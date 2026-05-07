async function addIdea() {
  const name = document.getElementById('idea-name').value.trim();
  const desc = document.getElementById('idea-desc').value.trim();
  const tag  = document.getElementById('idea-tag').value;
  if (!name) return;
  setSyncStatus('syncing', 'Guardando...');
  await dbAddIdea({ id: crypto.randomUUID(), name, desc: desc, tag });
  document.getElementById('idea-name').value = '';
  document.getElementById('idea-desc').value = '';
  setSyncStatus('synced', 'Sincronizado');
  renderIdeas();
}

async function deleteIdea(id) {
  await dbDeleteIdea(id);
  renderIdeas();
}

function renderIdeas() {
  const ideas = LOCAL.get('ideas');
  const grid = document.getElementById('ideas-grid');
  document.getElementById('idea-count').textContent = ideas.length;
  const tagLabels = { diseño:'Diseño', tech:'Tech', negocio:'Negocio', personal:'Personal', otro:'Otro' };
  if (!ideas.length) { grid.innerHTML = '<div class="empty" style="grid-column:1/-1">Sin ideas aún</div>'; return; }
  grid.innerHTML = ideas.map(i => `
    <div class="idea-card">
      <span class="idea-tag-badge t-${i.tag}">${tagLabels[i.tag]}</span>
      <div class="idea-name">${escHtml(i.name)}</div>
      ${i.description ? `<div class="idea-desc">${escHtml(i.description)}</div>` : ''}
      <button class="del-btn idea-del" onclick="deleteIdea('${i.id}')" aria-label="eliminar"><i class="ti ti-x"></i></button>
    </div>
  `).join('');
}

function exportJSON() {
  const data = {
    tasks:  LOCAL.get('tasks'),
    events: LOCAL.get('events'),
    ideas:  LOCAL.get('ideas'),
    exported_at: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mi-espacio-backup-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.tasks)  LOCAL.set('tasks',  data.tasks);
      if (data.events) LOCAL.set('events', data.events);
      if (data.ideas)  LOCAL.set('ideas',  data.ideas);
      renderTasks(); renderCal(); renderIdeas();
      alert('Datos importados correctamente.');
    } catch { alert('Archivo inválido.'); }
  };
  reader.readAsText(file);
}
