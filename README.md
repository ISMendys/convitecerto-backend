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

Caso deseje, posso criar também o .env.example ou te entregar o arquivo pronto para subir no GitHub.
