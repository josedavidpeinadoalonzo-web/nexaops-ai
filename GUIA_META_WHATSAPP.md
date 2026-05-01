# Guía de Configuración: Webhook de Meta WhatsApp Cloud API

Sigue estos pasos para conectar tu número de WhatsApp directamente a tu código en Vercel, permitiendo que la IA (OpenRouter / Google Studio AI) responda automáticamente.

## 1. Credenciales ya configuradas
Ya he agregado tus credenciales (Token y Phone ID) al archivo `.env` de tu proyecto local para que el entorno de desarrollo ya lo tenga integrado.

## 2. Despliega tu código en Vercel
Antes de conectar Meta de forma definitiva, asegúrate de que tu servidor esté subido en Vercel con el código que acabamos de crear (la ruta `/api/whatsapp`).
1. Haz *commit y push* de tus cambios a GitHub.
2. Vercel se actualizará automáticamente.
3. **Paso crítico:** Asegúrate de copiar las variables de tu `.env` (incluyendo `META_WHATSAPP_TOKEN`, `META_PHONE_ID`, `META_VERIFY_TOKEN` y `OPENROUTER_API_KEY`) en el panel de **Vercel -> Settings -> Environment Variables**.

## 3. Configurar el Webhook en Meta for Developers

1. Ve a tu panel en [Meta for Developers](https://developers.facebook.com/).
2. Selecciona tu aplicación y en el menú lateral izquierdo ve a **WhatsApp > Configuración (Configuration)**.
3. En la sección de **Webhook**, haz clic en el botón **Editar**.
4. Aparecerá una ventana modal. Llena los datos exactamente así:
   - **URL de devolución de llamada (Callback URL):** `https://TU-DOMINIO-DE-VERCEL.vercel.app/api/whatsapp` *(Cambia esto por el dominio real de tu backend en Vercel).*
   - **Token de verificación (Verify Token):** `nexaops_meta_secret_2026`
5. Haz clic en **Verificar y Guardar**. *(Meta intentará comunicarse con tu servidor Vercel mediante una petición GET. Como ya creamos el código, la verificación será exitosa al instante).*

## 4. Suscribir tu Número a los Mensajes
1. En esa misma página de Meta, debajo de donde configuraste el Webhook, verás la sección **Campos del Webhook (Webhook fields)**.
2. Haz clic en **Administrar (Manage)**.
3. Aparecerá una lista. Busca la fila que dice **`messages`** y dale clic en **Suscribirse (Subscribe)**.
4. ¡Perfecto! Esto autoriza a Meta a enviar los mensajes entrantes de los clientes a tu código.

## 5. ¡Prueba la magia!
Ve a tu Landing Page (`index.html`), haz clic en el nuevo botón flotante de WhatsApp y envía el texto. Tu servidor recibirá el evento, validará en Supabase, conectará con la Inteligencia Artificial (mediante tu API de OpenRouter) y el bot te responderá nativamente en WhatsApp en unos segundos.
