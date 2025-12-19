# 🎯 Organizations Module - Quick Start

## ✅ O que foi criado

### 1. **Schema Prisma** ✔️
- `Organization` model com tipos (MARKETPLACE, PROVIDER, PARTNER, CLIENT)
- `OrganizationMember` model com roles (OWNER, ADMIN, MANAGER, MEMBER, VIEWER)
- Sistema de convites com tokens
- Enums: `OrganizationType` e `OrganizationRole`

### 2. **Service Layer** ✔️
- `organization.service.ts` - Lógica de negócio completa
- Multi-tenancy com isolamento de dados
- Sistema de convites e permissões
- Audit logs automáticos

### 3. **Controller** ✔️
- `organization.controller.ts` - Handlers HTTP
- Validação de inputs com Zod
- Respostas padronizadas

### 4. **Routes** ✔️
- `organization.routes.ts` - 11 endpoints REST
- Autenticação e autorização
- Documentação inline

### 5. **Validation** ✔️
- `organization.validation.ts` - Schemas Zod
- Validação de slugs, emails, roles

### 6. **Documentation** ✔️
- `README.md` - Documentação completa
- Exemplos de uso
- Matriz de permissões

---

## 🚀 Próximo Passo: Migration

**Execute agora no terminal:**

```bash
# No prompt que está a aparecer, escreva:
y
```

Isto vai criar a migration com os novos campos:
- Organization: type, email, phone, website, logoUrl, isActive, deletedAt, metadata
- OrganizationMember: role enum, inviteToken, inviteExpires, inviteAcceptedAt, isActive, joinedAt

---

## 📋 Endpoints Disponíveis

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| POST | `/organizations` | Criar organização | Auth |
| GET | `/organizations` | Listar organizações | Auth |
| GET | `/organizations/:id` | Ver organização | Member |
| GET | `/organizations/slug/:slug` | Ver por slug | Public |
| PUT | `/organizations/:id` | Atualizar | OWNER/ADMIN |
| DELETE | `/organizations/:id` | Deletar | OWNER |
| POST | `/organizations/:id/members/invite` | Convidar | OWNER/ADMIN |
| POST | `/organizations/invites/:token/accept` | Aceitar convite | Auth |
| PUT | `/organizations/:id/members/:memberId/role` | Alterar role | OWNER |
| DELETE | `/organizations/:id/members/:memberId` | Remover membro | OWNER/ADMIN |
| POST | `/organizations/:id/leave` | Sair | Member |

---

## 🎨 Exemplo de Fluxo Completo

### 1. Criar Marketplace "Worten"

```http
POST /api/v1/organizations
{
  "name": "Worten",
  "slug": "worten",
  "type": "MARKETPLACE",
  "email": "info@worten.pt",
  "website": "https://www.worten.pt"
}
```

### 2. Convidar Membro

```http
POST /api/v1/organizations/{org_id}/members/invite
{
  "email": "gestor@worten.pt",
  "role": "MANAGER"
}
```

### 3. Aceitar Convite

```http
POST /api/v1/organizations/invites/{token}/accept
```

### 4. Listar Minhas Organizações

```http
GET /api/v1/organizations?myOrgs=true
```

---

## 🔐 Sistema de Roles

**Hierarquia:**
```
OWNER > ADMIN > MANAGER > MEMBER > VIEWER
```

**Permissões:**
- **OWNER**: Tudo (inclusive deletar org)
- **ADMIN**: Gestão completa (menos delete)
- **MANAGER**: Gestão de membros
- **MEMBER**: Acesso normal
- **VIEWER**: Apenas leitura

---

## 📦 Features Incluídas

✅ Multi-tenancy  
✅ Sistema de convites com tokens (7 dias)  
✅ Permissões hierárquicas  
✅ Soft delete  
✅ Audit logs automáticos  
✅ Validação completa (Zod)  
✅ Isolamento de dados  
✅ Slugs URL-friendly  
✅ Metadata flexível (JSON)  

---

## 🎯 Use Cases

### Marketplace (Worten, FNAC, Temu)
```typescript
type: "MARKETPLACE"
// Gestão de vendedores, produtos, integrações
```

### Provider (Fornecedores)
```typescript
type: "PROVIDER"
// Empresas que fornecem produtos/serviços
```

### Partner (Parceiros)
```typescript
type: "PARTNER"
// Parceiros de negócio, afiliados
```

### Client (Clientes Corporativos)
```typescript
type: "CLIENT"
// Empresas clientes com múltiplos utilizadores
```

---

## 🔄 Integração com Auth

O sistema está totalmente integrado com o módulo de autenticação:

- Usa `req.user` do JWT
- Audit logs automáticos
- Cookies HTTPOnly suportados
- Sessions tracking

---

## 📝 Next Steps Sugeridos

1. ✅ **Executar migration** (escrever `y` no terminal)
2. ✅ **Restart server** (`pnpm dev`)
3. ✅ **Testar no Postman**
4. 🔄 **Implementar email service** (enviar convites)
5. 🔄 **Adicionar organization context middleware**
6. 🔄 **Billing/Subscriptions por organização**

---

**Pronto para testar! 🚀**

Depois de executar a migration, o servidor vai reiniciar e teremos todos os endpoints disponíveis em:

```
http://localhost:4000/api/v1/organizations
```
