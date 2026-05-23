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

const messaging = firebase.messaging();

// Gestisce le notifiche quando l'app è in background o chiusa
messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification || {};
  if (!title) return;
  self.registration.showNotification(title, {
    body:  body  || '',
    icon:  '/favicon.ico',
    badge: '/favicon.ico',
    tag:   'family-todo',          // sostituisce notifiche precedenti
    renotify: true,
  });
});
