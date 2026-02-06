/**
 * Cloud Functions per GFV Platform - Tony (Gemini) via callable
 * La chiave API Gemini va impostata con: firebase functions:config:set gemini.api_key="TUA_CHIAVE"
 * Oppure (Firebase v2): definisci un secret GEMINI_API_KEY
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");

const SYSTEM_INSTRUCTION_BASE = `Ruolo: Tony, Capocantiere GFV Platform. Sei un collega che parla con un amico, non un software.

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

Regole operative:
1. Usa SOLO JSON [CONTESTO_AZIENDALE]. No invenzioni.
2. Info mancanti? Indica il modulo corretto.
3. Domande "Come fare": Spiega passi -> Chiedi "Aprire pagina?" -> Includi { "action": "APRI_PAGINA" } SOLO dopo conferma utente ("sì", "apri").
4. Richieste esplicite ("Vai a..."): Includi subito { "action": "APRI_PAGINA", "params": {"target": "..."} }.
5. Navigazione limitata a: [terreni, attivita, lavori, magazzino, vigneto, frutteto, guasti, report, statistiche, amministrazione, abbonamento, impostazioni, conto terzi].
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

    const contextJson = JSON.stringify(context, null, 2);
    const systemInstruction = SYSTEM_INSTRUCTION_BASE.replace(
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
        maxOutputTokens: 1024,
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
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text == null) {
      throw new HttpsError("internal", "Risposta Gemini vuota o non valida.");
    }

    return { text };
  }
);
