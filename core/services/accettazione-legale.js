/**
 * Regole pure dell'accettazione legale. Nessun Firebase.
 * Il flag spento non chiede nulla e non costruisce una ri-accettazione.
 */

const TIPI_DOCUMENTO = ['termini-b2b', 'privacy', 'dpa', 'informativa-lavoratori'];
const DOCUMENTI_ADMIN = ['termini-b2b', 'privacy', 'dpa'];
const DOCUMENTI_INVITATO = ['informativa-lavoratori'];
const RUOLI_INVITATI = new Set(['operaio', 'caposquadra', 'manager']);
const CANALI = new Set(['registrazione', 'invito']);
const VERSION_RE = /^(termini-b2b|privacy|dpa|informativa-lavoratori)-(\d{4})-(\d{2})-(\d{2})$/;

/**
 * @param {object|null|undefined} config
 * @returns {Record<string, {versione?: string, url?: string}>|null}
 */
function estraiDocumenti(config) {
  if (!config || typeof config !== 'object') return null;
  if (config.DOCUMENTI_LEGALI && typeof config.DOCUMENTI_LEGALI === 'object') {
    return config.DOCUMENTI_LEGALI;
  }
  if (config.documenti && typeof config.documenti === 'object' && !Array.isArray(config.documenti)) {
    return config.documenti;
  }
  if (TIPI_DOCUMENTO.some((tipo) => Object.prototype.hasOwnProperty.call(config, tipo))) {
    return config;
  }
  return null;
}

/**
 * @param {object|null|undefined} config
 * @returns {boolean}
 */
function flagAttivo(config) {
  if (!config || typeof config !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(config, 'attiva')) return config.attiva === true;
  if (Object.prototype.hasOwnProperty.call(config, 'ACCETTAZIONE_LEGALE_ATTIVA')) {
    return config.ACCETTAZIONE_LEGALE_ATTIVA === true;
  }
  return false;
}

/**
 * @param {string} tipo
 * @param {unknown} versione
 * @returns {boolean}
 */
