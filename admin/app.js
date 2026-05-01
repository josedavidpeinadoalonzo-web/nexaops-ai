const API_URL = localStorage.getItem('nexaops_api_url') || 'https://nexaops-ai.vercel.app/api';
const PORTAL_BASE = 'https://nexaops-ai.vercel.app/clients/?id=';

let currentSection = 'overview';
let clients = [];
let projects = [];
let tasks = [];

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadData();
});

async function loadData() {
    await Promise.all([
        loadStats(),
        loadRecentProjects(),
        loadClients(),
        loadProjects(),
        loadIncome(),
        loadTasks()
    ]);
}

async function loadStats() {
    try {
        const res = await fetch(`${API_URL}/stats`);
        if (!res.ok) throw new Error('API not available');

        const data = await res.json();
        document.getElementById('stats-grid').innerHTML = `
            <div class="card p-6 rounded-2xl bg-gray-800/50 border border-gray-700">
                <p class="text-gray-400 text-sm">Clientes / Leads</p>
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
                <p class="text-yellow-400">La API no esta disponible. Revisa que el backend este corriendo.</p>
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

        if (!data.length) {
            document.getElementById('recent-projects').innerHTML = '<p class="text-gray-500">Sin proyectos aun.</p>';
            return;
        }

        document.getElementById('recent-projects').innerHTML = data.slice(0, 5).map((project) => `
            <div class="p-4 rounded-xl bg-gray-800/50 border border-gray-700 flex justify-between items-center">
                <div>
                    <h4 class="font-semibold">${project.name || 'Sin nombre'}</h4>
                    <p class="text-sm text-gray-400">${project.description || ''}</p>
                </div>
                <span class="px-3 py-1 rounded-full ${getStatusColor(project.status)} text-sm">${project.status || 'N/A'}</span>
            </div>
        `).join('');
    } catch (e) {
        document.getElementById('recent-projects').innerHTML = '<p class="text-gray-500">Sin datos</p>';
    }
}

function getPortalLink(clientId) {
    return `${PORTAL_BASE}${clientId}`;
}

function sharePortalLink(clientId) {
    const link = getPortalLink(clientId);
    if (navigator.clipboard) {
        navigator.clipboard.writeText(link).then(() => alert(`Enlace copiado:\n${link}`));
    } else {
        prompt('Copia este enlace y envialo al cliente:', link);
    }
}

function sendWhatsApp(clientId, clientName, clientPhone) {
    const portalLink = getPortalLink(clientId);
    const phone = (clientPhone || '').replace(/[^0-9]/g, '');
    const message = encodeURIComponent(
        `Hola ${clientName}!\n\nTe compartimos el enlace de seguimiento de tu proyecto con NexaOps AI.\n\nTu portal de proyecto:\n${portalLink}\n\nAqui podras ver el progreso en tiempo real.`
    );
    const waUrl = phone
        ? `https://wa.me/${phone}?text=${message}`
        : `https://wa.me/?text=${message}`;

    window.open(waUrl, '_blank');
}

async function loadClients() {
    try {
        const res = await fetch(`${API_URL}/clients`);
        clients = await res.json();

        if (!clients.length) {
            document.getElementById('clients-list').innerHTML = '<p class="text-gray-500 text-center py-8">No hay clientes aun. Los leads del formulario apareceran aqui.</p>';
            return;
        }

        document.getElementById('clients-list').innerHTML = clients.map((client) => `
            <div class="p-4 rounded-xl bg-gray-800/50 border border-gray-700">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h4 class="font-semibold">${client.name || 'Sin nombre'}</h4>
                        <p class="text-sm text-gray-400">${client.email || ''}</p>
                        <p class="text-xs text-gray-500 mt-1">${client.phone || ''}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="px-3 py-1 rounded-full ${getStatusColor(client.status)} text-xs font-medium">${client.status || 'N/A'}</span>
                        <button onclick="deleteItem('clients', '${client.id}')" class="text-red-400 hover:text-red-300 text-lg leading-none">x</button>
                    </div>
                </div>
                <div class="flex gap-2 flex-wrap mt-2 pt-2 border-t border-gray-700/50">
                    <button onclick="sharePortalLink('${client.id}')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 text-xs font-medium transition-colors">
                        Copiar Portal
                    </button>
                    <button onclick="sendWhatsApp('${client.id}', '${(client.name || '').replace(/'/g, '')}', '${client.phone || ''}')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600/20 hover:bg-green-600/40 text-green-400 text-xs font-medium transition-colors">
                        Enviar por WhatsApp
                    </button>
                    <a href="${getPortalLink(client.id)}" target="_blank" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-gray-300 text-xs font-medium transition-colors">
                        Ver Portal
                    </a>
                </div>
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

        if (!projects.length) {
            document.getElementById('projects-list').innerHTML = '<p class="text-gray-500 text-center py-8">No hay proyectos aun.</p>';
            return;
        }

        document.getElementById('projects-list').innerHTML = projects.map((project) => `
            <div class="p-4 rounded-xl bg-gray-800/50 border border-gray-700">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h4 class="font-semibold">${project.name || 'Sin nombre'}</h4>
                        <p class="text-sm text-gray-400">${project.description || ''}</p>
                    </div>
                    <button onclick="deleteItem('projects', '${project.id}')" class="text-red-400 hover:text-red-300 text-lg leading-none">x</button>
                </div>
                <div class="mb-2">
                    <div class="flex justify-between text-sm mb-1">
                        <span class="text-gray-400">Progreso</span>
                        <span>${project.progress || 0}%</span>
                    </div>
                    <div class="h-2 bg-gray-700 rounded-full">
                        <div class="h-2 bg-indigo-500 rounded-full" style="width: ${project.progress || 0}%"></div>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        document.getElementById('projects-list').innerHTML = '<p class="text-gray-500">Sin datos</p>';
    }
}

async function loadIncome() {
    try {
        const res = await fetch(`${API_URL}/income`);
        const income = await res.json();
        const total = income.reduce((sum, item) => sum + Number(item.amount || 0), 0);

        document.getElementById('income-list').innerHTML = `
            <div class="p-6 rounded-2xl bg-green-500/20 border border-green-500/50 mb-6">
                <p class="text-gray-400">Total Ingresos</p>
                <p class="text-4xl font-bold text-green-400">$${total}</p>
            </div>
            ${income.length ? income.map((item) => `
                <div class="p-4 rounded-xl bg-gray-800/50 border border-gray-700 flex justify-between items-center gap-4">
                    <span>${item.description || 'Sin descripcion'}</span>
                    <div class="flex items-center gap-3">
                        <span class="text-green-400 font-bold">$${item.amount}</span>
                        <button onclick="deleteItem('income', '${item.id}')" class="text-red-400 hover:text-red-300 text-lg leading-none">x</button>
                    </div>
                </div>
            `).join('') : '<p class="text-gray-500 text-center py-4">No hay ingresos registrados.</p>'}
        `;
    } catch (e) {
        document.getElementById('income-list').innerHTML = '<p class="text-gray-500">Sin datos</p>';
    }
}

async function loadTasks() {
    try {
        const res = await fetch(`${API_URL}/tasks`);
        tasks = await res.json();

        if (!tasks.length) {
            document.getElementById('tasks-list').innerHTML = '<p class="text-gray-500 text-center py-8">No hay tareas aun.</p>';
            return;
        }

        document.getElementById('tasks-list').innerHTML = tasks.map((task) => `
            <div class="p-4 rounded-xl bg-gray-800/50 border border-gray-700 flex justify-between items-center">
                <div class="flex items-center gap-3">
                    <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask('${task.id}', this.checked)" class="w-4 h-4 rounded accent-indigo-500">
                    <span class="${task.completed ? 'line-through text-gray-500' : ''}">${task.title || 'Sin titulo'}</span>
                </div>
                <button onclick="deleteItem('tasks', '${task.id}')" class="text-red-400 hover:text-red-300 text-lg leading-none">x</button>
            </div>
        `).join('');
    } catch (e) {
        document.getElementById('tasks-list').innerHTML = '<p class="text-gray-500">Sin datos</p>';
    }
}

function showSection(section) {
    document.querySelectorAll('#section-content > [id^="section-"]').forEach((element) => element.classList.add('hidden'));

    const target = document.getElementById(`section-${section}`);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach((button) => {
        button.classList.remove('active');
        button.classList.add('text-gray-400');
    });

    const activeBtn = document.getElementById(`btn-${section}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.classList.remove('text-gray-400');
    }

    const titles = {
        overview: 'Overview',
        clients: 'Clientes / Leads',
        projects: 'Proyectos',
        agents: 'Agentes',
        income: 'Ingresos',
        tasks: 'Tareas',
        settings: 'Configuracion'
    };
    const subtitles = {
        overview: 'Resumen de tu empresa',
        clients: 'Gestiona leads y clientes activos',
        projects: 'Controla avance, estado y progreso',
        agents: 'Opera tus automatizaciones desde un solo lugar',
        income: 'Seguimiento comercial y caja',
        tasks: 'Pendientes internos del equipo',
        settings: 'Parametros base del sistema'
    };

    const titleEl = document.getElementById('section-title');
    if (titleEl) titleEl.textContent = titles[section] || section;
    const subtitleEl = document.getElementById('section-subtitle');
    if (subtitleEl) subtitleEl.textContent = subtitles[section] || '';

    currentSection = section;

    const sectionsWithAdd = ['clients', 'projects', 'tasks', 'income'];
    const addBtn = document.getElementById('btn-add');
    if (addBtn) addBtn.classList.toggle('hidden', !sectionsWithAdd.includes(section));

    if (section === 'agents') {
        reloadAgentWorkspace(false);
    }
}

function reloadAgentWorkspace(forceReload = true) {
    const frame = document.getElementById('agent-workspace-frame');
    if (!frame) return;

    if (forceReload) {
        frame.src = frame.src;
        return;
    }

    if (!frame.src || frame.src === 'about:blank') {
        frame.src = 'portal.html';
    }
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
    if (!confirm('Eliminar este elemento?')) return;

    const res = await fetch(`${API_URL}/${type}/${id}`, { method: 'DELETE' });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'No se pudo eliminar' }));
        alert(`Error: ${err.error || 'No se pudo eliminar'}`);
        return;
    }

    loadData();
}

function getClientOptions() {
    if (!clients.length) {
        return '<option value="">Primero crea un cliente</option>';
    }

    return [
        '<option value="">Selecciona un cliente</option>',
        ...clients.map((client) => `<option value="${client.id}">${client.name || 'Sin nombre'}${client.phone ? ` - ${client.phone}` : ''}</option>`)
    ].join('');
}

function showAddModal() {
    const clientForm = `
        <input type="text" name="name" placeholder="Nombre del negocio o contacto" required class="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 focus:border-indigo-500 outline-none">
        <input type="email" name="email" placeholder="Email" class="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 focus:border-indigo-500 outline-none">
        <input type="tel" name="phone" placeholder="WhatsApp (ej: +34600000000)" class="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 focus:border-indigo-500 outline-none">
        <select name="status" class="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 focus:border-indigo-500 outline-none">
            <option value="Nuevo Lead">Nuevo Lead</option>
            <option value="Contactado">Contactado</option>
            <option value="Cliente Activo">Cliente Activo</option>
            <option value="Cerrado">Cerrado</option>
        </select>
    `;

    const projectForm = `
        <select name="clientId" required class="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 focus:border-indigo-500 outline-none">
            ${getClientOptions()}
        </select>
        <input type="text" name="name" placeholder="Nombre del proyecto" required class="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 focus:border-indigo-500 outline-none">
        <textarea name="description" placeholder="Descripcion" class="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 focus:border-indigo-500 outline-none" rows="2"></textarea>
        <input type="number" name="progress" placeholder="Progreso (0-100)" min="0" max="100" value="0" class="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 focus:border-indigo-500 outline-none">
        <select name="status" class="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 focus:border-indigo-500 outline-none">
            <option value="pending">Pendiente</option>
            <option value="development">En Desarrollo</option>
            <option value="review">En Revision</option>
            <option value="active">Completado</option>
        </select>
    `;

    const taskForm = `
        <input type="text" name="title" placeholder="Descripcion de la tarea" required class="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 focus:border-indigo-500 outline-none">
    `;

    const incomeForm = `
        <input type="text" name="description" placeholder="Descripcion (ej: Proyecto web cliente X)" class="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 focus:border-indigo-500 outline-none">
        <input type="number" name="amount" placeholder="Monto $" required class="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 focus:border-indigo-500 outline-none">
    `;

    const forms = {
        clients: clientForm,
        projects: projectForm,
        tasks: taskForm,
        income: incomeForm
    };

    const sectionNames = {
        clients: 'Cliente / Lead',
        projects: 'Proyecto',
        tasks: 'Tarea',
        income: 'Ingreso'
    };

    document.getElementById('modal-title').textContent = `Agregar ${sectionNames[currentSection] || currentSection}`;
    document.getElementById('add-form').innerHTML = forms[currentSection] || '';
    document.getElementById('add-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('add-modal').classList.add('hidden');
}

async function handleAddForm(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    if (data.progress !== undefined) data.progress = Number(data.progress);

    if (currentSection === 'projects' && !data.clientId) {
        alert('Selecciona un cliente para el proyecto.');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/${currentSection}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'No se pudo guardar' }));
            alert(`Error: ${err.error || 'No se pudo guardar'}`);
            return;
        }

        closeModal();
        loadData();
    } catch (err) {
        alert('Error de conexion con la API.');
    }
}

const addFormEl = document.getElementById('add-form');
if (addFormEl) addFormEl.addEventListener('submit', handleAddForm);

function getStatusColor(status) {
    const map = {
        active: 'bg-green-500/20 text-green-400',
        'Cliente Activo': 'bg-green-500/20 text-green-400',
        development: 'bg-yellow-500/20 text-yellow-400',
        Contactado: 'bg-yellow-500/20 text-yellow-400',
        review: 'bg-blue-500/20 text-blue-400',
        pending: 'bg-gray-500/20 text-gray-400',
        'Nuevo Lead': 'bg-indigo-500/20 text-indigo-400',
        Cerrado: 'bg-red-500/20 text-red-400'
    };

    return map[status] || 'bg-gray-500/20 text-gray-400';
}

function loadSettings() {
    const waEl = document.getElementById('whatsapp-number');
    const apiEl = document.getElementById('api-url');

    if (waEl) waEl.value = localStorage.getItem('nexaops_whatsapp') || '';
    if (apiEl) apiEl.value = API_URL;
}

function saveSettings() {
    const wa = document.getElementById('whatsapp-number');
    const api = document.getElementById('api-url');

    if (wa) localStorage.setItem('nexaops_whatsapp', wa.value);
    if (api) localStorage.setItem('nexaops_api_url', api.value);

    location.reload();
}
