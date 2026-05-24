// stats.js — Productivity metrics and visual summaries

function renderStats() {
  const container = document.getElementById('stats-content');
  if (!container) return;

  const today       = todayStr();
  const tasks       = LOCAL.get('tasks');
  const habits      = LOCAL.get('habits');
  const completions = LOCAL.get('habit_completions');
  const goals       = LOCAL.get('goals');

  // ── Task stats ────────────────────────────────────
  const doneTasks     = tasks.filter(t => t.done).length;
  const pendingTasks  = tasks.filter(t => !t.done).length;
  const overdueTasks  = tasks.filter(t => !t.done && t.due_date && t.due_date < today).length;
  const totalTasks    = tasks.length;

  // ── Habit stats ───────────────────────────────────
  const totalHabits   = habits.length;
  const completedToday = completions.filter(c => c.date === today).length;

  // Best streak across all habits
  const bestStreak = habits.reduce((max, h) => {
    const s = getHabitStreak(h.id);
    return s > max ? s : max;
  }, 0);

  // 7-day habit completion rate
  const last7Rates = habits.map(h => getHabitRate(h.id, 7));
  const avgRate7   = habits.length
    ? Math.round(last7Rates.reduce((a, b) => a + b, 0) / habits.length)
    : 0;

  // ── Goal stats ────────────────────────────────────
  const activeGoals    = goals.filter(g => g.status === 'active').length;
  const completedGoals = goals.filter(g => g.status === 'completed').length;
  const avgGoalProg    = goals.length
    ? Math.round(goals.reduce((sum, g) => sum + getGoalProgress(g), 0) / goals.length)
    : 0;

  // ── Weekly task completion (last 7 days) ──────────
  const weekData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const ds    = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('es-AR', { weekday: 'short' });
    const done  = tasks.filter(t => t.done && t.created_at?.startsWith(ds)).length;
    return { label, done };
  });
  const maxWeek = Math.max(...weekData.map(d => d.done), 1);

  // ── Category distribution ─────────────────────────
  const cats = ['trabajo', 'personal', 'estudio', 'salud', 'otro'];
  const catLabels = { trabajo:'Trabajo', personal:'Personal', estudio:'Estudio', salud:'Salud', otro:'Otro' };
  const catColors = { trabajo:'#0091ff', personal:'#8e4ec6', estudio:'#f76b15', salud:'#e5484d', otro:'#6e6e73' };
  const catDist = cats.map(c => ({
    key: c,
    label: catLabels[c],
    color: catColors[c],
    count: tasks.filter(t => t.category === c || (!t.category && c === 'otro')).length,
  })).filter(d => d.count > 0);
  const maxCat = Math.max(...catDist.map(d => d.count), 1);

  container.innerHTML = `
    <!-- Summary cards -->
    <div class="stats-cards">
      <div class="stats-card">
        <div class="stats-card-icon" style="background:var(--accent-soft);color:var(--accent)">
          <i class="ti ti-checkbox"></i>
        </div>
        <div class="stats-card-body">
          <span class="stats-val">${doneTasks}</span>
          <span class="stats-lbl">Tareas completadas</span>
        </div>
      </div>
      <div class="stats-card">
        <div class="stats-card-icon" style="background:rgba(229,72,77,0.1);color:#e5484d">
          <i class="ti ti-clock-exclamation"></i>
        </div>
        <div class="stats-card-body">
          <span class="stats-val">${overdueTasks}</span>
          <span class="stats-lbl">Tareas vencidas</span>
        </div>
      </div>
      <div class="stats-card">
        <div class="stats-card-icon" style="background:rgba(247,107,21,0.1);color:#f76b15">
          <i class="ti ti-flame"></i>
        </div>
        <div class="stats-card-body">
          <span class="stats-val">${bestStreak}</span>
          <span class="stats-lbl">Mejor racha actual</span>
        </div>
      </div>
      <div class="stats-card">
        <div class="stats-card-icon" style="background:rgba(48,164,108,0.1);color:#30a46c">
          <i class="ti ti-target"></i>
        </div>
        <div class="stats-card-body">
          <span class="stats-val">${avgGoalProg}%</span>
          <span class="stats-lbl">Progreso promedio en objetivos</span>
        </div>
      </div>
    </div>

    <div class="stats-grid">
      <!-- Weekly activity chart -->
      <div class="stats-widget">
        <h3 class="stats-widget-title">Actividad semanal</h3>
        <div class="bar-chart">
          ${weekData.map(d => `
            <div class="bar-col">
              <div class="bar-fill" style="height:${Math.round((d.done / maxWeek) * 100)}%"
                title="${d.done} tareas">
                ${d.done > 0 ? `<span class="bar-val">${d.done}</span>` : ''}
              </div>
              <span class="bar-label">${d.label}</span>
            </div>`).join('')}
        </div>
      </div>

      <!-- Habits today -->
      <div class="stats-widget">
        <h3 class="stats-widget-title">Hábitos</h3>
        <div class="stats-habit-list">
          ${habits.length ? habits.map(h => {
            const rate   = getHabitRate(h.id, 30);
            const streak = getHabitStreak(h.id);
            const color  = h.color || '#5b5bd6';
            return `
              <div class="stats-habit-row">
                <div class="shr-info">
                  <span class="shr-dot" style="background:${color}"></span>
                  <span class="shr-name">${escHtml(h.title)}</span>
                  ${streak > 0 ? `<span class="shr-streak"><i class="ti ti-flame"></i>${streak}</span>` : ''}
                </div>
                <div class="shr-right">
                  <div class="shr-bar-wrap">
                    <div class="shr-bar" style="width:${rate}%;background:${color}"></div>
                  </div>
                  <span class="shr-pct">${rate}%</span>
                </div>
              </div>`;
          }).join('') : '<p class="stats-empty">Sin hábitos configurados</p>'}
        </div>
      </div>

      <!-- Category distribution -->
      ${catDist.length ? `
        <div class="stats-widget">
          <h3 class="stats-widget-title">Distribución por categoría</h3>
          <div class="cat-dist">
            ${catDist.map(d => `
              <div class="cat-dist-row">
                <span class="cat-dist-label">${d.label}</span>
                <div class="cat-dist-bar-wrap">
                  <div class="cat-dist-bar" style="width:${Math.round((d.count/maxCat)*100)}%;background:${d.color}"></div>
                </div>
                <span class="cat-dist-count">${d.count}</span>
              </div>`).join('')}
          </div>
        </div>` : ''}

      <!-- Goals overview -->
      <div class="stats-widget">
        <h3 class="stats-widget-title">Objetivos</h3>
        ${goals.length ? `
          <div class="stats-goals-list">
            ${goals.map(g => {
              const progress = getGoalProgress(g);
              const cat = getCatMeta(g.category);
              return `
                <div class="sgl-row">
                  <div class="sgl-info">
                    <span class="sgl-dot" style="background:${cat.color}">
                      <i class="ti ${cat.icon}"></i>
                    </span>
                    <span class="sgl-name">${escHtml(g.title)}</span>
                  </div>
                  <div class="sgl-bar-wrap">
                    <div class="sgl-bar" style="width:${progress}%;background:${cat.color}"></div>
                  </div>
                  <span class="sgl-pct">${progress}%</span>
                </div>`;
            }).join('')}
          </div>` : '<p class="stats-empty">Sin objetivos configurados</p>'}
      </div>
    </div>`;
}
