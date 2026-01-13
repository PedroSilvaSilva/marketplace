# Error Logging System - Articles & Warehouse

## Implementação Concluída ✅

Sistema de logging de erros integrado nos serviços de sincronização de artigos e warehouse para Typs4You.

## Funcionalidades

### 1. Logging Automático de Erros

**Articles Sync** (`article-scheduler.service.ts`):
- ✅ Regista erros quando artigos são rejeitados pela API Typs4You
- ✅ Captura BrandIDs inválidos
- ✅ Extrai InternalPartNumbers das mensagens de erro
- ✅ Calcula taxa de falha (failed/sent)
- ✅ Envia email apenas em caso de erro
- ✅ Envia notificação para erros críticos (exceções)

**Article Warehouse Sync** (`article-warehouse-scheduler.service.ts`):
- ✅ Regista erros por batch (cada 1000 registos)
- ✅ Captura InternalPartNumbers dos artigos que falharam
- ✅ Regista erros de API e exceções
- ✅ Continua processamento mesmo com erros
- ✅ Notifica erros críticos que param a sincronização

### 2. Dados Capturados

Cada erro registado contém:

```typescript
{
  context: 'articles' | 'warehouse',
  organizationId: string,
  errorMessage: string,
  errorDetails: {
    sent: number,              // Total enviado
    loaded: number,            // Total carregado com sucesso
    failed: number,            // Total falhado
    failureRate: string,       // % de falha
    invalidBrandIds: number[], // BrandIDs inválidos
    errorSummary: Array,       // Primeiros erros da API
    failedPartNumbers: string[], // InternalPartNumbers que falharam
    batchNumber?: number,      // Número do batch (warehouse)
    exitCode?: string          // Código de saída da API
  },
  stackTrace: string | null,
  metadata: {
    syncConfigurationId: string,
    providerConfigId: string,
    executionLogId: string,
    exitCode?: string
  }
}
```

### 3. API Endpoints Disponíveis

Base URL: `http://localhost:4000/api/v1/error-notifications`

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/` | Lista todos os logs com filtros |
| GET | `/formatted` | Logs formatados com InternalPartNumber |
| GET | `/:id` | Detalhes de um erro específico |
| GET | `/stats/summary` | Estatísticas de erros |
| DELETE | `/:id` | Eliminar um log específico |
| DELETE | `/bulk/delete` | Eliminar múltiplos logs |
| POST | `/send` | Enviar notificação manual |
| POST | `/test` | Testar sistema de notificações |

### 4. Filtros Disponíveis

Query parameters suportados:

```typescript
{
  context?: 'articles' | 'warehouse' | 'orders' | ...,
  organizationId?: string,
  hours?: number,           // Últimas X horas
  search?: string,          // Busca em errorMessage
  page?: number,            // Paginação (default: 1)
  limit?: number,           // Items por página (default: 50)
  sortBy?: string,          // Campo para ordenar
  sortOrder?: 'asc' | 'desc' // Ordem (default: desc)
}
```

### 5. Exemplos de Uso

#### Ver erros de artigos das últimas 24h
```http
GET /api/v1/error-notifications?context=articles&hours=24
```

#### Ver erros de warehouse com InternalPartNumber
```http
GET /api/v1/error-notifications/formatted?context=warehouse
```

#### Buscar erros de BrandID
```http
GET /api/v1/error-notifications?search=BrandID
```

#### Ver estatísticas
```http
GET /api/v1/error-notifications/stats/summary
```

Resposta:
```json
{
  "total": 150,
  "byContext": {
    "articles": 80,
    "warehouse": 70
  },
  "byOrganization": {
    "org-123": 100,
    "org-456": 50
  },
  "last24Hours": 45,
  "last7Days": 120
}
```

### 6. Formato de Resposta

#### Lista de Erros
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "context": "articles",
      "organizationId": "org-123",
      "errorMessage": "Articles sync completed with 15 failures out of 100 sent",
      "errorDetails": {
        "sent": 100,
        "loaded": 85,
        "failed": 15,
        "failureRate": "15.00%",
        "invalidBrandIds": [123, 456],
        "failedPartNumbers": ["PART-001", "PART-002"]
      },
      "createdAt": "2026-01-13T12:00:00Z",
      "sentAt": "2026-01-13T12:00:01Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "totalPages": 3
  }
}
```

