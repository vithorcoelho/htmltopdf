const axios = require('axios');

async function testSyncWebhookValidation() {
  console.log('🧪 Testando validação síncrona do webhook\n');
  
  const tests = [
    {
      name: 'Webhook válido (resposta rápida)',
      data: {
        url: 'https://www.google.com',
        webhook: 'http://localhost:3001/webhook'
      },
      expectedStatus: 202,
      description: 'Deve validar webhook e aceitar requisição'
    },
    {
      name: 'Webhook inválido (URL inexistente)',
      data: {
        url: 'https://www.google.com',
        webhook: 'http://localhost:9999/webhook'
      },
      expectedStatus: 400,
      description: 'Deve falhar rapidamente - webhook inacessível'
    },
    {
      name: 'Webhook timeout (URL lenta)',
      data: {
        url: 'https://www.google.com',
        webhook: 'http://httpbin.org/delay/5' // 5 segundos de delay
      },
      expectedStatus: 400,
      description: 'Deve falhar por timeout (> 2 segundos)'
    },
    {
      name: 'URL inválida',
      data: {
        url: 'not-a-valid-url',
        webhook: 'http://localhost:3001/webhook'
      },
      expectedStatus: 400,
      description: 'Deve falhar por URL inválida'
    },
    {
      name: 'Parâmetros ausentes',
      data: {
        url: 'https://www.google.com'
        // webhook ausente
      },
      expectedStatus: 400,
      description: 'Deve falhar por parâmetros obrigatórios ausentes'
    }
  ];

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    console.log(`\n📋 Teste ${i + 1}/${tests.length}: ${test.name}`);
    console.log(`📝 ${test.description}`);
    
    const startTime = Date.now();
    
    try {
      const response = await axios.post('http://localhost:3000/api/generate-url', test.data, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer dev_token_123'
        },
        timeout: 10000
      });
      
      const duration = Date.now() - startTime;
      
      if (response.status === test.expectedStatus) {
        console.log(`✅ SUCESSO - Status ${response.status} (${duration}ms)`);
        console.log(`📄 Resposta: ${response.data.message}`);
      } else {
        console.log(`❌ FALHOU - Status esperado: ${test.expectedStatus}, recebido: ${response.status}`);
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (error.response?.status === test.expectedStatus) {
        console.log(`✅ SUCESSO - Erro esperado ${error.response.status} (${duration}ms)`);
        console.log(`📄 Erro: ${error.response.data.error}`);
        console.log(`📋 Detalhes: ${error.response.data.details}`);
      } else {
        console.log(`❌ FALHOU - Status esperado: ${test.expectedStatus}, recebido: ${error.response?.status || 'TIMEOUT'} (${duration}ms)`);
        console.log(`📄 Erro: ${error.message}`);
      }
    }
  }
  
  console.log('\n🎯 Resumo dos testes:');
  console.log('✅ Webhooks válidos devem retornar 202 rapidamente');
  console.log('❌ Webhooks inválidos devem retornar 400 em até 2 segundos');
  console.log('⏱️  URLs lentas devem dar timeout em 2 segundos');
  
  console.log('\n💡 Para testar webhook válido:');
  console.log('1. Inicie o webhook: node webhook-test-server.js');
  console.log('2. Execute: node test-sync-validation.js');
}

// Executar testes
testSyncWebhookValidation();
