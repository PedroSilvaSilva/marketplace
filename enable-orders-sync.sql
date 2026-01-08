-- ============================================
-- SYNC CONFIGURATIONS - ORDERS
-- ============================================

INSERT INTO sync_configurations (
    id, "organizationId", "providerConfigId", "syncType",
    enabled, "intervalSeconds", options,
    "createdAt", "updatedAt"
) VALUES (
    'sync-orders-' || gen_random_uuid()::text,
    'b41e3222-7b2b-4a63-967d-c1eebe05612a',  -- TypsForYou
    '73b29d9b-054a-448f-b7c5-c0f3cac2b7fa',  -- TypsForYou Provider Config
    'ORDERS',
    true,
    300,  -- 5 minutos
    '{"autoSync": true, "batchSize": 50}',
    NOW(),
    NOW()
)
ON CONFLICT ("organizationId", "providerConfigId", "syncType") DO UPDATE SET
    enabled = EXCLUDED.enabled,
    "intervalSeconds" = EXCLUDED."intervalSeconds",
    options = EXCLUDED.options,
    "updatedAt" = EXCLUDED."updatedAt";

-- Verificação
SELECT 
    id,
    "syncType",
    enabled,
    "intervalSeconds",
    "lastSyncAt",
    "lastSuccessAt"
FROM sync_configurations
WHERE "organizationId" = 'b41e3222-7b2b-4a63-967d-c1eebe05612a'
  AND "syncType" = 'ORDERS';
