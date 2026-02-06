/**
 * Tony Service - Assistente IA (Gemini) per GFV Platform
 * Modulo dedicato: Singleton + Event Bus. Solo questo modulo parla con Gemini.
 * @see docs-sviluppo/GUIDA_SVILUPPO_TONY.md
 * @module core/services/tony-service
 */

import { GUIDA_APP_PER_TONY } from './tony-guida-app.js';

/** Elenco file della guida app (percorso relativo a docs-sviluppo/guida-app/) */
const GUIDA_APP_FILES = [
  'core.md',
  'intersezioni-moduli.md',
  'moduli/terreni.md',
  'moduli/lavori-attivita.md',
  'moduli/vigneto.md',
  'moduli/frutteto.md',
  'moduli/magazzino.md',
  'moduli/conto-terzi.md'
];

/**
 * Carica la guida app completa dai file .md.
 * Prova in ordine: 1) core/guida-app/ (sempre disponibile se deployato con core); 2) docs-sviluppo/guida-app/.
 * Se entrambi falliscono, restituisce null e si usa la guida condensata.
 * @returns {Promise<string|null>} Testo completo della guida o null
 */
async function loadGuidaAppFull() {
  const scriptBase = new URL(import.meta.url);
  const basesToTry = [
    new URL('../guida-app/', scriptBase).href,   // core/guida-app/ (copia in core)
    new URL('../../docs-sviluppo/guida-app/', scriptBase).href
  ];
  for (const base of basesToTry) {
    try {
      const parts = await Promise.all(
        GUIDA_APP_FILES.map(async (file) => {
          const res = await fetch(base + file, { cache: 'no-store' });
          if (!res.ok) return '';
          return res.text();
        })
      );
      const full = parts.filter(Boolean).join('\n\n---\n\n');
      if (full.length > 100) return full;
    } catch (_) { /* prova base successiva */ }
  }
  console.warn('[Tony] Guida completa non caricabile (uso versione condensata).');
  return null;
}

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

/** Numero massimo di messaggi in memoria (3–4 scambi = 6–8 elementi) */
const CHAT_HISTORY_MAX = 8;

class TonyService {
  constructor() {
    this.model = null;
    this.ai = null;
    this.app = null;
    this._tonyAskCallable = null;
    this.context = {};
    this.onActionCallbacks = [];
    this._ready = false;
    this._useCallable = false;
    this._initPromise = null;
    /** Memoria a breve termine: array di { role: 'user'|'model', parts: [{ text }] } */
    this.chatHistory = [];
  }

  /**
   * Formatta la history per il prompt (testo leggibile da Gemini).
   * @param {Array<{role: string, parts: Array<{text: string}>}>} history
   * @returns {string}
   */
  _formatHistoryForPrompt(history) {
    if (!history || !history.length) return '';
    return history
      .map((m) => {
        const label = m.role === 'user' ? 'Utente' : 'Tony';
        const text = m.parts && m.parts[0] ? m.parts[0].text : '';
        return `${label}: ${text}`;
      })
      .join('\n');
  }

  /**
   * Inizializza Tony (Gemini). Prima prova getAI (SDK); se non disponibile usa Cloud Function callable.
   * @param {import('firebase/app').FirebaseApp} app - Istanza Firebase App da getAppInstance()
   */
  async init(app) {
    if (this._ready && (this.model || this._useCallable)) {
      return;
    }
    if (this._initPromise) {
      return this._initPromise;
    }
    this.app = app;
    this.context.guida_app = GUIDA_APP_PER_TONY;
    this._initPromise = (async () => {
      try {
        const fullGuida = await loadGuidaAppFull();
        if (fullGuida) {
          this.context.guida_app = fullGuida;
          console.log('[Tony] Guida app completa caricata.');
        }
      } catch (_) { /* mantieni condensata */ }
      try {
        const { getAI, getGenerativeModel, GoogleAIBackend } = await import(
          'https://esm.sh/firebase@11/ai'
        );
        this._getGenerativeModel = getGenerativeModel;
        this.ai = getAI(app, { backend: new GoogleAIBackend() });
        this._buildModel();
        this._ready = true;
        return;
      } catch (err) {
        const useCallable = err?.message?.includes('Service AI is not available') || err?.message?.includes('not available');
        if (useCallable) {
          try {
            const { getFunctions, httpsCallable } = await import('https://www.gstatic.com/firebasejs/11.0.0/firebase-functions.js');
            const functions = getFunctions(app, 'europe-west1');
            this._tonyAskCallable = httpsCallable(functions, 'tonyAsk');
            this._useCallable = true;
            this._ready = true;
            console.log('[Tony] Uso Cloud Function tonyAsk (getAI non disponibile in questo build).');
            return;
          } catch (callableErr) {
            console.warn('[Tony] Callable non disponibile:', callableErr);
          }
        }
        console.error('[Tony] Errore inizializzazione AI:', err);
        this._initPromise = null;
        throw err;
      }
    })();
    return this._initPromise;
  }

