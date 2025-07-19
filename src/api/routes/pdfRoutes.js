const express = require('express');
const authenticate = require('../middlewares/auth');
const { generatePdf } = require('../controllers/pdfController');
const { generatePdfSync } = require('../controllers/syncPdfController');
const { 
  getJobStatus, 
  downloadPdf, 
  regeneratePdf, 
  getStorageStats,
  getPresignedUrl,
  getDriverInfo
} = require('../controllers/jobController');

const router = express.Router();

/**
 * @swagger
 * /api/generate:
 *   post:
 *     tags:
 *       - PDF Generation
 *     summary: Gerar PDF a partir de HTML ou URL
 *     description: |
 *       Cria um job assíncrono para gerar um PDF. O webhook é **opcional**.
 *       
 *       **Com webhook**: Você receberá uma notificação automática quando o PDF estiver pronto
 *       **Sem webhook**: Use os endpoints de consulta para verificar status e fazer download
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               html:
 *                 type: string
 *                 description: Conteúdo HTML para converter em PDF
 *                 example: '<html><body><h1>Meu PDF</h1></body></html>'
 *               url:
 *                 type: string
 *                 description: URL para converter em PDF
 *                 example: 'https://example.com'
 *               pageSize:
 *                 type: string
 *                 enum: [A4, A3, Letter, Square]
 *                 default: A4
 *                 description: Tamanho da página
 *               orientation:
 *                 type: string
 *                 enum: [portrait, landscape]
 *                 default: portrait
 *                 description: Orientação da página
 *               webhookUrl:
 *                 type: string
 *                 description: |
 *                   **OPCIONAL**: URL para receber notificação quando PDF estiver pronto.
 *                   
 *                   O webhook receberá:
 *                   - Headers: Authorization: Bearer {WEBHOOK_TOKEN}
 *                   - Content-Type: multipart/form-data
 *                   - Dados: jobId, status, file (se sucesso), error (se falha)
 *                 example: 'https://meusite.com/webhook'
 *             required:
 *               - html ou url (pelo menos um)
 *             example:
 *               html: '<html><body><h1>Meu PDF</h1><p>Conteúdo do documento</p></body></html>'
 *               pageSize: 'A4'
 *               orientation: 'portrait'
 *               webhookUrl: 'https://meusite.com/webhook'
 *     responses:
 *       200:
 *         description: Job criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobId:
 *                   type: string
 *                   description: ID único do job
 *                   example: 'a3fafc13-e776-4fcb-a100-c474ea6422a4'
 *                 status:
 *                   type: string
 *                   example: 'queued'
 *                 message:
 *                   type: string
 *                   description: Informação sobre como o PDF será entregue
 *                   example: 'PDF será gerado e notificado via webhook'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'HTML ou URL deve ser fornecido'
 *       401:
 *         description: Token não fornecido
 *       403:
 *         description: Token inválido
 */
router.post('/generate', authenticate, generatePdf);

