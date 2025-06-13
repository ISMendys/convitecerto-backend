# Guia de Configuração da Evolution API para WhatsApp

Este guia explica como configurar a Evolution API para envio de mensagens WhatsApp no seu servidor.

## Configuração Inicial

1. **Edite o arquivo `.env`**:
   - Altere `AUTHENTICATION_API_KEY=SUA_CHAVE_API_SECRETA_AQUI` para uma chave segura
   - Esta chave será usada pelo backend para se autenticar na API

2. **Inicie os serviços**:
   ```bash
   docker-compose up -d
   ```

3. **Conecte o número WhatsApp**:
   - Acesse `http://seu-servidor:8080`
   - Você verá a instância `myinstance` já criada
   - Escaneie o QR Code com o WhatsApp do número dedicado
   - Alternativamente, acesse `/api/whatsapp/qrcode` no backend

4. **Verifique a conexão**:
   - Acesse `/api/whatsapp/status` no backend
   - Deve mostrar `connected: true`

## Configuração do Webhook (Opcional)

Para receber notificações de mensagens:

```
POST /api/whatsapp/configure-webhook
{
  "webhookUrl": "https://seu-dominio.com/api/whatsapp/webhook"
}
```

## Solução de Problemas

- **QR Code expirado**: Acesse `/api/whatsapp/qrcode` para obter um novo
- **Desconectar**: Use `/api/whatsapp/disconnect` para desconectar o número
- **Logs**: Verifique com `docker logs evolution_api`

Para mais detalhes, consulte o README.md completo.
