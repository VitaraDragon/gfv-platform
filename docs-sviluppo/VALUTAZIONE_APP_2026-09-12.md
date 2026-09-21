# Valutazione GFV Platform

**Data:** 12 settembre 2026  
**Tipo:** snapshot periodico dello stato dell’app (codice, sicurezza, prodotto, concorrenza)  
**Letto da:** product owner e agenti — scritto anche per chi non programma  
**Ambito:** albero completo del repo (`core/`, `modules/`, `functions/`, `shared/`, `simulator/`, `tests/`, `landing/`, rules, documentazione)  
**Metodo:** revisione del codice in repo, non una sessione loggata su un’azienda reale

---

## Come usare questo documento

È una **fotografia al 12 settembre 2026**. Non sostituisce lo stato operativo quotidiano (`tony/STATO_ATTUALE.md`, `COSA_ABBIAMO_FATTO.md`, `DOBBIAMO_ANCORA_FARE.md`). Serve a rispondere: *dove siamo come prodotto, cosa è solido, cosa è fragile, cosa fare prima di vendere in scala*.

### Snapshot precedenti (stessa famiglia)

| Data | Documento | Cosa diceva (in sintesi) | Cosa è cambiato da allora |
|------|-----------|--------------------------|---------------------------|
| 1 feb 2026 | `VALUTAZIONE_DETTAGLIATA_APP_2026.md` (copia anche in `obsoleto/analisi-superate/`) | 4/5, core solido, pochi test, inviti `create` aperti | Tony, billing, manodopera, E2E e simulator sono nati o maturati; i 4/5 erano troppo ottimisti sulla sicurezza |
| 25 feb 2026 | `VALUTAZIONE_APP_2026-02-25.md` | 4/5, “adatta a produzione” con fix inviti e doc | Create inviti **chiusa** (apr 2026). Restano read pubblica inviti, `users` senza allowlist, Tony che si fida del tenant del client. Test e CI oggi sono molto più forti |
| 12 set 2026 | **questo file** | Voto per area, non un unico 4/5; P0 sicurezza spiegati in linguaggio semplice | — |

Per decisioni di **oggi** usare questo file + `SICUREZZA_FLUSSI.md` (perimetro operativo preventivi/inviti). Gli snapshot vecchi restano come storia, non come giudizio corrente.

---

## 1. Executive summary

**GFV è un ERP agricolo vero, non un prototipo.** Ha un wedge credibile (manodopera + conto terzi + Tony sui dati dell’azienda) e una disciplina di test sopra la media per un’app HTML/JavaScript. Non è ancora un SaaS “chiuso”: due porte sul retro sulla sicurezza multi-azienda, tre file enormi che tengono in ostaggio Tony, go-to-market indietro rispetto al codice.

| Area | Voto | Lettura in una riga |
|------|------|---------------------|
| Profondità di dominio | **8/10** | Vigneto, lavori, ore, squadre, conto terzi: software da campo |
| Architettura dichiarata | **7.5/10** | Core / moduli / mapping Tony: la direzione è giusta |
| Esecuzione del codice | **5.5/10** | Tre file-dio, HTML clonati, eccezioni `formId` dove la regola dice “solo config” |
| Sicurezza | **4/10** | Il modello tenant è solido; due falle lo aggirano se qualcuno *prova* (vedi §2) |
| Test e CI | **7.5/10** | ~189 file di test, simulatore, E2E Tony |
| UX / brand | **5.5/10** | Usabile in campo; chrome da tool interno; landing “coming soon” |
| Vs concorrenti | **Nicchia forte, mercato debole** | Vince su crew + AI operativa; perde su QdC, satellite, sito, canale |
| Prontezza a vendere in scala | **Media-bassa** | Prima i due P0 di sicurezza e il billing coterm |

**Non serve riscrivere l’app in React o Vue.** Serve chiudere le due porte di sicurezza, spezzare Tony a pezzi (come già fatto con la dashboard), e vendere ciò che già funziona.

---

## 2. FAQ sicurezza — in linguaggio semplice

