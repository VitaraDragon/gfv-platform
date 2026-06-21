# Handoff — Billing v2 (coterm, bundle, disattivazione)

**Creato:** 2026-06-20  
**Pubblico:** agenti Cursor / sviluppo GFV Platform  
**Stato:** decisioni prodotto **chiuse**; Fase 1 implementata (2026-06-21); Fasi 2–4 **da fare**

---

## 1. Scopo

Allineare pagamenti Stripe, scadenze e attivazione/disattivazione moduli/bundle a un modello **SaaS B2B standard**:

- **Una data di rinnovo** per tenant (= anniversario attivazione **piano Base**)
- **Nessun rimborso** pro-rata su annuale già pagato
- **Disattivazione** = uso fino a scadenza, poi stop rinnovo
- **Passaggio singoli → bundle** senza doppio pagamento
- Tony consigliere già allineato al **costo marginale** (non al risparmio catalogo fuorviante)

Questo documento descrive **da dove partiamo (v1)**, **dove arrivare (v2)** e **come implementare** senza reinterpretare le decisioni.

---

## 2. Decisioni prodotto (chiuse — non ridiscutere senza product owner)

| # | Decisione |
|---|-----------|
| D1 | Fatturazione **annuale anticipata**; prezzi UI = riferimento **€/mese**, addebito = **12 mesi** (`BILLING` in `subscription-plans.js`) |
| D2 | **Data rinnovo unica per tenant** = data attivazione / rinnovo del **piano Base** (coterm). Esempio: Base il 15 marzo → tutto ciò che resta attivo rinnova il **15 marzo**, anche moduli aggiunti a novembre |
| D3 | Modulo/bundle aggiunto **a metà ciclo** → **proration Stripe** (quota fino alla prossima scadenza Base), poi rinnovo unificato |
| D4 | **Nessun rimborso** cash per disattivazione anticipata su annuale (policy standard B2B). Eventuali eccezioni solo commerciale/manuale, fuori dal flusso automatico |
| D5 | **Disattivazione** modulo/bundle → **`cancel_at_period_end`** su Stripe; in app resta **attivo fino a `periodEnd`**, poi off e non rinnova |
| D6 | **Bundle gemelli** (stessa base, terzo modulo diverso): es. Viticoltore Operativo ↔ Viticoltore Campo — **non** sostituzione automatica; Tony **non** invita al gemello se l’altro è attivo (`BUNDLE_ALTERNATIVES`) |
| D7 | **Converti in bundle**: se l’utente ha moduli singoli **coperti** da un bundle, il flusso deve **sostituire** le voci di fatturazione (non aggiungere bundle + lasciare i singoli su Stripe) |
| D8 | Piano **Free** → moduli/bundle solo dopo **Base** attivo (invariato) |
| D9 | Tony consigliere: con bundle già attivo, suggerire **moduli singoli marginali** o bundle più grande (GFV Completo), non secondi pacchetti con overlap (`stacked_bundle_advisor`) |

---

## 3. Stato attuale — v1 (codice in repo, già deployabile)

### 3.1 Architettura pagamenti

| Aspetto | Comportamento v1 |
|---------|------------------|
| Checkout | `createStripeCheckoutSession` → una **Checkout Session** per acquisto |
| Subscription Stripe | **Separate** per piano Base, ogni modulo, ogni bundle |
| Addebito | `mode: subscription`, price annuale da `functions/config/stripe-prices.json` |
| Fulfill | `fulfillStripeCheckout` → aggiorna Firestore |
| Webhook Stripe | **Assenti** (sync manuale / fulfill al ritorno checkout) |

### 3.2 Firestore tenant (campi rilevanti)

