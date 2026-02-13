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
5. NON emettere mai comandi JSON come { "action": "APRI_PAGINA" }, { "command": { "type": "OPEN_MODAL" } }, ecc. Se Gemini genera accidentalmente questi comandi, devono essere rimossi prima della risposta.

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

REGOLE DI RISPOSTA:
1. Per ogni dato che capisci, usa il comando SET_FIELD con il valore più specifico possibile.
   - Esempio: "Ho trinciato" -> { "type": "SET_FIELD", "field": "attivita-tipo-lavoro-gerarchico", "value": "Trinciatura" } (usa il nome del lavoro, non l'ID).
   - Esempio: "Campo A" -> { "type": "SET_FIELD", "field": "attivita-terreno", "value": "Campo A" } (usa il nome del terreno).
2. NON cercare di impostare Categorie o Sottocategorie. Imposta SOLO il "Tipo Lavoro" specifico. Il sistema dedurrà automaticamente il resto.
3. Se l'utente vuole iniziare, usa { "type": "OPEN_MODAL", "id": "attivita-modal" }.
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

    const { message, context = {}, history = [] } = request.data || {};
    if (!message || typeof message !== "string") {
      throw new HttpsError("invalid-argument", "Campo 'message' (stringa) obbligatorio.");
    }

    // Controlla se il modulo 'tony' è attivo
    const moduliAttivi = context.moduli_attivi || context.dashboard?.moduli_attivi || context.info_azienda?.moduli_attivi || [];
    const isTonyAdvancedActive = Array.isArray(moduliAttivi) && moduliAttivi.includes('tony');
    
    // DEBUG: Log per verificare cosa riceve la Cloud Function
    console.log('[Tony Cloud Function] DEBUG - context ricevuto:', JSON.stringify(context, null, 2));
    console.log('[Tony Cloud Function] DEBUG - moduli_attivi estratti:', moduliAttivi);
    console.log('[Tony Cloud Function] DEBUG - isTonyAdvancedActive:', isTonyAdvancedActive);
    
    // Usa system instruction appropriata
    const systemInstructionTemplate = isTonyAdvancedActive 
      ? SYSTEM_INSTRUCTION_ADVANCED 
      : SYSTEM_INSTRUCTION_BASE;
    
    const contextJson = JSON.stringify(context, null, 2);
    const systemInstruction = systemInstructionTemplate.replace(
      "{CONTESTO_PLACEHOLDER}",
      contextJson || '"Nessun dato contestuale fornito."'
    );

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
    const fullPrompt = historyFormatted
      ? `Contesto attuale: ${contextJson}\n\nConversazione precedente:\n${historyFormatted}\n\nDomanda utente: ${message}`
      : `Contesto attuale: ${contextJson}\n\nDomanda utente: ${message}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    // Modalità Treasure Map: form attività aperto → istruiamo Gemini a includere blocco ```json (no responseSchema per evitare 500)
    const useStructuredFormOutput =
      isTonyAdvancedActive &&
      (context.form?.formId === "attivita-form" || context.form?.modalId === "attivita-modal");

    let systemInstructionToUse = systemInstruction;
    const generationConfig = {
      temperature: 0.7,
      maxOutputTokens: 4096,
    };

    if (useStructuredFormOutput) {
      console.log("[Tony Cloud Function] Usando modalità Treasure Map (blocco json via instruction, no responseSchema)");
      const ctxJson = JSON.stringify(context, null, 2);
      systemInstructionToUse = SYSTEM_INSTRUCTION_ATTIVITA_STRUCTURED.replace(
        "{CONTESTO_PLACEHOLDER}",
        ctxJson || '"Nessun dato"'
      );
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
            result.command = { type: "INJECT_FORM_DATA", formId: "attivita-form", formData: structured.formData };
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
