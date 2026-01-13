# Solução para Erro de Memória (Out of Memory)

Write-Host "🔧 Limpando cache e preparando ambiente..." -ForegroundColor Cyan

# Limpar cache do Node
Write-Host "Limpando cache do pnpm..." -ForegroundColor Yellow
pnpm store prune

# Limpar node_modules antigos se necessário
if (Test-Path "node_modules") {
    Write-Host "Limpando node_modules antigo..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
}

# Reinstalar dependências
Write-Host "Reinstalando dependências..." -ForegroundColor Yellow
pnpm install

Write-Host ""
Write-Host "✅ Ambiente limpo e preparado!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 O package.json foi atualizado para usar mais memória:" -ForegroundColor Cyan
Write-Host "   - Limite aumentado para 8GB (--max-old-space-size=8192)" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Agora pode executar:" -ForegroundColor Cyan
Write-Host "   pnpm dev" -ForegroundColor White
Write-Host ""
