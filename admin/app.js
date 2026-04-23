const API_URL = localStorage.getItem('nexaops_api_url') || 'https://api-virid-six-51.vercel.app/api';
let currentSection = 'overview';
let clients = [];
let projects = [];
let tasks = [];

const AGENTS = [
    { name: 'Python Developer', file: 'python-developer.md', desc: 'Backend, APIs, data science', mode: 'primary', tools: ['bash','read','edit','glob','grep','webfetch','websearch','task','todowrite','question'] },
    { name: 'Frontend Dev', file: 'frontend-dev.md', desc: 'React, Vue, interfaces', mode: 'primary', tools: ['bash','read','edit','glob','grep','webfetch','task','todowrite','question'] },
    { name: 'Backend Dev', file: 'backend-dev.md', desc: 'APIs, microservices', mode: 'primary', tools: ['bash','read','edit','glob','grep','webfetch','codesearch','task','todowrite','question'] },
    { name: 'Debug Agent', file: 'debug-agent.md', desc: 'Bug fixing, performance', mode: 'primary', tools: ['bash','read','grep','glob','websearch','codesearch','task','todowrite','question'] },
    { name: 'Docs Writer', file: 'docs-writer.md', desc: 'Documentation', mode: 'primary', tools: ['bash','read','edit','glob','grep','webfetch','task','todowrite','question'] },
    { name: 'Mobile Dev', file: 'mobile-developer.md', desc: 'iOS, Android, React Native', mode: 'primary', tools: ['bash','read','edit','glob','grep','webfetch','task','todowrite','question'] },
    { name: 'Automation Dev', file: 'automation-developer.md', desc: 'Scripts, bots, scraping', mode: 'primary', tools: ['bash','read','edit','glob','grep','webfetch','websearch','task','todowrite','question'] },
    { name: 'SaaS Architect', file: 'saas-architect.md', desc: 'Cloud architecture', mode: 'primary', tools: ['bash','read','edit','glob','grep','webfetch','websearch','codesearch','task','todowrite','question'] },
    { name: 'Digital Marketing', file: 'digital-marketing.md', desc: 'SEO, content', mode: 'primary', tools: ['bash','read','edit','glob','grep','webfetch','websearch','codesearch','task','todowrite','question'] },
    { name: 'DevOps Engineer', file: 'devops-engineer.md', desc: 'CI/CD, Docker', mode: 'primary', tools: ['bash','read','edit','glob','grep','webfetch','websearch','task','todowrite','question'] },
    { name: 'Deploy Agent', file: 'deploy-agent.md', desc: 'Deploy websites', mode: 'primary', tools: ['bash','read','edit','glob','grep','webfetch','websearch','task','todowrite','question'] },
    { name: 'Image Generator', file: 'image-generator.md', desc: 'Logos, banners', mode: 'primary', tools: ['bash','read','edit','glob','grep','webfetch','websearch','codesearch','task','todowrite','question'] },
    { name: 'UI/UX Designer', file: 'ui-ux-designer.md', desc: 'User experience', mode: 'primary', tools: ['bash','read','edit','glob','grep','webfetch','websearch','task','todowrite','question'] },
    { name: 'Project Manager', file: 'project-manager.md', desc: 'Planning, Agile', mode: 'primary', tools: ['bash','read','edit','glob','grep','webfetch','websearch','codesearch','task','todowrite','question'] },
    { name: 'Orchestrator', file: 'orchestrator-agent.md', desc: 'Main coordinator', mode: 'primary', tools: ['bash','read','edit','glob','grep','webfetch','websearch','codesearch','task','todowrite','question'] },
];

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadData();
});

async function loadData() {
    await Promise.all([loadStats(), loadRecentProjects(), loadClients(), loadProjects(), loadIncome(), loadTasks(), loadAgents()]);
}

async function loadStats() {
    try {
        const res = await fetch(`${API_URL}/stats`);
        if (!res.ok) throw new Error('API not available');
        const data = await res.json();
        document.getElementById('stats-grid').innerHTML = `
            <div class="card p-6 rounded-2xl bg-gray-800/50 border border-gray-700">
                <p class="text-gray-400 text-sm">Clientes Activos</p>
                <p class="text-3xl font-bold mt-2">${data.clients}</p>
            </div>
            <div class="card p-6 rounded-2xl bg-gray-800/50 border border-gray-700">
                <p class="text-gray-400 text-sm">Proyectos</p>
                <p class="text-3xl font-bold mt-2">${data.projects}</p>
            </div>
            <div class="card p-6 rounded-2xl bg-gray-800/50 border border-gray-700">
                <p class="text-gray-400 text-sm">Este Mes</p>
                <p class="text-3xl font-bold mt-2">$${data.thisMonthIncome}</p>
            </div>
            <div class="card p-6 rounded-2xl bg-gray-800/50 border border-gray-700">
                <p class="text-gray-400 text-sm">Tareas Pendientes</p>
                <p class="text-3xl font-bold mt-2">${data.pendingTasks}</p>
            </div>
        `;
    } catch (e) {
        document.getElementById('stats-grid').innerHTML = `
            <div class="col-span-4 p-6 rounded-2xl bg-yellow-500/20 border border-yellow-500/50 text-center">
                <p class="text-yellow-400">⚠️ API no disponible. Asegúrate de que el backend esté corriendo.</p>
                <p class="text-sm text-gray-400 mt-2">URL: ${API_URL}</p>
            </div>
        `;
    }
}

