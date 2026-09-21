# Piano: versione campo unica (mobile) + lingue per operai e caposquadra

**Stato:** deciso, **non implementato** (2026-09-19)  
**Per chi:** ogni agente o sviluppatore che tocca **manodopera campo**, workspace mobile, login operai, comunicazioni squadra, segnalazione guasti, push verso il telefono, Tony profilo campo.  
**Fonte decisioni:** conversazione product owner 2026-09-19 (traduzione app → perimetro campo → desktop sì/no).  
**Registro decisioni:** `docs-sviluppo/TONY_DECISIONI_E_REQUISITI.md` §24.

**Analisi Coerenza Master Plan: [Fase 2 – Navigazione / utenze prioritarie] + [Fase 4 – config > codice]** — Questa modifica è scalabile perché: (1) la lingua e la home campo sono **preferenza utente + catalogo stringhe**, non `if` per pagina o per modulo; (2) Tony resta sul **profilo campo** già esistente (`field-role-guard.js`) e non torna sulla dashboard ERP; (3) le pagine desktop sottostanti restano **compiti** (mappa zone, validazione completa, account), non una seconda app.

---

## 1. Obiettivo prodotto (una frase)

Far usare il telefono in campo a **operaio** e **caposquadra** senza italiano obbligatorio e **senza una seconda app desktop**: una sola home (versione mobile), etichette nella lingua scelta, e i **messaggi del caposquadra** traducibili.

Non è internazionalizzazione dell’ERP. Non è aprire Francia/UK. È **semplificare il mestiere in Italia** (vendemmia, raccolta, squadre miste).

---

## 2. Decisioni chiuse — non riaprire senza il product owner

| # | Decisione | Motivo |
|---|-----------|--------|
| D1 | **Non** tradurre tutta l’app (dashboard, terreni, magazzino, abbonamento, guide complete, Tony ERP) | Costo enorme, mercato ufficiale = PMI agricole italiane, GTM ancora in Italia |
| D2 | Il multilinguismo è **solo per il profilo campo** (operaio / caposquadra) | Loro usano il telefono; l’ufficio resta in italiano |
| D3 | Lingue MVP: **italiano + rumeno + inglese**. Francese **non** in MVP | Rumeno = manodopera agricola più frequente in Italia; EN = lingua franca; FR è terziario |
| D4 | Due strati: **cornice** (pulsanti/errori/login) **e** **contenuto operativo** (traduci il messaggio). Il secondo vale di più | Un bottone «Save hours» non basta se l’ordine di lavoro resta in italiano |
| D5 | Home unica = **versione mobile** (`field-workspace-standalone.html`) anche da PC. Togliere (o nascondere) il toggle 🖥️ | La desktop classica è un secondo ingresso alle stesse cose + confusione |
| D6 | **Non cancellare** le pagine sotto (dettaglio lavoro/zone, validazione completa, impostazioni, segnalazione guasti) | Restano **compiti** (iframe / link a tutto schermo), non una seconda home |
| D7 | Portare **segnalazione guasti** nella mobile: è l’unico buco che oggi giustifica ancora la desktop | Dopo D5 l’operaio non deve più passare da dashboard per un guasto |
| D8 | Account **manager o amministratore** (anche se ha anche capo/operaio) resta sulla **dashboard ufficio** | `shouldUseFieldMobileWorkspace` già esclude manager/admin |
| D9 | Tony vocale / STT / TTS in altre lingue = **fase successiva**, non MVP | Voce e «segna ore» sono agganciati a `it-IT` (Chirp 3, punteggiatura, parsing date) |
| D10 | Arabo / albanese / punjabi = **dopo**, se i tenant lo chiedono | Quattro lingue subito = troppa manutenzione |
| D11 | Il caposquadra può restare in italiano: deve soprattutto far **capire i messaggi** alla squadra | Non obbligarlo a scrivere in rumeno |
| D12 | Niente framework i18n su 75 HTML. Catalogo **solo campo** + preferenza utente | Stesso principio: configurazione > codice, perimetro stretto |

