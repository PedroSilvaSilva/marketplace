-- Ver o nome correto da view configurada
SELECT 
  "productView",
  "sqlDatabase",
  "sqlInstance"
FROM data_source_configs
WHERE "organizationId" = 'b41e3222-7b2b-4a63-967d-c1eebe05612a';
