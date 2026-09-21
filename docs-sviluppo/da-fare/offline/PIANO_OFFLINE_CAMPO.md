# Piano: lavorare in campo senza (o con poco) segnale

**Tipo:** verbale di decisione + analisi sul codice (nessuna implementazione)  
**Data:** 2026-09-14  
**Stato:** decisioni di perimetro chiuse; codice **non** scritto  
**Per chi:** agenti e sviluppatori su PWA, workspace mobile, manodopera, guasti, terreni

**Origine:** conversazione prodotto 2026-09-14 (analisi codice, senza patch). Non perdere questo testo: è il riferimento per quando si implementa.

**Documenti correlati:**

- `docs-sviluppo/GUIDA_PWA.md` — service worker attuale (network-first, cache on-demand)
- `docs-sviluppo/in-sviluppo/tony/PLAN_OTTIMIZZAZIONE_PERFORMANCE.md` §9 Fase **4.4** — coda ore offline **deferred** (track manodopera, non piano performance Tony)
- `docs-sviluppo/in-sviluppo/tony/HANDOFF_CONTINUITA_PERFORMANCE_NAV.md` — stessa voce in backlog
- `docs-sviluppo/tony/MASTER_PLAN.md` — priorità operaio/caposquadra (Fase 2, campo)
- FAQ utente `documentazione-utente/02-FAQ.md` — «Funziona offline?» già onesta: serve connessione, dati in cloud

**Fuori scope di questo piano (scartati / altri track):**

- Offline totale dell’ERP (liste magazzino, report, billing, …)
- Tony vocale/testo senza rete (Gemini + Cloud Functions)
- Trail GPS continuo dell’area lavorata (già in `obsoleto/strategie-superate/ROADMAP_TRACKING_GPS_AREA_LAVORATA.md`)
- Rewrite nativo (Flutter/Capacitor) solo per offline

---

## 1. Domanda di partenza

In vigneto/frutteto il cellulare spesso **non prende bene**. Si può lavorare sull’app lo stesso?

**Risposta:** oggi **no**, in modo affidabile. Qualcosa di PWA c’è (icona, cache asset), ma non è pensato per operare senza rete. Si **può** fare, tagliato su tre flussi di campo (sotto), non su tutta la piattaforma.

---

## 2. Decisioni prodotto (chiuse in conversazione)

1. **Non** «tutta l’app offline». Solo ciò che in campagna non può aspettare il cortile.
2. Perimetro offline:
   1. **Segna ore** (il pezzo più importante)
   2. **Segnalazione guasti**
   3. **Punto GPS** attaccato a quelle azioni, **compreso il vertice GPS del perimetro terreno**
3. Comportamento atteso sulle ore (e analogo su guasti / perimetro salvato): *registro sul telefono → quando torna la linea va in cloud*. **Oggi non è così.**
4. Tony resta **online**. In campo senza rete si usano i form, non la voce.
5. Google Maps (satellite, pin a mano) resta **online**. Il **chip GPS** del telefono no: funziona senza campo.
6. Ordine di implementazione, quando si scriverà codice: **ore (+ GPS sul mobile) → guasti (+ GPS) → perimetro a vertici GPS in locale**.
7. Coda **esplicita** IndexedDB (UX chiara), non solo persistenza opaca di Firestore.
8. Due etichette da non mescolare mai in UI:
   - **In attesa di invio** = solo sul telefono, la rete non ha ancora portato il record in azienda
   - **In attesa di validazione** = già in cloud, aspetta capo/manager

---

## 3. Cosa c’è oggi nel codice (verificato)

### 3.1 PWA / service worker

| Fatto | Dettaglio |
|-------|-----------|
| App installabile | `manifest.json` → `core/dashboard-standalone.html` |
| SW | `service-worker.js`: cache **on-demand**, strategia **Network First** + fallback cache |
| Nessun precache | In `install` si apre la cache e basta; niente lista `urlsToCache` |
| Esclusi dallo SW | Firebase, `googleapis.com`, `google.com`, `gstatic.com`, tutti i CDN cross-origin |
| SDK Firebase | Import ESM da `https://www.gstatic.com/firebasejs/11.0.0/…` (`firebase-service.js`, auth, functions) |
| Persistenza Firestore | **Non** abilitata: niente `persistentLocalCache` / IndexedDB SDK |
| Coda scritture | **Non** esiste |
| Registrazione SW | Login, dashboard, terreni, attività, statistiche (+ FCM). **Workspace mobile non registra** lo SW da solo |
| Pagina offline | Non c’è (checklist in `GUIDA_PWA.md` ancora aperta) |
| Banner rete | Non c’è (`navigator.onLine` non usato nel widget/workspace) |

