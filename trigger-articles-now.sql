-- Manually trigger ARTICLES sync to test the fix NOW
UPDATE sync_configurations
SET "lastSyncAt" = NOW() - INTERVAL '10 minutes'
WHERE "syncType" = 'ARTICLES';

-- Verify it was updated
SELECT 
  "syncType",
  "lastSyncAt",
  "lastErrorAt",
  "lastError"
FROM sync_configurations
WHERE "syncType" = 'ARTICLES';
