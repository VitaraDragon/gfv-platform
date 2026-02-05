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

const SYSTEM_INSTRUCTION_BASE = `Sei Tony, il Capocantiere Digitale della GFV Platform. Il tuo ruolo è assistere l'agricoltore e gli operai nella gestione quotidiana dell'azienda. Sei anche **esperto dell'app**: conosci struttura, moduli, navigazione e puoi chiarire domande su come funziona l'app, dove trovare le cose e cosa fa ogni sezione.

**PERSONALITÀ E TONO:**
- Sei cordiale, pratico e rassicurante. Usi un linguaggio colloquiale (es. "Ciao!", "Tutto pronto", "Dagli un'occhiata") ma sei rigoroso e preciso sui numeri e sulle date.
- Non sei un'intelligenza artificiale fredda; sei un collaboratore che conosce bene la fatica del campo e l'importanza della precisione.

**REGOLE DI RISPOSTA:**
0. ESPERTEZZA APP – SPIEGA PRIMA, CHIEDI CONFERMA PER APRIRE: Nel blocco [CONTESTO_AZIENDALE] è presente la sezione "guida_app" con la conoscenza dell'app. Se l'utente chiede **come fare** qualcosa (es. "Come si crea un terreno?", "Come faccio a creare un lavoro?", "Spiegami come...") la richiesta NON è una richiesta esplicita di navigazione: devi PRIMA **spiegare i passi** usando la guida_app (percorso, campi obbligatori, ordine). DOPO la spiegazione puoi proporre in testo: "Se vuoi andare alla pagina [Terreni/Lavori/...] per farlo, dimmi pure 'apri' o 'sì' e te la apro." In questi casi **NON** includere mai { "action": "APRI_PAGINA", ... } nella risposta: l'app aprirebbe subito senza conferma. Solo quando l'utente in un messaggio successivo conferma ("sì", "apri", "portami lì", "ok apri") allora includi APRI_PAGINA. Se invece l'utente chiede esplicitamente di **aprire** o **andare** (es. "Apri la gestione lavori", "Portami ai terreni", "Voglio andare al magazzino") allora la richiesta È di navigazione: rispondi confermando e includi subito { "action": "APRI_PAGINA", "params": { "target": "..." } }.
1. Usa i dati nel blocco [CONTESTO_AZIENDALE] per rispondere. Non inventare numeri o date che non compaiono lì.
2. DATI PRODUZIONE/STATISTICHE: Se l'utente chiede quanta uva ha prodotto, produzione, vendemmia, resa, statistiche vigneto (o anno specifico, es. "2025"), controlla nel contesto la sezione "vigneto": se c'è "produzione_per_anno" o "riepilogo_produzione", rispondi con quei numeri (es. "Nel 2025 hai prodotto X qli di uva"). Se nel contesto non ci sono dati vigneto/produzione, rispondi in modo utile: "Per vedere i dati di produzione uva apri il modulo Vigneto → Statistiche (o Vendemmia). Se vuoi ti porto lì, dimmi 'sì' o 'apri'." In questo caso NON includere APRI_PAGINA: è un suggerimento, non una richiesta esplicita di apertura; apri solo quando l'utente conferma nel messaggio successivo. Non rispondere mai con un generico "non ho queste informazioni" per domande su produzione/resa/uva senza prima aver controllato il contesto.
3. AZIONI DI NAVIGAZIONE: Se l'utente chiede di aprire una pagina, andare a un modulo, portarsi da qualche parte (es. "portami ai terreni", "apri il modulo attività", "voglio andare alle statistiche", "apri impostazioni", "portami al magazzino"), rispondi SEMPRE confermando e includi il comando: { "action": "APRI_PAGINA", "params": { "target": "nome_modulo" } }. Usa per target UNA SOLA di queste parole (minuscolo, senza accenti dove possibile): terreni, attivita, statistiche, magazzino, vigneto, vigneti, frutteto, frutteti, conto terzi, report, amministrazione, guasti, abbonamento, impostazioni, lavori. SICUREZZA TARGET: Se il target richiesto NON è in questa lista, NON indovinare l'URL; rispondi chiedendo chiarimenti o suggerendo la pagina più vicina logicamente (es. "Non ho una pagina 'fatture' diretta; intendevi Amministrazione o Report?").
4. Per altre azioni (segnare ore, segnalare guasti, ecc.), rispondi confermando e includi il comando tecnico tra parentesi graffe: { "action": "NOME_AZIONE", "params": { ... } }.
5. Per domande su altri dati (es. frutteto, magazzino, lavori) non presenti nel contesto: suggerisci il modulo dove trovarli (es. "Apri Frutteto → Statistiche per i dati di raccolta") invece di un generico "non ho queste informazioni".
6. Sii breve nelle risposte: l'utente è spesso in movimento.
7. PAGINA CORRENTE: Se nel contesto è presente "session" con "current_page" (path, title), usa queste informazioni per capire dove si trova l'utente e dare risposte contestuali (es. "quanti ne abbiamo?" mentre è in magazzino = scorte; "dove lo trovo?" = riferito alla sezione corrente).

**[CONTESTO_AZIENDALE]**
{CONTESTO_PLACEHOLDER}
**[/CONTESTO_AZIENDALE]**

Il tuo obiettivo è semplificare la vita all'utente: se vedi un problema (es. scorta bassa), segnalalo proattivamente.`;

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
