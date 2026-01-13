-- Verificar configuração do SQL Server
SELECT 
    id,
    "organizationId",
    "sourceType",
    "sqlHost",
    "sqlInstance",
    "sqlPort",
    "sqlDatabase",
    "sqlUser",
    LEFT("sqlPassword", 5) || '***' as sqlPassword_masked,
    "connectionTimeout",
    "requestTimeout",
    "poolMax",
    "poolMin",
    "productView",
    "isActive",
    TO_CHAR("lastTestAt", 'DD/MM HH24:MI:SS') as last_test,
    "lastTestStatus",
    "lastTestError"
FROM data_source_configs
WHERE "organizationId" = 'b41e3222-7b2b-4a63-967d-c1eebe05612a';

-- Verificar se outros syncs estão funcionando (usam mesma conexão SQL)
SELECT 
    "syncType",
    "status",
    TO_CHAR("startedAt", 'DD/MM HH24:MI:SS') as quando,
    "errorMessage"
FROM sync_execution_logs
WHERE "organizationId" = 'b41e3222-7b2b-4a63-967d-c1eebe05612a'
AND "startedAt" > NOW() - INTERVAL '1 hour'
ORDER BY "startedAt" DESC
LIMIT 30;
