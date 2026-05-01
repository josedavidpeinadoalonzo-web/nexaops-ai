require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const { z } = require('zod');
const axios = require('axios');

const app = express();

// ==================== GREEN API CONFIG ====================
const GREEN_API_INSTANCE = process.env.GREEN_API_INSTANCE || '';
const GREEN_API_TOKEN = process.env.GREEN_API_TOKEN || '';
const GREEN_API_BASE = `https://api.green-api.com/waInstance${GREEN_API_INSTANCE}`;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-haiku';
const WHATSAPP_BOT_AGENT_NAME = 'Bot Manager WhatsApp';
const WHATSAPP_BOT_CONFIG_KIND = 'whatsapp-bot-config';
const DEFAULT_WHATSAPP_BOT_CONFIG = {
    mode: 'rules',
    systemPrompt: [
        'Eres el asistente oficial de WhatsApp de NexaOps AI.',
        'Tu trabajo es ayudar a clientes actuales a consultar el estado de sus proyectos y pedir soporte.',
        'Si el usuario no esta registrado, indicale con claridad como contactar al equipo humano.',
        'Responde siempre en espanol, con mensajes cortos, claros y accionables.',
        'No inventes estados, precios ni plazos.',
        'Si no tienes suficiente contexto, deriva a soporte humano.'
    ].join(' '),
    replies: {
        unregistered: 'Hola. Soy el asistente de NexaOps AI.\n\nNo encontramos tu numero en el sistema.\n\nVisita: https://nexaops-ai.vercel.app\nO escribe CONTACTAR para hablar con un agente.',
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

async function generateOpenRouterWhatsAppReply({ incomingMsg, client, projects, portalLink, config }) {
    if (!OPENROUTER_API_KEY || config.mode === 'rules') {
        return null;
    }

    try {
        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: OPENROUTER_MODEL,
                temperature: 0.2,
                max_tokens: 280,
                messages: [
                    {
                        role: 'system',
                        content: config.systemPrompt
                    },
                    {
                        role: 'user',
                        content: JSON.stringify({
                            channel: 'whatsapp',
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
                timeout: 12000,
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
        const messageData = body.body || body;
        const textMessage = messageData.textMessageData?.textMessage || '';
        const chatId = messageData.senderData?.chatId || '';
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

        const reply = await buildWAReply(incomingMsg, chatId);
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
app.post('/api/whatsapp', async (req, res) => {
    const body = req.body;
    
    // Responder inmediatamente a Meta con 200 OK para evitar reintentos
    res.sendStatus(200);

    if (body.object) {
        if (body.entry && body.entry[0].changes && body.entry[0].changes[0] && body.entry[0].changes[0].value.messages && body.entry[0].changes[0].value.messages[0]) {
            const phoneNumberId = body.entry[0].changes[0].value.metadata.phone_number_id;
            const from = body.entry[0].changes[0].value.messages[0].from; // sender phone number
            const msgBody = body.entry[0].changes[0].value.messages[0].text?.body || '';

            console.log('Meta API Message received:', { from, msgBody });
            
            if (!msgBody) return;

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

async function buildWAReply(incomingMsg, chatId) {
    const bot = await getActiveWhatsAppBotConfig();
    const config = bot.config;
    const client = await findClientByChatId(chatId);
    if (!client) {
        return renderTemplate(config.replies.unregistered, {
            portalLink: 'https://nexaops-ai.vercel.app'
        });
    }

    const projects = await getClientProjects(client.id);
    const portalLink = PORTAL_BASE + client.id;
    const templateContext = {
        clientName: client.name,
        portalLink,
        projectsSummary: summarizeProjects(projects)
    };

    if (config.mode === 'ai') {
        const aiReply = await generateOpenRouterWhatsAppReply({
            incomingMsg,
            client,
            projects,
            portalLink,
            config
        });

        if (aiReply) return aiReply;
    }

    if (['hola', 'hi', 'help', 'menu', '1', 'estado', 'proyecto', 'progreso'].some((kw) => incomingMsg.includes(kw))) {
        return renderTemplate(config.replies.status, templateContext);
    }

    if (['soporte', 'ayuda', 'contactar', '2'].some((kw) => incomingMsg.includes(kw))) {
        return renderTemplate(config.replies.support, templateContext);
    }

    if (config.mode === 'hybrid') {
        const aiReply = await generateOpenRouterWhatsAppReply({
            incomingMsg,
            client,
            projects,
            portalLink,
            config
        });

        if (aiReply) return aiReply;
    }

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
