# Migración de Twilio a Green API - WhatsApp Bot

## ✅ Cambios Realizados

### 1. Código de `server.js` modificado

**Antes (Twilio):**
- Usaba SDK `twilio` para enviar/recibir mensajes
- Recibía formulario POST `application/x-www-form-urlencoded`
- Respondía con TwiML XML

**Después (Green API):**
- Usa `axios` (HTTP REST API)
- Recibe JSON `{body: {textMessageData: {textMessage: "..."}, senderData: {chatId: "..."}}}`  
- Responde JSON `{received: true}`
- Envía mensajes via REST API a Green API

### 2. Dependencias actualizadas
- ✅ `axios@1.15.2` instalado
- ⚠️ `twilio` aún presente (remover si no se necesita backup)

### 3. Nuevos endpoints

#### Health Check Green API
```bash
GET /api/whatsapp/health
```
Verifica conexión y estado de la instancia.

#### QR Code
```bash  
GET /api/whatsapp/qr
```
Obtiene QR para conectar WhatsApp.

### 4. Variables de entorno

Crear archivo `api/.env` con:
```bash
GREEN_API_INSTANCE=1234567890
GREEN_API_TOKEN=abcdefghijklmnopqrstuvwxyz123456
```

## 🔄 Flujo de funcionamiento

```
Usuario WhatsApp
        ↓
   Green API (recibe mensaje)
        ↓
   POST /api/webhook/whatsapp (nuestro server)
        ↓
   Procesar mensaje → Buscar cliente en Supabase
        ↓
   Generar respuesta
        ↓
   Green API sendMessage (REST)
        ↓
   Usuario recibe respuesta
```

## ⚠️ Notas importantes

1. **Formato ChatID**: Green API usa `email` (incluye `@c.us`)
2. **Números**: Formato internacional sin símbolos, ej: `34605797755`
3. **Webhook**: Green API necesita configurar URL en su panel
4. **Conexión**: WhatsApp debe estar conectado (QR code o teléfono vinculado)

## 🚀 Pasos para producción

1. ✅ Código actualizado (HECHO)
2. ✅ Dependencias instaladas (HECHO)
3. ⏳ Configurar Green API instance (pago/recomendado)
4. ⏳ Configurar webhook URL en Green API Console
5. ⏳ Obtener/QR enlazar WhatsApp número
6. ⏳ Probar endpoints en producción
7. ⏳ Remover credenciales Twilio si ya no se usan

## 🔍 Testing local

```bash
# 1. Arrancar servidor
cd api && node server.js

# 2. Verificar health
GET http://localhost:3000/api/whatsapp/health

# 3. Obtener QR (conectar WhatsApp)
GET http://localhost:3000/api/whatsapp/qr

# 4. Simular mensaje (curl)
curl -X POST http://localhost:3000/api/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "body": {
      "typeMessage": "textMessage",
      "textMessageData": {"textMessage": "hola"},
      "senderData": {"chatId": "34605797755@c.us"}
    }
  }'
```

## 💰 Costos Green API

- Plan FREE: ~100 mensajes/día
- Plan BÁSICO: ~$5/mes, mayor límite
- Plan PRO: ~$15/mes, prioridad + soporte

**Recomendación**: Plan BÁSICO para producción Venezuela.

## 📞 Soporte Green API

- Panel: https://console.green-api.com/
- Documentación: https://green-api.com/docs/
- Status: https://status.green-api.com/