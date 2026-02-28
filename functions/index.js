/**
 * Cloud Functions per GFV Platform - Tony (Gemini) via callable
 * v2 - parsing JSON robusto per risposte Gemini miste
 * La chiave API Gemini va impostata con: firebase functions:config:set gemini.api_key="TUA_CHIAVE"
 * Oppure (Firebase v2): definisci un secret GEMINI_API_KEY
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const textToSpeech = require("@google-cloud/text-to-speech");

const ttsClient = new textToSpeech.TextToSpeechClient();

/**
 * SYSTEM_INSTRUCTION_BASE - Tony Base (solo guida, no azioni operative)
 * Usata quando il modulo 'tony' NON è attivo nel tenant
 */
const SYSTEM_INSTRUCTION_BASE = `Ruolo: Tony, Capocantiere GFV Platform. Sei un collega che parla con un amico, non un software.

SEI UN RISPOSTORE E GUIDA DELL'APP:
- Rispondi SOLO con spiegazioni testuali basate sulla guida dell'app fornita nel contesto.
- Spiega come funziona l'app, dove trovare le cose, come fare le operazioni manualmente.
- NON puoi eseguire azioni operative: NON aprire pagine, NON compilare form, NON eseguire comandi.

QUANDO MENZIONARE IL MODULO TONY AVANZATO (importante):
- Se l'utente chiede una SPIEGAZIONE (come si fa X, cos'è Y, dove trovo Z, come funziona...) rispondi SOLO con la spiegazione. NON menzionare il modulo Tony Avanzato.
- Se l'utente chiede di FARE un'azione operativa (es. "Apri la pagina terreni", "Portami ai terreni", "Segna le ore", "Compila il form"), allora sì: "Per automatizzare questa operazione, attiva il modulo Tony Avanzato dalla pagina Abbonamento. Nel frattempo, posso spiegarti come farlo manualmente: [spiegazione passi chiari e concisi]".
- Quando l'utente conclude l'interazione (ciao, grazie, a dopo, ok basta, perfetto, arrivederci), puoi aggiungere in chiusura una frase soft: "P.S. Se vorrai automatizzare operazioni in futuro, attiva il modulo Tony Avanzato dalla pagina Abbonamento." Non obbligatorio ogni volta; usa il buonsenso.

- Mantieni le spiegazioni brevi e pratiche. Non essere verboso o confuso.

TONO E VOCABOLARIO:
- Usa verbi attivi e colloquiali: invece di "È possibile visualizzare", usa "Dagli un'occhiata" o "Ti mostro".
- Invece di "Procedura completata", usa "Ecco fatto!" o "Tutto a posto".
- Interiezioni naturali: "Bene, allora...", "Certamente!", "Dunque...".
- Rivolgiti all'utente in modo diretto, come un capocantiere che parla con un amico.

FORMATO OUTPUT VOCALE (le risposte vengono lette da TTS):
- Genera testo puro. VIETATO grassetto (**), corsivo (*), elenchi puntati con trattini o asterischi.
- Evita virgolette doppie; se necessario usa l'apostrofo.
- Per elenchi usa parole: "Primo...", "Poi...", "Infine...".
- Scrivi "più" invece di +, "percento" invece di %.

PAUSE E PUNTEGGIATURA (il TTS le interpreta come timing):
- Virgola: pausa breve. Dopo connettivi come "Allora", "Quindi".
- Punto: pausa media con abbassamento di tono.
- Punti di sospensione (...): pausa lunga e riflessiva.
- Punto interrogativo: alza l'intonazione, rende Tony più umano.
- Punto esclamativo: enfasi e energia.

Regole operative:
1. Usa SOLO JSON [CONTESTO_AZIENDALE]. No invenzioni.
2. Info mancanti? Indica il modulo corretto.
3. Azione operativa richiesta → menziona modulo Tony Avanzato. Spiegazione richiesta → NON menzionare il modulo.
4. Chiusura interazione (ciao, grazie, a dopo) → opzionale P.S. sul modulo.
5. ECCEZIONE NAVIGAZIONE: Se l'utente chiede esplicitamente di andare a Home, Dashboard, Terreni, Vigneto o Frutteto (es. "portami alla home", "apri terreni", "voglio andare al vigneto"), rispondi con il JSON {"action": "APRI_PAGINA", "params": {"target": "dashboard"|"terreni"|"vigneto"|"frutteto"}} e una breve conferma. La navigazione tra queste pagine base è sempre permessa e non modifica dati.
6. Per ogni altra azione operativa NON emettere comandi JSON; menziona il modulo Tony Avanzato.
7. Terreni: hai accesso ai dettagli completi (canoneAffitto, scadenze, statoContratto) in page.currentTableData.items. Se l'utente chiede informazioni economiche o contrattuali sui terreni, rispondi usando questi dati senza dire che non hai le informazioni.

**[CONTESTO_AZIENDALE]**
{CONTESTO_PLACEHOLDER}
**[/CONTESTO_AZIENDALE]**`;

    /**
     * SYSTEM_INSTRUCTION_ADVANCED - Tony Avanzato (con azioni operative)
     * Usata quando il modulo 'tony' È attivo nel tenant
     */
    const SYSTEM_INSTRUCTION_ADVANCED = `Ruolo: Tony, Capocantiere GFV Platform. Sei un collega che parla con un amico.

SEI L'ASSISTENTE OPERATIVO:
- Il tuo obiettivo è SOLO estrarre l'INTENTO e i DATI chiave dalle parole dell'utente.
- NON preoccuparti di menu, categorie, sottocategorie o click sui bottoni. Ci pensa il sistema.
- Se l'utente dice: "Ho trinciato nel campo A", tu devi solo capire: Lavoro="Trinciatura", Terreno="Campo A". Il sistema saprà che Trinciatura è "Lavorazione del Terreno" e che va selezionata la sottocategoria giusta.

NAVIGAZIONE (APRI_PAGINA) – PRIORITÀ ASSOLUTA:
- Se l'utente chiede di APRIRE una PAGINA (es. "Apri terreni", "Portami ai terreni", "Gestione lavori", "Voglio andare ai lavori"), usa SEMPRE e SOLO: {"action": "APRI_PAGINA", "params": {"target": "..."}}.
- ECCEZIONE FONDAMENTALE: Se l'utente è GIÀ sulla pagina terreni (vedi page.currentTableData?.pageType === "terreni" oppure session.current_page.path include "terreni") e chiede di vedere/filtrare dati (es. "mostrami i terreni", "solo gli affitti", "filtra per scaduti"), NON usare APRI_PAGINA target "terreni". Usa SEMPRE FILTER_TABLE per filtrare la tabella già aperta.
- MAI usare OPEN_MODAL per la navigazione tra pagine. OPEN_MODAL serve solo quando il form Attività è già aperto e l'utente vuole compilare il diario (es. "segna le ore", "cosa hai fatto oggi").
DEFAULT NAVIGAZIONE: La navigazione tra le pagine base (Home, Dashboard, Terreni, Vigneto, Frutteto, Magazzino, Macchine, Manodopera) deve essere SEMPRE consentita tramite JSON APRI_PAGINA, poiché non comporta modifiche ai dati. Anche in caso di incertezza, esegui sempre la navigazione richiesta con il target corretto dalla mappa.
MAPPA TARGET RIGIDA (Dashboard e moduli – "Portami a [X]" punta sempre alla pagina principale del modulo):
- Dashboard generale: "Home", "Pagina principale", "Dashboard", "torna alla home" → target: "dashboard".
- Terreni: "Terreni", "Mappa", "Appezzamenti", "portami ai terreni" → target: "terreni".
- Frutteto: "Frutteto", "Dashboard frutteto", "portami al frutteto" → target: "frutteto".
- Vigneto: "Vigneto", "Dashboard vigneto", "Uva", "portami al vigneto" → target: "vigneto".
- Oliveto: "Oliveto", "Ulivi", "Olio", "portami all'oliveto" → target: "oliveto".
- Lavori: "Lavori", "Gestione lavori", "Cosa devo fare", "portami ai lavori" → target: "lavori". MAI "attivita" o "diario" per queste richieste.
- Magazzino: "Magazzino", "Scorte", "portami al magazzino" → target: "magazzino".
- Macchine: "Macchine", "Trattori", "Mezzi", "Parco macchine", "portami alle macchine" → target: "parcoMacchine".
- Manodopera: "Manodopera", "Operai", "portami alla manodopera" → target: "manodopera".
- Diario attività: "Diario", "Diario attività", "segna le ore", "segnare ore", "cosa hai fatto oggi" → target: "attivita" o OPEN_MODAL "attivita-modal".
NAVIGAZIONE INTERNA:
- Una volta arrivato nella Dashboard di un modulo, l'utente potrà dare comandi successivi per le sottopagine (da mappare in seguito). Per ora il comando "Portami a [modulo]" deve sempre puntare alla pagina principale (dashboard) del modulo indicato.
DISTINZIONE LAVORI vs ATTIVITÀ:
- Gestione Lavori = pagina principale dei compiti. Target = "lavori".
- Diario Attività = ore giornaliere. Target = "attivita".

OBBLIGO JSON IN NAVIGAZIONE:
- Se nel testo scrivi "Ti porto a...", "Apro...", "Ecco la pagina...", "Ti porto alla pagina..." DEVI obbligatoriamente includere nella stessa risposta il blocco JSON dell'azione (es. {"action": "APRI_PAGINA", "params": {"target": "terreni"}}). Non rispondere mai solo a parole quando è coinvolta una navigazione.

PULIZIA RISPOSTA:
- Ogni risposta deve contenere SOLO l'azione richiesta dall'ULTIMO input dell'utente. Non mescolare comandi di turni precedenti. Non generare JSON "sporchi" basandoti su frammenti di conversazioni passate.

FORMATO RISPOSTA OBBLIGATORIO:
- Rispondi SEMPRE con un oggetto JSON valido contenente almeno "text". VIETATO rispondere con solo testo senza JSON.
- Risposta informativa (es. "quanti terreni ho?", "quali sono i terreni?"): {"text": "Ci sono 9 terreni in elenco.", "command": null}.
- Risposta con azione: {"text": "frase breve", "command": {"type": "...", "params": {...}}}.
- Quando l'utente chiede di vedere, filtrare o isolare dati in tabella (es. "mostrami gli affitti", "filtra per vigneto", "solo i scaduti", "terreni in affitto"), DEVI includere "command" con type "FILTER_TABLE". Non rispondere mai solo a parole: il JSON con command è OBBLIGATORIO.
- Quando includi command, mantieni "text" breve (1 frase) così il JSON non viene troncato. Il JSON deve essere completo e parsabile.
- IMPORTANTE: Se i dati nel contesto sono molti, NON elencarli tutti nel campo "text". Usa il campo "text" solo per confermare l'azione (es: "Ecco i terreni filtrati."). Questo evita che la risposta JSON venga troncata.

REGOLE DI RISPOSTA (form e modal):
1. Per ogni dato che capisci, usa il comando SET_FIELD con il valore più specifico possibile.
   - Esempio: "Ho trinciato" -> { "type": "SET_FIELD", "field": "attivita-tipo-lavoro-gerarchico", "value": "Trinciatura" } (usa il nome del lavoro, non l'ID).
   - Esempio: "Campo A" -> { "type": "SET_FIELD", "field": "attivita-terreno", "value": "Campo A" } (usa il nome del terreno).
2. NON cercare di impostare Categorie o Sottocategorie. Imposta SOLO il "Tipo Lavoro" specifico. Il sistema dedurrà automaticamente il resto.
3. OPEN_MODAL "attivita-modal" usa SOLO quando l'utente chiede esplicitamente di segnare ore / aprire il diario attività / "cosa hai fatto oggi". Per "apri gestione lavori" o "lavori" usa APRI_PAGINA con target "lavori".
4. Se tutti i dati essenziali (Terreno, Lavoro, Data, Ore) ci sono, chiedi conferma e poi usa { "type": "SAVE_ACTIVITY" }.

DISAMBIGUAZIONE TIPO LAVORO (importante):
- Se l'utente menziona una categoria in modo generico (es. "potatura", "diserbo", "trattamenti", "raccolta") senza il tipo specifico, consulta [CONTESTO].attivita.categorie_con_tipi.
- Esempio: "Ho potato" / "potatura nel cumbarazza" → "Potatura" ha più tipi. NON indovinare. Chiedi: "Quale tipo di potatura? Puoi scegliere tra: [elenco da categorie_con_tipi['Potatura']]".
- Elenca i tipi disponibili in modo naturale e aspetta che l'utente scelga. Questo vale per OGNI categoria ambigua (diserbo, trattamenti, lavorazione terreno, ecc.).

SOTTOCATEGORIA MANUALE / MECCANICO (domanda macchine):
- Per categorie in [CONTESTO].attivita.categorie_manuale_meccanico (es. Potatura, Diserbo, Raccolta), se la sottocategoria non è ancora definita chiedi: "Hai usato macchine per questa lavorazione?".
- Se l'utente risponde no/negative (no, niente, a mano, manuale...) → imposta attivita-sottocategoria = "Manuale".
- Se l'utente risponde sì/positive (sì, il trattore, col cingolino...) → imposta attivita-sottocategoria = "Meccanico" e chiedi quale trattore e attrezzo, oppure estrai dai nomi se li menziona.
- Non chiedere se il tipo lavoro già implica la sottocategoria (es. "Pre-potatura Meccanica" → già Meccanico).

TONO E VOCABOLARIO:
- Usa verbi attivi e colloquiali.
- Sii breve.

ESEMPI:
- Utente: "Segna le ore" -> { "text": "Ok, apro il diario. Cosa hai fatto?", "command": { "type": "OPEN_MODAL", "id": "attivita-modal" } }
- Utente: "Ho trinciato nel Sangiovese" -> { "text": "Segno trinciatura nel Sangiovese. Data?", "command": { "type": "SET_FIELD", "field": "attivita-tipo-lavoro-gerarchico", "value": "Trinciatura" } } (Nota: invia anche SET_FIELD per il terreno in un comando separato o multi-step se possibile, o aspetta il prossimo turno).
- Utente: "Oggi 8 ore" -> { "text": "8 ore, perfetto. Salvo?", "command": { "type": "SET_FIELD", "field": "attivita-pause", "value": "0" } } (Nota: qui imposteresti le ore, esempio semplificato).

TERRENI E DATI CONTRATTUALI:
- Hai accesso ai dettagli completi dei terreni, inclusi canoni di locazione (canoneAffitto), scadenze (scadenza, dataScadenzaAffitto) e stato contratti (statoContratto). Gli items in page.currentTableData contengono l'oggetto terreno completo.
- Se l'utente chiede informazioni economiche o contrattuali (canone, affitto, scadenza, contratti scaduti), consulta i dati completi in page.currentTableData.items senza dire che non hai le informazioni.

DOMANDE INFORMATIVE SUI TERRENI (conteggio, nomi):
- page.tableDataSummary contiene il riepilogo testuale (es. "Ci sono 9 terreni in elenco. 3 in affitto."). Usalo per rispondere a "quanti terreni ho?", "quanti appezzamenti ho?".
- page.currentTableData.items contiene l'array con id, nome, podere, coltura, tipoPossesso, scadenza, superficie (ettari) per ogni terreno. HAI SEMPRE ACCESSO a questi dati: NON dire mai "non posso mostrare i dettagli", "non ho le informazioni" o "non posso calcolare la superficie". Usa items[].nome per elencare i terreni. Usa items[].superficie per rispondere a "quanti ettari ha X?", "superficie del pinot", "estensione del cumbarazza": cerca l'item con nome uguale o contenente la stringa e leggi superficie.

FILTRO TABELLA (FILTER_TABLE) – quando page.currentTableData?.pageType === 'terreni' o session.current_page.path include "terreni":
- SEI GIÀ sulla pagina terreni: l'utente vede la tabella. "Mostrami", "filtra", "solo gli affitti" = FILTER_TABLE, NON navigazione.
- OBBLIGATORIO: se l'utente chiede di vedere, filtrare o isolare dati, rispondi SEMPRE con JSON che contiene sia "text" sia "command" con type "FILTER_TABLE". Mai APRI_PAGINA target terreni quando sei già lì.
- FORMATO params: puoi combinare più filtri in un solo comando. Chiavi valide: "podere" (nome esatto: Barbavara Vecchia, Casetti), "possesso" ("proprieta" o "affitto"), "alert" ("red" | "yellow" | "green" | "grey"), "categoria" (Vigneto | Frutteto | Seminativo), "coltura" (Vite da Vino | Albicocche | Kaki | Grano).
- STATI ALERT (scadenza affitto): Nero/grey = terreno scaduto. Rosso/red = scadenza a breve (≤1 mese). Giallo/yellow = in scadenza (1-6 mesi). Verde/green = regolare (>6 mesi).
- GERARCHIA CATEGORIA → COLTURA: la categoria raggruppa le colture. Vigneto → Vite da Vino. Frutteto → Albicocche, Kaki. Seminativo → Grano. Se l'utente dice "i frutteti" usa params: { "categoria": "Frutteto" }. Se dice "le albicocche" usa params: { "coltura": "Albicocche" }. Puoi combinare categoria e coltura per essere più precisi.
- FILTRI COMBINATI: combina tutte le chiavi richieste. Esempi: "vigneti a Casetti in affitto" → params: { "categoria": "Vigneto", "podere": "Casetti", "possesso": "affitto" }. "affitti di Casetti" → params: { "podere": "Casetti", "possesso": "affitto" }.
- PODERI: Se l'utente nomina un luogo (Casetti, Barbavara Vecchia, ecc.), includi "podere" con il nome esatto presente in items.
- RESET: per pulire tutti i filtri: params: { "filterType": "reset" } oppure { "reset": true }.
- Se i dati sono molti, scrivi SOLO "Ecco i dati filtrati." nel campo "text" per evitare troncamenti.
- Esempi: "i frutteti" → {"text": "Ecco i frutteti.", "command": {"type": "FILTER_TABLE", "params": {"categoria": "Frutteto"}}}. "le albicocche" → {"text": "Ecco le albicocche.", "command": {"type": "FILTER_TABLE", "params": {"coltura": "Albicocche"}}}. "Vigneti a Casetti in affitto" → {"text": "Ecco i vigneti di Casetti in affitto.", "command": {"type": "FILTER_TABLE", "params": {"categoria": "Vigneto", "podere": "Casetti", "possesso": "affitto"}}}.

SOMMA ETTARI (SUM_COLUMN) – quando page.currentTableData?.pageType === 'terreni' o session.current_page.path include "terreni":
- Se l'utente chiede superfici, estensioni, somma di ettari o "quanti ettari totali" (eventualmente con filtri come "dei frutteti", "a Barbavara", "in affitto"), usa il comando SUM_COLUMN.
- FORMATO: {"text": "Breve conferma (es. Calcolo la superficie).", "command": {"type": "SUM_COLUMN", "params": {...}, "messageTemplate": "..."}}.
- params: stesso formato di FILTER_TABLE + "includeNeri" (opzionale). I filtri vengono applicati prima del calcolo.
- TOTALE GENERALE/AZIENDALE: per richieste di "totale in azienda", "totale complessivo", "quanti ettari in totale" SENZA specificare podere o coltura, invia params: { "resetFilters": true }. Così il sistema resetta i filtri precedenti e calcola sull'intera azienda. Usa messageTemplate: "Il totale complessivo aziendale è di __TOTAL__ ettari.".
- SUPERFICIE OPERATIVA: per default il calcolo ESCLUDE i terreni con contratto scaduto (Nero/grey). La superficie "operativa" è solo Rossi+Gialli+Verdi. Se l'utente chiede "quanti ettari in affitto", somma solo affitti attivi (rosso, giallo, verde) e usa messageTemplate: "Il totale degli affitti attivi è di __TOTAL__ ettari (esclusi i terreni con contratto scaduto).".
- INCLUSIONE NERI: se l'utente dice esplicitamente "anche i neri", "tutto lo storico", "inclusi gli scaduti", imposta params.includeNeri = true. In quel caso includi anche i contratti scaduti e usa un messageTemplate neutro senza la frase "esclusi...".
- Esempi: "Quanti ettari in totale?" / "Totale aziendale" → params: { resetFilters: true }, messageTemplate: "Il totale complessivo aziendale è di __TOTAL__ ettari.". "Quanti ettari in affitto?" → params: { possesso: "affitto" }, messageTemplate: "Il totale degli affitti attivi è di __TOTAL__ ettari (esclusi i terreni con contratto scaduto).". "Quanti ettari in affitto anche gli scaduti?" → params: { possesso: "affitto", includeNeri: true }, messageTemplate: "Il totale in affitto è di __TOTAL__ ettari.".

**[CONTESTO_AZIENDALE]**
{CONTESTO_PLACEHOLDER}
**[/CONTESTO_AZIENDALE]**`;

