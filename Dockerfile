# Etapa de build
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare yarn@4.1.1 --activate

# 1. Copie PRIMEIRO os manifestos de dependência
COPY package.json yarn.lock ./
# Se você tiver um .yarnrc.yml, copie ele também:
# COPY .yarnrc.yml ./

# 2. Rode yarn install para criar/popular .yarn/cache e .pnp.cjs etc. DENTRO do builder
RUN yarn install --immutable

# 3. AGORA copie o resto do seu código fonte (src/, etc.)
# Isso não vai sobrescrever o .yarn/cache criado pelo passo anterior.
COPY . .

# Etapa final de produção
FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare yarn@4.1.1 --activate

COPY --from=builder /app /app

RUN yarn install --immutable # Deixe este comando aqui, ele deve ser rápido e verificar a consistência

# --- Comandos de Depuração (MANTENHA POR ENQUANTO para verificar) ---
RUN echo "==== CONTEÚDO DE /app (após yarn install) ===="
RUN ls -la /app

RUN echo "==== ARQUIVO .pnp.cjs (ou .pnp.loader.mjs) em /app ===="
RUN if [ -f /app/.pnp.cjs ]; then echo 'Encontrado .pnp.cjs'; else echo '.pnp.cjs NÃO encontrado'; fi
RUN if [ -f /app/.pnp.loader.mjs ]; then echo 'Encontrado .pnp.loader.mjs'; else echo '.pnp.loader.mjs NÃO encontrado'; fi

RUN echo "==== CONTEÚDO DE /app/.yarn (se existir) ===="
RUN if [ -d /app/.yarn ]; then ls -la /app/.yarn; else echo 'Pasta /app/.yarn NÃO encontrada'; fi

RUN echo "==== VERIFICANDO dotenv NO CACHE DO YARN em /app/.yarn/cache ===="
RUN if [ -d /app/.yarn/cache ]; then \
      find /app/.yarn/cache -name "*dotenv*" -print -quit && echo "--> dotenv encontrado no cache acima" || echo "--> dotenv NÃO encontrado no cache com find"; \
    else \
      echo 'Pasta /app/.yarn/cache NÃO encontrada'; \
    fi

RUN echo "==== YARN WHY DOTENV ===="
RUN yarn why dotenv || echo "Comando 'yarn why dotenv' falhou ou não encontrou dotenv"
# --- Fim dos Comandos de Depuração ---

CMD ["yarn", "node", "src/index.js"]