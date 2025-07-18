const { browserPool } = require('./browserPool');

async function generate({ html, url, pageSize = 'A4', orientation = 'portrait' }) {
  const browser = await browserPool.acquire();
  let page;
  
  try {
    page = await browser.newPage();
    browser.useCount++;
    
    if (html) {
      await page.setContent(html, { waitUntil: 'networkidle' });
    } else if (url) {
      await page.goto(url, { waitUntil: 'networkidle' });
    } else {
      throw new Error('HTML ou URL deve ser fornecido');
    }
    
    const pdfBuffer = await page.pdf({
      format: pageSize,
      landscape: orientation === 'landscape',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });
    
    return pdfBuffer;
  } finally {
    if (page) await page.close();
    await browserPool.release(browser);
  }
}

module.exports = { generate };
