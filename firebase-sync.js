// Firebase sync — uses compat SDK loaded via script tag (works on all browsers incl iOS Safari)
// firebase-app-compat and firebase-database-compat are loaded in HTML before this file

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCFkpLg0LFGsuB72VjQAhpPDsYavWI0Jdk",
  authDomain: "mua-teleprompter.firebaseapp.com",
  databaseURL: "https://mua-teleprompter-default-rtdb.firebaseio.com",
  projectId: "mua-teleprompter",
  storageBucket: "mua-teleprompter.firebasestorage.app",
  messagingSenderId: "412190982258",
  appId: "1:412190982258:web:3a14c16ef52afab01182eb"
};

let _db = null;
let _queue = [];
let _ready = false;

function _init() {
  try {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    _db = firebase.database();
    _ready = true;
    console.log('[Firebase] connected ✓');
    _queue.forEach(fn => fn());
    _queue = [];
  } catch(e) {
    console.error('[Firebase] init error:', e);
  }
}

function whenReady(fn) {
  if (_ready) fn();
  else _queue.push(fn);
}

function fbBroadcast(namespace, msg) {
  whenReady(() => {
    const path = 'cues/' + namespace.replace(/[^a-zA-Z0-9_]/g, '_');
    _db.ref(path).set({ ...msg, ts: Date.now() })
      .catch(e => console.warn('[Firebase] broadcast failed:', e));
  });
}

function fbListen(namespace, callback) {
  whenReady(() => {
    const path = 'cues/' + namespace.replace(/[^a-zA-Z0-9_]/g, '_');
    const startTs = Date.now();
    let lastTs = startTs;
    _db.ref(path).on('value', (snapshot) => {
      const msg = snapshot.val();
      if (!msg || !msg.ts || msg.ts <= lastTs) return;
      lastTs = msg.ts;
      localStorage.setItem(namespace + 'msg', JSON.stringify(msg));
      callback(msg);
    });
    console.log('[Firebase] listening:', path);
  });
}

function fbSyncTexts(namespace, texts) {
  whenReady(() => {
    const path = 'texts/' + namespace.replace(/[^a-zA-Z0-9_]/g, '_');
    _db.ref(path).set({ data: JSON.stringify(texts), ts: Date.now() })
      .catch(e => console.warn('[Firebase] syncTexts failed:', e));
  });
}

function fbGetTexts(namespace) {
  return new Promise((resolve) => {
    whenReady(() => {
      const path = 'texts/' + namespace.replace(/[^a-zA-Z0-9_]/g, '_');
      _db.ref(path).once('value').then(snapshot => {
        const val = snapshot.val();
        resolve((val && val.data) ? JSON.parse(val.data) : null);
      }).catch(() => resolve(null));
    });
  });
}

function fbSyncSettings(namespace, settings) {
  whenReady(() => {
    const path = 'settings/' + namespace.replace(/[^a-zA-Z0-9_]/g, '_');
    _db.ref(path).set({ data: JSON.stringify(settings), ts: Date.now() })
      .catch(e => console.warn('[Firebase] syncSettings failed:', e));
  });
}

function fbGetSettings(namespace) {
  return new Promise((resolve) => {
    whenReady(() => {
      const path = 'settings/' + namespace.replace(/[^a-zA-Z0-9_]/g, '_');
      _db.ref(path).once('value').then(snapshot => {
        const val = snapshot.val();
        resolve((val && val.data) ? JSON.parse(val.data) : null);
      }).catch(() => resolve(null));
    });
  });
}

// Continuous listener for texts — fires whenever texts are updated
function fbListenTexts(namespace, callback) {
  whenReady(() => {
    const path = 'texts/' + namespace.replace(/[^a-zA-Z0-9_]/g, '_');
    let lastTs = 0;
    _db.ref(path).on('value', (snapshot) => {
      const val = snapshot.val();
      if (!val || !val.data || val.ts <= lastTs) return;
      lastTs = val.ts;
      try { callback(JSON.parse(val.data)); } catch(e) {}
    });
    console.log('[Firebase] listening texts:', path);
  });
}

// Continuous listener for settings
function fbListenSettings(namespace, callback) {
  whenReady(() => {
    const path = 'settings/' + namespace.replace(/[^a-zA-Z0-9_]/g, '_');
    let lastTs = 0;
    _db.ref(path).on('value', (snapshot) => {
      const val = snapshot.val();
      if (!val || !val.data || val.ts <= lastTs) return;
      lastTs = val.ts;
      try { callback(JSON.parse(val.data)); } catch(e) {}
    });
    console.log('[Firebase] listening settings:', path);
  });
}

window.__fb = { fbBroadcast, fbListen, fbSyncTexts, fbGetTexts, fbSyncSettings, fbGetSettings, fbListenTexts, fbListenSettings };

// Init — defer slightly to ensure compat scripts are fully parsed
if (typeof firebase !== 'undefined') {
  _init();
} else {
  window.addEventListener('load', _init);
}
