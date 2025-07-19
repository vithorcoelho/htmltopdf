const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');

console.log('🔄 Inicializando Bull Board...');

// Validação das variáveis de ambiente (indireto via pdfQueue)
let pdfQueue;
try {
  pdfQueue = require('../queue/pdfQueue');
  console.log('✅ Fila PDF carregada para Bull Board');
} catch (error) {
  console.error('❌ Erro ao carregar fila PDF para Bull Board:', error.message);
  console.error('Stack trace:', error.stack);
  throw error;
}

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/bullboard');

// Configuração do Bull Board com debugging
let bullBoardConfig;
try {
  console.log('🚀 Criando Bull Board...');
  
  const { addQueue, removeQueue, replaceQueues } = createBullBoard({
    queues: [new BullMQAdapter(pdfQueue)],
    serverAdapter,
    options: {
      uiConfig: {
        boardTitle: 'PDF Generation Dashboard',
        boardLogo: {
          path: 'https://cdn.jsdelivr.net/npm/@bull-board/ui/dist/assets/logo.svg',
          width: '100px',
          height: 'auto'
        },
        miscLinks: [{
          text: 'API Docs',
          url: '/docs'
        }]
      }
    }
  });

  bullBoardConfig = { addQueue, removeQueue, replaceQueues };
  
  console.log('✅ Bull Board configurado com sucesso');
  console.log('📍 Fila monitorada:', pdfQueue.name);
  console.log('📍 Redis config:', pdfQueue.opts.connection);
  console.log('📍 Acesso via: /bullboard');

} catch (error) {
  console.error('❌ Erro ao configurar Bull Board:', error.message);
  console.error('Stack trace:', error.stack);
  throw error;
}

module.exports = serverAdapter;