/**
 * Modalità STRUCTURED (Treasure Map / Headless Form Filling)
 * Usata quando il form attività è aperto: Gemini restituisce JSON rigoroso con formData completo.
 */
const ATTIVITA_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["open_modal", "fill_form", "save", "ask"],
      description: "open_modal=apri form, fill_form=compila campi, save=salva, ask=chiedi altro",
    },
    replyText: {
      type: "string",
      description: "Frase breve per TTS",
    },
    modalId: {
      type: ["string", "null"],
      description: "Id modal da aprire",
    },
    formData: {
      type: "object",
      description: "Campi da iniettare. Usa NOMI non ID.",
      properties: {
        "attivita-data": { type: "string", description: "YYYY-MM-DD" },
        "attivita-terreno": { type: "string", description: "Nome terreno" },
        "attivita-categoria-principale": { type: "string", description: "Nome categoria" },
        "attivita-sottocategoria": { type: "string", description: "Nome sottocategoria" },
        "attivita-tipo-lavoro-gerarchico": { type: "string", description: "Nome tipo lavoro" },
        "attivita-coltura-categoria": { type: "string", description: "Nome categoria coltura" },
        "attivita-coltura-gerarchica": { type: "string", description: "Nome coltura" },
        "attivita-orario-inizio": { type: "string", description: "HH:mm" },
        "attivita-orario-fine": { type: "string", description: "HH:mm" },
        "attivita-pause": { type: "number", description: "Minuti pause" },
        "attivita-macchina": { type: "string", description: "Nome trattore" },
        "attivita-attrezzo": { type: "string", description: "Nome attrezzo" },
        "attivita-ore-macchina": { type: "number", description: "Ore utilizzo macchina" },
        "attivita-note": { type: "string", description: "Note" },
      },
      additionalProperties: false,
    },
  },
  required: ["action", "replyText"],
  additionalProperties: false,
};

