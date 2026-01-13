# 🔔 Error Notification API - Guia Rápido

## Resumo

Sistema centralizado de notificação de erros por email que captura erros de todos os métodos e envia informações contextuais específicas.

## 📧 Contextos Suportados

| Contexto | Identificador Específico | Exemplo |
|----------|--------------------------|---------|
| **articles** | InternalPartNumber | `ART-12345` |
| **warehouse** | InternalPartNumber | `ART-12345` |
| **orders** | Número da encomenda | `ORD-2024-001` |
| **discountGroup** | ArticleDiscountGroupCode | `DG-001` |
| **discountSubGroup** | DiscountSubGroupCode | `DSG-001` |
| **customers** | CustomerID | `CUST-12345` |

## 🚀 Endpoints

### 1. Enviar Notificação de Erro
```http
POST /api/v1/error-notifications/send
Authorization: Bearer {token}
Content-Type: application/json

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

### 2. Enviar Notificação de Teste
```http
POST /api/v1/error-notifications/test
Authorization: Bearer {token}
```

## 💻 Uso Programático

### Import
```typescript
import { ErrorNotificationService } from '@services/error-notification.service';
```

### Exemplo Básico
```typescript
try {
  // Sua lógica aqui
  await syncArticles();
} catch (error) {
  await ErrorNotificationService.sendErrorNotification({
    context: 'articles',
    method: 'syncArticles',
    error,
    internalPartNumber: 'ART-12345'
  });
  throw error;
}
```

### Exemplos por Contexto

#### Articles
```typescript
await ErrorNotificationService.sendErrorNotification({
  context: 'articles',
  method: 'sendArticlesToTypsForYou',
  error,
  internalPartNumber: 'ART-12345',
  additionalInfo: {
    organizationId: 'org-123',
    brandId: '42'
  }
});
```

#### Warehouse
```typescript
await ErrorNotificationService.sendErrorNotification({
  context: 'warehouse',
  method: 'sendWarehouseToTypsForYou',
  error,
  internalPartNumber: 'ART-12345',
  additionalInfo: {
    warehouseCode: 'WH-01',
    quantity: 100
  }
});
```

#### Orders
```typescript
await ErrorNotificationService.sendErrorNotification({
  context: 'orders',
  method: 'getOrdersFromTypsForYou',
  error,
  orderNumber: 'ORD-2024-001',
  additionalInfo: {
    status: 'pending',
    total: 1500.00
  }
});
```

#### Discount Groups
```typescript
await ErrorNotificationService.sendErrorNotification({
  context: 'discountGroup',
  method: 'sendDiscountGroupsToTypsForYou',
  error,
  articleDiscountGroupCode: 'DG-001'
});
```

#### Discount SubGroups
```typescript
await ErrorNotificationService.sendErrorNotification({
  context: 'discountSubGroup',
  method: 'sendDiscountSubGroupsToTypsForYou',
  error,
  discountSubGroupCode: 'DSG-001'
});
```

#### Customers
```typescript
await ErrorNotificationService.sendErrorNotification({
  context: 'customers',
  method: 'sendCustomersToTypsForYou',
  error,
  customerId: 'CUST-12345'
});
```

## ⚙️ Configuração

### Variáveis de Ambiente (.env)
```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-email@gmail.com
SMTP_PASSWORD=sua-app-password
EMAIL_FROM=noreply@cswmarkets.com

# Destinatários das notificações (separados por vírgula)
ORDER_NOTIFICATION_EMAILS=admin@empresa.com,dev@empresa.com,suporte@empresa.com
```

### Gmail App Password
1. Aceda às definições da conta Google
2. Ative a verificação em 2 passos
3. Vá a "App passwords" (Palavras-passe de aplicações)
4. Gere uma nova password para "Mail"
5. Use essa password na variável `SMTP_PASSWORD`

## 📧 Formato do Email

```
De: noreply@cswmarkets.com
Para: admin@empresa.com, dev@empresa.com
Assunto: ❌ Erro em articles - sendArticlesToTypsForYou

┌───────────────────────────────────┐
│ ❌ Erro no Sistema CSW Markets    │
└───────────────────────────────────┘

Detalhes do Erro
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Contexto: articles
Método: sendArticlesToTypsForYou
Data/Hora: 13/01/2026 14:30:45
InternalPartNumber: ART-12345

Mensagem de Erro
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Failed to upload CSV to TypsForYou API

Informação Adicional
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• organizationId: org-123
• providerConfigId: prov-456
• recordCount: 150

Stack Trace
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Error: Failed to upload CSV
    at ArticleSyncService.sendArticles
    at async sendArticlesToTypsForYou
    ...
```

## 🧪 Testar

### 1. Via CURL
```bash
# Obter token
TOKEN=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@exemplo.com","password":"senha"}' \
  | jq -r '.data.token')

# Enviar teste
curl -X POST http://localhost:3000/api/v1/error-notifications/test \
  -H "Authorization: Bearer $TOKEN"
```

### 2. Via Postman/Insomnia
1. **Login**: POST `{{baseUrl}}/auth/login`
2. **Copiar token** da resposta
3. **Teste**: POST `{{baseUrl}}/error-notifications/test`
   - Header: `Authorization: Bearer {token}`

### 3. Via Código
```typescript
// Qualquer lugar no código
import { ErrorNotificationService } from '@services/error-notification.service';

// Enviar teste
await ErrorNotificationService.sendTestNotification();
```

## ✅ Vantagens

✅ **Centralizado** - Uma API para todos os contextos  
✅ **Automático** - Integra-se facilmente em try/catch existentes  
✅ **Contextual** - Identifica automaticamente o tipo de erro  
✅ **Informativo** - Inclui stack trace e dados adicionais  
✅ **Configurável** - Emails de destino configuráveis  
✅ **Testável** - Endpoint de teste disponível  

## 📝 Notas Importantes

- ⚠️ O serviço **não lança exceções** se o envio de email falhar (evita cascata de erros)
- 📝 Todos os erros de envio são **logados** mas não interrompem o fluxo
- 🔒 Requer **autenticação JWT** para aceder aos endpoints
- 📧 Se `ORDER_NOTIFICATION_EMAILS` não estiver configurado, usa `EMAIL_FROM`

## 🔗 Ver Também

- [ERROR_NOTIFICATION_INTEGRATION.md](./ERROR_NOTIFICATION_INTEGRATION.md) - Guia completo de integração
- [API_ROUTES_SUMMARY.md](./API_ROUTES_SUMMARY.md) - Todas as rotas da API
