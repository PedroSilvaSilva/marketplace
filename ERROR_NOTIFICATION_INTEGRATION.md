# Integração do Error Notification Service

Este documento mostra como integrar o `ErrorNotificationService` nos serviços existentes.

## Instalação

O serviço já foi criado e integrado no projeto. A rota está disponível em:

```
POST /api/v1/error-notifications/send
POST /api/v1/error-notifications/test
```

## Configuração de Email

Certifique-se de que as variáveis de ambiente estão configuradas no `.env`:

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-email@gmail.com
SMTP_PASSWORD=sua-senha-app
EMAIL_FROM=noreply@cswmarkets.com

# Emails para receber notificações de erro (separados por vírgula)
ORDER_NOTIFICATION_EMAILS=admin@empresa.com,dev@empresa.com
```

## Como Integrar nos Serviços

### 1. Import do Serviço

```typescript
import { ErrorNotificationService } from '@services/error-notification.service';
```

### 2. Exemplo: Articles Service

```typescript
// src/modules/sync/services/article-sync.service.ts
import { ErrorNotificationService } from '@services/error-notification.service';

export class ArticleSyncService {
  static async sendArticlesToTypsForYou(
    organizationId: string,
    providerConfigId: string,
    options?: { ... }
  ) {
    try {
      // ... lógica existente ...
      
      const csvResult = await this.generateArticlesCsv(organizationId, options);
      const client = new Typs4YouClient(providerConfigId);
      const response = await client.uploadArticlesCsv(csvResult.csv);
      
      // ... resto da lógica ...
      
    } catch (error) {
      logger.error('Failed to send articles:', error);
      
      // 🔥 ENVIAR NOTIFICAÇÃO DE ERRO
      await ErrorNotificationService.sendErrorNotification({
        context: 'articles',
        method: 'sendArticlesToTypsForYou',
        error,
        internalPartNumber: options?.lastProcessedId || 'N/A',
        additionalInfo: {
          organizationId,
          providerConfigId,
          limit: options?.limit,
          brandId: options?.brandId
        }
      });
      
      throw error;
    }
  }
}
```

### 3. Exemplo: Warehouse Service

```typescript
// src/modules/sync/services/article-warehouse-sync.service.ts
import { ErrorNotificationService } from '@services/error-notification.service';

export class ArticleWarehouseSyncService {
  static async sendArticleWarehouseToTypsForYou(
    organizationId: string,
    providerConfigId: string,
    options?: { ... }
  ) {
    try {
      // ... lógica existente ...
      
      const result = await SQLService.getArticleWarehouse(organizationId, options);
      const client = new Typs4YouClient(providerConfigId);
      const response = await client.uploadArticleWarehouseCsv(csv);
      
      if (response.ExitCode !== '200') {
        throw new Error(`API returned error: ${response.ExitMesssage}`);
      }
      
    } catch (error) {
      logger.error('Failed to send warehouse data:', error);
      
      // 🔥 ENVIAR NOTIFICAÇÃO DE ERRO
      await ErrorNotificationService.sendErrorNotification({
        context: 'warehouse',
        method: 'sendArticleWarehouseToTypsForYou',
        error,
        internalPartNumber: result?.data?.[0]?.InternalPartNumber || 'N/A',
        additionalInfo: {
          organizationId,
          providerConfigId,
          warehouseCode: options?.warehouseCode,
          recordCount: result?.data?.length
        }
      });
      
      throw error;
    }
  }
}
```

### 4. Exemplo: Orders Service

```typescript
// src/modules/sync/services/order-sync.service.ts
import { ErrorNotificationService } from '@services/error-notification.service';

export class OrderSyncService {
  static async getOrdersFromTypsForYou(
    organizationId: string,
    providerConfigId: string,
    orderId?: string
  ) {
    try {
      // ... lógica existente ...
      
      const client = new Typs4YouClient(providerConfigId);
      const response = await client.getOrders({ orderId });
      
      return { success: true, orders: response.Orders_Table };
      
    } catch (error) {
      logger.error('Failed to fetch orders:', error);
      
      // 🔥 ENVIAR NOTIFICAÇÃO DE ERRO
      await ErrorNotificationService.sendErrorNotification({
        context: 'orders',
        method: 'getOrdersFromTypsForYou',
        error,
        orderNumber: orderId || 'ALL',
        additionalInfo: {
          organizationId,
          providerConfigId
        }
      });
      
      throw error;
    }
  }
}
```

### 5. Exemplo: Discount Group Service

```typescript
// src/modules/sync/services/discount-group-sync.service.ts
import { ErrorNotificationService } from '@services/error-notification.service';

export class DiscountGroupSyncService {
  static async sendDiscountGroupsToTypsForYou(
    organizationId: string,
    providerConfigId: string,
    options?: { ... }
  ) {
    try {
      // ... lógica existente ...
      
      const { csv, count } = await this.generateDiscountGroupsCsv(organizationId, options);
      const client = new Typs4YouClient(providerConfigId);
      const apiResponse = await client.uploadDiscountGroupsCsv(csv);
      
      return { success: true, sent: count };
      
    } catch (error) {
      logger.error('Failed to send discount groups:', error);
      
      // 🔥 ENVIAR NOTIFICAÇÃO DE ERRO
      await ErrorNotificationService.sendErrorNotification({
        context: 'discountGroup',
        method: 'sendDiscountGroupsToTypsForYou',
        error,
        articleDiscountGroupCode: options?.search || 'N/A',
        additionalInfo: {
          organizationId,
          providerConfigId,
          limit: options?.limit
        }
      });
      
      throw error;
    }
  }
}
```

### 6. Exemplo: Discount SubGroup Service

```typescript
// src/modules/sync/services/discount-subgroup-sync.service.ts
import { ErrorNotificationService } from '@services/error-notification.service';