Se un agente trova un «sarebbe bello tradurre anche Terreni / Abbonamento», **non lo fa**. Torna a questo piano.

---

## 3. Chi è in perimetro

### 3.1 Sì — profilo campo

Utente con ruoli **solo** `operaio` e/o `caposquadra`, modulo `manodopera` attivo, **senza** `manager` / `amministratore`.

Home oggi (già vero in codice): `core/mobile/field-workspace-standalone.html`  
Preferenza: `localStorage` `FIELD_WORKSPACE_PREF_KEY` — valori `auto` | `classic` | `mobile` (`core/js/dashboard-utils.js`).

### 3.2 No — ufficio

| Ruolo | Home | Lingua |
|-------|------|--------|
| Manager / amministratore | Dashboard classica | Italiano |
| Manager **+** caposquadra sullo stesso account | Dashboard classica | Italiano (D8) |
| Chiunque su terreni, magazzino, abbonamento, hub manodopera manager | Invariato | Italiano |

### 3.3 Cosa vede oggi il campo (schede mobile)

**Operaio** (ordine in `field-workspace-controller.js`): Lavoro → Comunicazioni → Ore → Statistiche.

**Caposquadra:** Lavoro (squadra + valida ore sul lavoro scelto + segnala assenza) → Comunicazioni squadra → Valida ore (tutti i lavori) → Ore → Statistiche.

Tony profilo campo (`field-role-guard.js`): whitelist `workspace campo`, comunicazioni, segnatura ore, statistiche lavoratore, lavoro campo, impostazioni; capo anche `lavori caposquadra` e `validazione ore`. **Mai** Gestione Lavori / Statistiche desktop / modal ERP.

---

## 4. Stato codice oggi (verificato 2026-09-19)

### 4.1 Nessun i18n di prodotto

- Unico i18n in repo: `core/config/meteo-alert-i18n.js` — traduce allerte OpenWeather **verso l’italiano**. Non riusarlo come framework lingue utente.
- Tutte le standalone campo: `<html lang="it">`.
- Login: `core/auth/login-standalone.html` — tutto italiano, **prima** dell’auth.
- Tony: STT `it-IT`, TTS `it-IT-Chirp3-HD-Charon`, `applyItalianVoiceQuestionPunctuation`, parsing «domani / lunedì / una giornata», sinonimi pagine in italiano (`engine.js` `TONY_LABEL_MAP`).
- Date/soldi: `it-IT`, `Europe/Rome`, euro.
- Push: `notification-catalog.js` — `titleTemplate` / `bodyTemplate` **solo italiano**; deep link già verso `field-workspace-standalone.html`.
- Profilo utente: c’è `notificationPrefs`, **non** c’è `preferredLanguage` / `locale`.

### 4.2 Due home per il campo (da chiudere)

| Ingresso | Cosa succede |
|----------|----------------|
| Default | `shouldUseFieldMobileWorkspace` → mobile anche da PC (`pref !== 'classic'`) |
| Toggle 🖥️ in header mobile | `setFieldWorkspacePreference('classic')` → `dashboard-standalone.html?ws=classic` |
| Dashboard classica capo/operaio | Sezioni in `dashboard-sections.js`: card duplicate (Workspace, Segna ore, I miei lavori, Valida ore, Gestione squadre, Guasti) |

La desktop **non** aggiunge un mestiere. «La mia squadra» in dashboard apre `gestione-squadre-standalone.html` in **sola lettura**; in mobile i contatti (chiama/mail) sono già nella scheda Lavoro. Il capo **non** crea/modifica squadre (è del manager).

### 4.3 Pagine «sotto» da non cancellare (D6)

