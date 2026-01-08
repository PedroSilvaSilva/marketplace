-- ============================================
-- FIX: Adicionar Discount Views ao TypsForYou
-- ============================================

UPDATE data_source_configs
SET 
    "discountGroupView" = 'u_csw_tips4y_ArticleDiscountGroup',
    "discountSubGroupView" = 'u_csw_tips4y_ArticleDiscountSubGroup',
    "updatedAt" = NOW()
WHERE "organizationId" = 'b41e3222-7b2b-4a63-967d-c1eebe05612a';

-- Verificação
SELECT 
    id, 
    "organizationId",
    "discountGroupView",
    "discountSubGroupView"
FROM data_source_configs
WHERE "organizationId" = 'b41e3222-7b2b-4a63-967d-c1eebe05612a';
