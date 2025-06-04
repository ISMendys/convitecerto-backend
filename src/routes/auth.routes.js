const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const Joi = require("joi");

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Endpoints para autenticação e gerenciamento de usuários
 */

// Esquema de validação para registro
const registerSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

// Esquema de validação para login
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

/**
 * Middleware de autenticação JWT.
 * Verifica a presença e validade de um token Bearer no header Authorization.
 * Se válido, adiciona os dados decodificados do usuário (payload do token) ao objeto `req.user`.
 * @param {object} req - Objeto de requisição do Express.
 * @param {object} res - Objeto de resposta do Express.
 * @param {function} next - Função para chamar o próximo middleware.
 * @returns {void} Chama `next()` se autenticado, ou envia resposta de erro 401.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token de autenticação não fornecido ou mal formatado" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Adiciona o payload decodificado (que deve conter id, email, etc.) a req.user
    req.user = decoded; 
    next();
  } catch (error) {
    // Log do erro pode ser útil para depuração
    req.logger?.error("Erro na verificação do token JWT:", error.message);
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
};

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registra um novo usuário no sistema.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/RegisterInput"
 *     responses:
 *       201:
 *         description: Usuário registrado com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/AuthResponse"
 *       400:
 *         description: Erro de validação nos dados fornecidos ou email já cadastrado.
 *       500:
 *         description: Erro interno do servidor ao tentar registrar o usuário.
 */
router.post("/register", async (req, res) => {
  try {
    // Validar dados de entrada
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, email, password } = value;

    // Verificar se o usuário já existe
    const existingUser = await req.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: "Email já cadastrado" });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Criar usuário
    const user = await req.prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    // Gerar token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email }, // Payload do token
      process.env.JWT_SECRET,
      { expiresIn: "7d" } // Duração do token
    );

    // Retornar usuário e token (sem a senha)
    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    req.logger.error("Erro ao registrar usuário:", error);
    res.status(500).json({ error: "Erro ao registrar usuário" });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Autentica um usuário e retorna um token JWT.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/LoginInput"
 *     responses:
 *       200:
 *         description: Login bem-sucedido.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/AuthResponse"
 *       400:
 *         description: Erro de validação nos dados fornecidos.
 *       401:
 *         description: Credenciais inválidas (email ou senha incorretos).
 *       500:
 *         description: Erro interno do servidor ao tentar fazer login.
 */
router.post("/login", async (req, res) => {
  try {
    // Validar dados de entrada
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password } = value;

    // Buscar usuário
    const user = await req.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Resposta genérica para não informar se o email existe ou não
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    // Verificar senha
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    // Gerar token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email }, // Payload
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Retornar usuário e token (sem a senha)
    const { password: _, ...userWithoutPassword } = user;

    res.status(200).json({
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    req.logger.error("Erro ao fazer login:", error);
    res.status(500).json({ error: "Erro ao fazer login" });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Retorna os dados do usuário autenticado.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do usuário recuperados com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/User"
 *       401:
 *         description: Token inválido, expirado ou não fornecido.
 *       404:
 *         description: Usuário associado ao token não encontrado no banco de dados.
 *       500:
 *         description: Erro interno do servidor ao tentar obter o usuário.
 */
router.get("/me", authenticate, async (req, res) => {
  try {
    // req.user contém o payload do token (id, email, etc.)
    const user = await req.prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      // Isso pode indicar um problema de sincronia ou token de um usuário excluído
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    // Retornar usuário (sem a senha)
    const { password, ...userWithoutPassword } = user;

    res.status(200).json(userWithoutPassword);
  } catch (error) {
    req.logger.error("Erro ao obter usuário:", error);
    res.status(500).json({ error: "Erro ao obter usuário" });
  }
});

// Definições de Schema para Swagger (devem estar no arquivo principal ou importadas)
/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: ID único do usuário.
 *         name:
 *           type: string
 *           description: Nome do usuário.
 *         email:
 *           type: string
 *           format: email
 *           description: Email do usuário (usado para login).
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Data de criação do registro do usuário.
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Data da última atualização do registro do usuário.
 *     RegisterInput:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - password
 *       properties:
 *         name:
 *           type: string
 *           description: Nome do usuário.
 *         email:
 *           type: string
 *           format: email
 *           description: Email para registro e login.
 *         password:
 *           type: string
 *           format: password
 *           minLength: 6
 *           description: Senha do usuário (mínimo 6 caracteres).
 *     LoginInput:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: Email do usuário cadastrado.
 *         password:
 *           type: string
 *           format: password
 *           description: Senha do usuário.
 *     AuthResponse:
 *       type: object
 *       properties:
 *         user:
 *           $ref: "#/components/schemas/User"
 *         token:
 *           type: string
 *           description: Token JWT para autenticação em requisições subsequentes.
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: Autenticação baseada em token JWT. Forneça o token no formato 'Bearer {token}'.
 */

// Exportar router e middleware authenticate
module.exports = {
  router,
  authenticate,
};

