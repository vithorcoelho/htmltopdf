// NOTA: Implementar apenas na Fase 5
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const pdfQueue = require('../queue/pdfQueue');

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(pdfQueue)],
  serverAdapter
});

module.exports = serverAdapter;
