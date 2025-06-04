# Etapa de build
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare yarn@4.1.1 --activate

COPY package.json yarn.lock ./
RUN yarn install --immutable

COPY . .

# Etapa final de produção
FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare yarn@4.1.1 --activate

COPY --from=builder /app /app

RUN yarn install

CMD ["node", "src/index.js"]
