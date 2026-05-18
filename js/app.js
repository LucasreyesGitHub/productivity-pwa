// app.js — Sidebar navigation and app initialization

// ── Sidebar toggle ─────────────────────────────────────
function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    const isOpen = sidebar.classList.contains('mobile-open');
    sidebar.classList.toggle('mobile-open', !isOpen);
    backdrop.classList.toggle('active', !isOpen);
  } else {
    sidebar.classList.toggle('collapsed');
  }
}

// ── Section navigation ─────────────────────────────────
function showSection(name) {
  ['tasks','calendar','ideas'].forEach(s => {
    document.getElementById('section-' + s).classList.add('hidden');
  });
  document.getElementById('section-' + name).classList.remove('hidden');

  // Deactivate all section nav items
  document.querySelectorAll('[data-section]').forEach(el => el.classList.remove('active'));

  if (name !== 'tasks') {
    const btn = document.querySelector(`[data-section="${name}"]`);
    if (btn) btn.classList.add('active');
    // Deactivate view nav items
    document.querySelectorAll('[data-view]').forEach(el => el.classList.remove('active'));
    // Update page title
    const titles = { calendar: 'Calendar', ideas: 'Ideas' };
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = titles[name] || name;
  }
}

// ── View navigation (task filters) ────────────────────
function setView(view) {
  currentView = view;

  // Show tasks section
  showSection('tasks');

  // Update nav item active states
  document.querySelectorAll('[data-view]').forEach(el => el.classList.remove('active'));
  const btn = document.querySelector(`[data-view="${view}"]`);
  if (btn) btn.classList.add('active');

  // Update page title
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = VIEW_TITLES[view] || view;

  // Re-render with new filter
  renderTasks();
}

// ── Wire up nav items ──────────────────────────────────
function initNav() {
  // Task view items (smart filters + categories)
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      setView(btn.dataset.view);
      // Close mobile sidebar
      if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('mobile-open');
        document.getElementById('sidebar-backdrop').classList.remove('active');
      }
    });
  });

  // Section items (calendar, ideas)
  document.querySelectorAll('[data-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      showSection(btn.dataset.section);
      // Deactivate view items
      document.querySelectorAll('[data-view]').forEach(el => el.classList.remove('active'));
      // Close mobile sidebar
      if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('mobile-open');
        document.getElementById('sidebar-backdrop').classList.remove('active');
      }
    });
  });

  // Sidebar toggle buttons
  document.getElementById('sidebar-toggle')?.addEventListener('click', toggleSidebar);
  document.getElementById('menu-btn')?.addEventListener('click', toggleSidebar);

  // Backdrop click closes sidebar
  document.getElementById('sidebar-backdrop')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('mobile-open');
    document.getElementById('sidebar-backdrop').classList.remove('active');
  });
}

// ── App init ───────────────────────────────────────────
async function initApp(uid) {
  userId = uid;
  setSyncStatus('syncing', 'Cargando...');
  await syncAll();
  initNav();
  setView('inbox');

  // Supabase realtime
  sb.channel('realtime-' + uid)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks',  filter: 'user_id=eq.' + uid }, syncAll)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: 'user_id=eq.' + uid }, syncAll)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ideas',  filter: 'user_id=eq.' + uid }, syncAll)
    .subscribe();
}

// Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}
