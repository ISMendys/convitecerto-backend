# Integração WhatsApp com Evolution API

Este projeto contém a integração do backend Convite Certo com a Evolution API para envio de mensagens WhatsApp.

## Estrutura do Projeto

- `docker-compose.yml` - Arquivo principal para orquestrar todos os serviços (Backend, Evolution API, Redis, PostgreSQL).
- `docker-compose-evolution.yml` - Arquivo de configuração específico da Evolution API (usado como base para o `docker-compose.yml` principal).
- `.env` - Arquivo de configuração da Evolution API (usado pelo `docker-compose.yml`).
- `convitecerto-backend/` - Código do backend com integração WhatsApp.
  - `Dockerfile` - Define a imagem Docker para o backend.
  - `.env` - Arquivo de configuração específico do backend (gerenciado pelo CI/CD).
  - `.github/workflows/backend-evolution.yml` - Workflow do GitHub Actions para CI/CD.

## Pré-requisitos

- Docker e Docker Compose instalados no servidor de destino.
- Um número de telefone WhatsApp dedicado para enviar as mensagens.
- Uma instância EC2 (ou similar) com acesso SSH configurado.
- Chave SSH privada configurada como um segredo no GitHub (`EC2_SSH_KEY`).
- Hostname/IP do servidor EC2 configurado como um segredo no GitHub (`EC2_HOST`).
- URL do banco de dados PostgreSQL configurada como um segredo no GitHub (`DATABASE_URL`).
- Segredo JWT configurado como um segredo no GitHub (`JWT_SECRET`).
- Chave API para a Evolution API configurada como um segredo no GitHub (`EVOLUTION_API_KEY`).


## Instruções de Implantação

### 1. Preparação do Ambiente

1. Clone este repositório no seu servidor:
   ```bash
   git clone <seu-repositorio>
   cd <pasta-do-repositorio>
   ```

2. Edite o arquivo `.env` na raiz do projeto:
   - Altere `AUTHENTICATION_API_KEY=SUA_CHAVE_API_SECRETA_AQUI` para uma chave segura
   - Ajuste outras configurações conforme necessário (banco de dados, webhook, etc.)

3. Edite o arquivo `docker-compose.yml` se necessário:
   - Verifique se as portas expostas (5000, 8080) estão disponíveis no seu servidor
   - Ajuste as variáveis de ambiente conforme necessário

### 2. Iniciar os Serviços

Execute o comando para iniciar todos os serviços:

```bash
docker compose up -d
```

Este comando iniciará:
- O backend da aplicação Convite Certo
- A Evolution API para WhatsApp
- Redis (cache para a Evolution API)
- PostgreSQL (banco de dados para a Evolution API)

### 3. Conectar o Número WhatsApp

1. Acesse a interface da Evolution API: `http://<IP_DO_SEU_SERVIDOR>:8080`
2. Navegue até a seção de instâncias
3. Você verá a instância `myinstance` já criada (configurada no backend)
4. Clique na instância para ver o QR Code
5. Escaneie o QR Code com o aplicativo WhatsApp no celular com o número dedicado:
   - Abra o WhatsApp
   - Vá em "Aparelhos conectados"
   - Selecione "Conectar um aparelho"
   - Escaneie o QR Code exibido

Alternativamente, você pode obter o QR Code através da API do backend:
```
GET /api/whatsapp/qrcode
```

### 4. Verificar a Conexão

Você pode verificar o status da conexão através da API do backend:
```
GET /api/whatsapp/status
```

A resposta deve mostrar `connected: true` se tudo estiver funcionando corretamente.

### 5. Configurar Webhook (Opcional)

Se você deseja receber notificações de mensagens recebidas, configure o webhook:

```
POST /api/whatsapp/configure-webhook
{
  "webhookUrl": "https://seu-dominio.com/api/whatsapp/webhook"
}
```

Certifique-se de que a URL do webhook seja acessível publicamente.

## Uso da API

### Enviar Convite Individual

```
POST /api/whatsapp/send-invite
{
  "guestId": "id-do-convidado",
  "message": "Olá! Você está convidado para o meu evento.",
  "inviteLink": "https://convitecerto.com/convite/123"
}
```

### Enviar Lembrete Individual

```
POST /api/whatsapp/send-reminder
{
  "guestId": "id-do-convidado",
  "message": "Não esqueça do evento amanhã!"
}
```

### Enviar Mensagem em Massa

