// db.js — abstracción offline-first con sync a Supabase
let userId = null;
let isOnline = navigator.onLine;
let pendingSync = false;

const LOCAL = {
  get: (key) => JSON.parse(localStorage.getItem(key + '_' + userId) || '[]'),
  set: (key, val) => localStorage.setItem(key + '_' + userId, JSON.stringify(val)),
};

function setSyncStatus(status, text) {
  const el = document.getElementById('sync-status');
  el.className = 'sync-badge ' + status;
  el.textContent = text;
}

window.addEventListener('online',  () => { isOnline = true;  syncAll(); });
window.addEventListener('offline', () => { isOnline = false; setSyncStatus('offline', 'Sin conexión'); });

// ── TASKS ──────────────────────────────────────────────
async function dbGetTasks() {
  if (!isOnline) return LOCAL.get('tasks');
  const { data, error } = await supabase.from('tasks').select('*').eq('user_id', userId).order('position');
  if (error) return LOCAL.get('tasks');
  LOCAL.set('tasks', data);
  return data;
}

async function dbAddTask(task) {
  const item = { ...task, user_id: userId, created_at: new Date().toISOString() };
  if (!isOnline) {
    const tasks = LOCAL.get('tasks');
    tasks.unshift(item);
    LOCAL.set('tasks', tasks);
    return item;
  }
  const { data, error } = await supabase.from('tasks').insert(item).select().single();
  if (error) throw error;
  const tasks = LOCAL.get('tasks');
  tasks.unshift(data);
  LOCAL.set('tasks', tasks);
  return data;
}

async function dbUpdateTask(id, changes) {
  const tasks = LOCAL.get('tasks');
  const idx = tasks.findIndex(t => t.id === id);
  if (idx !== -1) { Object.assign(tasks[idx], changes); LOCAL.set('tasks', tasks); }
  if (isOnline) await supabase.from('tasks').update(changes).eq('id', id).eq('user_id', userId);
}

async function dbDeleteTask(id) {
  const tasks = LOCAL.get('tasks').filter(t => t.id !== id);
  LOCAL.set('tasks', tasks);
  if (isOnline) await supabase.from('tasks').delete().eq('id', id).eq('user_id', userId);
}

async function dbReorderTasks(orderedIds) {
  const updates = orderedIds.map((id, i) => ({ id, position: i, user_id: userId }));
  const tasks = LOCAL.get('tasks');
  orderedIds.forEach((id, i) => { const t = tasks.find(t => t.id === id); if (t) t.position = i; });
  LOCAL.set('tasks', tasks);
  if (isOnline) {
    for (const u of updates) await supabase.from('tasks').update({ position: u.position }).eq('id', u.id).eq('user_id', userId);
  }
}

// ── EVENTS ─────────────────────────────────────────────
async function dbGetEvents() {
  if (!isOnline) return LOCAL.get('events');
  const { data, error } = await supabase.from('events').select('*').eq('user_id', userId).order('date');
  if (error) return LOCAL.get('events');
  LOCAL.set('events', data);
  return data;
}

async function dbAddEvent(ev) {
  const item = { ...ev, user_id: userId };
  if (!isOnline) {
    const evs = LOCAL.get('events');
    evs.push(item);
    LOCAL.set('events', evs);
    return item;
  }
  const { data, error } = await supabase.from('events').insert(item).select().single();
  if (error) throw error;
  const evs = LOCAL.get('events');
  evs.push(data);
  LOCAL.set('events', evs);
  return data;
}

async function dbDeleteEvent(id) {
  LOCAL.set('events', LOCAL.get('events').filter(e => e.id !== id));
  if (isOnline) await supabase.from('events').delete().eq('id', id).eq('user_id', userId);
}

// ── IDEAS ──────────────────────────────────────────────
async function dbGetIdeas() {
  if (!isOnline) return LOCAL.get('ideas');
  const { data, error } = await supabase.from('ideas').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) return LOCAL.get('ideas');
  LOCAL.set('ideas', data);
  return data;
}

async function dbAddIdea(idea) {
  const { desc, ...rest } = idea;
  const item = { ...rest, description: desc, user_id: userId, created_at: new Date().toISOString() };
  if (!isOnline) {
    const ideas = LOCAL.get('ideas');
    ideas.unshift(item);
    LOCAL.set('ideas', ideas);
    return item;
  }
  const { data, error } = await supabase.from('ideas').insert(item).select().single();
  if (error) throw error;
  const ideas = LOCAL.get('ideas');
  ideas.unshift(data);
  LOCAL.set('ideas', ideas);
  return data;
}

async function dbDeleteIdea(id) {
  LOCAL.set('ideas', LOCAL.get('ideas').filter(i => i.id !== id));
  if (isOnline) await supabase.from('ideas').delete().eq('id', id).eq('user_id', userId);
}

// ── FULL SYNC ──────────────────────────────────────────
async function syncAll() {
  if (!userId || !isOnline) return;
  setSyncStatus('syncing', 'Sincronizando...');
  try {
    await dbGetTasks();
    await dbGetEvents();
    await dbGetIdeas();
    renderTasks(); renderCal(); renderIdeas();
    setSyncStatus('synced', 'Sincronizado');
  } catch {
    setSyncStatus('offline', 'Error de sync');
  }
}
