# Etapa 1: Builder - Instalar dependências e preparar a aplicação
FROM node:20-alpine AS builder

WORKDIR /app

# Ativa o Corepack para usar a versão correta do Yarn
RUN corepack enable && corepack prepare yarn@4.1.1 --activate

# Copia apenas os ficheiros de manifesto de dependências primeiro para aproveitar o cache do Docker
COPY package.json yarn.lock ./

# Instala TODAS as dependências (incluindo devDependencies se forem necessárias para algum passo de build)
RUN yarn install --immutable

# DEBUG: Verifica se o dotenv foi instalado corretamente pelo yarn install
RUN echo "--- [BUILDER] Verificando dotenv em node_modules APÓS yarn install ---" && \
    if [ -d "node_modules/dotenv" ]; then echo "dotenv ENCONTRADO em node_modules"; else echo "dotenv NÃO ENCONTRADO em node_modules"; fi && \
    echo "--- Fim da verificação ---"

# Copia o restante do código da aplicação
# ASSUMINDO que 'node_modules' está no teu .dockerignore para que esta cópia não a substitua
COPY . .

# DEBUG: Verifica se o dotenv ainda está lá após o COPY . .
RUN echo "--- [BUILDER] Verificando dotenv em node_modules APÓS COPY . . ---" && \
    if [ -d "node_modules/dotenv" ]; then echo "dotenv ENCONTRADO em node_modules"; else echo "dotenv NÃO ENCONTRADO em node_modules"; fi && \
    echo "--- Fim da verificação ---"

# Se precisares de algum passo de build aqui (ex: transpilar TypeScript, gerar Prisma Client), faz aqui.
# Exemplo: RUN yarn build
# Exemplo: RUN yarn exec prisma generate # Garante que o prisma CLI está em devDependencies e foi instalado

# Etapa 2: Final - Imagem de produção enxuta
FROM node:20-alpine

WORKDIR /app

# Copia a pasta node_modules da etapa builder
COPY --from=builder /app/node_modules ./node_modules

# Copia o package.json (pode ser necessário para o comando start ou para o Node resolver o main)
COPY --from=builder /app/package.json ./package.json

# Copia o código fonte da aplicação da etapa builder
COPY --from=builder /app/src ./src

# Copia outros ficheiros/pastas necessários para a tua aplicação correr
# Exemplo: COPY --from=builder /app/prisma ./prisma # Se o schema for necessário em runtime
# Se tiveres uma pasta 'public' ou de 'views', copia-as também se necessário

# DEBUG: Verifica se o dotenv foi copiado para a etapa final
RUN echo "--- [FINAL] Verificando dotenv em node_modules na ETAPA FINAL ---" && \
    if [ -d "node_modules/dotenv" ]; then echo "dotenv ENCONTRADO em node_modules"; else echo "dotenv NÃO ENCONTRADO em node_modules"; fi && \
    echo "--- Fim da verificação ---"

# Expõe a porta que a aplicação usa (se for diferente da do .env, esta é uma boa prática)
# A porta real que a tua app escuta será definida pelas tuas variáveis de ambiente
# EXPOSE 5000 # Ajusta se necessário, ou remove se a porta for sempre dinâmica via .env

# Define o comando para iniciar a aplicação
# O ficheiro .env será criado pelo teu workflow do GitHub Actions na VM,
# e o Docker Compose deverá montá-lo no contentor ou as variáveis serão passadas.
# Garante que a tua aplicação (src/index.js) carrega o .env do diretório /app/.env
CMD ["node", "src/index.js"]
