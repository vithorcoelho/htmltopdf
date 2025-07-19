const { browserPool } = require('./browserPool');

async function generate({ html, url, pageSize = 'A4', orientation = 'portrait' }) {
  const browser = await browserPool.acquire();
  let page;
  
  try {
    page = await browser.newPage();
    browser.useCount++;
    
    // Configurar timeouts
    await page.setDefaultTimeout(60000);
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    });
    
    // Configurar viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    if (html) {
      console.log(`Definindo conteúdo HTML (${Math.round(html.length/1024)}KB)...`);
      await page.setContent(html, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
    } else if (url) {
      console.log(`Carregando: ${url}`);
      try {
        await page.goto(url, { 
          waitUntil: 'networkidle', 
          timeout: 30000 
        });
      } catch (error) {
        if (error.name === 'TimeoutError') {
          try {
            await page.goto(url, { 
              waitUntil: 'domcontentloaded', 
              timeout: 45000 
            });
            await page.waitForTimeout(5000);
          } catch (error2) {
            await page.goto(url, { 
              waitUntil: 'load', 
              timeout: 60000 
            });
            await page.waitForTimeout(10000);
          }
        } else {
          throw error;
        }
      }
    } else {
      throw new Error('HTML ou URL deve ser fornecido');
    }
    
    // Aguardar renderização
    if (url) {
      await page.waitForTimeout(2000);
    }
    
    if (html) {
      await page.waitForTimeout(3000);
    }
    
    console.log(`Gerando PDF (${pageSize}, ${orientation})...`);
    const startTime = Date.now();
    
    const pdfBuffer = await page.pdf({
      format: pageSize,
      landscape: orientation === 'landscape',
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: false,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      },
      timeout: 60000 // Timeout para geração do PDF
    });
    
    const endTime = Date.now();
    const pdfSize = Math.round(pdfBuffer.length / 1024);
    console.log(`✅ PDF gerado com sucesso em ${endTime - startTime}ms - Tamanho: ${pdfSize}KB`);
    
    return pdfBuffer;
  } catch (error) {
    console.error(`❌ Erro durante geração do PDF:`, error.message);
    throw error;
  } finally {
    if (page) {
      await page.close();
    }
    await browserPool.release(browser);
  }
}

module.exports = { generate };
