-- Get full error message from ARTICLES sync config
SELECT 
  "lastError",
  "lastErrorAt",
  options::text as options_json
FROM sync_configurations
WHERE "syncType" = 'ARTICLES';