function versioneValidaPerTipo(tipo, versione) {
  if (typeof versione !== 'string') return false;
  const match = VERSION_RE.exec(versione);
  if (!match || match[1] !== tipo) return false;
  if (match[2] === '0000' && match[3] === '00' && match[4] === '00') return false;
  const anno = Number(match[2]);
  const mese = Number(match[3]);
  const giorno = Number(match[4]);
  if (mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return false;
  const data = new Date(Date.UTC(anno, mese - 1, giorno));
  return data.getUTCFullYear() === anno
    && data.getUTCMonth() === mese - 1
    && data.getUTCDate() === giorno;
}

/**
 * @param {unknown} url
 * @returns {boolean}
 */
function urlHttpsValido(url) {
  return typeof url === 'string' && url.startsWith('https://') && url.length > 'https://'.length;
}

/**
 * @param {unknown} ruoli
 * @returns {string[]}
 */
function normalizzaRuoli(ruoli) {
  if (Array.isArray(ruoli)) return ruoli.filter((ruolo) => typeof ruolo === 'string');
  if (typeof ruoli === 'string' && ruoli) return [ruoli];
  return [];
}

/**
 * @param {string[]} ricevuti
 * @param {string[]} attesi
 * @returns {boolean}
 */
function stessiTipi(ricevuti, attesi) {
  if (ricevuti.length !== attesi.length) return false;
  const a = ricevuti.slice().sort();
  const b = attesi.slice().sort();
  return a.every((tipo, indice) => tipo === b[indice]);
}

/**
 * Con attiva false è sempre ok: i placeholder non bloccano l'app.
 * Con attiva true ogni versione è del tipo giusto, con data reale, e ogni url è https.
 * @param {object} config
 * @param {boolean} attiva
 * @returns {{ ok: boolean, errori: string[] }}
 */
export function validaConfigLegale(config, attiva) {
  if (attiva !== true) return { ok: true, errori: [] };
  const errori = [];
  const documenti = estraiDocumenti(config);
  if (!documenti) {
    return { ok: false, errori: ['config documenti mancante'] };
  }
  Object.keys(documenti).forEach((chiave) => {
    if (!TIPI_DOCUMENTO.includes(chiave)) errori.push(`tipo non ammesso: ${chiave}`);
  });
  TIPI_DOCUMENTO.forEach((tipo) => {
    const doc = documenti[tipo];
    if (!doc || typeof doc !== 'object') {
      errori.push(`documento mancante: ${tipo}`);
      return;
    }
    if (!versioneValidaPerTipo(tipo, doc.versione)) {
      errori.push(`${tipo}: versione non valida (${String(doc.versione)})`);
    }
    if (!urlHttpsValido(doc.url)) {
      errori.push(`${tipo}: url deve essere https://`);
    }
  });
  return { ok: errori.length === 0, errori };
}

/**
 * Entrambe le caselle devono essere il booleano true. Nessuna preselezione.
 * @param {{ termini?: unknown, dpa?: unknown }} [input]
 * @returns {boolean}
 */
export function validaCaselleRegistrazione(input) {
  return !!(input && input.termini === true && input.dpa === true);
}

/**
 * Presa visione solo se il booleano è true.
 * @param {{ presaVisione?: unknown }} [input]
 * @returns {boolean}
 */
export function validaPresaVisioneInvito(input) {
  return !!(input && input.presaVisione === true);
}

/**
 * Admin: termini, privacy, DPA. Invitato: solo informativa lavoratori.
 * @param {string[]|string} ruoli
 * @param {'registrazione'|'invito'} [canale]
 * @returns {string[]}
 */
export function documentiRichiestiPerRuolo(ruoli, canale) {
  const lista = normalizzaRuoli(ruoli);
  const haAdmin = lista.includes('amministratore');
  const haInvitato = lista.some((ruolo) => RUOLI_INVITATI.has(ruolo));
  if (canale === 'invito') return haInvitato ? DOCUMENTI_INVITATO.slice() : [];
  if (canale === 'registrazione') return haAdmin ? DOCUMENTI_ADMIN.slice() : [];
  if (haAdmin) return DOCUMENTI_ADMIN.slice();
  if (haInvitato) return DOCUMENTI_INVITATO.slice();
  return [];
}

/**
 * Documenti la cui versione corrente manca o è diversa. Flag spento: elenco vuoto.
 * @param {Array<{ tipo?: string, versione?: string }>|null|undefined} accettazioniUtente
 * @param {string[]} richiesti
 * @param {object} config
 * @returns {Array<{ tipo: string, versione: string }>}
 */
export function decidiRiaccettazione(accettazioniUtente, richiesti, config) {
  if (!flagAttivo(config)) return [];
  const documenti = estraiDocumenti(config) || {};
  const accettate = Array.isArray(accettazioniUtente) ? accettazioniUtente : [];
  const tipi = Array.isArray(richiesti) ? richiesti : [];
  const out = [];
  tipi.forEach((tipo) => {
    const versione = documenti[tipo] && typeof documenti[tipo].versione === 'string'
      ? documenti[tipo].versione
      : '';
    const gia = accettate.some((riga) => riga
      && riga.tipo === tipo
      && versione
      && riga.versione === versione);
    if (!gia) out.push({ tipo, versione });
  });
  return out;
}

/**
 * Payload per la callable. L'uid lo aggiunge il server da request.auth.
 * @param {{ canale?: string, tenantId?: string, ruolo?: string, documenti?: unknown[], config?: object }} input
 * @returns {{ canale: string, tenantId: string, ruolo: string, documenti: Array<{ tipo: string, versione: string, versioneTestoCasella: string }> }}
 */
export function costruisciPayloadAccettazione(input) {
  if (!input || typeof input !== 'object') throw new Error('payload accettazione non valido');
  const canale = input.canale;
  const tenantId = input.tenantId;
  const ruolo = input.ruolo;
  if (!CANALI.has(canale)) throw new Error('canale non valido');
  if (typeof tenantId !== 'string' || !tenantId.trim()) throw new Error('tenantId mancante');
  if (typeof ruolo !== 'string' || !ruolo.trim()) throw new Error('ruolo mancante');
  if (!Array.isArray(input.documenti) || input.documenti.length === 0) {
    throw new Error('documenti mancanti');
  }
  const tipi = input.documenti.map((doc) => {
    if (typeof doc === 'string') return doc;
    if (doc && typeof doc.tipo === 'string') return doc.tipo;
    throw new Error('documento malformato');
  });
  const attesi = documentiRichiestiPerRuolo([ruolo], canale);
  if (attesi.length === 0 || !stessiTipi(tipi, attesi)) {
    throw new Error('documenti non coerenti con ruolo e canale');
  }
  const documenti = estraiDocumenti(input.config);
  const versioniCaselle = input.config && (
    input.config.VERSIONI_CASELLE || input.config.versioniCaselle
  );
  if (!documenti || !versioniCaselle) throw new Error('config mancante');
  const versioneTestoCasella = versioniCaselle[canale];
  if (typeof versioneTestoCasella !== 'string' || !versioneTestoCasella) {
    throw new Error('versioneTestoCasella mancante');
  }
  const righe = attesi.map((tipo) => {
    const versione = documenti[tipo] && documenti[tipo].versione;
    if (typeof versione !== 'string' || !versione) throw new Error(`versione mancante per ${tipo}`);
    return { tipo, versione, versioneTestoCasella };
  });
  return {
    canale,
    tenantId,
    ruolo,
    documenti: righe
  };
}
