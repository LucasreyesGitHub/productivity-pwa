// app.js — Navigation, initialization and app coordination

let realtimeChannel  = null;
let navInitialized   = false;
const ALL_SECTIONS   = ['dashboard','tasks','habits','goals','stats','calendar','ideas'];

// ── Custom Categories ──────────────────────────────────
const DEFAULT_CAT_COLORS = ['#0284c7','#ea580c','#7c3aed','#16a34a','#6b7280','#e11d48','#d97706','#0891b2'];

function getCustomCategories() {
  if (!userId) return [];
  return JSON.parse(localStorage.getItem('custom_categories_' + userId) || '[]');
}

function saveCustomCategories(cats) {
  localStorage.setItem('custom_categories_' + userId, JSON.stringify(cats));
}

function openCategoryModal(editId = null) {
  document.getElementById('cat-modal-name').value = '';
  document.getElementById('cat-modal-form').dataset.editId = '';
  const colorOpts = document.querySelectorAll('.cat-color-opt');
  colorOpts.forEach((b, i) => b.classList.toggle('active', i === 0));
  document.getElementById('cat-modal-color').value = DEFAULT_CAT_COLORS[0];

  if (editId) {
    const cat = getCustomCategories().find(c => c.id === editId);
    if (cat) {
      document.getElementById('cat-modal-name').value = cat.name;
      document.getElementById('cat-modal-color').value = cat.color;
      document.getElementById('cat-modal-form').dataset.editId = editId;
      colorOpts.forEach(b => b.classList.toggle('active', b.dataset.color === cat.color));
    }
  }
  openModal('modal-category-form');
  setTimeout(() => document.getElementById('cat-modal-name')?.focus(), 80);
}

function submitCategoryForm() {
  const name = document.getElementById('cat-modal-name').value.trim();
  if (!name) { document.getElementById('cat-modal-name').focus(); return; }
  const color  = document.getElementById('cat-modal-color').value || DEFAULT_CAT_COLORS[0];
  const editId = document.getElementById('cat-modal-form').dataset.editId;
  const cats   = getCustomCategories();

  if (editId) {
    const idx = cats.findIndex(c => c.id === editId);
    if (idx !== -1) { cats[idx].name = name; cats[idx].color = color; }
  } else {
    cats.push({ id: crypto.randomUUID(), name, color });
  }
  saveCustomCategories(cats);
  closeModal('modal-category-form');
  if (typeof registerCustomCategoryFilters === 'function') registerCustomCategoryFilters();
  renderSidebarCustomCats();
  renderDashboard();
  refreshCategoryDropdowns();
}

function deleteCustomCategory(id) {
  const cats = getCustomCategories().filter(c => c.id !== id);
  saveCustomCategories(cats);
  if (typeof registerCustomCategoryFilters === 'function') registerCustomCategoryFilters();
  renderSidebarCustomCats();
  renderDashboard();
  refreshCategoryDropdowns();
  // unassign tasks from this category
  const tasks = LOCAL.get('tasks');
  const updated = tasks.map(t => t.category === 'custom-' + id ? { ...t, category: null } : t);
  LOCAL.set('tasks', updated);
  if (typeof renderTasks === 'function') renderTasks();
}

function selectCatModalColor(color, el) {
  document.getElementById('cat-modal-color').value = color;
  document.querySelectorAll('.cat-color-opt').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

function renderSidebarCustomCats() {
  const container = document.getElementById('sidebar-custom-cats');
  if (!container) return;
  const cats = getCustomCategories();
  container.innerHTML = cats.map(c => `
    <button class="nav-item" data-view="cat-custom-${c.id}">
      <span class="cat-dot" style="background:${c.color}"></span>
      <span>${escHtml(c.name)}</span>
      <span class="nav-badge" id="cnt-custom-${c.id}"></span>
    </button>`).join('');

  // wire up click events
  container.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      setView(btn.dataset.view);
      closeMobileSidebar();
    });
  });
}

function refreshCategoryDropdowns() {
  const cats = getCustomCategories();
  const customOpts = cats.map(c => `<option value="custom-${c.id}">${escHtml(c.name)}</option>`).join('');

  ['qa-cat', 'td-category'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    // remove old custom options
    sel.querySelectorAll('[data-custom]').forEach(o => o.remove());
    if (customOpts) {
      const temp = document.createElement('div');
      temp.innerHTML = customOpts;
      temp.querySelectorAll('option').forEach(o => {
        o.dataset.custom = '1';
        sel.appendChild(o);
      });
    }
  });
}

function updateCustomCatBadges() {
  const tasks = LOCAL.get('tasks');
  const cats = getCustomCategories();
  cats.forEach(c => {
    const el = document.getElementById('cnt-custom-' + c.id);
    if (el) {
      const count = tasks.filter(t => !t.done && t.category === 'custom-' + c.id).length;
      el.textContent = count > 0 ? count : '';
    }
  });
}

// ── Modal system ───────────────────────────────────────
function openModal(id) {
  const backdrop = document.getElementById('modal-backdrop');
  const modal    = document.getElementById(id);
  if (!backdrop || !modal) return;
  // Hide any other open modals
  backdrop.querySelectorAll('.modal-card').forEach(m => m.classList.add('hidden'));
  modal.classList.remove('hidden');
  backdrop.classList.remove('hidden');
}

function closeModal(id) {
  const backdrop = document.getElementById('modal-backdrop');
  const modal    = document.getElementById(id);
  if (modal) modal.classList.add('hidden');
  // Hide backdrop if no other modals are open
  const anyOpen = backdrop?.querySelectorAll('.modal-card:not(.hidden)').length > 0;
  if (!anyOpen && backdrop) backdrop.classList.add('hidden');
}

