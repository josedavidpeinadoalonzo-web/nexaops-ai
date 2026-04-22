const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let db = {
    clients: [
        { id: '1', name: 'Pizzeria Don Tito', type: 'restaurant', contact: 'Maria Perez', phone: '+58 412 1234567', email: 'maria@pizzeria.com', services: ['pedidos', 'whatsapp'], createdAt: '2026-04-20T10:00:00Z' },
        { id: '2', name: 'Farmacia Central', type: 'pharmacy', contact: 'Carlos Rodriguez', phone: '+58 414 9876543', email: 'carlos@farmacia.com', services: ['inventario', 'crm'], createdAt: '2026-04-21T10:00:00Z' },
        { id: '3', name: 'Barbería Style', type: 'barber', contact: 'Juan Martinez', phone: '+58 416 5551234', email: 'juan@barberia.com', services: ['reservas'], createdAt: '2026-04-22T10:00:00Z' }
    ],
    projects: [
        { id: '101', clientId: '1', name: 'Pizzeria Don Tito', description: 'Sistema de pedidos + WhatsApp', type: 'automation', status: 'active', progress: 100, price: 150, createdAt: '2026-04-20T10:00:00Z' },
        { id: '102', clientId: '2', name: 'Farmacia Central', description: 'Inventario + CRM', type: 'web', status: 'development', progress: 65, price: 300, createdAt: '2026-04-21T10:00:00Z' },
        { id: '103', clientId: '3', name: 'Barbería Style', description: 'Web + Reservas', type: 'web', status: 'review', progress: 90, price: 120, createdAt: '2026-04-22T10:00:00Z' }
    ],
    tasks: [
        { id: 't1', title: 'Terminar modulo de inventario', completed: false, projectId: '102', createdAt: '2026-04-22T10:00:00Z' },
        { id: 't2', title: 'Revisar cambios Barbería', completed: false, projectId: '103', createdAt: '2026-04-22T10:00:00Z' }
    ],
    income: [
        { id: 'i1', clientId: '1', description: 'Anticipo Pizzeria', amount: 75, date: '2026-04-20T10:00:00Z' },
        { id: 'i2', description: 'Pago parcial Barbería', amount: 60, date: '2026-04-21T10:00:00Z' }
    ],
    agents: [],
    prompts: []
};

// ==================== ROUTES ====================

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/stats', (req, res) => {
    const clients = db.clients.length;
    const projects = db.projects.length;
    const pendingTasks = db.tasks.filter(t => !t.completed).length;
    const totalIncome = db.income.reduce((sum, i) => sum + (i.amount || 0), 0);
    const thisMonthIncome = db.income
        .filter(i => new Date(i.date).getMonth() === new Date().getMonth())
        .reduce((sum, i) => sum + (i.amount || 0), 0);
    
    res.json({ clients, projects, pendingTasks, totalIncome, thisMonthIncome });
});

app.get('/api/clients', (req, res) => res.json(db.clients));
app.get('/api/clients/:id', (req, res) => {
    const client = db.clients.find(c => c.id === req.params.id);
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(client);
});

app.post('/api/clients', (req, res) => {
    const newClient = { id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() };
    db.clients.push(newClient);
    res.json(newClient);
});

app.put('/api/clients/:id', (req, res) => {
    const index = db.clients.findIndex(c => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Cliente no encontrado' });
    db.clients[index] = { ...db.clients[index], ...req.body };
    res.json(db.clients[index]);
});

app.get('/api/projects', (req, res) => res.json(db.projects));
app.get('/api/projects/client/:clientId', (req, res) => {
    res.json(db.projects.filter(p => p.clientId === req.params.clientId));
});
app.get('/api/projects/:id', (req, res) => {
    const project = db.projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });
    res.json(project);
});

app.post('/api/projects', (req, res) => {
    const newProject = { id: Date.now().toString(), status: 'pending', progress: 0, ...req.body, createdAt: new Date().toISOString() };
    db.projects.push(newProject);
    res.json(newProject);
});

app.put('/api/projects/:id', (req, res) => {
    const index = db.projects.findIndex(p => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Proyecto no encontrado' });
    db.projects[index] = { ...db.projects[index], ...req.body };
    res.json(db.projects[index]);
});

app.get('/api/tasks', (req, res) => res.json(db.tasks));

app.post('/api/tasks', (req, res) => {
    const newTask = { id: Date.now().toString(), completed: false, ...req.body, createdAt: new Date().toISOString() };
    db.tasks.push(newTask);
    res.json(newTask);
});

app.put('/api/tasks/:id', (req, res) => {
    const index = db.tasks.findIndex(t => t.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Tarea no encontrada' });
    db.tasks[index] = { ...db.tasks[index], ...req.body };
    res.json(db.tasks[index]);
});

app.delete('/api/tasks/:id', (req, res) => {
    db.tasks = db.tasks.filter(t => t.id !== req.params.id);
    res.json({ success: true });
});

app.get('/api/income', (req, res) => res.json(db.income));

app.post('/api/income', (req, res) => {
    const newIncome = { id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() };
    db.income.push(newIncome);
    res.json(newIncome);
});

app.get('/api/agents', (req, res) => res.json(db.agents));

app.post('/api/agents', (req, res) => {
    const newAgent = { id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() };
    db.agents.push(newAgent);
    res.json(newAgent);
});

app.get('/api/agents/:name/prompts', (req, res) => {
    res.json(db.prompts.filter(p => p.agentName === req.params.name));
});

app.post('/api/agents/:name/prompts', (req, res) => {
    const newPrompt = { id: Date.now().toString(), agentName: req.params.name, ...req.body, createdAt: new Date().toISOString() };
    db.prompts.push(newPrompt);
    res.json(newPrompt);
});

module.exports = app;