```
tenants/{tenantId}
  plan / piano          → 'free' | 'base'
  modules[]             → id moduli attivi (accesso app)
  activeBundles[]       → id bundle attivi
  stripeCustomerId
  stripeSubscriptionId  → solo subscription del piano Base
  expiryDate            → aggiornato soprattutto al purchase Base
  stripeAddons: {
    [moduleId|bundleId]: {
      type: 'module' | 'bundle',
      subscriptionId,
      periodEnd,        // unix sec — solo addon, non sempre mostrato in UI
      modules?: [...]    // se bundle
    }
  }
```

### 3.3 Upgrade (v1)

- **+ modulo**: Checkout → `applyModulePurchaseToTenant` → push in `modules[]`, nuova entry `stripeAddons[moduleId]`
- **+ bundle**: `applyBundlePurchaseToTenant` → **unione** moduli in `modules[]`, push `activeBundles[]`, `stripeAddons[bundleId]`
- **Non** cancella subscription singole già esistenti
- **Non** proration verso scadenza Base

### 3.4 Downgrade (v1) — gap critico

- Disattiva modulo/bundle da `abbonamento-standalone.html` → **solo Firestore**, effetto **immediato** in app
- **Nessuna** chiamata Stripe `subscriptions.cancel` / `cancel_at_period_end`
- **Nessun** rimborso (coerente con D4) ma copy UI a volte dice «a scadenza» mentre il codice spegne subito → **bug UX/legal da correggere in v2**

### 3.5 Scadenze (v1)

- Ogni subscription Stripe ha **propria** `current_period_end`
- `tenant.expiryDate` riflette soprattutto il **Base**
- Moduli comprati mesi dopo hanno scadenza **diversa** (in `stripeAddons.*.periodEnd`, spesso non in evidenza in UI)

### 3.6 Tony consigliere (già implementato — non regressione)

- `functions/tony-module-recommendations.js` — 22 test
- Bundle attivo → messaggio «risparmio bundle ce l'hai già»
- Domande stacking → confronto **marginale** (es. 16 vs 20 €/mese)
- Routing meteo vs abbonamento in `functions/index.js`

**File chiave v1:** `functions/stripe-billing.js`, `core/admin/abbonamento-standalone.html`, `core/config/subscription-plans.js`, `core/config/stripe-config.js`

---

## 4. Stato target — v2 (definition of done)

### 4.1 Modello Stripe consigliato

**Opzione preferita (standard mercato):**

1. Un **Customer** Stripe per tenant (`stripeCustomerId`)
2. Una **subscription principale** legata al Base con `billing_cycle_anchor` = data primo pagamento Base
3. Moduli e bundle = **subscription items** sulla **stessa** subscription (o subscription schedule), non N subscription orphan
4. Aggiunta item mid-cycle → Stripe **`proration_behavior: create_prorations`**
5. Rimozione item → **`cancel_at_period_end`** sull’item o delete a fine periodo (policy D5)

