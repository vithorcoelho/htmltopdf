# Integração com Amazon S3

Este documento descreve como configurar e usar a integração com Amazon S3 para armazenamento de PDFs.

## Drivers Disponíveis

A aplicação suporta dois drivers de armazenamento:

### 1. Local Storage (Padrão)
- Armazena PDFs no sistema de arquivos local
- Ideal para desenvolvimento e pequenos volumes
- Não suporta URLs pré-assinadas

### 2. Amazon S3
- Armazena PDFs no Amazon S3 ou serviços compatíveis
- Ideal para produção e alta disponibilidade
- Suporta URLs pré-assinadas para download direto
- Escalável e confiável

## Configuração

### Variáveis de Ambiente

#### Driver Selection
```bash
# Escolher o driver: 'local' ou 's3'
STORAGE_DRIVER=s3
```

#### Configuração S3
```bash
# Credenciais AWS (obrigatórias)
AWS_ACCESS_KEY_ID=sua-access-key
AWS_SECRET_ACCESS_KEY=sua-secret-key

# Configurações do bucket
AWS_S3_BUCKET=htmltopdf-storage
AWS_REGION=us-east-1
AWS_S3_PREFIX=pdfs/

# Opcional: para usar com LocalStack/MinIO
AWS_ENDPOINT_URL=http://localhost:4566
```

#### Configuração Geral
```bash
# Tempo de expiração dos PDFs
PDF_EXPIRATION_SECONDS=86400
```

### Configuração AWS IAM

Para usar o S3, você precisa de uma conta AWS com as seguintes permissões:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::seu-bucket/*",
                "arn:aws:s3:::seu-bucket"
            ]
        }
    ]
}
```

## Recursos Específicos do S3

### URLs Pré-assinadas

O driver S3 oferece URLs pré-assinadas para download direto:

```bash
# Endpoint para gerar URL pré-assinada
GET /api/jobs/{jobId}/presigned-url?expiresIn=3600

# Resposta
{
  "jobId": "uuid-do-job",
  "presignedUrl": "https://s3.amazonaws.com/bucket/file.pdf?signature=...",
  "expiresIn": 3600,
  "expiresAt": "2025-07-19T11:30:00Z",
  "message": "URL pré-assinada gerada com sucesso"
}
```

**Vantagens das URLs pré-assinadas:**
- Download direto do S3 (mais rápido)
- Reduz carga no servidor
- URLs temporárias e seguras
- Suporte a downloads resumíveis

### Metadados

O driver S3 armazena metadados automaticamente:
- `jobId`: ID do job
- `createdAt`: Data de criação
- Dados customizados do job

## Migração entre Drivers

### De Local para S3

1. Configure as variáveis de ambiente do S3
2. Altere `STORAGE_DRIVER=s3`
3. Reinicie a aplicação
4. PDFs antigos no storage local não serão migrados automaticamente

### De S3 para Local

1. Altere `STORAGE_DRIVER=local`
2. Configure `PDF_STORAGE_DIR`
3. Reinicie a aplicação
4. PDFs antigos no S3 não serão migrados automaticamente

## Desenvolvimento com LocalStack

Para desenvolvimento local, você pode usar LocalStack:

```bash
# Docker Compose para LocalStack
version: '3.8'
services:
  localstack:
    image: localstack/localstack:latest
    ports:
      - "4566:4566"
    environment:
      - SERVICES=s3
      - DEBUG=1
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock"
```

```bash
# Configuração .env para LocalStack
STORAGE_DRIVER=s3
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_S3_BUCKET=htmltopdf-dev
AWS_REGION=us-east-1
AWS_ENDPOINT_URL=http://localhost:4566
```

```bash
# Criar bucket no LocalStack
aws --endpoint-url=http://localhost:4566 s3 mb s3://htmltopdf-dev
```

## Monitoramento

### Verificar Driver Atual

```bash
GET /api/storage/driver
```

Resposta:
```json
{
  "type": "s3",
  "supportsPresignedUrls": true,
  "availableDrivers": ["local", "s3"],
  "configuration": {
    "expirationSeconds": 86400,
    "bucket": "htmltopdf-storage",
    "region": "us-east-1",
    "prefix": "pdfs/"
  }
}
```

### Estatísticas de Storage

```bash
GET /api/storage/stats
```

Resposta:
```json
{
  "active": 5,
  "expired": 2,
  "totalSize": 1234567,
  "total": 7,
  "expirationSeconds": 86400,
  "driver": {
    "type": "s3",
    "supportsPresignedUrls": true
  }
}
```

## Custos S3

### Estimativa de Custos

Para estimar custos do S3:

1. **Armazenamento**: ~$0.023/GB/mês (Standard)
2. **Requests PUT**: ~$0.0005 per 1,000 requests
3. **Requests GET**: ~$0.0004 per 1,000 requests
4. **Transferência de dados**: ~$0.09/GB (primeiros 10TB)

### Otimização

- Use `PDF_EXPIRATION_SECONDS` adequado ao seu caso
- Configure lifecycle policies no S3
- Considere S3 Intelligent-Tiering para arquivos antigos

## Troubleshooting

### Erro: "Configuração inválida para o driver de storage"

Verifique se todas as variáveis obrigatórias estão definidas:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

### Erro: "URLs pré-assinadas não suportadas"

Este endpoint só funciona com o driver S3. Verifique:
- `STORAGE_DRIVER=s3`
- Credenciais AWS válidas

### Erro: "Access Denied"

Verifique as permissões IAM e se o bucket existe.

### Debug

Ative logs detalhados:
```bash
DEBUG=htmltopdf:* npm start
```

## Backup e Recuperação

### Backup
- S3 oferece versionamento nativo
- Configure Cross-Region Replication se necessário
- Use S3 Glacier para arquivamento

### Recuperação
- PDFs são regeneráveis a partir dos dados do job
- Use endpoint `/api/jobs/{jobId}/regenerate`

## Segurança

### Boas Práticas
1. Use IAM roles em produção (evite credenciais hardcoded)
2. Configure bucket policies restritivas
3. Use VPC endpoints para tráfego interno AWS
4. Monitore logs do CloudTrail
5. Configure notificações S3 para auditoria

### Criptografia
- S3 suporta criptografia em repouso (SSE)
- Configure via AWS Console ou Terraform

## Performance

### Otimizações
1. Use regions próximas aos usuários
2. Configure CloudFront para cache (se aplicável)
3. Use multipart uploads para arquivos grandes
4. Configure Transfer Acceleration se necessário

### Métricas
- Monitore latência via CloudWatch
- Configure alertas para falhas de upload
- Monitore custos via AWS Cost Explorer
