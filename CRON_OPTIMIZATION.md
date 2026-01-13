# Cron Scheduler Optimization

## Problema Identificado

O node-cron estava a perder execuções (missed executions) devido a:
- Múltiplos schedulers configurados com intervalos muito curtos (< 60 segundos)
- Tarefas a iniciar antes da anterior terminar (blocking IO)
- Alto uso de CPU devido a processos pesados de sincronização

## Otimizações Implementadas

### 1. Sistema de Locks (Concurrency Control)
**Ficheiro**: `src/services/cron-scheduler.service.ts`

Adicionado tracking de tarefas em execução:
```typescript
private runningTasks: Set<string> = new Set();
```

**Comportamento**:
- Antes de executar, verifica se a tarefa já está a correr
- Se sim, salta execução e mostra warning no log
- Quando termina, remove do set de tarefas ativas
- Previne múltiplas execuções simultâneas da mesma tarefa

**Logs**:
```
[CronScheduler] ARTICLE_WAREHOUSE for org XXX is already running, skipping...
[CronScheduler] Released lock for XXX-YYY-ARTICLE_WAREHOUSE
```

### 2. Intervalo Mínimo Forçado
**Mudança**: Intervalos < 60 segundos são automaticamente ajustados para 60s

**Razão**: 
- Processos de sincronização pesados (articles, warehouse) demoram minutos
- Intervalos curtos causam overlapping e blocked executions
- Sistema não consegue acompanhar intervalos < 1 minuto

**Exemplo**:
```typescript
// Antes: intervalSeconds = 5
return `*/5 * * * * *`; // A cada 5 segundos

// Depois: intervalSeconds = 5 → forçado para 60
return `0 */1 * * * *`; // A cada 1 minuto
```

### 3. Remoção de Intervalos em Segundos
**Mudança**: Cron expressions agora usam apenas minutos, horas, dias

**Benefícios**:
- Evita sobrecarga do event loop
- Reduz warnings de missed executions
- Alinha com tempo real de processamento

## Configurações Recomendadas

### Por Tipo de Sync

| Sync Type | Intervalo Recomendado | Razão |
|-----------|----------------------|--------|
| DISCOUNT_GROUPS | 1 hora (3600s) | Dados mudam raramente |
| DISCOUNT_SUBGROUPS | 1 hora (3600s) | Dados mudam raramente |
| ARTICLES | 6 horas (21600s) | Processo pesado, ~30min |
| ARTICLE_WAREHOUSE | 5 minutos (300s) | Stocks mudam frequentemente |
| CUSTOMERS | 1 hora (3600s) | Dados mudam ocasionalmente |
| CUSTOMER_DISCOUNT_GROUPS | 2 horas (7200s) | Dados estáveis |
| CUSTOMER_WAREHOUSES | 2 horas (7200s) | Dados estáveis |
| ORDERS | 5 minutos (300s) | Crítico, tempo real |
| ORDER_FETCH | 5 minutos (300s) | Crítico, tempo real |

### Limites do Sistema
- **Mínimo absoluto**: 60 segundos (forçado pelo código)
- **Recomendado para processos pesados**: 5+ minutos
- **Recomendado para processos leves**: 1+ minutos

## Verificar Configurações Atuais

### SQL Query para ver schedulers ativos
```sql
SELECT 
  sc.id,
  o.name as organization,
  sc."syncType",
  sc."intervalSeconds",
  sc."intervalSeconds" / 60 as interval_minutes,
  sc.enabled,
  sc."lastSyncAt",
  sc."lastSuccessAt"
FROM sync_configurations sc
JOIN organizations o ON o.id = sc."organizationId"
WHERE sc.enabled = true
ORDER BY sc."intervalSeconds" ASC;
```

### Identificar schedulers problemáticos
```sql
-- Schedulers com intervalo < 60 segundos
SELECT 
  sc.id,
  o.name as organization,
  sc."syncType",
  sc."intervalSeconds"
FROM sync_configurations sc
JOIN organizations o ON o.id = sc."organizationId"
WHERE sc.enabled = true 
  AND sc."intervalSeconds" < 60
ORDER BY sc."intervalSeconds" ASC;
```

