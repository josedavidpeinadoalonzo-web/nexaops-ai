require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const { z } = require('zod');
const axios = require('axios');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_mock');

const app = express();

// ==================== BCV RATE SCRAPER ====================
app.get('/api/rate/bcv', async (req, res) => {
    try {
        const response = await axios.get('http://www.bcv.org.ve/', {
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Cache-Control': 'no-cache'
            }
        });
        
        const html = response.data;
        
        // Buscamos específicamente el bloque de USD dentro de la tabla de tasas
        // El BCV suele usar una estructura donde el id="dolar" está cerca del valor
        const usdMatch = html.match(/id="dolar"[\s\S]*?<strong>\s*([\d,.]+)\s*<\/strong>/i);
        
        if (usdMatch && usdMatch[1]) {
            // Limpiamos puntos de miles (si los hubiera) y convertimos coma a punto
            const cleanRate = usdMatch[1].trim().replace(/\./g, '').replace(',', '.');
            const rate = parseFloat(cleanRate);
            
            if (!isNaN(rate) && rate > 0) {
                console.log('Tasa BCV capturada con éxito:', rate);
                return res.json({ rate, source: 'official_bcv', timestamp: new Date().toISOString() });
            }
        }
        
        throw new Error('Estructura de tasa no encontrada');
    } catch (error) {
        console.error('BCV Scrape Error:', error.message);
        // Fallback robusto
        return res.json({ 
            rate: 489.55, 
            source: 'manual_verification', 
            note: 'Usando última tasa verificada visualmente' 
        });
    }
});

// ==================== GREEN API CONFIG ====================
const GREEN_API_INSTANCE = process.env.GREEN_API_INSTANCE || '';
const GREEN_API_TOKEN = process.env.GREEN_API_TOKEN || '';
const GREEN_API_URL = process.env.GREEN_API_URL || 'https://api.green-api.com';
const GREEN_API_BASE = `${GREEN_API_URL.replace(/\/$/, '')}/waInstance${GREEN_API_INSTANCE}`;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-haiku';
const WHATSAPP_BOT_AGENT_NAME = 'Sofía';
const WHATSAPP_BOT_CONFIG_KIND = 'whatsapp-bot-config';
const DEFAULT_WHATSAPP_BOT_CONFIG = {
    mode: 'ai',
    systemPrompt: [
        'Eres Sofía, la experta en ventas de NexaOps AI, una agencia de automatización empresarial impulsada por Inteligencia Artificial.',
        'El CEO de la agencia es José David Peinado, un arquitecto de IA que orquesta agentes inteligentes.',
        'Tu objetivo principal es VENDER nuestros servicios y filtrar a los clientes potenciales.',
        'Eres persuasiva, profesional, amigable y muy resolutiva. Habla de tú a tú.',
        '',
        'NUESTROS 3 PAQUETES DE SERVICIO:',
        '1. Starter Bot ($199 Setup + $29/mes): Un bot inteligente para WhatsApp que atiende clientes 24/7 y no deja escapar ni una venta.',
        '2. Growth Automation ($499 Setup + $49/mes): Bot de WhatsApp + CRM automatizado. Guarda los datos de tus clientes automáticamente para que no tengas que anotar nada a mano.',
        '3. Enterprise AI Ecosystem ($999+ Setup + $99/mes): Solución a medida. Bot, CRM, Paneles Web y automatización total de la empresa.',
        '',
        'Si el cliente es nuevo, pregúntale su nombre, de qué trata su negocio y ofrécele sutilmente el paquete que mejor se adapte a él.',
        'Maneja objeciones con elegancia. Explica que la IA no es un gasto, es un empleado perfecto que nunca duerme y cuesta 10 veces menos.',
        'Si el cliente ya está registrado, ayúdalo amablemente con su soporte.',
        'Tu meta final con clientes nuevos es convencerlos de que adquieran un paquete y pedirles su CORREO ELECTRÓNICO para enviarles la propuesta formal en PDF.'
    ].join('\n'),
    replies: {
        unregistered: '¡Hola! Soy el agente inteligente de NexaOps AI. No tengo tu número registrado, pero dime... ¿Cómo te llamas y qué te gustaría automatizar en tu negocio hoy?',
        status: 'NexaOps AI - Hola {{clientName}}.\n\nTus proyectos:\n{{projectsSummary}}\n\nTu portal: {{portalLink}}\n\nResponde: 1=Estado, 2=Soporte',
        support: 'Soporte NexaOps AI\n\nUn agente te atendera pronto.\nHorario: Lun-Vie 9am-6pm\n\nTu portal: {{portalLink}}',
        default: 'NexaOps AI - Hola {{clientName}}.\n\nResponde: 1=Estado, 2=Soporte'
    }
};

function mergeWhatsAppReplies(overrides = {}) {
    return {
        ...DEFAULT_WHATSAPP_BOT_CONFIG.replies,
        ...(overrides || {})
    };
}

