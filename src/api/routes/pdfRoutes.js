const express = require('express');
const authenticate = require('../middlewares/auth');
const { generatePdfSync } = require('../controllers/syncPdfController');
const { generatePdfFromUrl } = require('../controllers/urlToPdfController');
const { getJobStatus } = require('../controllers/jobController');

const router = express.Router();

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
 * /api/generate-url:
 *   post:
 *     tags:
 *       - PDF Generation
 *     summary: Gerar PDF a partir de URL com validação síncrona de webhook
 *     description: |
 *       Endpoint simplificado que gera PDF apenas a partir de URL e envia o resultado via webhook.
 *       **Não armazena arquivos** - o PDF é enviado diretamente para o webhook.
 *       
 *       **Fluxo do processo**:
 *       1. **Validação síncrona** do webhook (timeout 2s): `{"status": "Geração do PDF iniciada"}`
 *       2. Se webhook retornar 200, aceita requisição e inicia geração
 *       3. Se webhook falhar, retorna erro 400 imediatamente
 *       4. PDF é gerado de forma assíncrona e enviado via webhook
 *       
 *       **Características**:
 *       - **Validação síncrona** do webhook (2 segundos de timeout)
 *       - **Falha rápida** se webhook não responder
 *       - Processamento assíncrono após validação
 *       - Sem armazenamento local
 *       - Limite de 10MB para o PDF gerado
 *       - Timeout de 60s para carregamento da página
 *       
 *       **Webhook deve aceitar**:
 *       - POST com JSON para validação inicial e notificações
 *       - POST com multipart/form-data para receber o PDF
 *       - **Deve responder em até 2 segundos**
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: URL da página para converter em PDF
 *                 example: 'https://www.google.com'
 *               webhook:
 *                 type: string
 *                 format: uri
 *                 description: URL do webhook para receber notificações e o PDF
 *                 example: 'https://meusite.com/webhook'
 *             required:
 *               - url
 *               - webhook
 *             example:
 *               url: 'https://www.band.com.br/esportes'
 *               webhook: 'https://meusite.com/pdf-webhook'
 *     responses:
 *       202:
 *         description: Webhook validado - processamento iniciado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'Webhook validado - PDF será gerado'
 *                 url:
 *                   type: string
 *                   example: 'https://www.google.com'
 *                 webhook:
 *                   type: string
 *                   example: 'https://meusite.com/webhook'
 *                 status:
 *                   type: string
 *                   example: 'Processamento iniciado'
 *       400:
 *         description: Dados inválidos ou webhook inválido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Timeout na validação do webhook'
 *                 details:
 *                   type: string
 *                   example: 'Webhook deve responder em até 2 segundos'
 *                 webhookUrl:
 *                   type: string
 *                   example: 'https://meusite.com/webhook'
 *                 timeout:
 *                   type: string
 *                   example: '2 segundos'
 *                 suggestion:
 *                   type: string
 *                   example: 'Verifique se o webhook está ativo e responde rapidamente'
 *             examples:
 *               missing_params:
 *                 summary: Parâmetros obrigatórios ausentes
 *                 value:
 *                   error: 'URL e webhook são obrigatórios'
 *                   example:
 *                     url: 'https://example.com'
 *                     webhook: 'https://meusite.com/webhook'
 *               invalid_url:
 *                 summary: URL inválida
 *                 value:
 *                   error: 'URL ou webhook inválido'
 *                   details: 'Invalid URL'
 *               webhook_timeout:
 *                 summary: Webhook não responde em 2 segundos
 *                 value:
 *                   error: 'Timeout na validação do webhook'
 *                   details: 'Webhook deve responder em até 2 segundos'
 *                   webhookUrl: 'https://meusite.com/webhook'
 *                   timeout: '2 segundos'
 *                   suggestion: 'Verifique se o webhook está ativo e responde rapidamente'
 *               webhook_error:
 *                 summary: Webhook retorna erro
 *                 value:
 *                   error: 'Webhook retornou erro'
 *                   details: 'Status 500: Internal Server Error'
 *                   webhookUrl: 'https://meusite.com/webhook'
 *               webhook_unreachable:
 *                 summary: Webhook inacessível
 *                 value:
 *                   error: 'Webhook inacessível'
 *                   details: 'Não foi possível conectar ao webhook'
 *                   webhookUrl: 'https://meusite.com/webhook'
 *       401:
 *         description: Token não fornecido
 *       403:
 *         description: Token inválido
 */
router.post('/generate-url', authenticate, generatePdfFromUrl);

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

module.exports = router;
