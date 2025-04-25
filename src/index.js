require('dotenv').config();

const express       = require('express');
const cors          = require('cors');
const helmet        = require('helmet');
const morgan        = require('morgan');
const { PrismaClient } = require('@prisma/client');
const winston       = require('winston');


// 3. Importação das rotas (desestruturando para pegar apenas o router)
const { router: authRoutes }     = require('./routes/auth.routes');
const { router: eventRoutes }    = require('./routes/event.routes');
const { router: inviteRoutes }   = require('./routes/invite.routes');
const { router: guestRoutes }    = require('./routes/guest.routes');
const { router: whatsappRoutes } = require('./routes/whatsapp.routes');

// 4. Inicialização do app e do Prisma
const app    = express();
const prisma = new PrismaClient();
const PORT   = process.env.PORT || 5000;


// ⬇️ antes de tudo: configure o body‑parser
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 5. Configuração do logger (winston)
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

// 6. Middlewares globais
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(morgan('combined'));

// 7. Disponibiliza Prisma e Logger em req
app.use((req, res, next) => {
  req.prisma = prisma;
  req.logger = logger;
  next();
});


// 8. Montagem das rotas e logs de depuração
console.log('→ authRoutes é função?',    typeof authRoutes);
console.log('→ eventRoutes é função?',   typeof eventRoutes);
console.log('→ inviteRoutes é função?',  typeof inviteRoutes);
console.log('→ guestRoutes é função?',   typeof guestRoutes);
console.log('→ whatsappRoutes é função?',typeof whatsappRoutes);

app.use('/api/auth',     authRoutes);
app.use('/api/events',   eventRoutes);
app.use('/api/invites',  inviteRoutes);
app.use('/api/guests',   guestRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// 9. Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

app.get('/', (req, res) => {
  res.status(200).json({ message: 'API Convite Certo 🚀' });
});


// 10. Error handler
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

// 11. Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Servidor rodando na porta ${PORT}`);
  console.log(`Servidor rodando na porta ${PORT}`);
});

// 12. Encerramento gracioso
process.on('SIGTERM', async () => {
  logger.info('SIGTERM recebido, fechando conexões...');
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = app;