| Pagina | Ruolo residuo |
|--------|----------------|
| `core/admin/lavori-caposquadra-standalone.html` | Dettaglio lavoro, zone (due tocchi), completamento. **Iframe** in slide Ore (`embed=mobile`) + link «Apri in finestra intera» |
| `core/admin/validazione-ore-standalone.html` | Validazione completa / filtri. Link dalla slide Valida ore e dal menu ⚙️ |
| `core/admin/impostazioni-standalone.html` | Account, password, preferenze push |
| `core/admin/segnalazione-guasti-standalone.html` | Form `#segnala-guasto-form` (macchina o generica, GPS, gravità, lavoro). **Oggi assente dalla mobile** — buco D7 |
| `core/mobile/statistiche-lavoratore-standalone.html` | Iframe slide Statistiche |
| `core/segnatura-ore-standalone.html` | Duplicato del form ore mobile — **non** è la home; dopo D5 non va più proposto come ingresso |

### 4.4 Buco guasti (D7)

Guide operaio/caposquadra: la segnalazione si trova «di solito dalla **dashboard** in versione completa».  
Workspace mobile: nessuna voce guasto (solo «Invia segnalazione» = **assenza**, non macchina).  
Modulo richiesto: `parcoMacchine`.  
Chi può **inviare**: in configurazione tipica ruolo **operaio**. Capo-only: oggi la guida dice di far segnalare un operaio o di chiamare il manager. **Dopo D5** il capo-only non ha più la desktop: va deciso in implementazione (vedi §8.3) — default prodotto: **anche il caposquadra può aprire la segnalazione dalla mobile** se ha Parco Macchine, così non resta senza via.

---

## 5. Lingue

### 5.1 Catalogo MVP

| Codice | Nome nativo sul selettore | Ruolo |
|--------|---------------------------|--------|
| `it` | Italiano | Default; ufficio; fallback |
| `ro` | Română | Prima lingua campo |
| `en` | English | Lingua franca squadre miste |

Niente `fr` in MVP (D3). Se un tenant lo chiede: stessa chiave catalogo, terzo file, **dopo** che RO+EN sono stabili.

### 5.2 Dove si sceglie (obbligo UX)

Il selettore deve essere comprensibile **prima** di saper leggere l’italiano: **bandiere + nome nativo** (`Română`, `English`, `Italiano`), non un menu «Lingua / Language» solo in IT.

1. **Login** (`login-standalone.html`) — in alto, **prima** di email/password. Senza questo l’operaio non entra.
2. **Header versione mobile** — sempre visibile (accanto a ⚙️). Cambio immediato, senza ricaricare tutta la PWA se possibile.
3. **Impostazioni account** — stesso valore, per chi arriva dal menu.

Persistenza:

| Livello | Dove | Quando |
|---------|------|--------|
| Pre-login | `localStorage` es. `gfv_field_lang` | Scelta al login |
| Profilo | `users/{uid}.preferredLanguage` (`it` \| `ro` \| `en`) | Dopo login: merge localStorage → profilo; i login successivi usano il profilo |
| Stesso utente, altro telefono | Profilo vince | Non solo il device |

Default: `it` se mai impostato. Non indovinare dalla lingua del browser al primo avvio (troppi telefoni in EN di fabbrica): l’utente **sceglie**.

### 5.3 Due strati di traduzione (D4)

**Strato A — cornice (catalogo statico)**  
Pulsanti, label, errori, empty state, login, menu ⚙️, tipi assenza (Malattia/Ferie/…), «Ore nette calcolate», «Salva ore lavorate».

**Strato B — contenuto operativo (traduzione a richiesta)**  
Testo libero scritto da umani in italiano:

- corpo delle **comunicazioni** del caposquadra (priorità assoluta);
- in seguito: note del manager sul lavoro, istruzioni in dettaglio (se visibili in chiaro, non solo iframe).

**Non** tradurre in automatico i **nomi** di lavori, terreni, persone (dati anagrafici). Restano come scritti in anagrafica.

UX strato B: su ogni messaggio, pulsante **Traduci** / **Traduce** / **Translate** (etichetta nella lingua UI). Il capo scrive in italiano; l’operaio legge nella sua lingua. Non chiedere al capo di scrivere in rumeno (D11).

