const express = require('express');
const { authenticate } = require('./auth.routes');
const Joi = require('joi');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Invite
 *     description: Endpoints para gerenciamento de convites de eventos
 */

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

/**
 * @swagger
 * /api/invite/event/{eventId}:
 *   get:
 *     summary: Lista todos os convites associados a um evento específico.
 *     tags: [Invite]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do evento para o qual listar os convites.
 *     responses:
 *       200:
 *         description: Lista de convites recuperada com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Invite'
 *       403:
 *         description: Acesso negado. O usuário não tem permissão para acessar os convites deste evento.
 *       404:
 *         description: Evento não encontrado.
 *       500:
 *         description: Erro interno do servidor ao tentar listar os convites.
 */
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

/**
 * @swagger
 * /api/invite/{id}:
 *   get:
 *     summary: Obtém os detalhes de um convite específico pelo seu ID.
 *     tags: [Invite]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID único do convite a ser recuperado.
 *     responses:
 *       200:
 *         description: Detalhes do convite recuperados com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InviteWithEvent'
 *       403:
 *         description: Acesso negado. O usuário não tem permissão para acessar este convite.
 *       404:
 *         description: Convite não encontrado.
 *       500:
 *         description: Erro interno do servidor ao tentar obter o convite.
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const invite = await req.prisma.invite.findUnique({
      where: {
        id
      },
      include: {
        event: true // Inclui dados do evento associado
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

/**
 * @swagger
 * /api/invite:
 *   post:
 *     summary: Cria um novo convite para um evento.
 *     tags: [Invite]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InviteInput'
 *     responses:
 *       201:
 *         description: Convite criado com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Invite'
 *       400:
 *         description: Erro de validação nos dados fornecidos.
 *       403:
 *         description: Acesso negado. O usuário não pode criar convites para este evento.
 *       404:
 *         description: Evento associado não encontrado.
 *       500:
 *         description: Erro interno do servidor ao tentar criar o convite.
 */
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

/**
 * @swagger
 * /api/invite/{id}:
 *   put:
 *     summary: Atualiza um convite existente.
 *     tags: [Invite]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do convite a ser atualizado.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InviteInput' # Reutiliza o schema de input, mas eventId não é atualizável aqui
 *     responses:
 *       200:
 *         description: Convite atualizado com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Invite'
 *       400:
 *         description: Erro de validação nos dados fornecidos.
 *       403:
 *         description: Acesso negado. O usuário não tem permissão para atualizar este convite.
 *       404:
 *         description: Convite não encontrado.
 *       500:
 *         description: Erro interno do servidor ao tentar atualizar o convite.
 */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Validar dados de entrada (ignora eventId na atualização)
    const { error, value } = inviteSchema.fork(['eventId'], (schema) => schema.optional()).validate(req.body);
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

    // Remove eventId do objeto de atualização, pois não deve ser alterado
    const { eventId, ...updateData } = value;

    // Atualizar convite
    const updatedInvite = await req.prisma.invite.update({
      where: { id },
      data: updateData
    });

    res.status(200).json(updatedInvite);
  } catch (error) {
    req.logger.error('Erro ao atualizar convite:', error);
    res.status(500).json({ error: 'Erro ao atualizar convite' });
  }
});

/**
 * @swagger
 * /api/invite/{id}:
 *   delete:
 *     summary: Exclui um convite específico.
 *     tags: [Invite]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do convite a ser excluído.
 *     responses:
 *       204:
 *         description: Convite excluído com sucesso. Sem conteúdo de resposta.
 *       403:
 *         description: Acesso negado. O usuário não tem permissão para excluir este convite.
 *       404:
 *         description: Convite não encontrado.
 *       500:
 *         description: Erro interno do servidor ao tentar excluir o convite.
 */
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

/**
 * @swagger
 * /api/invite/public/{id}:
 *   get:
 *     summary: Rota pública para visualizar um convite (usado pelos convidados).
 *     tags: [Invite]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID único do convite a ser visualizado publicamente.
 *     responses:
 *       200:
 *         description: Detalhes do convite recuperados com sucesso para visualização pública.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PublicInvite'
 *       404:
 *         description: Convite não encontrado.
 *       500:
 *         description: Erro interno do servidor ao tentar obter o convite público.
 */
