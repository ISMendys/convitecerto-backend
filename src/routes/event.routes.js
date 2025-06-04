const express = require("express");
const { authenticate } = require("./auth.routes");
const Joi = require("joi");
const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Event
 *     description: Endpoints para gerenciamento de eventos
 */

// Esquema de validação para criação/atualização de evento
const eventSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().allow("", null),
  date: Joi.date().required(),
  location: Joi.string().allow("", null),
  maxGuests: Joi.string().allow("", null), // Considerar Joi.number().integer().positive().allow(null)
  image: Joi.string().uri().allow("", null),
  notes: Joi.string().allow("", null),
  type: Joi.string().valid("birthday", "wedding", "corporate", "party", "other").default("other"),
});

/**
 * @swagger
 * /api/event:
 *   get:
 *     summary: Lista todos os eventos criados pelo usuário autenticado.
 *     tags: [Event]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de eventos recuperada com sucesso, incluindo contagem de convidados.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/EventWithStats"
 *       500:
 *         description: Erro interno do servidor ao tentar listar os eventos.
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const events = await req.prisma.event.findMany({
      where: {
        userId: req.user.id,
      },
      include: {
        _count: {
          select: {
            guests: true,
          },
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    // Adicionar contagem de convidados confirmados e pendentes
    const eventsWithStats = await Promise.all(
      events.map(async (event) => {
        const confirmedCount = await req.prisma.guest.count({
          where: {
            eventId: event.id,
            status: "confirmed",
          },
        });

        const pendingCount = await req.prisma.guest.count({
          where: {
            eventId: event.id,
            status: "pending",
          },
        });

        return {
          ...event,
          guestsCount: event._count.guests,
          confirmedCount,
          pendingCount,
        };
      })
    );

    res.status(200).json(eventsWithStats);
  } catch (error) {
    req.logger.error("Erro ao listar eventos:", error);
    res.status(500).json({ error: "Erro ao listar eventos" });
  }
});

/**
 * @swagger
 * /api/event/{id}:
 *   get:
 *     summary: Obtém os detalhes de um evento específico pelo seu ID.
 *     tags: [Event]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID único do evento a ser recuperado.
 *     responses:
 *       200:
 *         description: Detalhes do evento recuperados com sucesso, incluindo convites e contagem de convidados.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/EventWithDetails"
 *       403:
 *         description: Acesso negado. O usuário não tem permissão para acessar este evento.
 *       404:
 *         description: Evento não encontrado.
 *       500:
 *         description: Erro interno do servidor ao tentar obter o evento.
 */
router.get("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const event = await req.prisma.event.findUnique({
      where: {
        id,
      },
      include: {
        invites: true, // Inclui os convites associados
        _count: {
          select: {
            guests: true,
          },
        },
      },
    });

    if (!event) {
      return res.status(404).json({ error: "Evento não encontrado" });
    }

    // Verificar se o evento pertence ao usuário
    if (event.userId !== req.user.id) {
      return res.status(403).json({ error: "Acesso negado" });
    }

    // Adicionar contagem de convidados confirmados e pendentes
    const confirmedCount = await req.prisma.guest.count({
      where: {
        eventId: event.id,
        status: "confirmed",
      },
    });

    const pendingCount = await req.prisma.guest.count({
      where: {
        eventId: event.id,
        status: "pending",
      },
    });

    const eventWithStats = {
      ...event,
      guestsCount: event._count.guests,
      confirmedCount,
      pendingCount,
    };

    res.status(200).json(eventWithStats);
  } catch (error) {
    req.logger.error("Erro ao obter evento:", error);
    res.status(500).json({ error: "Erro ao obter evento" });
  }
});

/**
 * @swagger
 * /api/event:
 *   post:
 *     summary: Cria um novo evento.
 *     tags: [Event]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/EventInput"
 *     responses:
 *       201:
 *         description: Evento criado com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Event"
 *       400:
 *         description: Erro de validação nos dados fornecidos.
 *       500:
 *         description: Erro interno do servidor ao tentar criar o evento.
 */
router.post("/", authenticate, async (req, res) => {
  const { error, value } = eventSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const event = await req.prisma.event.create({
      data: {
        title: value.title,
        description: value.description,
        date: new Date(value.date),
        location: value.location,
        maxGuests: value.maxGuests,
        notes: value.notes,
        type: value.type,
        image: value.image || null,
        userId: req.user.id, // Associa o evento ao usuário autenticado
      },
    });
    res.status(201).json(event);
  } catch (err) {
    req.logger.error("Erro ao criar evento:", err);
    res.status(500).json({ error: "Erro ao criar evento" });
  }
});

