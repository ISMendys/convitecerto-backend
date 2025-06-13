const express = require('express');
const { authenticate } = require('./auth.routes');
const Joi = require('joi');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Notifications
 *     description: Endpoints para gerenciamento de notificações
 */

// Esquema de validação para configurações de notificação
const notificationSettingsSchema = Joi.object({
  guestConfirmed: Joi.object({
    email: Joi.boolean().default(true),
    websocket: Joi.boolean().default(true),
    push: Joi.boolean().default(false)
  }).default(),
  guestDeclined: Joi.object({
    email: Joi.boolean().default(true),
    websocket: Joi.boolean().default(true),
    push: Joi.boolean().default(false)
  }).default(),
  inviteSent: Joi.object({
    email: Joi.boolean().default(false),
    websocket: Joi.boolean().default(true),
    push: Joi.boolean().default(false)
  }).default(),
  eventReminder: Joi.object({
    email: Joi.boolean().default(true),
    websocket: Joi.boolean().default(false),
    push: Joi.boolean().default(true)
  }).default(),
  digestFrequency: Joi.string().valid('NONE', 'DAILY', 'WEEKLY').default('NONE'),
  quietHoursStart: Joi.number().min(0).max(23).allow(null),
  quietHoursEnd: Joi.number().min(0).max(23).allow(null),
  timezone: Joi.string().default('America/Sao_Paulo')
});

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Lista notificações do usuário autenticado
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Número de itens por página
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Filtrar apenas notificações não lidas
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [GUEST_CONFIRMED, GUEST_DECLINED, INVITE_SENT, EVENT_REMINDER]
 *         description: Filtrar por tipo de notificação
 *     responses:
 *       200:
 *         description: Lista de notificações recuperada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notifications:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *                 unreadCount:
 *                   type: integer
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false, type } = req.query;
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      unreadOnly: unreadOnly === 'true',
      type: type || null
    };

    const result = await req.notificationService.getUserNotifications(req.user.id, options);
    
    res.status(200).json(result);
  } catch (error) {
    req.logger.error('Erro ao listar notificações:', error);
    res.status(500).json({ error: 'Erro ao listar notificações' });
  }
});

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   patch:
 *     summary: Marca uma notificação como lida
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da notificação
 *     responses:
 *       200:
 *         description: Notificação marcada como lida com sucesso
 *       404:
 *         description: Notificação não encontrada
 *       500:
 *         description: Erro interno do servidor
 */
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    await req.notificationService.markAsRead(id, req.user.id);
    
    res.status(200).json({ message: 'Notificação marcada como lida' });
  } catch (error) {
    req.logger.error('Erro ao marcar notificação como lida:', error);
    res.status(500).json({ error: 'Erro ao marcar notificação como lida' });
  }
});

/**
 * @swagger
 * /api/notifications/mark-all-read:
 *   patch:
 *     summary: Marca todas as notificações como lidas
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Todas as notificações marcadas como lidas
 *       500:
 *         description: Erro interno do servidor
 */
router.patch('/mark-all-read', authenticate, async (req, res) => {
  try {
    await req.prisma.notification.updateMany({
      where: {
        userId: req.user.id,
        read: false
      },
      data: {
        read: true,
        updatedAt: new Date()
      }
    });
    
    res.status(200).json({ message: 'Todas as notificações marcadas como lidas' });
  } catch (error) {
    req.logger.error('Erro ao marcar todas as notificações como lidas:', error);
    res.status(500).json({ error: 'Erro ao marcar todas as notificações como lidas' });
  }
});

/**
 * @swagger
 * /api/notifications/settings:
 *   get:
 *     summary: Obtém configurações de notificação do usuário
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configurações de notificação recuperadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationSettings'
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/settings', authenticate, async (req, res) => {
  try {
    const settings = await req.notificationService.getUserNotificationSettings(req.user.id);
    
    res.status(200).json(settings);
  } catch (error) {
    req.logger.error('Erro ao obter configurações de notificação:', error);
    res.status(500).json({ error: 'Erro ao obter configurações de notificação' });
  }
});

/**
 * @swagger
 * /api/notifications/settings:
 *   put:
 *     summary: Atualiza configurações de notificação do usuário
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NotificationSettingsInput'
 *     responses:
 *       200:
 *         description: Configurações atualizadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationSettings'
 *       400:
 *         description: Erro de validação nos dados fornecidos
 *       500:
 *         description: Erro interno do servidor
 */
router.put('/settings', authenticate, async (req, res) => {
  try {
    // Validar dados de entrada
    const { error, value } = notificationSettingsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Atualizar ou criar configurações
    const settings = await req.prisma.notificationSettings.upsert({
      where: { userId: req.user.id },
      update: {
        ...value,
        updatedAt: new Date()
      },
      create: {
        userId: req.user.id,
        ...value
      }
    });

    res.status(200).json(settings);
  } catch (error) {
    req.logger.error('Erro ao atualizar configurações de notificação:', error);
    res.status(500).json({ error: 'Erro ao atualizar configurações de notificação' });
  }
});

