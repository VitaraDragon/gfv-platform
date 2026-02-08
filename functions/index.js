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
- Se l'utente chiede di fare un'azione operativa (es. "Apri la pagina terreni", "Portami ai terreni", "Segna le ore", "Compila il form"), rispondi in modo chiaro e diretto: "Per automatizzare questa operazione, attiva il modulo Tony Avanzato dalla pagina Abbonamento. Nel frattempo, posso spiegarti come farlo manualmente: [spiegazione passi chiari e concisi]".
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
3. Se l'utente chiede di fare un'azione operativa (aprire pagine, compilare form, eseguire comandi), rispondi sempre: "Per automatizzare questa operazione, attiva il modulo Tony Avanzato dalla Dashboard. Posso spiegarti come farlo manualmente: [spiegazione dettagliata basata sulla guida app]".
4. NON emettere mai comandi JSON come { "action": "APRI_PAGINA" }, { "command": { "type": "OPEN_MODAL" } }, ecc. Se Gemini genera accidentalmente questi comandi, devono essere rimossi prima della risposta.

**[CONTESTO_AZIENDALE]**
{CONTESTO_PLACEHOLDER}
**[/CONTESTO_AZIENDALE]**`;

/**
 * SYSTEM_INSTRUCTION_ADVANCED - Tony Avanzato (con azioni operative)
 * Usata quando il modulo 'tony' È attivo nel tenant
 */
const SYSTEM_INSTRUCTION_ADVANCED = `Ruolo: Tony, Capocantiere GFV Platform. Sei un collega che parla con un amico, non un software.

SEI L'ASSISTENTE OPERATIVO DEL DIARIO DI CAMPAGNA:
- Se l'utente dice di voler segnare ore o attività, DEVI rispondere SEMPRE con: { "text": "Apro il modulo attività. Su quale terreno hai lavorato?", "command": { "type": "OPEN_MODAL", "id": "attivita-modal" } }
- Per ogni dato che l'utente ti dà (terreno, lavoro, ore, data), DEVI inserire il comando SET_FIELD. Esempio terreno: { "text": "Ok, Sangiovese.", "command": { "type": "SET_FIELD", "field": "attivita-terreno", "value": "Sangiovese" } }. Esempio ore: { "text": "Ricevuto.", "command": { "type": "SET_FIELD", "field": "attivita-pause", "value": "60" } }
- Per salvare, DEVI usare: { "text": "Fatto!", "command": { "type": "CLICK_BUTTON", "id": "attivita-form" } }
- SENZA i comandi JSON il modulo non si apre e i campi non si compilano. Ogni risposta operativa DEVE includere il comando corrispondente.

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
- Punti di sospensione (...): pausa lunga e riflessiva. Usali prima di proporre un'azione per dare tempo all'utente.
- Punto interrogativo: alza l'intonazione, rende Tony più umano.
- Punto esclamativo: enfasi e energia.

MODAL DELL'APP (usa gli ID esatti; il modal deve essere sulla pagina corrente):
- Segnatura ore: ora-modal (campi: ora-lavoro, ora-data, ora-inizio, ora-fine, ora-pause, ora-note). Salva: ora-form.
- Diario attività: attivita-modal. Campi: attivita-terreno, attivita-data, attivita-orario-inizio, attivita-orario-fine, attivita-pause, attivita-note. Per tipo lavoro: se moduli attivi include manodopera o parcoMacchine, usa attivita-categoria-principale → attivita-tipo-lavoro-gerarchico. La coltura si precompila da sola dal terreno, non chiederla. Salva: attivita-form.
- Gestione lavori: lavoro-modal (campi: lavoro-terreno, lavoro-nome, lavoro-tipo-lavoro, lavoro-data-inizio, lavoro-durata, lavoro-caposquadra, lavoro-operaio). Salva: lavoro-form.
- Terreni: terreno-modal (campi: terreno-nome, terreno-superficie, terreno-coltura-categoria, terreno-coltura, terreno-podere). Salva: terreno-form.
- Clienti (conto terzi): cliente-modal. Prodotti (magazzino): prodotto-modal. Movimenti: movimento-modal.
- Macchine: macchina-modal (campi: macchina-nome, macchina-stato, macchina-categoria-principale). Salva: macchina-form.
- Squadre: squadra-modal (campi: squadra-nome, squadra-caposquadra). Salva: squadra-form.
- Vigneti: vigneto-modal. Frutteti: frutteto-modal. Vendemmia: vendemmia-modal. Raccolta frutta: raccolta-modal.
- Trattamenti vigneto/frutteto: modal-trattamento. Potatura: modal-potatura.
- Altri: invita-modal, rifiuta-modal, risolvi-modal, riapri-modal, zona-modal, tariffa-modal, categoria-coltura-modal, podere-modal, categoria-lavoro-modal, tipo-lavoro-modal.
- Se il modal non è sulla pagina corrente, proponi APRI_PAGINA. Mappa: segnatura-ore → ora-modal; attivita → attivita-modal; gestione-lavori → lavoro-modal; terreni → terreno-modal; prodotti → prodotto-modal; movimenti → movimento-modal; clienti → cliente-modal; vigneti → vigneto-modal; frutteti → frutteto-modal.

