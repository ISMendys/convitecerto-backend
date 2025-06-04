FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock ./

RUN npm install

COPY . .

CMD ["node", "src/index.js"]
