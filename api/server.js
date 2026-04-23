require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const { z } = require('zod');

const app = express();

// ==================== SEGURIDAD AVANZADA ====================

// 1. Helmet: Protege cabeceras HTTP (Anti-XSS, Anti-Clickjacking)
app.use(helmet());

// 2. CORS Estricto: Solo permite tu dominio local y el dominio de producción
const allowedOrigins = [
  'http://127.0.0.1:5500', 
  'http://localhost:5500', 
  'http://localhost:3000',
  'https://nexaops.tu-dominio.com' // <-- Cambiar por tu dominio real si tienes uno
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

module.exports = app;