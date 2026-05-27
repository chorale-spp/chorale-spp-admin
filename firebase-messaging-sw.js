// ============================================
// FIREBASE MESSAGING SERVICE WORKER
// Handles background push notifications
// File must be at the ROOT of the site
// ============================================

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// ── Config — same as firebase-init.js ──
// This will be replaced by the build step reading your actual config
// For now it reads from the cache via postMessage on install
let messaging = null;

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    try {
      firebase.initializeApp(event.data.config);
      messaging = firebase.messaging();

      // Handle background messages
      messaging.onBackgroundMessage(payload => {
        const { title, body, icon, data } = payload.notification || payload.data || {};
        self.registration.showNotification(title || 'Chorale Saint Padre Pio', {
          body:    body  || '',
          icon:    icon  || '/chorale-spp-admin/assets/img/logo.png',
          badge:   '/chorale-spp-admin/assets/img/logo.png',
          tag:     data?.type || 'general',
          data:    data  || {},
          vibrate: [200, 100, 200],
          actions: [
            { action: 'open', title: 'Open Portal' }
          ]
        });
      });
    } catch(e) {
      console.log('SW Firebase init skipped (already initialized):', e.message);
    }
  }
});

// Handle notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/chorale-spp-admin/member.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('chorale-spp-admin') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
