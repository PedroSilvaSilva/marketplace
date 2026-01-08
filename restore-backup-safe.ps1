# ============================================
# RESTORE SEGURO - Preserva tabelas novas
# ============================================

$backupFile = "cswmarket.sql"
$dbName = "CSWMarkets"
$tempDb = "CSWMarkets_temp"

Write-Host "=== Restore Seguro do Backup ===" -ForegroundColor Cyan

# 1. Criar database temporária
Write-Host "`n[1/4] Criando database temporária..." -ForegroundColor Yellow
psql -U postgres -c "DROP DATABASE IF EXISTS $tempDb;"
psql -U postgres -c "CREATE DATABASE $tempDb;"

# 2. Restaurar backup na temporária
Write-Host "[2/4] Restaurando backup na database temporária..." -ForegroundColor Yellow
pg_restore -U postgres -d $tempDb -v $backupFile

# 3. Exportar apenas os dados que precisas
Write-Host "[3/4] Exportando dados das tabelas..." -ForegroundColor Yellow

# Lista de tabelas para restaurar dados
$tables = @(
    "users",
    "profiles", 
    "sessions",
    "organizations",
    "organization_members",
    "provider_configs",
    "data_source_configurations",
    "sync_configurations"
)

foreach ($table in $tables) {
    Write-Host "  - Copiando $table" -ForegroundColor Gray
    psql -U postgres -d $tempDb -c "\COPY $table TO 'backup_$table.csv' CSV HEADER;"
}

# 4. Importar dados para a database atual
Write-Host "[4/4] Importando dados para $dbName..." -ForegroundColor Yellow

foreach ($table in $tables) {
    Write-Host "  - Importando $table" -ForegroundColor Gray
    
    # Limpar tabela atual (cuidado!)
    psql -U postgres -d $dbName -c "TRUNCATE TABLE $table CASCADE;"
    
    # Importar dados
    psql -U postgres -d $dbName -c "\COPY $table FROM 'backup_$table.csv' CSV HEADER;"
}

# 5. Limpar
Write-Host "`nLimpando arquivos temporários..." -ForegroundColor Yellow
Remove-Item backup_*.csv -ErrorAction SilentlyContinue
psql -U postgres -c "DROP DATABASE IF EXISTS $tempDb;"

Write-Host "`n=== Restore concluído com sucesso! ===" -ForegroundColor Green
Write-Host "A tabela 'article_warehouse_sync_cache' foi preservada." -ForegroundColor Green