async function loadRecentProjects() {
    try {
        const res = await fetch(`${API_URL}/projects`);
        const data = await res.json();
        projects = data;
        document.getElementById('recent-projects').innerHTML = data.slice(0, 5).map(p => `
            <div class="p-4 rounded-xl bg-gray-800/50 border border-gray-700 flex justify-between items-center">
                <div>
                    <h4 class="font-semibold">${p.name}</h4>
                    <p class="text-sm text-gray-400">${p.description}</p>
                </div>
                <span class="px-3 py-1 rounded-full ${getStatusColor(p.status)} text-sm">${p.status}</span>
            </div>
        `).join('');
    } catch (e) {
        document.getElementById('recent-projects').innerHTML = '<p class="text-gray-500">Sin datos</p>';
    }
}

async function loadClients() {
    try {
        const res = await fetch(`${API_URL}/clients`);
        clients = await res.json();
        document.getElementById('clients-list').innerHTML = clients.map(c => `
            <div class="p-4 rounded-xl bg-gray-800/50 border border-gray-700">
                <div class="flex justify-between">
                    <div>
                        <h4 class="font-semibold">${c.name}</h4>
                        <p class="text-sm text-gray-400">${c.type} - ${c.contact}</p>
                    </div>
                    <button onclick="deleteItem('clients', '${c.id}')" class="text-red-400 hover:text-red-300">✕</button>
                </div>
                <p class="text-xs text-gray-500 mt-2">${c.phone}</p>
            </div>
        `).join('');
    } catch (e) {
        document.getElementById('clients-list').innerHTML = '<p class="text-gray-500">Sin datos</p>';
    }
}

async function loadProjects() {
    try {
        const res = await fetch(`${API_URL}/projects`);
        projects = await res.json();
        document.getElementById('projects-list').innerHTML = projects.map(p => `
            <div class="p-4 rounded-xl bg-gray-800/50 border border-gray-700">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h4 class="font-semibold">${p.name}</h4>
                        <p class="text-sm text-gray-400">${p.description}</p>
                    </div>
                    <button onclick="deleteItem('projects', '${p.id}')" class="text-red-400 hover:text-red-300">✕</button>
                </div>
                <div class="mb-2">
                    <div class="flex justify-between text-sm mb-1">
                        <span class="text-gray-400">Progreso</span>
                        <span>${p.progress}%</span>
                    </div>
                    <div class="h-2 bg-gray-700 rounded-full">
                        <div class="h-2 bg-indigo-500 rounded-full" style="width: ${p.progress}%"></div>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        document.getElementById('projects-list').innerHTML = '<p class="text-gray-500">Sin datos</p>';
    }
}

function loadAgents() {
    document.getElementById('agents-list').innerHTML = AGENTS.map(a => `
        <div class="card p-6 rounded-2xl bg-gray-800/50 border border-gray-700">
            <div class="flex items-center gap-3 mb-4">
                <span class="text-3xl">🤖</span>
                <div>
                    <h4 class="font-semibold">${a.name}</h4>
                    <p class="text-sm text-gray-400">${a.desc}</p>
                </div>
            </div>
            <div class="mb-3">
                <p class="text-xs text-gray-500">Archivo: ${a.file}</p>
            </div>
            <div class="flex gap-2 flex-wrap">
                ${a.tools.map(t => `<span class="px-2 py-1 rounded text-xs bg-gray-700">${t}</span>`).join('')}
            </div>
        </div>
    `).join('');
}

async function loadIncome() {
    try {
        const res = await fetch(`${API_URL}/income`);
        const income = await res.json();
        const total = income.reduce((sum, i) => sum + (i.amount || 0), 0);
        document.getElementById('income-list').innerHTML = `
            <div class="p-6 rounded-2xl bg-green-500/20 border border-green-500/50 mb-6">
                <p class="text-gray-400">Total Ingresos</p>
                <p class="text-4xl font-bold text-green-400">$${total}</p>
            </div>
            ${income.map(i => `
                <div class="p-4 rounded-xl bg-gray-800/50 border border-gray-700 flex justify-between items-center">
                    <span>${i.description}</span>
                    <span class="text-green-400">$${i.amount}</span>
                </div>
            `).join('')}
        `;
    } catch (e) {
        document.getElementById('income-list').innerHTML = '<p class="text-gray-500">Sin datos</p>';
    }
}

async function loadTasks() {
    try {
        const res = await fetch(`${API_URL}/tasks`);
        tasks = await res.json();
        document.getElementById('tasks-list').innerHTML = tasks.map(t => `
            <div class="p-4 rounded-xl bg-gray-800/50 border border-gray-700 flex justify-between items-center">
                <div class="flex items-center gap-3">
                    <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTask('${t.id}', this.checked)">
                    <span class="${t.completed ? 'line-through text-gray-500' : ''}">${t.title}</span>
                </div>
                <button onclick="deleteItem('tasks', '${t.id}')" class="text-red-400 hover:text-red-300">✕</button>
            </div>
        `).join('');
    } catch (e) {
        document.getElementById('tasks-list').innerHTML = '<p class="text-gray-500">Sin datos</p>';
    }
}

function showSection(section) {
    document.querySelectorAll('[id^="section-"]').forEach(el => el.classList.add('hidden'));
    document.getElementById(`section-${section}`).classList.remove('hidden');
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.classList.add('text-gray-400');
    });
    document.getElementById(`btn-${section}`).classList.add('active');
    document.getElementById(`btn-${section}`).classList.remove('text-gray-400');
    
    const titles = {
        overview: 'Overview', clients: 'Clientes', projects: 'Proyectos',
        agents: 'Agentes', income: 'Ingresos', tasks: 'Tareas', settings: 'Configuración'
    };
    document.getElementById('section-title').textContent = titles[section];
    currentSection = section;
    
    const sectionsWithAdd = ['clients', 'projects', 'tasks', 'income'];
    document.getElementById('btn-add').classList.toggle('hidden', !sectionsWithAdd.includes(section));
}

async function toggleTask(id, completed) {
    await fetch(`${API_URL}/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed })
    });
    loadTasks();
}

