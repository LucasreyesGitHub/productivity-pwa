let taskFilter = 'all';
let taskCategoryFilter = 'all';
let dragSrcId = null;

async function addTask() {
  const inp = document.getElementById('task-input');
  const pri = document.getElementById('task-priority').value;
  const cat = document.getElementById('task-category').value;
  const text = inp.value.trim();
  if (!text) return;
  setSyncStatus('syncing', 'Guardando...');
  await dbAddTask({ id: crypto.randomUUID(), text, priority: pri, category: cat, done: false, position: 0 });
  inp.value = '';
  setSyncStatus('synced', 'Sincronizado');
  renderTasks();
}

async function toggleTask(id) {
  const tasks = LOCAL.get('tasks');
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  await dbUpdateTask(id, { done: !t.done });
  renderTasks();
}

async function deleteTask(id) {
  await dbDeleteTask(id);
  renderTasks();
}

function setFilter(f, btn) {
  taskFilter = f;
  document.querySelectorAll('#status-filter-row .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTasks();
}

function setCategoryFilter(cat, btn) {
  taskCategoryFilter = cat;
  document.querySelectorAll('#cat-filter-row .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTasks();
}

async function renderTasks() {
  const all = LOCAL.get('tasks');
  const filtered = all.filter(t => {
    const statusOk = taskFilter === 'all' || (taskFilter === 'pending' ? !t.done : t.done);
    const catOk = taskCategoryFilter === 'all' || (t.category || 'otro') === taskCategoryFilter;
    return statusOk && catOk;
  });
  const done = all.filter(t => t.done).length;
  document.getElementById('task-count').textContent = done + '/' + all.length;
  const list = document.getElementById('task-list');
  const priLabels = { high: 'Alta', med: 'Media', low: 'Baja' };
  const catLabels = { trabajo: 'Trabajo', personal: 'Personal', estudio: 'Estudio', salud: 'Salud', otro: 'Otro' };
  if (!filtered.length) { list.innerHTML = '<div class="empty">Sin tareas</div>'; return; }
  list.innerHTML = filtered.map(t => {
    const cat = t.category || 'otro';
    return `
    <div class="task-item" draggable="true" data-id="${t.id}">
      <div class="task-check ${t.done ? 'done' : ''}" onclick="toggleTask('${t.id}')"></div>
      <span class="task-text ${t.done ? 'done' : ''}">${escHtml(t.text)}</span>
      <span class="cat-badge cat-${cat}">${catLabels[cat]}</span>
      <span class="priority-badge p-${t.priority}">${priLabels[t.priority]}</span>
      <button class="del-btn" onclick="deleteTask('${t.id}')" aria-label="eliminar"><i class="ti ti-x"></i></button>
    </div>
  `;
  }).join('');
  // drag-to-reorder
  list.querySelectorAll('.task-item').forEach(el => {
    el.addEventListener('dragstart', e => { dragSrcId = el.dataset.id; el.classList.add('dragging'); });
    el.addEventListener('dragend',   e => { el.classList.remove('dragging'); list.querySelectorAll('.task-item').forEach(r => r.classList.remove('drag-over')); });
    el.addEventListener('dragover',  e => { e.preventDefault(); el.classList.add('drag-over'); });
    el.addEventListener('dragleave', e => { el.classList.remove('drag-over'); });
    el.addEventListener('drop',      e => {
      e.preventDefault(); el.classList.remove('drag-over');
      if (dragSrcId === el.dataset.id) return;
      const items = [...list.querySelectorAll('.task-item')];
      const srcIdx = items.findIndex(i => i.dataset.id === dragSrcId);
      const dstIdx = items.findIndex(i => i.dataset.id === el.dataset.id);
      const ordered = LOCAL.get('tasks').filter(t => filtered.some(f => f.id === t.id));
      const [moved] = ordered.splice(srcIdx, 1);
      ordered.splice(dstIdx, 0, moved);
      dbReorderTasks(ordered.map(t => t.id));
      renderTasks();
    });
  });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function isValidUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}
