const express = require('express');
const { authenticate } = require('./auth.routes'); //
const Joi = require('joi');
const router = express.Router();

// Esquema de validação para criação/atualização de convidado
const guestSchema = Joi.object({
  name: Joi.string().required(), //
  email: Joi.string().email().allow('', null), //
  phone: Joi.string().allow('', null), //
  status: Joi.string().valid('pending', 'confirmed', 'declined').default('pending'), //
  whatsapp: Joi.boolean().default(false), //
  plusOne: Joi.boolean().default(false), //
  plusOneName: Joi.string().allow('', null), //
  notes: Joi.string().allow('', null), //
  eventId: Joi.string().required(), //
  inviteId: Joi.string().allow(null), //
  imageUrl: Joi.string().allow('', null), //
  group: Joi.string().allow('', null), //
});

// Esquema de validação para atualização de status (RSVP)
const rsvpSchema = Joi.object({
  status: Joi.string().valid('confirmed', 'declined').required(), //
  plusOne: Joi.boolean(), //
  plusOneName: Joi.string().allow('', null) //
});

/**
 * @swagger
 * tags:
 * - name: Guests
 * description: Endpoints para gerenciamento de convidados
 */

/**
 * @swagger
 * components:
 * schemas:
 * Guest:
 * type: object
 * properties:
 * id:
 * type: string
 * example: "clxguest..."
 * name:
 * type: string
 * example: "Convidado Exemplo"
 * email:
 * type: string
 * format: email
 * nullable: true
 * example: "convidado@example.com"
 * phone:
 * type: string
 * nullable: true
 * example: "5511999998888"
 * status:
 * type: string
 * enum: [pending, confirmed, declined]
 * default: pending
 * example: "pending"
 * whatsapp:
 * type: boolean
 * default: false
 * plusOne:
 * type: boolean
 * default: false
 * plusOneName:
 * type: string
 * nullable: true
 * example: "Acompanhante Exemplo"
 * notes:
 * type: string
 * nullable: true
 * example: "Alergia a camarão"
 * eventId:
 * type: string
 * example: "clxevent..."
 * inviteId:
 * type: string
 * nullable: true
 * example: "clxinvite..."
 * imageUrl:
 * type: string
 * nullable: true
 * example: "http://example.com/guest.png"
 * group:
 * type: string
 * nullable: true
 * example: "Família da Noiva"
 * createdAt:
 * type: string
 * format: date-time
 * updatedAt:
 * type: string
 * format: date-time
 * GuestInput:
 * type: object
 * required:
 * - name
 * - eventId
 * properties:
 * name:
 * type: string
 * example: "Convidado Exemplo"
 * email:
 * type: string
 * format: email
 * nullable: true
 * example: "convidado@example.com"
 * phone:
 * type: string
 * nullable: true
 * example: "5511999998888"
 * status:
 * type: string
 * enum: [pending, confirmed, declined]
 * default: pending
 * example: "pending"
 * whatsapp:
 * type: boolean
 * default: false
 * plusOne:
 * type: boolean
 * default: false
 * plusOneName:
 * type: string
 * nullable: true
 * example: "Acompanhante Exemplo"
 * notes:
 * type: string
 * nullable: true
 * example: "Alergia a camarão"
 * eventId:
 * type: string
 * example: "clxevent..."
 * inviteId:
 * type: string
 * nullable: true
 * example: "clxinvite..."
 * imageUrl:
 * type: string
 * nullable: true
 * format: uri
 * example: "http://example.com/guest.png"
 * group:
 * type: string
 * nullable: true
 * example: "Família da Noiva"
 * RsvpInput:
 * type: object
 * required:
 * - status
 * properties:
 * status:
 * type: string
 * enum: [confirmed, declined]
 * example: "confirmed"
 * plusOne:
 * type: boolean
 * example: true
 * plusOneName:
 * type: string
 * nullable: true
 * example: "Acompanhante Confirmado"
 * ImportGuestsInput:
 * type: object
 * required:
 * - guests
 * - eventId
 * properties:
 * eventId:
 * type: string
 * description: ID do evento ao qual os convidados serão adicionados.
 * guests:
 * type: array
 * description: Lista de convidados para importar.
 * items:
 * type: object
 * required:
 * - name
 * properties:
 * name:
 * type: string
 * example: "Importado Silva"
 * email:
 * type: string
 * format: email
 * nullable: true
 * example: "importado@example.com"
 * phone:
 * type: string
 * nullable: true
 * example: "5521988887777"
 * ImportGuestsResponse:
 * type: object
 * properties:
 * count:
 * type: integer
 * description: Número de convidados importados com sucesso.
 * example: 10
 * Message:
 * type: object
 * properties:
 * id:
 * type: string
 * type:
 * type: string
 * enum: [invite, reminder, bulk, confirmation, status_change, response, other]
 * content:
 * type: string
 * status:
 * type: string
 * enum: [sent, received, failed]
 * guestId:
 * type: string
 * createdAt:
 * type: string
 * format: date-time
 */

