const { Queue } = require('bullmq');

console.log('🔄 Inicializando configuração da fila PDF...');

// Validação das variáveis de ambiente
if (!process.env.REDIS_HOST && !process.env.REDIS_URL) {
  throw new Error('❌ REDIS_HOST ou REDIS_URL deve estar definido no arquivo .env');
}

if (!process.env.REDIS_PORT && !process.env.REDIS_URL) {
  throw new Error('❌ REDIS_PORT deve estar definido no arquivo .env quando REDIS_URL não for usado');
}

// Configurações da fila com valores do .env
const removeOnComplete = parseInt(process.env.QUEUE_REMOVE_ON_COMPLETE, 10) || 50;
const removeOnFail = parseInt(process.env.QUEUE_REMOVE_ON_FAIL, 10) || 20;

console.log('⚙️ Configurações da fila:');
console.log(`  - Manter jobs completados: ${removeOnComplete}`);
console.log(`  - Manter jobs falhados: ${removeOnFail}`);

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
  console.log('🚀 Criando fila PDF...');
  
  pdfQueue = new Queue('pdf-generation', {
    connection: connectionConfig,
    defaultJobOptions: {
      removeOnComplete: removeOnComplete, // Configurável via .env
      removeOnFail: removeOnFail,         // Configurável via .env
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
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

  console.log('✅ Fila PDF configurada com sucesso');

} catch (error) {
  console.error('❌ Erro ao criar fila PDF:', error.message);
  console.error('Stack trace:', error.stack);
  throw error;
}

module.exports = pdfQueue;
