const { Queue } = require('bullmq');

console.log('🔄 Inicializando configuração da fila PDF simplificada...');

// Validação das variáveis de ambiente
if (!process.env.REDIS_HOST && !process.env.REDIS_URL) {
  throw new Error('❌ REDIS_HOST ou REDIS_URL deve estar definido no arquivo .env');
}

if (!process.env.REDIS_PORT && !process.env.REDIS_URL) {
  throw new Error('❌ REDIS_PORT deve estar definido no arquivo .env quando REDIS_URL não for usado');
}

// Configurações da fila com valores do .env
const removeOnComplete = parseInt(process.env.QUEUE_REMOVE_ON_COMPLETE, 10) || 10; // Reduzido
const removeOnFail = parseInt(process.env.QUEUE_REMOVE_ON_FAIL, 10) || 5; // Reduzido

console.log('⚙️ Configurações da fila simplificada:');
console.log(`  - Manter jobs completados: ${removeOnComplete}`);
console.log(`  - Manter jobs falhados: ${removeOnFail}`);
console.log(`  - Sem armazenamento de arquivos`);

// Configuração de conexão Redis
let connectionConfig;
if (process.env.REDIS_URL) {
  connectionConfig = process.env.REDIS_URL;
  console.log('📍 Usando REDIS_URL:', process.env.REDIS_URL);
} else {
  connectionConfig = {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT, 10)
  };
  console.log('📍 Usando configuração Redis:', {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  });
}

let pdfQueue;

try {
  console.log('🚀 Criando fila PDF simplificada...');
  
  pdfQueue = new Queue('pdf-url-generation', { // Nome mais específico
    connection: connectionConfig,
    defaultJobOptions: {
      removeOnComplete: removeOnComplete,
      removeOnFail: removeOnFail,
      attempts: 2, // Reduzido
      backoff: {
        type: 'exponential',
        delay: 1000 // Reduzido
      },
      // Jobs expiram em 5 minutos se não processados
      delay: 0,
      jobId: undefined // Permitir jobId customizado
    }
  });

  // Listeners para eventos de conexão
  pdfQueue.on('error', (error) => {
    console.error('❌ Erro na fila PDF:', error.message);
    console.error('Stack trace:', error.stack);
  });

  pdfQueue.on('ioredis:connect', () => {
    console.log('✅ Fila PDF conectada ao Redis com sucesso');
  });

  pdfQueue.on('ioredis:close', () => {
    console.log('⚠️ Conexão da fila PDF com Redis foi fechada');
  });

  pdfQueue.on('ioredis:reconnecting', () => {
    console.log('🔄 Tentando reconectar fila PDF ao Redis...');
  });

  console.log('✅ Fila PDF simplificada configurada com sucesso');
  console.log('📋 Funcionalidades: geração de PDF via URL + webhook (sem armazenamento)');

} catch (error) {
  console.error('❌ Erro ao criar fila PDF:', error.message);
  console.error('Stack trace:', error.stack);
  throw error;
}

module.exports = pdfQueue;
