-- ============================================
-- CLIENT PROVIDER CONNECTIONS
-- ============================================
INSERT INTO client_provider_connections (
    id, "clientOrgId", "providerOrgId", "merchantId", "storeId",
    credentials, settings, "syncSettings", "isActive",
    "syncFrequency",
    "createdAt", "updatedAt"
) VALUES 
(
    '9efcc4f6-653a-4b3d-97ed-4250fa27465d',
    '5b28d9b0-a01f-4a7f-aee8-168adc646dd4',
    'bd914487-befd-4dd5-bccd-a144c8559337',
    'WORTEN_SAMIPARTS_001',
    'SAMIPARTS_STORE_WORTEN',
    '{"apiToken": "samiparts_worten_token_xyz", "storeName": "Samiparts - Peças Auto na Worten"}',
    '{"category": "auto-parts", "minStock": 5, "autoPublish": true, "priceMarkup": 1.1}',
    '{"syncStock": true, "syncOrders": true, "syncPrices": true, "syncProducts": true}',
    true,
    3600,
    '2025-11-15 23:17:39.058',
    '2025-11-15 23:17:39.058'
),
(
    'efaabdc2-e815-43d7-a1ba-264e14b212bd',
    '5b28d9b0-a01f-4a7f-aee8-168adc646dd4',
    'b41e3222-7b2b-4a63-967d-c1eebe05612a',
    'TYPS_SAMIPARTS_003',
    'SAMIPARTS_STORE_TYPS4YOU',
    '{"apiToken": "samiparts_typs4you_token_xyz", "storeName": "Samiparts na TypsForYou"}',
    '{"category": "auto-parts", "minStock": 3, "autoPublish": true, "priceMarkup": 1.15}',
    '{"syncStock": true, "syncOrders": true, "syncPrices": true, "syncProducts": true}',
    true,
    1800,
    '2025-11-15 23:30:36.625',
    '2025-11-15 23:30:36.625'
)
ON CONFLICT (id) DO UPDATE SET
    "clientOrgId" = EXCLUDED."clientOrgId",
    "providerOrgId" = EXCLUDED."providerOrgId",
    "merchantId" = EXCLUDED."merchantId",
    "storeId" = EXCLUDED."storeId",
    credentials = EXCLUDED.credentials,
    settings = EXCLUDED.settings,
    "syncSettings" = EXCLUDED."syncSettings",
    "isActive" = EXCLUDED."isActive",
    "syncFrequency" = EXCLUDED."syncFrequency",
    "updatedAt" = EXCLUDED."updatedAt";

-- Verificação
SELECT * FROM client_provider_connections 
WHERE id IN ('9efcc4f6-653a-4b3d-97ed-4250fa27465d', 'efaabdc2-e815-43d7-a1ba-264e14b212bd');
