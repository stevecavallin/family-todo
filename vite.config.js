import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export default defineConfig(() => {
  // Legge da .env locale (sviluppo) E da process.env (Netlify build)
  let fileEnv = {};
  if (existsSync('.env')) {
    readFileSync('.env', 'utf-8').split('\n').forEach(line => {
      const [k, ...v] = line.split('=');
      if (k && k.trim()) fileEnv[k.trim()] = v.join('=').trim();
    });
  }
  const g = key => fileEnv[key] || process.env[key] || '';

  const injectSW = template => template
    .replace('__API_KEY__',             g('VITE_FIREBASE_API_KEY'))
    .replace('__AUTH_DOMAIN__',         g('VITE_FIREBASE_AUTH_DOMAIN'))
    .replace('__DATABASE_URL__',        g('VITE_FIREBASE_DATABASE_URL'))
    .replace('__PROJECT_ID__',          g('VITE_FIREBASE_PROJECT_ID'))
    .replace('__STORAGE_BUCKET__',      g('VITE_FIREBASE_STORAGE_BUCKET'))
    .replace('__MESSAGING_SENDER_ID__', g('VITE_FIREBASE_MESSAGING_SENDER_ID'))
    .replace('__APP_ID__',              g('VITE_FIREBASE_APP_ID'));

  return {
    plugins: [
      react(),
      {
        name: 'generate-firebase-sw',
        closeBundle() {
          try {
            const sw = injectSW(readFileSync('public/firebase-messaging-sw.js', 'utf-8'));
            writeFileSync(join('dist', 'firebase-messaging-sw.js'), sw);
            console.log('✅ Service worker generato con config Firebase');
          } catch (e) {
            console.warn('⚠️ Service worker non generato:', e.message);
          }
        },
        configureServer(server) {
          server.middlewares.use('/firebase-messaging-sw.js', (req, res) => {
            try {
              const sw = injectSW(readFileSync('public/firebase-messaging-sw.js', 'utf-8'));
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
