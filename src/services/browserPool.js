const genericPool = require('generic-pool');
const { chromium } = require('playwright');

const factory = {
  create: async () => {
    try {
      const browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--no-first-run',
          '--no-default-browser-check',
          '--single-process'
        ]
      });
      browser.useCount = 0;
      return browser;
    } catch (error) {
      console.error('Erro ao criar browser:', error.message);
      throw error;
    }
  },
  destroy: async (browser) => {
    await browser.close();
  },
  validate: async (browser) => {
    return browser.isConnected() && browser.useCount < process.env.BROWSER_MAX_USES;
  }
};

const browserPool = genericPool.createPool(factory, {
  min: parseInt(process.env.BROWSER_POOL_MIN) || 2,
  max: parseInt(process.env.BROWSER_POOL_MAX) || 5,
  testOnBorrow: true,
  acquireTimeoutMillis: 30000
});

// Warm-up: criar browsers mínimos ao iniciar
async function warmUp() {
  try {
    console.log('Iniciando warm-up do pool de browsers...');
    const browsers = [];
    const minBrowsers = parseInt(process.env.BROWSER_POOL_MIN) || 2;
    
    for (let i = 0; i < minBrowsers; i++) {
      console.log(`Criando browser ${i + 1}/${minBrowsers}...`);
      browsers.push(await browserPool.acquire());
    }
    
    for (const browser of browsers) {
      await browserPool.release(browser);
    }
    
    console.log('Warm-up do pool de browsers concluído!');
  } catch (error) {
    console.error('Erro durante warm-up:', error.message);
    throw error;
  }
}

module.exports = { browserPool, warmUp };
