const express = require('express');
const axios = require('axios');
const { authenticate } = require('./auth.routes');
const router = express.Router();

// Configuração da Evolution API
const evolutionApiUrl = process.env.EVOLUTION_API_URL || 'http://evolution_api:8080';
const evolutionApiKey = process.env.EVOLUTION_API_KEY || 'SUA_CHAVE_API_SECRETA_AQUI';
const evolutionInstanceName = process.env.EVOLUTION_INSTANCE_NAME || 'myinstance';

// Configuração do cliente axios para Evolution API
const evolutionApi = axios.create({
  baseURL: evolutionApiUrl,
  headers: {
    'Content-Type': 'application/json',
    'apikey': evolutionApiKey
  }
});

// Função para verificar se a instância existe e está conectada
const checkInstanceStatus = async () => {
  try {
    const response = await evolutionApi.get(`/instance/fetchInstances`);
    const instances = response.data.instances || [];
    const instance = instances.find(i => i.instance === evolutionInstanceName);
    
    if (!instance) {
      return { exists: false, connected: false };
    }
    
    return { 
      exists: true, 
      connected: instance.status === 'connected',
      status: instance.status
    };
  } catch (error) {
    console.error('Erro ao verificar status da instância:', error.message);
    return { exists: false, connected: false, error: error.message };
  }
};

// Função para criar instância se não existir
const createInstanceIfNeeded = async () => {
  try {
    const status = await checkInstanceStatus();
    
    if (!status.exists) {
      await evolutionApi.post('/instance/create', {
        instanceName: evolutionInstanceName
      });
      return { created: true };
    }
    
    return { created: false, status };
  } catch (error) {
    console.error('Erro ao criar instância:', error.message);
    return { created: false, error: error.message };
  }
};

// Função para enviar mensagem via Evolution API
const sendWhatsAppMessage = async (to, body) => {
  try {
    // Verificar e criar instância se necessário
    await createInstanceIfNeeded();
    
    // Verificar status da conexão
    const status = await checkInstanceStatus();
    if (!status.connected) {
      throw new Error(`Instância não está conectada. Status atual: ${status.status}`);
    }
    
    // Formatar número de telefone (remover caracteres não numéricos)
    let formattedPhone = to.replace(/\D/g, '');
    
    // Garantir que o número esteja no formato internacional
    if (!formattedPhone.startsWith('55') && formattedPhone.length === 11) {
      formattedPhone = `55${formattedPhone}`;
    }
    
    // Adicionar @ para o formato da Evolution API
    if (!formattedPhone.includes('@')) {
      formattedPhone = `${formattedPhone}@s.whatsapp.net`;
    }
    
    // Enviar mensagem
    const response = await evolutionApi.post(`/message/sendText/${evolutionInstanceName}`, {
      number: formattedPhone,
      options: {
        delay: 1200
      },
      textMessage: {
        text: body
      }
    });
    
    return {
      sid: response.data.key?.id || `evolution-${Date.now()}`,
      to: formattedPhone,
      body,
      status: response.data.status || 'sent',
      dateCreated: new Date()
    };
  } catch (error) {
    console.error('Erro ao enviar mensagem WhatsApp:', error);
    throw error;
  }
};

