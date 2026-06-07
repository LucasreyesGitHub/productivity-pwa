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

// ══════════════════════════════════════════════════════
//  iOS MOBILE NAVIGATION
// ══════════════════════════════════════════════════════

const IOS_SECTION_TITLES = {
  dashboard: 'Inicio',
  tasks:     'Tareas',
  habits:    'Hábitos',
  goals:     'Objetivos',
  stats:     'Estadísticas',
  calendar:  'Calendario',
  ideas:     'Ideas',
};

let _iosCurrentTab = 'dashboard';

function isMobile() {
  return window.innerWidth <= 768;
}

// ── Update iOS nav bar title + controls ────────────────
function iosUpdateNavbar(section) {
  const title = IOS_SECTION_TITLES[section] || section;

  const largeTitle    = document.getElementById('ios-large-title');
  const compactTitle  = document.getElementById('ios-compact-title');
  const tasksControls = document.getElementById('ios-tasks-controls');
  const addBtn        = document.getElementById('ios-add-btn');
  const moreBtn       = document.getElementById('ios-more-btn');

  if (largeTitle)    largeTitle.textContent   = title;
  if (compactTitle)  compactTitle.textContent  = title;

  const isTasksSection = (section === 'tasks');
  if (tasksControls) tasksControls.classList.toggle('hidden-controls', !isTasksSection);
  if (addBtn)  addBtn.style.display  = isTasksSection ? '' : 'none';
  if (moreBtn) moreBtn.style.display = isTasksSection ? 'none' : '';

  // Recalculate navbar height for content padding
  requestAnimationFrame(() => {
    const navbar = document.getElementById('ios-navbar');
    if (navbar) {
      document.documentElement.style.setProperty(
        '--ios-navbar-h', navbar.offsetHeight + 'px'
      );
    }
  });

  // Reset scroll shadow when switching tabs
  const navbar = document.getElementById('ios-navbar');
  if (navbar) navbar.classList.remove('scrolled');
}

// ── Tab bar navigation ─────────────────────────────────
function iosTabNav(tab) {
  if (!isMobile()) return;

  _iosCurrentTab = tab;

  // Update tab bar active state
  document.querySelectorAll('.ios-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.iosTab === tab);
  });

  // Navigate to section (tasks → inbox by default)
  if (tab === 'tasks') {
    setView(currentView || 'inbox');
  } else if (['dashboard','habits','goals','stats','calendar','ideas'].includes(tab)) {
    showSection(tab);
  }

  iosUpdateNavbar(tab === 'tasks' ? 'tasks' : tab);

  // Scroll content to top
  const contentEl = document.querySelector('.content');
  if (contentEl) contentEl.scrollTop = 0;
}

// ── Scrim + sheet management ───────────────────────────
function iosShowSheet(id) {
  const scrim = document.getElementById('ios-scrim');
  const sheet = document.getElementById(id);
  if (!scrim || !sheet) return;
  scrim.classList.add('show');
  sheet.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function iosHideSheet() {
  document.querySelectorAll('.ios-sheet.show').forEach(s => s.classList.remove('show'));
  const scrim = document.getElementById('ios-scrim');
  if (scrim) scrim.classList.remove('show');
  document.body.style.overflow = '';
}

// ── Segmented control (tasks view) ────────────────────
function iosInitSegmented() {
  const seg = document.getElementById('ios-segmented');
  const thumb = document.getElementById('ios-seg-thumb');
  if (!seg || !thumb) return;

  function moveThumb(btn) {
    const sr = seg.getBoundingClientRect();
    const r  = btn.getBoundingClientRect();
    thumb.style.width = r.width + 'px';
    thumb.style.transform = `translateX(${r.left - sr.left - 2}px)`;
  }

  seg.querySelectorAll('.ios-seg').forEach(btn => {
    btn.addEventListener('click', () => {
      seg.querySelectorAll('.ios-seg').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      moveThumb(btn);
      setView(btn.dataset.iosFilter);
      // Sync sidebar view
      currentView = btn.dataset.iosFilter;
    });
  });

  requestAnimationFrame(() => {
    const active = seg.querySelector('.ios-seg.active');
    if (active) moveThumb(active);
  });
}

// Keep segmented control in sync when sidebar nav changes view
const _origSetView = typeof setView === 'function' ? setView : null;

// ── Sync segmented control when view changes ──────────
function iosSyncSegmented(view) {
  const seg = document.getElementById('ios-segmented');
  if (!seg) return;
  const btn = seg.querySelector(`[data-ios-filter="${view}"]`);
  if (btn) {
    seg.querySelectorAll('.ios-seg').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // move thumb
    const thumb = document.getElementById('ios-seg-thumb');
    if (thumb) {
      const sr = seg.getBoundingClientRect();
      const r  = btn.getBoundingClientRect();
      thumb.style.width = r.width + 'px';
      thumb.style.transform = `translateX(${r.left - sr.left - 2}px)`;
    }
  }
}

// ── Scroll handler — navbar collapse ──────────────────
function iosInitScroll() {
  const contentEl = document.querySelector('.content');
  const navbar    = document.getElementById('ios-navbar');
  if (!contentEl || !navbar) return;

  contentEl.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', contentEl.scrollTop > 10);
  }, { passive: true });
}