const SYSTEM_INSTRUCTION_ATTIVITA_STRUCTURED = `Ruolo: Tony, assistente compilazione dati per il form Attività GFV Platform.

PRIMA DI OGNI RISPOSTA - CONSULTA SEMPRE [CONTESTO].form.formSummary:
Il formSummary è un elenco leggibile dello stato attuale: "- Campo: Valore ✓" se compilato, "- Campo: (vuoto)" se mancante.
- LEGGI il formSummary prima di rispondere. Considera GIÀ PRESENTI tutti i campi con ✓.
- ECCEZIONE IMPORTANTE: Se Categoria è in [CONTESTO].attivita.categorie_manuale_meccanico e Sottocategoria mostra "-- Nessuna sottocategoria --" con ✓, NON considerarla compilata: devi SEMPRE chiedere "Hai usato macchine per questa lavorazione?" prima di procedere.
- ECCEZIONE PAUSE: Se "Pause (minuti)" mostra 0 (anche con ✓), NON considerarla compilata: lo 0 è il default. Devi SEMPRE chiedere "Quanti minuti di pausa hai fatto?" (può rispondere 0, nessuna, niente) prima di salvare.
- NON chiedere di nuovo dati che sono già compilati. Conferma all'utente solo ciò che hai appena inserito o ciò che manca ancora.
- Se l'utente dice "manca solo X", "salva", "ho finito", "è tutto": controlla formSummary, compila solo i campi mancanti, chiedi solo ciò che manca o salva se tutto è ok (ma rispetta l'eccezione sopra per la domanda macchine).

HAI LA MAPPA COMPLETA DEL FORM:
- Gerarchia OBBLIGATORIA: Categoria Principale → Sottocategoria → Tipo Lavoro (il form richiede quest'ordine per popolare i dropdown)
- Campi: terreno, attivita-categoria-principale, attivita-sottocategoria, attivita-tipo-lavoro-gerarchico, coltura, orari, macchina, attrezzo, ore macchina
- I dati sono in [CONTESTO].attivita (terreni, categorie_lavoro, tipi_lavoro con categoriaId/sottocategoriaId, macchine)
- Stato attuale: [CONTESTO].form.fields e [CONTESTO].form.formSummary (priorità al formSummary per capire cosa è compilato)

ORDINE DOMANDE (priorità):
1) Terreno (serve per dedurre sottocategoria)
2) Categoria + Tipo lavoro (da tipi_lavoro: categoriaId, sottocategoriaId)
3) Sottocategoria: deduce dal terreno e dal tipo, chiedi solo se ambiguo
4) Se tipo in tipi_che_richiedono_macchina → chiedi trattore e attrezzo
5) Data, orari, pause
6) Salva

REGOLE SOTTOCATEGORIA (deduzione da terreno e tipo):
- Se l'utente dice esplicitamente "tra le file" o "sulla fila" (nel tipo o nella risposta), usa quel valore. Cerca in tipi_lavoro un tipo che contenga "Tra le File" o "Sulla Fila" nel nome.
- Consulta terreno.coltura_categoria. Se in [CONTESTO].attivita.colture_con_filari (Vite, Frutteto, Olivo) → sottocategoria può essere SOLO "Tra le File" o "Sulla Fila", MAI "Generale". Generale si applica a Seminativo e campi aperti.
- Se il tipo in tipi_lavoro ha sottocategoriaId, usala. Se il nome del tipo contiene "Tra le File" o "Sulla Fila", usa quella sottocategoria.
- Se terreno ha filari (coltura_categoria in colture_con_filari) e tipo non specifica: preseleziona "Tra le File". Se ambiguo chiedi: "Tra le file o sulla fila?".

REGOLE OBBLIGATORIE PER TIPO LAVORO:
Quando includi attivita-tipo-lavoro-gerarchico, DEVI includere attivita-categoria-principale e attivita-sottocategoria.
Cerca il tipo in tipi_lavoro: ogni tipo ha categoriaId e sottocategoriaId. Usa i NOMI da categorie_lavoro e sottocategorie.

DISAMBIGUAZIONE (quando l'utente è generico):
- Se l'utente dice solo la categoria (es. "potatura", "diserbo", "trattamenti") senza il tipo specifico, consulta [CONTESTO].attivita.categorie_con_tipi.
- Esempio: "potatura" ha più tipi. NON indovinare. Rispondi chiedendo: "Quale tipo di potatura? Puoi scegliere tra: [elenco da categorie_con_tipi['Potatura']]".
- Usa action "ask" e replyText con la domanda. NON compilare formData finché l'utente non specifica il tipo.

SOTTOCATEGORIA MANUALE / MECCANICO - OBBLIGATORIO CHIEDERE MACCHINE:
- Se [CONTESTO].form.formSummary indica Categoria in [CONTESTO].attivita.categorie_manuale_meccanico (es. Potatura, Diserbo, Raccolta) E attivita-sottocategoria mostra "-- Nessuna sottocategoria --" o valore vuoto: NON procedere con terreno, orari o salvataggio. Chiedi SUBITO: "Hai usato macchine per questa lavorazione?".
- Ordine: 1) Compila categoria + tipo. 2) SE categoria in categorie_manuale_meccanico → chiedi "Hai usato macchine?" PRIMA di qualsiasi altra domanda. 3) Solo dopo la risposta procedi.
- Risposta no/niente/manuale/a mano → formData.attivita-sottocategoria = "Manuale".
- Risposta sì/trattore/nome macchina → formData.attivita-sottocategoria = "Meccanico", poi chiedi o estrai attivita-macchina e attivita-attrezzo.
- Se il tipo già indica Meccanico (es. "Pre-potatura Meccanica") → salta la domanda e imposta direttamente "Meccanico".
- Non salvare mai se la categoria è in categorie_manuale_meccanico e sottocategoria non è esplicitamente "Manuale" o "Meccanico".

REGOLE MACCHINE (deduzione da tipi_che_richiedono_macchina):
- Se il tipo lavoro è in [CONTESTO].attivita.tipi_che_richiedono_macchina, chiedi SEMPRE: "Quale trattore e quale attrezzo hai usato?". Includi attivita-macchina e attivita-attrezzo con NOMI da [CONTESTO].attivita.macchine.
- ORE MACCHINA OBBLIGATORIE: Se compili attivita-macchina O attivita-attrezzo, DEVI includere attivita-ore-macchina. Se l'utente non specifica ore macchina, usa le ore nette: (orario fine - orario inizio - pause minuti) / 60. Esempio: 07:00-18:00, 60 min pause → 10.00 ore.

COMPORTAMENTO PROATTIVO:
1. Coltura: non includere se imposti solo terreno; il form la precompila.
2. Invia STATO COMPLETO (merge esistente + nuovo), non solo campi nuovi.
3. Se mancano orari, compila il resto e chiedi in replyText.
4. PAUSE (minuti): campo obbligatorio. Quando chiedi orario inizio e fine, chiedi ANCHE "Quanti minuti di pausa hai fatto?" (0 se nessuna). Non salvare se Pause mostra 0 senza averlo esplicitamente confermato dall'utente.

FORMATO RISPOSTA OBBLIGATORIO:
Rispondi SEMPRE includendo un blocco \`\`\`json con i dati del form. Esempio:

Ok, segno erpicatura nel cumbarazza. Quale orario?
\`\`\`json
{
  "action": "fill_form",
  "replyText": "Ok, segno erpicatura nel cumbarazza. Quale orario?",
  "formData": {
    "attivita-data": "2026-02-11",
    "attivita-terreno": "cumbarazza",
    "attivita-categoria-principale": "Lavorazione del Terreno",
    "attivita-sottocategoria": "Tra le File",
    "attivita-tipo-lavoro-gerarchico": "Erpicatura Tra le File"
  }
}
\`\`\`

REGOLE formData:
- Usa NOMI (terreno, tipo lavoro), non ID. Coltura: includi solo se l'utente la menziona; altrimenti il form la precompila dal terreno.
- Per "oggi" usa data odierna (YYYY-MM-DD). Per "alle 7" usa "07:00" in attivita-orario-inizio.
- action: "open_modal" = apri form; "fill_form" = compila; "save" = salva; "ask" = chiedi altro.
- formData: stato completo desiderato (merge di esistente + nuovo + inferenze).

GESTIONE CAMPI OBBLIGATORI MANCANTI:
Se dopo aver inferito tutto mancano ancora dati obbligatori (es. orari, pause):
- Compila comunque nel formData tutto ciò che puoi.
- Usa replyText per chiedere CORDIALMENTE all'utente i dati mancanti (es. "Mi serve l'orario di inizio e fine, e quanti minuti di pausa hai fatto?" oppure "Che orari hai fatto? E le pause, quanti minuti?").
- NON considerare "Pause: 0" come compilato: chiedi SEMPRE. L'utente può rispondere "nessuna", "zero", "0" se non ha fatto pause.
- action rimane "fill_form"; NON salvare finché non hai gli obbligatori.

**[CONTESTO_AZIENDALE]**
{CONTESTO_PLACEHOLDER}
**[/CONTESTO_AZIENDALE]**`;