/**
 * @swagger
 * /api/generate-sync:
 *   post:
 *     tags:
 *       - PDF Generation
 *     summary: Gerar PDF de forma síncrona (para HTMLs pequenos)
 *     description: |
 *       Gera um PDF de forma síncrona diretamente a partir de HTML.
 *       **IMPORTANTE**: Este endpoint tem limite de tamanho e é adequado apenas para HTMLs pequenos e simples.
 *       
 *       **Características**:
 *       - Processamento síncrono (resposta imediata)
 *       - Limite de tamanho configurável (padrão: 50KB)
 *       - Não utiliza sistema de filas
 *       - Retorna JSON com link OU arquivo PDF diretamente
 *       
 *       **Tipos de resposta**:
 *       - **JSON**: Padrão, retorna link de download
 *       - **PDF direto**: Use `Accept: application/pdf` ou `?download=true`
 *       
 *       **Quando usar**:
 *       - HTMLs pequenos e simples
 *       - Quando precisar de resposta imediata
 *       - Para prototipagem e testes
 *       
 *       **Para HTMLs maiores ou complexos**: Use `/api/generate`
 *     parameters:
 *       - in: query
 *         name: download
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Se 'true', retorna o PDF diretamente para download
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               html:
 *                 type: string
 *                 description: Conteúdo HTML para converter em PDF (tamanho limitado)
 *                 example: '<html><body><h1>PDF Simples</h1><p>Conteúdo leve</p></body></html>'
 *               pageSize:
 *                 type: string
 *                 enum: [A4, A3, Letter, Square]
 *                 default: A4
 *                 description: Tamanho da página
 *               orientation:
 *                 type: string
 *                 enum: [portrait, landscape]
 *                 default: portrait
 *                 description: Orientação da página
 *             required:
 *               - html
 *             example:
 *               html: '<html><body><h1>PDF Simples</h1><p>Este é um exemplo de HTML pequeno.</p></body></html>'
 *               pageSize: 'A4'
 *               orientation: 'portrait'
 *     responses:
 *       200:
 *         description: PDF gerado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 fileId:
 *                   type: string
 *                   description: ID único do arquivo
 *                   example: 'a3fafc13-e776-4fcb-a100-c474ea6422a4'
 *                 fileName:
 *                   type: string
 *                   description: Nome do arquivo gerado
 *                   example: 'sync_a3fafc13-e776-4fcb-a100-c474ea6422a4.pdf'
 *                 downloadUrl:
 *                   type: string
 *                   description: URL para download do PDF
 *                   example: '/api/jobs/a3fafc13-e776-4fcb-a100-c474ea6422a4/download'
 *                 size:
 *                   type: number
 *                   description: Tamanho do PDF gerado (em bytes)
 *                   example: 15360
 *                 htmlSize:
 *                   type: number
 *                   description: Tamanho do HTML enviado (em bytes)
 *                   example: 1024
 *                 message:
 *                   type: string
 *                   example: 'PDF gerado com sucesso'
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *               description: Arquivo PDF binário (quando Accept=application/pdf ou download=true)
 *             headers:
 *               Content-Disposition:
 *                 schema:
 *                   type: string
 *                   example: 'attachment; filename="sync_uuid.pdf"'
 *               X-File-ID:
 *                 schema:
 *                   type: string
 *                   example: 'a3fafc13-e776-4fcb-a100-c474ea6422a4'
 *               X-HTML-Size:
 *                 schema:
 *                   type: number
 *                   example: 1024
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'HTML é obrigatório para o endpoint síncrono'
 *       401:
 *         description: Token não fornecido
 *       403:
 *         description: Token inválido
 *       408:
 *         description: Timeout no processamento
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Timeout ao gerar PDF. Tente novamente com HTML menor ou use o endpoint assíncrono.'
 *                 suggestion:
 *                   type: string
 *                   example: 'Use o endpoint /api/generate para conteúdo maior'
 *       413:
 *         description: HTML muito grande ou complexo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'HTML muito grande. Tamanho máximo permitido: 50KB. Tamanho atual: 75KB'
 *                 maxSize:
 *                   type: number
 *                   description: Tamanho máximo permitido (em bytes)
 *                   example: 51200
 *                 currentSize:
 *                   type: number
 *                   description: Tamanho atual do HTML (em bytes)
 *                   example: 76800
 *                 suggestion:
 *                   type: string
 *                   example: 'Use o endpoint /api/generate para conteúdo maior'
 */
router.post('/generate-sync', authenticate, generatePdfSync);

/**
 * @swagger
 * /api/jobs/{jobId}/status:
 *   get:
 *     tags:
 *       - Job Management
 *     summary: Consultar status de um job
 *     description: |
 *       Verifica o status atual de um job de geração de PDF.
 *       
 *       **Status possíveis**:
 *       - `queued`: Job criado e aguardando processamento
 *       - `processing`: PDF sendo gerado
 *       - `completed`: PDF gerado e disponível para download
 *       - `failed`: Erro na geração do PDF
 *       - `expired`: PDF expirado e removido
 *       - `not_found`: Job não encontrado
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do job retornado na criação
 *         example: 'a3fafc13-e776-4fcb-a100-c474ea6422a4'
 *     responses:
 *       200:
 *         description: Status do job
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/JobStatus'
 *             examples:
 *               completed:
 *                 summary: Job completado
 *                 value:
 *                   status: 'completed'
 *                   jobId: 'a3fafc13-e776-4fcb-a100-c474ea6422a4'
 *                   createdAt: '2025-07-18T10:30:00Z'
 *                   expiresAt: '2025-07-19T10:30:00Z'
 *                   size: 15340
 *                   filename: 'a3fafc13-e776-4fcb-a100-c474ea6422a4.pdf'
 *               failed:
 *                 summary: Job falhou
 *                 value:
 *                   status: 'failed'
 *                   jobId: 'a3fafc13-e776-4fcb-a100-c474ea6422a4'
 *                   error: 'Erro ao processar HTML'
 *       404:
 *         description: Job não encontrado
 */
