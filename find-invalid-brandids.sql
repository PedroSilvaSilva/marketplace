-- Encontrar artigos com BrandIDs inválidos (67 e 7000)
-- Estas são as marcas que o TypsForYou está rejeitando

-- Query 1: Contar quantos artigos temos de cada BrandID problemático
SELECT 
    BrandId,
    COUNT(*) as total_artigos,
    COUNT(DISTINCT PartNumber) as unique_partnumbers
FROM samiparts.dbo.u_csw_tips4y_Articles
WHERE BrandId IN (67, 7000)
GROUP BY BrandId
ORDER BY BrandId;

-- Query 2: Ver alguns exemplos de artigos com BrandID 67
SELECT TOP 10
    BrandId,
    PartNumber,
    ArticleName,
    Active,
    DataAlteracao
FROM samiparts.dbo.u_csw_tips4y_Articles
WHERE BrandId = 67
ORDER BY DataAlteracao DESC;

-- Query 3: Ver alguns exemplos de artigos com BrandID 7000
SELECT TOP 10
    BrandId,
    PartNumber,
    ArticleName,
    Active,
    DataAlteracao
FROM samiparts.dbo.u_csw_tips4y_Articles
WHERE BrandId = 7000
ORDER BY DataAlteracao DESC;

-- Query 4: Ver distribuição de todos os BrandIDs no sistema
SELECT 
    BrandId,
    COUNT(*) as total_artigos,
    CASE 
        WHEN BrandId IN (67, 7000) THEN '⚠️ INVÁLIDO'
        ELSE '✅ Válido'
    END as status_typs4you
FROM samiparts.dbo.u_csw_tips4y_Articles
GROUP BY BrandId
ORDER BY 
    CASE WHEN BrandId IN (67, 7000) THEN 0 ELSE 1 END,
    total_artigos DESC;
