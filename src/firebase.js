import { initializeApp } from 'firebase/app';
import { getDatabase }   from 'firebase/database';
import { getMessaging }  from 'firebase/messaging';

// ─────────────────────────────────────────────────────────────────────────────
// Copia qui la tua configurazione Firebase (vedi .env.example)
// I valori vengono letti dal file .env — non scrivere i segreti direttamente qui
// ─────────────────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyASC1ZEggL4Pq7_VHhKw5csjGrKg-6-XQg",
  authDomain: "family-to-do-9e83b.firebaseapp.com",
  databaseURL: "https://family-to-do-9e83b-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "family-to-do-9e83b",
  storageBucket: "family-to-do-9e83b.firebasestorage.app",
  messagingSenderId: "293381940279",
  appId: "1:293381940279:web:c5319cba9cd68ee98a0bb2"
};

const app = initializeApp(firebaseConfig);

export const database  = getDatabase(app);
export const messaging = getMessaging(app);
export const vapidKey  = import.meta.env.VITE_FIREBASE_VAPID_KEY;
