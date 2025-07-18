require('dotenv').config();
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
// const bullBoardAdapter = require('./config/bullBoard'); // Descomentar na Fase 5
const pdfRoutes = require('./api/routes/pdfRoutes');
const { warmUp } = require('./services/browserPool');
const pdfStorageService = require('./services/pdfStorageService');
require('./queue/pdfWorker'); // Iniciar worker

const app = express();

app.use(express.json());

// Rotas
app.use('/api', pdfRoutes);

// Swagger
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Bull Board - Descomentar na Fase 5
// app.use('/admin/queues', bullBoardAdapter.getRouter());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

async function start() {
  try {
    console.log('Iniciando servidor...');
    await warmUp();
    
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`Servidor rodando na porta ${port}`);
      console.log(`Documentação: http://localhost:${port}/docs`);
      console.log(`Health check: http://localhost:${port}/health`);
      // console.log(`Bull Board: http://localhost:${port}/admin/queues`); // Descomentar na Fase 5
    });
  } catch (error) {
    console.error('Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

start().catch(console.error);
