const pdfQueue = require('../../queue/pdfQueue');
const { v4: uuidv4 } = require('uuid');

async function generatePdf(req, res) {
  try {
    const { html, url, pageSize = 'A4', orientation = 'portrait', webhookUrl } = req.body;
    
    // Validações
    if (!html && !url) {
      return res.status(400).json({ error: 'HTML ou URL deve ser fornecido' });
    }
    
    // webhookUrl agora é opcional
    
    // Criar job na fila
    const jobId = uuidv4();
    await pdfQueue.add('generate-pdf', {
      html,
      url,
      pageSize,
      orientation,
      webhookUrl // pode ser undefined
    }, {
      jobId
    });
    
    res.json({
      jobId,
      status: 'queued',
      message: webhookUrl ? 'PDF será gerado e notificado via webhook' : 'PDF será gerado e ficará disponível para download'
    });
  } catch (error) {
    console.error('Erro ao criar job:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

module.exports = { generatePdf };
