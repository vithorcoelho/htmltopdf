const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'HTML to PDF API',
      version: '1.0.0',
      description: `
# API para conversão de HTML/URL para PDF usando Playwright

Esta API oferece conversão assíncrona de HTML ou URLs para PDF com sistema de filas, armazenamento temporário e notificações via webhook.

## 🔄 Sistema de Webhooks

### Como funciona
1. **Opcional**: O webhook é completamente opcional. Você pode gerar PDFs sem fornecer webhookUrl
2. **Notificação automática**: Se fornecido, o webhook será chamado quando o PDF estiver pronto ou falhar
3. **Formato multipart**: O webhook recebe dados via multipart/form-data
4. **Autenticação**: Todas as chamadas de webhook incluem header de autorização

### Estrutura do Webhook

#### Headers enviados:
- \`Content-Type: multipart/form-data\`
- \`Authorization: Bearer {WEBHOOK_TOKEN}\`

#### Dados enviados (form-data):
- \`jobId\`: ID do job original
- \`status\`: "completed" ou "failed"
- \`file\`: Arquivo PDF binário (apenas se status="completed")
- \`error\`: Mensagem de erro (apenas se status="failed")

### Exemplo de implementação do webhook:

\`\`\`javascript
const express = require('express');
const multer = require('multer');
const app = express();

const upload = multer({ dest: 'uploads/' });

app.post('/webhook', upload.single('file'), (req, res) => {
  const { jobId, status } = req.body;
  
  if (status === 'completed' && req.file) {
    // PDF recebido com sucesso
    console.log('PDF recebido:', {
      jobId,
      filename: req.file.originalname,
      size: req.file.size
    });
    
    // Processar o arquivo PDF...
    
  } else if (status === 'failed') {
    // Erro na geração
    console.log('Erro na geração:', {
      jobId,
      error: req.body.error
    });
  }
  
  res.json({ received: true });
});
\`\`\`

## 📥 Alternativa sem Webhook

Se você não fornecer um webhookUrl, pode:

1. **Consultar status**: \`GET /api/jobs/{jobId}/status\`
2. **Fazer download**: \`GET /api/jobs/{jobId}/download\`
3. **Regenerar se expirado**: \`POST /api/jobs/{jobId}/regenerate\`

## ⏰ Expiração de PDFs

- **Prazo**: PDFs expiram em 24 horas (configurável)
- **Limpeza automática**: Arquivos são removidos automaticamente após expiração
- **Regeneração**: PDFs expirados podem ser regenerados com os dados originais

## 🔐 Autenticação

Todas as requisições requerem um token Bearer no header:
\`Authorization: Bearer {API_TOKEN}\`
      `
    },
    servers: [
      {
        url: '/',
        description: 'API Server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token de autenticação da API'
        }
      },
      schemas: {
        WebhookPayload: {
          type: 'object',
          description: 'Payload enviado para o webhook (multipart/form-data)',
          properties: {
            jobId: {
              type: 'string',
              description: 'ID do job original',
              example: 'a3fafc13-e776-4fcb-a100-c474ea6422a4'
            },
            status: {
              type: 'string',
              enum: ['completed', 'failed'],
              description: 'Status do processamento'
            },
            file: {
              type: 'string',
              format: 'binary',
              description: 'Arquivo PDF (apenas se status=completed)'
            },
            error: {
              type: 'string',
              description: 'Mensagem de erro (apenas se status=failed)'
            }
          }
        },
        JobStatus: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['queued', 'processing', 'completed', 'failed', 'expired', 'not_found']
            },
            jobId: {
              type: 'string'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            expiresAt: {
              type: 'string',
              format: 'date-time'
            },
            size: {
              type: 'number',
              description: 'Tamanho do PDF em bytes'
            },
            filename: {
              type: 'string'
            }
          }
        }
      },
      examples: {
        WebhookSuccess: {
          summary: 'Webhook - PDF gerado com sucesso',
          description: 'Exemplo de dados enviados quando o PDF é gerado com sucesso',
          value: {
            jobId: 'a3fafc13-e776-4fcb-a100-c474ea6422a4',
            status: 'completed',
            file: '(arquivo PDF binário)'
          }
        },
        WebhookError: {
          summary: 'Webhook - Erro na geração',
          description: 'Exemplo de dados enviados quando há erro na geração do PDF',
          value: {
            jobId: 'a3fafc13-e776-4fcb-a100-c474ea6422a4',
            status: 'failed',
            error: 'Erro ao processar HTML: elemento não encontrado'
          }
        }
      }
    },
    tags: [
      {
        name: 'PDF Generation',
        description: 'Endpoints para geração de PDFs'
      },
      {
        name: 'Job Management', 
        description: 'Endpoints para consulta e gerenciamento de jobs'
      },
      {
        name: 'Storage',
        description: 'Endpoints para informações do armazenamento'
      }
    ]
  },
  apis: ['./src/api/routes/*.js']
};

const specs = swaggerJsdoc(options);
module.exports = specs;
