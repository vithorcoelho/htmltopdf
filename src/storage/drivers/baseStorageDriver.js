/**
 * Interface base para drivers de armazenamento
 * Todos os drivers devem implementar estes métodos
 */
class BaseStorageDriver {
  constructor(config = {}) {
    this.config = config;
    this.expirationSeconds = parseInt(process.env.PDF_EXPIRATION_SECONDS) || 86400; // 24 horas
    this.jobs = new Map(); // In-memory job tracking
  }

  /**
   * Inicializa o driver de storage
   */
  async init() {
    throw new Error('Method init() must be implemented');
  }

  /**
   * Salva um PDF
   * @param {string} jobId - ID do job
   * @param {Buffer} pdfBuffer - Buffer do PDF
   * @param {object} jobData - Dados adicionais do job
   * @returns {Promise<object>} - Informações do arquivo salvo
   */
  async savePdf(jobId, pdfBuffer, jobData = {}) {
    throw new Error('Method savePdf() must be implemented');
  }

  /**
   * Recupera um PDF
   * @param {string} jobId - ID do job
   * @returns {Promise<object>} - Dados do PDF ou status
   */
  async getPdf(jobId) {
    throw new Error('Method getPdf() must be implemented');
  }

  /**
   * Obtém o status de um job
   * @param {string} jobId - ID do job
   * @returns {Promise<object>} - Status do job
   */
  async getJobStatus(jobId) {
    const job = this.jobs.get(jobId);
    
    if (!job) {
      return { status: 'not_found', message: 'Job não encontrado' };
    }

    // Verificar se expirou
    if (new Date() > job.expiresAt) {
      await this.deletePdf(jobId);
      return { status: 'expired', message: 'PDF expirado' };
    }

    return {
      status: job.status,
      jobId,
      createdAt: job.createdAt,
      expiresAt: job.expiresAt,
      size: job.size,
      filename: job.filename
    };
  }

  /**
   * Marca um job como falha
   * @param {string} jobId - ID do job
   * @param {Error} error - Erro ocorrido
   */
  setJobFailed(jobId, error) {
    this.jobs.set(jobId, {
      status: 'failed',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.expirationSeconds * 1000),
      error: error.message || error
    });
  }

  /**
   * Marca um job como processando
   * @param {string} jobId - ID do job
   */
  setJobProcessing(jobId) {
    this.jobs.set(jobId, {
      status: 'processing',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.expirationSeconds * 1000)
    });
  }

  /**
   * Remove um PDF
   * @param {string} jobId - ID do job
   */
  async deletePdf(jobId) {
    throw new Error('Method deletePdf() must be implemented');
  }

  /**
   * Limpa PDFs expirados
   */
  async cleanExpiredPdfs() {
    const now = new Date();
    console.log(`🧹 Verificando PDFs expirados em ${now.toLocaleTimeString()}...`);
    let cleaned = 0;
    
    for (const [jobId, job] of this.jobs.entries()) {
      const secondsAlive = Math.floor((now - job.createdAt) / 1000);
      const isExpired = now > job.expiresAt;
      
      if (isExpired) {
        console.log(`❌ PDF expirado: ${jobId} (${secondsAlive}s de vida, limite: ${this.expirationSeconds}s)`);
        await this.deletePdf(jobId);
        cleaned++;
      } else {
        console.log(`✅ PDF ativo: ${jobId} (${secondsAlive}s de vida, expira em ${Math.floor((job.expiresAt - now) / 1000)}s)`);
      }
    }
    
    console.log(`🧹 Limpeza concluída: ${cleaned} PDFs removidos, ${this.jobs.size} PDFs ativos`);
  }

  /**
   * Obtém estatísticas do storage
   * @returns {object} - Estatísticas
   */
  getStats() {
    const now = new Date();
    let active = 0;
    let expired = 0;
    let totalSize = 0;

    for (const job of this.jobs.values()) {
      if (now > job.expiresAt) {
        expired++;
      } else {
        active++;
        totalSize += job.size || 0;
      }
    }

    return { active, expired, totalSize, total: this.jobs.size };
  }
}

module.exports = BaseStorageDriver;
