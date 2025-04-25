const express = require('express');
const { authenticate } = require('./auth.routes');
const Joi = require('joi');
const router = express.Router();

// Esquema de validação para criação/atualização de convidado
const guestSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().allow('', null),
  phone: Joi.string().allow('', null),
  status: Joi.string().valid('pending', 'confirmed', 'declined').default('pending'),
  whatsapp: Joi.boolean().default(false),
  plusOne: Joi.boolean().default(false),
  plusOneName: Joi.string().allow('', null),
  notes: Joi.string().allow('', null),
  eventId: Joi.string().required(),
  inviteId: Joi.string().allow(null),
  group: Joi.string().allow('', null),
});

// Esquema de validação para atualização de status (RSVP)
const rsvpSchema = Joi.object({
  status: Joi.string().valid('confirmed', 'declined').required(),
  plusOne: Joi.boolean(),
  plusOneName: Joi.string().allow('', null)
});

// Listar todos os convidados de um evento
router.get('/event/:eventId', authenticate, async (req, res) => {
  try {
    const { eventId } = req.params;
    
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
    
    const guests = await req.prisma.guest.findMany({
      where: {
        eventId
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    res.status(200).json(guests);
  } catch (error) {
    req.logger.error('Erro ao listar convidados:', error);
    res.status(500).json({ error: 'Erro ao listar convidados' });
  }
});

// Obter um convidado específico
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const guest = await req.prisma.guest.findUnique({
      where: {
        id
      },
      include: {
        event: true,
        messages: true
      }
    });
    
    if (!guest) {
      return res.status(404).json({ error: 'Convidado não encontrado' });
    }
    
    // Verificar se o convidado pertence a um evento do usuário
    if (guest.event.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    res.status(200).json(guest);
  } catch (error) {
    req.logger.error('Erro ao obter convidado:', error);
    res.status(500).json({ error: 'Erro ao obter convidado' });
  }
});

// Obter mensagens de um convidado específico
router.get('/:id/messages', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se o convidado existe
    const guest = await req.prisma.guest.findUnique({
      where: { id },
      include: { event: true }
    });
    
    if (!guest) {
      return res.status(404).json({ error: 'Convidado não encontrado' });
    }
    
    // Verificar se o convidado pertence a um evento do usuário
    if (guest.event.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    // Buscar mensagens do convidado
    const messages = await req.prisma.message.findMany({
      where: { guestId: id },
      orderBy: { createdAt: 'desc' }
    });
    
    res.status(200).json(messages);
  } catch (error) {
    req.logger.error('Erro ao obter mensagens do convidado:', error);
    res.status(500).json({ error: 'Erro ao obter mensagens do convidado' });
  }
});

// Adicionar um novo convidado
router.post('/', authenticate, async (req, res) => {
  try {
    // Validar dados de entrada
    const { error, value } = guestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { name, email, phone, status, plusOne, plusOneName, notes, eventId, inviteId } = value;
    
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
    
    // Verificar se o convite existe e pertence ao evento
    if (inviteId) {
      const invite = await req.prisma.invite.findUnique({
        where: { id: inviteId }
      });
      
      if (!invite || invite.eventId !== eventId) {
        return res.status(400).json({ error: 'Convite inválido para este evento' });
      }
    }
    
    // Criar convidado
    const guest = await req.prisma.guest.create({
      data: {
        name,
        email,
        phone,
        status,
        plusOne,
        plusOneName,
        notes,
        eventId,
        inviteId
      }
    });
    
    res.status(201).json(guest);
  } catch (error) {
    req.logger.error('Erro ao adicionar convidado:', error);
    res.status(500).json({ error: 'Erro ao adicionar convidado' });
  }
});

