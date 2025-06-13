# Documentação Técnica do Sistema de Notificações

## Visão Geral

O sistema de notificações implementado para o backend de convites online oferece uma solução completa e escalável para comunicar eventos importantes aos usuários em tempo real. Esta documentação técnica fornece informações detalhadas sobre a arquitetura, implementação, configuração e uso do sistema.

## Arquitetura do Sistema

### Componentes Principais

O sistema de notificações é composto por quatro componentes principais que trabalham em conjunto para fornecer uma experiência de notificação robusta e flexível.

#### 1. Sistema de Eventos (NotificationEvents)

O sistema de eventos serve como o núcleo central de comunicação entre diferentes partes da aplicação. Baseado no EventEmitter nativo do Node.js, este componente é responsável por emitir e gerenciar eventos que desencadeiam notificações.

**Características principais:**

- **Desacoplamento**: Permite que diferentes módulos da aplicação emitam eventos sem conhecimento direto do sistema de notificações
- **Escalabilidade**: Suporta múltiplos listeners para cada tipo de evento
- **Flexibilidade**: Facilita a adição de novos tipos de eventos sem modificar código existente
- **Performance**: Utiliza o EventEmitter otimizado do Node.js para processamento eficiente

**Eventos suportados:**

- `guest.status.changed`: Emitido quando um convidado altera seu status de participação
- `invite.sent`: Emitido quando um convite é enviado para convidados
- `event.created`: Emitido quando um novo evento é criado
- `event.updated`: Emitido quando um evento existente é modificado
- `event.reminder`: Emitido para lembretes automáticos de eventos
- `system.alert`: Emitido para alertas e notificações do sistema

#### 2. Serviço de Notificações (NotificationService)

O NotificationService atua como o orquestrador central do sistema, responsável por escutar eventos, processar regras de negócio, e coordenar o envio de notificações através de múltiplos canais.

**Responsabilidades principais:**

- **Processamento de Eventos**: Escuta eventos emitidos pelo sistema e determina quais notificações devem ser criadas
- **Gerenciamento de Configurações**: Obtém e aplica configurações personalizadas de notificação para cada usuário
- **Coordenação de Canais**: Determina quais canais de entrega devem ser utilizados para cada notificação
- **Persistência**: Armazena notificações no banco de dados para histórico e auditoria
- **Logging de Entrega**: Mantém registros detalhados de tentativas de entrega e seus resultados

**Fluxo de processamento:**

1. **Recepção de Evento**: O serviço recebe um evento através do EventEmitter
2. **Análise de Contexto**: Determina o tipo de notificação baseado no evento recebido
3. **Verificação de Configurações**: Consulta as preferências do usuário destinatário
4. **Criação de Notificação**: Persiste a notificação no banco de dados
5. **Seleção de Canais**: Identifica canais ativos baseado nas configurações do usuário
6. **Coordenação de Envio**: Delega o envio para os provedores apropriados
7. **Logging**: Registra resultados de entrega para auditoria

#### 3. Provedores de Notificação

Os provedores são módulos especializados responsáveis pelo envio efetivo de notificações através de canais específicos. Cada provedor implementa uma interface comum, garantindo consistência e facilitando a adição de novos canais.

##### WebSocket Provider

O provedor WebSocket oferece notificações em tempo real para usuários conectados, proporcionando feedback imediato sobre eventos importantes.

**Funcionalidades:**

- **Conexões Persistentes**: Mantém conexões WebSocket ativas com clientes conectados
- **Autenticação**: Valida identidade de usuários através de tokens JWT
- **Mapeamento de Usuários**: Associa IDs de usuários com conexões WebSocket específicas
- **Broadcast Seletivo**: Envia notificações apenas para usuários relevantes
- **Gerenciamento de Estado**: Monitora conexões ativas e remove conexões inválidas
- **Estatísticas**: Fornece métricas sobre conexões ativas e uso do sistema

**Protocolo de comunicação:**

```javascript
// Autenticação do cliente
socket.emit('authenticate', {
  userId: 'user-id',
  token: 'jwt-token'
});

// Recepção de notificações
socket.on('notification', (notification) => {
  // Processar notificação recebida
});

// Marcar notificação como lida
socket.emit('mark_notification_read', {
  notificationId: 'notification-id'
});
```

