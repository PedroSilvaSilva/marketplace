# Notification Settings API

Sistema de configuração de notificações por email para sincronizações.

## Endpoints

### GET /api/v1/notification-settings
Obter configurações de notificação (global ou por organização)

Query Parameters:
- `organizationId` (opcional): ID da organização. Se omitido, retorna configurações globais.

Response:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "organizationId": "uuid-or-null",
    "notifyOnSuccess": false,
    "notifyOnError": true,
    "notifyOnPartial": true,
    "emailRecipients": ["email@example.com"],
    "syncTypes": ["ARTICLES", "CUSTOMERS"],
    "createdAt": "2026-01-13T...",
    "updatedAt": "2026-01-13T..."
  }
}
```

### PUT /api/v1/notification-settings
Atualizar configurações de notificação

Request Body:
```json
{
  "organizationId": "uuid-or-null",
  "notifyOnSuccess": false,
  "notifyOnError": true,
  "notifyOnPartial": true,
  "emailRecipients": ["pedro.cardoso@comsoftweb.pt"],
  "syncTypes": ["ARTICLES", "CUSTOMERS"]
}
```

Campos:
- `organizationId`: null para configurações globais, UUID para específicas de organização
- `notifyOnSuccess`: Enviar email quando sync termina com sucesso
- `notifyOnError`: Enviar email quando sync falha completamente
- `notifyOnPartial`: Enviar email quando sync termina parcialmente (alguns registros falharam)
- `emailRecipients`: Array de emails para receber notificações
- `syncTypes`: Array de tipos de sync para notificar (vazio = todos). Valores: `ARTICLES`, `WAREHOUSE`, `ORDERS`, `CUSTOMERS`, `CUSTOMER_DISCOUNT_GROUPS`, `CUSTOMER_WAREHOUSES`, `DISCOUNT_GROUPS`, `DISCOUNT_SUBGROUPS`

### DELETE /api/v1/notification-settings/:organizationId
Deletar configurações específicas de organização (reverte para global)

## Prioridade

1. Se existir configuração para a organização, usa ela
2. Caso contrário, usa configuração global (organizationId = null)
3. Se não existir nenhuma, usa valores padrão do código

## Configuração Padrão

Por padrão:
- ✅ `notifyOnError`: true - Envia email em caso de erro
- ✅ `notifyOnPartial`: true - Envia email em caso de sucesso parcial
- ❌ `notifyOnSuccess`: false - NÃO envia email em caso de sucesso total
- Emails: Lê de `ORDER_NOTIFICATION_EMAILS` do .env

## Exemplos

### Desabilitar notificações de sucesso (apenas erros)
```bash
curl -X PUT http://localhost:4000/api/v1/notification-settings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "organizationId": null,
    "notifyOnSuccess": false,
    "notifyOnError": true,
    "notifyOnPartial": true,
    "emailRecipients": ["pedro.cardoso@comsoftweb.pt"]
  }'
```

### Notificar apenas para customers
```bash
curl -X PUT http://localhost:4000/api/v1/notification-settings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "organizationId": "org-uuid",
    "notifyOnSuccess": false,
    "notifyOnError": true,
    "emailRecipients": ["pedro.cardoso@comsoftweb.pt"],
    "syncTypes": ["CUSTOMERS", "CUSTOMER_DISCOUNT_GROUPS", "CUSTOMER_WAREHOUSES"]
  }'
```
