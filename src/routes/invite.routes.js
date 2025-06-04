const express = require('express');
const { authenticate } = require('./auth.routes'); //
const Joi = require('joi');
const router = express.Router();

// Esquema de validação para criação/atualização de convite
const inviteSchema = Joi.object({
  templateId: Joi.string().default('default'), //
  customText: Joi.string().allow('', null), //
  imageUrl: Joi.string().uri().allow('', null), //
  bgColor: Joi.string().default('#ffffff'), //
  textColor: Joi.string().default('#000000'), //
  accentColor: Joi.string().default('#5e35b1'), //
  fontFamily: Joi.string().default('Poppins'), //
  eventId: Joi.string().required(), //
  description: Joi.string().allow('', null), //
  eventTitle: Joi.string().allow('', null), //
  title: Joi.string().required() //
});

/**
 * @swagger
 * tags:
 * - name: Invites
 * description: Endpoints para gerenciamento de convites
 */

/**
 * @swagger
 * components:
 * schemas:
 * Invite:
 * type: object
 * properties:
 * id:
 * type: string
 * example: "clxinvite..."
 * title:
 * type: string
 * example: "Convite Especial Casamento"
 * templateId:
 * type: string
 * default: "default"
 * example: "template-floral"
 * customText:
 * type: string
 * nullable: true
 * example: "Junte-se a nós para celebrar!"
 * imageUrl:
 * type: string
 * format: uri
 * nullable: true
 * example: "http://example.com/invite-image.png"
 * bgColor:
 * type: string
 * default: "#ffffff"
 * example: "#f0f8ff"
 * textColor:
 * type: string
 * default: "#000000"
 * example: "#333333"
 * accentColor:
 * type: string
 * default: "#5e35b1"
 * example: "#ff69b4"
 * fontFamily:
 * type: string
 * default: "Poppins"
 * example: "Roboto"
 * eventId:
 * type: string
 * example: "clxevent..."
 * description:
 * type: string
 * nullable: true
 * example: "Detalhes adicionais sobre o evento."
 * eventTitle:
 * type: string
 * nullable: true
 * example: "Casamento de Maria e João"
 * createdAt:
 * type: string
 * format: date-time
 * updatedAt:
 * type: string
 * format: date-time
 * InviteInput:
 * type: object
 * required:
 * - eventId
 * - title
 * properties:
 * title:
 * type: string
 * example: "Convite Especial Casamento"
 * templateId:
 * type: string
 * default: "default"
 * example: "template-floral"
 * customText:
 * type: string
 * nullable: true
 * example: "Junte-se a nós para celebrar!"
 * imageUrl:
 * type: string
 * format: uri
 * nullable: true
 * example: "http://example.com/invite-image.png"
 * bgColor:
 * type: string
 * default: "#ffffff"
 * example: "#f0f8ff"
 * textColor:
 * type: string
 * default: "#000000"
 * example: "#333333"
 * accentColor:
 * type: string
 * default: "#5e35b1"
 * example: "#ff69b4"
 * fontFamily:
 * type: string
 * default: "Poppins"
 * example: "Roboto"
 * eventId:
 * type: string
 * example: "clxevent..."
 * description:
 * type: string
 * nullable: true
 * example: "Detalhes adicionais sobre o evento."
 * eventTitle:
 * type: string
 * nullable: true
 * example: "Casamento de Maria e João"
 * PublicInvite:
 * allOf:
 * - $ref: '#/components/schemas/Invite'
 * - type: object
 * properties:
 * event:
 * type: object
 * properties:
 * title:
 * type: string
 * description:
 * type: string
 * nullable: true
 * date:
 * type: string
 * format: date-time
 * location:
 * type: string
 * nullable: true
 * type:
 * type: string
 */

/**
 * @swagger
 * /api/invites/event/{eventId}:
 * get:
 * summary: Lista todos os convites de um evento específico
 * tags: [Invites]
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
 * description: Lista de convites
 * content:
 * application/json:
 * schema:
 * type: array
 * items:
 * $ref: '#/components/schemas/Invite'
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
    
    const invites = await req.prisma.invite.findMany({
      where: {
        eventId //
      }
    });
    
    res.status(200).json(invites); //
  } catch (error) {
    req.logger.error('Erro ao listar convites:', error); //
    res.status(500).json({ error: 'Erro ao listar convites' }); //
  }
});

/**
 * @swagger
 * /api/invites/{id}:
 * get:
 * summary: Obtém um convite específico
 * tags: [Invites]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * description: ID do convite
 * responses:
 * '200':
 * description: Detalhes do convite
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Invite' # Assumindo que Invite terá 'event' incluído
 * '401':
 * description: Não autorizado
 * '403':
 * description: Acesso negado
 * '404':
 * description: Convite não encontrado
 * '500':
 * description: Erro interno do servidor
 */
router.get('/:id', authenticate, async (req, res) => { //
  try {
    const { id } = req.params; //
    
    const invite = await req.prisma.invite.findUnique({
      where: {
        id //
      },
      include: {
        event: true //
      }
    });
    
    if (!invite) {
      return res.status(404).json({ error: 'Convite não encontrado' }); //
    }
    
    // Verificar se o convite pertence a um evento do usuário
    if (invite.event.userId !== req.user.id) { //
      return res.status(403).json({ error: 'Acesso negado' }); //
    }
    
    res.status(200).json(invite); //
  } catch (error) {
    req.logger.error('Erro ao obter convite:', error); //
    res.status(500).json({ error: 'Erro ao obter convite' }); //
  }
});

