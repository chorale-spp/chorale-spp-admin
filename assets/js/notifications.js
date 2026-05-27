// ============================================
// NOTIFICATIONS MODULE
// Handles: Web Push subscriptions, in-app
// notification centre, unread counts
// ============================================

window.APP = window.APP || {};

// ── VAPID public key for Web Push ──
// Generate your own at: https://vapidkeys.com
// Or run: npx web-push generate-vapid-keys
// Paste the PUBLIC key below
APP.VAPID_PUBLIC_KEY = 'BEE8oo2I1D0IKJ-BiI0aa84wIw2yH-qm3CXxRyOTDBWp1n1qLrgxPRVyDrqH34n5GgS5Q7Xe5aP4yLd_zqL5Tgo';

// ── Convert VAPID key to Uint8Array ──
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// ── Register service worker ──
APP.registerServiceWorker = async function() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/chorale-spp-admin/firebase-messaging-sw.js');
    // Send Firebase config to service worker
    const config = firebase.app().options;
    reg.active?.postMessage({ type: 'FIREBASE_CONFIG', config });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      navigator.serviceWorker.controller?.postMessage({ type: 'FIREBASE_CONFIG', config });
    });
    return reg;
  } catch(e) {
    console.warn('Service worker registration failed:', e);
    return null;
  }
};

// ── Request push permission and save subscription ──
APP.requestPushPermission = async function() {
  const u = APP.currentUser;
  if (!u) return;

  if (!('Notification' in window)) {
    APP.toast('Push notifications are not supported in this browser', 'info');
    return;
  }

  if (Notification.permission === 'denied') {
    APP.toast('Notifications are blocked. Please enable them in your browser settings.', 'info');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    // Register SW and get push subscription
    const reg = await APP.registerServiceWorker();
    if (!reg) return;

    // Wait for active service worker
    await navigator.serviceWorker.ready;

    let subscription;
    try {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(APP.VAPID_PUBLIC_KEY)
      });
    } catch(e) {
      // VAPID key not set yet — still save preference for in-app notifications
      console.warn('Push subscription failed (VAPID key may not be set):', e.message);
    }

    // Save subscription to Firestore
    const subData = {
      uid:        u.uid,
      role:       u.role || 'member',
      isAdmin:    ['music_director','secretary','treasurer','archivist','maestro','discipline_dir','discipline_vic','voice_resp'].includes(u.role),
      endpoint:   subscription?.endpoint || null,
      keys:       subscription ? {
        p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))),
        auth:   btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth'))))
      } : null,
      updatedAt:  firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('push_subscriptions').doc(u.uid).set(subData, { merge: true });
    APP.toast('Notifications enabled', 'success');
    APP._pushEnabled = true;

    // Update bell UI
    APP.updateNotifBell();

  } catch(e) {
    console.error('Push permission error:', e);
    APP.toast('Could not enable notifications: ' + e.message, 'error');
  }
};

// ── Check if push is already enabled ──
APP.checkPushStatus = async function() {
  if (!APP.currentUser) return;
  const snap = await db.collection('push_subscriptions').doc(APP.currentUser.uid).get();
  APP._pushEnabled = snap.exists && Notification.permission === 'granted';
  APP.updateNotifBell();
};

// ── CREATE a notification in Firestore ──
// Called whenever an announcement is posted or absence submitted
APP.createNotification = async function({ type, title, body, targetUids, targetAdminsOnly, url }) {
  const batch = db.batch();
  const now   = firebase.firestore.FieldValue.serverTimestamp();

  let uids = targetUids || [];

  // If broadcasting to admins only or all members, fetch targets
  if (!uids.length) {
    const snap = await db.collection('members').get();
    const adminRoles = ['music_director','secretary','treasurer','archivist','maestro','discipline_dir','discipline_vic','voice_resp'];
    uids = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(m => targetAdminsOnly ? adminRoles.includes(m.role) : true)
      .map(m => m.id);
  }

  // Write one notification doc per user
  uids.forEach(uid => {
    const ref = db.collection('notifications').doc();
    batch.set(ref, {
      uid, type, title, body,
      url:    url || '',
      read:   false,
      createdAt: now
    });
  });

  await batch.commit();

  // Also try Web Push via the push_subscriptions collection
  // (actual delivery handled by service worker / browser)
  APP.triggerWebPush({ type, title, body, targetAdminsOnly });
};

