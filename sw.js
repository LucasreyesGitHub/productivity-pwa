const CACHE = 'mi-espacio-v3';
const STATIC = [
  '/', '/index.html', '/css/app.css',
  '/js/config.js', '/js/auth.js', '/js/db.js',
  '/js/tasks.js', '/js/calendar.js', '/js/ideas.js', '/js/app.js',
  '/manifest.json', '/favicon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('supabase.co')) return;
  if (e.request.url.includes('cdn.jsdelivr.net')) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(cached => cached || fetch(e.request).then(res => {
      if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
      return res;
    }).catch(() => caches.match('/index.html')))
  );
});
