require('dotenv').config();
const axios = require('axios');

const INSTANCE = process.env.GREEN_API_INSTANCE;
const TOKEN = process.env.GREEN_API_TOKEN;
const BASE = `https://api.green-api.com/waInstance${INSTANCE}`;

console.log('\n🟢 Probando conexión a Green API...\n');
console.log('Instance:', INSTANCE);
console.log('Token:', TOKEN ? '[CONFIGURADO]' : '[FALTANTE]');

axios.get(`${BASE}/getStateInstance/${TOKEN}`, { timeout: 5000 })
  .then(res => {
    console.log('\n✅ Conexión exitosa!');
    console.log('Estado:', res.data.stateInstance);
    console.log('\n✅ Tu WhatsApp está conectado y listo para recibir mensajes.');
    process.exit(0);
  })
  .catch(err => {
    console.log('\n❌ Error:', err.response?.data?.error || err.message);
    process.exit(1);
  });
