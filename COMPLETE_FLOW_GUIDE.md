# 🚀 Guia Completo: Cliente + Organização Provider

## ✅ O Que Foi Implementado

### **1. Organizations Module**
- Tipos: MARKETPLACE, PROVIDER, PARTNER, CLIENT
- Roles: OWNER, ADMIN, MANAGER, MEMBER, VIEWER
- Sistema de convites com tokens
- Soft delete

### **2. ProviderConfig Module**
- Configuração de APIs por provider (Worten, FNAC, Temu)
- Encriptação AES-256-GCM para credentials
- Auth types: API_KEY, OAUTH2, BASIC, BEARER, CUSTOM
- Rate limiting, webhooks, field mappings

### **3. ClientProviderConnection Module**
- Conecta clientes a providers
- Sync settings (products, orders, stock, prices)
- Sync status tracking
- Cross-provider view para ver todas conexões de um cliente

---

## 📋 Endpoints Disponíveis

### **Organizations** (`/api/v1/organizations`)
```
POST   /                              - Criar organização
GET    /                              - Listar organizações
GET    /slug/:slug                    - Buscar por slug
GET    /:id                           - Buscar por ID
PUT    /:id                           - Atualizar
DELETE /:id                           - Deletar (soft)
POST   /:id/members/invite            - Convidar membro
POST   /invites/:token/accept         - Aceitar convite
PUT    /:id/members/:memberId/role    - Atualizar role de membro
DELETE /:id/members/:memberId         - Remover membro
POST   /:id/leave                     - Sair da organização
```

### **ProviderConfig** (`/api/v1/provider-configs`)
```
POST   /                                      - Criar config
GET    /organization/:organizationId          - Buscar config
PUT    /organization/:organizationId          - Atualizar config
DELETE /organization/:organizationId          - Deletar config
POST   /organization/:organizationId/test     - Testar conexão
POST   /organization/:organizationId/refresh-token - Refresh OAuth
```

### **ClientProviderConnection** (`/api/v1/client-provider-connections`)
```
POST   /                              - Conectar cliente a provider
GET    /                              - Listar conexões (filtros)
GET    /client/:clientOrgId           - Ver todas conexões de um cliente
GET    /:id                           - Buscar conexão por ID
PUT    /:id                           - Atualizar conexão
PUT    /:id/sync-status               - Atualizar status de sync
POST   /:id/disconnect                - Desconectar (soft)
DELETE /:id                           - Deletar permanentemente
```

---

## 🎯 Fluxo Completo de Teste

### **Passo 1: Criar Provider (Worten)**

```bash
POST http://localhost:4000/api/v1/organizations
Authorization: Bearer {SEU_TOKEN}
Content-Type: application/json

{
  "name": "Worten",
  "slug": "worten",
  "type": "PROVIDER",
  "email": "comercial@worten.pt",
  "phone": "+351210104200",
  "website": "https://www.worten.pt",
  "description": "Maior retalhista de eletrónica em Portugal",
  "settings": {
    "currency": "EUR",
    "language": "pt",
    "timezone": "Europe/Lisbon"
  }
}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-worten",
    "name": "Worten",
    "slug": "worten",
    "type": "PROVIDER",
    ...
  }
}
```

---

### **Passo 2: Configurar API da Worten**

```bash
POST http://localhost:4000/api/v1/provider-configs
Authorization: Bearer {SEU_TOKEN}
Content-Type: application/json

{
  "organizationId": "uuid-worten",
  "apiUrl": "https://api.worten.pt/v1",
  "authType": "API_KEY",
  "apiKey": "worten_api_key_12345",
  "apiSecret": "worten_secret_xyz",
  "webhookUrl": "https://csw-markets.pt/webhooks/worten",
  "webhookSecret": "webhook_secret_abc",
  "webhookEvents": ["order.created", "product.updated", "stock.changed"],
  "rateLimit": 120,
  "rateLimitWindow": 60,
  "fieldMappings": {
    "product_id": "sku",
    "product_name": "title",
    "product_price": "price"
  },
  "settings": {
    "autoSync": true,
    "syncInterval": 3600,
    "categories": ["electronics", "appliances"]
  }
}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "id": "config-uuid",
    "organizationId": "uuid-worten",
    "apiUrl": "https://api.worten.pt/v1",
    "hasApiKey": true,
    "hasApiSecret": true,
    "hasWebhookSecret": true,
    ...
  }
}
```

> ⚠️ **Nota:** Credentials nunca são retornadas na resposta (encriptadas no DB)

---

### **Passo 3: Testar Conexão com Worten**

```bash
POST http://localhost:4000/api/v1/provider-configs/organization/uuid-worten/test
Authorization: Bearer {SEU_TOKEN}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "status": 200,
    "message": "Connection successful",
    "timestamp": "2025-11-15T23:00:00.000Z"
  }
}
```

---

### **Passo 4: Criar Cliente (Loja XYZ)**

```bash
POST http://localhost:4000/api/v1/organizations
Authorization: Bearer {SEU_TOKEN}
Content-Type: application/json

{
  "name": "Loja XYZ",
  "slug": "loja-xyz",
  "type": "CLIENT",
  "email": "contato@lojaxyz.pt",
  "phone": "+351912345678",
  "website": "https://lojaxyz.pt",
  "description": "Loja de eletrónicos online",
  "settings": {
    "businessType": "ecommerce",
    "categories": ["electronics", "computers", "mobile"]
  }
}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-loja-xyz",
    "name": "Loja XYZ",
    "slug": "loja-xyz",
    "type": "CLIENT",
    ...
  }
}
```

---

### **Passo 5: Conectar Loja XYZ à Worten**

