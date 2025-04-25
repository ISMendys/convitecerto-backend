# convitecerto-backend
convitecerto-backend
ConviteCerto - Backend

Este é o backend da aplicação ConviteCerto, responsável pela lógica da API, autenticação, gestão de eventos, convidados, convites e integração com WhatsApp.

📁 Estrutura de Pastas

backend/
├── node_modules/            # Dependências Node.js
├── prisma/                  # Esquema do banco de dados Prisma
│   └── schema.prisma
├── src/
│   └── routes/              # Rotas da aplicação
│       ├── auth.routes.js
│       ├── event.routes.js
│       ├── guest.routes.js
│       ├── invite.routes.js
│       └── whatsapp.routes.js
├── index.js                 # Arquivo principal da aplicação
├── db.js                    # Conexão com o banco via Prisma
├── .env                     # Variáveis de ambiente
├── combined.log             # Logs combinados (info)
├── error.log                # Logs de erro
├── package.json             # Configuração do projeto Node
├── package-lock.json        # Lockfile de dependências (npm)
└── yarn.lock                # Lockfile do Yarn

🚀 Como rodar localmente

# Instalar dependências
yarn

# Criar .env baseado no exemplo (caso exista)
cp .env.example .env

# Rodar as migrations (Prisma)
npx prisma migrate dev

# Subir o servidor
yarn start

📦 Scripts Disponíveis

yarn start → Inicia a API na porta 5000

yarn dev → Inicia com nodemon (se configurado)

npx prisma studio → Interface visual do banco

npx prisma migrate dev → Aplica as migrations

🌐 Endpoints Principais

POST   /api/auth       → Login e registro

GET    /api/events     → Listagem de eventos

POST   /api/guests     → Cadastro de convidados

POST   /api/invites    → Geração de convite

POST   /api/whatsapp   → Envio via WhatsApp

GET    /health         → Verificação de saúde da API

Caso deseje, posso criar também o .env.example ou te entregar o arquivo pronto para subir no GitHub.
