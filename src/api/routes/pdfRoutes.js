const express = require('express');
const authenticate = require('../middlewares/auth');
const { generatePdf } = require('../controllers/pdfController');
const { getJobStatus, downloadPdf, regeneratePdf, getStorageStats } = require('../controllers/jobController');

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
 *       **Importante**: O PDF expira em 24 horas após a geração.
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
 *                 expirationHours:
 *                   type: number
 *                   description: Horas até expiração dos PDFs
 *                   example: 24
 *                 storageDir:
 *                   type: string
 *                   description: Diretório de armazenamento
 *                   example: './pdfs'
 */
router.get('/storage/stats', authenticate, getStorageStats);

module.exports = router;
