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
  if (el) { el.className = 'sync-badge ' + status; el.textContent = text; }
  const dot = document.getElementById('sync-dot');
  if (dot) dot.className = 'sync-dot ' + status;
}

window.addEventListener('online',  () => { isOnline = true;  syncAll(); });
window.addEventListener('offline', () => { isOnline = false; setSyncStatus('offline', 'Sin conexión'); });

// ── TASKS ──────────────────────────────────────────────
async function dbGetTasks() {
  if (!isOnline) return LOCAL.get('tasks');
  const { data, error } = await sb.from('tasks').select('*').eq('user_id', userId).order('position');
  if (error) return LOCAL.get('tasks');
  LOCAL.set('tasks', data);
  return data;
}

async function dbAddTask(task) {
  const item = { ...task, user_id: userId, created_at: new Date().toISOString() };

  // Local-first: always save immediately so UI never blocks
  const tasks = LOCAL.get('tasks');
  tasks.unshift(item);
  LOCAL.set('tasks', tasks);

  // Background sync — strip fields not yet in schema (due_date)
  if (isOnline) {
    const { due_date, notes, ...sbPayload } = item;
    sb.from('tasks').insert(sbPayload).select().single().then(({ data, error }) => {
      if (!error && data) {
        const all = LOCAL.get('tasks');
        const idx = all.findIndex(t => t.id === item.id);
        if (idx !== -1) { all[idx] = { ...data, due_date: item.due_date }; LOCAL.set('tasks', all); }
      }
    });
  }

  return item;
}

async function dbUpdateTask(id, changes) {
  const tasks = LOCAL.get('tasks');
  const idx = tasks.findIndex(t => t.id === id);
  if (idx !== -1) { Object.assign(tasks[idx], changes); LOCAL.set('tasks', tasks); }
  if (isOnline) {
    // Strip fields not yet in Supabase schema; fail silently so local always works
    const { due_date, notes, category, ...sbChanges } = changes;
    if (Object.keys(sbChanges).length > 0) {
      sb.from('tasks').update(sbChanges).eq('id', id).eq('user_id', userId)
        .then(({ error }) => { if (error) console.warn('Supabase update:', error.message); });
    }
  }
}

async function dbDeleteTask(id) {
  const tasks = LOCAL.get('tasks').filter(t => t.id !== id);
  LOCAL.set('tasks', tasks);
  if (isOnline) await sb.from('tasks').delete().eq('id', id).eq('user_id', userId);
}

async function dbReorderTasks(orderedIds) {
  const updates = orderedIds.map((id, i) => ({ id, position: i, user_id: userId }));
  const tasks = LOCAL.get('tasks');
  orderedIds.forEach((id, i) => { const t = tasks.find(t => t.id === id); if (t) t.position = i; });
  LOCAL.set('tasks', tasks);
  if (isOnline) {
    for (const u of updates) await sb.from('tasks').update({ position: u.position }).eq('id', u.id).eq('user_id', userId);
  }
}

// ── EVENTS ─────────────────────────────────────────────
async function dbGetEvents() {
  if (!isOnline) return LOCAL.get('events');
  const { data, error } = await sb.from('events').select('*').eq('user_id', userId).order('date');
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
  const { data, error } = await sb.from('events').insert(item).select().single();
  if (error) throw error;
  const evs = LOCAL.get('events');
  evs.push(data);
  LOCAL.set('events', evs);
  return data;
}

async function dbDeleteEvent(id) {
  LOCAL.set('events', LOCAL.get('events').filter(e => e.id !== id));
  if (isOnline) await sb.from('events').delete().eq('id', id).eq('user_id', userId);
}

// ── IDEAS ──────────────────────────────────────────────
async function dbGetIdeas() {
  if (!isOnline) return LOCAL.get('ideas');
  const { data, error } = await sb.from('ideas').select('*').eq('user_id', userId).order('created_at', { ascending: false });
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
  const { data, error } = await sb.from('ideas').insert(item).select().single();
  if (error) throw error;
  const ideas = LOCAL.get('ideas');
  ideas.unshift(data);
  LOCAL.set('ideas', ideas);
  return data;
}