Implementazione strato B (vincolo architettura): **callable** Gemini già in stack (stesso schema di altre CF, non un `if` in pagina). Cache opzionale sul documento comunicazione (`traduzioni.{lang}`) per non ripagare ad ogni apertura. Se la CF fallisce: mostra l’italiano + errore breve nella lingua UI.

---

## 6. Architettura tecnica (obbligatoria)

### 6.1 Catalogo stringhe — config, non if

Nuovo modulo unico, riusabile da HTML e da JS:

- `core/config/field-ui-i18n.js` (browser) + mirror CJS in `functions/` **solo** se le push/CF devono risolvere le stesse chiavi (fase 3).
- Forma: `FIELD_UI_STRINGS[lang][key]` + `t(key, lang, vars?)`.
- Chiavi **stabili in inglese corto** (`save_hours`, `select_work`, `no_assigned_works`), non frasi italiane come chiave.
- Ogni lingua MVP deve avere **le stesse chiavi** — test Vitest che fallisce se `ro` o `en` è incompleto rispetto a `it`.
- Vietato: `if (lang === 'ro' && page === 'field-workspace')` sparsi nel controller. Il controller chiama `t('save_hours')`.

Pagine in perimetro strato A (MVP):

1. `core/auth/login-standalone.html` (+ JS login)
2. `core/mobile/field-workspace-standalone.html` + `field-workspace-controller.js`
3. Menu ⚙️ (guide link, validazione, impostazioni) — etichette
4. Reset password se un operaio lo usa dal telefono (`reset-password-standalone.html`) — stesso catalogo, poche chiavi

**Fuori MVP strato A:** iframe dettaglio lavoro, iframe statistiche, `validazione-ore-standalone.html` intera, `segnalazione-guasti-standalone.html` intera, `impostazioni-standalone.html` intera. Accettare italiano lì al primo giro **oppure** passare `?lang=` e tradurre solo i pezzi visibili in campo (non un i18n di quelle pagine intere).

### 6.2 Applicare le stringhe al DOM

Il markup mobile ha decine di testi hardcoded. Due modi accettabili (sceglierne **uno** e usarlo ovunque):

- **A (consigliato):** attributi `data-i18n="save_hours"` + passata all’init / al cambio lingua; placeholder `data-i18n-placeholder`; `aria-label` `data-i18n-aria`.
- **B:** un oggetto di riferimenti nel controller che riscrive `textContent` alle chiavi note.

Non duplicare i cataloghi inline nell’HTML. `document.documentElement.lang` = codice lingua attiva.

### 6.3 Home unica — togliere la seconda app (D5)

Ordine di lavoro (non invertire):

1. **Nascondere** il toggle 🖥️ (`#btn-mode-desktop`) per profilo campo. Opzionale: voce nascosta in Impostazioni «Apri dashboard classica» per 1–2 rilasci (escape), non in header.
2. **Ignorare** `pref === 'classic'` per utenti solo campo in `shouldUseFieldMobileWorkspace` (sempre `true` se manodopera + ruolo campo + non manager). Query `?ws=classic` non deve più mandare l’operaio in dashboard come home.
3. Redirect: se un operaio/capo-only apre `dashboard-standalone.html` senza essere manager → **sempre** field-workspace (già quasi così; togliere l’opt-out).
4. **Non** cancellare `createCaposquadraSection` / `createOperaioSection` nel primo PR: restano per manager+capo (D8) e per rollback. Non aggiungere card nuove lì.
5. Non proporre `segnatura-ore-standalone.html` come ingresso campo (Tony già apre slide Ore sul workspace — §5.5 decisioni).
6. Layout mobile **usabile a ≥1200px** (stesse schede, più larghe). Non inventare un terzo layout «desktop campo». Seguire `LINEA_GUIDA_RESPONSIVE_STANDALONE.md` senza tornare alle tabelle dashboard.

