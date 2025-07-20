# 🔗 Webhook Test Server

Servidor de teste para receber e validar webhooks da API HTML to PDF.

## 🚀 Como usar

### 1. Instalar dependências
```bash
cd webhook
npm install
```

### 2. Iniciar o servidor
```bash
npm start
# ou para desenvolvimento com auto-reload:
npm run dev
```

### 3. Testar com a API
Use a URL do webhook: `http://localhost:3030/webhook`

## 📡 Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/webhook` | Recebe webhooks (validação + PDFs) |
| GET | `/status` | Status do servidor |
| GET | `/history` | Histórico de requisições |
| GET | `/files` | Lista arquivos salvos |
| GET | `/download/:filename` | Download de arquivo |
| DELETE | `/history` | Limpa histórico |
| DELETE | `/files` | Limpa arquivos |

## 🧪 Fluxo de teste

1. **Validação inicial**: A API envia `{"status": "processing"}` para validar o webhook
2. **Processamento**: Durante o processamento, podem vir notificações de status
3. **PDF final**: O PDF é enviado via `multipart/form-data` com metadata
4. **Erros**: Se houver erro, é enviada notificação JSON com detalhes

## 📁 Estrutura de arquivos

```
webhook/
├── webhookTest.js       # Servidor principal
├── package.json         # Dependências
├── upload/             # PDFs salvos aqui
└── README.md           # Esta documentação
```

## 📋 Exemplo de uso com curl

### Validação inicial (o que a API faz):
```bash
curl -X POST http://localhost:3030/webhook \
  -H "Content-Type: application/json" \
  -d '{"status": "processing"}'
```

### Envio de PDF (simulação):
```bash
curl -X POST http://localhost:3030/webhook \
  -F "file=@exemplo.pdf" \
  -F "status=Gerado com sucesso" \
  -F "url=https://example.com" \
  -F "fileSize=12345"
```

## 🔍 Monitoramento

- **Console**: Veja requisições em tempo real
- **Web Interface**: Acesse http://localhost:3030
- **Histórico**: GET /history para ver todas as requisições
- **Arquivos**: GET /files para listar PDFs salvos

## ⚙️ Configurações

- **Porta**: 3030 (modificar no código se necessário)
- **Pasta upload**: `./upload/`
- **Limite de arquivo**: 50MB
- **Tipos aceitos**: Apenas PDF
- **Histórico**: Últimas 50 requisições

## 🐛 Troubleshooting

### Erro de permissão na pasta upload
```bash
chmod 755 upload/
```

### Porta já em uso
Modifique a variável `port` no arquivo `webhookTest.js`

### Arquivo muito grande
O limite é 50MB. Para arquivos maiores, ajuste `limits.fileSize` no código.