##### Email Provider

O provedor de email oferece notificações assíncronas através de templates HTML responsivos, garantindo que usuários sejam informados mesmo quando não estão ativamente usando a aplicação.

**Características:**

- **Templates Responsivos**: Utiliza templates HTML que se adaptam a diferentes clientes de email
- **Personalização**: Suporta variáveis dinâmicas para personalizar conteúdo
- **Retry Logic**: Implementa tentativas automáticas em caso de falhas temporárias
- **Fallback de Texto**: Inclui versões em texto simples para compatibilidade
- **Configuração Flexível**: Suporta diferentes provedores SMTP
- **Throttling**: Evita spam através de controle de frequência

**Templates disponíveis:**

- **Confirmação de Presença**: Notifica quando um convidado confirma participação
- **Recusa de Convite**: Informa sobre recusas de convites
- **Convite Enviado**: Confirma envio bem-sucedido de convites
- **Lembrete de Evento**: Lembra sobre eventos próximos

#### 4. API de Gerenciamento

A API de gerenciamento fornece endpoints RESTful para interação com o sistema de notificações, permitindo que aplicações frontend consultem, configurem e gerenciem notificações.

**Endpoints principais:**

- **Listagem**: `GET /api/notifications` - Lista notificações com paginação e filtros
- **Leitura**: `PATCH /api/notifications/:id/read` - Marca notificações como lidas
- **Configurações**: `GET/PUT /api/notifications/settings` - Gerencia preferências do usuário
- **Estatísticas**: `GET /api/notifications/stats` - Fornece métricas de uso
- **Teste**: `POST /api/notifications/test` - Envia notificações de teste (desenvolvimento)

## Modelo de Dados

### Estrutura do Banco de Dados

O sistema utiliza três tabelas principais para armazenar informações de notificações, configurações e logs de entrega.

#### Tabela Notifications

A tabela principal que armazena todas as notificações geradas pelo sistema.

```sql
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
```

**Campos detalhados:**

- `id`: Identificador único da notificação (UUID)
- `userId`: Referência ao usuário destinatário
- `type`: Tipo da notificação (enum com valores predefinidos)
- `title`: Título conciso da notificação
- `message`: Conteúdo principal da mensagem
- `data`: Dados adicionais em formato JSON para contexto
- `read`: Status de leitura da notificação
- `createdAt/updatedAt`: Timestamps de criação e atualização

**Índices otimizados:**

- Índice composto em `(userId, read)` para consultas de notificações não lidas
- Índice em `createdAt` para ordenação cronológica eficiente

#### Tabela NotificationSettings

Armazena configurações personalizadas de notificação para cada usuário.

```sql
CREATE TABLE "NotificationSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guestConfirmed" JSONB NOT NULL DEFAULT '{"email": true, "websocket": true, "push": false}',
    "guestDeclined" JSONB NOT NULL DEFAULT '{"email": true, "websocket": true, "push": false}',
    "inviteSent" JSONB NOT NULL DEFAULT '{"email": false, "websocket": true, "push": false}',
    "eventReminder" JSONB NOT NULL DEFAULT '{"email": true, "websocket": false, "push": true}',
    "digestFrequency" "DigestFrequency" NOT NULL DEFAULT 'NONE',
    "quietHoursStart" INTEGER,
    "quietHoursEnd" INTEGER,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "NotificationSettings_userId_key" UNIQUE ("userId")
);
```

**Configurações por tipo:**

Cada tipo de notificação possui configurações independentes para diferentes canais:

- `email`: Habilita/desabilita notificações por email
- `websocket`: Controla notificações em tempo real
- `push`: Gerencia notificações push (futuro)

**Configurações globais:**

- `digestFrequency`: Frequência de digest (NONE, DAILY, WEEKLY)
- `quietHoursStart/End`: Período silencioso (0-23 horas)
- `timezone`: Fuso horário do usuário para cálculos de tempo

#### Tabela NotificationDeliveryLog

Mantém histórico detalhado de tentativas de entrega para auditoria e debugging.

```sql
CREATE TABLE "NotificationDeliveryLog" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    
    CONSTRAINT "NotificationDeliveryLog_pkey" PRIMARY KEY ("id")
);
```

