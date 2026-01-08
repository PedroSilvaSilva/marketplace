-- ============================================
-- ORGANIZATION MEMBERS
-- ============================================
-- Adicionar utilizador às organizações com role ADMIN

INSERT INTO organization_members (
    id, "organizationId", "userId", role, "isActive", "joinedAt",
    "createdAt", "updatedAt"
) VALUES 
(
    'f3d1e2c3-b4a5-6789-0123-456789abcdef',
    'b41e3222-7b2b-4a63-967d-c1eebe05612a',  -- TypsForYou
    'ee8abf6f-9466-4958-9b11-afc1967c97c7',  -- pedro.cardoso
    'ADMIN',
    true,
    '2025-11-15 21:56:00',
    '2025-11-15 21:56:00',
    '2025-11-15 21:56:00'
),
(
    'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    '5b28d9b0-a01f-4a7f-aee8-168adc646dd4',  -- Samiparts
    'ee8abf6f-9466-4958-9b11-afc1967c97c7',  -- pedro.cardoso
    'ADMIN',
    true,
    '2025-11-15 21:56:00',
    '2025-11-15 21:56:00',
    '2025-11-15 21:56:00'
),
(
    'b2c3d4e5-f6a7-8901-2345-678901bcdefg',
    '5b35fdae-fac6-47dc-9fa2-a49c72872f92',  -- FNAC
    'ee8abf6f-9466-4958-9b11-afc1967c97c7',  -- pedro.cardoso
    'ADMIN',
    true,
    '2025-11-15 21:56:00',
    '2025-11-15 21:56:00',
    '2025-11-15 21:56:00'
),
(
    'c3d4e5f6-a7b8-9012-3456-789012cdefgh',
    'bd914487-befd-4dd5-bccd-a144c8559337',  -- Worten
    'ee8abf6f-9466-4958-9b11-afc1967c97c7',  -- pedro.cardoso
    'ADMIN',
    true,
    '2025-11-15 21:56:00',
    '2025-11-15 21:56:00',
    '2025-11-15 21:56:00'
),
(
    'd4e5f6a7-b8c9-0123-4567-890123defghi',
    'ecfec177-a52a-4cb9-b4ce-5dcf3a7ad907',  -- Temu
    'ee8abf6f-9466-4958-9b11-afc1967c97c7',  -- pedro.cardoso
    'ADMIN',
    true,
    '2025-11-15 21:56:00',
    '2025-11-15 21:56:00',
    '2025-11-15 21:56:00'
)
ON CONFLICT ("organizationId", "userId") DO UPDATE SET
    role = EXCLUDED.role,
    "isActive" = EXCLUDED."isActive",
    "updatedAt" = EXCLUDED."updatedAt";

-- Verificação
SELECT om.id, o.name as organization, u.email, om.role, om."isActive"
FROM organization_members om
JOIN organizations o ON o.id = om."organizationId"
JOIN users u ON u.id = om."userId"
WHERE om."userId" = 'ee8abf6f-9466-4958-9b11-afc1967c97c7';
