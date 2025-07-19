const pdfStorageService = require('../../services/pdfStorageService');
const pdfQueue = require('../../queue/pdfQueue');

async function getJobStatus(req, res) {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({ error: 'JobId é obrigatório' });
    }

    // Primeiro verificar no storage local
    const localJob = await pdfStorageService.getJobStatus(jobId);
    
    if (localJob.status !== 'not_found') {
      return res.json(localJob);
    }

    // Se não encontrado localmente, verificar na fila
    try {
      const job = await pdfQueue.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ 
          status: 'not_found', 
          message: 'Job não encontrado' 
        });
      }

      const jobStatus = await job.getState();
      
      return res.json({
        status: jobStatus,
        jobId: job.id,
        createdAt: new Date(job.timestamp),
        progress: job.progress,
        data: job.data
      });
    } catch (queueError) {
      return res.status(404).json({ 
        status: 'not_found', 
        message: 'Job não encontrado' 
      });
    }
  } catch (error) {
    console.error('Erro ao consultar status do job:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function downloadPdf(req, res) {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({ error: 'JobId é obrigatório' });
    }

    const result = await pdfStorageService.getPdf(jobId);
    
    if (result.status === 'not_found') {
      return res.status(404).json({ 
        error: 'PDF não encontrado',
        message: 'Job não encontrado ou PDF não foi gerado' 
      });
    }

    if (result.status === 'expired') {
      return res.status(410).json({ 
        error: 'PDF expirado',
        message: 'O PDF expirou e foi removido. Você pode gerar um novo PDF usando o mesmo conteúdo.',
        suggestion: 'Use o endpoint /api/regenerate com o mesmo jobId ou crie um novo job'
      });
    }

    if (result.status === 'completed') {
      // Configurar headers para download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('Content-Length', result.size);
      res.setHeader('Cache-Control', 'no-cache');
      
      return res.send(result.pdfBuffer);
    }

    return res.status(400).json({ 
      error: 'Status inválido',
      status: result.status 
    });
  } catch (error) {
    console.error('Erro ao fazer download do PDF:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function regeneratePdf(req, res) {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({ error: 'JobId é obrigatório' });
    }

    // Verificar se job existe na fila para obter dados originais
    try {
      const originalJob = await pdfQueue.getJob(jobId);
      
      if (!originalJob) {
        return res.status(404).json({ 
          error: 'Job original não encontrado',
          message: 'Não é possível regenerar PDF sem os dados originais do job'
        });
      }

      const { html, url, pageSize, orientation, webhookUrl } = originalJob.data;
      
      // Criar novo job com os mesmos dados
      const newJobId = `${jobId}-regen-${Date.now()}`;
      await pdfQueue.add('generate-pdf', {
        html,
        url,
        pageSize,
        orientation,
        webhookUrl
      }, {
        jobId: newJobId
      });
      
      res.json({
        newJobId,
        originalJobId: jobId,
        status: 'queued',
        message: 'PDF será regenerado com um novo jobId'
      });
    } catch (queueError) {
      return res.status(404).json({ 
        error: 'Job original não encontrado',
        message: 'Não é possível regenerar PDF sem os dados originais do job'
      });
    }
  } catch (error) {
    console.error('Erro ao regenerar PDF:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function getStorageStats(req, res) {
  try {
    const stats = pdfStorageService.getStats();
    const driverInfo = pdfStorageService.getDriverInfo();
    
    res.json({
      ...stats,
      expirationSeconds: process.env.PDF_EXPIRATION_SECONDS || 86400,
      storageDir: process.env.PDF_STORAGE_DIR || './pdfs',
      driver: driverInfo
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function getPresignedUrl(req, res) {
  try {
    const { jobId } = req.params;
    const expiresIn = parseInt(req.query.expiresIn) || 3600; // 1 hora por padrão
    
    if (!jobId) {
      return res.status(400).json({ error: 'JobId é obrigatório' });
    }

    // Verificar se o driver suporta URLs pré-assinadas
    const driverInfo = pdfStorageService.getDriverInfo();
    if (!driverInfo.supportsPresignedUrls) {
      return res.status(400).json({ 
        error: 'URLs pré-assinadas não suportadas',
        message: `O driver atual (${driverInfo.type}) não suporta URLs pré-assinadas. Use o driver S3.`
      });
    }

    try {
      const presignedUrl = await pdfStorageService.getPresignedUrl(jobId, expiresIn);
      
      res.json({
        jobId,
        presignedUrl,
        expiresIn,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        message: 'URL pré-assinada gerada com sucesso'
      });
    } catch (error) {
      if (error.message.includes('não encontrado')) {
        return res.status(404).json({ 
          error: 'Job não encontrado',
          message: error.message
        });
      }
      
      if (error.message.includes('expirado')) {
        return res.status(410).json({ 
          error: 'PDF expirado',
          message: error.message
        });
      }
      
      throw error;
    }
  } catch (error) {
    console.error('Erro ao gerar URL pré-assinada:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function getDriverInfo(req, res) {
  try {
    const driverInfo = pdfStorageService.getDriverInfo();
    
    res.json({
      ...driverInfo,
      configuration: {
        expirationSeconds: process.env.PDF_EXPIRATION_SECONDS || 86400,
        ...(driverInfo.type === 'local' && {
          storageDir: process.env.PDF_STORAGE_DIR || './pdfs'
        }),
        ...(driverInfo.type === 's3' && {
          bucket: process.env.AWS_S3_BUCKET || 'htmltopdf-storage',
          region: process.env.AWS_REGION || 'us-east-1',
          prefix: process.env.AWS_S3_PREFIX || 'pdfs/'
        })
      }
    });
  } catch (error) {
    console.error('Erro ao obter informações do driver:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

module.exports = { 
  getJobStatus, 
  downloadPdf, 
  regeneratePdf, 
  getStorageStats,
  getPresignedUrl,
  getDriverInfo
};