/**
 * @swagger
 * /api/guests/event/{eventId}:
 * get:
 * summary: Lista todos os convidados de um evento específico
 * tags: [Guests]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: eventId
 * required: true
 * schema:
 * type: string
 * description: ID do evento
 * responses:
 * '200':
 * description: Lista de convidados
 * content:
 * application/json:
 * schema:
 * type: array
 * items:
 * $ref: '#/components/schemas/Guest'
 * '401':
 * description: Não autorizado
 * '403':
 * description: Acesso negado
 * '404':
 * description: Evento não encontrado
 * '500':
 * description: Erro interno do servidor
 */
router.get('/event/:eventId', authenticate, async (req, res) => { //
  try {
    const { eventId } = req.params; //
    
    // Verificar se o evento existe e pertence ao usuário
    const event = await req.prisma.event.findUnique({
      where: { id: eventId } //
    });
    
    if (!event) {
      return res.status(404).json({ error: 'Evento não encontrado' }); //
    }
    
    if (event.userId !== req.user.id) { //
      return res.status(403).json({ error: 'Acesso negado' }); //
    }
    
    const guests = await req.prisma.guest.findMany({
      where: {
        eventId //
      },
      orderBy: {
        name: 'asc' //
      }
    });
    
    res.status(200).json(guests); //
  } catch (error) {
    req.logger.error('Erro ao listar convidados:', error); //
    res.status(500).json({ error: 'Erro ao listar convidados' }); //
  }
});

/**
 * @swagger
 * /api/guests/{id}:
 * get:
 * summary: Obtém um convidado específico
 * tags: [Guests]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * description: ID do convidado
 * responses:
 * '200':
 * description: Detalhes do convidado
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Guest' # Assumindo que Guest terá 'event' e 'messages' incluídos
 * '401':
 * description: Não autorizado
 * '403':
 * description: Acesso negado
 * '404':
 * description: Convidado não encontrado
 * '500':
 * description: Erro interno do servidor
 */
router.get('/:id', authenticate, async (req, res) => { //
  try {
    const { id } = req.params; //
    
    const guest = await req.prisma.guest.findUnique({
      where: {
        id //
      },
      include: {
        event: true, //
        messages: true //
      }
    });
    
    if (!guest) {
      return res.status(404).json({ error: 'Convidado não encontrado' }); //
    }
    
    // Verificar se o convidado pertence a um evento do usuário
    if (guest.event.userId !== req.user.id) { //
      return res.status(403).json({ error: 'Acesso negado' }); //
    }
    
    res.status(200).json(guest); //
  } catch (error) {
    req.logger.error('Erro ao obter convidado:', error); //
    res.status(500).json({ error: 'Erro ao obter convidado' }); //
  }
});

/**
 * @swagger
 * /api/guests/{id}/messages:
 * get:
 * summary: Obtém todas as mensagens de um convidado específico
 * tags: [Guests]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * description: ID do convidado
 * responses:
 * '200':
 * description: Lista de mensagens do convidado
 * content:
 * application/json:
 * schema:
 * type: array
 * items:
 * $ref: '#/components/schemas/Message'
 * '401':
 * description: Não autorizado
 * '403':
 * description: Acesso negado
 * '404':
 * description: Convidado não encontrado
 * '500':
 * description: Erro interno do servidor
 */
router.get('/:id/messages', authenticate, async (req, res) => { //
  try {
    const { id } = req.params; //
    
    // Verificar se o convidado existe
    const guest = await req.prisma.guest.findUnique({
      where: { id }, //
      include: { event: true } //
    });
    
    if (!guest) {
      return res.status(404).json({ error: 'Convidado não encontrado' }); //
    }
    
    // Verificar se o convidado pertence a um evento do usuário
    if (guest.event.userId !== req.user.id) { //
      return res.status(403).json({ error: 'Acesso negado' }); //
    }
    
    // Buscar mensagens do convidado
    const messages = await req.prisma.message.findMany({
      where: { guestId: id }, //
      orderBy: { createdAt: 'desc' } //
    });
    
    res.status(200).json(messages); //
  } catch (error) {
    req.logger.error('Erro ao obter mensagens do convidado:', error); //
    res.status(500).json({ error: 'Erro ao obter mensagens do convidado' }); //
  }
});


