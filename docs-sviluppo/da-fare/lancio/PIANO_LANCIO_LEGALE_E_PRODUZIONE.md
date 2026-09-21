# Lancio legale e produzione — punto di partenza

**Data:** 2026-09-08  
**Stato:** piano di lavoro (nessuna implementazione in questo documento)  
**Origine:** conversazione product (Iubenda, GDPR, P.IVA agricola, cosa manca per vendere) + verifica sul codice dello stesso giorno.

> **Non è un parere legale né fiscale.** Orienta il lavoro (documenti, Stripe, prodotto). Prima di fatturare: commercialista; prima di scalare dati di manodopera / AI: avvocato privacy se serve.

**Documenti collegati:** `STRATEGIA_MARKETING_VENDITA_HANDOFF.md`, `in-sviluppo/abbonamento/BILLING_V2_HANDOFF.md`, `PUBBLICAZIONE_BRANCH_E_RELEASE.md`, `TONY_DECISIONI_E_REQUISITI.md` §1.21 (limiti Free) e §11.5 (niente GPS continuo).

---

## 1. In una pagina

GFV **funziona già come app** (registrazione, Free, Abbonamento, moduli, Tony). **Non è ancora vendibile** con soldi veri: Stripe è in test, l’attivazione dopo il pagamento è fragile, chi smette di pagare resta dentro, in registrazione **non** si accettano Privacy/Termini.

Iubenda è il kit **documenti + cookie**, non lo scanner del repo e non il via libera commerciale.

La **P.IVA agricola individuale** (26 anni, intestata al titolare) va bene come soggetto di partenza **se** il commercialista aggiunge l’attività software. Non si fatturano gli abbonamenti nel regime agricolo.

La landing «Stiamo arrivando» **non** è il blocco: login e ERP sono già su GitHub Pages. Manca il **contratto soldi ↔ accesso** e il **minimo legale in-app**.

```
P.IVA + attività software     Iubenda (testi)     Codice (checkbox, Stripe live, lock)
         │                         │                            │
         └─────────────────────────┴────────────────────────────┘
                              primo cliente che paga
```

---

## 2. Iubenda — cosa è e cosa non è

### 2.1 A cosa serve (sì, è utile)

Piattaforma italiana per:

- Privacy Policy (GDPR)
- Cookie Policy + banner (CMP, registro consensi)
- Termini e Condizioni
- aggiornamenti quando cambia la norma
- catalogo clausole (Firebase, Stripe, Maps, geolocalizzazione, AI, …)
- widget da mettere in footer / registrazione

Per GFV è il posto giusto per i **testi visibili**. Non sostituisce P.IVA, DPA, fatture, Statuto dei lavoratori.

### 2.2 Site Scanner (una pagina alla volta)

