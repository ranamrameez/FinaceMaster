import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getDatabase, type Database } from 'firebase/database';

// Firebase API keys are meant to be public in client code — they identify
// the project, not a secret. Actual access control lives in the Realtime
// Database security rules, which is what actually keeps data private.
// Reused as-is from the legacy app so existing users' cloud data loads
// into this app unchanged.
const firebaseConfig = {
  apiKey: 'AIzaSyCzg_KmLGNUXlIzqEAUJctG29kyJQruM8I',
  authDomain: 'qse-app.firebaseapp.com',
  databaseURL: 'https://qse-app-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'qse-app',
  storageBucket: 'qse-app.firebasestorage.app',
  messagingSenderId: '766310206577',
  appId: '1:766310206577:web:271c3974a45503e5999fd0',
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Database | null = null;
let ready = false;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getDatabase(app);
  ready = true;
} catch (e) {
  console.warn('Firebase failed to initialize — cloud sync disabled, saving locally only.', e);
}

export { app, auth, db, ready as firebaseReady };
