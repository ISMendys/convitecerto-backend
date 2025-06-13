const nodemailer = require('nodemailer');

/**
 * Provedor de notificações por Email
 * Responsável por enviar notificações via email usando templates HTML
 */
class EmailNotificationProvider {
  constructor(config, logger) {
    this.logger = logger;
    this.config = config;
    this.transporter = this.createTransporter();
    this.templates = this.loadTemplates();
  }

  /**
   * Cria o transporter do nodemailer
   */
  createTransporter() {
    const transportConfig = {
      host: this.config.smtp.host,
      port: this.config.smtp.port,
      secure: this.config.smtp.secure, // true para 465, false para outras portas
      auth: {
        user: this.config.smtp.user,
        pass: this.config.smtp.password
      }
    };

    // Para desenvolvimento, usar Ethereal Email ou configuração local
    if (process.env.NODE_ENV === 'development' && !this.config.smtp.host) {
      transportConfig.host = 'smtp.ethereal.email';
      transportConfig.port = 587;
      transportConfig.secure = false;
      transportConfig.auth = {
        user: 'ethereal.user@ethereal.email',
        pass: 'ethereal.pass'
      };
    }

    return nodemailer.createTransport(transportConfig);
  }

  /**
   * Carrega templates de email
   */
  loadTemplates() {
    return {
      GUEST_CONFIRMED: {
        subject: '✅ Confirmação de Presença - {{eventTitle}}',
        template: this.getGuestConfirmedTemplate()
      },
      GUEST_DECLINED: {
        subject: '❌ Recusa de Convite - {{eventTitle}}',
        template: this.getGuestDeclinedTemplate()
      },
      INVITE_SENT: {
        subject: '📧 Convite Enviado - {{eventTitle}}',
        template: this.getInviteSentTemplate()
      },
      EVENT_REMINDER: {
        subject: '⏰ Lembrete de Evento - {{eventTitle}}',
        template: this.getEventReminderTemplate()
      }
    };
  }

