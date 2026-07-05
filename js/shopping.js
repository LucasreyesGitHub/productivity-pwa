// shopping.js — Lista de compras: checklist simple dentro de la Agenda

async function addShoppingItem() {
  const input = document.getElementById('shopping-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) { input.focus(); return; }
  await dbAddShoppingItem(text);
  input.value = '';
  input.focus();
  renderShoppingList();
}

async function toggleShoppingItem(id) {
  const items = LOCAL.get('shopping_items');
  const it = items.find(i => i.id === id);
  if (!it) return;
  await dbUpdateShoppingItem(id, { done: !it.done });
  renderShoppingList();
}

async function deleteShoppingItem(id) {
  await dbDeleteShoppingItem(id);
  renderShoppingList();
}

async function clearCheckedShoppingItems() {
  await dbClearCheckedShoppingItems();
  renderShoppingList();
}

function renderShoppingList() {
  const list = document.getElementById('shopping-list');
  if (!list) return;
  const items = LOCAL.get('shopping_items');
  const pendingCount = items.filter(i => !i.done).length;

  const countEl = document.getElementById('shopping-count');
  if (countEl) countEl.textContent = pendingCount > 0 ? pendingCount : '';

  const clearBtn = document.getElementById('shopping-clear-btn');
  if (clearBtn) clearBtn.hidden = !items.some(i => i.done);

  if (!items.length) {
    list.innerHTML = `
      <div class="dash-empty">
        <i class="ti ti-shopping-cart"></i>
        <span>Sin artículos en la lista</span>
      </div>`;
    return;
  }

  // Pending first, then checked items at the bottom
  const sorted = [...items].sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));

  list.innerHTML = sorted.map(i => `
    <div class="shopping-item${i.done ? ' is-done' : ''}" data-id="${i.id}">
      <button class="task-check${i.done ? ' is-done' : ''}" onclick="toggleShoppingItem('${i.id}')" aria-label="Comprado"></button>
      <span class="shopping-item-text">${escHtml(i.text)}</span>
      <button class="shopping-item-del" onclick="deleteShoppingItem('${i.id}')" aria-label="Eliminar">
        <i class="ti ti-x"></i>
      </button>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('shopping-add-btn')?.addEventListener('click', addShoppingItem);
  document.getElementById('shopping-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addShoppingItem(); }
  });
  document.getElementById('shopping-clear-btn')?.addEventListener('click', clearCheckedShoppingItems);
});