/**
 * @swagger
 * /api/guests:
 * post:
 * summary: Adiciona um novo convidado a um evento
 * tags: [Guests]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/GuestInput'
 * responses:
 * '201':
 * description: Convidado adicionado com sucesso
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Guest'
 * '400':
 * description: Dados de entrada inválidos ou convite inválido
 * '401':
 * description: Não autorizado
 * '403':
 * description: Acesso negado
 * '404':
 * description: Evento não encontrado
 * '500':
 * description: Erro interno do servidor
 */
router.post('/', authenticate, async (req, res) => { //
  try {
    // Validar dados de entrada
    const { error, value } = guestSchema.validate(req.body); //
    if (error) {
      return res.status(400).json({ error: error.details[0].message }); //
    }

    const { name, email, phone, status, plusOne, plusOneName, whatsapp, group, notes, eventId, imageUrl, inviteId } = value; //
    
    // Verificar se o evento existe e pertence ao usuário
    const event = await req.prisma.event.findUnique({
      where: { id: eventId } //
    });
    
    if (!event) {
      return res.status(404).json({ error: 'Evento não encontrado' }); //
    }
    
    if (event.userId !== req.user.id) { //
      return res.status(403).json({ error: 'Acesso negado' }); //
    }
    
    // Verificar se o convite existe e pertence ao evento
    if (inviteId) {
      const invite = await req.prisma.invite.findUnique({ //
        where: { id: inviteId } //
      });
      
      if (!invite || invite.eventId !== eventId) { //
        return res.status(400).json({ error: 'Convite inválido para este evento' }); //
      }
    }
    
    // Criar convidado
    const guest = await req.prisma.guest.create({
      data: {
        name,
        email,
        whatsapp,
        phone,
        status,
        group,
        plusOne,
        imageUrl,
        plusOneName,
        notes,
        eventId,
        inviteId
      } //
    });
    
    res.status(201).json(guest); //
  } catch (error) {
    req.logger.error('Erro ao adicionar convidado:', error); //
    res.status(500).json({ error: 'Erro ao adicionar convidado' }); //
  }
});

/**
 * @swagger
 * /api/guests/{id}:
 * put:
 * summary: Atualiza um convidado existente
 * tags: [Guests]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * description: ID do convidado
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/GuestInput'
 * responses:
 * '200':
 * description: Convidado atualizado com sucesso
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Guest'
 * '400':
 * description: Dados de entrada inválidos ou convite inválido
 * '401':
 * description: Não autorizado
 * '403':
 * description: Acesso negado
 * '404':
 * description: Convidado não encontrado
 * '500':
 * description: Erro interno do servidor
 */
router.put('/:id', authenticate, async (req, res) => { //
  try {
    const { id } = req.params; //
    
    // Validar dados de entrada
    const { error, value } = guestSchema.validate(req.body); //
    if (error) {
      return res.status(400).json({ error: error.details[0].message }); //
    }
    
    // Verificar se o convidado existe
    const existingGuest = await req.prisma.guest.findUnique({
      where: { id }, //
      include: {
        event: true //
      }
    });
    
    if (!existingGuest) {
      return res.status(404).json({ error: 'Convidado não encontrado' }); //
    }
    
    // Verificar se o convidado pertence a um evento do usuário
    if (existingGuest.event.userId !== req.user.id) { //
      return res.status(403).json({ error: 'Acesso negado' }); //
    }
    
    const { name, email, phone, status, plusOne, plusOneName, whatsapp, group, notes, eventId, imageUrl, inviteId } = value; //
    
    // Verificar se o convite existe e pertence ao evento
    if (inviteId) {
      const invite = await req.prisma.invite.findUnique({ //
        where: { id: inviteId } //
      });
      
      if (!invite || invite.eventId !== existingGuest.eventId) { //
        return res.status(400).json({ error: 'Convite inválido para este evento' }); //
      }
    }
    
    // Verificar se o status está sendo alterado
    const statusChanged = existingGuest.status !== status; //
    
    // Atualizar convidado
    const updatedGuest = await req.prisma.guest.update({
      where: { id }, //
      data: {
        name,
        email,
        whatsapp,
        phone,
        status,
        group,
        plusOne,
        imageUrl,
        plusOneName,
        notes,
        inviteId
      } //
    });
    
    // Se o status foi alterado, registrar uma mensagem
    if (statusChanged) {
      await req.prisma.message.create({
        data: {
          type: 'status_change', //
          content: `Status atualizado para: ${status} (pelo organizador)`, //
          status: 'sent', //
          guestId: id //
        }
      });
    }
    
    res.status(200).json(updatedGuest); //
  } catch (error) {
    req.logger.error('Erro ao atualizar convidado:', error); //
    res.status(500).json({ error: 'Erro ao atualizar convidado' }); //
  }
});