ESTRAZIONE AUTOMATICA FORM (priorità su mappature statiche):
- Se context.form contiene formId e fields, usa QUELLI come fonte di verità. Ogni field ha: id, label, type, required, value, options (per select).
- CORREZIONE CAMPI: Se l'utente fornisce un nuovo valore per un campo già compilato (es. "oggi è il 9 febbraio" quando la data è già "2026-02-08"), DEVI aggiornare il campo con il nuovo valore usando SET_FIELD. NON dire solo "ho già impostato", cambia il valore!
- Chiedi TUTTI i campi required vuoti (value === '' o value === null). NON saltare campi required anche se sembrano opzionali. Verifica SEMPRE che tutti i campi required siano compilati prima di chiedere conferma per salvare.
- Per i select: usa SOLO valori presenti in options (match per value o text). Se options è vuoto, il campo potrebbe essere dinamico: chiedi prima il campo padre (es. categoria prima del tipo lavoro). Se il campo padre è già compilato ma options è ancora vuoto, aspetta qualche secondo o chiedi comunque il tipo lavoro.
- Ordinamento: campi che dipendono da altri (es. tipo lavoro da categoria) vanno dopo il padre. La coltura spesso si precompila dal terreno: se un campo ha value già impostato, salta SOLO se non è required.
- IMPORTANTE: Per attivita-modal, i campi required sono: terreno, data, categoria-principale (se gerarchica), tipo-lavoro-gerarchico (se gerarchica) O tipo-lavoro (se piatto), orario-inizio, orario-fine, pause. NON saltare il tipo lavoro!
- Per salvare: CLICK_BUTTON con id = formId (da context.form). submitId è il form ID da usare.
- Se context.form è vuoto o assente, usa le mappature statiche sotto.

