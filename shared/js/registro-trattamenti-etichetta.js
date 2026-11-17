/**
 * Valori d'etichetta per «Leggi scheda».
 * GFV non consiglia dosi: mostra solo quanto è scritto in etichetta.
 * Un file per numero di registrazione, caricato on demand.
 * @module shared/js/registro-trattamenti-etichetta
 */

import { getBasePath } from '../../core/services/path-resolver.js';

export const MSG_ETICHETTA_MANCANTE = "Valori d'etichetta non ancora disponibili in GFV per questo prodotto: vedi etichetta";
export const MSG_ETICHETTA_NON_ESTRATTA = 'Su questa coltura il valore non è ancora estratto: vedi etichetta';
export const MSG_ETICHETTA_COLTURA_ASSENTE = 'In etichetta non trovo questa coltura';
export const MSG_ETICHETTA_SENZA_COLTURA = "Indica la coltura per leggere i valori in etichetta.";
export const TESTO_VALORI_ETICHETTA = "Valori letti dall'etichetta del prodotto. Controllali e premi Conferma: fa fede l'etichetta.";

const cacheSchede = new Map();
let cacheVocabolario = null;

export function normalizzaNomeColtura(value) {
  return String(value == null ? '' : value)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[*']/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function variantiPlurali(nome) {
  const out = [];
  if (nome.length > 3 && nome.endsWith('i')) {
    out.push(nome.slice(0, -1) + 'o', nome.slice(0, -1) + 'e');
  }
  if (nome.length > 4 && (nome.endsWith('che') || nome.endsWith('ghe'))) {
    out.push(nome.slice(0, -2) + 'a');
  } else if (nome.length > 4 && nome.endsWith('e')) {
    out.push(nome.slice(0, -1) + 'a');
  }
  return out;
}

/** Forme da confrontare con `colture` e con i sinonimi del vocabolario. */
export function candidatiColtura(value, vocabolario) {
  const voc = vocabolario || {};
  const sinonimi = voc.sinonimi || {};
  const padre = voc.padre || {};
  const visti = [];
  const aggiungi = (nome) => {
    const n = normalizzaNomeColtura(nome);
    if (!n || visti.includes(n)) return;
    visti.push(n);
  };
  const base = normalizzaNomeColtura(value);
  if (!base) return visti;
  const semi = [base, ...variantiPlurali(base)];
  semi.forEach((nome) => {
    aggiungi(nome);
    if (sinonimi[nome]) aggiungi(sinonimi[nome]);
  });
  visti.slice().forEach((nome) => {
    if (padre[nome]) aggiungi(padre[nome]);
    if (sinonimi[nome]) aggiungi(sinonimi[nome]);
  });
  return visti;
}

function coltureRiga(riga) {
  return (Array.isArray(riga && riga.colture) ? riga.colture : [])
    .map(normalizzaNomeColtura)
    .filter(Boolean);
}

export function rigaCopreColtura(riga, candidati) {
  if (!riga || !candidati || !candidati.length) return false;
  const colture = coltureRiga(riga);
  if (candidati.some((c) => colture.includes(c))) return true;
  const gruppo = normalizzaNomeColtura(riga.gruppo);
  return !!(gruppo && candidati.includes(gruppo));
}

function tieneAmbiente(riga, serra) {
  const ambiente = normalizzaNomeColtura(riga && riga.ambiente);
  if (!ambiente) return true;
  const eSerra = ambiente.includes('serra');
  if (serra) return eSerra;
  return !eSerra || ambiente.includes('pieno');
}

/** Righe la cui lista `colture` (o il gruppo nominato) contiene la coltura. */
export function righePerColtura(scheda, coltura, vocabolario) {
  const candidati = candidatiColtura(coltura, vocabolario);
  const tutte = (scheda && Array.isArray(scheda.righe) ? scheda.righe : [])
    .filter((riga) => rigaCopreColtura(riga, candidati));
  if (!tutte.length) return [];
  const serra = /serra/.test(normalizzaNomeColtura(coltura));
  const filtrate = tutte.filter((riga) => tieneAmbiente(riga, serra));
  return filtrate.length ? filtrate : tutte;
}

export function colturaNonEstratta(scheda, coltura, vocabolario) {
  const candidati = candidatiColtura(coltura, vocabolario);
  const lista = scheda && Array.isArray(scheda.colture_non_estratte) ? scheda.colture_non_estratte : [];
  return lista.some((nome) => candidati.includes(normalizzaNomeColtura(nome)));
}

function fmtNum(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return String(n).replace('.', ',');
}

function stessoNumero(a, b) {
  const x = Number(a);
  const y = Number(b);
  return Number.isFinite(x) && x === y;
}

export function etichettaPeriodo(periodo) {
  const originale = String(periodo || '').trim();
  const n = normalizzaNomeColtura(originale);
  if (!n) return '';
  if (n === 'anno') return "all'anno";
  if (n === 'ciclo') return 'a ciclo';
  if (n === 'stagione') return 'a stagione';
  return originale;
}

function testoAvversita(riga) {
  const t = String(riga && riga.avversita || '').trim();
  return t || 'Senza avversità indicata';
}

export function chiaveAvversita(riga) {
  return normalizzaNomeColtura(testoAvversita(riga)) || 'senza';
}

export function avversitaDelleRighe(righe) {
  const out = [];
  const visti = new Set();
  (righe || []).forEach((riga) => {
    const chiave = chiaveAvversita(riga);
    if (visti.has(chiave)) return;
    visti.add(chiave);
    out.push({ chiave, testo: testoAvversita(riga), idRiga: riga && riga.id ? String(riga.id) : '' });
  });
  return out;
}

function baseVoce(v, riga, campo) {
  return {
    campo,
    pagina: v && v.pagina != null && Number.isFinite(Number(v.pagina)) ? Number(v.pagina) : null,
    citazione: v && v.citazione ? String(v.citazione) : '',
    idRiga: riga && riga.id ? String(riga.id) : '',
    condizione: v && v.condizione ? String(v.condizione).trim() : '',
    epoca: riga && riga.epoca ? String(riga.epoca).trim() : '',
    periodo: v && v.periodo ? String(v.periodo).trim() : '',
    nonNecessario: false
  };
}

function voceDose(v, riga, campo) {
  if (!v || (v.min == null && v.max == null)) return null;
  const unita = v.unita ? String(v.unita).trim() : '';
  const intervallo = v.min != null && v.max != null && !stessoNumero(v.min, v.max);
  const n = v.min != null ? v.min : v.max;
  const valore = intervallo ? `da ${fmtNum(v.min)} a ${fmtNum(v.max)}` : fmtNum(n);
  if (!valore) return null;
  let testo = intervallo
    ? `da ${fmtNum(v.min)} a ${fmtNum(v.max)}${unita ? ' ' + unita : ''}`
    : `${fmtNum(n)}${unita ? ' ' + unita : ''}`;
  if (v.condizione) testo += ' — ' + String(v.condizione).trim();
  return {
    ...baseVoce(v, riga, campo),
    testo,
    valore,
    unita,
    scrivibile: !intervallo
  };
}

function voceCarenza(v, riga) {
  if (!v) return null;
  const non = v.non_necessario === true;
  const valore = non ? 'non necessaria' : fmtNum(v.giorni);
  if (!valore) return null;
  const base = non ? 'non necessaria' : `${valore} giorni`;
  const testo = v.condizione ? `${base} — ${String(v.condizione).trim()}` : base;
  return {
    ...baseVoce(v, riga, 'carenza'),
    testo,
    valore,
    unita: non ? '' : 'giorni',
    scrivibile: true,
    nonNecessario: non
  };
}

function voceMassimo(v, riga) {
  if (!v || v.numero == null) return null;
  const valore = fmtNum(v.numero);
  if (!valore) return null;
  const periodo = etichettaPeriodo(v.periodo);
  const pezzi = [periodo ? `${valore} ${periodo}` : valore];
  if (v.condizione) pezzi.push(String(v.condizione).trim());
  if (riga && riga.epoca) pezzi.push(String(riga.epoca).trim());
  return {
    ...baseVoce(v, riga, 'massimo'),
    testo: pezzi.filter(Boolean).join(' — '),
    valore,
    unita: '',
    scrivibile: true
  };
}

function voceIntervallo(v, riga) {
  if (!v || (v.min == null && v.max == null)) return null;
  const intervallo = v.min != null && v.max != null && !stessoNumero(v.min, v.max);
  const n = v.min != null ? v.min : v.max;
  const valore = intervallo ? `da ${fmtNum(v.min)} a ${fmtNum(v.max)}` : fmtNum(n);
  if (!valore) return null;
  const base = intervallo
    ? `da ${fmtNum(v.min)} a ${fmtNum(v.max)} giorni`
    : `${fmtNum(n)} giorni`;
  const pezzi = [base];
  if (v.condizione) pezzi.push(String(v.condizione).trim());
  if (riga && riga.epoca) pezzi.push(String(riga.epoca).trim());
  if (v.periodo) {
    const periodo = etichettaPeriodo(v.periodo);
    if (periodo) pezzi.push(periodo);
  }
  return {
    ...baseVoce(v, riga, 'intervallo'),
    testo: pezzi.filter(Boolean).join(' — '),
    valore,
    unita: 'giorni',
    scrivibile: !intervallo
  };
}

function dedupeVoci(voci) {
  const out = [];
  const visti = new Set();
  voci.forEach((voce) => {
    if (!voce) return;
    const chiave = [voce.valore, voce.unita, voce.condizione, voce.epoca, voce.periodo, voce.testo].join('|');
    if (visti.has(chiave)) return;
    visti.add(chiave);
    out.push(voce);
  });
  return out;
}

function campoDaVoci(voci, dettaglioSempre) {
  const lista = dedupeVoci(voci);
  const unica = lista.length === 1 && lista[0].scrivibile ? lista[0] : null;
  const unita = lista.length && lista.every((v) => v.unita === lista[0].unita) ? (lista[0].unita || '') : '';
  return {
    scrivi: unica ? unica.valore : '',
    unita,
    voci: lista,
    dettaglioSempre: !!dettaglioSempre,
    voceScritta: unica
  };
}

function campoVuoto(dettaglioSempre) {
  return { scrivi: '', unita: '', voci: [], dettaglioSempre: !!dettaglioSempre, voceScritta: null };
}

function campiDalleRighe(righe) {
  const doseHa = [];
  const doseHl = [];
  const carenza = [];
  const massimo = [];
  const intervallo = [];
  righe.forEach((riga) => {
    (riga.dose_ha || []).forEach((v) => doseHa.push(voceDose(v, riga, 'doseHa')));
    (riga.dose_hl || []).forEach((v) => doseHl.push(voceDose(v, riga, 'doseHl')));
    (riga.carenza || []).forEach((v) => carenza.push(voceCarenza(v, riga)));
    (riga.max_trattamenti || []).forEach((v) => massimo.push(voceMassimo(v, riga)));
    (riga.intervallo_giorni || []).forEach((v) => intervallo.push(voceIntervallo(v, riga)));
  });
  return {
    doseHa: campoDaVoci(doseHa, false),
    doseHl: campoDaVoci(doseHl, false),
    carenza: campoDaVoci(carenza, false),
    massimo: campoDaVoci(massimo, true),
    intervallo: campoDaVoci(intervallo, true)
  };
}

function campiVuoti() {
  return {
    doseHa: campoVuoto(false),
    doseHl: campoVuoto(false),
    carenza: campoVuoto(false),
    massimo: campoVuoto(true),
    intervallo: campoVuoto(true)
  };
}

function vistaBase(stato, messaggio, urlEtichetta) {
  return {
    stato,
    messaggio,
    urlEtichetta: urlEtichetta || null,
    avversita: [],
    avversitaScelta: null,
    campi: campiVuoti()
  };
}

/**
 * Vista per il form. Non sceglie un'avversità se ce n'è più di una,
 * e non scrive un numero se la dose è un intervallo o ha condizioni diverse.
 * `avversitaScelta` vuota forza la scelta; `altra` lascia il campo libero.
 */
export function preparaEtichetta({ scheda, coltura, vocabolario, avversitaScelta } = {}) {
  if (!scheda || !Array.isArray(scheda.righe)) {
    return vistaBase('mancante', MSG_ETICHETTA_MANCANTE, null);
  }
  const urlEtichetta = scheda.url_etichetta || null;
  const nomeColtura = String(coltura == null ? '' : coltura).trim();
  if (!nomeColtura) {
    return vistaBase('senza-coltura', MSG_ETICHETTA_SENZA_COLTURA, urlEtichetta);
  }
  const righe = righePerColtura(scheda, nomeColtura, vocabolario);
  if (!righe.length) {
    if (colturaNonEstratta(scheda, nomeColtura, vocabolario)) {
      return vistaBase('non-estratta', MSG_ETICHETTA_NON_ESTRATTA, urlEtichetta);
    }
    return vistaBase('coltura-assente', MSG_ETICHETTA_COLTURA_ASSENTE, urlEtichetta);
  }
  const avversita = avversitaDelleRighe(righe);
  let scelta = avversitaScelta == null ? null : String(avversitaScelta);
  if (scelta == null) {
    scelta = avversita.length === 1 ? avversita[0].chiave : '';
  }
  if (scelta && scelta !== 'altra' && !avversita.some((a) => a.chiave === scelta)) {
    scelta = avversita.length === 1 ? avversita[0].chiave : '';
  }
  const righeScelte = scelta && scelta !== 'altra'
    ? righe.filter((riga) => chiaveAvversita(riga) === scelta)
    : [];
  return {
    stato: 'pronto',
    messaggio: '',
    urlEtichetta,
    avversita,
    avversitaScelta: scelta || null,
    campi: righeScelte.length ? campiDalleRighe(righeScelte) : campiVuoti()
  };
}

export function numeroFileEtichetta(numero) {
  const t = String(numero == null ? '' : numero).replace(/\s+/g, '');
  if (!/^\d+$/.test(t)) return '';
  return t.length >= 6 ? t : t.padStart(6, '0');
}

function basePulita(base) {
  if (base == null || base === '/' || base === '') return '';
  return String(base).replace(/\/$/, '');
}

export function percorsoValoriEtichetta(numero, base) {
  const id = numeroFileEtichetta(numero);
  if (!id) return '';
  return basePulita(base) + '/shared/data/fitofarmaci-etichette/per-registrazione/' + id + '.json';
}

export function percorsoVocabolarioColture(base) {
  return basePulita(base) + '/shared/data/fitofarmaci-etichette/colture-vocabolario.json';
}

function baseDalBrowser() {
  if (typeof window === 'undefined') return '';
  return getBasePath();
}

export async function caricaSchedaEtichetta(numero, opzioni = {}) {
  const id = numeroFileEtichetta(numero);
  if (!id) return null;
  const usaCache = !opzioni.fetch;
  if (usaCache && cacheSchede.has(id)) return cacheSchede.get(id);
  const fetchFn = opzioni.fetch || globalThis.fetch;
  const base = opzioni.basePath != null ? opzioni.basePath : baseDalBrowser();
  const url = percorsoValoriEtichetta(numero, base);
  if (!url || typeof fetchFn !== 'function') return null;
  try {
    const res = await fetchFn(url);
    if (!res || !res.ok) {
      if (usaCache) cacheSchede.set(id, null);
      return null;
    }
    const json = await res.json();
    if (!json || !Array.isArray(json.righe)) {
      if (usaCache) cacheSchede.set(id, null);
      return null;
    }
    if (usaCache) cacheSchede.set(id, json);
    return json;
  } catch (e) {
    return null;
  }
}

export async function caricaVocabolarioColture(opzioni = {}) {
  const usaCache = !opzioni.fetch;
  if (usaCache && cacheVocabolario) return cacheVocabolario;
  const fetchFn = opzioni.fetch || globalThis.fetch;
  const base = opzioni.basePath != null ? opzioni.basePath : baseDalBrowser();
  const url = percorsoVocabolarioColture(base);
  if (typeof fetchFn !== 'function') return null;
  try {
    const res = await fetchFn(url);
    if (!res || !res.ok) return null;
    const json = await res.json();
    if (!json || typeof json !== 'object') return null;
    if (usaCache) cacheVocabolario = json;
    return json;
  } catch (e) {
    return null;
  }
}
