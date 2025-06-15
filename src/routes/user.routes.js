// Arquivo: routes/user.routes.js

const express = require("express");
const router = express.Router();
const { authenticate } = require("./auth.routes");
const Joi = require("joi");
const axios = require("axios");

/**
 * @swagger
 * tags:
 *   - name: User
 *     description: Endpoints para gerenciamento de usuários e configurações
 */

// Esquema de validação para configurações do usuário
const configSchema = Joi.object({
  theme: Joi.string().valid("light", "dark", "system").default("light"),
  themeStyle: Joi.string().valid("blue", "purple").default("purple"),
  notifications: Joi.boolean().default(true),
  emailNotifications: Joi.boolean().default(true),
  interfaceDensity: Joi.string().valid("compact", "default", "comfortable").default("default"),
  fontSize: Joi.number().integer().min(12).max(20).default(16),
  language: Joi.string().default("pt-BR"),
  dateFormat: Joi.string().default("DD/MM/YYYY"),
  timeFormat: Joi.string().valid("12h", "24h").default("24h")
});

// Esquema de validação para atualização de perfil do usuário
const userProfileSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  email: Joi.string().email().required(),
  avatar: Joi.string().allow(null, "").custom((value, helpers) => {
    if (!value) return value; // Permite null ou string vazia
    
    // Verifica se é uma URL válida
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    
    // Verifica se é uma string Base64 válida para imagem
    if (value.startsWith('data:image/')) {
      const base64Pattern = /^data:image\/(jpeg|jpg|png|gif|webp);base64,([A-Za-z0-9+/=]+)$/;
      if (!base64Pattern.test(value)) {
        return helpers.error('any.invalid');
      }
      
      // Verifica o tamanho do Base64 (máximo 5MB)
      const base64Data = value.split(',')[1];
      const sizeInBytes = (base64Data.length * 3) / 4;
      const maxSizeInBytes = 5 * 1024 * 1024; // 5MB
      
      if (sizeInBytes > maxSizeInBytes) {
        return helpers.error('any.invalid');
      }
      
      return value;
    }
    
    return helpers.error('any.invalid');
  }).messages({
    'any.invalid': 'Avatar deve ser uma URL válida ou uma imagem Base64 válida (máximo 5MB)'
  })
});

// Esquema de validação para mudança de senha
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
  confirmNewPassword: Joi.string().valid(Joi.ref("newPassword")).required().messages({
    "any.only": "As senhas não coincidem"
  })
});

/**
 * @swagger
 * /api/users/config:
 *   get:
 *     summary: Recupera as configurações do usuário autenticado.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configurações do usuário recuperadas com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/UserConfig"
 *       401:
 *         description: Token inválido, expirado ou não fornecido.
 *       404:
 *         description: Configurações do usuário não encontradas.
 *       500:
 *         description: Erro interno do servidor.
 */
router.get("/config", authenticate, async (req, res) => {
  try {
    // Buscar configurações do usuário
    let userConfig = await req.prisma.userConfig.findUnique({
      where: { userId: req.user.id },
    });

    // Se não existir, criar com valores padrão
    if (!userConfig) {
      userConfig = await req.prisma.userConfig.create({
        data: {
          userId: req.user.id,
          theme: "light",
          themeStyle: "purple",
          notifications: true,
          emailNotifications: true,
          interfaceDensity: "default",
          fontSize: 16,
          language: "pt-BR",
          dateFormat: "DD/MM/YYYY",
          timeFormat: "24h"
        }
      });
    }

    res.status(200).json(userConfig);
  } catch (error) {
    req.logger.error("Erro ao buscar configurações do usuário:", error);
    res.status(500).json({ error: "Erro ao buscar configurações do usuário" });
  }
});

/**
 * @swagger
 * /api/users/config:
 *   put:
 *     summary: Atualiza as configurações do usuário autenticado.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/UserConfigInput"
 *     responses:
 *       200:
 *         description: Configurações do usuário atualizadas com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/UserConfig"
 *       400:
 *         description: Erro de validação nos dados fornecidos.
 *       401:
 *         description: Token inválido, expirado ou não fornecido.
 *       500:
 *         description: Erro interno do servidor.
 */
