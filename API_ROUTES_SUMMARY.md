# API Routes Summary

Base URL: `http://localhost:3000/api/v1`  
Swagger Docs: `http://localhost:3000/api/v1/docs`

## 📊 Status de Documentação Swagger

| Módulo | Rotas | Swagger | Status |
|--------|-------|---------|--------|
| Auth | 13+ rotas | ✅ Completo | Autenticação, registro, MFA, sessões |
| Organizations | 8+ rotas | ❌ Faltando | Gestão de organizações e membros |
| Customers | 5+ rotas | ✅ Completo | Gestão de clientes |
| Integrations | 6+ rotas | ✅ Completo | Gestão de integrações |
| Provider Config | 6+ rotas | ✅ Completo | Configurações de provedores |
| Client Provider | 8+ rotas | ✅ Completo | Conexões cliente-provedor |
| Data Source Config | 5+ rotas | ❌ Faltando | Configurações de fontes de dados |
| Sync | 12 rotas | ✅ Parcial | Sincronização de artigos |
| SQL Data | 3+ rotas | ❌ Faltando | Consultas SQL diretas |

---

## 🔐 Auth Module (`/api/v1/auth`)

**✅ Swagger Completo**

### Endpoints Principais:
- `POST /register` - Registrar novo usuário
- `POST /login` - Login com cookies HTTPOnly
- `POST /logout` - Logout e invalidar sessão
- `POST /refresh` - Renovar token de acesso
- `POST /verify-email` - Verificar email
- `POST /forgot-password` - Solicitar reset de senha
- `POST /reset-password` - Reset de senha com token
- `GET /me` - Obter perfil do usuário autenticado
- `PUT /me` - Atualizar perfil
- `GET /sessions` - Listar sessões ativas
- `POST /mfa/setup` - Configurar MFA
- `POST /mfa/verify` - Verificar código MFA

---

## 🏢 Organizations Module (`/api/v1/organizations`)

**❌ Swagger Faltando - PRECISA DOCUMENTAR**

### Endpoints:
- `POST /` - Criar organização
- `GET /` - Listar organizações (com filtros)
- `GET /slug/:slug` - Buscar por slug
- `GET /:id` - Buscar por ID
- `PUT /:id` - Atualizar organização
- `DELETE /:id` - Deletar organização (soft delete)
- `POST /:id/members/invite` - Convidar membro
- `POST /invites/:token/accept` - Aceitar convite
- `PUT /:id/members/:memberId/role` - Atualizar role de membro

**Query Parameters Importantes:**
- `type` - MARKETPLACE, PROVIDER, PARTNER, CLIENT
- `isActive` - true/false
- `search` - Busca por nome/slug/descrição
- `myOrgs` - Filtrar minhas organizações

---

## 👥 Customers Module (`/api/v1/customers`)

**✅ Swagger Completo**

### Endpoints:
- `POST /` - Criar cliente
- `GET /` - Listar clientes
- `GET /:id` - Buscar cliente por ID
- `PUT /:id` - Atualizar cliente
- `DELETE /:id` - Deletar cliente

---

## 🔌 Integrations Module (`/api/v1/integrations`)

**✅ Swagger Completo**

### Endpoints:
- `POST /` - Criar integração
- `GET /` - Listar integrações
- `GET /:id` - Buscar integração
- `PUT /:id` - Atualizar integração
- `DELETE /:id` - Deletar integração
- `POST /:id/test` - Testar conexão

---

## ⚙️ Provider Config Module (`/api/v1/provider-configs`)

**✅ Swagger Completo**

### Endpoints:
- `POST /` - Criar configuração de provedor
- `GET /` - Listar configurações
- `GET /:id` - Buscar configuração
- `PUT /:id` - Atualizar configuração
- `DELETE /:id` - Deletar configuração
- `POST /:id/test` - Testar configuração

---

## 🔗 Client Provider Module (`/api/v1/client-provider-connections`)

**✅ Swagger Completo**

### Endpoints:
- `POST /` - Criar conexão
- `GET /` - Listar conexões
- `GET /:id` - Buscar conexão
- `PUT /:id` - Atualizar conexão
- `DELETE /:id` - Deletar conexão
- `POST /:id/activate` - Ativar conexão
- `POST /:id/deactivate` - Desativar conexão
- `POST /:id/test` - Testar conexão

---

## 💾 Data Source Config Module (`/api/v1/data-source-configs`)

**❌ Swagger Faltando - PRECISA DOCUMENTAR**

### Endpoints:
- `POST /` - Criar configuração de data source
- `GET /` - Listar configurações
- `GET /:id` - Buscar configuração
- `PUT /:id` - Atualizar configuração
- `DELETE /:id` - Deletar configuração

---

## 🔄 Sync Module (`/api/v1/sync`)

**✅ Swagger Parcialmente Documentado**

### ✅ Endpoints Documentados:

#### Testing & Queries
- `POST /test-auth/:providerConfigId` - Testar autenticação TypsForYou
- `GET /articles/:providerConfigId` - Listar artigos do TypsForYou
- `GET /warehouse/:providerConfigId` - Listar stock/warehouse
- `GET /customers-warehouses/:providerConfigId` - Listar warehouses de clientes
- `GET /customers/:providerConfigId` - Listar clientes

#### Staging Workflow (PRINCIPAIS PARA O FRONTEND)
- `POST /import/:organizationId/:providerConfigId` - **Importar artigos para staging**
  - Query: `limit`, `replaceExisting`
  - Response: `articlesRead`, `articlesImported`, `articlesSkipped`
  
