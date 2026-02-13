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
5. Navigazione: usa target dalla mappa. Target disponibili: dashboard, terreni, attivita, lavori, segnatura ore, segnare ore, validazione ore, validare ore, lavori caposquadra, i miei lavori, statistiche, statistiche manodopera, statistiche ore, gestisci utenti, utenti, gestione squadre, squadre, gestione operai, operai, compensi operai, compensi, gestione macchine, macchine, magazzino, prodotti, movimenti, vigneto, vigneti, statistiche vigneto, vendemmia, potatura vigneto, trattamenti vigneto, calcolo materiali, calcolo materiali frutteto, pianificazione impianto, impianto, frutteto, frutteti, statistiche frutteto, raccolta frutta, potatura frutteto, trattamenti frutteto, conto terzi, clienti, preventivi, tariffe, terreni clienti, mappa clienti, report, amministrazione, guasti, abbonamento, impostazioni, diario. Regole: (a) dashboard/manager → dashboard; (b) segnare ore: se moduli_attivi include manodopera → segnatura ore; altrimenti → attivita (Diario Attività); (c) validare ore → validazione ore; (d) statistiche manodopera/ore (con Manodopera) → statistiche manodopera; (e) calcolo materiali impianto → calcolo materiali; (f) vendemmia/potatura/trattamenti: specifica vigneto o frutteto se ambiguo. (g) SE segnare ore / registrare ore: esegui SUBITO OPEN_MODAL (attivita-modal o ora-modal) e poi chiedi i dati. Non chiedere prima i dati e poi aprire; apri il modal subito, poi chiedi terreno, data, ecc.
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

  _buildModel(contextOverride) {
    if (!this._getGenerativeModel || !this.ai) return;
    const ctx = contextOverride !== undefined ? contextOverride : this.context;
    const contextJson = JSON.stringify(ctx, null, 2);
    const systemInstruction = SYSTEM_INSTRUCTION_BASE.replace(
      '{CONTESTO_PLACEHOLDER}',
      contextJson || '"Placeholder: nessun dato ancora iniettato"'
    );
    this.model = this._getGenerativeModel(this.ai, {
      model: 'gemini-2.0-flash',
      systemInstruction
    });
  }

  _getContextForPrompt() {
    if (this.chatHistory.length === 0) return this.context;
    const { guida_app, ...rest } = this.context;
    return rest;
  }

  /**
   * Helper: Inizializza il context di Tony con i moduli attivi dal tenant.
   * Da chiamare nelle pagine standalone dopo aver caricato i dati del tenant.
   * @param {Array<string>} modules - Array di moduli attivi (es. ['vigneto', 'tony', ...])
   * @param {number} maxRetries - Numero massimo di tentativi se Tony non è ancora disponibile (default: 10)
   */
  static async initContextWithModules(modules, maxRetries = 10) {
    if (!Array.isArray(modules)) {
      console.warn('[Tony] initContextWithModules: modules deve essere un array');
      return;
    }
    
    const initContext = (retries = 0) => {
      if (window.Tony && typeof window.Tony.setContext === 'function') {
        window.Tony.setContext('dashboard', {
          info_azienda: { moduli_attivi: modules },
          moduli_attivi: modules
        });
        console.log('[Tony] Context inizializzato con moduli:', modules);
        return true;
      } else if (retries < maxRetries) {
        setTimeout(() => {
          initContext(retries + 1);
        }, 500);
        return false;
      } else {
        console.warn('[Tony] Impossibile inizializzare context: Tony non disponibile dopo', maxRetries, 'tentativi');
        return false;
      }
    };
    
    return initContext();
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
   * Estrae dalla risposta eventuali blocchi JSON e chiama triggerAction.
   * Riconosce sia { "action": "...", "params": {...} } sia { "text": "...", "command": { "type": "...", ... } }.
   * Restituisce solo il testo pulito per display e TTS.
   * @param {string} text - Risposta di Tony
   * @returns {string} Testo pulito (senza i blocchi JSON)
   */
  _parseAndTriggerActions(text) {
    if (!text || typeof text !== 'string') return text;
    let cleaned = text;
    // 1. Cerca blocchi { "action": "NOME", "params": { ... } }
    const actionMarker = /\{\s*["']action["']\s*:\s*["']/;
    let match = actionMarker.exec(cleaned);
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
      match = actionMarker.exec(cleaned);
    }
    // 2. Cerca blocchi { "text": "...", "command": { "type": "...", ... } }
    const commandMarker = /\{\s*["']text["']\s*:\s*["']/;
    match = commandMarker.exec(cleaned);
    if (match) {
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
              const cmd = parsed.command;
              if (cmd && typeof cmd === 'object' && cmd.type) {
                this.triggerAction(cmd.type, cmd);
                cleaned = (parsed.text || '').trim() || (cleaned.slice(0, start) + cleaned.slice(i + 1)).replace(/\s{2,}/g, ' ').trim();
              }
            } catch (_) { /* JSON non valido, ignora */ }
            break;
          }
        }
        i++;
      }
    }
    // 3. Cerca blocchi standalone { "type": "OPEN_MODAL"|"SET_FIELD"|"CLICK_BUTTON", ... }
    const typeMarker = /\{\s*["']type["']\s*:\s*["'](?:OPEN_MODAL|SET_FIELD|CLICK_BUTTON)["']/;
    match = typeMarker.exec(cleaned);
    if (match) {
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
              if (parsed.type) {
                this.triggerAction(parsed.type, parsed);
                cleaned = (cleaned.slice(0, start) + cleaned.slice(i + 1)).replace(/\s{2,}/g, ' ').trim();
              }
            } catch (_) { /* JSON non valido, ignora */ }
            break;
          }
        }
        i++;
      }
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

    const contextForPrompt = this._getContextForPrompt();
    // DEBUG: Log context che viene passato alla Cloud Function
    // IMPORTANTE: context.form.fields (stato attuale del form) deve essere impostato dal widget
    // tramite setContext('form', formCtx) prima di ask(), così Gemini sa cosa è già compilato e cosa manca.
    console.log('[Tony Service] DEBUG - contextForPrompt passato a Cloud Function:', JSON.stringify(contextForPrompt, null, 2));
    console.log('[Tony Service] DEBUG - moduli_attivi nel context:', contextForPrompt.moduli_attivi || contextForPrompt.dashboard?.moduli_attivi || contextForPrompt.info_azienda?.moduli_attivi || []);
    
    let text;
    if (this._useCallable && this._tonyAskCallable) {
      const { data: rawData } = await this._tonyAskCallable({
        message: userPrompt,
        context: contextForPrompt,
        history: this.chatHistory
      });
      console.log('[DEBUG FINAL] Dati grezzi:', rawData);
      let parsedData = {};
      const fullResponseText = typeof rawData === 'string' ? rawData : (rawData && typeof rawData.text === 'string' ? rawData.text : '');
      if (fullResponseText && fullResponseText.includes('```json') && typeof window !== 'undefined' && window.TonyFormInjector && window.TonyFormInjector.extractFormDataFromText) {
        const extracted = window.TonyFormInjector.extractFormDataFromText(fullResponseText);
        if (extracted && extracted.formData && Object.keys(extracted.formData).length > 0) {
          parsedData = { text: extracted.cleanedText || extracted.replyText || 'Ok.', command: { type: 'INJECT_FORM_DATA', formId: 'attivita-form', formData: extracted.formData } };
          console.log('[Tony Service] Blocco ```json rilevato: uso SOLO INJECT_FORM_DATA, annullo eventuali SET_FIELD');
        }
      }
      if (parsedData.command && parsedData.command.type === 'INJECT_FORM_DATA') {
        text = parsedData.text ?? 'Ok.';
        const cmdParams = { formId: parsedData.command.formId, formData: parsedData.command.formData };
        this.triggerAction('INJECT_FORM_DATA', cmdParams);
      } else {
      try {
        if (typeof rawData === 'object' && rawData !== null) {
          parsedData = rawData;
        } else if (typeof rawData === 'string') {
          // Prova prima con JSON completo
          let jsonMatch = rawData.match(/\{[\s\S]*\}/);
          
          // Se non trova JSON completo, cerca JSON troncato
          if (!jsonMatch) {
            console.log('[Tony Service] JSON completo non trovato, cerco JSON troncato...');
            const incompleteMatch = rawData.match(/\{[^{}]*["']?(?:text|command|type)["']?\s*:/);
            if (incompleteMatch) {
              const startIdx = rawData.indexOf('{');
              let incompleteJson = rawData.substring(startIdx);
              // Conta parentesi e completa se necessario
              const openBraces = (incompleteJson.match(/\{/g) || []).length;
              const closeBraces = (incompleteJson.match(/\}/g) || []).length;
              const missingBraces = openBraces - closeBraces;
              console.log('[Tony Service] Parentesi mancanti:', missingBraces);
              
              if (missingBraces > 0) {
                incompleteJson = incompleteJson + '}'.repeat(missingBraces);
                jsonMatch = [incompleteJson];
              } else {
                // Prova comunque anche se sembra completo
                jsonMatch = [incompleteJson];
              }
            }
          }
          
          if (jsonMatch) {
            try {
              parsedData = JSON.parse(jsonMatch[0]);
            } catch (parseErr) {
              console.warn('[Tony Service] Errore parsing JSON, provo trimming progressivo...');
              // Prova trimming progressivo
              let toParse = jsonMatch[0];
              for (let i = 0; i < 30 && toParse.length > 10; i++) {
                toParse = toParse.slice(0, -1).trim();
                // Assicurati che finisca con }
                while (toParse.length > 0 && !toParse.endsWith('}')) {
                  toParse = toParse.slice(0, -1);
                }
                if (toParse.length === 0) break;
                try {
                  parsedData = JSON.parse(toParse);
                  console.log('[Tony Service] JSON parsato dopo trimming (tentativo', i + 1, ')');
                  break;
                } catch (_) {
                  // Continua
                }
              }
              if (!parsedData || typeof parsedData !== 'object') {
                throw parseErr;
              }
            }
          } else {
            parsedData = { text: rawData };
          }
        } else {
          parsedData = { text: 'Nessuna risposta da Tony.' };
        }
      } catch (e) {
        console.error('[ERRORE PARSING] Tony ha mandato un formato rotto:', e);
        parsedData = { text: typeof rawData === 'string' ? rawData : 'Nessuna risposta da Tony.' };
      }
      text = parsedData.text ?? 'Nessuna risposta da Tony.';
      if (parsedData.command && typeof parsedData.command === 'object' && parsedData.command.type) {
        console.log('[Tony] ESEGUO COMANDO:', parsedData.command);
        this.triggerAction(parsedData.command.type, parsedData.command);
      }
      
      // Se il parsing è fallito ma abbiamo ancora la stringa grezza con JSON, 
      // includiamola nel testo così il widget può provare a parsarla
      if (typeof rawData === 'string' && rawData.includes('"command"') && !parsedData.command) {
        console.log('[Tony Service] Parsing fallito ma JSON presente nella risposta grezza, includo nel testo per parsing nel widget');
        // Restituisci la stringa grezza così il widget può provare a parsarla
        return rawData;
      }
      }
    } else if (this.model) {
      this._buildModel(contextForPrompt);
      const contextJson = JSON.stringify(contextForPrompt, null, 2);
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

    const contextForPrompt = this._getContextForPrompt();
    this._buildModel(contextForPrompt);
    const historyBloc = this._formatHistoryForPrompt(this.chatHistory);
    const promptSuffix = historyBloc
      ? `Conversazione precedente:\n${historyBloc}\n\nDomanda utente: ${userPrompt}`
      : `Domanda utente: ${userPrompt}`;
    const contextJson = JSON.stringify(contextForPrompt, null, 2);
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