*Questa sezione risponde alle domande del product owner (12 set 2026). Va letta prima dei dettagli tecnici.*

### “Un operaio, usando l’app come tutti i giorni, può entrare in un’altra azienda o promuoversi manager?”

**No.** Se apre dashboard, segna ore, guarda i lavori, non vede i dati di un altro tenant e non trova un bottone “diventa amministratore”. I menu e i permessi in schermata sono fatti apposta: manager e proprietario (nel codice: ruoli `amministratore` / `manager`) invitano, cambiano ruoli, gestiscono l’azienda. Operaio e caposquadra no.

Quello che la valutazione chiama “si può entrare in altri tenant / altri ruoli” **non è il percorso normale dei pulsanti**.

### “Allora stai parlando di hacking, non di utilizzo normale?”

**Sì, nel senso comune della parola:** qualcuno che è *già* utente (ha email e password della vostra app) e invece di cliccare i bottoni parla **direttamente** con il database, come se usasse una porta sul retro.

Non è “uno sconosciuto da internet entra senza account”. L’autenticazione c’è. Non è nemmeno “il manager fa il suo lavoro” (invitare, dare ruoli): quello è lecito e deve restare.

È il caso:

- un operaio (o un ex dipendente che ha ancora l’accesso) che sa usare gli strumenti del browser, oppure
- un copincolla trovato online / un’estensione malevola, oppure
- un tecnico curioso che apre la console,

e invia al database un aggiornamento che **l’interfaccia non offre**.

Metafora: l’app è un ufficio. I dipendenti vedono solo le stanze del loro piano (l’interfaccia). Il database è il magazzino in cantina. Le **regole Firestore** sono il lucchetto sulla cantina. Oggi, su due sportelli, il lucchetto è più largo di quello delle porte dell’ufficio: chi sa dove sta la cantina può spingere, anche se in ufficio non c’è il bottone.

Per un gestionale **multi-azienda sullo stesso database** questo è il modello di minaccia normale, anche senza un “hacker professionista”. Non serve conoscere magie: serve un account valido e un po’ di tecnica. Non è l’uso quotidiano del titolare che clicca in dashboard.

### “Come farebbero a conoscere l’ID di un’altra azienda?”

Due cose diverse:

1. **Promuoversi nella propria azienda** — non serve nessun ID altrui. L’utente aggiorna *il proprio* documento (`users/{mioId}`) e si scrive `ruoli: amministratore`. L’ID lo ha già: è lui. Questo è il buco più concreto.

2. **Leggere un’altra azienda** — qui sì servirebbe l’identificativo del tenant. Non è un segreto militare: in registrazione spesso è il nome azienda normalizzato; a volte si vede nell’app o nelle richieste di rete. Tony, oggi, **accetta il tenant che gli arriva dal browser** senza ricontrollare “questo utente è davvero membro?”. Quindi non è “indovinare un UUID impossibile”: è “essere loggati e chiedere un contesto con un altro nome azienda”.

Nessuno dei due casi succede cliccando “Gestione utenti” se non sei già manager. Succedono se si bypassa l’interfaccia.

### “Creare nuovi ruoli? Il manager deve poterlo fare…”

Qui c’è stato un equivoco di linguaggio.

- **Cosa deve restare:** il manager/admin **assegna** a un collega i ruoli già previsti (operaio, caposquadra, manager, amministratore), tramite inviti e gestione utenti. È il flusso giusto.
- **Cosa non andrebbe permesso:** che **chiunque**, incluso un operaio, possa **scriversi da solo** quei ruoli sul proprio profilo, o aggiungersi a un’altra azienda, senza passare da gestione utenti.
- **Non** si intende inventare tipi di ruolo nuovi (“direttore vendite”). I ruoli nel codice sono quattro, fissi.

In sintesi: il manager deve poter nominare un manager. L’operaio non deve poter nominare *se stesso*.

### “Dobbiamo spaventarci? Chiudiamo l’app?”