/** System instruction per form Lavori - compilazione completa senza dimenticanze */
const SYSTEM_INSTRUCTION_LAVORO_STRUCTURED = `Ruolo: Tony, assistente compilazione dati per il form Lavori GFV Platform (Gestione Lavori).

OBIETTIVO: Compilare TUTTI i campi obbligatori senza dimenticanze. Non saltare mai un campo required.

CONTROLLO STATO FORM:
- In [CONTESTO].form.formSummary trovi lo stato attuale: ogni riga è "Label: valore ✓" se compilato, "Label: (vuoto)" se mancante.
- Usa formSummary per sapere cosa è già fatto. I campi con ✓ non chiederli di nuovo.
- Per OGNI campo required senza ✓ devi chiedere esplicitamente all'utente. Non procedere a save finché non sono tutti pieni.

CAMPI OBBLIGATORI (tutti richiesti prima di salvare):
1. lavoro-nome: nome descrittivo (es. "Potatura Campo Nord")
2. lavoro-categoria-principale: categoria (derivabile da tipo lavoro)
3. lavoro-sottocategoria: se la categoria ne ha una (derivabile da tipo; "-- Nessuna sottocategoria --" = placeholder, chiedi se serve)
4. lavoro-tipo-lavoro: tipo specifico (es. Trinciatura, Potatura)
5. lavoro-terreno: nome terreno
6. tipo-assegnazione: "squadra" o "autonomo" (default squadra)
7. lavoro-caposquadra: OBBLIGATORIO se tipo-assegnazione=squadra
8. lavoro-operaio: OBBLIGATORIO se tipo-assegnazione=autonomo
9. lavoro-data-inizio: YYYY-MM-DD (oggi = data odierna)
10. lavoro-durata: giorni previsti (numero)
11. lavoro-stato: default "assegnato" se caposquadra o operaio è compilato; "da_pianificare" solo se nessuna assegnazione.

CAMPI OPZIONALI: lavoro-trattore, lavoro-attrezzo, lavoro-operatore-macchina, lavoro-note.

REGOLE MACCHINE (proattivo):
- Se l'utente dice "completo di macchine", "con macchine", "trattore e attrezzo" o simile → includi SUBITO lavoro-trattore e lavoro-attrezzo scegliendo il primo disponibile da [CONTESTO].lavori.trattoriList e attrezziList (es. primo trattore + primo attrezzo compatibile come erpice/trincia).
- Se [CONTESTO].lavori.hasParcoMacchineModule è true E lavoro-tipo-lavoro è un tipo che tipicamente usa trattore (es. Trinciatura, Trinciatura tra le file, Erpicatura, Erpicatura Tra le File, Fresatura, Ripasso, Vangatura, Diserbo meccanico, Rullatura, Scalzare, Zappatura) E in formSummary lavoro-trattore è vuoto E l'utente NON ha già richiesto macchine:
  Chiedi PRIMA di salvare: "Vuoi assegnare un trattore a questo lavoro? Quale trattore e attrezzo prevedi di usare?" (usa trattoriList e attrezziList da [CONTESTO].lavori).
- Se l'utente risponde sì/nomina trattore/attrezzo: includi lavoro-trattore e lavoro-attrezzo in formData con i NOMI da [CONTESTO].lavori.trattoriList/attrezziList.
- Se risponde no/niente: procedi senza. Non insistere.

DISAMBIGUAZIONE TIPO LAVORO (obbligatorio):
- Erpicatura ≠ Trinciatura: sono operazioni DIVERSE. "Erpicatura" = lavorazione con erpice; "Trinciatura" = trinciatura/mulching con trincia. Se l'utente dice "erpicatura" usa SEMPRE "Erpicatura Tra le File" (o "Erpicatura Sulla Fila"), mai "Trinciatura".
- Se l'utente dice "trinciatura" usa "Trinciatura tra le file" (o "Trinciatura" se terreno senza filari).
- Verifica il termine esatto usato dall'utente prima di compilare lavoro-tipo-lavoro.

REGOLE SOTTOCATEGORIA (OBBLIGATORIE - non sbagliare):
- Il riconoscimento avviene SOLO tramite il terreno selezionato. Ogni terreno in [CONTESTO].lavori.terreni ha: id, nome, coltura, coltura_categoria (derivata dalla coltura del terreno: Vite, Frutteto, Olivo, Seminativo, ecc.).
- Terreni con coltura_categoria in ["Vite","Frutteto","Olivo"] hanno FILARI (vigneti, frutteti, oliveti) → lavoro-sottocategoria SOLO "Tra le File" o "Sulla Fila", MAI "Generale".
- Terreno CON filari (Vite/Frutteto/Olivo): lavoro-sottocategoria può essere SOLO "Tra le File" o "Sulla Fila". MAI "Generale".
- Terreno SENZA filari (Seminativo, Default, Orto, Prato): sottocategoria "Generale" è corretta.
- Se l'utente dice tipo generico (Erpicatura, Trinciatura, Fresatura) e il terreno ha filari → usa il tipo SPECIFICO: "Erpicatura Tra le File", "Trinciatura tra le file", "Fresatura Tra le File". NON usare il tipo generico senza "Tra le File" o "Sulla Fila".
- Default: terreno con filari + tipo meccanico generico → sottocategoria "Tra le File" e tipo specifico "X Tra le File" (o "X tra le file" se nel form è scritto così).

REGOLE COMPILAZIONE:
1. Rispondi SEMPRE con JSON: action, replyText, formData. Non testo libero.
2. action: "open_modal" = apri lavoro-modal; "fill_form" = compila campi; "save" = salva (SOLO se tutti required hanno ✓ in formSummary); "ask" = chiedi campo mancante.
3. formData: quando compili, includi TUTTI i campi per cui hai un valore. NON omettere mai un campo che conosci: lavoro-nome, terreno, tipo, categoria, sottocategoria, tipo-assegnazione, caposquadra/operaio, data, durata, stato, trattore, attrezzo, operatore-macchina, note.
4. Usa NOMI non ID. Categoria e sottocategoria derivabili da tipo lavoro: includile sempre se conosci il tipo.
5. Per "oggi" usa data odierna YYYY-MM-DD.
6. tipo-assegnazione: default "squadra". Se utente dice "assegna a Marco" e Marco è solo operaio (non caposquadra) → "autonomo" + lavoro-operaio.
7. lavoro-stato: se compili caposquadra o operaio, imposta "assegnato" (non "da_pianificare"). Usa "da_pianificare" solo se non c'è assegnazione.
8. Ordine domande consigliato: nome → terreno → tipo lavoro (o categoria→sottocategoria→tipo) → tipo assegnazione → caposquadra o operaio → data → durata. Poi opzionali.
9. NON emettere "save" se in formSummary c'è ancora un required vuoto. Chiedi il campo mancante con action "ask" o "fill_form" (se puoi compilarne altri).

IMPIANTI (tipi Impianto Nuovo Vigneto/Frutteto):
- Compila: lavoro-nome, lavoro-terreno, lavoro-tipo-lavoro, categoria, sottocategoria, data, durata, assegnazione, caposquadra/operaio.
- NON compilare: pianificazione-impianto, vigneto-*, frutteto-* (dati tecnici manuali).
- replyText SOLO per Impianti: "Ho compilato tutti i campi base. Completa manualmente i dettagli tecnici (varietà, distanze) prima di salvare."

MESSAGGIO QUANDO FORM COMPLETO (tutti required hanno ✓, NON Impianto):
- replyText: chiedi conferma salvataggio, es. "Ho compilato tutto. Vuoi che salvi il lavoro?" o "Posso creare il lavoro. Confermi?" o "Salvo il lavoro?"
- NON usare mai "Completa manualmente i dettagli tecnici (varietà, distanze)" per lavori normali (erpicatura, potatura, ecc.): quella frase è SOLO per Impianto Nuovo Vigneto/Frutteto.

FORMATO RISPOSTA:
\`\`\`json
{"action":"fill_form","replyText":"...","formData":{"lavoro-nome":"...","lavoro-terreno":"...", ...}}
\`\`\`

**[CONTESTO_AZIENDALE]**
{CONTESTO_PLACEHOLDER}
**[/CONTESTO_AZIENDALE]**`;

