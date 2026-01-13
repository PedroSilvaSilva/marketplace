# Fix Memory Issue - Start Server with Increased Memory
# Use this script to start the server with 8GB memory limit

Write-Host "🚀 Iniciando servidor com limite de memória aumentado (8GB)..." -ForegroundColor Cyan
Write-Host ""

# Set Node options with GC exposure
$env:NODE_OPTIONS="--max-old-space-size=8192 --expose-gc"

Write-Host "✅ NODE_OPTIONS configurado: $env:NODE_OPTIONS" -ForegroundColor Green
Write-Host "📦 Iniciando servidor..." -ForegroundColor Yellow
Write-Host ""

# Start server
pnpm dev