No. Non è “l’app è bucata e chiunque entra da strada”. È: **il lucchetto in cantina non coincide ancora con le porte che vedete in ufficio.** Per pochi tenant amici / pilot è un rischio calcolato. Prima di tanti clienti paganti sullo stesso Firebase, quei due lucchetti (documento utente + Tony che verifica il tenant) vanno allineati alle porte. È un lavoro da regole e da una Cloud Function, non da rifare il prodotto.

Dettaglio tecnico: §6.

---

## 3. Cos’è davvero l’app oggi (non il README)

Il `README.md` in root è **indietro**: parla di `seminativo`, modulo `vendemmia/`, `init.js`, fasce Starter/Pro/Enterprise. Nel codice il prodotto è un altro.

**GFV Platform** è un’app a **molte pagine HTML** (non una singola SPA), pubblicata da GitHub Pages, dati su Firebase (Auth, Firestore, Functions, Storage), installabile sul telefono (PWA). **Un solo progetto Firebase** per `main` e `develop`: il branch protegge il *sito*, non i *dati*. Una prova di scrittura “da develop” colpisce comunque la produzione.

| Pezzo | Cosa c’è in repo a settembre 2026 |
|-------|-----------------------------------|
| **Core** | Auth, dashboard per ruolo, terreni, attività, lavori, ore, squadre, statistiche, mappa, admin, abbonamento |
| **Moduli** | vigneto, frutteto, magazzino, manodopera, conto-terzi, parco-macchine, vendemmia-meccanica, meteo, report. Oliveto solo in listino (`available: false`) |
| **Tony** | Widget + Gemini 2.5 Flash in Cloud Function, voce Chirp 3, Context Builder, mapping form, piano Free / Base (Guida) / modulo Tony (operativo) |
| **Landing** | Vue + Vite + TypeScript, ma è un teaser “coming soon”, non un sito che vende |
| **Pagine** | ~75 `*-standalone.html` (28 in `core/`, 47 in `modules/`) |

Ruoli nel codice: `amministratore`, `manager`, `caposquadra`, `operaio`. Non esiste un ruolo distinto “proprietario”: in pratica è amministratore/manager. Un utente può appartenere a più aziende (`tenantMemberships`).

Prezzi in codice (`subscription-plans.js`): Free €0 (Tony assente, limiti 5 terreni / 30 attività·mese), Base €5/mese (Tony Guida), moduli pay-per-use €1–6, Tony Avanzato €5 come modulo.

---

## 4. Codice: cosa tiene e cosa è fragile

### 4.1 Cosa è fatto bene

- Path dati `tenants/{tenantId}/…`, servizi con tenant corrente, modelli con validazione.
- Dashboard già spezzata in file (`dashboard-data.js`, `dashboard-maps.js`, `dashboard-perf.js`, …).
- Gestione lavori a controller / events / utils / maps, non un unico blob.
- Cloud Functions: pezzi estratti (`tony-nav-quick-reply.js`, `tony-module-gate.js`, `stripe-webhooks.js`, meteo, notifiche). Webhook Stripe con firma. Secret Gemini / Resend / Stripe **non** nel codice delle Functions.
- **Simulatore + Vitest + Playwright**: ~189 file di test. Non è cosmesi: intent Tony, manodopera, scritture E2E su vigneto / magazzino / preventivi / ore.
- La regola **configurazione > codice** per i form Tony (`tony-form-mapping.js`, ~640 righe) è la decisione giusta. Il problema è che il resto non le obbedisce abbastanza.

### 4.2 I tre file che pesano di più

| File | Dimensione circa | Perché è un rischio |
|------|------------------|---------------------|
| `core/js/tony/main.js` | 606 KB, ~9.650 righe, 81 `setTimeout` | Orchestrazione, inject, navigazione, voce, salvataggi: tutto lì. Molti “aspetta 400 ms e riprova” → su telefono lento a volte flaky |
| `core/js/tony-form-injector.js` | 326 KB, ~7.260 righe | Decine di `if (questo form è il lavoro / il preventivo / …)` — il contrario del Master Plan |
| `functions/index.js` | 316 KB, ~4.540 righe | tonyAsk, contesto, preventivi, voce, colla billing. Helper estratti, il file resta enorme |

