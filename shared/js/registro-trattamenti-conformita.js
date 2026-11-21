/**
 * Conformità di un trattamento all'etichetta. Nessun DOM e nessun Firestore:
 * dati in ingresso, colore e motivi in uscita. Non consiglia una dose.
 * @module shared/js/registro-trattamenti-conformita
 */

import { numeroFinito, stessoProdotto, dataRegistro } from './registro-trattamenti.js';
import { classificaStatoAmministrativo } from './registro-trattamenti-fonte.js';
import {
  MSG_ETICHETTA_COLTURA_ASSENTE,
  MSG_ETICHETTA_DA_RICONTROLLARE,
  MSG_ETICHETTA_MANCANTE,
  MSG_ETICHETTA_NON_ESTRATTA,
  MSG_ETICHETTA_SENZA_COLTURA,
  chiaveAvversita,
  dataItalianaVisibile,
  normalizzaNomeColtura,
  numeroFileEtichetta,
  preparaEtichetta,
  righePerColtura,
  caricaSchedaEtichetta,
  caricaVocabolarioColture
} from './registro-trattamenti-etichetta.js';

/** Copre una stagione di trattamenti e lascia il tempo di finire le scorte. */
export const GIORNI_AVVISO_SCADENZA = 90;

/** Tolleranza sugli arrotondamenti di dose (0,5%). */
export const TOLLERANZA_ARROTONDAMENTO = 0.005;

const CHIAVI_ORIGINE = ['doseHa', 'doseHl', 'carenza', 'massimo', 'intervallo', 'avversita'];

const PAROLE = {
  rosso: 'Errore',
  giallo: 'Attenzione',
  verde: 'Conforme',
  grigio: "Nessun dato d'etichetta"
};

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
    if (voce.min != null && voce.max != null) intervallo = formattaNumeroIt(voce.min) + '–' + formattaNumeroIt(voce.max) + unita;
    else if (voce.max != null) intervallo = 'fino a ' + formattaNumeroIt(voce.max) + unita;
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
      blocco: motivo('scheda_mancante', 'grigio', null, MSG_ETICHETTA_MANCANTE)
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
      blocco: motivo('riga_ambigua', 'grigio', null, "Più righe d'etichetta possibili: scegli l'avversità")
    };
  }
  return { riga: filtrate[0], blocco: null };
}

