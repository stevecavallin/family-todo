import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export default defineConfig(({ mode }) => {
  // Load .env manually so we can use it in the plugin
  let env = {};
  if (existsSync('.env')) {
    readFileSync('.env', 'utf-8').split('\n').forEach(line => {
      const [k, ...v] = line.split('=');
      if (k && k.trim()) env[k.trim()] = v.join('=').trim();
    });
  }

  return {
    plugins: [
      react(),
      {
        name: 'generate-firebase-sw',
        // Inject env vars into service worker at BUILD time
        closeBundle() {
          try {
            const template = readFileSync('public/firebase-messaging-sw.js', 'utf-8');
            const sw = template
              .replace('__API_KEY__',            env.VITE_FIREBASE_API_KEY            || '')
              .replace('__AUTH_DOMAIN__',         env.VITE_FIREBASE_AUTH_DOMAIN        || '')
              .replace('__DATABASE_URL__',        env.VITE_FIREBASE_DATABASE_URL       || '')
              .replace('__PROJECT_ID__',          env.VITE_FIREBASE_PROJECT_ID         || '')
              .replace('__STORAGE_BUCKET__',      env.VITE_FIREBASE_STORAGE_BUCKET     || '')
              .replace('__MESSAGING_SENDER_ID__', env.VITE_FIREBASE_MESSAGING_SENDER_ID|| '')
              .replace('__APP_ID__',              env.VITE_FIREBASE_APP_ID             || '');
            writeFileSync(join('dist', 'firebase-messaging-sw.js'), sw);
            console.log('✅ Service worker generato con configurazione Firebase');
          } catch (e) {
            console.warn('⚠️  Service worker non generato:', e.message);
          }
        },
        // Also serve processed SW during DEV
        configureServer(server) {
          server.middlewares.use('/firebase-messaging-sw.js', (req, res) => {
            try {
              const template = readFileSync('public/firebase-messaging-sw.js', 'utf-8');
              const sw = template
                .replace('__API_KEY__',            env.VITE_FIREBASE_API_KEY            || '')
                .replace('__AUTH_DOMAIN__',         env.VITE_FIREBASE_AUTH_DOMAIN        || '')
                .replace('__DATABASE_URL__',        env.VITE_FIREBASE_DATABASE_URL       || '')
                .replace('__PROJECT_ID__',          env.VITE_FIREBASE_PROJECT_ID         || '')
                .replace('__STORAGE_BUCKET__',      env.VITE_FIREBASE_STORAGE_BUCKET     || '')
                .replace('__MESSAGING_SENDER_ID__', env.VITE_FIREBASE_MESSAGING_SENDER_ID|| '')
                .replace('__APP_ID__',              env.VITE_FIREBASE_APP_ID             || '');
              res.setHeader('Content-Type', 'application/javascript');
              res.end(sw);
            } catch (e) {
              res.statusCode = 500;
              res.end('// SW generation failed');
            }
          });
        },
      },
    ],
  };
});