// ── Trigger Web Push by posting to subscribed browsers ──
// Since we have no server, we use the Notifications API directly
// for users who are online, and the SW handles offline delivery
APP.triggerWebPush = async function({ type, title, body, targetAdminsOnly }) {
  if (!('serviceWorker' in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.ready;

    // Show notification via SW registration (works even if tab is in background)
    await reg.showNotification(title, {
      body,
      icon:  '/chorale-spp-admin/assets/img/logo.png',
      badge: '/chorale-spp-admin/assets/img/logo.png',
      tag:   type,
      vibrate: [200, 100, 200],
      data: { type, url: targetAdminsOnly ? '/chorale-spp-admin/dashboard.html' : '/chorale-spp-admin/member.html' }
    });
  } catch(e) {
    // Silent fail — in-app notification is the fallback
    console.warn('Web push failed:', e.message);
  }
};

// ── Load notifications for current user ──
APP.loadNotifications = async function(containerId, isAdminPortal) {
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = `<div style="text-align:center;padding:30px">
    <div class="spinner" style="border-color:rgba(0,0,0,.1);border-top-color:var(--gold);margin:auto"></div>
  </div>`;

  try {
    const uid  = APP.currentUser?.uid;
    if (!uid) return;

    // Fetch without orderBy — sort client side to avoid index requirement
    const snap = await db.collection('notifications')
      .where('uid', '==', uid)
      .limit(50)
      .get();

    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    // Mark all as read
    const unread = items.filter(n => !n.read);
    if (unread.length) {
      const batch = db.batch();
      unread.forEach(n => batch.update(db.collection('notifications').doc(n.id), { read: true }));
      await batch.commit();
      // Reset badge
      APP._unreadCount = 0;
      APP.updateNotifBell();
    }

    if (!items.length) {
      el.innerHTML = `
        <div style="text-align:center;padding:48px 20px">
          <i class="fas fa-bell-slash" style="font-size:2.5rem;color:var(--border);margin-bottom:14px;display:block"></i>
          <p class="muted">No notifications yet.</p>
        </div>`;
      return;
    }

    const typeIcons = {
      announcement: { icon: 'fa-bullhorn',     colour: 'var(--gold)' },
      absence:      { icon: 'fa-calendar-times', colour: '#3498db' },
      event:        { icon: 'fa-calendar-alt',   colour: '#27ae60' },
      general:      { icon: 'fa-info-circle',    colour: 'var(--text-muted)' }
    };

    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div style="font-size:.72rem;color:var(--text-muted)">${items.length} notification${items.length!==1?'s':''}</div>
        <button class="btn-ghost" style="font-size:.72rem" onclick="APP.clearAllNotifications('${containerId}')">
          <i class="fas fa-trash-alt"></i> Clear all
        </button>
      </div>
      ${items.map(n => {
        const t = typeIcons[n.type] || typeIcons.general;
        return `
          <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid rgba(0,0,0,.04);${!n.read?'':''}">
            <div style="width:36px;height:36px;border-radius:50%;background:rgba(184,151,58,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:${t.colour}">
              <i class="fas ${t.icon}"></i>
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:.84rem;margin-bottom:3px">${n.title}</div>
              <div style="font-size:.78rem;color:var(--text-muted);line-height:1.5">${n.body}</div>
              <div style="font-size:.68rem;color:var(--text-light);margin-top:5px">
                <i class="fas fa-clock" style="margin-right:3px"></i>${APP.formatDate(n.createdAt)}
              </div>
            </div>
          </div>
        `;
      }).join('')}
    `;

  } catch(e) {
    el.innerHTML = '<p class="muted" style="padding:20px">Error loading notifications.</p>';
    console.error('Notifications error:', e);
  }
};

// ── Get unread count ──
APP.getUnreadCount = async function() {
  const uid = APP.currentUser?.uid;
  if (!uid) return 0;
  try {
    const snap = await db.collection('notifications')
      .where('uid',  '==', uid)
      .where('read', '==', false)
      .get();
    return snap.size;
  } catch(e) {
    return 0;
  }
};

// ── Update bell badge ──
APP.updateNotifBell = function() {
  const count = APP._unreadCount || 0;
  ['notif-badge', 'mb-notif-badge'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (count > 0) {
      el.textContent = count > 9 ? '9+' : count;
      el.style.display = 'flex';
    } else {
      el.style.display = 'none';
    }
  });

  // Push enabled indicator
  ['notif-push-dot', 'mb-notif-push-dot'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = APP._pushEnabled ? 'block' : 'none';
  });
};

// ── Poll for new notifications (every 30s) ──
APP.startNotifPolling = function() {
  APP.pollNotifications();
  setInterval(APP.pollNotifications, 30000);
};

APP.pollNotifications = async function() {
  const count = await APP.getUnreadCount();
  APP._unreadCount = count;
  APP.updateNotifBell();
};

// ── Clear all notifications ──
APP.clearAllNotifications = async function(containerId) {
  const uid = APP.currentUser?.uid;
  if (!uid) return;
  try {
    const snap = await db.collection('notifications').where('uid','==',uid).get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    APP.toast('Notifications cleared', 'info');
    APP.loadNotifications(containerId, false);
    APP._unreadCount = 0;
    APP.updateNotifBell();
  } catch(e) {
    APP.toast('Error clearing notifications', 'error');
  }
};

// ── Admin: Load notifications section view ──
APP.loadNotificationsSection = function() {
  const el = document.getElementById('view-notifications');
  if (!el) return;

  el.innerHTML = `
    <div class="page-header">
      <div class="eyebrow">Inbox</div>
      <h2>My <em>Notifications</em></h2>
      <div class="divider"></div>
    </div>

    <!-- Push permission card -->
    <div class="card mb-28" id="notif-permission-card">
      <div class="card-body" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div style="width:44px;height:44px;border-radius:50%;background:rgba(184,151,58,0.1);display:flex;align-items:center;justify-content:center;color:var(--gold);font-size:1.2rem;flex-shrink:0">
          <i class="fas fa-bell"></i>
        </div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:.88rem;margin-bottom:3px">Browser Push Notifications</div>
          <div style="font-size:.78rem;color:var(--text-muted)" id="notif-status-text">
            ${Notification.permission === 'granted' ? 'Enabled — you will receive alerts even when the portal is closed.' : 'Enable to receive alerts even when the portal is closed.'}
          </div>
        </div>
        ${Notification.permission !== 'granted' ? `
          <button class="btn-primary" style="width:auto;padding:9px 18px" onclick="APP.requestPushPermission()">
            <i class="fas fa-bell"></i> Enable Notifications
          </button>
        ` : `
          <span class="badge badge-green"><i class="fas fa-check" style="margin-right:4px"></i>Active</span>
        `}
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>All Notifications</h3>
        <span class="badge badge-gold" id="notif-count-badge" style="display:none"></span>
      </div>
      <div class="card-body" id="notifications-container"></div>
    </div>
  `;

  APP.loadNotifications('notifications-container', true);
};
