-- Verify sync configurations
SELECT 
  id,
  "organizationId",
  "syncType",
  enabled,
  "intervalSeconds",
  "lastSuccessAt",
  "createdAt"
FROM sync_configurations
ORDER BY "createdAt" DESC;

-- Count configurations
SELECT 
  "syncType",
  enabled,
  COUNT(*) as total
FROM sync_configurations
GROUP BY "syncType", enabled;