/**
 * @swagger
 * /api/event/{id}:
 *   put:
 *     summary: Atualiza um evento existente.
 *     tags: [Event]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do evento a ser atualizado.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/EventInput" # Reutiliza o schema de input
 *     responses:
 *       200:
 *         description: Evento atualizado com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Event"
 *       400:
 *         description: Erro de validação nos dados fornecidos.
 *       403:
 *         description: Acesso negado. O usuário não tem permissão para atualizar este evento.
 *       404:
 *         description: Evento não encontrado.
 *       500:
 *         description: Erro interno do servidor ao tentar atualizar o evento.
 */
router.put("/:id", authenticate, async (req, res) => {
  const { error, value } = eventSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const existing = await req.prisma.event.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Evento não encontrado" });
    if (existing.userId !== req.user.id) return res.status(403).json({ error: "Acesso negado" });

    const updated = await req.prisma.event.update({
      where: { id: req.params.id },
      data: {
        title: value.title,
        description: value.description,
        date: new Date(value.date),
        location: value.location,
        maxGuests: value.maxGuests,
        notes: value.notes,
        type: value.type,
        image: value.image || null,
        // userId não é atualizado
      },
    });
    res.json(updated);
  } catch (err) {
    req.logger.error("Erro ao atualizar evento:", err);
    res.status(500).json({ error: "Erro ao atualizar evento" });
  }
});

/**
 * @swagger
 * /api/event/{id}:
 *   delete:
 *     summary: Exclui um evento específico.
 *     tags: [Event]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do evento a ser excluído.
 *     responses:
 *       204:
 *         description: Evento excluído com sucesso. Sem conteúdo de resposta.
 *       403:
 *         description: Acesso negado. O usuário não tem permissão para excluir este evento.
 *       404:
 *         description: Evento não encontrado.
 *       500:
 *         description: Erro interno do servidor ao tentar excluir o evento.
 */
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se o evento existe e pertence ao usuário
    const existingEvent = await req.prisma.event.findUnique({
      where: { id },
    });

    if (!existingEvent) {
      return res.status(404).json({ error: "Evento não encontrado" });
    }

    if (existingEvent.userId !== req.user.id) {
      return res.status(403).json({ error: "Acesso negado" });
    }

    // Excluir evento (e seus dependentes: invites, guests, messages via cascade delete do Prisma)
    await req.prisma.event.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    req.logger.error("Erro ao excluir evento:", error);
    // Verificar erro de chave estrangeira pode ser útil, mas o cascade deve tratar
    res.status(500).json({ error: "Erro ao excluir evento" });
  }
});

// Definições de Schema para Swagger (devem estar no arquivo principal ou importadas)
/**
 * @swagger
 * components:
 *   schemas:
 *     Event:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: ID único do evento.
 *         title:
 *           type: string
 *           description: Título do evento.
 *         description:
 *           type: string
 *           nullable: true
 *           description: Descrição detalhada do evento.
 *         date:
 *           type: string
 *           format: date-time
 *           description: Data e hora do evento.
 *         location:
 *           type: string
 *           nullable: true
 *           description: Localização do evento.
 *         maxGuests:
 *           type: string # Ou integer se validado como número
 *           nullable: true
 *           description: Número máximo de convidados permitido (informativo).
 *         image:
 *           type: string
 *           format: uri
 *           nullable: true
 *           description: URL de uma imagem associada ao evento.
 *         notes:
 *           type: string
 *           nullable: true
 *           description: Anotações internas sobre o evento.
 *         type:
 *           type: string
 *           enum: [birthday, wedding, corporate, party, other]
 *           description: Tipo do evento.
 *         userId:
 *           type: string
 *           description: ID do usuário que criou o evento.
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Data de criação do registro do evento.
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Data da última atualização do registro do evento.
 *     EventInput:
 *       type: object
 *       required:
 *         - title
 *         - date
 *       properties:
 *         title:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         date:
 *           type: string
 *           format: date-time
 *           description: Data e hora do evento (ISO 8601).
 *         location:
 *           type: string
 *           nullable: true
 *         maxGuests:
 *           type: string # Ou integer
 *           nullable: true
 *         image:
 *           type: string
 *           format: uri
 *           nullable: true
 *         notes:
 *           type: string
 *           nullable: true
 *         type:
 *           type: string
 *           enum: [birthday, wedding, corporate, party, other]
 *           default: other
 *     EventWithStats:
 *       allOf:
 *         - $ref: "#/components/schemas/Event"
 *         - type: object
 *           properties:
 *             guestsCount:
 *               type: integer
 *               description: Número total de convidados associados ao evento.
 *             confirmedCount:
 *               type: integer
 *               description: Número de convidados com status 'confirmed'.
 *             pendingCount:
 *               type: integer
 *               description: Número de convidados com status 'pending'.
 *             _count: # Campo original do Prisma, pode ser omitido se redundante
 *               type: object
 *               properties:
 *                 guests:
 *                   type: integer
 *     EventWithDetails:
 *       allOf:
 *         - $ref: "#/components/schemas/EventWithStats"
 *         - type: object
 *           properties:
 *             invites:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/Invite" # Supondo schema Invite definido
 */

// Exportar a rota
module.exports = { router };
