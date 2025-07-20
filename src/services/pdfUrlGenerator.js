const { browserPool } = require('./browserPool');

/**
 * Gerador de PDF específico para URLs
 * Otimizado para carregar páginas web com estratégias de fallback
 */
async function generateFromUrl({ url, pageSize = 'A4', orientation = 'portrait' }) {
  if (!url) {
    throw new Error('URL é obrigatória');
  }

  const browser = await browserPool.acquire();
  let page;
  
  try {
    page = await browser.newPage();
    browser.useCount++;
    
    console.log(`🌐 Carregando URL: ${url}`);
    
    // Configurar página para URLs
    await page.setDefaultTimeout(60000);
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    });
    await page.setViewportSize({ width: 1200, height: 800 });
    
    // Carregar URL com estratégias de fallback
    await loadUrlWithFallback(page, url);
    
    // Aguardar conteúdo dinâmico
    console.log('⏳ Aguardando conteúdo dinâmico...');
    await page.waitForTimeout(3000);
    
    console.log(`📄 Gerando PDF (${pageSize}, ${orientation})...`);
    const startTime = Date.now();
    
    const pdfBuffer = await page.pdf({
      format: pageSize,
      landscape: orientation === 'landscape',
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: false,
      margin: {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
      },
      timeout: 60000 // Timeout maior para URLs
    });
    
    const endTime = Date.now();
    const pdfSize = Math.round(pdfBuffer.length / 1024);
    console.log(`✅ PDF gerado de URL em ${endTime - startTime}ms - Tamanho: ${pdfSize}KB`);
    
    return pdfBuffer;
    
  } catch (error) {
    console.error(`❌ Erro ao gerar PDF de URL:`, error.message);
    throw error;
  } finally {
    if (page) {
      await page.close();
    }
    await browserPool.release(browser);
  }
}

/**
 * Carrega URL com múltiplas estratégias de fallback
 */
async function loadUrlWithFallback(page, url) {
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

module.exports = { generateFromUrl };
