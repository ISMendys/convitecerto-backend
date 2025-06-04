const express = require("express");
const { authenticate } = require("./auth.routes");
const Joi = require("joi");
const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Guest
 *     description: Endpoints para gerenciamento de convidados de eventos
 */

// Esquema de validação para criação/atualização de convidado
const guestSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().allow("", null),
  phone: Joi.string().allow("", null),
  status: Joi.string().valid("pending", "confirmed", "declined").default("pending"),
  whatsapp: Joi.boolean().default(false),
  plusOne: Joi.boolean().default(false),
  plusOneName: Joi.string().allow("", null),
  notes: Joi.string().allow("", null),
  eventId: Joi.string().required(),
  inviteId: Joi.string().allow(null),
  imageUrl: Joi.string().allow("", null),
  group: Joi.string().allow("", null),
});

// Esquema de validação para atualização de status (RSVP)
const rsvpSchema = Joi.object({
  status: Joi.string().valid("confirmed", "declined").required(),
  plusOne: Joi.boolean(),
  plusOneName: Joi.string().allow("", null),
});

/**
 * @swagger
 * /api/guest/event/{eventId}:
 *   get:
 *     summary: Lista todos os convidados associados a um evento específico.
 *     tags: [Guest]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do evento para o qual listar os convidados.
 *     responses:
 *       200:
 *         description: Lista de convidados recuperada com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/Guest"
 *       403:
 *         description: Acesso negado. O usuário não tem permissão para acessar os convidados deste evento.
 *       404:
 *         description: Evento não encontrado.
 *       500:
 *         description: Erro interno do servidor ao tentar listar os convidados.
 */
router.get("/event/:eventId", authenticate, async (req, res) => {
  try {
    const { eventId } = req.params;

    // Verificar se o evento existe e pertence ao usuário
    const event = await req.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return res.status(404).json({ error: "Evento não encontrado" });
    }

    if (event.userId !== req.user.id) {
      return res.status(403).json({ error: "Acesso negado" });
    }

    const guests = await req.prisma.guest.findMany({
      where: {
        eventId,
      },
      orderBy: {
        name: "asc",
      },
    });

    res.status(200).json(guests);
  } catch (error) {
    req.logger.error("Erro ao listar convidados:", error);
    res.status(500).json({ error: "Erro ao listar convidados" });
  }
});

/**
 * @swagger
 * /api/guest/{id}:
 *   get:
 *     summary: Obtém os detalhes de um convidado específico pelo seu ID.
 *     tags: [Guest]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID único do convidado a ser recuperado.
 *     responses:
 *       200:
 *         description: Detalhes do convidado recuperados com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/GuestWithDetails"
 *       403:
 *         description: Acesso negado. O usuário não tem permissão para acessar este convidado.
 *       404:
 *         description: Convidado não encontrado.
 *       500:
 *         description: Erro interno do servidor ao tentar obter o convidado.
 */
router.get("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const guest = await req.prisma.guest.findUnique({
      where: {
        id,
      },
      include: {
        event: true, // Inclui dados do evento associado
        messages: true, // Inclui mensagens associadas ao convidado
      },
    });

    if (!guest) {
      return res.status(404).json({ error: "Convidado não encontrado" });
    }

    // Verificar se o convidado pertence a um evento do usuário
    if (guest.event.userId !== req.user.id) {
      return res.status(403).json({ error: "Acesso negado" });
    }

    res.status(200).json(guest);
  } catch (error) {
    req.logger.error("Erro ao obter convidado:", error);
    res.status(500).json({ error: "Erro ao obter convidado" });
  }
});

/**
 * @swagger
 * /api/guest/{id}/messages:
 *   get:
 *     summary: Obtém as mensagens associadas a um convidado específico.
 *     tags: [Guest]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do convidado para o qual buscar as mensagens.
 *     responses:
 *       200:
 *         description: Lista de mensagens recuperada com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/Message"
 *       403:
 *         description: Acesso negado.
 *       404:
 *         description: Convidado não encontrado.
 *       500:
 *         description: Erro interno do servidor ao obter mensagens.
 */