router.get('/jobs/:jobId/status', authenticate, getJobStatus);

/**
 * @swagger
 * /api/jobs/{jobId}/download:
 *   get:
 *     tags:
 *       - Job Management
 *     summary: Fazer download do PDF gerado
 *     description: |
 *       Faz o download direto do arquivo PDF gerado.
 *       
 *       **Importante**: O PDF expira após o tempo configurado.
 *       Se expirado, use o endpoint de regeneração.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do job
 *         example: 'a3fafc13-e776-4fcb-a100-c474ea6422a4'
 *     responses:
 *       200:
 *         description: Arquivo PDF
 *         headers:
 *           Content-Type:
 *             schema:
 *               type: string
 *               example: 'application/pdf'
 *           Content-Disposition:
 *             schema:
 *               type: string
 *               example: 'attachment; filename="a3fafc13-e776-4fcb-a100-c474ea6422a4.pdf"'
 *           Content-Length:
 *             schema:
 *               type: integer
 *               example: 15340
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: PDF não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'PDF não encontrado'
 *                 message:
 *                   type: string
 *                   example: 'Job não encontrado ou PDF não foi gerado'
 *       410:
 *         description: PDF expirado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'PDF expirado'
 *                 message:
 *                   type: string
 *                   example: 'O PDF expirou e foi removido. Você pode gerar um novo PDF usando o mesmo conteúdo.'
 *                 suggestion:
 *                   type: string
 *                   example: 'Use o endpoint /api/regenerate com o mesmo jobId ou crie um novo job'
 */
router.get('/jobs/:jobId/download', authenticate, downloadPdf);

/**
 * @swagger
 * /api/jobs/{jobId}/regenerate:
 *   post:
 *     tags:
 *       - Job Management
 *     summary: Regenerar PDF expirado
 *     description: |
 *       Cria um novo job para regenerar um PDF expirado usando os dados originais.
 *       
 *       **Quando usar**:
 *       - Quando o PDF original expirou (erro 410 no download)
 *       - Para reprocessar um PDF com os mesmos parâmetros
 *       
 *       **Nota**: Um novo jobId será gerado para o PDF regenerado.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do job original
 *         example: 'a3fafc13-e776-4fcb-a100-c474ea6422a4'
 *     responses:
 *       200:
 *         description: PDF será regenerado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 newJobId:
 *                   type: string
 *                   description: ID do novo job criado
 *                   example: 'a3fafc13-e776-4fcb-a100-c474ea6422a4-regen-1642518000000'
 *                 originalJobId:
 *                   type: string
 *                   description: ID do job original
 *                   example: 'a3fafc13-e776-4fcb-a100-c474ea6422a4'
 *                 status:
 *                   type: string
 *                   example: 'queued'
 *                 message:
 *                   type: string
 *                   example: 'PDF será regenerado com um novo jobId'
 *       404:
 *         description: Job original não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Job original não encontrado'
 *                 message:
 *                   type: string
 *                   example: 'Não é possível regenerar PDF sem os dados originais do job'
 */
router.post('/jobs/:jobId/regenerate', authenticate, regeneratePdf);

