// dashboard.js — Today's overview: tasks, habits and goals at a glance

function renderDashboard() {
  if (!userId) return;
  const today       = todayStr();
  const tasks       = LOCAL.get('tasks');
  const events      = LOCAL.get('events');
  const habits      = LOCAL.get('habits');
  const completions = LOCAL.get('habit_completions');
  const goals       = LOCAL.get('goals');

  // ── Data aggregation ──────────────────────────────
  const overdueTasks = tasks.filter(t => !t.done && t.due_date && t.due_date < today);
  // Bug #10 fix: extract priority fn outside sort to avoid re-allocation per comparison
  const getPriority = t => {
    if (t.due_date && t.due_date < today) return 0;
    if (t.due_date === today || t.task_type === 'daily') return 1;
    if (t.due_date) return 2;
    return 3;
  };
  // "Hoy": overdue + due today + daily tasks — everything that needs attention today
  const todayTasks = tasks
    .filter(t => !t.done && (t.task_type === 'daily' || (t.due_date && t.due_date <= today)))
    .sort((a, b) => getPriority(a) - getPriority(b));

  const dailyHabits = habits.filter(h => h.frequency === 'daily');
  const doneHabits  = dailyHabits.filter(h => completions.some(c => c.habit_id === h.id && c.date === today));
  const activeGoals = goals.filter(g => g.status !== 'completed');

  // ── Greeting ──────────────────────────────────────
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const dateStr  = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  const greetEl = document.getElementById('dash-greeting');
  const dateEl  = document.getElementById('dash-date');
  if (greetEl) greetEl.textContent = greeting;
  if (dateEl)  dateEl.textContent  = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  // ── Stat cards ────────────────────────────────────
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setVal('dash-stat-tasks',   tasks.filter(t => !t.done).length);
  setVal('dash-stat-overdue', overdueTasks.length);
  setVal('dash-stat-habits',  dailyHabits.length ? `${doneHabits.length}/${dailyHabits.length}` : '—');
  setVal('dash-stat-goals',   activeGoals.length);

  // Toggle danger class on overdue card
  const overdueCard = document.getElementById('dash-stat-overdue')?.closest('.stat-card');
  if (overdueCard) overdueCard.classList.toggle('stat-card--danger', overdueTasks.length > 0);

  // ── Category cards ────────────────────────────────
  renderDashboardCategories(tasks);

  // ── Pinned tasks ──────────────────────────────────
  const pinnedTasks = tasks.filter(t => !t.done && t.pinned);
  renderDashboardPinned(pinnedTasks);

  // ── Today tasks list (+ today's calendar events) ──
  const todayEvents = events.filter(e => e.date === today);
  renderDashboardTasks(todayTasks, todayEvents);

  // ── This week, grouped by day (tasks + events) ────
  renderDashboardWeek(tasks, events, today);

  // ── Shopping list ──────────────────────────────────
  if (typeof renderShoppingList === 'function') renderShoppingList();

  // ── Quote of the day ───────────────────────────────
  renderDashboardQuote();

  // ── Habits strip ──────────────────────────────────
  renderDashboardHabits(dailyHabits, completions, today);

  // ── Goals mini list ───────────────────────────────
  renderDashboardGoals(activeGoals);
}

