-- Ativar sincronização de artigos com sistema de checkpoint
-- 290 mil artigos serão sincronizados em lotes de 1000
-- O checkpoint rastreia o último ID processado para evitar duplicatas

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
  'ARTICLES',
  300, -- 5 minutos (300 segundos) - 290 lotes = ~24 horas
  true,
  NULL,
  jsonb_build_object(
    'limit', 1000,
    'lastProcessedId', NULL,
    'totalProcessed', 0
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
WHERE "syncType" = 'ARTICLES'
  AND "organizationId" = 'b41e3222-7b2b-4a63-967d-c1eebe05612a';
