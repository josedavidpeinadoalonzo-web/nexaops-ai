# 🟢 Configuración Green API WhatsApp - Guía Completa

## Resumen

Se migró el chatbot de **Twilio a Green API** para garantizar funcionamiento en Venezuela y reducir costos.

---

## 📋 PASOS PARA CONFIGURACIÓN

### PASO 1: Obtener Credenciales de Green API

1. Ir a [Green API Console](https://console.green-api.com/)
2. Iniciar sesión / registrarse
3. Crear nueva instancia:
   - **Regiones recomendadas**: Frankfurt (Frankfurt) o Moscow
   - **Nombre**: `nexaops-whatsapp`
4. Copiar:
   - **Instance ID** (ej: `1234567890`) → `GREEN_API_INSTANCE`
   - **API Token** (ej: `abcd...1234`) → `GREEN_API_TOKEN`

### PASO 2: Configurar Entorno

Crear archivo `api/.env`:

```bash
# Green API
GREEN_API_INSTANCE=1234567890
GREEN_API_TOKEN=abcdefghijklmnopqrstuvwxyz123456
GREEN_API_WHATSAPP_FROM=58412345678@c.us

# Supabase (ya existen)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...

# API Security (opcional)
API_SECRET_KEY=mi_clave_secreta
```

### PASO 3: Ejecutar Setup Wizard

```bash
cd api
npm run setup
```

**OR manualmente:**

```bash
# Test conexión
node test-green-api.js

# Obtener QR
curl http://localhost:3000/api/whatsapp/qr

# Verificar estado
curl http://localhost:3000/api/whatsapp/health
```

### PASO 4: Conectar WhatsApp

**Opción A: QR Code (Recomendado para testing)**

1. Ejecutar servidor: `node server.js`
2. Llamar endpoint: `GET /api/whatsapp/qr`
3. Copiar URL del QR (ej: `https://.../get/qr/...`)
4. Abrir en navegador móvil
5. Escanear con WhatsApp móvil
6. Esperar confirmación

**Opción B: Webhook (Producción)**

1. Ir a Green API Console
2. Sección "Settings" → "Webhooks"
3. Configurar URL:
   ```
   https://api-virid-six-51.vercel.app/api/webhook/whatsapp
   ```
4. Guardar y verificar

### PASO 5: Verificar Conexión

```bash
# Test local
curl http://localhost:3000/api/whatsapp/health

# Respuesta esperada
{
  "status": "ok",
  "greenApi": {
    "stateInstance": "authorized"
  },
  "instance": "1234567890",
  "configured": true
}
```

---

## 🔧 CONFIGURACIÓN GREEN API CONSOLE

### Settings → Webhooks

```
Receive incoming webhooks: ENABLED
Webhook URL:
  https://api-virid-six-51.vercel.app/api/webhook/whatsapp
  
Webhook token: [dejar vacío]
```

### Settings → API

```
API Token: [tu_token_aquí]
Instance ID: [tu_instance_aquí]
```

### API

- URL Base: `https://api.green-api.com`
- Documentación: https://green-api.com/docs/

---

## 📤 FORMATO DE MENSAJES

### Mensaje Entrante (Green API → Nuestro Server)

```json
{
  "body": {
    "typeMessage": "textMessage",
    "textMessageData": {
      "textMessage": "hola"
    },
    "senderData": {
      "chatId": "34605797755@c.us",
      "sender": "34605797755",
      "senderName": "Juan"
    }
  },
  "receiptId": "12345"
}
```

### Mensaje Saliente (Nuestro Server → Green API)

```javascript
POST https://api.green-api.com/waInstance1234567890/sendMessage/abcdefghijklmnop

{
  "chatId": "34605797755@c.us",
  "message": "Hola! Respuesta automática"
}
```

---

## 🚀 DEPLOYMENT PRODUCCIÓN

### Vercel Deployment

1. Asegurar variables de entorno en Vercel:
   - `GREEN_API_INSTANCE`
   - `GREEN_API_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

2. Configurar webhook en producción:
   ```
   https://api-virid-six-51.vercel.app/api/webhook/whatsapp
   ```

3. Verificar conexión:
   ```
   https://api-virid-six-51.vercel.app/api/whatsapp/health
   ```

### Health Check Automático

Configurar monitoreo cada 5 minutos:
```
GET /api/whatsapp/health
```

Alerta si `stateInstance !== "authorized"`

---

## 💰 PLANES GREEN API

| Plan | Precio | Límite | Recomendado |
|------|--------|--------|-------------|
| FREE | Gratis | ~100 msg/día | ❌ Testing |
| BASIC | ~$5/mes | ~1000 msg/día | ✅ Producción |
| PRO | ~$15/mes | ~10000 msg/día | 🚀 Alto tráfico |

**Recomendación**: Plan BASIC para empezar.

---

## 🔍 TROUBLESHOOTING

### ❌ "No Green API credentials configured"
**Solución**: Verificar `.env` tiene `GREEN_API_INSTANCE` y `GREEN_API_TOKEN`

### ❌ "Instance not found"
**Solución**: Verificar `GREEN_API_INSTANCE` es el número correcto

### ❌ "authToken is not defined"
**Solución**: Verificar `GREEN_API_TOKEN` es correcto

### ❌ WhatsApp no escanea
**Solución**: 
- Asegurar WhatsApp móvil está abierto
- Revisar internet del móvil
- Intentar nuevo QR (GET /api/whatsapp/qr)

### ❌ Mensajes no llegan
**Solución**:
- Verificar webhook URL en Green API Console
- Chequear logs del servidor
- Verificar `stateInstance === "authorized"`

---

## 📊 TESTING

### Simular Mensaje Entrante

```bash
curl -X POST http://localhost:3000/api/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "body": {
      "typeMessage": "textMessage",
      "textMessageData": {
        "textMessage": "hola"
      },
      "senderData": {
        "chatId": "58412345678@c.us"
      }
    }
  }'
