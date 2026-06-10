// tasks.js — Task management: smart filters, quick-add, daily/persistent types

let currentView = 'inbox';
let dragSrcId   = null;
let qaTaskType  = 'persistent';
let modalTaskId = null;

// ── Date helpers ───────────────────────────────────────
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function in7daysStr() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

function fmtDueDate(dateStr) {
  if (!dateStr) return '';
  const today = todayStr();
  if (dateStr === today) return 'Hoy';
  const d   = new Date(dateStr + 'T12:00:00');
  const now = new Date();
  const opts = d.getFullYear() === now.getFullYear()
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' };
  return d.toLocaleDateString('es-AR', opts);
}

// ── Smart filter logic ─────────────────────────────────
const VIEW_FILTERS = {
  inbox:     t => !t.done,
  today:     t => !t.done && (t.task_type === 'daily' || (!!t.due_date && t.due_date === todayStr())),
  upcoming:  t => {
    if (t.done || !t.due_date || t.task_type === 'daily') return false;
    const d = t.due_date, today = todayStr(), in7 = in7daysStr();
    return d > today && d <= in7;
  },
  overdue:   t => !t.done && t.task_type !== 'daily' && !!t.due_date && t.due_date < todayStr(),
  completed: t => t.done,
  pinned:    t => !t.done && !!t.pinned,
  'cat-trabajo':  t => !t.done && t.category === 'trabajo',
  'cat-personal': t => !t.done && t.category === 'personal',
  'cat-estudio':  t => !t.done && t.category === 'estudio',
  'cat-salud':    t => !t.done && t.category === 'salud',
  'cat-otro':     t => !t.done && (!t.category || t.category === 'otro'),
};

const VIEW_TITLES = {
  inbox: 'Entrada', today: 'Hoy', upcoming: 'Próximas',
  overdue: 'Vencidas', completed: 'Completadas', pinned: 'Fijadas',
  'cat-trabajo': 'Trabajo', 'cat-personal': 'Personal',
  'cat-estudio': 'Estudio', 'cat-salud': 'Salud', 'cat-otro': 'Otro',
};

function registerCustomCategoryFilters() {
  const cats = getCustomCategories();
  cats.forEach(c => {
    VIEW_FILTERS['cat-custom-' + c.id] = t => !t.done && t.category === 'custom-' + c.id;
    VIEW_TITLES['cat-custom-' + c.id]  = c.name;
  });
}

// ── Daily task cleanup ─────────────────────────────────
function cleanupDailyTasks() {
  const today = todayStr();
  const tasks = LOCAL.get('tasks');
  let changed = false;
  const updated = tasks.map(t => {
    if (t.task_type === 'daily' && !t.done) {
      const taskDate = t.created_at ? t.created_at.split('T')[0] : '';
      if (taskDate && taskDate < today) { changed = true; return { ...t, done: true }; }
    }
    return t;
  });
  if (changed) LOCAL.set('tasks', updated);
}

// ── Toast system ───────────────────────────────────────
let _toastTimer = null;
let _lastDeletedTask = null;
let _lastDeletedSubtasks = [];

