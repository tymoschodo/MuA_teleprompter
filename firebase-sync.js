// Firebase Realtime Database sync
// Handles cross-device broadcasting for both front (tp_front_) and back (tp_back_) namespaces

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
let _listeners = {}; // namespace -> callback

async function getDB() {
  if (_db) return _db;
  // Load Firebase from CDN
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
  const { getDatabase, ref, set, onValue, off } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
  const app = initializeApp(FIREBASE_CONFIG);
  _db = { db: getDatabase(app), ref, set, onValue, off };
  return _db;
}

// Broadcast a message to all devices on this namespace
async function fbBroadcast(namespace, msg) {
  try {
    const { db, ref, set } = await getDB();
    const path = 'cues/' + namespace.replace(/[^a-zA-Z0-9]/g, '_');
    await set(ref(db, path), { ...msg, ts: Date.now() });
  } catch(e) {
    console.warn('Firebase broadcast failed:', e);
  }
}

// Listen for messages on this namespace, call callback(msg) on each
async function fbListen(namespace, callback) {
  try {
    const { db, ref, onValue } = await getDB();
    const path = 'cues/' + namespace.replace(/[^a-zA-Z0-9]/g, '_');
    const r = ref(db, path);
    let lastTs = 0;
    onValue(r, (snapshot) => {
      const msg = snapshot.val();
      if (!msg) return;
      // Ignore messages older than when we started listening,
      // and deduplicate (Firebase fires onValue on first attach too)
      if (msg.ts && msg.ts <= lastTs) return;
      lastTs = msg.ts || Date.now();
      // Also write to localStorage so same-device tabs still work
      localStorage.setItem(namespace + 'msg', JSON.stringify(msg));
      callback(msg);
    });
    _listeners[namespace] = { ref: r };
  } catch(e) {
    console.warn('Firebase listen failed:', e);
  }
}

// Broadcast texts to Firebase so all devices have latest
async function fbSyncTexts(namespace, texts) {
  try {
    const { db, ref, set } = await getDB();
    const path = 'texts/' + namespace.replace(/[^a-zA-Z0-9]/g, '_');
    await set(ref(db, path), { data: JSON.stringify(texts), ts: Date.now() });
  } catch(e) {
    console.warn('Firebase texts sync failed:', e);
  }
}

// Fetch latest texts from Firebase
async function fbGetTexts(namespace) {
  try {
    const { db, ref, onValue } = await getDB();
    return new Promise((resolve) => {
      const path = 'texts/' + namespace.replace(/[^a-zA-Z0-9]/g, '_');
      const r = ref(db, path);
      onValue(r, (snapshot) => {
        const val = snapshot.val();
        if (val && val.data) resolve(JSON.parse(val.data));
        else resolve(null);
      }, { onlyOnce: true });
    });
  } catch(e) {
    console.warn('Firebase getText failed:', e);
    return null;
  }
}

window.__fb = { fbBroadcast, fbListen, fbSyncTexts, fbGetTexts };
