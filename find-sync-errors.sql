-- BUSCAR ERROS: Por que artigos não estão carregando?

-- 1. ERROS NAS EXECUÇÕES (últimas 50)
SELECT 
    TO_CHAR("startedAt", 'DD/MM HH24:MI:SS') as quando,
    "status",
    "totalFetched" as enviados,
    "totalSucceeded" as aceitos,
    "totalFailed" as rejeitados,
    "errorMessage" as erro_principal,
    LEFT("errorStack", 200) as stack_trace,
    metadata->>'exitCode' as api_exit_code,
    metadata->>'errorSummary' as resumo_erro
FROM sync_execution_logs
WHERE "syncType" = 'ARTICLES'
AND "organizationId" = 'b41e3222-7b2b-4a63-967d-c1eebe05612a'
ORDER BY "startedAt" DESC
LIMIT 50;

-- 2. CONTAR TIPOS DE STATUS
SELECT 
    "status",
    COUNT(*) as quantidade,
    MAX("startedAt") as ultima_ocorrencia
FROM sync_execution_logs
WHERE "syncType" = 'ARTICLES'
AND "organizationId" = 'b41e3222-7b2b-4a63-967d-c1eebe05612a'
AND "startedAt" > NOW() - INTERVAL '2 days'
GROUP BY "status"
ORDER BY quantidade DESC;

-- 3. EXECUÇÕES COM ERRO (FAILED)
SELECT 
    TO_CHAR("startedAt", 'DD/MM HH24:MI:SS') as quando,
    "errorMessage",
    "errorStack",
    metadata
FROM sync_execution_logs
WHERE "syncType" = 'ARTICLES'
AND "organizationId" = 'b41e3222-7b2b-4a63-967d-c1eebe05612a'
AND "status" = 'FAILED'
ORDER BY "startedAt" DESC
LIMIT 10;

-- 4. ÚLTIMA SINCRONIZAÇÃO E ERRO NA CONFIG
SELECT 
    "syncType",
    enabled,
    TO_CHAR("lastSyncAt", 'DD/MM HH24:MI:SS') as ultima_tentativa,
    TO_CHAR("lastSuccessAt", 'DD/MM HH24:MI:SS') as ultimo_sucesso,
    TO_CHAR("lastErrorAt", 'DD/MM HH24:MI:SS') as ultimo_erro,
    "lastError" as mensagem_erro,
    "intervalSeconds" as intervalo_segundos,
    options
FROM sync_configurations
WHERE "syncType" = 'ARTICLES'
AND "organizationId" = 'b41e3222-7b2b-4a63-967d-c1eebe05612a';

-- 5. EXECUÇÕES QUE ENVIARAM 0 ARTIGOS (possível erro silencioso)
SELECT 
    TO_CHAR("startedAt", 'DD/MM HH24:MI:SS') as quando,
    "status",
    "duration" || 'ms' as duracao,
    "errorMessage",
    metadata->>'checkpoint' as checkpoint_usado
FROM sync_execution_logs
WHERE "syncType" = 'ARTICLES'
AND "organizationId" = 'b41e3222-7b2b-4a63-967d-c1eebe05612a'
AND "totalFetched" = 0
ORDER BY "startedAt" DESC
LIMIT 20;
