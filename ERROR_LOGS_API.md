# 📊 API de Consulta de Logs de Erro

## ✅ Sistema Instalado com Sucesso!

A tabela `error_notification_logs` foi **adicionada com sucesso** à base de dados.  
**✅ TODOS os seus dados existentes estão intactos e seguros!**

---

## 🎯 Funcionalidades

### 1️⃣ **Logs Guardados Automaticamente**
Quando ocorre um erro e é enviada uma notificação por email, o sistema:
- ✅ Guarda automaticamente o log na base de dados
- ✅ Regista se o email foi enviado com sucesso
- ✅ Guarda toda a informação contextual (método, erro, stack trace, etc.)

### 2️⃣ **API Completa de Consulta**
Endpoints disponíveis para consultar e gerir os logs de erro.

---

## 📡 Endpoints da API

### 1. **Listar Todos os Logs** (com filtros e paginação)
```http
GET /api/v1/error-notifications
Authorization: Bearer {token}
```

**Query Parameters:**
```
page=1              # Página (default: 1)
limit=50            # Items por página (default: 50)
context=articles    # Filtrar por contexto (articles, warehouse, orders, etc.)
method=syncArticles # Filtrar por método
emailSent=true      # Filtrar por status de email (true/false)
startDate=2026-01-01T00:00:00Z  # Data inicial
endDate=2026-01-13T23:59:59Z    # Data final
search=ART-12345    # Pesquisar em mensagens ou identificadores
```

**Exemplo:**
```bash
curl "http://localhost:4000/api/v1/error-notifications?context=articles&limit=20" \
  -H "Authorization: Bearer SEU_TOKEN"
```

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-123",
      "context": "articles",
      "method": "sendArticlesToTypsForYou",
      "errorMessage": "Failed to upload CSV",
      "errorStack": "Error: Failed...",
      "internalPartNumber": "ART-12345",
      "additionalInfo": { "organizationId": "org-123" },
      "emailSent": true,
      "emailSentAt": "2026-01-13T10:30:00Z",
      "emailRecipients": ["admin@empresa.com"],
      "createdAt": "2026-01-13T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

### 2. **Ver Detalhes de um Log Específico**
```http
GET /api/v1/error-notifications/{id}
Authorization: Bearer {token}
```

**Exemplo:**
```bash
curl "http://localhost:4000/api/v1/error-notifications/uuid-123" \
  -H "Authorization: Bearer SEU_TOKEN"
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-123",
    "context": "orders",
    "method": "getOrdersFromTypsForYou",
    "errorMessage": "Connection timeout",
    "errorStack": "Error: Connection timeout\n  at ...",
    "orderNumber": "ORD-2024-001",
    "additionalInfo": {
      "organizationId": "org-123",
      "providerConfigId": "prov-456",
      "retryCount": 3
    },
    "emailSent": true,
    "emailSentAt": "2026-01-13T14:25:00Z",
    "emailRecipients": ["admin@empresa.com", "dev@empresa.com"],
    "emailError": null,
    "createdAt": "2026-01-13T14:25:00Z"
  }
}
```

---

### 3. **Estatísticas de Erros**
```http
GET /api/v1/error-notifications/stats/summary?days=7
Authorization: Bearer {token}
```

**Query Parameters:**
```
days=7  # Número de dias para incluir nas estatísticas (default: 7)
```

**Exemplo:**
```bash
curl "http://localhost:4000/api/v1/error-notifications/stats/summary?days=30" \
  -H "Authorization: Bearer SEU_TOKEN"
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "period": {
      "days": 30,
      "startDate": "2025-12-14T00:00:00Z",
      "endDate": "2026-01-13T23:59:59Z"
    },
    "totals": {
      "total": 156,
      "emailSent": 148,
      "emailFailed": 8,
      "emailSuccessRate": "94.87"
    },
    "byContext": [
      { "context": "articles", "count": 45 },
      { "context": "warehouse", "count": 32 },
      { "context": "orders", "count": 28 },
      { "context": "discountGroup", "count": 15 },
      { "context": "customers", "count": 12 }
    ],
    "topMethods": [
      { "method": "sendArticlesToTypsForYou", "count": 25 },
      { "method": "sendWarehouseToTypsForYou", "count": 18 },
      { "method": "getOrdersFromTypsForYou", "count": 12 }
    ],
    "recentErrors": [
      {
        "id": "uuid-123",
        "context": "articles",
        "method": "sendArticlesToTypsForYou",
        "errorMessage": "Connection timeout",
        "createdAt": "2026-01-13T14:30:00Z",
        "emailSent": true
      }
    ]
  }
}
```

---

### 4. **Apagar um Log**
```http
DELETE /api/v1/error-notifications/{id}
Authorization: Bearer {token}
```

**Exemplo:**
```bash
curl -X DELETE "http://localhost:4000/api/v1/error-notifications/uuid-123" \
  -H "Authorization: Bearer SEU_TOKEN"
```

**Resposta:**
```json
{
  "success": true,
  "message": "Error log deleted successfully"
}
```

---

### 5. **Apagar Múltiplos Logs (Bulk Delete)**
```http
DELETE /api/v1/error-notifications/bulk/delete
Authorization: Bearer {token}
Content-Type: application/json
```

**Opção 1: Apagar por IDs**
```json
{
  "ids": ["uuid-123", "uuid-456", "uuid-789"]
}
```

**Opção 2: Apagar logs antigos**
```json
{
  "olderThan": "2025-12-01T00:00:00Z"
}
```

