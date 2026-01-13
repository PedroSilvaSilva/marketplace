# Memory Optimization Guide

## Problema Identificado
O servidor estava a consumir demasiada memória e a crashar com erros de "heap out of memory" durante a sincronização de artigos warehouse. O sistema estava a processar ~107K registos simultaneamente.

## Otimizações Implementadas

### 1. Redução de Limites de Queries
**Ficheiro**: `src/modules/sync/services/article-warehouse-scheduler.service.ts`

- Reduzido limite de fetch de 150K para 50K registos
- Implementado carregamento paginado da cache (10K registos de cada vez)
- Processamento de cache updates em batches de 500

### 2. Garbage Collection Ativa
**Ficheiros**: `package.json`, `start-dev.ps1`

- Adicionado flag `--expose-gc` ao NODE_OPTIONS
- Implementadas chamadas explícitas a `global.gc()` entre batches
- GC forçado após cada chunk de cache carregado
- GC forçado após cada batch de upload

### 3. Delays Entre Batches
**Ficheiro**: `src/modules/sync/services/article-warehouse-scheduler.service.ts`

- Adicionado delay de 100ms entre batches
- Reduz pressão na memória e no CPU
- Permite GC fazer limpeza entre operações

### 4. Processamento em Streaming
**Implementado**:
- Cache carregada em chunks de 10K
- Cache updates processadas em batches de 500
- Força GC entre cada chunk/batch

## Como Usar

### Parar Processos Existentes
```powershell
.\stop-all-processes.ps1
```

Este script:
- Para gracefully todos os processos Node.js
- Limpa cache do tsx
- Prepara sistema para restart

### Iniciar com Otimizações
```powershell
.\start-dev.ps1
```

Este script:
- Define NODE_OPTIONS com 8GB limite + expose-gc
- Inicia servidor com `pnpm dev`
- Logs mostram configuração aplicada

### Monitorizar Memória
Durante execução, observe:
- Logs de `[ArticleWarehouseScheduler]` mostram progresso
- GC warnings no console indicam quando garbage collection ocorre
- Process memory visível em Task Manager

## Configurações Aplicadas

### package.json
```json
{
  "scripts": {
    "dev": "cross-env NODE_OPTIONS=\"--max-old-space-size=8192 --expose-gc\" tsx watch src/server.ts"
  }
}
```

### Node.js Options
- `--max-old-space-size=8192`: 8GB limite de heap
- `--expose-gc`: Permite chamadas manuais a garbage collector

## Limites Recomendados

### Article Warehouse Sync
- **SQL Query Limit**: 50,000 registos
- **Cache Page Size**: 10,000 registos
- **Upload Batch Size**: 1,000 registos (limite API)
- **Cache Update Batch**: 500 registos
- **Batch Delay**: 100ms

### Memória do Sistema
- **Node Heap**: 8GB máximo
- **Sistema**: Recomendado 16GB+ RAM total
- **CPU**: Multi-core recomendado para parallel processing

## Debugging

### Ver Uso de Memória
```powershell
# Em PowerShell
Get-Process -Name "node" | Select-Object ProcessName, @{Name="Memory(MB)";Expression={[math]::Round($_.WorkingSet64/1MB,2)}}
```

### Forçar Garbage Collection
No código:
```typescript
if (global.gc) {
  global.gc(); // Força limpeza de memória
}
```

### Logs Importantes
```typescript
logger.info('[ArticleWarehouseScheduler] Loaded cache', { cacheSize: cacheMap.size });
logger.info('[ArticleWarehouseScheduler] Detected changes', { changed: recordsToSync.length });
logger.info('[ArticleWarehouseScheduler] Processing in batches', { batches: totalBatches });
```

## Próximos Passos

Se problemas persistirem:

1. **Aumentar delays**: Mudar de 100ms para 200ms ou 500ms
2. **Reduzir batch sizes**: De 1000 para 500 registos
3. **Implementar queue system**: Usar Bull/BullMQ para processamento async
4. **Split por warehouse**: Processar um warehouse de cada vez
5. **Streaming real**: Implementar streams do Node.js em vez de arrays

## Monitoring

### Métricas a Observar
- Heap size durante sync
- Número de GC events
- Tempo de processamento por batch
- Taxa de sucesso de uploads
- Erros de memória no log

### Alertas
Configure alertas para:
- Memory usage > 6GB
- GC frequency > 10/min
- Batch failures > 5%
- Sync duration > 30min

## Troubleshooting

### Servidor ainda crashando?
1. Verificar se há outros processos consumindo memória
2. Aumentar limite para 12GB ou 16GB
3. Considerar dividir sync em múltiplas execuções
4. Verificar memory leaks com `node --inspect`

### GC muito frequente?
1. Reduzir batch sizes
2. Aumentar delays entre batches
3. Limpar objetos grandes após uso:
   ```typescript
   let largeArray = [...];
   // usar array
   largeArray = null; // marcar para GC
   ```

### Performance degradada?
1. Delays podem estar muito longos
2. Batch sizes podem estar muito pequenos
3. Considerar parallel processing com workers
4. Cache invalidation strategy

## Performance Atual

### Antes das Otimizações
- ❌ Crash com ~4GB memória
- ❌ 150K registos carregados de uma vez
- ❌ Cache carregada toda de uma vez
- ❌ Sem garbage collection ativa

### Depois das Otimizações
- ✅ 8GB limite com margem de segurança
- ✅ 50K registos processados
- ✅ Cache carregada em chunks de 10K
- ✅ GC forçado entre operações
- ✅ Delays previnem overload

## Conclusão

Estas otimizações reduzem significativamente o consumo de memória através de:
1. **Chunking**: Dividir dados grandes em pedaços menores
2. **Streaming**: Processar dados em fluxo contínuo
3. **GC Management**: Limpeza ativa de memória
4. **Rate Limiting**: Delays previnem sobrecarga

O sistema agora deve funcionar de forma estável mesmo com grandes volumes de dados.
