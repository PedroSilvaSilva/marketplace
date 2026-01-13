# 🌙 Sistema Rodando Durante a Noite - Status

## 📊 6 Crons Ativos

### ⚡ Alta Frequência (10-60s)
1. **ORDER_FETCH** - 10s 
   - Busca encomendas da TypsForYou
   - Integra no PHC automaticamente
   - Email: celia@samiparts.pt

2. **ORDERS** - 60s
   - Envia encomendas para TypsForYou
   - Status: Aguardando encomendas

3. **DISCOUNT_GROUPS** - 60s
   - Sincroniza grupos de desconto
   - Modo: Incremental (MD5 hash)

4. **DISCOUNT_SUBGROUPS** - 60s
   - Sincroniza subgrupos de desconto
   - Modo: Incremental (MD5 hash)

### 🔄 Média Frequência (5 min = 300s)
5. **ARTICLE_WAREHOUSE** - 300s
   - Stock e preços dos artigos
   - Modo: Incremental (MD5 hash)
   - Primeira execução: Envia TODOS
   - Depois: Só mudanças

6. **ARTICLES** - 300s ⭐ **PRINCIPAL**
   - **Fase 1 (Checkpoint)**: Carregando 290 mil artigos
   - Progresso: 1000/290000 (0.34%)
   - Checkpoint: "6-411 0256 10"
   - Tempo estimado: ~24 horas
   - **Fase 2 (Incremental)**: Ativa automaticamente após fase 1

## 📈 O Que Vai Acontecer Durante a Noite

### 21:29 - 22:00 (primeira 30 min)
```
[21:29] ARTICLES: 1000 artigos (Total: 1000)
[21:34] ARTICLES: 1000 artigos (Total: 2000)
[21:39] ARTICLES: 1000 artigos (Total: 3000)
[21:44] ARTICLES: 1000 artigos (Total: 4000)
[21:49] ARTICLES: 1000 artigos (Total: 5000)
[21:54] ARTICLES: 1000 artigos (Total: 6000)
[21:59] ARTICLES: 1000 artigos (Total: 7000)
```

### 22:00 - 08:00 (10 horas)
```
120 execuções × 1000 artigos = 120.000 artigos
Total acumulado: 127.000 artigos (~44%)
```

### 08:00 - 12:00 (manhã seguinte)
```
48 execuções × 1000 artigos = 48.000 artigos
Total acumulado: 175.000 artigos (~60%)
```

### 12:00 - 21:29 (tarde/noite)
```
115 execuções × 1000 artigos = 115.000 artigos
Total final: 290.000 artigos (100%) ✅
```

## 📧 Emails que Vai Receber

### Durante Checkpoint (a cada 5 min):
```
✅ 1000 Artigo(s) Sincronizado(s) - TypsForYou
📤 Artigos Enviados: 1000
✅ Carregados na API: 1000
📊 Total Processado: 15,000
🔖 Checkpoint: 150-ABC456
```

### Quando Completar Fase 1:
```
🎉 Checkpoint completed! Switching to incremental mode
✅ Total sincronizados: 290,000 artigos
```

### Depois (Fase 2 - Incremental):
```
⚡ 25 Artigo(s) Sincronizado(s) - TypsForYou
✨ Apenas artigos modificados
```

## 🔍 Como Monitorizar

### 1. Ver Progresso no PostgreSQL
```sql
SELECT 
  "syncType",
  options->>'mode' as modo,
  options->>'lastProcessedId' as checkpoint,
  (options->>'totalProcessed')::int as processados,
  "lastSuccessAt" as ultima_sync,
  "lastError" as ultimo_erro
FROM sync_configurations
WHERE "syncType" = 'ARTICLES';
```

### 2. Ver Logs em Tempo Real
```powershell
# No terminal onde está pnpm dev
# Logs aparecem automaticamente a cada execução
```

### 3. Ver Execuções no Banco
```sql
SELECT 
  "syncType",
  status,
  "totalProcessed",
  "totalSucceeded",
  "totalFailed",
  duration,
  "startedAt",
  "completedAt"
FROM sync_execution_logs
WHERE "syncType" = 'ARTICLES'
ORDER BY "startedAt" DESC
LIMIT 10;
```

## ⚠️ Se Houver Problemas

### Sistema Trava/Pára
✅ **Checkpoint salva progresso!**
- Ao reiniciar, continua de onde parou
- Não perde nenhum artigo processado

### Erro na API
✅ **Retry automático na próxima execução**
- Cron tenta novamente em 5 minutos
- Checkpoint mantém posição

### Falta de Energia
✅ **Retomável**
- Liga servidor → pnpm dev
- Sistema carrega checkpoint automaticamente

## 📊 Estado Esperado Amanhã de Manhã (08:00)

```json
{
  "total_processado": "~130,000 artigos",
  "progresso": "~45%",
  "checkpoint": "130-XYZ789",
  "tempo_restante": "~13 horas",
  "emails_recebidos": "~156 (12 por hora)"
}
```

## ✅ Checklist Antes de Dormir

- [x] Servidor rodando (pnpm dev ativo)
- [x] 6 crons carregados e ativos
- [x] Checkpoint em 1000 artigos
- [x] Email service configurado
- [x] Logs funcionando
- [x] Base de dados conectada
- [x] Sem erros de compilação

## 🚀 Sistema 100% Automático

**Não requer intervenção manual!**

- ✅ Checkpoint salva progresso automaticamente
- ✅ Transição de Fase 1 → Fase 2 é automática
- ✅ Emails notificam progresso
- ✅ Logs registram tudo
- ✅ Retomável em caso de falha

**Bom descanso! O sistema trabalha para você! 🌙**
