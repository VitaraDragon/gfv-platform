/**
 * Conformità di un trattamento all'etichetta. Nessun DOM e nessun Firestore:
 * dati in ingresso, colore e motivi in uscita. Non consiglia una dose.
 * @module shared/js/registro-trattamenti-conformita
 */

import { numeroFinito, dataRegistro, messaggioDoseFuoriRiga } from './registro-trattamenti.js';
import { classificaStatoAmministrativo } from './registro-trattamenti-fonte.js';
import {
  MSG_ETICHETTA_COLTURA_ASSENTE,
  MSG_ETICHETTA_DA_RICONTROLLARE,
  MSG_ETICHETTA_NON_ESTRATTA,
  MSG_ETICHETTA_SENZA_COLTURA,
  chiaveAvversita,
  dataItalianaVisibile,
  normalizzaNomeColtura,
  numeroFileEtichetta,
  preparaEtichetta,
  righePerColtura,
  caricaSchedaEtichetta,
  caricaVocabolarioColture,
  caricaIndiceEtichette
} from './registro-trattamenti-etichetta.js';

/** Copre una stagione di trattamenti e lascia il tempo di finire le scorte. */
export const GIORNI_AVVISO_SCADENZA = 90;

/** Tolleranza sugli arrotondamenti di dose (0,5%). */
export const TOLLERANZA_ARROTONDAMENTO = 0.005;

const CHIAVI_ORIGINE = ['doseHa', 'doseHl', 'carenza', 'massimo', 'intervallo', 'avversita'];

const PAROLE = {
  rosso: 'Errore',
  giallo: 'Attenzione',
  verde: "Conforme all'etichetta",
  grigio: 'Da completare'
};

const PAROLA_SENZA_SCHEDA = "Nessun dato d'etichetta";

const CLASSI = {
  rosso: 'red',
  giallo: 'yellow',
  verde: 'green',
  grigio: 'grey'
};

const RANK = { rosso: 4, giallo: 3, grigio: 2, verde: 1 };

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formattaNumeroIt(value) {
  const n = numeroFinito(value);
  if (n == null) return '';
  const r = Math.round(n * 1000) / 1000;
  return String(r).replace('.', ',');
}

export function dataGiorno(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object' && typeof value.toDate === 'function') return dataGiorno(value.toDate());
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const t = String(value).trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const d = dataRegistro(value);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function formattaDataIt(value) {
  const d = dataGiorno(value);
  if (!d) {
    const vis = dataItalianaVisibile(value);
    return vis || '';
  }
  const gg = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return gg + '/' + mm + '/' + d.getFullYear();
}

function giorniTra(da, a) {
  const x = dataGiorno(da);
  const y = dataGiorno(a);
  if (!x || !y) return null;
  const ms = Date.UTC(y.getFullYear(), y.getMonth(), y.getDate()) - Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
  return Math.round(ms / 86400000);
}

function aggiungiGiorni(data, giorni) {
  const d = dataGiorno(data);
  if (!d || !Number.isFinite(giorni)) return null;
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + giorni);
  return out;
}

function motivo(codice, colore, campo, testo) {
  return { codice, colore, campo, testo };
}

/** Stessa pulizia del nome di magazzino usata da «Leggi scheda». */
export function nomeProdottoPerRicercaScheda(nome) {
  let s = String(nome == null ? '' : nome).trim();
  s = s.replace(/^(inse\.?|insetticida|fung\.?|fungicida|erb\.?|erbicida|diserbante|conc\.?|concime)\s+/i, '');
  s = s.replace(/\bda\s+\d[\d.,]*\s*(lt|l|kg|g|ml|cl|q\.?li)?\.?\s*$/i, '');
  s = s.replace(/\b\d[\d.,]*\s*(lt|l|kg|g|ml|cl)\.?\s*$/i, '');
  return s.replace(/[.,;:]+$/g, '').replace(/\s+/g, ' ').trim();
}

