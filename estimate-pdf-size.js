const { chromium } = require('playwright');
const axios = require('axios');

async function estimatePdfSize() {
  let browser, page;
  
  try {
    console.log('🔍 Iniciando análise para estimar tamanho do PDF...');
    
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    
    page = await browser.newPage();
    
    const url = 'https://www.band.com.br/esportes/automobilismo/formula-1/calendario';
    console.log(`🌐 Analisando: ${url}`);
    
    // Tentar carregar a página com múltiplas estratégias (igual ao extract-and-generate.js)
    try {
      console.log('🔄 Tentativa 1: networkidle...');
      await page.goto(url, { 
        waitUntil: 'networkidle', 
        timeout: 30000 
      });
      console.log('✅ Sucesso com networkidle');
    } catch (error) {
      console.log(`❌ Falha com networkidle: ${error.message}`);
      
      try {
        console.log('🔄 Tentativa 2: domcontentloaded...');
        await page.goto(url, { 
          waitUntil: 'domcontentloaded', 
          timeout: 45000 
        });
        console.log('✅ Sucesso com domcontentloaded');
        await page.waitForTimeout(5000);
      } catch (error2) {
        console.log(`❌ Falha com domcontentloaded: ${error2.message}`);
        
        console.log('🔄 Tentativa 3: load...');
        await page.goto(url, { 
          waitUntil: 'load', 
          timeout: 60000 
        });
        console.log('✅ Sucesso com load');
        await page.waitForTimeout(10000);
      }
    }
    
    console.log('\n📊 Coletando métricas da página...');
    
    // Extrair métricas da página
    const metrics = await page.evaluate(() => {
      const results = {
        htmlSize: 0,
        textContent: '',
        images: [],
        stylesheets: [],
        scripts: [],
        fonts: [],
        dimensions: {
          width: window.innerWidth,
          height: document.body.scrollHeight
        }
      };
      
      // Tamanho do HTML
      results.htmlSize = document.documentElement.outerHTML.length;
      
      // Conteúdo de texto (para estimar densidade)
      results.textContent = document.body.innerText || '';
      
      // Analisar imagens
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        if (img.src && !img.src.startsWith('data:')) {
          results.images.push({
            src: img.src,
            width: img.naturalWidth || img.width || 0,
            height: img.naturalHeight || img.height || 0,
            alt: img.alt || ''
          });
        }
      });
      
      // Analisar stylesheets
      const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
      stylesheets.forEach(css => {
        if (css.href) {
          results.stylesheets.push(css.href);
        }
      });
      
      // Analisar scripts
      const scripts = document.querySelectorAll('script[src]');
      scripts.forEach(script => {
        if (script.src) {
          results.scripts.push(script.src);
        }
      });
      
      // Detectar fontes customizadas
      const computedStyles = window.getComputedStyle(document.body);
      const fontFamily = computedStyles.fontFamily;
      if (fontFamily) {
        results.fonts.push(fontFamily);
      }
      
      return results;
    });
    
    console.log(`📄 HTML Size: ${Math.round(metrics.htmlSize / 1024)}KB`);
    console.log(`📝 Text Content: ${Math.round(metrics.textContent.length / 1024)}KB`);
    console.log(`📐 Page Dimensions: ${metrics.dimensions.width}x${metrics.dimensions.height}px`);
    console.log(`🖼️  Images Found: ${metrics.images.length}`);
    console.log(`🎨 Stylesheets: ${metrics.stylesheets.length}`);
    console.log(`📜 Scripts: ${metrics.scripts.length}`);
    
    // Analisar tamanho das imagens
    let totalImageSizeEstimate = 0;
    let imageAnalysis = [];
    
    console.log('\n🖼️  Analisando imagens...');
    
    for (let i = 0; i < Math.min(metrics.images.length, 10); i++) { // Limitar a 10 imagens para teste
      const img = metrics.images[i];
      try {
        const response = await axios.head(img.src, { timeout: 5000 });
        const sizeBytes = parseInt(response.headers['content-length'] || '0');
        const sizeKB = Math.round(sizeBytes / 1024);
        
        imageAnalysis.push({
          url: img.src.substring(0, 80) + '...',
          sizeKB: sizeKB,
          dimensions: `${img.width}x${img.height}`
        });
        
        totalImageSizeEstimate += sizeBytes;
        
        console.log(`   ${i+1}. ${sizeKB}KB - ${img.width}x${img.height}px`);
      } catch (error) {
        console.log(`   ${i+1}. [Erro ao acessar imagem] - ${img.width}x${img.height}px`);
      }
    }
    
    if (metrics.images.length > 10) {
      // Estimar o restante baseado na média
      const avgImageSize = totalImageSizeEstimate / Math.min(metrics.images.length, 10);
      const remainingImages = metrics.images.length - 10;
      totalImageSizeEstimate += avgImageSize * remainingImages;
      console.log(`   ... estimando mais ${remainingImages} imagens baseado na média`);
    }
    
    // Calcular estimativa do PDF
    console.log('\n📊 ESTIMATIVA DO TAMANHO DO PDF:');
    console.log('=====================================');
    
    const htmlSizeKB = Math.round(metrics.htmlSize / 1024);
    const imagesSizeKB = Math.round(totalImageSizeEstimate / 1024);
    const textDensity = metrics.textContent.length / metrics.htmlSize;
    
    // Fatores de estimativa
    const factors = {
      htmlBase: htmlSizeKB * 0.5, // HTML renderizado costuma ser menor
      images: imagesSizeKB * 1.2, // Imagens podem aumentar devido à resolução PDF
      fonts: metrics.fonts.length * 100, // ~100KB por fonte customizada
      vectorGraphics: metrics.dimensions.height / 1000 * 50, // Estimativa para gráficos vetoriais
      metadata: 50 // Metadados e estrutura do PDF
    };
    
    const estimatedPdfSizeKB = Math.round(
      factors.htmlBase + 
      factors.images + 
      factors.fonts + 
      factors.vectorGraphics + 
      factors.metadata
    );
    
    console.log(`🏗️  HTML renderizado: ~${Math.round(factors.htmlBase)}KB`);
    console.log(`🖼️  Imagens (${metrics.images.length}): ~${Math.round(factors.images)}KB`);
    console.log(`🔤 Fontes: ~${Math.round(factors.fonts)}KB`);
    console.log(`📐 Gráficos vetoriais: ~${Math.round(factors.vectorGraphics)}KB`);
    console.log(`📋 Metadados PDF: ~${Math.round(factors.metadata)}KB`);
    console.log('-------------------------------------');
    console.log(`📄 ESTIMATIVA TOTAL: ~${estimatedPdfSizeKB}KB (${Math.round(estimatedPdfSizeKB/1024)}MB)`);
    
    // Classificar tamanho
    let sizeCategory;
    if (estimatedPdfSizeKB < 1024) {
      sizeCategory = '🟢 PEQUENO - Adequado para endpoint síncrono';
    } else if (estimatedPdfSizeKB < 5120) {
      sizeCategory = '🟡 MÉDIO - Recomendado endpoint assíncrono';
    } else {
      sizeCategory = '🔴 GRANDE - Usar apenas endpoint assíncrono';
    }
    
    console.log(`\n📊 Classificação: ${sizeCategory}`);
    
    // Análise de performance esperada
    const expectedGenerationTime = Math.round(estimatedPdfSizeKB / 1024 * 10 + metrics.images.length * 0.5);
    console.log(`⏱️  Tempo estimado de geração: ~${expectedGenerationTime}s`);
    
    // Recomendações
    console.log('\n💡 RECOMENDAÇÕES:');
    if (metrics.images.length > 20) {
      console.log('   • Muitas imagens detectadas - considere otimização');
    }
    if (estimatedPdfSizeKB > 10240) {
      console.log('   • PDF será grande - use compressão se possível');
    }
    if (metrics.dimensions.height > 10000) {
      console.log('   • Página muito longa - considere paginação');
    }
    
    console.log('\n✅ Análise concluída!');
    
  } catch (error) {
    console.error('❌ Erro durante análise:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Executar análise
estimatePdfSize();