export class DiscountSubGroupSyncService {
  static async sendDiscountSubGroupsToTypsForYou(
    organizationId: string,
    providerConfigId: string,
    options?: { ... }
  ) {
    try {
      // ... lógica existente ...
      
      const { csv, count } = await this.generateDiscountSubGroupsCsv(organizationId, options);
      const client = new Typs4YouClient(providerConfigId);
      const apiResponse = await client.uploadDiscountSubGroupsCsv(csv);
      
      return { success: true, sent: count };
      
    } catch (error) {
      logger.error('Failed to send discount sub-groups:', error);
      
      // 🔥 ENVIAR NOTIFICAÇÃO DE ERRO
      await ErrorNotificationService.sendErrorNotification({
        context: 'discountSubGroup',
        method: 'sendDiscountSubGroupsToTypsForYou',
        error,
        discountSubGroupCode: options?.search || 'N/A',
        additionalInfo: {
          organizationId,
          providerConfigId,
          groupCode: options?.groupCode,
          limit: options?.limit
        }
      });
      
      throw error;
    }
  }
}
```

### 7. Exemplo: Customer Service

```typescript
// src/modules/sync/services/customer-sync.service.ts
import { ErrorNotificationService } from '@services/error-notification.service';

export class CustomerSyncService {
  static async sendCustomersToTypsForYou(
    organizationId: string,
    providerConfigId: string,
    options?: { customerId?: string }
  ) {
    try {
      // ... lógica existente ...
      
      const customers = await SQLService.getCustomers(organizationId, options?.customerId);
      const client = new Typs4YouClient(providerConfigId);
      const response = await client.uploadCustomersCsv(csv);
      
      return { success: true, sent: customers.length };
      
    } catch (error) {
      logger.error('Failed to send customers:', error);
      
      // 🔥 ENVIAR NOTIFICAÇÃO DE ERRO
      await ErrorNotificationService.sendErrorNotification({
        context: 'customers',
        method: 'sendCustomersToTypsForYou',
        error,
        customerId: options?.customerId || 'ALL',
        additionalInfo: {
          organizationId,
          providerConfigId
        }
      });
      
      throw error;
    }
  }
}
```

## Teste da Funcionalidade

### 1. Testar com Endpoint de Teste

```bash
# Autenticar primeiro
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@exemplo.com", "password": "suasenha"}'

# Enviar notificação de teste
curl -X POST http://localhost:3000/api/v1/error-notifications/test \
  -H "Authorization: Bearer SEU_TOKEN_JWT"
```

### 2. Testar com Endpoint Customizado

```bash
curl -X POST http://localhost:3000/api/v1/error-notifications/send \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "context": "articles",
    "method": "sendArticlesToTypsForYou",
    "errorMessage": "Failed to upload articles CSV",
    "errorStack": "Error: Failed to upload articles CSV\n    at ArticleSyncService.sendArticlesToTypsForYou (article-sync.service.ts:150:15)",
    "internalPartNumber": "ART-12345",
    "additionalInfo": {
      "organizationId": "org-123",
      "providerConfigId": "prov-456",
      "recordCount": 150
    }
  }'
```

## Contextos Disponíveis

- `articles` - InternalPartNumber
- `warehouse` - InternalPartNumber
- `orders` - Número da encomenda (orderNumber)
- `discountGroup` - ArticleDiscountGroupCode
- `discountSubGroup` - DiscountSubGroupCode
- `customers` - CustomerID
- `customerDiscountGroup` - CustomerID
- `customerWarehouse` - CustomerID

## Email de Exemplo

O email enviado terá o seguinte formato:

```
Assunto: ❌ Erro em articles - sendArticlesToTypsForYou

Corpo:
┌─────────────────────────────────────────┐
│ ❌ Erro no Sistema CSW Markets          │
└─────────────────────────────────────────┘

Detalhes do Erro
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Contexto: articles
Método: sendArticlesToTypsForYou
Data/Hora: 13/01/2026 10:30:45
InternalPartNumber: ART-12345

Mensagem de Erro
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Failed to upload articles CSV

Informação Adicional
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• organizationId: org-123
• providerConfigId: prov-456
• recordCount: 150

Stack Trace
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Error: Failed to upload articles CSV
    at ArticleSyncService.sendArticlesToTypsForYou
    ...
```

## API Unificada

Sim, podemos ter tudo numa API! O serviço `ErrorNotificationService` está disponível em todos os contextos e pode ser chamado de qualquer lugar do código.

### Vantagens:

✅ **Centralizado**: Um único serviço para todas as notificações  
✅ **Consistente**: Formato de email padronizado  
✅ **Configurável**: Emails de destino configuráveis via .env  
✅ **Automático**: Pode ser integrado em todos os métodos de sincronização  
✅ **Testável**: Endpoint de teste disponível  
✅ **Contextual**: Identifica automaticamente o contexto (articles, orders, etc.)  

### Como usar:

```typescript
// Em qualquer serviço
try {
  // ... sua lógica ...
} catch (error) {
  await ErrorNotificationService.sendErrorNotification({
    context: 'articles',  // ou warehouse, orders, etc.
    method: 'nomeDoMetodo',
    error,
    internalPartNumber: 'ART-123',  // contexto específico
    additionalInfo: { /* dados extras */ }
  });
  throw error;
}
```
