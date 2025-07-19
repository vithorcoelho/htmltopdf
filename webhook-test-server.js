const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3001;

// Configurar multer para receber arquivos
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

// Middleware para JSON
app.use(express.json());

// Diretório para salvar PDFs recebidos (para teste)
const WEBHOOK_PDFS_DIR = path.join(__dirname, 'webhook-pdfs');

// Criar diretório se não existir
async function ensureWebhookDir() {
  try {
    await fs.mkdir(WEBHOOK_PDFS_DIR, { recursive: true });
    console.log(`📁 Diretório criado: ${WEBHOOK_PDFS_DIR}`);
  } catch (error) {
    console.error('Erro ao criar diretório:', error.message);
  }
}

// Webhook endpoint para receber notificações e PDFs
app.post('/webhook', upload.single('file'), async (req, res) => {
  const timestamp = new Date().toISOString();
  
  console.log(`\n📡 [${timestamp}] Webhook chamado`);
  console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));
  
  // Se tem arquivo, é o PDF sendo enviado
  if (req.file) {
    console.log('📄 PDF recebido!');
    console.log(`   Tamanho: ${Math.round(req.file.size / 1024)}KB`);
    console.log(`   Nome original: ${req.file.originalname}`);
    console.log(`   Tipo: ${req.file.mimetype}`);
    
    // Dados adicionais do formulário
    console.log('📊 Dados do formulário:');
    Object.keys(req.body).forEach(key => {
      console.log(`   ${key}: ${req.body[key]}`);
    });
    
    // Salvar PDF para inspeção
    try {
      const filename = `received-${Date.now()}.pdf`;
      const filepath = path.join(WEBHOOK_PDFS_DIR, filename);
      
      await fs.writeFile(filepath, req.file.buffer);
      console.log(`💾 PDF salvo em: ${filepath}`);
      
      // Log de sucesso
      console.log('✅ PDF processado com sucesso!');
      
    } catch (error) {
      console.error('❌ Erro ao salvar PDF:', error.message);
    }
    
  } else {
    // É uma notificação de status
    console.log('📢 Notificação de status recebida:');
    console.log(JSON.stringify(req.body, null, 2));
    
    // Verificar se é a validação inicial
    if (req.body.status === 'Geração do PDF iniciada') {
      console.log('🔄 Validação inicial - PDF será gerado');
    } else if (req.body.status === 'Gerado com sucesso') {
      console.log('🎉 PDF foi gerado com sucesso!');
    } else if (req.body.error) {
      console.log('❌ Erro reportado:', req.body.error);
    }
  }
  
  // Sempre responder com 200 para aceitar o webhook
  res.status(200).json({
    message: 'Webhook recebido com sucesso',
    timestamp: timestamp,
    hasFile: !!req.file,
    bodyKeys: Object.keys(req.body)
  });
});

// Endpoint para listar PDFs recebidos
app.get('/pdfs', async (req, res) => {
  try {
    const files = await fs.readdir(WEBHOOK_PDFS_DIR);
    const pdfFiles = files.filter(file => file.endsWith('.pdf'));
    
    const fileDetails = await Promise.all(
      pdfFiles.map(async (filename) => {
        const filepath = path.join(WEBHOOK_PDFS_DIR, filename);
        const stats = await fs.stat(filepath);
        return {
          filename,
          size: `${Math.round(stats.size / 1024)}KB`,
          created: stats.birthtime.toISOString(),
          downloadUrl: `/download/${filename}`
        };
      })
    );
    
    res.json({
      message: 'PDFs recebidos via webhook',
      count: pdfFiles.length,
      files: fileDetails
    });
  } catch (error) {
    res.status(500).json({
      error: 'Erro ao listar PDFs',
      details: error.message
    });
  }
});

// Endpoint para download de PDFs recebidos
app.get('/download/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    
    // Validar nome do arquivo por segurança
    if (!filename.endsWith('.pdf') || filename.includes('..')) {
      return res.status(400).json({ error: 'Nome de arquivo inválido' });
    }
    
    const filepath = path.join(WEBHOOK_PDFS_DIR, filename);
    
    // Verificar se arquivo existe
    try {
      await fs.access(filepath);
    } catch {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }
    
    // Enviar arquivo
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const fileBuffer = await fs.readFile(filepath);
    res.send(fileBuffer);
    
  } catch (error) {
    res.status(500).json({
      error: 'Erro ao fazer download',
      details: error.message
    });
  }
});

// Endpoint de status do webhook
app.get('/status', (req, res) => {
  res.json({
    message: 'Webhook de teste ativo',
    port: PORT,
    endpoints: {
      webhook: `http://localhost:${PORT}/webhook`,
      listPdfs: `http://localhost:${PORT}/pdfs`,
      downloadPdf: `http://localhost:${PORT}/download/{filename}`,
      status: `http://localhost:${PORT}/status`
    },
    webhookDir: WEBHOOK_PDFS_DIR
  });
});

// Inicializar servidor
async function startWebhookServer() {
  await ensureWebhookDir();
  
  app.listen(PORT, () => {
    console.log(`🚀 Webhook de teste rodando na porta ${PORT}`);
    console.log(`📡 Endpoint do webhook: http://localhost:${PORT}/webhook`);
    console.log(`📋 Status: http://localhost:${PORT}/status`);
    console.log(`📄 Listar PDFs: http://localhost:${PORT}/pdfs`);
    console.log(`💾 PDFs salvos em: ${WEBHOOK_PDFS_DIR}`);
    console.log('\n📝 Para testar, use este webhook URL: http://localhost:3001/webhook');
  });
}

// Tratar erros do multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'Arquivo muito grande',
        details: 'Tamanho máximo permitido: 50MB'
      });
    }
  }
  
  console.error('Erro no webhook:', error);
  res.status(500).json({
    error: 'Erro interno do webhook',
    details: error.message
  });
});

startWebhookServer();
