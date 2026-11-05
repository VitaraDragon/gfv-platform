/**
 * Cambio coltura e propagazione superficie al salvataggio del terreno.
 * @module shared/js/effetti-salvataggio-terreno
 */

import { isColturaFrutteto, famigliaColtura } from './coltura-terreno.js';
import { isLavoroChiuso } from './storico-sola-lettura.js';

/**
 * Testo della tendina categoria. Il segnaposto («-- Seleziona categoria --») non è una categoria.
 * @param {{ value?: string, selectedOptions?: Array<{ textContent?: string }> }|null|undefined} select
 * @returns {string|null}
 */
export function testoCategoriaColtura(select) {
  if (!select || !select.value) return null;
  const opt = select.selectedOptions && select.selectedOptions[0];
  const testo = opt ? String(opt.textContent || '').trim() : '';
  return testo || null;
}

export function cambioCategoriaColtura(prima, dopo) {
  const a = famigliaColtura(prima);
  const b = famigliaColtura(dopo);
  if (a === b) return false;
  const speciali = new Set(['vigneto', 'frutteto']);
  return speciali.has(a) || speciali.has(b);
}

function formattaDataBreve(value) {
  if (!value) return '';
  const data = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(data.getTime())) return '';
  const g = String(data.getDate()).padStart(2, '0');
  const m = String(data.getMonth() + 1).padStart(2, '0');
  return `${g}/${m}`;
}

function etichettaColtura(terrenoOColtura) {
  if (!terrenoOColtura) return '—';
  if (typeof terrenoOColtura === 'string') return terrenoOColtura || '—';
  return terrenoOColtura.coltura || terrenoOColtura.colturaCategoria || '—';
}

function numeroPositivo(value) {
  const n = typeof value === 'number' ? value : parseFloat(String(value == null ? '' : value).replace(',', '.'));
  return Number.isFinite(n) && n > 0;
}

/**
 * Completato se c'è avanzamento o ore (resta nelle statistiche CT come lavoro fatto);
 * altrimenti annullato (non gonfia i completati Conto Terzi / report).
 * @param {object|null|undefined} lavoro
 * @returns {'completato'|'annullato'}
 */
export function statoChiusuraPerCambioColtura(lavoro) {
  const lav = lavoro || {};
  if (
    numeroPositivo(lav.percentualeCompletamento) ||
    numeroPositivo(lav.superficieTotaleLavorata) ||
    numeroPositivo(lav.superficieLavorata) ||
    numeroPositivo(lav.oreLavorate) ||
    numeroPositivo(lav.oreNette) ||
    numeroPositivo(lav.totaleOre) ||
    numeroPositivo(lav.oreValidate)
  ) {
    return 'completato';
  }
  return 'annullato';
}

/**
 * Payload di chiusura di un lavoro aperto al cambio coltura.
 * @param {object} lavoro
 * @param {string} now
 */
export function payloadChiusuraLavoroCambioColtura(lavoro, now) {
  const statoPrima = lavoro && lavoro.stato != null ? String(lavoro.stato) : null;
  const stato = statoChiusuraPerCambioColtura(lavoro);
  return {
    id: lavoro.id,
    nome: lavoro.nome || 'Lavoro',
    dataInizio: lavoro.dataInizio || null,
    macchinaId: lavoro.macchinaId || null,
    attrezzoId: lavoro.attrezzoId || null,
    stato,
    patch: {
      chiusoPerCambioColtura: true,
      motivoChiusura: 'cambio_coltura',
      dataChiusura: now,
      statoPrimaChiusura: statoPrima,
      stato,
      aggiornatoIl: now
    }
  };
}

export function aggiornaStoricoColture(esistente, nuovo, now) {
  const storico = Array.isArray(esistente && esistente.storicoColture)
    ? esistente.storicoColture.slice()
    : [];
  if (esistente && (esistente.coltura || esistente.colturaCategoria)) {
    storico.push({
      coltura: esistente.coltura || null,
      colturaCategoria: esistente.colturaCategoria || null,
      dal: esistente.colturaDal || esistente.createdAt || null,
      al: now
    });
  }
  return {
    storicoColture: storico,
    colturaDal: now,
    coltura: nuovo.coltura || null,
    colturaCategoria: nuovo.colturaCategoria || null
  };
}

function nomeImpianto(impianto, tipo) {
  return impianto.varieta || impianto.nome || impianto.specie || (tipo === 'frutteto' ? 'Frutteto' : 'Vigneto');
}

export function annoInizioCampagna(etichetta) {
  const match = String(etichetta || '').match(/(\d{4})/);
  return match ? Number(match[1]) : null;
}

export function campagnaCorrenteOFutura(campagna, now = new Date()) {
  const inizio = annoInizioCampagna(campagna && (campagna.campagna || campagna.anno));
  if (inizio == null) return false;
  const mese = now.getMonth();
  const annoCorrente = mese >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return inizio >= annoCorrente;
}

export function superficieCambiata(prima, dopo) {
  const a = prima == null || prima === '' ? null : Number(prima);
  const b = dopo == null || dopo === '' ? null : Number(dopo);
  if (b == null || Number.isNaN(b)) return false;
  if (a == null || Number.isNaN(a)) return true;
  return Math.abs(a - b) > 0.0001;
}

/**
 * Testo del dialogo di cambio coltura (numero lavori reale, senza limit).
 */
