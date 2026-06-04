// dashboard.js — Today's overview: tasks, habits and goals at a glance

function renderDashboard() {
  if (!userId) return;
  const today       = todayStr();
  const tasks       = LOCAL.get('tasks');
  const habits      = LOCAL.get('habits');
  const completions = LOCAL.get('habit_completions');
  const goals       = LOCAL.get('goals');

  // ── Data aggregation ──────────────────────────────
  const overdueTasks = tasks.filter(t => !t.done && t.due_date && t.due_date < today);
  // Show all pending tasks, sorted by urgency: overdue → today/daily → upcoming → no date
  const allForToday = tasks
    .filter(t => !t.done)
    .sort((a, b) => {
      const rank = t => {
        if (t.due_date && t.due_date < today) return 0;
        if (t.due_date === today || t.task_type === 'daily') return 1;
        if (t.due_date) return 2;
        return 3;
      };
      return rank(a) - rank(b);
    });

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

  // ── Today tasks list ──────────────────────────────
  renderDashboardTasks(allForToday);

  // ── Habits strip ──────────────────────────────────
  renderDashboardHabits(dailyHabits, completions, today);

  // ── Goals mini list ───────────────────────────────
  renderDashboardGoals(activeGoals);
}

function renderDashboardTasks(tasks) {
  const container = document.getElementById('dash-tasks-list');
  if (!container) return;

  if (!tasks.length) {
    container.innerHTML = `
      <div class="dash-empty">
        <i class="ti ti-checks"></i>
        <span>Sin tareas para hoy</span>
      </div>`;
    return;
  }

  const catLabels = { trabajo:'Trabajo', personal:'Personal', estudio:'Estudio', salud:'Salud', otro:'Otro' };

  container.innerHTML = tasks.slice(0, 8).map(t => {
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
