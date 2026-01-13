-- Check if ARTICLES cron has EVER executed
SELECT 
  id,
  "syncType",
  status,
  "startedAt",
  "completedAt",
  duration,
  "totalFetched",
  "totalProcessed",
  "errorMessage",
  metadata
FROM sync_execution_logs
WHERE "syncType" = 'ARTICLES'
ORDER BY "startedAt" DESC
LIMIT 20;

-- Check current ARTICLES sync configuration state
SELECT 
  id,
  "syncType",
  enabled,
  "intervalSeconds",
  "lastSyncAt",
  "lastSuccessAt",
  "lastErrorAt",
  "lastError",
  options,
  "updatedAt"
FROM sync_configurations
WHERE "syncType" = 'ARTICLES';