**Alternativa accettabile (fase transitoria):** mantenere subscription separate ma **forzare coterm** con [Subscription Schedules](https://docs.stripe.com/billing/subscriptions/subscription-schedules) o `billing_cycle_anchor` allineato al Base — più fragile, documentare se scelta temporanea.

### 4.2 Scadenza unica (coterm)

- **`tenant.renewalAnchor`** (o riuso coerente di `expiryDate`) = prossimo rinnovo globale = anniversario Base
- UI Abbonamento: **una riga** «Prossimo rinnovo: …» + dettaglio voci attive e importo stimato
- Ogni addon eredità lo stesso `periodEnd` dopo allineamento (Stripe è source of truth post-webhook)

### 4.3 Flussi utente target

#### A) Free → Base

Invariato concettualmente: Checkout Base → tenant `plan=base`, anchor impostata, `expiryDate/renewalAnchor` = +1 anno.

#### B) Aggiunta modulo a metà anno

1. Utente conferma in Abbonamento  
2. Stripe aggiunge price item con **proration** fino al `renewalAnchor`  
3. Firestore: `modules[]` aggiornato; item attivo; `periodEnd` = anchor  
4. Tony: già ok (consigli margini)

#### C) Aggiunta bundle a metà anno

Come (B), più:

- Moduli del bundle in `modules[]` + `activeBundles[]`
- Se moduli singoli **già pagati** e **inclusi** nel bundle → **rimuovere** item singoli da subscription (o marcare `cancel_at_period_end` e non rinnovare), **non** lasciare doppio addebito al rinnovo

#### D) Converti singoli → bundle (es. 3 singoli → Viticoltore Operativo)

Flusso dedicato UI: **«Passa al bundle»** (non solo «Attiva bundle» generico):

1. Verifica set moduli ⊆ bundle  
2. Checkout / update subscription: **una voce bundle**, rimuovi voci singoli coperte  
3. Proration Stripe (credito/addebito) gestita da Stripe  
4. Firestore: `activeBundles` += bundle; `modules` coerente; pulizia `stripeAddons` obsoleti

#### E) Disattivazione modulo

1. Conferma utente con testo chiaro: *«Resta attivo fino al [data]. Non verrà rinnovato. Nessun rimborso.»*  
2. Stripe: `cancel_at_period_end` sull’item (o remove at period end)  
3. Firestore: flag `pendingDeactivation` + `deactivatesAt` fino a webhook; **non** rimuovere subito da `modules[]` se policy D5 (accesso fino a scadenza)  
   - **Nota:** v1 rimuove subito — v2 deve **cambiare** questo comportamento se si adotta D5 alla lettera

#### F) Disattivazione bundle

- Stesso schema (E) per la voce bundle  
- Moduli: rimuovere da accesso app **a scadenza bundle**, non immediatamente (salvo eccezione «disattiva subito» solo admin)

### 4.4 Policy rimborsi (copy legale / UX)

Testo tipo da usare in conferme e FAQ:

> Abbonamento annuale. In caso di disattivazione, il modulo resta utilizzabile fino alla data di rinnovo già pagata e non sarà rinnovato. Non sono previsti rimborsi per la parte non utilizzata.

---

## 5. Casi limite (regole per agente)

| Caso | Regola |
|------|--------|
| Base + Viticoltore Operativo + vuole Frutteto + Parco Macchine | Consigliare **2 moduli singoli** (margine), non Frutticoltore Campo come 2° bundle |
| Base + 3 singoli = set Operativo | Offrire **Converti in Operativo**, non 4° subscription |
| Operativo attivo + suggerisce Campo | **Vietato** (gemello) — già in Tony |
| GFV Completo con molti moduli mancanti | Bundle expand solo se margine reale conviene |
| Disattiva un modulo di un bundle | v2: trattare come **disattiva intero bundle** o impedire pezzo-mezzo bundle (prodotto: preferire **bundle intero** a scadenza) |
| Piano Free | Nessun Checkout modulo/bundle finché Base non attivo |

---

## 6. Piano implementazione suggerito (ordine)

### Fase 1 — Sicurezza v1 (quick win) ✅ 2026-06-21

- [x] Alla disattivazione UI: chiamare CF `cancelStripeAddon` con `cancel_at_period_end: true` usando `stripeAddons[id].subscriptionId`
- [x] Allineare **copy UI** al comportamento reale — policy **D5**: attivo fino a scadenza, nessun rimborso; `reactivateStripeAddon` per annullare prima della scadenza
- [x] Webhook minimi: `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` (`stripeWebhook` + secret `STRIPE_WEBHOOK_SECRET`)

### Fase 2 — Coterm

- [ ] Campo `renewalAnchor` / sync `expiryDate` da subscription Base
- [ ] Nuovi acquisti addon: aggiunta item con proration verso anchor (Stripe API subscription update, non solo Checkout session separata)
- [ ] UI: scadenza unica + elenco voci al rinnovo

### Fase 3 — Converti bundle + pulizia singoli

- [ ] Endpoint / flusso «Passa al bundle»
- [ ] Migrazione tenant con doppie subscription (script admin)

### Fase 4 — Customer Portal (opzionale)

- [ ] Stripe Billing Portal per self-service fatture / metodo pagamento

---

## 7. File da toccare (indicativo)

| Area | File |
|------|------|
| Stripe server | `functions/stripe-billing.js` (refactor principale), nuovo `functions/stripe-webhooks.js` |
| Export CF | `functions/index.js` |
| Prezzi | `functions/config/stripe-prices.json`, `core/config/subscription-plans.js` |
| Client Abbonamento | `core/admin/abbonamento-standalone.html` |
| Tony advisor | `functions/tony-module-recommendations.js` (solo se cambiano regole commerciali) |
| Manutenzione | `scripts/repair-stripe-expiry.js` (evolvere o sostituire con sync webhook) |
| Test | nuovo `tests/stripe-billing-coterm.test.js` (mock Stripe) |

**Non duplicare** catalogo bundle: `functions/config/bundles-catalog.json`, `functions/config/tony-bundles-catalog.json`, `core/config/subscription-plans.js` (`BUNDLES`).

---

## 8. Test e verifica manuale

### Scenari minimi post-v2

1. Base giorno 1 → anchor T0+1y  
2. Modulo a T0+3m → proration corretta; stesso rinnovo T0+1y  
3. Disattiva modulo a T0+5m → attivo fino T0+1y; non in fattura successiva  
4. 3 singoli → converti Operativo → una voce bundle; niente 4 subscription al rinnovo  
5. Webhook: subscription deleted → Firestore coerente  
6. Tony: stessi 22 test + nessuna regressione consigli bundle

### Comandi utili

```bash
npm run deploy:functions
npx vitest run tests/tony-module-recommendations.test.js
node scripts/repair-stripe-expiry.js   # v1 — da rivedere in v2
```

---

## 9. Documentazione correlata

| Documento | Contenuto |
|-----------|-----------|
| `docs-sviluppo/STRATEGIA_MARKETING_VENDITA_HANDOFF.md` | Funnel Free/Base, bundle commerciali, Tony consigliere |
| `docs-sviluppo/COSA_ABBIAMO_FATTO.md` | Storico implementazione Stripe + Tony bundle advisor |
| `docs-sviluppo/TONY_DECISIONI_E_REQUISITI.md` | §1.13–1.17 consigliere/bundle |
| `docs-sviluppo/tony/STATO_ATTUALE.md` | Stato componenti Tony |
| `.cursor/rules/tony-agent-onboarding.md` | Regole agenti Tony (non mischiare billing con prompt Tony senza necessità) |

---

## 10. Cosa **non** fare

- Non promettere rimborso pro-rata in UI o in Tony senza policy esplicita  
- Non creare seconda subscription bundle se i singoli coperti restano attivi su Stripe  
- Non usare `expiryDate` singola ignorando addon — in v2 Stripe/webhook è source of truth  
- Non disattivare Firestore **subito** se la policy approvata è «attivo fino a scadenza» (D5)  
- Non suggerire pacchetti gemelli in Tony (già vietato in codice)

---

## 11. Changelog documento

| Data | Nota |
|------|------|
| 2026-06-21 | Fase 1 verificata in produzione/sandbox: deploy functions, Stripe Workbench destinazione + `whsec_`, test UI disattivazione/annulla bundle OK |
| 2026-06-21 | Fase 1 implementata: cancelStripeAddon, reactivateStripeAddon, stripeWebhook, UI abbonamento |
| 2026-06-20 | Creazione handoff da sessione product: coterm su anniversario Base, no rimborso, converti bundle, gap v1 documentati |

---

*Per implementazione: partire da §3 (v1 reale), consegnare §4 (v2). Aggiornare questo file e `COSA_ABBIAMO_FATTO.md` al completamento di ogni fase.*