router.put("/config", authenticate, async (req, res) => {
  try {
    // Validar dados de entrada
    const { error, value } = configSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Verificar se as configurações existem
    let userConfig = await req.prisma.userConfig.findUnique({
      where: { userId: req.user.id },
    });

    // Se não existir, criar com os valores fornecidos
    if (!userConfig) {
      userConfig = await req.prisma.userConfig.create({
        data: {
          userId: req.user.id,
          ...value
        }
      });
    } else {
      // Se existir, atualizar
      userConfig = await req.prisma.userConfig.update({
        where: { userId: req.user.id },
        data: value
      });
    }

    res.status(200).json(userConfig);
  } catch (error) {
    req.logger.error("Erro ao atualizar configurações do usuário:", error);
    res.status(500).json({ error: "Erro ao atualizar configurações do usuário" });
  }
});

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Recupera os detalhes do perfil do usuário autenticado.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Detalhes do perfil do usuário recuperados com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/User"
 *       401:
 *         description: Token inválido, expirado ou não fornecido.
 *       404:
 *         description: Usuário não encontrado.
 *       500:
 *         description: Erro interno do servidor.
 */
router.get("/profile", authenticate, async (req, res) => {
  try {
    const user = await req.prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, avatar: true, createdAt: true, updatedAt: true } // Selecionar apenas campos relevantes
    });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    res.status(200).json(user);
  } catch (error) {
    req.logger.error("Erro ao buscar perfil do usuário:", error);
    res.status(500).json({ error: "Erro ao buscar perfil do usuário" });
  }
});

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Atualiza os detalhes do perfil do usuário autenticado.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/UserProfileInput"
 *     responses:
 *       200:
 *         description: Perfil do usuário atualizado com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/User"
 *       400:
 *         description: Erro de validação nos dados fornecidos ou email já em uso.
 *       401:
 *         description: Token inválido, expirado ou não fornecido.
 *       500:
 *         description: Erro interno do servidor.
 */
router.put("/profile", authenticate, async (req, res) => {
  try {
    const { error, value } = userProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, email, avatar } = value;

    // Verificar se o email já está em uso por outro usuário
    const existingUser = await req.prisma.user.findUnique({
      where: { email: email }
    });

    if (existingUser && existingUser.id !== req.user.id) {
      return res.status(400).json({ error: "Este email já está em uso." });
    }

    const updatedUser = await req.prisma.user.update({
      where: { id: req.user.id },
      data: { name, email, avatar },
      select: { id: true, name: true, email: true, avatar: true, createdAt: true, updatedAt: true }
    });

    res.status(200).json(updatedUser);
  } catch (error) {
    req.logger.error("Erro ao atualizar perfil do usuário:", error);
    res.status(500).json({ error: "Erro ao atualizar perfil do usuário" });
  }
});

/**
 * @swagger
 * /api/users/change-password:
 *   put:
 *     summary: Altera a senha do usuário autenticado.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/ChangePasswordInput"
 *     responses:
 *       200:
 *         description: Senha alterada com sucesso.
 *       400:
 *         description: Erro de validação nos dados fornecidos ou senha atual incorreta.
 *       401:
 *         description: Token inválido, expirado ou não fornecido.
 *       500:
 *         description: Erro interno do servidor.
 */
router.put("/change-password", authenticate, async (req, res) => {
  try {
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { currentPassword, newPassword } = value;

    const user = await req.prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    // Comparar a senha atual fornecida com a senha hash no banco de dados
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: "Senha atual incorreta." });
    }

    // Hash da nova senha
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await req.prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedNewPassword }
    });

    res.status(200).json({ message: "Senha alterada com sucesso." });
  } catch (error) {
    req.logger.error("Erro ao alterar senha do usuário:", error);
    res.status(500).json({ error: "Erro ao alterar senha do usuário" });
  }
});

/**
 * @swagger
 * /api/users/help:
 *   get:
 *     summary: Envia uma mensagem de ajuda para o Discord.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Mensagem enviada com sucesso, em breve entraremos em contato.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/User"
 *       401:
 *         description: Token inválido, expirado ou não fornecido.
 *       404:
 *         description: Usuário associado ao token não encontrado no banco de dados.
 *       500:
 *         description: Erro interno do servidor ao enviar mensagem.
 */
