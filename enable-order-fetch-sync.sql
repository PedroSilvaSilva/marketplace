-- ============================================
-- SYNC CONFIGURATIONS - ORDER_FETCH
-- ============================================
-- Busca encomendas DA TypsForYou e insere NO SQL Server

INSERT INTO sync_configurations (
    id, "organizationId", "providerConfigId", "syncType",
    enabled, "intervalSeconds", options,
    "createdAt", "updatedAt"
) VALUES (
    'sync-order-fetch-' || gen_random_uuid()::text,
    '5b28d9b0-a01f-4a7f-aee8-168adc646dd4',  -- Samiparts (CLIENT que recebe encomendas)
    '73b29d9b-054a-448f-b7c5-c0f3cac2b7fa',  -- TypsForYou Provider Config
    'ORDER_FETCH',
    true,
    60,  -- 1 minuto (busca encomendas frequentemente)
    '{"autoSync": true, "autoProcess": true, "batchSize": 50}',
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
WHERE "organizationId" = '5b28d9b0-a01f-4a7f-aee8-168adc646dd4'
  AND "syncType" = 'ORDER_FETCH';
