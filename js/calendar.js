// calendar.js — Calendar with events + task due-date integration

let calDate     = new Date();
let selectedDate = null;

// ── Month navigation ───────────────────────────────────
function changeMonth(d) {
  calDate = new Date(calDate.getFullYear(), calDate.getMonth() + d, 1);
  selectedDate = null;
  renderCal();
}

// ── Day selection ──────────────────────────────────────
function selectDay(dateStr) {
  selectedDate = selectedDate === dateStr ? null : dateStr;
  renderCal();
  if (selectedDate) {
    document.getElementById('day-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// ── Event CRUD ─────────────────────────────────────────
async function addEvent() {
  if (!selectedDate) return;
  const label = document.getElementById('event-label').value.trim();
  if (!label) { document.getElementById('event-label').focus(); return; }
  setSyncStatus('syncing', 'Guardando...');
  await dbAddEvent({ id: crypto.randomUUID(), date: selectedDate, label });
  document.getElementById('event-label').value = '';
  setSyncStatus('synced', 'Sincronizado');
  renderCal();
}

async function deleteEvent(id) {
  await dbDeleteEvent(id);
  renderCal();
}

// ── Main render ────────────────────────────────────────
function renderCal() {
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const today  = new Date();
  const y = calDate.getFullYear(), m = calDate.getMonth();

  document.getElementById('cal-month-label').textContent = months[m] + ' ' + y;

  const firstDay    = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const prevDays    = new Date(y, m, 0).getDate();

  const events = LOCAL.get('events');
  const tasks  = LOCAL.get('tasks');

  // Index events and tasks by date for O(1) lookup
  const eventsByDate = {};
  events.forEach(e => { (eventsByDate[e.date] = eventsByDate[e.date] || []).push(e); });

  const tasksByDate = {};
  tasks.filter(t => !t.done && t.due_date).forEach(t => {
    (tasksByDate[t.due_date] = tasksByDate[t.due_date] || []).push(t);
  });

  // Build calendar grid
  const dows = ['Do','Lu','Ma','Mi','Ju','Vi','Sa'];
  let html = '<div class="cal-dow-row">' + dows.map(d => `<div class="cal-dow">${d}</div>`).join('') + '</div>';
  html += '<div class="cal-days-grid">';

  // Prev month padding
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-day other-month">${prevDays - firstDay + i + 1}</div>`;
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr  = `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday  = d === today.getDate() && m === today.getMonth() && y === today.getFullYear();
    const isSel    = selectedDate === dateStr;
    const hasEv    = !!eventsByDate[dateStr];
    const hasTasks = !!tasksByDate[dateStr];
    const taskOverdue = hasTasks && tasksByDate[dateStr].some(t => t.due_date < todayStr());

    const dotHtml = (hasEv || hasTasks) ? `
      <div class="cal-day-dots">
        ${hasEv    ? '<span class="cal-dot cal-dot--event"></span>' : ''}
        ${hasTasks ? `<span class="cal-dot cal-dot--task${taskOverdue ? ' cal-dot--overdue' : ''}"></span>` : ''}
      </div>` : '';

    html += `
      <div class="cal-day ${isToday?'today':''} ${isSel?'selected':''} ${hasTasks?'has-task':''} ${hasEv?'has-event':''}"
           onclick="selectDay('${dateStr}')"
           title="${hasTasks ? tasksByDate[dateStr].length + ' tarea(s)' : ''}">
        <span class="cal-day-num">${d}</span>
        ${dotHtml}
      </div>`;
  }
  html += '</div>';
  document.getElementById('cal-grid').innerHTML = '<div class="cal-grid-wrap">' + html + '</div>';

  // Render day detail panel
  renderDayPanel(tasksByDate, eventsByDate);

  // Render upcoming tasks sidebar
  renderCalTaskSidebar(tasksByDate, y, m);

  // Render full events list
  renderEventsList(events);
}

// ── Day panel (selected day detail) ───────────────────
function renderDayPanel(tasksByDate, eventsByDate) {
  const panel = document.getElementById('day-panel');
  if (!panel) return;

  if (!selectedDate) {
    panel.classList.add('hidden');
    return;
  }

  const dayTasks  = tasksByDate[selectedDate]  || [];
  const dayEvents = eventsByDate[selectedDate] || [];

  if (!dayTasks.length && !dayEvents.length) {
    panel.innerHTML = `
      <div class="day-panel-hdr">
        <span class="day-panel-title">${formatDateLong(selectedDate)}</span>
        <button class="day-panel-close" onclick="selectedDate=null;renderCal()" aria-label="Cerrar">
          <i class="ti ti-x"></i>
        </button>
      </div>
      <div class="day-panel-empty">
        <i class="ti ti-sun"></i>
        <span>Día libre — sin tareas ni eventos</span>
        <div class="day-panel-empty-actions">
          <button class="btn-primary btn-sm" onclick="openQuickAdd('${selectedDate}')">
            <i class="ti ti-plus"></i> Nueva tarea
          </button>
          <button class="btn-secondary btn-sm" onclick="document.getElementById('event-label-inline')?.focus()">
            <i class="ti ti-calendar-plus"></i> Nuevo evento
          </button>
        </div>
      </div>
      <div class="day-panel-add">
        <input class="day-event-input" id="event-label-inline" placeholder="Nuevo evento para este día…"
          onkeydown="if(event.key==='Enter'){document.getElementById('event-label').value=this.value;addEvent()}">
        <button class="btn-primary btn-sm" onclick="document.getElementById('event-label').value=document.getElementById('event-label-inline').value;addEvent()">
          Agregar
        </button>
      </div>`;
    panel.classList.remove('hidden');
    return;
  }

  const catLabels = { trabajo:'Trabajo', personal:'Personal', estudio:'Estudio', salud:'Salud', otro:'Otro' };

  const taskRows = dayTasks.map(t => {
    const overdue = t.due_date < todayStr();
    return `
      <div class="day-task-row" onclick="setView('inbox');setTimeout(()=>openTaskDetail('${t.id}'),80)">
        <button class="task-check${t.done?' is-done':''}"
          onclick="event.stopPropagation();toggleTask('${t.id}')" aria-label="Completar"></button>
        <span class="day-task-text">${escHtml(t.text)}</span>
        ${t.category ? `<span class="cat-chip cat-${t.category}">${catLabels[t.category]||t.category}</span>` : ''}
        ${overdue ? `<span class="due-chip is-overdue">Vencida</span>` : ''}
      </div>`;
  }).join('');

  const eventRows = dayEvents.map(e => `
    <div class="day-event-row">
      <span class="cal-dot cal-dot--event"></span>
      <span class="day-event-label">${escHtml(e.label)}</span>
      <button class="subtask-del" onclick="deleteEvent('${e.id}')" aria-label="Eliminar">
        <i class="ti ti-x"></i>
      </button>
    </div>`).join('');

  panel.innerHTML = `
    <div class="day-panel-hdr">
      <span class="day-panel-title">${formatDateLong(selectedDate)}</span>
      <button class="day-panel-close" onclick="selectedDate=null;renderCal()" aria-label="Cerrar">
        <i class="ti ti-x"></i>
      </button>
    </div>
    ${dayTasks.length ? `
    <div class="day-panel-section">
      <span class="day-panel-section-label"><i class="ti ti-checks"></i> Tareas (${dayTasks.length})</span>
      <div class="day-tasks-list">${taskRows}</div>
    </div>` : ''}
    ${dayEvents.length ? `
    <div class="day-panel-section">
      <span class="day-panel-section-label"><i class="ti ti-calendar-event"></i> Eventos (${dayEvents.length})</span>
      <div class="day-events-list">${eventRows}</div>
    </div>` : ''}
    <div class="day-panel-add">
      <button class="btn-primary btn-sm day-panel-add-task" onclick="openQuickAdd('${selectedDate}')">
        <i class="ti ti-plus"></i> Nueva tarea
      </button>
      <div class="day-panel-event-row">
        <input class="day-event-input" id="event-label-inline" placeholder="Nuevo evento…"
          onkeydown="if(event.key==='Enter'){document.getElementById('event-label').value=this.value;addEvent()}">
        <button class="btn-secondary btn-sm" onclick="document.getElementById('event-label').value=document.getElementById('event-label-inline').value;addEvent()">
          + Evento
        </button>
      </div>
    </div>`;
  panel.classList.remove('hidden');

  // Keep hidden input in sync with event-label
  const inlineInput = document.getElementById('event-label-inline');
  if (inlineInput) {
    inlineInput.addEventListener('input', () => {
      const hidden = document.getElementById('event-label');
      if (hidden) hidden.value = inlineInput.value;
    });
  }
}

// ── Calendar task sidebar (upcoming tasks this month) ──
function renderCalTaskSidebar(tasksByDate, y, m) {
  const sidebar = document.getElementById('cal-tasks-sidebar');
  if (!sidebar) return;

  const monthStart = `${y}-${String(m + 1).padStart(2,'0')}-01`;
  const lastDay    = new Date(y, m + 1, 0).getDate();
  const monthEnd   = `${y}-${String(m + 1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
  const today      = todayStr();

  const catLabels = { trabajo:'Trabajo', personal:'Personal', estudio:'Estudio', salud:'Salud', otro:'Otro' };

  // Collect all tasks in month, sorted by date
  const monthEntries = Object.entries(tasksByDate)
    .filter(([date]) => date >= monthStart && date <= monthEnd)
    .sort(([a], [b]) => a.localeCompare(b));

  if (!monthEntries.length) {
    sidebar.innerHTML = `
      <div class="cal-sidebar-empty">
        <i class="ti ti-calendar-off"></i>
        <span>Sin tareas con fecha en ${['Enero','Febrero','Marzo','Abril','Mayo','Junio',
          'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][m]}</span>
        <button class="btn-link" onclick="openQuickAdd()">+ Agregar tarea</button>
      </div>`;
    return;
  }

  sidebar.innerHTML = monthEntries.map(([date, tasks]) => {
    const isOverdue = date < today;
    const isToday   = date === today;
    const dateLabel = isToday ? 'Hoy' : (isOverdue ? `⚠ ${formatDateShort(date)}` : formatDateShort(date));

    const taskHtml = tasks.map(t => `
      <div class="cal-sidebar-task${isOverdue?' cal-task-overdue':''}"
           onclick="selectDay('${date}');setView('inbox');setTimeout(()=>openTaskDetail('${t.id}'),80)">
        <button class="task-check${t.done?' is-done':''}"
          onclick="event.stopPropagation();toggleTask('${t.id}')" aria-label="Completar"></button>
        <span class="cal-task-title">${escHtml(t.text)}</span>
        ${t.category ? `<span class="cat-chip cat-${t.category}">${catLabels[t.category]||t.category}</span>` : ''}
        <span class="pri-pip p-${t.priority||'med'}"></span>
      </div>`).join('');

    return `
      <div class="cal-sidebar-group">
        <div class="cal-sidebar-date${isToday?' cal-date-today':''}${isOverdue?' cal-date-overdue':''}">${dateLabel}</div>
        <div class="cal-sidebar-tasks">${taskHtml}</div>
      </div>`;
  }).join('');
}

// ── Events list (full list below calendar) ─────────────
function renderEventsList(events) {
  const evList = document.getElementById('events-list');
  if (!evList) return;
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) {
    evList.innerHTML = '<div class="cal-events-empty">Sin eventos marcados este mes</div>';
    return;
  }
  evList.innerHTML = sorted.map(e => `
    <div class="event-item">
      <div class="event-dot"></div>
      <span>${escHtml(e.label)}</span>
      <span class="event-date">${formatDate(e.date)}</span>
      <button class="del-btn" onclick="deleteEvent('${e.id}')" aria-label="Eliminar">
        <i class="ti ti-x"></i>
      </button>
    </div>`).join('');
}

// ── Date format helpers ────────────────────────────────
function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatDateLong(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}