// Função para simular envio de mensagem (para MVP sem conexão real)
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
    
    // Verificar se a Evolution API está configurada e tentar enviar
    if (evolutionApiUrl && evolutionApiKey) {
      try {
        result = await sendWhatsAppMessage(formattedPhone, fullMessage);
      } catch (error) {
        req.logger.error('Erro ao enviar via Evolution API, usando modo de simulação:', error);
        result = await mockSendWhatsApp(formattedPhone, fullMessage);
      }
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
      evolutionSid: result.sid
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
    
    // Verificar se a Evolution API está configurada e tentar enviar
    if (evolutionApiUrl && evolutionApiKey) {
      try {
        result = await sendWhatsAppMessage(formattedPhone, message);
      } catch (error) {
        req.logger.error('Erro ao enviar via Evolution API, usando modo de simulação:', error);
        result = await mockSendWhatsApp(formattedPhone, message);
      }
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
      evolutionSid: result.sid
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
        
        // Verificar se a Evolution API está configurada e tentar enviar
        if (evolutionApiUrl && evolutionApiKey) {
          try {
            result = await sendWhatsAppMessage(formattedPhone, message);
          } catch (error) {
            req.logger.error(`Erro ao enviar via Evolution API para ${guest.name}:`, error);
            result = await mockSendWhatsApp(formattedPhone, message);
          }
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
          evolutionSid: result.sid
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

// Webhook para receber respostas do WhatsApp (para integração com Evolution API)
router.post('/webhook', async (req, res) => {
  try {
    req.logger.info('Webhook do WhatsApp recebido:', req.body);
    
    // Verificar se é um webhook da Evolution API
    if (req.body.event === 'messages.upsert' && req.body.data && req.body.data.key) {
      // Extrair dados da mensagem
      const messageData = req.body.data;
      const phone = messageData.key.remoteJid.split('@')[0];
      const body = messageData.message?.conversation || 
                  messageData.message?.extendedTextMessage?.text || 
                  'Mensagem sem texto';
      
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
      const lowerBody = body.toLowerCase().trim();
      
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
            content: body,
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
            content: body,
            status: 'received',
            guestId: guest.id
          }
        });
        
        req.logger.info(`Mensagem recebida de ${guest.name} via WhatsApp: ${body}`);
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    req.logger.error('Erro ao processar webhook do WhatsApp:', error);
    res.status(200).send('OK'); // Sempre retornar 200 para webhooks, mesmo em caso de erro
  }
});

// Rota para verificar o status da instância do WhatsApp
router.get('/status', authenticate, async (req, res) => {
  try {
    const status = await checkInstanceStatus();
    res.status(200).json(status);
  } catch (error) {
    req.logger.error('Erro ao verificar status da instância:', error);
    res.status(500).json({ error: 'Erro ao verificar status da instância' });
  }
});

// Rota para obter o QR Code da instância
router.get('/qrcode', authenticate, async (req, res) => {
  try {
    // Verificar se a instância existe
    const status = await checkInstanceStatus();
    
    if (!status.exists) {
      // Criar instância se não existir
      await createInstanceIfNeeded();
    }
    
    // Obter QR Code
    const response = await evolutionApi.get(`/instance/qrcode/${evolutionInstanceName}`);
    
    if (response.data && response.data.qrcode) {
      res.status(200).json({ qrcode: response.data.qrcode });
    } else {
      res.status(404).json({ error: 'QR Code não disponível' });
    }
  } catch (error) {
    req.logger.error('Erro ao obter QR Code:', error);
    res.status(500).json({ error: 'Erro ao obter QR Code' });
  }
});

// Rota para configurar webhook da instância
router.post('/configure-webhook', authenticate, async (req, res) => {
  try {
    const { webhookUrl } = req.body;
    
    if (!webhookUrl) {
      return res.status(400).json({ error: 'URL do webhook não fornecida' });
    }
    
    // Verificar se a instância existe
    const status = await checkInstanceStatus();
    
    if (!status.exists) {
      // Criar instância se não existir
      await createInstanceIfNeeded();
    }
    
    // Configurar webhook
    const response = await evolutionApi.post(`/webhook/set/${evolutionInstanceName}`, {
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false
    });
    
    res.status(200).json({ success: true, message: 'Webhook configurado com sucesso' });
  } catch (error) {
    req.logger.error('Erro ao configurar webhook:', error);
    res.status(500).json({ error: 'Erro ao configurar webhook' });
  }
});

// Rota para desconectar a instância
router.post('/disconnect', authenticate, async (req, res) => {
  try {
    // Verificar se a instância existe
    const status = await checkInstanceStatus();
    
    if (!status.exists) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }
    
    // Desconectar instância
    const response = await evolutionApi.delete(`/instance/logout/${evolutionInstanceName}`);
    
    res.status(200).json({ success: true, message: 'Instância desconectada com sucesso' });
  } catch (error) {
    req.logger.error('Erro ao desconectar instância:', error);
    res.status(500).json({ error: 'Erro ao desconectar instância' });
  }
});

module.exports = { router };
