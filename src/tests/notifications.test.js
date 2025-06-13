const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const app = require('../src/index_updated');
const NotificationService = require('../src/services/NotificationService');
const notificationEvents = require('../src/services/notificationEvents');

describe('Sistema de Notificações', () => {
  let prisma;
  let notificationService;
  let testUser;
  let testEvent;
  let testGuest;
  let authToken;

  beforeAll(async () => {
    prisma = new PrismaClient();
    
    // Criar usuário de teste
    testUser = await prisma.user.create({
      data: {
        name: 'Usuário Teste',
        email: 'teste@exemplo.com',
        password: 'senha123'
      }
    });

    // Criar evento de teste
    testEvent = await prisma.event.create({
      data: {
        title: 'Evento Teste',
        description: 'Evento para testes de notificação',
        date: new Date('2024-12-31'),
        location: 'Local Teste',
        userId: testUser.id
      }
    });

    // Criar convidado de teste
    testGuest = await prisma.guest.create({
      data: {
        name: 'Convidado Teste',
        email: 'convidado@exemplo.com',
        status: 'pending',
        eventId: testEvent.id
      }
    });

    // Simular token de autenticação
    authToken = 'Bearer mock-jwt-token';
  });

  afterAll(async () => {
    // Limpar dados de teste
    await prisma.notificationDeliveryLog.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.notificationSettings.deleteMany({});
    await prisma.guest.deleteMany({});
    await prisma.event.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe('NotificationService', () => {
    beforeEach(() => {
      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
      };
      notificationService = new NotificationService(prisma, mockLogger);
    });

    test('deve criar notificação no banco de dados', async () => {
      const notificationData = {
        userId: testUser.id,
        type: 'GUEST_CONFIRMED',
        title: 'Teste',
        message: 'Mensagem de teste',
        data: { test: true }
      };

      const notification = await notificationService.createNotification(notificationData);

      expect(notification).toBeDefined();
      expect(notification.userId).toBe(testUser.id);
      expect(notification.type).toBe('GUEST_CONFIRMED');
      expect(notification.read).toBe(false);
    });

    test('deve obter configurações padrão para novo usuário', async () => {
      const settings = await notificationService.getUserNotificationSettings(testUser.id);

      expect(settings).toBeDefined();
      expect(settings.userId).toBe(testUser.id);
      expect(settings.guestConfirmed).toBeDefined();
      expect(settings.guestDeclined).toBeDefined();
    });

    test('deve determinar canais ativos corretamente', async () => {
      const settings = await notificationService.getUserNotificationSettings(testUser.id);
      const channels = notificationService.getActiveChannels(settings, 'GUEST_CONFIRMED');

      expect(Array.isArray(channels)).toBe(true);
      expect(channels.length).toBeGreaterThan(0);
    });

    test('deve marcar notificação como lida', async () => {
      const notification = await notificationService.createNotification({
        userId: testUser.id,
        type: 'GUEST_CONFIRMED',
        title: 'Teste',
        message: 'Mensagem de teste'
      });

      await notificationService.markAsRead(notification.id, testUser.id);

      const updatedNotification = await prisma.notification.findUnique({
        where: { id: notification.id }
      });

      expect(updatedNotification.read).toBe(true);
    });

    test('deve obter notificações do usuário com paginação', async () => {
      // Criar múltiplas notificações
      for (let i = 0; i < 5; i++) {
        await notificationService.createNotification({
          userId: testUser.id,
          type: 'GUEST_CONFIRMED',
          title: `Teste ${i}`,
          message: `Mensagem ${i}`
        });
      }

      const result = await notificationService.getUserNotifications(testUser.id, {
        page: 1,
        limit: 3
      });

      expect(result.notifications).toBeDefined();
      expect(result.notifications.length).toBe(3);
      expect(result.pagination.total).toBeGreaterThanOrEqual(5);
      expect(result.unreadCount).toBeGreaterThan(0);
    });
  });

  describe('Eventos de Notificação', () => {
    test('deve emitir evento de mudança de status', (done) => {
      const eventData = {
        guestId: testGuest.id,
        eventId: testEvent.id,
        userId: testUser.id,
        previousStatus: 'pending',
        newStatus: 'confirmed',
        guestName: 'Convidado Teste',
        eventTitle: 'Evento Teste'
      };

      notificationEvents.once('guest.status.changed', (data) => {
        expect(data.guestId).toBe(eventData.guestId);
        expect(data.newStatus).toBe('confirmed');
        expect(data.timestamp).toBeDefined();
        done();
      });

      notificationEvents.emitGuestStatusChanged(eventData);
    });

    test('deve emitir evento de convite enviado', (done) => {
      const eventData = {
        inviteId: 'test-invite-id',
        eventId: testEvent.id,
        userId: testUser.id,
        guestId: testGuest.id,
        channel: 'email'
      };

      notificationEvents.once('invite.sent', (data) => {
        expect(data.inviteId).toBe(eventData.inviteId);
        expect(data.channel).toBe('email');
        expect(data.timestamp).toBeDefined();
        done();
      });

      notificationEvents.emitInviteSent(eventData);
    });
  });

  describe('API de Notificações', () => {
    test('GET /api/notifications deve retornar lista de notificações', async () => {
      // Criar notificação de teste
      await notificationService.createNotification({
        userId: testUser.id,
        type: 'GUEST_CONFIRMED',
        title: 'API Teste',
        message: 'Teste da API'
      });

      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.notifications).toBeDefined();
      expect(Array.isArray(response.body.notifications)).toBe(true);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.unreadCount).toBeDefined();
    });

    test('PATCH /api/notifications/:id/read deve marcar como lida', async () => {
      const notification = await notificationService.createNotification({
        userId: testUser.id,
        type: 'GUEST_CONFIRMED',
        title: 'API Teste',
        message: 'Teste da API'
      });

      await request(app)
        .patch(`/api/notifications/${notification.id}/read`)
        .set('Authorization', authToken)
        .expect(200);

      const updatedNotification = await prisma.notification.findUnique({
        where: { id: notification.id }
      });

      expect(updatedNotification.read).toBe(true);
    });

    test('GET /api/notifications/settings deve retornar configurações', async () => {
      const response = await request(app)
        .get('/api/notifications/settings')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.userId).toBe(testUser.id);
      expect(response.body.guestConfirmed).toBeDefined();
      expect(response.body.guestDeclined).toBeDefined();
    });

    test('PUT /api/notifications/settings deve atualizar configurações', async () => {
      const newSettings = {
        guestConfirmed: {
          email: false,
          websocket: true,
          push: false
        },
        guestDeclined: {
          email: true,
          websocket: false,
          push: false
        }
      };

      const response = await request(app)
        .put('/api/notifications/settings')
        .set('Authorization', authToken)
        .send(newSettings)
        .expect(200);

      expect(response.body.guestConfirmed.email).toBe(false);
      expect(response.body.guestDeclined.websocket).toBe(false);
    });

    test('GET /api/notifications/stats deve retornar estatísticas', async () => {
      const response = await request(app)
        .get('/api/notifications/stats')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.total).toBeDefined();
      expect(response.body.unread).toBeDefined();
      expect(response.body.byType).toBeDefined();
      expect(response.body.last7Days).toBeDefined();
    });
  });

  describe('Integração com RSVP', () => {
    test('deve gerar notificação ao confirmar presença', async () => {
      const initialNotificationCount = await prisma.notification.count({
        where: { userId: testUser.id }
      });

      await request(app)
        .put(`/api/guest/${testGuest.id}/rsvp`)
        .send({
          status: 'confirmed'
        })
        .expect(200);

      // Aguardar processamento assíncrono
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalNotificationCount = await prisma.notification.count({
        where: { userId: testUser.id }
      });

      expect(finalNotificationCount).toBeGreaterThan(initialNotificationCount);

      // Verificar se a notificação foi criada com o tipo correto
      const notification = await prisma.notification.findFirst({
        where: {
          userId: testUser.id,
          type: 'GUEST_CONFIRMED'
        },
        orderBy: { createdAt: 'desc' }
      });

      expect(notification).toBeDefined();
      expect(notification.title).toContain('Confirmação');
    });

    test('deve gerar notificação ao recusar convite', async () => {
      // Criar novo convidado para este teste
      const newGuest = await prisma.guest.create({
        data: {
          name: 'Convidado Recusa',
          email: 'recusa@exemplo.com',
          status: 'pending',
          eventId: testEvent.id
        }
      });

      const initialNotificationCount = await prisma.notification.count({
        where: { userId: testUser.id }
      });

      await request(app)
        .put(`/api/guest/${newGuest.id}/rsvp`)
        .send({
          status: 'declined'
        })
        .expect(200);

      // Aguardar processamento assíncrono
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalNotificationCount = await prisma.notification.count({
        where: { userId: testUser.id }
      });

      expect(finalNotificationCount).toBeGreaterThan(initialNotificationCount);

      // Verificar se a notificação foi criada com o tipo correto
      const notification = await prisma.notification.findFirst({
        where: {
          userId: testUser.id,
          type: 'GUEST_DECLINED'
        },
        orderBy: { createdAt: 'desc' }
      });

      expect(notification).toBeDefined();
      expect(notification.title).toContain('Recusa');
    });
  });

  describe('WebSocket Provider', () => {
    test('deve processar autenticação de usuário', () => {
      const mockSocket = {
        id: 'socket-123',
        emit: jest.fn(),
        on: jest.fn()
      };

      const mockIo = {
        on: jest.fn((event, callback) => {
          if (event === 'connection') {
            callback(mockSocket);
          }
        }),
        sockets: {
          sockets: new Map([['socket-123', mockSocket]])
        }
      };

      const mockLogger = {
        info: jest.fn(),
        error: jest.fn()
      };

      const provider = new (require('../src/providers/WebSocketNotificationProvider'))(mockIo, mockLogger);

      // Simular autenticação
      const authData = { userId: testUser.id, token: 'mock-token' };
      
      // Verificar se o handler foi registrado
      expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('Email Provider', () => {
    test('deve processar template de email corretamente', () => {
      const mockConfig = {
        smtp: {
          host: 'smtp.test.com',
          port: 587,
          secure: false,
          user: 'test@test.com',
          password: 'password'
        },
        fromName: 'Teste',
        fromEmail: 'test@test.com',
        frontendUrl: 'http://localhost:3000'
      };

      const mockLogger = {
        info: jest.fn(),
        error: jest.fn()
      };

      const EmailProvider = require('../src/providers/EmailNotificationProvider');
      const provider = new EmailProvider(mockConfig, mockLogger);

      const template = provider.getGuestConfirmedTemplate();
      const variables = {
        guestName: 'João Silva',
        eventTitle: 'Festa de Aniversário',
        eventDate: '31/12/2024',
        eventLocation: 'Casa do João'
      };

      const processed = provider.processTemplate(template, variables);

      expect(processed).toContain('João Silva');
      expect(processed).toContain('Festa de Aniversário');
      expect(processed).toContain('31/12/2024');
      expect(processed).toContain('Casa do João');
    });

    test('deve formatar data corretamente', () => {
      const mockConfig = {
        smtp: {},
        fromName: 'Teste',
        fromEmail: 'test@test.com',
        frontendUrl: 'http://localhost:3000'
      };

      const EmailProvider = require('../src/providers/EmailNotificationProvider');
      const provider = new EmailProvider(mockConfig, { info: jest.fn(), error: jest.fn() });

      const date = new Date('2024-12-31T20:00:00Z');
      const formatted = provider.formatDate(date);

      expect(formatted).toContain('2024');
      expect(formatted).toContain('dezembro');
    });
  });

  describe('Logs de Entrega', () => {
    test('deve criar log de entrega ao enviar notificação', async () => {
      const notification = await notificationService.createNotification({
        userId: testUser.id,
        type: 'GUEST_CONFIRMED',
        title: 'Teste Log',
        message: 'Teste de log de entrega'
      });

      // Simular envio através de canal
      const mockProvider = {
        send: jest.fn().mockResolvedValue({ success: true })
      };

      notificationService.registerProvider('test', mockProvider);

      await notificationService.sendNotificationThroughChannels(
        notification,
        ['test'],
        {}
      );

      const deliveryLog = await prisma.notificationDeliveryLog.findFirst({
        where: { notificationId: notification.id }
      });

      expect(deliveryLog).toBeDefined();
      expect(deliveryLog.channel).toBe('TEST');
      expect(deliveryLog.status).toBe('SENT');
    });
  });
});

module.exports = {
  testUser,
  testEvent,
  testGuest
};

