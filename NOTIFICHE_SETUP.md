# 🔔 Setup Notifiche Push

Questa guida ti spiega come attivare le notifiche push. Ci vogliono circa 20 minuti.

---

## Panoramica dei pezzi

```
Browser di Marco          Netlify             Firebase
─────────────────         ────────            ────────
"Aggiungo task"     →  Function /notify  →  Legge token di Laura
                         │
                         └─► FCM  →  Browser di Laura  →  🔔 Notifica
```

---

## Passo 1 — Attiva Firebase Cloud Messaging

1. Vai su [console.firebase.google.com](https://console.firebase.google.com) → tuo progetto
2. Nel menu a sinistra: **Build → Cloud Messaging**
3. Se vedi un banner "Firebase Cloud Messaging API", clicca **Manage API in Google Cloud Console**
   e assicurati che sia attiva (pulsante blu "Enable")

---

## Passo 2 — Genera la VAPID Key

1. **Firebase Console → Impostazioni progetto ⚙️** (icona ingranaggio in alto a sinistra)
2. Scheda **Cloud Messaging**
3. Scorri fino a **"Web Push certificates"**
4. Clicca **"Generate key pair"**
5. Copia la stringa che appare (lunga, tipo `BKag3...`)

---

## Passo 3 — Crea il file `.env`

Nella cartella del progetto crea un file chiamato `.env` (copia da `.env.example`):

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=tuoprogetto.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://tuoprogetto-default-rtdb.europe-west1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=tuoprogetto
VITE_FIREBASE_STORAGE_BUCKET=tuoprogetto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef

VITE_FIREBASE_VAPID_KEY=BKag3...   ← chiave del Passo 2
```

I primi 7 valori sono gli stessi della configurazione Firebase che hai già.

---

## Passo 4 — Crea il Service Account Firebase

Il service account permette alla Netlify Function di inviare notifiche in modo sicuro.

1. **Firebase Console → Impostazioni progetto ⚙️ → Account di servizio**
2. Clicca **"Genera nuova chiave privata"**
3. Si scarica un file JSON — **tienilo al sicuro, non caricarlo mai su GitHub**
4. Apri il file con un editor di testo, seleziona tutto il contenuto e **minificalo**:
   - Vai su [jsonminifier.org](https://www.jsonminifier.org/) oppure
   - Copia il JSON in un terminale: `cat service-account.json | tr -d '\n'`

Otterrai una lunga stringa su una riga sola, tipo:
```
{"type":"service_account","project_id":"tuoprogetto","private_key_id":"abc...
```

---

## Passo 5 — Configura le variabili d'ambiente su Netlify

Vai su **Netlify Dashboard → tuo sito → Site configuration → Environment variables**

Aggiungi queste variabili:

| Nome | Valore |
|------|--------|
| `VITE_FIREBASE_API_KEY` | il tuo API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | il tuo auth domain |
| `VITE_FIREBASE_DATABASE_URL` | l'URL del database |
| `VITE_FIREBASE_PROJECT_ID` | il tuo project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | il tuo storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | il messaging sender ID |
| `VITE_FIREBASE_APP_ID` | il tuo app ID |
| `VITE_FIREBASE_VAPID_KEY` | la VAPID key del Passo 2 |
| `FIREBASE_SERVICE_ACCOUNT` | il JSON minificato del Passo 4 |
| `FIREBASE_DATABASE_URL` | l'URL del database (uguale a VITE_FIREBASE_DATABASE_URL) |

---

## Passo 6 — Aggiorna le regole Realtime Database

Aggiungi la possibilità di leggere i token FCM (già coperto dalle regole "true" impostate prima).
Se hai regole più restrittive, assicurati che il percorso `/fcm_tokens` sia leggibile e scrivibile.

---

## Passo 7 — Deploy

```bash
npm run build
```

Trascina la cartella `dist/` su Netlify come al solito.

---

## Come funziona una volta attivo

1. La prima volta che aprite l'app, il browser chiede **"Vuoi ricevere notifiche?"** → cliccate Consenti
2. Il token FCM del dispositivo viene salvato su Firebase
3. Quando Marco aggiunge un task sulla lista di Laura, viene chiamata la Netlify Function
4. La function recupera il token di Laura da Firebase e manda la notifica tramite FCM
5. Laura riceve la notifica sul telefono/PC anche se l'app è chiusa

**Nota:** le notifiche funzionano solo nella versione pubblicata su Netlify, non in locale con `npm run dev`.

---

## Troubleshooting

**"Connessione a Firebase…" non scompare**
→ Controlla che i valori nel file `.env` siano corretti e non abbiano spazi extra.

**Notifiche non arrivano**
→ Verifica che le variabili d'ambiente su Netlify siano salvate e che il sito sia stato ri-deployato dopo averle aggiunte.
→ Controlla che nel browser le notifiche siano abilitate (Impostazioni → Notifiche → tuo sito → Consenti).

**Errore nella Netlify Function**
→ Vai su Netlify Dashboard → Functions → notify → vedi i log degli errori.
