const EventEmitter = require('events');

/**
 * Sistema de eventos centralizado para o sistema de notificações
 * Utiliza o EventEmitter nativo do Node.js para gerenciar eventos
 */
class NotificationEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // Aumenta o limite de listeners para suportar múltiplos provedores
  }

  /**
   * Emite evento quando um convidado muda de status
   * @param {Object} eventData - Dados do evento
   * @param {string} eventData.guestId - ID do convidado
   * @param {string} eventData.eventId - ID do evento
   * @param {string} eventData.userId - ID do organizador do evento
   * @param {string} eventData.previousStatus - Status anterior
   * @param {string} eventData.newStatus - Novo status
   * @param {string} eventData.guestName - Nome do convidado
   * @param {string} eventData.eventTitle - Título do evento
   * @param {Date} eventData.timestamp - Timestamp da mudança
   */
  emitGuestStatusChanged(eventData) {
    this.emit('guest.status.changed', {
      ...eventData,
      timestamp: eventData.timestamp || new Date()
    });
  }

  /**
   * Emite evento quando um convite é enviado
   * @param {Object} eventData - Dados do evento
   * @param {string} eventData.inviteId - ID do convite
   * @param {string} eventData.eventId - ID do evento
   * @param {string} eventData.userId - ID do organizador
   * @param {string} eventData.guestId - ID do convidado
   * @param {string} eventData.channel - Canal de envio (email, whatsapp, etc)
   */
  emitInviteSent(eventData) {
    this.emit('invite.sent', {
      ...eventData,
      timestamp: new Date()
    });
  }

  /**
   * Emite evento quando um evento é criado
   * @param {Object} eventData - Dados do evento
   * @param {string} eventData.eventId - ID do evento
   * @param {string} eventData.userId - ID do organizador
   * @param {string} eventData.eventTitle - Título do evento
   * @param {Date} eventData.eventDate - Data do evento
   */
  emitEventCreated(eventData) {
    this.emit('event.created', {
      ...eventData,
      timestamp: new Date()
    });
  }

  /**
   * Emite evento quando um evento é atualizado
   * @param {Object} eventData - Dados do evento
   * @param {string} eventData.eventId - ID do evento
   * @param {string} eventData.userId - ID do organizador
   * @param {Object} eventData.changes - Mudanças realizadas
   */
  emitEventUpdated(eventData) {
    this.emit('event.updated', {
      ...eventData,
      timestamp: new Date()
    });
  }

  /**
   * Emite evento para lembretes de evento
   * @param {Object} eventData - Dados do evento
   * @param {string} eventData.eventId - ID do evento
   * @param {string} eventData.userId - ID do organizador
   * @param {string} eventData.reminderType - Tipo do lembrete (1day, 1hour, etc)
   */
  emitEventReminder(eventData) {
    this.emit('event.reminder', {
      ...eventData,
      timestamp: new Date()
    });
  }

  /**
   * Emite evento de sistema/alerta
   * @param {Object} eventData - Dados do evento
   * @param {string} eventData.userId - ID do usuário (opcional)
   * @param {string} eventData.alertType - Tipo do alerta
   * @param {string} eventData.message - Mensagem do alerta
   * @param {string} eventData.severity - Severidade (info, warning, error)
   */
  emitSystemAlert(eventData) {
    this.emit('system.alert', {
      ...eventData,
      timestamp: new Date()
    });
  }
}

// Instância singleton do event emitter
const notificationEvents = new NotificationEventEmitter();

module.exports = notificationEvents;

