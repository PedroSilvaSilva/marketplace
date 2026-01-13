# Sistema de Checkpoint para Sincronização de Artigos

## 📊 Problema
- **290 mil artigos** precisam ser sincronizados para TypsForYou
- API limita uploads a **1000 registos por requisição**
- Sistema cron executa a cada intervalo configurado
- **Sem checkpoint**: Re-processaria os mesmos 1000 artigos infinitamente

## ✅ Solução Implementada

### 1. **Checkpoint no Prisma** (sync_configurations.options)
```json
{
  "limit": 1000,
  "lastProcessedId": "123-ABC456",
  "totalProcessed": 5000
}
```

### 2. **Query SQL com Cursor**
```sql
-- ANTES (pagination com OFFSET - problemático)
ORDER BY BrandId, PartNumber
OFFSET 0 ROWS
FETCH NEXT 1000 ROWS ONLY

-- DEPOIS (checkpoint com WHERE - retomável)
WHERE CompositeId > '123-ABC456'
ORDER BY BrandId, PartNumber
FETCH NEXT 1000 ROWS ONLY
```

### 3. **Fluxo de Execução**

#### Primeira Execução (Cron #1)
1. ✅ `lastProcessedId = NULL` → Inicia do primeiro registo
2. ✅ Busca 1000 artigos (`1-AA001` até `50-ZZ999`)
3. ✅ Envia para TypsForYou API
4. ✅ **Guarda checkpoint**: `lastProcessedId = "50-ZZ999"`
5. ✅ **Contador**: `totalProcessed = 1000`

#### Segunda Execução (Cron #2 - 5 minutos depois)
1. ✅ `lastProcessedId = "50-ZZ999"` → Continua de onde parou
2. ✅ Busca próximos 1000 artigos (`51-AA001` até `100-ZZ999`)
3. ✅ Envia para TypsForYou API
4. ✅ **Atualiza checkpoint**: `lastProcessedId = "100-ZZ999"`
5. ✅ **Contador**: `totalProcessed = 2000`

#### Execução Final (Cron #290)
1. ✅ `lastProcessedId = "999-ZZ500"`
2. ✅ Busca últimos 200 artigos (batch < 1000)
3. ✅ Envia para TypsForYou API
4. ✅ **Reset checkpoint**: `lastProcessedId = NULL`, `totalProcessed = 0`
5. ✅ **Status**: `completed = true`

## 🔧 Arquivos Modificados

### 1. `sql.service.ts` - Query com Checkpoint
```typescript
static async getArticles(organizationId: string, options?: {
  lastProcessedId?: string; // ✨ NOVO: Checkpoint
}) {
  // WHERE CompositeId > 'lastProcessedId'
  // ORDER BY BrandId, PartNumber
  // FETCH NEXT 1000 ROWS ONLY
  
  return {
    data: [...],
    lastProcessedId: '123-ABC456' // ✨ NOVO: Último ID do batch
  }
}
```

### 2. `article-sync.service.ts` - Gestão de Checkpoint
```typescript
static async sendArticlesToTypsForYou(
  organizationId: string,
  providerConfigId: string,
  options?: { syncConfigId?: string } // ✨ NOVO
) {
  // 1. Ler checkpoint atual
  const checkpoint = await prisma.syncConfiguration.findUnique(...);
  const lastProcessedId = checkpoint.options.lastProcessedId;
  
  // 2. Buscar próximo batch
  const result = await generateArticlesCsv({ lastProcessedId });
  
  // 3. Enviar para API
  await typs4you.uploadArticlesCsv(result.csv);
  
  // 4. Guardar novo checkpoint
  await prisma.syncConfiguration.update({
    data: {
      options: {
        lastProcessedId: result.lastProcessedId,
        totalProcessed: checkpoint.options.totalProcessed + result.count
      }
    }
  });
}
```

### 3. `cron-scheduler.service.ts` - Passar Config ID
```typescript
case SyncType.ARTICLES:
  result = await ArticleSyncService.sendArticlesToTypsForYou(
    organizationId,
    providerConfigId,
    {
      ...config.options,
      syncConfigId: id // ✨ NOVO: Para atualizar checkpoint
    }
  );
```

## ⚙️ Configuração do Cron

### Executar SQL
```bash
psql -h localhost -U postgres -d cswmarkets -f enable-articles-sync.sql
```

### Configuração Ativa
- **Intervalo**: 300 segundos (5 minutos)
- **Lotes**: ~290 batches de 1000 artigos
- **Tempo Total**: ~24 horas para sincronizar 290 mil
- **Retomável**: Se falhar, continua do último checkpoint

## 📈 Monitorização

### Ver Progresso
```sql
SELECT 
  sync_type,
  is_active,
  options->>'lastProcessedId' as checkpoint,
  (options->>'totalProcessed')::int as processados,
  last_success_at,
  last_error
FROM sync_configurations
WHERE sync_type = 'ARTICLES';
```

### Logs Esperados
```
[INFO] Starting articles sync to TypsForYou...
[INFO] Resuming from checkpoint: 50-ZZ999
[INFO] Fetched 1000 articles from SQL Server
[INFO] Generated CSV with 1000 articles
[INFO] Articles sent successfully to TypsForYou (sent: 1000, loaded: 1000)
[INFO] Checkpoint updated: 100-ZZ999 (Total: 2000)
[INFO] Cached 1000 synced articles to database
```

### Quando Terminar
```
[INFO] No more articles to send - sync completed
[INFO] Checkpoint reset - all articles synced
```

## 🎯 Vantagens

### ✅ Retomável
- Sistema pode parar e recomeçar sem perder progresso
- Falhas de rede não requerem re-envio completo

### ✅ Sem Duplicatas
- Query usa `WHERE id > checkpoint` em vez de `OFFSET`
- Cada artigo processado exatamente uma vez

### ✅ Rastreável
- Campo `totalProcessed` mostra progresso real
- Logs mostram qual batch está a processar

### ✅ Automático
- Cron executa automaticamente a cada 5 minutos
- Não requer intervenção manual

### ✅ Eficiente
- Não re-processa dados já sincronizados
- Incrementa apenas a partir da última posição

## 🚀 Como Activar

1. **Executar SQL de Ativação**
```bash
psql -h localhost -U postgres -d cswmarkets -f enable-articles-sync.sql
```

2. **Reiniciar Servidor** (para carregar nova config)
```bash
npm run dev
```

3. **Verificar Logs**
```bash
tail -f logs/combined.log | grep "articles sync"
```

4. **Monitorizar Progresso** (cada 5 minutos verá novo batch)
```
[14:00] Total: 0 → Batch 1 (1000 artigos)
[14:05] Total: 1000 → Batch 2 (2000 artigos)
[14:10] Total: 2000 → Batch 3 (3000 artigos)
...
[~24h depois] Total: 290000 → Sync completo!
```

## ⚠️ Notas Importantes

1. **CompositeId**: Chave composta `BrandId-PartNumber` garante unicidade
2. **Ordenação Consistente**: `ORDER BY BrandId, PartNumber` é crítica
3. **Intervalo**: 300s (5min) evita sobrecarregar API
4. **Limite**: 1000 registos testados como seguro (500KB CSV limit)
5. **Reset Automático**: Quando batch < 1000, terminou (reset checkpoint)

## 🔄 Reset Manual (se necessário)

```sql
-- Reset checkpoint para re-sincronizar tudo
UPDATE sync_configurations
SET options = jsonb_build_object(
  'limit', 1000,
  'lastProcessedId', NULL,
  'totalProcessed', 0
)
WHERE sync_type = 'ARTICLES';
```
