// ============================================
// FIREBASE CONFIGURATION
// Replace the values below with your Firebase project config
// Go to: Firebase Console > Project Settings > Your Apps > Web App
// ============================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAFBeffjoHdNmtnSLPxLftG-rFJK9Rlg5c",
  authDomain: "chorale-spp.firebaseapp.com",
  projectId: "chorale-spp",
  storageBucket: "chorale-spp.firebasestorage.app",
  messagingSenderId: "509837805978",
  appId: "1:509837805978:web:36d1adcb3b753c6a2e5223"
};

// ── Initialize ──
firebase.initializeApp(FIREBASE_CONFIG);

const auth = firebase.auth();
const db   = firebase.firestore();

// ── Auth State ──
window.APP = window.APP || {};

auth.onAuthStateChanged(async (user) => {
  if (user) {
    // Fetch user profile from Firestore
    try {
      const snap = await db.collection('members').doc(user.uid).get();
      if (snap.exists) {
        window.APP.currentUser = { uid: user.uid, email: user.email, ...snap.data() };
      } else {
        window.APP.currentUser = { uid: user.uid, email: user.email };
      }
    } catch (e) {
      window.APP.currentUser = { uid: user.uid, email: user.email };
    }

    // If on login page, redirect to dashboard
    if (window.location.pathname.includes('index') || window.location.pathname === '/' || window.location.pathname.endsWith('/')) {
      window.location.href = 'dashboard.html';
    }

    // Hide app loading screen
    const loadEl = document.getElementById('app-loading');
    if (loadEl) {
      loadEl.style.opacity = '0';
      loadEl.style.transition = 'opacity 0.4s';
      setTimeout(() => loadEl.remove(), 400);
    }

    // If dashboard, initialize it
    if (typeof window.initDashboard === 'function') {
      window.initDashboard();
    }

  } else {
    // Not logged in — redirect to login if on dashboard
    if (window.location.pathname.includes('dashboard')) {
      window.location.href = 'index.html';
    }

    const loadEl = document.getElementById('app-loading');
    if (loadEl) {
      loadEl.style.opacity = '0';
      loadEl.style.transition = 'opacity 0.4s';
      setTimeout(() => loadEl.remove(), 400);
    }
  }
});

// ── Auth helpers ──
window.signIn = async (email, password) => {
  return auth.signInWithEmailAndPassword(email, password);
};

window.signOut = async () => {
  await auth.signOut();
  window.location.href = 'index.html';
};
