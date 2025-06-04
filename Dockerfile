# Etapa de build
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare yarn@4.1.1 --activate

COPY package.json yarn.lock ./
# Se você tiver um .yarnrc.yml, copie ele também:

RUN yarn install --immutable

# --- LOGS NO BUILDER: Antes do COPY . . ---
RUN echo "==== BUILDER: ESTADO DE /app/.yarn/cache APÓS yarn install (ANTES do COPY . .) ===="
RUN if [ -d /app/.yarn/cache ]; then \
      echo "BUILDER: Encontrada /app/.yarn/cache. Contagem de itens:"; \
      ls -1qA /app/.yarn/cache | wc -l; \
    else \
      echo "BUILDER: /app/.yarn/cache NÃO encontrada APÓS yarn install (ANTES do COPY . .)"; \
    fi
# --- Fim dos Logs no Builder ---

COPY . .

# --- LOGS NO BUILDER: Depois do COPY . . ---
RUN echo "==== BUILDER: ESTADO DE /app/.yarn/cache APÓS COPY . . ===="
RUN if [ -d /app/.yarn/cache ]; then \
      echo "BUILDER: Encontrada /app/.yarn/cache. Contagem de itens:"; \
      ls -1qA /app/.yarn/cache | wc -l; \
    else \
      echo "BUILDER: /app/.yarn/cache NÃO encontrada APÓS COPY . ."; \
    fi
# --- Fim dos Logs no Builder ---

# Etapa final de produção
FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare yarn@4.1.1 --activate

COPY --from=builder /app /app

RUN yarn install --immutable # Deixe este comando aqui

# --- Comandos de Depuração na Etapa Final (MANTENHA) ---
RUN echo "==== FINAL: CONTEÚDO DE /app (após yarn install) ===="
RUN ls -la /app

RUN echo "==== FINAL: ARQUIVO .pnp.cjs (ou .pnp.loader.mjs) em /app ===="
RUN if [ -f /app/.pnp.cjs ]; then echo 'FINAL: Encontrado .pnp.cjs'; else echo 'FINAL: .pnp.cjs NÃO encontrado'; fi
RUN if [ -f /app/.pnp.loader.mjs ]; then echo 'FINAL: Encontrado .pnp.loader.mjs'; else echo 'FINAL: .pnp.loader.mjs NÃO encontrado'; fi

RUN echo "==== FINAL: CONTEÚDO DE /app/.yarn (se existir) ===="
RUN if [ -d /app/.yarn ]; then ls -la /app/.yarn; else echo 'FINAL: Pasta /app/.yarn NÃO encontrada'; fi

RUN echo "==== FINAL: VERIFICANDO dotenv NO CACHE DO YARN em /app/.yarn/cache ===="
RUN if [ -d /app/.yarn/cache ]; then \
      find /app/.yarn/cache -name "*dotenv*" -print -quit && echo "FINAL: --> dotenv encontrado no cache acima" || echo "FINAL: --> dotenv NÃO encontrado no cache com find"; \
    else \
      echo 'FINAL: Pasta /app/.yarn/cache NÃO encontrada'; \
    fi

RUN echo "==== FINAL: YARN WHY DOTENV ===="
RUN yarn why dotenv || echo "FINAL: Comando 'yarn why dotenv' falhou ou não encontrou dotenv"
# --- Fim dos Comandos de Depuração na Etapa Final ---

CMD ["yarn", "node", "src/index.js"]