`GUIDA_PWA.md` dice esplicitamente che Firebase **non** va in cache «perché i dati dinamici devono essere aggiornati». Effetto collaterale: a freddo senza rete l’SDK spesso **non parte**.

Config Firebase: `sessionStorage` (`config-loader.js`) — sopravvive al refresh del tab, **non** alla chiusura della PWA.

### 3.2 Auth e bootstrap pagine

- Auth tiene la sessione in IndexedDB del browser (default Firebase).
- Quasi ogni pagina, workspace compreso, fa `getDoc(users/{uid})` (e spesso tenant/moduli) **sul server**. Se fallisce: errore o redirect al login. Un buco di rete viene trattato come «non sei loggato».
- Field workspace: `core/mobile/js/field-workspace-controller.js` → senza user Firestore manda a login o mostra «Errore caricamento».

### 3.3 Due scenari d’uso (da non confondere)

**A — App già aperta, il campo sparisce**  
Lo schermo resta. Refresh, cambio pagina, Salva: falliscono. Con **segnale debole** è peggio del Wi‑Fi spento: Network First **aspetta il timeout** poi magari usa la cache.

**B — Icona PWA a freddo in mezzo ai filari**  
Quasi sempre pagina rotta: SDK gstatic + user doc + config. Non c’è uno shell offline.

### 3.4 Cosa funziona / sembra / non funziona

**Funziona**

- Installare l’icona
- Cache HTML/CSS/JS **dello stesso origin** già visitati online
- Sessione login nel browser (finché non scade il token)
- UI già in memoria se non si chiude l’app
- Link `tel:` dal workspace
- Chip GPS del dispositivo (`navigator.geolocation`, `core/js/geo-capture.js`) — **non** dipende dal cellulare

**Sembra offline, non lo è**

- «Service Worker per funzionamento offline» in guide vecchie: è cache asset, non dati
- «Stato offline» in dashboard/logout: **presenza utente**, non modalità campo
- Tony «salva locale / 0 CF»: compila il form sul telefono e scrive **subito su Firestore**, senza Gemini. Serve comunque internet
- «Ore in coda da validare»: record **già in cloud**

**Non funziona senza rete (e non deve, in questo piano)**

- Tony (CF + Gemini)
- Tessere / SDK Google Maps
- Login la prima volta
- Meteo, push FCM, OCR/Gemini documenti
- Magazzino (scorte «vere»), report, CDN (Chart.js, jsPDF, …)

---

## 4. I tre flussi nello scope — stato codice e coda

### 4.1 Segna ore

Percorsi di scrittura (tutti `addDoc` diretto, errore = ora persa):

| Superficie | File | GPS oggi |
|------------|------|----------|
| Workspace mobile | `field-workspace-controller.js` → `saveQuickHours` | **No** |
| Pagina Segna ore | `core/segnatura-ore-standalone.html` | Sì, se checkbox «includi posizione» → `posizioneRilevamento` |
| Servizio | `core/services/ore-service.js` → `addDoc` su `tenants/{tid}/lavori/{id}/oreOperai` | dipende dal chiamante |
| Tony | intervista + submit dello stesso form (0 CF) | come la superficie aperta |

Collection: `tenants/{tenantId}/lavori/{lavoroId}/oreOperai`, stato iniziale `da_validare`.

**Perché la coda sta bene qui:** ogni salvataggio è un documento **nuovo** (append-only). Conflitti bassi. Al sync il capo vede l’ora **solo dopo** l’invio, non prima.

UX attesa (decisa):

1. In vigneto Salva → «Salvato sul telefono, si invia quando torna il campo»
2. Ritorno linea / riapertura app con campo → invio
3. In cloud come oggi (`da_validare`)
4. Allineare il **mobile** al desktop sul punto GPS opzionale

