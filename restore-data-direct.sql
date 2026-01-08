-- ============================================
-- RESTORE DIRETO - Dados do Backup Original
-- ============================================
-- Usando UPSERT para criar ou atualizar registos

-- ============================================
-- 1. USER
-- ============================================
INSERT INTO users (
    id, email, password, "userType", status, 
    "isEmailVerified", "mfaEnabled", "backupCodes",
    "createdAt", "updatedAt", "lastLoginAt"
) VALUES (
    'ee8abf6f-9466-4958-9b11-afc1967c97c7',
    'pedro.cardoso@comsoftweb.pt',
    '$2a$12$KPTN65W7ecjebpL8A4vm/eZ/uRvjTY3ElQdRHwbyFgrgo667eT50u',
    'ADMIN',
    'ACTIVE',
    true,
    false,
    '{}',
    '2025-11-15 21:55:36.55',
    '2025-12-19 15:17:14.668',
    '2025-12-19 15:17:14.667'
)
ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    password = EXCLUDED.password,
    "userType" = EXCLUDED."userType",
    status = EXCLUDED.status,
    "isEmailVerified" = EXCLUDED."isEmailVerified",
    "mfaEnabled" = EXCLUDED."mfaEnabled",
    "backupCodes" = EXCLUDED."backupCodes",
    "updatedAt" = EXCLUDED."updatedAt",
    "lastLoginAt" = EXCLUDED."lastLoginAt";

-- ============================================
-- 2. ORGANIZATION
-- ============================================
INSERT INTO organizations (
    id, name, slug, description, type, email, phone, website,
    "isActive", settings, metadata, "createdAt", "updatedAt"
) VALUES 
(
    'b41e3222-7b2b-4a63-967d-c1eebe05612a',
    'TypsForYou',
    'typsforyou',
    'Marketplace de produtos personalizados - API para integração de vendedores',
    'PROVIDER',
    'info@typsforyou.pt',
    '+351912345678',
    'https://typsforyou.pt',
    true,
    '{"nif": "123456789", "currency": "EUR", "language": "pt", "timezone": "Europe/Lisbon", "categories": ["personalizados", "presentes", "customizados"], "businessType": "ecommerce"}',
    '{"foundedYear": 2024, "employeeCount": 5, "monthlyOrders": 0}',
    '2025-11-15 23:19:42.125',
    '2025-11-15 23:26:01.586'
),
(
    '5b28d9b0-a01f-4a7f-aee8-168adc646dd4',
    'Samiparts',
    'samiparts',
    'Loja online de peças automóvel',
    'CLIENT',
    'samiparts@teste.pt',
    '+351912345678',
    'https://samiparts.pt',
    true,
    '{}',
    '{}',
    '2025-11-15 23:16:02.633',
    '2025-11-15 23:16:02.633'
),
(
    '5b35fdae-fac6-47dc-9fa2-a49c72872f92',
    'FNAC',
    'fnac',
    'Cultura, Tecnologia e Entretenimento',
    'PROVIDER',
    'comercial@fnac.pt',
    '+351707313435',
    'https://www.fnac.pt',
    true,
    '{}',
    '{}',
    '2025-11-15 23:12:51.118',
    '2025-11-15 23:12:51.118'
),
(
    'bd914487-befd-4dd5-bccd-a144c8559337',
    'Worten',
    'worten',
    'Maior retalhista de eletrónica e eletrodomésticos em Portugal',
    'PROVIDER',
    'comercial@worten.pt',
    '+351210104200',
    'https://www.worten.pt',
    true,
    '{"currency": "EUR", "language": "pt", "timezone": "Europe/Lisbon", "categories": ["electronics", "appliances", "computers"]}',
    '{}',
    '2025-11-15 23:11:43.982',
    '2025-11-15 23:11:43.982'
),
(
    'ecfec177-a52a-4cb9-b4ce-5dcf3a7ad907',
    'Temu',
    'temu',
    'Marketplace global',
    'PROVIDER',
    'sellers@temu.com',
    NULL,
    'https://www.temu.com',
    true,
    '{}',
    '{}',
    '2025-11-15 23:13:03.751',
    '2025-11-15 23:13:03.751'
)
ON CONFLICT (slug) DO UPDATE SET
    id = EXCLUDED.id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    type = EXCLUDED.type,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    website = EXCLUDED.website,
    "isActive" = EXCLUDED."isActive",
    settings = EXCLUDED.settings,
    metadata = EXCLUDED.metadata,
    "updatedAt" = EXCLUDED."updatedAt";