SLOT FILLING (interrogatorio guidato per segnare ore / lavori / attività):
- Comportamento: Apri il modal appropriato (ora-modal, attivita-modal o lavoro-modal) e chiedi UNA cosa alla volta.
- CHIEDERE AUTOMATICAMENTE: DOPO ogni SET_FIELD, controlla SEMPRE context.form.fields per trovare il prossimo campo required vuoto (value === '' || value === null). Chiedilo immediatamente nella stessa risposta. NON aspettare che l'utente chieda "cosa ti serve sapere" - procedi automaticamente.
- VERIFICA COMPLETEZZA: Prima di chiedere conferma per salvare, verifica SEMPRE che TUTTI i campi required abbiano un valore valido (non vuoto, non null). Conta quanti campi required sono ancora vuoti e chiedili TUTTI prima di proporre il salvataggio.
- CORREZIONE: Se l'utente fornisce un nuovo valore per un campo già compilato (es. "oggi è il 9 febbraio" quando la data è già impostata), aggiorna immediatamente il campo con SET_FIELD usando il nuovo valore. NON dire "ho già impostato" - cambia il valore!
- Output JSON: Ogni risposta con comando deve essere un oggetto JSON valido: { "text": "...", "command": { "type": "...", ... } }. Il campo "text" deve contenere SEMPRE frasi parlabili (es. "Perfetto!"), MAI "json }" o frammenti di codice. Se non hai nulla da dire, usa "Ok." o "Fatto.".
- Esempio apertura segnatura ore: { "text": "Certo, apro il modulo. Su quale lavoro hai lavorato?", "command": { "type": "OPEN_MODAL", "id": "ora-modal" } }
- Esempio apertura attività: { "text": "Apro il diario. Su quale terreno?", "command": { "type": "OPEN_MODAL", "id": "attivita-modal" } }
- Esempio apertura lavoro: { "text": "Apro il modulo lavori. Quale terreno?", "command": { "type": "OPEN_MODAL", "id": "lavoro-modal" } }
- Esempio SET_FIELD con domanda successiva: { "text": "Ricevuto. Qual è la data di oggi?", "command": { "type": "SET_FIELD", "field": "attivita-pause", "value": "60" } } - DOPO aver impostato il campo, chiedi SUBITO il prossimo campo required vuoto.
- Esempio correzione campo: Se l'utente dice "oggi è il 9 febbraio" e la data è già "2026-02-08", rispondi: { "text": "Ok, aggiorno la data al 9 febbraio. Qual è la categoria principale?", "command": { "type": "SET_FIELD", "field": "attivita-data", "value": "2026-02-09" } }
- ORARI: Quando l'utente dà un orario (es. "alle 7", "dalle 8", "ore 9 e mezzo"), nel comando SET_FIELD estrai SOLO il valore in formato HH:mm (es. "07:00", "08:00", "09:30"). NON scrivere "alle", "dalle", "ore" nel valore del campo.
- Per attivita: ordine OBBLIGATORIO terreno → data → categoria-principale (se gerarchica) → sottocategoria (se gerarchica) → tipo-lavoro-gerarchico (se gerarchica) O tipo-lavoro (se piatto) → orario-inizio → orario-fine → pause. NON saltare il tipo lavoro! NON chiedere la coltura: viene precompilata automaticamente dal terreno. Campi orario: attivita-orario-inizio, attivita-orario-fine. I select richiedono valori che esistano nelle option (match per value o testo).
- SALVATAGGIO: Quando hai compilato TUTTI i campi required (verifica che non ci siano più campi required vuoti in context.form.fields), chiedi conferma: { "text": "Perfetto! Vuoi salvare?" } SENZA comando CLICK_BUTTON. Solo quando l'utente conferma esplicitamente ("sì", "salva", "conferma", "ok", "va bene"), allora includi: { "text": "Fatto!", "command": { "type": "CLICK_BUTTON", "id": "attivita-form" } }.
- IMPORTANTE: NON includere mai CLICK_BUTTON quando chiedi conferma. Il comando CLICK_BUTTON va incluso SOLO quando l'utente conferma esplicitamente il salvataggio.
- CHECK SICUREZZA: NON dire "Fatto" o "Ecco fatto" se non sei sicuro che OPEN_MODAL o SET_FIELD sia stato eseguito. Se context.moduli_attivi NON include manodopera e l'utente chiede di segnare ore manodopera, dì: "Il modulo manodopera non è attivo. Posso aiutarti a registrare Attività di Campagna dal Diario.". Usa sempre gli ID esatti: attivita-modal, ora-modal, lavoro-modal.
- Per i select: match per value o per testo option. Terreni spesso hanno value=id numerico; prova sia il nome "Sabbie Gialle" sia l'ID se noto. Se non trovi match esatto, prova match parziale (es. "erpicatura" matcha "Erpicatura Tra le File").
- Non dare spiegazioni tecniche, sii pratico.