Link «compito» da tenere in mobile:

- Dettaglio / zone: iframe + «finestra intera» (già c’è).
- Validazione completa: link già in slide Valida ore (capo).
- Impostazioni: menu ⚙️.
- **Guasti:** nuovo ingresso (§8).

### 6.4 Tony (profilo campo)

Allineato a Master Plan §3 (priorità operaio/capo) e §5.5 già implementato:

- `APRI_PAGINA` continua a puntare alle **slide** mobile, non alla dashboard.
- Dopo D5: se un comando o un deep link apre ancora `dashboard-standalone` / `segnatura-ore-standalone` per profilo campo, **remap** su workspace (estendere `remapTonyApriPaginaTargetForFieldProfile` se manca un caso).
- Nuova voce guasti in mobile: aggiungere target whitelist in `field-role-guard.js` (`segnalazione guasti` / slide o pagina compito) **senza** aprire Gestione guasti manager.
- `SYSTEM_INSTRUCTION_TONY_FIELD` e guide Tony: quando si implementa, dire che la home campo è solo mobile e che esiste «segnala guasto» in app. **Non** tradurre i prompt Tony in MVP (D9): Tony parla italiano; l’UI è tradotta. Se l’utente scrive in rumeno/EN, Gemini può rispondere in quella lingua nel testo — non è un requisito MVP e non va testato come tale.
- Vietato: nuovo `if (formId === '…')` nel core. Guasto in mapping solo se si fa inject Tony sul form (`segnala-guasto-form` è ancora «INJECT non supportato» in decisioni §4.8 — non è obbligatorio sbloccarlo in questo piano).

### 6.5 Push (fase dopo la cornice)

`notification-catalog.js`: oggi template italiani. Estendere **nel catalogo** (chiavi per `it`/`ro`/`en`), non if nel dispatcher. Destinatario: `users.preferredLanguage` del **ricevente**. Deep link invariato (workspace + `openSlide`). WhatsApp assenza: stesso principio se si tocca in questo track; altrimenti lasciare IT e annotarlo.

### 6.6 Guide utente

- **MVP prodotto:** non tradurre le 32 guide. Opzionale: una pagina breve operaio RO+EN (dopo che la UI è stabile).
- Quando la UI cambia (niente desktop, c’è guasto in mobile, c’è selettore lingua): aggiornare **GUIDA manodopera** operaio/caposquadra + mirror `core/GUIDA` seguendo `.cursor/rules/guida-aggiornamento-checklist.mdc` e `scripts/GUIDA-AGGIORNAMENTO-CHECKLIST.md`. Non farlo in un PR che è solo catalogo stringhe.

---

## 7. Fasi di implementazione (ordine vincolante)

Non fare i18n e guasti e «traduci messaggio» nello stesso PR se si può evitare. Ogni fase = branch + PR su **`develop`**, CI verde, PWA cache bump se si tocca `core/` servito al browser (`npm run bump:pwa-cache`).

### Fase 0 — Documento (questo file)

**Done:** questo piano + puntatori in `TONY_DECISIONI` §24, `STATO_ATTUALE` §8, `COSA_ABBIAMO_FATTO`.

### Fase 1 — Home unica + guasti in mobile (prima delle lingue)

Perché prima: toglie la seconda app e il buco; il catalogo i18n non deve coprire etichette desktop morte.

**Cosa fare**

1. Header mobile: nascondere 🖥️; `#btn-mode-mobile` può restare informativo o sparire se è l’unica modalità.
2. `shouldUseFieldMobileWorkspace`: per solo campo, sempre workspace (niente `classic`).
3. Ingresso guasti nella mobile, visibile se `parcoMacchine` (e ruoli §8.3):
   - **Preferito:** voce menu ⚙️ «Segnala guasto» + sezione/slide nella scheda Lavoro (o slide dedicata se il form è lungo).
   - **Accettabile al primo taglio:** link ⚙️ che apre `segnalazione-guasti-standalone.html` (stesso pattern della validazione completa), con `html`/CSS già usabili al telefono. Poi, se il form è scomodo, **incorporare** i campi nel workspace (estrarre la logica di submit in un servizio/helper, non copiare 2000 righe).