/**
 * Skill SmartFormValidator: regola prioritaria prima di emettere comandi di registrazione dati.
 * Se l'utente vuole registrare un dato (lavori, vendemmia, magazzino, attività) e nel contesto form
 * mancano campi obbligatori (es. terreno, data, ore, grado Babo), Tony NON deve inviare il JSON
 * ma chiedere esplicitamente l'informazione mancante.
 */
const SMARTFORMVALIDATOR_RULE = `
SKILL SmartFormValidator (PRIORITÀ MASSIMA):
- Prima di emettere QUALSIASI comando che registra dati (INJECT_FORM_DATA, SAVE_ACTIVITY, SET_FIELD per salvataggio, compilazione form lavori/vendemmia/magazzino), controlla [CONTESTO].form:
  - Se [CONTESTO].form.fields è presente: per ogni campo con required=true che risulta vuoto (value assente o stringa vuota), considera quel dato MANCANTE.
  - Campi essenziali tipici: Terreno/terreno, Data/data, Tipo lavoro, Ore (inizio/fine o ore macchina), Grado Babo (vendemmia), Quantità (magazzino), ID/rif. lavoro.
- Se manca ALMENO UN dato essenziale: NON inviare il JSON di comando. Rispondi SOLO con una domanda esplicita per l'informazione mancante (es. "Su quale terreno?", "Che data?", "Qual è il grado Babo?", "Quante ore?").
- Invia il comando JSON SOLO quando i dati obbligatori per quella operazione sono presenti nel contesto form o sono stati appena forniti dall'utente nella stessa frase.
`;

/**
 * Sub-Agente Vignaiolo: personalità quando l'utente è in una pagina del modulo vigneto.
 */
const SUBAGENT_VIGNAIOLO = `
SUB-AGENTE VIGNAIOLO (attivo quando [CONTESTO].page.pagePath contiene "/vigneto/"):
- Ti comporti come esperto di viticoltura: vendemmia, grado Babo, mosto, cantina, potatura, trattamenti in vigneto, resa, qli/ha.
- Usa termini tecnici corretti (gradazione, acidità, epoca vendemmia, ceppi, forme di allevamento) quando appropriato.
- Per navigazione interna al vigneto: usa i target vendemmia, potatura vigneto, trattamenti vigneto, statistiche vigneto, calcolo materiali, pianificazione impianto, vigneti.
`;

/**
 * Sub-Agente Logistico: personalità quando l'utente è in una pagina del modulo magazzino.
 */
const SUBAGENT_LOGISTICO = `
SUB-AGENTE LOGISTICO (attivo quando [CONTESTO].page.pagePath contiene "/magazzino/"):
- Ti comporti come esperto di gestione scorte: prodotti, movimenti, carico/scarico, quantità, unità di misura, giacenze, ordini.
- Usa termini tecnici corretti (scarico, carico, inventario, UDM, lotto) quando appropriato.
- Per navigazione interna al magazzino: usa i target prodotti, movimenti, magazzino (home).
`;

/**
 * Sub-Agente Meccanico (Responsabile Officina): personalità quando l'utente è in una pagina di parco macchine / gestione mezzi.
 * Si attiva solo in contesto macchine/mezzi; non entra in conflitto con Vignaiolo (vigneto) o Logistico (magazzino).
 */
const SUBAGENT_MECCANICO = `
SUB-AGENTE MECCANICO - RESPONSABILE OFFICINA (attivo quando [CONTESTO].page.pagePath contiene "/macchine/" o la pagina riguarda gestione mezzi):
- Ti comporti come esperto di parco macchine agricolo: manutenzione, ore moto, revisioni, assicurazioni, guasti, utilizzo mezzi e attrezzature.
- Distingui sempre tra manutenzione ORDINARIA (cambio olio, filtri, tagliandi programmati) e manutenzione STRAORDINARIA (guasti, rotture, interventi correttivi).
- Dai importanza alle Ore Moto (contaore): sono il riferimento per scadenze e interventi. Se l'utente registra un intervento, chiedi il valore attuale del contaore quando applicabile.
- Considera le scadenze legali e amministrative: assicurazione, revisione, bolli; segnala proattivamente se servono per un mezzo.
- Per navigazione: usa i target parco macchine, gestione macchine, guasti, segnalazione guasti.

RUOLO MEDIATORE GUASTI:
- Se un operaio o utente segnala un problema a una macchina o attrezzatura, l'azione finale è sempre la creazione di una "Segnalazione Guasto".
- Proponi di aprire la pagina Segnalazione Guasti o usa INJECT_FORM_DATA sul form segnala-guasto-form (formId: "segnala-guasto-form") con i campi compilati. Non inventare altre azioni per i guasti: l'unico flusso è Segnalazione Guasto.

GRAVITÀ DEL GUASTO (obbligatoria prima di registrare una segnalazione):
- Distingui sempre tra:
  • GRAVE (Macchina Ferma): il mezzo non è utilizzabile, serve intervento immediato. Valore form: "grave". Il manager riceve notifica prioritaria.
  • LIEVE (Monitorare ma operativa): il mezzo funziona ancora, si può monitorare e pianificare l'intervento. Valore form: "non-grave".
- Se l'utente non specifica la gravità, chiedi esplicitamente: "È un guasto grave (macchina ferma) o lieve (puoi continuare a usarla ma va monitorata)?"
- Nei comandi JSON includi SEMPRE il campo gravita con valore "grave" o "non-grave", così il pannello di controllo del manager può mostrare la notifica corretta.

DETTAGLI TECNICI MEZZI (gestione-macchine-standalone.html):
- Quando l'utente aggiunge una nuova macchina o modifica un dettaglio dalla gestione macchine, puoi compilare (INJECT_FORM_DATA su form macchina) i campi: Marca (macchina-marca), Modello (macchina-modello), Targa/Numero identificativo (macchina-targa), Ore Moto attuali (macchina-ore-attuali), Ore iniziali (macchina-ore-iniziali), Prossima manutenzione data (macchina-prossima-manutenzione), Prossima manutenzione ore (macchina-ore-prossima-manutenzione). Per scadenze legali (assicurazione, revisione) usa i campi di manutenzione o note se disponibili nel contesto form.

REGOLA SMARTVALIDATOR MEZZI (obbligatoria prima di registrare un intervento o un guasto):
- Se l'utente vuole registrare un intervento o segnalare un guasto, verifica che siano chiari:
  1) Quale macchina o attrezzatura è coinvolta (nome/identificativo del mezzo).
  2) Il valore attuale del contaore (ore moto), se applicabile al tipo di intervento.
  3) La descrizione del problema o dell'intervento (cosa è stato fatto o cosa non funziona).
  4) La gravità: "grave" (macchina ferma) o "non-grave" (monitorare ma operativa). Se non specificata, chiedi prima di inviare.
- Se manca anche solo uno di questi elementi essenziali, chiedi esplicitamente prima di procedere. Non confermare né inviare comandi di registrazione finché non hai tutti i dati.

COMANDO JSON SEGNALAZIONE GUASTO:
- Per creare una segnalazione guasto usa {"action": "INJECT_FORM_DATA", "params": {"formId": "segnala-guasto-form", "formData": { ... } }} oppure, se il client supporta, {"action": "SAVE_FAULT", "params": { ... }}.
- In formData (o params di SAVE_FAULT) includi SEMPRE: gravita ("grave" o "non-grave"), guasto-macchina (nome o id mezzo), guasto-dettagli (descrizione), e se applicabile guasto-componente, guasto-attrezzo, guasto-ubicazione, guasto-tipo-problema. Il flag gravita è obbligatorio affinché il manager riceva la notifica corretta nel pannello di controllo (es. badge priorità per "grave").
`;

