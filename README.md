# convitecerto-backend
convitecerto-backend
ConviteCerto - Backend

Este é o backend da aplicação ConviteCerto, responsável pela lógica da API, autenticação, gestão de eventos, convidados, convites e integração com WhatsApp.

📁 Estrutura de Pastas
```
backend/
├── combined.log
├── db.js                               
├── error.log                        
├── estrutura_back.txt                            
├── package.json                                            
├── package-lock.json                                            
├── prisma                                                  
│   └── schema.prisma                                                        
├── src                                                            
│   ├── index.js                                                                
│   └── routes                                                      
│       ├── auth.routes.js                                                          
│       ├── event.routes.js                                                        
│       ├── guest.routes.js                                                        
│       ├── invite.routes.js                                                    
│       └── whatsapp.routes.js                                                    
└── yarn.lock                                                  
```
3 directories, 14 files


🚀 Como rodar localmente

# Instalar dependências
```yarn```

# Criar .env baseado no exemplo (caso exista)
```cp .env.example .env```

# Rodar as migrations (Prisma)
```npx prisma migrate dev```

# Subir o servidor
```yarn start```

📦 Scripts Disponíveis
```
yarn start → Inicia a API na porta 5000

yarn dev → Inicia com nodemon (se configurado)

npx prisma studio → Interface visual do banco

npx prisma migrate dev → Aplica as migrations
```

🌐 Endpoints Principais

POST   /api/auth       → Login e registro

GET    /api/events     → Listagem de eventos

POST   /api/guests     → Cadastro de convidados

POST   /api/invites    → Geração de convite

POST   /api/whatsapp   → Envio via WhatsApp

GET    /health         → Verificação de saúde da API

Documentação Completa - Projeto ConviteCerto

*📊 Visão Geral*
<!-- 
Este projeto é dividido em duas partes principais:

Frontend: Aplicativo ReactJS hospedado no S3 + CloudFront.

Backend: API Node.js (Express + Prisma) hospedada em instância EC2 na AWS.

Também configuramos integrações de CI/CD completas usando GitHub Actions. -->

🚀 Como está funcionando

*Backend (EC2)*
<!-- 
Hospedado em uma máquina Ubuntu 24.04

Rodando com PM2 (gerenciador de processos)

Usando Node.js 18 + Yarn

Banco de dados PostgreSQL hospedado na AWS RDS

Protegido com HTTPS (Let's Encrypt via Certbot)

Proxy reverso configurado com Nginx -->

*Frontend (S3 + CloudFront)*
<!-- 
Bucket S3 configurado para hosting estático (público via CloudFront)

Sem uso de ACLs (Object Ownership setado como Bucket Owner Enforced)

Cache invalidado automaticamente após cada deploy -->

*CI/CD (GitHub Actions)*

<!-- Dois workflows separados:

frontend.yml: builda e publica o frontend

backend.yml: faz deploy via SSH + PM2 restart na EC2

Variáveis sensíveis configuradas em GitHub Secrets -->

🌐 Endereços

Frontend: https://convitecerto.online

Backend: https://api.convitecerto.online

🔧 Fluxo de Desenvolvimento

1. Desenvolvimento Local

    - Frontend: yarn start

    - Backend: yarn start

2. Criar Feature

    - Cria branch

    - Faz commits

    - Abre Pull Request (PR)

3. Merge na main

    - Frontend:

        - CI roda yarn build

        - Faz deploy no S3

        - Invalida cache do CloudFront

    - Backend:

        - CI roda yarn install + prisma generate

        - Reinicia app com PM2 na EC2

🔑 Secrets Configurados no GitHub

Nome                            Descrição

AWS_ACCESS_KEY_ID               Chave de acesso AWS

AWS_SECRET_ACCESS_KEY           Chave secreta AWS

AWS_S3_BUCKET                   Nome do bucket S3

CLOUDFRONT_DISTRIBUTION_ID      ID da distribuição CloudFront

EC2_SSH_KEY                     SSH Private Key da VM EC2

EC2_HOST                        IP público da instância EC2

🔵 Comandos Importantes

Frontend
```
    yarn install
    yarn build
    yarn start
```
Backend
```
    yarn install
    yarn dev
    npx prisma migrate dev
    pm2 start src/index.js --name convite-backend
```
Gerenciar PM2
```
    pm2 list
    pm2 restart convite-backend
    pm2 logs convite-backend
```
Certbot SSL (Renovar)
```
    sudo certbot renew
```
🔐 Segurança e Acesso
```
    Bucket S3: Bloqueio de ACLs ativado

    SSL/TLS válido com Let's Encrypt

    Porta 22 liberada apenas para IPs confiáveis

    Firewall configurado para portas 80/443 abertas para o público
```
🚩 Possíveis Melhorias Futuras
```
    Configurar deploy blue/green para backend (zero downtime)

    Adicionar rollback automático em caso de falha no deploy

    Melhorar linter para não quebrar build apenas com warnings (opcional)

    Monitorar máquina EC2 com CloudWatch

    CI com validação de testes unitários
```