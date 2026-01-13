# 🔄 Sistema Híbrido de Sincronização de Artigos

## 📋 Duas Fases Automáticas

### 🔵 **Fase 1: Checkpoint (Carga Inicial)**
**Duração**: ~24 horas para 290 mil artigos
**Objetivo**: Carregar todos os artigos sequencialmente

```
Execução #1:  Artigos 1-1000    → Checkpoint: "50-ABC123"
Execução #2:  Artigos 1001-2000 → Checkpoint: "100-DEF456"
...
Execução #290: Artigos 289001-290000 → COMPLETO!
```

**Query SQL Fase 1**:
```sql
WHERE CompositeId > 'lastCheckpoint'  -- Continua de onde parou
ORDER BY BrandId, PartNumber
FETCH NEXT 1000 ROWS ONLY
```

---

### 🟢 **Fase 2: Incremental (Mudanças)**
**Ativa**: Automaticamente após Fase 1 completar
**Objetivo**: Sincronizar apenas artigos modificados

```
Última sync: 2026-01-08 21:00:00

Execução #1: 0 artigos (nada mudou)
Execução #2: 5 artigos (preços alterados)
Execução #3: 0 artigos
Execução #4: 12 artigos (novos + alterados)
```

**Query SQL Fase 2**:
```sql
WHERE DataAlteracao > '2026-01-08 21:00:00'  -- Só modificados desde última sync
ORDER BY BrandId, PartNumber
FETCH NEXT 1000 ROWS ONLY
```

---

## 🔄 Transição Automática

### Como Funciona:

1. **Início**: Sistema inicia em modo `checkpoint`
   ```json
   {
     "mode": "checkpoint",
     "lastProcessedId": null,
     "totalProcessed": 0
   }
   ```

2. **Durante Fase 1**: Checkpoint vai avançando
   ```json
   {
     "mode": "checkpoint",
     "lastProcessedId": "150-XYZ789",
     "totalProcessed": 150000
   }
   ```

3. **Quando termina** (batch < 1000 = não há mais artigos):
   ```
   🎉 Checkpoint completed! Switching to incremental mode
   ```
   ```json
   {
     "mode": "incremental",
     "lastProcessedId": null,
     "totalProcessed": 290000,
     "completedAt": "2026-01-09T21:00:00Z"
   }
   ```

4. **Fase 2 ativa**: Usa `lastSuccessAt` para comparar
   ```json
   {
     "mode": "incremental",
     "totalProcessed": 290000
   }
   ```

---

## 📊 Campos DataCriacao e DataAlteracao

### Na View SQL:
```sql
SELECT 
  BrandId,
  PartNumber,
  ArticleName,
  ...
  DataCriacao,    -- Quando artigo foi criado
  DataAlteracao   -- Última modificação (preço, nome, stock, etc)
FROM u_csw_tips4y_Articles
```

### Lógica Incremental:
```typescript
// Buscar artigos modificados desde última sincronização
const lastSync = '2026-01-08 21:00:00';

SELECT * FROM u_csw_tips4y_Articles
WHERE DataAlteracao > '2026-01-08 21:00:00'
ORDER BY BrandId, PartNumber
```

**Vantagem**: Não re-envia artigos que não mudaram!

---

## 🔧 Implementação Técnica

### sql.service.ts
```typescript
static async getArticles(organizationId, options: {
  lastProcessedId?: string;    // Fase 1: Checkpoint
  modifiedSince?: Date;         // Fase 2: Incremental
}) {
  // Fase 1: WHERE CompositeId > checkpoint
  if (options.lastProcessedId) {
    conditions.push(`CompositeId > '${options.lastProcessedId}'`);
  }
  
  // Fase 2: WHERE DataAlteracao > lastSync
  if (options.modifiedSince) {
    conditions.push(`DataAlteracao > '${dateStr}'`);
  }
}
```