Fase 4.4 Tony performance era solo «coda ore IndexedDB deferred». Questo piano **estende** quel track (guasti + GPS + perimetro), restando fuori dal piano latenza Gemini.

### 4.2 Segnalazione guasti

File: `core/admin/segnalazione-guasti-standalone.html`

- GPS: bottone posizione + in salvataggio se «includi posizione» (`getCurrentPositionGeo`). Pin su **mappa** = Google Maps (online).
- Scrittura: `addDoc` su `tenants/{tid}/guasti`.
- **Effetti collaterali** (rendono la coda più ricca delle ore):
  - guasto macchina → `updateDoc` stato trattore/attrezzo (`guasto` / `guasto-lavoro-in-corso`)
  - gravità **grave** + `lavoroId` → lavoro `sospeso`

Offline: in campo «Segnalato sul telefono» (+ punto GPS se acquisito). All’online: crea guasto **e** applica macchina/lavoro. Finché non parte l’invio, in ufficio il guasto **non esiste**.

### 4.3 Perimetro terreno — «Punto da GPS»

File: `core/js/terreni-maps.js` (`addGpsVertexToPolygon`, `centerMapOnMyLocation`), UI in `core/terreni-standalone.html` (stesso modulo su terreni clienti CT).

Oggi **Traccia Confini** → **Punto da GPS** legge il chip e mette un vertice sul poligono **Google Maps**. Senza `google.maps` il bottone dice «Mappa non disponibile». Salvataggio anagrafe = `updateDoc` terreno (`polygonCoords`).

| In campo senza linea | Oggi | Cosa serve |
|----------------------|------|------------|
| Leggere GPS e ricordare i vertici | Bloccato da Maps | Lista punti sul telefono, anche senza satellite |
| Vedere il campo sullo sfondo e ritoccare | Maps | Resta con rete (cortile / bordo strada) |
| Salvare il poligono | Firestore | Coda: perimetro locale → invio al ritorno |

Flusso campagna atteso: cammini, Punto da GPS, Togli ultimo, chiudi; vedi almeno **conteggio punti** e **ettari stimati**; al ritorno della linea si scrive `polygonCoords`. Ritocco fine sul satellite = secondo passo, con rete.

Helper GPS già condiviso: `core/js/geo-capture.js` (`getCurrentPositionGeo`, `buildPosizioneRilevamentoFirestore`). Timeout 25 s, `enableHighAccuracy`. Il «suggerimento GPS» del workspace lavori è ancora un **placeholder** (primo lavoro in lista), non posizione reale.

---

## 5. GPS vs cellulare vs Maps (da non confondere in implementazione)

| Sorgente | Serve il campo? | Uso nello scope |
|----------|-----------------|-----------------|
| Chip GNSS (`geolocation`) | No (fix più lento senza A-GPS) | Ore, guasti, vertici perimetro |
| Rete cellulare / Wi‑Fi | Sì | Invio coda, SDK Firebase, Maps, Tony |
| Google Maps JS + tessere | Sì (e SW le esclude) | Disegno/ritocco perimetro, pin guasto a mano |

Precisione: spesso ± diversi metri; l’UI attuale lo dice già (`map-gps-hint`). Offline non migliora la precisione, evita solo di **perdere** il punto.

---

## 6. Architettura di coda (quando si implementa)

### 6.1 Perché IndexedDB nostra, non solo Firestore persistence

Firestore `persistentLocalCache` accoderebbe le write in silenzio. Contro:

- UX opaca (l’operaio non sa se è in azienda)
- Token Auth ~1 ora: dopo, le regole possono rifiutare la sync
- Guasti: più write collegate (guasto + macchina + lavoro) da tenere atomiche dal punto di vista prodotto
- Perimetro: sessione di N punti, non un `addDoc`
- iOS può evictare la cache

Va bene come **aiuto secondario** alle letture (lavori già scaricati in cortile), non come unica storia per l’operaio.

### 6.2 Pacchi in coda (stesso tubo, tre tipi)

Un outbox IndexedDB, record del tipo:

- `ore` — payload pronto per `oreOperai` (incluso `posizioneRilevamento` se c’è)
- `guasto` — payload `guasti` + flag/azioni macchina e sospensione lavoro da applicare **in sync**
- `perimetro` — `terrenoId` + array vertici `{lat, lng, accuracyMeters}` + chiusura poligono

