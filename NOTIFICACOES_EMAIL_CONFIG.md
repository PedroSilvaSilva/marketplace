# 📧 Sistema de Notificações - Configuração Final

## ✅ Implementação Completa

### 🔴 Emails Imediatos - APENAS PARA ERROS
Quando ocorre um **erro**, o sistema:
- ✅ Envia email **imediatamente** com detalhes do erro
- ✅ Guarda log na base de dados
- ✅ Inclui stack trace, contexto e informação adicional

### ✅ Relatório Diário - SUCESSOS
Para operações **bem-sucedidas**:
- ✅ **NÃO** envia email imediato
- ✅ Agrega estatísticas ao longo do dia
- ✅ Envia **1 único email** no final do dia (23:00) com resumo de todas as operações bem-sucedidas

---

## 📧 Email de Erro (Imediato)

### Quando é enviado:
- ❌ Quando qualquer operação falha
- ❌ Quando há exceções/erros em qualquer método

### Conteúdo:
```
Assunto: ❌ Erro em articles - sendArticlesToTypsForYou

- Contexto do erro
- Método onde ocorreu
- Mensagem de erro completa
- Stack trace
- Identificador específico (InternalPartNumber, OrderNumber, etc.)
- Informações adicionais
```

---

## 📊 Email de Relatório Diário (23:00)

### Quando é enviado:
- ✅ Todos os dias às **23:00** (automaticamente)
- ✅ Apenas se houver operações bem-sucedidas no dia

### Conteúdo:
```
Assunto: ✅ Relatório Diário - 13/01/2026 - 156 Operações Bem-Sucedidas

📊 RESUMO DO DIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total de Operações: 156

POR TIPO DE SINCRONIZAÇÃO
• articles: 45 operações, 12.500 registos
• warehouse: 32 operações, 8.300 registos  
• orders: 28 operações, 450 registos
• discountGroup: 15 operações, 230 registos

TOP ORGANIZAÇÕES
• Organização A: 65 operações
• Organização B: 42 operações
• Organização C: 28 operações
```

---

## 🔧 Configuração

### Variáveis de Ambiente (.env)
```env
# Emails que recebem as notificações (separados por vírgula)
ORDER_NOTIFICATION_EMAILS=pedro.cardoso@comsoftweb.pt,admin@empresa.com

# Configuração SMTP
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@comsoftweb.pt
SMTP_PASSWORD=sua-senha
EMAIL_FROM=noreply@comsoftweb.pt
```

---

## 📡 API Endpoints

### Relatório Manual (para teste)
```http
POST /api/v1/daily-reports/send
Authorization: Bearer {token}

# Body (opcional)
{
  "date": "2026-01-13"  # Data específica (default: hoje)
}
```

### Preview do Relatório (sem enviar email)
```http
GET /api/v1/daily-reports/preview?date=2026-01-13
Authorization: Bearer {token}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "date": "2026-01-13T00:00:00Z",
    "totalSuccessful": 156,
    "byType": [
      {
        "type": "articles",
        "count": 45,
        "totalProcessed": 12500,
        "avgDuration": 2340
      },
      {
        "type": "warehouse",
        "count": 32,
        "totalProcessed": 8300,
        "avgDuration": 1850
      }
    ],
    "byOrg": [
      {
        "organizationId": "org-123",
        "organizationName": "Organização A",
        "count": 65,
        "totalProcessed": 18500
      }
    ]
  }
}
```

---

## 🕐 Agendamento Automático

### Cron Job Configurado
O sistema está configurado para enviar o relatório diário **automaticamente às 23:00** todos os dias.

**Expressão Cron:** `0 23 * * *`
- Hora: 23:00 (11 PM)
- Frequência: Todos os dias
- Timezone: Sistema local

### Verificar Status
O cron job é iniciado automaticamente quando o servidor arranca.

---

## 🧪 Testar o Sistema

### 1. Testar Email de Erro (Imediato)
```bash
# Enviar notificação de teste
curl -X POST http://localhost:4000/api/v1/error-notifications/test \
  -H "Authorization: Bearer SEU_TOKEN"

# Verificar se recebeu email de erro imediatamente
```

### 2. Ver Preview do Relatório Diário
```bash
# Ver preview do relatório de hoje
curl http://localhost:4000/api/v1/daily-reports/preview \
  -H "Authorization: Bearer SEU_TOKEN"
```

### 3. Enviar Relatório Diário Manual (Teste)
```bash
# Enviar relatório manualmente
curl -X POST http://localhost:4000/api/v1/daily-reports/send \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json"

# Verificar se recebeu email com resumo de sucessos
```

---

## 📊 Diferenças entre Emails

| Aspecto | Email de Erro | Relatório Diário |
|---------|---------------|------------------|
| **Quando** | Imediatamente quando ocorre erro | 23:00 todos os dias |
| **Gatilho** | Qualquer exceção/erro | Operações bem-sucedidas |
| **Conteúdo** | Detalhes do erro específico | Estatísticas agregadas |
| **Frequência** | Cada erro = 1 email | 1 email por dia |
| **Objetivo** | Alerta urgente | Resumo informativo |
| **Tom** | ❌ Crítico/Urgente | ✅ Informativo/Positivo |

---

## 💻 Exemplo de Integração no Código

### Erros (Email Imediato)
```typescript
import { ErrorNotificationService } from '@services/error-notification.service';

try {
  await syncArticles();
} catch (error) {
  // ❌ Email enviado IMEDIATAMENTE
  await ErrorNotificationService.sendErrorNotification({
    context: 'articles',
    method: 'syncArticles',
    error,
    internalPartNumber: 'ART-12345',
    additionalInfo: { organizationId: 'org-123' }
  });
  
  throw error;
}
```

### Sucessos (Sem Email - Vai para Relatório Diário)
```typescript
// Operações bem-sucedidas são registadas automaticamente
// nos SyncExecutionLog com status SUCCESS
// O relatório diário às 23:00 vai buscar estas estatísticas

await prisma.syncExecutionLog.create({
  data: {
    syncType: 'articles',
    status: 'SUCCESS',
    totalProcessed: 150,
    organizationId: 'org-123',
    // ... outros campos
  }
});

// ✅ Nenhum email é enviado agora
// ✅ Será incluído no relatório das 23:00
```

---

## 🎯 Benefícios

### ✅ Para Administradores
- **Menos emails**: Apenas erros urgentes + 1 resumo diário
- **Foco**: Emails imediatos = problemas que precisam atenção
- **Visão geral**: Relatório diário mostra o que funcionou bem

### ✅ Para o Sistema
- **Eficiência**: Não sobrecarrega email com sucessos
- **Priorização**: Erros têm atenção imediata
- **Histórico**: Tudo guardado na BD para consulta

### ✅ Para Debugging
- **Erros**: Stack trace e contexto completo por email
- **Sucessos**: Estatísticas agregadas para análise de performance
- **API**: Consultar qualquer log quando necessário

---

## 📝 Resumo da Configuração

✅ **Emails de Erro** → Imediatos, automáticos, detalhados  
✅ **Relatório Diário** → 23:00, automático, resumo de sucessos  
✅ **API de Consulta** → Disponível para histórico completo  
✅ **Cron Job** → Ativo e agendado  
✅ **Base de Dados** → Todos os logs guardados  

**🎉 Sistema 100% Funcional e Configurado!**
