const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const BaseStorageDriver = require('./baseStorageDriver');

/**
 * Driver de armazenamento no Amazon S3
 */
class S3StorageDriver extends BaseStorageDriver {
  constructor(config = {}) {
    super(config);
    
    // Configurações do S3
    this.bucketName = config.bucketName || process.env.AWS_S3_BUCKET || 'htmltopdf-storage';
    this.region = config.region || process.env.AWS_REGION || 'us-east-1';
    this.prefix = config.prefix || process.env.AWS_S3_PREFIX || 'pdfs/';
    
    // Configurar cliente S3
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
      // Para usar com LocalStack ou MinIO
      ...(process.env.AWS_ENDPOINT_URL && {
        endpoint: process.env.AWS_ENDPOINT_URL,
        forcePathStyle: true
      })
    });
  }

  async init() {
    try {
      console.log(`☁️ Inicializando S3 Storage - Bucket: ${this.bucketName}, Region: ${this.region}`);
      
      // Verificar se conseguimos acessar o bucket (opcional)
      try {
        await this.s3Client.send(new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: `${this.prefix}test-connection`
        }));
      } catch (error) {
        // Erro esperado se o objeto não existir, mas indica que a conexão funciona
        if (error.name !== 'NotFound' && error.name !== 'NoSuchKey') {
          console.warn(`⚠️ Aviso: Não foi possível verificar a conexão com S3: ${error.message}`);
        }
      }
      
      // Limpar PDFs expirados na inicialização
      await this.cleanExpiredPdfs();
      
      // Configurar limpeza automática a cada 30 segundos
      setInterval(() => {
        this.cleanExpiredPdfs();
      }, 30 * 1000);
      
      console.log('✅ S3 Storage inicializado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao inicializar S3 storage:', error);
      throw error;
    }
  }

  async savePdf(jobId, pdfBuffer, jobData = {}) {
    try {
      const filename = `${jobId}.pdf`;
      const key = `${this.prefix}${filename}`;
      
      // Garantir que todos os metadados sejam strings para compatibilidade com MinIO
      const sanitizedMetadata = {};
      const safeJobData = { ...jobData };
      
      // Converter todos os valores de jobData para strings
      Object.keys(safeJobData).forEach(key => {
        const value = safeJobData[key];
        if (value !== null && value !== undefined) {
          sanitizedMetadata[key] = String(value);
        }
      });
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
        Metadata: {
          jobId: String(jobId),
          createdAt: new Date().toISOString(),
          ...sanitizedMetadata
        }
      });

      await this.s3Client.send(command);
      
      // Salvar metadados do job
      this.jobs.set(jobId, {
        status: 'completed',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.expirationSeconds * 1000),
        filename,
        key,
        size: pdfBuffer.length,
        driver: 's3',
        bucket: this.bucketName,
        ...jobData
      });

      console.log(`☁️ PDF salvo no S3: ${key} (${pdfBuffer.length} bytes)`);
      return { 
        filename, 
        key, 
        size: pdfBuffer.length, 
        driver: 's3', 
        bucket: this.bucketName 
      };
    } catch (error) {
      console.error('❌ Erro ao salvar PDF no S3:', error);
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
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: job.key
      });

      const response = await this.s3Client.send(command);
      
      // Converter stream para buffer
      const chunks = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      const pdfBuffer = Buffer.concat(chunks);
      
      return {
        status: 'completed',
        jobId,
        createdAt: job.createdAt,
        expiresAt: job.expiresAt,
        size: job.size,
        pdfBuffer,
        filename: job.filename,
        driver: 's3',
        bucket: this.bucketName
      };
    } catch (error) {
      console.error(`❌ Erro ao ler PDF do S3 ${jobId}:`, error);
      
      // Se arquivo não existe, remover do tracking
      if (error.name === 'NoSuchKey' || error.name === 'NotFound') {
        this.jobs.delete(jobId);
        return { status: 'not_found', message: 'Arquivo PDF não encontrado no S3' };
      }
      
      throw error;
    }
  }

  async deletePdf(jobId) {
    const job = this.jobs.get(jobId);
    if (job && job.key) {
      try {
        const command = new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: job.key
        });

        await this.s3Client.send(command);
        console.log(`🗑️ PDF removido do S3: ${job.key}`);
      } catch (error) {
        console.error(`❌ Erro ao remover PDF do S3 ${jobId}:`, error);
      }
    }
    this.jobs.delete(jobId);
  }

  /**
   * Gera uma URL pré-assinada para download direto do S3
   * @param {string} jobId - ID do job
   * @param {number} expiresIn - Tempo de expiração em segundos (padrão: 3600)
   * @returns {Promise<string>} - URL pré-assinada
   */
  async getPresignedUrl(jobId, expiresIn = 3600) {
    const job = this.jobs.get(jobId);
    
    if (!job) {
      throw new Error('Job não encontrado');
    }

    if (new Date() > job.expiresAt) {
      await this.deletePdf(jobId);
      throw new Error('PDF expirado');
    }

    try {
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: job.key
      });

      const presignedUrl = await getSignedUrl(this.s3Client, command, { 
        expiresIn 
      });

      return presignedUrl;
    } catch (error) {
      console.error(`❌ Erro ao gerar URL pré-assinada para ${jobId}:`, error);
      throw error;
    }
  }
}

module.exports = S3StorageDriver;
