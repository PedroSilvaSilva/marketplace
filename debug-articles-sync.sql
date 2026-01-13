-- Verificar estado da sincronização de artigos
SELECT 
  id,
  "syncType",
  enabled,
  "intervalSeconds",
  options->>'mode' as modo,
  options->>'lastProcessedId' as checkpoint,
  (options->>'totalProcessed')::int as total_processado,
  "lastSyncAt" as ultima_tentativa,
  "lastSuccessAt" as ultimo_sucesso,
  "lastErrorAt" as ultimo_erro,
  "lastError" as mensagem_erro,
  "createdAt",
  "updatedAt"
FROM sync_configurations
WHERE "syncType" = 'ARTICLES';

-- Ver últimas execuções
SELECT 
  "syncType",
  status,
  "startedAt",
  "completedAt",
  duration,
  "totalFetched",
  "totalProcessed",
  "totalSucceeded",
  "totalFailed",
  "errorMessage"
FROM sync_execution_logs
WHERE "syncType" = 'ARTICLES'
ORDER BY "startedAt" DESC
LIMIT 10;
