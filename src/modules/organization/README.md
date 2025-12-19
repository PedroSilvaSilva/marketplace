# 🏢 Organizations API - Marketplace System

Sistema completo de gestão de organizações multi-tenant para marketplace (Worten, FNAC, Temu, etc).

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Estrutura de Dados](#estrutura-de-dados)
- [Endpoints](#endpoints)
- [Permissões e Roles](#permissões-e-roles)
- [Sistema de Convites](#sistema-de-convites)
- [Exemplos de Uso](#exemplos-de-uso)

---

## 🎯 Visão Geral

O módulo de **Organizations** permite:

- ✅ Criar organizações (Marketplaces/Providers/Partners/Clients)
- ✅ Multi-tenancy com isolamento de dados
- ✅ Sistema de membros com roles hierárquicos
- ✅ Convites por email com tokens
- ✅ Gestão de permissões por role
- ✅ Audit logs de todas as operações
- ✅ Soft delete de organizações

---

## 📊 Estrutura de Dados

### Organization Types

```typescript
enum OrganizationType {
  MARKETPLACE  // Ex: Worten, FNAC, Temu
  PROVIDER     // Fornecedores de produtos/serviços
  PARTNER      // Parceiros de negócio
  CLIENT       // Clientes corporativos
}
```

### Organization Roles

```typescript
enum OrganizationRole {
  OWNER        // Controlo total, pode deletar org
  ADMIN        // Gestão completa, menos delete
  MANAGER      // Gestão de membros e configurações
  MEMBER       // Acesso normal às features
  VIEWER       // Apenas visualização
}
```

### Organization Schema

```typescript
{
  id: string;
  name: string;
  slug: string;              // URL-friendly (ex: "worten")
  description?: string;
  type: OrganizationType;
  
  // Contactos
  email: string;
  phone?: string;
  website?: string;
  logoUrl?: string;
  
  // Status
  isActive: boolean;
  deletedAt?: Date;
  
  // Configurações e metadata flexíveis
  settings: Json;            // Configurações específicas
  metadata: Json;            // Dados adicionais
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Relações
  members: OrganizationMember[];
}
```

### Organization Member Schema

```typescript
{
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  
  // Sistema de convites
  invitedBy?: string;
  inviteToken?: string;
  inviteExpires?: Date;
  inviteAcceptedAt?: Date;
  
  // Status
  isActive: boolean;
  joinedAt: Date;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 🔌 Endpoints

### 1. Criar Organização

```http
POST /api/v1/organizations
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Worten",
  "slug": "worten",
  "description": "Maior retalhista de eletrónica em Portugal",
  "type": "MARKETPLACE",
  "email": "info@worten.pt",
  "phone": "+351 707 505 505",
  "website": "https://www.worten.pt",
  "logoUrl": "https://cdn.worten.pt/logo.png",
  "settings": {
    "currency": "EUR",
    "language": "pt",
    "timezone": "Europe/Lisbon"
  },
  "metadata": {
    "category": "Electronics",
    "established": 1996
  }
}
```

**Resposta:**

```json
{
  "success": true,
  "data": {
    "id": "org_123",
    "name": "Worten",
    "slug": "worten",
    "type": "MARKETPLACE",
    "email": "info@worten.pt",
    "isActive": true,
    "members": [
      {
        "id": "member_123",
        "role": "OWNER",
        "isActive": true,
        "user": {
          "id": "user_123",
          "email": "admin@cswmarkets.com",
          "profile": {
            "firstName": "Admin",
            "lastName": "User"
          }
        }
      }
    ],
    "createdAt": "2025-11-15T22:00:00.000Z"
  },
  "meta": {
    "timestamp": "2025-11-15T22:00:00.000Z"
  }
}
```

---

### 2. Listar Organizações

```http
GET /api/v1/organizations
Authorization: Bearer {token}

# Query Parameters:
# - type: MARKETPLACE | PROVIDER | PARTNER | CLIENT
# - isActive: true | false
# - search: string (pesquisa em name, slug, description)
# - myOrgs: true (apenas minhas organizações)
```

**Exemplos:**

```bash
# Todas as organizações
GET /api/v1/organizations

# Apenas marketplaces
GET /api/v1/organizations?type=MARKETPLACE

# Minhas organizações
GET /api/v1/organizations?myOrgs=true

# Pesquisa
GET /api/v1/organizations?search=worten

# Organizações ativas do tipo marketplace
GET /api/v1/organizations?type=MARKETPLACE&isActive=true
```

---

### 3. Obter Organização por ID

```http
GET /api/v1/organizations/:id
Authorization: Bearer {token}
```

**Nota:** Apenas membros da organização têm acesso.

---

### 4. Obter Organização por Slug

```http
GET /api/v1/organizations/slug/:slug

# Exemplo:
GET /api/v1/organizations/slug/worten
```

**Nota:** Endpoint público (não requer autenticação).

---

### 5. Atualizar Organização

```http
PUT /api/v1/organizations/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Worten Portugal",
  "description": "Nova descrição",
  "website": "https://www.worten.pt",
  "logoUrl": "https://cdn.worten.pt/new-logo.png",
  "settings": {
    "currency": "EUR",
    "paymentMethods": ["MB", "CC", "PAYPAL"]
  }
}
```

**Permissões:** OWNER ou ADMIN

---

### 6. Deletar Organização

```http
DELETE /api/v1/organizations/:id
Authorization: Bearer {token}
```

**Permissões:** Apenas OWNER

**Nota:** Soft delete (isActive = false, deletedAt definido)

---

## 👥 Gestão de Membros

### 7. Convidar Membro

```http
POST /api/v1/organizations/:id/members/invite
Authorization: Bearer {token}
Content-Type: application/json

{
  "email": "joao.silva@example.com",
  "role": "MEMBER",
  "message": "Bem-vindo à equipa Worten!"
}
```

**Resposta:**

```json
{
  "success": true,
  "data": {
    "member": {
      "id": "member_456",
      "organizationId": "org_123",
      "role": "MEMBER",
      "isActive": false,
      "user": {
        "id": "user_456",
        "email": "joao.silva@example.com"
      }
    },
    "inviteToken": "abc123def456..."
  },
  "meta": {
    "message": "Member invited successfully"
  }
}
```

**Permissões:** OWNER ou ADMIN

**Roles disponíveis:**
- `OWNER` - Controlo total
- `ADMIN` - Gestão completa
- `MANAGER` - Gestão de membros
- `MEMBER` - Acesso normal
- `VIEWER` - Apenas visualização

---

### 8. Aceitar Convite

```http
POST /api/v1/organizations/invites/:token/accept
Authorization: Bearer {token}

# Exemplo:
POST /api/v1/organizations/invites/abc123def456.../accept
```

**Resposta:**

```json
{
  "success": true,
  "data": {
    "id": "member_456",
    "organizationId": "org_123",
    "role": "MEMBER",
    "isActive": true,
    "joinedAt": "2025-11-15T22:10:00.000Z",
    "organization": {
      "id": "org_123",
      "name": "Worten",
      "slug": "worten"
    }
  },
  "meta": {
    "message": "Invite accepted successfully"
  }
}
```

---

### 9. Atualizar Role de Membro

```http
PUT /api/v1/organizations/:id/members/:memberId/role
Authorization: Bearer {token}
Content-Type: application/json

{
  "role": "ADMIN"
}
```

**Permissões:** Apenas OWNER

**Restrições:**
- Não pode alterar a própria role
- Não pode alterar role de outros OWNERS

---

### 10. Remover Membro

```http
DELETE /api/v1/organizations/:id/members/:memberId
Authorization: Bearer {token}
```

**Permissões:** OWNER ou ADMIN

**Restrições:**
- Não pode remover a si próprio
- Não pode remover OWNERS

---

### 11. Sair da Organização

```http
POST /api/v1/organizations/:id/leave
Authorization: Bearer {token}
```

**Restrição:** Se for o único OWNER, deve transferir ownership primeiro.

---

## 🔐 Permissões e Roles

### Matriz de Permissões

| Ação | OWNER | ADMIN | MANAGER | MEMBER | VIEWER |
|------|-------|-------|---------|--------|--------|
| Ver organização | ✅ | ✅ | ✅ | ✅ | ✅ |
| Editar organização | ✅ | ✅ | ❌ | ❌ | ❌ |
| Deletar organização | ✅ | ❌ | ❌ | ❌ | ❌ |
| Convidar membros | ✅ | ✅ | ❌ | ❌ | ❌ |
| Alterar roles | ✅ | ❌ | ❌ | ❌ | ❌ |
| Remover membros | ✅ | ✅ | ❌ | ❌ | ❌ |
| Sair da organização | ✅* | ✅ | ✅ | ✅ | ✅ |

*\* OWNER só pode sair se houver outro OWNER*

---

## 📧 Sistema de Convites

### Fluxo de Convite

1. **OWNER/ADMIN convida membro:**
   ```
   POST /api/v1/organizations/:id/members/invite
   ```

2. **Sistema gera token único:**
   - Token válido por 7 dias
   - Armazenado com hash seguro
   - Email enviado ao convidado (TODO: implementar)

3. **Convidado aceita:**
   ```
   POST /api/v1/organizations/invites/:token/accept
   ```

4. **Membro ativado:**
   - `isActive = true`
   - `joinedAt` definido
   - Token invalidado
   - Audit log criado

### Token de Convite

```typescript
{
  inviteToken: string;      // Token único (32 chars)
  inviteExpires: Date;      // +7 dias
  inviteAcceptedAt?: Date;  // Data de aceitação
}
```

---

## 💡 Exemplos de Uso

### Criar Marketplace "FNAC"

```bash
curl -X POST http://localhost:4000/api/v1/organizations \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "FNAC",
    "slug": "fnac",
    "description": "Cultura, entretenimento e tecnologia",
    "type": "MARKETPLACE",
    "email": "info@fnac.pt",
    "phone": "+351 707 313 435",
    "website": "https://www.fnac.pt",
    "logoUrl": "https://static.fnac.pt/logo.png",
    "settings": {
      "currency": "EUR",
      "categories": ["Books", "Music", "Tech", "Gaming"]
    }
  }'
```

### Convidar Gestor

```bash
curl -X POST http://localhost:4000/api/v1/organizations/org_123/members/invite \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "gestor@fnac.pt",
    "role": "MANAGER",
    "message": "Junte-se à equipa de gestão da FNAC!"
  }'
```

### Aceitar Convite

```bash
curl -X POST http://localhost:4000/api/v1/organizations/invites/TOKEN_AQUI/accept \
  -H "Authorization: Bearer USER_TOKEN"
```

### Listar Minhas Organizações

```bash
curl -X GET "http://localhost:4000/api/v1/organizations?myOrgs=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Promover a ADMIN

```bash
curl -X PUT http://localhost:4000/api/v1/organizations/org_123/members/member_456/role \
  -H "Authorization: Bearer OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "ADMIN"
  }'
```

---

## 🔄 Multi-Tenancy

### Isolamento de Dados

Cada organização tem seus próprios:
- Membros e permissões
- Configurações (`settings`)
- Metadata customizado
- Audit logs isolados

### Contexto de Organização

```typescript
// No futuro, adicionar middleware:
req.organization = {
  id: "org_123",
  name: "Worten",
  type: "MARKETPLACE",
  role: "ADMIN"
}
```

---

## 📝 Audit Logs

Todas as operações geram audit logs:

```typescript
{
  userId: "user_123",
  action: "CREATE" | "UPDATE" | "DELETE",
  entity: "Organization" | "OrganizationMember",
  entityId: "org_123",
  description: "Organization created: Worten",
  metadata: { slug: "worten", type: "MARKETPLACE" },
  ipAddress: "192.168.1.1",
  userAgent: "Mozilla/5.0...",
  createdAt: "2025-11-15T22:00:00.000Z"
}
```

---

## 🚀 Próximos Passos

### Features a Implementar

- [ ] **Email Service** - Envio automático de convites
- [ ] **Organization Context Middleware** - Injetar organização no request
- [ ] **Billing** - Planos e subscrições por organização
- [ ] **API Keys** - Chaves de API por organização
- [ ] **Webhooks** - Eventos de organização
- [ ] **Teams** - Sub-equipas dentro da organização
- [ ] **SSO/SAML** - Single Sign-On empresarial
- [ ] **Data Export** - Exportar dados da organização
- [ ] **Transfer Ownership** - Transferir propriedade

### Melhorias

- [ ] Rate limiting por organização
- [ ] Quotas e limites por organização
- [ ] Analytics e dashboard
- [ ] Notificações in-app
- [ ] Activity feed por organização

---

## 📚 Referências

- [Prisma Schema](../../prisma/schema.prisma)
- [Organization Service](./organization.service.ts)
- [Organization Routes](./organization.routes.ts)
- [Organization Controller](./organization.controller.ts)

---

**Desenvolvido com ❤️ pela equipa CSW Markets**
