const express = require('express');
const { authenticate } = require('./auth.routes');
const router = express.Router();
const twilio = require('twilio');

// Configuração do cliente Twilio
let twilioClient;
try {
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
} catch (error) {
  console.warn('Aviso: Credenciais do Twilio não configuradas. Usando modo de simulação.');
}

// Função para simular envio de mensagem (para MVP sem credenciais reais)
const mockSendWhatsApp = async (to, body) => {
  return {
    sid: `mock-${Date.now()}`,
    to,
    body,
    status: 'sent',
    dateCreated: new Date()
  };
};

// Enviar convite via WhatsApp
router.post('/send-invite', authenticate, async (req, res) => {
  try {
    const { guestId, message, inviteLink } = req.body;
    
    if (!guestId || !message || !inviteLink) {
      return res.status(400).json({ error: 'Dados incompletos para envio de convite' });
    }
    
    // Buscar convidado
    const guest = await req.prisma.guest.findUnique({
      where: { id: guestId },
      include: {
        event: true
      }
    });
    
    if (!guest) {
      return res.status(404).json({ error: 'Convidado não encontrado' });
    }
    
    // Verificar se o convidado pertence a um evento do usuário
    if (guest.event.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    // Verificar se o convidado tem número de telefone
    if (!guest.phone) {
      return res.status(400).json({ error: 'Convidado não possui número de telefone' });
    }
    
    // Formatar o número de telefone (remover caracteres não numéricos e adicionar código do país se necessário)
    let formattedPhone = guest.phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('+')) {
      // Assumir Brasil como padrão se não tiver código de país
      formattedPhone = `+55${formattedPhone}`;
    }
    
    // Preparar mensagem completa
    const fullMessage = `${message}\n\nPara confirmar sua presença, acesse: ${inviteLink}`;
    
    let result;
    
    // Enviar mensagem via Twilio ou simular no modo de desenvolvimento
    if (twilioClient && process.env.TWILIO_WHATSAPP_FROM) {
      result = await twilioClient.messages.create({
        body: fullMessage,
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
        to: `whatsapp:${formattedPhone}`
      });
    } else {
      // Modo de simulação para desenvolvimento/MVP
      result = await mockSendWhatsApp(formattedPhone, fullMessage);
      req.logger.info('Simulando envio de WhatsApp:', { to: formattedPhone, message: fullMessage });
    }
    
    // Registrar mensagem no banco de dados
    const messageRecord = await req.prisma.message.create({
      data: {
        type: 'invite',
        content: fullMessage,
        status: 'sent',
        guestId: guest.id
      }
    });
    
    res.status(200).json({
      success: true,
      messageId: messageRecord.id,
      twilioSid: result.sid
    });
  } catch (error) {
    req.logger.error('Erro ao enviar convite via WhatsApp:', error);
    res.status(500).json({ error: 'Erro ao enviar convite via WhatsApp' });
  }
});

// Enviar lembrete via WhatsApp
router.post('/send-reminder', authenticate, async (req, res) => {
  try {
    const { guestId, message } = req.body;
    
    if (!guestId || !message) {
      return res.status(400).json({ error: 'Dados incompletos para envio de lembrete' });
    }
    
    // Buscar convidado
    const guest = await req.prisma.guest.findUnique({
      where: { id: guestId },
      include: {
        event: true
      }
    });
    
    if (!guest) {
      return res.status(404).json({ error: 'Convidado não encontrado' });
    }
    
    // Verificar se o convidado pertence a um evento do usuário
    if (guest.event.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    // Verificar se o convidado tem número de telefone
    if (!guest.phone) {
      return res.status(400).json({ error: 'Convidado não possui número de telefone' });
    }
    
    // Formatar o número de telefone
    let formattedPhone = guest.phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = `+55${formattedPhone}`;
    }
    
    let result;
    
    // Enviar mensagem via Twilio ou simular no modo de desenvolvimento
    if (twilioClient && process.env.TWILIO_WHATSAPP_FROM) {
      result = await twilioClient.messages.create({
        body: message,
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
        to: `whatsapp:${formattedPhone}`
      });
    } else {
      // Modo de simulação para desenvolvimento/MVP
      result = await mockSendWhatsApp(formattedPhone, message);
      req.logger.info('Simulando envio de lembrete via WhatsApp:', { to: formattedPhone, message });
    }
    
    // Registrar mensagem no banco de dados
    const messageRecord = await req.prisma.message.create({
      data: {
        type: 'reminder',
        content: message,
        status: 'sent',
        guestId: guest.id
      }
    });
    
    res.status(200).json({
      success: true,
      messageId: messageRecord.id,
      twilioSid: result.sid
    });
  } catch (error) {
    req.logger.error('Erro ao enviar lembrete via WhatsApp:', error);
    res.status(500).json({ error: 'Erro ao enviar lembrete via WhatsApp' });
  }
});

