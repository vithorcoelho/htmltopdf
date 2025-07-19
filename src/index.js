require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
// const bullBoardAdapter = require('./config/bullBoard'); // Descomentar na Fase 5
const pdfRoutes = require('./api/routes/pdfRoutes');
const { warmUp } = require('./services/browserPool');
const pdfStorageService = require('./services/pdfStorageService');
require('./queue/pdfWorker'); // Iniciar worker

const app = express();

// CORS - permitir todas as origens para desenvolvimento
app.use(cors({
  origin: true,
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json());

// Rotas
app.use('/api', pdfRoutes);

// Swagger com configuração customizada
const swaggerOptions = {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'HTML to PDF API',
  swaggerOptions: {
    persistAuthorization: true,
    tryItOutEnabled: true,
    filter: true,
    defaultModelsExpandDepth: -1,
    docExpansion: 'none'
  }
};

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerOptions));

// Rota para acessar a especificação JSON do Swagger
app.get('/swagger.json', (req, res) => {
  res.json(swaggerSpec);
});

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
