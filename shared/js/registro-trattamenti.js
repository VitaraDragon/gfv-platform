/**
 * Registro trattamenti privato: conferma riga, miscela, avvisi, export, conservazione.
 * Un solo helper per vigneto, frutteto e seminativo. Non invia nulla al SIAN.
 * @module shared/js/registro-trattamenti
 */

export const FONTE_OPEN_DATA_FITOSANITARI = 'Ministero della Salute, open data Fitosanitari, licenza Italian Open Data License 2.0';
export const ANNI_CONSERVAZIONE_REGISTRO = 3;
export const NOTA_REGISTRO_PRIVATO = 'Registro privato di compilazione. I dati anagrafici del prodotto vengono dal Ministero della Salute; carenza e avversità sono quelle della scheda pubblica, filtrate sulla specie del terreno e confermate in azienda. GFV non invia il file al SIAN né al fascicolo.';
export const NOTA_PASSAGGIO_NON_REGISTRATO = 'Se un trattamento di ieri non è ancora stato registrato, questo avviso non lo vede.';

export function numeroFinito(value) {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function arrotonda(value, decimals = 2) {
  const n = numeroFinito(value);
  if (n == null) return null;
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

export function dataRegistro(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') {
    const d = value.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  if (typeof value === 'object' && value.seconds != null) {
    const d = new Date(Number(value.seconds) * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normalizzaRiferimentoRiga(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const nomeProdotto = raw.nomeProdotto != null ? String(raw.nomeProdotto).trim() : '';
  const numeroRegistrazione = raw.numeroRegistrazione != null ? String(raw.numeroRegistrazione).trim() : '';
  const colturaScheda = raw.colturaScheda != null ? String(raw.colturaScheda).trim() : '';
  if (!nomeProdotto && !numeroRegistrazione && !colturaScheda) return null;
  return { nomeProdotto, numeroRegistrazione, colturaScheda };
}

/** Campi confermati sulla riga prodotto. Non inventa valori assenti. */
export function campiConfermaRiga(raw = {}) {
  return {
    avversita: raw.avversita != null && String(raw.avversita).trim() ? String(raw.avversita).trim() : null,
    specieUsata: raw.specieUsata != null && String(raw.specieUsata).trim() ? String(raw.specieUsata).trim() : null,
    riferimentoRiga: normalizzaRiferimentoRiga(raw.riferimentoRiga),
    confermatoDa: raw.confermatoDa != null && String(raw.confermatoDa).trim() ? String(raw.confermatoDa).trim() : null,
    confermatoIl: raw.confermatoIl || null,
    impieghiMassimiAnno: numeroFinito(raw.impieghiMassimiAnno),
    giorniMinimiTraPassaggi: numeroFinito(raw.giorniMinimiTraPassaggi),
    dosePerEttaroScheda: numeroFinito(raw.dosePerEttaroScheda),
    dosePerEttolitroScheda: numeroFinito(raw.dosePerEttolitroScheda),
    giorniCarenzaConfermata: numeroFinito(raw.giorniCarenzaConfermata),
    epoca: raw.epoca != null && String(raw.epoca).trim() ? String(raw.epoca).trim() : null,
    doseMinHa: numeroFinito(raw.doseMinHa),
    doseMaxHa: numeroFinito(raw.doseMaxHa),
    doseMinHl: numeroFinito(raw.doseMinHl),
    doseMaxHl: numeroFinito(raw.doseMaxHl),
    unitaDose: raw.unitaDose != null && String(raw.unitaDose).trim() ? String(raw.unitaDose).trim() : null
  };
}

function slugConferma(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
}

/** Chiave di conferma: coltura della scheda, epoca e avversità. */
export function chiaveConfermaScheda(riga = {}) {
  const coltura = (riga.riferimentoRiga && riga.riferimentoRiga.colturaScheda) || riga.colturaScheda || '';
  const avversita = riga.avversita || '';
  if (!String(coltura).trim() || !String(avversita).trim()) return '';
  return [slugConferma(coltura), slugConferma(riga.epoca), slugConferma(avversita)].join('__');
}

function testoBassoScheda(value) {
  return String(value || '').trim().toLowerCase();
}

function colturaMenuCoincide(richiesta, alias, colturaRiga) {
  const nome = testoBassoScheda(colturaRiga);
  if (!nome) return false;
  const chiavi = [testoBassoScheda(richiesta), ...(alias || []).map(testoBassoScheda)].filter(Boolean);
  return chiavi.some((k) => nome === k);
}

function rigaMenuSerra(row) {
  return /serra/.test([row && row.colturaScheda, row && row.avversita, row && row.epoca].map(testoBassoScheda).join(' '));
}

/**
 * Voci del menu sul lavoro. La specie sceglie la coltura.
 * Se restano più epoche, restano tutte: la data non sceglie la dose.
 * In pieno campo non entra la riga di serra.
 */
export function vociMenuScheda(input = {}) {
  const specie = String(input.specie || '').trim();
  if (!specie) return [];
  const chiedeSerra = /serra/.test(testoBassoScheda(specie));
  const conferme = input.conferme && typeof input.conferme === 'object' ? input.conferme : {};
  const voci = (Array.isArray(input.righe) ? input.righe : []).filter((row) => {
    if (!row || !String(row.avversita || '').trim()) return false;
    if (!chiedeSerra && (row.pienoCampo === false || rigaMenuSerra(row))) return false;
    return colturaMenuCoincide(specie, input.alias, row.colturaScheda);
  }).map((row) => {
    const voce = {
      colturaScheda: String(row.colturaScheda || '').trim(),
      epoca: row.epoca ? String(row.epoca).trim() : null,
      avversita: String(row.avversita).trim(),
      pienoCampo: row.pienoCampo !== false,
      giorniCarenza: numeroFinito(row.giorniCarenza),
      doseMinHa: numeroFinito(row.doseMinHa),
      doseMaxHa: numeroFinito(row.doseMaxHa),
      doseMinHl: numeroFinito(row.doseMinHl),
      doseMaxHl: numeroFinito(row.doseMaxHl),
      unitaDose: row.unitaDose ? String(row.unitaDose).trim() : null,
      impieghiMassimiAnno: numeroFinito(row.impieghiMassimiAnno),
      giorniMinimiTraPassaggi: numeroFinito(row.giorniMinimiTraPassaggi)
    };
    voce.giaConfermata = !!conferme[chiaveConfermaScheda(voce)];
    return voce;
  });
  voci.sort((a, b) => Number(b.giaConfermata) - Number(a.giaConfermata));
  return voci;
}

export function piuFinestreInMenu(voci) {
  const epoche = new Set((voci || []).map((voce) => voce.epoca || ''));
  return epoche.size > 1;
}

/** Con la riga di scheda confermata, minimo e massimo sono quelli. Altrimenti restano quelli scritti in anagrafica. */
export function rangeDoseAvviso(row, anagrafica) {
  const minScheda = numeroFinito(row && row.doseMinHa);
  const maxScheda = numeroFinito(row && row.doseMaxHa);
  if (rigaHaConferma(row) && (minScheda != null || maxScheda != null)) {
    return { min: minScheda, max: maxScheda };
  }
  return {
    min: numeroFinito(anagrafica && anagrafica.dosaggioMin),
    max: numeroFinito(anagrafica && anagrafica.dosaggioMax)
  };
}

export function rigaHaConferma(riga) {
  return !!(riga && (riga.confermatoIl || riga.avversita));
}

export function trattamentoHaConferma(trattamento) {
  const prodotti = trattamento && Array.isArray(trattamento.prodotti) ? trattamento.prodotti : [];
  return prodotti.some(rigaHaConferma);
}

/**
 * Se c'è uno dei due numeri e ci sono gli ettari, calcola l'altro.
 * @returns {{ ettolitriPerEttaro: number|null, ettolitriTotali: number|null }}
 */
export function calcolaAcqua({ ettari, ettolitriPerEttaro, ettolitriTotali } = {}) {
  const ha = numeroFinito(ettari);
  let perHa = numeroFinito(ettolitriPerEttaro);
  let totale = numeroFinito(ettolitriTotali);
  if (perHa != null && ha != null && ha > 0 && totale == null) totale = arrotonda(perHa * ha, 4);
  if (totale != null && ha != null && ha > 0 && perHa == null) perHa = arrotonda(totale / ha, 4);
  return { ettolitriPerEttaro: perHa, ettolitriTotali: totale };
}

/** dose a botte piena = dose per ettolitro × quintali. 1 quintale = 100 litri. */
export function doseBottePiena(dosePerEttolitro, quintali) {
  const dose = numeroFinito(dosePerEttolitro);
  const q = numeroFinito(quintali);
  if (dose == null || q == null || q <= 0) return null;
  return arrotonda(dose * q, 4);
}

/**
 * Miscela prevista. Senza quintali della botte non inventa la botte piena.
 * L'ultima botte, se parziale, usa la dose per ettolitro sull'acqua di quella botte.
 */
export function calcolaMiscela(input = {}) {
  const ettari = numeroFinito(input.ettari);
  const acqua = calcolaAcqua({
    ettari,
    ettolitriPerEttaro: input.ettolitriPerEttaro,
    ettolitriTotali: input.ettolitriTotali
  });
  const quintali = numeroFinito(input.capacitaBotteQuintali);
  const haBotte = quintali != null && quintali > 0;
  const prodottiIn = Array.isArray(input.prodotti) ? input.prodotti : [];
  const prodotti = prodottiIn.map((row) => {
    const dosePerEttaro = numeroFinito(row.dosePerEttaro != null ? row.dosePerEttaro : row.dosaggio);
    const dosePerEttolitro = numeroFinito(row.dosePerEttolitro != null ? row.dosePerEttolitro : row.dosePerEttolitroScheda);
    const quantita = dosePerEttaro != null && ettari != null && ettari > 0
      ? arrotonda(dosePerEttaro * ettari, 4)
      : numeroFinito(row.quantita);
    return {
      prodottoId: row.prodottoId || null,
      nome: row.nome || row.prodotto || '',
      unita: row.unita || row.unitaDosaggio || null,
      dosePerEttaro,
      quantita,
      dosePerEttolitro,
      doseBottePiena: haBotte ? doseBottePiena(dosePerEttolitro, quintali) : null
    };
  });

  let bottiPiene = null;
  let ultimaBotte = null;
  if (haBotte && acqua.ettolitriTotali != null && acqua.ettolitriTotali > 0) {
    const intere = Math.floor(acqua.ettolitriTotali / quintali + 1e-9);
    const resto = arrotonda(acqua.ettolitriTotali - intere * quintali, 4);
    bottiPiene = resto != null && resto > 0.0001 ? intere : Math.round(acqua.ettolitriTotali / quintali);
    if (resto != null && resto > 0.0001) {
      ultimaBotte = {
        ettolitri: resto,
        prodotti: prodotti.map((p) => ({
          nome: p.nome,
          unita: p.unita,
          quantita: p.dosePerEttolitro != null ? arrotonda(p.dosePerEttolitro * resto, 4) : null
        }))
      };
    }
  }

  return {
    ettolitriPerEttaro: acqua.ettolitriPerEttaro,
    ettolitriTotali: acqua.ettolitriTotali,
    capacitaBotteQuintali: haBotte ? quintali : null,
    nomeAttrezzo: input.nomeAttrezzo || null,
    prodotti,
    bottiPiene,
    ultimaBotte
  };
}

function stessoProdotto(a, b) {
  if (a.prodottoId && b.prodottoId) return String(a.prodottoId) === String(b.prodottoId);
  const na = String(a.nome || a.prodotto || '').trim().toLowerCase();
  const nb = String(b.nome || b.prodotto || '').trim().toLowerCase();
  return !!na && na === nb;
}

function stessoCampo(a, b) {
  return String(a.terrenoId || '') !== '' && String(a.terrenoId) === String(b.terrenoId || '');
}

/**
 * Avvisi non bloccanti su numero massimo e intervallo.
 * Conto per lo stesso prodotto, lo stesso campo, nell'anno.
 * Senza conferma non inventa la soglia.
 */
export function avvisoImpieghiEIntervallo(input = {}) {
  const messaggi = [];
  const data = dataRegistro(input.data) || new Date();
  const anno = data.getFullYear();
  const terrenoId = input.terrenoId || null;
  const corrente = {
    prodottoId: input.prodottoId || null,
    nome: input.nome || input.prodotto || '',
    terrenoId
  };
  const conferma = input.conferma || null;
  const haSoglia = conferma && (
    numeroFinito(conferma.impieghiMassimiAnno) != null ||
    numeroFinito(conferma.giorniMinimiTraPassaggi) != null
  );
  if (!haSoglia) {
    messaggi.push('Per ' + (corrente.nome || 'questo prodotto') + ' la scheda non è confermata: il controllo sul numero massimo e sull\'intervallo non si può fare.');
  } else {
    const precedenti = (Array.isArray(input.precedenti) ? input.precedenti : []).filter((p) => {
      if (!p || (input.escludiId && p.id && String(p.id) === String(input.escludiId))) return false;
      const d = dataRegistro(p.data);
      if (!d || d.getFullYear() !== anno) return false;
      if (!stessoCampo({ terrenoId }, p)) return false;
      return stessoProdotto(corrente, p);
    });
    const max = numeroFinito(conferma.impieghiMassimiAnno);
    if (max != null && precedenti.length >= max) {
      messaggi.push((corrente.nome || 'Il prodotto') + ' su questo campo è già al numero massimo di impieghi nell\'anno (' + max + ').');
    }
    const minGiorni = numeroFinito(conferma.giorniMinimiTraPassaggi);
    if (minGiorni != null && precedenti.length) {
      const ultimo = precedenti
        .map((p) => dataRegistro(p.data))
        .filter(Boolean)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      if (ultimo) {
        const giorni = Math.round((data.getTime() - ultimo.getTime()) / 86400000);
        if (giorni < minGiorni) {
          messaggi.push('L\'ultimo passaggio registrato di ' + (corrente.nome || 'questo prodotto') + ' su questo campo è troppo vicino (' + giorni + ' giorni, ne servono almeno ' + minGiorni + ').');
        }
      }
    }
  }
  if (input.includiNotaNonRegistrato) messaggi.push(NOTA_PASSAGGIO_NON_REGISTRATO);
  return { avvisi: messaggi, blocca: false };
}

/**
 * Se la quantità di prodotto e l'acqua usata non tornano con la dose per ettolitro, avvisa.
 * 1 ettolitro = 100 litri, quindi quantità attesa = dose per ettolitro × ettolitri.
 */
export function avvisoDiluizione({ nome, quantita, ettolitriTotali, dosePerEttolitro } = {}) {
  const q = numeroFinito(quantita);
  const hl = numeroFinito(ettolitriTotali);
  const dose = numeroFinito(dosePerEttolitro);
  if (q == null || hl == null || dose == null || hl <= 0) return null;
  const attesa = dose * hl;
  const scarto = Math.abs(q - attesa);
  const tolleranza = Math.max(0.05, Math.abs(attesa) * 0.05);
  if (scarto <= tolleranza) return null;
  const etichetta = nome || 'Il prodotto';
  return etichetta + ': la quantità (' + arrotonda(q, 2) + ') e l\'acqua usata (' + arrotonda(hl, 2) + ' hl) non tornano con la dose per ettolitro confermata (' + dose + ', attesi circa ' + arrotonda(attesa, 2) + ').';
}

export function avvisiRegistrazione(input = {}) {
  const messaggi = [];
  const prodotti = Array.isArray(input.prodotti) ? input.prodotti : [];
  prodotti.forEach((row) => {
    const conferma = rigaHaConferma(row) ? row : null;
    const esito = avvisoImpieghiEIntervallo({
      data: input.data,
      terrenoId: input.terrenoId,
      prodottoId: row.prodottoId,
      nome: row.prodotto || row.nome,
      conferma,
      precedenti: input.precedenti,
      escludiId: input.escludiId,
      includiNotaNonRegistrato: false
    });
    messaggi.push(...esito.avvisi);
    const dil = avvisoDiluizione({
      nome: row.prodotto || row.nome,
      quantita: row.quantita,
      ettolitriTotali: input.ettolitriTotali,
      dosePerEttolitro: row.dosePerEttolitroScheda
    });
    if (dil) messaggi.push(dil);
  });
  return { avvisi: messaggi, blocca: false };
}

export function valutaCancellazioneRegistro(trattamento, opzioni = {}) {
  const notaMagazzino = 'I movimenti di magazzino collegati restano: non si tolgono insieme al registro.';
  if (!trattamentoHaConferma(trattamento)) {
    return { consentita: true, messaggio: notaMagazzino };
  }
  const ora = dataRegistro(opzioni.ora) || new Date();
  const data = dataRegistro(trattamento && trattamento.data);
  const limite = new Date(ora.getTime());
  limite.setFullYear(limite.getFullYear() - ANNI_CONSERVAZIONE_REGISTRO);
  const recente = !data || data > limite;
  if (recente && opzioni.exportConfermato !== true) {
    return {
      consentita: false,
      messaggio: 'Questo trattamento è nel registro privato e non ha ancora tre anni. Esporta il registro prima di cancellarlo. ' + notaMagazzino
    };
  }
  return {
    consentita: true,
    messaggio: 'Il registro è stato esportato, oppure sono passati almeno tre anni. ' + notaMagazzino
  };
}

function csvCella(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r;]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function xmlTesto(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const COLONNE_EXPORT = [
  ['azienda', 'azienda'],
  ['indirizzo', 'indirizzo'],
  ['recapiti', 'recapiti'],
  ['dati_fiscali', 'datiFiscali'],
  ['data', 'data'],
  ['terreno', 'terreno'],
  ['coltura', 'coltura'],
  ['varieta', 'varieta'],
  ['ettari', 'ettari'],
  ['prodotto', 'prodotto'],
  ['quantita', 'quantita'],
  ['unita', 'unita'],
  ['dose_per_ettaro', 'dosePerEttaro'],
  ['dose_per_ettolitro', 'dosePerEttolitro'],
  ['acqua_ettolitri_totali', 'acquaEttolitriTotali'],
  ['acqua_ettolitri_per_ettaro', 'acquaEttolitriPerEttaro'],
  ['numero_registrazione', 'numeroRegistrazione'],
  ['principio_attivo', 'principioAttivo'],
  ['fonte', 'fonte'],
  ['data_lettura', 'dataLettura'],
  ['avversita', 'avversita'],
  ['giorni_carenza', 'giorniCarenza'],
  ['specie', 'specie'],
  ['confermato_da', 'confermatoDa'],
  ['confermato_il', 'confermatoIl'],
  ['operatore', 'operatore'],
  ['macchina', 'macchina']
];

export function righeExportRegistro(interventi = []) {
  const out = [];
  (interventi || []).forEach((intervento) => {
    const prodotti = Array.isArray(intervento.prodotti) && intervento.prodotti.length
      ? intervento.prodotti
      : [{ prodotto: intervento.prodotto || '' }];
    prodotti.forEach((row) => {
      const rif = row.riferimentoRiga || {};
      out.push({
        azienda: intervento.azienda || '',
        indirizzo: intervento.indirizzo || '',
        recapiti: intervento.recapiti || '',
        datiFiscali: intervento.datiFiscali || '',
        data: intervento.data || '',
        terreno: intervento.terreno || '',
        coltura: intervento.coltura || '',
        varieta: intervento.varieta || '',
        ettari: intervento.ettari != null ? intervento.ettari : '',
        prodotto: row.prodotto || row.nome || '',
        quantita: row.quantita != null ? row.quantita : '',
        unita: row.unita || row.unitaDosaggio || '',
        dosePerEttaro: row.dosaggio != null ? row.dosaggio : (row.dosePerEttaro != null ? row.dosePerEttaro : ''),
        dosePerEttolitro: row.dosePerEttolitroScheda != null ? row.dosePerEttolitroScheda : '',
        acquaEttolitriTotali: intervento.acquaEttolitriTotali != null ? intervento.acquaEttolitriTotali : '',
        acquaEttolitriPerEttaro: intervento.acquaEttolitriPerEttaro != null ? intervento.acquaEttolitriPerEttaro : '',
        numeroRegistrazione: rif.numeroRegistrazione || row.numeroRegistrazione || '',
        principioAttivo: row.principioAttivo || '',
        fonte: row.fonteScheda || row.fonte || '',
        dataLettura: row.dataLetturaScheda || row.dataLettura || '',
        avversita: row.avversita || '',
        giorniCarenza: row.giorniCarenzaConfermata != null ? row.giorniCarenzaConfermata : (intervento.giorniCarenza != null ? intervento.giorniCarenza : ''),
        specie: row.specieUsata || intervento.specie || '',
        confermatoDa: row.confermatoDa || '',
        confermatoIl: row.confermatoIl || '',
        operatore: intervento.operatore || '',
        macchina: intervento.macchina || ''
      });
    });
  });
  return out;
}

export function registroToCsv(righe) {
  const header = COLONNE_EXPORT.map((c) => c[0]).join(';');
  const lines = (righe || []).map((row) => COLONNE_EXPORT.map((c) => csvCella(row[c[1]])).join(';'));
  return '\uFEFF' + [header, ...lines].join('\r\n');
}

export function registroToXml(righe) {
  const body = (righe || []).map((row) => {
    const campi = COLONNE_EXPORT.map((c) => '<' + c[0] + '>' + xmlTesto(row[c[1]]) + '</' + c[0] + '>').join('');
    return '<trattamento>' + campi + '</trattamento>';
  }).join('');
  return '<?xml version="1.0" encoding="UTF-8"?><registroTrattamenti privato="true">' + body + '</registroTrattamenti>';
}

export function aziendaDaTenant(tenant = {}) {
  const recapiti = [tenant.telefono, tenant.email].filter(Boolean).join(' · ');
  const fiscali = [tenant.partitaIva ? 'P.IVA ' + tenant.partitaIva : '', tenant.codiceFiscale ? 'CF ' + tenant.codiceFiscale : '']
    .filter(Boolean)
    .join(' · ');
  return {
    azienda: tenant.nome || tenant.ragioneSociale || '',
    indirizzo: tenant.indirizzo || tenant.sede || '',
    recapiti,
    datiFiscali: fiscali
  };
}

export function unisciConfermaSpecie(prodotto, specie, riga) {
  const slug = slugConferma(specie);
  const conferme = prodotto && prodotto.confermeSpecie && typeof prodotto.confermeSpecie === 'object'
    ? { ...prodotto.confermeSpecie }
    : {};
  const campi = { ...campiConfermaRiga(riga), specieUsata: specie || (riga && riga.specieUsata) || null };
  if (slug && riga && rigaHaConferma(riga)) conferme[slug] = campi;
  const chiave = chiaveConfermaScheda(campi);
  if (chiave && riga && rigaHaConferma(riga)) conferme[chiave] = campi;
  return {
    numeroRegistrazione: (riga && riga.riferimentoRiga && riga.riferimentoRiga.numeroRegistrazione) || (prodotto && prodotto.numeroRegistrazione) || null,
    principioAttivo: (riga && riga.principioAttivo) || (prodotto && prodotto.principioAttivo) || null,
    fonteScheda: (riga && riga.fonteScheda) || FONTE_OPEN_DATA_FITOSANITARI,
    dataLetturaScheda: (riga && riga.dataLetturaScheda) || null,
    confermeSpecie: conferme
  };
}

/** Stessa soglia della coda: sei mesi dopo l'ultima lettura completa. Senza data, la foto non si propone. */
export function schedaOltreSeiMesi(iso, oraMs = Date.now()) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return true;
  const limite = new Date(t);
  limite.setUTCMonth(limite.getUTCMonth() + 6);
  return Number(oraMs) >= limite.getTime();
}

export function schedaDaRileggere(prodotto, oraMs = Date.now()) {
  if (!prodotto || prodotto.letturaSchedaStato !== 'pronta') return false;
  return schedaOltreSeiMesi(prodotto.letturaSchedaCompletaAt, oraMs);
}

export function testoStatoLetturaScheda(prodotto) {
  if (!prodotto || String(prodotto.categoria || '').toLowerCase() !== 'fitofarmaci') return '';
  if (prodotto.letturaSchedaStato === 'in_corso') return 'Lettura in corso';
  if (prodotto.letturaSchedaStato === 'pronta') return 'Scheda letta';
  if (prodotto.letturaSchedaStato === 'da_riprovare') {
    if (prodotto.letturaSchedaMotivo === 'nome_non_univoco') {
      return 'Da riprovare: il nome non corrisponde a una sola registrazione';
    }
    if (prodotto.letturaSchedaMotivo === 'non_trovato') {
      return 'Da riprovare: nome non trovato negli open data';
    }
    return 'Da riprovare';
  }
  return 'In attesa di lettura';
}

function escAttrSemaforo(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/** Pallino accanto al nome. Verde scheda letta, giallo in lettura, rosso non letta. Nessun pulsante. */
export function htmlSemaforoLetturaScheda(prodotto) {
  const titolo = testoStatoLetturaScheda(prodotto);
  if (!titolo) return '';
  let colore = 'yellow';
  if (prodotto.letturaSchedaStato === 'pronta') colore = 'green';
  else if (prodotto.letturaSchedaStato === 'da_riprovare') colore = 'red';
  const t = escAttrSemaforo(titolo);
  return '<span class="gfv-semaforo gfv-semaforo--' + colore + '" title="' + t + '" role="img" aria-label="' + t + '"></span>';
}

export function confermaSpecieSalvata(prodotto, specie) {
  if (!prodotto || !prodotto.confermeSpecie || !specie) return null;
  const slug = slugConferma(specie);
  return prodotto.confermeSpecie[slug] || null;
}

export function confermaSchedaSalvata(prodotto, riga) {
  const chiave = chiaveConfermaScheda(riga || {});
  if (!chiave || !prodotto || !prodotto.confermeSpecie) return null;
  return prodotto.confermeSpecie[chiave] || null;
}