router.get('/public/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const invite = await req.prisma.invite.findUnique({
      where: {
        id
      },
      include: {
        event: {
          select: { // Seleciona apenas campos relevantes do evento para a visão pública
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

/**
 * @swagger
 * /api/invite/link-guests/{inviteId}:
 *   post:
 *     summary: Vincula múltiplos convidados a um convite de uma só vez.
 *     tags: [Invite]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: O ID do convite ao qual os convidados serão vinculados.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               guestIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Uma lista com os IDs dos convidados a serem vinculados.
 *             example:
 *               guestIds: ["uuid-guest-1", "uuid-guest-2", "uuid-guest-3"]
 *     responses:
 *       200:
 *         description: Convidados vinculados com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 count:
 *                   type: integer
 *       400:
 *         description: Erro de validação. A lista de `guestIds` não foi fornecida ou está vazia.
 *       403:
 *         description: Acesso negado. O usuário não tem permissão para modificar este convite.
 *       404:
 *         description: Convite não encontrado.
 *       500:
 *         description: Erro interno do servidor.
 */
router.post('/link-guests/:inviteId', authenticate, async (req, res) => {
  try {
    const { inviteId } = req.params;
    const { guestIds } = req.body;
    const userId = req.user.id;

    if (!guestIds || !Array.isArray(guestIds) || guestIds.length === 0) {
      return res.status(400).json({ error: 'A lista de "guestIds" é obrigatória e não pode estar vazia.' });
    }

    // 1. Verificar se o convite existe e pertence ao usuário (através do evento)
    const invite = await req.prisma.invite.findFirst({
      where: {
        id: inviteId,
        event: {
          userId: userId,
        },
      },
    });

    if (!invite) {
      return res.status(404).json({ error: 'Convite não encontrado ou você não tem permissão para acessá-lo.' });
    }

    // 2. A MÁGICA: Atualização em massa com a condição correta, validada pelo seu schema
    const { count } = await req.prisma.guest.updateMany({
      where: {
        id: {
          in: guestIds,
        },
        // A CONDIÇÃO CORRETA:
        // "Onde o evento (event) associado ao convidado
        // tem um userId que corresponde ao do usuário logado"
        event: {
          userId: userId,
        },
      },
      data: {
        inviteId: inviteId,
      },
    });

    // 3. Responder com sucesso
    res.status(200).json({
      message: `${count} convidados foram vinculados com sucesso.`,
      count: count,
    });

  } catch (error) {
    if (error.name === 'PrismaClientValidationError') {
      req.logger.error('Erro de validação do Prisma:', error.message);
      return res.status(400).json({ error: 'Erro nos dados da requisição para o banco de dados.' });
    }
    req.logger.error('Erro ao vincular múltiplos convidados:', error);
    res.status(500).json({ error: 'Erro ao vincular convidados' });
  }
});

// É necessário definir os Schemas no arquivo principal do Swagger
// Exemplo de como poderiam ser definidos:
/**
 * @swagger
 * components:
 *   schemas:
 *     Invite:
 *       type: object
 *       properties:
 *         id: 
 *           type: string
 *           description: ID único do convite.
 *         templateId: 
 *           type: string
 *           description: ID do template usado.
 *         customText: 
 *           type: string
 *           description: Texto customizado do convite.
 *         imageUrl: 
 *           type: string
 *           format: uri
 *           description: URL da imagem do convite.
 *         bgColor: 
 *           type: string
 *           description: Cor de fundo do convite.
 *         textColor: 
 *           type: string
 *           description: Cor do texto do convite.
 *         accentColor: 
 *           type: string
 *           description: Cor de destaque do convite.
 *         fontFamily: 
 *           type: string
 *           description: Família da fonte usada.
 *         title: 
 *           type: string
 *           description: Título do convite.
 *         description: 
 *           type: string
 *           description: Descrição do convite.
 *         eventTitle: 
 *           type: string
 *           description: Título do evento (pode ser diferente do título do evento principal).
 *         eventId: 
 *           type: string
 *           description: ID do evento ao qual o convite pertence.
 *         createdAt: 
 *           type: string
 *           format: date-time
 *           description: Data de criação do convite.
 *         updatedAt: 
 *           type: string
 *           format: date-time
 *           description: Data da última atualização do convite.
 *     InviteInput:
 *       type: object
 *       required:
 *         - eventId
 *         - title
 *       properties:
 *         templateId: 
 *           type: string
 *           default: 'default'
 *         customText: 
 *           type: string
 *           nullable: true
 *         imageUrl: 
 *           type: string
 *           format: uri
 *           nullable: true
 *         bgColor: 
 *           type: string
 *           default: '#ffffff'
 *         textColor: 
 *           type: string
 *           default: '#000000'
 *         accentColor: 
 *           type: string
 *           default: '#5e35b1'
 *         fontFamily: 
 *           type: string
 *           default: 'Poppins'
 *         eventId: 
 *           type: string
 *           description: ID do evento ao qual o convite será associado.
 *         description: 
 *           type: string
 *           nullable: true
 *         eventTitle: 
 *           type: string
 *           nullable: true
 *         title: 
 *           type: string
 *           description: Título principal do convite.
 *     InviteWithEvent:
 *       allOf:
 *         - $ref: '#/components/schemas/Invite'
 *         - type: object
 *           properties:
 *             event:
 *               $ref: '#/components/schemas/Event' # Supondo que exista um schema Event
 *     PublicInvite:
 *       allOf:
 *         - $ref: '#/components/schemas/Invite'
 *         - type: object
 *           properties:
 *             event:
 *               type: object
 *               properties:
 *                 title: 
 *                   type: string
 *                 description: 
 *                   type: string
 *                 date: 
 *                   type: string
 *                   format: date-time
 *                 location: 
 *                   type: string
 *                 type: 
 *                   type: string
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

module.exports = { router };