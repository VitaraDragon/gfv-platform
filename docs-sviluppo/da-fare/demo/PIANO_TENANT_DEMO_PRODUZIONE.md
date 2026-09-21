# Piano tecnico — Tenant DEMO in produzione

**Data:** 2026-08-03 (geo v2: 2026-08-04)  
**Stato:** seed operativo + switcher + **geo privacy-safe v2** (fasce lineari O→E, origin privacy, stile mappa demo-only) — mancano reset wipe, conto terzi, più lavori (50+).  
**Progetto Firebase:** `gfv-platform` (**produzione**)  
**Non confondere con:** `simulator/` (solo emulator locale; `guard-production.js` vieta scritture cloud)

Documenti collegati:
- Tool CLI: `scripts/demo-cloud/README.md`
- Video presentazione: `docs-sviluppo/PIANO_VIDEO_PRESENTAZIONE_PROF_E_RIUSO_COMMERCIALE.md`
- Storyboard/clip: `docs-sviluppo/VIDEO_STORYBOARD_SCRIPT_E_CLIP.md`
- Simulatore (riferimento generatori, **non** riuso diretto su prod): `docs-sviluppo/simulator/GFV_FARM_SIMULATOR.md`

---

## 1. Obiettivo

Creare un’**azienda demo cloud reale** per:
- presentazioni (professore, commerciali, tester);
- video con Tony funzionante (Auth produzione → Cloud Functions OK);
- verificare catene complete (comunicazioni, ore, validazioni, sostituzioni, guasti, magazzino, colture).

Il tenant vive su Firebase come un’azienda normale; i dati nascono da **seed Admin SDK**, non da inserimento manuale lento.

---

## 2. Decisioni prodotto (chiuse)

| Voce | Valore |
|------|--------|
| Nome azienda | **AZIENDA DEMO GFV** |
| Ambiente | Produzione `gfv-platform` |
| Organico Auth | 1 manager, **3** capisquadra, **20** operai |
| Nomi UI | Italiani inventati (es. Mario Rossi, Anna Bianchi) |
| Email | `nome.cognome@gfvdemo.app` (ID Auth; non serve casella posta reale) |
| Password | `DemoGFV2026!` (**condivisa**) |
| Accesso | Pagina **switcher one-click** con URL proprio, condividibile |
| Moduli | **Tutti** quelli disponibili, incluso **Tony** |
| Piano tenant | `base` (widget Tony + moduli) |
| Seed | **Pieno**, storico ~**3 mesi** lavorativi |
| Contenuti storici | Trattamenti, potature, concimazioni, vendemmie, guasti, movimenti magazzino, lavori/ore/comunicazioni/assenze utili alle sostituzioni |
| Reset | Sì — **script admin** + **pulsante nello switcher** (stessa password) |
| Disattivazione moduli | Dopo il seed si possono spegnere manualmente da configurazione per prove |

### Moduli da attivare nel seed

Da `core/config/subscription-plans.js` (disponibili):

```
manodopera, parcoMacchine, contoTerzi, vendemmiaMeccanica,
vigneto, frutteto, magazzino, tony, report, meteo
```

`oliveto` = definito ma non disponibile → **non** attivare.  
`core` = implicito.

**Billing:** nessun `stripeCustomerId` / subscription / addon sul tenant demo. Solo `plan/piano: "base"` + `modules/moduli` completi + flag demo (sotto).

---

## 3. Modello Auth e switcher

### 3.1 Un account Firebase per persona
- Manager (ruolo consigliato: `amministratore` + eventuale `manager` se serve coerenza UI)
- 3 × `caposquadra`
- 20 × `operaio`

Ogni user document deve avere **sia** campi canonici sia compatibilità legacy (ancora usati da liste/regole):

```
users/{uid}
  email, nome, cognome
  stato: "attivo"
  ruoli: [...]                    // legacy
  tenantId: "<demoTenantId>"      // legacy
  tenantMemberships: {
    "<demoTenantId>": {
      ruoli: [...],
      stato: "attivo",
      tenantIdPredefinito: true
    }
  }
```

Auth: `displayName` = `"Nome Cognome"`; email = slug `@gfvdemo.app`.

### 3.2 Pagina switcher (produzione)

**Path proposto:** `core/dev/demo-switcher-standalone.html`  
(URL pubblico tipo: `https://<hosting>/core/dev/demo-switcher-standalone.html`)

Comportamento:
1. Gate iniziale con password demo (`DemoGFV2026!`).
2. Elenco one-click raggruppato:
   - Manager
   - Caposquadra (3, con nome)
   - Operai per squadra (20)
