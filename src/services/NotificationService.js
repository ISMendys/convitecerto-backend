const notificationEvents = require('./notificationEvents');

/**
 * Serviço principal de notificações
 * Responsável por escutar eventos e coordenar o envio de notificações
 */
class NotificationService {
  constructor(prisma, logger) {
    this.prisma = prisma;
    this.logger = logger;
    this.providers = new Map();
    this.setupEventListeners();
  }

  /**
   * Registra um provedor de notificação
   * @param {string} name - Nome do provedor
   * @param {Object} provider - Instância do provedor
   */
  registerProvider(name, provider) {
    this.providers.set(name, provider);
    this.logger.info(`Provedor de notificação registrado: ${name}`);
  }

  /**
   * Configura os listeners para eventos de notificação
   */
  setupEventListeners() {
    // Listener para mudanças de status de convidados
    notificationEvents.on('guest.status.changed', async (eventData) => {
      await this.handleGuestStatusChanged(eventData);
    });

    // Listener para convites enviados
    notificationEvents.on('invite.sent', async (eventData) => {
      await this.handleInviteSent(eventData);
    });

    // Listener para eventos criados
    notificationEvents.on('event.created', async (eventData) => {
      await this.handleEventCreated(eventData);
    });

    // Listener para eventos atualizados
    notificationEvents.on('event.updated', async (eventData) => {
      await this.handleEventUpdated(eventData);
    });

    // Listener para lembretes de evento
    notificationEvents.on('event.reminder', async (eventData) => {
      await this.handleEventReminder(eventData);
    });

    // Listener para alertas de sistema
    notificationEvents.on('system.alert', async (eventData) => {
      await this.handleSystemAlert(eventData);
    });

    this.logger.info('Listeners de eventos de notificação configurados');
  }

  /**
   * Processa mudanças de status de convidados
   * @param {Object} eventData - Dados do evento
   */
  async handleGuestStatusChanged(eventData) {
    try {
      const { userId, newStatus, guestName, eventTitle, previousStatus } = eventData;

      // Determinar tipo de notificação baseado no novo status
      let notificationType;
      let title;
      let message;

      switch (newStatus) {
        case 'confirmed':
          notificationType = 'GUEST_CONFIRMED';
          title = 'Convite Confirmado';
          message = `${guestName} confirmou presença no evento "${eventTitle}"`;
          break;
        case 'declined':
          notificationType = 'GUEST_DECLINED';
          title = 'Convite Recusado';
          message = `${guestName} recusou o convite para o evento "${eventTitle}"`;
          break;
        default:
          // Para outros status, não enviar notificação
          return;
      }

      // Criar notificação no banco de dados
      const notification = await this.createNotification({
        userId,
        type: notificationType,
        title,
        message,
        data: eventData
      });

      // Obter configurações de notificação do usuário
      const settings = await this.getUserNotificationSettings(userId);

      // Determinar canais ativos para este tipo de notificação
      const activeChannels = this.getActiveChannels(settings, notificationType);

      // Enviar notificação através dos canais ativos
      await this.sendNotificationThroughChannels(notification, activeChannels, eventData);

    } catch (error) {
      this.logger.error('Erro ao processar mudança de status de convidado:', error);
    }
  }

  /**
   * Processa envio de convites
   * @param {Object} eventData - Dados do evento
   */
  async handleInviteSent(eventData) {
    try {
      const { userId } = eventData;
      
      // Obter configurações do usuário
      const settings = await this.getUserNotificationSettings(userId);
      
      // Verificar se notificações de convite enviado estão habilitadas
      const activeChannels = this.getActiveChannels(settings, 'INVITE_SENT');
      
      if (activeChannels.length === 0) {
        return; // Usuário não quer receber este tipo de notificação
      }

      const notification = await this.createNotification({
        userId,
        type: 'INVITE_SENT',
        title: 'Convite Enviado',
        message: `Convite enviado com sucesso`,
        data: eventData
      });

      await this.sendNotificationThroughChannels(notification, activeChannels, eventData);

    } catch (error) {
      this.logger.error('Erro ao processar envio de convite:', error);
    }
  }

  /**
   * Processa criação de eventos
   * @param {Object} eventData - Dados do evento
   */
  async handleEventCreated(eventData) {
    // Implementação para notificações de evento criado
    // Por enquanto, apenas log
    this.logger.info('Evento criado:', eventData);
  }

  /**
   * Processa atualizações de eventos
   * @param {Object} eventData - Dados do evento
   */
  async handleEventUpdated(eventData) {
    // Implementação para notificações de evento atualizado
    this.logger.info('Evento atualizado:', eventData);
  }

  /**
   * Processa lembretes de eventos
   * @param {Object} eventData - Dados do evento
   */
  async handleEventReminder(eventData) {
    // Implementação para lembretes de evento
    this.logger.info('Lembrete de evento:', eventData);
  }

