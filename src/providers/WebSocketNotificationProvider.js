/**
 * Provedor de notificações WebSocket
 * Responsável por enviar notificações em tempo real via Socket.IO
 */
class WebSocketNotificationProvider {
    constructor(io, logger) {
      this.io = io;
      this.logger = logger;
      this.connectedUsers = new Map(); // Map de userId -> socket.id
      this.setupSocketHandlers();
    }
  
    /**
     * Configura handlers para conexões WebSocket
     */
    setupSocketHandlers() {
      this.io.on('connection', (socket) => {
        this.logger.info(`Nova conexão WebSocket: ${socket.id}`);
  
        // Handler para autenticação do usuário
        socket.on('authenticate', (data) => {
          try {
            const { userId, token } = data;
            
            // Aqui você pode validar o token JWT se necessário
            // Por simplicidade, vamos assumir que o userId é válido
            
            this.connectedUsers.set(userId, socket.id);
            socket.userId = userId;
            
            socket.emit('authenticated', { success: true });
            this.logger.info(`Usuário autenticado via WebSocket: ${userId}`);
            
          } catch (error) {
            socket.emit('authenticated', { success: false, error: 'Token inválido' });
            this.logger.error('Erro na autenticação WebSocket:', error);
          }
        });
  
        // Handler para desconexão
        socket.on('disconnect', () => {
          if (socket.userId) {
            this.connectedUsers.delete(socket.userId);
            this.logger.info(`Usuário desconectado: ${socket.userId}`);
          }
        });
  
        // Handler para marcar notificação como lida
        socket.on('mark_notification_read', (data) => {
          const { notificationId } = data;
          // Emitir evento para outros componentes se necessário
          socket.emit('notification_marked_read', { notificationId });
        });
      });
    }
  
    /**
     * Envia notificação via WebSocket
     * @param {Object} notification - Dados da notificação
     * @param {Object} eventData - Dados do evento original
     * @returns {Object} Resultado do envio
     */
    async send(notification, eventData) {
      try {
        const { userId } = notification;
        const socketId = this.connectedUsers.get(userId);
  
        if (!socketId) {
          // Usuário não está conectado
          return {
            success: false,
            error: 'Usuário não conectado via WebSocket'
          };
        }
  
        const socket = this.io.sockets.sockets.get(socketId);
        if (!socket) {
          // Socket não existe mais, remover do mapa
          this.connectedUsers.delete(userId);
          return {
            success: false,
            error: 'Socket não encontrado'
          };
        }
  
        // Preparar payload da notificação
        const payload = {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          timestamp: notification.createdAt,
          read: notification.read
        };
  
        // Enviar notificação
        socket.emit('notification', payload);
  
        this.logger.info(`Notificação WebSocket enviada para usuário ${userId}:`, notification.id);
  
        return {
          success: true,
          deliveredAt: new Date()
        };
  
      } catch (error) {
        this.logger.error('Erro ao enviar notificação WebSocket:', error);
        return {
          success: false,
          error: error.message
        };
      }
    }
  
    /**
     * Envia notificação para múltiplos usuários
     * @param {Array} userIds - Lista de IDs de usuários
     * @param {Object} notificationData - Dados da notificação
     */
    async broadcast(userIds, notificationData) {
      const results = [];
  
      for (const userId of userIds) {
        const result = await this.send({ ...notificationData, userId }, {});
        results.push({ userId, ...result });
      }
  
      return results;
    }
  
    /**
     * Obtém lista de usuários conectados
     * @returns {Array} Lista de IDs de usuários conectados
     */
    getConnectedUsers() {
      return Array.from(this.connectedUsers.keys());
    }
  
    /**
     * Verifica se um usuário está conectado
     * @param {string} userId - ID do usuário
     * @returns {boolean} True se o usuário estiver conectado
     */
    isUserConnected(userId) {
      return this.connectedUsers.has(userId);
    }
  
    /**
     * Desconecta um usuário específico
     * @param {string} userId - ID do usuário
     */
    disconnectUser(userId) {
      const socketId = this.connectedUsers.get(userId);
      if (socketId) {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
        }
        this.connectedUsers.delete(userId);
      }
    }
  
    /**
     * Envia mensagem de sistema para todos os usuários conectados
     * @param {Object} message - Mensagem do sistema
     */
    sendSystemMessage(message) {
      this.io.emit('system_message', {
        ...message,
        timestamp: new Date()
      });
    }
  
    /**
     * Obtém estatísticas de conexões
     * @returns {Object} Estatísticas
     */
    getStats() {
      return {
        connectedUsers: this.connectedUsers.size,
        totalSockets: this.io.sockets.sockets.size,
        userSocketMap: Object.fromEntries(this.connectedUsers)
      };
    }
  }
  
  module.exports = WebSocketNotificationProvider;
  
  