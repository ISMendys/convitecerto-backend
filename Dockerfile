# --------------------------
# Etapa 1: Build
# --------------------------
    FROM node:20-alpine AS builder

    WORKDIR /app
    
    RUN corepack enable && corepack prepare yarn@4.1.1 --activate
    
    # Copia arquivos de dependência
    COPY package.json yarn.lock ./
    
    # Instala todas dependências (incluindo dev)
    RUN yarn install --immutable
    
    # Copia tudo e gera o Prisma Client
    COPY . .
    
    RUN yarn prisma generate
    
    # --------------------------
    # Etapa 2: Produção
    # --------------------------
    FROM node:20-alpine
    
    WORKDIR /app
    
    RUN corepack enable && corepack prepare yarn@4.1.1 --activate
    
    # Copia arquivos necessários para prod
    COPY package.json yarn.lock ./
    
    # Instala apenas dependências de produção
    RUN yarn install --immutable --production
    
    # Copia arquivos da build anterior, incluindo Prisma Client
    COPY --from=builder /app ./
    
    EXPOSE 5000
    
    CMD [ "yarn", "start" ]
    