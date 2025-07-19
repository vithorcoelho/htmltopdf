const fs = require('fs').promises;
const path = require('path');

class PdfStorageService {
  constructor() {
    this.storageDir = process.env.PDF_STORAGE_DIR || './pdfs';
    this.expirationSeconds = parseInt(process.env.PDF_EXPIRATION_SECONDS) || 86400; // 24 horas em segundos
    this.jobs = new Map(); // In-memory job tracking
    
    this.init();
  }

  async init() {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      console.log(`Diretório de PDFs criado: ${this.storageDir}`);
      
      // Limpar PDFs expirados na inicialização
      await this.cleanExpiredPdfs();
      
      // Configurar limpeza automática a cada 30 segundos
      setInterval(() => {
        this.cleanExpiredPdfs();
      }, 30 * 1000); // 30 segundos
    } catch (error) {
      console.error('Erro ao inicializar storage:', error);
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
        ...jobData
      });

      console.log(`PDF salvo: ${filename} (${pdfBuffer.length} bytes)`);
      return { filename, filepath, size: pdfBuffer.length };
    } catch (error) {
      console.error('Erro ao salvar PDF:', error);
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
        filename: job.filename
      };
    } catch (error) {
      console.error(`Erro ao ler PDF ${jobId}:`, error);
      // Se arquivo não existe, remover do tracking
      this.jobs.delete(jobId);
      return { status: 'not_found', message: 'Arquivo PDF não encontrado' };
    }
  }

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

  setJobFailed(jobId, error) {
    this.jobs.set(jobId, {
      status: 'failed',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.expirationSeconds * 1000),
      error: error.message || error
    });
  }

  setJobProcessing(jobId) {
    this.jobs.set(jobId, {
      status: 'processing',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.expirationSeconds * 1000)
    });
  }

  async deletePdf(jobId) {
    const job = this.jobs.get(jobId);
    if (job && job.filepath) {
      try {
        await fs.unlink(job.filepath);
        console.log(`PDF removido: ${job.filename}`);
      } catch (error) {
        console.error(`Erro ao remover PDF ${jobId}:`, error);
      }
    }
    this.jobs.delete(jobId);
  }

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

module.exports = new PdfStorageService();