// Atualizar um convidado
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validar dados de entrada
    const { error, value } = guestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    // Verificar se o convidado existe
    const existingGuest = await req.prisma.guest.findUnique({
      where: { id },
      include: {
        event: true
      }
    });
    
    if (!existingGuest) {
      return res.status(404).json({ error: 'Convidado não encontrado' });
    }
    
    // Verificar se o convidado pertence a um evento do usuário
    if (existingGuest.event.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    const { name, email, phone, status, plusOne, plusOneName, notes, inviteId } = value;
    
    // Verificar se o convite existe e pertence ao evento
    if (inviteId) {
      const invite = await req.prisma.invite.findUnique({
        where: { id: inviteId }
      });
      
      if (!invite || invite.eventId !== existingGuest.eventId) {
        return res.status(400).json({ error: 'Convite inválido para este evento' });
      }
    }
    
    // Verificar se o status está sendo alterado
    const statusChanged = existingGuest.status !== status;
    
    // Atualizar convidado
    const updatedGuest = await req.prisma.guest.update({
      where: { id },
      data: {
        name,
        email,
        phone,
        status,
        plusOne,
        plusOneName,
        notes,
        inviteId
      }
    });
    
    // Se o status foi alterado, registrar uma mensagem
    if (statusChanged) {
      await req.prisma.message.create({
        data: {
          type: 'status_change',
          content: `Status atualizado para: ${status} (pelo organizador)`,
          status: 'sent',
          guestId: id
        }
      });
    }
    
    res.status(200).json(updatedGuest);
  } catch (error) {
    req.logger.error('Erro ao atualizar convidado:', error);
    res.status(500).json({ error: 'Erro ao atualizar convidado' });
  }
});

// Excluir um convidado
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se o convidado existe
    const existingGuest = await req.prisma.guest.findUnique({
      where: { id },
      include: {
        event: true
      }
    });
    
    if (!existingGuest) {
      return res.status(404).json({ error: 'Convidado não encontrado' });
    }
    
    // Verificar se o convidado pertence a um evento do usuário
    if (existingGuest.event.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    // Excluir convidado
    await req.prisma.guest.delete({
      where: { id }
    });
    
    res.status(204).send();
  } catch (error) {
    req.logger.error('Erro ao excluir convidado:', error);
    res.status(500).json({ error: 'Erro ao excluir convidado' });
  }
});

// Importar múltiplos convidados
router.post('/import', authenticate, async (req, res) => {
  try {
    const { guests, eventId } = req.body;
    
    if (!Array.isArray(guests) || guests.length === 0) {
      return res.status(400).json({ error: 'Lista de convidados inválida' });
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
    
    // Criar convidados em lote
    const createdGuests = await req.prisma.guest.createMany({
      data: guests.map(guest => ({
        name: guest.name,
        email: guest.email || null,
        phone: guest.phone || null,
        status: 'pending',
        eventId
      })),
      skipDuplicates: true
    });
    
    res.status(201).json({ count: createdGuests.count });
  } catch (error) {
    req.logger.error('Erro ao importar convidados:', error);
    res.status(500).json({ error: 'Erro ao importar convidados' });
  }
});

// Rota pública para RSVP (confirmação de presença)
router.post('/rsvp/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validar dados de entrada
    const { error, value } = rsvpSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { status, plusOne, plusOneName } = value;
    
    // Verificar se o convidado existe
    const guest = await req.prisma.guest.findUnique({
      where: { id }
    });
    
    if (!guest) {
      return res.status(404).json({ error: 'Convidado não encontrado' });
    }
    
    // Atualizar status do convidado
    const updatedGuest = await req.prisma.guest.update({
      where: { id },
      data: {
        status,
        plusOne: plusOne !== undefined ? plusOne : guest.plusOne,
        plusOneName: plusOneName !== undefined ? plusOneName : guest.plusOneName
      }
    });
    
    // Registrar mensagem de confirmação
    await req.prisma.message.create({
      data: {
        type: 'confirmation',
        content: `Status atualizado para: ${status}`,
        status: 'sent',
        guestId: id
      }
    });
    
    res.status(200).json(updatedGuest);
  } catch (error) {
    req.logger.error('Erro ao processar RSVP:', error);
    res.status(500).json({ error: 'Erro ao processar confirmação' });
  }
});

module.exports = { router };