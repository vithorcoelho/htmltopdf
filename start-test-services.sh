#!/bin/bash

echo "🚀 Iniciando serviços para teste do endpoint /api/generate-url"
echo

# Função para limpeza ao sair
cleanup() {
    echo
    echo "🧹 Limpando processos..."
    jobs -p | xargs -r kill
    exit 0
}

# Capturar Ctrl+C
trap cleanup SIGINT

# Verificar se as portas estão livres
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo "❌ Porta $1 já está em uso"
        echo "💡 Para liberar: sudo lsof -ti:$1 | xargs kill -9"
        return 1
    fi
    return 0
}

echo "🔍 Verificando portas..."
if ! check_port 3000; then
    echo "⚠️  Serviço principal pode já estar rodando na porta 3000"
fi

if ! check_port 3001; then
    echo "❌ Webhook de teste não pode iniciar - porta 3001 em uso"
    exit 1
fi

echo "✅ Portas disponíveis"
echo

# Iniciar webhook de teste
echo "📡 Iniciando webhook de teste na porta 3001..."
node webhook-test-server.js &
WEBHOOK_PID=$!

# Aguardar webhook inicializar
sleep 2

# Verificar se webhook está rodando
if ! kill -0 $WEBHOOK_PID 2>/dev/null; then
    echo "❌ Falha ao iniciar webhook de teste"
    exit 1
fi

echo "✅ Webhook de teste ativo: http://localhost:3001/webhook"
echo

# Verificar se serviço principal está rodando
echo "🔍 Verificando serviço principal..."
if curl -s http://localhost:3000/api/storage/stats > /dev/null 2>&1; then
    echo "✅ Serviço principal já está rodando na porta 3000"
else
    echo "⚠️  Serviço principal não detectado na porta 3000"
    echo "💡 Para iniciar: npm start (em outro terminal)"
    echo
fi

echo "🧪 Exemplo de teste:"
echo "node test-url-to-pdf.js"
echo
echo "📋 URLs úteis:"
echo "   Status webhook: http://localhost:3001/status"
echo "   PDFs recebidos: http://localhost:3001/pdfs"
echo "   Download PDF: http://localhost:3001/download/{filename}"
echo
echo "🛑 Pressione Ctrl+C para parar todos os serviços"
echo

# Manter script rodando
wait
