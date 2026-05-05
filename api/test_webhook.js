const axios = require('axios');

async function testWebhook() {
    try {
        const res = await axios.post('https://nexaops-ai.vercel.app/api/whatsapp', {
            object: "whatsapp_business_account",
            entry: [{
                id: "12345",
                changes: [{
                    value: {
                        messaging_product: "whatsapp",
                        metadata: {
                            display_phone_number: "15556342027",
                            phone_number_id: "1107843959074490"
                        },
                        messages: [{
                            from: "584121146391",
                            id: "wamid.123",
                            timestamp: "123",
                            text: { body: "Hola" },
                            type: "text"
                        }]
                    },
                    field: "messages"
                }]
            }]
        });
        console.log('Webhook Status:', res.status, res.data);
    } catch (e) {
        console.error('Webhook Error:', e.response?.status, e.response?.data);
    }
}

testWebhook();
