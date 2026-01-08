-- Check all data source configs (columns use camelCase with quotes)
SELECT 
  id, 
  "organizationId", 
  "discountGroupView", 
  "discountSubGroupView",
  "createdAt"
FROM data_source_configs;