-- ============================================
-- 3. PROVIDER CONFIG
-- ============================================
INSERT INTO provider_configs (
    id, "organizationId", "apiUrl", "apiKey", "apiSecret",
    "authType", "webhookUrl", "webhookSecret", "webhookEvents",
    "rateLimit", "rateLimitWindow", "maxRetries", "retryDelay",
    "fieldMappings", settings, "isActive", "lastSyncAt", "createdAt", "updatedAt"
) VALUES (
    '73b29d9b-054a-448f-b7c5-c0f3cac2b7fa',
    'b41e3222-7b2b-4a63-967d-c1eebe05612a',
    'https://tips4ycloud.azure-api.net/supplierManagement/api',
    '790f97dce3b090fb348d4dfb2abc3b5e:529e7beaf24819f774334fcf1e3867be:7f5c76d16f9f2a1881c131ef505802',
    '48db77d9155741da9ddfafbe8db857e0:cea4183a25f2fb161204372d63f4dd76:c6f34a3701c60fa3d1a666026401a532',
    'API_KEY',
    'https://csw-markets.pt/webhooks/typs4you',
    '7992c3b410194ba8f4202eb501d46f89:5a979db3d74ea34d98dde42bc6a828cd:be35501d791d972836c8ad2c0d89343aa013c9a6c8cb5b917d3fdce80f0ff922',
    ARRAY['order.created', 'product.updated', 'stock.changed'],
    100,
    60,
    3,
    1000,
    '{"product_id": "sku", "product_name": "title", "product_price": "price", "product_stock": "quantity"}',
    '{"autoSync": true, "categories": ["personalizados", "presentes", "customizados"], "syncInterval": 1800}',
    true,
    '2025-12-18 11:43:13.337',
    '2025-11-15 23:27:11.021',
    '2025-12-18 11:43:13.339'
)
ON CONFLICT ("organizationId") DO UPDATE SET
    id = EXCLUDED.id,
    "apiUrl" = EXCLUDED."apiUrl",
    "apiKey" = EXCLUDED."apiKey",
    "apiSecret" = EXCLUDED."apiSecret",
    "authType" = EXCLUDED."authType",
    "webhookUrl" = EXCLUDED."webhookUrl",
    "webhookSecret" = EXCLUDED."webhookSecret",
    "webhookEvents" = EXCLUDED."webhookEvents",
    "rateLimit" = EXCLUDED."rateLimit",
    "rateLimitWindow" = EXCLUDED."rateLimitWindow",
    "maxRetries" = EXCLUDED."maxRetries",
    "retryDelay" = EXCLUDED."retryDelay",
    "fieldMappings" = EXCLUDED."fieldMappings",
    settings = EXCLUDED.settings,
    "isActive" = EXCLUDED."isActive",
    "lastSyncAt" = EXCLUDED."lastSyncAt",
    "updatedAt" = EXCLUDED."updatedAt";

-- ============================================
-- 4. CLIENT PROVIDER CONNECTIONS
-- ============================================
INSERT INTO client_provider_connections (
    id, "clientId", "providerId", "connectionCode", "storeName",
    credentials, settings, "syncConfig", "isActive", "isPaused",
    "syncIntervalSeconds", "errorCount", "successCount", "totalSyncs",
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
    false,
    3600,
    0,
    0,
    0,
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
    false,
    1800,
    0,
    0,
    0,
    '2025-11-15 23:30:36.625',
    '2025-11-15 23:30:36.625'
)
ON CONFLICT (id) DO UPDATE SET
    "clientId" = EXCLUDED."clientId",
    "providerId" = EXCLUDED."providerId",
    "connectionCode" = EXCLUDED."connectionCode",
    "storeName" = EXCLUDED."storeName",
    credentials = EXCLUDED.credentials,
    settings = EXCLUDED.settings,
    "syncConfig" = EXCLUDED."syncConfig",
    "isActive" = EXCLUDED."isActive",
    "isPaused" = EXCLUDED."isPaused",
    "syncIntervalSeconds" = EXCLUDED."syncIntervalSeconds",
    "errorCount" = EXCLUDED."errorCount",
    "successCount" = EXCLUDED."successCount",
    "totalSyncs" = EXCLUDED."totalSyncs",
    "updatedAt" = EXCLUDED."updatedAt";

