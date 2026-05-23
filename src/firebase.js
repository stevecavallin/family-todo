import { initializeApp } from 'firebase/app';
import { getDatabase }   from 'firebase/database';
import { getMessaging }  from 'firebase/messaging';

// ─────────────────────────────────────────────────────────────────────────────
// Copia qui la tua configurazione Firebase (vedi .env.example)
// I valori vengono letti dal file .env — non scrivere i segreti direttamente qui
// ─────────────────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const database  = getDatabase(app);
export const messaging = getMessaging(app);
export const vapidKey  = import.meta.env.VITE_FIREBASE_VAPID_KEY;
