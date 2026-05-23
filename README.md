# 🗓️ Todo Famiglia

App calendario condivisa per due persone, con sincronizzazione in tempo reale e notifiche push.

---

## Prerequisiti

- **Node.js 18+** → [nodejs.org](https://nodejs.org)
- Account Google (per Firebase, gratuito)
- Account Netlify (gratuito)

---

## Setup Firebase (da fare una volta sola)

### 1. Crea il progetto
1. [console.firebase.google.com](https://console.firebase.google.com) → **Aggiungi progetto**
2. **Build → Realtime Database → Crea database** → Europe West → Modalità test
3. **Regole** → incolla e pubblica:
   ```json
   { "rules": { ".read": true, ".write": true } }
   ```

### 2. Aggiungi l'app web
1. **Impostazioni progetto ⚙️ → Le tue app → `</>`**
2. Registra l'app → copia il `firebaseConfig`

### 3. Crea il file `.env`
Copia `.env.example` → rinomina in `.env` → compila con i valori del `firebaseConfig`.

---

## Avvio locale

```bash
npm install
npm run dev
```

→ [http://localhost:5173](http://localhost:5173)

---

## Deploy su Netlify

```bash
npm run build
```

1. [app.netlify.com](https://app.netlify.com) → **Add new site → Deploy manually**
2. Trascina la cartella `dist/`
3. Nelle **Environment variables** del sito su Netlify: aggiungi tutte le variabili dal tuo `.env`

---

## Notifiche push

Vedi **NOTIFICHE_SETUP.md** per le istruzioni dettagliate.

---

## Struttura del progetto

```
family-todo/
├── .env                 ← configurazione (NON caricare su Git)
├── .env.example         ← template
├── netlify.toml         ← configurazione Netlify
├── netlify/
│   └── functions/
│       └── notify.js    ← Netlify Function per inviare notifiche
├── public/
│   └── firebase-messaging-sw.js  ← service worker (template, non modificare)
└── src/
    ├── App.jsx          ← tutta la logica dell'app
    ├── firebase.js      ← configurazione Firebase
    ├── index.css        ← stili
    └── main.jsx         ← punto di ingresso
```

## Aggiornare l'app in futuro

Modifica i file in `src/`, poi:
```bash
npm run build
```
Trascina `dist/` su Netlify. **I dati su Firebase non vengono mai toccati.**