// ── Grab-to-dismiss on ios-more sheet ─────────────────
function iosInitGrabbers() {
  const grabber = document.getElementById('ios-more-grabber');
  const sheet   = document.getElementById('ios-more-sheet');
  if (!grabber || !sheet) return;

  let sy = 0, dragging = false;
  grabber.addEventListener('pointerdown', e => {
    sy = e.clientY; dragging = true;
    sheet.style.transition = 'none';
    grabber.setPointerCapture(e.pointerId);
  });
  grabber.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dy = Math.max(0, e.clientY - sy);
    sheet.style.transform = `translateY(${dy}px)`;
  });
  grabber.addEventListener('pointerup', e => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = '';
    sheet.style.transform = '';
    if (e.clientY - sy > 100) iosHideSheet();
  });
}

// ── iOS Task Swipe gestures ────────────────────────────
function iosBindSwipe(cardEl) {
  const id  = cardEl.dataset.id;
  const row = cardEl.querySelector('.task-card-main');
  if (!row || !id) return;

  let startX = 0, startY = 0, swipeDX = 0, locked = false, active = false;

  row.addEventListener('pointerdown', e => {
    startX = e.clientX; startY = e.clientY;
    active = true; locked = false; swipeDX = 0;
    row.style.transition = 'none';
  });

  row.addEventListener('pointermove', e => {
    if (!active) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!locked) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { active = false; row.style.transition = ''; return; }
      if (Math.abs(dx) > 8) { locked = true; row.setPointerCapture(e.pointerId); }
      else return;
    }
    swipeDX = dx;
    const clamped = Math.max(-130, Math.min(130, dx));
    row.style.transform = `translateX(${clamped}px)`;
  });

  const endSwipe = () => {
    if (!active) return;
    active = false;
    row.style.transition = 'transform .3s var(--ease-ios)';
    if (swipeDX > 90) {
      row.style.transform = 'translateX(100%)';
      setTimeout(() => toggleTask(id), 180);
    } else if (swipeDX < -90) {
      row.style.transform = 'translateX(-100%)';
      setTimeout(() => deleteTask(id), 200);
    } else {
      row.style.transform = 'translateX(0)';
    }
  };

  row.addEventListener('pointerup',     endSwipe);
  row.addEventListener('pointercancel', endSwipe);
}

// ── Init iOS nav ───────────────────────────────────────
function initIosNav() {
  if (!isMobile()) return;

  // Tab bar clicks
  document.querySelectorAll('.ios-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const t = tab.dataset.iosTab;
      if (t === 'more') {
        iosShowSheet('ios-more-sheet');
        // Update user email in sheet
        const emailEl = document.getElementById('ios-user-email');
        const mainEmailEl = document.getElementById('user-email-label');
        if (emailEl && mainEmailEl) emailEl.textContent = mainEmailEl.textContent;
        // Sync sync-dot
        const mainDot = document.getElementById('sync-dot');
        const iosDot  = document.getElementById('ios-sync-dot');
        if (mainDot && iosDot) iosDot.className = mainDot.className;
      } else {
        iosTabNav(t);
      }
    });
  });

  // + button (new task on tasks view)
  document.getElementById('ios-add-btn')?.addEventListener('click', openQuickAdd);

  // More button (non-task sections → show more sheet)
  document.getElementById('ios-more-btn')?.addEventListener('click', () => {
    iosShowSheet('ios-more-sheet');
    const emailEl   = document.getElementById('ios-user-email');
    const mainEmail = document.getElementById('user-email-label');
    if (emailEl && mainEmail) emailEl.textContent = mainEmail.textContent;
  });

  // Scrim tap → dismiss
  document.getElementById('ios-scrim')?.addEventListener('click', iosHideSheet);

  // Segmented control
  iosInitSegmented();

  // Scroll shadow
  iosInitScroll();

  // Grab-to-dismiss
  iosInitGrabbers();

  // Set initial navbar height CSS var
  requestAnimationFrame(() => {
    const navbar = document.getElementById('ios-navbar');
    if (navbar) {
      document.documentElement.style.setProperty('--ios-navbar-h', navbar.offsetHeight + 'px');
    }
  });

  // Search
  document.getElementById('ios-search-input')?.addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('.task-card').forEach(card => {
      const title = card.querySelector('.task-card-title')?.textContent?.toLowerCase() || '';
      card.style.display = (!q || title.includes(q)) ? '' : 'none';
    });
  });
}

// ── Patch showSection to update iOS nav ───────────────
{
  const _orig = showSection;
  showSection = function(name) {
    _orig(name);
    if (isMobile()) {
      iosUpdateNavbar(name);
      const tabMap = { dashboard:'dashboard', tasks:'tasks', habits:'habits', goals:'goals', stats:'more', calendar:'more', ideas:'more' };
      const tabKey = tabMap[name] || 'more';
      document.querySelectorAll('.ios-tab').forEach(t => t.classList.toggle('active', t.dataset.iosTab === tabKey));
    }
  };
}

// ── Patch setView to sync segmented control ───────────
{
  const _orig = setView;
  setView = function(view) {
    _orig(view);
    if (isMobile()) {
      iosUpdateNavbar('tasks');
      document.querySelectorAll('.ios-tab').forEach(t => t.classList.toggle('active', t.dataset.iosTab === 'tasks'));
      iosSyncSegmented(view);
    }
  };
}

// ── Bind swipe after tasks render ─────────────────────
document.addEventListener('tasksRendered', () => {
  if (!isMobile()) return;
  document.querySelectorAll('.task-card').forEach(iosBindSwipe);
});

// ── Patch initApp to init iOS nav ─────────────────────
{
  const _orig = initApp;
  initApp = async function(uid) {
    await _orig(uid);
    if (isMobile()) {
      initIosNav();
      iosUpdateNavbar('dashboard');
    }
  };
}