router.get("/:id/messages", authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se o convidado existe
    const guest = await req.prisma.guest.findUnique({
      where: { id },
      include: { event: true },
    });

    if (!guest) {
      return res.status(404).json({ error: "Convidado não encontrado" });
    }

    // Verificar se o convidado pertence a um evento do usuário
    if (guest.event.userId !== req.user.id) {
      return res.status(403).json({ error: "Acesso negado" });
    }

    // Buscar mensagens do convidado
    const messages = await req.prisma.message.findMany({
      where: { guestId: id },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(messages);
  } catch (error) {
    req.logger.error("Erro ao obter mensagens do convidado:", error);
    res.status(500).json({ error: "Erro ao obter mensagens do convidado" });
  }
});

/**
 * @swagger
 * /api/guest:
 *   post:
 *     summary: Adiciona um novo convidado a um evento.
 *     tags: [Guest]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/GuestInput"
 *     responses:
 *       201:
 *         description: Convidado adicionado com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Guest"
 *       400:
 *         description: Erro de validação nos dados fornecidos ou convite inválido.
 *       403:
 *         description: Acesso negado. O usuário não pode adicionar convidados a este evento.
 *       404:
 *         description: Evento associado não encontrado.
 *       500:
 *         description: Erro interno do servidor ao tentar adicionar o convidado.
 */
router.post("/", authenticate, async (req, res) => {
  try {
    // Validar dados de entrada
    const { error, value } = guestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, email, phone, status, plusOne, plusOneName, whatsapp, group, notes, eventId, imageUrl, inviteId } = value;

    // Verificar se o evento existe e pertence ao usuário
    const event = await req.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return res.status(404).json({ error: "Evento não encontrado" });
    }

    if (event.userId !== req.user.id) {
      return res.status(403).json({ error: "Acesso negado" });
    }

    // Verificar se o convite existe e pertence ao evento
    if (inviteId) {
      const invite = await req.prisma.invite.findUnique({
        where: { id: inviteId },
      });

      if (!invite || invite.eventId !== eventId) {
        return res.status(400).json({ error: "Convite inválido para este evento" });
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
        inviteId,
      },
    });

    res.status(201).json(guest);
  } catch (error) {
    req.logger.error("Erro ao adicionar convidado:", error);
    res.status(500).json({ error: "Erro ao adicionar convidado" });
  }
});

/**
 * @swagger
 * /api/guest/{id}:
 *   put:
 *     summary: Atualiza os dados de um convidado existente.
 *     tags: [Guest]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do convidado a ser atualizado.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/GuestInput" # Reutiliza o schema de input
 *     responses:
 *       200:
 *         description: Convidado atualizado com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Guest"
 *       400:
 *         description: Erro de validação nos dados fornecidos ou convite inválido.
 *       403:
 *         description: Acesso negado. O usuário não tem permissão para atualizar este convidado.
 *       404:
 *         description: Convidado não encontrado.
 *       500:
 *         description: Erro interno do servidor ao tentar atualizar o convidado.
 */
router.put("/:id", authenticate, async (req, res) => {
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
        event: true,
      },
    });

    if (!existingGuest) {
      return res.status(404).json({ error: "Convidado não encontrado" });
    }

    // Verificar se o convidado pertence a um evento do usuário
    if (existingGuest.event.userId !== req.user.id) {
      return res.status(403).json({ error: "Acesso negado" });
    }

    const { name, email, phone, status, plusOne, plusOneName, whatsapp, group, notes, eventId, imageUrl, inviteId } = value;

    // Verificar se o convite existe e pertence ao evento (se fornecido)
    if (inviteId) {
      const invite = await req.prisma.invite.findUnique({
        where: { id: inviteId },
      });

      if (!invite || invite.eventId !== existingGuest.eventId) {
        return res.status(400).json({ error: "Convite inválido para este evento" });
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
        whatsapp,
        phone,
        status,
        group,
        plusOne,
        imageUrl,
        plusOneName,
        notes,
        inviteId, // Permite atualizar o convite associado
        // eventId não é atualizado aqui, pois está no schema mas não deve mudar
      },
    });

    // Se o status foi alterado, registrar uma mensagem
    if (statusChanged) {
      await req.prisma.message.create({
        data: {
          type: "status_change",
          content: `Status atualizado para: ${status} (pelo organizador)`,
          status: "sent",
          guestId: id,
        },
      });
    }

    res.status(200).json(updatedGuest);
  } catch (error) {
    req.logger.error("Erro ao atualizar convidado:", error);
    res.status(500).json({ error: "Erro ao atualizar convidado" });
  }
});

