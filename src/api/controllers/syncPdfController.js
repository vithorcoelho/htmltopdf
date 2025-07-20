const pdfHtmlGenerator = require('../../services/pdfHtmlGenerator');
const { v4: uuidv4 } = require('uuid');

async function generatePdfSync(req, res) {
  try {
    const { html, pageSize = 'A4', orientation = 'portrait' } = req.body;
    
    // Verificar se deve retornar o arquivo diretamente ou JSON
    const returnFile = req.headers['accept'] === 'application/pdf' || req.query.download === 'true';
    
    // Limite máximo de tamanho do HTML (em bytes) - lido dinamicamente
    const MAX_HTML_SIZE = parseInt(process.env.SYNC_PDF_MAX_HTML_SIZE) || 51200; // 50KB por padrão
    
    // Validações
    if (!html) {
      return res.status(400).json({ 
        error: 'HTML é obrigatório para o endpoint síncrono' 
      });
    }

    // Verificar limite de tamanho do HTML
    const htmlSize = Buffer.byteLength(html, 'utf8');
    if (htmlSize > MAX_HTML_SIZE) {
      return res.status(413).json({ 
        error: `HTML muito grande. Tamanho máximo permitido: ${Math.round(MAX_HTML_SIZE / 1024)}KB. Tamanho atual: ${Math.round(htmlSize / 1024)}KB`,
        maxSize: MAX_HTML_SIZE,
        currentSize: htmlSize
      });
    }

    // Gerar PDF diretamente (síncrono)
    const pdfBuffer = await pdfHtmlGenerator.generateFromHtml({
      html,
      pageSize,
      orientation
    });

    // Gerar ID único para o arquivo
    const fileId = uuidv4();
    const fileName = `sync_${fileId}.pdf`;

    // Se solicitado download direto, retornar o arquivo
    if (returnFile) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('X-File-ID', fileId);
      res.setHeader('X-HTML-Size', htmlSize);
      return res.send(pdfBuffer);
    }

    // Retornar resposta JSON com o PDF em base64 (para compatibilidade)
    res.json({
      success: true,
      fileId,
      fileName,
      size: pdfBuffer.length,
      htmlSize,
      message: 'PDF gerado com sucesso',
      pdfBase64: pdfBuffer.toString('base64') // PDF diretamente na resposta
    });

  } catch (error) {
    console.error('Erro ao gerar PDF síncrono:', error);
    
    // Retornar erro mais específico baseado no tipo de erro
    if (error.message.includes('timeout') || error.message.includes('TimeoutError')) {
      return res.status(408).json({ 
        error: 'Timeout ao gerar PDF. Tente novamente com HTML menor ou use o endpoint assíncrono.',
        suggestion: 'Use o endpoint /api/generate para conteúdo maior'
      });
    }
    
    if (error.message.includes('memory') || error.message.includes('Memory')) {
      return res.status(413).json({ 
        error: 'HTML muito complexo para processamento síncrono. Use o endpoint assíncrono.',
        suggestion: 'Use o endpoint /api/generate para conteúdo mais complexo'
      });
    }

    res.status(500).json({ 
      error: 'Erro interno do servidor ao gerar PDF',
      message: error.message
    });
  }
}

module.exports = { generatePdfSync };