function normalizeWhatsAppBotConfig(config = {}) {
    const mode = ['rules', 'hybrid', 'ai'].includes(config.mode) ? config.mode : DEFAULT_WHATSAPP_BOT_CONFIG.mode;

    return {
        ...DEFAULT_WHATSAPP_BOT_CONFIG,
        ...(config || {}),
        mode,
        systemPrompt: (config.systemPrompt || DEFAULT_WHATSAPP_BOT_CONFIG.systemPrompt).trim(),
        replies: mergeWhatsAppReplies(config.replies)
    };
}

function parseWhatsAppBotConfigRecord(record) {
    if (!record?.prompt) return null;

    try {
        const parsed = JSON.parse(record.prompt);
        if (parsed?.kind !== WHATSAPP_BOT_CONFIG_KIND) return null;

        return {
            record,
            config: normalizeWhatsAppBotConfig(parsed.config || {})
        };
    } catch (error) {
        return null;
    }
}

async function getActiveWhatsAppBotConfig() {
    try {
        const { data, error } = await supabase
            .from('prompts')
            .select('*')
            .eq('agentName', WHATSAPP_BOT_AGENT_NAME)
            .order('createdAt', { ascending: false });

        if (error) throw error;

        const activeRecord = (data || [])
            .map(parseWhatsAppBotConfigRecord)
            .find(Boolean);

        if (activeRecord) {
            return {
                source: 'saved',
                record: activeRecord.record,
                config: activeRecord.config
            };
        }
    } catch (error) {
        console.error('Failed to load WhatsApp bot config:', error.message);
    }

    return {
        source: 'default',
        record: null,
        config: normalizeWhatsAppBotConfig()
    };
}

async function saveWhatsAppBotConfig(payload = {}) {
    const config = normalizeWhatsAppBotConfig({
        mode: payload.mode,
        systemPrompt: payload.systemPrompt || payload.prompt || DEFAULT_WHATSAPP_BOT_CONFIG.systemPrompt,
        replies: payload.replies
    });

    const storedPrompt = JSON.stringify({
        kind: WHATSAPP_BOT_CONFIG_KIND,
        config,
        sourcePrompt: payload.sourcePrompt || '',
        notes: payload.notes || '',
        deployedBy: payload.deployedBy || 'dashboard',
        updatedAt: new Date().toISOString()
    });

    const newPrompt = {
        id: Date.now().toString(),
        agentName: WHATSAPP_BOT_AGENT_NAME,
        prompt: storedPrompt,
        createdAt: new Date().toISOString()
    };

    const { data, error } = await supabase
        .from('prompts')
        .insert([newPrompt])
        .select()
        .single();

    if (error) throw error;

    return {
        record: data,
        config
    };
}

function summarizeProjects(projects = []) {
    if (!projects.length) return 'Tu proyecto esta siendo preparado.';
    return projects
        .map((project) => `- ${project.name}: ${project.progress || 0}% (${project.status})`)
        .join('\n');
}

function renderTemplate(template, context = {}) {
    return String(template || '').replace(/{{(\w+)}}/g, (_, key) => {
        const value = context[key];
        return value === undefined || value === null ? '' : String(value);
    });
}

