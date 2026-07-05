// quotes.js — Frases favoritas: guardar y ver citas inspiradoras

function toggleQuoteForm() {
  const form = document.getElementById('quote-add-form');
  if (!form) return;
  form.hidden = !form.hidden;
  if (!form.hidden) setTimeout(() => document.getElementById('quote-text')?.focus(), 50);
}

async function addQuote() {
  const text   = document.getElementById('quote-text').value.trim();
  const author = document.getElementById('quote-author').value.trim();
  if (!text) { document.getElementById('quote-text').focus(); return; }
  setSyncStatus('syncing', 'Guardando...');
  await dbAddQuote({ id: crypto.randomUUID(), text, author: author || null });
  document.getElementById('quote-text').value = '';
  document.getElementById('quote-author').value = '';
  const form = document.getElementById('quote-add-form');
  if (form) form.hidden = true;
  setSyncStatus('synced', 'Sincronizado');
  renderQuotes();
  renderDashboard();
}

async function deleteQuote(id) {
  await dbDeleteQuote(id);
  renderQuotes();
  renderDashboard();
}

function renderQuotes() {
  const quotes = LOCAL.get('quotes');
  const grid = document.getElementById('quotes-grid');
  if (!grid) return;
  const countEl = document.getElementById('quote-count');
  if (countEl) countEl.textContent = quotes.length || '';

  if (!quotes.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;pointer-events:auto">
      <i class="ti ti-quote"></i>
      <p class="empty-title">Sin frases guardadas</p>
      <p class="empty-sub">Tocá "Nueva frase" para guardar algo que te inspire</p>
    </div>`;
    return;
  }

  grid.innerHTML = quotes.map(q => `
    <div class="quote-card">
      <i class="ti ti-quote quote-mark"></i>
      <div class="quote-text">${escHtml(q.text)}</div>
      ${q.author ? `<div class="quote-author">— ${escHtml(q.author)}</div>` : ''}
      <button class="del-btn quote-del" onclick="deleteQuote('${q.id}')" aria-label="eliminar"><i class="ti ti-x"></i></button>
    </div>
  `).join('');
}

// ── Quote of the day (used by the Agenda) ──────────────
function getQuoteOfTheDay() {
  const quotes = LOCAL.get('quotes');
  if (!quotes.length) return null;
  // Deterministic pick by day-of-year so it stays the same all day
  const start = new Date(new Date().getFullYear(), 0, 0);
  const diff = new Date() - start;
  const dayOfYear = Math.floor(diff / 86400000);
  return quotes[dayOfYear % quotes.length];
}
