# 🧠 Geração de PDF com Playwright + Webhook

Aplicação backend em Node.js que gera arquivos PDF a partir de HTML ou URL usando Playwright com sistema de filas BullMQ.

## 🧱 Stack Tecnológica

- **Node.js** (última versão LTS)
- **Yarn** (gerenciador de pacotes)
- **Playwright** (geração de PDF)
- **BullMQ** (sistema de filas)
- **Bull Board** (dashboard para monitoramento de filas - fase final)
- **Docker + Docker Compose** (containerização)
- **Traefik** (reverse proxy e load balancer)
- **Redis** (backend para BullMQ)
- **Swagger/OpenAPI** (documentação da API)
- **generic-pool** (pool de browsers)
- **Express.js** (framework web)
- **Axios** (cliente HTTP para webhooks)

## 📁 Estrutura do Projeto

```
htmltopdf/
├── src/
│   ├── api/
│   │   ├── controllers/
│   │   │   └── pdfController.js
│   │   ├── middlewares/
│   │   │   └── auth.js
│   │   └── routes/
│   │       └── pdfRoutes.js
│   ├── services/
│   │   ├── browserPool.js
│   │   ├── pdfGenerator.js
│   │   └── webhookService.js
│   ├── queue/
│   │   ├── pdfQueue.js
│   │   └── pdfWorker.js
│   ├── config/
│   │   ├── swagger.js
│   │   └── bullBoard.js        # Implementado na última fase
│   └── index.js
├── .env
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── docker-compose.dev.yml       # Para desenvolvimento com volumes
├── package.json
├── yarn.lock
└── README.md
```

## 🚀 Fases de Implementação

### Fase 1: API de Conversão HTML para PDF
- Configuração inicial do projeto com Express
- Implementação do serviço de geração de PDF com Playwright
- Endpoint básico `/generate` (síncrone para testes iniciais)
- Middleware de autenticação
- Testes básicos de conversão

### Fase 2: Sistema de Filas com BullMQ
- Integração com Redis
- Implementação de filas assíncronas
- Worker para processar jobs
- Modificação do endpoint para retornar jobId

### Fase 3: Sistema de Webhooks
- Implementação do serviço de webhook
- Notificações automáticas após processamento
- Tratamento de erros e retry

### Fase 4: Otimizações e Pool de Browsers
- Implementação do pool de browsers
- Otimização de performance
- Configurações avançadas do Playwright

### Fase 5: Documentação e Monitoramento
- Configuração do Swagger
- Implementação do Bull Board
- Métricas e logs detalhados

## 🛠️ Funcionalidades da API

### POST /generate

Endpoint para solicitar geração de PDF.

**Request:**
```json
{
  "html": "<html>...</html>",  // ou "url": "https://google.com"
  "pageSize": "A4",            // opções: A4 (default), A3, Letter e Square
  "orientation": "portrait",    // opcional: portrait ou landscape
  "webhookUrl": "https://cliente.com/webhook"
}
```

**Headers obrigatórios:**
```
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
```

**Response:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued"
}
```

### Webhook de Notificação

Quando o PDF for gerado, a aplicação enviará uma requisição POST para o `webhookUrl` informado.

**Request do Webhook:**
- **Método:** POST
- **Content-Type:** multipart/form-data
- **Headers:** `Authorization: Bearer <WEBHOOK_TOKEN>`
- **Body:**
  - `jobId`: ID do job
  - `status`: "completed" ou "failed"
  - `file`: arquivo PDF binário (apenas se status="completed")
  - `error`: mensagem de erro (apenas se status="failed")

## 💻 Implementação Detalhada

### 1. Configuração do Ambiente (.env)

```env
# Servidor
PORT=3000
NODE_ENV=production

# Autenticação
API_TOKEN=seu_token_api_aqui
WEBHOOK_TOKEN=seu_token_webhook_aqui

