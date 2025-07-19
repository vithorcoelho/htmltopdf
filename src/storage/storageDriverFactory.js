const LocalStorageDriver = require('./drivers/localStorageDriver');
const S3StorageDriver = require('./drivers/s3StorageDriver');

/**
 * Factory para criar instâncias de drivers de storage
 */
class StorageDriverFactory {
  /**
   * Cria uma instância do driver de storage baseado na configuração
   * @param {string} driverType - Tipo do driver ('local' ou 's3')
   * @param {object} config - Configurações específicas do driver
   * @returns {BaseStorageDriver} - Instância do driver
   */
  static createDriver(driverType = null, config = {}) {
    // Se não especificado, usar variável de ambiente ou padrão
    const type = driverType || process.env.STORAGE_DRIVER || 'local';
    
    console.log(`🔧 Inicializando driver de storage: ${type}`);
    
    switch (type.toLowerCase()) {
      case 'local':
      case 'storage':
        return new LocalStorageDriver(config);
        
      case 's3':
      case 'aws':
        return new S3StorageDriver(config);
        
      default:
        console.warn(`⚠️ Driver de storage desconhecido: ${type}. Usando 'local' como padrão.`);
        return new LocalStorageDriver(config);
    }
  }

  /**
   * Lista os drivers disponíveis
   * @returns {Array<string>} - Lista de drivers disponíveis
   */
  static getAvailableDrivers() {
    return ['local', 's3'];
  }

  /**
   * Valida se um driver está disponível
   * @param {string} driverType - Tipo do driver
   * @returns {boolean} - Se o driver está disponível
   */
  static isDriverAvailable(driverType) {
    return this.getAvailableDrivers().includes(driverType.toLowerCase());
  }

  /**
   * Valida as configurações necessárias para um driver
   * @param {string} driverType - Tipo do driver
   * @returns {object} - Resultado da validação
   */
  static validateDriverConfig(driverType) {
    const type = driverType.toLowerCase();
    const errors = [];
    const warnings = [];

    switch (type) {
      case 'local':
      case 'storage':
        // Verificar se o diretório de storage é válido
        const storageDir = process.env.PDF_STORAGE_DIR || './pdfs';
        if (!storageDir) {
          warnings.push('PDF_STORAGE_DIR não definido, usando "./pdfs" como padrão');
        }
        break;

      case 's3':
      case 'aws':
        // Verificar credenciais AWS
        if (!process.env.AWS_ACCESS_KEY_ID) {
          errors.push('AWS_ACCESS_KEY_ID é obrigatório para o driver S3');
        }
        if (!process.env.AWS_SECRET_ACCESS_KEY) {
          errors.push('AWS_SECRET_ACCESS_KEY é obrigatório para o driver S3');
        }
        if (!process.env.AWS_S3_BUCKET) {
          warnings.push('AWS_S3_BUCKET não definido, usando "htmltopdf-storage" como padrão');
        }
        if (!process.env.AWS_REGION) {
          warnings.push('AWS_REGION não definido, usando "us-east-1" como padrão');
        }
        break;

      default:
        errors.push(`Driver desconhecido: ${driverType}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

module.exports = StorageDriverFactory;
