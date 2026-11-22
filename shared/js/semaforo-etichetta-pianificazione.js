/**
 * Semaforo etichetta sul trattamento ancora da fare, e carenza sulla raccolta.
 * Funzioni pure: niente DOM e niente Firestore. Punto d'aggancio futuro per Tony.
 * Non consiglia una dose e non inventa un valore se in etichetta il campo è vuoto.
 * @module shared/js/semaforo-etichetta-pianificazione
 */

import { numeroFinito, righeTrattamentoDaMiscela } from './registro-trattamenti.js';
import { intervalloDoseHa } from './registro-trattamenti-etichetta.js';
import {
  dataGiorno,
  formattaDataIt,
  formattaNumeroIt,
  testiRossi,
  testiSegnalati,
  trovaRigaEtichetta,
  valutaConformitaEtichetta,
  valutaConformitaTrattamento
} from './registro-trattamenti-conformita.js';

/**
 * Tipo lavoro di raccolta o vendemmia. Una sola funzione per Gestione Lavori e Diario.
 * «Vendemmia manuale», «Raccolta frutta» e «Raccolta» sì. «Trattamento» e «Potatura» no.
 * @returns {{ vendemmia: boolean, raccolta: boolean, eRaccolta: boolean }}
 */
export function tipoLavoroRaccolta(nome) {
  const testo = String(nome || '').toLowerCase();
  const vendemmia = testo.includes('vendemmia');
  const raccolta = testo.includes('raccolta');
  return { vendemmia, raccolta, eRaccolta: vendemmia || raccolta };
}

/**
 * «vendemmiare» per la vite e per l'uva da vino o da tavola. Altrimenti «raccogliere».
 */
export function verboRaccolta({ coltura, tipoLavoro, terrenoColtura } = {}) {
  const tipo = tipoLavoroRaccolta(tipoLavoro);
  const col = String(coltura || '').toLowerCase();
  const terreno = String(terrenoColtura || '').toLowerCase();
  const vite = col.includes('vite') || col.includes('uva') || terreno.includes('vite');
  if (tipo.vendemmia || vite) return 'vendemmiare';
  return 'raccogliere';
}

function aggiungiGiorni(data, giorni) {
  const giorno = dataGiorno(data);
  if (!giorno || !Number.isFinite(giorni)) return null;
  const out = new Date(giorno.getFullYear(), giorno.getMonth(), giorno.getDate());
  out.setDate(out.getDate() + giorni);
  return out;
}

function giornoChiave(value) {
  const giorno = dataGiorno(value);
  if (!giorno) return '';
  const mm = String(giorno.getMonth() + 1).padStart(2, '0');
  const gg = String(giorno.getDate()).padStart(2, '0');
  return giorno.getFullYear() + '-' + mm + '-' + gg;
}

function schedaDellaRiga(input, riga) {
  if (typeof input.schedaPerRiga === 'function') return input.schedaPerRiga(riga);
  if (input.legami && typeof input.legami.schedaPerRiga === 'function') return input.legami.schedaPerRiga(riga);
  return input.scheda || null;
}

function carenzaUtile(voci) {
  const lista = Array.isArray(voci) ? voci : [];
  const libera = lista.some((voce) => voce && voce.non_necessario === true && !String(voce.condizione || '').trim());
  if (libera) return null;
  const conGiorni = lista.filter((voce) => voce && voce.non_necessario !== true && numeroFinito(voce.giorni) != null);
  if (!conGiorni.length) return null;
  const giorni = Math.max(...conGiorni.map((voce) => Number(voce.giorni)));
  const scelta = conGiorni.find((voce) => Number(voce.giorni) === giorni) || conGiorni[0];
  return { giorni, condizione: String(scelta.condizione || '').trim() };
}

