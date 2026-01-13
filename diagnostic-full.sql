-- DIAGNÓSTICO COMPLETO DO SYNC ARTICLES

-- 1. Estado atual da configuração
SELECT 
  "syncType",
  enabled,
  "intervalSeconds",
  "lastSyncAt",
  "lastSuccessAt",
  "lastErrorAt",
  LEFT("lastError", 200) as erro_resumido,
  options::json->>'totalProcessed' as total_processado,
  options::json->>'lastProcessedId' as checkpoint_atual,
  options::json->>'mode' as modo,
  NOW() - "lastSyncAt" as tempo_desde_ultimo_sync,
  NOW() - "lastSuccessAt" as tempo_desde_ultimo_sucesso
FROM sync_configurations
WHERE "syncType" = 'ARTICLES';

-- 2. Últimas 5 execuções
SELECT 
  status,
  "startedAt",
  "completedAt",
  "totalProcessed",
  "totalSucceeded",
  "totalFailed",
  LEFT("errorMessage", 100) as erro
FROM sync_execution_logs
WHERE "syncType" = 'ARTICLES'
ORDER BY "startedAt" DESC
LIMIT 5;

-- 3. Total de execuções por status
SELECT 
  status,
  COUNT(*) as quantidade
FROM sync_execution_logs
WHERE "syncType" = 'ARTICLES'
GROUP BY status;