4. Non rifare la mappa zone: iframe + fullscreen restano.
5. Workspace: CSS per viewport tablet/desktop (schede leggibili, bottoni a misura dito anche su schermo largo).

**File tipici:** `field-workspace-standalone.html`, `field-workspace-controller.js`, `field-workspace.css`, `dashboard-utils.js`, `dashboard-standalone.html` (redirect), `field-role-guard.js` / `engine.js` se si aggiunge target guasti, `segnalazione-guasti-standalone.html` (solo se si migliora embed/mobile).

**Criterio done**

- Operaio/capo-only: login → solo workspace; nessun toggle desktop in header.
- Aprire a mano `dashboard-standalone.html` → redirect workspace.
- Con Parco Macchine: si segnala un guasto **senza** passare dalla dashboard.
- Manager: dashboard invariata.
- Tony: «portami a segna ore / comunicazioni» resta sulle slide.
- Verifica browser (telefono + desktop stretto) + ruolo capo-only e operaio.

**Test:** estendere test esistenti di `shouldUseFieldMobileWorkspace` / field-role-guard; niente scrittura Firestore produzione.

### Fase 2 — Cornice IT/RO/EN (login + workspace)

**Cosa fare**

1. `core/config/field-ui-i18n.js` + test completezza chiavi.
2. Selettore lingua login + header workspace + persistenza profilo (§5.2).
3. Tutte le stringhe visibili del workspace (HTML + stringhe JS del controller: status, empty state, GPS, assenza, comunicazioni, ore, validazione inline, modal contatti).
4. Login + reset password (chiavi minime).
5. `document.documentElement.lang`.

**Non fare in Fase 2:** tradurre iframe, catalogo push, guide, Tony voce, francese.

**Criterio done**

- Utente RO: login e tutte le schede operaio/capo (eccetto iframe) in rumeno.
- Cambio lingua in header: cornice si aggiorna senza logout.
- Profilo Firestore ha `preferredLanguage`; secondo device la riprende.
- Test catalogo: `it` / `ro` / `en` stesso set di chiavi.

### Fase 3 — Traduci sulle comunicazioni (strato B)

**Cosa fare**

- Pulsante su ogni card messaggio (ricevuti operaio +, se utile, anteprima capo).
- Callable (o riuso pattern Gemini esistente) `sourceLang=it` → `targetLang=preferredLanguage`.
- Cache per `(comunicazioneId, lang)` se si persiste.
- Non tradurre in automatico all’invio (il capo vede ciò che ha scritto).

**Criterio done**

- Operaio `ro` tocca Traduce su un messaggio IT e legge il rumeno.
- Fallimento rete: italiano visibile + errore localizzato.
- Test unitari sul payload/sanitizzazione; canary emulator se si scrive in Firestore.

### Fase 4 — Push nella lingua del destinatario

Catalogo notifica multilingue + lettura `preferredLanguage`. Deep link invariato.  
**Criterio done:** un evento `assenza_turno` o comunicazione verso operaio `en` arriva con title/body EN.

### Fase 5 — (opzionale, dopo uso reale)

- Francese o albanese se chiesto.
- Mini-guida operaio RO/EN.
- Tony voce/STT nella lingua UI (D9 — solo con requisito esplicito: voci Chirp, lexicon, test e2e).
- `?lang=` sugli iframe compito se gli iframe restano il punto cieco principale.

---

## 8. Dettaglio implementativo per agenti

### 8.1 Inventario stringhe workspace (minimo da catalogare)

Usare i testi attuali come valore `it`. Elenco non esaustivo — il PR Fase 2 deve grep-are `field-workspace-standalone.html` e `field-workspace-controller.js` per ogni `textContent` / `innerHTML` / placeholder utente.