function carenzaDalleCandidate(candidate) {
  const lette = (candidate || []).map((riga) => carenzaUtile(riga && riga.carenza));
  const conGiorni = lette.filter(Boolean);
  if (!conGiorni.length) return null;
  const giorni = conGiorni.map((voce) => voce.giorni);
  const unica = new Set(giorni).size === 1;
  const massima = Math.max(...giorni);
  const scelta = conGiorni.find((voce) => voce.giorni === massima);
  return {
    giorni: massima,
    condizione: unica ? (scelta.condizione || '') : '',
    ambigua: !unica
  };
}

function voceCarenzaProdotto({ riga, trattamento, coltura, vocabolario, scheda }) {
  if (!riga || !scheda) return null;
  const trovato = trovaRigaEtichetta({
    scheda,
    vocabolario,
    trattamento: { specieUsata: coltura, data: trattamento && trattamento.data },
    riga: {
      ...riga,
      specieUsata: riga.specieUsata || coltura,
      riferimentoRiga: riga.riferimentoRiga || { colturaScheda: coltura }
    }
  });
  if (trovato.blocco && trovato.blocco.codice !== 'riga_ambigua') return null;
  const scelta = trovato.riga
    ? carenzaUtile(trovato.riga.carenza)
    : carenzaDalleCandidate(trovato.candidate);
  if (!scelta) return null;
  const dal = aggiungiGiorni(trattamento && trattamento.data, scelta.giorni);
  if (!dal) return null;
  const nome = String(riga.prodotto || riga.nome || '').trim();
  return {
    prodotto: nome,
    dataTrattamento: dataGiorno(trattamento && trattamento.data),
    giorni: scelta.giorni,
    dal,
    condizione: scelta.condizione || '',
    ambigua: scelta.ambigua === true
  };
}

function fraseCarenza(verbo, dataMinima, voci) {
  const dettagli = voci.map((voce) => {
    let testo = voce.prodotto + ', trattamento del ' + formattaDataIt(voce.dataTrattamento)
      + ', carenza ' + voce.giorni + ' giorni da etichetta';
    if (voce.ambigua) {
      testo += ' (valore più lungo tra le avversità in etichetta: scegli l\'avversità nel registro)';
    }
    if (voce.condizione) {
      testo += ' (in etichetta: solo con la condizione «' + voce.condizione + '»)';
    }
    return testo;
  }).join('. ');
  return 'Non si può ' + verbo + ' prima del ' + formattaDataIt(dataMinima) + ': ' + dettagli;
}

/**
 * Avviso di carenza d'etichetta prima di una raccolta o di una vendemmia.
 * Punto d'aggancio futuro per Tony. Solo la carenza d'etichetta: se manca, nessun avviso.
 * Non blocca e non chiede conferma: chi chiama decide solo se mostrare `testo`.
 * @param {object} input
 * @param {string|Date} [input.dataRaccolta]
 * @param {string} [input.coltura]
 * @param {'vendemmiare'|'raccogliere'} [input.verbo]
 * @param {Array} [input.trattamenti]
 * @returns {{ dataMinima: Date|null, voci: Array, testo: string }}
 */
export function avvisoCarenzaRaccolta(input = {}) {
  const dataRaccolta = dataGiorno(input.dataRaccolta);
  const verbo = input.verbo === 'vendemmiare' ? 'vendemmiare' : 'raccogliere';
  const coltura = String(input.coltura || '').trim();
  const vocabolario = input.vocabolario || (input.legami && input.legami.vocabolario) || null;
  const voci = [];
  (Array.isArray(input.trattamenti) ? input.trattamenti : []).forEach((trattamento) => {
    const dataTrattamento = dataGiorno(trattamento && trattamento.data);
    if (dataRaccolta && dataTrattamento && dataTrattamento.getTime() > dataRaccolta.getTime()) return;
    const prodotti = trattamento && Array.isArray(trattamento.prodotti) ? trattamento.prodotti : [];
    prodotti.forEach((riga) => {
      const voce = voceCarenzaProdotto({
        riga,
        trattamento,
        coltura,
        vocabolario,
        scheda: schedaDellaRiga(input, riga)
      });
      if (voce) voci.push(voce);
    });
  });
  if (!voci.length) return { dataMinima: null, voci: [], testo: '' };
  voci.sort((a, b) => b.dal.getTime() - a.dal.getTime());
  const dataMinima = voci[0].dal;
  if (dataRaccolta && dataRaccolta.getTime() >= dataMinima.getTime()) {
    return { dataMinima, voci, testo: '' };
  }
  return { dataMinima, voci, testo: fraseCarenza(verbo, dataMinima, voci) };
}