#### Formato com InternalPartNumber (endpoint `/formatted`)
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "context": "articles",
      "identifier": "PART-001, PART-002", // InternalPartNumbers
      "errorMessage": "Articles sync completed with 15 failures",
      "details": {
        "sent": 100,
        "failed": 15,
        "invalidBrandIds": [123, 456]
      },
      "createdAt": "2026-01-13T12:00:00Z"
    }
  ]
}
```

### 7. Integração com Email

O sistema já envia emails automaticamente:

**Quando envia email:**
- ❌ Artigos com falhas na sincronização
- ❌ Warehouse batches com erros
- ❌ Erros críticos (exceções)

**Quando NÃO envia email:**
- ✅ Sincronizações 100% bem sucedidas (vão para relatório diário)

**Destinatários:**
- Configurados em `.env` → `ORDER_NOTIFICATION_EMAILS`
- Formato: `email1@example.com,email2@example.com`

### 8. Base de Dados

Tabela: `error_notification_logs`

```sql
-- Ver todos os erros de artigos
SELECT * FROM error_notification_logs 
WHERE context = 'articles'
ORDER BY "createdAt" DESC;

-- Ver erros por organização
SELECT 
  "organizationId",
  context,
  COUNT(*) as total_errors
FROM error_notification_logs
GROUP BY "organizationId", context;

-- Ver erros recentes
SELECT * FROM error_notification_logs
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
ORDER BY "createdAt" DESC;

-- Limpar erros antigos
DELETE FROM error_notification_logs
WHERE "createdAt" < NOW() - INTERVAL '30 days';
```

### 9. Quando os Erros São Registados

#### Articles Sync
1. **Durante sincronização**: Se há artigos rejeitados pela API
2. **Após cada batch**: Logs parciais se houver falhas
3. **Em exceções**: Erros críticos que param o processo

#### Warehouse Sync
1. **Por batch (1000 registos)**: Se exitCode ≠ 200/0
2. **Em exceções**: Erros em processamento de batch
3. **Erro crítico**: Falha total da sincronização

### 10. Monitoring e Alertas

**Verificar saúde do sistema:**
```http
GET /api/v1/error-notifications/stats/summary
```

**Alertas recomendados:**
- Taxa de erro > 10% em articles
- Múltiplos batches falhados em warehouse
- Mesmos BrandIDs falhando repetidamente
- Aumento súbito de erros

### 11. Troubleshooting

#### Não vejo erros na API
- Verificar se houve sincronizações recentemente
- Confirmar que as sincronizações tiveram erros (ver logs)
- Verificar token de autenticação

#### Muitos erros de BrandID
- Executar SQL para corrigir: `check-invalid-brandids.sql`
- Filtrar BrandIDs inválidos na query SQL
- Verificar mapeamento de marcas

#### Emails não chegam
- Verificar configuração SMTP em `.env`
- Ver logs do servidor: `[EmailService]`
- Testar com endpoint `/test`

### 12. Próximos Passos

Possíveis melhorias:
- [ ] Dashboard visual de erros
- [ ] Alertas por webhook
- [ ] Retry automático de artigos falhados
- [ ] Filtro por BrandID na API
- [ ] Export de erros para CSV
- [ ] Gráficos de tendências

## Ficheiros Modificados

1. ✅ `src/modules/sync/services/article-scheduler.service.ts`
   - Integrado ErrorNotificationService
   - Logging de erros parciais e críticos
   
2. ✅ `src/modules/sync/services/article-warehouse-scheduler.service.ts`
   - Logging por batch
   - Captura de erros de API e exceções

3. ✅ `test-error-logs.http`
   - Exemplos de chamadas à API
   - Testes de todos os endpoints

## Como Testar

1. **Forçar erro de artigos:**
   - Adicionar BrandID inválido temporariamente
   - Executar sync manual via API
   - Verificar logs em `/error-notifications`

2. **Verificar warehouse:**
   - Aguardar próxima sincronização automática
   - Verificar se há batches com erros
   - Consultar API para ver detalhes

3. **Testar notificações:**
```http
POST http://localhost:4000/api/v1/error-notifications/test
{
  "context": "articles",
  "organizationId": "test",
  "errorMessage": "Test error"
}
```

## Conclusão

✅ Sistema completo de logging de erros implementado
✅ API REST disponível com múltiplos endpoints
✅ Emails automáticos apenas em caso de erro
✅ Dados detalhados incluindo InternalPartNumbers
✅ Filtros e paginação
✅ Estatísticas e monitoring

Todos os erros de sincronização de artigos e warehouse são agora registados e podem ser consultados via API!