/**
 * @swagger
 * /api/storage/stats:
 *   get:
 *     tags:
 *       - Storage
 *     summary: Estatísticas do armazenamento de PDFs
 *     description: |
 *       Retorna informações sobre o uso atual do armazenamento de PDFs.
 *       
 *       **Métricas incluídas**:
 *       - Número de PDFs ativos e expirados
 *       - Tamanho total ocupado
 *       - Configurações de expiração
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas do storage
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 active:
 *                   type: number
 *                   description: Número de PDFs ativos (não expirados)
 *                   example: 5
 *                 expired:
 *                   type: number
 *                   description: Número de PDFs expirados pendentes de limpeza
 *                   example: 2
 *                 totalSize:
 *                   type: number
 *                   description: Tamanho total em bytes dos PDFs ativos
 *                   example: 1234567
 *                 total:
 *                   type: number
 *                   description: Número total de jobs rastreados
 *                   example: 7
 *                 expirationSeconds:
 *                   type: number
 *                   description: Segundos até expiração dos PDFs
 *                   example: 86400
 *                 storageDir:
 *                   type: string
 *                   description: Diretório de armazenamento
 *                   example: './pdfs'
 */
router.get('/storage/stats', authenticate, getStorageStats);

/**
 * @swagger
 * /api/storage/driver:
 *   get:
 *     tags:
 *       - Storage
 *     summary: Informações do driver de armazenamento
 *     description: |
 *       Retorna informações sobre o driver de armazenamento atual e suas capacidades.
 *       
 *       **Drivers disponíveis**:
 *       - `local`: Armazenamento no sistema de arquivos local
 *       - `s3`: Armazenamento no Amazon S3 (suporta URLs pré-assinadas)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Informações do driver
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 type:
 *                   type: string
 *                   description: Tipo do driver atual
 *                   example: 's3'
 *                 supportsPresignedUrls:
 *                   type: boolean
 *                   description: Se o driver suporta URLs pré-assinadas
 *                   example: true
 *                 availableDrivers:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Lista de drivers disponíveis
 *                   example: ['local', 's3']
 *                 configuration:
 *                   type: object
 *                   description: Configurações específicas do driver
 */
router.get('/storage/driver', authenticate, getDriverInfo);

/**
 * @swagger
 * /api/jobs/{jobId}/presigned-url:
 *   get:
 *     tags:
 *       - Job Management
 *     summary: Obter URL pré-assinada para download (S3 apenas)
 *     description: |
 *       Gera uma URL pré-assinada para download direto do S3, sem passar pelo servidor.
 *       
 *       **Disponível apenas para o driver S3**.
 *       
 *       **Vantagens**:
 *       - Download direto do S3 (mais rápido)
 *       - Reduz carga no servidor
 *       - URL temporária e segura
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do job
 *         example: 'a3fafc13-e776-4fcb-a100-c474ea6422a4'
 *       - in: query
 *         name: expiresIn
 *         required: false
 *         schema:
 *           type: integer
 *           default: 3600
 *           minimum: 60
 *           maximum: 604800
 *         description: Tempo de expiração da URL em segundos (1 hora a 7 dias)
 *         example: 3600
 *     responses:
 *       200:
 *         description: URL pré-assinada gerada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobId:
 *                   type: string
 *                   example: 'a3fafc13-e776-4fcb-a100-c474ea6422a4'
 *                 presignedUrl:
 *                   type: string
 *                   description: URL para download direto
 *                   example: 'https://s3.amazonaws.com/bucket/file.pdf?signature=...'
 *                 expiresIn:
 *                   type: integer
 *                   description: Tempo de expiração em segundos
 *                   example: 3600
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *                   description: Data/hora de expiração da URL
 *                   example: '2025-07-19T11:30:00Z'
 *                 message:
 *                   type: string
 *                   example: 'URL pré-assinada gerada com sucesso'
 *       400:
 *         description: Driver não suporta URLs pré-assinadas ou parâmetros inválidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'URLs pré-assinadas não suportadas'
 *                 message:
 *                   type: string
 *                   example: 'O driver atual (local) não suporta URLs pré-assinadas. Use o driver S3.'
 *       404:
 *         description: Job não encontrado
 *       410:
 *         description: PDF expirado
 */
router.get('/jobs/:jobId/presigned-url', authenticate, getPresignedUrl);

module.exports = router;
