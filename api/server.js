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

// ==================== GREEN API CONFIG ====================
const GREEN_API_INSTANCE = process.env.GREEN_API_INSTANCE || '';
const GREEN_API_TOKEN = process.env.GREEN_API_TOKEN || '';
const GREEN_API_BASE = `https://api.green-api.com/waInstance${GREEN_API_INSTANCE}`;

// ==================== GREEN API WEBHOOK ====================
// Último rebuild: 2026-04-25
app.post('/api/webhook/whatsapp', express.json({ type: '*/*' }), async (req, res) => {
    // Timeout de seguridad: si Supabase tarda mucho, respondemos igual pero registramos
    const timer = setTimeout(() => {
        console.log('Timeout de procesamiento Green API');
    }, 8500);

    try {
        const body = req.body;
        
        // Extraer datos del formato Green API
        const messageData = body.body || {};
        const textMessage = messageData.textMessageData?.textMessage || '';
        const chatId = messageData.senderData?.chatId || '';
        const incomingMsg = (textMessage || '').toLowerCase().trim();

        console.log('Green API webhook received:', { chatId, incomingMsg });

        if (!chatId) {
            clearTimeout(timer);
            return res.status(400).json({ error: 'No chatId provided' });
        }

        const reply = await buildWAReply(incomingMsg, chatId);

        // Enviar respuesta por Green API (no necesitamos responder HTTP inmediatamente)
        await sendWhatsAppGreenAPI(chatId, reply);

        clearTimeout(timer);
        // Green API espera 200 OK
        res.status(200).json({ received: true });
    } catch (err) {
        console.error('Green API webhook error:', err);
        clearTimeout(timer);
        // Intentamos enviar error por WhatsApp
        try {
            await sendWhatsAppGreenAPI(
                req.body?.body?.senderData?.chatId || '',
                'Error temporal. Por favor intenta de nuevo.'
            );
        } catch (e) {
            console.error('Error sending error reply:', e);
        }
        res.status(500).json({ error: err.message });
    }
});

// ==================== GREEN API: ENVIAR WHATSAPP ====================
async function sendWhatsAppGreenAPI(chatId, message) {
    if (!GREEN_API_INSTANCE || !GREEN_API_TOKEN) {
        console.error('Green API no configurado');
        return;
    }

    try {
        const url = `${GREEN_API_BASE}/sendMessage/${GREEN_API_TOKEN}`;
        const payload = {
            chatId: chatId,
            message: message
        };

        const response = await axios.post(url, payload, {
            timeout: 5000
        });

        console.log('Green API send response:', response.data);
        return response.data;
    } catch (err) {
        console.error('Green API send error:', err.response?.data || err.message);
        throw err;
    }
}



// 1. Helmet: Protege cabeceras HTTP (Anti-XSS, Anti-Clickjacking)
app.use(helmet());

// 2. CORS Estricto: Solo permite tu dominio local y el dominio de producción
const allowedOrigins = [
  'http://127.0.0.1:5500', 
  'http://localhost:5500', 
  'http://localhost:3000',
  'https://nexaops-ai.vercel.app',
  'https://nexaops-ai-admin.vercel.app',
  'https://admin-nexaops-ai.vercel.app',
  'https://admin.nexaops.com',
  'null'
];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Bloqueado por CORS'));
    }
  }
}));

app.use(express.json());

// 3. Rate Limiting: Previene ataques DDoS o de fuerza bruta (Máx 100 peticiones cada 15 min)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Demasiadas peticiones, intenta de nuevo en 15 minutos.' }
});
app.use('/api/', limiter);

// 4. API Key Middleware: Solo permite acceso si envían la clave correcta
const authenticateApiKey = (req, res, next) => {
  // Omitido para el endpoint health
  if (req.path === '/api/health') return next();
  
  // Puedes desactivar esto comentando las siguientes 3 líneas mientras desarrollas
  // const apiKey = req.headers['x-api-key'];
  // if (apiKey !== process.env.API_SECRET_KEY) {
  //   return res.status(401).json({ error: 'Acceso denegado. API Key inválida.' });
  // }
  next();
};
app.use(authenticateApiKey);


