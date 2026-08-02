# Tracking GPS → area lavorata automatica — NON PORTARE AVANTI

**Stato:** **scartato / non in roadmap** (2026-07-31)  
**Spostato da:** `docs-sviluppo/da-fare/lavori/ROADMAP_TRACKING_GPS_AREA_LAVORATA.md`  
**Tipo originale:** idea / roadmap embrionale (prima stesura 2026-07-17)  
**Ambito storico:** lavori / manodopera / field-workspace (PWA mobile)

---

## Motivo dello scarto (decisione prodotto 2026-07-31)

Non portare avanti il **tracking GPS continuo (o di sessione) sullo smartphone del dipendente** per ricostruire l’area lavorata, principalmente per **vincoli legali e di privacy in Italia**:

- **Art. 4 Statuto dei Lavoratori** (L. 300/1970, come modificato): i sistemi da cui derivi un controllo a distanza sull’attività lavorativa sono ammessi solo per finalità tipizzate (organizzazione, produzione, sicurezza, tutela del patrimonio) e con le procedure previste (accordo sindacale / autorizzazione).
- **GDPR + Codice Privacy**: geolocalizzazione dei lavoratori = trattamento ad alto impatto; servono base giuridica adeguata, minimizzazione, informativa, spesso **DPIA**, privacy by design. Il **consenso del dipendente non è base giuridica solida** nel rapporto di lavoro subordinato (squilibrio di potere).
- Orientamento recente del **Garante Privacy** (es. provvedimenti 2025 su geolocalizzazione in contesto lavorativo / smart working): sanzioni e giudizi di illegittimità su trattamenti sproporzionati o finalizzati al controllo diretto.

**Conseguenza per GFV:** non investire in trail GPS → area automatica da telefono operaio/capo. Restano validi e preferiti:

- **zone lavorate manuali** (poligoni già in lavori-caposquadra);
- **mappa aziendale** con progresso lavori / indicatori (dati già in ERP);
- eventuali evoluzioni future della mappa basate su **dati strutturati** (assenze, roster, standby) **senza** posizione del telefono;
- GPS **puntuale / opzionale** già esistenti (confini terreno, guasti, campioni — altro scope; non tracking di percorso lavorativo).

Il testo sotto resta solo come **archivio storico** dell’idea tecnica; **non** è backlog attivo.

---

# Testo originale (bozza embrionale — solo storico)

**Tipo**: idea / roadmap **non ancora deciso** (fase embrionale)  
**Data prima stesura**: 2026-07-17  
**Stato decisionale (all’epoca)**: da discutere — nessuna implementazione autorizzata  
**Riuso esistente**: traccia zone manuale (`lavori-caposquadra`, poligoni), `core/js/geo-capture.js`, confini terreno GPS, caratteristiche terreno (filari)

---

## 1. Obiettivo (visione)

Usare il **GPS del telefono** durante il lavoro in campo per registrare il percorso del mezzo/operatore e **ricavare automaticamente una stima dell’area lavorata**, da salvare come zona/segmento sul lavoro (stesso concetto produttivo della traccia manuale odierna), con **conferma umana** prima della persistenza.

Non è “GPS magico certificato”: è una **stima operativa** che riduce il lavoro di disegnare a mano i poligoni sulla mappa.

---

## 2. Problema reale (perché non basta il perimetro)

Per la maggior parte delle lavorazioni il mezzo **non contorna** l’appezzamento: percorre **linee parallele** (spesso **filari**).

```text
filare / passata 1  ──────────────────
filare / passata 2  ──────────────────
filare / passata 3  ──────────────────
         → buffer laterale → unione → area lavorata stimata
```

Quindi il modello geometrico corretto non è “chiudi il perimetro del trail”, bensì:

1. trail GPS (polyline temporale);
2. **buffer** (striscia / swath) su ogni tratto;
3. **unione** dei buffer → poligono (o multi-poligono);
4. opzionale: **intersezione** con il poligono del terreno;
5. revisione / conferma → salvataggio come zona lavorata sul lavoro.

Con questo approccio l’area si può ricavare **anche senza** un contorno esterno chiuso disegnato dall’operatore.

---

## 3. Larghezza del buffer — due mondi

### 3.1 Terreni a filari (vite, frutteto, olivo, …)

- La geometria utile (es. **distanza tra filari / interfilare**, sesto, caratteristiche impianto) è già (o può essere) **nel database del terreno**.
- Sorgente preferita del semi-buffer: **caratteristiche terreno** (es. ~ interfilare / 2), eventualmente raffinata da tipo lavorazione (tra le file vs sulla fila — da decidere).
- **Non è il blocco principale** a livello dati: il problema è più precisione GPS e UX sessione.

### 3.2 Seminativo (e colture senza griglia fissa)

- Non c’è una griglia di filari sul terreno.
- La larghezza utile è quella della **passata** (attrezzo / macchina / barra), non un attributo geometrico del terreno.
- Sorgenti candidate (in ordine da valutare in decisione prodotto):

| Priorità | Sorgente | Note |
|----------|----------|------|
| 1 | Larghezza lavoro su **attrezzo / trattore** collegato al lavoro | Ideale se anagrafica macchine lo supporta |
| 2 | Default azienda / tipo lavorazione | Fallback |
| 3 | Domanda una tantum all’operatore (anche via Tony) | “Larghezza passata?” |
| 4 | Stima dalla distanza media tra passate parallele nel trail | Da confermare; fragile con GPS rumoroso |

