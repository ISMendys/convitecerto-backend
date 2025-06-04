#!/bin/bash

# --- Configurações ---
# Mude o ADMIN_EMAIL para o seu e-mail!
ADMIN_EMAIL="orkutcaiu.com@gmail.com"

MAIN_DOMAIN="convitecerto.online"
EVOLUTION_SUBDOMAIN="evolution"
API_SUBDOMAIN="api"

FULL_EVOLUTION_DOMAIN="${EVOLUTION_SUBDOMAIN}.${MAIN_DOMAIN}"
FULL_API_DOMAIN="${API_SUBDOMAIN}.${MAIN_DOMAIN}"

EVOLUTION_SERVICE_PORT="8080" # Porta interna da sua Evolution API
API_SERVICE_PORT="5000"       # Porta interna do seu backend
FRONTEND_BUILD_PATH="/home/admin/frontend" # Caminho para os arquivos de build do frontend

# --- Funções Auxiliares ---
log_action() {
  echo "-----------------------------------------------------"
  echo ">>> $1"
  echo "-----------------------------------------------------"
}

# Sair imediatamente se um comando falhar
set -e

# --- Início do Script ---
log_action "Iniciando script de configuração do Nginx, Frontend e Certbot"

if [ "$ADMIN_EMAIL" == "seu-email-aqui@example.com" ]; then
  echo "[AVISO] Por favor, edite este script e altere a variável ADMIN_EMAIL para o seu endereço de e-mail."
  exit 1
fi

# 1. Instalar Nginx
log_action "Verificando e instalando Nginx..."
if ! command -v nginx &> /dev/null; then
  apt update
  apt install nginx -y
  systemctl enable nginx
  systemctl start nginx
else
  echo "Nginx já está instalado."
fi

# 2. Configurar Firewall UFW (se estiver ativo)
log_action "Configurando Firewall UFW..."
if command -v ufw &> /dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 'Nginx Full'
  ufw allow 'OpenSSH' # Ou a porta SSH específica se você a mudou
  # ufw reload # Descomente se necessário, mas 'Nginx Full' geralmente é suficiente para novas regras
  echo "Regras do UFW para Nginx e OpenSSH aplicadas/verificadas."
else
  echo "UFW não está ativo ou não encontrado. Pulando configuração do firewall."
fi

# 3. Remover Certbot antigo (apt) e instalar via Snap
log_action "Verificando e instalando Certbot via Snap..."
if command -v certbot &> /dev/null && ! snap list certbot &> /dev/null ; then
  echo "Removendo instalações antigas do Certbot (apt)..."
  apt-get remove certbot python3-certbot-nginx -y
  apt-get autoremove -y
fi

if ! command -v certbot &> /dev/null || ! snap list certbot &> /dev/null; then
  echo "Instalando Certbot via Snap..."
  snap install core; snap refresh core
  snap install --classic certbot
  ln -sf /snap/bin/certbot /usr/bin/certbot
else
  echo "Certbot (via Snap) já está instalado."
fi

# 4. Criar configurações do Nginx
log_action "Criando configuração do Nginx para ${MAIN_DOMAIN} (Frontend)..."
# Certifique-se de que o diretório pai do FRONTEND_BUILD_PATH existe
mkdir -p "$(dirname "${FRONTEND_BUILD_PATH}")"
# Crie o diretório do frontend se ele não existir (importante para o Nginx iniciar)
mkdir -p "${FRONTEND_BUILD_PATH}"

cat <<EOF > "/etc/nginx/sites-available/${MAIN_DOMAIN}"
server {
    listen 80;
    listen [::]:80;
    server_name ${MAIN_DOMAIN};

    root ${FRONTEND_BUILD_PATH};
    index index.html index.htm;

    location / {
        # Essencial para Single Page Applications (React, Vue, Angular, etc.)
        # Tenta servir o arquivo diretamente, depois como diretório, e por último fallback para index.html
        try_files \$uri \$uri/ /index.html;
    }

    # Opcional: Configurações adicionais para cache de assets estáticos
    location ~* \.(?:css|js|jpg|jpeg|gif|png|ico|svg|webp|woff|woff2|ttf|eot)$ {
        expires 1M;
        add_header Cache-Control "public";
    }
}
EOF

log_action "Criando configuração do Nginx para ${FULL_EVOLUTION_DOMAIN}..."
cat <<EOF > "/etc/nginx/sites-available/${FULL_EVOLUTION_DOMAIN}"
server {
    listen 80;
    listen [::]:80;
    server_name ${FULL_EVOLUTION_DOMAIN};

    location / {
        proxy_pass http://localhost:${EVOLUTION_SERVICE_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

log_action "Criando configuração do Nginx para ${FULL_API_DOMAIN}..."
cat <<EOF > "/etc/nginx/sites-available/${FULL_API_DOMAIN}"
server {
    listen 80;
    listen [::]:80;
    server_name ${FULL_API_DOMAIN};

    location / {
        proxy_pass http://localhost:${API_SERVICE_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# 5. Habilitar sites Nginx (usando -f para forçar, caso já existam)
log_action "Habilitando sites no Nginx..."
ln -sf "/etc/nginx/sites-available/${MAIN_DOMAIN}" "/etc/nginx/sites-enabled/"
ln -sf "/etc/nginx/sites-available/${FULL_EVOLUTION_DOMAIN}" "/etc/nginx/sites-enabled/"
ln -sf "/etc/nginx/sites-available/${FULL_API_DOMAIN}" "/etc/nginx/sites-enabled/"

# 6. Testar e recarregar Nginx
log_action "Testando configuração do Nginx..."
nginx -t
log_action "Recarregando Nginx..."
systemctl reload nginx

# 7. Obter certificados SSL com Certbot
log_action "Obtendo certificados SSL com Certbot para todos os domínios..."
certbot --nginx \
    -d "${MAIN_DOMAIN}" \
    -d "${FULL_EVOLUTION_DOMAIN}" \
    -d "${FULL_API_DOMAIN}" \
    --email "${ADMIN_EMAIL}" \
    --agree-tos \
    --redirect \
    --expand \
    --non-interactive \
    --keep-until-expiring # Ou --force-renewal se quiser forçar a renovação

log_action "Configuração concluída com sucesso!"
echo "Seus sites devem estar acessíveis via HTTPS:"
echo "Frontend: https://${MAIN_DOMAIN}"
echo "Evolution: https://${FULL_EVOLUTION_DOMAIN}"
echo "API: https://${FULL_API_DOMAIN}"
echo "A renovação automática do SSL também está configurada."
