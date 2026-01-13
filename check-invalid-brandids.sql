-- Verificar quantos artigos têm BrandId inválido
SELECT 
    BrandId,
    COUNT(*) as qtd
FROM u_csw_tips4y_Articles
WHERE BrandId IN (67, 7000)
GROUP BY BrandId;

-- Ver lista completa de todos os BrandIds distintos
SELECT 
    BrandId,
    COUNT(*) as qtd_artigos
FROM u_csw_tips4y_Articles
GROUP BY BrandId
ORDER BY BrandId;