/**
 * @swagger
 * /api/notifications/stats:
 *   get:
 *     summary: Obtém estatísticas de notificações do usuário
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas recuperadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   description: Total de notificações
 *                 unread:
 *                   type: integer
 *                   description: Notificações não lidas
 *                 byType:
 *                   type: object
 *                   description: Contagem por tipo de notificação
 *                 last7Days:
 *                   type: integer
 *                   description: Notificações dos últimos 7 dias
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [total, unread, byType, last7Days] = await Promise.all([
      // Total de notificações
      req.prisma.notification.count({
        where: { userId }
      }),
      
      // Notificações não lidas
      req.prisma.notification.count({
        where: { userId, read: false }
      }),
      
      // Contagem por tipo
      req.prisma.notification.groupBy({
        by: ['type'],
        where: { userId },
        _count: { type: true }
      }),
      
      // Últimos 7 dias
      req.prisma.notification.count({
        where: {
          userId,
          createdAt: { gte: sevenDaysAgo }
        }
      })
    ]);

    // Formatar contagem por tipo
    const typeStats = {};
    byType.forEach(item => {
      typeStats[item.type] = item._count.type;
    });

    res.status(200).json({
      total,
      unread,
      byType: typeStats,
      last7Days
    });
  } catch (error) {
    req.logger.error('Erro ao obter estatísticas de notificações:', error);
    res.status(500).json({ error: 'Erro ao obter estatísticas de notificações' });
  }
});

/**
 * @swagger
 * /api/notifications/test:
 *   post:
 *     summary: Envia notificação de teste (apenas desenvolvimento)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [GUEST_CONFIRMED, GUEST_DECLINED, INVITE_SENT, EVENT_REMINDER]
 *               title:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Notificação de teste enviada
 *       400:
 *         description: Dados inválidos
 *       403:
 *         description: Disponível apenas em desenvolvimento
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/test', authenticate, async (req, res) => {
  // Disponível apenas em desenvolvimento
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Endpoint disponível apenas em desenvolvimento' });
  }

  try {
    const { type = 'GUEST_CONFIRMED', title = 'Teste', message = 'Esta é uma notificação de teste' } = req.body;

    // Criar notificação de teste
    const notification = await req.notificationService.createNotification({
      userId: req.user.id,
      type,
      title,
      message,
      data: {
        test: true,
        guestName: 'João Silva',
        eventTitle: 'Evento de Teste',
        eventDate: new Date(),
        eventLocation: 'Local de Teste'
      }
    });

    // Obter configurações do usuário
    const settings = await req.notificationService.getUserNotificationSettings(req.user.id);
    
    // Determinar canais ativos
    const activeChannels = req.notificationService.getActiveChannels(settings, type);
    
    // Enviar através dos canais ativos
    await req.notificationService.sendNotificationThroughChannels(
      notification, 
      activeChannels, 
      notification.data
    );

    res.status(200).json({ 
      message: 'Notificação de teste enviada',
      notification,
      channels: activeChannels
    });
  } catch (error) {
    req.logger.error('Erro ao enviar notificação de teste:', error);
    res.status(500).json({ error: 'Erro ao enviar notificação de teste' });
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         userId:
 *           type: string
 *         type:
 *           type: string
 *           enum: [GUEST_CONFIRMED, GUEST_DECLINED, INVITE_SENT, EVENT_REMINDER]
 *         title:
 *           type: string
 *         message:
 *           type: string
 *         data:
 *           type: object
 *         read:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     NotificationSettings:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         userId:
 *           type: string
 *         guestConfirmed:
 *           type: object
 *           properties:
 *             email:
 *               type: boolean
 *             websocket:
 *               type: boolean
 *             push:
 *               type: boolean
 *         guestDeclined:
 *           type: object
 *           properties:
 *             email:
 *               type: boolean
 *             websocket:
 *               type: boolean
 *             push:
 *               type: boolean
 *         inviteSent:
 *           type: object
 *           properties:
 *             email:
 *               type: boolean
 *             websocket:
 *               type: boolean
 *             push:
 *               type: boolean
 *         eventReminder:
 *           type: object
 *           properties:
 *             email:
 *               type: boolean
 *             websocket:
 *               type: boolean
 *             push:
 *               type: boolean
 *         digestFrequency:
 *           type: string
 *           enum: [NONE, DAILY, WEEKLY]
 *         quietHoursStart:
 *           type: integer
 *           minimum: 0
 *           maximum: 23
 *         quietHoursEnd:
 *           type: integer
 *           minimum: 0
 *           maximum: 23
 *         timezone:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     NotificationSettingsInput:
 *       type: object
 *       properties:
 *         guestConfirmed:
 *           type: object
 *           properties:
 *             email:
 *               type: boolean
 *             websocket:
 *               type: boolean
 *             push:
 *               type: boolean
 *         guestDeclined:
 *           type: object
 *           properties:
 *             email:
 *               type: boolean
 *             websocket:
 *               type: boolean
 *             push:
 *               type: boolean
 *         inviteSent:
 *           type: object
 *           properties:
 *             email:
 *               type: boolean
 *             websocket:
 *               type: boolean
 *             push:
 *               type: boolean
 *         eventReminder:
 *           type: object
 *           properties:
 *             email:
 *               type: boolean
 *             websocket:
 *               type: boolean
 *             push:
 *               type: boolean
 *         digestFrequency:
 *           type: string
 *           enum: [NONE, DAILY, WEEKLY]
 *         quietHoursStart:
 *           type: integer
 *           minimum: 0
 *           maximum: 23
 *         quietHoursEnd:
 *           type: integer
 *           minimum: 0
 *           maximum: 23
 *         timezone:
 *           type: string
 */

module.exports = { router };