### Atualizar intervalos curtos
```sql
-- Aumentar todos os intervalos < 60s para 300s (5 minutos)
UPDATE sync_configurations
SET "intervalSeconds" = 300
WHERE enabled = true 
  AND "intervalSeconds" < 60;
```

## Monitoring

### Logs a Observar

**Normal**:
```
[CronScheduler] Executing ARTICLE_WAREHOUSE for org XXX
[CronScheduler] ARTICLE_WAREHOUSE completed successfully
[CronScheduler] Released lock for XXX-YYY-ARTICLE_WAREHOUSE
```

**Overlap detectado** (bom - previne problema):
```
[CronScheduler] ARTICLE_WAREHOUSE for org XXX is already running, skipping...
```

**Intervalo ajustado** (informativo):
```
[CronScheduler] Interval 5s is too short, using 60s minimum
```

**Problema** (necessita atenção):
```
[NODE-CRON] [WARN] missed execution at ...
```

### Métricas Importantes

1. **Duração de Execução**:
   - Verificar quanto tempo cada sync demora
   - Ajustar intervalSeconds se duração > intervalo

2. **Taxa de Skips**:
   - Quantas vezes "already running, skipping" aparece
   - Se > 50% das tentativas, aumentar intervalo

3. **Taxa de Sucesso**:
   - lastSuccessAt vs lastSyncAt
   - Diferença indica falhas

## Troubleshooting

### Muitos "missed execution" warnings

**Causa**: Tarefas ainda a bloquear o event loop

**Soluções**:
1. Verificar se locks estão a funcionar (ver "already running")
2. Aumentar intervalos na base de dados
3. Verificar se há memory leaks (ver MEMORY_OPTIMIZATION.md)
4. Reduzir número de schedulers ativos simultaneamente

### Tarefas não executam

**Causa**: Cron expression inválido ou tarefa desabilitada

**Verificar**:
```typescript
// Ver expressão gerada
const cronExpression = this.intervalToCron(intervalSeconds);
console.log('Cron:', cronExpression);

// Testar manualmente
cron.validate(cronExpression); // true = válido
```

### Overlapping ainda ocorre

**Causa**: Lock não está a funcionar ou tarefa demora muito

**Verificar**:
```sql
-- Ver duração real das tarefas
SELECT 
  "syncType",
  AVG(duration) / 1000 as avg_duration_seconds,
  MAX(duration) / 1000 as max_duration_seconds
FROM sync_execution_logs
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
GROUP BY "syncType";
```

**Ajustar** se duração > intervalo:
```sql
UPDATE sync_configurations
SET "intervalSeconds" = (
  SELECT CEIL(MAX(duration) / 1000) * 2 
  FROM sync_execution_logs sel
  WHERE sel."syncConfigurationId" = sync_configurations.id
)
WHERE id = 'problematic-id';
```

## Best Practices

### 1. Intervalos Seguros
- Usar intervalos 2-3x superiores à duração média
- Exemplo: tarefa demora 5min → intervalo 10-15min

### 2. Horários Estratégicos
Para tarefas pesadas (ARTICLES), usar horários específicos:
```sql
-- Em vez de interval, usar cron expression direta
UPDATE sync_configurations
SET 
  "intervalSeconds" = 86400, -- 1 dia
  options = jsonb_set(
    COALESCE(options, '{}'::jsonb),
    '{cronExpression}',
    '"0 2 * * *"'::jsonb -- 2h da manhã
  )
WHERE "syncType" = 'ARTICLES';
```

### 3. Evitar Horários de Pico
- Não agendar múltiplas tarefas pesadas ao mesmo tempo
- Escalonar: ARTICLES às 2h, WAREHOUSE às 3h, etc.

### 4. Monitoring Contínuo
- Verificar logs diários
- Ajustar intervalos com base em performance real
- Usar métricas de sync_execution_logs

## Conclusão

Com estas otimizações:
- ✅ Overlapping de tarefas prevenido via locks
- ✅ Intervalos muito curtos ajustados automaticamente
- ✅ Sistema mais estável e previsível
- ✅ Logs claros indicam estado das tarefas

O sistema agora previne os warnings de "missed execution" garantindo que cada tarefa termina antes da próxima começar.
