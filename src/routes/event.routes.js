const express = require('express');
const { authenticate } = require('./auth.routes'); //
const Joi = require('joi');
const router = express.Router();

// Esquema de validação para criação/atualização de evento
const eventSchema = Joi.object({
  title: Joi.string().required(), //
  description: Joi.string().allow('', null), //
  date: Joi.date().required(), //
  location: Joi.string().allow('', null), //
  maxGuests: Joi.string().allow('', null), //
  image: Joi.string().allow('', null), //
  notes: Joi.string().allow('', null), //
  type: Joi.string().valid('birthday', 'wedding', 'corporate', 'party', 'other').default('other') //
});

/**
 * @swagger
 * tags:
 * - name: Events
 * description: Endpoints para gerenciamento de eventos
 */

/**
 * @swagger
 * components:
 * schemas:
 * Event:
 * type: object
 * properties:
 * id:
 * type: string
 * example: "clxevent..."
 * title:
 * type: string
 * example: "Festa de Aniversário"
 * description:
 * type: string
 * nullable: true
 * example: "Grande festa para celebrar."
 * date:
 * type: string
 * format: date-time
 * example: "2025-12-31T19:00:00.000Z"
 * location:
 * type: string
 * nullable: true
 * example: "Salão de Festas Principal"
 * maxGuests:
 * type: string
 * nullable: true
 * example: "100"
 * image:
 * type: string
 * nullable: true
 * example: "http://example.com/image.png"
 * notes:
 * type: string
 * nullable: true
 * example: "Lembrar de comprar balões."
 * type:
 * type: string
 * enum: [birthday, wedding, corporate, party, other]
 * default: other
 * example: "birthday"
 * userId:
 * type: string
 * example: "clxuser..."
 * guestsCount:
 * type: integer
 * example: 50
 * confirmedCount:
 * type: integer
 * example: 30
 * pendingCount:
 * type: integer
 * example: 20
 * EventInput:
 * type: object
 * required:
 * - title
 * - date
 * properties:
 * title:
 * type: string
 * example: "Festa de Aniversário"
 * description:
 * type: string
 * nullable: true
 * example: "Grande festa para celebrar."
 * date:
 * type: string
 * format: date-time
 * example: "2025-12-31T19:00:00.000Z"
 * location:
 * type: string
 * nullable: true
 * example: "Salão de Festas Principal"
 * maxGuests:
 * type: string
 * nullable: true
 * example: "100"
 * image:
 * type: string
 * nullable: true
 * format: uri
 * example: "http://example.com/image.png"
 * notes:
 * type: string
 * nullable: true
 * example: "Lembrar de comprar balões."
 * type:
 * type: string
 * enum: [birthday, wedding, corporate, party, other]
 * default: other
 * example: "birthday"
 */

/**
 * @swagger
 * /api/events:
 * get:
 * summary: Lista todos os eventos do usuário autenticado
 * tags: [Events]
 * security:
 * - bearerAuth: []
 * responses:
 * '200':
 * description: Lista de eventos
 * content:
 * application/json:
 * schema:
 * type: array
 * items:
 * $ref: '#/components/schemas/Event'
 * '401':
 * description: Não autorizado
 * '500':
 * description: Erro interno do servidor
 */
router.get('/', authenticate, async (req, res) => { //
  try {
    const events = await req.prisma.event.findMany({
      where: {
        userId: req.user.id //
      },
      include: {
        _count: {
          select: {
            guests: true //
          }
        }
      },
      orderBy: {
        date: 'asc' //
      }
    });

    // Adicionar contagem de convidados confirmados e pendentes
    const eventsWithStats = await Promise.all(events.map(async (event) => {
      const confirmedCount = await req.prisma.guest.count({
        where: {
          eventId: event.id, //
          status: 'confirmed' //
        }
      });
      
      const pendingCount = await req.prisma.guest.count({
        where: {
          eventId: event.id, //
          status: 'pending' //
        }
      });
      
      return {
        ...event,
        guestsCount: event._count.guests, //
        confirmedCount,
        pendingCount
      };
    }));

    res.status(200).json(eventsWithStats); //
  } catch (error) {
    req.logger.error('Erro ao listar eventos:', error); //
    res.status(500).json({ error: 'Erro ao listar eventos' }); //
  }
});

/**
 * @swagger
 * /api/events/{id}:
 * get:
 * summary: Obtém um evento específico do usuário autenticado
 * tags: [Events]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * description: ID do evento
 * responses:
 * '200':
 * description: Detalhes do evento
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Event'
 * '401':
 * description: Não autorizado
 * '403':
 * description: Acesso negado (evento não pertence ao usuário)
 * '404':
 * description: Evento não encontrado
 * '500':
 * description: Erro interno do servidor
 */
