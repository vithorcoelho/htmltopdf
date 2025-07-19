const axios = require('axios');

async function testUrlToPdfEndpoint() {
  console.log('🧪 Testando endpoint /api/generate-url com validação síncrona');
  
  try {
    // Dados para teste
    const testData = {
      url: 'https://www.google.com', // URL simples para teste
      webhook: 'http://localhost:3001/webhook' // Webhook local
    };
    
    console.log('📤 Enviando requisição...');
    console.log('URL:', testData.url);
    console.log('Webhook:', testData.webhook);
    console.log('⏱️  Validação de webhook (timeout: 2s)...');
    
    const startTime = Date.now();
    
    const response = await axios.post('http://localhost:3000/api/generate-url', testData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dev_token_123'
      },
      timeout: 10000
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ Resposta recebida em ${duration}ms:`);
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.status === 202) {
      console.log('\n🎉 Webhook validado com sucesso!');
      console.log('� PDF está sendo gerado de forma assíncrona...');
      console.log('\n📡 Monitore o webhook para receber o PDF:');
      console.log('   Status: http://localhost:3001/status');
      console.log('   PDFs: http://localhost:3001/pdfs');
    }
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error(`❌ Erro no teste (${duration}ms):`);
    console.error('Status:', error.response?.status);
    
    if (error.response?.data) {
      console.error('Resposta:', JSON.stringify(error.response.data, null, 2));
      
      // Ajudar com diagnóstico
      if (error.response.data.error?.includes('Timeout')) {
        console.log('\n💡 Dica: Webhook deve responder em até 2 segundos');
        console.log('   Verifique se o webhook está rodando: node webhook-test-server.js');
      } else if (error.response.data.error?.includes('inacessível')) {
        console.log('\n💡 Dica: Webhook não está acessível');
        console.log('   Inicie o webhook: node webhook-test-server.js');
      }
    } else {
      console.error('Message:', error.message);
    }
  }
}

// Executar teste
console.log('🚀 Teste de validação síncrona do webhook\n');
testUrlToPdfEndpoint();