/**
 * @swagger
 * /api/invites:
 * post:
 * summary: Cria um novo convite para um evento
 * tags: [Invites]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/InviteInput'
 * responses:
 * '201':
 * description: Convite criado com sucesso
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Invite'
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
router.post('/', authenticate, async (req, res) => { //
  try {
    // Validar dados de entrada
    const { error, value } = inviteSchema.validate(req.body); //
    if (error) {
      return res.status(400).json({ error: error.details[0].message }); //
    }
    
    const { eventId, templateId, customText, imageUrl, bgColor, textColor, accentColor, eventTitle, fontFamily, title, description } = value; //
    
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
      } //
    });
    
    res.status(201).json(invite); //
  } catch (error) {
    req.logger.error('Erro ao criar convite:', error); //
    res.status(500).json({ error: 'Erro ao criar convite' }); //
  }
});

/**
 * @swagger
 * /api/invites/{id}:
 * put:
 * summary: Atualiza um convite existente
 * tags: [Invites]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * description: ID do convite
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/InviteInput'
 * responses:
 * '200':
 * description: Convite atualizado com sucesso
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Invite'
 * '400':
 * description: Dados de entrada inválidos
 * '401':
 * description: Não autorizado
 * '403':
 * description: Acesso negado
 * '404':
 * description: Convite não encontrado
 * '500':
 * description: Erro interno do servidor
 */
router.put('/:id', authenticate, async (req, res) => { //
  try {
    const { id } = req.params; //
    
    // Validar dados de entrada
    const { error, value } = inviteSchema.validate(req.body); //
    if (error) {
      return res.status(400).json({ error: error.details[0].message }); //
    }
    
    // Verificar se o convite existe
    const existingInvite = await req.prisma.invite.findUnique({
      where: { id }, //
      include: {
        event: true //
      }
    });
    
    if (!existingInvite) {
      return res.status(404).json({ error: 'Convite não encontrado' }); //
    }
    
    // Verificar se o convite pertence a um evento do usuário
    if (existingInvite.event.userId !== req.user.id) { //
      return res.status(403).json({ error: 'Acesso negado' }); //
    }
    
    const { templateId, customText, imageUrl, bgColor, textColor, accentColor, fontFamily, title, description, eventTitle } = value; //
    
    // Atualizar convite
    const updatedInvite = await req.prisma.invite.update({
      where: { id }, //
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
      } //
    });
    
    res.status(200).json(updatedInvite); //
  } catch (error) {
    req.logger.error('Erro ao atualizar convite:', error); //
    res.status(500).json({ error: 'Erro ao atualizar convite' }); //
  }
});

/**
 * @swagger
 * /api/invites/{id}:
 * delete:
 * summary: Exclui um convite
 * tags: [Invites]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * description: ID do convite
 * responses:
 * '204':
 * description: Convite excluído com sucesso
 * '401':
 * description: Não autorizado
 * '403':
 * description: Acesso negado
 * '404':
 * description: Convite não encontrado
 * '500':
 * description: Erro interno do servidor
 */
router.delete('/:id', authenticate, async (req, res) => { //
  try {
    const { id } = req.params; //
    
    // Verificar se o convite existe
    const existingInvite = await req.prisma.invite.findUnique({
      where: { id }, //
      include: {
        event: true //
      }
    });
    
    if (!existingInvite) {
      return res.status(404).json({ error: 'Convite não encontrado' }); //
    }
    
    // Verificar se o convite pertence a um evento do usuário
    if (existingInvite.event.userId !== req.user.id) { //
      return res.status(403).json({ error: 'Acesso negado' }); //
    }
    
    // Excluir convite
    await req.prisma.invite.delete({
      where: { id } //
    });
    
    res.status(204).send(); //
  } catch (error) {
    req.logger.error('Erro ao excluir convite:', error); //
    res.status(500).json({ error: 'Erro ao excluir convite' }); //
  }
});

/**
 * @swagger
 * /api/invites/public/{id}:
 * get:
 * summary: Obtém os dados públicos de um convite (para visualização por convidados)
 * tags: [Invites]
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * description: ID do convite
 * responses:
 * '200':
 * description: Dados públicos do convite
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/PublicInvite'
 * '404':
 * description: Convite não encontrado
 * '500':
 * description: Erro interno do servidor
 */
router.get('/public/:id', async (req, res) => { //
  try {
    const { id } = req.params; //
    
    const invite = await req.prisma.invite.findUnique({
      where: {
        id //
      },
      include: {
        event: {
          select: {
            title: true, //
            description: true, //
            date: true, //
            location: true, //
            type: true //
          }
        }
      }
    });
    
    if (!invite) {
      return res.status(404).json({ error: 'Convite não encontrado' }); //
    }
    
    res.status(200).json(invite); //
  } catch (error) {
    req.logger.error('Erro ao obter convite público:', error); //
    res.status(500).json({ error: 'Erro ao obter convite' }); //
  }
});

module.exports = { router }; //