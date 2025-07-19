const StorageDriverFactory = require('../storage/storageDriverFactory');

class PdfStorageService {
  constructor() {
    // Validar configuração do driver
    const driverType = process.env.STORAGE_DRIVER || 'local';
    const validation = StorageDriverFactory.validateDriverConfig(driverType);
    
    if (!validation.isValid) {
      console.error('❌ Configuração inválida para o driver de storage:');
      validation.errors.forEach(error => console.error(`  - ${error}`));
      throw new Error('Configuração inválida para o driver de storage');
    }

    if (validation.warnings.length > 0) {
      console.warn('⚠️ Avisos de configuração do driver de storage:');
      validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }

    // Criar instância do driver
    this.driver = StorageDriverFactory.createDriver(driverType);
    
    this.init();
  }

  async init() {
    try {
      await this.driver.init();
      console.log('✅ PDF Storage Service inicializado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao inicializar PDF Storage Service:', error);
      throw error;
    }
  }

  async savePdf(jobId, pdfBuffer, jobData = {}) {
    return await this.driver.savePdf(jobId, pdfBuffer, jobData);
  }

  async getPdf(jobId) {
    return await this.driver.getPdf(jobId);
  }

  async getJobStatus(jobId) {
    return await this.driver.getJobStatus(jobId);
  }

  setJobFailed(jobId, error) {
    return this.driver.setJobFailed(jobId, error);
  }

  setJobProcessing(jobId) {
    return this.driver.setJobProcessing(jobId);
  }

  async deletePdf(jobId) {
    return await this.driver.deletePdf(jobId);
  }

  async cleanExpiredPdfs() {
    return await this.driver.cleanExpiredPdfs();
  }

  getStats() {
    return this.driver.getStats();
  }

  /**
   * Método específico para S3: gera URL pré-assinada para download
   * @param {string} jobId - ID do job
   * @param {number} expiresIn - Tempo de expiração em segundos
   * @returns {Promise<string>} - URL pré-assinada (apenas para S3)
   */
  async getPresignedUrl(jobId, expiresIn = 3600) {
    if (typeof this.driver.getPresignedUrl === 'function') {
      return await this.driver.getPresignedUrl(jobId, expiresIn);
    } else {
      throw new Error('URLs pré-assinadas não são suportadas pelo driver atual');
    }
  }

  /**
   * Retorna informações sobre o driver atual
   * @returns {object} - Informações do driver
   */
  getDriverInfo() {
    const driverType = process.env.STORAGE_DRIVER || 'local';
    return {
      type: driverType,
      supportsPresignedUrls: typeof this.driver.getPresignedUrl === 'function',
      availableDrivers: StorageDriverFactory.getAvailableDrivers()
    };
  }
}

module.exports = new PdfStorageService();