**Regola di prodotto proposta (bozza):** stessa pipeline geometrica; **policy di risoluzione larghezza** diversa in base a `coltura_categoria` / tipo campo (filari vs seminativo).

---

## 4. Ipotesi di UX (field-workspace / PWA)

Entry point naturale: **workspace mobile** sul lavoro selezionato (allineato alla direzione “campo = mobile”).

Flusso embrionale:

1. Operatore/caposquadra apre il lavoro.
2. **Avvia traccia** (permesso geolocalizzazione).
3. Campionamento periodico in foreground (MVP); background = fase successiva / vincoli OS.
4. **Pausa / ripresa** (opzionale MVP+).
5. **Termina traccia** → anteprima mappa (trail + poligono stimato + mq / % sul terreno).
6. **Conferma / modifica / scarta** → salvataggio zone come oggi (o estensione del modello zone esistenti).

Tony (futuro, non vincolante): comandi vocali “avvia/ferma traccia” — solo se il flusso dati e i permessi sono stabili; **nessuna visione/multimodale richiesta** per questo pezzo.

---

## 5. Limiti tecnici da accettare in prodotto

| Limite | Impatto |
|--------|---------|
| Precisione GPS telefono tipica ±3–15 m (peggio sotto chioma / in cabina) | Su filari stretti possibile “salto” di filare; area stimata, non certificata |
| Batteria e kill app in background | MVP preferibilmente **foreground** + avviso se sessione interrotta |
| iOS/Android permessi e PWA | Test obbligatori su entrambi; possibile differenza di comportamento |
| Buffer troppo largo/stretto | Area gonfiata o buchi finti — serve preview + override larghezza |
| Capotesta e curve | Inclusi nel trail; di solito il buffer li gestisce in modo accettabile |

Messaggio utente da prevedere: *“Stima da GPS, verifica sulla mappa prima di salvare.”*

---

## 6. Fasi proposte (solo bozza — non commitment)

| Fase | Contenuto | Criterio “fatto” (indicativo) |
|------|-----------|------------------------------|
| **0 – Decisione** | Accettare/rifiutare l’idea; scegliere MVP (solo filari? anche seminativo?) | Voce in decisioni prodotto + priorità roadmap |
| **1 – MVP filari** | Start/stop trail; buffer da interfilare terreno; unione; preview; salva zona su lavoro | Un lavoro a filari in campo reale con conferma operatore |
| **2 – Seminativo** | Policy larghezza da attrezzo / domanda / stima | Stesso flusso su almeno un seminativo |
| **3 – Robustezza** | Filtro accuratezza, pausa, multi-zona/giorno, % completamento lavoro | Metriche usabili in lista lavori / statistiche |
| **4 – Opzionale** | Background tracking, GNSS esterno / antenna trattore | Solo se MVP dimostra valore |

Fuori scope iniziale (esplicito):

- certificazione catastale / incentivi che richiedono precisione legale;
- sostituzione totale della traccia manuale (resta fallback e correzione);
- tracking continuo 24/7 senza sessione lavoro.

---

## 7. Allineamento architetturale GFV

- **Config > patch**: policy larghezza (filari vs seminativo) in config/servizio, non `if` sparsi nel widget Tony.
- **Persistenza**: riusare / estendere il modello **zone lavorate** già usato da caposquadra; non inventare un silo parallelo senza decisione.
- **Mobile first** per l’acquisizione; desktop = eventuale revisione mappa.
- **Privacy / consenso**: permesso OS + traccia legata a lavoro/tenant; retention da definire in decisione.
- **Non** introdurre callable multimodali / visione per questo flusso (Master Plan: dati strutturati GPS → geometria).

---

## 8. Decisioni aperte (checklist) — storiche

- [x] Si fa o si parcheggia? → **scartato** (2026-07-31), vedi banner in testa.
- [ ] MVP solo filari o anche seminativo? *(n/a)*
- [ ] Campo esatto terreno da usare come interfilare? *(n/a)*
- [ ] Larghezza seminativo: obbligo attrezzo vs domanda vs stima? *(n/a)*
- [ ] Chi può avviare la traccia? *(n/a)*
- [ ] Una traccia = una zona, o merge multi-sessione? *(n/a)*
- [ ] Come aggiorna `% completamento` / superficie lavorata? *(n/a)*
- [ ] Retention punti grezzi GPS? *(n/a)*

---

## 9. Riferimenti codice / doc esistenti (lettura)

| Pezzo | Path / nota |
|-------|-------------|
| Traccia zona manuale lavori | `core/admin/lavori-caposquadra-standalone.html` (modal zona, poligoni) |
| Geolocalizzazione puntuale | `core/js/geo-capture.js` |
| GPS su confini terreno | `core/js/terreni-maps.js`, guida terreni (precisione non certificata) |
| Workspace campo | `core/mobile/field-workspace-standalone.html` |
| GPS campioni (altro use case, futuro) | `TONY_DECISIONI_E_REQUISITI.md` §18 — **non** confondere con area lavorata; resta scope distinto (punti campione, non trail dipendente) |
