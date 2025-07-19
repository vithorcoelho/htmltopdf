const fs = require('fs').promises;
const path = require('path');
const BaseStorageDriver = require('./baseStorageDriver');

/**
 * Driver de armazenamento local no sistema de arquivos
 */
class LocalStorageDriver extends BaseStorageDriver {
  constructor(config = {}) {
    super(config);
    this.storageDir = config.storageDir || process.env.PDF_STORAGE_DIR || './pdfs';
  }

  async init() {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      console.log(`📁 Diretório de PDFs criado: ${this.storageDir}`);
    } catch (error) {
      console.error('❌ Erro ao inicializar storage local:', error);
      throw error;
    }
  }

  async savePdf(jobId, pdfBuffer, jobData = {}) {
    try {
      const filename = `${jobId}.pdf`;
      const filepath = path.join(this.storageDir, filename);
      
      await fs.writeFile(filepath, pdfBuffer);
      
      // Salvar metadados do job
      this.jobs.set(jobId, {
        status: 'completed',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.expirationSeconds * 1000),
        filename,
        filepath,
        size: pdfBuffer.length,
        driver: 'local',
        ...jobData
      });

      console.log(`💾 PDF salvo: ${filename}`);
      return { filename, filepath, size: pdfBuffer.length, driver: 'local' };
    } catch (error) {
      console.error('❌ Erro ao salvar PDF localmente:', error);
      throw error;
    }
  }

  async getPdf(jobId) {
    const job = this.jobs.get(jobId);
    
    if (!job) {
      return { status: 'not_found', message: 'Job não encontrado' };
    }

    // Verificar se expirou
    if (new Date() > job.expiresAt) {
      await this.deletePdf(jobId);
      return { status: 'expired', message: 'PDF expirado' };
    }

    try {
      // Verificar se arquivo ainda existe
      await fs.access(job.filepath);
      const pdfBuffer = await fs.readFile(job.filepath);
      
      return {
        status: 'completed',
        jobId,
        createdAt: job.createdAt,
        expiresAt: job.expiresAt,
        size: job.size,
        pdfBuffer,
        filename: job.filename,
        driver: 'local'
      };
    } catch (error) {
      console.error(`❌ Erro ao ler PDF local ${jobId}:`, error);
      // Se arquivo não existe, remover do tracking
      this.jobs.delete(jobId);
      return { status: 'not_found', message: 'Arquivo PDF não encontrado' };
    }
  }

  async deletePdf(jobId) {
    const job = this.jobs.get(jobId);
    if (job && job.filepath) {
      try {
        await fs.unlink(job.filepath);
        console.log(`🗑️ PDF removido: ${job.filename}`);
      } catch (error) {
        console.error(`❌ Erro ao remover PDF local ${jobId}:`, error);
      }
    }
    this.jobs.delete(jobId);
  }
}

module.exports = LocalStorageDriver;