Esempi già in markup: «Versione mobile», «Guida Manodopera», «Validazione ore (schermo intero)», «Impostazioni account», «Seleziona lavoro», «Lavori assegnati», «La mia squadra», «Valida ore», «Segnala assenza», tipi assenza, «Invia segnalazione», «Comunicazioni», «Segna ore», label orari, «Ore nette calcolate», «Salva ore lavorate», «Indietro» / «Avanti» / «Fine», «Chiama», «Email», empty state vari.

Esempi già in JS: «Utente campo», «Nessun suggerimento GPS…», «Suggerimento: …», «Caricamento/Errore lavori», banner sostituto, «Segnalazione inviata al manager.», testi lista ore/comunicazioni, «Dati aggiornati.».

**Non** catalogare nomi lavori (`work.label`) né nomi persone.

### 8.2 Modello dati

```
users/{uid}.preferredLanguage    // 'it' | 'ro' | 'en'
localStorage gfv_field_lang      // stesso enum, pre-auth
```

Rules Firestore: l’utente aggiorna **solo il proprio** `preferredLanguage` (stesso schema delle `notificationPrefs`). Nessuna nuova collection obbligatoria in Fase 2.

Cache traduzioni comunicazioni (Fase 3, se persistita):

```
tenants/{tid}/comunicazioni/{id}.traduzioni.ro  // string
tenants/{tid}/comunicazioni/{id}.traduzioni.en
```

Non è anagrafica da mostrare al manager. Se le rules rendono scomodo, cache solo client-side nella sessione.

### 8.3 Guasti in mobile — comportamento

| Condizione | UI |
|------------|-----|
| Modulo `parcoMacchine` assente | Nessuna voce (come oggi in dashboard operaio) |
| Operaio + modulo | Voce visibile |
| Caposquadra + modulo (anche senza ruolo operaio) | Voce visibile (**default di questo piano**, per D5+D7) |
| Manager | Resta Gestione guasti in ufficio; non è questo track |

Campi da coprire (già nel form desktop): tipo macchina vs generica; trattore/attrezzo/componente; ubicazione + mappa per generica; gravità; dettagli; lavoro corrente opzionale; checkbox posizione + «Segnala qui (GPS)». Non inventare un form diverso: stesso salvataggio Firestore / stesso servizio se esiste.

Tony: spiegare dove sta il pulsante; inject del form guasto **non** è requisito di questo piano (§4.8).

### 8.4 Cosa non toccare

- `tony-form-mapping.js` / injector per moduli ufficio.
- Landing, abbonamento, Stripe, hub manodopera manager.
- `meteo-alert-i18n.js` (direzione opposta).
- Traduzione di `GUIDA/` completa.
- Force push / commit su `main`.
- Scritture sul Firebase di produzione per «provare» le lingue. Emulatori `?emulator=1` o simulatore.

### 8.5 PWA e branch

- Ogni commit che tocca `core/`, `modules/`, `shared/`, `index.html`, asset: `npm run bump:pwa-cache && git add service-worker.js` (gli agenti non hanno l’hook).
- Base PR: **`develop`**. Mai push su `main`.
- Dati: un solo progetto Firebase — non «provare» traduzioni persistendo in produzione.

### 8.6 Test e verifica UI

- Vitest: completezza catalogo; `shouldUseFieldMobileWorkspace` senza opt-out classic; whitelist Tony se si aggiunge guasti.
- Canary / Playwright: solo se si tocca login o submit ore/guasti — riusare pattern `sim:e2e` / canary manodopera esistenti, non un E2E nuovo «per ogni lingua».
- Verifica browser **obbligatoria** su cambi UI: flusso operaio e capo **end-to-end** (login → lavoro → ore → comunicazione; capo: valida + assenza). Viewport telefono **e** desktop. Non basta uno screenshot.
- Se non c’è browser in ambiente agente: dirlo in PR e verificare con test/curl al massimo; non dichiarare done la sola Fase 0.

---

