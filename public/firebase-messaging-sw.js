// Service Worker per Firebase Cloud Messaging
// I valori __PLACEHOLDER__ vengono sostituiti automaticamente durante il build (vite.config.js)

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "__API_KEY__",
  authDomain:        "__AUTH_DOMAIN__",
  databaseURL:       "__DATABASE_URL__",
  projectId:         "__PROJECT_ID__",
  storageBucket:     "__STORAGE_BUCKET__",
  messagingSenderId: "__MESSAGING_SENDER_ID__",
  appId:             "__APP_ID__"
});

// Il service worker deve essere inizializzato per ricevere i messaggi FCM,
// ma NON deve chiamare showNotification manualmente:
// il browser lo fa già in automatico dal campo "notification" del messaggio.
// Chiamarlo di nuovo qui causerebbe notifiche doppie.
firebase.messaging();