-- ============================================
-- 5. DATA SOURCE CONFIG
-- ============================================
INSERT INTO data_source_configs (
    id, "organizationId", "sourceType", "sqlHost", "sqlInstance",
    "sqlDatabase", "sqlUser", "sqlPassword",
    "connectionTimeout", "requestTimeout", "poolMax", "poolMin",
    "productView", "stockView", "customerView",
    "discountGroupView", "discountSubGroupView",
    "isActive", "lastTestAt", "lastTestStatus",
    "createdAt", "updatedAt"
) VALUES 
(
    '16e2dd0f-5181-4727-8a0a-0994b11f066e',
    'b41e3222-7b2b-4a63-967d-c1eebe05612a',
    'SQL_SERVER',
    'SRVCLOUDSP\PHC',
    NULL,
    'samiparts',
    'sa',
    'aa07f5a7b4b9571c91ae2bf784d50fee:e40013093ac1e2781d52e924e08efafd:62087f168590a9e60fc7',
    15000,
    30000,
    10,
    0,
    'u_csw_tips4y_Articles',
    'u_csw_tips4y_ArticleWarehouse',
    'u_csw_tips4y_Customers',
    NULL,
    NULL,
    true,
    NULL,
    NULL,
    '2025-11-16 11:42:33.846',
    '2025-11-16 11:42:33.846'
),
(
    'b565ea30-b3aa-4d3b-a063-e690098f9378',
    '5b28d9b0-a01f-4a7f-aee8-168adc646dd4',
    'SQL_SERVER',
    'SRVCLOUDSP',
    'PHC',
    'samiparts',
    'sa',
    '72bae6c24b7d82af9069da43ab26c6d8:3b06c3475807e5046cd584a6c7584dab:0008c9a0c281a43ef92a',
    15000,
    30000,
    10,
    0,
    'u_csw_tips4y_Articles',
    'u_csw_tips4y_ArticleWarehouse',
    'u_csw_tips4y_Customers',
    'u_csw_tips4y_ArticleDiscountGroup',
    'u_csw_tips4y_ArticleDiscountSubGroup',
    true,
    '2025-12-10 18:16:33.877',
    'SUCCESS',
    '2025-11-16 00:34:29.834',
    '2025-12-10 18:16:33.879'
)
ON CONFLICT ("organizationId") DO UPDATE SET
    id = EXCLUDED.id,
    "sourceType" = EXCLUDED."sourceType",
    "sqlHost" = EXCLUDED."sqlHost",
    "sqlInstance" = EXCLUDED."sqlInstance",
    "sqlDatabase" = EXCLUDED."sqlDatabase",
    "sqlUser" = EXCLUDED."sqlUser",
    "sqlPassword" = EXCLUDED."sqlPassword",
    "connectionTimeout" = EXCLUDED."connectionTimeout",
    "requestTimeout" = EXCLUDED."requestTimeout",
    "poolMax" = EXCLUDED."poolMax",
    "poolMin" = EXCLUDED."poolMin",
    "productView" = EXCLUDED."productView",
    "stockView" = EXCLUDED."stockView",
    "customerView" = EXCLUDED."customerView",
    "discountGroupView" = EXCLUDED."discountGroupView",
    "discountSubGroupView" = EXCLUDED."discountSubGroupView",
    "isActive" = EXCLUDED."isActive",
    "lastTestAt" = EXCLUDED."lastTestAt",
    "lastTestStatus" = EXCLUDED."lastTestStatus",
    "updatedAt" = EXCLUDED."updatedAt";

-- ============================================
-- 6. SYNC CONFIGURATIONS
-- ============================================
-- Mostra-me os dados da tabela 'sync_configurations' do backup
-- Formato esperado: id, organizationId, providerConfigId, syncType, enabled, intervalSeconds, options, lastSyncAt, lastSuccessAt, createdAt, updatedAt

-- INSERT INTO sync_configurations (...) VALUES (...);
-- (DISCOUNT_GROUPS)
-- (DISCOUNT_SUBGROUPS)
-- (ARTICLE_WAREHOUSE)

-- ============================================
-- VERIFICAÇÃO
-- ============================================
SELECT 'Users' as table_name, COUNT(*) FROM users
UNION ALL
SELECT 'Organizations', COUNT(*) FROM organizations
UNION ALL
SELECT 'Organization Members', COUNT(*) FROM organization_members
UNION ALL
SELECT 'Provider Configs', COUNT(*) FROM provider_configs
UNION ALL
SELECT 'Data Source Configs', COUNT(*) FROM data_source_configs
UNION ALL
SELECT 'Sync Configurations', COUNT(*) FROM sync_configurations;
