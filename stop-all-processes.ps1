# Script para parar todos os processos Node do projeto com segurança
Write-Host "🛑 Parando todos os processos Node.js do projeto..." -ForegroundColor Yellow

# Encontrar processos Node relacionados com o projeto
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    Write-Host "`n📋 Processos encontrados:" -ForegroundColor Cyan
    foreach ($process in $nodeProcesses) {
        Write-Host "  - PID: $($process.Id) | Memory: $([math]::Round($process.WorkingSet64 / 1MB, 2)) MB" -ForegroundColor Gray
    }
    
    Write-Host "`n⏳ Tentando parar gracefully..." -ForegroundColor Yellow
    foreach ($process in $nodeProcesses) {
        try {
            # Tentar parar gracefully primeiro
            $process.CloseMainWindow() | Out-Null
            Start-Sleep -Milliseconds 500
            
            if (!$process.HasExited) {
                # Se não parar, forçar
                Stop-Process -Id $process.Id -Force
                Write-Host "✓ Processo PID $($process.Id) parado" -ForegroundColor Green
            } else {
                Write-Host "✓ Processo PID $($process.Id) parado gracefully" -ForegroundColor Green
            }
        } catch {
            Write-Host "✗ Erro ao parar processo PID $($process.Id): $_" -ForegroundColor Red
        }
    }
    
    Write-Host "`n✅ Todos os processos foram parados" -ForegroundColor Green
} else {
    Write-Host "`n ℹ️  Nenhum processo Node.js encontrado" -ForegroundColor Yellow
}

# Limpar cache do tsx
Write-Host "`n🧹 Limpando cache do tsx..." -ForegroundColor Yellow
$tsxCachePath = "$env:USERPROFILE\.tsx"
if (Test-Path $tsxCachePath) {
    Remove-Item -Path $tsxCachePath -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "✓ Cache do tsx limpo" -ForegroundColor Green
} else {
    Write-Host "ℹ️  Cache do tsx não encontrado" -ForegroundColor Gray
}

Write-Host "`n🎯 Pronto! O sistema está limpo e pronto para reiniciar." -ForegroundColor Green
Write-Host "Execute: .\start-dev.ps1 para iniciar o servidor" -ForegroundColor Cyan
