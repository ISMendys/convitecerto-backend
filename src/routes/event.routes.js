const express = require('express');
const { authenticate } = require('./auth.routes');
const Joi = require('joi');
const router = express.Router();

// Esquema de validação para criação/atualização de evento
const eventSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().allow('', null),
  date: Joi.date().required(),
  location: Joi.string().allow('', null),
  maxGuests: Joi.string().allow('', null),
  image: Joi.string().allow('', null),
  notes: Joi.string().allow('', null),
  type: Joi.string().valid('birthday', 'wedding', 'corporate', 'party', 'other').default('other')
});


// Listar todos os eventos do usuário
router.get('/', authenticate, async (req, res) => {
  try {
    const events = await req.prisma.event.findMany({
      where: {
        userId: req.user.id
      },
      include: {
        _count: {
          select: {
            guests: true
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    // Adicionar contagem de convidados confirmados e pendentes
    const eventsWithStats = await Promise.all(events.map(async (event) => {
      const confirmedCount = await req.prisma.guest.count({
        where: {
          eventId: event.id,
          status: 'confirmed'
        }
      });
      
      const pendingCount = await req.prisma.guest.count({
        where: {
          eventId: event.id,
          status: 'pending'
        }
      });
      
      return {
        ...event,
        guestsCount: event._count.guests,
        confirmedCount,
        pendingCount
      };
    }));

    res.status(200).json(eventsWithStats);
  } catch (error) {
    req.logger.error('Erro ao listar eventos:', error);
    res.status(500).json({ error: 'Erro ao listar eventos' });
  }
});

// Obter um evento específico
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const event = await req.prisma.event.findUnique({
      where: {
        id
      },
      include: {
        invites: true,
        _count: {
          select: {
            guests: true
          }
        }
      }
    });
    
    if (!event) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }
    
    // Verificar se o evento pertence ao usuário
    if (event.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    // Adicionar contagem de convidados confirmados e pendentes
    const confirmedCount = await req.prisma.guest.count({
      where: {
        eventId: event.id,
        status: 'confirmed'
      }
    });
    
    const pendingCount = await req.prisma.guest.count({
      where: {
        eventId: event.id,
        status: 'pending'
      }
    });
    
    const eventWithStats = {
      ...event,
      guestsCount: event._count.guests,
      confirmedCount,
      pendingCount
    };
    
    res.status(200).json(eventWithStats);
  } catch (error) {
    req.logger.error('Erro ao obter evento:', error);
    res.status(500).json({ error: 'Erro ao obter evento' });
  }
});

// Criar um novo evento
router.post('/', authenticate, async (req, res) => {
  const { error, value } = eventSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const event = await req.prisma.event.create({
      data: {
        title:       value.title,
        description: value.description,
        date:        new Date(value.date),
        location:    value.location,
        maxGuests:   value.maxGuests,
        notes:       value.notes,
        type:        value.type,
        image:       value.image || null,
        userId:      req.user.id
      }
    });
    res.status(201).json(event);
  } catch (err) {
    req.logger.error('Erro ao criar evento:', err);
    res.status(500).json({ error: 'Erro ao criar evento' });
  }
});

// Atualizar um evento
router.put('/:id', authenticate, async (req, res) => {
  const { error, value } = eventSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const existing = await req.prisma.event.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Evento não encontrado' });
    if (existing.userId !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });

    const updated = await req.prisma.event.update({
      where: { id: req.params.id },
      data: {
        title:       value.title,
        description: value.description,
        date:        new Date(value.date),
        location:    value.location,
        maxGuests:   value.maxGuests,
        notes:       value.notes,
        type:        value.type,
        image:       value.image || null
      }
    });
    res.json(updated);
  } catch (err) {
    req.logger.error('Erro ao atualizar evento:', err);
    res.status(500).json({ error: 'Erro ao atualizar evento' });
  }
});

// Excluir um evento
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se o evento existe e pertence ao usuário
    const existingEvent = await req.prisma.event.findUnique({
      where: { id }
    });
    
    if (!existingEvent) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }
    
    if (existingEvent.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    // Excluir evento (isso também excluirá convites e convidados devido às relações no Prisma)
    await req.prisma.event.delete({
      where: { id }
    });
    
    res.status(204).send();
  } catch (error) {
    req.logger.error('Erro ao excluir evento:', error);
    res.status(500).json({ error: 'Erro ao excluir evento' });
  }
});

// Exportar a rota
module.exports = { router };
