const { browserPool } = require('../../services/browserPool');
const axios = require('axios');

/**
 * Gera PDF a partir de URL com validação de webhook
 * Não armazena arquivo, envia diretamente por webhook
 */
async function generatePdfFromUrl(req, res) {
  const { url, webhook } = req.body;

  // Validação básica
  if (!url || !webhook) {
    return res.status(400).json({
      error: 'URL e webhook são obrigatórios',
      example: {
        url: 'https://example.com',
        webhook: 'https://meusite.com/webhook'
      }
    });
  }

  // Validar formato das URLs
  try {
    new URL(url);
    new URL(webhook);
  } catch (error) {
    return res.status(400).json({
      error: 'URL ou webhook inválido',
      details: error.message
    });
  }

  console.log(`🚀 Iniciando validação para URL: ${url}`);
  console.log(`📡 Webhook: ${webhook}`);

  // VALIDAÇÃO SÍNCRONA DO WEBHOOK (timeout de 2 segundos)
  try {
    console.log('📋 Validando webhook de forma síncrona...');
    
    const webhookValidationResponse = await axios.post(webhook, {
      status: 'Geração do PDF iniciada'
    }, {
      timeout: 2000, // 2 segundos
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'HTMLtoPDF-Service/1.0'
      }
    });

    if (webhookValidationResponse.status !== 200) {
      return res.status(400).json({
        error: 'Webhook inválido',
        details: `Webhook retornou status ${webhookValidationResponse.status}`,
        webhookUrl: webhook
      });
    }

    console.log('✅ Webhook validado com sucesso');

  } catch (webhookError) {
    console.error('❌ Falha na validação do webhook:', webhookError.message);
    
    // Determinar tipo de erro para resposta mais específica
    let errorMessage = 'Webhook não respondeu';
    let errorDetails = webhookError.message;
    
    if (webhookError.code === 'ECONNABORTED') {
      errorMessage = 'Timeout na validação do webhook';
      errorDetails = 'Webhook deve responder em até 2 segundos';
    } else if (webhookError.code === 'ECONNREFUSED') {
      errorMessage = 'Webhook inacessível';
      errorDetails = 'Não foi possível conectar ao webhook';
    } else if (webhookError.response) {
      errorMessage = 'Webhook retornou erro';
      errorDetails = `Status ${webhookError.response.status}: ${webhookError.response.statusText}`;
    }
    
    return res.status(400).json({
      error: errorMessage,
      details: errorDetails,
      webhookUrl: webhook,
      timeout: '2 segundos',
      suggestion: 'Verifique se o webhook está ativo e responde rapidamente'
    });
  }

  // Webhook validado com sucesso - aceitar requisição
  res.status(202).json({
    message: 'Webhook validado - PDF será gerado',
    url: url,
    webhook: webhook,
    status: 'Processamento iniciado'
  });

  // Processar PDF de forma assíncrona (webhook já foi validado)
  processUrlToPdfWithWebhook(url, webhook);
}

async function processUrlToPdfWithWebhook(url, webhook) {
  let browser = null;
  let page = null;

  try {
    // Webhook já foi validado na função anterior
    console.log('🔄 Iniciando geração do PDF...');
    
    // Obter browser do pool
    browser = await browserPool.acquire();
    page = await browser.newPage();

    // Configurar página
    await page.setViewportSize({ width: 1200, height: 800 });
    
    // Tentar carregar a página com estratégias de fallback
    await loadPageWithFallback(page, url);

    // Aguardar conteúdo dinâmico
    console.log('⏳ Aguardando conteúdo dinâmico...');
    await page.waitForTimeout(3000);

    // Gerar PDF
    console.log('📄 Gerando PDF...');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
      }
    });

    console.log(`✅ PDF gerado com sucesso - Tamanho: ${Math.round(pdfBuffer.length / 1024)}KB`);

    // Verificar se o arquivo não é muito grande (limite: 10MB)
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB
    if (pdfBuffer.length > maxSizeBytes) {
      console.warn(`⚠️ PDF muito grande: ${Math.round(pdfBuffer.length / 1024 / 1024)}MB`);
      
      await notifyWebhook(webhook, {
        status: 'Arquivo muito grande',
        error: `PDF gerado é muito grande (${Math.round(pdfBuffer.length / 1024 / 1024)}MB). Limite: 10MB`,
        url: url
      });
      return;
    }

    // Enviar PDF via webhook
    console.log('📤 Enviando PDF via webhook...');
    
    await sendPdfToWebhook(webhook, pdfBuffer, url);
    
    console.log('🎉 Processo concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro durante geração do PDF:', error.message);
    
    // Notificar falha via webhook
    await notifyWebhook(webhook, {
      status: 'Falha ao gerar',
      error: error.message,
      url: url
    });
    
  } finally {
    // Limpeza
    if (page) {
      try {
        await page.close();
      } catch (e) {
        console.error('Erro ao fechar página:', e.message);
      }
    }
    
    if (browser) {
      try {
        await browserPool.release(browser);
      } catch (e) {
        console.error('Erro ao retornar browser ao pool:', e.message);
      }
    }
  }
}

async function loadPageWithFallback(page, url) {
  const strategies = [
    { name: 'networkidle', waitUntil: 'networkidle', timeout: 30000 },
    { name: 'domcontentloaded', waitUntil: 'domcontentloaded', timeout: 45000 },
    { name: 'load', waitUntil: 'load', timeout: 60000 }
  ];

  for (const strategy of strategies) {
    try {
      console.log(`🔄 Tentativa com ${strategy.name}...`);
      await page.goto(url, {
        waitUntil: strategy.waitUntil,
        timeout: strategy.timeout
      });
      console.log(`✅ Sucesso com ${strategy.name}`);
      return;
    } catch (error) {
      console.log(`❌ Falha com ${strategy.name}: ${error.message}`);
      if (strategy === strategies[strategies.length - 1]) {
        throw new Error(`Não foi possível carregar a página: ${error.message}`);
      }
    }
  }
}

async function sendPdfToWebhook(webhook, pdfBuffer, originalUrl) {
  try {
    const FormData = require('form-data');
    const form = new FormData();
    
    // Adicionar arquivo PDF
    form.append('file', pdfBuffer, {
      filename: `pdf-${Date.now()}.pdf`,
      contentType: 'application/pdf'
    });
    
    // Adicionar dados do status
    form.append('status', 'Gerado com sucesso');
    form.append('url', originalUrl);
    form.append('fileSize', pdfBuffer.length.toString());
    form.append('generatedAt', new Date().toISOString());

    const response = await axios.post(webhook, form, {
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
    
    // Tentar notificar sobre a falha no envio
    await notifyWebhook(webhook, {
      status: 'Falha ao enviar arquivo',
      error: `Erro no envio do PDF: ${error.message}`,
      url: originalUrl
    });
    
    throw error;
  }
}

async function notifyWebhook(webhook, data) {
  try {
    await axios.post(webhook, data, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'HTMLtoPDF-Service/1.0'
      }
    });
    console.log('📡 Notificação enviada para webhook');
  } catch (error) {
    console.error('❌ Erro ao notificar webhook:', error.message);
  }
}

module.exports = {
  generatePdfFromUrl
};
