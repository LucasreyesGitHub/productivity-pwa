// habits.js — Habit tracking with streaks, completion rates and a monthly streak grid

// ── Helpers ────────────────────────────────────────────
function getHabitCompletionDates(habitId) {
  return LOCAL.get('habit_completions')
    .filter(c => c.habit_id === habitId)
    .map(c => c.date);
}

function isHabitDoneToday(habitId) {
  return LOCAL.get('habit_completions')
    .some(c => c.habit_id === habitId && c.date === todayStr());
}

function getHabitStreak(habitId) {
  const dates = getHabitCompletionDates(habitId);
  if (!dates.includes(todayStr())) return 0;
  let streak = 0;
  const d = new Date(todayStr() + 'T12:00:00');
  const MAX_STREAK = 365; // Bug #4 fix: prevent infinite loop
  while (streak < MAX_STREAK) {
    const ds = d.toISOString().split('T')[0];
    if (dates.includes(ds)) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

function getHabitRate(habitId, days = 7) {
  const dates = getHabitCompletionDates(habitId);
  let count = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    if (dates.includes(ds)) count++;
  }
  return Math.round((count / days) * 100);
}

// ── Month streak grid (like a habit-tracker calendar) ──
let habitsMonthOffset = 0;

function changeHabitsMonth(delta) {
  habitsMonthOffset += delta;
  renderHabits();
}

function getMonthGrid(habitId, offset = 0) {
  const dates = getHabitCompletionDates(habitId);
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + offset);
  const year = base.getFullYear(), month = base.getMonth();

  const firstDay     = new Date(year, month, 1);
  const daysInMonth   = new Date(year, month + 1, 0).getDate();
  const startOffset   = (firstDay.getDay() + 6) % 7; // Monday-first
  const today         = todayStr();

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells.push({
      date: ds, day: d,
      done: dates.includes(ds),
      note: getHabitNote(habitId, ds),
      isFuture: ds > today,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const label = firstDay.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return { weeks, label: label.charAt(0).toUpperCase() + label.slice(1) };
}

// ── Per-day notes ──────────────────────────────────────
function getHabitNote(habitId, date) {
  const entry = LOCAL.get('habit_notes').find(n => n.habit_id === habitId && n.date === date);
  return entry ? entry.note : '';
}

// ── Day detail popover: mark done/not-done + comment ──
function openHabitDayPopover(habitId, date, anchorEl) {
  document.getElementById('habit-day-popover')?.remove();

  const completions = LOCAL.get('habit_completions');
  const existing = completions.find(c => c.habit_id === habitId && c.date === date);
  const done = !!existing;
  const note = getHabitNote(habitId, date);

  const dLabel = new Date(date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  const pop = document.createElement('div');
  pop.id = 'habit-day-popover';
  pop.className = 'habit-day-popover';
  pop.innerHTML = `
    <div class="hdp-date">${dLabel.charAt(0).toUpperCase() + dLabel.slice(1)}</div>
    <button type="button" class="hdp-toggle ${done ? 'is-done' : ''}">
      <i class="ti ${done ? 'ti-check' : 'ti-circle-dashed'}"></i>
      <span>${done ? 'Cumplido' : 'Marcar como cumplido'}</span>
    </button>
    <textarea class="hdp-note" placeholder="Agregar un comentario…" rows="2">${escHtml(note)}</textarea>
    <div class="hdp-actions">
      <button type="button" class="hdp-cancel">Cancelar</button>
      <button type="button" class="hdp-save">Guardar</button>
    </div>`;
  document.body.appendChild(pop);

  let toggledDone = done;
  pop.querySelector('.hdp-toggle').addEventListener('click', (e) => {
    toggledDone = !toggledDone;
    e.currentTarget.classList.toggle('is-done', toggledDone);
    e.currentTarget.querySelector('i').className = 'ti ' + (toggledDone ? 'ti-check' : 'ti-circle-dashed');
    e.currentTarget.querySelector('span').textContent = toggledDone ? 'Cumplido' : 'Marcar como cumplido';
  });

  const close = () => pop.remove();
  pop.querySelector('.hdp-cancel').addEventListener('click', close);
  pop.querySelector('.hdp-save').addEventListener('click', async () => {
    const noteVal = pop.querySelector('.hdp-note').value.trim();
    await saveHabitDay(habitId, date, toggledDone, noteVal);
    close();
  });

  // Position near anchor
  const r = anchorEl.getBoundingClientRect();
  const spaceBelow = window.innerHeight - r.bottom;
  requestAnimationFrame(() => {
    const popH = pop.offsetHeight;
    const leftPos = Math.min(Math.max(r.left - 90, 8), window.innerWidth - pop.offsetWidth - 8);
    pop.style.left = leftPos + 'px';
    pop.style.top = spaceBelow > popH + 12 ? (r.bottom + 8) + 'px' : (r.top - popH - 8) + 'px';
  });

  setTimeout(() => {
    document.addEventListener('click', function onDoc(e) {
      if (!pop.contains(e.target) && e.target !== anchorEl) { pop.remove(); document.removeEventListener('click', onDoc); }
    });
  }, 0);
}

async function saveHabitDay(habitId, date, done, note) {
  const completions = LOCAL.get('habit_completions');
  const existing = completions.find(c => c.habit_id === habitId && c.date === date);

  if (done && !existing) {
    await dbAddHabitCompletion({ id: crypto.randomUUID(), habit_id: habitId, date });
  } else if (!done && existing) {
    await dbDeleteHabitCompletion(existing.id);
  }

  await dbSetHabitNote(habitId, date, note);

  renderHabits();
  renderDashboard();
  updateHabitBadge();
}

// ── Toggle completion ─────────────────────────────────
async function toggleHabitToday(habitId) {
  const today = todayStr();
  const completions = LOCAL.get('habit_completions');
  const existing = completions.find(c => c.habit_id === habitId && c.date === today);
  if (existing) {
    await dbDeleteHabitCompletion(existing.id);
  } else {
    await dbAddHabitCompletion({ id: crypto.randomUUID(), habit_id: habitId, date: today });
  }
  renderHabits();
  renderDashboard();
  updateHabitBadge();
}

// ── Badge update ──────────────────────────────────────
function updateHabitBadge() {
  const habits = LOCAL.get('habits');
  const today = todayStr();
  const completions = LOCAL.get('habit_completions');
  const total = habits.filter(h => h.frequency === 'daily').length;
  const done  = habits.filter(h => h.frequency === 'daily' && completions.some(c => c.habit_id === h.id && c.date === today)).length;
  const el = document.getElementById('cnt-habits-today');
  if (el) el.textContent = total > 0 ? `${done}/${total}` : '';
}

// ── Render ────────────────────────────────────────────
function renderHabits() {
  updateHabitBadge();
  const habits = LOCAL.get('habits');
  const container = document.getElementById('habits-list');
  if (!container) return;

  const dow = ['L','M','M','J','V','S','D'];

  if (!habits.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="ti ti-repeat"></i>
        <p class="empty-title">Sin hábitos todavía</p>
        <p class="empty-sub">Creá un hábito para empezar a construir tu rutina diaria</p>
      </div>`;
    const monthLabelEl = document.getElementById('habits-month-label');
    if (monthLabelEl) monthLabelEl.textContent = getMonthGrid('_', habitsMonthOffset).label;
    return;
  }

  let sharedMonthLabel = '';

  container.innerHTML = habits.map(h => {
    const done   = isHabitDoneToday(h.id);
    const streak = getHabitStreak(h.id);
    const rate   = getHabitRate(h.id);
    const grid   = getMonthGrid(h.id, habitsMonthOffset);
    sharedMonthLabel = grid.label;
    const color  = h.color || '#5b5bd6';

    return `
      <div class="habit-card ${done ? 'is-done' : ''}" style="--habit-color:${color}">
        <div class="habit-main">
          <button class="habit-check ${done ? 'is-done' : ''}"
            onclick="toggleHabitToday('${h.id}')" aria-label="Completar hábito">
            ${done ? '<i class="ti ti-check"></i>' : ''}
          </button>
          <div class="habit-info">
            <span class="habit-title">${escHtml(h.title)}</span>
            <div class="habit-meta">
              <span class="habit-freq-badge">${h.frequency === 'daily' ? 'Diario' : 'Semanal'}</span>
              ${rate > 0 ? `<span class="habit-rate">${rate}% esta semana</span>` : ''}
            </div>
          </div>
          <div class="habit-right">
            ${streak > 1 ? `
              <div class="habit-streak" title="${streak} días seguidos">
                <i class="ti ti-flame"></i>
                <span>${streak}</span>
              </div>` : ''}
            <div class="habit-menu">
              <button class="icon-btn" onclick="openHabitModal('${h.id}')" title="Editar">
                <i class="ti ti-pencil"></i>
              </button>
              <button class="icon-btn icon-btn--danger" onclick="deleteHabit('${h.id}')" title="Eliminar">
                <i class="ti ti-trash"></i>
              </button>
            </div>
          </div>
        </div>
        <div class="habit-month">
          <div class="habit-month-dow">
            ${dow.map(l => `<span>${l}</span>`).join('')}
          </div>
          <div class="habit-month-grid">
            ${grid.weeks.map(week => week.map(cell => {
              if (!cell) return '<span class="habit-month-day is-empty"></span>';
              const cls = [cell.done ? 'done' : '', cell.isFuture ? 'is-future' : ''].filter(Boolean).join(' ');
              const title = `${cell.date}${cell.note ? ' · ' + escHtml(cell.note) : ''}`;
              return cell.isFuture
                ? `<span class="habit-month-day ${cls}" title="${title}">${cell.day}</span>`
                : `<button type="button" class="habit-month-day ${cls}" title="${title}"
                    onclick="openHabitDayPopover('${h.id}','${cell.date}', this)">
                    ${cell.day}${cell.note ? '<span class="habit-day-note-dot"></span>' : ''}
                  </button>`;
            }).join('')).join('')}
          </div>
        </div>
      </div>`;
  }).join('');

  const monthLabelEl = document.getElementById('habits-month-label');
  if (monthLabelEl) monthLabelEl.textContent = sharedMonthLabel;
}

// ── Color selector ────────────────────────────────────
let selectedHabitColor = '#5b5bd6';

function selectHabitColor(color, el) {
  selectedHabitColor = color;
  document.getElementById('habit-color').value = color;
  document.querySelectorAll('.color-opt').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

// ── Modal ─────────────────────────────────────────────
function openHabitModal(editId = null) {
  const form = document.getElementById('habit-form');
  const titleEl = document.getElementById('habit-modal-title');

  document.getElementById('habit-title').value = '';
  document.getElementById('habit-frequency').value = 'daily';
  selectedHabitColor = '#5b5bd6';
  document.getElementById('habit-color').value = selectedHabitColor;
  document.querySelectorAll('.color-opt').forEach(b => b.classList.remove('active'));
  document.querySelector('.color-opt[data-color="#5b5bd6"]')?.classList.add('active');
  form.dataset.editId = '';

  if (editId) {
    const habit = LOCAL.get('habits').find(h => h.id === editId);
    if (habit) {
      document.getElementById('habit-title').value = habit.title;
      document.getElementById('habit-frequency').value = habit.frequency || 'daily';
      selectedHabitColor = habit.color || '#5b5bd6';
      document.getElementById('habit-color').value = selectedHabitColor;
      const colorBtn = document.querySelector(`.color-opt[data-color="${selectedHabitColor}"]`);
      if (colorBtn) { colorBtn.classList.add('active'); }
      form.dataset.editId = editId;
      if (titleEl) titleEl.textContent = 'Editar hábito';
    }
  } else {
    if (titleEl) titleEl.textContent = 'Nuevo hábito';
  }

  openModal('modal-habit-form');
  setTimeout(() => document.getElementById('habit-title')?.focus(), 80);
}

async function submitHabitForm() {
  const title = document.getElementById('habit-title').value.trim();
  if (!title) { document.getElementById('habit-title').focus(); return; }
  const frequency = document.getElementById('habit-frequency').value;
  const color     = document.getElementById('habit-color').value || '#5b5bd6';
  const editId    = document.getElementById('habit-form').dataset.editId;

  if (editId) {
    await dbUpdateHabit(editId, { title, frequency, color });
  } else {
    await dbAddHabit({ id: crypto.randomUUID(), title, frequency, color, days_of_week: [0,1,2,3,4,5,6] });
  }
  closeModal('modal-habit-form');
  renderHabits();
  renderDashboard();
}

let _lastDeletedHabit = null;
let _lastDeletedHabitCompletions = [];

async function deleteHabit(id) {
  _lastDeletedHabit = LOCAL.get('habits').find(h => h.id === id);
  _lastDeletedHabitCompletions = LOCAL.get('habit_completions').filter(c => c.habit_id === id);

  await dbDeleteHabit(id);
  renderHabits();
  renderDashboard();
  updateHabitBadge();

  showToast('Hábito eliminado', async () => {
    if (!_lastDeletedHabit) return;
    // Remove from permanent deletion blacklist so it can be restored
    const deletedKey = 'deleted_habits_' + userId;
    try {
      const ids = JSON.parse(localStorage.getItem(deletedKey) || '[]');
      localStorage.setItem(deletedKey, JSON.stringify(ids.filter(x => x !== _lastDeletedHabit.id)));
    } catch {}
    _pendingHabitDels.delete(_lastDeletedHabit.id);
    const habits = LOCAL.get('habits');
    habits.push(_lastDeletedHabit);
    LOCAL.set('habits', habits);
    const completions = LOCAL.get('habit_completions');
    _lastDeletedHabitCompletions.forEach(c => { if (!completions.find(x => x.id === c.id)) completions.push(c); });
    LOCAL.set('habit_completions', completions);
    _lastDeletedHabit = null;
    _lastDeletedHabitCompletions = [];
    renderHabits();
    renderDashboard();
    updateHabitBadge();
  });
}

// ── Wire up on DOM ready ──────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('add-habit-btn')?.addEventListener('click', () => openHabitModal());
});