router.get('/:id', authenticate, async (req, res) => { //
  try {
    const { id } = req.params; //
    
    const event = await req.prisma.event.findUnique({
      where: {
        id //
      },
      include: {
        invites: true, //
        _count: {
          select: {
            guests: true //
          }
        }
      }
    });
    
    if (!event) {
      return res.status(404).json({ error: 'Evento não encontrado' }); //
    }
    
    // Verificar se o evento pertence ao usuário
    if (event.userId !== req.user.id) { //
      return res.status(403).json({ error: 'Acesso negado' }); //
    }
    
    // Adicionar contagem de convidados confirmados e pendentes
    const confirmedCount = await req.prisma.guest.count({
      where: {
        eventId: event.id, //
        status: 'confirmed' //
      }
    });
    
    const pendingCount = await req.prisma.guest.count({
      where: {
        eventId: event.id, //
        status: 'pending' //
      }
    });
    
    const eventWithStats = {
      ...event,
      guestsCount: event._count.guests, //
      confirmedCount,
      pendingCount
    };
    
    res.status(200).json(eventWithStats); //
  } catch (error) {
    req.logger.error('Erro ao obter evento:', error); //
    res.status(500).json({ error: 'Erro ao obter evento' }); //
  }
});

/**
 * @swagger
 * /api/events:
 * post:
 * summary: Cria um novo evento para o usuário autenticado
 * tags: [Events]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/EventInput'
 * responses:
 * '201':
 * description: Evento criado com sucesso
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Event'
 * '400':
 * description: Dados de entrada inválidos
 * '401':
 * description: Não autorizado
 * '500':
 * description: Erro interno do servidor
 */
router.post('/', authenticate, async (req, res) => { //
  const { error, value } = eventSchema.validate(req.body); //
  if (error) return res.status(400).json({ error: error.details[0].message }); //

  try {
    const event = await req.prisma.event.create({
      data: {
        title:       value.title, //
        description: value.description, //
        date:        new Date(value.date), //
        location:    value.location, //
        maxGuests:   value.maxGuests, //
        notes:       value.notes, //
        type:        value.type, //
        image:       value.image || null, //
        userId:      req.user.id //
      }
    });
    res.status(201).json(event); //
  } catch (err) {
    req.logger.error('Erro ao criar evento:', err); //
    res.status(500).json({ error: 'Erro ao criar evento' }); //
  }
});

/**
 * @swagger
 * /api/events/{id}:
 * put:
 * summary: Atualiza um evento existente do usuário autenticado
 * tags: [Events]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * description: ID do evento
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/EventInput'
 * responses:
 * '200':
 * description: Evento atualizado com sucesso
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Event'
 * '400':
 * description: Dados de entrada inválidos
 * '401':
 * description: Não autorizado
 * '403':
 * description: Acesso negado
 * '404':
 * description: Evento não encontrado
 * '500':
 * description: Erro interno do servidor
 */
router.put('/:id', authenticate, async (req, res) => { //
  const { error, value } = eventSchema.validate(req.body); //
  if (error) return res.status(400).json({ error: error.details[0].message }); //

  try {
    const existing = await req.prisma.event.findUnique({ where: { id: req.params.id } }); //
    if (!existing) return res.status(404).json({ error: 'Evento não encontrado' }); //
    if (existing.userId !== req.user.id) return res.status(403).json({ error: 'Acesso negado' }); //

    const updated = await req.prisma.event.update({
      where: { id: req.params.id }, //
      data: {
        title:       value.title, //
        description: value.description, //
        date:        new Date(value.date), //
        location:    value.location, //
        maxGuests:   value.maxGuests, //
        notes:       value.notes, //
        type:        value.type, //
        image:       value.image || null //
      }
    });
    res.json(updated); //
  } catch (err) {
    req.logger.error('Erro ao atualizar evento:', err); //
    res.status(500).json({ error: 'Erro ao atualizar evento' }); //
  }
});

/**
 * @swagger
 * /api/events/{id}:
 * delete:
 * summary: Exclui um evento do usuário autenticado
 * tags: [Events]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * description: ID do evento
 * responses:
 * '204':
 * description: Evento excluído com sucesso
 * '401':
 * description: Não autorizado
 * '403':
 * description: Acesso negado
 * '404':
 * description: Evento não encontrado
 * '500':
 * description: Erro interno do servidor
 */
router.delete('/:id', authenticate, async (req, res) => { //
  try {
    const { id } = req.params; //
    
    // Verificar se o evento existe e pertence ao usuário
    const existingEvent = await req.prisma.event.findUnique({
      where: { id } //
    });
    
    if (!existingEvent) {
      return res.status(404).json({ error: 'Evento não encontrado' }); //
    }
    
    if (existingEvent.userId !== req.user.id) { //
      return res.status(403).json({ error: 'Acesso negado' }); //
    }
    
    // Excluir evento (isso também excluirá convites e convidados devido às relações no Prisma)
    await req.prisma.event.delete({
      where: { id } //
    });
    
    res.status(204).send(); //
  } catch (error) {
    req.logger.error('Erro ao excluir evento:', error); //
    res.status(500).json({ error: 'Erro ao excluir evento' }); //
  }
});

// Exportar a rota
module.exports = { router }; //