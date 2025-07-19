const { Worker } = require('bullmq');
const pdfGenerator = require('../services/pdfGenerator');
const webhookService = require('../services/webhookService');
const pdfStorageService = require('../services/pdfStorageService');

// Parse Redis URL if provided
let connectionConfig;
if (process.env.REDIS_URL) {
  connectionConfig = process.env.REDIS_URL;
} else {
  connectionConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6380
  };
}

const worker = new Worker('pdf-generation', async (job) => {
  const { html, url, pageSize, orientation, webhookUrl } = job.data;
  
  try {
    // Marcar job como em processamento
    pdfStorageService.setJobProcessing(job.id);
    
    // Gerar PDF
    const pdfBuffer = await pdfGenerator.generate({
      html,
      url,
      pageSize,
      orientation
    });
    
    // Salvar PDF no storage
    await pdfStorageService.savePdf(job.id, pdfBuffer, {
      pageSize,
      orientation,
      sourceType: html ? 'html' : 'url',
      sourceLength: html ? html.length : undefined,
      sourceUrl: url,
      hasWebhook: !!webhookUrl
    });
    
    // Enviar webhook apenas se fornecido
    if (webhookUrl) {
      try {
        await webhookService.send({
          webhookUrl,
          jobId: job.id,
          status: 'completed',
          pdfBuffer
        });
        console.log(`Webhook enviado para job ${job.id}`);
      } catch (webhookError) {
        console.error(`Erro ao enviar webhook para job ${job.id}:`, webhookError.message);
        // Não falhar o job por erro de webhook
      }
    } else {
      console.log(`PDF gerado para job ${job.id} - webhook não configurado`);
    }
    
    return { success: true, size: pdfBuffer.length, webhookSent: !!webhookUrl };
  } catch (error) {
    // Marcar job como falha
    pdfStorageService.setJobFailed(job.id, error);
    
    // Enviar webhook de erro apenas se fornecido
    if (webhookUrl) {
      try {
        await webhookService.send({
          webhookUrl,
          jobId: job.id,
          status: 'failed',
          error: error.message
        });
      } catch (webhookError) {
        console.error(`Erro ao enviar webhook de falha para job ${job.id}:`, webhookError.message);
      }
    }
    
    throw error;
  }
}, {
  connection: connectionConfig,
  concurrency: 5
});

module.exports = worker;
