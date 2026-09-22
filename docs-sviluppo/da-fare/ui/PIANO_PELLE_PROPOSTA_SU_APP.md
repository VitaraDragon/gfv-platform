# Piano: pelle «Proposta» su tutta l’app (con ritorno indietro)

**Stato:** **Fetata 0 e Fetata 1 nel codice (flag + Home, hub Frutteto, anagrafica frutteti, Gestione lavori). Look non definitivo.** Si spegne con Pubblicata. Non è su `main`.  
**Non sostituire** lo stile attuale. La pelle nuova è una **prova affiancata**, spegnibile.  
**Per chi:** nuovo agente / conversazione che deve applicare il look della pagina di prova alle pagine vere.  
**Fonte:** conversazioni 2026-09-21/22 (critica «stile fumetto», prova `core/dev/ui-preview-doppio-pelle.html`, swipe catalogo, sidebar PC).  
**PR della prova (non è l’app):** https://github.com/VitaraDragon/gfv-platform/pull/64 — branch `cursor/ui-preview-doppio-pelle-d4a9`, base `develop`.  
**Registro:** `docs-sviluppo/TONY_DECISIONI_E_REQUISITI.md` §26.  
**Piano vicino (telefono manager, liste→card):** `docs-sviluppo/da-fare/dashboard/PIANO_MOBILE_MANAGER.md` — **non mescolare** i due track; leggere entrambi.

**Analisi Coerenza Master Plan: [Fase 2 config > codice] + [§15.5 reminder 1 riga] + [pubblicazione: main = produzione]** — È scalabile perché il look è un flag tenant + CSS condiviso, non `if (formId)` e non un secondo sito. Il rollback è lo switch già esistente Prova/Pubblicata, non un rewrite.

---

## 0. In una frase

Il product owner **non è convinto** del cambio di stile, ma **vuole vederlo sull’app vera** (telefono e PC). Si fa **senza buttare lo stile di oggi**. Si spegne e si torna indietro.

---

## 1. Prima di scrivere una riga di codice

L’agente **non parte** col restyling delle 35+ pagine. In ordine:

1. Leggere **questo file** per intero.
2. Leggere `.cursor/rules/pubblicazione-e-branch.mdc`: `main` è il sito; `develop` **non ha indirizzo**; mai push diretto su `main`; dati Firebase unici.
3. Leggere `core/config/feature-flags.js` e `TONY_DECISIONI` §23 (switch Prova/Pubblicata, tenant Sabbie Gialle).
4. Aprire e **usare** la prova: `core/dev/ui-preview-doppio-pelle.html` (locale o link githack della PR #64). Quella pagina è il **riferimento visivo**, non un pezzo da copincollare nelle standalone.
5. Leggere `docs-sviluppo/LINEA_GUIDA_RESPONSIVE_STANDALONE.md` (breakpoint 1024 / 768 / 480; tabelle scroll vs card).
6. Leggere `docs-sviluppo/da-fare/dashboard/PIANO_MOBILE_MANAGER.md` §2 e §6 (niente seconda app manager; `currentTableData` resta).
7. Se si tocca Tony (briefing, FAB, nav): `docs-sviluppo/tony/MASTER_PLAN.md`, `STATO_ATTUALE.md`, policy reminder §15.5–§15.6.
8. Confermare col product owner **solo** se si vuole cambiare una decisione della §3. Il resto si esegue.

**Vietato in questo momento:** mergiare su `main` la sola pagina di prova credendo che «l’app cambi look»; riscrivere HTML pagina per pagina senza flag; toccare il workspace campo (`field-workspace-standalone.html`).

---

## 2. Decisioni già ferme (non riaprire senza il product owner)

| # | Decisione | Perché |
|---|-----------|--------|
| P1 | Lo stile **attuale resta** finché il PO non dice «questa è la pelle». La proposta è **affiancata**. | Non è convinto; deve poter tornare indietro in un tap |
| P2 | Rollback **funzionale** = switch dashboard **Pubblicata** (flag `featureFlags.preview` off, o novelty `uiPelleProposta` off). Rollback **di codice** = `git revert` + push su `main` + tag | `develop` non è online; il telefono vede solo `main` |
| P3 | **Non** mescolare questo flag con `moduliAttivi` / abbonamento | «Cosa ha pagato» ≠ «cosa stiamo provando» (`feature-flags.js`, §23.1) |
| P4 | **Non** clonare xFarm; **non** portare lo «stile fumetto» sul chrome ERP. Tony (viso, FAB, chat) può restare più vivo; l’ERP è carta/quiete | Deciso in conversazione 2026-09-21 |
| P5 | Home = **«oggi»** (Tony + pochi numeri + 4–6 azioni frequenti). I 20 moduli **non** sono la prima schermata | Catalogo a parte |
| P6 | **Telefono:** catalogo in sheet (maniglia + tap; swipe ancora da limare). Scelta → lo sheet **si chiude**. **PC (≥1024px):** colonna sinistra **sempre visibile**, click, niente swipe | Stesso catalogo, due gusci |
| P7 | Liste: telefono = **schede**; desktop = **tabella** (Gestione lavori 9 colonne, non schiacciare) | Già in prova |
| P8 | Dettaglio lavoro ≠ le 9 colonne di nuovo. Tre tab: Panoramica / Mappa / Ore | Già in prova |
| P9 | Reminder Tony: **1 riga**, max 5 in expand, il resto in chat. Vietato lo striscione da 20 righe (schermata «Pieno» della prova = come **non** fare) | §15.5–§15.6 |
| P10 | Config > codice. Niente `if (formId === 'terreno')` / `if (pagina === 'frutteto')` nel core Tony | Master Plan |
| P11 | Branch di lavoro + PR su **`develop`**. `main` solo quando il PO chiede di **vedere sull’app installata**, e **sempre** con flag spento di default per chi non è in prova |
| P12 | Workspace **campo** (operaio/capo) **fuori scope** | Altro piano: `PIANO_CAMPO_MOBILE_MULTILINGUA.md` |
| P13 | Un solo Firebase. Prove di scrittura = emulatori / simulatore, non produzione | Pubblicazione |

---

## 3. Come si torna indietro (obbligo, non optional)

Tre strati, dal più veloce al più duro. L’agente deve lasciare **tutti e tre** funzionanti.

### 3.1 Tap — switch già in dashboard

Tenant **Sabbie Gialle**, ruolo manager/admin: pulsanti **Prova (develop)** / **Pubblicata (main)** in `core/dashboard-standalone.html`.

- **Pubblicata** = look di oggi (pelle Oggi).
- **Prova** = pelle Proposta, solo per quel tenant.

Implementazione: nuova voce in `PREVIEW_FLAG_CATALOG` (nome proposto: `uiPelleProposta`), `enabledWhenPreview: true`, **`enabledAlways: false`** (a differenza di `zonaLavorataDuePunti`, che è già promossa).

Spegnere il flag **non** richiede un deploy. Il codice può già essere su `main`.

### 3.2 Git — se il codice è rotto

1. **Prima** di ogni promozione su `main`: tag sulla versione «com’è ora» (es. `ui-pre-pelle-YYYYMMDD`).
2. Rollback sito: `git revert <commit>` + PR/push su `main`. Online in ~1 minuto.
3. **Mai** force push / amend su `main`.
4. Se si tocca `core/`, `modules/`, `shared/`, `index.html`, asset: `npm run bump:pwa-cache && git add service-worker.js` (l’hook pre-commit **non** gira per gli agenti).

### 3.3 Cosa il rollback **non** ripristina

Stesso Firestore/Auth/Storage su `develop` e `main`. Il revert riporta le **pagine**, non un database a parte.

---

## 4. Come si vede (oggi vs dopo)

| Cosa vuole il PO | Dove | Serve `main`? |
|------------------|------|----------------|
| Giudicare il **prototipo** (dati finti, no login) | `core/dev/ui-preview-doppio-pelle.html` — locale, oppure rawcdn.githack.com con **SHA** del commit (i nomi branch con `/` rompono i CDN) | No |
| Giudicare da **PC** il prototipo a sidebar | Stesso file, finestra ≥1024px | No |
| `develop` in locale | `git checkout develop` dopo merge PR, aprire il file o le standalone | No. `develop` **non è un URL** |
| Giudicare il look **sull’app vera dal telefono** (PWA, login, dati Sabbie Gialle) | Codice della pelle **promosso su `main`**, flag Prova **on** solo per Sabbie Gialle | **Sì**, ma la pelle di tutti gli altri resta Oggi |
| Sostituire lo stile per tutti | Solo dopo OK esplicito del PO + `enabledAlways` o rimozione del gate | Sì, e allora il revert è l’unica via indietro |

**Non dire** al PO: «l’ho messo su develop, aprilo dal telefono». Develop non è pubblicato.

Link prototipo (aggiornare lo SHA dopo nuovi commit della PR #64):

`https://rawcdn.githack.com/VitaraDragon/gfv-platform/<SHA>/core/dev/ui-preview-doppio-pelle.html?theme=proposta&screen=dashboard`

---

## 5. Cos’è la prova oggi (source of truth visivo)

File unico: `core/dev/ui-preview-doppio-pelle.html`. Dati finti, niente Firebase.

Pelli: `?theme=oggi` | `?theme=proposta`.  
Schermi: Home, hub (Frutteto e altri da catalogo `HUBS`), sotto-liste `SUBS`, Gestione lavori, Dettaglio, Meteo, Mappa, Abbonamento, Impostazioni, «Pieno» (anti-pattern reminder).

**Pelle Proposta (da replicare, non inventare):**

- Fondo carta `#F6F3EC`, pannelli `#FFFEFA`, testo `#1c1917`, font Plus Jakarta Sans.
- Tony in cima (briefing 1–2 frasi), FAB in basso a destra, chat a scheda.
- Header basso, accento **solo** bordo (Frutteto arancio `#FF6F00`, Vigneto viola, Manodopera verde, Macchine blu, CT arancio, Meteo azzurro).
- Card silenziose, icone lineari in proposta (emoji solo in pelle Oggi).
- Telefono: maniglia `Proposta · <posto>` → sheet moduli; tap/swipe; dopo la scelta resta solo la pagina.
- PC: rail 272px, moduli in colonna, contenuto a destra; liste = tabella.

**Pelle Oggi:** chrome colorato 2018 (gradient header, card colorate). Serve come **controllo A/B**, non da «migliorare» in questo track.

Swipe sul telefono: **funziona poco**. Affordance affidabile = **tap sulla maniglia**. Non spendere il primo sprint a perfezionare il gesto.

---

## 6. Architettura (come si implementa, senza local patch)

```
html[data-pelle="oggi"|"proposta"]
html[data-shell="phone"|"desktop"]     /* matchMedia 1024px */
```

1. **Flag** `uiPelleProposta` in `PREVIEW_FLAG_CATALOG`. Lettura: `isFeatureEnabledFromWindow('uiPelleProposta')`. Pubblicazione già fatta da `publishFeatureFlags`.
2. **Un foglio** (o blocco in `core/styles/responsive-standalone.css`) con i token della Proposta. Le standalone **già** includono quel CSS: non copiare 200 righe in ogni HTML.
3. Una funzione piccola (`applyPelleFromFlags`) che setta `data-pelle` su `documentElement` all’avvio di ogni pagina che usa lo shell. Niente duplicare la logica in 40 file: un modulo, un include.
4. Catalogo moduli: **`MODULE_CATALOG`** in `core/js/dashboard-hub.js` + `subscription-plans.js`. Non un terzo elenco hardcoded. Lo sheet/sidebar legge lo stesso catalogo (più Impostazioni / Abbonamento).
5. Liste: pattern già deciso in linea guida — Opzione B card su telefono, Opzione A tabella su desktop. Tony `currentTableData` **non** cambia schema; merge `setContext('page', …)` come da `tony-pagina-lista-e-form.mdc`.
6. Form: stesso `tony-form-mapping.js`. Solo CSS (una colonna, Salva visibile). Vietato un secondo mapping «mobile».

---

## 7. Ordine di lavoro (fette, ognuna con rollback)

Ogni fetta = branch `cursor/…-d4a9` (o il prefisso del run), PR su **`develop`**, CI verde, **non** mergiare/chiudere senza il PO.

### Fetata 0 — Fondamenta (nessun look visibile in produzione)

- Voce catalogo flag `uiPelleProposta`.
- Token CSS + `applyPelleFromFlags`.
- Test: flag off → `data-pelle="oggi"`; flag on (Sabbie + Prova) → `proposta`.
- Tag su `main` **prima** di qualsiasi promozione successiva.

### Fetata 1 — Pilota (si vede sull’app, ancora gated)

Tre superfici vere, non il file `core/dev/`:

1. `core/dashboard-standalone.html` (Home: Tony + oggi + azioni; catalogo non è la home).
2. `modules/frutteto/views/frutteto-dashboard-standalone.html` + una lista (anagrafica o raccolta).
3. `core/admin/gestione-lavori-standalone.html` (schede telefono / tabella PC) + dettaglio se già modal/pagina.

Shell: sheet+maniglia <1024px; sidebar ≥1024px. Stesso DOM, CSS diverso.

Verifica: telefono PWA **solo dopo** che il PO chiede la promozione su `main` (flag on Sabbie). Prima: locale + simulatore, oppure githack della branch se serve il prototipo.

### Fetata 2 — Altri hub

Manodopera, Magazzino, Parco macchine, Conto terzi, Vigneto, Terreni, Report, Meteo. Stesso schema hub (KPI + card azioni). Niente eccezioni per singolo hub se esprimibili in config.

### Fetata 3 — Resto liste / abbonamento / impostazioni

Abbonamento e impostazioni come in prova (piano + moduli; azienda/account). Liste della shortlist in `PIANO_MOBILE_MANAGER.md` §4.2: **solo** quelle, non tutte e 25.

### Fetata 4 — Limare

Swipe telefono; maniglia più bassa; copy switch («Prova look» vs il testo attuale sulla zona a due punti). Solo se il PO conferma che la pelle merita.

**Stop.** Non settare `enabledAlways: true` senza frase esplicita del PO.

---

## 8. Superfici (cosa «tutta l’app» significa qui)

In scope (ufficio manager / admin / proprietario):

| Superficie | File tipici |
|------------|-------------|
| Home ERP | `core/dashboard-standalone.html`, `core/js/dashboard-hub.js` |
| Hub coltura | `vigneto-dashboard-standalone.html`, `frutteto-dashboard-standalone.html` |
| Hub altri | manodopera / magazzino / macchine / conto-terzi / report / meteo `*-home-*` o `*-dashboard-*` |
| Liste critiche | gestione-lavori, validazione-ore, impegni, sotto-liste hub |
| Account | `abbonamento-standalone.html`, `impostazioni-standalone.html` |
| Mappa / meteo | `mappa-aziendale-standalone.html`, dashboard meteo |

Fuori scope (salvo richiesta esplicita):

- Workspace campo e lingue IT/RO/EN.
- Login / registrazione / inviti (si possono allineare dopo).
- Pagine pubbliche preventivo.
- Tony: nuova logica, nuovi comandi, visione/Gemini.
- Seconda app, secondo Firebase, secondo Hosting (si **propongono**, non si fanno da soli).

---

## 9. Cosa non fare

- Non cancellare CSS/HTML della pelle Oggi «per pulizia».
- Non mettere la prova in `core/dev/` e promuovere **solo quella** su `main` credendo di aver cambiato l’app.
- Non usare `develop` come URL da telefono.
- Non scrivere su Firestore di produzione per «accendere il flag» se si può usare lo switch UI (Sabbie).
- Non `if (isMobile && formId === …)` in `tony-form-injector.js` / `functions/index.js`.
- Non 20 reminder in home.
- Non clonare il catalogo moduli in un quarto file.
- Non force push su `main`.
- Non mergiare/chiudere PR da soli.

---

## 10. Criteri done (prima promozione su `main`, ancora gated)

- Flag off = app **identica** a prima (nessuna regressione visiva su Home, un hub, Gestione lavori, desktop e 390px).
- Flag on, Sabbie Gialle, Prova: Home + Frutteto + Gestione lavori seguono la prova (sheet/sidebar, card/tabella, briefing 1 riga).
- Switch Pubblicata spegne la pelle **senza** nuovo deploy.
- Tag pre-promozione esistente; `SW_CACHE_BUILD_ID` bumpato se si è toccato codice servito.
- CI `.github/workflows/simulator-ci.yml` verde.
- PO ha visto **dal telefono** (PWA) e **da PC**; non è ancora «pelle definitiva».

---

## 11. Prompt da incollare in una conversazione nuova

```
Leggi docs-sviluppo/da-fare/ui/PIANO_PELLE_PROPOSTA_SU_APP.md e eseguilo.

Non sostituire lo stile attuale. La pelle Proposta va dietro il flag
uiPelleProposta (feature-flags.js, switch Prova/Pubblicata, solo Sabbie Gialle).
Deve essere possibile tornare indietro con un tap (Pubblicata) e con git revert.

Riferimento visivo: core/dev/ui-preview-doppio-pelle.html e PR #64.
Base PR: develop. Mai push su main se non te lo chiedo.
Inizia dalla Fetata 0, poi Fetata 1 (Home + Frutteto + Gestione lavori).
Non toccare il workspace campo. Non inventare if per singolo formId.
```

---

## 12. Riferimenti

| Cosa | Path |
|------|------|
| Prova visiva | `core/dev/ui-preview-doppio-pelle.html` |
| Flag tenant | `core/config/feature-flags.js`, dashboard switch, §23 |
| Catalogo moduli | `core/js/dashboard-hub.js` `MODULE_CATALOG` |
| Responsive | `docs-sviluppo/LINEA_GUIDA_RESPONSIVE_STANDALONE.md` |
| Telefono manager | `docs-sviluppo/da-fare/dashboard/PIANO_MOBILE_MANAGER.md` |
| Pubblicazione | `.cursor/rules/pubblicazione-e-branch.mdc` |
| Tony reminder | `TONY_DECISIONI_E_REQUISITI.md` §15.5–§15.6 |
| Liste + Tony | `.cursor/rules/tony-pagina-lista-e-form.mdc` |
| Changelog | `docs-sviluppo/COSA_ABBIAMO_FATTO.md` |

---

## 13. Come usare questo file

- **Agente nuovo:** esegui §1, poi Fetata 0. Se il compito è «metti il look nuovo su main per tutti», **rifiuta** e punta a P1–P2.
- **Product owner:** per vedere l’app vera dal telefono, chiedere esplicitamente la promozione della fetata 1 su `main` (flag on). Per tornare indietro: switch **Pubblicata**. Per buttar via il codice: revert.
- **Non** creare altri `TONY_*_PELLE.md` sparsi. Aggiornare questo file e `COSA_ABBIAMO_FATTO.md`.

| Revisione | Data | Cosa |
|-----------|------|------|
| 0 | 2026-09-22 | Prima stesura da conversazione: prova isolata, rollback, vedere su tutta l’app |
| 1 | 2026-09-22 | Fetata 0–1: flag `uiPelleProposta`, shell da `MODULE_CATALOG`, Home + Frutteto + anagrafica + Gestione lavori. Ancora gated. |
