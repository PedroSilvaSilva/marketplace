USE samiparts;
GO

-- 1. Verificar se há duplicados na view
SELECT 
    BrandId,
    PartNumber,
    COUNT(*) as qtd_duplicados
FROM u_csw_tips4y_Articles
GROUP BY BrandId, PartNumber
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 2. Ver total vs únicos
SELECT 
    COUNT(*) as total_registos,
    COUNT(DISTINCT CONCAT(CAST(BrandId AS VARCHAR), '-', PartNumber)) as registos_unicos,
    COUNT(*) - COUNT(DISTINCT CONCAT(CAST(BrandId AS VARCHAR), '-', PartNumber)) as diferenca
FROM u_csw_tips4y_Articles;

-- 3. Ver exemplos dos duplicados (61-105.0724014 que deu erro)
SELECT TOP 5 *
FROM u_csw_tips4y_Articles
WHERE BrandId = 61 AND PartNumber = '105.0724014'
ORDER BY DataCriacao;
