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
 *                 $ref: "#/components/schemas/Guests"
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
 * /api/guest/all:
 *   get:
 *     summary: Lista todos os convidados associados a todos os eventos do usuário autenticado.
 *     tags: [Guest]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, declined, all]
 *         required: false
 *         description: Filtro opcional por status do convidado. Se não fornecido, retorna todos.
 *       - in: query
 *         name: eventId
 *         schema:
 *           type: string
 *         required: false
 *         description: Filtro opcional por ID do evento. Se não fornecido, retorna de todos os eventos.
 *     responses:
 *       200:
 *         description: Lista de convidados recuperada com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   description: Número total de convidados encontrados.
 *                 guests:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       phone:
 *                         type: string
 *                       status:
 *                         type: string
 *                       plusOne:
 *                         type: boolean
 *                       plusOneName:
 *                         type: string
 *                       group:
 *                         type: string
 *                       whatsapp:
 *                         type: boolean
 *                       notes:
 *                         type: string
 *                       eventId:
 *                         type: string
 *                       eventTitle:
 *                         type: string
 *                         description: Título do evento ao qual o convidado pertence.
 *                       eventDate:
 *                         type: string
 *                         format: date-time
 *                         description: Data do evento ao qual o convidado pertence.
 *       500:
 *         description: Erro interno do servidor ao tentar listar os convidados.
 */
router.get("/all", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, eventId } = req.query;
    
    // Construir o filtro para os eventos
    const eventFilter = { userId };
    if (eventId) {
      eventFilter.id = eventId;
    }
    
    // Buscar todos os eventos do usuário
    const events = await req.prisma.event.findMany({
      where: eventFilter,
      select: {
        id: true,
        title: true,
        date: true,
      },
    });
    
    if (events.length === 0) {
      return res.status(200).json({ total: 0, guests: [] });
    }
    
    // Extrair IDs dos eventos
    const eventIds = events.map(event => event.id);
    
    // Construir o filtro para os convidados
    const guestFilter = {
      eventId: {
        in: eventIds,
      },
    };
    
    // Adicionar filtro de status se fornecido
    if (status && status !== 'all') {
      guestFilter.status = status;
    }
    
    // Buscar todos os convidados dos eventos do usuário
    const guests = await req.prisma.guest.findMany({
      where: guestFilter,
      orderBy: [
        { eventId: 'asc' },
        { name: 'asc' },
      ],
    });
    
    // Criar um mapa de eventos para facilitar o acesso
    const eventMap = {};
    events.forEach(event => {
      eventMap[event.id] = {
        title: event.title,
        date: event.date,
      };
    });
    
    // Adicionar informações do evento a cada convidado
    const guestsWithEventInfo = guests.map(guest => ({
      ...guest,
      eventTitle: eventMap[guest.eventId].title,
      eventDate: eventMap[guest.eventId].date,
    }));
    
    res.status(200).json({
      total: guestsWithEventInfo.length,
      guests: guestsWithEventInfo,
    });
  } catch (error) {
    req.logger.error("Erro ao listar convidados do usuário:", error);
    res.status(500).json({ error: "Erro ao listar convidados do usuário" });
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
 *               $ref: "#/components/schemas/GuestsWithDetails"
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
 *             $ref: "#/components/schemas/GuestsInput"
 *     responses:
 *       201:
 *         description: Convidado adicionado com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Guests"
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
 *             $ref: "#/components/schemas/GuestsInput" # Reutiliza o schema de input
 *     responses:
 *       200:
 *         description: Convidado atualizado com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Guests"
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

    // Criar convidados em massa
    const createdGuests = await Promise.all(
      guests.map(async (guestData) => {
        // Validação básica
        if (!guestData.name) {
          return null; // Pular convidados sem nome
        }

        try {
          return await req.prisma.guest.create({
            data: {
              name: guestData.name,
              email: guestData.email || null,
              phone: guestData.phone || null,
              status: "pending",
              whatsapp: guestData.whatsapp || false,
              plusOne: guestData.plusOne || false,
              plusOneName: guestData.plusOneName || null,
              group: guestData.group || null,
              notes: guestData.notes || null,
              eventId,
            },
          });
        } catch (error) {
          req.logger.error(`Erro ao criar convidado ${guestData.name}:`, error);
          return null;
        }
      })
    );

    // Filtrar convidados que não foram criados com sucesso
    const successfullyCreated = createdGuests.filter((guest) => guest !== null);

    res.status(201).json({
      count: successfullyCreated.length,
      message: `${successfullyCreated.length} convidados importados com sucesso`,
    });
  } catch (error) {
    req.logger.error("Erro ao importar convidados:", error);
    res.status(500).json({ error: "Erro ao importar convidados" });
  }
});

