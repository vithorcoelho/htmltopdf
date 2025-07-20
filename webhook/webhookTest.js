const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3030;

// Middleware para JSON
app.use(express.json());

// Configurar multer para salvar arquivos na pasta upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'upload');
    // Criar diretório se não existir
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Gerar nome único com timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `pdf-${timestamp}-${file.originalname}`;
    cb(null, filename);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Aceitar apenas PDFs
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos PDF são aceitos'), false);
    }
  }
});

// Array para armazenar histórico de requisições
let requestHistory = [];

// Endpoint principal do webhook
app.post('/webhook', upload.single('file'), (req, res) => {
  const timestamp = new Date().toISOString();
  
  console.log(`\n🔔 [${timestamp}] Webhook recebido:`);
  console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));
  console.log('📄 Body:', JSON.stringify(req.body, null, 2));
  
  // Registrar no histórico
  const requestData = {
    timestamp,
    method: req.method,
    headers: req.headers,
    body: req.body,
    file: null
  };

  // Se há arquivo, processar
  if (req.file) {
    console.log('📎 Arquivo recebido:');
    console.log(`   - Nome: ${req.file.filename}`);
    console.log(`   - Tamanho: ${(req.file.size / 1024).toFixed(2)} KB`);
    console.log(`   - Tipo: ${req.file.mimetype}`);
    console.log(`   - Salvo em: ${req.file.path}`);
    
    requestData.file = {
      originalname: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path
    };
  }

  // Adicionar ao histórico (manter apenas os últimos 50)
  requestHistory.unshift(requestData);
  if (requestHistory.length > 50) {
    requestHistory = requestHistory.slice(0, 50);
  }

  // Verificar se é validação inicial
  if (req.body.status === 'processing') {
    console.log('✅ Validação inicial - respondendo OK');
    return res.status(200).json({
      message: 'Webhook válido - pode prosseguir',
      timestamp: timestamp
    });
  }

  // Verificar se é notificação de erro
  if (req.body.status && req.body.status.includes('Falha')) {
    console.log('❌ Erro reportado:', req.body.error || req.body.details);
    return res.status(200).json({
      message: 'Erro recebido e registrado',
      timestamp: timestamp
    });
  }

  // Se chegou até aqui, é o PDF final
  if (req.file) {
    console.log('🎉 PDF recebido com sucesso!');
    return res.status(200).json({
      message: 'PDF recebido e salvo com sucesso',
      filename: req.file.filename,
      size: req.file.size,
      timestamp: timestamp
    });
  }

  // Resposta genérica
  console.log('📨 Notificação recebida');
  res.status(200).json({
    message: 'Notificação recebida',
    timestamp: timestamp
  });
});

// Endpoint para visualizar histórico
app.get('/history', (req, res) => {
  res.json({
    total: requestHistory.length,
    requests: requestHistory
  });
});

// Endpoint para listar arquivos salvos
app.get('/files', (req, res) => {
  const uploadDir = path.join(__dirname, 'upload');
  
  try {
    const files = fs.readdirSync(uploadDir).map(filename => {
      const filePath = path.join(uploadDir, filename);
      const stats = fs.statSync(filePath);
      
      return {
        filename,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        sizeFormatted: `${(stats.size / 1024).toFixed(2)} KB`
      };
    }).sort((a, b) => new Date(b.created) - new Date(a.created));

    res.json({
      total: files.length,
      files: files
    });
  } catch (error) {
    res.status(500).json({
      error: 'Erro ao listar arquivos',
      details: error.message
    });
  }
});

// Endpoint para download de arquivos
app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'upload', filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      error: 'Arquivo não encontrado',
      filename: filename
    });
  }

  res.download(filePath, filename, (err) => {
    if (err) {
      console.error('Erro no download:', err);
      res.status(500).json({
        error: 'Erro ao fazer download',
        details: err.message
      });
    }
  });
});

// Endpoint para limpar histórico
app.delete('/history', (req, res) => {
  requestHistory = [];
  res.json({ message: 'Histórico limpo' });
});

