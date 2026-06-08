// Firebase Realtime Database sync — eager initialization
// Uses Firebase CDN modules for cross-device cue broadcasting

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCFkpLg0LFGsuB72VjQAhpPDsYavWI0Jdk",
  authDomain: "mua-teleprompter.firebaseapp.com",
  databaseURL: "https://mua-teleprompter-default-rtdb.firebaseio.com",
  projectId: "mua-teleprompter",
  storageBucket: "mua-teleprompter.firebasestorage.app",
  messagingSenderId: "412190982258",
  appId: "1:412190982258:web:3a14c16ef52afab01182eb"
};

// Queued calls before Firebase is ready
let _ready = false;
let _db = null, _ref = null, _set = null, _onValue = null;
let _queue = [];

function _drain() {
  _queue.forEach(fn => fn());
  _queue = [];
}

// Eagerly connect on load
(async function init() {
  try {
    const app_mod  = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
    const db_mod   = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
    // Avoid duplicate app initialization
    let app;
    try { app = app_mod.getApp(); }
    catch(e) { app = app_mod.initializeApp(FIREBASE_CONFIG); }
    _db      = db_mod.getDatabase(app);
    _ref     = db_mod.ref;
    _set     = db_mod.set;
    _onValue = db_mod.onValue;
    _ready   = true;
    console.log('[Firebase] connected');
    _drain();
  } catch(e) {
    console.warn('[Firebase] init failed:', e);
  }
})();

function whenReady(fn) {
  if (_ready) fn();
  else _queue.push(fn);
}

// ── PUBLIC API ──────────────────────────────────────────────────────────────

function fbBroadcast(namespace, msg) {
  whenReady(async () => {
    try {
      const path = 'cues/' + namespace.replace(/[^a-zA-Z0-9_]/g, '_');
      await _set(_ref(_db, path), { ...msg, ts: Date.now() });
    } catch(e) { console.warn('[Firebase] broadcast failed:', e); }
  });
}

function fbListen(namespace, callback) {
  whenReady(() => {
    try {
      const path = 'cues/' + namespace.replace(/[^a-zA-Z0-9_]/g, '_');
      let lastTs = Date.now(); // ignore anything older than page load
      _onValue(_ref(_db, path), (snapshot) => {
        const msg = snapshot.val();
        if (!msg || !msg.ts || msg.ts <= lastTs) return;
        lastTs = msg.ts;
        // Mirror to localStorage for same-device tabs
        localStorage.setItem(namespace + 'msg', JSON.stringify(msg));
        callback(msg);
      });
      console.log('[Firebase] listening on', path);
    } catch(e) { console.warn('[Firebase] listen failed:', e); }
  });
}

function fbSyncTexts(namespace, texts) {
  whenReady(async () => {
    try {
      const path = 'texts/' + namespace.replace(/[^a-zA-Z0-9_]/g, '_');
      await _set(_ref(_db, path), { data: JSON.stringify(texts), ts: Date.now() });
    } catch(e) { console.warn('[Firebase] syncTexts failed:', e); }
  });
}

function fbGetTexts(namespace) {
  return new Promise((resolve) => {
    whenReady(() => {
      try {
        const path = 'texts/' + namespace.replace(/[^a-zA-Z0-9_]/g, '_');
        _onValue(_ref(_db, path), (snapshot) => {
          const val = snapshot.val();
          resolve((val && val.data) ? JSON.parse(val.data) : null);
        }, { onlyOnce: true });
      } catch(e) {
        console.warn('[Firebase] getTexts failed:', e);
        resolve(null);
      }
    });
  });
}

window.__fb = { fbBroadcast, fbListen, fbSyncTexts, fbGetTexts };