**Exemplo:**
```bash
# Apagar logs com mais de 90 dias
curl -X DELETE "http://localhost:4000/api/v1/error-notifications/bulk/delete" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"olderThan": "2025-10-15T00:00:00Z"}'
```

**Resposta:**
```json
{
  "success": true,
  "message": "Deleted 45 error log(s)",
  "deletedCount": 45
}
```

---

### 6. **Enviar Notificação Manual**
```http
POST /api/v1/error-notifications/send
Authorization: Bearer {token}
Content-Type: application/json
```

**Body:**
```json
{
  "context": "articles",
  "method": "sendArticlesToTypsForYou",
  "errorMessage": "Failed to upload CSV",
  "errorStack": "Error: Failed...\n  at ...",
  "internalPartNumber": "ART-12345",
  "additionalInfo": {
    "organizationId": "org-123",
    "recordCount": 150
  }
}
```

---

### 7. **Enviar Notificação de Teste**
```http
POST /api/v1/error-notifications/test
Authorization: Bearer {token}
```

---

## 🔍 Exemplos de Consulta por Contexto

### Ver erros de Articles
```bash
curl "http://localhost:4000/api/v1/error-notifications?context=articles" \
  -H "Authorization: Bearer SEU_TOKEN"
```

### Ver erros de Orders nos últimos 7 dias
```bash
curl "http://localhost:4000/api/v1/error-notifications?context=orders&startDate=2026-01-06T00:00:00Z" \
  -H "Authorization: Bearer SEU_TOKEN"
```

### Pesquisar por InternalPartNumber
```bash
curl "http://localhost:4000/api/v1/error-notifications?search=ART-12345" \
  -H "Authorization: Bearer SEU_TOKEN"
```

### Ver emails que falharam
```bash
curl "http://localhost:4000/api/v1/error-notifications?emailSent=false" \
  -H "Authorization: Bearer SEU_TOKEN"
```

### Ver erros de um método específico
```bash
curl "http://localhost:4000/api/v1/error-notifications?method=sendArticlesToTypsForYou" \
  -H "Authorization: Bearer SEU_TOKEN"
```

---

## 📊 Campos Disponíveis no Log

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | string | ID único do log |
| `context` | enum | Contexto do erro (articles, warehouse, orders, etc.) |
| `method` | string | Nome do método onde ocorreu o erro |
| `errorMessage` | string | Mensagem de erro |
| `errorStack` | string | Stack trace completo |
| `internalPartNumber` | string | InternalPartNumber (para articles/warehouse) |
| `orderNumber` | string | Número da encomenda (para orders) |
| `articleDiscountGroupCode` | string | Código do grupo (para discountGroup) |
| `discountSubGroupCode` | string | Código do subgrupo (para discountSubGroup) |
| `customerId` | string | ID do cliente (para customers) |
| `additionalInfo` | json | Informação adicional customizada |
| `emailSent` | boolean | Se o email foi enviado com sucesso |
| `emailSentAt` | datetime | Data/hora do envio do email |
| `emailRecipients` | array | Lista de destinatários do email |
| `emailError` | string | Erro no envio do email (se houver) |
| `createdAt` | datetime | Data/hora de criação do log |

---

## 🎯 Casos de Uso

### 1. Dashboard de Monitorização
```javascript
// Obter estatísticas dos últimos 7 dias
const stats = await fetch('/api/v1/error-notifications/stats/summary?days=7');
// Mostrar gráficos de erros por contexto, métodos mais problemáticos, etc.
```

### 2. Alertas e Notificações
```javascript
// Verificar se há muitos erros recentes
const recent = await fetch('/api/v1/error-notifications?limit=10');
if (recent.data.length > 5) {
  // Enviar alerta ao administrador
}
```

### 3. Debugging e Troubleshooting
```javascript
// Pesquisar todos os erros relacionados a um artigo específico
const logs = await fetch('/api/v1/error-notifications?search=ART-12345');
// Analisar stack traces e informação adicional
```

### 4. Limpeza de Logs Antigos (Cron Job)
```javascript
// Apagar logs com mais de 90 dias
await fetch('/api/v1/error-notifications/bulk/delete', {
  method: 'DELETE',
  body: JSON.stringify({
    olderThan: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  })
});
```

---

## 🚀 Como Iniciar

1. **Reiniciar o servidor:**
```bash
pnpm dev
```

2. **Autenticar:**
```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@exemplo.com","password":"senha"}'
```

3. **Testar o sistema:**
```bash
# Enviar notificação de teste
curl -X POST http://localhost:4000/api/v1/error-notifications/test \
  -H "Authorization: Bearer SEU_TOKEN"

# Ver o log criado
curl http://localhost:4000/api/v1/error-notifications \
  -H "Authorization: Bearer SEU_TOKEN"
```

---

## ✅ Benefícios

✅ **Histórico completo** de todos os erros  
✅ **Pesquisa avançada** com múltiplos filtros  
✅ **Estatísticas** para análise de tendências  
✅ **Rastreabilidade** - cada erro está ligado ao contexto específico  
✅ **Debugging facilitado** - stack traces e informação adicional guardados  
✅ **Auditoria** - saber quando emails foram enviados e para quem  
✅ **Gestão de logs** - apagar logs antigos ou específicos  

---

## 📝 Nota Importante

**✅ Os seus dados existentes estão 100% seguros!**

A migração apenas **ADICIONOU** uma nova tabela (`error_notification_logs`).  
Nenhum dado existente foi modificado ou removido.