/**
 * @swagger
 * /api/guests/{id}:
 * delete:
 * summary: Exclui um convidado
 * tags: [Guests]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * description: ID do convidado
 * responses:
 * '204':
 * description: Convidado excluído com sucesso
 * '401':
 * description: Não autorizado
 * '403':
 * description: Acesso negado
 * '404':
 * description: Convidado não encontrado
 * '500':
 * description: Erro interno do servidor
 */
router.delete('/:id', authenticate, async (req, res) => { //
  try {
    const { id } = req.params; //
    
    // Verificar se o convidado existe
    const existingGuest = await req.prisma.guest.findUnique({
      where: { id }, //
      include: {
        event: true //
      }
    });
    
    if (!existingGuest) {
      return res.status(404).json({ error: 'Convidado não encontrado' }); //
    }
    
    // Verificar se o convidado pertence a um evento do usuário
    if (existingGuest.event.userId !== req.user.id) { //
      return res.status(403).json({ error: 'Acesso negado' }); //
    }
    
    // Excluir convidado
    await req.prisma.guest.delete({
      where: { id } //
    });
    
    res.status(204).send(); //
  } catch (error) {
    req.logger.error('Erro ao excluir convidado:', error); //
    res.status(500).json({ error: 'Erro ao excluir convidado' }); //
  }
});

/**
 * @swagger
 * /api/guests/import:
 * post:
 * summary: Importa múltiplos convidados para um evento
 * tags: [Guests]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/ImportGuestsInput'
 * responses:
 * '201':
 * description: Convidados importados com sucesso
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/ImportGuestsResponse'
 * '400':
 * description: Lista de convidados inválida ou evento não encontrado
 * '401':
 * description: Não autorizado
 * '403':
 * description: Acesso negado
 * '404':
 * description: Evento não encontrado
 * '500':
 * description: Erro interno do servidor
 */
router.post('/import', authenticate, async (req, res) => { //
  try {
    const { guests, eventId } = req.body; //
    
    if (!Array.isArray(guests) || guests.length === 0) { //
      return res.status(400).json({ error: 'Lista de convidados inválida' }); //
    }
    
    // Verificar se o evento existe e pertence ao usuário
    const event = await req.prisma.event.findUnique({
      where: { id: eventId } //
    });
    
    if (!event) {
      return res.status(404).json({ error: 'Evento não encontrado' }); //
    }
    
    if (event.userId !== req.user.id) { //
      return res.status(403).json({ error: 'Acesso negado' }); //
    }
    
    // Criar convidados em lote
    const createdGuests = await req.prisma.guest.createMany({
      data: guests.map(guest => ({
        name: guest.name, //
        email: guest.email || null, //
        phone: guest.phone || null, //
        status: 'pending', //
        eventId //
      })),
      skipDuplicates: true //
    });
    
    res.status(201).json({ count: createdGuests.count }); //
  } catch (error) {
    req.logger.error('Erro ao importar convidados:', error); //
    res.status(500).json({ error: 'Erro ao importar convidados' }); //
  }
});

/**
 * @swagger
 * /api/guests/rsvp/{id}:
 * post:
 * summary: Permite que um convidado confirme ou decline presença (RSVP)
 * tags: [Guests]
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * description: ID do convidado (geralmente parte de um link único de RSVP)
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/RsvpInput'
 * responses:
 * '200':
 * description: RSVP processado com sucesso
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Guest'
 * '400':
 * description: Dados de entrada inválidos
 * '404':
 * description: Convidado não encontrado
 * '500':
 * description: Erro interno do servidor
 */
router.post('/rsvp/:id', async (req, res) => { //
  try {
    const { id } = req.params; //
    
    // Validar dados de entrada
    const { error, value } = rsvpSchema.validate(req.body); //
    if (error) {
      return res.status(400).json({ error: error.details[0].message }); //
    }
    
    const { status, plusOne, plusOneName } = value; //
    
    // Verificar se o convidado existe
    const guest = await req.prisma.guest.findUnique({
      where: { id } //
    });
    
    if (!guest) {
      return res.status(404).json({ error: 'Convidado não encontrado' }); //
    }
    
    // Atualizar status do convidado
    const updatedGuest = await req.prisma.guest.update({
      where: { id }, //
      data: {
        status, //
        plusOne: plusOne !== undefined ? plusOne : guest.plusOne, //
        plusOneName: plusOneName !== undefined ? plusOneName : guest.plusOneName //
      }
    });
    
    // Registrar mensagem de confirmação
    await req.prisma.message.create({
      data: {
        type: 'confirmation', //
        content: `Status atualizado para: ${status}`, //
        status: 'sent', //
        guestId: id //
      }
    });
    
    res.status(200).json(updatedGuest); //
  } catch (error) {
    req.logger.error('Erro ao processar RSVP:', error); //
    res.status(500).json({ error: 'Erro ao processar confirmação' }); //
  }
});

module.exports = { router }; //