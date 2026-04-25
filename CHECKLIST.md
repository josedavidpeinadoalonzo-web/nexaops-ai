:white_check_mark: # CHECKLIST DE IMPLEMENTACIÓN - Green API WhatsApp

## ✅ COMPLETADO

### 1. Código Migrado
- [x] `server.js` - Webhook actualizado a Green API
- [x] `server.js` - Lógica de mensajes con Green API
- [x] `server.js` - Eliminadas dependencias de Twilio
- [x] `server.js` - Nuevos endpoints (health, qr)
- [x] `package.json` - Dependencias actualizadas
- [x] `package.json` - Twilio removido

### 2. Dependencias
- [x] `axios` instalado (^1.6.0)
- [x] `twilio` desinstalado
- [x] Todas las dependencias funcionales

### 3. Documentación
- [x] `GREEN_API_SETUP.md` - Guía de setup
- [x] `SETUP_GREEN_API.md` - Configuración paso a paso
- [x] `MIGRATION_TWILIO_GREENAPI.md` - Detalles técnicos
- [x] `WEBHOOK_CONFIG.md` - Configuración de webhooks
- [x] `CHECKLIST.md` - Este archivo

### 4. Scripts
- [x] `test-green-api.js` - Test de conexión
- [x] `setup-green-api.js` - Wizard de configuración
- [x] `api/.env.example` - Template de variables

### 5. Endpoints Nuevos
- [x] `GET /api/whatsapp/health` - Verificar conexión
- [x] `GET /api/whatsapp/qr` - Obtener QR code
- [x] `POST /api/webhook/whatsapp` - Webhook Green API
- [x] `POST /api/notify/whatsapp` - Notificaciones (actualizado)

## ⏳ PENDIENTE (Requiere Acción)

### Configuración Green API
- [ ] Crear cuenta en Green API Console
- [ ] Obtener `GREEN_API_INSTANCE`
- [ ] Obtener `GREEN_API_TOKEN`
- [ ] Configurar `api/.env` con credenciales

### Conexión WhatsApp
- [ ] Ejecutar `npm run setup` o `node test-green-api.js`
- [ ] Obtener QR code (`GET /api/whatsapp/qr`)
- [ ] Escanear QR con WhatsApp móvil
- [ ] Verificar conexión (`GET /api/whatsapp/health`)
- [ ] Estado debe ser `authorized`

### Webhook Producción
- [ ] Ir a Green API Console → Settings → Webhooks
- [ ] Configurar URL:
  ```
  https://api-virid-six-51.vercel.app/api/webhook/whatsapp
  ```
- [ ] Guardar configuración
- [ ] Test webhook con curl

### Deploy
- [ ] Subir cambios a GitHub
- [ ] Deploy en Vercel
- [ ] Configurar variables de entorno en Vercel:
  - `GREEN_API_INSTANCE`
  - `GREEN_API_TOKEN`
  - `GREEN_API_WHATSAPP_FROM`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
- [ ] Verificar deploy exitoso
- [ ] Test endpoints en producción

## 📋 INSTRUCCIONES PASO A PASO

```bash
# 1. Configurar credenciales
cd api
cp .env.example .env
# Editar .env con tus credenciales

# 2. Ejecutar setup wizard
npm run setup

# 3. Escanear QR que aparece
# Abrir WhatsApp móvil → Configuración → Dispositivos vinculados → Vincular dispositivo
# Escanear el QR

# 4. Verificar conexión
curl http://localhost:3000/api/whatsapp/health

# 5. Configurar webhook en Green API Console
# Settings → Webhooks
# URL: https://api-virid-six-51.vercel.app/api/webhook/whatsapp

# 6. Deploy a producción
git add -A
git commit -m "feat: migrate from Twilio to Green API for WhatsApp"
git push
# Deploy automático en Vercel
```

## 🧪 TESTING

### Test Local
```bash
cd api
npm start

# Terminal 2 - Test webhook
curl -X POST http://localhost:3000/api/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "body": {
      "typeMessage": "textMessage",
      "textMessageData": {"textMessage": "hola"},
      "senderData": {"chatId": "58412345678@c.us"}
    }
  }'
```

### Test Producción
```bash
curl -X POST https://api-virid-six-51.vercel.app/api/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "body": {
      "typeMessage": "textMessage",
      "textMessageData": {"textMessage": "hola"},
      "senderData": {"chatId": "58412345678@c.us"}
    }
  }'
```

## 🎯 VERIFICACIÓN FINAL

### Debe Funcionar
- [ ] Mensajes entrantes por WhatsApp → Procesados
- [ ] Respuestas automáticas enviadas por WhatsApp
- [ ] Clientes reconocidos por número
- [ ] Clientes nuevos reciben mensaje de bienvenida
- [ ] Comando "1" muestra proyectos
- [ ] Comando "2" muestra soporte
- [ ] Admin puede enviar notificaciones
- [ ] Webhook responde en < 5 segundos

### Métricas Esperadas
```
Tiempo respuesta webhook: < 1000ms
Conexión WhatsApp: authorized
Mensajes/hora: Según plan Green API
Errores: 0%
```

## 📞 SOPORTE

### Problemas Comunes

**No escanea QR**
- Verificar internet en móvil
- Intentar nuevo QR
- Revisar estado: `GET /api/whatsapp/health`

**Mensajes no llegan**
- Verificar webhook URL en Green API
- Chequear estado conexión
- Revisar logs Vercel

**Error credenciales**
- Verificar `.env`
- Revisar Green API Console
- Test: `npm run test`

### Documentación
- Green API: https://green-api.com/docs/
- Código: `api/server.js`
- Tests: `api/test-green-api.js`

---

**Versión**: 1.1.0  
**Fecha**: Abril 2026  
**Estado**: 🟢 Listo para Configuración