Nel core e nelle Functions ci sono circa **86 confronti `formId === …`**. Ogni form nuovo tende ad aggiungere un ramo, non una riga di mapping. È il debito che costerà di più nei prossimi mesi — più di “manca TypeScript”.

Altri file pesanti ma **di mestiere** (estendere, non riscrivere): controller attività e lavori, impostazioni (~234 KB di HTML), pagine gemelle vigneto/frutteto trattamenti e concimazioni (~120 KB, quasi copie).

### 4.3 Debito strutturale (non estetico)

1. **Pagine standalone clonate.** Lo stesso avvio Firebase/Maps copiato. Esiste `standalone-bootstrap.js` e quasi nessuno lo usa. `shared/` ha 5 file e pochissimi import.
2. **Stato globale nel browser** (`window.Tony`, `window.currentTableData`, tante bandierine interne). Funziona; i tempi di gara sono difficili da vedere.
3. **Validazione a volte solo in schermata.** Sui *lavori* le regole database stringono i campi di capo e operaio. Su *attività*, *ore degli operai* e *zone lavorate* qualsiasi membro dell’azienda può creare/modificare/cancellare se parla al database (stesso discorso della cantina, §2).
4. **Nessun “bundler” sull’ERP.** Tony da solo è ~600 KB da far digerire al telefono. La landing ha Vite; l’app no. Scelta MPA/PWA legittima, costo mobile reale.
5. **CI che a volte non parte.** Il workflow `simulator-ci.yml` **non** elenca `tony-form-injector.js`, `tony-form-mapping.js`, `functions/index.js`. Si può rompere Tony senza far partire i test su cui fate affidamento.
6. **Lista lavori: scarica tutto.** Piano già scritto (`da-fare/lavori/PLAN_SCALABILITA_LISTA_LAVORI.md`). Con ~3.000 lavori l’anno (10 operai) diventa un problema di costo Firestore e di memoria, non solo di schermata. Maps oggi è pigra all’apertura; il download dei lavori no.
7. **Documentazione a due velocità.** ~330 file markdown, di cui ~86 in `obsoleto/`. I canonici (Master Plan, Stato attuale, decisioni) sono ottimi. README e parti di `STATO_PROGETTO_COMPLETO.md` mescolano verità e fossili (EmailJS, “Firestore in modalità Test”, prezzi Enterprise).
8. **Test “security” che non chiudono il lucchetto.** `tests/security/permissions.test.js` verifica funzioni copiate in locale, non le regole Firestore vere. Non avrebbero preso i due P0.

### 4.4 Cosa non toccare (rifare sarebbe un danno)

- Servizi di dominio che funzionano (lavori, magazzino, conto terzi, parco macchine)
- Spezzatino della dashboard e cache PWA (Network-First + codice build)
- Mapping form Tony + cancello moduli + risposte rapide deterministiche
- Simulatore e matrice E2E Tony
- Landing Vite tenuta isolata
- Rewrite in un framework “per snellire” — già detto in `DOBBIAMO_ANCORA_FARE.md`, resta vero

Migliorare il codice **sì**, per *estrazione e configurazione*, non per rivoluzione: spezzare `tony/main.js` come la dashboard; spostare le cascate dei form nel mapping **un form alla volta**; un solo avvio pagine; togliere le chiavi Maps copiate in 13 file.

---

## 5. Guardando l’app (UX e prodotto)

Identità visiva: **verde agrario, emoji, pagine dense**. Coerente, poco “SaaS 2026”. Tony (pallino, voce, intervista) è l’unico pezzo con faccia da prodotto; il resto è console di cantiere. Per un caposquadra in vigna è un pregio. Per un titolare che arriva dal sito, no: la landing non spiega prezzi, moduli, né un giro guidato.

**Funziona bene (dal codice UI):**