/**
 * @swagger
 * /api/guest/{id}:
 *   delete:
 *     summary: Exclui um convidado específico.
 *     tags: [Guest]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do convidado a ser excluído.
 *     responses:
 *       204:
 *         description: Convidado excluído com sucesso. Sem conteúdo de resposta.
 *       403:
 *         description: Acesso negado. O usuário não tem permissão para excluir este convidado.
 *       404:
 *         description: Convidado não encontrado.
 *       500:
 *         description: Erro interno do servidor ao tentar excluir o convidado.
 */
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se o convidado existe
    const existingGuest = await req.prisma.guest.findUnique({
      where: { id },
      include: {
        event: true,
      },
    });

    if (!existingGuest) {
      return res.status(404).json({ error: "Convidado não encontrado" });
    }

    // Verificar se o convidado pertence a um evento do usuário
    if (existingGuest.event.userId !== req.user.id) {
      return res.status(403).json({ error: "Acesso negado" });
    }

    // Excluir convidado (e mensagens associadas por cascata, se configurado no schema.prisma)
    await req.prisma.guest.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    req.logger.error("Erro ao excluir convidado:", error);
    res.status(500).json({ error: "Erro ao excluir convidado" });
  }
});

/**
 * @swagger
 * /api/guest/import:
 *   post:
 *     summary: Importa múltiplos convidados para um evento.
 *     tags: [Guest]
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
 *               - guests
 *             properties:
 *               eventId:
 *                 type: string
 *                 description: ID do evento para o qual importar os convidados.
 *               guests:
 *                 type: array
 *                 description: Lista de objetos de convidados a serem importados.
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                       format: email
 *                     phone:
 *                       type: string
 *                     # Adicione outros campos se necessário para importação
 *     responses:
 *       201:
 *         description: Convidados importados com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   description: Número de convidados criados com sucesso.
 *       400:
 *         description: Lista de convidados inválida ou vazia.
 *       403:
 *         description: Acesso negado.
 *       404:
 *         description: Evento não encontrado.
 *       500:
 *         description: Erro interno do servidor ao importar convidados.
 */
router.post("/import", authenticate, async (req, res) => {
  try {
    const { guests, eventId } = req.body;

    if (!Array.isArray(guests) || guests.length === 0) {
      return res.status(400).json({ error: "Lista de convidados inválida" });
    }

    // Verificar se o evento existe e pertence ao usuário
    const event = await req.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return res.status(404).json({ error: "Evento não encontrado" });
    }

    if (event.userId !== req.user.id) {
      return res.status(403).json({ error: "Acesso negado" });
    }

    // Preparar dados para criação em lote
    const guestData = guests.map((guest) => ({
      name: guest.name,
      email: guest.email || null,
      phone: guest.phone || null,
      status: "pending", // Status padrão para importados
      eventId,
      // Adicione outros campos padrão se necessário
      whatsapp: guest.whatsapp || false,
      plusOne: guest.plusOne || false,
      plusOneName: guest.plusOneName || null,
      notes: guest.notes || null,
      group: guest.group || null,
      imageUrl: guest.imageUrl || null,
      inviteId: guest.inviteId || null,
    }));

    // Criar convidados em lote
    const createdGuests = await req.prisma.guest.createMany({
      data: guestData,
      skipDuplicates: true, // Evita erro se houver duplicatas (baseado nas constraints unique do schema)
    });

    res.status(201).json({ count: createdGuests.count });
  } catch (error) {
    req.logger.error("Erro ao importar convidados:", error);
    // Verifica se o erro é de constraint única (ex: email duplicado)
    if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Erro de duplicidade ao importar convidados. Verifique emails ou outros campos únicos.', details: error.meta });
    }
    res.status(500).json({ error: "Erro ao importar convidados" });
  }
});

/**
 * @swagger
 * /api/guest/rsvp/{id}:
 *   post:
 *     summary: Rota pública para um convidado confirmar ou declinar presença (RSVP).
 *     tags: [Guest]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID único do convidado que está respondendo.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/RsvpInput"
 *     responses:
 *       200:
 *         description: RSVP processado com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Guest"
 *       400:
 *         description: Erro de validação nos dados fornecidos.
 *       404:
 *         description: Convidado não encontrado.
 *       500:
 *         description: Erro interno do servidor ao processar o RSVP.
 */
