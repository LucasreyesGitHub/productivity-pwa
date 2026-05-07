let calDate = new Date();
let selectedDate = null;

function changeMonth(d) {
  calDate = new Date(calDate.getFullYear(), calDate.getMonth() + d, 1);
  renderCal();
}

function selectDay(dateStr) {
  selectedDate = dateStr;
  document.getElementById('selected-day-label').textContent = 'Evento para: ' + formatDate(dateStr);
  document.getElementById('event-input-row').style.display = 'flex';
  document.getElementById('event-label').focus();
  renderCal();
}

async function addEvent() {
  if (!selectedDate) return;
  const label = document.getElementById('event-label').value.trim();
  if (!label) return;
  setSyncStatus('syncing', 'Guardando...');
  await dbAddEvent({ id: crypto.randomUUID(), date: selectedDate, label });
  document.getElementById('event-label').value = '';
  document.getElementById('event-input-row').style.display = 'none';
  document.getElementById('selected-day-label').textContent = 'Seleccioná un día para agregar un evento';
  selectedDate = null;
  setSyncStatus('synced', 'Sincronizado');
  renderCal();
}

async function deleteEvent(id) {
  await dbDeleteEvent(id);
  renderCal();
}

function renderCal() {
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const today = new Date();
  const y = calDate.getFullYear(), m = calDate.getMonth();
  document.getElementById('cal-month-label').textContent = months[m] + ' ' + y;
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();
  const events = LOCAL.get('events');
  const markedDates = events.map(e => e.date);
  const dows = ['Do','Lu','Ma','Mi','Ju','Vi','Sa'];
  let html = '<div class="cal-dow-row">' + dows.map(d => `<div class="cal-dow">${d}</div>`).join('') + '</div><div class="cal-days-grid">';
  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day other-month">${prevDays - firstDay + i + 1}</div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = y + '-' + String(m + 1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    const isToday = d === today.getDate() && m === today.getMonth() && y === today.getFullYear();
    const isSel = selectedDate === dateStr;
    const hasEv = markedDates.includes(dateStr);
    html += `<div class="cal-day ${isToday?'today':''} ${isSel&&!isToday?'selected':''} ${hasEv?'has-event':''}" onclick="selectDay('${dateStr}')">${d}</div>`;
  }
  html += '</div>';
  document.getElementById('cal-grid').innerHTML = '<div class="cal-grid-wrap">' + html + '</div>';
  const evList = document.getElementById('events-list');
  const sorted = [...events].sort((a,b) => a.date.localeCompare(b.date));
  if (!sorted.length) { evList.innerHTML = '<div class="empty">Sin eventos marcados</div>'; return; }
  evList.innerHTML = sorted.map(e => `
    <div class="event-item">
      <div class="event-dot"></div>
      <span>${escHtml(e.label)}</span>
      <span class="event-date">${formatDate(e.date)}</span>
      <button class="del-btn" onclick="deleteEvent('${e.id}')" aria-label="eliminar"><i class="ti ti-x"></i></button>
    </div>
  `).join('');
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return d + '/' + m + '/' + y;
}
