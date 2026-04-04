# Sicurezza – Flussi GFV Platform (riferimento operativo)

**Ultimo aggiornamento**: 2026-04-04

Documento sintetico per **perimetro** e **deploy**; il dettaglio storico resta in `COSA_ABBIAMO_FATTO.md`.

---

## 1. Accettazione / rifiuto preventivo da link email (cliente senza account)

**Pagina**: `modules/conto-terzi/views/accetta-preventivo-standalone.html`  
**Autenticazione**: nessuna. Il diritto d’uso del link è legato al segreto del **`tokenAccettazione`** nel URL (HTTPS).

### Perimetro

| Elemento | Ruolo |
|----------|--------|
| **Callable `getPreventivoPubblico`** | Legge i dati necessari alla UI (token → `collectionGroup('preventivi')` + eventuale nome cliente). Regione **`europe-west1`**, **`cors: true`**, **`invoker: "public"`**. |
| **Callable `aggiornaStatoPreventivoPubblico`** | Aggiorna stato (`accetta` / `rifiuta`) con validazione server (scadenza, stati ammessi). Stesse opzioni di regione/CORS/invoker. |
| **Firestore client nel browser** | **Non** usato per `tenants`, `clienti`, `preventivi` su questa pagina. |
| **Firestore rules** | Tenant/clienti/preventivi solo per utenti autenticati nel tenant; niente letture pubbliche per sostituire le callable. |
| **Indici** | In **`firebase.json`** la chiave `firestore` deve includere **`"indexes": "firestore.indexes.json"`**. Per la query su `tokenAccettazione` in collection group **`preventivi`** usare un **field override** (scope COLLECTION + COLLECTION_GROUP), non una voce “composito” errata a un solo campo. |
| **Secret** | Non legare **`SENTRY_DSN`** (`secrets: [sentryDsn]`) a queste due callable: se il secret non è disponibile sulla revisione Cloud Run, le richieste possono rispondere **500**. `instrument.js` resta ok senza DSN. |

### Operatività

- **Deploy tipico**: `firebase deploy --only functions,firestore:rules,firestore:indexes` (e hosting se cambi l’HTML).
- **404** sulla URL della callable → function non deployata. Messaggio **CORS** in console su preflight può mascherare **404/403**: verificare deploy e IAM (`invoker: "public"`).
- **Tony** sulla pagina pubblica: spesso compare `moduli_attivi non trovati` (nessun tenant); è atteso e non indica un problema di sicurezza del preventivo.

### Miglioramenti opzionali

- App Check sulle callable, rate limiting a livello infrastruttura se compaiono abusi.

---

## 2. Inviti utente (Firestore)

Regole su `inviti`: creazione solo da utente autenticato, vincoli su `inviatoDa`, `stato`, `tenantId`, ruoli manager/admin. Dettaglio in `COSA_ABBIAMO_FATTO.md` (sezione inviti).

---

## Riferimenti incrociati

- `functions/README.md` — preventivo pubblico, indici, secret, regione.
- `docs-sviluppo/tony/MASTER_PLAN.md` — §6.3 (allineamento architetturale Tony / no patch client anonime).
- `firestore.rules`, `firebase.json`, `firestore.indexes.json` — sorgenti da versionare.
