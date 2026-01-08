-- Check users
SELECT COUNT(*) as user_count FROM users;
SELECT id, email, name FROM users LIMIT 5;

-- Check organizations
SELECT COUNT(*) as org_count FROM organizations;
SELECT id, name FROM organizations LIMIT 5;

-- Check provider configurations (SQL + Typs4You)
SELECT COUNT(*) as provider_count FROM provider_configurations;
SELECT id, "organizationId", provider, "createdAt" FROM provider_configurations;

-- Check data source configurations (SQL views)
SELECT COUNT(*) as datasource_count FROM data_source_configurations;
SELECT id, "providerConfigId", "sourceType", view FROM data_source_configurations;

-- Check sync configurations
SELECT COUNT(*) as sync_count FROM sync_configurations;
SELECT id, "organizationId", "syncType", enabled FROM sync_configurations;

-- Check article warehouse cache
SELECT COUNT(*) as cache_count FROM article_warehouse_sync_cache;
