# Pubblicazione, branch e release — decisioni e stato

**Data:** 2026-09-01
**Contesto:** riordino del repository in vista della produzione.
**Regola agenti:** `.cursor/rules/pubblicazione-e-branch.mdc` · **Flusso per le persone:** `README.md` §Contribuire

---

## 1. In breve

Il sito pubblico è servito da **GitHub Pages dalla radice di `main`**: non esiste uno step di deploy, quindi **ogni commit su `main` è online nell'istante del push**. Prima di questo lavoro non c'era alcun margine tra «fatto» e «pubblicato».

Ora esiste `develop` per raccogliere il lavoro non ancora verificato, e `main` riceve solo promozioni. Restano due limiti da conoscere: `develop` **non ha un indirizzo** raggiungibile, e i **dati non sono separati**.

---

## 2. Come funziona oggi (verificato sul progetto)

| Artefatto | Destinazione | Quando va online |
|-----------|--------------|------------------|
| **ERP** (`core/`, `modules/`, Tony client) | GitHub Pages — <https://vitaradragon.github.io/gfv-platform/> | **Subito**, al push su `main` |
| **Landing** (`landing/dist`) | Firebase Hosting — `gfv-platform.web.app` | Solo con `npm run deploy:landing` |
| **Cloud Functions**, **rules/indexes** | Firebase | Solo con `npm run deploy:*` |

Dettaglio comandi e troubleshooting: `DEPLOY_RUNBOOK.md`.

**Punti che contano:**

- Pages è configurato su `source: { branch: main, path: / }`, senza dominio personalizzato. **Un repository può avere un solo sito Pages**: non basta un'opzione per pubblicarne un secondo.
- La **PWA installata** punta lì (`manifest.json` → `core/dashboard-standalone.html`). Non c'è app store, quindi nessuna revisione e nessun rilascio graduale: pubblichi e nello stesso istante è di tutti.
- `service-worker.js` usa `SW_CACHE_BUILD_ID`, aggiornato da `.githooks/pre-commit` (`npm run bump:pwa-cache`), altrimenti la PWA resta sulla cache vecchia. **L'hook non gira per gli agenti**, perché Cursor sovrascrive `core.hooksPath`.
- Esiste **un solo progetto Firebase** (`gfv-platform`): `core/config/firebase-config.js`, `.firebaserc`.
- CI: `.github/workflows/simulator-ci.yml`, 7 job (emulatori, Playwright E2E, Tony vitest, canary manodopera e mappa) + `guida-impact-pr.yml`.

---

## 3. Decisioni prese

| # | Decisione | Stato |
|---|-----------|-------|
| 1 | `main` = solo versioni verificate; è il sito pubblico | **attivo** |
| 2 | `develop` = lavoro che funziona ma non è verificato a fondo; non pubblicato | **attivo** |
| 3 | Mai push diretto su `main`: sempre branch + PR | **attivo** (regola) |
| 4 | Base PR di default `develop`; `main` solo per promozione | **attivo** |
| 5 | Nessun merge o chiusura PR senza richiesta esplicita dell'utente | **attivo** (regola) |
| 6 | CI verde prima di promuovere su `main` | **attivo** |
| 7 | Prove di scrittura solo su emulatori/simulatore, mai su dati reali | **attivo** (regola) |
| 8 | Niente secondo ambiente adesso: prima feature flag e test automatici | **deciso** |
| 9 | Progetto Firebase separato = traguardo successivo, non ora | **deciso** |
| 10 | Le opzioni per un indirizzo di prova si **propongono**, non si implementano di iniziativa | **attivo** (regola) |

---

## 4. Cosa è stato fatto

**Pulizia GitHub (2026-08-31)** — da 10 branch a 1.

- Branch orfani dopo merge: le PR #2, #3, #4 erano squash-merged ma i rami erano rimasti, perché *Delete branch on merge* è disattivato.
- `cursor/manodopera-skill-auto-6276` e `cursor/manodopera-stelline` puntavano allo stesso commit.
- PR #6 duplicata di #7 (stesso titolo, stessi 5 file, diff vuoto) → chiusa.
- PR #1 ferma da maggio, contenuto già su `main` e codice arrivato con #2–#4 → chiusa.
- PR #7 e #8 rebasate/mergiate (conflitti solo di changelog), poi 7 branch eliminati.

**Nuovo assetto (2026-08-31 / 09-01)**

- Creato `develop`.
- CI: push anche su `develop` (prima solo `main`); le PR erano già coperte perché `pull_request` non ha filtro di branch.
- `README.md` §Contribuire (era un segnaposto vuoto): tabella branch, flusso, vincolo dati.
- `.cursor/rules/pubblicazione-e-branch.mdc` (`alwaysApply: true`): la stessa disciplina per gli agenti.
- `DEPLOY_RUNBOOK.md` §1 allineato: l'ERP non si pubblica più con `git push origin main`.
- Questo documento.

---

## 5. Come si lavora adesso