```bash
POST http://localhost:4000/api/v1/client-provider-connections
Authorization: Bearer {SEU_TOKEN}
Content-Type: application/json

{
  "clientOrgId": "uuid-loja-xyz",
  "providerOrgId": "uuid-worten",
  "merchantId": "WORTEN_MERCHANT_12345",
  "storeId": "STORE_XYZ_001",
  "credentials": {
    "apiToken": "xyz_token_worten",
    "storeName": "Loja XYZ - Worten"
  },
  "syncSettings": {
    "syncProducts": true,
    "syncOrders": true,
    "syncStock": true,
    "syncPrices": true
  },
  "syncFrequency": 1800,
  "settings": {
    "priceMarkup": 1.15,
    "autoPublish": true,
    "minStock": 5
  }
}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "id": "connection-uuid",
    "clientOrgId": "uuid-loja-xyz",
    "providerOrgId": "uuid-worten",
    "merchantId": "WORTEN_MERCHANT_12345",
    "storeId": "STORE_XYZ_001",
    "isActive": true,
    "isVerified": false,
    "clientOrg": {
      "id": "uuid-loja-xyz",
      "name": "Loja XYZ",
      "slug": "loja-xyz",
      "type": "CLIENT"
    },
    "providerOrg": {
      "id": "uuid-worten",
      "name": "Worten",
      "slug": "worten",
      "type": "PROVIDER"
    },
    "connectedAt": "2025-11-15T23:00:00.000Z"
  },
  "message": "Connection created successfully"
}
```

---

### **Passo 6: Ver Todas Conexões da Loja XYZ (Cross-Provider)**

```bash
GET http://localhost:4000/api/v1/client-provider-connections/client/uuid-loja-xyz
Authorization: Bearer {SEU_TOKEN}
```

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "connection-uuid",
      "clientOrgId": "uuid-loja-xyz",
      "providerOrgId": "uuid-worten",
      "merchantId": "WORTEN_MERCHANT_12345",
      "providerOrg": {
        "id": "uuid-worten",
        "name": "Worten",
        "slug": "worten",
        "type": "PROVIDER",
        "logoUrl": null
      },
      "isActive": true,
      "lastSyncAt": null,
      "totalOrders": 0,
      "totalProducts": 0,
      "totalRevenue": 0
    }
  ],
  "meta": {
    "total": 1
  }
}
```

---

### **Passo 7: Atualizar Status de Sync**

```bash
PUT http://localhost:4000/api/v1/client-provider-connections/connection-uuid/sync-status
Authorization: Bearer {SEU_TOKEN}
Content-Type: application/json

{
  "lastSyncStatus": "SUCCESS",
  "totalProducts": 150,
  "totalOrders": 25,
  "totalRevenue": 12500.50
}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "id": "connection-uuid",
    "lastSyncAt": "2025-11-15T23:05:00.000Z",
    "lastSyncStatus": "SUCCESS",
    "totalProducts": 150,
    "totalOrders": 25,
    "totalRevenue": 12500.50,
    ...
  },
  "message": "Sync status updated"
}
```

---

## 🎨 Cenários de Uso

### **Cenário 1: Loja vende em múltiplos marketplaces**
```
Loja XYZ (CLIENT)
  ├─ Conectada à Worten (150 produtos, 25 pedidos)
  ├─ Conectada à FNAC (200 produtos, 30 pedidos)
  └─ Conectada à Temu (500 produtos, 100 pedidos)

# Um único endpoint mostra tudo:
GET /api/v1/client-provider-connections/client/uuid-loja-xyz
```

### **Cenário 2: Responsável da Loja vê todas operações**
```
# Audit logs cross-organization (TODO: implementar)
GET /api/v1/audit-logs/client/uuid-loja-xyz

# Retorna logs de:
# - Sync Worten: 2025-11-15 22:00 - SUCCESS
# - Sync FNAC: 2025-11-15 22:05 - SUCCESS
# - Sync Temu: 2025-11-15 22:10 - FAILED (rate limit)
```

---

## 🔐 Segurança

✅ **Credentials encriptadas** - AES-256-GCM  
✅ **Permissões por role** - OWNER/ADMIN para configs  
✅ **Audit logs** - Todas operações registadas  
✅ **Isolation** - Cada client só vê seus dados  
✅ **Soft delete** - Dados nunca apagados fisicamente  

---

## 📊 Próximos Passos

1. ✅ **Criar providers** (Worten, FNAC, Temu)
2. ✅ **Configurar APIs** com credentials
3. ✅ **Criar clientes**
4. ✅ **Conectar clientes a providers**
5. 🔨 **Implementar sync real** (produtos, pedidos, stock)
6. 🔨 **Cross-org audit logs**
7. 🔨 **Dashboard analytics** por cliente

---

## ⚡ Quick Test

```bash
# 1. Login
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"pedro.cardoso@comsoftweb.pt","password":"sua_senha"}'

# Copiar token da resposta

# 2. Criar Worten
curl -X POST http://localhost:4000/api/v1/organizations \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Worten","slug":"worten","type":"PROVIDER","email":"comercial@worten.pt"}'

# 3. Criar Cliente
curl -X POST http://localhost:4000/api/v1/organizations \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Loja XYZ","slug":"loja-xyz","type":"CLIENT","email":"contato@lojaxyz.pt"}'

# 4. Conectar
curl -X POST http://localhost:4000/api/v1/client-provider-connections \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"clientOrgId":"CLIENT_ID","providerOrgId":"PROVIDER_ID","merchantId":"MERCHANT_123"}'
```

---

**Tudo pronto para começar! 🚀**