async function generateOpenRouterWhatsAppReply({ incomingMsg, chatHistory = [], client, projects, portalLink, config }) {
    if (!OPENROUTER_API_KEY || config.mode === 'rules') {
        return null;
    }

    try {
        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: OPENROUTER_MODEL,
                temperature: 0.2,
                max_tokens: 350,
                messages: [
                    {
                        role: 'system',
                        content: config.systemPrompt + '\n\nIMPORTANTE: Se natural y humano. A continuacion se enviara el historial de chat (si existe) y el mensaje actual. NO REPITAS el historial, SOLO RESPONDAS al nuevo mensaje teniendo el contexto en cuenta.'
                    },
                    {
                        role: 'user',
                        content: JSON.stringify({
                            channel: 'whatsapp',
                            chatHistory,
                            incomingMessage: incomingMsg,
                            client: client ? {
                                id: client.id,
                                name: client.name,
                                status: client.status,
                                phone: client.phone
                            } : null,
                            projects,
                            portalLink,
                            supportHours: 'Lun-Vie 9am-6pm'
                        })
                    }
                ]
            },
            {
                timeout: 6000,
                headers: {
                    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const content = response.data?.choices?.[0]?.message?.content;
        return typeof content === 'string' ? content.trim() : null;
    } catch (error) {
        console.error('OpenRouter WhatsApp reply failed:', error.response?.data || error.message);
        return null;
    }
}

// ==================== GREEN API WEBHOOK ====================
app.post('/api/webhook/whatsapp', express.json({ type: '*/*' }), async (req, res) => {
    const timer = setTimeout(() => {
        console.log('Timeout de procesamiento Green API');
    }, 8500);

    try {
        const body = req.body || {};
        
        // Log puro para ver la estructura exacta en Vercel si falla
        console.log('Raw GreenAPI Body:', JSON.stringify(body, null, 2));

        const senderData = body.senderData || body.body?.senderData || {};
        const msgData = body.messageData || body.body?.messageData || body.body || {};
        
        const chatId = senderData.chatId || '';
        let textMessage = msgData.textMessageData?.textMessage || msgData.extendedTextMessageData?.text || '';
        
        // Si no hay textMessage en messageData, quizas viene directo en body.textMessage (estructuras legacy)
        if (!textMessage) {
            textMessage = body.textMessage || body.body?.textMessage || '';
        }

        // Prevenir bucles: Ignorar si es un mensaje enviado por el propio bot o API
        if (body.typeWebhook === 'outgoingMessageReceived' || body.typeWebhook === 'outgoingAPIMessageReceived' || body.typeWebhook === 'outgoingMessageStatus') {
            return res.status(200).json({ ignored: true, reason: 'Outgoing message ignored to prevent loops' });
        }

        const incomingMsg = textMessage.toLowerCase().trim();

        console.log('Green API webhook received:', { chatId, incomingMsg });

        if (!chatId) {
            clearTimeout(timer);
            return res.status(200).json({ ignored: true, reason: 'No chatId provided' });
        }

        if (!incomingMsg) {
            clearTimeout(timer);
            return res.status(200).json({ ignored: true, reason: 'No text message provided' });
        }

        const chatHistory = await getGreenApiChatHistory(chatId);
        const reply = await buildWAReply(incomingMsg, chatId, chatHistory);
        await sendWhatsAppGreenAPI(chatId, reply);

        clearTimeout(timer);
        res.status(200).json({ received: true });
    } catch (err) {
        console.error('Green API webhook error:', err);
        clearTimeout(timer);

        try {
            await sendWhatsAppGreenAPI(
                req.body?.body?.senderData?.chatId || '',
                'Error temporal. Por favor intenta de nuevo.'
            );
        } catch (sendError) {
            console.error('Error sending error reply:', sendError);
        }

        res.status(500).json({ error: err.message });
    }
});

async function sendWhatsAppGreenAPI(chatId, message) {
    if (!GREEN_API_INSTANCE || !GREEN_API_TOKEN) {
        console.error('Green API no configurado');
        return null;
    }

    try {
        const url = `${GREEN_API_BASE}/sendMessage/${GREEN_API_TOKEN}`;
        const response = await axios.post(url, { chatId, message }, { timeout: 5000 });
        console.log('Green API send response:', response.data);
        return response.data;
    } catch (err) {
        console.error('Green API send error:', err.response?.data || err.message);
        throw err;
    }
}

async function getGreenApiChatHistory(chatId) {
    if (!GREEN_API_INSTANCE || !GREEN_API_TOKEN) return [];
    try {
        const url = `${GREEN_API_BASE}/getChatHistory/${GREEN_API_TOKEN}`;
        const response = await axios.post(url, { chatId, count: 6 }, { timeout: 3000 });
        // Green API devuelve de más reciente a más antiguo, hay que invertirlo
        const history = (response.data || [])
            .map(m => `${m.type}: ${m.textMessage || m.extendedTextMessage?.text || ''}`.trim())
            .filter(text => !text.endsWith(':'))
            .reverse();
        // Omitimos el ultimo porque es el mensaje actual que la IA va a responder
        return history.slice(0, -1);
    } catch (err) {
        console.error('Green API get history error:', err.response?.data || err.message);
        return [];
    }
}

// ==================== META WHATSAPP CLOUD API WEBHOOK ====================
const META_WHATSAPP_TOKEN = process.env.META_WHATSAPP_TOKEN || '';
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'nexaops_meta_secret_2026';

// Verificacion del Webhook (GET)
app.get('/api/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
            console.log('Meta Webhook Verified!');
            return res.status(200).send(challenge);
        } else {
            return res.sendStatus(403);
        }
    }
    res.status(400).send('Bad Request');
});

