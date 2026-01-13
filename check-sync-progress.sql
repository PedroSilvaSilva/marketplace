-- 1. Ver estado atual do checkpoint e total processado
SELECT 
  "syncType",
  "lastSyncAt",
  "lastSuccessAt",
  "lastErrorAt",
  options::json->>'totalProcessed' as total_processado,
  options::json->>'lastProcessedId' as ultimo_checkpoint,
  "lastError"
FROM sync_configurations
WHERE "syncType" = 'ARTICLES';

-- 2. Ver últimas 10 execuções do ARTICLES sync
SELECT 
  "syncType",
  status,
  "startedAt",
  "completedAt",
  "totalProcessed",
  "totalSucceeded",
  "totalFailed",
  "errorMessage"
FROM sync_execution_logs
WHERE "syncType" = 'ARTICLES'
ORDER BY "startedAt" DESC
LIMIT 10;

-- 3. Contar execuções bem-sucedidas vs falhadas
SELECT 
  status,
  COUNT(*) as qtd,
  SUM("totalProcessed") as total_artigos_processados
FROM sync_execution_logs
WHERE "syncType" = 'ARTICLES'
GROUP BY status;
