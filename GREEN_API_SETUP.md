# Green API Setup Guide - WhatsApp Bot

## Overview
Green API replaces Twilio for WhatsApp integration (better for Venezuela).

## Configuration

### 1. Green API Account Setup
- Login: https://console.green-api.com/
- Create instance in your region (recommended: Frankfurt or Moscow for Venezuela)
- Instance format: `XXXXXXXXX` (numbers only)

### 2. Environment Variables (.env file)

Add these to your `api/.env` file:

```bash
# Green API Configuration
GREEN_API_INSTANCE=YOUR_INSTANCE_NUMBER
GREEN_API_TOKEN=YOUR_API_TOKEN

# WhatsApp Settings
GREEN_API_WHATSAPP_FROM=YOUR_GREEN_API_NUMBER@c.us

# Optional: Verify your Green API connection
# Visit: http://localhost:3000/api/whatsapp/health
```

### 3. Connect WhatsApp Number

**Method A: QR Code (Recommended for testing)**

```bash
GET /api/whatsapp/qr
```

1. Call this endpoint
2. Scan QR code with WhatsApp mobile app
3. Status: http://localhost:3000/api/whatsapp/health

**Method B: Phone Number (Production)**

1. Go to Green API Console
2. Link your WhatsApp number to the instance
3. Wait for approval (may take minutes)

## API Endpoints

### Webhook Configuration
Green API needs to send incoming messages to:
```
POST https://your-server.com/api/webhook/whatsapp
```

### Send Message
```bash
POST /api/notify/whatsapp
{
  "clientId": "1234567890",
  "message": "Hello from NexaOps!"
}
```

### Connection Health
```bash
GET /api/whatsapp/health
```

### Get QR Code
```bash
GET /api/whatsapp/qr
```

## Green API Format

### Incoming Message (from Green API)
```json
{
  "body": {
    "typeMessage": "textMessage",
    "textMessageData": {
      "textMessage": "hola"
    },
    "senderData": {
      "chatId": "34605797755@c.us"
    }
  }
}
```

### Outgoing Message (to Green API)
```json
{
  "chatId": "34605797755@c.us",
  "message": "Hola! Mensaje de respuesta"
}
```

## Important Notes

1. **Chat ID Format**: Include `@c.us` for personal numbers, `@g.us` for groups
2. **Number Format**: Green API uses international format without `+`
3. **Rate Limits**: Green API has limits (free tier: ~100 msg/day)
4. **Connection**: WhatsApp must be connected to receive/send messages
5. **Testing**: Use `/api/whatsapp/health` to verify connection

## Troubleshooting

### No Messages Received
- Check Green API status: `/api/whatsapp/health`
- Verify webhook URL in Green API console
- Ensure WhatsApp is connected (via QR code)

### Cannot Send Messages
- Verify instance ID and token
- Check WhatsApp connection status
- Ensure correct phone number format

### Wrong Number Detection
- Green API `chatId` may differ from actual number
- Update `findClientByChatId()` if needed

## Production Deployment

1. Use production Green API instance (paid plan)
2. Set up SSL for webhook
3. Configure webhook URL in Green API console
4. Monitor `/api/whatsapp/health` endpoint
5. Add error logging for failed messages
