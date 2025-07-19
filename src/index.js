require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const bullBoardAdapter = require('./config/bullBoard');
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

// Configurar limite de payload para o endpoint síncrono
const maxSyncPayload = parseInt(process.env.SYNC_PDF_MAX_HTML_SIZE) || 51200;
app.use(express.json({ 
  limit: Math.max(maxSyncPayload * 2, 1024 * 1024) // Pelo menos 1MB ou 2x o limite do sync
}));

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

// Bull Board - Interface de monitoramento das filas (com autenticação)
app.use('/bullboard', (req, res, next) => {
  // Verificar se há autenticação básica
  const auth = req.headers.authorization;
  
  console.log('🔐 Tentativa de acesso ao Bull Board:');
  console.log('  - Authorization header:', auth);
  
  if (!auth || !auth.startsWith('Basic ')) {
    console.log('  - ❌ Header de autorização ausente ou inválido');
    res.set('WWW-Authenticate', 'Basic realm="Bull Board"');
    return res.status(401).send('Autenticação necessária para acessar Bull Board');
  }
  
  // Decodificar credenciais
  try {
    const credentials = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
    const username = credentials[0];
    const password = credentials[1];
    
    console.log('  - Usuário fornecido:', username);
    console.log('  - Senha fornecida:', password ? '[OCULTA]' : 'vazia');
    
    // Verificar credenciais (configuráveis via .env)
    const validUsername = process.env.BULLBOARD_USERNAME || 'admin';
    const validPassword = process.env.BULLBOARD_PASSWORD || 'admin123';
    
    console.log('  - Usuário esperado:', validUsername);
    console.log('  - Senha esperada:', validPassword ? '[OCULTA]' : 'vazia');
    
    if (username === validUsername && password === validPassword) {
      console.log('  - ✅ Credenciais válidas, acesso liberado');
      next(); // Credenciais válidas, continuar
    } else {
      console.log('  - ❌ Credenciais inválidas');
      console.log(`    - Username match: ${username === validUsername}`);
      console.log(`    - Password match: ${password === validPassword}`);
      res.set('WWW-Authenticate', 'Basic realm="Bull Board"');
      return res.status(401).send('Credenciais inválidas');
    }
  } catch (error) {
    console.log('  - ❌ Erro ao decodificar credenciais:', error.message);
    res.set('WWW-Authenticate', 'Basic realm="Bull Board"');
    return res.status(401).send('Erro na autenticação');
  }
}, bullBoardAdapter.getRouter());

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