// ── This week: upcoming tasks + calendar events, by day ──
function renderDashboardWeek(tasks, events, today) {
  const container = document.getElementById('dash-week-list');
  if (!container) return;

  const upcoming = tasks.filter(t => !t.done && t.task_type !== 'daily' && t.due_date && t.due_date > today);
  const upcomingEvents = events.filter(e => e.date > today);

  if (!upcoming.length && !upcomingEvents.length) {
    container.innerHTML = `
      <div class="dash-empty">
        <i class="ti ti-calendar-event"></i>
        <span>Sin tareas ni eventos programados esta semana</span>
      </div>`;
    return;
  }

  const customCats = getCustomCategories ? getCustomCategories() : [];
  const catLabels = { trabajo:'Trabajo', personal:'Personal', estudio:'Estudio', salud:'Salud', otro:'Otro' };
  customCats.forEach(c => { catLabels['custom-' + c.id] = c.name; });

  // Group tasks and events by date, keep only the next 7 distinct upcoming days
  const tasksByDate = {};
  upcoming.forEach(t => { (tasksByDate[t.due_date] = tasksByDate[t.due_date] || []).push(t); });
  const eventsByDate = {};
  upcomingEvents.forEach(e => { (eventsByDate[e.date] = eventsByDate[e.date] || []).push(e); });

  const dates = [...new Set([...Object.keys(tasksByDate), ...Object.keys(eventsByDate)])].sort().slice(0, 7);

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  container.innerHTML = dates.map(date => {
    const d = new Date(date + 'T12:00:00');
    let label;
    if (date === tomorrowStr) label = 'Mañana';
    else label = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' });
    label = label.charAt(0).toUpperCase() + label.slice(1);

    const dayTasks  = tasksByDate[date]  || [];
    const dayEvents = eventsByDate[date] || [];

    return `
      <div class="dash-week-day">
        <div class="dash-week-day-hdr">${label}</div>
        ${dayEvents.map(e => `
          <div class="dash-task-row dash-event-row" onclick="showSection('calendar'); selectDay('${date}')">
            <span class="dash-event-dot"><i class="ti ti-calendar-event"></i></span>
            <div class="dash-task-body">
              <span class="dash-task-text">${escHtml(e.label)}</span>
            </div>
          </div>`).join('')}
        ${dayTasks.map(t => `
          <div class="dash-task-row" data-id="${t.id}" onclick="setView('inbox'); setTimeout(()=>openTaskDetail('${t.id}'),80)">
            <button class="task-check" onclick="event.stopPropagation(); toggleTask('${t.id}')" aria-label="Completar"></button>
            <div class="dash-task-body">
              <span class="dash-task-text">${escHtml(t.text)}</span>
            </div>
            <div class="dash-task-chips">
              ${t.category ? `<span class="cat-chip cat-${t.category.startsWith('custom-') ? 'otro' : t.category}">${catLabels[t.category] || t.category}</span>` : ''}
            </div>
          </div>`).join('')}
      </div>`;
  }).join('');
}

