-- Ativar sincronização de article warehouse (stock/preços) com MD5 hash incremental
-- Sincroniza apenas artigos que mudaram desde última execução

INSERT INTO sync_configurations (
  id,
  "organizationId",
  "providerConfigId",
  "syncType",
  "intervalSeconds",
  enabled,
  "lastSuccessAt",
  options,
  "createdAt",
  "updatedAt"
)
VALUES (
  gen_random_uuid(),
  'b41e3222-7b2b-4a63-967d-c1eebe05612a', -- TypsForYou
  '73b29d9b-054a-448f-b7c5-c0f3cac2b7fa', -- Azure API
  'ARTICLE_WAREHOUSE',
  300, -- 5 minutos - MD5 hash faz sync só de mudanças
  true,
  NULL,
  jsonb_build_object(
    'warehouseCode', '1'
  ),
  NOW(),
  NOW()
)
ON CONFLICT ("organizationId", "providerConfigId", "syncType")
DO UPDATE SET
  "intervalSeconds" = EXCLUDED."intervalSeconds",
  enabled = EXCLUDED.enabled,
  options = EXCLUDED.options,
  "updatedAt" = NOW();

-- Verificar configuração criada
SELECT 
  id,
  "syncType",
  "intervalSeconds",
  enabled,
  options,
  "lastSuccessAt",
  "createdAt"
FROM sync_configurations
WHERE "syncType" = 'ARTICLE_WAREHOUSE'
  AND "organizationId" = 'b41e3222-7b2b-4a63-967d-c1eebe05612a';

-- Ver estatísticas do cache (quantos artigos já foram sincronizados)
SELECT 
  COUNT(*) as total_cached,
  MAX("lastSyncedAt") as last_sync
FROM article_warehouse_sync_cache
WHERE "organizationId" = 'b41e3222-7b2b-4a63-967d-c1eebe05612a';
