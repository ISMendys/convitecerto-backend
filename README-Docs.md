# Integração WhatsApp com Evolution API

Este projeto contém a integração do backend Convite Certo com a Evolution API para envio de mensagens WhatsApp.

## Estrutura do Projeto

- `docker-compose.yml` - Arquivo principal para orquestrar todos os serviços
- `docker-compose-evolution.yml` - Arquivo de configuração específico da Evolution API
- `.env` - Arquivo de configuração da Evolution API
- `convitecerto-backend/` - Código do backend com integração WhatsApp

## Pré-requisitos

- Docker e Docker Compose instalados no servidor
- Um número de telefone WhatsApp dedicado para enviar as mensagens

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
docker-compose up -d
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

### Backup

É recomendável fazer backup regular dos volumes Docker:
- `evolution_instances`: Contém os dados das instâncias do WhatsApp
- `evolution_redis`: Contém os dados do Redis
- `postgres_data`: Contém os dados do PostgreSQL

## Suporte

Para suporte adicional, consulte:
- [Documentação da Evolution API](https://doc.evolution-api.com/)
- [GitHub da Evolution API](https://github.com/EvolutionAPI/evolution-api)