function precedentiSenzaQuestoLavoro(precedenti, lavoroId) {
  const id = lavoroId ? String(lavoroId) : '';
  return (Array.isArray(precedenti) ? precedenti : []).filter((passaggio) => {
    if (!passaggio || !id) return true;
    if (passaggio.lavoroId && String(passaggio.lavoroId) === id) return false;
    if (passaggio.id && String(passaggio.id) === 'lavoro:' + id) return false;
    return true;
  });
}

/**
 * Conformità di un trattamento pianificato, senza la carenza.
 * Punto d'aggancio futuro per Tony. `testiDaConfermare` usa la stessa regola del registro.
 * @param {object} input
 * @returns {{ colore: string, motivi: Array, perRiga: Array, testiDaConfermare: string[] }}
 */
export function valutaTrattamentoPianificato(input = {}) {
  const costruito = righeTrattamentoDaMiscela(input.miscela, input.superficieHa);
  const legami = input.legami || {};
  const trattamento = {
    id: input.lavoroId ? 'lavoro:' + input.lavoroId : null,
    data: input.data,
    terrenoId: input.terrenoId || null,
    specieUsata: input.specie || '',
    acquaEttolitriPerEttaro: costruito.acquaEttolitriPerEttaro
  };
  const precedenti = precedentiSenzaQuestoLavoro(input.precedenti, input.lavoroId);
  const base = {
    trattamento,
    precedenti,
    oggi: input.oggi,
    controlli: { carenza: false },
    mostraRestanti: true,
    vocabolario: legami.vocabolario || input.vocabolario || null
  };
  const perRiga = costruito.prodotti.map((riga) => {
    const scheda = typeof legami.schedaPerRiga === 'function'
      ? legami.schedaPerRiga(riga)
      : (typeof input.schedaPerRiga === 'function' ? input.schedaPerRiga(riga) : input.scheda);
    const esito = valutaConformitaEtichetta({
      ...base,
      riga,
      scheda,
      statoProdotto: typeof legami.statoPerRiga === 'function' ? legami.statoPerRiga(riga) : input.statoProdotto,
      riconoscimento: typeof legami.riconoscimentoPerRiga === 'function'
        ? legami.riconoscimentoPerRiga(riga)
        : input.riconoscimento
    });
    return { riga, esito };
  });
  const fuso = costruito.prodotti.length
    ? valutaConformitaTrattamento({
      ...base,
      righe: costruito.prodotti,
      schedaPerRiga: legami.schedaPerRiga || input.schedaPerRiga,
      statoPerRiga: legami.statoPerRiga || input.statoPerRiga,
      riconoscimentoPerRiga: legami.riconoscimentoPerRiga || input.riconoscimentoPerRiga,
      scheda: input.scheda
    })
    : { colore: 'grigio', motivi: [] };
  return {
    colore: fuso.colore,
    motivi: fuso.motivi || [],
    perRiga,
    testiDaConfermare: testiSegnalati(fuso)
  };
}

