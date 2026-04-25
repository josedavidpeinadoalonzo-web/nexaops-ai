#!/usr/bin/env node
/**
 * Setup Wizard para Green API WhatsApp
 * 
 * Este script guía la configuración inicial:
 * 1. Test de conexión
 * 2. Obtener QR code
 * 3. Verificar estado
 */

require('dotenv').config();
const axios = require('axios');
const GREEN_API_INSTANCE = process.env.GREEN_API_INSTANCE;
const GREEN_API_TOKEN = process.env.GREEN_API_TOKEN;
const GREEN_API_BASE = `https://api.green-api.com/waInstance${GREEN_API_INSTANCE}`;

console.log('\n🔧 Green API WhatsApp Setup Wizard');
console.log('===================================\n');

// Paso 0: Validar configuración
if (!GREEN_API_INSTANCE || !GREEN_API_TOKEN) {
    console.log('❌ Faltan credenciales de Green API\n');
    console.log('Por favor configura las variables en api/.env:');
    console.log('  GREEN_API_INSTANCE=1234567890');
    console.log('  GREEN_API_TOKEN=abcdefghijklmnop\n');
    console.log('Obtén estas credenciales en: https://console.green-api.com/\n');
    process.exit(1);
}

console.log('✅ Credenciales detectadas');
console.log('   Instance:', GREEN_API_INSTANCE);
console.log('   Token:    [configurado]\n');

async function checkHealth() {
    console.log('📡 Testeando conexión a Green API...');
    try {
        const url = `${GREEN_API_BASE}/getStateInstance/${GREEN_API_TOKEN}`;
        const response = await axios.get(url, { timeout: 5000 });
        const state = response.data.stateInstance;
        console.log('   Estado:', state);
        console.log('   ✅ Conexión exitosa\n');
        return state;
    } catch (err) {
        console.log('   ❌ Error:', err.response?.data?.error || err.message);
        return null;
    }
}

async function getQRCode() {
    console.log('📱 Obteniendo QR Code...');
    try {
        const url = `${GREEN_API_BASE}/getQRCode/${GREEN_API_TOKEN}`;
        const response = await axios.get(url, { timeout: 5000 });
        const { type, message, urlCode } = response.data;
        
        if (type === 'qrCode') {
            console.log('   Estado: QR generado correctamente\n');
            console.log('   Escanea este código con tu WhatsApp:');
            console.log('   URL:', urlCode);
            console.log('\n   O abre esta URL en el navegador:');
            console.log('   ' + urlCode + '\n');
        } else {
            console.log('   Estado:', type);
            console.log('   Mensaje:', message, '\n');
        }
        
        return type;
    } catch (err) {
        console.log('   ❌ Error:', err.response?.data?.error || err.message);
        return null;
    }
}

async function waitForConnection(maxAttempts = 30) {
    console.log('⏳ Esperando conexión de WhatsApp...');
    console.log('   (Esto puede tomar hasta 2 minutos)\n');
    
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const url = `${GREEN_API_BASE}/getStateInstance/${GREEN_API_TOKEN}`;
            const response = await axios.get(url, { timeout: 5000 });
            const state = response.data.stateInstance;
            
            if (state === 'authorized') {
                console.log('   ✅ WhatsApp conectado correctamente!');
                console.log('   Estado:', state, '\n');
                return true;
            }
            
            process.stdout.write(`   Intento ${i + 1}/${maxAttempts}: estado = ${state}\r`);
        } catch (err) {
            process.stdout.write(`   Intento ${i + 1}/${maxAttempts}: error\r`);
        }
        
        await new Promise(r => setTimeout(r, 4000));
    }
    
    console.log('\n   ⚠️  Timeout esperando conexión\n');
    return false;
}

async function main() {
    console.log('Paso 1: Verificar conexión\n');
    const state = await checkHealth();
    
    if (!state) {
        console.log('No se pudo conectar a Green API');
        console.log('Verifica tus credenciales y reintenta.\n');
        process.exit(1);
    }
    
    console.log('Paso 2: Obtener QR Code\n');
    const qrType = await getQRCode();
    
    if (qrType === 'qrCode') {
        console.log('Paso 3: Conectar WhatsApp\n');
        const connected = await waitForConnection();
        
        if (connected) {
            console.log('=================================');
            console.log('✅ SETUP COMPLETADO');
            console.log('=================================');
            console.log('\nTu WhatsApp está conectado y listo');
            console.log('para recibir mensajes.\n');
            console.log('Prueba enviar un mensaje a tu número');
            console.log('de WhatsApp.\n');
            process.exit(0);
        } else {
            console.log('⚠️  No se pudo conectar WhatsApp');
            console.log('Revisa los pasos y reintenta.\n');
            process.exit(1);
        }
    } else if (qrType === 'authorized') {
        console.log('✅ WhatsApp ya está conectado!\n');
        process.exit(0);
    } else {
        console.log('⚠️  Estado inesperado:', qrType);
        console.log('Revisa tu configuración.\n');
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { checkHealth, getQRCode, waitForConnection };