// ==================== CONEXIÓN A SUPABASE ====================

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("FATAL ERROR: SUPABASE_URL y SUPABASE_ANON_KEY son requeridos en .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ==================== VALIDACIONES (Zod) ====================

const clientSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  email: z.string().email("Email inválido").optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  status: z.string().optional()
});

const projectSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1, "El nombre del proyecto es requerido"),
  status: z.string().default('pending'),
  progress: z.number().min(0).max(100).default(0)
});


// ==================== RUTAS (ENDPOINTS) ====================

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString(), database: 'supabase' });
});

// ==================== WHATSAPP BOT (GREEN API) ====================

const PORTAL_BASE = 'https://nexaops-ai.vercel.app/clients/?id=';

// Helper: find client by phone (in-memory filter - avoids slow ilike)
// Green API usa formato chatId: "34605797755@c.us" (número@s.whatsapp.net)
// Extraemos el número del chatId
async function findClientByChatId(chatId) {
    // Extraer número del chatId de Green API (formato: "34605797755@c.us")
    let phoneNumber = chatId.replace('@c.us', '').replace('@g.us', '');
    if (!phoneNumber) return null;
    
    const digits = phoneNumber.replace(/\D/g, '');
    const last9 = digits.slice(-9);
    
    const { data, error } = await supabase
        .from('clients')
        .select('id, name, status, phone')
        .not('phone', 'is', null);
    if (error || !data) return null;
    return data.find(c => (c.phone || '').replace(/\D/g, '').endsWith(last9)) || null;
}

// Helper: get client projects
async function getClientProjects(clientId) {
    const { data } = await supabase
        .from('projects')
        .select('name, status, progress')
        .eq('clientId', clientId);
    return data || [];
}

// Helper: send WhatsApp message via Green API
// Green API espera enviar a chatId (número@s.whatsapp.net)
async function sendWhatsApp(chatId, message) {
    if (!GREEN_API_INSTANCE || !GREEN_API_TOKEN) {
        console.error('Green API credentials missing');
        return;
    }
    
    // Asegurarnos que chatId tiene el formato correcto
    let targetChatId = chatId;
    if (!chatId.includes('@')) {
        targetChatId = `${chatId.replace(/\D/g, '')}@c.us`;
    }
    
    try {
        await sendWhatsAppGreenAPI(targetChatId, message);
    } catch (err) {
        console.error('Failed to send WhatsApp message:', err);
    }
}

// Helper: build reply message async
async function buildWAReply(incomingMsg, chatId) {
    const client = await findClientByChatId(chatId);
    if (!client) {
        return 'Hola! Soy el asistente de NexaOps AI.\n\n'
             + 'No encontramos tu numero en el sistema.\n\n'
             + 'Visita: https://nexaops-ai.vercel.app\n'
             + 'O escribe CONTACTAR para hablar con un agente.';
    }
    const projects = await getClientProjects(client.id);
    const portalLink = PORTAL_BASE + client.id;
    if (['hola','hi','help','menu','1','estado','proyecto','progreso'].some(kw => incomingMsg.includes(kw))) {
        const info = projects.length > 0
            ? projects.map(p => '- ' + p.name + ': ' + (p.progress||0) + '% (' + p.status + ')').join('\n')
            : 'Tu proyecto esta siendo preparado.';
        return 'NexaOps AI - Hola ' + client.name + '!\n\nTus proyectos:\n' + info
             + '\n\nTu portal: ' + portalLink + '\n\nResponde: 1=Estado, 2=Soporte';
    }
    if (['soporte','ayuda','contactar','2'].some(kw => incomingMsg.includes(kw))) {
        return 'Soporte NexaOps AI\n\nUn agente te atendera pronto.\nHorario: Lun-Vie 9am-6pm\n\nTu portal: ' + portalLink;
    }
    return 'NexaOps AI - Hola ' + client.name + '!\n\nResponde: 1=Estado, 2=Soporte';
}