export function buildMessaggioCambioColtura({ da, a, impianti = [], aperti = [] } = {}) {
  const daLabel = etichettaColtura(da);
  const aLabel = etichettaColtura(a);
  const parti = [`Cambi la coltura da ${daLabel} a ${aLabel}.`];

  if (aperti.length) {
    const voci = aperti.map((l) => {
      const quando = formattaDataBreve(l.dataInizio);
      const nome = l.nome || 'Lavoro';
      return quando ? `«${nome}» (dal ${quando})` : `«${nome}»`;
    });
    parti.push(
      `Verranno chiusi ${aperti.length} lavor${aperti.length === 1 ? 'o aperto' : 'i aperti'} della coltura precedente: ${voci.join(', ')}. ` +
        'Resteranno nello storico in sola lettura, con ore, potature e trattamenti.'
    );
  }

  if (impianti.length) {
    const nomi = impianti.map((i) => {
      const tipo = i._tipo === 'frutteto' ? 'il frutteto' : 'il vigneto';
      return `${tipo} «${nomeImpianto(i, i._tipo)}»`;
    });
    if (impianti.length === 1) {
      parti.push(`Verrà chiuso anche ${nomi[0]} (resta nello storico).`);
    } else {
      parti.push(`Verranno chiusi anche ${nomi.join(', ')} (restano nello storico).`);
    }
  }

  parti.push('Continuare?');
  return parti.join(' ');
}

export function buildMessaggioToastCambioColtura({ chiudiLavori = [], chiudi = [] } = {}) {
  const pezzi = [];
  if (chiudiLavori.length) {
    pezzi.push(`${chiudiLavori.length} lavor${chiudiLavori.length === 1 ? 'o' : 'i'}`);
  }
  if (chiudi.length) {
    const nomi = chiudi.map((i) => {
      const tipo = i.tipo === 'frutteto' ? 'il frutteto' : 'il vigneto';
      return `${tipo} «${i.nome}»`;
    });
    pezzi.push(nomi.join(' e '));
  }
  if (!pezzi.length) return 'Terreno aggiornato con successo!';
  return `Terreno aggiornato. Chiusi ${pezzi.join(' e ')}: restano nello storico.`;
}

/**
 * @param {Function} conferma - riceve il messaggio e restituisce true/false (anche Promise)
 */
export async function preparaEffettiSalvataggioTerreno({
  esistente,
  nuovo,
  vigneti = [],
  frutteti = [],
  lavori = [],
  campagne = [],
  now = new Date().toISOString(),
  oggi = new Date(),
  conferma
} = {}) {
  const effetti = {
    procedi: true,
    storico: null,
    chiudi: [],
    chiudiLavori: [],
    superfici: [],
    messaggioSuperficie: '',
    messaggioToast: '',
    messaggioConferma: ''
  };
  if (!esistente) return effetti;

  const nuovoPerFamiglia = {
    coltura: nuovo.coltura,
    colturaCategoria: nuovo.colturaCategoria || esistente.colturaCategoria
  };
  const cambia = cambioCategoriaColtura(esistente, nuovoPerFamiglia);
  const impianti = []
    .concat((vigneti || []).filter((v) => v.statoImpianto !== 'chiuso').map((v) => ({ ...v, _tipo: 'vigneto' })))
    .concat((frutteti || []).filter((f) => f.statoImpianto !== 'chiuso').map((f) => ({ ...f, _tipo: 'frutteto' })));
  const aperti = (lavori || []).filter((l) => !isLavoroChiuso(l));

  if (cambia && (impianti.length || aperti.length)) {
    const messaggio = buildMessaggioCambioColtura({
      da: esistente,
      a: nuovoPerFamiglia,
      impianti,
      aperti
    });
    effetti.messaggioConferma = messaggio;
    const ok = typeof conferma === 'function' ? await Promise.resolve(conferma(messaggio)) : false;
    if (!ok) {
      effetti.procedi = false;
      return effetti;
    }
    effetti.chiudi = impianti.map((i) => ({ id: i.id, tipo: i._tipo, nome: nomeImpianto(i, i._tipo) }));
    effetti.chiudiLavori = aperti.map((l) => payloadChiusuraLavoroCambioColtura(l, now));
  }

  if (cambia) {
    effetti.storico = aggiornaStoricoColture(esistente, nuovo, now);
  }

  if (superficieCambiata(esistente.superficie, nuovo.superficie)) {
    const attiviVigneti = (vigneti || []).filter((v) => v.statoImpianto !== 'chiuso');
    const attiviFrutteti = (frutteti || []).filter((f) => f.statoImpianto !== 'chiuso');
    const campagneAgg = (campagne || []).filter((c) => campagnaCorrenteOFutura(c, oggi));
    effetti.superfici = [
      ...attiviVigneti.map((v) => ({ id: v.id, collezione: 'vigneti', nome: nomeImpianto(v, 'vigneto'), tipo: 'vigneto' })),
      ...attiviFrutteti.map((f) => ({ id: f.id, collezione: 'frutteti', nome: nomeImpianto(f, 'frutteto'), tipo: 'frutteto' })),
      ...campagneAgg.map((c) => ({ id: c.id, collezione: 'seminativi', nome: c.campagna || 'campagna', tipo: 'campagna' }))
    ];
    if (effetti.superfici.length) {
      const primo = effetti.superfici[0];
      const etichetta = primo.tipo === 'campagna' ? `della campagna «${primo.nome}»` : `del ${primo.tipo} «${primo.nome}»`;
      effetti.messaggioSuperficie = `Aggiornata anche la superficie ${etichetta}`;
      if (effetti.superfici.length > 1) {
        effetti.messaggioSuperficie += ` e di altri ${effetti.superfici.length - 1} collegamenti`;
      }
      effetti.messaggioSuperficie += '.';
    }
  }

  if (cambia && (effetti.chiudi.length || effetti.chiudiLavori.length)) {
    effetti.messaggioToast = buildMessaggioToastCambioColtura({
      chiudiLavori: effetti.chiudiLavori,
      chiudi: effetti.chiudi
    });
  }

  return effetti;
}

export { isColturaFrutteto };
