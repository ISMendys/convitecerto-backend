require('dotenv').config();

const express       = require('express');
const cors          = require('cors');
const helmet        = require('helmet');
const morgan        = require('morgan');
const { PrismaClient } = require('@prisma/client');
const winston       = require('winston');
const swaggerUi  = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
const http = require('http');
const socketIo = require('socket.io');

// Importação das rotas (desestruturando para pegar apenas o router)
const { router: authRoutes }     = require('./routes/auth.routes');
const { router: eventRoutes }    = require('./routes/event.routes');
const { router: inviteRoutes }   = require('./routes/invite.routes');
const { router: guestRoutes }    = require('./routes/guest.routes');
const { router: whatsappRoutes } = require('./routes/whatsapp.routes');
const { router: userRoutes } = require('./routes/user.routes');
const { router: notificationRoutes } = require('./routes/notification.routes');

// Importação dos serviços de notificação
const NotificationService = require('./services/NotificationService');
const WebSocketNotificationProvider = require('./providers/WebSocketNotificationProvider');
const EmailNotificationProvider = require('./providers/EmailNotificationProvider');

// Inicialização do app e do Prisma
const app    = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://convitecerto.online',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const prisma = new PrismaClient();
const PORT   = process.env.PORT || 5000;

const corsOptions = {
  origin: process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://convitecerto.online',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

// Configuração do body-parser
app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(morgan('combined'));

// Configuração do logger (winston)
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'convites-digitais-api' },
  transports: [
    new winston.transports.File({ filename: 'error.log',   level: 'error'   }),
    new winston.transports.File({ filename: 'combined.log'            }),
    new winston.transports.Console({ format: winston.format.simple() })
  ],
});

// Configuração do sistema de notificações
const emailConfig = {
  smtp: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD
  },
  fromName: process.env.FROM_NAME || 'Convite Certo',
  fromEmail: process.env.FROM_EMAIL || 'noreply@convitecerto.online',
  frontendUrl: process.env.FRONTEND_URL || 'https://convitecerto.online'
};

// Inicializar serviços de notificação
const notificationService = new NotificationService(prisma, logger);
const websocketProvider = new WebSocketNotificationProvider(io, logger);
const emailProvider = new EmailNotificationProvider(emailConfig, logger);

// Registrar provedores de notificação
notificationService.registerProvider('websocket', websocketProvider);
notificationService.registerProvider('email', emailProvider);

// Disponibiliza Prisma, Logger e NotificationService em req
app.use((req, res, next) => {
  req.prisma = prisma;
  req.logger = logger;
  req.notificationService = notificationService;
  req.io = io;
  next();
});

// Logs de depuração
console.log('→ authRoutes é função?',    typeof authRoutes);
console.log('→ eventRoutes é função?',   typeof eventRoutes);
console.log('→ inviteRoutes é função?',  typeof inviteRoutes);
console.log('→ guestRoutes é função?',   typeof guestRoutes);
console.log('→ whatsappRoutes é função?',typeof whatsappRoutes);
console.log('→ userRoutes é função?',typeof userRoutes);
console.log('→ notificationRoutes é função?',typeof notificationRoutes);

// Montagem das rotas
app.use('/api/auth',     authRoutes);
app.use('/api/events',   eventRoutes);
app.use('/api/invites',  inviteRoutes);
app.use('/api/guest',   guestRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes); // Nova rota de notificações

// Definição básica do OpenAPI
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'API Convite Certo',
    version: '1.0.0',
    description: 'Documentação interativa dos endpoints com sistema de notificações'
  },
  servers: [
    {"url": "https://api.convitecerto.online", "description": "Servidor de Produção"},
    {"url": "https://convitecerto.online", "description": "Frontend de Produção"},
    {"url": "http://localhost:5000", "description": "Servidor de Desenvolvimento Local"}
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  },
  security: [{
    bearerAuth: []
  }]
};

// Aponta para os arquivos de rotas para extrair comentários JSDoc
const options = {
  swaggerDefinition,
  apis: ['./src/routes/*.js']
};

const swaggerSpec = swaggerJSDoc(options);

// Monta a UI em /docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date(),
    notifications: {
      websocketConnections: websocketProvider.getConnectedUsers().length,
      emailProvider: 'configured'
    }
  });
});

app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'API Convite Certo 🚀',
    features: ['notifications', 'websocket', 'email']
  });
});

// WebSocket status endpoint
app.get('/api/websocket/status', (req, res) => {
  const stats = websocketProvider.getStats();
  res.status(200).json(stats);
});

// Error handlers
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({
    error:   'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload muito grande' });
  }
  next(err);
});

// Iniciar servidor
server.listen(PORT, '0.0.0.0', async () => {
  logger.info(`Servidor rodando na porta ${PORT}`);
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`WebSocket habilitado para notificações em tempo real`);
  
  // Testar configuração de email
  const emailTest = await emailProvider.testConnection();
  if (emailTest.success) {
    console.log('✅ Configuração de email válida');
  } else {
    console.log('⚠️ Problema na configuração de email:', emailTest.error);
  }
});

// Encerramento gracioso
process.on('SIGTERM', async () => {
  logger.info('SIGTERM recebido, fechando conexões...');
  await prisma.$disconnect();
  server.close(() => {
    process.exit(0);
  });
});

module.exports = app;
