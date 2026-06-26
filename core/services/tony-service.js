/**
 * Tony Service - Assistente IA (Gemini) per GFV Platform
 * Modulo dedicato: Singleton + Event Bus. Solo questo modulo parla con Gemini.
 * @see docs-sviluppo/GUIDA_SVILUPPO_TONY.md
 * @module core/services/tony-service
 */

import { GUIDA_APP_PER_TONY } from './tony-guida-app.js';
import { normalizeTonyCommand, resolveTonyUserVisibleText } from '../js/tony/engine.js';
import { isTonySaveConfirmText, isTonyQuickHoursCfFakeSaveText } from '../js/tony-form-save-local.js';
import { tryTonyTerrenoEntityParse } from '../js/tony-terreno-entity-parser.js';

/** Blocca QUICK_SAVE CF su workspace Segna ore senza conferma utente («sì»/«salva»). */
function _blockFieldWorkspaceQuickHoursSaveCommand(command, historyUserText, context) {
  if (!command || !command.type) return false;
  const cmd = String(command.type).toUpperCase();
  if (cmd !== 'QUICK_SAVE' && cmd !== 'SUBMIT_FORM' && cmd !== 'SUBMIT' && cmd !== 'SALVA' && cmd !== 'SAVE') {
    return false;
  }
  const fid = String(command.formId || command.id || '').toLowerCase();
  const ctxForm =
    context && context.form && context.form.formId ? String(context.form.formId).toLowerCase() : '';
  const pagePath =
    context && context.page && context.page.pagePath ? String(context.page.pagePath).toLowerCase() : '';
  const onField =
    fid.indexOf('field-workspace') >= 0 ||
    fid.indexOf('quick-hours') >= 0 ||
    ctxForm === 'field-workspace-ore-form' ||
    pagePath.indexOf('field-workspace') >= 0;
  if (!onField) return false;
  const up = String(historyUserText || '').trim();
  return !isTonySaveConfirmText(up);
}

/**
 * Ordine di caricamento guida markdown per Tony.
 * Ogni voce: path relativo alla base; più candidate di base provate in ordine (deploy core vs repo dev).
 * Strategia: prima il linguaggio e i passi **utente** (stesso tono delle risposte), poi **guida tecnica** e intersezioni.
 * @see docs-sviluppo/GUIDA/README.md
 */