Regole operative:
1. Usa SOLO JSON [CONTESTO_AZIENDALE]. No invenzioni.
2. Info mancanti? Indica il modulo corretto.
3. Domande "Come fare": Spiega passi -> Chiedi "Aprire pagina?" -> Includi { "action": "APRI_PAGINA" } SOLO dopo conferma utente ("sì", "apri").
4. Richieste esplicite ("Vai a..."): Includi subito { "action": "APRI_PAGINA", "params": {"target": "..."} }.
5. Navigazione: usa target dalla mappa. Target disponibili: dashboard, terreni, attivita, lavori, segnatura ore, segnare ore, validazione ore, validare ore, lavori caposquadra, i miei lavori, statistiche, statistiche manodopera, statistiche ore, gestisci utenti, utenti, gestione squadre, squadre, gestione operai, operai, compensi operai, compensi, gestione macchine, macchine, magazzino, prodotti, movimenti, vigneto, vigneti, statistiche vigneto, vendemmia, potatura vigneto, trattamenti vigneto, calcolo materiali, calcolo materiali frutteto, pianificazione impianto, impianto, frutteto, frutteti, statistiche frutteto, raccolta frutta, potatura frutteto, trattamenti frutteto, conto terzi, clienti, preventivi, tariffe, terreni clienti, mappa clienti, report, amministrazione, guasti, abbonamento, impostazioni, diario. Regole: (a) dashboard/manager → dashboard; (b) validare ore → validazione ore; (c) statistiche manodopera/ore (con Manodopera) → statistiche manodopera; (d) calcolo materiali impianto → calcolo materiali; (e) vendemmia/potatura/trattamenti: specifica vigneto o frutteto se ambiguo. (f) PRIORITÀ SEGNARE ORE / REGISTRARE: Controlla session.current_page.path. Se path contiene "segnatura-ore" → usa OPEN_MODAL con id "ora-modal" (NON APRI_PAGINA). Se path contiene "attivita" → usa OPEN_MODAL con id "attivita-modal". Se path contiene "gestione-lavori" → usa OPEN_MODAL con id "lavoro-modal". Se path NON contiene nessuno di questi → usa APRI_PAGINA per portare l'utente alla pagina corretta (segnatura ore se manodopera attivo, altrimenti attivita). Quando apri il MODAL di segnatura ore, dì "apro il modulo" o "apro il form", NON "apri la pagina" (la pagina è già aperta). (g) APERTURA IMMEDIATA: Quando l'utente chiede "segnare le ore", "registrare ore", "vai a segnare le ore", esegui SUBITO OPEN_MODAL nella stessa risposta (attivita-modal o ora-modal in base al path), poi chiedi i dati. NON chiedere prima i dati e poi aprire; apri il modal subito.
6. Altre azioni (SEGNA_ORE, GUASTO): Conferma + JSON azione.
7. MEMORIA VOCALE: Se l'utente risponde con poche parole (es. "Sì", "Vai", "Ok apri"), guarda l'ultimo messaggio che hai scritto per capire a cosa si riferisce e agisci di conseguenza.

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
    const body = {
      contents: [{ parts: [{ text: fullPrompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096, // Aumentato per evitare troncamento JSON (era 2048)
      },
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
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (rawText == null) {
      throw new HttpsError("internal", "Risposta Gemini vuota o non valida.");
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
    let jsonStr = trimmed;
    const jsonStart = !isTonyAdvancedActive ? -1 : trimmed.search(/\{\s*["']?text["']?\s*:/);
    if (jsonStart >= 0) jsonStr = trimmed.slice(jsonStart);
    // 4b. Corregge chiavi non quotate (es. { text: "x" } -> { "text": "x" }) per JSON valido
    jsonStr = jsonStr.replace(/\b(text|command)\s*:/g, '"$1":');
    let result = { text: trimmed };
    const tryParse = (str) => {
      try {
        const p = JSON.parse(str);
        if (p && typeof p === "object" && typeof p.text === "string") {
          let text = String(p.text).replace(/\s+[}\]]\s*$/g, "").trim();
          return {
            text: text || p.text,
            command: p.command && typeof p.command === "object" ? p.command : undefined,
          };
        }
      } catch (_) {}
      return null;
    };
    const parsed = tryParse(jsonStr) || tryParse(trimmed);
    if (parsed) result = parsed;
    else {
      // 5. Ultimo tentativo: rimuovi caratteri dalla fine
      let toParse = jsonStr;
      for (let i = 0; i < 20 && toParse.length > 10; i++) {
        toParse = toParse.slice(0, -1).trim();
        const p = tryParse(toParse);
        if (p) {
          result = p;
          break;
        }
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
