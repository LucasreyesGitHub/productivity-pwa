// goals.js — Personal objectives with progress tracking, milestones, and categories

let currentGoalCategory = 'all';

const GOAL_CATS = {
  finanzas: { label: 'Finanzas',  icon: 'ti-currency-dollar', color: '#30a46c' },
  salud:    { label: 'Salud',     icon: 'ti-heart',           color: '#e5484d' },
  estudio:  { label: 'Estudio',   icon: 'ti-book',            color: '#0091ff' },
  personal: { label: 'Personal',  icon: 'ti-user',            color: '#8e4ec6' },
  carrera:  { label: 'Carrera',   icon: 'ti-briefcase',       color: '#f76b15' },
  negocios: { label: 'Negocios',  icon: 'ti-building',        color: '#ab6400' },
};

// ── Helpers ────────────────────────────────────────────
function getGoalProgress(goal) {
  if (!goal.target_value || goal.target_value === 0) return 0;
  return Math.min(100, Math.round((goal.current_value / goal.target_value) * 100));
}

function getCatMeta(category) {
  return GOAL_CATS[category] || { label: category, icon: 'ti-target', color: '#5b5bd6' };
}

// ── Category filter ───────────────────────────────────
function setGoalCategory(cat) {
  currentGoalCategory = cat;
  // Sync sidebar active state
  document.querySelectorAll('[data-goal-cat]').forEach(el => {
    el.classList.toggle('active', el.dataset.goalCat === cat);
  });
  renderGoals();
}

// ── Render ────────────────────────────────────────────
function renderGoals() {
  const goals = LOCAL.get('goals');
  const milestones = LOCAL.get('milestones');
  const filtered = currentGoalCategory === 'all'
    ? goals
    : goals.filter(g => g.category === currentGoalCategory);

  // Sync filter tabs inside section
  document.querySelectorAll('.goal-filter-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.cat === currentGoalCategory);
  });

  const container = document.getElementById('goals-grid');
  if (!container) return;

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="ti ti-target"></i>
        <p class="empty-title">Sin objetivos${currentGoalCategory !== 'all' ? ' en esta categoría' : ''}</p>
        <p class="empty-sub">Definí tus metas y seguí tu progreso hacia ellas</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(g => {
    const progress = getGoalProgress(g);
    const cat = getCatMeta(g.category);
    const gMilestones = milestones.filter(m => m.goal_id === g.id);
    const completedMs = gMilestones.filter(m => m.completed).length;
    const status = g.status || 'active';
    const statusLabel = status === 'completed' ? 'Completado' : status === 'paused' ? 'Pausado' : 'Activo';

    return `
      <div class="goal-card" data-id="${g.id}">
        <div class="goal-card-header">
          <div class="goal-cat-badge" style="--cat-color:${cat.color}">
            <i class="ti ${cat.icon}"></i>
            <span>${cat.label}</span>
          </div>
          <span class="goal-status-badge goal-status--${status}">${statusLabel}</span>
        </div>

        <h3 class="goal-title">${escHtml(g.title)}</h3>
        ${g.description ? `<p class="goal-desc">${escHtml(g.description)}</p>` : ''}

        <div class="goal-progress-wrap">
          <div class="goal-progress-bar">
            <div class="goal-progress-fill" style="width:${progress}%;background:${cat.color}"></div>
          </div>
          <span class="goal-pct">${progress}%</span>
        </div>

        <div class="goal-meta-row">
          ${g.current_value !== undefined && g.target_value
            ? `<span class="goal-values">${g.current_value} / ${g.target_value}${g.unit ? ' ' + escHtml(g.unit) : ''}</span>`
            : ''}
          ${g.deadline ? `<span class="goal-deadline"><i class="ti ti-calendar-event"></i>${fmtDueDate(g.deadline)}</span>` : ''}
          ${gMilestones.length ? `<span class="goal-ms-count"><i class="ti ti-flag"></i>${completedMs}/${gMilestones.length}</span>` : ''}
        </div>

        <!-- Expandable area -->
        <div class="goal-expanded hidden" id="goal-exp-${g.id}">
          ${g.why ? `<div class="goal-why"><strong>¿Por qué?</strong> ${escHtml(g.why)}</div>` : ''}

          ${gMilestones.length ? `
            <div class="goal-milestones-section">
              <h4 class="goal-ms-title">Hitos</h4>
              <div class="goal-ms-list">
                ${gMilestones.map(m => `
                  <div class="ms-row ${m.completed ? 'done' : ''}">
                    <button class="task-check ${m.completed ? 'is-done' : ''}"
                      onclick="event.stopPropagation();toggleMilestone('${m.id}','${g.id}')">
                    </button>
                    <span>${escHtml(m.title)}</span>
                    <button class="icon-btn ms-del" onclick="event.stopPropagation();deleteMilestone('${m.id}','${g.id}')">
                      <i class="ti ti-x"></i>
                    </button>
                  </div>`).join('')}
              </div>
            </div>` : ''}

          <div class="goal-add-ms">
            <input type="text" class="ms-input" id="ms-input-${g.id}" placeholder="Agregar hito…"
              onkeydown="if(event.key==='Enter'){event.preventDefault();addMilestone('${g.id}')}">
            <button class="btn-link" onclick="event.stopPropagation();addMilestone('${g.id}')">Agregar</button>
          </div>

          <div class="goal-actions">
            <button class="btn-secondary btn-sm" onclick="event.stopPropagation();openUpdateProgress('${g.id}')">
              <i class="ti ti-trending-up"></i> Actualizar progreso
            </button>
            <button class="btn-secondary btn-sm" onclick="event.stopPropagation();openGoalModal('${g.id}')">
              <i class="ti ti-pencil"></i> Editar
            </button>
            <button class="btn-danger btn-sm" onclick="event.stopPropagation();deleteGoal('${g.id}')">
              <i class="ti ti-trash"></i>
            </button>
          </div>
        </div>

        <button class="goal-expand-btn" onclick="toggleGoalExpand('${g.id}')" aria-label="Expandir">
          <i class="ti ti-chevron-down" id="goal-chevron-${g.id}"></i>
        </button>
      </div>`;
  }).join('');
}