  /**
   * Template para confirmação de presença
   */
  getGuestConfirmedTemplate() {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirmação de Presença</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; }
            .event-info { background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .guest-info { background-color: #e8f5e8; padding: 15px; border-radius: 8px; border-left: 4px solid #4CAF50; }
            .footer { background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .btn { display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>✅ Confirmação de Presença</h1>
            </div>
            <div class="content">
                <h2>Ótimas notícias!</h2>
                <div class="guest-info">
                    <strong>{{guestName}}</strong> confirmou presença no seu evento!
                </div>
                
                <div class="event-info">
                    <h3>{{eventTitle}}</h3>
                    <p><strong>Data:</strong> {{eventDate}}</p>
                    <p><strong>Local:</strong> {{eventLocation}}</p>
                </div>

                <p>Você pode visualizar todos os convidados e suas confirmações no painel de gerenciamento do evento.</p>
                
                <a href="{{dashboardUrl}}" class="btn">Ver Painel do Evento</a>
            </div>
            <div class="footer">
                <p>Esta é uma notificação automática do sistema Convite Certo.</p>
                <p>Para alterar suas preferências de notificação, acesse suas configurações.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Template para recusa de convite
   */
  getGuestDeclinedTemplate() {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recusa de Convite</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background-color: #f44336; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; }
            .event-info { background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .guest-info { background-color: #ffebee; padding: 15px; border-radius: 8px; border-left: 4px solid #f44336; }
            .footer { background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .btn { display: inline-block; padding: 12px 24px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>❌ Recusa de Convite</h1>
            </div>
            <div class="content">
                <h2>Informação sobre seu evento</h2>
                <div class="guest-info">
                    <strong>{{guestName}}</strong> recusou o convite para o seu evento.
                </div>
                
                <div class="event-info">
                    <h3>{{eventTitle}}</h3>
                    <p><strong>Data:</strong> {{eventDate}}</p>
                    <p><strong>Local:</strong> {{eventLocation}}</p>
                </div>

                <p>Você pode visualizar o status atualizado de todos os convidados no painel de gerenciamento.</p>
                
                <a href="{{dashboardUrl}}" class="btn">Ver Painel do Evento</a>
            </div>
            <div class="footer">
                <p>Esta é uma notificação automática do sistema Convite Certo.</p>
                <p>Para alterar suas preferências de notificação, acesse suas configurações.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Template para convite enviado
   */
  getInviteSentTemplate() {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Convite Enviado</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; }
            .event-info { background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .btn { display: inline-block; padding: 12px 24px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📧 Convite Enviado</h1>
            </div>
            <div class="content">
                <h2>Convite enviado com sucesso!</h2>
                <p>Seu convite foi enviado para os convidados selecionados.</p>
                
                <div class="event-info">
                    <h3>{{eventTitle}}</h3>
                    <p><strong>Data:</strong> {{eventDate}}</p>
                    <p><strong>Convites enviados:</strong> {{inviteCount}}</p>
                </div>

                <p>Você receberá notificações quando os convidados responderem aos convites.</p>
                
                <a href="{{dashboardUrl}}" class="btn">Acompanhar Respostas</a>
            </div>
            <div class="footer">
                <p>Esta é uma notificação automática do sistema Convite Certo.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Template para lembrete de evento
   */
  getEventReminderTemplate() {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Lembrete de Evento</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background-color: #FF9800; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; }
            .event-info { background-color: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FF9800; }
            .footer { background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .btn { display: inline-block; padding: 12px 24px; background-color: #FF9800; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>⏰ Lembrete de Evento</h1>
            </div>
            <div class="content">
                <h2>Seu evento está se aproximando!</h2>
                
                <div class="event-info">
                    <h3>{{eventTitle}}</h3>
                    <p><strong>Data:</strong> {{eventDate}}</p>
                    <p><strong>Local:</strong> {{eventLocation}}</p>
                    <p><strong>Confirmados:</strong> {{confirmedCount}} convidados</p>
                </div>

                <p>Não se esqueça de fazer os preparativos finais para seu evento!</p>
                
                <a href="{{dashboardUrl}}" class="btn">Ver Detalhes do Evento</a>
            </div>
            <div class="footer">
                <p>Esta é uma notificação automática do sistema Convite Certo.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Substitui variáveis no template
   * @param {string} template - Template HTML
   * @param {Object} variables - Variáveis para substituição
   * @returns {string} Template processado
   */
  processTemplate(template, variables) {
    let processed = template;
    
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(regex, variables[key] || '');
    });

    return processed;
  }

  /**
   * Envia notificação por email
   * @param {Object} notification - Dados da notificação
   * @param {Object} eventData - Dados do evento original
   * @returns {Object} Resultado do envio
   */
  async send(notification, eventData) {
    try {
      // Buscar dados do usuário para obter email
      const user = await this.getUserEmail(notification.userId);
      if (!user || !user.email) {
        return {
          success: false,
          error: 'Email do usuário não encontrado'
        };
      }

      // Obter template para o tipo de notificação
      const templateData = this.templates[notification.type];
      if (!templateData) {
        return {
          success: false,
          error: `Template não encontrado para tipo: ${notification.type}`
        };
      }

      // Preparar variáveis para o template
      const templateVariables = {
        guestName: eventData.guestName || 'Convidado',
        eventTitle: eventData.eventTitle || 'Evento',
        eventDate: this.formatDate(eventData.eventDate),
        eventLocation: eventData.eventLocation || 'Local não informado',
        dashboardUrl: `${this.config.frontendUrl}/dashboard/events/${eventData.eventId}`,
        inviteCount: eventData.inviteCount || 1,
        confirmedCount: eventData.confirmedCount || 0
      };

      // Processar template
      const htmlContent = this.processTemplate(templateData.template, templateVariables);
      const subject = this.processTemplate(templateData.subject, templateVariables);

      // Configurar email
      const mailOptions = {
        from: `"${this.config.fromName}" <${this.config.fromEmail}>`,
        to: user.email,
        subject: subject,
        html: htmlContent,
        // Versão texto simples como fallback
        text: this.htmlToText(htmlContent)
      };

      // Enviar email
      const info = await this.transporter.sendMail(mailOptions);

      this.logger.info(`Email enviado para ${user.email}:`, info.messageId);

      return {
        success: true,
        deliveredAt: new Date(),
        messageId: info.messageId
      };

    } catch (error) {
      this.logger.error('Erro ao enviar email:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Busca email do usuário (mock - implementar com Prisma real)
   * @param {string} userId - ID do usuário
   * @returns {Object} Dados do usuário
   */
  async getUserEmail(userId) {
    // Esta função deve ser implementada para buscar o email do usuário no banco
    // Por enquanto, retornando um mock
    return {
      email: 'usuario@exemplo.com' // Substituir por consulta real ao banco
    };
  }

  /**
   * Formata data para exibição
   * @param {Date|string} date - Data para formatar
   * @returns {string} Data formatada
   */
  formatDate(date) {
    if (!date) return 'Data não informada';
    
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Converte HTML para texto simples
   * @param {string} html - Conteúdo HTML
   * @returns {string} Texto simples
   */
  htmlToText(html) {
    return html
      .replace(/<[^>]*>/g, '') // Remove tags HTML
      .replace(/\s+/g, ' ') // Normaliza espaços
      .trim();
  }

  /**
   * Testa configuração de email
   * @returns {Object} Resultado do teste
   */
  async testConnection() {
    try {
      await this.transporter.verify();
      return { success: true, message: 'Configuração de email válida' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = EmailNotificationProvider;