3. Click → `signInWithEmailAndPassword` → set tenant corrente → redirect:
   - manager → dashboard
   - capo/operaio → `field-workspace-standalone.html`
4. Pulsante **Ripristina demo** (conferma doppia) → chiama reset (callable protetta o flusso documentato).

**Ispirazione UI:** `core/dev/simulator-dev-standalone.html` + `core/js/simulator-browser-auth.js`  
**Non copiare:** emulator flag, `manifest.json` locale, storage credenziali emulator.

**Modalità Firebase (anti-kick / anti-9099):**
- Lo switcher imposta `localStorage` + `sessionStorage` `gfv_demo_cloud_session=1` e rimuove `gfv_firebase_emulator`.
- `shouldUseFirebaseEmulator()` rispetta quel flag (priorità su `?emulator=1`).
- Il simulatore, entrando, **cancella** la sessione demo cloud e riattiva l’emulator — non mescolare i due tab per video/Tony.

### 3.3 Sicurezza switcher
- Non è un backdoor admin globale: fa solo login degli account demo noti.
- Chi ha URL + password può impersonare tutti i ruoli demo → accettabile per professore/tester; **non** pubblicare su landing marketing senza contesto.
- Opzionale fase 2: rate-limit / nascondere reset ai soli “operatori” (stessa password o seconda chiave).

---

## 4. Tagging tenant (obbligatorio per reset sicuro)

Su `tenants/{tenantId}`:

```
name / nome: "AZIENDA DEMO GFV"
plan / piano: "base"
modules / moduli: [ ...tutti... ]
status: "active"
demoSeed: true
demoSeedId: "gfv-demo-v1"          // o timestamp/version
demoSeedVersion: 1
demoSeedAt: <timestamp>
createdAt / updatedAt
```

**Reset consentito solo se** `demoSeed === true` **e** `demoSeedId` combacia con quello richiesto.  
Mai cancellare tenant senza questi flag.

Auth users creati dallo seed: custom claims o metadati lato Firestore (`demoSeedId` su user) per poterli cancellare in reset senza toccare utenti reali.

---

## 5. Architettura implementativa

### 5.1 Perché non usare `simulator/` così com’è
- `simulator/lib/guard-production.js` **blocca** la produzione di proposito.
- Context Admin legato a emulator (`emulator-context.js`).

### 5.2 Nuovo tool (separato)

| Pezzo | Path proposto |
|-------|----------------|
| Seed/reset CLI | `scripts/demo-cloud/seed-demo-tenant.mjs` |
| Config quantità/nomi | `scripts/demo-cloud/demo-config.json` (o `.mjs`) |
| Generatori | riuso selettivo da `simulator/generators/*` **senza** importare guard emulator |
| Switcher UI | `core/dev/demo-switcher-standalone.html` |
| Helper login switcher | `core/js/demo-switcher-auth.js` |
| Reset da UI (fase 2) | Callable HTTPS `resetDemoTenant` in `functions/` (solo se `demoSeed` + secret/password hash) |

### 5.3 Guardie CLI (obbligatorie)
Lo script **deve** rifiutare l’esecuzione se manca anche solo uno di:
- `--project=gfv-platform`
- `--confirm-production`
- `--demo-id=gfv-demo-v1` (o id corrente)
- default `--dry-run` (scritture solo con `--execute`)

In più:
- abort se sono settate env emulator (`FIRESTORE_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST`);
- log chiaro di cosa verrà creato/cancellato.

Credenziali Admin: `FIREBASE_SERVICE_ACCOUNT` o `firebase-service-account.json` / ADC (stesso pattern di `scripts/migrate-user-tenant-memberships.js`).

---

## 6. Piano seed — fasi

Ordine consigliato (allineato all’orchestrator sim, adattato a 3 mesi + organico demo):

| Fase | Contenuto |
|------|-----------|
| 0 | Dry-run / validazione config |
| 1 | Crea Auth manager + doc `tenants` + `users` manager |
| 2 | Asset: terreni, vigneti, frutteti, trattori, attrezzi, flotta, prodotti magazzino, cataloghi se servono |
| 3 | Personas: 3 capi + 20 operai (Auth + users + membership) |
| 4 | Manodopera struttura: squadre (es. 3), lavori assegnati, impegni |
| 5 | Storico ~3 mesi: attività diario, potature, trattamenti, concimazioni, vendemmie |
| 6 | Magazzino: movimenti collegati dove sensato |
| 7 | Parco: guasti (aperti/chiusi), scadenze/manutenzioni realistiche |
| 8 | Ore validate + da validare, comunicazioni, assenze + casi utili alle **sostituzioni** |
| 9 | Conto terzi minimo (clienti/tariffe/preventivi) se moduli attivi |
| 10 | Scrivi manifest demo (`scripts/demo-cloud/demo-manifest.json`) con uid/email per lo switcher |
| 11 | Smoke check (conteggi minimi) |
| Geo | Arricchimento privacy-safe (terreni/zone/guasti) — fase CLI `--geo-only` (v2) |

