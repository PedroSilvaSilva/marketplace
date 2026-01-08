# Article Warehouse Setup - Passos

## 1. Migrar Prisma Schema
npx prisma migrate dev --name add_article_warehouse_cache

## 2. Gerar Prisma Client
npx prisma generate

## 3. Iniciar servidor
npm run dev

## 4. Criar cron via API
# Usar o ficheiro: create-article-warehouse-cron.http
# POST http://localhost:4000/api/v1/sync-config

## Como Funciona

### Sincronização Inteligente com Hash:
1. Busca dados do SQL Server
2. Para cada artigo, calcula hash MD5 de todos os campos
3. Compara com cache no PostgreSQL
4. Envia APENAS artigos novos ou alterados
5. Atualiza cache após sync bem-sucedido

### Exemplo:
- 1ª execução: 10.000 artigos → envia 10.000 (FULL)
- 2ª execução: 50 alterações de preço → envia 50 (INCREMENTAL - 99,5% poupança!)
- 3ª execução: sem mudanças → envia 0 (SKIP)

### Features:
✅ Auto-sync no GET /article-warehouse/.../csv
✅ Cron scheduler automático (default: 10 min)
✅ Cache com hash MD5 para detecção de mudanças
✅ Email com estatísticas de eficiência
✅ Logs de execução detalhados
✅ Suporte para múltiplos armazéns (warehouseCode)
