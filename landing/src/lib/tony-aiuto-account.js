/**
 * Logica pura dell'aiuto per l'account (passo 14).
 * Niente Vue, niente rete, niente persistenza browser.
 */

import { EMAIL_CONTATTO } from '../config/landing-config.js';
import { testiLanding } from '../content/testi-landing.js';
import {
  LIMITI,
  risolviControAzienda,
  validaRichiestaSetup,
} from './generati/tony-landing-setup-core.js';

export const PASSI_AIUTO = Object.freeze(['sede', 'poderi', 'terreni']);

/**
 * @param {string} passo
 * @returns {string | null}
 */
export function prossimoPasso(passo) {
  const i = PASSI_AIUTO.indexOf(passo);
  if (i < 0 || i >= PASSI_AIUTO.length - 1) return null;
  return PASSI_AIUTO[i + 1];
}

/**
 * @param {string} grezzo
 * @returns {number | null}
 */
export function numeroDaTesto(grezzo) {
  if (grezzo == null) return null;
  const s = String(grezzo).trim().replace(/\s+/g, '').replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

function chiaveNome(nome) {
  return String(nome || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * @param {object} attuali
 * @param {object|null} nuovi
 * @param {string} argomento
 */
export function unisciDati(attuali, nuovi, argomento) {
  const base = attuali && typeof attuali === 'object' ? attuali : {};
  const n = nuovi && typeof nuovi === 'object' ? nuovi : {};
  const out = {
    sede: base.sede || null,
    poderi: Array.isArray(base.poderi) ? base.poderi.slice() : [],
    terreni: Array.isArray(base.terreni) ? base.terreni.slice() : [],
  };
  let troppiTerreni = false;

  if (n.sede && (!out.sede || !out.sede.citta)) {
    const prev = out.sede && typeof out.sede === 'object' ? out.sede : {};
    out.sede = {
      indirizzo: n.sede.indirizzo || prev.indirizzo || null,
      citta: n.sede.citta || prev.citta || null,
      cap: n.sede.cap || prev.cap || null,
      provincia: n.sede.provincia || prev.provincia || null,
    };
  }

  if (argomento === 'poderi' || (Array.isArray(n.poderi) && n.poderi.length)) {
    const visti = Object.create(null);
    for (const p of out.poderi) {
      visti[chiaveNome(p.nome)] = true;
    }
    const aggiunti = Array.isArray(n.poderi) ? n.poderi : [];
    for (const p of aggiunti) {
      if (!p || !p.nome) continue;
      const k = chiaveNome(p.nome);
      if (!k || visti[k]) continue;
      if (out.poderi.length >= LIMITI.MAX_PODERI) break;
      visti[k] = true;
      out.poderi.push({ nome: String(p.nome).trim() });
    }
  }

  if (argomento === 'terreni' || (Array.isArray(n.terreni) && n.terreni.length)) {
    const visti = Object.create(null);
    for (const t of out.terreni) {
      visti[chiaveNome(t.nome)] = true;
    }
    const aggiunti = Array.isArray(n.terreni) ? n.terreni : [];
    if (out.terreni.length + aggiunti.length > LIMITI.MAX_TERRENI_PER_RICHIESTA) {
      troppiTerreni = true;
    }
    for (const t of aggiunti) {
      if (!t || !t.nome) continue;
      const k = chiaveNome(t.nome);
      if (!k || visti[k]) continue;
      if (out.terreni.length >= LIMITI.MAX_TERRENI_PER_RICHIESTA) {
        troppiTerreni = true;
        break;
      }
      visti[k] = true;
      out.terreni.push({
        nome: String(t.nome).trim(),
        superficie: typeof t.superficie === 'number' ? t.superficie : null,
        coltura: t.coltura == null || t.coltura === '' ? null : String(t.coltura),
        podere: t.podere == null || t.podere === '' ? null : String(t.podere),
      });
    }
  }

  return { dati: out, troppiTerreni };
}

/**
 * Testo per il prompt account: cosa è già stato raccolto.
 * @param {{ sede?: object|null, poderi?: object[], terreni?: object[] }} dati
 */
export function serializzaRaccolti(dati) {
  const d = dati && typeof dati === 'object' ? dati : {};
  const righe = [];
  if (d.sede && typeof d.sede === 'object' && (d.sede.citta || d.sede.indirizzo)) {
    const pezzi = [];
    if (d.sede.indirizzo) pezzi.push(String(d.sede.indirizzo));
    if (d.sede.citta) pezzi.push(String(d.sede.citta));
    if (d.sede.cap) pezzi.push('CAP ' + d.sede.cap);
    if (d.sede.provincia) pezzi.push(String(d.sede.provincia));
    righe.push('Sede: ' + pezzi.join(', '));
  }
  if (Array.isArray(d.poderi) && d.poderi.length) {
    righe.push(
      'Poderi: ' +
        d.poderi
          .map((p) => (p && p.nome ? String(p.nome) : ''))
          .filter(Boolean)
          .join(', ')
    );
  }
  if (Array.isArray(d.terreni) && d.terreni.length) {
    for (const t of d.terreni) {
      if (!t || !t.nome) continue;
      let r = 'Terreno «' + String(t.nome) + '»';
      if (typeof t.superficie === 'number') r += ', ' + t.superficie + ' ha';
      if (t.coltura) r += ', coltura ' + t.coltura;
      if (t.podere) r += ', podere ' + t.podere;
      righe.push(r);
    }
  }
  return righe.join('\n');
}

const MESSAGGIO_RIEPILOGO =
  'Facciamo così: controlla il riepilogo e completa lì.';

/**
 * @param {{
 *   nuoviDati?: boolean,
 *   fuoriTema?: number,
 *   turniSenzaNovitaNelPasso?: number,
 *   domandeRimaste?: number
 * }} opts
 */
export function decidiDopoRisposta(opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const senzaNovita =
    typeof o.turniSenzaNovitaNelPasso === 'number' ? o.turniSenzaNovitaNelPasso : 0;
  const fuori = typeof o.fuoriTema === 'number' ? o.fuoriTema : 0;
  const rimaste =
    typeof o.domandeRimaste === 'number' ? o.domandeRimaste : Number.POSITIVE_INFINITY;
  if (senzaNovita >= 2 || fuori >= 2 || rimaste <= 3) {
    return { apriRiepilogo: true, messaggio: MESSAGGIO_RIEPILOGO };
  }
  return { apriRiepilogo: false };
}

/**
 * @param {{
 *   sede?: { indirizzo?: string, citta?: string, cap?: string, provincia?: string } | null,
 *   poderi?: Array<{ nome?: string }>,
 *   terreni?: Array<{ nome?: string, superficie?: string|number, coltura?: string|null, podere?: string|null }>
 * }} righe
 * @param {string} requestId
 */
export function payloadDaScheda(righe, requestId) {
  const r = righe && typeof righe === 'object' ? righe : {};
  let sede = null;
  if (r.sede && typeof r.sede === 'object') {
    const indirizzo = String(r.sede.indirizzo || '').trim();
    const citta = String(r.sede.citta || '').trim();
    const cap = String(r.sede.cap || '').trim();
    const provincia = String(r.sede.provincia || '').trim();
    if (indirizzo || citta) {
      sede = {
        indirizzo: indirizzo || null,
        citta: citta || null,
        cap: cap || null,
        provincia: provincia || null,
      };
    }
  }

  const poderi = [];
  if (Array.isArray(r.poderi)) {
    for (const p of r.poderi) {
      const nome = String(p && p.nome != null ? p.nome : '').trim();
      if (!nome) continue;
      poderi.push({ nome });
    }
  }

  const terreni = [];
  if (Array.isArray(r.terreni)) {
    for (const t of r.terreni) {
      const nome = String(t && t.nome != null ? t.nome : '').trim();
      if (!nome) continue;
      const superficie = numeroDaTesto(t && t.superficie != null ? t.superficie : '');
      terreni.push({
        nome,
        superficie,
        coltura:
          t && t.coltura != null && String(t.coltura).trim()
            ? String(t.coltura).trim()
            : null,
        podere:
          t && t.podere != null && String(t.podere).trim()
            ? String(t.podere).trim()
            : null,
      });
    }
  }

  return {
    requestId: String(requestId || ''),
    sede,
    poderi,
    terreni,
  };
}

/**
 * @param {object} payload
 */
export function controllaScheda(payload) {
  const validata = validaRichiestaSetup(payload);
  if (!validata.ok) {
    if (validata.motivo === 'niente-da-salvare') {
      return { ok: false, codice: 'niente-da-salvare', errori: [] };
    }
    const errori = Array.isArray(validata.errori) ? validata.errori : [];
    return {
      ok: false,
      codice: 'dati-non-validi',
      errori: errori.map((e) => ({
        campo: e.campo,
        errore: e.errore,
      })),
    };
  }

  const risolta = risolviControAzienda(validata.richiesta, {
    poderi: [],
    terreni: [],
    coltureAzienda: [],
  });
  if (!risolta.ok) {
    return {
      ok: false,
      codice: 'dati-non-validi',
      errori: (risolta.errori || []).map((e) => ({
        campo: e.campo,
        errore: e.errore,
      })),
    };
  }

  const da = risolta.daScrivere || {};
  const nienteDaSalvare =
    !da.sede &&
    !(da.poderiDaCreare && da.poderiDaCreare.length) &&
    !(da.terreni && da.terreni.length);
  if (nienteDaSalvare) {
    return { ok: false, codice: 'niente-da-salvare', errori: [] };
  }

  return { ok: true, daScrivere: da };
}

export function nuovoRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'req-' + Date.now() + '-' + Math.floor(Math.random() * 1e9);
}

/**
 * @param {{ codice?: string, motivo?: string, dettagli?: object }} errore
 * @param {{ collegato?: boolean, email?: string }} [ctx]
 */
export function messaggioErroreSetup(errore, ctx) {
  const t = testiLanding.tonyBussa.aiuto.errori;
  const e = errore && typeof errore === 'object' ? errore : {};
  const motivo = String(e.motivo || e.codice || '');
  const dettagli = e.dettagli && typeof e.dettagli === 'object' ? e.dettagli : {};
  void ctx;
  const email = EMAIL_CONTATTO || '';

  if (motivo === 'unauthenticated' || motivo === 'non-collegato') {
    return t.nonCollegato;
  }
  if (motivo === 'app-check' || motivo === 'failed-precondition') {
    return t.appCheck;
  }
  if (motivo === 'troppe-chiamate' || motivo === 'resource-exhausted') {
    return t.troppeChiamate;
  }
  if (motivo === 'dati-non-validi' || motivo === 'invalid-argument') {
    return t.datiNonValidi;
  }
  if (motivo === 'niente-da-salvare') {
    return t.nienteDaSalvare;
  }
  if (motivo === 'senza-azienda' || motivo === 'non-autorizzato') {
    let msg = t.senzaAzienda;
    if (email) {
      msg += ' ' + t.contatto.replace('{email}', email);
    }
    return msg;
  }
  if (motivo === 'limite-terreni') {
    const esistenti =
      typeof dettagli.esistenti === 'number' ? dettagli.esistenti : 0;
    const limite = typeof dettagli.limite === 'number' ? dettagli.limite : 5;
    const rimasti = Math.max(0, limite - esistenti);
    return t.limiteTerreni
      .replace('{esistenti}', String(esistenti))
      .replace('{rimasti}', String(rimasti));
  }
  if (motivo === 'gia-preparato' || motivo === 'already-exists') {
    return t.giaPreparato;
  }
  if (motivo === 'unavailable' || motivo === 'rete') {
    return t.rete;
  }
  return t.rete;
}

/**
 * @param {object} risposta
 */
export function esitoSalvataggio(risposta) {
  if (!risposta || typeof risposta !== 'object') return { ok: false };
  if (risposta.ok === true) return { ok: true };
  if (risposta.giaSalvato === true) return { ok: true };
  if (risposta.data && risposta.data.ok === true) return { ok: true };
  if (risposta.data && risposta.data.giaSalvato === true) return { ok: true };
  return { ok: false };
}