// Enviar mensagem em massa para todos os convidados de um evento
router.post('/send-bulk', authenticate, async (req, res) => {
  try {
    const { eventId, message, filter } = req.body;
    
    if (!eventId || !message) {
      return res.status(400).json({ error: 'Dados incompletos para envio em massa' });
    }
    
    // Verificar se o evento existe e pertence ao usuário
    const event = await req.prisma.event.findUnique({
      where: { id: eventId }
    });
    
    if (!event) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }
    
    if (event.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    // Construir filtro para buscar convidados
    let whereClause = {
      eventId,
      phone: { not: null } // Apenas convidados com número de telefone
    };
    
    // Adicionar filtro por status se especificado
    if (filter && filter.status) {
      whereClause.status = filter.status;
    }
    
    // Buscar convidados que atendem aos critérios
    const guests = await req.prisma.guest.findMany({
      where: whereClause
    });
    
    if (guests.length === 0) {
      return res.status(400).json({ error: 'Nenhum convidado encontrado com os critérios especificados' });
    }
    
    // Enviar mensagens e registrar no banco de dados
    const results = [];
    
    for (const guest of guests) {
      try {
        // Formatar o número de telefone
        let formattedPhone = guest.phone.replace(/\D/g, '');
        if (!formattedPhone.startsWith('+')) {
          formattedPhone = `+55${formattedPhone}`;
        }
        
        let result;
        
        // Enviar mensagem via Twilio ou simular no modo de desenvolvimento
        if (twilioClient && process.env.TWILIO_WHATSAPP_FROM) {
          result = await twilioClient.messages.create({
            body: message,
            from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
            to: `whatsapp:${formattedPhone}`
          });
        } else {
          // Modo de simulação para desenvolvimento/MVP
          result = await mockSendWhatsApp(formattedPhone, message);
          req.logger.info('Simulando envio em massa via WhatsApp:', { to: formattedPhone, message });
        }
        
        // Registrar mensagem no banco de dados
        const messageRecord = await req.prisma.message.create({
          data: {
            type: 'bulk',
            content: message,
            status: 'sent',
            guestId: guest.id
          }
        });
        
        results.push({
          guestId: guest.id,
          name: guest.name,
          success: true,
          messageId: messageRecord.id,
          twilioSid: result.sid
        });
      } catch (error) {
        req.logger.error(`Erro ao enviar mensagem para ${guest.name}:`, error);
        
        results.push({
          guestId: guest.id,
          name: guest.name,
          success: false,
          error: error.message
        });
      }
    }
    
    res.status(200).json({
      totalSent: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length,
      results
    });
  } catch (error) {
    req.logger.error('Erro ao enviar mensagens em massa:', error);
    res.status(500).json({ error: 'Erro ao enviar mensagens em massa' });
  }
});

// Webhook para receber respostas do WhatsApp (para integração com Twilio)
router.post('/webhook', async (req, res) => {
  try {
    const { From, Body, MessageSid } = req.body;
    
    req.logger.info('Webhook do WhatsApp recebido:', req.body);
    
    // Extrair número de telefone do formato whatsapp:+XXXXXXXXXXX
    const phone = From.replace('whatsapp:', '');
    
    // Buscar convidado pelo número de telefone
    const guest = await req.prisma.guest.findFirst({
      where: {
        phone: {
          contains: phone.substring(phone.length - 9) // Buscar pelos últimos 9 dígitos
        }
      }
    });
    
    if (!guest) {
      req.logger.warn(`Mensagem recebida de número não cadastrado: ${phone}`);
      return res.status(200).send('OK');
    }
    
    // Processar resposta como RSVP
    const lowerBody = Body.toLowerCase().trim();
    
    let newStatus = null;
    
    // Verificar se a resposta indica confirmação ou recusa
    if (['sim', 'yes', 'confirmo', 'confirmado', 'vou', 'estarei lá', 'estarei la'].some(term => lowerBody.includes(term))) {
      newStatus = 'confirmed';
    } else if (['não', 'nao', 'no', 'recuso', 'recusado', 'não vou', 'nao vou', 'não poderei', 'nao poderei'].some(term => lowerBody.includes(term))) {
      newStatus = 'declined';
    }
    
    // Atualizar status do convidado se a resposta foi reconhecida
    if (newStatus) {
      await req.prisma.guest.update({
        where: { id: guest.id },
        data: { status: newStatus }
      });
      
      // Registrar mensagem recebida
      await req.prisma.message.create({
        data: {
          type: 'response',
          content: Body,
          status: 'received',
          guestId: guest.id
        }
      });
      
      req.logger.info(`Status do convidado ${guest.name} atualizado para ${newStatus} via WhatsApp`);
    } else {
      // Registrar mensagem recebida mesmo que não seja uma resposta de RSVP reconhecida
      await req.prisma.message.create({
        data: {
          type: 'other',
          content: Body,
          status: 'received',
          guestId: guest.id
        }
      });
      
      req.logger.info(`Mensagem recebida de ${guest.name} via WhatsApp: ${Body}`);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    req.logger.error('Erro ao processar webhook do WhatsApp:', error);
    res.status(200).send('OK'); // Sempre retornar 200 para webhooks, mesmo em caso de erro
  }
});

module.exports = { router };