### 6.1 Geo privacy-safe v2 (solo tenant demo)

**Scopo:** mappe credibili per video/presentazioni **senza** esporre aziende/strade reali italiane riconoscibili.

| Voce | Valore |
|------|--------|
| Tenant | solo `demo_azienda_demo_gfv_v1` (`demoSeedId=gfv-demo-v1`) |
| Versione | `demoGeoSafeVersion: 2` su `tenants/{id}` |
| Origin | ~44.7215 / 27.5482 — cluster “Demo Valley GFV (privacy-safe v2)” (pianura aperta; **non** Veneto) |
| Terreni | poligoni rettangolari su griglia sintetica (`demoTerrenoSlot`) |
| Zone lavorate | **fasce lineari ovest→est** (`linearWorkedStrip`), tipicamente 2 giorni consecutivi — **non** concentriche |
| Guasti | pin GPS dentro il poligono del terreno |
| UI stile mappa | `core/js/demo-map-privacy.js` — roadmap senza POI/etichette **solo se** `tenantId === demo_azienda_demo_gfv_v1` (gestione lavori + mappa aziendale) |
| Codice seed | `scripts/demo-cloud/lib/demo-geo-safe.js` + `phase-geo-enrich.mjs` |

**Non tocca** tenant reali: né coordinate seed, né stile mappa (gate stretto su tenantId).

```bash
npm run demo:cloud:seed -- --project=gfv-platform --demo-id=gfv-demo-v1 \
  --geo-only --force-geo --confirm-production --execute
```

**Video:** default demo = roadmap privacy; evitare Street View / zoom largo con etichette; se si forza satellite, le etichette Google possono riapparire in parte.

### Quantità target (ordine di grandezza)

| Entità | Target |
|--------|--------|
| Manager | 1 |
| Capisquadra | 3 |
| Operai | 20 |
| Squadre | 3 (una per capo, ~6–7 operai) |
| Terreni | ≥6 (mix vigneto/frutteto) |
| Storico | ~90 giorni / ~60–65 gg lavorativi |
| Lavori | mix aperti + chiusi/completati |
| Ore | molte validate + alcune `da_validare` |
| Comunicazioni | diverse, anche recenti |
| Assenze / standby | almeno 2–3 scenari per shortlist/sostituzioni |
| Guasti | mix aperti/risolti |
| Movimenti magazzino | decine, collegati ad attività dove possibile |

> Nota: i template sim attuali (`regime-max-manodopera` = 2 capi/10 op / ~30 gg; `mista-…` più moduli ma meno manodopera) sono **riferimento**, non copia 1:1. Il config demo cloud avrà quantità proprie (3/20 + 3 mesi).

---

## 7. Reset

### 7.1 Script
```bash
# solo preview
node scripts/demo-cloud/seed-demo-tenant.mjs --project=gfv-platform --demo-id=gfv-demo-v1 --reset --dry-run

# esecuzione
node scripts/demo-cloud/seed-demo-tenant.mjs --project=gfv-platform --demo-id=gfv-demo-v1 --reset --confirm-production --confirm-delete=gfv-demo-v1 --execute
```

Passi reset:
1. Trova tenant con `demoSeed==true` e `demoSeedId` richiesto.
2. Delete ricorsivo `tenants/{id}/**` + doc tenant.
3. Delete Auth users marcati dal seed (+ doc `users/{uid}` correlati).
4. Poi (opzione) rilancia seed completo.

### 7.2 Pulsante switcher
- Conferma UI (“Scrivi RESET”) + password demo.
- Chiama callable o endpoint protetto che esegue la stessa pipeline.
- Finché la callable non esiste: il pulsante può mostrare istruzioni + “reset solo da script” (MVP), poi si completa.

---

## 8. Rischi e mitigazioni

