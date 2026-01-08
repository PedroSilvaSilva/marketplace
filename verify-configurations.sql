-- ============================================
-- VERIFICAÇÃO DE CONFIGURAÇÕES E PERMISSÕES
-- ============================================

-- 1. Verificar se user tem acesso às organizações
SELECT 
    om.id,
    o.name as organization,
    o.type,
    u.email,
    om.role,
    om."isActive"
FROM organization_members om
JOIN organizations o ON o.id = om."organizationId"
JOIN users u ON u.id = om."userId"
WHERE u.email = 'pedro.cardoso@comsoftweb.pt'
ORDER BY o.name;

-- 2. Verificar provider configs
SELECT 
    pc.id,
    o.name as organization,
    pc."apiUrl",
    pc."isActive",
    pc."lastSyncAt"
FROM provider_configs pc
JOIN organizations o ON o.id = pc."organizationId"
WHERE o.id IN ('b41e3222-7b2b-4a63-967d-c1eebe05612a', '5b28d9b0-a01f-4a7f-aee8-168adc646dd4');

-- 3. Verificar data source configs
SELECT 
    dsc.id,
    o.name as organization,
    dsc."sourceType",
    dsc."isActive",
    dsc."lastTestStatus"
FROM data_source_configs dsc
JOIN organizations o ON o.id = dsc."organizationId"
WHERE o.id IN ('b41e3222-7b2b-4a63-967d-c1eebe05612a', '5b28d9b0-a01f-4a7f-aee8-168adc646dd4');

-- 4. Verificar client-provider connections
SELECT 
    cpc.id,
    c.name as client,
    p.name as provider,
    cpc."merchantId",
    cpc."storeId",
    cpc."isActive"
FROM client_provider_connections cpc
JOIN organizations c ON c.id = cpc."clientOrgId"
JOIN organizations p ON p.id = cpc."providerOrgId"
WHERE c.id = '5b28d9b0-a01f-4a7f-aee8-168adc646dd4'
   OR p.id = 'b41e3222-7b2b-4a63-967d-c1eebe05612a';

-- 5. Verificar sync configurations ativas
SELECT 
    sc.id,
    o.name as organization,
    sc."syncType",
    sc.enabled,
    sc."intervalSeconds",
    sc."lastSyncAt",
    sc."lastSuccessAt"
FROM sync_configurations sc
JOIN organizations o ON o.id = sc."organizationId"
WHERE o.id IN ('b41e3222-7b2b-4a63-967d-c1eebe05612a', '5b28d9b0-a01f-4a7f-aee8-168adc646dd4')
ORDER BY o.name, sc."syncType";
