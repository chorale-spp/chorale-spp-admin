// ============================================
// SERVICE WORKER — Chorale Saint Padre Pio
// Enables PWA install + offline shell caching
// ============================================

const CACHE_NAME = 'chorale-spp-v1';

// Files to cache for offline shell
const SHELL_FILES = [
  '/chorale-spp-admin/',
  '/chorale-spp-admin/index.html',
  '/chorale-spp-admin/dashboard.html',
  '/chorale-spp-admin/member.html',
  '/chorale-spp-admin/assets/css/main.css',
  '/chorale-spp-admin/assets/js/firebase-init.js',
  '/chorale-spp-admin/assets/js/utils.js',
  '/chorale-spp-admin/assets/js/roles.js',
  '/chorale-spp-admin/assets/js/announcements.js',
  '/chorale-spp-admin/assets/js/scores.js',
  '/chorale-spp-admin/assets/js/sections.js',
  '/chorale-spp-admin/assets/img/logo.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Montserrat:wght@300;400;500;600;700&display=swap'
];

// ── Install: cache the app shell ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache what we can, silently skip failures (e.g. logo not uploaded yet)
      return Promise.allSettled(
        SHELL_FILES.map(url => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: remove old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => clients.claim())
  );
});

// ── Fetch: network-first for Firebase/API, cache-first for assets ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go network-first for Firebase, GitHub API, and dynamic data
  const networkFirst = [
    'firebaseio.com',
    'googleapis.com',
    'firestore.googleapis.com',
    'identitytoolkit.googleapis.com',
    'api.github.com',
    'raw.githubusercontent.com'
  ];

  if (networkFirst.some(domain => url.hostname.includes(domain))) {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Cache-first for static assets (CSS, JS, fonts, images)
  if (
    event.request.method === 'GET' &&
    (url.pathname.includes('/assets/') ||
     url.hostname.includes('fonts.g') ||
     url.hostname.includes('cdnjs.') ||
     url.pathname.endsWith('.png') ||
     url.pathname.endsWith('.jpg'))
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first for HTML pages
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then(cached =>
          cached || caches.match('/chorale-spp-admin/index.html')
        )
      )
    );
    return;
  }

  // Default: network with cache fallback
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
