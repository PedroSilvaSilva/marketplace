# 📊 Integration Statistics API - Typs4You

Base URL: `/api/v1/integration/stats`

Todas as rotas requerem autenticação (Bearer Token).

---

## 1. Overview - Resumo Geral
**GET** `/api/v1/integration/stats/:organizationId/overview`

Estatísticas gerais de sincronização da organização.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSyncs": 8,
    "activeSyncs": 6,
    "inactiveSyncs": 2,
    "lastSuccessfulSync": "2025-12-29T10:30:00.000Z",
    "nextScheduledSync": "2025-12-29T11:00:00.000Z",
    "overallSuccessRate": 94.5,
    "totalRecordsSynced": 150000,
    "totalRecordsSyncedToday": 1250
  },
  "meta": {
    "timestamp": "2025-12-29T10:35:00.000Z"
  }
}
```

---

## 2. Real-time - Status em Tempo Real
**GET** `/api/v1/integration/stats/:organizationId/realtime`

Status atual de sincronizações em execução.

**Response:**
```json
{
  "success": true,
  "data": {
    "syncsRunning": 2,
    "syncsPending": 1,
    "currentJobs": [
      {
        "type": "ARTICLES",
        "status": "PROCESSING",
        "progress": 65.5,
        "estimatedTimeRemaining": 120,
        "processedRecords": 6500,
        "totalRecords": 10000
      }
    ]
  },
  "meta": {
    "timestamp": "2025-12-29T10:35:00.000Z"
  }
}
```

---

## 3. By Type - Estatísticas por Tipo
**GET** `/api/v1/integration/stats/:organizationId/by-type`

Estatísticas detalhadas por tipo de sincronização.

**Response:**
```json
{
  "success": true,
  "data": {
    "ARTICLES": {
      "totalSynced": 50000,
      "lastSync": "2025-12-29T10:30:00.000Z",
      "successRate": 98.2,
      "errors": 900,
      "avgExecutionTime": 45
    },
    "CUSTOMERS": {
      "totalSynced": 25000,
      "lastSync": "2025-12-29T09:00:00.000Z",
      "successRate": 99.5,
      "errors": 125,
      "avgExecutionTime": 32,
      "newToday": 15
    },
    "ORDERS": {
      "totalSynced": 5000,
      "lastSync": "2025-12-29T10:20:00.000Z",
      "successRate": 97.5,
      "errors": 125,
      "avgExecutionTime": 2,
      "pending": 3
    },
    "DISCOUNT_GROUPS": {
      "totalSynced": 150,
      "lastSync": "2025-12-29T08:00:00.000Z",
      "successRate": 100.0,
      "errors": 0,
      "avgExecutionTime": 5
    }
  },
  "meta": {
    "timestamp": "2025-12-29T10:35:00.000Z"
  }
}
```

**Campos dinâmicos:**
- `newToday` - Apenas para CUSTOMERS
- `pending` - Apenas para ORDERS

---

## 4. Errors - Estatísticas de Erros
**GET** `/api/v1/integration/stats/:organizationId/errors`

Análise detalhada de erros.

**Response:**
```json
{
  "success": true,
  "data": {
    "last24h": 12,
    "last7days": 85,
    "last30days": 320,
    "byOperation": {
      "API_UPLOAD": 150,
      "CSV_GENERATION": 80,
      "DATA_VALIDATION": 90
    },
    "topErrors": [
      {
        "errorMessage": "Campo ou Parametro PartNumber Errado ou Inexistente",
        "count": 120,
        "lastOccurred": "2025-12-29T10:25:00.000Z"
      },
      {
        "errorMessage": "Connection timeout",
        "count": 45,
        "lastOccurred": "2025-12-29T09:15:00.000Z"
      }
    ]
  },
  "meta": {
    "timestamp": "2025-12-29T10:35:00.000Z"
  }
}
```

---

## 5. Performance - Métricas de Performance
**GET** `/api/v1/integration/stats/:organizationId/performance`

Métricas de performance dos últimos 30 dias.

**Response:**
```json
{
  "success": true,
  "data": {
    "avgResponseTime": 1250,
    "uptime": 99.2,
    "totalRequests": 15000,
    "successfulRequests": 14880,
    "failedRequests": 120,
    "avgExecutionTime": 35
  },
  "meta": {
    "timestamp": "2025-12-29T10:35:00.000Z"
  }
}
```

**Unidades:**
- `avgResponseTime`: millisegundos
- `uptime`: percentagem (0-100)
- `avgExecutionTime`: segundos

---

## 6. Trends - Tendências ao Longo do Tempo
**GET** `/api/v1/integration/stats/:organizationId/trends?days=30`

Dados históricos para gráficos de tendências.

**Query Parameters:**
- `days` (opcional): número de dias (1-365, default: 30)

**Response:**
```json
{
  "success": true,
  "data": {
    "syncsByDay": [
      {
        "date": "2025-12-01",
        "total": 48,
        "success": 46,
        "failed": 2
      },
      {
        "date": "2025-12-02",
        "total": 52,
        "success": 50,
        "failed": 2
      }
    ],
    "recordsByDay": [
      {
        "date": "2025-12-01",
        "records": 125000
      },
      {
        "date": "2025-12-02",
        "records": 130000
      }
    ],
    "errorTrend": [
      {
        "date": "2025-12-01",
        "errors": 15
      },
      {
        "date": "2025-12-02",
        "errors": 12
      }
    ]
  },
  "meta": {
    "timestamp": "2025-12-29T10:35:00.000Z",
    "days": 30
  }
}
```

**Uso:** Ideal para Line Charts mostrando evolução ao longo do tempo.

---

## 7. Schedule - Próximas Sincronizações
**GET** `/api/v1/integration/stats/:organizationId/schedule`

Agenda de próximas sincronizações.

**Response:**
```json
{
  "success": true,
  "data": {
    "upcomingSyncs": [
      {
        "syncType": "ARTICLES",
        "nextRun": "2025-12-29T11:00:00.000Z",
        "intervalSeconds": 3600,
        "enabled": true
      },
      {
        "syncType": "CUSTOMERS",
        "nextRun": "2025-12-29T11:15:00.000Z",
        "intervalSeconds": 1800,
        "enabled": true
      },
      {
        "syncType": "ORDERS",
        "nextRun": "2025-12-29T11:20:00.000Z",
        "intervalSeconds": 300,
        "enabled": true
      }
    ]
  },
  "meta": {
    "timestamp": "2025-12-29T10:35:00.000Z"
  }
}
```

**Ordenação:** Por `nextRun` (mais próximo primeiro).

---

## 📌 Tipos de Sync Disponíveis

```typescript
enum SyncType {
  ARTICLES = "ARTICLES",
  ARTICLE_WAREHOUSE = "ARTICLE_WAREHOUSE",
  CUSTOMERS = "CUSTOMERS",
  CUSTOMER_DISCOUNT_GROUPS = "CUSTOMER_DISCOUNT_GROUPS",
  CUSTOMER_WAREHOUSES = "CUSTOMER_WAREHOUSES",
  DISCOUNT_GROUPS = "DISCOUNT_GROUPS",
  DISCOUNT_SUBGROUPS = "DISCOUNT_SUBGROUPS",
  ORDERS = "ORDERS"
}
```

---

## 🎨 Sugestões de UI

### Dashboard Principal
```
┌─────────────────────────────────────────────────┐
│  📊 OVERVIEW (cards grandes)                     │
│  - Total Syncs: 8 (6 ativos)                    │
│  - Success Rate: 94.5%                          │
│  - Records Today: 1,250                         │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  ⚡ REALTIME (progress bars)                     │
│  Articles: ████████░░ 65% (120s remaining)      │
│  Customers: Pending...                          │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  📈 TRENDS (line chart - últimos 30 dias)       │
│  - Syncs por dia                                │
│  - Taxa de sucesso                              │
│  - Volume de dados                              │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  ⚠️ ERRORS (table + pie chart)                  │
│  - Top 10 erros                                 │
│  - Distribuição por tipo                        │
└─────────────────────────────────────────────────┘
```

### Sugestão de Polling
- **Overview/ByType**: Refresh a cada 30-60 segundos
- **Realtime**: Refresh a cada 5 segundos
- **Trends/Performance**: Refresh a cada 5 minutos
- **Schedule**: Refresh a cada 60 segundos

---

## ✅ Status da Implementação

Todas as 7 APIs estão implementadas e prontas para uso:
- ✅ Overview
- ✅ Realtime
- ✅ By Type
- ✅ Errors
- ✅ Performance
- ✅ Trends
- ✅ Schedule

**Autenticação:** Todas requerem Bearer Token
**Rate Limiting:** Aplicado a todas as rotas
**Error Handling:** Completo com AppError
