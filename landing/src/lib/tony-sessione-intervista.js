/**
 * Persistenza dell'intervista guidata (aiuto account) in sessionStorage.
 * Logica pura: lo storage arriva da fuori (testabile con un finto Storage).
 *
 * Mai salvati: email, password, token, dati di registrazione.
 * Si salva solo lo stato della conversazione e i dati azienda raccolti.
 */

import { compattaTerreni, nomeTerrenoVisibile } from './tony-aiuto-account.js';

export const CHIAVE_SESSIONE_INTERVISTA = 'gfv-landing-intervista';
export const VERSIONE_SESSIONE_INTERVISTA = 1;
export const TTL_SESSIONE_INTERVISTA_MS = 2 * 60 * 60 * 1000;

const MAX_MESSAGGI = 60;
const MAX_CARATTERI_MESSAGGIO = 1200;
const MAX_BATTUTE_STORIA = 10;
const PASSI_VALIDI = ['invito', 'sede', 'poderi', 'terreni', 'scheda'];

const RE_EMAIL = /[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+/g;

/** «password: xyz», «pwd=xyz»: mai in sessionStorage. */
const RE_PASSWORD = /\b(?:password|passwd|pwd)\s*[:=]\s*\S+/gi;

function testoSicuro(valore, max) {
  let s = String(valore == null ? '' : valore);
  s = s.replace(RE_EMAIL, '').replace(RE_PASSWORD, '').replace(/\s{2,}/g, ' ').trim();
  return s.length > max ? s.slice(0, max) : s;
}

function testoOpz(valore, max) {
  if (valore == null || valore === '') return null;
  const s = testoSicuro(valore, max);
  return s || null;
}

function pulisciSede(sede) {
  if (!sede || typeof sede !== 'object') return null;
  const out = {
    indirizzo: testoOpz(sede.indirizzo, 200),
    citta: testoOpz(sede.citta, 120),
    cap: testoOpz(sede.cap, 10),
    provincia: testoOpz(sede.provincia, 4),
  };
  return out.indirizzo || out.citta || out.cap || out.provincia ? out : null;
}

function pulisciDati(dati) {
  const d = dati && typeof dati === 'object' ? dati : {};
  const poderi = (Array.isArray(d.poderi) ? d.poderi : [])
    .map((p) => testoSicuro(p && p.nome, 120))
    .filter(Boolean)
    .slice(0, 10)
    .map((nome) => ({ nome }));
  const terreni = (Array.isArray(d.terreni) ? d.terreni : [])
    .filter(
      (t) =>
        t &&
        (t.nome ||
          (typeof t.superficie === 'number' && Number.isFinite(t.superficie)) ||
          t.coltura)
    )
    .slice(0, 10)
    .map((t) => {
      const voce = {
        nome: nomeTerrenoVisibile(testoSicuro(t.nome, 120)),
        superficie:
          typeof t.superficie === 'number' && Number.isFinite(t.superficie)
            ? t.superficie
            : null,
        coltura: testoOpz(t.coltura, 80),
        podere: testoOpz(t.podere, 120),
      };
      const categoria = testoOpz(t.categoria, 40);
      if (categoria) voce.categoria = categoria;
      return voce;
    })
    .filter((t) => t.nome || t.superficie != null || t.coltura);
  return {
    sede: pulisciSede(d.sede),
    poderi,
    terreni: compattaTerreni(terreni),
    ultimoPodere: testoOpz(d.ultimoPodere, 120),
    senzaPoderi: d.senzaPoderi === true,
  };
}

function pulisciMessaggi(lista) {
  return (Array.isArray(lista) ? lista : [])
    .filter(
      (m) =>
        m &&
        (m.ruolo === 'utente' || m.ruolo === 'tony') &&
        typeof m.testo === 'string' &&
        m.testo.trim()
    )
    .slice(-MAX_MESSAGGI)
    .map((m) => ({ ruolo: m.ruolo, testo: testoSicuro(m.testo, MAX_CARATTERI_MESSAGGIO) }))
    .filter((m) => m.testo);
}

function pulisciStoria(lista) {
  return (Array.isArray(lista) ? lista : [])
    .filter((b) => b && (b.ruolo === 'utente' || b.ruolo === 'tony'))
    .slice(-MAX_BATTUTE_STORIA)
    .map((b) => ({ ruolo: b.ruolo, testo: testoSicuro(b.testo, MAX_CARATTERI_MESSAGGIO) }));
}

function numeroNonNegativo(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

/**
 * Costruisce il record da salvare (solo campi in whitelist).
 * @param {object} stato
 * @param {number} adesso
 */
export function costruisciSessioneIntervista(stato, adesso) {
  const s = stato && typeof stato === 'object' ? stato : {};
  const passo = PASSI_VALIDI.indexOf(s.passoAiuto) >= 0 ? s.passoAiuto : null;
  return {
    versione: VERSIONE_SESSIONE_INTERVISTA,
    salvatoAlMs: typeof adesso === 'number' ? adesso : Date.now(),
    messaggi: pulisciMessaggi(s.messaggi),
    storia: pulisciStoria(s.storia),
    datiAiuto: pulisciDati(s.datiAiuto),
    passoAiuto: passo,
    schedaAperta: s.schedaAperta === true,
    tornatoDalRiepilogo: s.tornatoDalRiepilogo === true,
    giaRiaperturaLimiteDomande: s.giaRiaperturaLimiteDomande === true,
    turniSenzaNovitaNelPasso: numeroNonNegativo(s.turniSenzaNovitaNelPasso),
    consecutiviFuoriTema: numeroNonNegativo(s.consecutiviFuoriTema),
    sessione:
      typeof s.sessione === 'string' && /^[A-Za-z0-9-]{16,64}$/.test(s.sessione)
        ? s.sessione
        : null,
  };
}

/**
 * @param {Storage|null|undefined} storage
 * @param {object} stato  stato corrente dell'intervista
 * @param {number} [adesso]
 * @returns {boolean} true se salvato
 */
export function salvaSessioneIntervista(storage, stato, adesso) {
  if (!storage) return false;
  const s = stato && typeof stato === 'object' ? stato : {};
  // Si salva solo a intervista avviata e non conclusa.
  if (s.faseAiuto !== true || s.aiutoFatto === true) {
    cancellaSessioneIntervista(storage);
    return false;
  }
  try {
    storage.setItem(
      CHIAVE_SESSIONE_INTERVISTA,
      JSON.stringify(costruisciSessioneIntervista(s, adesso))
    );
    return true;
  } catch {
    return false;
  }
}

export function cancellaSessioneIntervista(storage) {
  if (!storage) return;
  try {
    storage.removeItem(CHIAVE_SESSIONE_INTERVISTA);
  } catch {
    /* storage non disponibile */
  }
}

/**
 * Legge e valida la sessione salvata. Scaduta / versione diversa / corrotta → null
 * (e il record viene rimosso).
 * @param {Storage|null|undefined} storage
 * @param {number} [adesso]
 * @returns {ReturnType<typeof costruisciSessioneIntervista> | null}
 */
export function leggiSessioneIntervista(storage, adesso) {
  if (!storage) return null;
  let grezzo = null;
  try {
    grezzo = storage.getItem(CHIAVE_SESSIONE_INTERVISTA);
  } catch {
    return null;
  }
  if (!grezzo) return null;
  let rec = null;
  try {
    rec = JSON.parse(grezzo);
  } catch {
    cancellaSessioneIntervista(storage);
    return null;
  }
  const ora = typeof adesso === 'number' ? adesso : Date.now();
  if (
    !rec ||
    typeof rec !== 'object' ||
    rec.versione !== VERSIONE_SESSIONE_INTERVISTA ||
    typeof rec.salvatoAlMs !== 'number' ||
    ora - rec.salvatoAlMs > TTL_SESSIONE_INTERVISTA_MS ||
    ora < rec.salvatoAlMs - 60 * 1000
  ) {
    cancellaSessioneIntervista(storage);
    return null;
  }
  // Rigenera dai soli campi in whitelist (ignora qualsiasi altra chiave).
  const pulita = costruisciSessioneIntervista(rec, rec.salvatoAlMs);
  if (!pulita.passoAiuto) {
    cancellaSessioneIntervista(storage);
    return null;
  }
  return pulita;
}