/**
 * @swagger
 * /api/guest/{id}/rsvp:
 *   put:
 *     summary: Atualiza o status de confirmação (RSVP) de um convidado.
 *     tags: [Guest]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do convidado para atualizar o RSVP.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [confirmed, declined]
 *                 description: Novo status de confirmação.
 *               plusOne:
 *                 type: boolean
 *                 description: Se o convidado trará acompanhante.
 *               plusOneName:
 *                 type: string
 *                 description: Nome do acompanhante, se houver.
 *     responses:
 *       200:
 *         description: RSVP atualizado com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Guests"
 *       400:
 *         description: Erro de validação nos dados fornecidos.
 *       404:
 *         description: Convidado não encontrado.
 *       500:
 *         description: Erro interno do servidor ao atualizar o RSVP.
 */
router.put("/:id/rsvp", async (req, res) => {
  try {
    const { id } = req.params;

    // Validar dados de entrada
    const { error, value } = rsvpSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { status, plusOne, plusOneName } = value;

    // Verificar se o convidado existe
    const existingGuest = await req.prisma.guest.findUnique({
      where: { id },
    });

    if (!existingGuest) {
      return res.status(404).json({ error: "Convidado não encontrado" });
    }

    // Verificar se o status está sendo alterado
    const statusChanged = existingGuest.status !== status;

    // Preparar dados para atualização
    const updateData = {
      status,
    };

    // Adicionar plusOne e plusOneName apenas se fornecidos
    if (plusOne !== undefined) {
      updateData.plusOne = plusOne;
    }

    if (plusOneName !== undefined) {
      updateData.plusOneName = plusOneName;
    }

    // Atualizar convidado
    const updatedGuest = await req.prisma.guest.update({
      where: { id },
      data: updateData,
    });

    // Registrar mensagem de alteração de status
    if (statusChanged) {
      await req.prisma.message.create({
        data: {
          type: "status_change",
          content: `Status atualizado para: ${status} (pelo convidado)`,
          status: "sent",
          guestId: id,
        },
      });
    }

    res.status(200).json(updatedGuest);
  } catch (error) {
    req.logger.error("Erro ao atualizar RSVP:", error);
    res.status(500).json({ error: "Erro ao atualizar RSVP" });
  }
});


/**
 * @swagger
 * /api/guest/{id}/public:
 *   get:
 *     summary: Obtém os detalhes publico de um convidado específico pelo seu ID.
 *     tags: [Guest]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do convidado para buscar convidado.
 *     responses:
 *       200:
 *         description: Detalhes do convidado recuperados com sucesso.
 *       404:
 *         description: Convidado não encontrado.
 *       500:
 *         description: Erro interno do servidor ao tentar obter o convidado.
 */
router.get("/:id/public", async (req, res) => {
  try {
    const { id } = req.params;

    const guest = await req.prisma.guest.findUnique({
      where: {
        id,
      },
      select: { // Usando 'select' para retornar apenas os dados públicos
        id: true,
        name: true,
        status: true,
        inviteId: true,
        plusOne: true,
        event: {
          select: {
            id: true,
            title: true,
            date: true,
            location: true,
            image: true,
          }
        }
      }
    });

    if (!guest) {
      return res.status(404).json({ error: "Convidado não encontrado" });
    }

    res.status(200).json(guest);
  } catch (error) {
    req.logger.error("Erro ao obter convidado:", error);
    res.status(500).json({ error: "Erro ao obter convidado" });
  }
});

module.exports = { router };

