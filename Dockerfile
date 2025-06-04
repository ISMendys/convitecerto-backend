# Etapa final de produção
FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare yarn@4.1.1 --activate

COPY --from=builder /app /app

RUN yarn install --immutable # Deixe este comando aqui

# --- Adicione estes Comandos de Depuração ---
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