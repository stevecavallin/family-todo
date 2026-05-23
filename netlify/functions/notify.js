/**
 * Netlify Function: /api/notify
 * Invia una notifica push FCM all'altra persona quando un task viene aggiunto
 * per conto suo.
 *
 * Variabili d'ambiente richieste su Netlify:
 *   FIREBASE_SERVICE_ACCOUNT  →  JSON del service account (minificato)
 *   FIREBASE_DATABASE_URL     →  URL del Realtime Database
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase }  from 'firebase-admin/database';
import { getMessaging } from 'firebase-admin/messaging';

// ── Inizializza Firebase Admin (una sola volta tra le invocazioni calde) ──
const getAdminApp = () => {
  if (getApps().length) return getApps()[0];
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  return initializeApp({
    credential:  cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
};

// ── Handler principale ────────────────────────────────────────────────────
export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { toUser, taskTitle, addedBy } = JSON.parse(event.body || '{}');
    if (!toUser || !taskTitle) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing fields' }) };
    }

    const adminApp = getAdminApp();
    const db       = getDatabase(adminApp);

    // Recupera tutti i token FCM dell'utente destinatario
    const snap = await db.ref(`fcm_tokens/${toUser}`).get();
    if (!snap.exists()) {
      return { statusCode: 200, headers, body: JSON.stringify({ sent: false, reason: 'no_tokens' }) };
    }

    const tokens = Object.values(snap.val()).filter(Boolean);
    if (!tokens.length) {
      return { statusCode: 200, headers, body: JSON.stringify({ sent: false, reason: 'no_tokens' }) };
    }

    // Invia la notifica push
    const result = await getMessaging(adminApp).sendEachForMulticast({
      tokens,
      notification: {
        title: '🗓️ Nuovo task!',
        body:  `${addedBy} ha aggiunto per te: "${taskTitle}"`,
      },
      webpush: {
        notification: {
          icon:             '/favicon.ico',
          requireInteraction: false,
          silent:           false,
        },
        fcmOptions: { link: '/' },
      },
    });

    // Rimuovi token non più validi
    const invalidTokenKeys = Object.keys(snap.val()).filter((_, i) => result.responses[i]?.error);
    if (invalidTokenKeys.length) {
      await Promise.all(invalidTokenKeys.map(k => db.ref(`fcm_tokens/${toUser}/${k}`).remove()));
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ sent: true, successCount: result.successCount }),
    };

  } catch (err) {
    console.error('notify error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
