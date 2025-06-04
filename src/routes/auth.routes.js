const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Joi = require('joi');

// Esquema de validação para registro
const registerSchema = Joi.object({
  name: Joi.string().required(), //
  email: Joi.string().email().required(), //
  password: Joi.string().min(6).required() //
});

// Esquema de validação para login
const loginSchema = Joi.object({
  email: Joi.string().email().required(), //
  password: Joi.string().required() //
});

// Middleware de autenticação
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization; //
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido' }); //
  }
  
  const token = authHeader.split(' ')[1]; //
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); //
    req.user = decoded; //
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado' }); //
  }
};

/**
 * @swagger
 * tags:
 * - name: Auth
 * description: Endpoints para autenticação de usuários
 */

/**
 * @swagger
 * /api/auth/register:
 * post:
 * summary: Registra um novo usuário
 * tags: [Auth]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - name
 * - email
 * - password
 * properties:
 * name:
 * type: string
 * example: João Silva
 * email:
 * type: string
 * format: email
 * example: joao.silva@example.com
 * password:
 * type: string
 * minLength: 6
 * example: "senha123"
 * responses:
 * '201':
 * description: Usuário registrado com sucesso
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * user:
 * type: object
 * properties:
 * id:
 * type: string
 * example: "clx..."
 * name:
 * type: string
 * example: João Silva
 * email:
 * type: string
 * format: email
 * example: joao.silva@example.com
 * token:
 * type: string
 * example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * '400':
 * description: Dados de entrada inválidos ou email já cadastrado
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * error:
 * type: string
 * example: "Email já cadastrado"
 * '500':
 * description: Erro interno do servidor
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * error:
 * type: string
 * example: "Erro ao registrar usuário"
 */
router.post('/register', async (req, res) => { //
  try {
    // Validar dados de entrada
    const { error, value } = registerSchema.validate(req.body); //
    if (error) {
      return res.status(400).json({ error: error.details[0].message }); //
    }
    
    const { name, email, password } = value; //
    
    // Verificar se o usuário já existe
    const existingUser = await req.prisma.user.findUnique({
      where: { email } //
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'Email já cadastrado' }); //
    }
    
    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10); //
    
    // Criar usuário
    const user = await req.prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword
      } //
    });
    
    // Gerar token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' } //
    );
    
    // Retornar usuário e token (sem a senha)
    const { password: _, ...userWithoutPassword } = user; //
    
    res.status(201).json({
      user: userWithoutPassword,
      token
    }); //
  } catch (error) {
    req.logger.error('Erro ao registrar usuário:', error); //
    res.status(500).json({ error: 'Erro ao registrar usuário', error }); //
  }
});

/**
 * @swagger
 * /api/auth/login:
 * post:
 * summary: Autentica um usuário existente
 * tags: [Auth]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - email
 * - password
 * properties:
 * email:
 * type: string
 * format: email
 * example: joao.silva@example.com
 * password:
 * type: string
 * example: "senha123"
 * responses:
 * '200':
 * description: Login bem-sucedido
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * user:
 * type: object
 * properties:
 * id:
 * type: string
 * example: "clx..."
 * name:
 * type: string
 * example: João Silva
 * email:
 * type: string
 * format: email
 * example: joao.silva@example.com
 * token:
 * type: string
 * example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * '400':
 * description: Dados de entrada inválidos
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * error:
 * type: string
 * '401':
 * description: Credenciais inválidas
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * error:
 * type: string
 * example: "Credenciais inválidas"
 * '500':
 * description: Erro interno do servidor
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * error:
 * type: string
 * example: "Erro ao fazer login"
 */
router.post('/login', async (req, res) => { //
  try {
    // Validar dados de entrada
    const { error, value } = loginSchema.validate(req.body); //
    if (error) {
      return res.status(400).json({ error: error.details[0].message }); //
    }
    
    const { email, password } = value; //
    
    // Buscar usuário
    const user = await req.prisma.user.findUnique({
      where: { email } //
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' }); //
    }
    
    // Verificar senha
    const passwordMatch = await bcrypt.compare(password, user.password); //
    
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciais inválidas' }); //
    }
    
    // Gerar token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' } //
    );
    
    // Retornar usuário e token (sem a senha)
    const { password: _, ...userWithoutPassword } = user; //
    
    res.status(200).json({
      user: userWithoutPassword,
      token
    }); //
  } catch (error) {
    req.logger.error('Erro ao fazer login:', error); //
    res.status(500).json({ error: 'Erro ao fazer login' }); //
  }
});

/**
 * @swagger
 * /api/auth/me:
 * get:
 * summary: Obtém os dados do usuário autenticado
 * tags: [Auth]
 * security:
 * - bearerAuth: []
 * responses:
 * '200':
 * description: Dados do usuário
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * id:
 * type: string
 * example: "clx..."
 * name:
 * type: string
 * example: João Silva
 * email:
 * type: string
 * format: email
 * example: joao.silva@example.com
 * '401':
 * description: Token de autenticação não fornecido ou inválido
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * error:
 * type: string
 * example: "Token inválido ou expirado"
 * '404':
 * description: Usuário não encontrado
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * error:
 * type: string
 * example: "Usuário não encontrado"
 * '500':
 * description: Erro interno do servidor
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * error:
 * type: string
 * example: "Erro ao obter usuário"
 */
router.get('/me', authenticate, async (req, res) => { //
  try {
    const user = await req.prisma.user.findUnique({
      where: { id: req.user.id } //
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' }); //
    }
    
    // Retornar usuário (sem a senha)
    const { password, ...userWithoutPassword } = user; //
    
    res.status(200).json(userWithoutPassword); //
  } catch (error) {
    req.logger.error('Erro ao obter usuário:', error); //
    res.status(500).json({ error: 'Erro ao obter usuário' }); //
  }
});

// Exportar diretamente o router
module.exports = {
  router,
  authenticate //
};