```

### Simular Cliente Nuevo

```bash
curl -X POST http://localhost:3000/api/clients \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Client",
    "phone": "58412345678",
    "email": "test@example.com"
  }'
```

---

## 📝 COMANDOS ÚTILES

```bash
# Iniciar servidor
cd api && npm start

# Modo desarrollo
cd api && npm run dev

# Test conexión
cd api && npm test

# Setup wizard
cd api && npm run setup

# Ver logs
tail -f /var/log/green-api.log

# Reiniciar WhatsApp
curl -X POST http://localhost:3000/api/whatsapp/qr
```

---

## 🔄 MIGRACIÓN DESDE TWILIO

### Cambios en Código

| Antes (Twilio) | Ahora (Green API) |
|----------------|-------------------|
| `twilio().messages.create()` | `axios.post(GREEN_API_BASE/sendMessage)` |
| `req.body.Body` | `req.body.body.textMessageData.textMessage` |
| `req.body.From` | `req.body.body.senderData.chatId` |
| XML Response | JSON Response |
| Form-encoded | JSON |

### Variables Removidas

- `TWILIO_ACCOUNT_SID` ❌
- `TWILIO_AUTH_TOKEN` ❌
- `TWILIO_WHATSAPP_FROM` ❌

### Variables Nuevas

- `GREEN_API_INSTANCE` ✅
- `GREEN_API_TOKEN` ✅
- `GREEN_API_WHATSAPP_FROM` ✅

---

## 📞 SOPORTE

### Green API
- Panel: https://console.green-api.com/
- Docs: https://green-api.com/docs/
- Status: https://status.green-api.com/

### Documentación Interna
- `GREEN_API_SETUP.md` - Esta guía
- `SETUP_GREEN_API.md` - Guía paso a paso
- `MIGRATION_TWILIO_GREENAPI.md` - Detalles técnicos

---

## ✅ CHECKLIST FIN

- [x] Código migrado a Green API
- [x] Dependencias actualizadas (axios)
- [x] Twilio removido
- [x] Endpoints configurados
- [x] Variables de entorno definidas
- [ ] Credenciales Green API configuradas
- [ ] WhatsApp conectado
- [ ] Webhook configurado en Green API
- [ ] Testing completado
- [ ] Deploy producción realizado

---

**Fecha**: Abril 2026  
**Versión**: 1.1.0  
**Estado**: 🟢 Listo para Configuración