# Use uma imagem base do Node.js
FROM node:20-alpine

# Defina o diretório de trabalho
WORKDIR /usr/src/app

# 1) Ativa o Corepack e instala o Yarn 4.1.1
RUN corepack enable \
 && corepack prepare yarn@4.1.1 --activate
 
# Copie os arquivos de dependência
COPY package*.json yarn.lock* ./ 

# Instale as dependências
RUN yarn install --immutable

# Copie o restante dos arquivos da aplicação
COPY . .

# Gere o cliente Prisma
RUN ./node_modules/.bin/prisma generate

# Exponha a porta que a aplicação usa (padrão 5000)
EXPOSE 5000

# Comando para iniciar a aplicação
CMD [ "yarn", "start" ]