function showToast(msg, undoFn = null, duration = 5000) {
  document.querySelector('.app-toast')?.remove();
  clearTimeout(_toastTimer);

  const toast = document.createElement('div');
  toast.className = 'app-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = `
    <span class="toast-msg">${escHtml(msg)}</span>
    ${undoFn ? `<button class="toast-undo">Deshacer</button>` : ''}
    <button class="toast-close" aria-label="Cerrar"><i class="ti ti-x"></i></button>`;

  if (undoFn) toast.querySelector('.toast-undo').addEventListener('click', () => { undoFn(); toast.remove(); clearTimeout(_toastTimer); });
  toast.querySelector('.toast-close').addEventListener('click', () => { toast.remove(); clearTimeout(_toastTimer); });

  document.body.appendChild(toast);
  _toastTimer = setTimeout(() => toast.remove(), duration);
}

// ── Quick add UI ───────────────────────────────────────
function setQaType(type) {
  qaTaskType = type;
  document.getElementById('qa-type-persistent')?.classList.toggle('active', type === 'persistent');
  document.getElementById('qa-type-daily')?.classList.toggle('active', type === 'daily');
  const dateInput = document.getElementById('qa-date');
  if (dateInput) {
    dateInput.style.display = type === 'daily' ? 'none' : '';
    if (type === 'daily') dateInput.value = '';
  }
}

function openQuickAdd(prefillDate = null) {
  // En mobile el quick-add es un sheet global — no navegar a tasks
  const isMob = typeof isMobile === 'function' ? isMobile() : window.innerWidth <= 768;
  if (!isMob) {
    const tasksSection = document.getElementById('section-tasks');
    if (tasksSection && tasksSection.classList.contains('hidden')) {
      setView(currentView || 'inbox');
    }
  }
  const qa = document.getElementById('quick-add');
  if (!qa.hidden) { document.getElementById('qa-input').focus(); return; }
  qa.hidden = false;
  setQaType('persistent');
  const di = document.getElementById('qa-date');
  if (di) {
    if (prefillDate) {
      di.value = prefillDate;
    } else if (currentView === 'today') {
      di.value = todayStr();
    }
  }
  const catMap = { 'cat-trabajo':'trabajo','cat-personal':'personal','cat-estudio':'estudio','cat-salud':'salud','cat-otro':'otro' };
  if (catMap[currentView]) document.getElementById('qa-cat').value = catMap[currentView];
  document.getElementById('qa-input').focus();
}

function closeQuickAdd() {
  const qa = document.getElementById('quick-add');
  qa.hidden = true;
  document.getElementById('qa-input').value = '';
  document.getElementById('qa-cat').value   = '';
  document.getElementById('qa-priority').value = 'med';
  document.getElementById('qa-date').value  = '';
  setQaType('persistent');
}

async function submitQuickAdd() {
  const text = document.getElementById('qa-input').value.trim();
  if (!text) { document.getElementById('qa-input').focus(); return; }
  const cat      = document.getElementById('qa-cat').value || null;
  const priority = document.getElementById('qa-priority').value || 'med';
  const dueDate  = qaTaskType === 'daily' ? null : (document.getElementById('qa-date').value || null);
  setSyncStatus('syncing', 'Guardando...');
  await dbAddTask({ id: crypto.randomUUID(), text, priority, category: cat, due_date: dueDate, task_type: qaTaskType, done: false, position: 0 });
  closeQuickAdd();
  setSyncStatus('synced', 'Sincronizado');
  renderTasks();
  renderDashboard();
}

// ── Inline edit popover ────────────────────────────────
function showEditPopover(anchorEl, items, onSelect) {
  document.getElementById('task-popover')?.remove();
  const pop = document.createElement('div');
  pop.id = 'task-popover';
  pop.className = 'task-popover';
  items.forEach(({ label, value, cls }) => {
    const b = document.createElement('button');
    b.className = 'task-popover-item' + (cls ? ' ' + cls : '');
    b.textContent = label;
    b.onclick = e => { e.stopPropagation(); onSelect(value); pop.remove(); };
    pop.appendChild(b);
  });
  document.body.appendChild(pop);

  const r = anchorEl.getBoundingClientRect();
  const spaceBelow = window.innerHeight - r.bottom;
  const popH = items.length * 34 + 8;
  const leftPos = Math.min(r.left, window.innerWidth - 160);
  pop.style.cssText = `position:fixed;z-index:9999;left:${leftPos}px;` +
    (spaceBelow > popH ? `top:${r.bottom + 6}px` : `bottom:${window.innerHeight - r.top + 6}px`);

  // Bug #7 fix: close on Esc, scroll, resize
  const cleanup = () => pop.remove();
  setTimeout(() => {
    document.addEventListener('click',   cleanup, { once: true });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') cleanup(); }, { once: true });
    window.addEventListener('scroll',   cleanup, { once: true, passive: true });
    window.addEventListener('resize',   cleanup, { once: true });
  }, 0);
}

async function editPriority(e, id) {
  e.stopPropagation();
  showEditPopover(e.currentTarget, [
    { label: '⬤  Alta',  value: 'high', cls: 'pop-high' },
    { label: '⬤  Media', value: 'med',  cls: 'pop-med'  },
    { label: '⬤  Baja',  value: 'low',  cls: 'pop-low'  },
  ], async priority => { await dbUpdateTask(id, { priority }); renderTasks(); renderDashboard(); });
}

async function editCategory(e, id) {
  e.stopPropagation();
  const customCats = getCustomCategories();
  const customItems = customCats.map(c => ({
    label: '●  ' + c.name,
    value: 'custom-' + c.id,
  }));
  showEditPopover(e.currentTarget, [
    { label: '—  Sin categoría', value: ''         },
    { label: '●  Trabajo',       value: 'trabajo',  cls: 'pop-cat-trabajo'  },
    { label: '●  Personal',      value: 'personal', cls: 'pop-cat-personal' },
    { label: '●  Estudio',       value: 'estudio',  cls: 'pop-cat-estudio'  },
    { label: '●  Salud',         value: 'salud',    cls: 'pop-cat-salud'    },
    { label: '●  Otro',          value: 'otro',     cls: 'pop-cat-otro'     },
    ...customItems,
  ], async category => { await dbUpdateTask(id, { category: category || null }); renderTasks(); renderDashboard(); });
}

async function togglePin(e, id) {
  e.stopPropagation();
  const tasks = LOCAL.get('tasks');
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  await dbUpdateTask(id, { pinned: !t.pinned });
  renderTasks();
  renderDashboard();
}

// ── Core task operations ───────────────────────────────
async function toggleTask(id) {
  const tasks = LOCAL.get('tasks');
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  await dbUpdateTask(id, { done: !t.done });
  renderTasks();
  renderDashboard();
  if (typeof renderCal === 'function') renderCal();
}

async function deleteTask(id) {
  _lastDeletedTask = LOCAL.get('tasks').find(t => t.id === id);
  _lastDeletedSubtasks = dbGetSubtasks(id);

  dbDeleteSubtasksForTask(id);
  await dbDeleteTask(id);
  renderTasks();
  renderDashboard();

  // Toast with undo (replaces confirm())
  showToast('Tarea eliminada', async () => {
    if (!_lastDeletedTask) return;
    await dbAddTask(_lastDeletedTask);
    _lastDeletedSubtasks.forEach(s => {
      const all = LOCAL.get('subtasks');
      if (!all.find(x => x.id === s.id)) { all.push(s); LOCAL.set('subtasks', all); }
    });
    _lastDeletedTask = null;
    _lastDeletedSubtasks = [];
    renderTasks();
    renderDashboard();
  });
}

// ── Badge counts ───────────────────────────────────────
function updateBadges() {
  const tasks = LOCAL.get('tasks');
  const today = todayStr();
  const in7   = in7daysStr();
  const counts = {
    inbox:    tasks.filter(t => !t.done).length,
    today:    tasks.filter(t => !t.done && (t.task_type === 'daily' || t.due_date === today)).length,
    upcoming: tasks.filter(t => !t.done && t.task_type !== 'daily' && t.due_date && t.due_date > today && t.due_date <= in7).length,
    overdue:  tasks.filter(t => !t.done && t.task_type !== 'daily' && t.due_date && t.due_date < today).length,
    trabajo:  tasks.filter(t => !t.done && t.category === 'trabajo').length,
    personal: tasks.filter(t => !t.done && t.category === 'personal').length,
    estudio:  tasks.filter(t => !t.done && t.category === 'estudio').length,
    salud:    tasks.filter(t => !t.done && t.category === 'salud').length,
    otro:     tasks.filter(t => !t.done && (!t.category || t.category === 'otro')).length,
  };
  for (const [key, count] of Object.entries(counts)) {
    const el = document.getElementById('cnt-' + key);
    if (el) el.textContent = count > 0 ? count : '';
  }
  if (typeof updateCustomCatBadges === 'function') updateCustomCatBadges();
}

// ── Focus trap (Bug #8) ────────────────────────────────
function trapFocus(el) {
  const focusable = el.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last  = focusable[focusable.length - 1];
  el._trapHandler = e => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
    else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
  };
  el.addEventListener('keydown', el._trapHandler);
}

function releaseFocus(el) {
  if (el?._trapHandler) { el.removeEventListener('keydown', el._trapHandler); delete el._trapHandler; }
}

// ── Task Detail Modal ──────────────────────────────────
function openTaskDetail(id) {
  const tasks = LOCAL.get('tasks');
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  modalTaskId = id;

  document.getElementById('td-title').value    = t.text || '';
  document.getElementById('td-priority').value = t.priority || 'med';
  document.getElementById('td-category').value = t.category || '';
  document.getElementById('td-due').value      = t.due_date || '';
  document.getElementById('td-notes').value    = t.notes || '';

  const checkEl = document.getElementById('td-check');
  if (checkEl) checkEl.classList.toggle('is-done', !!t.done);

  const pinBtn = document.getElementById('td-pin-btn');
  if (pinBtn) {
    pinBtn.classList.toggle('is-pinned', !!t.pinned);
    pinBtn.title = t.pinned ? 'Quitar del inicio' : 'Fijar en inicio';
    pinBtn.querySelector('i').className = t.pinned ? 'ti ti-pin' : 'ti ti-pin-off';
  }

  renderModalSubtasks(id);

  const overlay = document.getElementById('task-detail-overlay');
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';

  const card = overlay.querySelector('.task-detail-card');
  trapFocus(card);
  setTimeout(() => document.getElementById('td-title')?.focus(), 50);
}

function closeTaskDetail() {
  const overlay = document.getElementById('task-detail-overlay');
  releaseFocus(overlay?.querySelector('.task-detail-card'));
  overlay.hidden = true;
  document.body.style.overflow = '';
  modalTaskId = null;
}

function handleTaskDetailOverlayClick(e) {
  if (e.target.id === 'task-detail-overlay') {
    saveTaskDetail().then(closeTaskDetail);
  }
}

async function saveTaskDetail() {
  if (!modalTaskId) return;
  const title = document.getElementById('td-title').value.trim();
  if (!title) return;

  const changes = {
    text:     title,
    priority: document.getElementById('td-priority').value,
    category: document.getElementById('td-category').value || null,
    due_date: document.getElementById('td-due').value || null,
    notes:    document.getElementById('td-notes').value.trim() || null,
  };
  await dbUpdateTask(modalTaskId, changes);

  // Visual save feedback
  const btn = document.querySelector('.td-footer .btn-primary');
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = '✓ Guardado';
    btn.classList.add('btn-saved');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('btn-saved'); }, 1400);
  }

  renderTasks();
  renderDashboard();
  if (typeof renderCal === 'function') renderCal();
}

async function togglePinFromModal() {
  if (!modalTaskId) return;
  const tasks = LOCAL.get('tasks');
  const t = tasks.find(t => t.id === modalTaskId);
  if (!t) return;
  await dbUpdateTask(modalTaskId, { pinned: !t.pinned });
  const pinBtn = document.getElementById('td-pin-btn');
  const nowPinned = !t.pinned;
  if (pinBtn) {
    pinBtn.classList.toggle('is-pinned', nowPinned);
    pinBtn.title = nowPinned ? 'Quitar del inicio' : 'Fijar en inicio';
    pinBtn.querySelector('i').className = nowPinned ? 'ti ti-pin' : 'ti ti-pin-off';
  }
  renderTasks();
  renderDashboard();
}

async function toggleTaskFromModal() {
  if (!modalTaskId) return;
  const tasks = LOCAL.get('tasks');
  const t = tasks.find(t => t.id === modalTaskId);
  if (!t) return;
  await dbUpdateTask(modalTaskId, { done: !t.done });
  const checkEl = document.getElementById('td-check');
  if (checkEl) checkEl.classList.toggle('is-done', !t.done);
  renderTasks();
  renderDashboard();
}

async function deleteTaskFromModal() {
  if (!modalTaskId) return;
  const id = modalTaskId;
  closeTaskDetail();

  _lastDeletedTask = LOCAL.get('tasks').find(t => t.id === id);
  _lastDeletedSubtasks = dbGetSubtasks(id);

  dbDeleteSubtasksForTask(id);
  await dbDeleteTask(id);
  renderTasks();
  renderDashboard();

  showToast('Tarea eliminada', async () => {
    if (!_lastDeletedTask) return;
    await dbAddTask(_lastDeletedTask);
    _lastDeletedSubtasks.forEach(s => {
      const all = LOCAL.get('subtasks');
      if (!all.find(x => x.id === s.id)) { all.push(s); LOCAL.set('subtasks', all); }
    });
    _lastDeletedTask = null;
    _lastDeletedSubtasks = [];
    renderTasks();
    renderDashboard();
  });
}

// ── Subtask management ─────────────────────────────────
function renderModalSubtasks(taskId) {
  const subtasks = dbGetSubtasks(taskId);
  const list = document.getElementById('td-subtasks-list');
  const pct  = document.getElementById('td-subtasks-pct');
  if (!list) return;

  if (subtasks.length > 0) {
    const done = subtasks.filter(s => s.done).length;
    if (pct) pct.textContent = `${done}/${subtasks.length}`;
  } else {
    if (pct) pct.textContent = '';
  }

  list.innerHTML = subtasks.map(s => `
    <div class="subtask-item${s.done ? ' is-done' : ''}" data-sid="${s.id}">
      <button class="task-check${s.done ? ' is-done' : ''}"
        onclick="toggleSubtaskItem('${s.id}')" aria-label="Completar subtarea"></button>
      <span class="subtask-text">${escHtml(s.text)}</span>
      <button class="subtask-del" onclick="deleteSubtaskItem('${s.id}')" aria-label="Eliminar subtarea">
        <i class="ti ti-x"></i>
      </button>
    </div>`).join('');
}

async function toggleSubtaskItem(sid) {
  dbToggleSubtask(sid);
  if (modalTaskId) renderModalSubtasks(modalTaskId);
  renderTasks();
}

async function deleteSubtaskItem(sid) {
  dbDeleteSubtask(sid);
  if (modalTaskId) renderModalSubtasks(modalTaskId);
  renderTasks();
}

function addSubtaskFromInput() {
  if (!modalTaskId) return;
  const input = document.getElementById('td-subtask-input');
  const text  = input.value.trim();
  if (!text) { input.focus(); return; }
  dbAddSubtask(modalTaskId, text);
  input.value = '';
  renderModalSubtasks(modalTaskId);
  renderTasks();
  input.focus();
}

// ── Render tasks as cards ──────────────────────────────
async function renderTasks() {
  const all      = LOCAL.get('tasks');
  const filterFn = VIEW_FILTERS[currentView] || VIEW_FILTERS.inbox;
  const filtered = all.filter(filterFn);

  updateBadges();

  const list  = document.getElementById('task-list');
  const empty = document.getElementById('empty-state');
  if (!list) return;

  if (!filtered.length) {
    list.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  const today     = todayStr();
  const customCats = getCustomCategories();
  const catLabels = { trabajo:'Trabajo', personal:'Personal', estudio:'Estudio', salud:'Salud', otro:'Otro' };
  customCats.forEach(c => { catLabels['custom-' + c.id] = c.name; });

  list.innerHTML = filtered.map(t => {
    const cat      = t.category;
    const overdue  = !t.done && t.task_type !== 'daily' && t.due_date && t.due_date < today;
    const isToday  = !t.done && t.due_date === today;
    const dueCls   = overdue ? 'is-overdue' : isToday ? 'is-today' : '';
    const dueLabel = t.task_type !== 'daily' && t.due_date ? fmtDueDate(t.due_date) : '';
    const isDaily  = t.task_type === 'daily';
    const subtasks = dbGetSubtasks(t.id);
    const subDone  = subtasks.filter(s => s.done).length;
    const subTotal = subtasks.length;
    const subPct   = subTotal > 0 ? Math.round(subDone / subTotal * 100) : 0;
    const hasChips = cat || dueLabel || isDaily;

    return `
      <div class="task-card${t.done ? ' is-done' : ''}${t.pinned ? ' is-pinned' : ''}" data-id="${t.id}">
        <div class="task-card-main">
          <button class="task-check${t.done ? ' is-done' : ''}"
            onclick="event.stopPropagation(); toggleTask('${t.id}')"
            aria-label="Completar tarea"></button>
          <div class="task-card-body" onclick="openTaskDetail('${t.id}')">
            <span class="task-card-title">${escHtml(t.text)}</span>
            ${subTotal > 0 ? `
            <div class="task-subtask-info">
              <div class="task-subtask-bar"><div class="task-subtask-fill" style="width:${subPct}%"></div></div>
              <span class="task-subtask-count">${subDone}/${subTotal}</span>
            </div>` : ''}
          </div>
          <button class="pin-btn${t.pinned ? ' is-pinned' : ''}" onclick="togglePin(event,'${t.id}')" title="${t.pinned ? 'Quitar del inicio' : 'Fijar en inicio'}" aria-label="Fijar tarea">
            <i class="ti ti-pin${t.pinned ? '' : '-off'}"></i>
          </button>
          <span class="pri-pip p-${t.priority || 'med'}"></span>
          <button class="drag-handle" title="Arrastrar para ordenar" aria-label="Arrastrar">
            <i class="ti ti-grip-vertical"></i>
          </button>
        </div>
        ${hasChips ? `
        <div class="task-card-chips">
          ${isDaily ? `<span class="type-badge type-daily"><i class="ti ti-sun"></i> Hoy</span>` : ''}
          ${cat ? `<span class="cat-chip cat-${cat}" onclick="editCategory(event,'${t.id}')" title="Cambiar categoría" style="cursor:pointer">${catLabels[cat] || cat}</span>` : ''}
          ${dueLabel ? `<span class="due-chip ${dueCls}"><i class="ti ti-calendar-event"></i> ${dueLabel}</span>` : ''}
        </div>` : ''}
      </div>`;
  }).join('');

  // Notify iOS nav to bind swipe gestures
  document.dispatchEvent(new CustomEvent('tasksRendered'));

  // ── Drag-to-reorder (desktop + touch) ─────────────────
  list.querySelectorAll('.task-card').forEach(el => {
    const handle = el.querySelector('.drag-handle');

    // Desktop drag
    if (handle) {
      handle.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse') el.draggable = true;
      });
    }

    el.addEventListener('dragstart', e => {
      if (!el.draggable) { e.preventDefault(); return; }
      dragSrcId = el.dataset.id;
      requestAnimationFrame(() => el.classList.add('dragging'));
    });
    el.addEventListener('dragend', () => {
      el.draggable = false;
      el.classList.remove('dragging');
      list.querySelectorAll('.task-card').forEach(r => r.classList.remove('drag-over'));
    });
    el.addEventListener('dragover',  e => { e.preventDefault(); if (dragSrcId !== el.dataset.id) el.classList.add('drag-over'); });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('drag-over');
      if (!dragSrcId || dragSrcId === el.dataset.id) return;
      const items  = [...list.querySelectorAll('.task-card')];
      const srcIdx = items.findIndex(i => i.dataset.id === dragSrcId);
      const dstIdx = items.findIndex(i => i.dataset.id === el.dataset.id);
      const filteredIds = filtered.map(t => t.id);
      const ordered = LOCAL.get('tasks')
        .filter(t => filteredIds.includes(t.id))
        .sort((a, b) => filteredIds.indexOf(a.id) - filteredIds.indexOf(b.id));
      const [moved] = ordered.splice(srcIdx, 1);
      ordered.splice(dstIdx, 0, moved);
      dbReorderTasks(ordered.map(t => t.id));
      renderTasks();
    });

    // Touch drag (Bug #9 fix)
    if (handle) {
      let touchClone = null;
      let touchSrcId = null;

      handle.addEventListener('touchstart', e => {
        e.preventDefault();
        touchSrcId = el.dataset.id;
        const rect = el.getBoundingClientRect();
        touchClone = el.cloneNode(true);
        Object.assign(touchClone.style, {
          position: 'fixed', opacity: '0.85', pointerEvents: 'none',
          width: rect.width + 'px', zIndex: '9999',
          left: rect.left + 'px', top: rect.top + 'px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)', transition: 'none',
        });
        document.body.appendChild(touchClone);
        el.classList.add('dragging');
      }, { passive: false });

      handle.addEventListener('touchmove', e => {
        e.preventDefault();
        if (!touchClone) return;
        const touch = e.touches[0];
        touchClone.style.top  = (touch.clientY - 22) + 'px';
        touchClone.style.left = (touch.clientX - 60) + 'px';
        touchClone.style.display = 'none';
        const under = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.task-card');
        touchClone.style.display = '';
        list.querySelectorAll('.task-card').forEach(r => r.classList.remove('drag-over'));
        if (under && under !== el) under.classList.add('drag-over');
      }, { passive: false });

      handle.addEventListener('touchend', () => {
        touchClone?.remove(); touchClone = null;
        el.classList.remove('dragging');
        const target = list.querySelector('.task-card.drag-over');
        list.querySelectorAll('.task-card').forEach(r => r.classList.remove('drag-over'));
        if (target && target !== el && touchSrcId) {
          const items  = [...list.querySelectorAll('.task-card')];
          const srcIdx = items.findIndex(i => i.dataset.id === touchSrcId);
          const dstIdx = items.indexOf(target);
          const filteredIds = filtered.map(t => t.id);
          const ordered = LOCAL.get('tasks')
            .filter(t => filteredIds.includes(t.id))
            .sort((a, b) => filteredIds.indexOf(a.id) - filteredIds.indexOf(b.id));
          const [moved] = ordered.splice(srcIdx, 1);
          ordered.splice(dstIdx, 0, moved);
          dbReorderTasks(ordered.map(t => t.id));
          renderTasks();
        }
        touchSrcId = null;
      });
    }
  });
}

// ── Keyboard shortcuts ─────────────────────────────────
document.addEventListener('keydown', e => {
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    if (e.key === 'Escape') {
      document.activeElement.blur();
      closeQuickAdd();
      // Bug #3 fix: Esc auto-saves before closing modal
      if (modalTaskId) saveTaskDetail().then(closeTaskDetail);
      else closeTaskDetail();
    }
    if (e.key === 'Enter') {
      if (document.activeElement.id === 'qa-input')        { e.preventDefault(); submitQuickAdd(); }
      if (document.activeElement.id === 'td-subtask-input') { e.preventDefault(); addSubtaskFromInput(); }
    }
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  switch (e.key) {
    case 'n': case 'N': e.preventDefault(); openQuickAdd(); break;
    case 'Escape':
      closeQuickAdd();
      if (modalTaskId) saveTaskDetail().then(closeTaskDetail);
      else closeTaskDetail();
      break;
    case '1': setViewFromKey('inbox');     break;
    case '2': setViewFromKey('today');     break;
    case '3': setViewFromKey('upcoming');  break;
    case '4': setViewFromKey('overdue');   break;
    case '5': setViewFromKey('completed'); break;
    case '[': toggleSidebar(); break;
  }
});

function setViewFromKey(view) {
  const btn = document.querySelector(`[data-view="${view}"]`);
  if (btn) btn.click();
}

// ── Wire up on DOM ready ───────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('sidebar-new-task')?.addEventListener('click', openQuickAdd);
  document.getElementById('qa-cancel')?.addEventListener('click', closeQuickAdd);
  document.getElementById('qa-submit')?.addEventListener('click', submitQuickAdd);
});

// ── Helpers ────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function isValidUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}