async function dbDeleteIdea(id) {
  LOCAL.set('ideas', LOCAL.get('ideas').filter(i => i.id !== id));
  if (isOnline) await sb.from('ideas').delete().eq('id', id).eq('user_id', userId);
}

// ── HABITS ─────────────────────────────────────────────
async function dbGetHabits() {
  if (!isOnline) return LOCAL.get('habits');
  try {
    const { data, error } = await sb.from('habits').select('*').eq('user_id', userId).order('created_at');
    if (error) throw error;
    LOCAL.set('habits', data);
    return data;
  } catch { return LOCAL.get('habits'); }
}

async function dbAddHabit(habit) {
  const item = { ...habit, user_id: userId, created_at: new Date().toISOString() };
  const habits = LOCAL.get('habits');
  habits.push(item);
  LOCAL.set('habits', habits);
  if (isOnline) {
    sb.from('habits').insert(item).select().single()
      .then(({ data, error }) => {
        if (!error && data) {
          const all = LOCAL.get('habits');
          const idx = all.findIndex(h => h.id === item.id);
          if (idx !== -1) { all[idx] = data; LOCAL.set('habits', all); }
        }
      }).catch(() => {});
  }
  return item;
}

async function dbUpdateHabit(id, changes) {
  const habits = LOCAL.get('habits');
  const idx = habits.findIndex(h => h.id === id);
  if (idx !== -1) { Object.assign(habits[idx], changes); LOCAL.set('habits', habits); }
  if (isOnline) {
    sb.from('habits').update(changes).eq('id', id).eq('user_id', userId).catch(() => {});
  }
}

async function dbDeleteHabit(id) {
  const completions = LOCAL.get('habit_completions').filter(c => c.habit_id !== id);
  LOCAL.set('habit_completions', completions);
  LOCAL.set('habits', LOCAL.get('habits').filter(h => h.id !== id));
  if (isOnline) {
    sb.from('habit_completions').delete().eq('habit_id', id).catch(() => {});
    sb.from('habits').delete().eq('id', id).eq('user_id', userId).catch(() => {});
  }
}

// ── HABIT COMPLETIONS ──────────────────────────────────
async function dbGetHabitCompletions() {
  if (!isOnline) return LOCAL.get('habit_completions');
  try {
    const { data, error } = await sb.from('habit_completions').select('*').eq('user_id', userId);
    if (error) throw error;
    LOCAL.set('habit_completions', data);
    return data;
  } catch { return LOCAL.get('habit_completions'); }
}

async function dbAddHabitCompletion(completion) {
  const item = { ...completion, user_id: userId };
  const completions = LOCAL.get('habit_completions');
  completions.push(item);
  LOCAL.set('habit_completions', completions);
  if (isOnline) {
    sb.from('habit_completions').insert(item).select().single().catch(() => {});
  }
  return item;
}

async function dbDeleteHabitCompletion(id) {
  LOCAL.set('habit_completions', LOCAL.get('habit_completions').filter(c => c.id !== id));
  if (isOnline) sb.from('habit_completions').delete().eq('id', id).eq('user_id', userId).catch(() => {});
}

// ── GOALS ───────────────────────────────────────────────
async function dbGetGoals() {
  if (!isOnline) return LOCAL.get('goals');
  try {
    const { data, error } = await sb.from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    LOCAL.set('goals', data);
    return data;
  } catch { return LOCAL.get('goals'); }
}

async function dbAddGoal(goal) {
  const item = { ...goal, user_id: userId, created_at: new Date().toISOString() };
  const goals = LOCAL.get('goals');
  goals.unshift(item);
  LOCAL.set('goals', goals);
  if (isOnline) {
    sb.from('goals').insert(item).select().single()
      .then(({ data, error }) => {
        if (!error && data) {
          const all = LOCAL.get('goals');
          const idx = all.findIndex(g => g.id === item.id);
          if (idx !== -1) { all[idx] = data; LOCAL.set('goals', all); }
        }
      }).catch(() => {});
  }
  return item;
}

