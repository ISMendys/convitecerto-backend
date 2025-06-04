const express = require('express');
const { authenticate } = require('./auth.routes');
const Joi = require('joi');
const router = express.Router();

// Esquema de validação para criação/atualização de convite
const inviteSchema = Joi.object({
  templateId: Joi.string().default('default'),
  customText: Joi.string().allow('', null),
  imageUrl: Joi.string().uri().allow('', null),
  bgColor: Joi.string().default('#ffffff'),
  textColor: Joi.string().default('#000000'),
  accentColor: Joi.string().default('#5e35b1'),
  fontFamily: Joi.string().default('Poppins'),
  eventId: Joi.string().required(),
  description: Joi.string().allow('', null),
  eventTitle: Joi.string().allow('', null),
  title: Joi.string().required()
});

// Listar todos os convites de um evento
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
    
    const invites = await req.prisma.invite.findMany({
      where: {
        eventId
      }
    });
    
    res.status(200).json(invites);
  } catch (error) {
    req.logger.error('Erro ao listar convites:', error);
    res.status(500).json({ error: 'Erro ao listar convites' });
  }
});

// Obter um convite específico
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const invite = await req.prisma.invite.findUnique({
      where: {
        id
      },
      include: {
        event: true
      }
    });
    
    if (!invite) {
      return res.status(404).json({ error: 'Convite não encontrado' });
    }
    
    // Verificar se o convite pertence a um evento do usuário
    if (invite.event.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    res.status(200).json(invite);
  } catch (error) {
    req.logger.error('Erro ao obter convite:', error);
    res.status(500).json({ error: 'Erro ao obter convite' });
  }
});

// Criar um novo convite
router.post('/', authenticate, async (req, res) => {
  try {
    // Validar dados de entrada
    const { error, value } = inviteSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { eventId, templateId, customText, imageUrl, bgColor, textColor, accentColor, eventTitle, fontFamily, title, description } = value;
    
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
    
    // Criar convite
    const invite = await req.prisma.invite.create({
      data: {
        templateId,
        customText,
        imageUrl,
        bgColor,
        textColor,
        accentColor,
        description,
        eventTitle,
        fontFamily,
        title,
        eventId
      }
    });
    
    res.status(201).json(invite);
  } catch (error) {
    req.logger.error('Erro ao criar convite:', error);
    res.status(500).json({ error: 'Erro ao criar convite' });
  }
});

// Atualizar um convite
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validar dados de entrada
    const { error, value } = inviteSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    // Verificar se o convite existe
    const existingInvite = await req.prisma.invite.findUnique({
      where: { id },
      include: {
        event: true
      }
    });
    
    if (!existingInvite) {
      return res.status(404).json({ error: 'Convite não encontrado' });
    }
    
    // Verificar se o convite pertence a um evento do usuário
    if (existingInvite.event.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    const { templateId, customText, imageUrl, bgColor, textColor, accentColor, fontFamily, title, description, eventTitle } = value;
    
    // Atualizar convite
    const updatedInvite = await req.prisma.invite.update({
      where: { id },
      data: {
        templateId,
        customText,
        imageUrl,
        bgColor,
        textColor,
        description,
        eventTitle,
        accentColor,
        title,
        fontFamily
      }
    });
    
    res.status(200).json(updatedInvite);
  } catch (error) {
    req.logger.error('Erro ao atualizar convite:', error);
    res.status(500).json({ error: 'Erro ao atualizar convite' });
  }
});

// Excluir um convite
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se o convite existe
    const existingInvite = await req.prisma.invite.findUnique({
      where: { id },
      include: {
        event: true
      }
    });
    
    if (!existingInvite) {
      return res.status(404).json({ error: 'Convite não encontrado' });
    }
    
    // Verificar se o convite pertence a um evento do usuário
    if (existingInvite.event.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    // Excluir convite
    await req.prisma.invite.delete({
      where: { id }
    });
    
    res.status(204).send();
  } catch (error) {
    req.logger.error('Erro ao excluir convite:', error);
    res.status(500).json({ error: 'Erro ao excluir convite' });
  }
});

// Rota pública para visualizar um convite (usado pelos convidados)
router.get('/public/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const invite = await req.prisma.invite.findUnique({
      where: {
        id
      },
      include: {
        event: {
          select: {
            title: true,
            description: true,
            date: true,
            location: true,
            type: true
          }
        }
      }
    });
    
    if (!invite) {
      return res.status(404).json({ error: 'Convite não encontrado' });
    }
    
    res.status(200).json(invite);
  } catch (error) {
    req.logger.error('Erro ao obter convite público:', error);
    res.status(500).json({ error: 'Erro ao obter convite' });
  }
});

module.exports = { router };
