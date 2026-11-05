/**
 * Ricerca indirizzo sede (Impostazioni → Mappa sede): logica pura e testabile.
 * - una sola ricerca «valida» alla volta (le vecchie risposte vengono ignorate);
 * - la proposta automatica non parte se l'utente ha già premuto Cerca;
 * - un solo avviso per esito (niente doppi toast);
 * - coda se la mappa non è ancora pronta.
 * @module core/js/sede-ricerca-indirizzo
 */

import {
  scegliGeocodeNelComune,
  scegliCentroComune,
  buildQueryCentroComune,
} from './sede-geocode-match.js';

/** Messaggio mostrato quando la ricerca viene messa in coda (mappa non ancora pronta). */
export const MSG_CARICO_MAPPA = 'Carico la mappa…';

/**
 * @param {{ adesso?: () => number, dedupToastMs?: number }} [opzioni]
 */
export function creaControlloRicercaSede(opzioni) {
  const o = opzioni && typeof opzioni === 'object' ? opzioni : {};
  const adesso = typeof o.adesso === 'function' ? o.adesso : Date.now;
  const dedupToastMs = typeof o.dedupToastMs === 'number' ? o.dedupToastMs : 2500;

  let seq = 0;
  let utenteHaCercato = false;
  let autoProposta = false;
  let ultimoToast = { msg: '', t: -Infinity };
  let coda = null;

  return {
    /**
     * Apre una nuova ricerca: invalida tutte le precedenti.
     * @param {'utente'|'auto'} origine
     * @returns {number} token da passare ad `attuale`
     */
    nuovaRichiesta(origine) {
      seq += 1;
      if (origine === 'utente') utenteHaCercato = true;
      return seq;
    },
    /** @param {number} token */
    attuale(token) {
      return token === seq;
    },
    utenteHaCercato() {
      return utenteHaCercato;
    },
    /** La proposta automatica parte una sola volta e mai dopo un click su Cerca. */
    puoProporreAutomatica() {
      return !utenteHaCercato && !autoProposta;
    },
    segnaAutoProposta() {
      autoProposta = true;
    },
    /**
     * Un solo toast per messaggio entro la finestra di dedup.
     * @param {string} msg
     * @returns {boolean} true se va mostrato
     */
    daNotificare(msg) {
      const m = String(msg || '');
      if (!m) return false;
      const t = adesso();
      if (ultimoToast.msg === m && t - ultimoToast.t < dedupToastMs) return false;
      ultimoToast = { msg: m, t };
      return true;
    },
    /**
     * Mappa non pronta: tiene solo l'ULTIMA ricerca richiesta.
     * @param {string} query
     * @param {{ origine?: 'utente'|'auto', messaggioOk?: string }} [opzioniRicerca]
     */
    accoda(query, opzioniRicerca) {
      coda = { query: String(query || ''), opzioni: opzioniRicerca || {} };
      if (opzioniRicerca && opzioniRicerca.origine === 'utente') utenteHaCercato = true;
    },
    haCoda() {
      return !!coda;
    },
    prendiCoda() {
      const c = coda;
      coda = null;
      return c;
    },
  };
}

/**
 * Risolve l'indirizzo: civico nel comune → altrimenti centro comune (locality/admin3, mai CAP).
 *
 * @param {object} args
 * @param {(req: object) => Promise<object[]>} args.geocode  restituisce [] se status != OK
 * @param {string} args.query  indirizzo da cercare
 * @param {string} [args.comune]  comune atteso (campo anagrafica)
 * @param {string} [args.provincia]
 * @param {string} [args.messaggioOk]
 * @returns {Promise<{
 *   esito: 'civico'|'centro'|'nessuno',
 *   chosen: object|null,
 *   messaggio: string,
 *   tipoToast: 'success'|'info'|'error',
 *   aggiornaTestoRicerca: boolean
 * }>}
 */
export async function risolviRicercaSede(args) {
  const a = args && typeof args === 'object' ? args : {};
  const comune = String(a.comune || '').trim();
  const provincia = String(a.provincia || '').trim();
  const query = String(a.query || '');
  const address = query.indexOf('Italia') === -1 ? query + ', Italia' : query;
  const geocode = a.geocode;

  const results = await geocode({
    address,
    region: 'it',
    componentRestrictions: { country: 'it' },
  });

  let chosen = null;
  if (Array.isArray(results) && results.length) {
    // Senza comune in anagrafica non c'è nulla da confrontare: vale il primo risultato.
    chosen = comune ? scegliGeocodeNelComune(results, comune) : results[0];
  }
  if (chosen) {
    return {
      esito: 'civico',
      chosen,
      messaggio: a.messaggioOk || 'Sede trovata. Verifica il pin e salva le impostazioni azienda.',
      tipoToast: 'success',
      aggiornaTestoRicerca: true,
    };
  }

  if (!comune) {
    return {
      esito: 'nessuno',
      chosen: null,
      messaggio:
        'Indirizzo non trovato. Prova con più dettagli o posiziona il pin manualmente sulla mappa.',
      tipoToast: 'error',
      aggiornaTestoRicerca: false,
    };
  }

  const queryCentro = buildQueryCentroComune(comune, provincia);
  const centroRes = await geocode({
    address: queryCentro,
    region: 'it',
    componentRestrictions: { country: 'it', locality: comune },
  });
  let centro = scegliCentroComune(centroRes, comune);
  if (!centro) {
    const fallbackRes = await geocode({
      address: queryCentro,
      region: 'it',
      componentRestrictions: { country: 'it' },
    });
    centro = scegliCentroComune(fallbackRes, comune);
  }
  if (centro) {
    return {
      esito: 'centro',
      chosen: centro,
      messaggio:
        'Non trovo il civico: ho messo il pin al centro di ' +
        comune +
        '. Spostalo sulla sede.',
      tipoToast: 'info',
      // Il testo di ricerca dell'utente resta com'è (non sostituirlo con «48022 Lugo RA, Italia»).
      aggiornaTestoRicerca: false,
    };
  }
  return {
    esito: 'nessuno',
    chosen: null,
    messaggio: 'Non trovo questo indirizzo a ' + comune + ': metti il pin a mano sulla mappa.',
    tipoToast: 'error',
    aggiornaTestoRicerca: false,
  };
}