```
POST /api/whatsapp/send-bulk
{
  "eventId": "id-do-evento",
  "message": "Mensagem para todos os convidados",
  "filter": {
    "status": "confirmed" // opcional, para filtrar por status
  }
}
```

## Solução de Problemas

### QR Code Expirado

Se o QR Code expirar, você pode obter um novo através da API:
```
GET /api/whatsapp/qrcode
```

### Desconectar Instância

Se precisar desconectar o número de WhatsApp:
```
POST /api/whatsapp/disconnect
```
### Limpar docker
```
# 1) Pare todos os containers em execução
docker stop $(docker ps -q)

# 2) Remova todos os containers (parados e em execução)
docker rm $(docker ps -aq)

# 3) Remova todas as imagens
docker rmi $(docker images -q) --force

# 4) Remova todos os volumes
docker volume rm $(docker volume ls -q)

# 5) Remova todas as redes criadas pelo usuário (exceto as padrão)
docker network prune -f

# 6) (Opcional) Limpe cache de build do Docker
docker builder prune -f
```
### Logs

Para verificar os logs dos serviços:
```bash
# Logs do backend
docker logs convitecerto_backend

# Logs da Evolution API
docker logs evolution_api
```

## Arquitetura da Solução

A solução é composta por:

1. **Backend Convite Certo**: Aplicação Node.js que gerencia eventos, convites e convidados
2. **Evolution API**: API que gerencia a conexão com o WhatsApp
3. **Redis**: Cache para a Evolution API
4. **PostgreSQL**: Banco de dados para a Evolution API

O fluxo de funcionamento é:

1. O usuário solicita o envio de uma mensagem através do frontend
2. O backend recebe a solicitação e a processa
3. O backend envia a mensagem para a Evolution API
4. A Evolution API envia a mensagem para o WhatsApp
5. O WhatsApp entrega a mensagem ao destinatário
6. Se configurado, o webhook recebe notificações de mensagens recebidas

## Segurança

- A chave de API (`AUTHENTICATION_API_KEY`) é usada para autenticar as requisições entre o backend e a Evolution API
- Certifique-se de usar uma chave forte e mantê-la segura
- Recomenda-se usar HTTPS para todas as comunicações externas

## Manutenção

### Atualização da Evolution API

Para atualizar a Evolution API:

1. Pare os serviços: `docker-compose down`
2. Atualize a imagem: `docker pull atendai/evolution-api:homolog`
3. Inicie os serviços novamente: `docker-compose up -d`


## Instruções de Implantação (Manual)

Se você preferir implantar manualmente sem usar o GitHub Actions:

1.  **Clone o Repositório:**
    ```bash
    git clone <seu-repositorio>
    cd <pasta-do-repositorio>
    ```

2.  **Configure os Arquivos `.env`:**
    *   **Raiz do Projeto (`./.env`):**
        *   Edite `AUTHENTICATION_API_KEY` com sua chave secreta segura.
        *   Ajuste `SERVER_URL` se necessário (geralmente `http://localhost:8080` é suficiente para comunicação interna do Docker).
        *   Configure `WEBHOOK_GLOBAL_URL` se for usar webhooks (ex: `https://seu-dominio.com/api/whatsapp/webhook`).
        *   Ajuste outras configurações da Evolution API conforme necessário (veja os comentários no arquivo).
    *   **Backend (`./convitecerto-backend/.env`):**
        *   Configure `DATABASE_URL` com a string de conexão do seu banco de dados PostgreSQL.
        *   Configure `JWT_SECRET` com uma chave secreta segura.
        *   `EVOLUTION_API_URL` e `EVOLUTION_API_KEY` serão preenchidos automaticamente pelo `docker-compose.yml` se estiver usando o compose para rodar tudo. Se rodar o backend separadamente, defina-os aqui.

3.  **Construa e Inicie os Serviços com Docker Compose:**
    ```bash
    docker-compose up --build -d
    ```
    Isso construirá a imagem do backend (se necessário) e iniciará todos os serviços definidos no `docker-compose.yml`.

4.  **Execute as Migrações do Banco de Dados:**
    ```bash
    docker-compose exec backend npx prisma migrate deploy
    ```

5.  **Conecte o Número WhatsApp:**
    *   Acesse a interface da Evolution API: `http://<IP_DO_SEU_SERVIDOR>:8080`
    *   Crie uma instância (se não existir, o nome padrão é `myinstance`).
    *   Escaneie o QR Code com o aplicativo WhatsApp no celular dedicado.

