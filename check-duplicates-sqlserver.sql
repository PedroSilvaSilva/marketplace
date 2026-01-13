-- 1. Verificar se há duplicados na view do SQL Server
SELECT 
    BrandId,
    PartNumber,
    COUNT(*) as qtd
FROM u_csw_tips4y_Articles
GROUP BY BrandId, PartNumber
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 2. Verificar total de registos vs registos únicos
SELECT 
    COUNT(*) as total_registos,
    COUNT(DISTINCT CONCAT(CAST(BrandId AS VARCHAR), '-', PartNumber)) as registos_unicos
FROM u_csw_tips4y_Articles;
