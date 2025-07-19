const axios = require('axios');
const { chromium } = require('playwright');

async function extractHtmlAndGeneratePdf() {
  let browser, page;
  
  try {
    console.log('🚀 Iniciando extração de HTML da página da Band...');
    
    // Lançar browser para extrair HTML
    browser = await chromium.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });
    
    page = await browser.newPage();
    
    const url = 'https://sandbox.vidanova.ionnutri.com.br/laudos/4/html';
    console.log(`🌐 Navegando para: ${url}`);
    
    // Tentar carregar a página com múltiplas estratégias
    let html;
    try {
      // Primeira tentativa: networkidle
      console.log('🔄 Tentativa 1: networkidle...');
      await page.goto(url, { 
        waitUntil: 'networkidle', 
        timeout: 30000 
      });
      console.log('✅ Sucesso com networkidle');
    } catch (error) {
      console.log(`❌ Falha com networkidle: ${error.message}`);
      
      try {
        // Segunda tentativa: domcontentloaded
        console.log('🔄 Tentativa 2: domcontentloaded...');
        await page.goto(url, { 
          waitUntil: 'domcontentloaded', 
          timeout: 45000 
        });
        console.log('✅ Sucesso com domcontentloaded');
        
        // Aguardar conteúdo dinâmico
        console.log('⏳ Aguardando 5s para conteúdo dinâmico...');
        await page.waitForTimeout(5000);
      } catch (error2) {
        console.log(`❌ Falha com domcontentloaded: ${error2.message}`);
        
        // Terceira tentativa: load
        console.log('🔄 Tentativa 3: load...');
        await page.goto(url, { 
          waitUntil: 'load', 
          timeout: 60000 
        });
        console.log('✅ Sucesso com load');
        
        // Aguardar mais tempo para conteúdo dinâmico
        console.log('⏳ Aguardando 10s para conteúdo dinâmico...');
        await page.waitForTimeout(10000);
      }
    }
    
    console.log('📄 Extraindo HTML da página...');
    html = await page.content();
    
    console.log(`✅ HTML extraído com sucesso - Tamanho: ${Math.round(html.length / 1024)}KB`);
    
    // Fechar browser após extrair HTML
    await browser.close();
    browser = null;
    
    // Verificar se HTML não é muito grande para endpoint síncrono
    const htmlSizeKB = Math.round(html.length / 1024);
    const maxSyncSizeKB = 50; // 50KB padrão
    
    if (htmlSizeKB <= maxSyncSizeKB) {
      console.log(`📤 HTML pequeno (${htmlSizeKB}KB), usando endpoint síncrono...`);
      
      // Usar endpoint síncrono
      const syncResponse = await axios.post('http://localhost:3000/api/generate-sync', {
        html: html,
        pageSize: 'A4',
        orientation: 'portrait'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer dev_token_123'
        },
        timeout: 120000 // 2 minutos
      });
      
      console.log('✅ PDF gerado via endpoint síncrono:');
      console.log(JSON.stringify(syncResponse.data, null, 2));
      
    } else {
      console.log(`📤 HTML grande (${htmlSizeKB}KB), usando endpoint assíncrono...`);
      
      // Usar endpoint assíncrono
      const asyncResponse = await axios.post('http://localhost:3000/api/generate', {
        html: html,
        pageSize: 'A4',
        orientation: 'portrait'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer dev_token_123'
        },
        timeout: 180000 // 3 minutos
      });
      
      console.log('✅ Job criado via endpoint assíncrono:');
      console.log(JSON.stringify(asyncResponse.data, null, 2));
      
      if (asyncResponse.data.jobId) {
        console.log('\n🔍 Monitorando status do job...');
        
        // Monitorar status
        const jobId = asyncResponse.data.jobId;
        let attempts = 0;
        const maxAttempts = 30; // 5 minutos máximo (30 * 10s)
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 10000)); // Aguardar 10s
          attempts++;
          
          try {
            const statusResponse = await axios.get(`http://localhost:3000/api/jobs/${jobId}/status`, {
              headers: {
                'Authorization': 'Bearer dev_token_123'
              }
            });
            
            console.log(`📊 Status (tentativa ${attempts}):`, statusResponse.data.status);
            
            if (statusResponse.data.status === 'completed') {
              console.log('🎉 PDF gerado com sucesso!');
              console.log('📁 Detalhes do arquivo:');
              console.log(JSON.stringify(statusResponse.data, null, 2));
              break;
            } else if (statusResponse.data.status === 'failed') {
              console.log('❌ Job falhou!');
              console.log(JSON.stringify(statusResponse.data, null, 2));
              break;
            }
            
          } catch (error) {
            console.error(`❌ Erro ao consultar status (tentativa ${attempts}):`, error.message);
          }
        }
        
        if (attempts >= maxAttempts) {
          console.log('⏰ Timeout ao aguardar conclusão do job');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Erro durante extração/geração:');
    console.error('Status:', error.response?.status);
    console.error('Data:', error.response?.data);
    console.error('Message:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Executar
extractHtmlAndGeneratePdf();