async function deleteItem(type, id) {
    if (confirm('¿Eliminar?')) {
        await fetch(`${API_URL}/${type}/${id}`, { method: 'DELETE' });
        loadData();
    }
}

function showAddModal() {
    const forms = {
        clients: \`
            <input type="text" name="name" placeholder="Nombre del negocio" required class="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700">
            <select name="type" class="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700">
                <option value="restaurant">Restaurante</option>
                <option value="pharmacy">Farmacia</option>
                <option value="retail">Tienda</option>
                <option value="barber">Peluquería</option>
                <option value="other">Otro</option>
            </select>
            <input type="text" name="contact" placeholder="Nombre de contacto" class="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700">
            <input type="tel" name="phone" placeholder="WhatsApp" class="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700">
        \`,
        projects: \`
            <input type="text" name="name" placeholder="Nombre del proyecto" required class="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700">
            <textarea name="description" placeholder="Descripción" class="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700"></textarea>
            <select name="type" class="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700">
                <option value="web">Web</option>
                <option value="mobile">App Mobile</option>
                <option value="automation">Automatización</option>
                <option value="marketing">Marketing</option>
            </select>
            <input type="number" name="price" placeholder="Precio $" class="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700">
        \`,
        tasks: \`
            <input type="text" name="title" placeholder="Descripción de la tarea" required class="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700">
        \`,
        income: \`
            <input type="text" name="description" placeholder="Descripción" class="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700">
            <input type="number" name="amount" placeholder="Monto $" required class="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700">
        \`
    };
    
    document.getElementById('modal-title').textContent = \`Agregar \${currentSection.slice(0, -1)}\`;
    document.getElementById('add-form').innerHTML = forms[currentSection];
    document.getElementById('add-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('add-modal').classList.add('hidden');
}

async function handleAddForm(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    await fetch(\`\${API_URL}/\${currentSection}\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    
    closeModal();
    loadData();
}

document.getElementById('add-form').addEventListener('submit', handleAddForm);

function getStatusColor(status) {
    return {
        active: 'bg-green-500/20 text-green-400',
        development: 'bg-yellow-500/20 text-yellow-400',
        review: 'bg-blue-500/20 text-blue-400',
        pending: 'bg-gray-500/20 text-gray-400'
    }[status] || 'bg-gray-500/20 text-gray-400';
}

function loadSettings() {
    document.getElementById('whatsapp-number').value = localStorage.getItem('nexaops_whatsapp') || '';
    document.getElementById('api-url').value = API_URL;
}

function saveSettings() {
    localStorage.setItem('nexaops_whatsapp', document.getElementById('whatsapp-number').value);
    localStorage.setItem('nexaops_api_url', document.getElementById('api-url').value);
    location.reload();
}
