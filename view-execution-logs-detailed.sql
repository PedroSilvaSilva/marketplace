-- Query detalhada dos execution logs de ARTICLES com análise de erros

SELECT 
    "startedAt",
    "completedAt",
    "status",
    "totalFetched",
    "totalSucceeded",
    "totalFailed",
    "duration" || 'ms' as duration,
    -- Extrair informações específicas do metadata
    metadata->>'exitCode' as exit_code,
    metadata->>'errorSummary' as error_summary,
    metadata->>'checkpoint' as checkpoint,
    metadata->>'completed' as is_completed,
    -- Mostrar erros completos se existirem
    CASE 
        WHEN metadata->'invalidBrandIds' IS NOT NULL 
        THEN 'BrandIDs rejeitados: ' || metadata->>'invalidBrandIds'
        ELSE '✅ Sem erros'
    END as brand_errors,
    metadata
FROM sync_execution_logs
WHERE "syncType" = 'ARTICLES'
AND "organizationId" = 'b41e3222-7b2b-4a63-967d-c1eebe05612a'
ORDER BY "startedAt" DESC
LIMIT 10;

-- Resumo geral das últimas execuções
SELECT 
    COUNT(*) as total_executions,
    SUM("totalSucceeded") as total_articles_loaded,
    SUM("totalFailed") as total_articles_failed,
    AVG("duration") as avg_duration_ms,
    MAX("startedAt") as last_execution,
    MIN("startedAt") as first_execution
FROM sync_execution_logs
WHERE "syncType" = 'ARTICLES'
AND "organizationId" = 'b41e3222-7b2b-4a63-967d-c1eebe05612a';