# Redis/BullMQ
REDIS_URL=redis://redis:6379

# Playwright
BROWSER_POOL_MIN=2
BROWSER_POOL_MAX=5
BROWSER_MAX_USES=50

# Timeouts
JOB_TIMEOUT=30000
WEBHOOK_TIMEOUT=10000
```

### 2. Package.json

```json
{
  "name": "htmltopdf",
  "version": "1.0.0",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "docker:dev": "docker-compose -f docker-compose.dev.yml up",
    "docker:build": "docker-compose build",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:logs": "docker-compose logs -f app"
  },
  "dependencies": {
    "axios": "^1.6.2",
    "bullmq": "^5.1.0",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "form-data": "^4.0.0",
    "generic-pool": "^3.9.0",
    "playwright": "^1.40.0",
    "swagger-jsdoc": "^6.2.8",
    "swagger-ui-express": "^5.0.0",
    "uuid": "^9.0.1",
    "@bull-board/api": "^5.9.1",
    "@bull-board/bullmq": "^5.9.1",
    "@bull-board/express": "^5.9.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

### 2.1. Instalação de Dependências

```bash
# Usando Docker (recomendado para desenvolvimento)
docker run --rm -v $(pwd):/app -w /app node:20 yarn install

# Ou diretamente com yarn (se instalado localmente)
yarn install
```

### 3. Pool de Browsers (src/services/browserPool.js)

```javascript
const genericPool = require('generic-pool');
const { chromium } = require('playwright');

const factory = {
  create: async () => {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    browser.useCount = 0;
    return browser;
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
  const browsers = [];
  for (let i = 0; i < parseInt(process.env.BROWSER_POOL_MIN); i++) {
    browsers.push(await browserPool.acquire());
  }
  for (const browser of browsers) {
    await browserPool.release(browser);
  }
}

module.exports = { browserPool, warmUp };
```

### 4. Fila BullMQ (src/queue/pdfQueue.js)

```javascript
const { Queue } = require('bullmq');

const pdfQueue = new Queue('pdf-generation', {
  connection: {
    host: process.env.REDIS_HOST || 'redis',
    port: process.env.REDIS_PORT || 6379
  },
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

module.exports = pdfQueue;
```

### 5. Worker de Processamento (src/queue/pdfWorker.js)

```javascript
const { Worker } = require('bullmq');
const pdfGenerator = require('../services/pdfGenerator');
const webhookService = require('../services/webhookService');

const worker = new Worker('pdf-generation', async (job) => {
  const { html, url, pageSize, orientation, webhookUrl } = job.data;
  
  try {
    // Gerar PDF
    const pdfBuffer = await pdfGenerator.generate({
      html,
      url,
      pageSize,
      orientation
    });
    
    // Enviar webhook
    await webhookService.send({
      webhookUrl,
      jobId: job.id,
      status: 'completed',
      pdfBuffer
    });
    
    return { success: true, size: pdfBuffer.length };
  } catch (error) {
    // Enviar webhook de erro
    await webhookService.send({
      webhookUrl,
      jobId: job.id,
      status: 'failed',
      error: error.message
    });
    
    throw error;
  }
}, {
  connection: {
    host: process.env.REDIS_HOST || 'redis',
    port: process.env.REDIS_PORT || 6379
  },
  concurrency: 5
});

module.exports = worker;
```

### 6. Serviço de Geração de PDF (src/services/pdfGenerator.js)

```javascript
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
```

### 7. Serviço de Webhook (src/services/webhookService.js)

```javascript
const axios = require('axios');
const FormData = require('form-data');

async function send({ webhookUrl, jobId, status, pdfBuffer, error }) {
  const form = new FormData();
  form.append('jobId', jobId);
  form.append('status', status);
  
  if (status === 'completed' && pdfBuffer) {
    form.append('file', pdfBuffer, {
      filename: `${jobId}.pdf`,
      contentType: 'application/pdf'
    });
  }
  
  if (status === 'failed' && error) {
    form.append('error', error);
  }
  
  try {
    await axios.post(webhookUrl, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${process.env.WEBHOOK_TOKEN}`
      },
      timeout: parseInt(process.env.WEBHOOK_TIMEOUT) || 10000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
  } catch (error) {
    console.error('Erro ao enviar webhook:', error.message);
    throw error;
  }
}