function controllaDoseHa(riga, rigaEtichetta, motivi) {
  const voci = (rigaEtichetta.dose_ha || []).map(voceUtile).filter((v) => v && (v.min != null || v.max != null));
  const dose = numeroFinito(riga && riga.dosaggio);
  const specDose = specUnita(riga && riga.unitaDosaggio);
  if (!voci.length) {
    motivi.push(motivo('dose_non_indicata', 'grigio', 'doseHa', 'Dose per ettaro non presente in etichetta, non verificabile'));
    return false;
  }
  if (dose == null || !specDose || (specDose.per && specDose.per !== 'ha')) {
    motivi.push(motivo('dose_non_indicata', 'grigio', 'doseHa', 'Dose per ettaro non indicata, non verificabile'));
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
    motivi.push(motivo('unita_diverse', 'grigio', 'doseHa', 'Unità diverse: la dose non si confronta con l\'etichetta'));
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
  if (hl == null || hl <= 0 || dose == null || !specDose) {
    motivi.push(motivo('dose_hl_non_verificabile', null, 'doseHl', 'Dose per ettolitro: acqua non indicata, non verificabile'));
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
    motivi.push(motivo('unita_diverse', 'grigio', 'doseHl', 'Unità diverse: la dose per ettolitro non si confronta con l\'etichetta'));
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

function passaggiStessoProdotto(input, dataLimite) {
  const riga = input.riga || {};
  const trattamento = input.trattamento || {};
  const corrente = {
    prodottoId: riga.prodottoId || null,
    nome: riga.prodotto || riga.nome || '',
    terrenoId: trattamento.terrenoId || riga.terrenoId || null
  };
  const idCorrente = trattamento.id || riga.id || null;
  return (Array.isArray(input.precedenti) ? input.precedenti : []).filter((p) => {
    if (!p) return false;
    if (idCorrente && p.id && String(p.id) === String(idCorrente)) return false;
    const d = dataGiorno(p.data);
    if (!d || (dataLimite && d.getTime() > dataLimite.getTime())) return false;
    if (!stessoCampo(corrente, p) && (corrente.terrenoId || p.terrenoId)) return false;
    return stessoProdotto(corrente, { prodottoId: p.prodottoId, nome: p.nome || p.prodotto });
  });
}

function controllaMassimo(input, rigaEtichetta, motivi) {
  const voci = (rigaEtichetta.max_trattamenti || []).filter((v) => v && numeroFinito(v.numero) != null);
  if (!voci.length) return;
  const data = dataGiorno(input.trattamento && input.trattamento.data) || dataGiorno(input.oggi) || dataGiorno(new Date());
  const valutate = voci.map((voce) => {
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
    return { voce, ordinale, massimo, oltre: ordinale > massimo, nota: notaPeriodo(voce.periodo) };
  });
  const oltreTutte = valutate.length > 0 && valutate.every((v) => v.oltre);
  if (oltreTutte) {
    const prima = valutate[0];
    const periodoTesto = prima.nota ? '' : etichettaPeriodoMassimo(prima.voce.periodo);
    const pezzi = [
      prima.ordinale + '° trattamento nell\'anno: in etichetta al massimo ' + formattaNumeroIt(prima.massimo) + (periodoTesto ? ' ' + periodoTesto : '')
    ];
    if (prima.nota) pezzi.push(prima.nota);
    if (prima.voce.condizione) pezzi.push('condizione: ' + String(prima.voce.condizione).trim());
    motivi.push(motivo('troppi_trattamenti', 'rosso', 'massimo', pezzi.join('; ')));
    return;
  }
  const note = [...new Set(valutate.map((v) => v.nota).filter(Boolean))];
  if (note.length) {
    motivi.push(motivo('periodo_conteggio', null, 'massimo', note.join('; ')));
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
  const motivi = [];
  const trovato = trovaRigaEtichetta(input);
  let doseOk = false;
  if (trovato.blocco) motivi.push(trovato.blocco);
  if (trovato.riga) {
    doseOk = controllaDoseHa(input.riga || {}, trovato.riga, motivi);
    controllaDoseHl(input.trattamento || {}, input.riga || {}, trovato.riga, motivi);
    controllaCarenza(input.trattamento || {}, trovato.riga, input.dataRaccolta, motivi);
    controllaMassimo(input, trovato.riga, motivi);
    controllaIntervallo(input, trovato.riga, motivi);
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
      motivi: [motivo('scheda_mancante', 'grigio', null, MSG_ETICHETTA_MANCANTE)]
    };
  }
  const esiti = righe.map((riga) => {
    const scheda = typeof input.schedaPerRiga === 'function'
      ? input.schedaPerRiga(riga)
      : input.scheda;
    const stato = typeof input.statoPerRiga === 'function'
      ? input.statoPerRiga(riga)
      : input.statoProdotto;
    const esito = valutaConformitaEtichetta({
      trattamento,
      riga,
      rigaEtichetta: typeof input.rigaEtichettaPerRiga === 'function' ? input.rigaEtichettaPerRiga(riga) : input.rigaEtichetta,
      scheda,
      vocabolario: input.vocabolario,
      statoProdotto: stato,
      precedenti: input.precedenti,
      dataRaccolta: input.dataRaccolta,
      oggi: input.oggi
    });
    if (righe.length < 2) return esito;
    const nome = String(riga.prodotto || riga.nome || '').trim();
    return {
      colore: esito.colore,
      motivi: esito.motivi.map((m) => (nome ? { ...m, testo: nome + ': ' + m.testo } : m))
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

export function numeroRegistrazioneRiga(riga, anagrafica) {
  const dalRiga = riga && riga.riferimentoRiga && riga.riferimentoRiga.numeroRegistrazione;
  const dalProdotto = anagrafica && anagrafica.numeroRegistrazione;
  return numeroFileEtichetta(dalRiga || dalProdotto || '');
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

export function htmlSemaforoConformita(esito, opzioni = {}) {
  const colore = esito && CLASSI[esito.colore] ? esito.colore : 'grigio';
  const testi = (esito && esito.motivi || []).map((m) => m && m.testo).filter(Boolean);
  const label = [PAROLE[colore], ...testi].join('. ');
  const piccolo = opzioni.piccolo ? ' gfv-semaforo--sm' : '';
  return '<span class="gfv-semaforo gfv-semaforo--' + CLASSI[colore] + piccolo + '" role="img" aria-label="'
    + esc(label) + '" title="' + esc(label) + '"></span>';
}

export function htmlRiepilogoConformita(esito) {
  const colore = esito && PAROLE[esito.colore] ? esito.colore : 'grigio';
  const lista = (esito && esito.motivi || []).map((m) => '<li>' + esc(m.testo) + '</li>').join('');
  return '<div class="registro-conformita" data-colore="' + colore + '">'
    + '<span class="gfv-semaforo-inline">' + htmlSemaforoConformita(esito) + '<span class="gfv-semaforo-parola">' + esc(PAROLE[colore]) + '</span></span>'
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
    motivi: [motivo('scheda_mancante', 'grigio', null, "Nessun dato d'etichetta")]
  };
  const extra = (Array.isArray(extraTesti) ? extraTesti : String(extraTesti || '').split(';'))
    .map((t) => String(t || '').trim())
    .filter(Boolean);
  const fuso = {
    colore: base.colore,
    motivi: (base.motivi || []).concat(extra.map((testo) => motivo('avviso_precedente', null, null, testo)))
  };
  return {
    html: '<span class="gfv-semaforo-inline">' + htmlSemaforoConformita(fuso) + '<span class="gfv-semaforo-parola">' + esc(PAROLE[base.colore] || PAROLE.grigio) + '</span></span>',
    rowClass: base.colore === 'rosso' ? 'gfv-row-alert--red' : ''
  };
}