router.post("/rsvp/:id", async (req, res) => {
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
      where: { id },
    });

    if (!guest) {
      return res.status(404).json({ error: "Convidado não encontrado" });
    }

    // Atualizar status do convidado
    const updatedGuest = await req.prisma.guest.update({
      where: { id },
      data: {
        status,
        plusOne: plusOne !== undefined ? plusOne : guest.plusOne,
        plusOneName: plusOneName !== undefined ? plusOneName : guest.plusOneName,
      },
    });

    // Registrar mensagem de confirmação/declínio
    await req.prisma.message.create({
      data: {
        type: "confirmation", // Ou 'declination' dependendo do status?
        content: `RSVP recebido: ${status}${plusOne ? ' com acompanhante' + (plusOneName ? ` (${plusOneName})` : '') : ''}`,
        status: "received", // Status da mensagem, não do convidado
        guestId: id,
      },
    });

    res.status(200).json(updatedGuest);
  } catch (error) {
    req.logger.error("Erro ao processar RSVP:", error);
    res.status(500).json({ error: "Erro ao processar confirmação" });
  }
});

// Definições de Schema para Swagger (devem estar no arquivo principal ou importadas)
/**
 * @swagger
 * components:
 *   schemas:
 *     Guest:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: ID único do convidado.
 *         name:
 *           type: string
 *           description: Nome do convidado.
 *         email:
 *           type: string
 *           format: email
 *           nullable: true
 *           description: Email do convidado.
 *         phone:
 *           type: string
 *           nullable: true
 *           description: Telefone do convidado.
 *         status:
 *           type: string
 *           enum: [pending, confirmed, declined]
 *           description: Status de confirmação do convidado.
 *         whatsapp:
 *           type: boolean
 *           description: Indica se o convidado prefere contato via WhatsApp.
 *         plusOne:
 *           type: boolean
 *           description: Indica se o convidado levará um acompanhante.
 *         plusOneName:
 *           type: string
 *           nullable: true
 *           description: Nome do acompanhante, se houver.
 *         notes:
 *           type: string
 *           nullable: true
 *           description: Observações sobre o convidado.
 *         eventId:
 *           type: string
 *           description: ID do evento ao qual o convidado pertence.
 *         inviteId:
 *           type: string
 *           nullable: true
 *           description: ID do convite associado a este convidado (opcional).
 *         imageUrl:
 *           type: string
 *           nullable: true
 *           description: URL da imagem do convidado (opcional).
 *         group:
 *           type: string
 *           nullable: true
 *           description: "Grupo ao qual o convidado pertence (ex: 'Família da Noiva')."
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Data de criação do registro do convidado.
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Data da última atualização do registro do convidado.
 *     GuestInput:
 *       type: object
 *       required:
 *         - name
 *         - eventId
 *       properties:
 *         name:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *           nullable: true
 *         phone:
 *           type: string
 *           nullable: true
 *         status:
 *           type: string
 *           enum: [pending, confirmed, declined]
 *           default: pending
 *         whatsapp:
 *           type: boolean
 *           default: false
 *         plusOne:
 *           type: boolean
 *           default: false
 *         plusOneName:
 *           type: string
 *           nullable: true
 *         notes:
 *           type: string
 *           nullable: true
 *         eventId:
 *           type: string
 *           description: ID do evento ao qual associar o convidado.
 *         inviteId:
 *           type: string
 *           nullable: true
 *           description: ID do convite a ser associado (opcional).
 *         imageUrl:
 *           type: string
 *           nullable: true
 *         group:
 *           type: string
 *           nullable: true
 *     GuestWithDetails:
 *       allOf:
 *         - $ref: "#/components/schemas/Guest"
 *         - type: object
 *           properties:
 *             event:
 *               $ref: "#/components/schemas/Event" # Supondo schema Event definido
 *             messages:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/Message" # Supondo schema Message definido
 *     RsvpInput:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [confirmed, declined]
 *           description: Novo status de confirmação.
 *         plusOne:
 *           type: boolean
 *           description: Informar se levará acompanhante (opcional na resposta).
 *         plusOneName:
 *           type: string
 *           nullable: true
 *           description: Nome do acompanhante (opcional).
 *     Message: # Schema básico para referência
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         type:
 *           type: string
 *           enum: [invite, reminder, bulk, confirmation, status_change]
 *         content:
 *           type: string
 *         status:
 *           type: string
 *           enum: [sent, received, failed]
 *         guestId:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 */

module.exports = { router };