6.  **Verifique a Conexão:**
    *   Acesse `http://<IP_DO_SEU_SERVIDOR>:5000/api/whatsapp/status` (ou a porta que você mapeou para o backend).
    *   A resposta deve indicar o status da conexão com a instância do WhatsApp.

## Implantação Automatizada (GitHub Actions)

Este projeto inclui um workflow do GitHub Actions (`.github/workflows/backend-evolution.yml`) para automatizar o processo de implantação no seu servidor EC2 (ou similar) sempre que houver um push para a branch `main`.

**Configuração:**

1.  **Segredos do GitHub:** Configure os seguintes segredos no seu repositório GitHub (Settings > Secrets and variables > Actions):
    *   `EC2_SSH_KEY`: A chave SSH privada para acessar seu servidor.
    *   `EC2_HOST`: O nome de usuário e endereço IP/hostname do seu servidor (ex: `ubuntu@your.server.ip`).
    *   `DATABASE_URL`: A URL de conexão completa para o seu banco de dados PostgreSQL.
    *   `JWT_SECRET`: O segredo JWT usado pelo seu backend.
    *   `EVOLUTION_API_KEY`: A chave de API segura que você definiu para a Evolution API.
    *   (Opcional) `APP_DOMAIN`: O domínio público da sua aplicação, se você estiver usando webhooks (ex: `app.seusite.com`).

2.  **Workflow:** O arquivo `backend-evolution.yml` fará o seguinte:
    *   Faz o checkout do código.
    *   Configura o acesso SSH ao seu servidor.
    *   Copia os arquivos necessários (`docker-compose.yml`, `.env`, `convitecerto-backend/`) para o servidor via `rsync`.
    *   Cria os arquivos `.env` no servidor usando os segredos configurados no GitHub.
    *   Executa `docker-compose down` e `docker-compose up -d --build` para parar, reconstruir (se necessário) e iniciar os serviços.
    *   Executa as migrações do Prisma (`npx prisma migrate deploy`) dentro do contêiner do backend.

**Observação:** O workflow sobrescreve os arquivos `.env` no servidor a cada deploy, usando os valores dos segredos do GitHub. Certifique-se de que os segredos estão corretos e atualizados.


### QR Code Expirado

Se o QR Code expirar, você pode obter um novo através da API:
```
GET /api/whatsapp/qrcode
```

### Desconectar Instância

Se precisar desconectar o número de WhatsApp:
```
POST /api/whatsapp/disconnect
```

### Logs

Para verificar os logs dos serviços:
```bash
# Logs do backend
docker logs convitecerto_backend

# Logs da Evolution API
docker logs evolution_api
```

A solução é composta por:

1.  **Backend Convite Certo**: Aplicação Node.js que gerencia eventos, convites e convidados
2.  **Evolution API**: API que gerencia a conexão com o WhatsApp
3.  **Redis**: Cache para a Evolution API
4.  **PostgreSQL**: Banco de dados para a Evolution API

O fluxo de funcionamento é:

1.  O usuário solicita o envio de uma mensagem através do frontend
2.  O backend recebe a solicitação e a processa
3.  O backend envia a mensagem para a Evolution API
4.  A Evolution API envia a mensagem para o WhatsApp
5.  O WhatsApp entrega a mensagem ao destinatário
6.  Se configurado, o webhook recebe notificações de mensagens recebidas

- A chave de API (`AUTHENTICATION_API_KEY`) é usada para autenticar as requisições entre o backend e a Evolution API. **Guarde esta chave com segurança e configure-a como um segredo no GitHub (`EVOLUTION_API_KEY`) para o workflow de CI/CD.**
- Configure as credenciais do banco de dados (`DATABASE_URL`) e o segredo JWT (`JWT_SECRET`) como segredos no GitHub.
- Certifique-se de que a chave SSH (`EC2_SSH_KEY`) usada para o deploy tenha permissões restritas no servidor.
- Recomenda-se usar HTTPS para todas as comunicações externas.

### Backup

É recomendável fazer backup regular dos volumes Docker:
- `evolution_instances`: Contém os dados das instâncias do WhatsApp
- `evolution_redis`: Contém os dados do Redis
- `postgres_data`: Contém os dados do PostgreSQL

## Suporte

Para suporte adicional, consulte:
- [Documentação da Evolution API](https://doc.evolution-api.com/)
- [GitHub da Evolution API](https://github.com/EvolutionAPI/evolution-api)