Idempotenza: non duplicare se l’utente ripreme Salva o se la sync riparte a metà. Chiave stabile per pacco.

Sync: evento `online` e/o all’apertura app. **iOS:** niente Background Sync affidabile — la sync parte quando **si riapre l’app con campo**, non da sola in tasca.

### 6.3 Prerequisito shell (senza questo il Salva non esiste)

1. Precache shell workspace + pagine ore / guasti / terreni già usate in cortile (HTML/CSS/JS core)
2. SDK Firebase in cache **o** venduto nel repo (oggi è il blocco più grosso a freddo)
3. Asset statici: **cache-first** o stale-while-revalidate in campo, non Network First (timeout con 1 barra)
4. Registrare lo SW anche dal workspace mobile
5. Errore rete ≠ logout
6. Banner: nessun campo / in coda / sincronizzato

Letture: elenco **lavori del giorno** (e macchine per il form guasto, terreno in disegno) va scaricato **prima**, in cortile o con un filo di rete. La coda scrive; non inventa l’anagrafe.

### 6.4 Segnale debole (spesso il caso reale)

Non è solo «aereo». Mitigazioni: non bloccare l’UI sul round-trip; timeout corti; retry; accodare anche se `navigator.onLine` è true ma `addDoc` fallisce o è lentissimo.

---

## 7. Cosa resta volutamente online

- Tony (intervista ore **online** già c’è: 3b-C21/C22; distinta da questa coda)
- Mappe e geocoding
- Login / registrazione / reset password
- Magazzino, validazione ore del capo che deve vedere l’elenco **già in cloud**
- Meteo, push, OCR documenti, report/PDF da CDN
- Context Builder server

Il capo **valida** solo ore già sincronizzate. Validare offline è fuori da questo piano.

---

## 8. Ordine di lavoro (quando si apre un PR di codice)

1. **Ore** — workspace + `segnatura-ore-standalone` + GPS sul mobile come sul desktop; outbox; UI «in attesa di invio»
2. **Guasti** — stesso tubo; pacco con side-effect macchina/lavoro in sync
3. **Perimetro** — vertici GPS senza dipendere da Maps in sessione; salvataggio `polygonCoords` al ritorno; ritocco satellite con rete
4. Shell PWA (precache + Firebase in cache + no-redirect-on-network-error) è **trasversale**: va affrontato almeno per le pagine dei punti 1–3, altrimenti il form non si apre

Non mescolare in quel PR: Tony, magazzino, trail GPS area lavorata, rewrite nativo.

Test: simulatore / emulatori (`?emulator=1`), **mai** Firestore produzione. Verifica manuale: cortile (scarico) → aereo o campo assente (salva) → di nuovo rete (compare in validazione / gestione guasti / anagrafe terreni). iPhone PWA: chiudi app e riapri con campo.

---

## 9. Riferimenti file (ancora)

| Pezzo | Path |
|-------|------|
| SW | `service-worker.js` |
| Manifest | `manifest.json` |
| Firebase init | `core/services/firebase-service.js` |
| Config loader | `core/js/config-loader.js` |
| GPS | `core/js/geo-capture.js` |
| Workspace ore | `core/mobile/js/field-workspace-controller.js` |
| Segna ore | `core/segnatura-ore-standalone.html`, `core/services/ore-service.js` |
| Guasti | `core/admin/segnalazione-guasti-standalone.html` |
| Perimetro | `core/js/terreni-maps.js`, `core/terreni-standalone.html` |
| Tony ore online | `core/js/tony/tony-segna-ora-local-engine.js`, `core/js/tony/main.js` |

---

## 10. Frasi da non perdere (verbale)

- *«Per le ore: registro, e quando torna la linea va tutto online — o è già così?»* → **non è già così**; si può fare ed è il flusso giusto.
- *«La parte importante offline è ore, segnalazione guasti, GPS di conseguenza, compreso il punto GPS per il perimetro terreno.»* → perimetro di questo documento.
- Network First in vigneto è la strategia sbagliata (timeout). Cache-first sugli asset; coda sulle write.
- Due code diverse: **invio** vs **validazione**.
- iPhone: sync all’apertura con campo, non in tasca.

**Ultimo aggiornamento:** 2026-09-14  
**Versione:** 1.0 (solo documentazione)
