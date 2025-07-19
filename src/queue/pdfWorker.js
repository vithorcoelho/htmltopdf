const { Worker } = require('bullmq');
const pdfGenerator = require('../services/pdfGenerator');
const webhookService = require('../services/webhookService');
const pdfStorageService = require('../services/pdfStorageService');

console.log('🔄 Inicializando worker PDF...');

// Validação das variáveis de ambiente
if (!process.env.REDIS_HOST && !process.env.REDIS_URL) {
  throw new Error('❌ REDIS_HOST ou REDIS_URL deve estar definido no arquivo .env');
}

if (!process.env.REDIS_PORT && !process.env.REDIS_URL) {
  throw new Error('❌ REDIS_PORT deve estar definido no arquivo .env quando REDIS_URL não for usado');
}

// Configuração de conexão Redis
let connectionConfig;
if (process.env.REDIS_URL) {
  connectionConfig = process.env.REDIS_URL;
  console.log('📍 Worker usando REDIS_URL:', process.env.REDIS_URL);
} else {
  connectionConfig = {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT, 10)
  };
  console.log('📍 Worker usando configuração Redis:', {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  });
}

let worker;

try {
  console.log('🚀 Criando worker PDF...');
  
  worker = new Worker('pdf-generation', async (job) => {
    console.log(`🎯 Processando job ${job.id}`);
    const { html, url, pageSize, orientation, webhookUrl } = job.data;
    
    try {
      // Marcar job como em processamento
      pdfStorageService.setJobProcessing(job.id);
      
      // Gerar PDF
      console.log(`📄 Gerando PDF para job ${job.id}...`);
      const pdfBuffer = await pdfGenerator.generate({
        html,
        url,
        pageSize,
        orientation
      });
      
      // Salvar PDF no storage
      console.log(`💾 Salvando PDF para job ${job.id}...`);
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
          console.log(`🔔 Enviando webhook para job ${job.id}...`);
          await webhookService.send({
            webhookUrl,
            jobId: job.id,
            status: 'completed',
            pdfBuffer
          });
          console.log(`✅ Webhook enviado com sucesso para job ${job.id}`);
        } catch (webhookError) {
          console.error(`❌ Erro ao enviar webhook para job ${job.id}:`, webhookError.message);
          console.error('Stack trace:', webhookError.stack);
          // Não falhar o job por erro de webhook
        }
      } else {
        console.log(`✅ PDF gerado para job ${job.id} - webhook não configurado`);
      }
      
      console.log(`🎉 Job ${job.id} processado com sucesso`);
      return { success: true, size: pdfBuffer.length, webhookSent: !!webhookUrl };
    } catch (error) {
      console.error(`❌ Erro ao processar job ${job.id}:`, error.message);
      console.error('Stack trace:', error.stack);
      
      // Marcar job como falha
      pdfStorageService.setJobFailed(job.id, error);
      
      // Enviar webhook de erro apenas se fornecido
      if (webhookUrl) {
        try {
          console.log(`🔔 Enviando webhook de erro para job ${job.id}...`);
          await webhookService.send({
            webhookUrl,
            jobId: job.id,
            status: 'failed',
            error: error.message
          });
          console.log(`✅ Webhook de erro enviado para job ${job.id}`);
        } catch (webhookError) {
          console.error(`❌ Erro ao enviar webhook de falha para job ${job.id}:`, webhookError.message);
          console.error('Stack trace:', webhookError.stack);
        }
      }
      
      throw error;
    }
  }, {
    connection: connectionConfig,
    concurrency: 5
  });

  // Listeners para eventos do worker
  worker.on('completed', (job) => {
    console.log(`✅ Worker: Job ${job.id} completado com sucesso`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Worker: Job ${job?.id || 'unknown'} falhou:`, err.message);
  });

  worker.on('error', (error) => {
    console.error('❌ Erro no worker PDF:', error.message);
    console.error('Stack trace:', error.stack);
  });

  worker.on('ioredis:connect', () => {
    console.log('✅ Worker PDF conectado ao Redis com sucesso');
  });

  worker.on('ioredis:close', () => {
    console.log('⚠️ Conexão do worker PDF com Redis foi fechada');
  });

  worker.on('ioredis:reconnecting', () => {
    console.log('🔄 Worker tentando reconectar ao Redis...');
  });

  console.log('✅ Worker PDF configurado com sucesso');

} catch (error) {
  console.error('❌ Erro ao criar worker PDF:', error.message);
  console.error('Stack trace:', error.stack);
  throw error;
}

module.exports = worker;
