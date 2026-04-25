# 🔗 Green API Webhook Configuration

## URL del Webhook

### Producción (Vercel)
```
https://api-virid-six-51.vercel.app/api/webhook/whatsapp
```

### Local
```
http://localhost:3000/api/webhook/whatsapp
```

## Configuración en Green API Console

1. Ir a: **Settings** → **Webhooks**
2. Configurar:

```
Receive incoming webhooks: [ENABLED]

Webhook URL:
  https://api-virid-six-51.vercel.app/api/webhook/whatsapp

Webhook token: (dejar vacío)
```

3. Clic en **Save**

## Formato Esperado

Green API enviará POST automáticamente cuando llegue un mensaje:

### Headers
```
Content-Type: application/json
```

### Body
```json
{
  "receiptId": 1234567890,
  "body": {
    "typeMessage": "textMessage",
    "textMessageData": {
      "textMessage": "hola"
    },
    "senderData": {
      "chatId": "58412345678@c.us",
      "sender": "58412345678",
      "senderName": "Juan Perez"
    },
    "timestamp": 1234567890
  },
  "instanceData": {
    "idInstance": 1234567890,
    "wid": "58412345678@c.us",
    "typeInstance": "whatsapp"
  }
}
```

## Respuesta del Webhook

### Éxito (200 OK)
```json
{
  "received": true
}
```

### Error (500)
```json
{
  "error": "Mensaje de error"
}
```

## Verificación

### 1. Test Local
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

### 2. Test Producción
```bash
curl -X POST https://api-virid-six-51.vercel.app/api/webhook/whatsapp \
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

### 3. Historial en Green API
- Ir a: **API** → **History**
- Verificar que los webhooks se están enviando
- Revisar códigos de respuesta

## Troubleshooting

### ❌ Webhook no responde

**Verificar:**
1. Servidor está corriendo: `GET /api/health`
2. Green API está configurado: `GET /api/whatsapp/health`
3. URL del webhook es correcta
4. El servidor acepta conexiones externas (no solo localhost)

**Logs:**
- Verificar logs del servidor
- Revisar "History" en Green API Console

### ❌ Mensajes duplicados

**Causa**: Green API reenvía si no recibe 200 OK en 5 segundos

**Solución**: 
- Asegurar el endpoint responde 200 OK rápido
- El procesamiento es asíncrono (se envía el 200 antes de procesar)

### ❌ Error 404

**Causa**: URL incorrecta o servidor no alcanzable

**Solución**:
- Verificar URL exacta
- Probar con `curl` local primero
- Asegurar DNS está configurado (producción)

### ❌ Error 500

**Causa**: Excepción no manejada en el servidor

**Solución**:
- Verificar logs del servidor
- Asegurar formato JSON esperado
- Validar datos de Supabase

## Seguridad

### Validación de Webhook

Green API no firma los webhooks. Para seguridad adicional:

1. **IP Whitelist**: Solo aceptar desde IPs de Green API
2. **Token**: Implementar header personalizado
3. **Rate Limit**: Ya implementado (84 requests/minute)

### Rate Limiting

El endpoint ya tiene límite:
```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 100                    // 100 requests
});
app.use('/api/', limiter);
```

## Monitorización

### Health Check
```bash
GET https://api-virid-six-51.vercel.app/api/whatsapp/health
```

### Alertas Recomendadas

Configurar alertas si:
1. `/api/whatsapp/health` retorna error por > 5 minutos
2. Webhook retorna 5xx por > 10 requests
3. Respuesta > 10 segundos

### Logs

Ver en Vercel:
```
Analytics → Functions → /api/webhook/whatsapp
```

## Backup

Si Green API falla, configurar webhook secundario:
```
Webhook URL 2: [URL de backup]
```

---

**Nota**: Los webhooks se procesan en el orden de llegada. Green API garantiza entrega pero no orden estricto en alta concurrencia.