- Pubblico: [iubenda.com/it/scanner](https://www.iubenda.com/it/scanner/)
- In dashboard: **«Analizza il sito e rileva automaticamente i servizi»**
- Cookie Scanner: elenco cookie → policy

È un **crawler sull’URL live**. Vede script/cookie in pagina. Non entra nel login, non legge Firestore, Cloud Functions, Gemini, manodopera.

Per noi: **1–2 URL** (landing + login). Il resto si spunta **a mano** nel catalogo.

### 2.3 MCP ufficiale — non analizza GitHub

Esiste: `https://mcp-server.iubenda.com/mcp` (OAuth). Guida: [connettere iubenda a Claude/ChatGPT](https://www.iubenda.com/en/help/222393-how-to-connect-iubenda-to-claude-and-chatgpt/).

Fa da **telecomando dell’account** (siti, scan URL, policy, banner, catalogo servizi). **Non** apre il repository. Org GitHub iubenda: SDK/snippet, niente Action sul source.

Combo utile: inventario dal **codice** (questo repo / agente) → spunta servizi su Iubenda (dashboard o MCP).

Strumenti terzi che scansionano il codice (Codepliant, ecc.) **non** sono Iubenda e non sono parere legale.

### 2.4 Cosa spuntare nel generatore (allineato al codice)

Tipo progetto: **SaaS / web app**, non blog. Lingua: italiano.

| Servizio / trattamento | Dove sta nel prodotto |
|------------------------|------------------------|
| Firebase Auth, Firestore, Storage | `core/config/firebase-config.js`, Auth, dati tenant |
| Stripe | Checkout abbonamenti (`functions/stripe-billing.js`) |
| Google Maps | terreni, lavori, dashboard |
| Geolocalizzazione **puntuale** | segnatura ore / «Segnala qui» — **non** tracking continuo (scartato, §11.5) |
| Account utente, ruoli, inviti | registrazione, `users`, Resend |
| Assistente AI (Tony / Gemini) | Cloud Functions, testi e dati aziendali |
| Email transazionali | Resend, `no-reply@globalfarmview.net` |
| PWA | `manifest.json`, service worker |
| Pagamenti ricorrenti / abbonamento annuale | catalogo `subscription-plans.js` |

Aggiungere a mano (lo scanner non li vede): newsletter se arriverà, WhatsApp se si attiva, Retention foto documenti (roadmap magazzino).

---

## 3. GDPR — due ruoli, non uno

GFV non è un sito vetrina: il cliente **carica dati di altre persone**.

| Ruolo | Dati | Chi |
|--------|------|-----|
| **Titolare** | email account, pagamenti, log, eventuale marketing sito | GFV (la P.IVA del titolare) |
| **Responsabile (art. 28)** | operai, clienti CT, terreni, GPS puntuale, documenti, chat Tony | GFV **per conto del cliente** |

La Privacy Iubenda copre soprattutto il **primo**. Il **DPA** copre il secondo. Senza DPA i PDF sul sito non chiudono un ERP B2B.

**Basi giuridiche (orientamento, da confermare):** contratto per account e servizio; **non** usare il “consenso del dipendente” per i dati in app (rapporto di lavoro: squilibrio). Il titolare verso gli operai è **l’azienda agricola cliente**; nei T&C/DPA va scritto.

AI: dichiarare che Tony è un assistente, non un agronomo/avvocato; i testi possono andare a Google (Gemini); non addestrare modelli propri sui dati clienti.

---

## 4. P.IVA agricola già esistente (decisione aperta col commercialista)

**Fatto:** P.IVA agricola operativa da 26 anni, **intestata al titolare** (ditta individuale agricola).

**Implicazione:** va bene come *soggetto* (nome, P.IVA, sede in Iubenda e Stripe). **Non** va bene vendere SaaS come se fosse prodotto agricolo / stesso ATECO / regime speciale agricolo.

Passo da fare **fuori dal repo** (una domanda al commercialista):

> Devo fatturare abbonamenti software SaaS (ERP) a altre aziende, Stripe, IVA 22%, fattura elettronica. Posso **aggiungere attività secondaria** (software / 62.xx) a questa P.IVA, o serve un soggetto nuovo?

Atteso tipico: **stessa P.IVA**, secondo codice attività, fatture GFV in IVA ordinaria, corrispettivi agricoli e software **separati** in contabilità.

Finché resti ditta individuale: multe GDPR, chargeback Stripe, danni da bug → **patrimonio personale**. Per i primi clienti è accettabile; una S.r.l. è uno step successivo, non il giorno 1.

Stripe e Iubenda: stesso nominativo della P.IVA, oggetto “piattaforma software”, non “azienda agricola”.

---

## 5. Stato prodotto (codice, 2026-09-08)

### 5.1 Già in piedi — non rifare

| Pezzo | Note |
|--------|------|
| Registrazione → tenant `piano: 'free'` | `core/auth/registrazione-standalone.html` |
| Limiti Free | 5 terreni, 30 attività/mese — `plan-limits-service.js` (CRUD terreni/attività) |
| Abbonamento | Base, moduli, bundle, prova 30 giorni senza carta |
| Checkout Stripe | piano / modulo / bundle — **solo test** |
| Menu Moduli | solo moduli attivi (`dashboard-sections.js`) |
| Tony sul Free | widget e CF spenti |
| Email inviti/preventivi | Resend, mittente `no-reply@globalfarmview.net` |
| Disattiva/riattiva addon | `cancelStripeAddon` / `reactivateStripeAddon` + webhook parziale |

Sito pubblico `index.html`: copy «Stiamo arrivando». ERP comunque raggiungibile (es. `core/auth/login-standalone.html` su GitHub Pages).

### 5.2 Cosa manca per **incassare** (produzione)

Ordine di blocco.

#### A — Stripe Live (blocco assoluto)

- `core/config/stripe-config.js`: `STRIPE_ENV = 'test'`, chiave `pk_test_…`
- `STRIPE_PRICE_IDS.live` in `subscription-plans.js` è **`{}`** (i `price_` sono solo in `test`)
- `functions/config/stripe-prices.json` è **generato** da quel catalogo (`generate-tony-configs.js`)

**Come fare:**

1. Dashboard Stripe → modalità **Live**.
2. Creare prodotti/prezzi annuali EUR (stesso catalogo dello script `functions/scripts/sync-stripe-catalog.js`, adattato a live) **oppure** duplicare i prodotti test in live e copiare gli ID.
3. Compilare `STRIPE_PRICE_IDS.live` + rigenerare `stripe-prices.json`.
4. Secret Firebase `STRIPE_SECRET_KEY` = `sk_live_…`; env functions `STRIPE_ENV=live`.
5. Client: `STRIPE_ENV = 'live'` e `pk_live_…`.
6. Webhook Live → `stripeWebhook` (europe-west1), nuovo `STRIPE_WEBHOOK_SECRET` (`whsec_` live).
7. **Un pagamento vero** del titolare: Free → Base → un modulo → disattiva → (se possibile) fail rinnovo.

Senza A, il resto è sandbox.

#### B — Attivazione dopo il pagamento (fragile)

Oggi `fulfillStripeCheckout` parte se l’utente **torna** su Abbonamento (`?checkout=success&session_id=`). Il webhook **non** gestisce `checkout.session.completed` (solo `customer.subscription.updated` / `deleted` e `invoice.payment_failed`).

**Rischio:** paga e chiude il telefono → soldi presi, accesso spento (o ritardo).

**Come fare:** gestire `checkout.session.completed` (stessa logica di fulfill, idempotente) e/o confermare che `subscription.updated` + metadata `subscription_data` copra già i nuovi acquisti; testare il caso “chiudi tab”.

#### C — Chi non paga resta dentro (buco commerciale)

`invoice.payment_failed` scrive solo `billingPaymentFailedAt`. `status: expired` colora Abbonamento. **Nessun lock** sul resto dell’app.

**Come fare (prodotto da chiudere):** rinnovo fallito o Base scaduto → `plan/piano: free`, svuotare (o spegnere) `modules[]` / bundle, Tony off, limiti Free. Messaggio chiaro in dashboard + Abbonamento. Definire grazia (es. 3–7 giorni) col titolare prima di tagliare.

#### D — Dominio quando l’ERP non è solo github.io

Oggi hardcoded:

- inviti: `APP_BASE_URL` = `https://vitaradragon.github.io/gfv-platform`
- ritorno Checkout: fallback stesso host
- notifiche: `NOTIFICATION_WEB_ORIGIN` uguale

**Come fare:** Firebase Auth → domini autorizzati; una sola costante di base URL; Maps: HTTP referrer; Resend già su `globalfarmview.net` — allineare link app allo stesso host quando l’ERP ci va.

#### E — Minimo legale **in codice**

| Voce | Stato |
|------|--------|
| Checkbox registrazione Privacy + Termini (+ DPA) | **Assente** |
| Footer link policy | **Assente** |
| Log chi ha accettato (uid, versione, timestamp) | **Assente** |
| Banner cookie landing | da Iubenda, se ci sono script terzi |

Senza checkbox, i testi Iubenda **non** sono accettati.

### 5.3 Cosa **non** blocca i primi clienti (può aspettare)

| Voce | Perché |
|------|--------|
| Billing v2 coterm / «passa al bundle» | `BILLING_V2_HANDOFF.md` Fasi 2–4 — rinnovi un po’ disordinati, si vende lo stesso |
| Stripe Customer Portal | fatture/carta a mano i primi mesi |
| Landing marketing / ads | vendita diretta |
| Secondo progetto Firebase | dati già unici in produzione |
| DPIA formale | calendario quando c’è manodopera vera in prod |
| DPO | di solito no per PMI piccola |
| S.r.l. | dopo volumi / rischio |

---

## 6. Checklist legale (persone, non solo git)

### 6.1 Fiscale — titolare + commercialista

- [ ] Confermare attività secondaria software sulla P.IVA agricola (o soggetto nuovo, se il commercialista lo impone)
- [ ] Fattura elettronica SDI per ogni abbonamento (Stripe **non** è lo SDI)
- [ ] IVA 22% sulle vendite IT (verificare extra-UE / reverse charge col commercialista)
- [ ] Stripe Live intestato a **quella** P.IVA (non carta personale)
- [ ] PEC, codice destinatario, sede in fattura = Iubenda = T&C

### 6.2 Documenti Iubenda / equivalenti

- [ ] Account Iubenda, sito/app tipo SaaS
- [ ] Privacy Policy
- [ ] Cookie Policy + banner (landing; login se Maps/font/analytics)
- [ ] Termini: B2B, **niente recesso 14 giorni** (Codice del Consumo), annuale anticipato, **nessun rimborso**, modulo **off subito**, riattivazione fino a scadenza già pagata — **stesso testo** della UI Abbonamento
- [ ] DPA art. 28 (link in registrazione)
- [ ] Elenco sub-responsabili: Google (Firebase, Maps, Gemini), Stripe, Resend, …

Scanner: landing (+ login). Catalogo: tabella §2.4.

### 6.3 Manodopera / GPS (già deciso in prodotto)

- Tracking GPS continuo **scartato** (art. 4 St. Lav. + GDPR) — non reintrodurre
- GPS puntuale: dichiararlo in policy
- Il cliente resta titolare verso i dipendenti; GFV responsabile per istruzioni del DPA

### 6.4 Dopo il go-live (calendario, non blocco Checkout)

- [ ] Registro trattamenti art. 30 (foglio: quali dati, perché, dove, chi)
- [ ] Una pagina procedura data breach (72 ore, chi avvisa il Garante)
- [ ] Revisione avvocato T&C+DPA quando si scala
- [ ] DPIA se manodopera + geo + AI diventano strutturali

---

## 7. Piano di lavoro suggerito

### Fase 0 — Fuori dal codice (titolare)

1. Commercialista: attività software + fatture GFV  
2. Account Iubenda + tre documenti + DPA + sub-responsabili  
3. Stripe Live: identità = P.IVA  

### Fase 1 — Codice “porta legale”

- Checkbox + link Privacy / Termini / DPA in `registrazione-standalone.html` (e invito)
- Footer (login, dashboard, Abbonamento)
- Persistenza accettazione su `users/{uid}` o `tenants/{id}` (versione documenti, `acceptedAt`)
- Opzionale: Consent Database Iubenda

**Base git:** `develop`. Non push su `main`.

### Fase 2 — Soldi veri

- Catalogo prezzi **live** + chiavi + `STRIPE_ENV`
- Webhook `checkout.session.completed` (o equivalenza verificata)
- Lock su unpaid / expired (grazia da definire)
- Costante URL app (inviti, Checkout, notifiche)
- Giro E2E pagamento **live** del titolare

### Fase 3 — Aprire

- Togliere o sostituire «Stiamo arrivando» **solo dopo** Fase 0–2
- Primi clienti con accettazione tracciata e fattura vera
- Billing v2 e portal: dopo, non prima

---

## 8. File di riferimento (implementazione)

| Area | Path |
|------|------|
| Stripe client | `core/config/stripe-config.js` |
| Prezzi test/live | `core/config/subscription-plans.js` (`STRIPE_PRICE_IDS`) |
| Checkout / fulfill / cancel | `functions/stripe-billing.js` |
| Webhook | `functions/stripe-webhooks.js` |
| Catalogo CF | `functions/config/stripe-prices.json` (generato) |
| Sync prodotti test | `functions/scripts/sync-stripe-catalog.js` |
| UI Abbonamento | `core/admin/abbonamento-standalone.html` |
| Registrazione | `core/auth/registrazione-standalone.html` |
| Limiti Free | `core/services/plan-limits-service.js` |
| Gating moduli | `core/utils/module-access-resolver.js` |
| Inviti URL | `core/admin/gestisci-utenti-standalone.html` (`APP_BASE_URL`) |
| Handoff billing | `docs-sviluppo/in-sviluppo/abbonamento/BILLING_V2_HANDOFF.md` |

---

## 9. Cosa chiedere all’agente (quando si implementa)

Esempi, **un pezzo per volta**:

1. «Checkbox e footer registrazione, URL Iubenda placeholder / reali.»
2. «Webhook `checkout.session.completed` idempotente.»
3. «Lock tenant se Base unpaid/expired (con N giorni di grazia).»
4. «Compilare `STRIPE_PRICE_IDS.live` quando ho gli ID dalla dashboard.»

Non mescolare Iubenda, Stripe live e lock in un unico PR.

---

## 10. Verdetti della conversazione (non riaprire senza motivo)

| # | Decisione / constatazione |
|---|---------------------------|
| 1 | Iubenda sì, come kit documenti; scanner = extra sulla vetrina |
| 2 | Nessuno scanner Iubenda sul **codice** GitHub; MCP = gestione account + scan URL |
| 3 | Iubenda da solo **non** mette l’app «in produzione commerciale» |
| 4 | Per vendere manca soprattutto Stripe live + fulfill affidabile + lock chi non paga + checkbox |
| 5 | P.IVA agricola individuale = titolare ok; attività software da aprire col commercialista |
| 6 | T&C allineati alla UI: annuale, no rimborso, off subito, riattivabile fino a scadenza |
| 7 | GPS continuo resta **scartato** |

---

*Aggiornare questo file quando una voce della checklist passa a fatto (data + dove nel codice o in Iubenda/Stripe). Changelog breve anche in `COSA_ABBIAMO_FATTO.md`.*