**Status de entrega:**

- `PENDING`: Tentativa iniciada mas não concluída
- `SENT`: Enviado com sucesso pelo provedor
- `DELIVERED`: Confirmação de entrega recebida
- `FAILED`: Falha na tentativa de envio
- `BOUNCED`: Rejeitado pelo destinatário

### Tipos Enumerados

O sistema utiliza enums para garantir consistência e facilitar manutenção:

```prisma
enum NotificationType {
  GUEST_CONFIRMED
  GUEST_DECLINED
  GUEST_PENDING
  INVITE_SENT
  EVENT_REMINDER
  EVENT_UPDATED
  SYSTEM_ALERT
}

enum DeliveryChannel {
  EMAIL
  WEBSOCKET
  PUSH
  SMS
}

enum DeliveryStatus {
  PENDING
  SENT
  DELIVERED
  FAILED
  BOUNCED
}

enum DigestFrequency {
  NONE
  DAILY
  WEEKLY
}
```

## Configuração e Implementação

### Requisitos do Sistema

**Dependências principais:**

- Node.js 16+ com suporte a ES6+
- PostgreSQL 12+ para persistência de dados
- Redis (opcional) para cache de sessões WebSocket
- Provedor SMTP para envio de emails

**Bibliotecas necessárias:**

```json
{
  "socket.io": "^4.7.0",
  "nodemailer": "^6.9.0",
  "@prisma/client": "^5.0.0",
  "winston": "^3.10.0",
  "joi": "^17.9.0"
}
```

### Configuração de Ambiente

O sistema requer configuração de variáveis de ambiente para funcionamento adequado:

```env
# Configurações de banco de dados
DATABASE_URL="postgresql://user:password@localhost:5432/convites"

# Configurações de email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-email@gmail.com
SMTP_PASSWORD=sua-senha-de-app
FROM_NAME="Convite Certo"
FROM_EMAIL=noreply@convitecerto.online

# URLs da aplicação
FRONTEND_URL=https://convitecerto.online
API_URL=https://api.convitecerto.online

# Configurações de desenvolvimento
NODE_ENV=development
LOG_LEVEL=info
```

### Processo de Instalação

**1. Preparação do banco de dados:**

```bash
# Executar migrations do Prisma
npx prisma migrate dev --name add_notifications

# Gerar cliente Prisma atualizado
npx prisma generate
```

**2. Instalação de dependências:**

```bash
# Instalar bibliotecas necessárias
npm install socket.io nodemailer

# Instalar dependências de desenvolvimento para testes
npm install --save-dev jest supertest
```

**3. Configuração de arquivos:**

- Substituir `src/index.js` pela versão atualizada com suporte a notificações
- Atualizar `src/routes/guest.routes.js` com integração de eventos
- Adicionar novos arquivos de serviços e provedores

**4. Teste de configuração:**

```bash
# Executar testes do sistema
npm test

# Verificar health check
curl http://localhost:5000/health
```

## Uso e Integração

### Emissão de Eventos

Para integrar notificações em novos fluxos da aplicação, utilize o sistema de eventos:

```javascript
const notificationEvents = require('./services/notificationEvents');

// Emitir evento de mudança de status
notificationEvents.emitGuestStatusChanged({
  guestId: 'guest-id',
  eventId: 'event-id',
  userId: 'organizer-id',
  previousStatus: 'pending',
  newStatus: 'confirmed',
  guestName: 'João Silva',
  eventTitle: 'Festa de Aniversário',
  eventDate: new Date(),
  eventLocation: 'Casa do João'
});
```

### Configuração de Usuário

Usuários podem personalizar suas preferências através da API:

```javascript
// Obter configurações atuais
const settings = await fetch('/api/notifications/settings', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Atualizar configurações
await fetch('/api/notifications/settings', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    guestConfirmed: {
      email: true,
      websocket: true,
      push: false
    },
    guestDeclined: {
      email: false,
      websocket: true,
      push: false
    }
  })
});
```

### Integração WebSocket no Frontend

Para receber notificações em tempo real no frontend:

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

// Autenticar usuário
socket.on('connect', () => {
  socket.emit('authenticate', {
    userId: currentUser.id,
    token: authToken
  });
});

