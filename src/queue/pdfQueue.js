const { Queue } = require('bullmq');

// Parse Redis URL if provided
let connectionConfig;
if (process.env.REDIS_URL) {
  connectionConfig = process.env.REDIS_URL;
} else {
  connectionConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6380
  };
}

const pdfQueue = new Queue('pdf-generation', {
  connection: connectionConfig,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

module.exports = pdfQueue;