| Rischio | Mitigazione |
|---------|-------------|
| Cancellare dati non-demo | Flag `demoSeed` + `demoSeedId` + confirm espliciti |
| Costi Tony/Gemini | Tenant unico; uso controllato; monitor usage |
| Stripe che altera moduli | Nessun collegamento Stripe sul demo |
| Email `@gfvdemo.app` | OK come ID Auth; non usare recovery email |
| Switcher pubblico | Gate password; non linkarlo in homepage marketing |
| Inconsistenza ruoli legacy | Scrivere sia `ruoli`/`tenantId` sia `tenantMemberships` |
| Divergere dal sim | Documentare quantità demo; riusare generatori, non orchestrator emulator |
| Geo su luogo riconoscibile | Origin v2 fuori Veneto + stile senza etichette (solo demo) |
| Zone concentriche (non realistiche) | v2: fasce lineari O→E |
| Tab simulatore + demo misti | Flag `gfv_demo_cloud_session` / clear emulator; usare solo lo switcher per Tony |

---

## 9. Criteri di accettazione

- [ ] Esiste tenant **AZIENDA DEMO GFV** in prod con tutti i moduli + `plan: base` + Tony
- [ ] Login manager / 3 capi / 20 operai con password condivisa
- [ ] Nomi italiani visibili in UI; email `@gfvdemo.app`
- [ ] Switcher one-click funziona e reindirizza ai destini giusti
- [ ] Storico ~3 mesi navigabile (diario, vigneto/frutteto, magazzino, guasti, manodopera)
- [ ] Flusso comunicazioni + ore + validazione percorribile tra ruoli
- [ ] Almeno uno scenario utile alle sostituzioni (assenza/shortlist)
- [x] Tony risponde **senza 401** (Auth prod) — usare switcher, non emulator
- [x] Geo v2: fasce lineari + origin privacy + stile mappa solo demo (2026-08-04)
- [ ] Reset dry-run + reset execute ripristinano uno stato pulito e ri-seedabile
- [ ] Nessun impatto su altri tenant / nessun campo Stripe sul demo

---

## 10. Piano di lavoro suggerito (implementazione)

1. ~~**Config + CLI skeleton**~~ ✅  
2. ~~**Personas 3+20** + manifest~~ ✅  
3. ~~**Asset + storico ~3 mesi**~~ ✅ (65 attività, stub vigneto/frutteto, magazzino, guasti)  
4. ~~**Manodopera** (squadre, lavori, ore, comm, assenze)~~ ✅  
5. ~~**Switcher UI** + gate password~~ ✅  
   - `core/dev/demo-switcher-standalone.html`  
   - `core/dev/demo-cloud-roster.js`  
   - `core/js/demo-switcher-auth.js`  
   - Locale: `http://127.0.0.1:8000/core/dev/demo-switcher-standalone.html`  
   - Pages: `https://vitaradragon.github.io/gfv-platform/core/dev/demo-switcher-standalone.html`  
6. ~~**Geo privacy-safe** (terreni/zone/guasti)~~ ✅ v2: fasce lineari O→E + origin privacy + stile mappa demo-only  
7. **Reset script** wipe end-to-end  
8. **Reset da switcher** (callable)  
9. **Conto terzi minimo** + **50+ lavori**  
10. **Smoke** video mappa/zone/guasto (roadmap privacy demo; fasce lineari)  
11. ~~Aggiornare storyboard scene mappa~~ ✅ note privacy/fasce in storyboard + piano video

### Comandi skeleton

```bash
# solo piano (no credenziali)
npm run demo:cloud:seed -- --project=gfv-platform --demo-id=gfv-demo-v1 --plan-only

# dry-run + probe Firestore (serve service account / ADC)
npm run demo:cloud:seed -- --project=gfv-platform --demo-id=gfv-demo-v1

# scrive SOLO fase 1 (tenant + manager) — produzione
npm run demo:cloud:seed -- --project=gfv-platform --demo-id=gfv-demo-v1 --confirm-production --execute
```

---

## 11. Fuori scope (per ora)

- Branch Git `DEMO` / `STAGING` (non necessari per il tenant dati)
- Seed su emulator tramite questo tool (resta `simulator/`)
- Dominio DNS reale `gfvdemo.app` per posta in ingresso
- Multi-tenant demo multipli (v1 = un solo `demoSeedId`)

---

## 12. Prossimo passo operativo

Quando si passa all’implementazione:
1. Verificare presenza credenziali Admin SDK in locale (senza committarle).
2. Implementare CLI fase 1 in dry-run su progetto reale (solo log).
3. Solo dopo review dry-run: `--execute` creazione tenant.

**Non** indebolire `simulator/lib/guard-production.js`.
