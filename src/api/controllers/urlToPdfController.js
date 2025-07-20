const pdfQueue = require('../../queue/pdfQueue');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

/**
 * Gera PDF a partir de URL com validação síncrona de webhook
 * Usa fila para processamento assíncrono - sem armazenamento de arquivos
 */
async function generatePdfFromUrl(req, res) {
  const { url, webhook, pageSize = 'A4', orientation = 'portrait' } = req.body;

  // Validação básica
  if (!url || !webhook) {
    return res.status(400).json({
      error: 'URL e webhook são obrigatórios',
      example: {
        url: 'https://example.com',
        webhook: 'https://meusite.com/webhook'
      }
    });
  }

  // Validar formato das URLs
  try {
    new URL(url);
    new URL(webhook);
  } catch (error) {
    return res.status(400).json({
      error: 'URL ou webhook inválido',
      details: error.message
    });
  }

  console.log(`Iniciando validação para URL: ${url}`);
  console.log(`Webhook: ${webhook}`);

  // VALIDAÇÃO SÍNCRONA DO WEBHOOK (timeout de 2 segundos)
  try {
    console.log('Validando webhook de forma síncrona...');
    
    const webhookValidationResponse = await axios.post(webhook, {
      status: 'processing'
    }, {
      timeout: 2000, // 2 segundos
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'HTMLtoPDF-Service/1.0'
      }
    });

    if (webhookValidationResponse.status !== 200) {
      return res.status(400).json({
        error: 'Webhook inválido',
        details: `Webhook retornou status ${webhookValidationResponse.status}`,
        webhookUrl: webhook
      });
    }

    console.log('Webhook validado com sucesso');

  } catch (webhookError) {
    console.error('Falha na validação do webhook:', webhookError.message);
    
    // Determinar tipo de erro para resposta mais específica
    let errorMessage = 'Webhook não respondeu';
    let errorDetails = webhookError.message;
    
    if (webhookError.code === 'ECONNABORTED') {
      errorMessage = 'Timeout na validação do webhook';
      errorDetails = 'Webhook deve responder em até 2 segundos';
    } else if (webhookError.code === 'ECONNREFUSED') {
      errorMessage = 'Webhook inacessível';
      errorDetails = 'Não foi possível conectar ao webhook';
    } else if (webhookError.response) {
      errorMessage = 'Webhook retornou erro';
      errorDetails = `Status ${webhookError.response.status}: ${webhookError.response.statusText}`;
    }
    
    return res.status(400).json({
      error: errorMessage,
      details: errorDetails,
      webhookUrl: webhook,
      timeout: '2 segundos',
      suggestion: 'Verifique se o webhook está ativo e responde rapidamente'
    });
  }

  // Webhook validado - criar job na fila
  try {
    const jobId = uuidv4();
    
    await pdfQueue.add('generate-pdf-from-url', {
      url,
      webhook,
      pageSize,
      orientation
    }, {
      jobId,
      delay: 0,
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });

    console.log(`📝 Job ${jobId} criado na fila`);

    res.status(202).json({
      message: 'Webhook validado - PDF será gerado',
      jobId: jobId,
      url: url,
      webhook: webhook,
      status: 'queued',
      pageSize,
      orientation
    });

  } catch (queueError) {
    console.error('Erro ao criar job na fila:', queueError.message);
    
    return res.status(500).json({
      error: 'Erro interno do servidor',
      details: 'Falha ao criar job de processamento',
      suggestion: 'Tente novamente em alguns instantes'
    });
  }
}

module.exports = {
  generatePdfFromUrl
};