export function normalizzaNomeProdottoScheda(nome) {
  return nomeProdottoPerRicercaScheda(nome).toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Cerca il nome nel indice delle etichette. Solo un risultato unico ed esatto.
 * @returns {{ numero: string, esito: 'unica'|'ambigua'|'assente' }}
 */
export function trovaRegistrazionePerNome(nome, indice) {
  const q = normalizzaNomeProdottoScheda(nome);
  if (!q) return { numero: '', esito: 'assente' };
  const prodotti = indice && Array.isArray(indice.prodotti) ? indice.prodotti : [];
  const hits = prodotti.filter((p) => normalizzaNomeProdottoScheda(p && p.nome_prodotto) === q);
  if (hits.length === 1) {
    return { numero: numeroFileEtichetta(hits[0].numero_registrazione), esito: 'unica' };
  }
  if (hits.length > 1) return { numero: '', esito: 'ambigua' };
  return { numero: '', esito: 'assente' };
}

/**
 * Prodotti dell'indice etichette per «Leggi scheda».
 * Il numero, se è solo cifre, vince. Altrimenti il nome esatto, poi il nome che contiene la ricerca.
 * Una ricerca più corta di 3 caratteri non apre l'elenco parziale.
 * @returns {Array<{ nome_prodotto: string, numero_registrazione: string }>}
 */
export function cercaProdottiEtichetta(query, indice) {
  const grezzo = String(query == null ? '' : query).trim();
  const q = normalizzaNomeProdottoScheda(grezzo);
  const prodotti = indice && Array.isArray(indice.prodotti) ? indice.prodotti : [];
  if (!q) return [];
  const cifre = grezzo.replace(/\s+/g, '');
  if (/^\d+$/.test(cifre)) {
    const id = numeroFileEtichetta(cifre);
    return prodotti.filter((p) => numeroFileEtichetta(p && p.numero_registrazione) === id);
  }
  const esatti = prodotti.filter((p) => normalizzaNomeProdottoScheda(p && p.nome_prodotto) === q);
  if (esatti.length) return esatti;
  if (q.length < 3) return [];
  return prodotti.filter((p) => normalizzaNomeProdottoScheda(p && p.nome_prodotto).includes(q));
}

function specUnita(unita) {
  const u = String(unita || '').trim().toLowerCase().replace(/\s+/g, '');
  const m = u.match(/^(kg|g|ml|l|lt|litri)(?:\/(ha|hl))?$/);
  if (!m) return null;
  const base = m[1];
  const per = m[2] || null;
  if (base === 'kg') return { fam: 'massa', fattore: 1000, per };
  if (base === 'g') return { fam: 'massa', fattore: 1, per };
  if (base === 'ml') return { fam: 'volume', fattore: 1, per };
  return { fam: 'volume', fattore: 1000, per };
}

function unitaBreve(spec) {
  if (!spec) return '';
  if (spec.fam === 'massa') return spec.fattore === 1000 ? 'kg' : 'g';
  return spec.fattore === 1000 ? 'l' : 'ml';
}

function testoIntervallo(voci) {
  return voci.map((voce) => {
    const unita = voce.unita ? ' ' + voce.unita : '';
    let intervallo;
    if (voce.min != null && voce.max != null) {
      intervallo = Number(voce.min) === Number(voce.max)
        ? formattaNumeroIt(voce.min) + unita
        : formattaNumeroIt(voce.min) + '–' + formattaNumeroIt(voce.max) + unita;
    } else if (voce.max != null) intervallo = 'fino a ' + formattaNumeroIt(voce.max) + unita;
    else intervallo = 'almeno ' + formattaNumeroIt(voce.min) + unita;
    if (voce.condizione) intervallo += ' (' + String(voce.condizione).trim() + ')';
    return intervallo;
  }).join('; ');
}

function dentro(valore, min, max) {
  const tol = TOLLERANZA_ARROTONDAMENTO;
  const basso = min == null ? -Infinity : min - Math.abs(min) * tol;
  const alto = max == null ? Infinity : max + Math.abs(max) * tol;
  return valore >= basso && valore <= alto;
}

function voceUtile(v) {
  if (!v || typeof v !== 'object') return null;
  const min = numeroFinito(v.min);
  const max = numeroFinito(v.max);
  if (min == null && max == null && v.non_necessario !== true && v.giorni == null && v.numero == null) return null;
  return v;
}

function idRigaOrigine(origine) {
  if (!origine || typeof origine !== 'object') return '';
  for (let i = 0; i < CHIAVI_ORIGINE.length; i += 1) {
    const voce = origine[CHIAVI_ORIGINE[i]];
    if (voce && voce.idRiga != null && String(voce.idRiga).trim()) return String(voce.idRiga).trim();
  }
  return '';
}

function colturaDi(input) {
  const riga = input.riga || {};
  const trattamento = input.trattamento || {};
  const rif = riga.riferimentoRiga || {};
  return String(rif.colturaScheda || riga.specieUsata || trattamento.specieUsata || '').trim();
}

function avversitaDi(riga) {
  return String((riga && riga.avversita) || '').trim();
}

function eAvversitaAltra(testo) {
  const n = normalizzaNomeColtura(testo);
  return n === 'altra' || n.startsWith('altra ');
}

function firmaRiga(riga) {
  const liste = ['dose_ha', 'dose_hl', 'carenza', 'max_trattamenti', 'intervallo_giorni'];
  const out = {};
  liste.forEach((nome) => {
    out[nome] = (riga[nome] || []).map((v) => ({
      min: v.min == null ? null : v.min,
      max: v.max == null ? null : v.max,
      unita: v.unita || '',
      giorni: v.giorni == null ? null : v.giorni,
      non_necessario: v.non_necessario === true,
      numero: v.numero == null ? null : v.numero,
      periodo: v.periodo || '',
      condizione: v.condizione || ''
    }));
  });
  return JSON.stringify(out);
}

function stessoCampo(a, b) {
  const ta = a && a.terrenoId != null ? String(a.terrenoId) : '';
  const tb = b && b.terrenoId != null ? String(b.terrenoId) : '';
  if (!ta || !tb) return !ta && !tb;
  return ta === tb;
}

function coloreDi(motivi, doseOk) {
  let best = doseOk ? 'verde' : 'grigio';
  (motivi || []).forEach((m) => {
    if (m && m.colore && RANK[m.colore] > RANK[best]) best = m.colore;
  });
  return best;
}

/**
 * Trova la riga d'etichetta. Non ne sceglie una a caso se i valori divergono.
 * @returns {{ riga: object|null, blocco: object|null }}
 */
export function trovaRigaEtichetta(input = {}) {
  if (input.rigaEtichetta) return { riga: input.rigaEtichetta, blocco: null };
  const scheda = input.scheda;
  if (!scheda || !Array.isArray(scheda.righe)) {
    return {
      riga: null,
      blocco: motivo('scheda_mancante', 'grigio', null, PAROLA_SENZA_SCHEDA)
    };
  }
  const id = idRigaOrigine(input.riga && input.riga.origineValori);
  if (id) {
    const trovata = scheda.righe.find((riga) => riga && String(riga.id) === id);
    if (trovata) return { riga: trovata, blocco: null };
  }
  const coltura = colturaDi(input);
  const vista = preparaEtichetta({
    scheda,
    coltura,
    vocabolario: input.vocabolario,
    avversitaScelta: '',
    dataRevisione: input.dataRevisione
  });
  if (vista.stato === 'da-ricontrollare') {
    return { riga: null, blocco: motivo('da_ricontrollare', 'grigio', null, MSG_ETICHETTA_DA_RICONTROLLARE) };
  }
  if (vista.stato === 'senza-coltura') {
    return { riga: null, blocco: motivo('senza_coltura', 'grigio', null, MSG_ETICHETTA_SENZA_COLTURA) };
  }
  if (vista.stato === 'non-estratta') {
    return { riga: null, blocco: motivo('coltura_non_estratta', 'grigio', null, MSG_ETICHETTA_NON_ESTRATTA) };
  }
  if (vista.stato === 'coltura-assente') {
    return { riga: null, blocco: motivo('coltura_assente', 'rosso', null, MSG_ETICHETTA_COLTURA_ASSENTE) };
  }
  const righe = righePerColtura(scheda, coltura, input.vocabolario);
  const avversita = avversitaDi(input.riga);
  if (!avversita) {
    if (righe.length === 1 || (vista.avversita || []).length <= 1) {
      const unica = righe.length === 1 ? righe : righe.filter((riga) => chiaveAvversita(riga) === (vista.avversita[0] && vista.avversita[0].chiave));
      if (unica.length === 1) return { riga: unica[0], blocco: null };
      if (unica.length > 1 && new Set(unica.map(firmaRiga)).size === 1) return { riga: unica[0], blocco: null };
    }
    return {
      riga: null,
      candidate: righe,
      blocco: motivo('riga_ambigua', 'grigio', null, "Più righe d'etichetta possibili: scegli l'avversità")
    };
  }
  if (eAvversitaAltra(avversita) || !(vista.avversita || []).some((a) => a.chiave === chiaveAvversita({ avversita }))) {
    return {
      riga: null,
      blocco: motivo('avversita_altra', 'rosso', 'avversita', "Avversità non presente in etichetta per questa coltura")
    };
  }
  const filtrate = righe.filter((riga) => chiaveAvversita(riga) === chiaveAvversita({ avversita }));
  if (!filtrate.length) {
    return {
      riga: null,
      blocco: motivo('avversita_altra', 'rosso', 'avversita', "Avversità non presente in etichetta per questa coltura")
    };
  }
  if (filtrate.length > 1 && new Set(filtrate.map(firmaRiga)).size > 1) {
    return {
      riga: null,
      candidate: filtrate,
      blocco: motivo('riga_ambigua', 'grigio', null, "Più righe d'etichetta possibili: scegli l'avversità")
    };
  }
  return { riga: filtrate[0], blocco: null };
}

function firmaDose(riga) {
  return JSON.stringify(['dose_ha', 'dose_hl'].map((nome) => (riga[nome] || []).map((v) => ({
    min: v && v.min != null ? v.min : null,
    max: v && v.max != null ? v.max : null,
    unita: (v && v.unita) || '',
    condizione: (v && v.condizione) || ''
  }))));
}

function raggruppaDose(righe) {
  const map = new Map();
  (righe || []).forEach((riga) => {
    const chiave = firmaDose(riga);
    if (!map.has(chiave)) map.set(chiave, []);
    map.get(chiave).push(riga);
  });
  return [...map.values()];
}

function unitaComuneDelleRighe(righe) {
  const unita = [];
  (righe || []).forEach((riga) => {
    (riga.dose_ha || []).forEach((v) => {
      if (!v || (v.min == null && v.max == null)) return;
      const u = String(v.unita || '').trim().toLowerCase();
      if (u) unita.push(u);
    });
  });
  if (!unita.length) return null;
  const prima = specUnita(unita[0]);
  if (!prima) return { ambigua: true };
  const stessa = unita.every((u) => {
    const spec = specUnita(u);
    return spec && spec.fam === prima.fam && spec.fattore === prima.fattore && (spec.per || 'ha') === (prima.per || 'ha');
  });
  if (!stessa) return { ambigua: true };
  return { ambigua: false, breve: unitaBreve(prima), testo: unita[0] };
}

/** Se la riga non ha unità, usa quella unica dell'etichetta. Mai tra massa e volume. */
function rigaConUnita(riga, righeEtichetta, motivi) {
  const base = riga && typeof riga === 'object' ? riga : {};
  if (specUnita(base.unitaDosaggio)) return base;
  if (numeroFinito(base.dosaggio) == null) return base;
  const comune = unitaComuneDelleRighe(righeEtichetta);
  if (!comune) return base;
  if (comune.ambigua) {
    if (!motivi.some((m) => m.codice === 'unita_mancante')) {
      motivi.push(motivo('unita_mancante', 'grigio', 'doseHa', 'Unità mancante: scegli kg o L'));
    }
    return base;
  }
  if (!motivi.some((m) => m.codice === 'unita_da_etichetta')) {
    motivi.push(motivo('unita_da_etichetta', null, 'doseHa', "Unità presa dall'etichetta: " + comune.testo));
  }
  return Object.assign({}, base, { unitaDosaggio: comune.breve });
}

function prefissoAvversita(gruppo) {
  const nomi = [...new Set((gruppo || []).map((r) => String(r.avversita || '').trim()).filter(Boolean))];
  return nomi.length ? nomi.join(', ') + ': ' : '';
}

function controllaDoseHa(riga, rigaEtichetta, motivi) {
  const voci = (rigaEtichetta.dose_ha || []).map(voceUtile).filter((v) => v && (v.min != null || v.max != null));
  const dose = numeroFinito(riga && riga.dosaggio);
  const specDose = specUnita(riga && riga.unitaDosaggio);
  if (!voci.length) {
    motivi.push(motivo('dose_non_indicata', 'grigio', 'doseHa', 'Dose per ettaro non presente in etichetta, non verificabile'));
    return false;
  }
  if (dose == null) {
    motivi.push(motivo('dose_non_indicata', 'grigio', 'doseHa', 'Dose per ettaro non indicata, non verificabile'));
    return false;
  }
  if (!specDose) {
    if (!motivi.some((m) => m.codice === 'unita_mancante')) {
      motivi.push(motivo('unita_mancante', 'grigio', 'doseHa', 'Unità mancante: scegli kg o L'));
    }
    return false;
  }
  if (specDose.per && specDose.per !== 'ha') {
    motivi.push(motivo('unita_diverse', 'grigio', 'doseHa', "Unità diverse da quelle dell'etichetta"));
    return false;
  }
  const doseBase = dose * specDose.fattore;
  const confrontabili = [];
  voci.forEach((voce) => {
    const spec = specUnita(voce.unita || 'kg/ha');
    if (!spec || spec.per === 'hl' || spec.fam !== specDose.fam) return;
    confrontabili.push({ voce, spec, baseMin: voce.min == null ? null : Number(voce.min) * spec.fattore, baseMax: voce.max == null ? null : Number(voce.max) * spec.fattore });
  });
  if (!confrontabili.length) {
    motivi.push(motivo('unita_diverse', 'grigio', 'doseHa', "Unità diverse da quelle dell'etichetta"));
    return false;
  }
  const interne = confrontabili.filter((c) => dentro(doseBase, c.baseMin, c.baseMax));
  if (!interne.length) {
    const spec = confrontabili[0].spec;
    const doseVis = doseBase / spec.fattore;
    const unita = confrontabili[0].voce.unita || (unitaBreve(spec) + '/ha');
    motivi.push(motivo(
      'dose_fuori',
      'rosso',
      'doseHa',
      'Dose ' + formattaNumeroIt(doseVis) + ' ' + unita + " fuori dall'intervallo d'etichetta (" + testoIntervallo(confrontabili.map((c) => c.voce)) + ')'
    ));
    return false;
  }
  const senzaCondizione = interne.some((c) => !String(c.voce.condizione || '').trim());
  if (!senzaCondizione) {
    const condizioni = [...new Set(interne.map((c) => String(c.voce.condizione).trim()).filter(Boolean))];
    motivi.push(motivo(
      'dose_con_condizione',
      'giallo',
      'doseHa',
      'Dose ' + formattaNumeroIt(dose) + ' ' + (riga.unitaDosaggio || '') + '/ha è nell\'intervallo d\'etichetta solo con la condizione «' + condizioni.join('», «') + '»'
    ));
  }
  return true;
}

function controllaDoseHl(trattamento, riga, rigaEtichetta, motivi) {
  const voci = (rigaEtichetta.dose_hl || []).map(voceUtile).filter((v) => v && (v.min != null || v.max != null));
  if (!voci.length) return;
  const hl = numeroFinito(trattamento && trattamento.acquaEttolitriPerEttaro);
  const dose = numeroFinito(riga && riga.dosaggio);
  const specDose = specUnita(riga && riga.unitaDosaggio);
  if (dose == null) {
    motivi.push(motivo('dose_hl_non_verificabile', null, 'doseHl', 'Dose per ettolitro: dose non indicata, non verificabile'));
    return;
  }
  if (!specDose) {
    if (!motivi.some((m) => m.codice === 'unita_mancante')) {
      motivi.push(motivo('unita_mancante', 'grigio', 'doseHl', 'Unità mancante: scegli kg o L'));
    }
    return;
  }
  if (hl == null || hl <= 0) {
    motivi.push(motivo('dose_hl_non_verificabile', null, 'doseHl', 'Dose per ettolitro: acqua (hl/ha) non indicata, non verificabile'));
    return;
  }
  const perHl = (dose * specDose.fattore) / hl;
  const confrontabili = [];
  voci.forEach((voce) => {
    const spec = specUnita(voce.unita || 'g/hl');
    if (!spec || spec.fam !== specDose.fam) return;
    confrontabili.push({
      voce,
      spec,
      baseMin: voce.min == null ? null : Number(voce.min) * spec.fattore,
      baseMax: voce.max == null ? null : Number(voce.max) * spec.fattore
    });
  });
  if (!confrontabili.length) {
    motivi.push(motivo('unita_diverse', 'grigio', 'doseHl', "Unità diverse da quelle dell'etichetta"));
    return;
  }
  const interne = confrontabili.filter((c) => dentro(perHl, c.baseMin, c.baseMax));
  if (!interne.length) {
    const spec = confrontabili[0].spec;
    const vis = perHl / spec.fattore;
    const unita = confrontabili[0].voce.unita || (unitaBreve(spec) + '/hl');
    motivi.push(motivo(
      'dose_hl_fuori',
      'rosso',
      'doseHl',
      'Dose ' + formattaNumeroIt(vis) + ' ' + unita + " fuori dall'intervallo d'etichetta (" + testoIntervallo(confrontabili.map((c) => c.voce)) + ')'
    ));
    return;
  }
  const senzaCondizione = interne.some((c) => !String(c.voce.condizione || '').trim());
  if (!senzaCondizione) {
    const condizioni = [...new Set(interne.map((c) => String(c.voce.condizione).trim()).filter(Boolean))];
    motivi.push(motivo(
      'dose_hl_con_condizione',
      'giallo',
      'doseHl',
      'Dose per ettolitro nell\'intervallo d\'etichetta solo con la condizione «' + condizioni.join('», «') + '»'
    ));
  }
}

function controllaCarenza(trattamento, rigaEtichetta, dataRaccolta, motivi) {
  const voci = (rigaEtichetta.carenza || []).filter((v) => v && (v.non_necessario === true || numeroFinito(v.giorni) != null));
  if (!voci.length) return;
  if (voci.some((v) => v.non_necessario === true && !String(v.condizione || '').trim())) return;
  const conGiorni = voci.filter((v) => v.non_necessario !== true && numeroFinito(v.giorni) != null);
  if (!conGiorni.length) {
    const cond = voci.map((v) => String(v.condizione || '').trim()).filter(Boolean);
    if (cond.length) {
      motivi.push(motivo('carenza_condizione', null, 'carenza', 'Carenza non necessaria solo con la condizione «' + cond.join('», «') + '»'));
    }
    return;
  }
  const dataT = dataGiorno(trattamento && trattamento.data);
  const raccolta = dataGiorno(dataRaccolta);
  if (!raccolta || !dataT) {
    const giorni = Math.max(...conGiorni.map((v) => Number(v.giorni)));
    const dal = dataT ? formattaDataIt(aggiungiGiorni(dataT, giorni)) : '';
    motivi.push(motivo(
      'carenza_non_verificabile',
      null,
      'carenza',
      'Carenza: data di raccolta non registrata, non verificabile' + (dal ? '. Si potrà raccogliere dal ' + dal : '')
    ));
    return;
  }
  const giorni = giorniTra(dataT, raccolta);
  const rispettate = conGiorni.filter((v) => giorni >= Number(v.giorni));
  if (rispettate.length) {
    if (!rispettate.some((v) => !String(v.condizione || '').trim())) {
      const cond = [...new Set(rispettate.map((v) => String(v.condizione).trim()).filter(Boolean))];
      if (cond.length) {
        motivi.push(motivo('carenza_condizione', 'giallo', 'carenza', 'Carenza rispettata solo con la condizione «' + cond.join('», «') + '»'));
      }
    }
    return;
  }
  const richiesti = Math.max(...conGiorni.map((v) => Number(v.giorni)));
  motivi.push(motivo(
    'carenza_non_rispettata',
    'rosso',
    'carenza',
    'Carenza non rispettata: raccolta il ' + formattaDataIt(raccolta) + ', ' + giorni + ' giorni dopo il trattamento; in etichetta ' + formattaNumeroIt(richiesti) + ' giorni'
  ));
}

function notaPeriodo(periodo) {
  const n = normalizzaNomeColtura(periodo);
  if (!n) return 'periodo non indicato; conteggio sull\'anno solare';
  if (n === 'anno' || n === 'ogni 2 anni') return '';
  return 'conteggio sull\'anno solare';
}

function finestraPeriodo(periodo, data) {
  const n = normalizzaNomeColtura(periodo);
  if (n === 'ogni 2 anni') return { tipo: 'giorni', giorni: 730 };
  return { tipo: 'anno', anno: data ? data.getFullYear() : null };
}

function numeroConteggio(voce) {
  if (!voce) return '';
  const rif = voce.riferimentoRiga && typeof voce.riferimentoRiga === 'object' ? voce.riferimentoRiga : null;
  return numeroFileEtichetta(
    voce.numeroRegistrazioneLetto || voce.numeroRegistrazione || (rif && rif.numeroRegistrazione) || ''
  );
}

/** Annullato o eliminato esce. Errore, da completare e pianificato restano nel conto. */
function passaggioFuoriConteggio(passaggio) {
  if (!passaggio) return true;
  if (passaggio.eliminato === true) return true;
  const stato = String(passaggio.stato || passaggio.statoLavoro || '').toLowerCase();
  return stato === 'annullato' || stato === 'eliminato';
}

/**
 * Stesso fitofarmaco anche se la riga Errore ha un id di magazzino diverso
 * o il nome breve («Folpan») al posto del nome in etichetta.
 */
function stessoProdottoConteggio(a, b) {
  const na = numeroConteggio(a);
  const nb = numeroConteggio(b);
  if (na && nb && na === nb) return true;
  if (a && b && a.prodottoId && b.prodottoId && String(a.prodottoId) === String(b.prodottoId)) return true;
  const nomeA = normalizzaNomeProdottoScheda((a && (a.nome || a.prodotto)) || '');
  const nomeB = normalizzaNomeProdottoScheda((b && (b.nome || b.prodotto)) || '');
  if (nomeA && nomeA === nomeB) return true;
  if (na && nb && na !== nb) return false;
  if (!nomeA || !nomeB) return false;
  const corto = nomeA.length <= nomeB.length ? nomeA : nomeB;
  const lungo = nomeA.length <= nomeB.length ? nomeB : nomeA;
  return corto.length >= 5 && lungo.includes(corto);
}

function passaggiStessoProdotto(input, dataLimite) {
  const riga = input.riga || {};
  const trattamento = input.trattamento || {};
  const corrente = {
    prodottoId: riga.prodottoId || null,
    nome: riga.prodotto || riga.nome || '',
    numeroRegistrazioneLetto: numeroConteggio(riga),
    terrenoId: trattamento.terrenoId || riga.terrenoId || null
  };
  const idCorrente = trattamento.id || riga.id || null;
  return (Array.isArray(input.precedenti) ? input.precedenti : []).filter((p) => {
    if (passaggioFuoriConteggio(p)) return false;
    if (idCorrente && p.id && String(p.id) === String(idCorrente)) return false;
    const d = dataGiorno(p.data);
    if (!d || (dataLimite && d.getTime() > dataLimite.getTime())) return false;
    if (!stessoCampo(corrente, p) && (corrente.terrenoId || p.terrenoId)) return false;
    return stessoProdottoConteggio(corrente, p);
  });
}

function firmaMassimo(riga) {
  return JSON.stringify((riga && riga.max_trattamenti || []).map((v) => ({
    numero: v && v.numero != null ? v.numero : null,
    periodo: (v && v.periodo) || '',
    condizione: (v && v.condizione) || ''
  })));
}

/** Vero se ogni riga candidata ha lo stesso max_trattamenti, e quel massimo c'è. */
function stessoMassimo(righe) {
  if (!righe || !righe.length) return false;
  const firme = righe.map(firmaMassimo);
  if (new Set(firme).size !== 1) return false;
  return (righe[0].max_trattamenti || []).some((v) => v && numeroFinito(v.numero) != null);
}

/**
 * Quanti passaggi dello stesso prodotto contano già, e quanti ne restano dopo questo.
 * `restanti` non scende sotto 0. Lista vuota se in etichetta il massimo non c'è.
 * @returns {Array<{ ordinale: number, massimo: number, restanti: number, periodo: string, nota: string, condizione: string, oltre: boolean }>}
 */
export function conteggioTrattamentiEtichetta(input = {}, rigaEtichetta = {}) {
  const voci = (rigaEtichetta.max_trattamenti || []).filter((v) => v && numeroFinito(v.numero) != null);
  if (!voci.length) return [];
  const data = dataGiorno(input.trattamento && input.trattamento.data) || dataGiorno(input.oggi) || dataGiorno(new Date());
  return voci.map((voce) => {
    const finestra = finestraPeriodo(voce.periodo, data);
    const passaggi = passaggiStessoProdotto(input, data).filter((p) => {
      const d = dataGiorno(p.data);
      if (!d) return false;
      if (finestra.tipo === 'anno') return d.getFullYear() === finestra.anno;
      const delta = giorniTra(d, data);
      return delta != null && delta >= 0 && delta <= finestra.giorni;
    });
    const ordinale = passaggi.length + 1;
    const massimo = Number(voce.numero);
    return {
      ordinale,
      massimo,
      restanti: Math.max(0, massimo - ordinale),
      periodo: voce.periodo || '',
      nota: notaPeriodo(voce.periodo),
      condizione: String(voce.condizione || '').trim(),
      oltre: ordinale > massimo
    };
  });
}

function testoRestanti(nome, voce) {
  const periodo = etichettaPeriodoMassimo(voce.periodo);
  const chi = nome ? nome + ': ' : '';
  return chi + 'sarebbe il ' + voce.ordinale + '° trattamento nell\'anno su questo terreno; in etichetta al massimo '
    + formattaNumeroIt(voce.massimo) + (periodo ? ' ' + periodo : '') + ', ne restano ' + voce.restanti + ' dopo questo';
}

function controllaMassimo(input, rigaEtichetta, motivi) {
  const valutate = conteggioTrattamentiEtichetta(input, rigaEtichetta);
  if (!valutate.length) return;
  const oltreTutte = valutate.every((v) => v.oltre);
  if (oltreTutte) {
    const prima = valutate[0];
    const periodoTesto = prima.nota ? '' : etichettaPeriodoMassimo(prima.periodo);
    const pezzi = [
      prima.ordinale + '° trattamento nell\'anno: in etichetta al massimo ' + formattaNumeroIt(prima.massimo) + (periodoTesto ? ' ' + periodoTesto : '')
    ];
    if (prima.nota) pezzi.push(prima.nota);
    if (prima.condizione) pezzi.push('condizione: ' + prima.condizione);
    motivi.push(motivo('troppi_trattamenti', 'rosso', 'massimo', pezzi.join('; ')));
    return;
  }
  const note = [...new Set(valutate.map((v) => v.nota).filter(Boolean))];
  if (note.length) {
    motivi.push(motivo('periodo_conteggio', null, 'massimo', note.join('; ')));
  }
  if (input.mostraRestanti === true) {
    const nome = String((input.riga && (input.riga.prodotto || input.riga.nome)) || '').trim();
    valutate.forEach((voce) => {
      if (voce.oltre) return;
      motivi.push(motivo('trattamenti_restanti', null, 'massimo', testoRestanti(nome, voce)));
    });
  }
}

function etichettaPeriodoMassimo(periodo) {
  const n = normalizzaNomeColtura(periodo);
  if (!n || n === 'anno') return "all'anno";
  if (n === 'ogni 2 anni') return 'ogni 2 anni';
  if (n === 'stagione') return 'a stagione';
  if (n === 'ciclo') return 'a ciclo';
  return String(periodo).trim();
}

function controllaIntervallo(input, rigaEtichetta, motivi) {
  const voci = (rigaEtichetta.intervallo_giorni || []).filter((v) => v && numeroFinito(v.min) != null);
  if (!voci.length) return;
  const data = dataGiorno(input.trattamento && input.trattamento.data);
  if (!data) return;
  const precedenti = passaggiStessoProdotto(input, data)
    .map((p) => dataGiorno(p.data))
    .filter((d) => d && d.getTime() <= data.getTime())
    .sort((a, b) => b.getTime() - a.getTime());
  if (!precedenti.length) return;
  const ultimo = precedenti[0];
  const giorni = giorniTra(ultimo, data);
  const sottoTutte = voci.every((v) => giorni < Number(v.min));
  if (!sottoTutte) return;
  const minimo = Math.min(...voci.map((v) => Number(v.min)));
  motivi.push(motivo(
    'intervallo_corto',
    'rosso',
    'intervallo',
    'Passaggio a ' + giorni + ' giorni dal precedente: in etichetta almeno ' + formattaNumeroIt(minimo)
  ));
}

function dataRevoca(stato) {
  return dataGiorno(stato.dataDecorrenzaRevoca) || dataGiorno(stato.dataDecretoRevoca);
}

function controllaStato(input, motivi) {
  const stato = input.statoProdotto;
  if (!stato || typeof stato !== 'object') return;
  const cls = classificaStatoAmministrativo(stato.stato);
  const dataT = dataGiorno(input.trattamento && input.trattamento.data) || dataGiorno(input.oggi);
  const oggi = dataGiorno(input.oggi) || dataGiorno(new Date());
  const scadenza = dataGiorno(stato.dataScadenzaAutorizzazione);
  const revoca = dataRevoca(stato);
  const smaltimento = dataGiorno(stato.smaltimentoScorteFino);

  if (cls === 'non_verificato') {
    motivi.push(motivo('stato_non_verificato', 'grigio', null, 'Stato del prodotto non verificato'));
  }

  if ((cls === 'revocato' || cls === 'sospeso') && dataT) {
    const parola = cls === 'sospeso' ? 'sospeso' : 'revocato';
    const dal = revoca ? formattaDataIt(revoca) : '';
    const quandoTrattamento = formattaDataIt(dataT);
    if (!revoca || giorniTra(revoca, dataT) >= 0) {
      const inSmaltimento = smaltimento && revoca && giorniTra(revoca, dataT) >= 0 && giorniTra(dataT, smaltimento) >= 0;
      if (inSmaltimento) {
        motivi.push(motivo(
          'smaltimento',
          'giallo',
          null,
          'Prodotto ' + parola + (dal ? ' dal ' + dal : '') + ': smaltimento scorte fino al ' + formattaDataIt(smaltimento)
        ));
      } else {
        motivi.push(motivo(
          'prodotto_' + parola,
          'rosso',
          null,
          'Prodotto ' + parola + (dal ? ' dal ' + dal : '') + ': il trattamento è del ' + quandoTrattamento
        ));
      }
    } else {
      motivi.push(motivo(
        'revoca_successiva',
        null,
        null,
        'Prodotto ' + parola + ' dal ' + dal + ': il trattamento è precedente a quella data'
      ));
    }
  }

  if (scadenza && dataT && giorniTra(scadenza, dataT) > 0 && (cls === 'autorizzato' || cls === 'scaduto')) {
    motivi.push(motivo(
      'autorizzazione_scaduta',
      'rosso',
      null,
      'Autorizzazione scaduta il ' + formattaDataIt(scadenza) + ': il trattamento è del ' + formattaDataIt(dataT)
    ));
  } else if (cls === 'scaduto' && dataT && scadenza && giorniTra(dataT, scadenza) >= 0) {
    motivi.push(motivo(
      'scadenza_successiva',
      null,
      null,
      'Prodotto scaduto il ' + formattaDataIt(scadenza) + ': il trattamento è precedente a quella data'
    ));
  } else if (cls === 'scaduto' && !scadenza) {
    motivi.push(motivo('prodotto_scaduto', 'rosso', null, 'Prodotto scaduto: il trattamento è del ' + formattaDataIt(dataT)));
  }

  if (cls === 'autorizzato' && scadenza && oggi && giorniTra(oggi, scadenza) >= 0 && giorniTra(oggi, scadenza) <= GIORNI_AVVISO_SCADENZA) {
    const giaRosso = motivi.some((m) => m.codice === 'autorizzazione_scaduta');
    if (!giaRosso) {
      motivi.push(motivo(
        'scadenza_vicina',
        'giallo',
        null,
        'Autorizzazione in scadenza il ' + formattaDataIt(scadenza)
      ));
    }
  }

  // TODO: deroga (art. 53, uso eccezionale) e smaltimento scorte non sono nel CSV PROD_FTS
  // né nei JSON d'etichetta. Potranno arrivare da un campo esplicito degli open data del Ministero
  // o da un dato confermato in anagrafica. Non dedurli dallo stato amministrativo.
  const deroga = stato.deroga;
  if (deroga && typeof deroga === 'object' && (deroga.fino || deroga.testo)) {
    const pezzi = ['Uso in deroga'];
    if (deroga.testo) pezzi.push(String(deroga.testo).trim());
    if (deroga.fino) pezzi.push('fino al ' + formattaDataIt(deroga.fino));
    motivi.push(motivo('deroga', 'giallo', null, pezzi.join(' ')));
  }
}

export function valutaConformitaEtichetta(input = {}) {
  if (input.riconoscimento === 'non_riconosciuto') {
    return {
      colore: 'grigio',
      motivi: [motivo('prodotto_non_riconosciuto', 'grigio', null, 'Prodotto non riconosciuto: premi Leggi scheda')]
    };
  }
  if (input.riconoscimento === 'vuoto') {
    return { colore: 'grigio', motivi: [] };
  }
  const motivi = [];
  const trovato = trovaRigaEtichetta(input);
  if (trovato.blocco && trovato.blocco.codice === 'scheda_mancante') {
    trovato.blocco.testo = PAROLA_SENZA_SCHEDA;
  }
  let doseOk = false;
  if (trovato.blocco) motivi.push(trovato.blocco);
  if (trovato.riga) {
    const rigaDose = rigaConUnita(input.riga || {}, [trovato.riga], motivi);
    const bloccoUnita = motivi.some((m) => m.codice === 'unita_mancante');
    if (!bloccoUnita) doseOk = controllaDoseHa(rigaDose, trovato.riga, motivi);
    controllaDoseHl(input.trattamento || {}, rigaDose, trovato.riga, motivi);
    if (!(input.controlli && input.controlli.carenza === false)) {
      controllaCarenza(input.trattamento || {}, trovato.riga, input.dataRaccolta, motivi);
    }
    controllaMassimo(input, trovato.riga, motivi);
    controllaIntervallo(input, trovato.riga, motivi);
  } else if (trovato.candidate && trovato.candidate.length) {
    const rigaDose = rigaConUnita(input.riga || {}, trovato.candidate, motivi);
    const bloccoUnita = motivi.some((m) => m.codice === 'unita_mancante');
    if (!bloccoUnita) {
      const gruppi = raggruppaDose(trovato.candidate);
      let tuttiOk = gruppi.length > 0;
      gruppi.forEach((gruppo) => {
        const locali = [];
        const ok = controllaDoseHa(rigaDose, gruppo[0], locali);
        controllaDoseHl(input.trattamento || {}, rigaDose, gruppo[0], locali);
        if (!ok || locali.some((m) => m.colore === 'rosso' || m.colore === 'giallo' || m.colore === 'grigio')) tuttiOk = false;
        const prefisso = prefissoAvversita(gruppo);
        locali.forEach((m) => {
          if (prefisso && m.testo) m.testo = prefisso + m.testo;
          motivi.push(m);
        });
      });
      doseOk = tuttiOk;
    }
    if (input.mostraRestanti === true && stessoMassimo(trovato.candidate)) {
      controllaMassimo(input, trovato.candidate[0], motivi);
    }
  }
  controllaStato(input, motivi);
  return {
    colore: coloreDi(motivi, doseOk && !trovato.blocco),
    motivi
  };
}

export function valutaConformitaTrattamento(input = {}) {
  const trattamento = input.trattamento || {};
  const righe = Array.isArray(input.righe) ? input.righe : (Array.isArray(trattamento.prodotti) ? trattamento.prodotti : []);
  if (!righe.length) {
    return {
      colore: 'grigio',
      motivi: [motivo('scheda_mancante', 'grigio', null, PAROLA_SENZA_SCHEDA)]
    };
  }
  const esiti = righe.map((riga) => {
    const scheda = typeof input.schedaPerRiga === 'function'
      ? input.schedaPerRiga(riga)
      : input.scheda;
    const stato = typeof input.statoPerRiga === 'function'
      ? input.statoPerRiga(riga)
      : input.statoProdotto;
    const riconoscimento = typeof input.riconoscimentoPerRiga === 'function'
      ? input.riconoscimentoPerRiga(riga)
      : input.riconoscimento;
    const esito = valutaConformitaEtichetta({
      trattamento,
      riga,
      rigaEtichetta: typeof input.rigaEtichettaPerRiga === 'function' ? input.rigaEtichettaPerRiga(riga) : input.rigaEtichetta,
      scheda,
      vocabolario: input.vocabolario,
      statoProdotto: stato,
      precedenti: input.precedenti,
      dataRaccolta: input.dataRaccolta,
      oggi: input.oggi,
      riconoscimento,
      controlli: input.controlli,
      mostraRestanti: input.mostraRestanti
    });
    if (righe.length < 2) return esito;
    const nome = String(riga.prodotto || riga.nome || '').trim();
    return {
      colore: esito.colore,
      motivi: esito.motivi.map((m) => {
        if (!nome || !m || !m.testo || m.testo.startsWith(nome + ':')) return m;
        return { ...m, testo: nome + ': ' + m.testo };
      })
    };
  });
  const motivi = esiti.reduce((acc, esito) => acc.concat(esito.motivi || []), []);
  const doseOk = esiti.every((esito) => esito.colore === 'verde');
  return { colore: coloreDi(motivi, doseOk), motivi };
}

export function primaDataRaccoltaDopo(dataTrattamento, candidati) {
  const inizio = dataGiorno(dataTrattamento);
  if (!inizio) return null;
  const dopo = (candidati || [])
    .map(dataGiorno)
    .filter((d) => d && d.getTime() >= inizio.getTime())
    .sort((a, b) => a.getTime() - b.getTime());
  return dopo[0] || null;
}

export function statoProdottoDaAnagrafica(prodotto) {
  if (!prodotto || typeof prodotto !== 'object') return null;
  const stato = prodotto.statoAmministrativoScheda || prodotto.stato || '';
  if (!String(stato).trim() && !prodotto.dataScadenzaAutorizzazioneScheda && !prodotto.dataScadenzaAutorizzazione) return null;
  const cls = classificaStatoAmministrativo(stato);
  const variazione = prodotto.dataVariazioneScheda || '';
  return {
    stato,
    dataScadenzaAutorizzazione: prodotto.dataScadenzaAutorizzazioneScheda || prodotto.dataScadenzaAutorizzazione || '',
    dataDecorrenzaRevoca: (cls === 'revocato' || cls === 'sospeso')
      ? (prodotto.dataDecorrenzaRevoca || variazione || '')
      : (prodotto.dataDecorrenzaRevoca || ''),
    dataDecretoRevoca: prodotto.dataDecretoRevoca || '',
    deroga: prodotto.deroga || null,
    smaltimentoScorteFino: prodotto.smaltimentoScorteFino || null
  };
}

export function messaggiDoseFuoriProdotti(prodotti, anagrafica, pacchetto) {
  const catalogo = Array.isArray(anagrafica) ? anagrafica : [];
  const schede = pacchetto && pacchetto.schede;
  const indice = pacchetto && pacchetto.indice;
  const messaggi = [];
  (prodotti || []).forEach((row) => {
    if (!row) return;
    const prod = row.prodottoId ? catalogo.find((item) => item && item.id === row.prodottoId) : null;
    let scheda = null;
    if (schede && typeof schede.get === 'function') {
      const n = numeroRegistrazioneRiga(row, prod, indice);
      scheda = n ? schede.get(n) || null : null;
    }
    const msg = messaggioDoseFuoriRiga(row, prod, scheda);
    if (msg) messaggi.push(msg);
  });
  return messaggi;
}

export function numeroRegistrazioneRiga(riga, anagrafica, indice) {
  const rif = riga && riga.riferimentoRiga;
  const dalRiga = rif && rif.numeroRegistrazione;
  const letto = (riga && riga.numeroRegistrazioneLetto) || (rif && rif.numeroRegistrazioneLetto);
  const dalProdotto = anagrafica && anagrafica.numeroRegistrazione;
  const esplicito = numeroFileEtichetta(dalRiga || letto || dalProdotto || '');
  if (esplicito) return esplicito;
  if (!indice) return '';
  const nome = (riga && (riga.prodotto || riga.nome)) || (rif && rif.nomeProdotto) || '';
  const trovato = trovaRegistrazionePerNome(nome, indice);
  return trovato.esito === 'unica' ? trovato.numero : '';
}

function riconoscimentoRiga(riga, numero, scheda) {
  if (scheda) return 'scheda';
  const nome = String((riga && (riga.prodotto || riga.nome)) || '').trim();
  if (!nome && !numero) return 'vuoto';
  if (numero) return 'senza_json';
  return 'non_riconosciuto';
}

export async function caricaPacchettoPerRighe(righe, anagraficaDi) {
  const indice = await caricaIndiceEtichette();
  const anag = typeof anagraficaDi === 'function' ? anagraficaDi : () => null;
  const numeri = (righe || []).map((riga) => numeroRegistrazioneRiga(riga, anag(riga), indice)).filter(Boolean);
  const pacchetto = await caricaSchedeRegistrazione(numeri);
  pacchetto.indice = indice;
  return pacchetto;
}

export function legamiScheda(pacchetto, anagraficaDi) {
  const indice = pacchetto && pacchetto.indice;
  const anag = typeof anagraficaDi === 'function' ? anagraficaDi : () => null;
  const schede = pacchetto && pacchetto.schede;
  return {
    vocabolario: pacchetto ? pacchetto.vocabolario : null,
    schedaPerRiga(riga) {
      const n = numeroRegistrazioneRiga(riga, anag(riga), indice);
      if (!n || !schede) return null;
      return schede.get(n) || null;
    },
    statoPerRiga(riga) {
      return statoProdottoDaAnagrafica(anag(riga) || riga);
    },
    riconoscimentoPerRiga(riga) {
      const n = numeroRegistrazioneRiga(riga, anag(riga), indice);
      const scheda = n && schede ? schede.get(n) : null;
      return riconoscimentoRiga(riga, n, scheda);
    }
  };
}

export async function caricaSchedeRegistrazione(numeri) {
  const schede = new Map();
  const ids = [...new Set((numeri || []).map((n) => numeroFileEtichetta(n)).filter(Boolean))];
  await Promise.all(ids.map(async (id) => {
    try {
      schede.set(id, await caricaSchedaEtichetta(id));
    } catch (e) {
      schede.set(id, null);
    }
  }));
  let vocabolario = null;
  try {
    vocabolario = await caricaVocabolarioColture();
  } catch (e) {
    vocabolario = null;
  }
  return { schede, vocabolario };
}

export function testiRossi(esito) {
  return (esito && esito.motivi || []).filter((m) => m && m.colore === 'rosso' && m.testo).map((m) => m.testo);
}

export function testiSegnalati(esito) {
  return (esito && esito.motivi || [])
    .filter((m) => m && (m.colore === 'rosso' || m.colore === 'giallo') && m.testo)
    .map((m) => m.testo);
}

export function chiediSalvaComunque(messaggi, confirmFn) {
  const lista = (messaggi || []).map((t) => String(t || '').trim()).filter(Boolean);
  if (!lista.length) return true;
  const chiedi = typeof confirmFn === 'function'
    ? confirmFn
    : ((testo) => (typeof window !== 'undefined' && window.confirm ? window.confirm(testo) : false));
  return !!chiedi(lista.join('\n') + '\n\nSalvare comunque?');
}

export function parolaConformita(esito) {
  const colore = esito && PAROLE[esito.colore] ? esito.colore : 'grigio';
  if (colore !== 'grigio') return PAROLE[colore];
  const motivi = (esito && esito.motivi) || [];
  const senza = motivi.some((m) => m && (m.codice === 'scheda_mancante' || m.codice === 'prodotto_non_riconosciuto'));
  return senza ? PAROLA_SENZA_SCHEDA : PAROLE.grigio;
}

function breveMotivoGrigio(m) {
  if (!m || !m.testo) return '';
  const t = String(m.testo);
  if (m.codice === 'riga_ambigua' || /scegli l'avversit/i.test(t)) return "scegli l'avversità";
  if (m.codice === 'unita_mancante' || /unit[aà] mancante/i.test(t)) return 'unità della dose';
  if (m.codice === 'dose_non_indicata' || /dose non indicata/i.test(t)) return 'dose non indicata';
  if (m.codice === 'prodotto_non_riconosciuto') return 'prodotto non riconosciuto';
  return t.replace(/^[^:]{0,80}:\s*/, '');
}

export function titoloBannerConformita(esito) {
  const parola = parolaConformita(esito);
  if (!esito || esito.colore !== 'grigio' || parola !== PAROLE.grigio) return parola;
  const primo = (esito.motivi || []).find((m) => m && m.colore === 'grigio' && m.testo);
  const breve = breveMotivoGrigio(primo);
  return breve ? 'Da completare: ' + breve : 'Da completare';
}

export function htmlSemaforoConformita(esito, opzioni = {}) {
  const colore = esito && CLASSI[esito.colore] ? esito.colore : 'grigio';
  const testi = (esito && esito.motivi || []).map((m) => m && m.testo).filter(Boolean);
  const label = [parolaConformita(esito), ...testi].join('. ');
  let taglia = '';
  if (opzioni.taglia === 'banner') taglia = ' gfv-semaforo--banner';
  else if (opzioni.taglia === 'cella') taglia = ' gfv-semaforo--cella';
  else if (opzioni.taglia === 'riga') taglia = ' gfv-semaforo--riga';
  else if (opzioni.piccolo) taglia = ' gfv-semaforo--sm';
  return '<span class="gfv-semaforo gfv-semaforo--' + CLASSI[colore] + taglia + '" role="img" aria-label="'
    + esc(label) + '" title="' + esc(label) + '"></span>';
}

export function htmlBannerConformita(esito) {
  const colore = esito && CLASSI[esito.colore] ? esito.colore : 'grigio';
  const titolo = titoloBannerConformita(esito);
  const voce = (esito && esito.motivi) || [];
  const lista = voce.filter((m) => m && m.colore && m.testo);
  const note = voce.filter((m) => m && !m.colore && m.testo);
  const ul = lista.map((m) => '<li>' + esc(m.testo) + '</li>').join('');
  const noteHtml = note.map((m) => '<p class="gfv-semaforo-banner-nota">' + esc(m.testo) + '</p>').join('');
  return '<div class="gfv-semaforo-banner gfv-semaforo-banner--' + CLASSI[colore] + '" data-colore="' + colore + '" role="status">'
    + htmlSemaforoConformita(esito, { taglia: 'banner' })
    + '<div class="gfv-semaforo-banner-testo">'
    + '<p class="gfv-semaforo-banner-titolo">' + esc(titolo) + '</p>'
    + (ul ? '<ul class="gfv-semaforo-banner-motivi">' + ul + '</ul>' : '')
    + noteHtml
    + '</div></div>';
}

export function htmlRiepilogoConformita(esito) {
  const colore = esito && PAROLE[esito.colore] ? esito.colore : 'grigio';
  const lista = (esito && esito.motivi || []).map((m) => '<li>' + esc(m.testo) + '</li>').join('');
  return '<div class="registro-conformita" data-colore="' + colore + '">'
    + '<span class="gfv-semaforo-inline">' + htmlSemaforoConformita(esito) + '<span class="gfv-semaforo-parola">' + esc(parolaConformita(esito)) + '</span></span>'
    + (lista ? '<ul class="registro-conformita-motivi">' + lista + '</ul>' : '')
    + '</div>';
}

export function htmlPallinoCampo(esito, campo) {
  const motivi = (esito && esito.motivi || []).filter((m) => m && m.campo === campo);
  if (!motivi.length) return '';
  let colore = 'grigio';
  motivi.forEach((m) => {
    const c = m.colore && RANK[m.colore] ? m.colore : 'grigio';
    if (RANK[c] > RANK[colore]) colore = c;
  });
  return htmlSemaforoConformita({ colore, motivi }, { piccolo: true });
}

export function htmlCellaAvvisi(esito, extraTesti) {
  const base = esito && esito.colore ? esito : {
    colore: 'grigio',
    motivi: [motivo('scheda_mancante', 'grigio', null, PAROLA_SENZA_SCHEDA)]
  };
  const extra = (Array.isArray(extraTesti) ? extraTesti : String(extraTesti || '').split(';'))
    .map((t) => String(t || '').trim())
    .filter(Boolean);
  const fuso = {
    colore: base.colore,
    motivi: (base.motivi || []).concat(extra.map((testo) => motivo('avviso_precedente', null, null, testo)))
  };
  return {
    html: '<span class="gfv-semaforo-inline">' + htmlSemaforoConformita(fuso, { taglia: 'cella' }) + '<span class="gfv-semaforo-parola">' + esc(parolaConformita(base)) + '</span></span>',
    rowClass: base.colore === 'rosso' ? 'gfv-row-alert--red' : ''
  };
}