module.exports = { send };
```

### 8. Configuração do Bull Board (src/config/bullBoard.js) - ÚLTIMA FASE

```javascript
// NOTA: Implementar apenas na Fase 5
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const pdfQueue = require('../queue/pdfQueue');

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(pdfQueue)],
  serverAdapter
});

module.exports = serverAdapter;
```

### 9. Aplicação Principal (src/index.js)

```javascript
require('dotenv').config();
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
// const bullBoardAdapter = require('./config/bullBoard'); // Descomentar na Fase 5
const pdfRoutes = require('./api/routes/pdfRoutes');
const { warmUp } = require('./services/browserPool');
require('./queue/pdfWorker'); // Iniciar worker

const app = express();

app.use(express.json());

// Rotas
app.use('/api', pdfRoutes);

// Swagger
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Bull Board - Descomentar na Fase 5
// app.use('/admin/queues', bullBoardAdapter.getRouter());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

async function start() {
  await warmUp();
  
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
    console.log(`Documentação: http://localhost:${port}/docs`);
    // console.log(`Bull Board: http://localhost:${port}/admin/queues`); // Descomentar na Fase 5
  });
}

start().catch(console.error);
```

## 🐳 Docker e Docker Compose

### Dockerfile

```dockerfile
FROM node:20-slim

# Instalar dependências do Playwright
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Instalar Yarn
RUN corepack enable && corepack prepare yarn@stable --activate

WORKDIR /app

COPY package.json yarn.lock* ./
RUN yarn install --frozen-lockfile --production

# Instalar browsers do Playwright
RUN yarn playwright install chromium

COPY . .

EXPOSE 3000

CMD ["yarn", "start"]
```

### docker-compose.dev.yml (Desenvolvimento com Volumes)

```yaml
version: '3.8'

services:
  app-dev:
    build: .
    volumes:
      - .:/app
      - /app/node_modules
      - playwright-cache:/ms-playwright
    environment:
      - NODE_ENV=development
      - REDIS_URL=redis://redis:6379
      - API_TOKEN=dev_token_123
      - WEBHOOK_TOKEN=dev_webhook_token_456
      - BROWSER_POOL_MIN=1
      - BROWSER_POOL_MAX=3
      - BROWSER_MAX_USES=50
    ports:
      - "3000:3000"
    command: yarn dev
    depends_on:
      - redis
    networks:
      - pdf-network

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    ports:
      - "6379:6379"
    networks:
      - pdf-network

volumes:
  playwright-cache:

networks:
  pdf-network:
    driver: bridge
```

### docker-compose.yml (Produção)

```yaml
version: '3.8'

services:
  app:
    build: .
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: "0.5"
          memory: "1024M"
        reservations:
          cpus: "0.3"
          memory: "512M"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - API_TOKEN=${API_TOKEN}
      - WEBHOOK_TOKEN=${WEBHOOK_TOKEN}
      - BROWSER_POOL_MIN=2
      - BROWSER_POOL_MAX=5
      - BROWSER_MAX_USES=50
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.pdf.rule=PathPrefix(`/`)"
      - "traefik.http.services.pdf.loadbalancer.server.port=3000"
    depends_on:
      - redis
    networks:
      - pdf-network

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    deploy:
      resources:
        limits:
          cpus: "0.2"
          memory: "512M"
    networks:
      - pdf-network

  traefik:
    image: traefik:v2.11
    ports:
      - "9090:80"      # Aplicação (inclui Swagger em /docs)
      - "3001:3001"    # Bull Board
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.bullboard.address=:3001"
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock:ro"
    networks:
      - pdf-network

