# Etapa de build
FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare yarn@4.1.1 --activate

RUN yarn install

CMD ["node", "src/index.js"]