// ── Quote of the day widget ────────────────────────────
function renderDashboardQuote() {
  const container = document.getElementById('dash-quote-widget');
  if (!container) return;
  const quote = typeof getQuoteOfTheDay === 'function' ? getQuoteOfTheDay() : null;

  if (!quote) {
    container.innerHTML = `
      <div class="dash-empty">
        <i class="ti ti-quote"></i>
        <span>Guardá frases que te inspiren</span>
        <button class="btn-link" onclick="showSection('quotes')">Agregar frase</button>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="dash-quote">
      <i class="ti ti-quote quote-mark"></i>
      <p class="dash-quote-text">${escHtml(quote.text)}</p>
      ${quote.author ? `<p class="dash-quote-author">— ${escHtml(quote.author)}</p>` : ''}
    </div>`;
}

function renderDashboardTasks(tasks, todayEvents = []) {
  const container = document.getElementById('dash-tasks-list');
  if (!container) return;

  if (!tasks.length && !todayEvents.length) {
    container.innerHTML = `
      <div class="dash-empty">
        <i class="ti ti-checks"></i>
        <span>Sin tareas para hoy</span>
      </div>`;
    return;
  }

  const customCats = getCustomCategories ? getCustomCategories() : [];
  const catLabels = { trabajo:'Trabajo', personal:'Personal', estudio:'Estudio', salud:'Salud', otro:'Otro' };
  customCats.forEach(c => { catLabels['custom-' + c.id] = c.name; });

  const eventsHtml = todayEvents.map(e => `
    <div class="dash-task-row dash-event-row" onclick="showSection('calendar'); selectDay('${e.date}')">
      <span class="dash-event-dot"><i class="ti ti-calendar-event"></i></span>
      <div class="dash-task-body">
        <span class="dash-task-text">${escHtml(e.label)}</span>
      </div>
    </div>`).join('');

  const tasksHtml = tasks.slice(0, 8).map(t => {
    const isDaily  = t.task_type === 'daily';
    const today    = todayStr();
    const overdue  = !t.done && t.due_date && t.due_date < today;
    const isToday  = t.due_date === today;
    const dueCls   = overdue ? 'is-overdue' : isToday ? 'is-today' : '';

    const subtasks = typeof dbGetSubtasks === 'function' ? dbGetSubtasks(t.id) : [];
    const subDone  = subtasks.filter(s => s.done).length;
    const subTotal = subtasks.length;
    const subPct   = subTotal > 0 ? Math.round(subDone / subTotal * 100) : 0;

    return `
      <div class="dash-task-row" data-id="${t.id}" onclick="setView('inbox'); setTimeout(()=>openTaskDetail('${t.id}'),80)">
        <button class="task-check ${t.done ? 'is-done' : ''}"
          onclick="event.stopPropagation(); toggleTask('${t.id}')" aria-label="Completar"></button>
        <div class="dash-task-body">
          <span class="dash-task-text ${t.done ? 'is-done' : ''}">${escHtml(t.text)}</span>
          ${subTotal > 0 ? `
          <div class="task-subtask-info">
            <div class="task-subtask-bar"><div class="task-subtask-fill" style="width:${subPct}%"></div></div>
            <span class="task-subtask-count">${subDone}/${subTotal}</span>
          </div>` : ''}
        </div>
        <div class="dash-task-chips">
          ${isDaily ? `<span class="type-badge type-daily"><i class="ti ti-sun"></i></span>` : ''}
          ${t.category ? `<span class="cat-chip cat-${t.category}">${catLabels[t.category] || t.category}</span>` : ''}
          ${t.due_date && !isDaily ? `<span class="due-chip ${dueCls}">${fmtDueDate(t.due_date)}</span>` : ''}
        </div>
      </div>`;
  }).join('');

  container.innerHTML = eventsHtml + tasksHtml;

  if (tasks.length > 8) {
    container.innerHTML += `
      <button class="btn-link dash-see-more" onclick="setView('inbox')">
        Ver ${tasks.length - 8} más…
      </button>`;
  }
}

function renderDashboardHabits(habits, completions, today) {
  const container = document.getElementById('dash-habits-strip');
  if (!container) return;

  if (!habits.length) {
    container.innerHTML = `
      <div class="dash-empty">
        <i class="ti ti-repeat"></i>
        <span>No hay hábitos configurados</span>
        <button class="btn-link" onclick="showSection('habits')">Crear hábito</button>
      </div>`;
    return;
  }

  container.innerHTML = habits.map(h => {
    const done   = completions.some(c => c.habit_id === h.id && c.date === today);
    const streak = getHabitStreak(h.id);
    const color  = h.color || '#5b5bd6';

    return `
      <button class="dash-habit-item ${done ? 'done' : ''}"
        style="--habit-color:${color}"
        onclick="toggleHabitToday('${h.id}')"
        title="${escHtml(h.title)}${streak > 1 ? ' · ' + streak + ' días' : ''}">
        <span class="dhi-check">${done ? '<i class="ti ti-check"></i>' : ''}</span>
        <span class="dhi-name">${escHtml(h.title)}</span>
        ${streak > 1 ? `<span class="dhi-streak"><i class="ti ti-flame"></i>${streak}</span>` : ''}
      </button>`;
  }).join('');
}

function renderDashboardGoals(goals) {
  const container = document.getElementById('dash-goals-list');
  if (!container) return;

  if (!goals.length) {
    container.innerHTML = `
      <div class="dash-empty">
        <i class="ti ti-target"></i>
        <span>Sin objetivos activos</span>
        <button class="btn-link" onclick="showSection('goals')">Crear objetivo</button>
      </div>`;
    return;
  }

  container.innerHTML = goals.slice(0, 5).map(g => {
    const progress = getGoalProgress(g);
    const cat = getCatMeta(g.category);

    return `
      <div class="dash-goal-row" onclick="showSection('goals')" title="Ver objetivos">
        <div class="dgr-left">
          <span class="dgr-dot" style="background:${cat.color}">
            <i class="ti ${cat.icon}"></i>
          </span>
          <div class="dgr-info">
            <span class="dgr-title">${escHtml(g.title)}</span>
            <span class="dgr-cat">${cat.label}</span>
          </div>
        </div>
        <div class="dgr-right">
          <span class="dgr-pct">${progress}%</span>
          <div class="dgr-bar-wrap">
            <div class="dgr-bar" style="width:${progress}%;background:${cat.color}"></div>
          </div>
        </div>
      </div>`;
  }).join('');

  if (goals.length > 5) {
    container.innerHTML += `
      <button class="btn-link dash-see-more" onclick="showSection('goals')">
        Ver todos (${goals.length})
      </button>`;
  }
}

function renderDashboardCategories(tasks) {
  const container = document.getElementById('dash-cats-grid');
  if (!container) return;

  const defaultCats = [
    { id: 'trabajo',  name: 'Trabajo',  color: '#0284c7', view: 'cat-trabajo'  },
    { id: 'personal', name: 'Personal', color: '#ea580c', view: 'cat-personal' },
    { id: 'estudio',  name: 'Estudio',  color: '#7c3aed', view: 'cat-estudio'  },
    { id: 'salud',    name: 'Salud',    color: '#16a34a', view: 'cat-salud'    },
    { id: 'otro',     name: 'Otro',     color: '#6b7280', view: 'cat-otro'     },
  ];

  const customCats = (typeof getCustomCategories === 'function' ? getCustomCategories() : [])
    .map(c => ({ id: 'custom-' + c.id, name: c.name, color: c.color, view: 'cat-custom-' + c.id }));

  const allCats = [...defaultCats, ...customCats];

  const countFor = (cat) => {
    if (cat.view === 'cat-otro') return tasks.filter(t => !t.done && (!t.category || t.category === 'otro')).length;
    return tasks.filter(t => !t.done && t.category === cat.id).length;
  };

  container.innerHTML = allCats.map(cat => {
    const count = countFor(cat);
    return `
      <button class="dash-cat-card" onclick="setView('${cat.view}')" style="--cat-accent:${cat.color}">
        <span class="dash-cat-dot" style="background:${cat.color}"></span>
        <span class="dash-cat-name">${escHtml(cat.name)}</span>
        <span class="dash-cat-count">${count}</span>
      </button>`;
  }).join('');

  container.innerHTML += `
    <button class="dash-cat-card dash-cat-card--add" onclick="openCategoryModal()">
      <i class="ti ti-plus"></i>
      <span class="dash-cat-name">Nueva</span>
    </button>`;
}

function renderDashboardPinned(pinnedTasks) {
  const section = document.getElementById('dash-pinned-section');
  const container = document.getElementById('dash-pinned-list');
  if (!section || !container) return;

  if (!pinnedTasks.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;

  const customCats = typeof getCustomCategories === 'function' ? getCustomCategories() : [];
  const catLabels = { trabajo:'Trabajo', personal:'Personal', estudio:'Estudio', salud:'Salud', otro:'Otro' };
  customCats.forEach(c => { catLabels['custom-' + c.id] = c.name; });

  container.innerHTML = pinnedTasks.map(t => {
    const today = todayStr();
    const overdue = !t.done && t.due_date && t.due_date < today;
    const isToday = t.due_date === today;
    const dueCls  = overdue ? 'is-overdue' : isToday ? 'is-today' : '';

    return `
      <div class="dash-task-row dash-task-row--pinned" data-id="${t.id}" onclick="setView('inbox'); setTimeout(()=>openTaskDetail('${t.id}'),80)">
        <button class="task-check ${t.done ? 'is-done' : ''}"
          onclick="event.stopPropagation(); toggleTask('${t.id}')" aria-label="Completar"></button>
        <div class="dash-task-body">
          <span class="dash-task-text">${escHtml(t.text)}</span>
        </div>
        <div class="dash-task-chips">
          ${t.category ? `<span class="cat-chip cat-${t.category.startsWith('custom-') ? 'otro' : t.category}">${catLabels[t.category] || t.category}</span>` : ''}
          ${t.due_date && t.task_type !== 'daily' ? `<span class="due-chip ${dueCls}">${fmtDueDate(t.due_date)}</span>` : ''}
          <button class="pin-btn is-pinned" onclick="event.stopPropagation(); togglePin(event,'${t.id}')" title="Quitar del inicio">
            <i class="ti ti-pin"></i>
          </button>
        </div>
      </div>`;
  }).join('');
}