router.post("/help", authenticate, async (req, res) => {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  
    if (!webhookUrl) {
      req.logger.error("A variável de ambiente DISCORD_WEBHOOK_URL não está configurada.");
      return res.status(500).json({ error: "Erro de configuração no servidor." });
    }
  
    try {
      const user = await req.prisma.user.findUnique({
        where: { id: req.user.id },
      });
  
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado." });
      }
      const { message } = req.body;
      const helpMessage = message || "Nenhuma mensagem adicional fornecida.";
  
      const discordPayload = {
        embeds: [{
          title: "🆘 Pedido de Ajuda Recebido!",
          description: `O usuário **${user.name}** solicitou ajuda.`,
          color: 15105570,
          fields: [
            { name: "Usuário", value: user.name, inline: true },
            { name: "Email", value: user.email, inline: true },
            { name: "Mensagem", value: helpMessage }
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: `User ID: ${user.id}` 
          }
        }]
      };
  
      await axios.post(webhookUrl, discordPayload);
  
      res.status(200).json({ message: "Sua solicitação de ajuda foi registrada com sucesso." });
  
    } catch (error) {
      req.logger.error("Erro no endpoint /help:", error);
      res.status(500).json({ error: "Não foi possível processar sua solicitação de ajuda." });
    }
  });

  // Definições de Schema para Swagger
/**
 * @swagger
 * components:
 *   schemas:
 *     UserConfig:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: ID único das configurações do usuário.
 *         theme:
 *           type: string
 *           enum: [light, dark, system]
 *           description: Tema da interface.
 *         themeStyle:
 *           type: string
 *           enum: [blue, purple]
 *           description: Estilo do tema da interface.
 *         notifications:
 *           type: boolean
 *           description: Se as notificações no aplicativo estão ativadas.
 *         emailNotifications:
 *           type: boolean
 *           description: Se as notificações por email estão ativadas.
 *         interfaceDensity:
 *           type: string
 *           enum: [compact, default, comfortable]
 *           description: Densidade da interface.
 *         fontSize:
 *           type: integer
 *           description: Tamanho da fonte em pixels.
 *         language:
 *           type: string
 *           description: Idioma da interface.
 *         dateFormat:
 *           type: string
 *           description: Formato de data.
 *         timeFormat:
 *           type: string
 *           enum: [12h, 24h]
 *           description: Formato de hora.
 *         userId:
 *           type: string
 *           description: ID do usuário associado às configurações.
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Data de criação das configurações.
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Data da última atualização das configurações.
 *     UserConfigInput:
 *       type: object
 *       properties:
 *         theme:
 *           type: string
 *           enum: [light, dark, system]
 *           description: Tema da interface.
 *         notifications:
 *           type: boolean
 *           description: Se as notificações no aplicativo estão ativadas.
 *         emailNotifications:
 *           type: boolean
 *           description: Se as notificações por email estão ativadas.
 *         interfaceDensity:
 *           type: string
 *           enum: [compact, default, comfortable]
 *           description: Densidade da interface.
 *         fontSize:
 *           type: integer
 *           description: Tamanho da fonte em pixels.
 *         language:
 *           type: string
 *           description: Idioma da interface.
 *         dateFormat:
 *           type: string
 *           description: Formato de data.
 *         timeFormat:
 *           type: string
 *           enum: [12h, 24h]
 *           description: Formato de hora.
 *     UserProfileInput:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Nome do usuário.
 *         email:
 *           type: string
 *           format: email
 *           description: Endereço de email do usuário.
 *         avatar:
 *           type: string
 *           description: URL ou Base64 da imagem de perfil do usuário.
 *     ChangePasswordInput:
 *       type: object
 *       properties:
 *         currentPassword:
 *           type: string
 *           description: Senha atual do usuário.
 *         newPassword:
 *           type: string
 *           description: Nova senha do usuário.
 *         confirmNewPassword:
 *           type: string
 *           description: Confirmação da nova senha.
 */


module.exports = { router };

