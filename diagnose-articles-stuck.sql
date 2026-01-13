-- DIAGNÓSTICO COMPLETO: Por que os artigos não estão aumentando no TypsForYou?

-- 1. Verificar estado atual da configuração
SELECT 
    'CONFIG_STATUS' as type,
    sc.enabled,
    sc."lastSyncAt",
    sc."lastSuccessAt",
    sc.options->>'mode' as sync_mode,
    sc.options->>'lastProcessedId' as checkpoint,
    sc.options->>'totalProcessed' as total_processed,
    NOW() - sc."lastSyncAt" as time_since_last_sync
FROM sync_configurations sc
WHERE sc."syncType" = 'ARTICLES'
AND sc."organizationId" = 'b41e3222-7b2b-4a63-967d-c1eebe05612a';

-- 2. Verificar últimas execuções - ARTIGOS REALMENTE ENVIADOS?
SELECT 
    'EXECUTION_HISTORY' as type,
    TO_CHAR("startedAt", 'YYYY-MM-DD HH24:MI:SS') as started,
    "status",
    "totalFetched" as sent_to_api,
    "totalSucceeded" as loaded_by_api,
    "totalFailed" as rejected_by_api,
    "duration" || 'ms' as duration,
    metadata->>'exitCode' as exit_code,
    metadata->>'checkpoint' as new_checkpoint,
    metadata->>'errorSummary' as errors
FROM sync_execution_logs
WHERE "syncType" = 'ARTICLES'
AND "organizationId" = 'b41e3222-7b2b-4a63-967d-c1eebe05612a'
ORDER BY "startedAt" DESC
LIMIT 20;

-- 3. Resumo total desde hoje
SELECT 
    'DAILY_SUMMARY' as type,
    COUNT(*) as executions_today,
    SUM("totalFetched") as total_sent,
    SUM("totalSucceeded") as total_loaded,
    SUM("totalFailed") as total_failed,
    MIN("startedAt") as first_execution,
    MAX("startedAt") as last_execution
FROM sync_execution_logs
WHERE "syncType" = 'ARTICLES'
AND "organizationId" = 'b41e3222-7b2b-4a63-967d-c1eebe05612a'
AND DATE("startedAt") = CURRENT_DATE;

-- 4. Verificar se checkpoint está travado (mesmo valor repetido)
WITH checkpoint_changes AS (
    SELECT 
        "startedAt",
        metadata->>'checkpoint' as checkpoint,
        LAG(metadata->>'checkpoint') OVER (ORDER BY "startedAt") as prev_checkpoint,
        "totalSucceeded"
    FROM sync_execution_logs
    WHERE "syncType" = 'ARTICLES'
    AND "organizationId" = 'b41e3222-7b2b-4a63-967d-c1eebe05612a'
    ORDER BY "startedAt" DESC
    LIMIT 10
)
SELECT 
    'CHECKPOINT_ANALYSIS' as type,
    *,
    CASE 
        WHEN checkpoint = prev_checkpoint THEN '⚠️ CHECKPOINT NÃO AVANÇOU'
        WHEN checkpoint IS NULL THEN '❌ SEM CHECKPOINT'
        ELSE '✅ Checkpoint avançando'
    END as status
FROM checkpoint_changes;

-- 5. Verificar se há execuções com 0 artigos enviados
SELECT 
    'EMPTY_EXECUTIONS' as type,
    COUNT(*) as executions_with_zero_articles
FROM sync_execution_logs
WHERE "syncType" = 'ARTICLES'
AND "organizationId" = 'b41e3222-7b2b-4a63-967d-c1eebe05612a'
AND "totalFetched" = 0
AND "startedAt" > NOW() - INTERVAL '24 hours';
