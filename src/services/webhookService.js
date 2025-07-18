const axios = require('axios');
const FormData = require('form-data');

async function send({ webhookUrl, jobId, status, pdfBuffer, error }) {
  const form = new FormData();
  form.append('jobId', jobId);
  form.append('status', status);
  
  if (status === 'completed' && pdfBuffer) {
    form.append('file', pdfBuffer, {
      filename: `${jobId}.pdf`,
      contentType: 'application/pdf'
    });
  }
  
  if (status === 'failed' && error) {
    form.append('error', error);
  }
  
  try {
    await axios.post(webhookUrl, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${process.env.WEBHOOK_TOKEN}`
      },
      timeout: parseInt(process.env.WEBHOOK_TIMEOUT) || 10000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
  } catch (error) {
    console.error('Erro ao enviar webhook:', error.message);
    throw error;
  }
}

module.exports = { send };