async function dbUpdateGoal(id, changes) {
  const goals = LOCAL.get('goals');
  const idx = goals.findIndex(g => g.id === id);
  if (idx !== -1) { Object.assign(goals[idx], changes); LOCAL.set('goals', goals); }
  if (isOnline) {
    sb.from('goals').update(changes).eq('id', id).eq('user_id', userId).catch(() => {});
  }
}

async function dbDeleteGoal(id) {
  LOCAL.set('milestones', LOCAL.get('milestones').filter(m => m.goal_id !== id));
  LOCAL.set('goals', LOCAL.get('goals').filter(g => g.id !== id));
  if (isOnline) {
    sb.from('milestones').delete().eq('goal_id', id).catch(() => {});
    sb.from('goals').delete().eq('id', id).eq('user_id', userId).catch(() => {});
  }
}

// ── MILESTONES ──────────────────────────────────────────
async function dbGetMilestones() {
  if (!isOnline) return LOCAL.get('milestones');
  try {
    const { data, error } = await sb.from('milestones').select('*').eq('user_id', userId).order('sort_order');
    if (error) throw error;
    LOCAL.set('milestones', data);
    return data;
  } catch { return LOCAL.get('milestones'); }
}

async function dbAddMilestone(milestone) {
  const item = { ...milestone, user_id: userId };
  const milestones = LOCAL.get('milestones');
  milestones.push(item);
  LOCAL.set('milestones', milestones);
  if (isOnline) {
    sb.from('milestones').insert(item).select().single().catch(() => {});
  }
  return item;
}

async function dbUpdateMilestone(id, changes) {
  const milestones = LOCAL.get('milestones');
  const idx = milestones.findIndex(m => m.id === id);
  if (idx !== -1) { Object.assign(milestones[idx], changes); LOCAL.set('milestones', milestones); }
  if (isOnline) {
    sb.from('milestones').update(changes).eq('id', id).eq('user_id', userId).catch(() => {});
  }
}

async function dbDeleteMilestone(id) {
  LOCAL.set('milestones', LOCAL.get('milestones').filter(m => m.id !== id));
  if (isOnline) sb.from('milestones').delete().eq('id', id).eq('user_id', userId).catch(() => {});
}

// ── SUBTASKS (local-only storage) ──────────────────────
function dbGetSubtasks(taskId) {
  return LOCAL.get('subtasks').filter(s => s.task_id === taskId);
}

function dbAddSubtask(taskId, text) {
  const item = {
    id: crypto.randomUUID(),
    task_id: taskId,
    text,
    done: false,
    user_id: userId,
    created_at: new Date().toISOString(),
  };
  const subtasks = LOCAL.get('subtasks');
  subtasks.push(item);
  LOCAL.set('subtasks', subtasks);
  return item;
}

function dbToggleSubtask(subtaskId) {
  const subtasks = LOCAL.get('subtasks');
  const s = subtasks.find(s => s.id === subtaskId);
  if (s) s.done = !s.done;
  LOCAL.set('subtasks', subtasks);
  return s;
}

function dbDeleteSubtask(subtaskId) {
  LOCAL.set('subtasks', LOCAL.get('subtasks').filter(s => s.id !== subtaskId));
}

function dbDeleteSubtasksForTask(taskId) {
  LOCAL.set('subtasks', LOCAL.get('subtasks').filter(s => s.task_id !== taskId));
}

// ── FULL SYNC ──────────────────────────────────────────
async function syncAll() {
  if (!userId || !isOnline) return;
  setSyncStatus('syncing', 'Sincronizando...');
  try {
    await Promise.all([
      dbGetTasks(), dbGetEvents(), dbGetIdeas(),
      dbGetHabits(), dbGetHabitCompletions(), dbGetGoals(), dbGetMilestones(),
    ]);
    if (typeof renderTasks    === 'function') renderTasks();
    if (typeof renderCal      === 'function') renderCal();
    if (typeof renderIdeas    === 'function') renderIdeas();
    if (typeof renderHabits   === 'function') renderHabits();
    if (typeof renderGoals    === 'function') renderGoals();
    if (typeof renderDashboard=== 'function') renderDashboard();
    if (typeof renderStats    === 'function') renderStats();
    setSyncStatus('synced', 'Sincronizado');
  } catch {
    setSyncStatus('offline', 'Error de sync');
  }
}