// Endpoint para limpar arquivos
app.delete('/files', (req, res) => {
  const uploadDir = path.join(__dirname, 'upload');
  
  try {
    const files = fs.readdirSync(uploadDir);
    files.forEach(file => {
      fs.unlinkSync(path.join(uploadDir, file));
    });
    
    res.json({ 
      message: `${files.length} arquivos removidos`,
      count: files.length 
    });
  } catch (error) {
    res.status(500).json({
      error: 'Erro ao limpar arquivos',
      details: error.message
    });
  }
});

// Endpoint para status do webhook
app.get('/status', (req, res) => {
  const uploadDir = path.join(__dirname, 'upload');
  let fileCount = 0;
  let totalSize = 0;

  try {
    const files = fs.readdirSync(uploadDir);
    fileCount = files.length;
    totalSize = files.reduce((total, file) => {
      const stats = fs.statSync(path.join(uploadDir, file));
      return total + stats.size;
    }, 0);
  } catch (error) {
    console.error('Erro ao calcular estatísticas:', error.message);
  }

  res.json({
    status: 'ativo',
    webhook_url: `http://localhost:${port}/webhook`,
    requests_received: requestHistory.length,
    files_saved: fileCount,
    total_size: totalSize,
    total_size_formatted: `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
    uptime: process.uptime(),
    endpoints: {
      webhook: '/webhook (POST)',
      history: '/history (GET)',
      files: '/files (GET)',
      download: '/download/:filename (GET)',
      status: '/status (GET)',
      clear_history: '/history (DELETE)',
      clear_files: '/files (DELETE)'
    }
  });
});

// Página inicial com instruções
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Webhook Test Server</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
            .endpoint { background: #f4f4f4; padding: 10px; margin: 10px 0; border-radius: 5px; }
            .method { font-weight: bold; color: #0066cc; }
        </style>
    </head>
    <body>
        <h1>🔗 Webhook Test Server</h1>
        <p>Servidor rodando na porta <strong>${port}</strong></p>
        
        <h2>📡 URL do Webhook:</h2>
        <div class="endpoint">
            <code>http://localhost:${port}/webhook</code>
        </div>
        
        <h2>🛠️ Endpoints Disponíveis:</h2>
        
        <div class="endpoint">
            <span class="method">POST</span> /webhook - Receber PDFs e notificações
        </div>
        
        <div class="endpoint">
            <span class="method">GET</span> <a href="/status">/status</a> - Status do servidor
        </div>
        
        <div class="endpoint">
            <span class="method">GET</span> <a href="/history">/history</a> - Histórico de requisições
        </div>
        
        <div class="endpoint">
            <span class="method">GET</span> <a href="/files">/files</a> - Lista de arquivos salvos
        </div>
        
        <div class="endpoint">
            <span class="method">GET</span> /download/:filename - Download de arquivo
        </div>
        
        <div class="endpoint">
            <span class="method">DELETE</span> /history - Limpar histórico
        </div>
        
        <div class="endpoint">
            <span class="method">DELETE</span> /files - Limpar arquivos
        </div>
        
        <h2>🧪 Como testar:</h2>
        <ol>
            <li>Use a URL <code>http://localhost:${port}/webhook</code> na sua API</li>
            <li>Os PDFs serão salvos na pasta <code>upload/</code></li>
            <li>Monitore o console para ver as requisições em tempo real</li>
            <li>Use <code>/history</code> para ver todas as requisições recebidas</li>
        </ol>
    </body>
    </html>
  `);
});

// Error handler para multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'Arquivo muito grande',
        details: 'Tamanho máximo permitido: 50MB'
      });
    }
  }
  
  console.error('Erro no webhook:', error.message);
  res.status(500).json({
    error: 'Erro interno do webhook',
    details: error.message
  });
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`🚀 Webhook Test Server rodando na porta ${port}`);
  console.log(`📡 URL do webhook: http://localhost:${port}/webhook`);
  console.log(`🌐 Interface web: http://localhost:${port}`);
  console.log(`📁 Arquivos serão salvos em: ${path.join(__dirname, 'upload')}`);
  console.log(`\n💡 Dica: Use http://localhost:${port}/webhook como webhook na sua API\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n📴 Encerrando webhook test server...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n📴 Encerrando webhook test server...');
  process.exit(0);
});