- `GET /staging/:organizationId/:providerConfigId/csv` - **Gerar CSV de artigos staged**
  - Query: `status` (PENDING, VALIDATED, SENT, ERROR, REJECTED, SKIPPED), `limit`
  - Response: CSV file download
  
- `POST /staging/:organizationId/:providerConfigId/sync-existing` - **Sincronizar artigos existentes**
  - Marca artigos já existentes no TypsForYou como SENT
  - Response: `totalFetched`, `markedAsSent`
  
- `POST /staging/:organizationId/:providerConfigId/reset` - **Resetar status de artigos**
  - Query: `fromStatus` - Resetar apenas artigos com status específico
  - Response: `count` - Número de artigos resetados
  
- `POST /staging/:organizationId/:providerConfigId/send` - **Enviar artigos para TypsForYou**
  - Query: `status` (default: PENDING), `limit`
  - Response: `sent`, `rejected`, `errors[]`

### ❌ Endpoints SEM Swagger:
- `POST /articles/:providerConfigId` - Criar artigo (upload CSV direto)
- `POST /run/:organizationId/:providerConfigId` - Sync direto (sem staging)

---

## 🗄️ SQL Data Module (`/api/v1/sync/sql`)

**❌ Swagger Faltando - PRECISA DOCUMENTAR**

### Endpoints:
- `GET /test/:dataSourceConfigId` - Testar conexão SQL
- `POST /query/:dataSourceConfigId` - Executar query SQL
- `GET /tables/:dataSourceConfigId` - Listar tabelas do banco

---

## 🎯 Workflow Recomendado para Frontend - Sync de Artigos

### 1️⃣ Importar Artigos para Staging
```http
POST /api/v1/sync/import/{organizationId}/{providerConfigId}?limit=1000
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Imported 850 articles to staging",
  "data": {
    "articlesRead": 1000,
    "articlesImported": 850,
    "articlesSkipped": 150
  }
}
```

---

### 2️⃣ Sincronizar Artigos Existentes (Opcional)
```http
POST /api/v1/sync/staging/{organizationId}/{providerConfigId}/sync-existing
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Synced 120 articles from TypsForYou, 120 marked as sent",
  "data": {
    "totalFetched": 500,
    "markedAsSent": 120
  }
}
```

---

### 3️⃣ Gerar CSV para Revisão (Opcional)
```http
GET /api/v1/sync/staging/{organizationId}/{providerConfigId}/csv?status=PENDING&limit=100
Authorization: Bearer {token}
```

**Response:** CSV file download

---

### 4️⃣ Enviar Artigos para TypsForYou
```http
POST /api/v1/sync/staging/{organizationId}/{providerConfigId}/send?status=PENDING&limit=50
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Sent 45 articles, 5 rejected",
  "data": {
    "sent": 45,
    "rejected": 5,
    "errors": [
      {
        "articleCode": "ART001",
        "error": "Invalid BrandID"
      }
    ]
  }
}
```

---

### 5️⃣ Resetar Artigos com Erro (Se Necessário)
```http
POST /api/v1/sync/staging/{organizationId}/{providerConfigId}/reset?fromStatus=ERROR
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Reset 5 articles to PENDING status",
  "data": {
    "count": 5
  }
}
```

---

## 📝 Modelos de Dados (Schemas)

### SyncArticle Status Enum
```typescript
enum SyncStatus {
  PENDING    // Importado, aguardando envio
  VALIDATED  // Validado, pronto para envio
  SENT       // Enviado com sucesso
  ERROR      // Erro ao enviar
  REJECTED   // Rejeitado pela API (validação)
  SKIPPED    // Ignorado (já existe)
}
```

### Article Fields (17 campos obrigatórios)
1. BrandID
2. ArticleDiscountGroupCode
3. PartNumber
4. Description
5. DescriptionEnglish
6. Weight
7. Volume
8. UnitOfMeasure
9. PackageQuantity
10. RecommendedRetailPrice
11. CategoryCode
12. AttributeID (obsoleto)
13. AvailableForSale
14. Availability (obsoleto)
15. Active
16. Sort (obsoleto)
17. ReservedForFutureUse

---

## 🔧 Próximos Passos

### Documentação Prioritária:
1. ✅ **Sync Module** - CONCLUÍDO (7/12 rotas principais documentadas)
2. ❌ **Organizations Module** - CRÍTICO para multi-tenancy
3. ❌ **Data Source Config Module** - Importante para configuração
4. ❌ **SQL Data Module** - Útil para debugging

### Sugestões para o Frontend:
- Criar dashboard com cards para:
  - Total de artigos staged (por status)
  - Últimos erros de sincronização
  - Taxa de sucesso de envio
  - Artigos pendentes
  
- Criar página de staging com:
  - Tabela de artigos com filtros por status
  - Botão "Importar do SQL"
  - Botão "Enviar Selecionados"
  - Botão "Resetar Erros"
  - Download CSV
  
- Criar logs/histórico de sincronização
  - Timestamp de cada operação
  - Resultado (sucesso/erro)
  - Detalhes dos erros

---

## 🚀 Para Iniciar o Servidor

```bash
# Desenvolvimento
pnpm dev

# Produção
pnpm build
pnpm start
```

**Swagger URL:** http://localhost:3000/api/v1/docs
