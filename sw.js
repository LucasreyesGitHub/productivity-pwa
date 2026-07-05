const CACHE = 'tareas-v8';
const STATIC = [
  '/', '/index.html', '/css/app.css',
  '/js/config.js', '/js/auth.js', '/js/db.js',
  '/js/tasks.js', '/js/habits.js', '/js/goals.js',
  '/js/dashboard.js', '/js/stats.js',
  '/js/calendar.js', '/js/ideas.js', '/js/quotes.js', '/js/shopping.js', '/js/app.js',
  '/manifest.json'
  // Bug #5 fix: removed /favicon.svg (it's an inline data URI, not a file)
];

self.addEventListener('install', e => {
  // Bug #5 fix: use allSettled so one missing file doesn't break the whole cache
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(STATIC.map(url => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('supabase.co')) return;
  if (e.request.url.includes('cdn.jsdelivr.net')) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(cached =>
      cached || fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => caches.match('/index.html'))
    )
  );
});
