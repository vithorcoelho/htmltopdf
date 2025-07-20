const pdfQueue = require('../../queue/pdfQueue');

/**
 * Consulta status de job na fila (apenas para generate-url)
 */
async function getJobStatus(req, res) {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({ error: 'JobId é obrigatório' });
    }

    // Verificar job na fila
    try {
      const job = await pdfQueue.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ 
          status: 'not_found', 
          message: 'Job não encontrado',
          jobId: jobId
        });
      }

      const jobState = await job.getState();
      const jobProgress = job.progress || 0;
      
      // Mapear estados da fila para estados simplificados
      let status = jobState;
      let message = 'Job em processamento';
      
      switch (jobState) {
        case 'waiting':
          status = 'queued';
          message = 'Job aguardando processamento';
          break;
        case 'active':
          status = 'processing';
          message = 'Gerando PDF...';
          break;
        case 'completed':
          status = 'completed';
          message = 'PDF gerado e enviado via webhook';
          break;
        case 'failed':
          status = 'failed';
          message = job.failedReason || 'Erro ao gerar PDF';
          break;
        case 'delayed':
          status = 'queued';
          message = 'Job agendado';
          break;
      }
      
      const response = {
        status: status,
        jobId: job.id,
        createdAt: new Date(job.timestamp),
        progress: jobProgress,
        message: message
      };

      // Adicionar dados extras se disponíveis
      if (job.data) {
        response.url = job.data.url;
        response.webhook = job.data.webhook;
        response.pageSize = job.data.pageSize;
        response.orientation = job.data.orientation;
      }

      // Adicionar informações de erro se job falhou
      if (jobState === 'failed' && job.failedReason) {
        response.error = job.failedReason;
      }

      // Adicionar resultado se job completou
      if (jobState === 'completed' && job.returnvalue) {
        response.result = {
          success: job.returnvalue.success,
          size: job.returnvalue.size,
          webhookSent: job.returnvalue.webhookSent
        };
      }

      return res.json(response);
      
    } catch (queueError) {
      console.error('Erro ao consultar job na fila:', queueError.message);
      return res.status(404).json({ 
        status: 'not_found', 
        message: 'Job não encontrado na fila',
        jobId: jobId
      });
    }
  } catch (error) {
    console.error('Erro ao consultar status do job:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Falha ao consultar status do job'
    });
  }
}

module.exports = { 
  getJobStatus
};
