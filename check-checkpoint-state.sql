-- Verificar se checkpoint avançou após último sync
SELECT 
  options::json->>'totalProcessed' as total_processado,
  options::json->>'lastProcessedId' as ultimo_checkpoint,
  "lastSuccessAt",
  "lastErrorAt"
FROM sync_configurations
WHERE "syncType" = 'ARTICLES';