1. Nuovo lavoro → branch dedicato che parte da **`develop`**.
2. PR verso `develop`. La CI dà il segnale.
3. Prove **in locale**: emulatori (`?emulator=1`) o simulatore (`npm run sim:*`).
4. Quando la versione è sicura: PR `develop` → `main`. **Solo qui cambia il sito.**

```bash
git checkout develop && git pull        # allinea il laptop
git checkout -b <nome-lavoro>           # nuovo lavoro
npm run bump:pwa-cache                  # solo se tocchi codice servito al browser
```

**Rollback:** `git revert <commit>` + push su `main`; il sito torna indietro in circa un minuto. Vale la pena provarlo una volta a freddo.

### I due limiti da ricordare

**`develop` non ha un indirizzo.** Non è pubblicato da nessuna parte: dal telefono o da internet non lo vedi. Chi prova online lo fa su `main`.

**Il branch protegge il sito, non i dati.** `develop` e `main` condividono lo stesso Firestore, Auth e Storage: una prova di scrittura da `develop` colpisce comunque la produzione.

---

## 6. Alternative valutate

### Come si fa di solito

Il modello da manuale è a tre ambienti: locale → *staging* → produzione. La tendenza recente però va nella direzione opposta, perché **lo staging mente**: non ha mai gli stessi dati, lo stesso carico e gli stessi casi strani della produzione. Da qui il classico «da noi funzionava». Molte aziende che rilasciano spesso hanno ridotto gli ambienti e spostato il controllo sui **feature flag**: il codice nuovo arriva in produzione **spento** e si accende per pochi.

Un'app **nativa** ha un cuscinetto gratuito — canale beta, poi rilascio graduale all'1%, 5%, 20%, 100%, con possibilità di fermarsi a metà. Una **PWA no**: quel gradino va costruito, e il feature flag è esattamente quello.

### Opzioni sul tavolo

| Opzione | Cosa dà | Costo | Decisione |
|---------|---------|-------|-----------|
| **Feature flag per tenant** | Provare in produzione, dal telefono, senza esporre i clienti | Basso: lo schema esiste già | **Preferita** |
| **Secondo sito Firebase Hosting** su `develop` | Indirizzo di prova stabile, PWA separata | Medio: sito + dominio autorizzato in Auth | In attesa |
| **Progetto Firebase separato** | Isola davvero anche i **dati** | Alto: config, rules, Functions, notifiche | Traguardo successivo |
| **Duplicare solo l'indirizzo** | — | Basso | Scartata: risolve il problema meno grave |

Sui feature flag: il meccanismo per accendere funzioni per singolo tenant esiste già in `core/config/tony-module-gate.js` (+ gemello in `functions/`) e `core/config/subscription-plans.js`. Va riusato lo **schema**, con una **lista separata** da `moduliAttivi`: non mescolare «cosa il cliente ha pagato» con «cosa stiamo provando».

---

## 7. Cosa resta da fare

### Solo dall'interfaccia (utente)

| # | Cosa | Perché | Dove |
|---|------|--------|------|
| 1 | **Proteggere `main`** | È la produzione e oggi chiunque può pusharci direttamente, senza attriti | GitHub → Settings → Branches |
| 2 | **Delete branch on merge** | È il motivo per cui i rami mergiati si accumulavano | GitHub → Settings → General → Pull Requests |

Le regole sono una **convenzione, non un lucchetto**: guidano gli agenti che le leggono, non impediscono un push. Il lucchetto è la branch protection. Le due cose sono complementari.

### Implementabile su richiesta (agente)

| # | Cosa | Note |
|---|------|------|
| 3 | **Tag sulle release** | Il repository non ha nessun tag: «cosa c'è online» e «riportami a com'era martedì» oggi non hanno risposta precisa. Immediato |
| 4 | **Feature flag per tenant** | Vedi §6. Richiede una decisione su dove tenere la lista |
| 5 | **Secondo sito Firebase Hosting** | L'agente prepara target e workflow; l'utente crea il sito e aggiunge il dominio ai domini autorizzati di Auth. Per il deploy automatico serve una credenziale come secret del repository |
| 6 | **Progetto Firebase separato** | Da valutare quando i clienti veri saranno più di uno |

### Abitudini

| # | Cosa |
|---|------|
| 7 | Usare i **test automatici** come primo filtro: 7 job in pochi minuti sono più affidabili del provare cliccando dopo aver pubblicato |
| 8 | Provare il **rollback** una volta a freddo, per non impararlo nel panico |

---

## 8. Riferimenti

| File | Ruolo |
|------|-------|
| `.cursor/rules/pubblicazione-e-branch.mdc` | Regola agenti (sempre attiva) |
| `README.md` §Contribuire | Flusso per le persone |
| `DEPLOY_RUNBOOK.md` | Comandi deploy, Functions, secrets, troubleshooting |
| `.github/workflows/simulator-ci.yml` | CI: push su `main` e `develop`, tutte le PR |
| `.githooks/README.md` · `scripts/bump-pwa-cache-version.mjs` | Cache PWA |
| `core/config/tony-module-gate.js` · `core/config/subscription-plans.js` | Gating per tenant — base per i feature flag |