- Dashboard che cambia con il ruolo; sul campo l’operaio/capo ha uno spazio a slide, non tutto l’ERP
- Conto terzi: intestazione che diventa blu — si capisce il contesto
- Magazzino a hub, sotto-scorta, bolla ora e prezzi dopo (come lavorano i fornitori italiani)
- PWA sul telefono, allineata al pitch “zero hardware”

**Meno bene:**

- Troppi bottoni in testata dashboard, tutti dello stesso peso
- Tabelle e form lunghi; HTML da 150–180 KB in una pagina sola
- Report: Tony sa *aprire* Statistiche, non ancora “mostrami quel grafico”
- Offline: si cachano i file dell’app, non i dati. In campagna con rete a pezzi, chi promette sync offline vince la percezione

**Tony operativo** (crea lavoro, segna ore, preventivo, magazzino, voce, molti giri senza chiamare il cloud) è più avanti di quasi tutti i gestionali agricoli di questo mercato. **Tony analista** (storico, “quest’anno spendiamo il 15% in più di concime”) è ancora la visione del Master Plan, non il prodotto. In vendita non va promesso l’analista se si consegna l’operativo.

---

## 6. Sicurezza — dettaglio (dopo la FAQ §2)

L’architettura *vuole* l’isolamento tra aziende. Billing, meteo, email controllano “sei membro di questo tenant?”. Sui lavori le regole limitano i campi di capo e operaio. Cache meteo/Tony: solo server. Preventivi da link email: token in Cloud Function, non database aperto. Tutto questo è lavoro fatto bene.

Poi due sportelli restano più larghi delle porte.

### P0 — Il proprio profilo utente è troppo scrivibile

In `firestore.rules`, chi è loggato può aggiornare **il proprio** documento `users` senza lista di campi ammessi. Può scriversi ruoli e appartenenze. Da lì: auto-promozione a manager, o (con un tenantId) tentativo di agganciarsi a un’altra azienda.

Anche la *creazione* del documento in registrazione non limita i ruoli. I manager con i ruoli “vecchio formato” possono **leggere qualsiasi utente**, non solo i colleghi: combinato con l’auto-promozione è una fuga di email.

*Traduzione:* il lucchetto non dice “sul tuo profilo puoi cambiare nome e telefono”; dice “sul tuo profilo puoi cambiare tutto”. L’interfaccia non lo offre; il database sì.

### P0 — Tony si fida del “di quale azienda parli” mandato dal telefono

La Function che risponde a Tony usa l’Admin SDK (passa sopra le regole Firestore). Il tenant arriva dal contesto del browser. Non c’è il controllo “questo utente è membro attivo di *quel* tenant” prima di caricare terreni, magazzino, lavori. Meteo e billing quel controllo ce l’hanno; Tony no.

*Traduzione:* Tony è un impiegato con le chiavi di tutte le cantine, e oggi crede al badge che gli mostri, senza telefonare all’anagrafe.

### P1 (dopo i due P0)

- **Inviti:** lettura pubblica (`allow read: if true`). In Firestore “read” include anche **elencare**. I token degli inviti, se listabili, non sono più un segreto. La *creazione* è stata ristretta ad aprile 2026 (bene); la lettura no.
- **Attività / ore / zone:** qualsiasi membro dell’azienda, parlando al database, può cancellare o alterare. In UI l’operaio non ha “elimina tutte le ore del collega”; in cantina, se sa gli id, sì.
- **Storage (loghi, documenti Tony Occhi):** controlla solo il `tenantId` vecchio, non le membership nuove. Il ruolo manager è dichiarato “verificato in schermata”.
- **Guasti macchine:** stesso disallineamento `tenantId` vecchio.
- **Niente App Check, niente tetto di chiamate** su chat Tony / voce. Un account può far salire il conto Gemini. È in checklist da mesi.
- **Chiavi nel git pubblico:** `firebase-config.js` dice “non viene committato” ma **c’è**. Stesso per Maps (e la stessa chiave copiata in 13 file). Per Firebase web è normale avere la chiave in pagina; il rischio è che su Google Cloud non sia ristretta per sito. Lo Stripe *pubblicabile* di test in client è ok; i secret server no (qui il pattern è corretto).