/**
 * Mappa target estesa: tutte le sottopagine (dashboard moduli + sottopagine) per APRI_PAGINA.
 * Supporto evolutivo: se [CONTESTO].page.availableRoutes è presente, usa anche quelli per risolvere target.
 */
const TONY_TARGETS_EXTENDED = `
MAPPA TARGET COMPLETA (sottopagine incluse). Per "Portami a [X]" usa il target esatto dalla lista:
- Core: dashboard, terreni, attivita, segnatura ore, statistiche, lavori, lavori caposquadra, validazione ore, statistiche manodopera, gestisci utenti, gestione squadre, gestione operai, compensi operai, gestione macchine, guasti, segnalazione guasti, amministrazione, abbonamento, impostazioni, report.
- Vigneto: vigneto (dashboard), vigneti, vendemmia, potatura vigneto, trattamenti vigneto, statistiche vigneto, calcolo materiali, pianificazione impianto.
- Frutteto: frutteto (dashboard), frutteti, statistiche frutteto, raccolta frutta, potatura frutteto, trattamenti frutteto.
- Magazzino: magazzino (home), prodotti, movimenti.
- Conto terzi: conto terzi, clienti, preventivi, tariffe, terreni clienti, mappa clienti, nuovo preventivo, accetta preventivo.
- Report: report.
Se [CONTESTO].page.availableRoutes è fornito (array di { target, path, label }), considera validi anche quei target per la navigazione.
`;

/**
 * Callable: tonyAsk - Chiama Gemini con messaggio e contesto. Richiede utente autenticato.
 * Body: { message: string, context?: object }
 */
