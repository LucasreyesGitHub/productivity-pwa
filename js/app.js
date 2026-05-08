function showSection(name) {
  ['tasks','calendar','ideas'].forEach(s => {
    document.getElementById('section-' + s).classList.add('hidden');
    document.getElementById('nav-' + s).classList.remove('active');
  });
  document.getElementById('section-' + name).classList.remove('hidden');
  document.getElementById('nav-' + name).classList.add('active');
}

async function initApp(uid) {
  userId = uid;
  setSyncStatus('syncing', 'Cargando...');
  await syncAll();
  showSection('tasks');
  // Realtime sync via Supabase channels
  sb.channel('realtime-' + uid)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks',  filter: 'user_id=eq.' + uid }, syncAll)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: 'user_id=eq.' + uid }, syncAll)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ideas',  filter: 'user_id=eq.' + uid }, syncAll)
    .subscribe();
}

// Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}