// Escutar notificações
socket.on('notification', (notification) => {
  // Exibir notificação na interface
  showNotification(notification);
  
  // Atualizar contador de não lidas
  updateUnreadCount();
});

// Confirmar leitura
function markAsRead(notificationId) {
  socket.emit('mark_notification_read', { notificationId });
}
```

## Monitoramento e Métricas

### Logs do Sistema

O sistema gera logs estruturados para facilitar monitoramento:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "Notificação enviada via websocket",
  "service": "convites-digitais-api",
  "userId": "user-123",
  "notificationId": "notif-456",
  "channel": "websocket",
  "success": true
}
```

### Métricas Disponíveis

**Através da API de estatísticas:**

```javascript
// GET /api/notifications/stats
{
  "total": 1250,
  "unread": 15,
  "byType": {
    "GUEST_CONFIRMED": 450,
    "GUEST_DECLINED": 200,
    "INVITE_SENT": 600
  },
  "last7Days": 85
}
```

**Através do endpoint de WebSocket:**

```javascript
// GET /api/websocket/status
{
  "connectedUsers": 42,
  "totalSockets": 45,
  "userSocketMap": {
    "user-1": "socket-abc",
    "user-2": "socket-def"
  }
}
```

### Health Checks

O sistema fornece endpoints de saúde para monitoramento:

```javascript
// GET /health
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "notifications": {
    "websocketConnections": 42,
    "emailProvider": "configured"
  }
}
```

## Troubleshooting

### Problemas Comuns

**1. Notificações não são geradas:**

- Verificar se eventos estão sendo emitidos corretamente
- Confirmar configurações do usuário
- Verificar logs do NotificationService
- Validar conexão com banco de dados

**2. WebSocket não conecta:**

- Verificar configuração de CORS
- Confirmar se porta está acessível
- Validar token de autenticação
- Verificar logs de conexão

**3. Emails não são enviados:**

- Verificar configurações SMTP
- Confirmar credenciais de email
- Verificar logs de erro do EmailProvider
- Testar conectividade com provedor SMTP

### Debugging

**Habilitar logs detalhados:**

```env
LOG_LEVEL=debug
NODE_ENV=development
```

**Testar componentes individualmente:**

```bash
# Testar notificação de exemplo
curl -X POST http://localhost:5000/api/notifications/test \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "GUEST_CONFIRMED"}'
```

**Verificar estado do sistema:**

```bash
# Status geral
curl http://localhost:5000/health

# Status WebSocket
curl http://localhost:5000/api/websocket/status

# Estatísticas de usuário
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:5000/api/notifications/stats
```

## Extensibilidade

### Adicionando Novos Tipos de Notificação

**1. Atualizar enum no schema Prisma:**

```prisma
enum NotificationType {
  // ... tipos existentes ...
  NEW_NOTIFICATION_TYPE
}
```

**2. Adicionar evento no NotificationEvents:**

```javascript
emitNewNotificationType(eventData) {
  this.emit('new.notification.type', {
    ...eventData,
    timestamp: new Date()
  });
}
```

**3. Implementar handler no NotificationService:**

```javascript
setupEventListeners() {
  // ... listeners existentes ...
  
  notificationEvents.on('new.notification.type', async (eventData) => {
    await this.handleNewNotificationType(eventData);
  });
}
```

### Adicionando Novos Provedores

**1. Implementar interface comum:**

```javascript
class NewNotificationProvider {
  async send(notification, eventData) {
    // Implementar lógica de envio
    return {
      success: true/false,
      error: 'mensagem de erro',
      deliveredAt: new Date()
    };
  }
}
```

**2. Registrar provedor:**

```javascript
const newProvider = new NewNotificationProvider(config, logger);
notificationService.registerProvider('new-channel', newProvider);
```

**3. Atualizar configurações de usuário:**

```prisma
model NotificationSettings {
  // ... campos existentes ...
  newNotificationType Json @default("{\"email\": true, \"websocket\": true, \"new-channel\": false}")
}
```

Esta documentação técnica fornece uma base sólida para compreensão, implementação e manutenção do sistema de notificações, garantindo que desenvolvedores possam efetivamente utilizar e estender suas funcionalidades conforme necessário.