### P2

- Tanti `innerHTML` e non sempre il testo è “escpato”: un nome o una nota messi in tabella possono, in teoria, eseguire script in pagina.
- Comunicazioni di squadra: le legge tutto il tenant; il filtro “solo destinatari” è in schermata.
- Statistiche aggregate scrivibili da qualsiasi membro.
- Se non si aggiorna il numero di cache PWA, i telefoni restano sulla versione vecchia anche dopo un fix.

**I test di sicurezza attuali non avrebbero preso i P0.** Servono test delle regole sull’emulatore, più il controllo di membership in Tony.

---

## 7. Vs concorrenza (Italia / EU)

Non siete nella partita di Cropio / 365FarmNet / xFarm sul satellite. Non siete Isagri sulla contabilità. Non siete un Quaderno di Campagna per PAC/Agea.

| Loro | Voi |
|------|-----|
| xFarm / Agricolus: ettari, sensori, registri, marchio | Prezzo basso, moduli a pezzi, AI che *fa* non solo *consiglia* |
| QdC italiani: compliance trattamenti | Trattamenti legati a magazzino e lavori, **niente export registro ufficiale** |
| Farmable e simili: ~€29+/mese, schermate più “prodotto” | Base €5 + moduli €1–6; schermate da ERP interno |
| Contoterzisti: spesso Excel + WhatsApp | Preventivi, tariffe, accettazione da link, vendemmia meccanica — nicchia vera |
| Crew e ore: spesso assenti o grezzi | Il pezzo più maturo (validazione, sostituzioni, impegni, semaforo, mappa allarmi) |

**Frase di posizione (già in strategia, ancora valida):** ERP modulare per viticoltori e aziende miste italiane, con assistente sui dati reali — paghi solo i moduli che usi.

Il prezzo basso è leva d’ingresso, non posizione a cinque anni (è già deciso in `STRATEGIA_MARKETING_VENDITA_HANDOFF.md`). Il rischio commerciale non è “siamo troppo economici”: è **nessuno vi trova**. Landing coming soon, app su GitHub Pages, billing v2 (una sola data di rinnovo, passa-al-bundle senza doppio addebito) ancora incompleto. Prima di publcità: lucchetti P0, enforcement del piano Free, coterm.

Non inseguire NDVI “perché ce l’hanno tutti”. Agrieuro non è un competitor (è ecommerce).

---

## 8. Maturità per area (fotografia)

| Area | Maturità | Nota |
|------|----------|------|
| Core (terreni, attività, dashboard, ore) | Alta | Cuore PWA, ruoli, molti scenari di test |
| Lavori + manodopera | Alta | Validazione, sostituzioni, impegni, mappa allarmi |
| Vigneto | Alta | Ciclo coltura + statistiche + E2E scrittura |
| Frutteto | Alta-media | Parallelo al vigneto; qualche parametro stats ancora in da-fare |
| Magazzino | Media-alta | Prodotti/movimenti/tracciabilità; Occhi (foto bolla) in corso e già in produzione sulla Function di estrazione |
| Conto terzi | Media-alta | Loop commerciale completo |
| Parco macchine | Media-alta | Liste, guasti, scadenze, collegamento lavori |
| Vendemmia meccanica | Media | Modulo dedicato, dipende da conto terzi |
| Meteo | Media | Pagina + cancello Tony |
| Report | Media-bassa | Pagine ci sono; grafici spesso da far crescere |
| Oliveto | Bassa | Solo “prossimamente” in listino |
| Billing / sito / canale | Media / bassa | Checkout c’è; coterm e marketing no |
| Tony | Alto in operativo, incompleto in visione/storico | Guida vs Avanzato, form, nav, voce; memoria storica e grafici aperti |

---

## 9. Sviluppi futuri che stanno *in questa* app

In ordine di aderenza al prodotto, non di moda:

1. **Chiudere i due P0** — Tony verifica il tenant; sul profilo utente si possono cambiare solo i campi anagrafici, non ruoli e aziende.
2. **Billing v2** — una data di rinnovo, conversione singoli → bundle senza pagare due volte (`in-sviluppo/abbonamento/BILLING_V2_HANDOFF.md`).
3. **Enforcement piano Free** — 5 terreni / 30 attività: se è solo scritta in schermata, il freemium non converte.
4. **Tony Occhi fino in fondo** — bolla ora, prezzi dopo. Italiano, magazzino, già disegnato. Non “AI vision generica”.
5. **QdC come ponte** — export trattamenti/consumi verso gli strumenti PAC che le aziende già usano. Non rifare Agea.
6. **Lista lavori per periodo** — altrimenti il secondo anno di un tenant da 10 operai costa letture e rallenta Tony.
7. **Giornata del caposquadra come schermata eroina sul telefono** — impegni, assenze, “Marco manca, chi mando?” a voce. Canale naturale: cantine, contoterzisti.
8. **Oliveto** con lo stesso stampo di vigneto/frutteto, quando il canale lo chiede — non prima.
9. **Demo azienda + 60 secondi di Tony** — la strategia marketing lo dice; il sito no.
10. **Memoria storica Tony e “mostrami il grafico”** — dopo che operativo e billing tengono.

Da non fare ora: satellite, rewrite SPA, unire vigneto e frutteto in un colpo, TypeScript su tutta l’app, secondo progetto Firebase “per prova” senza una decisione esplicita (costa e tocca i domini di login).

---

## 10. Priorità (impatto / rischio)

**Subito, poco rischio collaterale**

- In Tony (e nella voce): verificare che l’utente *appartenga* al tenant prima di qualsiasi lettura privilegiata
- Sul documento `users`: lista campi ammessi; il manager legge solo i colleghi della stessa azienda
- Inviti: si può aprire *quel* invito se hai il link/token, non elencare tutta la cassetta
- Allargare i path della CI a injector, mapping, `functions/index.js`

**Subito dopo (regole database)**

- Attività / ore / zone: per ruolo e “sono i miei dati”
- Storage e guasti allineati alle membership nuove; scrittura loghi solo manager
- App Check + tetto di chiamate per utente su Tony/voce
- Togliere le chiavi Maps copiate; su Google Cloud restringere per sito
- Test delle regole sull’emulatore (auto-promozione + Tony su altro tenant)

**Poi, qualità a pezzi**

- Un solo avvio sulle pagine che si toccano
- Test “il mapping basta a compilare il form” (pagina finta)
- Spezzare `main.js` per famiglia di comandi, senza cambiare ciò che vede il widget
- Cascate nel mapping, un form per volta
- Query lavori per mese/anno, non “tutti”
- Testo in tabella sempre passato da `escapeHtml`

---

## 11. Quadro onesto (chiusura)

Avete costruito, in JavaScript “classico” e Firebase, qualcosa che molti gestionali da catalogo non hanno: **un operatore AI che conosce l’azienda e compila i form giusti**, più un modulo manodopera da capocantiere, più conto terzi. È tesina di dominio, non un chat accanto ai form.

Il prezzo si vede nel repo: file enormi, attese a timer, HTML duplicato, documentazione che è anche memoria di squadra (a volte troppa). Si sistema a pezzi, come già fatto con dashboard e widget.

Quello che **non** si sistema a pezzi se lo si ignora è il lucchetto in cantina: profilo utente troppo libero e Tony che crede al tenant del telefono. Non è l’uso normale del titolare. È il caso “qualcuno che c’è già dentro e prova”. Per pochi pilot si può convivere; per tanti clienti sullo stesso Firebase è un blocco al go-live commerciale, non “hardening un giorno”.

**Continuare su questa architettura. Non cambiare stack. Allineare i lucchetti alle porte. Vendere crew + Tony operativo a viticoltori, miste, contoterzisti. Lasciare satellite e QdC nativo agli specialisti, al massimo un export.** Il codice si può migliorare; non va buttato.

---

*Snapshot 2026-09-12. Prossimo giro di valutazione: dopo i P0 di sicurezza e/o dopo billing v2, non a calendario fisso.*
