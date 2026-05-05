const axios = require('axios');
require('dotenv').config({ path: './api/.env' });

const token = process.env.META_WHATSAPP_TOKEN;
const phoneId = process.env.META_PHONE_ID;
const to = '584121146391'; // User's personal number

async function testSend() {
    try {
        console.log(`Sending to ${to} via phoneId ${phoneId}...`);
        const res = await axios.post(
            `https://graph.facebook.com/v18.0/${phoneId}/messages`,
            {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to,
                type: 'text',
                text: { preview_url: false, body: 'Hola, este es un mensaje de prueba forzado desde el servidor' }
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log('Exito:', res.data);
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

testSend();
