-- Check if organization still exists
SELECT 
  id,
  name,
  "createdAt"
FROM organizations 
WHERE id = 'b41e3222-7b2b-4a63-967d-c1eebe05612a';

-- Check provider config
SELECT 
  id,
  "organizationId",
  provider,
  "createdAt"
FROM provider_configurations
WHERE id = '73b29d9b-054a-448f-b7c5-c0f3cac2b7fa';