// ── Expand/collapse goal card ─────────────────────────
function toggleGoalExpand(id) {
  const exp = document.getElementById('goal-exp-' + id);
  const chv = document.getElementById('goal-chevron-' + id);
  if (!exp) return;
  const isOpen = !exp.classList.contains('hidden');
  exp.classList.toggle('hidden', isOpen);
  if (chv) chv.style.transform = isOpen ? '' : 'rotate(180deg)';
}

// ── Milestones ────────────────────────────────────────
async function addMilestone(goalId) {
  const input = document.getElementById('ms-input-' + goalId);
  if (!input) return;
  const title = input.value.trim();
  if (!title) { input.focus(); return; }
  const milestones = LOCAL.get('milestones').filter(m => m.goal_id === goalId);
  await dbAddMilestone({
    id: crypto.randomUUID(),
    goal_id: goalId,
    title,
    completed: false,
    sort_order: milestones.length,
  });
  input.value = '';
  renderGoals();
  // Re-open the expanded area
  const exp = document.getElementById('goal-exp-' + goalId);
  if (exp) exp.classList.remove('hidden');
  const chv = document.getElementById('goal-chevron-' + goalId);
  if (chv) chv.style.transform = 'rotate(180deg)';
}

async function toggleMilestone(id, goalId) {
  const milestones = LOCAL.get('milestones');
  const m = milestones.find(m => m.id === id);
  if (!m) return;
  await dbUpdateMilestone(id, { completed: !m.completed });
  renderGoals();
  const exp = document.getElementById('goal-exp-' + goalId);
  if (exp) { exp.classList.remove('hidden'); }
  const chv = document.getElementById('goal-chevron-' + goalId);
  if (chv) chv.style.transform = 'rotate(180deg)';
}

