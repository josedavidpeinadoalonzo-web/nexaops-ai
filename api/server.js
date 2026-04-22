const express = require('express');
const cors = require('cors');
const jsonfile = require('jsonfile');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json());

// Helper: Read DB
const readDB = () => jsonfile.readFileSync(DB_PATH);

// Helper: Write DB
const writeDB = (data) => jsonfile.writeFileSync(DB_PATH, data, { spaces: 2 });

// Initialize DB if not exists
const initDB = () => {
    if (!require('fs').existsSync(DB_PATH)) {
        writeDB({ clients: [], projects: [], tasks: [], income: [], agents: [], prompts: [] });
    } else {
        const db = readDB();
        if (!db.agents) db.agents = [];
        if (!db.prompts) db.prompts = [];
        writeDB(db);
    }
};
initDB();

// ==================== ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// ==================== CLIENTS ====================

// Get all clients
app.get('/api/clients', (req, res) => {
    const db = readDB();
    res.json(db.clients);
});

// Get single client
app.get('/api/clients/:id', (req, res) => {
    const db = readDB();
    const client = db.clients.find(c => c.id === req.params.id);
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(client);
});

// Create client
app.post('/api/clients', (req, res) => {
    const db = readDB();
    const newClient = {
        id: Date.now().toString(),
        ...req.body,
        createdAt: new Date().toISOString()
    };
    db.clients.push(newClient);
    writeDB(db);
    res.json(newClient);
});

// Update client
app.put('/api/clients/:id', (req, res) => {
    const db = readDB();
    const index = db.clients.findIndex(c => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Cliente no encontrado' });
    db.clients[index] = { ...db.clients[index], ...req.body };
    writeDB(db);
    res.json(db.clients[index]);
});

// ==================== PROJECTS ====================

// Get all projects
app.get('/api/projects', (req, res) => {
    const db = readDB();
    res.json(db.projects);
});

// Get projects by client
app.get('/api/projects/client/:clientId', (req, res) => {
    const db = readDB();
    const projects = db.projects.filter(p => p.clientId === req.params.clientId);
    res.json(projects);
});

// Get single project
app.get('/api/projects/:id', (req, res) => {
    const db = readDB();
    const project = db.projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });
    res.json(project);
});

// Create project
app.post('/api/projects', (req, res) => {
    const db = readDB();
    const newProject = {
        id: Date.now().toString(),
        status: 'pending',
        progress: 0,
        ...req.body,
        createdAt: new Date().toISOString()
    };
    db.projects.push(newProject);
    writeDB(db);
    res.json(newProject);
});

// Update project
app.put('/api/projects/:id', (req, res) => {
    const db = readDB();
    const index = db.projects.findIndex(p => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Proyecto no encontrado' });
    db.projects[index] = { ...db.projects[index], ...req.body };
    writeDB(db);
    res.json(db.projects[index]);
});

// ==================== TASKS ====================

// Get all tasks
app.get('/api/tasks', (req, res) => {
    const db = readDB();
    res.json(db.tasks);
});

// Create task
app.post('/api/tasks', (req, res) => {
    const db = readDB();
    const newTask = {
        id: Date.now().toString(),
        completed: false,
        ...req.body,
        createdAt: new Date().toISOString()
    };
    db.tasks.push(newTask);
    writeDB(db);
    res.json(newTask);
});

// Update task
app.put('/api/tasks/:id', (req, res) => {
    const db = readDB();
    const index = db.tasks.findIndex(t => t.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Tarea no encontrada' });
    db.tasks[index] = { ...db.tasks[index], ...req.body };
    writeDB(db);
    res.json(db.tasks[index]);
});

// Delete task
app.delete('/api/tasks/:id', (req, res) => {
    const db = readDB();
    db.tasks = db.tasks.filter(t => t.id !== req.params.id);
    writeDB(db);
    res.json({ success: true });
});

// ==================== INCOME ====================

// Get all income
app.get('/api/income', (req, res) => {
    const db = readDB();
    res.json(db.income);
});

// Add income
app.post('/api/income', (req, res) => {
    const db = readDB();
    const newIncome = {
        id: Date.now().toString(),
        ...req.body,
        createdAt: new Date().toISOString()
    };
    db.income.push(newIncome);
    writeDB(db);
    res.json(newIncome);
});

// ==================== STATS ====================

// Get dashboard stats
app.get('/api/stats', (req, res) => {
    const db = readDB();
    const clients = db.clients.length;
    const projects = db.projects.length;
    const pendingTasks = db.tasks.filter(t => !t.completed).length;
    const totalIncome = db.income.reduce((sum, i) => sum + (i.amount || 0), 0);
    const thisMonthIncome = db.income
        .filter(i => new Date(i.date).getMonth() === new Date().getMonth())
        .reduce((sum, i) => sum + (i.amount || 0), 0);
    
    res.json({
        clients,
        projects,
        pendingTasks,
        totalIncome,
        thisMonthIncome
    });
});

// ==================== AGENTS ====================

// Get all agents
app.get('/api/agents', (req, res) => {
    const db = readDB();
    res.json(db.agents);
});

// Save agent config
app.post('/api/agents', (req, res) => {
    const db = readDB();
    const newAgent = { id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() };
    db.agents.push(newAgent);
    writeDB(db);
    res.json(newAgent);
});

// Get agent prompts
app.get('/api/agents/:name/prompts', (req, res) => {
    const db = readDB();
    const prompts = db.prompts.filter(p => p.agentName === req.params.name);
    res.json(prompts);
});

// Save prompt
app.post('/api/agents/:name/prompts', (req, res) => {
    const db = readDB();
    const newPrompt = {
        id: Date.now().toString(),
        agentName: req.params.name,
        ...req.body,
        createdAt: new Date().toISOString()
    };
    db.prompts.push(newPrompt);
    writeDB(db);
    res.json(newPrompt);
});

app.listen(PORT, () => {
    console.log(`NexaOps API running on http://localhost:${PORT}`);
});