let qrCache = {}; // Initialize an empty object to store QR codes by instance name

/**
 * @swagger
 * tags:
 *   - name: WhatsApp
 *     description: Endpoints para gerenciamento e envio de mensagens via WhatsApp
 */
const express = require('express');
const axios = require('axios');
const { authenticate } = require('./auth.routes');
const router = express.Router();

// Configuração da Evolution API
const evolutionApiUrl = process.env.EVOLUTION_API_URL || 'http://api:8080';
const evolutionApiKey = process.env.EVOLUTION_API_KEY || 'SUA_CHAVE_API_SECRETA_AQUI';
const evolutionInstanceName = process.env.EVOLUTION_INSTANCE_NAME || 'myinstance';

// Cliente axios pré-configurado para Evolution API
const evolutionApi = axios.create({
  baseURL: evolutionApiUrl,
  headers: {
    'Content-Type': 'application/json',
    apikey: evolutionApiKey
  }
});

// Helper para pausa
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Verifica se a instância existe e seu status, com tentativas
const checkInstanceStatus = async (retries = 3, delay = 1500) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Tentativa ${i + 1}/${retries} de verificar status da instância ${evolutionInstanceName}...`);
      const { data } = await evolutionApi.get("/instance/fetchInstances");
      console.log("Resposta completa da API /instance/fetchInstances:", JSON.stringify(data, null, 2)); // Log detalhado da resposta
      const instances = data || []; // Correção: A resposta é o próprio array
      const inst = instances.find(i => i.name === evolutionInstanceName); // Correção: Usar i.name

      if (inst) {
        console.log(`Instância ${evolutionInstanceName} encontrada com status: ${inst.connectionStatus}`); // Correção: Usar inst.connectionStatus
        const isConnected = inst.connectionStatus === 'open'; // Correção: Verificar 'open'
        // Retorna imediatamente o status encontrado (conectado ou não)
        return { exists: true, connected: isConnected, status: inst.connectionStatus }; // Correção: Retornar inst.connectionStatus
      } else {
        // Instância não encontrada na lista, loga e tenta novamente após delay
        console.warn(`Instância ${evolutionInstanceName} não encontrada na lista retornada pela API na tentativa ${i + 1}.`);
      }

    } catch (err) {
      // Log detalhado do erro de comunicação
      console.error(`Erro de comunicação na tentativa ${i + 1} de verificar status:`, err.response?.data || err.message);
      // Tenta novamente após delay
    }

    // Espera antes da próxima tentativa (exceto na última)
    if (i < retries - 1) {
      console.log(`Aguardando ${delay}ms antes da próxima tentativa...`);
      await sleep(delay);
    }
  }

  // Se chegou aqui, todas as tentativas falharam ou a instância não foi encontrada
  console.error(`Falha ao obter status da instância ${evolutionInstanceName} após ${retries} tentativas.`);
  // Retorna um estado indicando falha na verificação. Manter o status undefined é consistente com o erro original.
  return { exists: false, connected: false, error: `Falha ao verificar status após ${retries} tentativas` };
};

// Cria a instância se não existir
const createInstanceIfNeeded = async () => {
  const status = await checkInstanceStatus();
  if (!status.exists) {
    try {
      await evolutionApi.post('/instance/create', {
        instanceName: evolutionInstanceName,
        integration: 'WHATSAPP-BAILEYS'
      });
      return { created: true };
    } catch (err) {
      // se já existe, ignora
      if (err.response?.status === 403 &&
          err.response.data?.response?.message?.some(msg =>
            msg.includes('already in use')
          )) {
        return { created: false, status: await checkInstanceStatus() };
      }
      console.error('Erro ao criar instância:', err.message);
      throw err;
    }
  }
  return { created: false, status };
};

// Envia mensagem de texto via Evolution API
const sendWhatsAppMessage = async (to, text) => {
  await createInstanceIfNeeded();
  const { connected, status } = await checkInstanceStatus();
  if (!connected) throw new Error(`Instância não conectada (status: ${status})`);

  let number = to.replace(/\D/g, '');
  if (!number.startsWith('55') && number.length === 11) number = `55${number}`;
  if (!number.includes('@')) number = `${number}@s.whatsapp.net`;

  const { data } = await evolutionApi.post(
    `/message/sendText/${evolutionInstanceName}`,
    // Correção: Enviar 'text' diretamente, não dentro de 'textMessage'
    { number, text, options: { delay: 1200 } } 
  );

  return {
    sid: data.key?.id || `evo-${Date.now()}`,
    to: number,
    body: text,
    status: data.status || 'sent',
    dateCreated: new Date()
  };
};


// Modo de simulação para envios sem Evolution
const mockSendWhatsApp = async (to, text) => ({
  sid: `mock-${Date.now()}`,
  to,
  body: text,
  status: 'sent',
  dateCreated: new Date()
});


/**
 * @swagger
 * /api/whatsapp/send-invite:
 *   post:
 *     summary: Envia convite via WhatsApp para um convidado específico
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - guestId
 *               - message
 *               - inviteLink
 *             properties:
 *               guestId:
 *                 type: string
 *               message:
 *                 type: string
 *               inviteLink:
 *                 type: string
 *     responses:
 *       200:
 *         description: Convite enviado com sucesso
 *       400:
 *         description: Dados incompletos ou convidado não possui telefone
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Convidado não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
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


/**
 * @swagger
 * /api/whatsapp/send-reminder:
 *   post:
 *     summary: Envia lembrete via WhatsApp para um convidado
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - guestId
 *               - message
 *             properties:
 *               guestId:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Lembrete enviado com sucesso
 *       400:
 *         description: Dados incompletos ou convidado sem telefone
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Convidado não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
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


/**
 * @swagger
 * /api/whatsapp/send-bulk:
 *   post:
 *     summary: Envia mensagem em massa via WhatsApp para convidados de um evento
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventId
 *               - message
 *             properties:
 *               eventId:
 *                 type: string
 *               message:
 *                 type: string
 *               filter:
 *                 type: object
 *                 properties:
 *                   status:
 *                     type: string
 *     responses:
 *       200:
 *         description: Envio em massa realizado
 *       400:
 *         description: Dados incompletos ou nenhum convidado encontrado
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Evento não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
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


/**
 * @swagger
 * /api/whatsapp/webhook:
 *   post:
 *     summary: Webhook para receber eventos da Evolution API
 *     tags: [WhatsApp]
 *     requestBody:
 *       description: Payload do webhook da Evolution API
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Evento recebido e processado (ou ignorado)
 */
router.post('/webhook', async (req, res) => {
  try {
    req.logger.info('Webhook do WhatsApp recebido:', req.body);

    // Captura QR code atualizado
    if (req.body.event === 'qrcode.updated' &&
        req.body.instance === evolutionInstanceName &&
        req.body.data?.qrcode?.base64
    ) {
      qrCache[evolutionInstanceName] = req.body.data.qrcode.base64;
      req.logger.info(`QR Code recebido e armazenado para instância ${evolutionInstanceName}`); // Log adicionado
      return res.status(200).send('OK');
    }

    // Processa mensagens de resposta (RSVP)
    if (req.body.event === 'messages.upsert' && req.body.data?.key) {
      const messageData = req.body.data;
      const phone = messageData.key.remoteJid.split('@')[0];
      const text = messageData.message?.conversation || messageData.message?.extendedTextMessage?.text || '';
      const guest = await req.prisma.guest.findFirst({
        where: { phone: { contains: phone.slice(-9) } } // Ajuste para buscar pelo final do número
      });
      if (guest) {
        const lower = text.toLowerCase();
        let newStatus = null;
        if (['sim','yes','confirmo','confirmado','vou'].some(t => lower.includes(t))) newStatus = 'confirmed';
        else if (['não','nao','no','recuso','recusado'].some(t => lower.includes(t))) newStatus = 'declined';
        
        // Registra a mensagem recebida
        await req.prisma.message.create({ data: {
          type: newStatus ? 'response' : 'other',
          content: text,
          status: 'received',
          guestId: guest.id
        }});
        
        // Atualiza o status do convidado se for uma resposta válida
        if (newStatus) {
          await req.prisma.guest.update({ where: { id: guest.id }, data: { status: newStatus } });
          req.logger.info(`Convidado ${guest.name} (${guest.id}) atualizado para status: ${newStatus}`);
        } else {
          req.logger.info(`Mensagem recebida de ${guest.name} (${guest.id}) não interpretada como RSVP: ${text}`);
        }
      } else {
        req.logger.warn(`Mensagem recebida de número não associado a nenhum convidado: ${phone}`);
      }
      return res.status(200).send('OK');
    }

    // Ignorar outros eventos
    res.status(200).send('OK');
  } catch (error) {
    req.logger.error('Erro ao processar webhook do WhatsApp:', error.message, error.stack);
    // É importante responder 200 OK para a Evolution API não ficar reenviando o webhook
    res.status(200).send('OK'); 
  }
});


/**
 * @swagger
 * /api/whatsapp/status:
 *   get:
 *     summary: Verifica o status da conexão da instância WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status da instância
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *                 connected:
 *                   type: boolean
 *                 status:
 *                   type: string
 *       500:
 *         description: Erro ao verificar status
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const status = await checkInstanceStatus();
    res.status(200).json(status);
  } catch (error) {
    req.logger.error('Erro ao verificar status da instância:', error);
    res.status(500).json({ error: 'Erro ao verificar status da instância' });
  }
});

/**
 * @swagger
 * /api/whatsapp/qrcode:
 *   get:
 *     summary: Obtém o QR Code para conectar a instância WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: QR Code em formato base64
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 qrcode:
 *                   type: string
 *       404:
 *         description: QR Code não disponível (instância conectada, não encontrada ou QR ainda não recebido)
 *       500:
 *         description: Erro interno ao obter QR Code
 */
router.get('/qrcode', authenticate, async (req, res) => {
  try {
    // Não chamar createInstanceIfNeeded aqui, pois o QR só existe se a instância já foi criada e está aguardando conexão.
    const qr = qrCache[evolutionInstanceName];
    if (!qr) {
      req.logger.warn(`Tentativa de obter QR Code para ${evolutionInstanceName}, mas não encontrado no cache.`);
      const status = await checkInstanceStatus();
      if (!status.exists) {
        return res.status(404).json({ error: 'Instância não encontrada. Crie a instância primeiro.' });
      } else if (status.connected) {
        return res.status(404).json({ error: 'Instância já conectada, QR Code não é mais necessário ou expirou.' });
      } else {
        // Se a instância existe mas não está conectada, e não temos QR, ele pode não ter chegado ainda ou expirou.
        return res.status(404).json({ error: 'QR Code não disponível ou ainda não recebido pelo webhook. Tente novamente em alguns segundos.' });
      }
    }
    // Opcional: Limpar o QR do cache após ser enviado para evitar reutilização.
    // Considerar se o frontend pode precisar buscar o mesmo QR múltiplas vezes.
    // delete qrCache[evolutionInstanceName]; 
    return res.status(200).json({ qrcode: qr });
  } catch (err) {
    // Verifica se o erro é ReferenceError (caso qrCache não esteja definido - segurança extra)
    if (err instanceof ReferenceError && err.message.includes('qrCache is not defined')) {
       req.logger.error('Erro Crítico: Variável qrCache não foi inicializada no whatsapp.routes.js!', err);
       return res.status(500).json({ error: 'Erro interno do servidor: Falha na configuração do cache de QR Code.' });
    }
    // Log genérico para outros erros
    req.logger.error('Erro inesperado ao obter QR Code:', err.message, err.stack);
    res.status(500).json({ error: 'Erro interno ao obter QR Code' });
  }
});


/**
 * @swagger
 * /api/whatsapp/disconnect:
 *   post:
 *     summary: Desconecta a instância WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Instância desconectada com sucesso
 *       404:
 *         description: Instância não encontrada
 *       500:
 *         description: Erro ao desconectar instância
 */
router.post('/disconnect', authenticate, async (req, res) => {
  try {
    const status = await checkInstanceStatus();
    if (!status.exists) return res.status(404).json({ error: 'Instância não encontrada' });
    
    // Só tenta desconectar se existir
    await evolutionApi.delete(`/instance/logout/${evolutionInstanceName}`);
    
    // Limpa o QR code do cache ao desconectar, caso ainda exista
    delete qrCache[evolutionInstanceName]; 
    req.logger.info(`Instância ${evolutionInstanceName} desconectada e QR Code (se existente) removido do cache.`);
    
    res.status(200).json({ success: true, message: 'Instância desconectada com sucesso' });
  } catch (err) {
    // Tratar erro caso a instância já esteja desconectada ou ocorra outro problema na API
    req.logger.error('Erro ao desconectar instância:', err.response?.data || err.message);
    // Retorna um erro genérico, mas loga o detalhe
    res.status(500).json({ error: 'Erro ao tentar desconectar a instância' }); 
  }
});

module.exports = { router };
