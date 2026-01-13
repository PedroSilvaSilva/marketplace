-- Verificar estado atual do checkpoint
SELECT 
  "syncType",
  "lastSyncAt",
  "lastSuccessAt",
  "lastErrorAt",
  "lastError",
  options::json->>'totalProcessed' as total_processado,
  options::json->>'lastProcessedId' as ultimo_checkpoint,
  options::json->>'mode' as modo
FROM sync_configurations
WHERE "syncType" = 'ARTICLES';

-- Verificar últimas execuções
SELECT 
  "syncType",
  status,
  "startedAt",
  "completedAt",
  duration,
  "totalProcessed",
  "errorMessage"
FROM sync_execution_logs
WHERE "syncType" = 'ARTICLES'
ORDER BY "startedAt" DESC
LIMIT 5;