  /**
   * Processa alertas de sistema
   * @param {Object} eventData - Dados do evento
   */
  async handleSystemAlert(eventData) {
    // Implementação para alertas de sistema
    this.logger.info('Alerta de sistema:', eventData);
  }

  /**
   * Cria uma notificação no banco de dados
   * @param {Object} notificationData - Dados da notificação
   * @returns {Object} Notificação criada
   */
  async createNotification(notificationData) {
    return await this.prisma.notification.create({
      data: notificationData
    });
  }

  /**
   * Obtém configurações de notificação do usuário
   * @param {string} userId - ID do usuário
   * @returns {Object} Configurações de notificação
   */
  async getUserNotificationSettings(userId) {
    let settings = await this.prisma.notificationSettings.findUnique({
      where: { userId }
    });

    // Se não existir configuração, criar uma padrão
    if (!settings) {
      settings = await this.prisma.notificationSettings.create({
        data: {
          userId,
          guestConfirmed: { email: true, websocket: true, push: false },
          guestDeclined: { email: true, websocket: true, push: false },
          inviteSent: { email: false, websocket: true, push: false },
          eventReminder: { email: true, websocket: false, push: true }
        }
      });
    }

    return settings;
  }

  /**
   * Determina canais ativos para um tipo de notificação
   * @param {Object} settings - Configurações do usuário
   * @param {string} notificationType - Tipo da notificação
   * @returns {Array} Lista de canais ativos
   */
  getActiveChannels(settings, notificationType) {
    const channels = [];
    let channelConfig;

    switch (notificationType) {
      case 'GUEST_CONFIRMED':
        channelConfig = settings.guestConfirmed;
        break;
      case 'GUEST_DECLINED':
        channelConfig = settings.guestDeclined;
        break;
      case 'INVITE_SENT':
        channelConfig = settings.inviteSent;
        break;
      case 'EVENT_REMINDER':
        channelConfig = settings.eventReminder;
        break;
      default:
        return channels;
    }

    if (channelConfig.email) channels.push('email');
    if (channelConfig.websocket) channels.push('websocket');
    if (channelConfig.push) channels.push('push');

    return channels;
  }

  /**
   * Envia notificação através dos canais especificados
   * @param {Object} notification - Notificação a ser enviada
   * @param {Array} channels - Canais para envio
   * @param {Object} eventData - Dados do evento original
   */
  async sendNotificationThroughChannels(notification, channels, eventData) {
    const promises = channels.map(async (channel) => {
      const provider = this.providers.get(channel);
      if (!provider) {
        this.logger.warn(`Provedor não encontrado para canal: ${channel}`);
        return;
      }

      try {
        // Log de tentativa de entrega
        const deliveryLog = await this.prisma.notificationDeliveryLog.create({
          data: {
            notificationId: notification.id,
            channel: channel.toUpperCase(),
            status: 'PENDING'
          }
        });

        // Enviar notificação
        const result = await provider.send(notification, eventData);

        // Atualizar log de entrega
        await this.prisma.notificationDeliveryLog.update({
          where: { id: deliveryLog.id },
          data: {
            status: result.success ? 'SENT' : 'FAILED',
            deliveredAt: result.success ? new Date() : null,
            errorMessage: result.error || null
          }
        });

        if (result.success) {
          this.logger.info(`Notificação enviada via ${channel}:`, notification.id);
        } else {
          this.logger.error(`Falha ao enviar notificação via ${channel}:`, result.error);
        }

      } catch (error) {
        this.logger.error(`Erro ao enviar notificação via ${channel}:`, error);
        
        // Atualizar log com erro
        await this.prisma.notificationDeliveryLog.updateMany({
          where: {
            notificationId: notification.id,
            channel: channel.toUpperCase(),
            status: 'PENDING'
          },
          data: {
            status: 'FAILED',
            errorMessage: error.message
          }
        });
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Marca uma notificação como lida
   * @param {string} notificationId - ID da notificação
   * @param {string} userId - ID do usuário (para validação)
   */
  async markAsRead(notificationId, userId) {
    await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId: userId
      },
      data: {
        read: true,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Obtém notificações de um usuário
   * @param {string} userId - ID do usuário
   * @param {Object} options - Opções de filtragem e paginação
   * @returns {Object} Lista de notificações e metadados
   */
  async getUserNotifications(userId, options = {}) {
    const {
      page = 1,
      limit = 20,
      unreadOnly = false,
      type = null
    } = options;

    const where = { userId };
    if (unreadOnly) where.read = false;
    if (type) where.type = type;

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { userId, read: false }
      })
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      unreadCount
    };
  }
}

module.exports = NotificationService;

