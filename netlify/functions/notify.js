import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase }  from 'firebase-admin/database';
import { getMessaging } from 'firebase-admin/messaging';

const getAdminApp = () => {
  if (getApps().length) return getApps()[0];
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  return initializeApp({
    credential:  cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
};

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { toUser, taskTitle, addedBy, shared } = JSON.parse(event.body || '{}');
    if (!toUser || !taskTitle) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing fields' }) };

    const adminApp = getAdminApp();
    const snap = await getDatabase(adminApp).ref(`fcm_tokens/${toUser}`).get();
    if (!snap.exists()) return { statusCode: 200, headers, body: JSON.stringify({ sent: false, reason: 'no_tokens' }) };

    const tokens = Object.values(snap.val()).filter(Boolean);
    if (!tokens.length) return { statusCode: 200, headers, body: JSON.stringify({ sent: false, reason: 'no_tokens' }) };

    // Messaggio diverso per task condivisi vs personali
    const title = shared ? '🤝 Task condiviso!' : '🗓️ Nuovo task!';
    const body  = shared
      ? `${addedBy} ha aggiunto un task condiviso: "${taskTitle}"`
      : `${addedBy} ha aggiunto per te: "${taskTitle}"`;

    const result = await getMessaging(adminApp).sendEachForMulticast({
      tokens,
      notification: { title, body },
      webpush: {
        notification: { icon: '/favicon.ico', requireInteraction: false, silent: false },
        fcmOptions: { link: '/' },
      },
    });

    // Rimuovi token non più validi
    const invalidKeys = Object.keys(snap.val()).filter((_, i) => result.responses[i]?.error);
    if (invalidKeys.length) {
      await Promise.all(invalidKeys.map(k => getDatabase(adminApp).ref(`fcm_tokens/${toUser}/${k}`).remove()));
    }

    return { statusCode: 200, headers, body: JSON.stringify({ sent: true, successCount: result.successCount }) };
  } catch (err) {
    console.error('notify error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