### article-sync.service.ts
```typescript
static async sendArticlesToTypsForYou() {
  const syncConfig = await getSyncConfig();
  const mode = syncConfig.options.mode || 'checkpoint';
  
  // Decidir qual fase usar
  if (mode === 'incremental' && lastSyncAt) {
    // Fase 2: Só mudanças
    csvResult = await generateArticlesCsv({
      modifiedSince: lastSyncAt
    });
  } else {
    // Fase 1: Checkpoint
    csvResult = await generateArticlesCsv({
      lastProcessedId: checkpoint
    });
  }
  
  // Se Fase 1 terminou (count = 0) → muda para Fase 2
  if (mode === 'checkpoint' && csvResult.count === 0) {
    await updateConfig({ mode: 'incremental' });
    logger.info('🎉 Switched to incremental mode!');
  }
}
```

---

## 📈 Comparação de Performance

### Fase 1 (Checkpoint):
- **1ª execução**: 1000 artigos (~2 min)
- **2ª execução**: 1000 artigos (~2 min)
- **290ª execução**: 1000 artigos (~2 min)
- **Total**: 290 execuções × 5 min = **~24 horas**

### Fase 2 (Incremental):
- **Se nada mudou**: 0 artigos (~5 seg query)
- **Se 10 mudaram**: 10 artigos (~10 seg total)
- **Se 100 mudaram**: 100 artigos (~30 seg total)
- **Média**: **< 1 minuto** por execução

---

## ✅ Vantagens do Sistema Híbrido

### Checkpoint (Fase 1):
✅ Retomável se sistema falhar
✅ Não depende de timestamps (dados antigos OK)
✅ Progressão visível (1000/290000, 2000/290000...)
✅ Não perde nada (processa tudo sequencialmente)

### Incremental (Fase 2):
✅ Ultra-rápido (só mudanças)
✅ Não sobrecarrega API
✅ Ideal para produção contínua
✅ 99% das execuções são instantâneas

---

## 🔍 Monitorização

### Ver Fase Atual:
```sql
SELECT 
  "syncType",
  options->>'mode' as fase,
  options->>'lastProcessedId' as checkpoint,
  options->>'totalProcessed' as processados,
  options->>'completedAt' as checkpoint_completo,
  "lastSuccessAt" as ultima_sync
FROM sync_configurations
WHERE "syncType" = 'ARTICLES';
```

### Logs Esperados:

**Fase 1 (Checkpoint)**:
```
[info] Sync mode: checkpoint {checkpoint: '100-ABC', lastSync: null}
[info] [Checkpoint Mode] Sequential loading from checkpoint
[info] Fetched 1000 articles from SQL Server
[info] Checkpoint updated: 150-XYZ (Total: 150000)
```

**Transição**:
```
[info] Sync mode: checkpoint {checkpoint: '289-ZZZ', lastSync: null}
[info] [Checkpoint Mode] Sequential loading from checkpoint
[info] Fetched 500 articles from SQL Server (batch < 1000)
[info] 🎉 Checkpoint completed! Switching to incremental mode
```

**Fase 2 (Incremental)**:
```
[info] Sync mode: incremental {checkpoint: null, lastSync: '2026-01-09T21:00:00Z'}
[info] [Incremental Mode] Fetching articles modified since last sync
[info] Fetched 15 articles from SQL Server
[info] Incremental sync: 15 modified articles sent
```

---

## 🚀 Estado Atual

```json
{
  "fase": "1 (Checkpoint)",
  "progresso": "1000/290000 (0.34%)",
  "tempo_restante": "~24 horas",
  "proximo_batch": "em 5 minutos",
  "transicao_automatica": "quando checkpoint = null E count = 0"
}
```

**Após 24 horas**:
```json
{
  "fase": "2 (Incremental)",
  "total_sincronizados": "290000 artigos",
  "modo": "apenas mudanças",
  "performance": "< 1 minuto por sync"
}
```
