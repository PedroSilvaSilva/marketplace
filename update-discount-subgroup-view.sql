-- Update discount subgroup view configuration (correct ID)
UPDATE data_source_configs 
SET "discountSubGroupView" = 'u_csw_tips4y_ArticleDiscountSubGroup'
WHERE id = '16e2dd0f-5181-4727-8a0a-0994b11f066e';

-- Verify the update
SELECT id, "organizationId", "discountGroupView", "discountSubGroupView"
FROM data_source_configs 
WHERE id = '16e2dd0f-5181-4727-8a0a-0994b11f066e';