  _buildModel() {
    if (!this._getGenerativeModel || !this.ai) return;
    const contextJson = JSON.stringify(this.context, null, 2);
    const systemInstruction = SYSTEM_INSTRUCTION_BASE.replace(
      '{CONTESTO_PLACEHOLDER}',
      contextJson || '"Placeholder: nessun dato ancora iniettato"'
    );
    this.model = this._getGenerativeModel(this.ai, {
      model: 'gemini-2.5-flash',
      systemInstruction
    });
  }

  /**
   * Aggiorna il contesto da un modulo. Tony userà questi dati nelle risposte.
   * @param {string} moduleName - Nome modulo (es. 'amministrazione', 'magazzino')
   * @param {Object} data - Dati da iniettare nel contesto
   */
  setContext(moduleName, data) {
    this.context[moduleName] = data;
    if (this._getGenerativeModel && this.ai) {
      this._buildModel();
    }
  }

  /**
   * Estrae dalla risposta eventuali blocchi JSON { "action": "...", "params": {...} } e chiama triggerAction.
   * Restituisce il testo senza i blocchi JSON (per mostrarlo all'utente).
   * @param {string} text - Risposta di Tony
   * @returns {string} Testo pulito (senza il JSON azione)
   */
  _parseAndTriggerActions(text) {
    if (!text || typeof text !== 'string') return text;
    let cleaned = text;
    // Cerca blocchi { "action": "NOME", "params": { ... } } (params può essere annidato, quindi cerchiamo per graffe bilanciate)
    const startMarker = /\{\s*["']action["']\s*:\s*["']/;
    let match = startMarker.exec(cleaned);
    while (match) {
      const start = match.index;
      let depth = 0;
      let i = start;
      while (i < cleaned.length) {
        if (cleaned[i] === '{') depth++;
        else if (cleaned[i] === '}') {
          depth--;
          if (depth === 0) {
            const block = cleaned.slice(start, i + 1);
            try {
              const parsed = JSON.parse(block);
              const actionName = parsed.action;
              const params = parsed.params || {};
              if (actionName) {
                this.triggerAction(actionName, params);
                cleaned = (cleaned.slice(0, start) + cleaned.slice(i + 1)).replace(/\s{2,}/g, ' ').trim();
              }
            } catch (_) { /* JSON non valido, ignora */ }
            break;
          }
        }
        i++;
      }
      match = startMarker.exec(cleaned);
    }
    return cleaned.trim();
  }

  /**
   * Invia una domanda a Tony e restituisce la risposta testuale.
   * Se la risposta contiene un'azione (JSON), viene emessa con triggerAction e il testo restituito è senza il blocco JSON.
   * @param {string} userPrompt - Testo dell'utente
   * @returns {Promise<string>} Risposta di Tony (testo eventualmente ripulito dalle azioni)
   */
  async ask(userPrompt) {
    if (!this._ready) {
      throw new Error('Tony non inizializzato. Chiama Tony.init(app) prima.');
    }
    const historyBloc = this._formatHistoryForPrompt(this.chatHistory);
    const promptSuffix = historyBloc
      ? `Conversazione precedente:\n${historyBloc}\n\nDomanda utente: ${userPrompt}`
      : `Domanda utente: ${userPrompt}`;

    let text;
    if (this._useCallable && this._tonyAskCallable) {
      const { data } = await this._tonyAskCallable({
        message: userPrompt,
        context: this.context,
        history: this.chatHistory
      });
      text = data?.text ?? 'Nessuna risposta da Tony.';
    } else if (this.model) {
      const contextJson = JSON.stringify(this.context, null, 2);
      const fullPrompt = `Contesto attuale: ${contextJson}\n\n${promptSuffix}`;
      const result = await this.model.generateContent(fullPrompt);
      const response = result.response;
      if (!response || !response.text) {
        return 'Non ho ricevuto una risposta valida. Riprova.';
      }
      text = response.text();
    } else {
      throw new Error('Tony non inizializzato. Chiama Tony.init(app) prima.');
    }

    const cleaned = this._parseAndTriggerActions(text);

    this.chatHistory.push({ role: 'user', parts: [{ text: userPrompt }] });
    this.chatHistory.push({ role: 'model', parts: [{ text: cleaned }] });
    while (this.chatHistory.length > CHAT_HISTORY_MAX) {
      this.chatHistory.shift();
    }

    return cleaned;
  }

  /**
   * Invia una domanda a Tony con streaming. Emette chunk via onChunk; restituisce il testo completo finale.
   * Se usa Cloud Function (callable), fa fallback su ask() senza streaming.
   * @param {string} userPrompt - Testo dell'utente
   * @param {{ onChunk?: (chunk: string) => void }} opts - Callback per ogni chunk di testo
   * @returns {Promise<string>} Risposta completa (testo ripulito dalle azioni)
   */
  async askStream(userPrompt, opts = {}) {
    if (!this._ready) {
      throw new Error('Tony non inizializzato. Chiama Tony.init(app) prima.');
    }
    const onChunk = opts.onChunk || (() => {});

    if (this._useCallable && this._tonyAskCallable) {
      const text = await this.ask(userPrompt);
      return text;
    }

    if (!this.model) {
      throw new Error('Tony non inizializzato. Chiama Tony.init(app) prima.');
    }

    const historyBloc = this._formatHistoryForPrompt(this.chatHistory);
    const promptSuffix = historyBloc
      ? `Conversazione precedente:\n${historyBloc}\n\nDomanda utente: ${userPrompt}`
      : `Domanda utente: ${userPrompt}`;
    const contextJson = JSON.stringify(this.context, null, 2);
    const fullPrompt = `Contesto attuale: ${contextJson}\n\n${promptSuffix}`;

    let fullText = '';
    const result = await this.model.generateContentStream(fullPrompt);
    for await (const chunk of result.stream) {
      const chunkText = chunk.text?.() ?? '';
      if (chunkText) {
        fullText += chunkText;
        onChunk(chunkText);
      }
    }
    const response = await result.response;
    if (response?.text) {
      fullText = response.text();
    }

    const cleaned = this._parseAndTriggerActions(fullText);

    this.chatHistory.push({ role: 'user', parts: [{ text: userPrompt }] });
    this.chatHistory.push({ role: 'model', parts: [{ text: cleaned }] });
    while (this.chatHistory.length > CHAT_HISTORY_MAX) {
      this.chatHistory.shift();
    }

    return cleaned;
  }

  /**
   * Registra un callback che verrà chiamato quando Tony emette un'azione.
   * @param {function(actionName: string, params: Object): void} callback
   */
  onAction(callback) {
    if (typeof callback === 'function') {
      this.onActionCallbacks.push(callback);
    }
  }

  /**
   * Emette un'azione verso i moduli iscritti (chiamato dal service quando Gemini restituisce un'azione).
   * @param {string} actionName - Nome azione (es. 'APRI_PAGINA', 'SEGNA_ATTIVITA')
   * @param {Object} params - Parametri dell'azione
   */
  triggerAction(actionName, params) {
    this.onActionCallbacks.forEach((cb) => {
      try {
        cb(actionName, params || {});
      } catch (e) {
        console.error('[Tony] Errore in onAction callback:', e);
      }
    });
  }

  /**
   * Indica se Tony è pronto (init completato).
   */
  isReady() {
    return this._ready && (!!this.model || this._useCallable);
  }
}

// Singleton
export const Tony = new TonyService();
export default Tony;
