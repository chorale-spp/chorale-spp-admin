// ============================================
// FIREBASE CONFIGURATION
// Replace the values below with your Firebase project config
// Go to: Firebase Console > Project Settings > Your Apps > Web App
// ============================================

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAFBeffjoHdNmtnSLPxLftG-rFJK9Rlg5c",
  authDomain:        "chorale-spp.firebaseapp.com",
  projectId:         "chorale-spp",
  storageBucket:     "chorale-spp.firebasestorage.app",
  messagingSenderId: "509837805978",
  appId:             "1:509837805978:web:36d1adcb3b753c6a2e5223"
};

// ── Initialize ──
firebase.initializeApp(FIREBASE_CONFIG);

const auth = firebase.auth();
const db   = firebase.firestore();

window.APP = window.APP || {};

// ── Leadership roles (admin portal access) ──
const ADMIN_ROLES = [
  'music_director', 'secretary', 'treasurer', 'archivist',
  'maestro', 'discipline_dir', 'discipline_vic', 'voice_resp'
];

// ── Determine which portal we are on ──
const IS_ADMIN_PORTAL  = window.location.pathname.includes('dashboard');
const IS_MEMBER_PORTAL = window.location.pathname.includes('member');
const IS_LOGIN_PAGE    = !IS_ADMIN_PORTAL && !IS_MEMBER_PORTAL;

// ── Auth state handler ──
auth.onAuthStateChanged(async (user) => {
  const loadEl = document.getElementById('app-loading');

  if (user) {
    // Fetch Firestore profile using uid as document ID
    let profile = null;
    try {
      const snap = await db.collection('members').doc(user.uid).get();
      if (snap.exists) {
        profile = { uid: user.uid, email: user.email, ...snap.data() };
      }
    } catch(e) {
      console.error('Profile fetch error:', e);
    }

    const role    = profile?.role || '';
    const isAdmin = ADMIN_ROLES.includes(role);

    // ── Admin login page ──
    if (IS_LOGIN_PAGE) {
      if (!profile) {
        // UID not linked to any member record
        await auth.signOut();
        showLoginError('Your account is not linked to a member record. Contact the Secretary.');
        hideLoading(loadEl);
        return;
      }
      if (!isAdmin) {
        // Member trying to use admin portal
        await auth.signOut();
        showLoginError('You do not have admin access. Please use the Member Portal.');
        hideLoading(loadEl);
        return;
      }
      // Valid admin — go to dashboard
      window.APP.currentUser = profile;
      window.location.href = 'dashboard.html';
      return;
    }

    // ── Admin dashboard ──
    if (IS_ADMIN_PORTAL) {
      if (!profile || !isAdmin) {
        await auth.signOut();
        window.location.href = 'index.html';
        return;
      }
      window.APP.currentUser = profile;
      hideLoading(loadEl);
      if (typeof window.initDashboard === 'function') window.initDashboard();
      return;
    }

    // ── Member portal ──
    if (IS_MEMBER_PORTAL) {
      // Member portal handles everything itself — never interfere
      hideLoading(loadEl);
      return;
    }

  } else {
    // Not logged in
    if (IS_ADMIN_PORTAL) {
      window.location.href = 'index.html';
      return;
    }
    if (IS_MEMBER_PORTAL) {
      // Member portal handles its own signed-out state
      return;
    }
    // Login page — just hide loading
    hideLoading(loadEl);
  }
});

function hideLoading(el) {
  if (!el) return;
  el.style.opacity = '0';
  el.style.transition = 'opacity 0.4s';
  setTimeout(() => el.remove(), 400);
}

function showLoginError(msg) {
  // Works on both login pages
  const ids = ['login-error', 'ml-error'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.classList.add('visible'); }
  });
  // Re-enable login button
  const btns = ['login-btn', 'ml-btn'];
  btns.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = btn.id === 'login-btn'
        ? '<span>Sign In</span><i class="fas fa-arrow-right"></i>'
        : '<span>Sign In</span><i class="fas fa-arrow-right"></i>';
    }
  });
}

// ── Auth helpers ──
window.signIn = async (email, password) => {
  return auth.signInWithEmailAndPassword(email, password);
};

window.signOut = async () => {
  await auth.signOut();
  window.location.href = 'index.html';
};