async function deleteMilestone(id, goalId) {
  await dbDeleteMilestone(id);
  renderGoals();
  const exp = document.getElementById('goal-exp-' + goalId);
  if (exp) exp.classList.remove('hidden');
  const chv = document.getElementById('goal-chevron-' + goalId);
  if (chv) chv.style.transform = 'rotate(180deg)';
}

// ── Update progress ───────────────────────────────────
function openUpdateProgress(goalId) {
  const goal = LOCAL.get('goals').find(g => g.id === goalId);
  if (!goal) return;
  const unit = goal.unit ? ` (${goal.unit})` : '';
  const val = prompt(`Progreso actual de "${goal.title}"${unit}:`, goal.current_value ?? 0);
  if (val === null) return;
  const num = parseFloat(val);
  if (isNaN(num)) { alert('Ingresá un número válido'); return; }
  dbUpdateGoal(goalId, { current_value: num }).then(() => {
    renderGoals();
    renderDashboard();
  });
}

// ── CRUD ─────────────────────────────────────────────
async function deleteGoal(id) {
  if (!confirm('¿Eliminar este objetivo y todos sus hitos?')) return;
  await dbDeleteGoal(id);
  renderGoals();
  renderDashboard();
}

// ── Goal modal ────────────────────────────────────────
function openGoalModal(editId = null) {
  const form     = document.getElementById('goal-form');
  const titleEl  = document.getElementById('goal-modal-title');

  // Reset form
  ['goal-title','goal-description','goal-why','goal-unit'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['goal-target','goal-current'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('goal-category').value = 'finanzas';
  document.getElementById('goal-deadline').value = '';
  form.dataset.editId = '';

  if (editId) {
    const g = LOCAL.get('goals').find(g => g.id === editId);
    if (g) {
      document.getElementById('goal-title').value       = g.title || '';
      document.getElementById('goal-description').value = g.description || '';
      document.getElementById('goal-why').value         = g.why || '';
      document.getElementById('goal-category').value    = g.category || 'finanzas';
      document.getElementById('goal-target').value      = g.target_value ?? '';
      document.getElementById('goal-current').value     = g.current_value ?? '';
      document.getElementById('goal-unit').value        = g.unit || '';
      document.getElementById('goal-deadline').value    = g.deadline || '';
      form.dataset.editId = editId;
      if (titleEl) titleEl.textContent = 'Editar objetivo';
    }
  } else {
    if (titleEl) titleEl.textContent = 'Nuevo objetivo';
  }

  openModal('modal-goal-form');
  setTimeout(() => document.getElementById('goal-title')?.focus(), 80);
}

async function submitGoalForm() {
  const title = document.getElementById('goal-title').value.trim();
  if (!title) { document.getElementById('goal-title').focus(); return; }

  const data = {
    title,
    category:    document.getElementById('goal-category').value,
    description: document.getElementById('goal-description').value.trim(),
    why:         document.getElementById('goal-why').value.trim(),
    target_value: parseFloat(document.getElementById('goal-target').value) || 0,
    current_value: parseFloat(document.getElementById('goal-current').value) || 0,
    unit:        document.getElementById('goal-unit').value.trim(),
    deadline:    document.getElementById('goal-deadline').value || null,
    status:      'active',
  };

  const editId = document.getElementById('goal-form').dataset.editId;
  if (editId) {
    await dbUpdateGoal(editId, data);
  } else {
    await dbAddGoal({ id: crypto.randomUUID(), ...data });
  }
  closeModal('modal-goal-form');
  renderGoals();
  renderDashboard();
}

// ── Wire up on DOM ready ──────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('add-goal-btn')?.addEventListener('click', () => openGoalModal());
});
