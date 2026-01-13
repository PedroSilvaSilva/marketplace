-- Check and Fix Cron Scheduler Intervals
-- Run this to identify and fix schedulers with problematic intervals

-- 1. Ver todos os schedulers ativos e seus intervalos
SELECT 
  sc.id,
  o.name as organization,
  sc."syncType",
  sc."intervalSeconds",
  CASE 
    WHEN sc."intervalSeconds" < 60 THEN '❌ TOO SHORT'
    WHEN sc."intervalSeconds" < 300 THEN '⚠️  SHORT'
    WHEN sc."intervalSeconds" < 3600 THEN '✅ OK'
    ELSE '✅ GOOD'
  END as status,
  sc."intervalSeconds" / 60 || ' minutes' as interval_display,
  sc.enabled,
  sc."lastSyncAt",
  sc."lastSuccessAt",
  sc."lastError"
FROM sync_configurations sc
JOIN organizations o ON o.id = sc."organizationId"
WHERE sc.enabled = true
ORDER BY sc."intervalSeconds" ASC;

-- 2. Identificar schedulers problemáticos (< 60 segundos)
SELECT 
  sc.id,
  o.name as organization,
  sc."syncType",
  sc."intervalSeconds" as current_interval,
  300 as recommended_interval
FROM sync_configurations sc
JOIN organizations o ON o.id = sc."organizationId"
WHERE sc.enabled = true 
  AND sc."intervalSeconds" < 60;

-- 3. Ver duração média e máxima de cada tipo de sync
SELECT 
  sc."syncType",
  COUNT(*) as executions,
  ROUND(AVG(sel.duration) / 1000) as avg_duration_seconds,
  ROUND(MAX(sel.duration) / 1000) as max_duration_seconds,
  MIN(sc."intervalSeconds") as min_interval_config,
  CASE 
    WHEN MIN(sc."intervalSeconds") < ROUND(MAX(sel.duration) / 1000) * 2 THEN '❌ INTERVAL TOO SHORT'
    ELSE '✅ OK'
  END as health_check
FROM sync_configurations sc
LEFT JOIN sync_execution_logs sel ON sel."syncConfigurationId" = sc.id
WHERE sc.enabled = true
  AND sel."createdAt" > NOW() - INTERVAL '24 hours'
GROUP BY sc."syncType"
ORDER BY max_duration_seconds DESC;

-- 4. Schedulers que falharam recentemente
SELECT 
  sc.id,
  o.name as organization,
  sc."syncType",
  sc."intervalSeconds",
  sc."lastSyncAt",
  sc."lastSuccessAt",
  sc."lastErrorAt",
  sc."lastError"
FROM sync_configurations sc
JOIN organizations o ON o.id = sc."organizationId"
WHERE sc.enabled = true
  AND sc."lastErrorAt" IS NOT NULL
  AND sc."lastErrorAt" > sc."lastSuccessAt"
ORDER BY sc."lastErrorAt" DESC;

-- 5. FIX: Atualizar intervalos muito curtos para 5 minutos (300s)
-- UNCOMMENT para executar:
/*
UPDATE sync_configurations
SET "intervalSeconds" = 300
WHERE enabled = true 
  AND "intervalSeconds" < 60
RETURNING 
  id,
  "syncType",
  "intervalSeconds" as new_interval;
*/

-- 6. FIX: Atualizar intervalos baseado na duração real das tarefas
-- UNCOMMENT para executar:
/*
UPDATE sync_configurations sc
SET "intervalSeconds" = GREATEST(
  300, -- mínimo de 5 minutos
  (
    SELECT CEIL(MAX(sel.duration) / 1000) * 2 
    FROM sync_execution_logs sel
    WHERE sel."syncConfigurationId" = sc.id
      AND sel."createdAt" > NOW() - INTERVAL '7 days'
  )
)
WHERE sc.enabled = true
  AND EXISTS (
    SELECT 1 
    FROM sync_execution_logs sel 
    WHERE sel."syncConfigurationId" = sc.id
  )
RETURNING 
  id,
  "syncType",
  "intervalSeconds" as new_interval;
*/

-- 7. Recomendações por tipo de sync
SELECT 
  'DISCOUNT_GROUPS' as sync_type,
  3600 as recommended_interval_seconds,
  '1 hour' as recommended_display,
  'Dados mudam raramente' as reason
UNION ALL
SELECT 'DISCOUNT_SUBGROUPS', 3600, '1 hour', 'Dados mudam raramente'
UNION ALL
SELECT 'ARTICLES', 21600, '6 hours', 'Processo pesado, ~30min de duração'
UNION ALL
SELECT 'ARTICLE_WAREHOUSE', 300, '5 minutes', 'Stocks mudam frequentemente'
UNION ALL
SELECT 'CUSTOMERS', 3600, '1 hour', 'Dados mudam ocasionalmente'
UNION ALL
SELECT 'CUSTOMER_DISCOUNT_GROUPS', 7200, '2 hours', 'Dados estáveis'
UNION ALL
SELECT 'CUSTOMER_WAREHOUSES', 7200, '2 hours', 'Dados estáveis'
UNION ALL
SELECT 'ORDERS', 300, '5 minutes', 'Crítico, tempo real'
UNION ALL
SELECT 'ORDER_FETCH', 300, '5 minutes', 'Crítico, tempo real';

-- 8. Aplicar recomendações (CAREFUL!)
-- UNCOMMENT para executar:
/*
UPDATE sync_configurations
SET "intervalSeconds" = CASE "syncType"
  WHEN 'DISCOUNT_GROUPS' THEN 3600
  WHEN 'DISCOUNT_SUBGROUPS' THEN 3600
  WHEN 'ARTICLES' THEN 21600
  WHEN 'ARTICLE_WAREHOUSE' THEN 300
  WHEN 'CUSTOMERS' THEN 3600
  WHEN 'CUSTOMER_DISCOUNT_GROUPS' THEN 7200
  WHEN 'CUSTOMER_WAREHOUSES' THEN 7200
  WHEN 'ORDERS' THEN 300
  ELSE 3600 -- default 1 hour
END
WHERE enabled = true
RETURNING 
  id,
  "syncType",
  "intervalSeconds" as new_interval,
  "intervalSeconds" / 60 || ' minutes' as display;
*/
