#!/usr/bin/env node
/**
 * Test script para verificar Green API integration
 */

require('dotenv').config();
const axios = require('axios');

const GREEN_API_INSTANCE = process.env.GREEN_API_INSTANCE;
const GREEN_API_TOKEN = process.env.GREEN_API_TOKEN;
const GREEN_API_BASE = `https://api.green-api.com/waInstance${GREEN_API_INSTANCE}`;

async function testHealth() {
    console.log('\n=== Test 1: Health Check ===');
    try {
        const url = `${GREEN_API_BASE}/getStateInstance/${GREEN_API_TOKEN}`;
        const response = await axios.get(url, { timeout: 5000 });
        console.log('✅ Green API conectado:', response.data);
        return true;
    } catch (err) {
        console.log('❌ Error:', err.response?.data || err.message);
        return false;
    }
}

async function testQR() {
    console.log('\n=== Test 2: QR Code ===');
    try {
        const url = `${GREEN_API_BASE}/getQRCode/${GREEN_API_TOKEN}`;
        const response = await axios.get(url, { timeout: 5000 });
        console.log('✅ QR obtenido (type:', response.data.type + ')');
        if (response.data.type === 'qrCode') {
            console.log('   Ejecutar: node test-green-api.js');
        }
        return true;
    } catch (err) {
        console.log('❌ Error:', err.response?.data || err.message);
        return false;
    }
}

async function main() {
    console.log('\n🟢 Green API Integration Test');
    console.log('================================');
    console.log('Instance:', GREEN_API_INSTANCE || '❌ NO CONFIGURADO');
    console.log('Token:', GREEN_API_TOKEN ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO');

    if (!GREEN_API_INSTANCE || !GREEN_API_TOKEN) {
        console.log('\n❌ Por favor configura las variables GREEN_API_INSTANCE y GREEN_API_TOKEN en .env');
        process.exit(1);
    }

    const health = await testHealth();
    const qr = await testQR();

    console.log('\n================================');
    if (health && qr) {
        console.log('✅ Todos los tests pasaron\n');
    } else {
        console.log('⚠️  Algunos tests fallaron\n');
    }
}

if (require.main === module) {
    main();
}

module.exports = { testHealth, testQR };
