const { Worker } = require('bullmq');
const webhookService = require('../services/webhookService');
const pdfUrlGenerator = require('../services/pdfUrlGenerator');

console.log('🔄 Inicializando worker PDF simplificado...');

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
  
  worker = new Worker('pdf-url-generation', async (job) => {
    console.log(`🎯 Processando job URL-to-PDF ${job.id}`);
    const { url, webhook, pageSize = 'A4', orientation = 'portrait' } = job.data;
    
    if (!url || !webhook) {
      throw new Error('URL e webhook são obrigatórios');
    }
    
    try {
      // Gerar PDF a partir da URL
      console.log(`📄 Gerando PDF de URL para job ${job.id}...`);
      const pdfBuffer = await pdfUrlGenerator.generateFromUrl({
        url,
        pageSize,
        orientation
      });

      console.log(`✅ PDF gerado - Tamanho: ${Math.round(pdfBuffer.length / 1024)}KB`);

      // Verificar tamanho limite (10MB)
      const maxSizeBytes = 10 * 1024 * 1024;
      if (pdfBuffer.length > maxSizeBytes) {
        console.warn(`⚠️ PDF muito grande: ${Math.round(pdfBuffer.length / 1024 / 1024)}MB`);
        
        // Enviar webhook de erro por tamanho
        await webhookService.sendNotification({
          webhookUrl: webhook,
          data: {
            jobId: job.id,
            status: 'Arquivo muito grande',
            error: `PDF gerado é muito grande (${Math.round(pdfBuffer.length / 1024 / 1024)}MB). Limite: 10MB`,
            url: url
          }
        });
        
        return { success: false, error: 'PDF muito grande', size: pdfBuffer.length };
      }

      // Enviar PDF via webhook
      console.log(`📤 Enviando PDF via webhook para job ${job.id}...`);
      await webhookService.sendPdf({
        webhookUrl: webhook,
        pdfBuffer,
        jobId: job.id,
        metadata: {
          url,
          pageSize,
          orientation,
          generatedAt: new Date().toISOString()
        }
      });
      
      console.log(`🎉 Job ${job.id} processado e enviado com sucesso`);
      return { 
        success: true, 
        size: pdfBuffer.length,
        url: url,
        webhookSent: true 
      };
      
    } catch (error) {
      console.error(`❌ Erro ao processar job ${job.id}:`, error.message);
      
      // Enviar webhook de erro
      try {
        await webhookService.sendNotification({
          webhookUrl: webhook,
          data: {
            jobId: job.id,
            status: 'Falha ao gerar',
            error: error.message,
            url: url
          }
        });
        console.log(`📡 Webhook de erro enviado para job ${job.id}`);
      } catch (webhookError) {
        console.error(`❌ Erro ao enviar webhook de falha para job ${job.id}:`, webhookError.message);
      }
      
      throw error;
    }
  }, {
    connection: connectionConfig,
    concurrency: 3, // Reduzido
    settings: {
      retryProcessDelay: 2000,
      maxStalledCount: 1,
      stalledInterval: 30000
    },
    removeOnComplete: parseInt(process.env.QUEUE_REMOVE_ON_COMPLETE) || 10,
    removeOnFail: parseInt(process.env.QUEUE_REMOVE_ON_FAIL) || 5,
    // Timeout de 3 minutos por job
    jobsOpts: {
      removeOnComplete: parseInt(process.env.QUEUE_REMOVE_ON_COMPLETE) || 10,
      removeOnFail: parseInt(process.env.QUEUE_REMOVE_ON_FAIL) || 5,
      delay: 0,
      attempts: 2, // Reduzido
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    }
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

  console.log('✅ Worker PDF simplificado configurado com sucesso');
  console.log('📋 Funcionalidades: processamento de URL-to-PDF com webhook');

} catch (error) {
  console.error('❌ Erro ao criar worker PDF:', error.message);
  console.error('Stack trace:', error.stack);
  throw error;
}

module.exports = worker;