networks:
  pdf-network:
    driver: bridge
```

## 🔒 Segurança e Autenticação

### Middleware de Autenticação (src/api/middlewares/auth.js)

```javascript
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  
  const token = authHeader.substring(7);
  
  if (token !== process.env.API_TOKEN) {
    return res.status(403).json({ error: 'Token inválido' });
  }
  
  next();
}

module.exports = authenticate;
```

## 🧑‍💻 Desenvolvimento com Docker

### Configuração Inicial

```bash
# Clonar o projeto
git clone <repo-url>
cd htmltopdf

# Criar arquivo .env baseado no exemplo
cp .env.example .env

# Instalar dependências usando Docker
docker run --rm -v $(pwd):/app -w /app node:20 yarn install

# Iniciar ambiente de desenvolvimento
yarn docker:dev

# Ou usando docker-compose diretamente
docker-compose -f docker-compose.dev.yml up
```

### Vantagens do Volume Docker

1. **Isolamento**: Não precisa instalar Node.js ou dependências na máquina host
2. **Hot Reload**: Alterações no código são refletidas automaticamente
3. **Consistência**: Mesmo ambiente para todos os desenvolvedores
4. **Cache do Playwright**: Volume persistente para browsers baixados

### Comandos Úteis

```bash
# Ver logs da aplicação
yarn docker:logs

# Executar comandos dentro do container
docker-compose -f docker-compose.dev.yml exec app-dev yarn add <package>

# Limpar volumes e containers
docker-compose -f docker-compose.dev.yml down -v
```

## 📊 Monitoramento

### Acessos

- **Aplicação:** http://localhost:3000 (desenvolvimento) ou http://localhost:9090 (produção)
- **Swagger/Documentação:** http://localhost:3000/docs
- **Bull Board (Fase 5):** http://localhost:3000/admin/queues (dev) ou http://localhost:3001 (prod)

### Logs Detalhados

O sistema registra automaticamente:
- ID do job criado
- Tempo de processamento
- Tamanho do PDF gerado
- Erros de processamento
- Status de webhooks

## ⚙️ Configurações Importantes

- **Timeout por job:** 30 segundos
- **Tentativas em caso de falha:** 3
- **Pool de browsers:** mínimo 2, máximo 5
- **Reutilização por browser:** 50 páginas
- **Concorrência do worker:** 2 jobs simultâneos

## 🧪 Testando a API

### Fase 1 - Teste Síncrono (Inicial)

```bash
# Teste básico de conversão (antes da implementação de filas)
curl -X POST http://localhost:3000/api/generate-sync \
  -H "Authorization: Bearer dev_token_123" \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<html><body><h1>Teste PDF</h1></body></html>"
  }' \
  --output test.pdf
```

### Fase 2+ - Teste Assíncrono com Filas

```bash
# Gerar PDF de HTML
curl -X POST http://localhost:3000/api/generate \
  -H "Authorization: Bearer dev_token_123" \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<html><body><h1>Teste PDF</h1></body></html>",
    "webhookUrl": "https://webhook.site/seu-endpoint"
  }'

# Gerar PDF de URL
curl -X POST http://localhost:3000/api/generate \
  -H "Authorization: Bearer dev_token_123" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "pageSize": "A4",
    "orientation": "portrait",
    "webhookUrl": "https://webhook.site/seu-endpoint"
  }'
```

## 📝 Notas de Implementação

1. **Fase 1 é crucial**: Foque primeiro em fazer a conversão HTML->PDF funcionar corretamente
2. **Testes incrementais**: Teste cada fase antes de avançar para a próxima
3. **Bull Board é opcional**: Implementar apenas após todo o sistema estar funcionando
4. **Use volumes Docker**: Evita problemas de compatibilidade e instalações locais
