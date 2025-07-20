const { browserPool } = require('./browserPool');

/**
 * Gerador de PDF específico para HTML
 * Otimizado para conteúdo HTML direto
 */
async function generateFromHtml({ html, pageSize = 'A4', orientation = 'portrait' }) {
  if (!html) {
    throw new Error('HTML é obrigatório');
  }

  const browser = await browserPool.acquire();
  let page;
  
  try {
    page = await browser.newPage();
    browser.useCount++;
    
    console.log(`📄 Processando HTML (${Math.round(html.length/1024)}KB)...`);
    
    // Configurar página para HTML
    await page.setDefaultTimeout(30000); // Timeout menor para HTML
    await page.setViewportSize({ width: 1200, height: 800 });
    
    // Definir conteúdo HTML
    await page.setContent(html, { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    
    // Aguardar renderização CSS
    await page.waitForTimeout(2000);
    
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
      timeout: 30000 // Timeout menor para HTML
    });
    
    const endTime = Date.now();
    const pdfSize = Math.round(pdfBuffer.length / 1024);
    console.log(`✅ PDF gerado de HTML em ${endTime - startTime}ms - Tamanho: ${pdfSize}KB`);
    
    return pdfBuffer;
    
  } catch (error) {
    console.error(`❌ Erro ao gerar PDF de HTML:`, error.message);
    throw error;
  } finally {
    if (page) {
      await page.close();
    }
    await browserPool.release(browser);
  }
}

module.exports = { generateFromHtml };
