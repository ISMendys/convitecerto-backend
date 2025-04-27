# Use uma imagem base do Node.js
FROM node:20-alpine

# Defina o diretório de trabalho
WORKDIR /usr/src/app

# Copie os arquivos de dependência
COPY package*.json yarn.lock* ./ 

# Instale as dependências
RUN yarn install --frozen-lockfile

# Copie o restante dos arquivos da aplicação
COPY . .

# Gere o cliente Prisma
RUN npx prisma generate

# Exponha a porta que a aplicação usa (padrão 5000)
EXPOSE 5000

# Comando para iniciar a aplicação
CMD [ "yarn", "start" ]

