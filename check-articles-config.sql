-- Check current ARTICLES sync configuration
SELECT 
  id,
  "syncType",
  enabled,
  "intervalSeconds",
  "lastSyncAt",
  "lastSuccessAt",
  "lastErrorAt",
  "lastError",
  options
FROM sync_configurations
WHERE "syncType" = 'ARTICLES'
AND "organizationId" = 'b41e3222-7b2b-4a63-967d-c1eebe05612a';

-- Check if any ARTICLES execution logs exist since 18:20
SELECT 
  "syncType",
  status,
  "startedAt",
  "completedAt",
  duration,
  "totalFetched",
  "totalSucceeded",
  "totalFailed",
  "errorMessage"
FROM sync_execution_logs
WHERE "syncType" = 'ARTICLES'
AND "startedAt" >= '2026-01-11T18:20:00'
ORDER BY "startedAt" DESC
LIMIT 5;
