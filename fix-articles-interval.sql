-- Corrigir intervalo do cron de artigos para 300 segundos (5 minutos)
UPDATE sync_configurations
SET 
  "intervalSeconds" = 300,
  "updatedAt" = NOW()
WHERE "syncType" = 'ARTICLES'
  AND "organizationId" = 'b41e3222-7b2b-4a63-967d-c1eebe05612a';

-- Verificar
SELECT 
  id,
  "syncType",
  "intervalSeconds",
  enabled,
  options,
  "lastSuccessAt",
  "lastError"
FROM sync_configurations
WHERE "syncType" = 'ARTICLES';