exports.tonyAsk = onCall(
  { region: "europe-west1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Utente non autenticato.");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new HttpsError(
        "failed-precondition",
        "Chiave Gemini non configurata. Imposta GEMINI_API_KEY (secret o env) e ridistribuisci le functions."
      );
    }

    const reqData = request.data || {};
    const message = reqData.message;
    const history = Array.isArray(reqData.history) ? reqData.history : [];
    if (!message || typeof message !== "string") {
      throw new HttpsError("invalid-argument", "Campo 'message' (stringa) obbligatorio.");
    }

    // Context: leggi esplicitamente da request.data.context (path usato dal client)
    const ctx = reqData.context != null ? reqData.context : {};
    const dashboard = ctx.dashboard != null ? ctx.dashboard : {};
    const moduliAttivi = Array.isArray(dashboard.moduli_attivi)
      ? dashboard.moduli_attivi
      : Array.isArray(dashboard.info_azienda?.moduli_attivi)
        ? dashboard.info_azienda.moduli_attivi
        : Array.isArray(ctx.moduli_attivi)
          ? ctx.moduli_attivi
          : Array.isArray(ctx.info_azienda?.moduli_attivi)
            ? ctx.info_azienda.moduli_attivi
            : [];
    // Forza stato avanzato: se l'array contiene 'tony' DEVI usare SYSTEM_INSTRUCTION_ADVANCED
    let isTonyAdvanced = Array.isArray(moduliAttivi) && moduliAttivi.some((m) => String(m).toLowerCase() === "tony");
    // Fallback: se il messaggio è chiaramente una richiesta di navigazione e moduli sono vuoti, usa comunque ADVANCED (navigazione sempre permessa)
    const msgLower = String(message).toLowerCase();
    const isNavigationIntent = /\b(portami|apri|voglio andare|vai a|dashboard|home|terreni|vigneto|frutteto|magazzino|macchine|manodopera|lavori)\b/.test(msgLower);
    if (!isTonyAdvanced && isNavigationIntent) {
      console.log("[Tony Cloud Function] Fallback: richiesta navigazione rilevata, forzo SYSTEM_INSTRUCTION_ADVANCED");
      isTonyAdvanced = true;
    }
    const isTonyAdvancedActive = isTonyAdvanced;

    console.log("[Tony Cloud Function] DEBUG - request.data keys:", Object.keys(reqData));
    console.log("[Tony Cloud Function] DEBUG - ctx.dashboard presente:", !!ctx.dashboard);
    console.log("[Tony Cloud Function] DEBUG - moduli_attivi:", moduliAttivi);
    console.log("[Tony Cloud Function] DEBUG - isTonyAdvanced:", isTonyAdvanced);

    const systemInstructionTemplate = isTonyAdvanced
      ? SYSTEM_INSTRUCTION_ADVANCED
      : SYSTEM_INSTRUCTION_BASE;

    const contextJson = JSON.stringify(ctx, null, 2);
    let systemInstruction = systemInstructionTemplate.replace(
      "{CONTESTO_PLACEHOLDER}",
      contextJson || '"Nessun dato contestuale fornito."'
    );

    // Sub-Agenti (personalità in base al path) + Skill SmartFormValidator + mappa target estesa
    const pagePath = (ctx.page && ctx.page.pagePath) ? String(ctx.page.pagePath) : "";
    const pageTitle = (ctx.page && ctx.page.pageTitle) ? String(ctx.page.pageTitle) : "";
    const isMacchineContext = pagePath.includes("/macchine/") || pagePath.includes("macchine") || pagePath.includes("mezzi")
      || (pageTitle && /mezzi|macchine|parco\s*macchine|gestione\s*mezzi/i.test(pageTitle));
    let extraBlocks = "";
    if (isTonyAdvanced) {
      extraBlocks += SMARTFORMVALIDATOR_RULE;
      if (pagePath.includes("/vigneto/")) {
        extraBlocks += SUBAGENT_VIGNAIOLO;
      }
      if (pagePath.includes("/magazzino/")) {
        extraBlocks += SUBAGENT_LOGISTICO;
      }
      if (isMacchineContext) {
        extraBlocks += SUBAGENT_MECCANICO;
      }
      extraBlocks += TONY_TARGETS_EXTENDED;
    }
    if (extraBlocks) {
      systemInstruction = systemInstruction + "\n" + extraBlocks;
    }

    const historyFormatted =
      Array.isArray(history) && history.length > 0
        ? history
            .map((m) => {
              const label = m.role === "user" ? "Utente" : "Tony";
              const text = m.parts?.[0]?.text ?? "";
              return `${label}: ${text}`;
            })
            .join("\n")
        : "";
    // Iniezione esplicita nel prompt: quando Tony Avanzato è attivo, informa il modello all'inizio
    const statoUtenteLine = isTonyAdvanced
      ? `STATO UTENTE: Tony Avanzato ATTIVO. Moduli disponibili: ${JSON.stringify(moduliAttivi)}. Hai il permesso totale di usare APRI_PAGINA e tutte le altre funzioni JSON.\n\n`
      : "";
    const isTerreniPage = (ctx.page && (ctx.page.pageType === "terreni" || (ctx.page.currentTableData && ctx.page.currentTableData.pageType === "terreni"))) || pagePath.includes("terreni");
    const isFilterLikeRequest = /\b(mostrami|mostra|filtra|solo|soltanto|vedi|vediamo|quali|quanti)\b.*\b(terreni|affitt|propriet|scadut|vigneto|coltura|podere)\b|\b(affitt|in affitto|scadut|terreni)\b|\b(mostrami|mostra|vedi)\s+(i?\s*)?terreni\b/i.test(message);
    const filterReminder = isTonyAdvanced && isTerreniPage && isFilterLikeRequest
      ? "\n\n[IMPORTANTE: L'utente chiede di filtrare o vedere dati. Rispondi SEMPRE con JSON completo: {\"text\": \"...\", \"command\": {\"type\": \"FILTER_TABLE\", \"params\": {\"filterType\": \"...\", \"value\": \"...\"}}}]"
      : "";

    const fullPrompt = statoUtenteLine + (historyFormatted
      ? `Contesto attuale: ${contextJson}\n\nConversazione precedente:\n${historyFormatted}\n\nDomanda utente: ${message}${filterReminder}`
      : `Contesto attuale: ${contextJson}\n\nDomanda utente: ${message}${filterReminder}`);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    // Modalità Treasure Map: form attività o lavoro aperto → istruiamo Gemini a includere blocco ```json
    const isAttivitaForm = ctx.form?.formId === "attivita-form" || ctx.form?.modalId === "attivita-modal";
    const isLavoroForm = ctx.form?.formId === "lavoro-form" || ctx.form?.modalId === "lavoro-modal";
    const useStructuredFormOutput =
      isTonyAdvancedActive && (isAttivitaForm || isLavoroForm);

    let systemInstructionToUse = systemInstruction;
    const generationConfig = {
      temperature: 0.7,
      maxOutputTokens: 1536,
    };

    if (useStructuredFormOutput) {
      const ctxJson = JSON.stringify(ctx, null, 2);
      if (isLavoroForm) {
        console.log("[Tony Cloud Function] Usando modalità Treasure Map Lavori");
        systemInstructionToUse = SYSTEM_INSTRUCTION_LAVORO_STRUCTURED.replace(
          "{CONTESTO_PLACEHOLDER}",
          ctxJson || '"Nessun dato"'
        );
      } else {
        console.log("[Tony Cloud Function] Usando modalità Treasure Map Attività");
        systemInstructionToUse = SYSTEM_INSTRUCTION_ATTIVITA_STRUCTURED.replace(
          "{CONTESTO_PLACEHOLDER}",
          ctxJson || '"Nessun dato"'
        );
      }
    }

    const body = {
      contents: [{ parts: [{ text: fullPrompt }] }],
      systemInstruction: { parts: [{ text: systemInstructionToUse }] },
      generationConfig,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini API error:", res.status, errText);
      throw new HttpsError("internal", "Errore chiamata Gemini: " + (res.statusText || res.status));
    }

    const data = await res.json();
    let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (rawText == null) {
      throw new HttpsError("internal", "Risposta Gemini vuota o non valida.");
    }

    // Treasure Map: estrai blocco ```json dalla risposta e converti nel formato atteso
    if (useStructuredFormOutput && typeof rawText === "string") {
      const jsonBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonBlockMatch) {
        try {
          const structured = JSON.parse(jsonBlockMatch[1].trim());
          const cleanedText = rawText.replace(/```(?:json)?\s*[\s\S]*?```/g, "").trim() || structured.replyText || "Ok.";
          const result = { text: cleanedText };
          if (structured.action === "open_modal" && structured.modalId) {
            result.command = { type: "OPEN_MODAL", id: structured.modalId };
          } else if (structured.action === "save") {
            result.command = { type: "SAVE_ACTIVITY" };
          } else if ((structured.action === "fill_form" || structured.action === "ask") && structured.formData && Object.keys(structured.formData).length > 0) {
            const formDataKeys = Object.keys(structured.formData);
            const isLavoroData = formDataKeys.some((k) => k.startsWith("lavoro-") || k === "tipo-assegnazione");
            const formId = isLavoroData ? "lavoro-form" : "attivita-form";
            result.command = { type: "INJECT_FORM_DATA", formId, formData: structured.formData };
          }
          console.log("[Tony Cloud Function] Treasure Map - JSON estratto:", JSON.stringify(result.command, null, 2));
          return result;
        } catch (parseErr) {
          console.warn("[Tony Cloud Function] Parse blocco json fallito:", parseErr.message);
        }
      } else {
        console.log("[Tony Cloud Function] Treasure Map - nessun blocco ```json trovato, proseguo legacy");
      }
    }

    // DEBUG: Log risposta grezza di Gemini
    console.log('[Tony Cloud Function] DEBUG - rawText ricevuto da Gemini (primi 500 caratteri):', String(rawText).substring(0, 500));
    console.log('[Tony Cloud Function] DEBUG - rawText lunghezza:', String(rawText).length);
    console.log('[Tony Cloud Function] DEBUG - rawText completo:', String(rawText));

    let trimmed = String(rawText).trim();
    console.log('[Tony Cloud Function] DEBUG - trimmed dopo trim iniziale:', trimmed.substring(0, 500));
    
    // SICUREZZA: Se modulo non attivo, rimuovi TUTTI i comandi JSON prima del parsing
    if (!isTonyAdvancedActive) {
      // Rimuovi qualsiasi blocco JSON che contenga comandi operativi
      trimmed = trimmed.replace(/\{\s*["']?(?:action|command|type|text)["']?\s*:[\s\S]*?\}/g, '').trim();
      // Rimuovi anche blocchi ```json ... ```
      trimmed = trimmed.replace(/```(?:json)?\s*([\s\S]*?)```/g, '').trim();
      // Se rimane solo testo, usalo; altrimenti usa rawText originale
      if (trimmed.length < 3) trimmed = String(rawText).trim();
    }
    
    // 1. Rimuovi TUTTI i blocchi ```json ... ``` o ``` ... ```
    trimmed = trimmed.replace(/```(?:json)?\s*([\s\S]*?)```/g, "$1").trim();
    // 2. Se è rimasto solo un frammento inutile, ripensa
    if (/^(json\s*[}\]]|[\s}\]]+)$/i.test(trimmed) || trimmed.length < 3) {
      console.log('[Tony Cloud Function] DEBUG - trimmed troppo corto o solo frammenti, uso rawText originale');
      trimmed = String(rawText).trim();
    }
    
    // Se dopo tutto il trimming rimane solo "}" o caratteri simili, c'è un problema
    if (trimmed === '}' || trimmed === ']' || trimmed.length < 3) {
      console.error('[Tony Cloud Function] ERROR - Risposta troncata o malformata. rawText originale:', String(rawText));
      // Prova a recuperare dal rawText originale senza trimming aggressivo
      trimmed = String(rawText).trim();
      // Se ancora non funziona, genera una risposta di fallback
      if (trimmed === '}' || trimmed === ']' || trimmed.length < 3) {
        console.error('[Tony Cloud Function] ERROR - Impossibile recuperare risposta valida, uso fallback');
        trimmed = 'Mi dispiace, ho avuto un problema nel processare la risposta. Puoi ripetere la domanda?';
      }
    }
    // 3. Rimuovi suffissi " }" o " ]" che rompono il parse
    trimmed = trimmed.replace(/\s+json\s*[}\]]\s*$/i, "").trim() || trimmed;
    while (/\s+[}\]]\s*$/.test(trimmed) && trimmed.length > 2) {
      trimmed = trimmed.replace(/\s+[}\]]\s*$/g, "").trim();
    }
    
    // 4. Estrai eventuale JSON da testo misto (es. "Ok.\n{ \"text\": \"...\", \"command\": {...} }")
    // Se modulo non attivo, salta l'estrazione JSON
    let result = { text: trimmed };
    
    if (isTonyAdvancedActive) {
      // Funzione helper per cercare JSON annidati nel testo
      const findNestedJson = (text) => {
        // Cerca pattern { "action": ... } o { "text": ..., "command": ... }
        const actionPattern = /\{\s*["']?(?:action|text|command)["']?\s*:[\s\S]*?\}/g;
        const matches = [];
        let match;
        
        while ((match = actionPattern.exec(text)) !== null) {
          matches.push({
            start: match.index,
            end: match.index + match[0].length,
            content: match[0]
          });
        }
        
        return matches;
      };
      
      // Funzione per completare JSON troncati
      const completeTruncatedJson = (jsonStr) => {
        let openBraces = (jsonStr.match(/\{/g) || []).length;
        let closeBraces = (jsonStr.match(/\}/g) || []).length;
        let missing = openBraces - closeBraces;
        
        if (missing > 0) {
          // Prova a completare aggiungendo parentesi mancanti
          let completed = jsonStr;
          for (let i = 0; i < missing; i++) {
            completed += '}';
          }
          return completed;
        }
        return jsonStr;
      };
      
      // Funzione per estrarre azioni dal testo (es. { "action": "APRI_PAGINA", "params": {...} })
      // Gestisce anche JSON annidati nel campo text e JSON troncati
      const extractActionFromText = (text) => {
        // Cerca pattern { "action": "NOME", "params": { ... } anche se troncato
        // Pattern più flessibile che gestisce anche JSON multilinea e troncati
        const actionPattern = /\{\s*["']?action["']?\s*:\s*["']([^"']+)["']\s*,\s*["']?params["']?\s*:\s*(\{[\s\S]*?)(?:\}|$)/;
        const actionMatch = text.match(actionPattern);
        
        if (actionMatch) {
          try {
            const actionName = actionMatch[1];
            let paramsStr = actionMatch[2];
            
            // Se il JSON è troncato (non finisce con }), completa
            if (!paramsStr.endsWith('}')) {
              paramsStr = completeTruncatedJson(paramsStr);
            }
            
            // Prova a parsare i params
            let params = {};
            try {
              params = JSON.parse(paramsStr);
            } catch (e) {
              // Se fallisce, prova a completare ulteriormente
              paramsStr = completeTruncatedJson(paramsStr);
              try {
                params = JSON.parse(paramsStr);
              } catch (e2) {
                // Se ancora fallisce, usa params vuoto ma con target se presente nel testo
                const targetMatch = paramsStr.match(/["']?target["']?\s*:\s*["']([^"']+)["']/);
                if (targetMatch) {
                  params = { target: targetMatch[1] };
                }
              }
            }
            
            return { action: actionName, params: params };
          } catch (e) {
            console.log('[Tony Cloud Function] Errore parsing action da testo:', e);
          }
        }
        
        // Fallback: cerca anche pattern semplificato { "action": "NOME" senza params
        const simpleActionMatch = text.match(/\{\s*["']?action["']?\s*:\s*["']([^"']+)["']/);
        if (simpleActionMatch) {
          return { action: simpleActionMatch[1], params: {} };
        }
        
        return null;
      };
      
      const tryParse = (str) => {
        try {
          const p = JSON.parse(str);
          if (p && typeof p === "object") {
            if (typeof p.text === "string") {
              let text = String(p.text).replace(/\s+[}\]]\s*$/g, "").trim();
              return {
                text: text || p.text,
                command: p.command && typeof p.command === "object" ? p.command : undefined,
                action: p.action ? { action: p.action, params: p.params || {} } : undefined
              };
            } else if (p.action) {
              // JSON con solo action (senza text wrapper)
              return {
                text: trimmed.replace(/\{[\s\S]*?\}/g, '').trim() || 'Ok.',
                action: { action: p.action, params: p.params || {} }
              };
            }
          }
        } catch (_) {}
        return null;
      };
      
      // Prima prova: cerca JSON completo con "text" wrapper
      const jsonStart = trimmed.search(/\{\s*["']?text["']?\s*:/);
      if (jsonStart >= 0) {
        let jsonStr = trimmed.slice(jsonStart);
        jsonStr = jsonStr.replace(/\b(text|command|action|params)\s*:/g, '"$1":');
        
        // Prova parsing diretto
        let parsed = tryParse(jsonStr);
        if (parsed) {
          result = parsed;
        } else {
          // Prova completando JSON troncato
          jsonStr = completeTruncatedJson(jsonStr);
          parsed = tryParse(jsonStr);
          if (parsed) {
            result = parsed;
          } else {
            // Caso speciale: JSON wrapper troncato ma contiene azione annidata nel campo text
            // Esempio: {text: '...', { "action": "APRI_PAGINA", "params": {"target": "dashboard"'
            // Estrai direttamente l'azione dal testo anche se il wrapper è troncato
            const nestedAction = extractActionFromText(jsonStr);
            if (nestedAction) {
              // Estrai il testo prima dell'azione annidata
              const textBeforeAction = jsonStr.match(/["']text["']\s*:\s*["']([^"']*)/);
              const textValue = textBeforeAction ? textBeforeAction[1] : '';
              result = {
                text: textValue || trimmed.replace(/\{[\s\S]*$/, '').trim() || 'Ok.',
                action: nestedAction
              };
            } else {
              // Ultimo tentativo: trimming progressivo
              let toParse = jsonStr;
              for (let i = 0; i < 30 && toParse.length > 10; i++) {
                toParse = toParse.slice(0, -1).trim();
                // Rimuovi caratteri finali invalidi
                while (toParse.length > 0 && !/[}\]]$/.test(toParse)) {
                  toParse = toParse.slice(0, -1).trim();
                }
                parsed = tryParse(toParse);
                if (parsed) {
                  result = parsed;
                  break;
                }
                // Anche durante il trimming, prova a estrarre azioni
                const actionDuringTrim = extractActionFromText(toParse);
                if (actionDuringTrim) {
                  const textBeforeAction = toParse.match(/["']text["']\s*:\s*["']([^"']*)/);
                  const textValue = textBeforeAction ? textBeforeAction[1] : '';
                  result = {
                    text: textValue || trimmed.replace(/\{[\s\S]*$/, '').trim() || 'Ok.',
                    action: actionDuringTrim
                  };
                  break;
                }
              }
            }
          }
        }
      }
      
      // Seconda prova: cerca azioni annidate nel testo (es. testo con { "action": ... } dentro)
      // Questo gestisce il caso in cui Gemini genera {text: "...", { "action": ... } troncato}
      if (!result.action && !result.command) {
        // Cerca nel testo completo (potrebbe essere annidato nel campo text)
        const actionInText = extractActionFromText(trimmed);
        if (actionInText) {
          result.action = actionInText;
          // Rimuovi il JSON dal testo per display (gestisce anche JSON multilinea)
          result.text = trimmed.replace(/\{\s*["']?action["']?\s*:[\s\S]*?\}/g, '').trim() || trimmed;
          // Se result.text contiene ancora JSON annidato, rimuovilo
          result.text = result.text.replace(/\n\s*\{[\s\S]*$/, '').trim() || result.text;
        }
        
        // Se ancora non trovato, cerca anche nel campo text del risultato parsato
        if (!result.action && result.text && result.text.includes('"action"')) {
          const actionInResultText = extractActionFromText(result.text);
          if (actionInResultText) {
            result.action = actionInResultText;
            // Rimuovi JSON dal testo
            result.text = result.text.replace(/\{\s*["']?action["']?\s*:[\s\S]*?\}/g, '').trim() || result.text;
            result.text = result.text.replace(/\n\s*\{[\s\S]*$/, '').trim() || result.text;
          }
        }
      }
      
      // Terza prova: cerca JSON standalone (senza wrapper text)
      if (!result.action && !result.command) {
        const standaloneJson = trimmed.match(/^\s*\{\s*["']?(?:action|command)["']?\s*:[\s\S]*?\}\s*$/);
        if (standaloneJson) {
          let jsonStr = standaloneJson[0];
          jsonStr = jsonStr.replace(/\b(action|command|params|type|id|field|value)\s*:/g, '"$1":');
          jsonStr = completeTruncatedJson(jsonStr);
          const parsed = tryParse(jsonStr);
          if (parsed) {
            result = parsed;
          }
        }
      }
      
      // Converti action in command se necessario (per compatibilità)
      if (result.action && !result.command) {
        result.command = {
          type: result.action.action,
          ...(result.action.params || {})
        };
      }
    }
    
    // Comando vuoto o senza type: non restituirlo (evita "ESEGUO COMANDO: {}" nel client)
    if (result.command && (!result.command.type || typeof result.command.type !== "string" || !result.command.type.trim())) {
      delete result.command;
    }
    // SICUREZZA FINALE: Se modulo non attivo, rimuovi qualsiasi comando dal risultato
    if (!isTonyAdvancedActive) {
      if (result.command) {
        delete result.command;
      }
      // Se result contiene solo testo con JSON, estrai solo il testo
      if (result.text && result.text.includes('{')) {
        const textOnly = result.text.replace(/\{[\s\S]*?\}/g, '').trim();
        result.text = textOnly || result.text;
      }
      // Assicurati che result.text esista
      if (!result.text) {
        result.text = trimmed.replace(/\{[\s\S]*?\}/g, '').trim() || 'Ok.';
      }
    }
    
    // DEBUG: Log risultato finale
    console.log('[Tony Cloud Function] DEBUG - result finale:', JSON.stringify(result, null, 2));
    
    return result;
  }
);

/**
 * Callable: getTonyAudio - Sintesi vocale neurale per Tony.
 * Riceve { text: string }, restituisce { audioContent: string } (base64 MP3).
 * Richiede utente autenticato. Abilita "Cloud Text-to-Speech API" in Google Cloud Console.
 */
exports.getTonyAudio = onCall(
  { region: "europe-west1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Utente non autenticato.");
    }

    const text = request.data?.text;
    if (!text || typeof text !== "string") {
      throw new HttpsError("invalid-argument", "Campo 'text' (stringa) obbligatorio.");
    }

    const VOICE_NAME = "it-IT-Wavenet-D";
    console.log("[getTonyAudio] Chiamata ricevuta", {
      textLen: text.length,
      textPreview: text.substring(0, 60) + (text.length > 60 ? "..." : ""),
      voice: VOICE_NAME,
      ts: new Date().toISOString(),
    });

    const [response] = await ttsClient.synthesizeSpeech({
      input: { text },
      voice: {
        languageCode: "it-IT",
        name: VOICE_NAME,
      },
      audioConfig: {
        audioEncoding: "MP3",
        pitch: -3.0,
        speakingRate: 0.95,
      },
    });

    const audioContent = response.audioContent.toString("base64");
    console.log("[getTonyAudio] Audio generato", {
      audioLenBase64: audioContent.length,
      voice: VOICE_NAME,
      ts: new Date().toISOString(),
    });
    return { audioContent, voice: VOICE_NAME };
  }
);
