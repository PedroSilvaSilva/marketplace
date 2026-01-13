# Script seguro para adicionar tabela de logs de erro
# NÃO ALTERA dados existentes - apenas adiciona nova tabela

Write-Host "🔒 Executando migração SEGURA (apenas adiciona tabela)..." -ForegroundColor Cyan
Write-Host "✅ Dados existentes NÃO serão afetados" -ForegroundColor Green
Write-Host ""

# Executar o script SQL
$sqlScript = Get-Content "add-error-logs-table.sql" -Raw

# Usar Prisma para executar o SQL de forma segura
$env:DATABASE_URL = "postgresql://postgres:Ekf2dmpedro@localhost:5432/cswmarkets"

# Criar arquivo temporário com o comando
$tempFile = [System.IO.Path]::GetTempFileName()
$sqlScript | Out-File -FilePath $tempFile -Encoding UTF8

Write-Host "📝 Executando SQL via npx prisma db execute..." -ForegroundColor Yellow

npx prisma db execute --file add-error-logs-table.sql --schema prisma/schema.prisma

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Tabela error_notification_logs criada com sucesso!" -ForegroundColor Green
    Write-Host "✅ Todos os dados existentes estão intactos" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎯 Próximos passos:" -ForegroundColor Cyan
    Write-Host "   1. Executar: npx prisma generate" -ForegroundColor White
    Write-Host "   2. Reiniciar o servidor: pnpm dev" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ Erro ao criar tabela" -ForegroundColor Red
    Write-Host "   Os dados existentes NÃO foram afetados" -ForegroundColor Yellow
}

# Limpar arquivo temporário
if (Test-Path $tempFile) {
    Remove-Item $tempFile -Force
}
