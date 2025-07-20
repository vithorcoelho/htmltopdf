const axios = require('axios');
const FormData = require('form-data');

/**
 * Envia PDF via webhook
 */
async function sendPdf({ webhookUrl, pdfBuffer, jobId, metadata = {} }) {
  const form = new FormData();
  
  // Adicionar arquivo PDF
  form.append('file', pdfBuffer, {
    filename: `pdf-${jobId}-${Date.now()}.pdf`,
    contentType: 'application/pdf'
  });
  
  // Adicionar metadados
  form.append('status', 'Gerado com sucesso');
  form.append('jobId', jobId);
  form.append('fileSize', pdfBuffer.length.toString());
  
  // Adicionar metadata customizada
  Object.keys(metadata).forEach(key => {
    if (metadata[key] !== undefined && metadata[key] !== null) {
      form.append(key, String(metadata[key]));
    }
  });
  
  try {
    const response = await axios.post(webhookUrl, form, {
      headers: {
        ...form.getHeaders(),
        'User-Agent': 'HTMLtoPDF-Service/1.0'
      },
      timeout: 30000, // 30 segundos para upload
      maxContentLength: 50 * 1024 * 1024, // 50MB max
      maxBodyLength: 50 * 1024 * 1024
    });

    if (response.status === 200 || response.status === 201) {
      console.log('✅ PDF enviado com sucesso via webhook');
    } else {
      throw new Error(`Webhook retornou status ${response.status}`);
    }

  } catch (error) {
    console.error('❌ Erro ao enviar PDF via webhook:', error.message);
    throw error;
  }
}

/**
 * Envia notificação JSON via webhook
 */
async function sendNotification({ webhookUrl, data }) {
  try {
    const response = await axios.post(webhookUrl, data, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'HTMLtoPDF-Service/1.0'
      }
    });

    if (response.status === 200 || response.status === 201) {
      console.log('📡 Notificação enviada para webhook');
    } else {
      throw new Error(`Webhook retornou status ${response.status}`);
    }

  } catch (error) {
    console.error('❌ Erro ao enviar notificação via webhook:', error.message);
    throw error;
  }
}

module.exports = { 
  sendPdf,
  sendNotification,
  // Backward compatibility
  send: sendPdf 
};