/** Testo informativo accanto alla dose. Vuoto se la riga d'etichetta non è determinata. */
export function testoDoseDaEtichetta(scheda, coltura, avversita) {
  const intervallo = intervalloDoseHa(scheda, { coltura: coltura || '', avversita: avversita || '' });
  if (!intervallo) return '';
  let fascia;
  if (intervallo.min != null && intervallo.max != null) {
    fascia = formattaNumeroIt(intervallo.min) + '–' + formattaNumeroIt(intervallo.max);
  } else if (intervallo.max != null) {
    fascia = 'fino a ' + formattaNumeroIt(intervallo.max);
  } else {
    fascia = 'almeno ' + formattaNumeroIt(intervallo.min);
  }
  return 'Da etichetta: ' + fascia + (intervallo.unita ? ' ' + intervallo.unita : '');
}

function firmaMiscela(miscela) {
  const m = miscela && typeof miscela === 'object' ? miscela : {};
  const prodotti = (Array.isArray(m.prodotti) ? m.prodotti : []).map((prodotto) => ({
    id: prodotto && prodotto.prodottoId ? String(prodotto.prodottoId) : '',
    nome: String((prodotto && (prodotto.nome || prodotto.prodotto)) || '').trim(),
    dose: prodotto && prodotto.dosePerEttaro != null ? prodotto.dosePerEttaro : null,
    avversita: String((prodotto && prodotto.avversita) || '').trim()
  }));
  return JSON.stringify({
    prodotti,
    hl: m.ettolitriPerEttaro != null ? m.ettolitriPerEttaro : null,
    tot: m.ettolitriTotali != null ? m.ettolitriTotali : null
  });
}

/**
 * In modifica non si chiede di nuovo la conferma se miscela, data e terreno
 * sono gli stessi. Si chiede se il lavoro viene riattivato dopo un annullamento.
 */
export function pianificazioneGiaConfermata(originale, attuale = {}) {
  if (!originale) return false;
  if (String(originale.terrenoId || '') !== String(attuale.terrenoId || '')) return false;
  if (giornoChiave(originale.dataInizio) !== giornoChiave(attuale.data)) return false;
  if (firmaMiscela(originale.miscelaPrevista) !== firmaMiscela(attuale.miscela)) return false;
  const eraAnnullato = String(originale.stato || '').toLowerCase() === 'annullato';
  const oraAnnullato = String(attuale.stato || '').toLowerCase() === 'annullato';
  if (eraAnnullato !== oraAnnullato) return false;
  return true;
}

/**
 * Se il semaforo ha già contato i passaggi da etichetta, non ripetere
 * l'avviso «non c'è una conferma dell'azienda…».
 */
export function avvisiSenzaConteggioDoppione(avvisi, esito) {
  const nomi = new Set();
  (esito && esito.perRiga || []).forEach((voce) => {
    const motivi = (voce && voce.esito && voce.esito.motivi) || [];
    const contato = motivi.some((motivo) => motivo && (
      motivo.codice === 'trattamenti_restanti'
      || motivo.codice === 'troppi_trattamenti'
      || motivo.codice === 'periodo_conteggio'
    ));
    if (!contato) return;
    const nome = String((voce.riga && (voce.riga.prodotto || voce.riga.nome)) || '').trim().toLowerCase();
    if (nome) nomi.add(nome);
  });
  return (avvisi || []).filter((testo) => {
    const frase = String(testo || '');
    if (!/non c'è una conferma dell'azienda/i.test(frase)) return true;
    const basso = frase.toLowerCase();
    for (const nome of nomi) {
      if (basso.includes(nome)) return false;
    }
    return true;
  });
}

export function messaggiConfermaPianificazione(avvisi, esito) {
  const segnalati = testiSegnalati(esito);
  const messaggi = [];
  const visti = new Set();
  if (testiRossi(esito).length) {
    messaggi.push('Il trattamento pianificato non è conforme all\'etichetta:');
    visti.add(messaggi[0]);
  }
  (avvisi || []).concat(segnalati).forEach((testo) => {
    const pulito = String(testo || '').trim();
    if (!pulito || visti.has(pulito)) return;
    visti.add(pulito);
    messaggi.push(pulito);
  });
  return messaggi;
}