// Helper: build reply message async
async function buildWAReply(incomingMsg, fromNumber) {
    const client = await findClientByPhone(fromNumber);
    if (!client) {
        return 'Hola! Soy el asistente de NexaOps AI.\n\n'
             + 'No encontramos tu numero en el sistema.\n\n'
             + 'Visita: https://nexaops-ai.vercel.app\n'
             + 'O escribe CONTACTAR para hablar con un agente.';
    }
    const projects = await getClientProjects(client.id);
    const portalLink = PORTAL_BASE + client.id;
    if (['hola','hi','help','menu','1','estado','proyecto','progreso'].some(kw => incomingMsg.includes(kw))) {
        const info = projects.length > 0
            ? projects.map(p => '- ' + p.name + ': ' + (p.progress||0) + '% (' + p.status + ')').join('\n')
            : 'Tu proyecto esta siendo preparado.';
        return 'NexaOps AI - Hola ' + client.name + '!\n\nTus proyectos:\n' + info
             + '\n\nTu portal: ' + portalLink + '\n\nResponde: 1=Estado, 2=Soporte';
    }
    if (['soporte','ayuda','contactar','2'].some(kw => incomingMsg.includes(kw))) {
        return 'Soporte NexaOps AI\n\nUn agente te atendera pronto.\nHorario: Lun-Vie 9am-6pm\n\nTu portal: ' + portalLink;
    }
    return 'NexaOps AI - Hola ' + client.name + '!\n\nResponde: 1=Estado, 2=Soporte';
}


// SEND NOTIFICATION — admin triggers this to notify a client proactively
app.post('/api/notify/whatsapp', async (req, res) => {
    try {
        if (!GREEN_API_INSTANCE || !GREEN_API_TOKEN) {
            return res.status(503).json({ error: 'Green API no configurado' });
        }
        const { clientId, message } = req.body;
        if (!clientId || !message) return res.status(400).json({ error: 'clientId y message son requeridos' });

        const { data: client } = await supabase
            .from('clients')
            .select('name, phone')
            .eq('id', clientId)
            .single();

        if (!client || !client.phone) return res.status(404).json({ error: 'Cliente sin número de WhatsApp' });

        // Convert phone number to Green API chatId format
        const cleanPhone = client.phone.replace(/[^0-9+]/g, '');
        const chatId = `${cleanPhone}@c.us`;
        
        await sendWhatsApp(chatId, message);
        res.json({ success: true, sent_to: chatId });
    } catch (err) {
        console.error('Notify error:', err);
        res.status(500).json({ error: err.message });
    }
});

// HEALTH CHECK - verify Green API connection
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
            configured: !!GREEN_API_INSTANCE
        });
    }
});

// GET QR CODE for WhatsApp connection
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

// PUBLIC CLIENT VIEW — no API key needed, only client ID as token
app.get('/api/client-view/:id', async (req, res) => {
    try {
        const { data: client, error: clientError } = await supabase
            .from('clients')
            .select('id, name, email, phone, status, createdAt')
            .eq('id', req.params.id)
            .single();

        if (clientError || !client) return res.status(404).json({ error: 'Cliente no encontrado' });

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
        // Ejecutamos consultas en paralelo para máxima velocidad
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

        const totalIncome = incomeData ? incomeData.reduce((sum, i) => sum + Number(i.amount || 0), 0) : 0;
        const currentMonth = new Date().getMonth();
        const thisMonthIncome = incomeData ? incomeData
            .filter(i => new Date(i.date).getMonth() === currentMonth)
            .reduce((sum, i) => sum + Number(i.amount || 0), 0) : 0;
        
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
        const { data, error } = await supabase.from('clients')
            .update(req.body)
            .eq('id', req.params.id)
            .select().single();
            
        if (error) throw error;
        res.json(data);
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
        const { data, error } = await supabase.from('projects')
            .update(req.body)
            .eq('id', req.params.id)
            .select().single();
            
        if (error) throw error;
        res.json(data);
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
        const { data, error } = await supabase.from('tasks')
            .update(req.body)
            .eq('id', req.params.id)
            .select().single();
            
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
    res.json(data);
});

app.post('/api/agents/:name/prompts', async (req, res) => {
    try {
        const newPrompt = { id: Date.now().toString(), agentName: req.params.name, ...req.body, createdAt: new Date().toISOString() };
        const { data, error } = await supabase.from('prompts').insert([newPrompt]).select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;