const GUIDA_LOAD_ENTRIES = [
  { path: 'CORE/utente/guida.md', bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/'] },
  { path: 'CORE/tony/guida-tecnica.md', bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/'] },
  { path: 'TONY/utente/guida.md', bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/'] },
  { path: 'TONY/tony/guida-tecnica.md', bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/'] },
  { path: 'INTERSEZIONI/tony/intersezioni.md', bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/'] },
  { path: 'PARCO_MACCHINE/utente/guida.md', bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/'] },
  { path: 'PARCO_MACCHINE/tony/guida-tecnica.md', bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/'] },
  { path: 'VIGNETO/utente/guida.md', bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/'] },
  { path: 'VIGNETO/tony/guida-tecnica.md', bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/'] },
  { path: 'FRUTTETO/utente/guida.md', bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/'] },
  { path: 'FRUTTETO/tony/guida-tecnica.md', bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/'] },
  { path: 'MAGAZZINO/utente/guida.md', bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/'] },
  { path: 'MAGAZZINO/tony/guida-tecnica.md', bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/'] },
  { path: 'MANODOPERA/utente/guida.md', bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/'] },
  { path: 'MANODOPERA/utente/guida-manager.md', bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/'] },
  { path: 'MANODOPERA/utente/guida-caposquadra.md', bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/'] },
  { path: 'MANODOPERA/utente/guida-operaio.md', bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/'] },
  { path: 'MANODOPERA/tony/guida-tecnica.md', bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/'] },
  { path: 'CONTO_TERZI/utente/guida.md', bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/'] },
  { path: 'CONTO_TERZI/tony/guida-tecnica.md', bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/'] },
  { path: 'METEO/utente/guida.md', bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/'] },
  { path: 'METEO/tony/guida-tecnica.md', bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/'] },
  { path: 'moduli/terreni.md', bases: ['../guida-app/', '../../docs-sviluppo/guida-app/'] },
  { path: 'moduli/lavori-attivita.md', bases: ['../guida-app/', '../../docs-sviluppo/guida-app/'] }
];

/**
 * @param {URL} scriptBase - import.meta.url del service
 * @param {{ path: string, bases: string[] }} entry
 * @returns {Promise<string>}
 */
async function fetchGuidaMarkdownPart(scriptBase, entry) {
  for (let i = 0; i < entry.bases.length; i++) {
    try {
      const url = new URL(entry.bases[i] + entry.path, scriptBase).href;
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length) return text;
      }
    } catch (_) { /* prova base successiva */ }
  }
  return '';
}

/**
 * Carica la guida app completa dai file .md (cartella GUIDA + legacy guida-app/moduli).
 * Fallback: null → versione condensata in tony-guida-app.js.
 * @returns {Promise<string|null>}
 */
async function loadGuidaAppFull() {
  const scriptBase = new URL(import.meta.url);
  const parts = [];
  for (let j = 0; j < GUIDA_LOAD_ENTRIES.length; j++) {
    const t = await fetchGuidaMarkdownPart(scriptBase, GUIDA_LOAD_ENTRIES[j]);
    if (t) parts.push(t);
  }
  const full = parts.join('\n\n---\n\n');
  if (full.length > 100) return full;
  console.warn('[Tony] Guida completa non caricabile (uso versione condensata).');
  return null;
}

/** Riassunto sempre corto (fetch da CORE/utente/guida-sintesi.md); resta nel contesto anche dopo il primo messaggio. */
const GUIDA_SINTESI_ENTRY = {
  path: 'CORE/utente/guida-sintesi.md',
  bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/']
};

/**
 * Sotto questa lunghezza `guida_app` è probabilmente solo il fallback condensato:
 * nel primo messaggio si allega anche guida_sintesi per non perdere i passi Core.
 */
const GUIDA_APP_FULL_THRESHOLD_CHARS = 12000;

/** Modello Gemini SDK locale (callable usa functions/index.js TONY_GEMINI_MODEL). */
const TONY_GEMINI_MODEL = 'gemini-2.5-flash';

const GUIDA_SINTESI_FALLBACK = `
GFV Core (sintesi): Impostazioni prima (azienda e poderi). Terreni con Traccia confini e Salva terreno. Diario attività per le giornate in campo. Dashboard con mappa se i confini sono già tracciati. Statistiche con filtri e Applica filtri. Menu con freccetta: rispetta l ordine delle scelte in schermata. Ruolo e moduli cambiano cosa vedi.
`.trim();

async function loadGuidaSintesi() {
  const scriptBase = new URL(import.meta.url);
  return fetchGuidaMarkdownPart(scriptBase, GUIDA_SINTESI_ENTRY);
}

/** Riassunto modulo Parco Macchine (fetch da PARCO_MACCHINE/utente/guida-sintesi.md). */
const GUIDA_SINTESI_PARCO_MACCHINE_ENTRY = {
  path: 'PARCO_MACCHINE/utente/guida-sintesi.md',
  bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/']
};

const GUIDA_SINTESI_PARCO_MACCHINE_FALLBACK = `
Parco Macchine (sintesi): solo se modulo parcoMacchine attivo. Dashboard → Parco Macchine → hub con azioni rapide. Trattori e attrezzi: ore e manutenzione per ore/data. Flotta (furgone/automezzo/veicolo): km e tagliando km; revisione e assicurazione per data. Gestione macchine, scadenze (incluso Tagliando km), officina e guasti. Diario: trattore/attrezzo/ore macchina opzionali; la flotta stradale non usa ore nel Diario.
`.trim();

async function loadGuidaSintesiParcoMacchine() {
  const scriptBase = new URL(import.meta.url);
  return fetchGuidaMarkdownPart(scriptBase, GUIDA_SINTESI_PARCO_MACCHINE_ENTRY);
}

/** Riassunto modulo Vigneto (fetch da VIGNETO/utente/guida-sintesi.md). */
const GUIDA_SINTESI_VIGNETO_ENTRY = {
  path: 'VIGNETO/utente/guida-sintesi.md',
  bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/']
};

const GUIDA_SINTESI_VIGNETO_FALLBACK = `
Vigneto (sintesi): solo se modulo vigneto attivo. Dashboard Vigneto (Manager/Admin): statistiche e azioni rapide. Anagrafica vigneti; registri trattamenti, concimazioni, potatura, vendemmia; statistiche; pianifica impianto; calcolo materiali. Tony: riepilogo da dashboard quando presente; su Gestione vendemmia e Concimazioni può leggere l elenco tabellare come in schermata.
`.trim();

async function loadGuidaSintesiVigneto() {
  const scriptBase = new URL(import.meta.url);
  return fetchGuidaMarkdownPart(scriptBase, GUIDA_SINTESI_VIGNETO_ENTRY);
}

/** Riassunto modulo Frutteto (fetch da FRUTTETO/utente/guida-sintesi.md). */
const GUIDA_SINTESI_FRUTTETO_ENTRY = {
  path: 'FRUTTETO/utente/guida-sintesi.md',
  bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/']
};

const GUIDA_SINTESI_FRUTTETO_FALLBACK = `
Frutteto (sintesi): solo se modulo frutteto attivo. Dashboard Frutteto: panoramica, raccolte recenti, lavori frutteto. Anagrafica frutteti. Trattamenti, concimazioni, potatura: righe in lista dopo lavoro o Diario sul terreno con categoria giusta, poi completamento in modulo; raccolta frutta soprattutto da Raccolta frutta. Statistiche. Pianifica/Calcolo materiali: strumento condiviso con altri moduli coltura; dal frutteto si entra dalla Dashboard Frutteto (azioni rapide), poi file e piante, sesto, orientamento, carraie; non usare checklist/dashboard vigneto per chi opera in frutteto. Tony: guida testuale; su Concimazioni frutteto spesso elenco tabellare come in schermata.
`.trim();

async function loadGuidaSintesiFrutteto() {
  const scriptBase = new URL(import.meta.url);
  return fetchGuidaMarkdownPart(scriptBase, GUIDA_SINTESI_FRUTTETO_ENTRY);
}

/** Riassunto modulo Magazzino (fetch da MAGAZZINO/utente/guida-sintesi.md). */
const GUIDA_SINTESI_MAGAZZINO_ENTRY = {
  path: 'MAGAZZINO/utente/guida-sintesi.md',
  bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/']
};

const GUIDA_SINTESI_MAGAZZINO_FALLBACK = `
Magazzino (sintesi): solo se modulo magazzino attivo. Home Prodotti e Magazzino: riepilogo e azioni rapide. Anagrafica prodotti; movimenti entrata/uscita; tracciabilità consumi (filtri e viste). Sotto scorta da soglie. Scarichi da Vigneto/Frutteto se abilitati. Tony: liste prodotti/movimenti/tracciabilità con currentTableData dove esposto.
`.trim();

async function loadGuidaSintesiMagazzino() {
  const scriptBase = new URL(import.meta.url);
  return fetchGuidaMarkdownPart(scriptBase, GUIDA_SINTESI_MAGAZZINO_ENTRY);
}

/** Riassunto modulo Meteo (fetch da METEO/utente/guida-sintesi.md). */
const GUIDA_SINTESI_METEO_ENTRY = {
  path: 'METEO/utente/guida-sintesi.md',
  bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/']
};

const GUIDA_SINTESI_METEO_FALLBACK = `
Meteo (sintesi): piano Free = nessun meteo. Base senza modulo = Meteo sede in dashboard (Impostazioni sede). Modulo meteo attivo = Moduli → Meteo, mappa campi, pageType meteo_dashboard con currentTableData. Tony briefing con Avanzato.
`.trim();

async function loadGuidaSintesiMeteo() {
  const scriptBase = new URL(import.meta.url);
  return fetchGuidaMarkdownPart(scriptBase, GUIDA_SINTESI_METEO_ENTRY);
}

/** Riassunto modulo Manodopera (fetch da MANODOPERA/utente/guida-sintesi.md). */
const GUIDA_SINTESI_MANODOPERA_ENTRY = {
  path: 'MANODOPERA/utente/guida-sintesi.md',
  bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/']
};

const GUIDA_SINTESI_MANODOPERA_FALLBACK = `
Manodopera (sintesi): solo se modulo manodopera attivo. Manager: versione desktop, gestione squadre (solo manager), operai, compensi, validazione ore globale, statistiche manodopera, gestione lavori. Caposquadra: versione mobile con comunicazioni squadra, validazione ore operai, segna ore, dettaglio lavoro/zone; non gestisce composizione squadre. Operaio: versione mobile (schede Lavoro, Ore, Statistiche), segna ore, dettaglio lavoro/zone; non usa Diario manageriale. Tony: target segnatura/validazione/operai/squadre/compensi/statistiche manodopera; pageType field_workspace / lavori_caposquadra / lavori con currentTableData se presente.
`.trim();

async function loadGuidaSintesiManodopera() {
  const scriptBase = new URL(import.meta.url);
  return fetchGuidaMarkdownPart(scriptBase, GUIDA_SINTESI_MANODOPERA_ENTRY);
}

/** Riassunto modulo Conto Terzi (fetch da CONTO_TERZI/utente/guida-sintesi.md). */
const GUIDA_SINTESI_CONTO_TERZI_ENTRY = {
  path: 'CONTO_TERZI/utente/guida-sintesi.md',
  bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/']
};

const GUIDA_SINTESI_CONTO_TERZI_FALLBACK = `
Conto Terzi (sintesi): solo se modulo conto terzi attivo. Home Conto Terzi: panoramica clienti, preventivi, terreni clienti, lavori da pianificare e Diario filtrato. Clienti, terreni clienti, mappa consultativa; tariffe: tariffa finale = base €/ha × coefficiente; coefficienti morfologia in Impostazioni (pianura 1,0; collina/montagna da percentuali o default 1,2/1,5) per creare tre morfologie insieme o Duplica; tariffa singola con tipo campo e coefficiente manuali; allineare tipo lavoro ai preventivi. Nuovo preventivo, lista preventivi (bozza, invio, accettazione, pianifica). Tony: target conto terzi, clienti, preventivi, tariffe, terreni clienti, mappa clienti.
`.trim();

async function loadGuidaSintesiContoTerzi() {
  const scriptBase = new URL(import.meta.url);
  return fetchGuidaMarkdownPart(scriptBase, GUIDA_SINTESI_CONTO_TERZI_ENTRY);
}

/** Riassunto modulo Tony (fetch da TONY/utente/guida-sintesi.md). */
const GUIDA_SINTESI_TONY_ENTRY = {
  path: 'TONY/utente/guida-sintesi.md',
  bases: ['../GUIDA/', '../../docs-sviluppo/GUIDA/']
};

const GUIDA_SINTESI_TONY_FALLBACK = `
Tony (sintesi): assistente chat; widget e voce se previsto. Tony Guida vs modulo Tony (Avanzato): navigazione e automazioni solo con modulo attivo; piano free senza widget. Liste: dati visibili; profilo campo limitato. Conferme brevi dopo domande Tony. Briefing dashboard manager solo con modulo Tony.
`.trim();

async function loadGuidaSintesiTony() {
  const scriptBase = new URL(import.meta.url);
  return fetchGuidaMarkdownPart(scriptBase, GUIDA_SINTESI_TONY_ENTRY);
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
5. Navigazione: usa target dalla mappa. Target disponibili: dashboard, terreni, attivita, lavori, segnatura ore, segnare ore, validazione ore, validare ore, lavori caposquadra, i miei lavori, statistiche, statistiche manodopera, statistiche ore, gestisci utenti, utenti, gestione squadre, squadre, gestione operai, operai, compensi operai, compensi, gestione macchine, macchine, magazzino, prodotti, movimenti, meteo, previsioni meteo, vigneto, vigneti, statistiche vigneto, vendemmia, potatura vigneto, trattamenti vigneto, calcolo materiali, calcolo materiali frutteto, pianificazione impianto, pianificazione impianto frutteto, impianto, frutteto, frutteti, statistiche frutteto, raccolta frutta, potatura frutteto, trattamenti frutteto, conto terzi, clienti, preventivi, tariffe, terreni clienti, mappa clienti, report, amministrazione, guasti, abbonamento, impostazioni, diario. Regole: (a) dashboard/manager → dashboard; (b) segnare ore: se moduli_attivi include manodopera → segnatura ore; altrimenti → attivita (Diario Attività); (c) validare ore → validazione ore; (d) statistiche manodopera/ore (con Manodopera) → statistiche manodopera; (e) calcolo materiali vigneto → calcolo materiali; calcolo materiali frutteto → calcolo materiali frutteto; (f) vendemmia/potatura/trattamenti: specifica vigneto o frutteto se ambiguo; **pianifica nuovo impianto / calcolo materiali**: strumento condiviso tra moduli coltura; usa **page.pagePath** (o titolo pagina): se contiene vigneto → Dashboard Vigneto e target pianificazione impianto / calcolo materiali; se contiene frutteto → Dashboard Frutteto e target pianificazione impianto frutteto / calcolo materiali frutteto; se non è chiaro, una frase generica sullo strumento condiviso e chiedi vigneto o frutteto. Non applicare la checklist dell'altro modulo. (g) SE segnare ore / registrare ore: esegui SUBITO OPEN_MODAL (attivita-modal o ora-modal) e poi chiedi i dati. Non chiedere prima i dati e poi aprire; apri il modal subito, poi chiedi terreno, data, ecc.; (h) meteo / previsioni: target **meteo** solo se modulo meteo attivo; altrimenti spiega **Meteo sede** in dashboard (piano Base) e Impostazioni sede.
6. Altre azioni (SEGNA_ORE, GUASTO): Conferma + JSON azione.
7. MEMORIA VOCALE: Se l'utente risponde con poche parole (es. "Sì", "Vai", "Ok apri"), guarda l'ultimo messaggio che hai scritto per capire a cosa si riferisce e agisci di conseguenza.
8. DATI IN TABELLA: Se il contesto include page.currentTableData o page.tableDataSummary, usa SOLO quelli per rispondere a domande sui dati visibili (es. "Cosa scade?", "Quali trattori ci sono?", "Ci sono guasti aperti?"). Rispondi in base a summary e/o items; non inventare dati. Se tableDataSummary è "Caricamento dati in corso..." rispondi: "Sto ancora leggendo i dati della lista, dammi un attimo di pazienza." Se tableDataSummary è "Dati non disponibili" o mancano page.currentTableData e page.tableDataSummary, NON dire "Non ho le competenze": rispondi invece: "In questa pagina non vedo dati in tabella, riprova tra un secondo o controlla se la lista è vuota."
9. Guida "come fare": nel JSON usa context.guida_sintesi per il **Core** (app base), context.guida_sintesi_parco_macchine per **Parco Macchine** (mezzi, scadenze, guasti), context.guida_sintesi_vigneto per **Vigneto**, context.guida_sintesi_frutteto per **Frutteto**, context.guida_sintesi_magazzino per **Magazzino**, context.guida_sintesi_manodopera per **Manodopera**, context.guida_sintesi_conto_terzi per **Conto Terzi**, context.guida_sintesi_meteo per **Meteo** (sede vs modulo, mappa campi) e context.guida_sintesi_tony per **come funziona Tony** (widget, piani, Tony Guida vs Avanzato, voce, profilo campo, briefing) se presenti; per **pianificazione impianto / calcolo materiali** privilegia la sintesi del modulo coerente con **page.pagePath** (vigneto vs frutteto) e non mischiare le due se il path è chiaro; su **/magazzino/** privilegia **guida_sintesi_magazzino** per anagrafica, movimenti e tracciabilità; su pagine **manodopera** (path con segnatura-ore, validazione-ore, gestione-operai, gestione-squadre, compensi-operai, statistiche-manodopera, lavori-caposquadra, field-workspace, ecc.) privilegia **guida_sintesi_manodopera** per segnatura, validazione, squadre, operai e compensi; su **/conto-terzi/** privilegia **guida_sintesi_conto_terzi** per clienti, terreni clienti, tariffe, preventivi e flusso pianifica lavoro; su **/meteo/** o **pageType meteo_dashboard** privilegia **guida_sintesi_meteo** e **page.currentTableData** (campi, pop, alert); se l'utente chiede cos'è Tony o cosa può fare **in generale** privilegia **guida_sintesi_tony**; integra con moduli attivi nel tenant e pagina corrente; non inventare schermate assenti. La guida lunga context.guida_app è nel contesto completo soprattutto al primo messaggio quando caricata da file.

**[CONTESTO_AZIENDALE]**
{CONTESTO_PLACEHOLDER}
**[/CONTESTO_AZIENDALE]**`;

/** Numero massimo di messaggi in memoria (3–4 scambi = 6–8 elementi) */
const CHAT_HISTORY_MAX = 8;
/** Max righe tabella inviate a tonyAsk (evita payload enormi su Gestione Lavori / liste lunghe). */
const TONY_CALLABLE_MAX_TABLE_ITEMS = 40;
/** Timeout client sulla callable (allineato al limite tipico CF ~60–120s). */
const TONY_CALLABLE_TIMEOUT_MS = 90000;
/** Timeout connessione SSE: se non arrivano header/byte, fallback su tonyAsk callable. */
const TONY_STREAM_CONNECT_TIMEOUT_MS = 25000;
const TONY_STREAM_DISABLED_KEY = 'tony_stream_disabled';

/**
 * Preferisce una tabella lavori campo con items non vuoti: contesto serializzato a volte arriva senza righe
 * mentre window.currentTableData (o parent field-workspace) è aggiornato.
 */
function _resolveFieldWorkspaceTableDataForEnumerate(safeContext) {
  const candidates = [];
  try {
    if (safeContext && safeContext.page && safeContext.page.currentTableData) {
      candidates.push(safeContext.page.currentTableData);
    }
  } catch (_) {}
  if (typeof window !== 'undefined') {
    try {
      if (window.currentTableData) candidates.push(window.currentTableData);
    } catch (_) {}
    try {
      if (window.parent && window.parent !== window && window.parent.currentTableData) {
        candidates.push(window.parent.currentTableData);
      }
    } catch (_) {}
  }
  for (let i = 0; i < candidates.length; i++) {
    const ct = candidates[i];
    if (!ct) continue;
    const pt = String(ct.pageType || '');
    if (pt !== 'field_workspace' && pt !== 'lavori_caposquadra') continue;
    const items = ct.items;
    if (!Array.isArray(items) || items.length === 0) continue;
    return ct;
  }
  return null;
}

/**
 * Domande «quali lavori in lista» nel workspace campo: risposta deterministica dai dati tabella (no CF / no Gemini).
 * Evita risposte solo con il conteggio.
 */
function _tryFieldWorkspaceEnumerateJobsReply(userPrompt, safeContext, askOptions) {
  if (askOptions && askOptions.proactive) return null;
  const p = String(userPrompt || '').trim();
  if (!p) return null;
  const ct = _resolveFieldWorkspaceTableDataForEnumerate(safeContext);
  if (!ct) return null;
  const items = ct.items;
  if (!Array.isArray(items) || items.length === 0) return null;
  const lower = p.toLowerCase();
  if (/\b(ritard|scad|filtro|solo\s+i\s|solo\s+quell|in corso|completat)\b/i.test(lower) && !/\bin elenco\b|\bin lista\b|\btutti\b/i.test(lower)) {
    return null;
  }
  const looksLikeEnumerate =
    /\bquali\b.*\blavor/i.test(lower) ||
    /\b(elenco|lista)\b.*\blavor/i.test(lower) ||
    /\bquanti\b.*\blavor/i.test(lower) ||
    /\blavor\w*\b.*\b(ci sono|in elenco|in lista)\b/i.test(lower);
  if (!looksLikeEnumerate) return null;

  var lines = items.map(function (it) {
    var title = String(it.label != null ? it.label : it.nome != null ? it.nome : it.titolo || '').trim() || 'Senza nome';
    var st = String(it.stato || '').trim();
    var tipo = String(it.tipoLavoro || '').trim();
    var bits = [title];
    if (tipo) bits.push(tipo);
    if (st) bits.push('stato ' + st);
    return bits.join(', ');
  });

  if (items.length === 1) {
    return 'Nel tuo elenco c’è un lavoro: ' + lines[0] + '.';
  }
  if (items.length === 2) {
    return 'Ci sono due lavori in elenco. Primo, ' + lines[0] + '. Secondo, ' + lines[1] + '.';
  }
  return (
    'Nel tuo elenco ci sono ' +
    items.length +
    ' lavori. ' +
    lines
      .map(function (line, i) {
        return 'Numero ' + (i + 1) + ', ' + line;
      })
      .join('. ') +
    '.'
  );
}

/**
 * Aggiunta terreno su pagina Terreni: risposta locale (0 CF) come lavoro entity-first.
 */
function _tryTerrenoCreateQuickReply(userPrompt, safeContext, askOptions) {
  if (askOptions && askOptions.proactive) return null;
  const parsed = tryTonyTerrenoEntityParse({ message: userPrompt, ctx: safeContext });
  if (!parsed || !parsed.earlyReturn) return null;
  return { text: parsed.text, command: parsed.command };
}

function _emitTerrenoQuickReply(service, historyUserText, terrenoQuick, askOptions) {
  console.log(
    '[Tony] Quick reply terreno (0 CF):',
    terrenoQuick.command && terrenoQuick.command.fields
      ? Object.keys(terrenoQuick.command.fields).length
      : 0,
    'campi'
  );
  service._pushChatTurn(historyUserText, terrenoQuick.text, askOptions);
  if (terrenoQuick.command && terrenoQuick.command.type) {
    service.triggerAction(terrenoQuick.command.type, terrenoQuick.command);
  }
  return { text: terrenoQuick.text, command: terrenoQuick.command || null };
}

class TonyService {
  constructor() {
    this.model = null;
    this.ai = null;
    this.app = null;
    this._tonyAskCallable = null;
    this._tonyAskHttpUrl = null;
    this._tonyAskStreamUrl = null;
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
    this.context.guida_sintesi = GUIDA_SINTESI_FALLBACK;
    this.context.guida_sintesi_parco_macchine = GUIDA_SINTESI_PARCO_MACCHINE_FALLBACK;
    this.context.guida_sintesi_vigneto = GUIDA_SINTESI_VIGNETO_FALLBACK;
    this.context.guida_sintesi_frutteto = GUIDA_SINTESI_FRUTTETO_FALLBACK;
    this.context.guida_sintesi_magazzino = GUIDA_SINTESI_MAGAZZINO_FALLBACK;
    this.context.guida_sintesi_manodopera = GUIDA_SINTESI_MANODOPERA_FALLBACK;
    this.context.guida_sintesi_conto_terzi = GUIDA_SINTESI_CONTO_TERZI_FALLBACK;
    this.context.guida_sintesi_meteo = GUIDA_SINTESI_METEO_FALLBACK;
    this.context.guida_sintesi_tony = GUIDA_SINTESI_TONY_FALLBACK;
    this._initPromise = (async () => {
      try {
        const fullGuida = await loadGuidaAppFull();
        if (fullGuida) {
          this.context.guida_app = fullGuida;
          console.log('[Tony] Guida app completa caricata.');
        }
      } catch (_) { /* mantieni condensata */ }
      try {
        const sintesiRaw = await loadGuidaSintesi();
        const sintesi =
          sintesiRaw && String(sintesiRaw).trim().length > 80
            ? String(sintesiRaw).trim()
            : GUIDA_SINTESI_FALLBACK;
        this.context.guida_sintesi = sintesi;
        if (sintesiRaw && String(sintesiRaw).trim().length > 80) {
          console.log('[Tony] Guida sintesi caricata.');
        }
      } catch (_) {
        this.context.guida_sintesi = GUIDA_SINTESI_FALLBACK;
      }
      try {
        const sintesiParcoRaw = await loadGuidaSintesiParcoMacchine();
        const sintesiParco =
          sintesiParcoRaw && String(sintesiParcoRaw).trim().length > 60
            ? String(sintesiParcoRaw).trim()
            : GUIDA_SINTESI_PARCO_MACCHINE_FALLBACK;
        this.context.guida_sintesi_parco_macchine = sintesiParco;
        if (sintesiParcoRaw && String(sintesiParcoRaw).trim().length > 60) {
          console.log('[Tony] Guida sintesi Parco Macchine caricata.');
        }
      } catch (_) {
        this.context.guida_sintesi_parco_macchine = GUIDA_SINTESI_PARCO_MACCHINE_FALLBACK;
      }
      try {
        const sintesiVignetoRaw = await loadGuidaSintesiVigneto();
        const sintesiVigneto =
          sintesiVignetoRaw && String(sintesiVignetoRaw).trim().length > 60
            ? String(sintesiVignetoRaw).trim()
            : GUIDA_SINTESI_VIGNETO_FALLBACK;
        this.context.guida_sintesi_vigneto = sintesiVigneto;
        if (sintesiVignetoRaw && String(sintesiVignetoRaw).trim().length > 60) {
          console.log('[Tony] Guida sintesi Vigneto caricata.');
        }
      } catch (_) {
        this.context.guida_sintesi_vigneto = GUIDA_SINTESI_VIGNETO_FALLBACK;
      }
      try {
        const sintesiFruttetoRaw = await loadGuidaSintesiFrutteto();
        const sintesiFrutteto =
          sintesiFruttetoRaw && String(sintesiFruttetoRaw).trim().length > 60
            ? String(sintesiFruttetoRaw).trim()
            : GUIDA_SINTESI_FRUTTETO_FALLBACK;
        this.context.guida_sintesi_frutteto = sintesiFrutteto;
        if (sintesiFruttetoRaw && String(sintesiFruttetoRaw).trim().length > 60) {
          console.log('[Tony] Guida sintesi Frutteto caricata.');
        }
      } catch (_) {
        this.context.guida_sintesi_frutteto = GUIDA_SINTESI_FRUTTETO_FALLBACK;
      }
      try {
        const sintesiMagazzinoRaw = await loadGuidaSintesiMagazzino();
        const sintesiMagazzino =
          sintesiMagazzinoRaw && String(sintesiMagazzinoRaw).trim().length > 60
            ? String(sintesiMagazzinoRaw).trim()
            : GUIDA_SINTESI_MAGAZZINO_FALLBACK;
        this.context.guida_sintesi_magazzino = sintesiMagazzino;
        if (sintesiMagazzinoRaw && String(sintesiMagazzinoRaw).trim().length > 60) {
          console.log('[Tony] Guida sintesi Magazzino caricata.');
        }
      } catch (_) {
        this.context.guida_sintesi_magazzino = GUIDA_SINTESI_MAGAZZINO_FALLBACK;
      }
      try {
        const sintesiManodoperaRaw = await loadGuidaSintesiManodopera();
        const sintesiManodopera =
          sintesiManodoperaRaw && String(sintesiManodoperaRaw).trim().length > 60
            ? String(sintesiManodoperaRaw).trim()
            : GUIDA_SINTESI_MANODOPERA_FALLBACK;
        this.context.guida_sintesi_manodopera = sintesiManodopera;
        if (sintesiManodoperaRaw && String(sintesiManodoperaRaw).trim().length > 60) {
          console.log('[Tony] Guida sintesi Manodopera caricata.');
        }
      } catch (_) {
        this.context.guida_sintesi_manodopera = GUIDA_SINTESI_MANODOPERA_FALLBACK;
      }
      try {
        const sintesiContoTerziRaw = await loadGuidaSintesiContoTerzi();
        const sintesiContoTerzi =
          sintesiContoTerziRaw && String(sintesiContoTerziRaw).trim().length > 60
            ? String(sintesiContoTerziRaw).trim()
            : GUIDA_SINTESI_CONTO_TERZI_FALLBACK;
        this.context.guida_sintesi_conto_terzi = sintesiContoTerzi;
        if (sintesiContoTerziRaw && String(sintesiContoTerziRaw).trim().length > 60) {
          console.log('[Tony] Guida sintesi Conto Terzi caricata.');
        }
      } catch (_) {
        this.context.guida_sintesi_conto_terzi = GUIDA_SINTESI_CONTO_TERZI_FALLBACK;
      }
      try {
        const sintesiMeteoRaw = await loadGuidaSintesiMeteo();
        const sintesiMeteo =
          sintesiMeteoRaw && String(sintesiMeteoRaw).trim().length > 60
            ? String(sintesiMeteoRaw).trim()
            : GUIDA_SINTESI_METEO_FALLBACK;
        this.context.guida_sintesi_meteo = sintesiMeteo;
        if (sintesiMeteoRaw && String(sintesiMeteoRaw).trim().length > 60) {
          console.log('[Tony] Guida sintesi Meteo caricata.');
        }
      } catch (_) {
        this.context.guida_sintesi_meteo = GUIDA_SINTESI_METEO_FALLBACK;
      }
      try {
        const sintesiTonyRaw = await loadGuidaSintesiTony();
        const sintesiTony =
          sintesiTonyRaw && String(sintesiTonyRaw).trim().length > 60
            ? String(sintesiTonyRaw).trim()
            : GUIDA_SINTESI_TONY_FALLBACK;
        this.context.guida_sintesi_tony = sintesiTony;
        if (sintesiTonyRaw && String(sintesiTonyRaw).trim().length > 60) {
          console.log('[Tony] Guida sintesi modulo Tony caricata.');
        }
      } catch (_) {
        this.context.guida_sintesi_tony = GUIDA_SINTESI_TONY_FALLBACK;
      }
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
            this._tonyAskHttpUrl = this._resolveTonyAskCallableUrl(app);
            this._tonyAskStreamUrl = this._resolveTonyAskStreamUrl(app);
            this._useCallable = true;
            this._ready = true;
            console.log('[Tony] Uso Cloud Function tonyAsk (getAI non disponibile in questo build).');
            if (this._tonyAskStreamUrl) {
              console.log('[Tony] Streaming SSE tonyAskStream attivo.');
            }
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
      model: TONY_GEMINI_MODEL,
      systemInstruction
    });
  }

  /**
   * Contesto per prompt / callable.
   * - **Callable (tonyAsk)**: solo `guida_sintesi_*` (mai `guida_app` lunga).
   * - **Modello locale**: primo turno può usare `guida_app` intera; sintesi omesse se ridondanti.
   * @param {{ forCallable?: boolean }} [opts]
   */
  _getContextForPrompt(opts = {}) {
    const forCallable = !!opts.forCallable;
    const firstTurn = this.chatHistory.length === 0;
    const ga = this.context.guida_app;
    const longGuidaLoaded =
      typeof ga === 'string' && ga.length >= GUIDA_APP_FULL_THRESHOLD_CHARS;
    const sintesiKeys = [
      'guida_sintesi',
      'guida_sintesi_parco_macchine',
      'guida_sintesi_vigneto',
      'guida_sintesi_frutteto',
      'guida_sintesi_magazzino',
      'guida_sintesi_manodopera',
      'guida_sintesi_conto_terzi',
      'guida_sintesi_meteo',
      'guida_sintesi_tony'
    ];
    const out = {};
    for (const key of Object.keys(this.context)) {
      if (key === 'guida_app') {
        if (!forCallable && firstTurn) out[key] = this.context[key];
        continue;
      }
      if (sintesiKeys.indexOf(key) >= 0) {
        if (!forCallable && firstTurn && longGuidaLoaded) continue;
        out[key] = this.context[key];
        continue;
      }
      out[key] = this.context[key];
    }
    return out;
  }

  /**
   * True se il messaggio utente esprime una conferma di salvataggio (magazzino), non una lunga descrizione del prodotto/movimento.
   */
  _magazzinoUserPromptLooksLikeSaveConfirm(userPrompt) {
    if (!userPrompt || typeof userPrompt !== 'string') return false;
    const s = userPrompt.trim().toLowerCase();
    if (/\b(ok\s*salva|salva\s+il\s+prodotto|salva\s+il\s+movimento|conferma\s+salvataggio|registra\s+il\s+prodotto|registra\s+il\s+movimento)\b/i.test(s)) return true;
    if (/^(ok|salva|sì|si|va\s*bene)(\s*[!.])?\s*$/i.test(s)) return true;
    if (/^(ok|sì|si)\s*,?\s*salva\b/i.test(s)) return true;
    if (s.length <= 40 && /^\s*salva\s*$/i.test(s)) return true;
    return false;
  }

  /**
   * Helper: Inizializza il context di Tony con i moduli attivi dal tenant.
   * Da chiamare nelle pagine standalone dopo aver caricato i dati del tenant.
   * @param {Array<string>} modules - Array di moduli attivi (es. ['vigneto', 'tony', ...])
   * @param {number|{ maxRetries?: number, tenantId?: string, utente_corrente?: { nome?: string, ruoli?: string[] } }} [optionsOrMaxRetries]
   *        — numero = maxRetries (retrocompatibile); oggetto = opzioni con ruoli utente per profilo campo / guard APRI_PAGINA
   */
  static async initContextWithModules(modules, optionsOrMaxRetries = 10) {
    if (!Array.isArray(modules)) {
      console.warn('[Tony] initContextWithModules: modules deve essere un array');
      return;
    }

    let maxRetries = 10;
    let tenantId = null;
    let utente_corrente = null;
    if (typeof optionsOrMaxRetries === 'number') {
      maxRetries = optionsOrMaxRetries;
    } else if (optionsOrMaxRetries && typeof optionsOrMaxRetries === 'object') {
      maxRetries = optionsOrMaxRetries.maxRetries != null ? optionsOrMaxRetries.maxRetries : 10;
      tenantId = optionsOrMaxRetries.tenantId || null;
      utente_corrente = optionsOrMaxRetries.utente_corrente || null;
    }

    const initContext = (retries = 0) => {
      if (window.Tony && typeof window.Tony.setContext === 'function') {
        const payload = {
          info_azienda: { moduli_attivi: modules },
          moduli_attivi: modules
        };
        try {
          if (typeof window !== "undefined" && window.__gfvSubscriptionPlanId != null && window.__gfvSubscriptionPlanId !== "") {
            const pid = String(window.__gfvSubscriptionPlanId).trim().toLowerCase();
            payload.plan = pid;
            payload.piano = pid;
          }
        } catch (_) {}
        if (tenantId) payload.tenantId = tenantId;
        if (utente_corrente && typeof utente_corrente === 'object') {
          payload.utente_corrente = utente_corrente;
          try {
            if (Array.isArray(utente_corrente.ruoli)) {
              sessionStorage.setItem('gfv_tony_utente_ruoli', JSON.stringify(utente_corrente.ruoli));
            }
          } catch (e) { /* ignore */ }
        }
        window.Tony.setContext('dashboard', payload);
        console.log('[Tony] Context inizializzato con moduli:', modules, utente_corrente ? '(+ utente_corrente)' : '');
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
    if (moduleName === 'page' && data && typeof data === 'object' && !Array.isArray(data)) {
      this.context[moduleName] = Object.assign({}, this.context[moduleName] || {}, data);
    } else {
      this.context[moduleName] = data;
    }
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
  /** True se il tenant ha il modulo Tony Avanzato (solo allora si eseguono azioni da JSON locale). */
  _isTonyAdvancedFromContext() {
    const dash = this.context && this.context.dashboard;
    const mods =
      (dash && dash.moduli_attivi) ||
      (this.context && this.context.moduli_attivi) ||
      [];
    return Array.isArray(mods) && mods.some((m) => String(m).toLowerCase() === 'tony');
  }

  _parseAndTriggerActions(text) {
    if (!text || typeof text !== 'string') return text;
    if (!this._isTonyAdvancedFromContext()) {
      return text;
    }
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
   * Scudo termico: rimuove coordinate GPS e dati pesanti dal contesto prima di inviare a Gemini.
   * Risparmia token e evita che il JSON di risposta venga troncato.
   * Gestisce pageType: terreni, attivita, lavori, clienti, prodotti, movimenti, macchine, ecc.
   */
  _sanitizeContextForAI(context) {
    if (!context || !context.page || !context.page.currentTableData) return context;
    let cleanContext;
    try {
      cleanContext = JSON.parse(JSON.stringify(context));
    } catch (e) {
      console.warn('[Tony] Contesto non serializzabile, invio senza currentTableData:', e && e.message);
      const fallback = { ...context };
      if (fallback.page) {
        fallback.page = { ...fallback.page };
        delete fallback.page.currentTableData;
      }
      return fallback;
    }
    const table = cleanContext.page.currentTableData;
    const pageType = table.pageType || '';
    if (!Array.isArray(table.items)) return cleanContext;
    if (pageType === 'attivita') {
      table.items = table.items.map((item) => ({
        id: item.id,
        data: item.dataItaliana || item.data || '-',
        terreno: item.terreno || '-',
        tipoLavoro: item.tipoLavoro || '-',
        oreNette: item.oreNette != null ? item.oreNette : '-',
        coltura: item.coltura || '-'
      }));
    } else if (pageType === 'clienti') {
      table.items = table.items.map((item) => ({
        ragioneSociale: item.ragioneSociale || '-',
        stato: item.stato || '-',
        totaleLavori: item.totaleLavori != null ? item.totaleLavori : 0,
        email: item.email || '-',
        partitaIva: item.partitaIva || '-'
      }));
    } else if (pageType === 'preventivi') {
      table.items = table.items.map((item) => ({
        numero: item.numero || '-',
        cliente: item.cliente || '-',
        stato: item.stato || '-',
        totale: item.totale != null ? item.totale : 0
      }));
    } else if (pageType === 'terreniClienti') {
      table.items = table.items.map((item) => ({
        nome: item.nome || '-',
        cliente: item.cliente || '-',
        superficie: item.superficie != null ? item.superficie : '-',
        coltura: item.coltura || '-',
        podere: item.podere || '-'
      }));
    } else if (pageType === 'tariffe') {
      table.items = table.items.map((item) => ({
        tipoLavoro: item.tipoLavoro || '-',
        coltura: item.coltura || '-',
        tipoCampo: item.tipoCampo || '-',
        tariffaBase: item.tariffaBase != null ? item.tariffaBase : 0,
        coefficiente: item.coefficiente != null ? item.coefficiente : 1,
        attiva: !!item.attiva,
        tariffaFinale: item.tariffaFinale != null ? item.tariffaFinale : 0
      }));
    } else if (pageType === 'lavori') {
      table.items = table.items.map((item) => ({
        id: item.id,
        nome: item.nome || '-',
        terreno: item.terreno || '-',
        stato: item.stato || '-',
        tipo: item.tipo || '-',
        tipoLavoro: item.tipoLavoro || '-',
        dataInizio: item.dataInizioItaliana || item.dataInizio || '-',
        caposquadra: item.caposquadra || '-',
        operaio: item.operaio || '-'
      }));
      if (table.items.length > TONY_CALLABLE_MAX_TABLE_ITEMS) {
        const total = table.items.length;
        table.items = table.items.slice(0, TONY_CALLABLE_MAX_TABLE_ITEMS);
        table._itemsCapped = true;
        table._itemsTotal = total;
      }
    } else if (pageType === 'terreni') {
      table.items = table.items.map((item) => ({
        id: item.id,
        nome: item.nome || item.name || 'Senza nome',
        podere: item.podere,
        coltura: item.coltura,
        tipoPossesso: item.tipoPossesso,
        scadenza: item.scadenzaItaliana || item.scadenza || item.dataScadenzaAffitto || 'N/A',
        superficie: item.superficie != null ? Math.round(Number(item.superficie) * 100) / 100 : null
      }));
    } else if (pageType === 'vendemmia') {
      if (Array.isArray(table.vendemmiaAggregates)) {
        table.vendemmiaAggregates = table.vendemmiaAggregates.map((a) => ({
          varieta: a.varieta || '-',
          totaleQli: a.totaleQli != null ? a.totaleQli : 0,
          numeroVendemmie: a.numeroVendemmie != null ? a.numeroVendemmie : 0
        }));
      }
      table.items = table.items.map((item) => ({
        dataItaliana: item.dataItaliana || item.data || '-',
        varieta: item.varieta || '-',
        vignetoNome: item.vignetoNome || '-',
        quantitaQli: item.quantitaQli != null ? item.quantitaQli : null,
        quantitaEttari: item.quantitaEttari != null ? item.quantitaEttari : null,
        resaQliHa: item.resaQliHa != null ? item.resaQliHa : null
      }));
    } else if (pageType === 'meteo_dashboard') {
      if (table.sede && table.sede.previsioniGiornaliere && table.sede.previsioniGiornaliere.length > 8) {
        table.sede.previsioniGiornaliere = table.sede.previsioniGiornaliere.slice(0, 8);
      }
      table.items = table.items.map((item) => ({
        id: item.id || item.terrenoId,
        terrenoId: item.terrenoId,
        nome: item.nome,
        podere: item.podere,
        ok: !!item.ok,
        popOggi: item.popOggi,
        popDomani: item.popDomani,
        hasRainSoon: !!item.hasRainSoon,
        previsioniGiornaliere: Array.isArray(item.previsioniGiornaliere)
          ? item.previsioniGiornaliere.slice(0, 8)
          : [],
      }));
    } else {
      // Altri pageType (lavori, prodotti, movimenti, trattori, attrezzi, guasti, scadenze, flotta): mantieni struttura leggera
      table.items = table.items.map((item) => {
        const out = { ...item };
        if (Object.keys(out).length > 15) {
          return Object.fromEntries(Object.entries(out).slice(0, 12));
        }
        return out;
      });
    }
    return cleanContext;
  }

  /**
   * Alleggerisce il contesto inviato a tonyAsk (Map lavori, liste lunghe, tabella).
   * Le guide passano solo come `guida_sintesi_*` (vedi `_getContextForPrompt({ forCallable: true })`).
   */
  _prepareContextForCallable(context) {
    if (!context || typeof context !== 'object') return context;
    const out = this._sanitizeForJson(context);
    if (!out || typeof out !== 'object') return out;
    if (out.guida_app != null) delete out.guida_app;
    if (out.lavori && typeof out.lavori === 'object') {
      const l = { ...out.lavori };
      delete l.sottocategorieLavoriMap;
      delete l.squadreList;
      const capArr = (arr, max, mapFn) => {
        if (!Array.isArray(arr)) return arr;
        return arr.slice(0, max).map(mapFn);
      };
      l.terreni = capArr(l.terreni, 80, (t) =>
        t && typeof t === 'object'
          ? {
              id: t.id,
              nome: t.nome,
              coltura: t.coltura,
              coltura_categoria: t.coltura_categoria
            }
          : t
      );
      l.tipi_lavoro = capArr(l.tipi_lavoro, 100, (t) =>
        t && typeof t === 'object'
          ? { id: t.id, nome: t.nome || t.tipoLavoro || t.label, tipoLavoro: t.tipoLavoro }
          : t
      );
      l.caposquadraList = capArr(l.caposquadraList, 40, (c) =>
        c && typeof c === 'object'
          ? { id: c.id, nome: `${c.nome || ''} ${c.cognome || ''}`.trim() }
          : c
      );
      l.operaiList = capArr(l.operaiList, 40, (c) =>
        c && typeof c === 'object'
          ? { id: c.id, nome: `${c.nome || ''} ${c.cognome || ''}`.trim() }
          : c
      );
      l.trattoriList = capArr(l.trattoriList, 40, (t) =>
        t && typeof t === 'object' ? { id: t.id, nome: t.nome || t.label } : t
      );
      l.attrezziList = capArr(l.attrezziList, 40, (t) =>
        t && typeof t === 'object' ? { id: t.id, nome: t.nome || t.label } : t
      );
      if (Array.isArray(l.categorie_lavoro) && l.categorie_lavoro.length > 40) {
        l.categorie_lavoro = l.categorie_lavoro.slice(0, 40);
        l._categorieCapped = true;
      }
      out.lavori = l;
    }
    if (out.page && out.page.currentTableData && Array.isArray(out.page.currentTableData.items)) {
      const n = out.page.currentTableData.items.length;
      if (n > TONY_CALLABLE_MAX_TABLE_ITEMS) {
        out.page.currentTableData = {
          ...out.page.currentTableData,
          items: out.page.currentTableData.items.slice(0, TONY_CALLABLE_MAX_TABLE_ITEMS),
          _itemsCapped: true,
          _itemsTotal: n
        };
      }
    }
    return out;
  }

  /**
   * URL HTTP tonyAskStream (SSE) — regione europe-west1.
   * @param {import('firebase/app').FirebaseApp} app
   * @returns {string|null}
   */
  _resolveCfBaseUrl(app) {
    try {
      const opts = app && app.options ? app.options : {};
      const projectId = opts.projectId || (typeof window !== 'undefined' && window.firebaseConfig && window.firebaseConfig.projectId);
      if (!projectId) return null;
      return `https://europe-west1-${projectId}.cloudfunctions.net`;
    } catch (_) {
      return null;
    }
  }

  _resolveTonyAskCallableUrl(app) {
    const base = this._resolveCfBaseUrl(app);
    return base ? `${base}/tonyAsk` : null;
  }

  _resolveTonyAskStreamUrl(app) {
    const base = this._resolveCfBaseUrl(app);
    return base ? `${base}/tonyAskStream` : null;
  }

  _preferCallableOverStream(opts = {}) {
    if (opts && opts.forceStream === true) return false;
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(TONY_STREAM_DISABLED_KEY) === '1') {
        return true;
      }
    } catch (_) { /* ignore */ }
    return false;
  }

  _markStreamDisabled(reason) {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(TONY_STREAM_DISABLED_KEY, '1');
      }
    } catch (_) { /* ignore */ }
    console.warn('[Tony] SSE disabilitato per questa sessione:', reason || 'fallback');
  }

  /**
   * @param {{ message: string, context: object, history: object[], onChunk?: (delta: string) => void }} payload
   * @returns {Promise<{ text: string, command: object|null }>}
   */
  async _callTonyAskStream(payload) {
    if (!this._tonyAskStreamUrl) {
      throw new Error('tonyAskStream URL non configurato');
    }
    const { getAuth } = await import('https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js');
    const { parseTonySseStream } = await import('./tony-sse-parse.js');
    const auth = getAuth(this.app);
    const user = auth.currentUser;
    if (!user) throw new Error('Utente non autenticato');
    const idToken = await user.getIdToken();

    let payloadKb = 0;
    try {
      payloadKb = Math.round(JSON.stringify(payload).length / 1024);
    } catch (_) { /* ignore */ }

    const started = Date.now();
    const abortCtrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const abortTimer = abortCtrl
      ? setTimeout(function () {
          try {
            abortCtrl.abort();
          } catch (_) { /* ignore */ }
        }, TONY_STREAM_CONNECT_TIMEOUT_MS)
      : null;
    console.log('[Tony] tonyAskStream avviata (~' + payloadKb + ' KB)...');
    let res;
    try {
      res = await fetch(this._tonyAskStreamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          message: payload.message,
          context: payload.context,
          history: payload.history,
        }),
        signal: abortCtrl ? abortCtrl.signal : undefined,
      });
    } catch (fetchErr) {
      if (abortTimer) clearTimeout(abortTimer);
      const aborted = fetchErr && (fetchErr.name === 'AbortError' || String(fetchErr.message || '').indexOf('aborted') >= 0);
      if (aborted) {
        this._markStreamDisabled('timeout connessione SSE');
        const timeoutErr = new Error(
          'Tony: timeout connessione stream (' + Math.round(TONY_STREAM_CONNECT_TIMEOUT_MS / 1000) + ' s).'
        );
        timeoutErr.code = 'deadline-exceeded';
        throw timeoutErr;
      }
      this._markStreamDisabled(fetchErr && fetchErr.message);
      throw fetchErr;
    }
    if (abortTimer) clearTimeout(abortTimer);
    console.log('[Tony] tonyAskStream: header HTTP', res.status, 'in', Date.now() - started, 'ms');

    if (!res.ok) {
      let errMsg = `tonyAskStream HTTP ${res.status}`;
      try {
        const errBody = await res.json();
        if (errBody && errBody.error) errMsg = String(errBody.error);
      } catch (_) {}
      throw new Error(errMsg);
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.indexOf('application/json') >= 0) {
      const jsonBody = await res.json();
      if (jsonBody && jsonBody.error) throw new Error(String(jsonBody.error));
      return {
        text: jsonBody && jsonBody.text != null ? String(jsonBody.text) : '',
        command: jsonBody && jsonBody.command && typeof jsonBody.command === 'object' ? jsonBody.command : null,
      };
    }

    const rawBody = await res.text();
    let donePayload = null;
    const parsed = parseTonySseStream(rawBody, {
      onChunk(delta) {
        if (payload.onChunk) payload.onChunk(delta);
      },
      onDone(data) {
        donePayload = data;
      },
    });

    console.log('[Tony] tonyAskStream completata in', Date.now() - started, 'ms');
    if (!donePayload) {
      const preview = String(rawBody || '').slice(0, 240).replace(/\s+/g, ' ');
      console.warn('[Tony] tonyAskStream senza done; body preview:', preview || '(vuoto)', 'hadEvents:', parsed.hadEvents);
      throw new Error('Stream Tony terminato senza evento done');
    }
    return {
      text: donePayload.text != null ? String(donePayload.text) : '',
      command: donePayload.command && typeof donePayload.command === 'object' ? donePayload.command : null,
    };
  }

  /**
   * Callable tonyAsk via fetch HTTP (evita hang sporadici di httpsCallable SDK in browser).
   * @param {{ message: string, context: object, history: object[] }} payload
   * @param {number} started
   * @returns {Promise<*>}
   */
  async _callTonyAskViaHttp(payload, started) {
    if (!this._tonyAskHttpUrl) {
      throw new Error('tonyAsk HTTP URL non configurato');
    }
    const { getAuth } = await import('https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js');
    const auth = getAuth(this.app);
    const user = auth.currentUser;
    if (!user) throw new Error('Utente non autenticato');
    console.log('[Tony] tonyAsk HTTP: richiesta token...');
    const idToken = await user.getIdToken();
    console.log('[Tony] tonyAsk HTTP: POST', this._tonyAskHttpUrl);

    const abortCtrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const abortTimer = abortCtrl
      ? setTimeout(function () {
          try {
            abortCtrl.abort();
          } catch (_) { /* ignore */ }
        }, TONY_CALLABLE_TIMEOUT_MS)
      : null;
    const heartbeat = setInterval(function () {
      console.log('[Tony] tonyAsk HTTP ancora in attesa...', Math.round((Date.now() - started) / 1000), 's');
    }, 10000);

    try {
      const res = await fetch(this._tonyAskHttpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ data: payload }),
        signal: abortCtrl ? abortCtrl.signal : undefined,
      });
      console.log('[Tony] tonyAsk HTTP: risposta', res.status, 'in', Date.now() - started, 'ms');
      let json = {};
      try {
        json = await res.json();
      } catch (_) {
        json = {};
      }
      if (!res.ok) {
        const errMsg =
          (json && json.error && (json.error.message || json.error.status)) ||
          `tonyAsk HTTP ${res.status}`;
        const err = new Error(String(errMsg));
        if (json && json.error && json.error.status) err.code = String(json.error.status).toLowerCase();
        throw err;
      }
      if (json && json.error) {
        const err = new Error(String(json.error.message || json.error.status || 'Errore tonyAsk'));
        if (json.error.status) err.code = String(json.error.status).toLowerCase();
        throw err;
      }
      const data = json.result !== undefined ? json.result : json.data;
      console.log('[Tony] tonyAsk completata in', Date.now() - started, 'ms (HTTP)');
      return data;
    } catch (fetchErr) {
      if (fetchErr && (fetchErr.name === 'AbortError' || String(fetchErr.message || '').indexOf('aborted') >= 0)) {
        const timeoutErr = new Error(
          'Tony: timeout attesa risposta dal server (' + Math.round(TONY_CALLABLE_TIMEOUT_MS / 1000) + ' s).'
        );
        timeoutErr.code = 'deadline-exceeded';
        throw timeoutErr;
      }
      throw fetchErr;
    } finally {
      clearInterval(heartbeat);
      if (abortTimer) clearTimeout(abortTimer);
    }
  }

  /**
   * @param {{ message: string, context: object, history: object[] }} payload
   * @returns {Promise<*>}
   */
  async _callTonyAskCallable(payload) {
    const started = Date.now();
    let payloadKb = 0;
    try {
      payloadKb = Math.round(JSON.stringify(payload).length / 1024);
    } catch (e) {
      console.warn('[Tony] Stima payload callable non riuscita:', e && e.message);
    }
    console.log('[Tony] Invio tonyAsk (~' + payloadKb + ' KB)...');

    if (this._tonyAskHttpUrl) {
      try {
        return await this._callTonyAskViaHttp(payload, started);
      } catch (httpErr) {
        console.warn('[Tony] tonyAsk HTTP fallita, fallback SDK:', httpErr && httpErr.message);
        if (!this._tonyAskCallable) throw httpErr;
      }
    }

    const callPromise = this._tonyAskCallable(payload).then((r) => r.data);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        const err = new Error(
          'Tony: timeout attesa risposta dal server (' + Math.round(TONY_CALLABLE_TIMEOUT_MS / 1000) + ' s).'
        );
        err.code = 'deadline-exceeded';
        reject(err);
      }, TONY_CALLABLE_TIMEOUT_MS);
    });
    try {
      const data = await Promise.race([callPromise, timeoutPromise]);
      console.log('[Tony] tonyAsk completata in', Date.now() - started, 'ms (SDK)');
      return data;
    } catch (err) {
      console.error('[Tony] tonyAsk fallita dopo', Date.now() - started, 'ms:', err);
      throw err;
    }
  }

  /**
   * Sanitizza un oggetto per la serializzazione JSON (Firebase callable non accetta NaN).
   * Sostituisce NaN con null, converte Map in oggetto plain.
   */
  _sanitizeForJson(obj) {
    if (obj === null) return null;
    if (obj === undefined) return null;
    if (typeof obj === 'number') return Number.isNaN(obj) || !Number.isFinite(obj) ? null : obj;
    if (typeof obj === 'string' || typeof obj === 'boolean') return obj;
    if (obj instanceof Map) {
      const plain = {};
      obj.forEach((v, k) => {
        const key = String(k);
        plain[key] = this._sanitizeForJson(v);
      });
      return plain;
    }
    if (Array.isArray(obj)) return obj.map((item) => this._sanitizeForJson(item));
    if (typeof obj === 'object') {
      const out = {};
      for (const k of Object.keys(obj)) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) {
          out[k] = this._sanitizeForJson(obj[k]);
        }
      }
      return out;
    }
    return obj;
  }

  /**
   * @param {{ skipUserHistory?: boolean, proactive?: boolean, historyUserMessage?: string }} askOptions - skipUserHistory: non aggiunge il turno utente a chatHistory. proactive: turno avviato dal widget (es. verifica modulo); usato per non eseguire SAVE_ACTIVITY sul finto messaggio «Form completo, confermi salvataggio?». historyUserMessage: testo utente da mostrare/salvare in cronologia (es. senza istruzioni client augment); se assente si usa userPrompt.
   */
  _pushChatTurn(userPrompt, modelText, askOptions) {
    const skipUser = askOptions && askOptions.skipUserHistory;
    if (!skipUser) {
      this.chatHistory.push({ role: 'user', parts: [{ text: userPrompt }] });
    }
    this.chatHistory.push({ role: 'model', parts: [{ text: modelText }] });
    while (this.chatHistory.length > CHAT_HISTORY_MAX) {
      this.chatHistory.shift();
    }
  }

  /**
   * Invia una domanda a Tony e restituisce la risposta testuale.
   * Se la risposta contiene un'azione (JSON), viene emessa con triggerAction e il testo restituito è senza il blocco JSON.
   * @param {string} userPrompt - Testo inviato al modello (può includere augment client)
   * @param {{ skipUserHistory?: boolean, proactive?: boolean, historyUserMessage?: string }} [askOptions]
   * @returns {Promise<string|{text:string,command?:object}>} Risposta di Tony (testo eventualmente ripulito dalle azioni)
   */
  async ask(userPrompt, askOptions = {}) {
    if (!this._ready) {
      throw new Error('Tony non inizializzato. Chiama Tony.init(app) prima.');
    }
    if (typeof window !== 'undefined' && window.__tonyFreemiumBlocked) {
      throw new Error('Tony non è disponibile sul piano Free. Passa al piano Base dalla pagina Abbonamento.');
    }
    const historyUserText =
      askOptions && askOptions.historyUserMessage != null && String(askOptions.historyUserMessage).trim() !== ''
        ? String(askOptions.historyUserMessage).trim()
        : String(userPrompt || '').trim();
    // Prima di triggerAction / _pushChatTurn: così APRI_PAGINA post-conferma ha il testo utente anche se il dialog viene confermato prima che chatHistory sia aggiornata.
    if (historyUserText && !(askOptions && askOptions.skipUserHistory)) {
      try {
        if (typeof window !== 'undefined') window.__tonyLastUserMessage = historyUserText;
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('tony_last_user_message', historyUserText);
        }
      } catch (_) {}
    }
    const historyBloc = this._formatHistoryForPrompt(this.chatHistory);
    const promptSuffix = historyBloc
      ? `Conversazione precedente:\n${historyBloc}\n\nDomanda utente: ${userPrompt}`
      : `Domanda utente: ${userPrompt}`;

    const contextForPrompt = this._getContextForPrompt({ forCallable: this._useCallable });
    const lightContext = this._sanitizeContextForAI(contextForPrompt);
    let safeContext = this._sanitizeForJson(lightContext);
    if (this._useCallable) {
      safeContext = this._prepareContextForCallable(safeContext);
    }
    const safeHistory = this._sanitizeForJson(this.chatHistory);

    // Context Builder: passa tenantId per fetch dati aziendali lato Cloud (docs-sviluppo/CONTEXT_BUILDER_SPECIFICHE_SVILUPPO.md)
    let tenantId = null;
    try {
      const mod = await import('./tenant-service.js');
      tenantId = mod.getCurrentTenantId ? mod.getCurrentTenantId() : null;
    } catch (_) {
      tenantId = (typeof window !== 'undefined' && window.currentTenantId) ? window.currentTenantId : null;
    }
    if (tenantId && safeContext) {
      if (!safeContext.dashboard) safeContext.dashboard = {};
      safeContext.dashboard.tenantId = tenantId;
    }

    const fieldWorkspaceQuickReply = _tryFieldWorkspaceEnumerateJobsReply(userPrompt, safeContext, askOptions);
    if (fieldWorkspaceQuickReply != null && String(fieldWorkspaceQuickReply).trim()) {
      this._pushChatTurn(historyUserText, fieldWorkspaceQuickReply, askOptions);
      return { text: fieldWorkspaceQuickReply, command: null };
    }

    const terrenoQuickReply = _tryTerrenoCreateQuickReply(userPrompt, safeContext, askOptions);
    if (terrenoQuickReply) {
      return _emitTerrenoQuickReply(this, historyUserText, terrenoQuickReply, askOptions);
    }

    // IMPORTANTE: context.form.fields (stato attuale del form) deve essere impostato dal widget
    // tramite setContext('form', formCtx) prima di ask(), così Gemini sa cosa è già compilato e cosa manca.
    // DEBUG disabilitato: console.log('[Tony Service] contextForPrompt:', JSON.stringify(safeContext, null, 2));
    
    let text;
    if (this._useCallable && this._tonyAskCallable) {
      const rawData = await this._callTonyAskCallable({
        message: userPrompt,
        context: safeContext,
        history: safeHistory
      });
      let parsedData = {};
      const fullResponseText = typeof rawData === 'string' ? rawData : (rawData && typeof rawData.text === 'string' ? rawData.text : '');
      if (fullResponseText && fullResponseText.includes('```json') && typeof window !== 'undefined' && window.TonyFormInjector && window.TonyFormInjector.extractFormDataFromText) {
        const extracted = window.TonyFormInjector.extractFormDataFromText(fullResponseText);
        if (extracted && extracted.formData && Object.keys(extracted.formData).length > 0) {
          var fd0 = extracted.formData;
          var keys0 = Object.keys(fd0);
          var ctxForm = (contextForPrompt && contextForPrompt.form && contextForPrompt.form.formId) ? String(contextForPrompt.form.formId) : '';
          var pathLow = typeof window !== 'undefined' && window.location && window.location.pathname ? String(window.location.pathname).toLowerCase() : '';
          var onNuovoPreventivoPage = pathLow.indexOf('nuovo-preventivo') >= 0 || ctxForm === 'preventivo-form';
          if (onNuovoPreventivoPage) {
            var needPrevDate =
              (fd0['data-prevista'] == null || String(fd0['data-prevista']).trim() === '') &&
              (fd0['attivita-data'] != null && String(fd0['attivita-data']).trim() !== '' ||
                fd0['dataPrevista'] != null && String(fd0['dataPrevista']).trim() !== '' ||
                fd0['data_prevista'] != null && String(fd0['data_prevista']).trim() !== '');
            if (needPrevDate) {
              fd0 = Object.assign({}, fd0);
              if (fd0['data-prevista'] == null || String(fd0['data-prevista']).trim() === '') {
                if (fd0['attivita-data'] != null && String(fd0['attivita-data']).trim() !== '') {
                  fd0['data-prevista'] = fd0['attivita-data'];
                  delete fd0['attivita-data'];
                } else if (fd0['dataPrevista'] != null && String(fd0['dataPrevista']).trim() !== '') {
                  fd0['data-prevista'] = fd0['dataPrevista'];
                  delete fd0['dataPrevista'];
                } else if (fd0['data_prevista'] != null && String(fd0['data_prevista']).trim() !== '') {
                  fd0['data-prevista'] = fd0['data_prevista'];
                  delete fd0['data_prevista'];
                }
              }
              keys0 = Object.keys(fd0);
              extracted.formData = fd0;
            }
          }
          var explicitLavoro0 = keys0.some(function (k) { return k === 'lavoro-tipo-lavoro' || k === 'lavoro-nome' || k === 'tipo-assegnazione'; });
          var explicitAttivita0 = keys0.some(function (k) { return k.indexOf('attivita-') === 0; });
          var explicitPreventivo0 =
            keys0.indexOf('cliente-id') >= 0 &&
            (keys0.indexOf('tipo-lavoro') >= 0 || keys0.indexOf('coltura-categoria') >= 0 || keys0.indexOf('coltura') >= 0 || keys0.indexOf('terreno-id') >= 0);
          var preventivoKeyHints = ['tipo-lavoro', 'terreno-id', 'cliente-id', 'coltura-categoria', 'coltura', 'tipo-campo', 'superficie', 'lavoro-categoria-principale', 'lavoro-sottocategoria', 'iva', 'giorni-scadenza', 'data-prevista', 'dataPrevista', 'data_prevista', 'note'];
          var looksLikePreventivo0 = keys0.some(function (k) { return preventivoKeyHints.indexOf(k) >= 0; });
          var injectFormId0 = 'attivita-form';
          if (keys0.some(function (k) { return k.indexOf('trattamento-') === 0; })) {
            injectFormId0 = 'form-trattamento';
          } else if ((explicitPreventivo0 || (onNuovoPreventivoPage && looksLikePreventivo0 && !explicitLavoro0)) && !explicitAttivita0) {
            injectFormId0 = 'preventivo-form';
          } else if (keys0.some(function (k) { return k.indexOf('lavoro-') === 0 || k === 'tipo-assegnazione'; })) {
            injectFormId0 = 'lavoro-form';
          }
          parsedData = { text: extracted.cleanedText || extracted.replyText || 'Ok.', command: { type: 'INJECT_FORM_DATA', formId: injectFormId0, formData: extracted.formData } };
          console.log('[Tony Service] Blocco ```json rilevato: uso SOLO INJECT_FORM_DATA, annullo eventuali SET_FIELD');
        }
      }
      if (parsedData.command && parsedData.command.type === 'INJECT_FORM_DATA') {
        text = parsedData.text ?? 'Ok.';
        const cmdParams = { formId: parsedData.command.formId, formData: parsedData.command.formData };
        this.triggerAction('INJECT_FORM_DATA', cmdParams);
        const cleanedInject = this._parseAndTriggerActions(text);
        this._pushChatTurn(historyUserText, cleanedInject, askOptions);
        return { text: cleanedInject, command: parsedData.command };
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
      parsedData.command = normalizeTonyCommand(parsedData.command);
      const resolvedCallable = resolveTonyUserVisibleText(text, parsedData.command);
      text = resolvedCallable.text;
      parsedData.command = resolvedCallable.command;
      if (parsedData.command && typeof parsedData.command === 'object' && parsedData.command.type) {
        var cmdT0 = String(parsedData.command.type).toUpperCase();
        // Il widget invia «Form completo, confermi salvataggio?» come prompt proattivo; la CF a volte restituisce SAVE_ACTIVITY / QUICK_SAVE come se l'utente avesse confermato → non eseguire finché l'utente non scrive davvero una conferma (es. «sì» / «salva», o pulsante — gestito lato main.js).
        var proactiveSavePrompt =
          askOptions.proactive &&
          userPrompt &&
          (/confermi\s+salvataggio/i.test(String(userPrompt)) || /^form\s+completo,?\s*confermi/i.test(String(userPrompt)));
        var blockProactiveFalseSave =
          proactiveSavePrompt &&
          (cmdT0 === 'SAVE_ACTIVITY' ||
            cmdT0 === 'QUICK_SAVE' ||
            cmdT0 === 'SUBMIT_FORM' ||
            cmdT0 === 'SALVA' ||
            cmdT0 === 'SAVE');
        if (blockProactiveFalseSave) {
          var blockedCmd = cmdT0;
          console.log('[Tony Service] Comando salvataggio non eseguito (', blockedCmd, '): prompt proattivo di verifica modulo, non conferma utente');
          parsedData.command = null;
          var rep = parsedData.text != null ? String(parsedData.text) : '';
          var isQuickHoursSave =
            blockedCmd === 'QUICK_SAVE' ||
            blockedCmd === 'SUBMIT_FORM' ||
            blockedCmd === 'SALVA' ||
            blockedCmd === 'SAVE';
          if (isQuickHoursSave) {
            if (!rep.trim() || /salvat|registrat|ore|perfetto|ok\s*salvo|procedo\s+con\s+il\s+salv/i.test(rep.trim())) {
              parsedData.text =
                'Il form delle ore sembra completo. Per salvare scrivi «sì» o «salva» qui in chat, oppure tocca «Salva ore lavorate» sullo schermo Segna ore.';
            }
          } else if (!rep.trim() || /attivit[aà]\s*salvat|salvat[aoe]\s*!|^\s*ok\.?\s*$/i.test(rep.trim())) {
            parsedData.text =
              'Il modulo sembra pronto. Per salvare in anagrafica dimmi esplicitamente «ok salva» o «sì, salva». Se vuoi cambiare ancora qualcosa (es. unità di misura), dimmelo prima.';
          }
          text = parsedData.text;
        } else if (
          cmdT0 === 'SAVE_ACTIVITY' &&
          typeof window !== 'undefined'
        ) {
          try {
            var cpSave = this._getContextForPrompt();
            var fidSave = cpSave && cpSave.form && cpSave.form.formId ? String(cpSave.form.formId) : '';
            var isMagSave = fidSave === 'prodotto-form' || fidSave === 'movimento-form';
            // Dopo OPEN_MODAL/INJECT il contesto form a volte non ha ancora formId: stessa guardia se siamo su pagina anagrafica prodotti/movimenti.
            if (!isMagSave && typeof window !== 'undefined' && window.location && window.location.pathname) {
              var plMag = String(window.location.pathname).toLowerCase();
              if (plMag.indexOf('prodotti') >= 0 || plMag.indexOf('movimenti') >= 0) {
                isMagSave = true;
              }
            }
            var upSave = String(historyUserText || '').trim();
            // Non richiedere upSave truthy: se il prompt è vuoto (replay/turno interno) non è una conferma → bloccare.
            if (isMagSave && !this._magazzinoUserPromptLooksLikeSaveConfirm(upSave)) {
              console.log('[Tony Service] SAVE_ACTIVITY non eseguito (magazzino): il messaggio non è una conferma esplicita di salvataggio');
              parsedData.command = null;
              var rtMag = parsedData.text != null ? String(parsedData.text) : '';
              if (!rtMag.trim() || /salvat|registrat|prodotto\s+salv|movimento\s+registr/i.test(rtMag)) {
                parsedData.text = 'Quando vuoi registrare in anagrafica, dimmi «ok salva».';
              }
              text = parsedData.text;
            }
          } catch (eMagSave) { /* ignore */ }
          if (parsedData.command) {
            console.log('[Tony] ESEGUO COMANDO:', parsedData.command);
            this.triggerAction(parsedData.command.type, parsedData.command);
          }
        } else {
          const blockFieldQhAsk = _blockFieldWorkspaceQuickHoursSaveCommand(
            parsedData.command,
            historyUserText,
            contextForPrompt
          );
          if (blockFieldQhAsk) {
            console.log('[Tony Service] QUICK_SAVE workspace ore non eseguito: serve conferma esplicita («sì»/«salva»).');
            parsedData.command = null;
            if (!text.trim() || isTonyQuickHoursCfFakeSaveText(text)) {
              parsedData.text = 'Per salvare le ore scrivi «sì» o «salva», oppure tocca «Salva ore lavorate» sul form.';
              text = parsedData.text;
            }
          } else {
            console.log('[Tony] ESEGUO COMANDO:', parsedData.command);
            this.triggerAction(parsedData.command.type, parsedData.command);
          }
        }
      }
      
      // Se il parsing è fallito ma abbiamo ancora la stringa grezza con JSON,
      // restituisci oggetto così il widget può provare a parsare (non restituire stringa nuda)
      if (typeof rawData === 'string' && rawData.includes('"command"') && !parsedData.command) {
        console.log('[Tony Service] Parsing fallito ma JSON presente nella risposta grezza, passo al widget come oggetto');
        const cleaned = this._parseAndTriggerActions(rawData.replace(/\{[\s\S]*\}/g, '').trim() || rawData);
        this._pushChatTurn(historyUserText, cleaned, askOptions);
        return { text: cleaned, command: null };
      }
      // Restituisci al widget l'oggetto { text, command } quando il backend ha già estratto il comando
      if (parsedData.command && typeof parsedData.command === 'object' && parsedData.command.type) {
        this._pushChatTurn(historyUserText, text, askOptions);
        return { text: text, command: parsedData.command };
      }
      const cleanedNoCmd = this._parseAndTriggerActions(text);
      const finalText = (cleanedNoCmd || text || 'Nessuna risposta da Tony.').toString().trim() || 'Ok.';
      this._pushChatTurn(historyUserText, finalText, askOptions);
      return { text: finalText, command: null };
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

    this._pushChatTurn(historyUserText, cleaned, askOptions);

    return cleaned;
  }

  /**
   * askStream via CF SSE (Fase 3): quick reply = solo evento done; Gemini = chunk + done.
   */
  async _askStreamViaCallable(userPrompt, opts = {}) {
    const onChunk = opts.onChunk || (() => {});
    const historyUserText =
      opts && opts.historyUserMessage != null && String(opts.historyUserMessage).trim() !== ''
        ? String(opts.historyUserMessage).trim()
        : String(userPrompt || '').trim();

    if (historyUserText && !(opts && opts.skipUserHistory)) {
      try {
        if (typeof window !== 'undefined') window.__tonyLastUserMessage = historyUserText;
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('tony_last_user_message', historyUserText);
        }
      } catch (_) {}
    }

    const contextForPrompt = this._getContextForPrompt({ forCallable: true });
    const lightContext = this._sanitizeContextForAI(contextForPrompt);
    let safeContext = this._sanitizeForJson(lightContext);
    safeContext = this._prepareContextForCallable(safeContext);
    const safeHistory = this._sanitizeForJson(this.chatHistory);

    let tenantId = null;
    try {
      const mod = await import('./tenant-service.js');
      tenantId = mod.getCurrentTenantId ? mod.getCurrentTenantId() : null;
    } catch (_) {
      tenantId = (typeof window !== 'undefined' && window.currentTenantId) ? window.currentTenantId : null;
    }
    if (tenantId && safeContext) {
      if (!safeContext.dashboard) safeContext.dashboard = {};
      safeContext.dashboard.tenantId = tenantId;
    }

    const fieldQuick = _tryFieldWorkspaceEnumerateJobsReply(userPrompt, safeContext, opts);
    if (fieldQuick != null && String(fieldQuick).trim()) {
      onChunk(fieldQuick);
      this._pushChatTurn(historyUserText, fieldQuick, opts);
      return { text: fieldQuick, command: null };
    }

    const terrenoQuickStream = _tryTerrenoCreateQuickReply(userPrompt, safeContext, opts);
    if (terrenoQuickStream) {
      onChunk(terrenoQuickStream.text);
      return _emitTerrenoQuickReply(this, historyUserText, terrenoQuickStream, opts);
    }

    const rawData = await this._callTonyAskStream({
      message: userPrompt,
      context: safeContext,
      history: safeHistory,
      onChunk,
    });

    return this._finalizeCallableResponse(rawData, userPrompt, opts, historyUserText);
  }

  /**
   * Post-process risposta CF { text, command } — allineato al path callable di ask().
   */
  _finalizeCallableResponse(rawData, userPrompt, askOptions, historyUserText) {
    let parsedData =
      rawData && typeof rawData === 'object'
        ? { text: rawData.text, command: rawData.command || null }
        : { text: String(rawData || ''), command: null };

    let text = parsedData.text != null ? String(parsedData.text) : 'Ok.';
    parsedData.command = normalizeTonyCommand(parsedData.command);

    const resolved = resolveTonyUserVisibleText(text, parsedData.command);
    text = resolved.text;
    parsedData.command = resolved.command;

    if (parsedData.command && typeof parsedData.command === 'object' && parsedData.command.type) {
      const cmdT0 = String(parsedData.command.type).toUpperCase();
      const proactiveSavePrompt =
        askOptions.proactive &&
        userPrompt &&
        (/confermi\s+salvataggio/i.test(String(userPrompt)) || /^form\s+completo,?\s*confermi/i.test(String(userPrompt)));
      const blockProactiveFalseSave =
        proactiveSavePrompt &&
        (cmdT0 === 'SAVE_ACTIVITY' ||
          cmdT0 === 'QUICK_SAVE' ||
          cmdT0 === 'SUBMIT_FORM' ||
          cmdT0 === 'SALVA' ||
          cmdT0 === 'SAVE');
      if (!blockProactiveFalseSave) {
        const ctxForSaveBlock = this._getContextForPrompt({ forCallable: true });
        const blockFieldQhSave = _blockFieldWorkspaceQuickHoursSaveCommand(
          parsedData.command,
          historyUserText,
          ctxForSaveBlock
        );
        if (blockFieldQhSave) {
          console.log('[Tony Service] QUICK_SAVE workspace ore non eseguito: serve conferma esplicita («sì»/«salva»).');
          parsedData.command = null;
          if (!text.trim() || isTonyQuickHoursCfFakeSaveText(text)) {
            text = 'Per salvare le ore scrivi «sì» o «salva», oppure tocca «Salva ore lavorate» sul form.';
          }
        } else {
          this.triggerAction(parsedData.command.type, parsedData.command);
        }
      }
    }

    const finalText = (text || 'Ok.').trim() || 'Ok.';
    this._pushChatTurn(historyUserText, finalText, askOptions);
    return {
      text: finalText,
      command: parsedData.command && parsedData.command.type ? parsedData.command : null,
    };
  }

  /**
   * Fallback ask() con emissione onChunk (testo completo) per UI/TTS quando SSE non disponibile.
   */
  async _askStreamCallableFallback(userPrompt, opts = {}) {
    const onChunk = opts.onChunk || (() => {});
    const result = await this.ask(userPrompt, opts);
    let text = '';
    if (result && typeof result === 'object' && result.text != null) {
      text = String(result.text);
    } else if (result != null) {
      text = String(result);
    }
    if (text.trim()) onChunk(text);
    return result;
  }

  /**
   * Invia una domanda a Tony con streaming. Emette chunk via onChunk; restituisce il testo completo finale.
   * Se usa Cloud Function (callable), fa fallback su ask() senza streaming.
   * @param {string} userPrompt - Testo dell'utente
   * @param {{ onChunk?: (chunk: string) => void, skipUserHistory?: boolean, proactive?: boolean, historyUserMessage?: string }} opts - Callback chunk; skipUserHistory/proactive/historyUserMessage come in ask()
   * @returns {Promise<string>} Risposta completa (testo ripulito dalle azioni)
   */
  async askStream(userPrompt, opts = {}) {
    if (!this._ready) {
      throw new Error('Tony non inizializzato. Chiama Tony.init(app) prima.');
    }
    const onChunk = opts.onChunk || (() => {});
    const historyUserText =
      opts && opts.historyUserMessage != null && String(opts.historyUserMessage).trim() !== ''
        ? String(opts.historyUserMessage).trim()
        : String(userPrompt || '').trim();

    if (this._useCallable && this._tonyAskCallable && this._preferCallableOverStream(opts)) {
      console.log('[Tony] Uso tonyAsk callable (SSE disabilitato in sessione).');
      return await this._askStreamCallableFallback(userPrompt, opts);
    }

    if (this._useCallable && this._tonyAskStreamUrl) {
      try {
        return await this._askStreamViaCallable(userPrompt, opts);
      } catch (streamErr) {
        this._markStreamDisabled(streamErr && streamErr.message);
        console.warn('[Tony] tonyAskStream fallito, fallback ask():', streamErr && streamErr.message);
        return await this._askStreamCallableFallback(userPrompt, opts);
      }
    }

    if (this._useCallable && this._tonyAskCallable) {
      return await this._askStreamCallableFallback(userPrompt, opts);
    }

    if (!this.model) {
      throw new Error('Tony non inizializzato. Chiama Tony.init(app) prima.');
    }

    if (historyUserText && !(opts && opts.skipUserHistory)) {
      try {
        if (typeof window !== 'undefined') window.__tonyLastUserMessage = historyUserText;
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('tony_last_user_message', historyUserText);
        }
      } catch (_) {}
    }

    const contextForPrompt = this._getContextForPrompt({ forCallable: this._useCallable });
    const lightStreamContext = this._sanitizeContextForAI(contextForPrompt);
    const safeStreamContext = this._sanitizeForJson(lightStreamContext);
    const fieldWorkspaceQuickStream = _tryFieldWorkspaceEnumerateJobsReply(userPrompt, safeStreamContext, opts);
    if (fieldWorkspaceQuickStream != null && String(fieldWorkspaceQuickStream).trim()) {
      onChunk(fieldWorkspaceQuickStream);
      this._pushChatTurn(historyUserText, fieldWorkspaceQuickStream, opts);
      return fieldWorkspaceQuickStream;
    }

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

    this._pushChatTurn(historyUserText, cleaned, opts);

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