function handleBackdropClick(e) {
  if (e.target === document.getElementById('modal-backdrop')) {
    document.getElementById('modal-backdrop')?.querySelectorAll('.modal-card').forEach(m => m.classList.add('hidden'));
    document.getElementById('modal-backdrop')?.classList.add('hidden');
  }
}

// Close modals with Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const backdrop = document.getElementById('modal-backdrop');
    if (backdrop && !backdrop.classList.contains('hidden')) {
      backdrop.querySelectorAll('.modal-card').forEach(m => m.classList.add('hidden'));
      backdrop.classList.add('hidden');
    }
  }
});

// ── Sidebar toggle ─────────────────────────────────────
function toggleSidebar() {
  const sidebar   = document.getElementById('sidebar');
  const backdrop  = document.getElementById('sidebar-backdrop');
  const isMobile  = window.innerWidth <= 768;

  if (isMobile) {
    const isOpen = sidebar.classList.contains('mobile-open');
    sidebar.classList.toggle('mobile-open', !isOpen);
    backdrop.classList.toggle('active', !isOpen);
  } else {
    sidebar.classList.toggle('collapsed');
  }
}

function closeMobileSidebar() {
  if (window.innerWidth > 768) return;
  document.getElementById('sidebar')?.classList.remove('mobile-open');
  document.getElementById('sidebar-backdrop')?.classList.remove('active');
}

// ── Section navigation ─────────────────────────────────
function showSection(name) {
  ALL_SECTIONS.forEach(s => {
    document.getElementById('section-' + s)?.classList.add('hidden');
  });
  document.getElementById('section-' + name)?.classList.remove('hidden');

  // Update active states on all nav items
  document.querySelectorAll('[data-section]').forEach(el => {
    el.classList.toggle('active', el.dataset.section === name && !el.dataset.goalCat);
  });
  document.querySelectorAll('[data-view]').forEach(el => el.classList.remove('active'));

  // Page title
  const sectionTitles = {
    dashboard: 'Inicio',
    tasks:     currentView ? (VIEW_TITLES[currentView] || 'Tareas') : 'Tareas',
    habits:    'Hábitos',
    goals:     'Objetivos',
    stats:     'Estadísticas',
    calendar:  'Calendario',
    ideas:     'Ideas',
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = sectionTitles[name] || name;

  // Trigger renders
  if (name === 'dashboard') renderDashboard();
  if (name === 'habits')    renderHabits();
  if (name === 'goals')     renderGoals();
  if (name === 'stats')     renderStats();
  if (name === 'calendar')  renderCal();
  if (name === 'ideas')     renderIdeas();
}

// ── View navigation (task filters) ────────────────────
function setView(view) {
  currentView = view;

  // Show tasks section
  ALL_SECTIONS.forEach(s => {
    document.getElementById('section-' + s)?.classList.add('hidden');
  });
  document.getElementById('section-tasks')?.classList.remove('hidden');

  // Active state
  document.querySelectorAll('[data-view]').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('[data-section]').forEach(el => el.classList.remove('active'));
  document.querySelector(`[data-view="${view}"]`)?.classList.add('active');

  // Page title
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = VIEW_TITLES[view] || view;

  renderTasks();
}

// ── Wire up nav items ──────────────────────────────────
function initNav() {
  // Task view items
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      setView(btn.dataset.view);
      closeMobileSidebar();
    });
  });

  // Section items (dashboard, habits, goals, stats, calendar, ideas)
  document.querySelectorAll('[data-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      const goalCat = btn.dataset.goalCat;

      if (section === 'goals' && goalCat) {
        // Goal category shortcut
        currentGoalCategory = goalCat;
        // Update sidebar goal-cat active states
        document.querySelectorAll('[data-goal-cat]').forEach(el => {
          el.classList.toggle('active', el.dataset.goalCat === goalCat);
        });
        showSection('goals');
      } else {
        showSection(section);
      }
      closeMobileSidebar();
    });
  });

  // Sidebar toggles
  document.getElementById('sidebar-toggle')?.addEventListener('click', toggleSidebar);
  document.getElementById('menu-btn')?.addEventListener('click', toggleSidebar);

  // Backdrop
  document.getElementById('sidebar-backdrop')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.remove('mobile-open');
    document.getElementById('sidebar-backdrop')?.classList.remove('active');
  });
}

// ── App init ───────────────────────────────────────────
async function initApp(uid) {
  userId = uid;
  setSyncStatus('syncing', 'Cargando...');

  // Cleanup daily tasks from previous days
  cleanupDailyTasks();

  await syncAll();

  if (!navInitialized) { initNav(); navInitialized = true; }

  // Init custom categories
  if (typeof registerCustomCategoryFilters === 'function') registerCustomCategoryFilters();
  renderSidebarCustomCats();
  refreshCategoryDropdowns();

  // Default: show dashboard
  showSection('dashboard');

  // Realtime subscription
  if (realtimeChannel) { sb.removeChannel(realtimeChannel); realtimeChannel = null; }
  realtimeChannel = sb.channel('realtime-' + uid)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks',            filter: 'user_id=eq.' + uid }, syncAll)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events',           filter: 'user_id=eq.' + uid }, syncAll)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ideas',            filter: 'user_id=eq.' + uid }, syncAll)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'habits',           filter: 'user_id=eq.' + uid }, syncAll)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'habit_completions',filter: 'user_id=eq.' + uid }, syncAll)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'goals',            filter: 'user_id=eq.' + uid }, syncAll)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'milestones',       filter: 'user_id=eq.' + uid }, syncAll)
    .subscribe(status => {
      if (status === 'CHANNEL_ERROR') console.warn('Realtime channel error — continuing with local data');
    });
}

// ── Service Worker ─────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}