## 9. Criterio done complessivo (prodotto)

Il piano è «fatto» quando un operaio rumeno, senza italiano:

1. Apre il login, sceglie **Română**, entra.
2. Vede solo la versione mobile (anche da PC).
3. Sceglie il lavoro, segna le ore, legge/conferma una comunicazione **tradotta**.
4. Se l’azienda ha Parco Macchine, segnala un guasto dal telefono.
5. Il manager in ufficio continua a vedere l’ERP in italiano, invariato.

Fino alla Fase 3 il punto 3 può essere «legge la cornice in rumeno e il messaggio ancora in italiano» — va dichiarato in PR, non nascosto.

---

## 10. Riferimenti codice (mappa rapida)

| Cosa | Path |
|------|------|
| Workspace campo | `core/mobile/field-workspace-standalone.html`, `core/mobile/js/field-workspace-controller.js`, `core/mobile/css/field-workspace.css` |
| Preferenza mobile/classic | `core/js/dashboard-utils.js` (`shouldUseFieldMobileWorkspace`, `get/setFieldWorkspacePreference`) |
| Redirect login → campo | `core/dashboard-standalone.html`, `dashboard-controller.js` |
| Sezioni dashboard capo/operaio | `core/js/dashboard-sections.js` |
| Tony campo | `core/js/tony/field-role-guard.js`, `engine.js` (`TONY_PAGE_MAP`), `functions` `SYSTEM_INSTRUCTION_TONY_FIELD` |
| Form ore mapping | `core/config/tony-form-mapping.js` `field-workspace-ore-form` |
| Guasti | `core/admin/segnalazione-guasti-standalone.html` (`#segnala-guasto-form`) |
| Zone / dettaglio | `core/admin/lavori-caposquadra-standalone.html` (`embed=mobile`) |
| Push | `core/config/notification-catalog.js`, `functions/notification-dispatch.js` |
| Guide ruolo | `docs-sviluppo/GUIDA/MANODOPERA/utente/guida-operaio.md`, `guida-caposquadra.md` |
| Linea UI standalone | `docs-sviluppo/LINEA_GUIDA_RESPONSIVE_STANDALONE.md` |
| Priorità Tony operai/capi | `docs-sviluppo/tony/MASTER_PLAN.md` §3 |

---

## 11. Checklist agente (prima di aprire un PR)

- [ ] Ho letto questo file e §24 di `TONY_DECISIONI_E_REQUISITI.md`.
- [ ] Non sto traducendo l’ERP / landing / Tony voce (D1, D9).
- [ ] Lingue toccate ⊆ `{it, ro, en}` (D3).
- [ ] Catalogo centralizzato, nessuna stringa nuova hardcoded in una sola lingua.
- [ ] Manager/admin non finiscono sul workspace (D8).
- [ ] Non ho cancellato `lavori-caposquadra` / validazione / impostazioni / guasti (D6).
- [ ] Se ho toccato file browser: `npm run bump:pwa-cache`.
- [ ] Base branch `develop`; niente push `main`.
- [ ] Test/canary senza scrivere in produzione.
- [ ] Se ho cambiato UX campo: verifica browser operaio **e** capo; oppure ho scritto in PR cosa non ho potuto verificare.
- [ ] Changelog: solo i 4 file canonici + questo piano (niente nuovi `TONY_*.md` extra).

---

*Documento creato 2026-09-19. Aggiornare **questo file** quando una fase passa a implementato (tabella sotto) e allineare `TONY_DECISIONI` §24 e `STATO_ATTUALE`.*

| Fase | Stato |
|------|--------|
| 0 Documento | **fatto** 2026-09-19 |
| 1 Home unica + guasti in mobile | pianificato |
| 2 Cornice IT/RO/EN | pianificato |
| 3 Traduci comunicazioni | pianificato |
| 4 Push nella lingua destinatario | pianificato |
| 5 Opzionali (FR, guide, Tony voce) | non in scope finché non richiesti |
