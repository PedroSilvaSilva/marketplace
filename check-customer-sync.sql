-- Check Customer Sync Configuration
SELECT 
  sc.id,
  sc."syncType",
  sc.enabled,
  sc.interval,
  sc."lastSyncAt",
  sc."lastSuccessAt",
  sc."lastError",
  sc."lastErrorAt",
  o.name as organization_name
FROM "SyncConfiguration" sc
JOIN "Organization" o ON sc."organizationId" = o.id
WHERE sc."syncType" IN ('CUSTOMERS', 'CUSTOMER_DISCOUNT_GROUPS', 'CUSTOMER_WAREHOUSES')
ORDER BY sc."syncType";
