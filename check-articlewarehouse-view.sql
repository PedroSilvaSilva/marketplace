-- Check ArticleWarehouse view structure and data change fields
SELECT TOP 5
  [BrandId],
  [PartNumber],
  [WareHouseCode],
  [ArticleQuantity],
  [ArticlePrice1],
  [ArticlePrice2],
  [ArticlePrice3],
  [ArticlePrice4],
  [ArticlePrice5],
  [ArticleEcoTax],
  [ArticleCurrency],
  [Tag],
  [ReservedForFutureUse],
  [DataCriacao],
  [DataAlteracao]
FROM [samiparts].[dbo].[u_csw_tips4y_ArticleWarehouse];