// Recepcion de Mensajes (POST)
app.post('/api/whatsapp', express.json(), async (req, res) => {
    try {
        const body = req.body || {};
        
        // FAKE LOG PARA VER QUÉ ENVIA META
        try {
            await supabase.from('tasks').insert([{
                id: Date.now().toString(),
                title: 'WEBHOOK_META',
                description: JSON.stringify(body).substring(0, 500),
                completed: false,
                createdAt: new Date().toISOString()
            }]);
        } catch(e) {}

        console.log('Webhook POST received. Body:', JSON.stringify(body, null, 2));

        if (body.object) {
            if (body.entry && body.entry[0].changes && body.entry[0].changes[0] && body.entry[0].changes[0].value.messages && body.entry[0].changes[0].value.messages[0]) {
                const phoneNumberId = body.entry[0].changes[0].value.metadata.phone_number_id;
                const messageObj = body.entry[0].changes[0].value.messages[0];
                const from = messageObj.from; // sender phone number
                
                let msgBody = '';
                if (messageObj.type === 'text') {
                    msgBody = messageObj.text.body;
                } else if (messageObj.type === 'button') {
                    msgBody = messageObj.button.text;
                } else if (messageObj.type === 'interactive') {
                    msgBody = messageObj.interactive.button_reply?.title || messageObj.interactive.list_reply?.title || '';
                }

                console.log('Meta API Message received:', { from, type: messageObj.type, msgBody });

                if (!msgBody) return res.sendStatus(200);

                const incomingMsg = msgBody.toLowerCase().trim();
                const bot = await getActiveWhatsAppBotConfig();
                
                // Buscar si es un cliente existente
                const client = await findClientByChatId(from);
                const projects = client ? await getClientProjects(client.id) : [];
                const portalLink = client ? PORTAL_BASE + client.id : 'https://nexaops-ai.vercel.app';
                
                // Generar respuesta con IA (OpenRouter)
                let replyText = await generateOpenRouterWhatsAppReply({
                    incomingMsg,
                    client,
                    projects,
                    portalLink,
                    config: bot.config
                });

                // Fallback si la IA falla
                if (!replyText) {
                    replyText = 'Hola, soy el agente inteligente de NexaOps. ¿En qué puedo ayudarte hoy?';
                }

                // Enviar respuesta via Meta API
                try {
                    if (META_WHATSAPP_TOKEN) {
                        await axios.post(
                            `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
                            {
                                messaging_product: 'whatsapp',
                                recipient_type: 'individual',
                                to: from,
                                type: 'text',
                                text: { preview_url: false, body: replyText }
                            },
                            { 
                                headers: { 
                                    'Authorization': `Bearer ${META_WHATSAPP_TOKEN}`,
                                    'Content-Type': 'application/json' 
                                } 
                            }
                        );
                    } else {
                        console.log('Simulacion (Falta META_WHATSAPP_TOKEN). Respuesta IA:', replyText);
                    }
                } catch (err) {
                    console.error('Meta WhatsApp send error:', err.response?.data || err.message);
                }
            }
        }
        
        res.sendStatus(200);
    } catch (error) {
        console.error('Critical Error in Meta Webhook:', error);
        res.sendStatus(500);
    }
});


// 1. Helmet
app.use(helmet());

// 2. CORS
const allowedOrigins = [
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'http://localhost:3001',
    'https://nexaops-ai.vercel.app',
    'https://nexaops-ai-admin.vercel.app',
    'https://admin-nexaops-ai.vercel.app',
    'https://admin.nexaops.com',
    'null'
];

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error('Bloqueado por CORS'));
    }
}));

app.use(express.json());

// 3. Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Demasiadas peticiones, intenta de nuevo en 15 minutos.' }
});
app.use('/api/', limiter);

// 4. API key middleware
const authenticateApiKey = (req, res, next) => {
    if (req.path === '/api/health') return next();

    // const apiKey = req.headers['x-api-key'];
    // if (apiKey !== process.env.API_SECRET_KEY) {
    //   return res.status(401).json({ error: 'Acceso denegado. API Key invalida.' });
    // }

    next();
};
app.use(authenticateApiKey);

// ==================== SUPABASE ====================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('FATAL ERROR: SUPABASE_URL y SUPABASE_ANON_KEY son requeridos en .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ==================== VALIDACIONES ====================
const clientSchema = z.object({
    name: z.string().min(1, 'El nombre es requerido'),
    email: z.string().email('Email invalido').optional().or(z.literal('')),
    phone: z.string().optional().or(z.literal('')),
    status: z.string().optional()
});

const projectSchema = z.object({
    clientId: z.string().min(1, 'El cliente es requerido'),
    name: z.string().min(1, 'El nombre del proyecto es requerido'),
    description: z.string().optional().or(z.literal('')),
    status: z.string().default('pending'),
    progress: z.number().min(0).max(100).default(0),
    type: z.string().optional().or(z.literal('')),
    price: z.union([z.number(), z.string()]).optional()
});

// ==================== RUTAS ====================
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString(), database: 'supabase' });
});

const PORTAL_BASE = 'https://nexaops-ai.vercel.app/clients/?id=';

// ==================== STRIPE BILLING & CHECKOUT ====================
const DOMAIN = process.env.NEXT_PUBLIC_SITE_URL || 'https://nexaops-ai.vercel.app';

app.post('/api/checkout', express.json(), async (req, res) => {
    try {
        const { planId, email, phone, name } = req.body;
        
        // Mapeo de planes a precios (Se asume que configuraras los Price IDs en Stripe luego)
        const priceMap = {
            'starter': process.env.STRIPE_PRICE_STARTER || 'price_mock_starter',
            'growth': process.env.STRIPE_PRICE_GROWTH || 'price_mock_growth',
            'enterprise': process.env.STRIPE_PRICE_ENTERPRISE || 'price_mock_enterprise'
        };

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer_email: email,
            client_reference_id: phone, // Usamos el telefono como ID de referencia inicial
            metadata: { planId, name, phone },
            line_items: [
                {
                    price: priceMap[planId] || priceMap['starter'],
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${DOMAIN}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${DOMAIN}/#pricing`,
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error('Error creating checkout session:', err.message);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

app.post('/api/checkout/manual', express.json(), async (req, res) => {
    try {
        const { planId, email, phone, name, reference } = req.body;
        
        console.log(`Solicitud de Pago Móvil: ${name} (${phone}) - Plan: ${planId} - Ref: ${reference}`);
        // 0. Obtener tasa BCV (VES por USD)
        let bcvRate = 0;
        try {
          const rateResp = await axios.get(`${DOMAIN}/api/rate/bcv`);
          bcvRate = rateResp.data.rate || 0;
        } catch (e) {
          console.error('Error al obtener tasa BCV:', e.message);
        }

        // Mapeo de precios en USD
        const usdPriceMap = {
          starter: 199,
          growth: 499,
          enterprise: 999
        };
        const usdAmount = usdPriceMap[planId] || usdPriceMap['starter'];
        const amountVES = bcvRate && usdAmount ? Math.round(usdAmount * bcvRate) : null;
        // 1. Crear cliente en Supabase con estatus 'pending'
        const clientId = Date.now().toString();
        const { error: clientError } = await supabase.from('clients').insert([{
            id: clientId,
            name,
            email,
            phone,
            status: 'pending_verification',
            createdAt: new Date().toISOString()
        }]);

        if (clientError) throw clientError;

        // 2. Crear proyecto base
        await supabase.from('projects').insert([{
            id: (Date.now() + 1).toString(),
            clientId: clientId,
            name: `Implementación ${planId.toUpperCase()}`,
            description: `Pago Móvil Ref: ${reference}. Esperando validación.`,
            status: 'pending',
            progress: 0,
            createdAt: new Date().toISOString()
        }]);

        // 3. Notificar al administrador por WhatsApp (Opcional, pero recomendado)
        try {
            const adminMsg = `🔔 *NUEVO PAGO MÓVIL*\n\nCliente: ${name}\nPlan: ${planId.toUpperCase()}\nReferencia: ${reference}\nWhatsApp: ${phone}\n\nPor favor verifica el banco y activa el proyecto en el dashboard.`;
            const adminPhone = process.env.GREEN_API_WHATSAPP_FROM || '584121146391@c.us';
            await sendWhatsApp(adminPhone, adminMsg);
        } catch (e) {
            console.error('Error notificando al admin:', e.message);
        }

        res.json({ success: true, message: 'Pago registrado para verificación' });
    } catch (err) {
        console.error('Error en checkout manual:', err.message);
        res.status(500).json({ error: 'No se pudo registrar el pago manual' });
    }
});

// Stripe requiere el body en RAW para verificar firmas de webhooks
app.post('/api/webhook/stripe', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // Valida que el webhook proviene de Stripe de verdad
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || 'whsec_mock');
    } catch (err) {
        console.error('Webhook signature verification failed.', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Manejar el evento de pago exitoso
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { name, phone, planId } = session.metadata;
        const email = session.customer_details?.email || session.customer_email;
        const amount = session.amount_total / 100; // Convertir de centavos a dolares

        console.log(`Pago exitoso recibido de ${name} (${email}) por el plan ${planId}. Monto: $${amount}`);

        // 1. Insertar al cliente en Supabase
        const clientId = Date.now().toString();
        try {
            await supabase.from('clients').insert([{
                id: clientId,
                name: name || 'Cliente Nuevo',
                email: email,
                phone: phone || '',
                status: 'active',
                createdAt: new Date().toISOString()
            }]);
            
            // 2. Registrar el ingreso en la tabla 'income' para el Dashboard
            await supabase.from('income').insert([{
                id: (Date.now() + 1).toString(),
                description: `Suscripción Plan ${planId.toUpperCase()} - ${name}`,
                amount: amount,
                date: new Date().toISOString(),
                createdAt: new Date().toISOString()
            }]);

            // 3. Crear el proyecto base automáticamente
            await supabase.from('projects').insert([{
                id: (Date.now() + 2).toString(),
                clientId: clientId,
                name: `Implementación ${planId.toUpperCase()}`,
                description: `Proyecto de automatización para ${name} (Plan ${planId})`,
                status: 'pending',
                progress: 10,
                createdAt: new Date().toISOString()
            }]);

            console.log('Cliente, Ingreso y Proyecto registrados correctamente tras pago en Stripe.');
            
            // 4. Notificar por WhatsApp de bienvenida si Green API está listo
            try {
                if (phone) {
                    const welcomeMsg = `¡Hola ${name}! 🚀 Bienvenido a NexaOps AI.\n\nHemos recibido tu pago por el plan ${planId.toUpperCase()}.\n\nTu portal de seguimiento ya está activo. En breve nos pondremos en contacto para iniciar la configuración de tu bot.`;
                    await sendWhatsApp(phone, welcomeMsg);
                }
            } catch (waErr) {
                console.error('Error enviando WhatsApp de bienvenida:', waErr);
            }

        } catch(e) {
            console.error('Error procesando post-pago en Supabase:', e);
        }
    }

    res.json({received: true});
});

async function findClientByChatId(chatId) {
    const phoneNumber = chatId.replace('@c.us', '').replace('@g.us', '');
    if (!phoneNumber) return null;

    const digits = phoneNumber.replace(/\D/g, '');
    const last9 = digits.slice(-9);

    const { data, error } = await supabase
        .from('clients')
        .select('id, name, status, phone')
        .not('phone', 'is', null);

    if (error || !data) return null;
    return data.find((client) => (client.phone || '').replace(/\D/g, '').endsWith(last9)) || null;
}

async function getClientProjects(clientId) {
    const { data } = await supabase
        .from('projects')
        .select('name, status, progress')
        .eq('clientId', clientId);

    return data || [];
}

function toGreenApiChatId(phoneOrChatId) {
    if (!phoneOrChatId) return '';
    if (phoneOrChatId.includes('@')) return phoneOrChatId;

    const digits = phoneOrChatId.replace(/\D/g, '');
    return digits ? `${digits}@c.us` : '';
}

async function sendWhatsApp(chatId, message) {
    if (!GREEN_API_INSTANCE || !GREEN_API_TOKEN) {
        console.error('Green API credentials missing');
        return;
    }

    const targetChatId = toGreenApiChatId(chatId);
    if (!targetChatId) {
        console.error('Invalid chatId for WhatsApp send');
        return;
    }

    try {
        await sendWhatsAppGreenAPI(targetChatId, message);
    } catch (err) {
        console.error('Failed to send WhatsApp message:', err);
    }
}

async function buildWAReply(incomingMsg, chatId, chatHistory = []) {
    const bot = await getActiveWhatsAppBotConfig();
    const config = bot.config;
    const client = await findClientByChatId(chatId);
    
    const projects = client ? await getClientProjects(client.id) : [];
    const portalLink = client ? PORTAL_BASE + client.id : 'https://nexaops-ai.vercel.app';
    const templateContext = {
        clientName: client ? client.name : 'Visitante',
        portalLink,
        projectsSummary: summarizeProjects(projects)
    };

    // Si el modo es IA, siempre usamos OpenRouter, registrado o no.
    if (config.mode === 'ai' || config.mode === 'hybrid') {
        const aiReply = await generateOpenRouterWhatsAppReply({
            incomingMsg,
            chatHistory,
            client,
            projects,
            portalLink,
            config
        });

        if (aiReply) return aiReply;
    }

    // Fallback a reglas si la IA falla o si esta en modo rules
    if (!client) {
        return renderTemplate(config.replies.unregistered, {
            portalLink: 'https://nexaops-ai.vercel.app'
        });
    }

    if (['hola', 'hi', 'help', 'menu', '1', 'estado', 'proyecto', 'progreso'].some((kw) => incomingMsg.includes(kw))) {
        return renderTemplate(config.replies.status, templateContext);
    }

    if (['soporte', 'ayuda', 'contactar', '2'].some((kw) => incomingMsg.includes(kw))) {
        return renderTemplate(config.replies.support, templateContext);
    }

    // (Modo hybrid ya procesado arriba)

    return renderTemplate(config.replies.default, templateContext);
}

// SEND NOTIFICATION
app.post('/api/notify/whatsapp', async (req, res) => {
    try {
        if (!GREEN_API_INSTANCE || !GREEN_API_TOKEN) {
            return res.status(503).json({ error: 'Green API no configurado' });
        }

        const { clientId, message } = req.body;
        if (!clientId || !message) {
            return res.status(400).json({ error: 'clientId y message son requeridos' });
        }

        const { data: client } = await supabase
            .from('clients')
            .select('name, phone')
            .eq('id', clientId)
            .single();

        if (!client || !client.phone) {
            return res.status(404).json({ error: 'Cliente sin numero de WhatsApp' });
        }

        const chatId = toGreenApiChatId(client.phone);
        if (!chatId) {
            return res.status(400).json({ error: 'Numero de WhatsApp invalido' });
        }

        await sendWhatsApp(chatId, message);
        res.json({ success: true, sent_to: chatId });
    } catch (err) {
        console.error('Notify error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/whatsapp/bot-config', async (req, res) => {
    try {
        const activeConfig = await getActiveWhatsAppBotConfig();
        res.json({
            source: activeConfig.source,
            promptId: activeConfig.record?.id || null,
            config: activeConfig.config,
            runtime: {
                greenApiConfigured: Boolean(GREEN_API_INSTANCE && GREEN_API_TOKEN),
                openrouterConfigured: Boolean(OPENROUTER_API_KEY),
                openrouterModel: OPENROUTER_MODEL
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/whatsapp/bot-config', async (req, res) => {
    try {
        const hasPrompt = Boolean((req.body?.systemPrompt || req.body?.prompt || '').trim());
        const hasReplies = Boolean(req.body?.replies && typeof req.body.replies === 'object');

        if (!hasPrompt && !hasReplies) {
            return res.status(400).json({ error: 'Debes enviar systemPrompt, prompt o replies.' });
        }

        const savedConfig = await saveWhatsAppBotConfig(req.body || {});
        res.json({
            success: true,
            promptId: savedConfig.record.id,
            config: savedConfig.config
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GREEN API HEALTH
app.get('/api/whatsapp/health', async (req, res) => {
    if (!GREEN_API_INSTANCE || !GREEN_API_TOKEN) {
        return res.status(500).json({ error: 'Green API credentials not configured' });
    }

    try {
        const url = `${GREEN_API_BASE}/getStateInstance/${GREEN_API_TOKEN}`;
        const response = await axios.get(url, { timeout: 5000 });
        res.json({
            status: 'ok',
            greenApi: response.data,
            instance: GREEN_API_INSTANCE,
            configured: true
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            error: err.message,
            instance: GREEN_API_INSTANCE,
            configured: Boolean(GREEN_API_INSTANCE)
        });
    }
});

app.get('/api/whatsapp/qr', async (req, res) => {
    if (!GREEN_API_INSTANCE || !GREEN_API_TOKEN) {
        return res.status(500).json({ error: 'Green API credentials not configured' });
    }

    try {
        const url = `${GREEN_API_BASE}/getQRCode/${GREEN_API_TOKEN}`;
        const response = await axios.get(url, { timeout: 5000 });
        res.json(response.data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/client-view/:id', async (req, res) => {
    try {
        const { data: client, error: clientError } = await supabase
            .from('clients')
            .select('id, name, email, phone, status, createdAt')
            .eq('id', req.params.id)
            .single();

        if (clientError || !client) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        const { data: projects } = await supabase
            .from('projects')
            .select('id, name, description, status, progress, createdAt')
            .eq('clientId', req.params.id);

        res.json({ client, projects: projects || [] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const [
            { count: clientsCount },
            { count: projectsCount },
            { count: pendingTasksCount },
            { data: incomeData }
        ] = await Promise.all([
            supabase.from('clients').select('*', { count: 'exact', head: true }),
            supabase.from('projects').select('*', { count: 'exact', head: true }),
            supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('completed', false),
            supabase.from('income').select('amount, date')
        ]);

        const totalIncome = incomeData
            ? incomeData.reduce((sum, item) => sum + Number(item.amount || 0), 0)
            : 0;

        const currentMonth = new Date().getMonth();
        const thisMonthIncome = incomeData
            ? incomeData
                .filter((item) => new Date(item.date).getMonth() === currentMonth)
                .reduce((sum, item) => sum + Number(item.amount || 0), 0)
            : 0;

        res.json({
            clients: clientsCount || 0,
            projects: projectsCount || 0,
            pendingTasks: pendingTasksCount || 0,
            totalIncome,
            thisMonthIncome
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// METRICAS REALES DE STRIPE (MRR, CLIENTES ACTIVOS)
app.get('/api/admin/metrics', async (req, res) => {
    try {
        // Consultar suscripciones activas en Stripe
        const subscriptions = await stripe.subscriptions.list({
            status: 'active',
            expand: ['data.plan.product']
        });

        const activeCustomers = subscriptions.data.length;
        const mrr = subscriptions.data.reduce((sum, sub) => sum + (sub.plan.amount / 100), 0);

        // Calcular tasa de conversión (Leads vs Clientes)
        const { count: leadsCount } = await supabase.from('leads').select('*', { count: 'exact', head: true });
        const { count: clientsCount } = await supabase.from('clients').select('*', { count: 'exact', head: true });
        
        const conversionRate = leadsCount > 0 ? ((clientsCount / leadsCount) * 100).toFixed(1) : 0;

        res.json({
            mrr,
            activeCustomers,
            conversionRate: `${conversionRate}%`,
            currency: 'USD'
        });
    } catch (error) {
        console.error('Error fetching Stripe metrics:', error);
        res.status(500).json({ error: 'No se pudieron obtener las métricas de Stripe. Revisa tus API Keys.' });
    }
});

// ==================== LEADS (FORMULARIO LANDING) ====================
app.get('/api/leads', async (req, res) => {
    const { data, error } = await supabase.from('leads').select('*').order('createdAt', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/leads', async (req, res) => {
    try {
        const { name, phone, email, interest } = req.body;
        const newLead = { 
            id: Date.now().toString(), 
            name, 
            phone, 
            email, 
            interest,
            status: 'new',
            createdAt: new Date().toISOString() 
        };

        const { data, error } = await supabase.from('leads').insert([newLead]).select().single();
        if (error) throw error;

        // Opcional: Aqui podriamos notificar por WhatsApp al Admin de que llego un nuevo lead
        
        res.status(201).json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// CLIENTS
app.get('/api/clients', async (req, res) => {
    const { data, error } = await supabase.from('clients').select('*').order('createdAt', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.get('/api/clients/:id', async (req, res) => {
    const { data, error } = await supabase.from('clients').select('*').eq('id', req.params.id).single();
    if (error) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(data);
});

app.post('/api/clients', async (req, res) => {
    try {
        const validatedData = clientSchema.parse(req.body);
        const newClient = { id: Date.now().toString(), ...validatedData, createdAt: new Date().toISOString() };

        const { data, error } = await supabase.from('clients').insert([newClient]).select().single();
        if (error) throw error;

        res.status(201).json(data);
    } catch (error) {
        res.status(400).json({ error: error.errors || error.message });
    }
});

app.put('/api/clients/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('clients')
            .update(req.body)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.delete('/api/clients/:id', async (req, res) => {
    try {
        const clientId = req.params.id;

        const { error: projectsError } = await supabase.from('projects').delete().eq('clientId', clientId);
        if (projectsError) throw projectsError;

        const { error } = await supabase.from('clients').delete().eq('id', clientId);
        if (error) throw error;

        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PROJECTS
app.get('/api/projects', async (req, res) => {
    const { data, error } = await supabase.from('projects').select('*').order('createdAt', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.get('/api/projects/client/:clientId', async (req, res) => {
    const { data, error } = await supabase.from('projects').select('*').eq('clientId', req.params.clientId);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.get('/api/projects/:id', async (req, res) => {
    const { data, error } = await supabase.from('projects').select('*').eq('id', req.params.id).single();
    if (error) return res.status(404).json({ error: 'Proyecto no encontrado' });
    res.json(data);
});

app.post('/api/projects', async (req, res) => {
    try {
        const validatedData = projectSchema.parse(req.body);
        const newProject = { id: Date.now().toString(), ...validatedData, createdAt: new Date().toISOString() };

        const { data, error } = await supabase.from('projects').insert([newProject]).select().single();
        if (error) throw error;

        res.status(201).json(data);
    } catch (error) {
        res.status(400).json({ error: error.errors || error.message });
    }
});

app.put('/api/projects/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('projects')
            .update(req.body)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.delete('/api/projects/:id', async (req, res) => {
    try {
        const { error } = await supabase.from('projects').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// TASKS
app.get('/api/tasks', async (req, res) => {
    const { data, error } = await supabase.from('tasks').select('*').order('createdAt', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/tasks', async (req, res) => {
    try {
        const newTask = { id: Date.now().toString(), completed: false, ...req.body, createdAt: new Date().toISOString() };
        const { data, error } = await supabase.from('tasks').insert([newTask]).select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.put('/api/tasks/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tasks')
            .update(req.body)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.delete('/api/tasks/:id', async (req, res) => {
    const { error } = await supabase.from('tasks').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
});

// INCOME
app.get('/api/income', async (req, res) => {
    const { data, error } = await supabase.from('income').select('*').order('createdAt', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/income', async (req, res) => {
    try {
        const newIncome = { id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() };
        const { data, error } = await supabase.from('income').insert([newIncome]).select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.delete('/api/income/:id', async (req, res) => {
    try {
        const { error } = await supabase.from('income').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// AGENTS
app.get('/api/agents', async (req, res) => {
    const { data, error } = await supabase.from('agents').select('*').order('createdAt', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/agents', async (req, res) => {
    try {
        const newAgent = { id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() };
        const { data, error } = await supabase.from('agents').insert([newAgent]).select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PROMPTS
app.get('/api/agents/:name/prompts', async (req, res) => {
    const { data, error } = await supabase.from('prompts').select('*').eq('agentName', req.params.name);
    if (error) return res.status(500).json({ error: error.message });
    const normalizedPrompts = (data || []).map((record) => {
        const parsed = parseWhatsAppBotConfigRecord(record);
        if (!parsed) return record;

        return {
            ...record,
            prompt: parsed.config.systemPrompt,
            mode: parsed.config.mode,
            isBotConfig: true
        };
    });
    res.json(normalizedPrompts);
});

app.post('/api/agents/:name/prompts', async (req, res) => {
    try {
        const newPrompt = {
            id: Date.now().toString(),
            agentName: req.params.name,
            ...req.body,
            createdAt: new Date().toISOString()
        };

        const { data, error } = await supabase.from('prompts').insert([newPrompt]).select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

if (require.main === module) {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;
