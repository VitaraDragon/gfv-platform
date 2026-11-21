/**
 * Pannello open data e acqua sul form trattamento (vigneto, frutteto, seminativo, orticole).
 * Il CSV del Ministero non propone dosi. Se c'è il file d'etichetta, i campi si riempiono
 * con quei valori e l'azienda conferma. GFV non consiglia dosi.
 * @module shared/js/registro-trattamenti-form
 */

import {
  NOTA_REGISTRO_PRIVATO,
  calcolaAcqua,
  campiConfermaRiga,
  confermaSpecieSalvata,
  rigaHaConferma,
  avvisiRegistrazione,
  FONTE_OPEN_DATA_FITOSANITARI,
  unisciConfermaSpecie,
  AVVISO_ETICHETTA_FA_FEDE,
  URL_BANCA_FITOSANITARI,
  htmlAttribuzioneOpenData,
  classificaStatoAmministrativo,
  dataLetturaItaliana,
  numeroFinito,
  numeroSingoloTesto
} from './registro-trattamenti.js';
import {
  FRASE_CONFERMA_CONTROLLATA,
  FRASE_VALORE_ESTRATTO,
  TESTO_VALORI_ETICHETTA,
  caricaSchedaEtichetta,
  caricaVocabolarioColture,
  dataItalianaVisibile,
  dataRevisioneOpenData,
  normalizzaNomeColtura,
  preparaEtichetta,
  limitiDoseDaScheda,
  testoConsultaEtichetta
} from './registro-trattamenti-etichetta.js';
import {
  htmlBannerConformita,
  htmlPallinoCampo,
  htmlSemaforoConformita,
  legamiScheda,
  nomeProdottoPerRicercaScheda,
  caricaPacchettoPerRighe,
  valutaConformitaEtichetta,
  valutaConformitaTrattamento
} from './registro-trattamenti-conformita.js';

export { nomeProdottoPerRicercaScheda };

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Per un input type="number": niente NaN. Manca o non è finito → stringa vuota. */
export function valoreInputNumerico(value) {
  const n = numeroFinito(value);
  return n == null ? '' : n;
}

/** Il campo prodotto è un numero di registrazione se, tolti gli spazi, restano solo cifre. */
function numeroDalCampoProdotto(value) {
  const t = String(value == null ? '' : value).replace(/\s+/g, '');
  return /^\d+$/.test(t) ? t : '';
}

/**
 * Richiesta per la callable. Se l'anagrafica ha il numero, si manda quello.
 * Altrimenti il nome pulito, non la stringa grezza di magazzino.
 */
export function richiestaLetturaScheda({ nome, prodotto, specie } = {}) {
  const visibile = String(nome == null ? '' : nome).trim();
  const numeroAnagrafica = prodotto && prodotto.numeroRegistrazione != null
    ? String(prodotto.numeroRegistrazione).trim()
    : '';
  const richiesta = {
    nome: visibile,
    nomeProdotto: visibile,
    specie: specie || ''
  };
  if (numeroAnagrafica && /\d/.test(numeroAnagrafica)) {
    richiesta.numero = numeroAnagrafica;
    richiesta.numeroRegistrazione = numeroAnagrafica;
    return richiesta;
  }
  const pulito = nomeProdottoPerRicercaScheda(visibile);
  const nomeQuery = pulito || visibile;
  richiesta.nome = nomeQuery;
  richiesta.nomeProdotto = nomeQuery;
  const numeroCampo = numeroDalCampoProdotto(nomeQuery);
  if (numeroCampo) {
    richiesta.numero = numeroCampo;
    richiesta.numeroRegistrazione = numeroCampo;
  }
  return richiesta;
}

export function notaRegistroTesto() {
  return NOTA_REGISTRO_PRIVATO;
}

function pacchettoRegistro(registro) {
  const base = campiConfermaRiga(registro || {});
  base.principioAttivo = registro && registro.principioAttivo ? String(registro.principioAttivo) : null;
  base.titolare = registro && registro.titolare ? String(registro.titolare) : null;
  base.statoAmministrativoScheda = registro && registro.statoAmministrativoScheda
    ? String(registro.statoAmministrativoScheda)
    : null;
  base.dataVariazioneScheda = registro && registro.dataVariazioneScheda ? String(registro.dataVariazioneScheda) : null;
  base.dataScadenzaAutorizzazioneScheda = registro && registro.dataScadenzaAutorizzazioneScheda
    ? String(registro.dataScadenzaAutorizzazioneScheda)
    : null;
  base.fonteScheda = registro && registro.fonteScheda ? String(registro.fonteScheda) : null;
  base.dataLetturaScheda = registro && registro.dataLetturaScheda ? registro.dataLetturaScheda : null;
  return base;
}

export function serializzaRegistroRiga(registro) {
  return encodeURIComponent(JSON.stringify(pacchettoRegistro(registro)));
}

export function leggiRegistroRiga(tr) {
  const vuoto = pacchettoRegistro({});
  const input = tr && tr.querySelector ? tr.querySelector('.registro-json') : null;
  if (!input || !input.value) return vuoto;
  try {
    return pacchettoRegistro(JSON.parse(decodeURIComponent(input.value)));
  } catch (e) {
    return vuoto;
  }
}

export function htmlMetaRegistro(registro) {
  const r = campiConfermaRiga(registro || {});
  const stato = rigaHaConferma(r)
    ? 'Confermato' + (r.avversita ? ': ' + r.avversita : '')
    : 'Conferma dell\'azienda mancante';
  return '<div class="registro-riga-meta" style="margin-top:4px;font-size:12px;color:#555;">'
    + esc(stato)
    + '<input type="hidden" class="registro-json" value="' + serializzaRegistroRiga(registro) + '">'
    + '<div><button type="button" class="btn btn-sm btn-secondary btn-leggi-scheda">Leggi scheda</button></div>'
    + '</div>';
}

export function bindAcquaCampi() {
  const perHa = document.getElementById('trattamento-acqua-hl-ha');
  const tot = document.getElementById('trattamento-acqua-hl-tot');
  const superficie = document.getElementById('trattamento-superficie');
  if (!perHa || !tot || perHa.dataset.registroBound === '1') return;
  perHa.dataset.registroBound = '1';
  const ricalcola = (sorgente) => {
    const ha = parseFloat(superficie && superficie.value);
    const acqua = calcolaAcqua({
      ettari: ha,
      ettolitriPerEttaro: sorgente === 'tot' ? null : perHa.value,
      ettolitriTotali: sorgente === 'ha' ? null : tot.value
    });
    if (sorgente !== 'ha' && acqua.ettolitriPerEttaro != null && document.activeElement !== perHa) {
      perHa.value = valoreInputNumerico(acqua.ettolitriPerEttaro);
    }
    if (sorgente !== 'tot' && acqua.ettolitriTotali != null && document.activeElement !== tot) {
      tot.value = valoreInputNumerico(acqua.ettolitriTotali);
    }
  };
  perHa.addEventListener('input', () => ricalcola('ha'));
  tot.addEventListener('input', () => ricalcola('tot'));
  if (superficie) superficie.addEventListener('input', () => ricalcola('ha'));
}

export function scriviAcquaNelForm(trattamento) {
  const perHa = document.getElementById('trattamento-acqua-hl-ha');
  const tot = document.getElementById('trattamento-acqua-hl-tot');
  if (perHa) perHa.value = valoreInputNumerico(trattamento && trattamento.acquaEttolitriPerEttaro);
  if (tot) tot.value = valoreInputNumerico(trattamento && trattamento.acquaEttolitriTotali);
}

export function leggiAcquaDalForm() {
  const ha = parseFloat(document.getElementById('trattamento-superficie')?.value);
  return calcolaAcqua({
    ettari: ha,
    ettolitriPerEttaro: document.getElementById('trattamento-acqua-hl-ha')?.value,
    ettolitriTotali: document.getElementById('trattamento-acqua-hl-tot')?.value
  });
}

export function scriviEsitoScheda(html) {
  const el = document.getElementById('registro-scheda-esito');
  if (!el) return;
  el.innerHTML = html || '';
}

function dataUtile(value) {
  const t = String(value == null ? '' : value).trim();
  if (!t || t === '-' || t === '—') return '';
  return t;
}

function dataRevocaOScadenza(prodotto) {
  const cls = classificaStatoAmministrativo(prodotto && prodotto.stato);
  if (cls === 'scaduto') return dataUtile(prodotto.dataScadenzaAutorizzazione);
  if (cls === 'revocato' || cls === 'sospeso') {
    return dataUtile(prodotto.dataDecorrenzaRevoca) || dataUtile(prodotto.dataDecretoRevoca);
  }
  return '';
}

function prodottoBloccato(prodotto) {
  const cls = classificaStatoAmministrativo(prodotto && prodotto.stato);
  return cls === 'revocato' || cls === 'scaduto' || cls === 'sospeso';
}

function etichettaStato(cls) {
  if (cls === 'revocato') return 'Revocato';
  if (cls === 'scaduto') return 'Scaduto';
  if (cls === 'sospeso') return 'Sospeso';
  return '';
}

function dataAziendaItaliana(iso) {
  const d = new Date(iso || '');
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(d);
}

function valoreCampo(value) {
  if (value == null || value === '') return '';
  return esc(value);
}

function rigaAnagrafica(prodotto) {
  const parti = [
    prodotto.denominazione || '',
    prodotto.numeroRegistrazione ? 'n. ' + prodotto.numeroRegistrazione : '',
    prodotto.titolare ? 'titolare ' + prodotto.titolare : '',
    prodotto.principioAttivo ? 'sostanze ' + prodotto.principioAttivo : '',
    prodotto.stato ? 'stato ' + prodotto.stato : ''
  ];
  const scad = dataUtile(prodotto.dataScadenzaAutorizzazione);
  if (scad && classificaStatoAmministrativo(prodotto.stato) === 'autorizzato') {
    parti.push('scadenza autorizzazione ' + scad);
  }
  return '<p>' + esc(parti.filter(Boolean).join(' — ')) + '</p>';
}

function segnapostoConformita(campo) {
  return '<span class="registro-conformita-campo" data-campo="' + campo + '"></span>';
}

function campiManuali(conferma, specie) {
  const c = conferma || {};
  const coltura = (c.riferimentoRiga && c.riferimentoRiga.colturaScheda) || c.specieUsata || specie || '';
  return '<div class="registro-campi-azienda" style="margin-top:8px;">'
    + '<p>Coltura, avversità, dose e carenza le inserisce l\'azienda. Non arrivano dal Ministero.</p>'
    + '<label>Coltura <input class="registro-coltura" type="text" value="' + valoreCampo(coltura) + '"></label> '
    + '<label>Avversità <input class="registro-avversita" type="text" value="' + valoreCampo(c.avversita) + '"></label> '
    + '<label>Dose per ha ' + segnapostoConformita('doseHa') + '<input class="registro-dose-ha" type="text" inputmode="decimal" value="' + valoreCampo(c.dosePerEttaroScheda) + '"></label> '
    + '<label>Dose per hl ' + segnapostoConformita('doseHl') + '<input class="registro-dose-hl" type="text" inputmode="decimal" value="' + valoreCampo(c.dosePerEttolitroScheda) + '"></label> '
    + '<label>Carenza (giorni) ' + segnapostoConformita('carenza') + '<input class="registro-carenza" type="text" inputmode="numeric" value="' + valoreCampo(testoCarenzaSalvata(c)) + '"></label> '
    + '<label>Numero massimo ' + segnapostoConformita('massimo') + '<input class="registro-massimo" type="text" inputmode="numeric" value="' + valoreCampo(c.impieghiMassimiAnno) + '"></label> '
    + '<label>Intervallo (giorni) ' + segnapostoConformita('intervallo') + '<input class="registro-intervallo" type="text" inputmode="numeric" value="' + valoreCampo(c.giorniMinimiTraPassaggi) + '"></label>'
    + '</div>';
}

function testoCarenzaSalvata(conferma) {
  if (conferma && conferma.carenzaNonNecessaria === true) return 'non necessaria';
  if (!conferma || conferma.giorniCarenzaConfermata == null || conferma.giorniCarenzaConfermata === '') return '';
  return conferma.giorniCarenzaConfermata;
}

const STILE_VALORE_ETICHETTA = 'background:#fff3cd;border:1px solid #b8860b;';

function numeroPerConsulta(etichetta, prodotto) {
  const dalProdotto = prodotto && prodotto.numeroRegistrazione;
  const dallaScheda = etichetta && etichetta.meta && etichetta.meta.numeroRegistrazione;
  return dalProdotto || dallaScheda || '';
}

function htmlConsultaEtichetta(etichetta, prodotto) {
  const testo = testoConsultaEtichetta(numeroPerConsulta(etichetta, prodotto));
  if (!testo) return '';
  return '<p class="registro-consulta-etichetta">' + esc(testo) + '</p>';
}

function htmlMessaggioEtichetta(etichetta, prodotto) {
  const msg = String(etichetta && etichetta.messaggio || '');
  if (!msg) return htmlConsultaEtichetta(etichetta, prodotto);
  return '<p>' + esc(msg) + '</p>' + htmlConsultaEtichetta(etichetta, prodotto);
}

function attrsVoce(voce) {
  if (!voce) return '';
  const parti = [
    ' data-origine="etichetta"',
    ' data-valore-etichetta="' + valoreCampo(voce.valore) + '"'
  ];
  if (voce.pagina != null) parti.push(' data-pagina="' + esc(voce.pagina) + '"');
  if (voce.idRiga) parti.push(' data-id-riga="' + esc(voce.idRiga) + '"');
  if (voce.unita) parti.push(' data-unita="' + esc(voce.unita) + '"');
  if (voce.condizione) parti.push(' data-condizione="' + esc(voce.condizione) + '"');
  if (voce.epoca) parti.push(' data-epoca="' + esc(voce.epoca) + '"');
  if (voce.periodo) parti.push(' data-periodo="' + esc(voce.periodo) + '"');
  if (voce.nonNecessario) parti.push(' data-non-necessario="1"');
  return parti.join('');
}

function htmlFonteEtichetta(voce) {
  if (!voce) return '';
  const pag = voce.pagina != null ? 'da etichetta, pag. ' + voce.pagina : 'da etichetta';
  let html = '<span class="registro-blocco-fonte">';
  html += '<span class="registro-fonte-etichetta"> ' + esc(pag);
  if (voce.citazione) {
    html += ' <button type="button" class="btn btn-sm btn-secondary" data-mostra-frase="1">mostra frase</button>';
  }
  html += '</span>';
  if (voce.citazione) {
    html += '<span class="registro-citazione" hidden>«' + esc(voce.citazione) + '»</span>';
  }
  html += '</span>';
  return html;
}

function htmlVociEtichetta(campo) {
  if (!campo || !campo.voci || !campo.voci.length) return '';
  const mostra = campo.voci.length > 1 || campo.dettaglioSempre || !campo.voceScritta;
  if (!mostra) return '';
  const invito = campo.voci.length > 1
    ? '<p class="registro-scegli-voce" style="margin:4px 0;">Scegli la riga che vale per il tuo caso</p>'
    : '';
  return invito + '<ul class="registro-voci-etichetta" style="margin:4px 0 8px;padding-left:18px;">'
    + campo.voci.map((voce) => '<li><button type="button" class="registro-voce-etichetta" data-campo="'
      + esc(voce.campo) + '"' + attrsVoce(voce) + '>' + esc(voce.testo) + '</button>'
      + htmlFonteEtichetta(voce) + '</li>').join('')
    + '</ul>';
}

function valoreProposto(campo, salvato) {
  if (salvato != null && salvato !== '') return { valore: salvato, voce: null };
  if (campo && campo.scrivi) return { valore: campo.scrivi, voce: campo.voceScritta };
  return { valore: '', voce: null };
}

function htmlInputValore(classe, valore, inputmode, voce) {
  const stile = voce ? ' style="' + STILE_VALORE_ETICHETTA + '" class="' + classe + ' registro-valore-da-etichetta"' : ' class="' + classe + '"';
  return '<input' + stile + ' type="text" inputmode="' + inputmode + '" value="'
    + valoreCampo(valore) + '"' + (voce ? attrsVoce(voce) : '') + '>';
}

function htmlUnita(campo, voce) {
  const unita = (voce && voce.unita) || (campo && campo.unita) || '';
  if (!unita || unita === 'giorni') return '';
  return ' <span class="registro-unita-etichetta">' + esc(unita) + '</span>';
}

function htmlAvversitaEtichetta(etichetta, conferma) {
  const c = conferma || {};
  if (!etichetta || etichetta.stato !== 'pronto' || !etichetta.avversita || !etichetta.avversita.length) {
    return '<label>Avversità <input class="registro-avversita" type="text" value="' + valoreCampo(c.avversita) + '"></label> ';
  }
  const scelta = etichetta.avversitaScelta;
  const altra = scelta === 'altra';
  let html = '<label>Avversità <select class="registro-avversita-scelta">';
  if (etichetta.avversita.length > 1) {
    html += '<option value=""' + (!scelta ? ' selected' : '') + '>Scegli…</option>';
  }
  etichetta.avversita.forEach((a) => {
    html += '<option value="' + esc(a.chiave) + '"'
      + (a.idRiga ? ' data-id-riga="' + esc(a.idRiga) + '"' : '')
      + (scelta === a.chiave ? ' selected' : '') + '>' + esc(a.testo) + '</option>';
  });
  html += '<option value="altra"' + (altra ? ' selected' : '') + '>Altra…</option></select></label> ';
  html += '<input class="registro-avversita" type="text" value="' + valoreCampo(altra ? c.avversita : '') + '"'
    + (altra ? '' : ' hidden') + '> ';
  return html;
}

function valoriRiempitiDaEtichetta(etichetta, conferma) {
  const campi = etichetta && etichetta.campi;
  if (campi && ['doseHa', 'doseHl', 'carenza', 'massimo', 'intervallo'].some((k) => campi[k] && String(campi[k].scrivi || '').trim())) {
    return true;
  }
  const origine = conferma && conferma.origineValori;
  if (!origine) return false;
  return ['doseHa', 'doseHl', 'carenza', 'massimo', 'intervallo'].some((k) => origine[k] && origine[k].origine === 'etichetta');
}

function htmlDicituraEtichetta(etichetta) {
  const meta = (etichetta && etichetta.meta) || {};
  const pezzi = [];
  if (meta.fonte) pezzi.push(meta.fonte);
  if (meta.titolare) pezzi.push('titolare ' + meta.titolare);
  if (meta.dataEtichetta) pezzi.push('etichetta del ' + meta.dataEtichetta);
  if (meta.dataEstrazione) pezzi.push('estratto il ' + dataItalianaVisibile(meta.dataEstrazione));
  pezzi.push(FRASE_VALORE_ESTRATTO);
  return '<p class="registro-dicitura-etichetta">' + esc(pezzi.join(' · ')) + '</p>';
}

function campiConEtichetta(conferma, specie, etichetta, colturaBozza, prodotto) {
  const c = conferma || {};
  const coltura = colturaBozza != null
    ? colturaBozza
    : ((c.riferimentoRiga && c.riferimentoRiga.colturaScheda) || c.specieUsata || specie || '');
  const pronto = etichetta && etichetta.stato === 'pronto';
  const campi = (pronto && etichetta.campi) || {};
  const origine = (c.origineValori) || {};
  const doseHa = valoreProposto(campi.doseHa, c.dosePerEttaroScheda);
  const doseHl = valoreProposto(campi.doseHl, c.dosePerEttolitroScheda);
  const carenzaSalvata = testoCarenzaSalvata(c);
  const carenza = valoreProposto(campi.carenza, carenzaSalvata);
  const massimo = valoreProposto(campi.massimo, c.impieghiMassimiAnno);
  const intervallo = valoreProposto(campi.intervallo, c.giorniMinimiTraPassaggi);
  const voceSeNuova = (proposto, chiave) => {
    if (proposto.voce) return proposto.voce;
    const salvata = origine[chiave];
    if (!salvata || salvata.origine !== 'etichetta') return null;
    return {
      valore: proposto.valore,
      pagina: salvata.pagina,
      idRiga: salvata.idRiga,
      unita: salvata.unita,
      condizione: salvata.condizione,
      epoca: salvata.epoca,
      periodo: salvata.periodo,
      nonNecessario: salvata.nonNecessario,
      citazione: ''
    };
  };
  const riempiti = valoriRiempitiDaEtichetta(etichetta, c);
  const intro = pronto
    ? '<p>' + esc(TESTO_VALORI_ETICHETTA) + '</p>' + htmlConsultaEtichetta(etichetta, prodotto)
    : '<p>Coltura, avversità, dose e carenza le inserisce l\'azienda. Non arrivano dal Ministero.</p>'
      + htmlMessaggioEtichetta(etichetta, prodotto);
  const dataEtichetta = etichetta && etichetta.meta && etichetta.meta.dataEtichetta
    ? ' data-data-etichetta="' + esc(etichetta.meta.dataEtichetta) + '"'
    : '';
  return '<div class="registro-campi-azienda" style="margin-top:8px;"' + dataEtichetta + '>'
    + intro
    + '<label>Coltura <input class="registro-coltura" type="text" value="' + valoreCampo(coltura) + '"></label> '
    + htmlAvversitaEtichetta(etichetta, c)
    + '<label>Dose per ha ' + segnapostoConformita('doseHa') + htmlInputValore('registro-dose-ha', doseHa.valore, 'decimal', voceSeNuova(doseHa, 'doseHa'))
    + htmlUnita(campi.doseHa, doseHa.voce) + '</label>'
    + htmlFonteEtichetta(doseHa.voce)
    + htmlVociEtichetta(campi.doseHa)
    + '<label>Dose per hl ' + segnapostoConformita('doseHl') + htmlInputValore('registro-dose-hl', doseHl.valore, 'decimal', voceSeNuova(doseHl, 'doseHl'))
    + htmlUnita(campi.doseHl, doseHl.voce) + '</label>'
    + htmlFonteEtichetta(doseHl.voce)
    + htmlVociEtichetta(campi.doseHl)
    + '<label>Carenza (giorni) ' + segnapostoConformita('carenza') + htmlInputValore('registro-carenza', carenza.valore, 'text', voceSeNuova(carenza, 'carenza')) + '</label>'
    + htmlFonteEtichetta(carenza.voce)
    + htmlVociEtichetta(campi.carenza)
    + '<label>Numero massimo ' + segnapostoConformita('massimo') + htmlInputValore('registro-massimo', massimo.valore, 'text', voceSeNuova(massimo, 'massimo')) + '</label>'
    + htmlFonteEtichetta(massimo.voce)
    + htmlVociEtichetta(campi.massimo)
    + '<label>Intervallo (giorni) ' + segnapostoConformita('intervallo') + htmlInputValore('registro-intervallo', intervallo.valore, 'text', voceSeNuova(intervallo, 'intervallo')) + '</label>'
    + htmlFonteEtichetta(intervallo.voce)
    + htmlVociEtichetta(campi.intervallo)
    + (riempiti ? htmlDicituraEtichetta(etichetta) : '')
    + '</div>';
}

/**
 * HTML dell'esito di «Leggi scheda». Le righe di impiego, se arrivano, si ignorano.
 * @param {{ esito?: object, nome?: string, specie?: string, conferma?: object, indiceScelto?: number|null }} input
 */
export function htmlPannelloOpenData(input = {}) {
  const esito = input.esito || {};
  const prodotti = Array.isArray(esito.prodotti) ? esito.prodotti : [];
  const dataLettura = esito.dataLettura || null;
  const parti = [
    '<p class="registro-avviso-etichetta">' + esc(AVVISO_ETICHETTA_FA_FEDE) + '</p>',
    '<div data-conformita-slot="1"></div>'
  ];
  if (!prodotti.length) {
    parti.push('<p>Non trovo «' + esc(input.nome || 'questo prodotto') + '» negli open data del Ministero. Non invento numero, titolare, sostanze o stato.</p>');
    parti.push('<p><a href="' + URL_BANCA_FITOSANITARI + '" target="_blank" rel="noopener noreferrer">Apri la banca dati fitosanitari del Ministero</a></p>');
    parti.push('<p><label>Numero di registrazione <input class="registro-numero-manuale" type="text" inputmode="numeric" autocomplete="off" placeholder="es. 16273"></label> ');
    parti.push('<button type="button" class="btn btn-sm btn-secondary" data-riprova-numero="1">Cerca per numero</button></p>');
    return parti.join('');
  }
  parti.push('<p class="registro-attribuzione">' + htmlAttribuzioneOpenData(dataLettura) + '</p>');
  const scelto = input.indiceScelto == null ? (prodotti.length === 1 ? prodotti[0] : null) : prodotti[input.indiceScelto];
  if (!scelto) {
    const proposto = esito.proposto && esito.proposto.numeroRegistrazione;
    parti.push('<p>Ci sono più prodotti. Scegli quello giusto: non ne scelgo uno da solo.</p><ul style="list-style:none;padding:0;">');
    prodotti.forEach((prodotto, i) => {
      const cls = classificaStatoAmministrativo(prodotto.stato);
      const nota = [];
      if (proposto && prodotto.numeroRegistrazione === proposto) nota.push('Proposta: ancora in commercio');
      if (cls === 'revocato' || cls === 'scaduto' || cls === 'sospeso') {
        const quando = dataRevocaOScadenza(prodotto);
        nota.push(etichettaStato(cls) + (quando ? ' ' + quando : ''));
      } else if (prodotto.stato) nota.push(prodotto.stato);
      parti.push('<li style="margin:6px 0;"><button type="button" class="btn btn-sm btn-secondary" data-scegli-prodotto="' + i + '">Scegli</button> '
        + esc([prodotto.denominazione, prodotto.numeroRegistrazione ? 'n. ' + prodotto.numeroRegistrazione : '', prodotto.titolare || ''].filter(Boolean).join(' — '))
        + (nota.length ? ' — ' + esc(nota.join(' — ')) : '')
        + '</li>');
    });
    parti.push('</ul>');
    return parti.join('');
  }
  parti.push(rigaAnagrafica(scelto));
  if (prodottoBloccato(scelto)) {
    parti.push('<p>Non propongo dose, carenza né avversità.</p>');
    parti.push('<p><button type="button" class="btn btn-sm btn-primary" data-conferma-bloccata="1">Conferma</button></p>');
    return parti.join('');
  }
  if (input.conferma && (input.conferma.confermatoIl || input.conferma.avversita)) {
    const quando = dataAziendaItaliana(input.conferma.confermatoIl);
    parti.push('<p class="registro-conferma-azienda">Inserita dalla tua azienda'
      + (quando ? ' il ' + esc(quando) : '')
      + '. Non è un dato del Ministero.</p>');
  }
  parti.push(input.etichetta
    ? campiConEtichetta(input.conferma, input.specie, input.etichetta, input.colturaBozza, scelto)
    : campiManuali(input.conferma, input.specie));
  const dichiarazione = input.etichetta && valoriRiempitiDaEtichetta(input.etichetta, input.conferma)
    ? ' <span class="registro-dichiarazione-conferma">' + esc(FRASE_CONFERMA_CONTROLLATA) + '</span>'
    : '';
  parti.push('<p><button type="button" class="btn btn-sm btn-primary" data-conferma-manuale="1">Conferma</button>' + dichiarazione + '</p>');
  return parti.join('');
}

function anagraficaRegistro(prodotto, meta) {
  return {
    principioAttivo: prodotto && prodotto.principioAttivo ? String(prodotto.principioAttivo) : null,
    titolare: prodotto && prodotto.titolare ? String(prodotto.titolare) : null,
    statoAmministrativoScheda: prodotto && prodotto.stato ? String(prodotto.stato) : null,
    dataScadenzaAutorizzazioneScheda: dataUtile(prodotto && prodotto.dataScadenzaAutorizzazione) || null,
    dataVariazioneScheda: dataUtile(prodotto && prodotto.dataDecorrenzaRevoca)
      || dataUtile(prodotto && prodotto.dataDecretoRevoca)
      || dataUtile(prodotto && prodotto.dataScadenzaAutorizzazione)
      || null,
    fonteScheda: (meta && meta.fonte) || FONTE_OPEN_DATA_FITOSANITARI,
    dataLetturaScheda: meta && meta.dataLettura ? meta.dataLettura : null
  };
}

/** Conferma di un revocato, scaduto o sospeso: solo anagrafica, nessuna dose. */
export function registroConfermaBloccata(prodotto, meta = {}) {
  return {
    ...anagraficaRegistro(prodotto, meta),
    riferimentoRiga: {
      nomeProdotto: (prodotto && prodotto.denominazione) || '',
      numeroRegistrazione: (prodotto && prodotto.numeroRegistrazione) || '',
      colturaScheda: ''
    },
    confermatoDa: meta.utente || null,
    confermatoIl: meta.ora || new Date().toISOString()
  };
}

/** Conferma con i valori scritti dall'azienda, o copiati dall'etichetta e poi confermati. */
export function registroConfermaManuale(prodotto, campi = {}, meta = {}) {
  const specie = campi.coltura || meta.specie || '';
  const carenzaTesto = String(campi.carenza == null ? '' : campi.carenza).trim();
  const origineCarenza = campi.origineValori && campi.origineValori.carenza;
  const carenzaNonNecessaria = /^non\s+necessar/i.test(carenzaTesto)
    || !!(origineCarenza && origineCarenza.nonNecessario === true);
  const doseHa = numeroSingoloTesto(campi.doseHa);
  const registro = {
    ...campiConfermaRiga({
      avversita: campi.avversita,
      specieUsata: specie,
      riferimentoRiga: {
        nomeProdotto: (prodotto && prodotto.denominazione) || meta.nome || '',
        numeroRegistrazione: (prodotto && prodotto.numeroRegistrazione) || '',
        colturaScheda: specie
      },
      confermatoDa: meta.utente || null,
      confermatoIl: meta.ora || new Date().toISOString(),
      impieghiMassimiAnno: numeroSingoloTesto(campi.massimo),
      giorniMinimiTraPassaggi: numeroSingoloTesto(campi.intervallo),
      dosePerEttaroScheda: doseHa,
      dosePerEttolitroScheda: numeroSingoloTesto(campi.doseHl),
      giorniCarenzaConfermata: carenzaNonNecessaria ? null : numeroSingoloTesto(carenzaTesto),
      carenzaNonNecessaria: carenzaNonNecessaria || null,
      doseMinHa: campi.doseMinHa,
      doseMaxHa: campi.doseMaxHa,
      unitaDose: campi.unitaDose,
      origineValori: campi.origineValori || null
    }),
    ...anagraficaRegistro(prodotto, meta)
  };
  if (doseHa != null) registro.dosaggio = doseHa;
  return registro;
}

function origineDaInput(el) {
  if (!el) return null;
  const scritto = String(el.value || '').trim();
  const atteso = el.getAttribute('data-valore-etichetta');
  const origineEtichetta = el.getAttribute('data-origine') === 'etichetta';
  const nonNecessario = origineEtichetta
    && el.getAttribute('data-non-necessario') === '1'
    && (scritto === '' || /^non\s+necessar/i.test(scritto));
  if (!scritto && !nonNecessario) return null;
  const daEtichetta = nonNecessario || (origineEtichetta && atteso != null && scritto === atteso);
  const voce = { origine: daEtichetta ? 'etichetta' : 'azienda' };
  if (!daEtichetta) return voce;
  const pagina = el.getAttribute('data-pagina');
  if (pagina) voce.pagina = Number(pagina);
  const idRiga = el.getAttribute('data-id-riga');
  if (idRiga) voce.idRiga = idRiga;
  ['unita', 'condizione', 'epoca', 'periodo'].forEach((chiave) => {
    const v = el.getAttribute('data-' + chiave);
    if (v) voce[chiave] = v;
  });
  if (el.getAttribute('data-non-necessario') === '1') voce.nonNecessario = true;
  if (scritto && numeroSingoloTesto(scritto) == null) voce.testo = scritto;
  return voce;
}

export function leggiCampiAzienda(box) {
  const valore = (sel) => {
    const el = box.querySelector(sel);
    return el ? el.value : '';
  };
  const select = box.querySelector('.registro-avversita-scelta');
  let avversita = valore('.registro-avversita');
  const origineValori = {};
  if (select && select.value && select.value !== 'altra') {
    const opt = select.selectedOptions && select.selectedOptions[0];
    avversita = opt ? String(opt.textContent || '').trim() : avversita;
    origineValori.avversita = { origine: 'etichetta' };
    const idRiga = opt && opt.getAttribute('data-id-riga');
    if (idRiga) origineValori.avversita.idRiga = idRiga;
  } else   if (String(avversita).trim()) {
    origineValori.avversita = { origine: 'azienda' };
  }
  const dataEtichetta = box.querySelector('.registro-campi-azienda')
    && box.querySelector('.registro-campi-azienda').getAttribute('data-data-etichetta');
  if (dataEtichetta) origineValori.dataEtichetta = dataEtichetta;
  [
    ['doseHa', '.registro-dose-ha'],
    ['doseHl', '.registro-dose-hl'],
    ['carenza', '.registro-carenza'],
    ['massimo', '.registro-massimo'],
    ['intervallo', '.registro-intervallo']
  ].forEach(([chiave, sel]) => {
    const voce = origineDaInput(box.querySelector(sel));
    if (voce) origineValori[chiave] = voce;
  });
  return {
    coltura: valore('.registro-coltura'),
    avversita,
    doseHa: valore('.registro-dose-ha'),
    doseHl: valore('.registro-dose-hl'),
    carenza: valore('.registro-carenza'),
    massimo: valore('.registro-massimo'),
    intervallo: valore('.registro-intervallo'),
    origineValori
  };
}

function copiaAttributiVoce(da, a) {
  ['data-pagina', 'data-id-riga', 'data-unita', 'data-condizione', 'data-epoca', 'data-periodo', 'data-non-necessario'].forEach((nome) => {
    const v = da.getAttribute(nome);
    if (v) a.setAttribute(nome, v);
    else a.removeAttribute(nome);
  });
}

const MAPPA_CAMPO_INPUT = {
  doseHa: '.registro-dose-ha',
  doseHl: '.registro-dose-hl',
  carenza: '.registro-carenza',
  massimo: '.registro-massimo',
  intervallo: '.registro-intervallo'
};

function valoreVoceScelta(bottone) {
  if (bottone.getAttribute('data-non-necessario') === '1') return '';
  const valore = bottone.getAttribute('data-valore-etichetta');
  return valore == null ? '' : valore;
}

function testoFonteCampo(bottone) {
  if (bottone.getAttribute('data-non-necessario') === '1') return 'non necessaria, da etichetta';
  const pagina = bottone.getAttribute('data-pagina');
  return pagina ? 'da etichetta, pag. ' + pagina : 'da etichetta';
}

function aggiornaFonteCampo(input, bottone) {
  const label = input.closest('label');
  if (!label) return;
  let blocco = label.nextElementSibling;
  const gia = blocco && (
    blocco.classList.contains('registro-blocco-fonte') || blocco.classList.contains('registro-fonte-etichetta')
  );
  if (!gia) {
    blocco = document.createElement('span');
    blocco.className = 'registro-blocco-fonte';
    const riga = document.createElement('span');
    riga.className = 'registro-fonte-etichetta';
    blocco.appendChild(riga);
    label.insertAdjacentElement('afterend', blocco);
  }
  const riga = blocco.classList.contains('registro-fonte-etichetta')
    ? blocco
    : blocco.querySelector('.registro-fonte-etichetta');
  if (!riga) return;
  const pulsante = riga.querySelector('[data-mostra-frase]');
  riga.textContent = ' ' + testoFonteCampo(bottone);
  if (pulsante) {
    riga.appendChild(document.createTextNode(' '));
    riga.appendChild(pulsante);
  }
}

function segnaVoceScelta(bottone) {
  const lista = bottone.closest('.registro-voci-etichetta');
  const gruppo = lista ? lista.querySelectorAll('.registro-voce-etichetta') : [bottone];
  gruppo.forEach((altro) => {
    altro.classList.remove('registro-voce-selezionata');
    altro.removeAttribute('aria-pressed');
    altro.style.fontWeight = '';
    altro.style.outline = '';
    altro.style.background = '';
  });
  bottone.classList.add('registro-voce-selezionata');
  bottone.setAttribute('aria-pressed', 'true');
  bottone.style.fontWeight = '700';
  bottone.style.outline = '2px solid #b8860b';
  bottone.style.background = '#fff3cd';
}

function assicuratiDicitura(box, etichetta) {
  if (!box.querySelector('.registro-dichiarazione-conferma')) {
    const btn = box.querySelector('[data-conferma-manuale]');
    if (btn) {
      const span = document.createElement('span');
      span.className = 'registro-dichiarazione-conferma';
      span.textContent = ' ' + FRASE_CONFERMA_CONTROLLATA;
      btn.insertAdjacentElement('afterend', span);
    }
  }
  if (!box.querySelector('.registro-dicitura-etichetta') && etichetta && etichetta.meta) {
    const intro = box.querySelector('.registro-campi-azienda');
    if (intro) {
      const p = document.createElement('p');
      p.className = 'registro-dicitura-etichetta';
      const meta = etichetta.meta;
      const pezzi = [];
      if (meta.fonte) pezzi.push(meta.fonte);
      if (meta.titolare) pezzi.push('titolare ' + meta.titolare);
      if (meta.dataEtichetta) pezzi.push('etichetta del ' + meta.dataEtichetta);
      if (meta.dataEstrazione) pezzi.push('estratto il ' + dataItalianaVisibile(meta.dataEstrazione));
      pezzi.push(FRASE_VALORE_ESTRATTO);
      p.textContent = pezzi.join(' · ');
      intro.insertBefore(p, intro.querySelector('label'));
    }
  }
}

function applicaVoceEtichetta(box, bottone, etichetta) {
  const input = box.querySelector(MAPPA_CAMPO_INPUT[bottone.getAttribute('data-campo')] || '');
  if (!input) return;
  const valore = valoreVoceScelta(bottone);
  input.value = valore;
  input.setAttribute('data-origine', 'etichetta');
  input.setAttribute('data-valore-etichetta', valore);
  input.classList.add('registro-valore-da-etichetta');
  input.style.background = '#fff3cd';
  input.style.border = '1px solid #b8860b';
  copiaAttributiVoce(bottone, input);
  aggiornaFonteCampo(input, bottone);
  segnaVoceScelta(bottone);
  assicuratiDicitura(box, etichetta);
}

function toggleFraseEtichetta(bottone) {
  const blocco = bottone.closest('.registro-blocco-fonte') || bottone.parentElement;
  const span = blocco && blocco.querySelector('.registro-citazione');
  if (!span) return;
  const apri = !!span.hidden;
  span.hidden = !apri;
  span.style.display = apri ? 'block' : 'none';
  if (apri) span.style.fontStyle = 'italic';
  bottone.textContent = apri ? 'nascondi frase' : 'mostra frase';
}

/** Clic sulle voci d'etichetta e su «mostra frase». Stesso comportamento in ogni modulo. */
export function attaccaScelteEtichetta(box, etichetta) {
  if (!box) return;
  box.querySelectorAll('.registro-voce-etichetta').forEach((b) => {
    b.addEventListener('click', () => applicaVoceEtichetta(box, b, etichetta));
  });
  box.querySelectorAll('[data-mostra-frase]').forEach((b) => {
    b.addEventListener('click', () => toggleFraseEtichetta(b));
  });
}

let contestoBanner = null;
let ascoltoConformitaPronto = false;
let bannerSeq = 0;

const SELETTORI_BANNER = '.prodotto-dosaggio, .prodotto-nome-altro, .prodotto-select, .prodotto-unita-scelta, #trattamento-data, #trattamento-acqua-hl-ha, #trattamento-acqua-hl-tot, #trattamento-superficie, .registro-dose-ha, .registro-dose-hl, .registro-carenza, .registro-massimo, .registro-intervallo, .registro-coltura, .registro-avversita, .registro-avversita-scelta';

/**
 * Dopo la Conferma, la dose scritta sulla riga (o nel pannello, se è quella usata)
 * aggiorna dosePerEttaroScheda / dosePerEttolitroScheda. Avversità, numero e confermatoIl restano.
 */
export function sincronizzaDoseConfermata(tr, input = {}) {
  if (!tr || !tr.querySelector) return null;
  const registro = leggiRegistroRiga(tr);
  if (!rigaHaConferma(registro)) return registro;
  const next = {
    ...registro,
    origineValori: registro.origineValori ? { ...registro.origineValori } : {}
  };
  let changed = false;
  const applica = (chiaveScheda, chiaveOrig, valore, atteso) => {
    if (valore == null || valore === '') return;
    const n = numeroFinito(valore);
    if (n == null) return;
    if (numeroFinito(next[chiaveScheda]) === n) return;
    const origine = next.origineValori[chiaveOrig];
    const attesoN = numeroFinito(atteso);
    const restaEtichetta = attesoN != null && n === attesoN && origine && origine.origine === 'etichetta';
    next[chiaveScheda] = n;
    if (!restaEtichetta) next.origineValori[chiaveOrig] = { origine: 'azienda' };
    changed = true;
  };
  applica('dosePerEttaroScheda', 'doseHa', input.doseHa, input.valoreEtichettaHa);
  applica('dosePerEttolitroScheda', 'doseHl', input.doseHl, input.valoreEtichettaHl);
  if (!changed) return registro;
  if (!Object.keys(next.origineValori).length) next.origineValori = null;
  const hidden = tr.querySelector('.registro-json');
  if (hidden) hidden.value = serializzaRegistroRiga(next);
  return next;
}

function sincronizzaDoseDaEvento(el) {
  if (!el || !el.classList) return;
  if (el.classList.contains('prodotto-dosaggio')) {
    const tr = el.closest('tr');
    if (!tr) return;
    const box = document.getElementById('registro-scheda-esito');
    const campo = box && box.querySelector('.registro-dose-ha');
    sincronizzaDoseConfermata(tr, {
      doseHa: el.value,
      valoreEtichettaHa: campo ? campo.getAttribute('data-valore-etichetta') : null
    });
    return;
  }
  const box = el.closest && el.closest('#registro-scheda-esito');
  if (!box) return;
  const idx = box.getAttribute('data-riga-idx');
  if (idx == null) return;
  const tr = document.querySelector('#tbody-prodotti-trattamento tr[data-idx="' + idx + '"]');
  if (!tr) return;
  const doseRiga = tr.querySelector('.prodotto-dosaggio');
  const rigaVuota = !doseRiga || String(doseRiga.value) === '';
  if (el.classList.contains('registro-dose-ha') && rigaVuota) {
    sincronizzaDoseConfermata(tr, {
      doseHa: el.value,
      valoreEtichettaHa: el.getAttribute('data-valore-etichetta')
    });
  }
  if (el.classList.contains('registro-dose-hl')) {
    sincronizzaDoseConfermata(tr, {
      doseHl: el.value,
      valoreEtichettaHl: el.getAttribute('data-valore-etichetta')
    });
  }
}

function assicuraAscoltoConformita() {
  if (ascoltoConformitaPronto || typeof document === 'undefined') return;
  ascoltoConformitaPronto = true;
  const handler = (ev) => {
    const t = ev.target;
    if (!t || !t.matches || !t.matches(SELETTORI_BANNER)) return;
    sincronizzaDoseDaEvento(t);
    aggiornaBannerConformita();
  };
  document.addEventListener('input', handler);
  document.addEventListener('change', handler);
}

function unitaDaEtichetta(unita) {
  const u = String(unita || '').toLowerCase();
  if (u.startsWith('kg')) return 'kg';
  if (u.startsWith('ml')) return 'ml';
  if (u.startsWith('g')) return 'g';
  if (u.startsWith('l')) return 'l';
  return '';
}

function dipingiCampiConformita(box, esito) {
  if (!box || !esito) return;
  box.querySelectorAll('.registro-conformita-campo').forEach((el) => {
    el.innerHTML = htmlPallinoCampo(esito, el.getAttribute('data-campo'));
  });
}

export function leggiUnitaRigaDom(tr, unitaAnagrafica) {
  const scelta = tr && tr.querySelector ? tr.querySelector('.prodotto-unita-scelta') : null;
  if (scelta && !scelta.hidden && scelta.value) return String(scelta.value).trim();
  const daAnag = String(unitaAnagrafica || '').trim();
  if (daAnag && daAnag !== '-' && daAnag !== '—' && daAnag !== '–') return daAnag;
  const span = tr && tr.querySelector ? tr.querySelector('.prodotto-unita') : null;
  const testo = span ? String(span.textContent || '').trim() : '';
  if (testo && testo !== '-' && testo !== '—' && testo !== '–') return testo;
  const segnata = span && span.getAttribute('data-unita-etichetta');
  return segnata ? String(segnata).trim() : null;
}

function unitaBreveDaNota(testo) {
  const m = String(testo || '').match(/:\s*(kg|g|ml|l)\b/i);
  return m ? m[1].toLowerCase() : '';
}

function segnaNumeroLetto(tr, prodotto) {
  if (!tr || !prodotto) return;
  const registro = leggiRegistroRiga(tr);
  const numero = prodotto.numeroRegistrazione ? String(prodotto.numeroRegistrazione).trim() : '';
  if (numero) {
    registro.numeroRegistrazioneLetto = numero;
    const rif = registro.riferimentoRiga || {};
    if (!rif.numeroRegistrazione) {
      registro.riferimentoRiga = {
        nomeProdotto: rif.nomeProdotto || prodotto.denominazione || '',
        numeroRegistrazione: numero,
        colturaScheda: rif.colturaScheda || ''
      };
    }
  }
  if (prodotto.stato && !registro.statoAmministrativoScheda) {
    registro.statoAmministrativoScheda = String(prodotto.stato);
  }
  const quando = dataUtile(prodotto.dataDecorrenzaRevoca)
    || dataUtile(prodotto.dataDecretoRevoca)
    || dataUtile(prodotto.dataScadenzaAutorizzazione);
  if (quando && !registro.dataVariazioneScheda) registro.dataVariazioneScheda = quando;
  const input = tr.querySelector('.registro-json');
  if (input) input.value = serializzaRegistroRiga(registro);
}

function leggiRigheBanner(opts) {
  const tbody = document.getElementById('tbody-prodotti-trattamento');
  if (!tbody) return [];
  const box = document.getElementById('registro-scheda-esito');
  const attivo = box ? box.getAttribute('data-riga-idx') : null;
  return Array.from(tbody.querySelectorAll('tr[data-idx]')).map((tr) => {
    const idx = tr.getAttribute('data-idx');
    const sel = tr.querySelector('.prodotto-select');
    const prodottoId = sel && sel.value ? sel.value : null;
    const anag = opts.anagrafica && prodottoId ? opts.anagrafica(prodottoId) : null;
    const nomeAltro = tr.querySelector('.prodotto-nome-altro');
    const registro = leggiRegistroRiga(tr);
    const prodotto = prodottoId
      ? ((anag && (anag.nome || anag.codice)) || (registro.riferimentoRiga && registro.riferimentoRiga.nomeProdotto) || '')
      : ((nomeAltro && nomeAltro.value.trim()) || (registro.riferimentoRiga && registro.riferimentoRiga.nomeProdotto) || '');
    const doseInp = tr.querySelector('.prodotto-dosaggio');
    let dosaggio = doseInp && doseInp.value !== '' ? numeroFinito(doseInp.value) : null;
    let unita = leggiUnitaRigaDom(tr, anag && anag.unitaMisura);
    const usaPannello = box && attivo != null && String(attivo) === String(idx);
    const campi = usaPannello ? leggiCampiAzienda(box) : null;
    if (dosaggio == null && campi) dosaggio = numeroSingoloTesto(campi.doseHa);
    if (!unita && campi) {
      const campo = box.querySelector('.registro-dose-ha');
      unita = unitaDaEtichetta(campo && campo.getAttribute('data-unita')) || null;
    }
    return {
      tr,
      idx,
      prodottoId: prodottoId || null,
      prodotto,
      dosaggio,
      unitaDosaggio: unita || null,
      avversita: registro.avversita || (campi && campi.avversita) || '',
      confermaMancante: !!(usaPannello && campi && String(campi.avversita || '').trim() && !rigaHaConferma(registro)),
      specieUsata: (campi && campi.coltura) || registro.specieUsata || '',
      riferimentoRiga: registro.riferimentoRiga,
      numeroRegistrazioneLetto: registro.numeroRegistrazioneLetto || null,
      statoAmministrativoScheda: registro.statoAmministrativoScheda || (anag && anag.stato) || null,
      dataVariazioneScheda: registro.dataVariazioneScheda || null,
      dataScadenzaAutorizzazioneScheda: registro.dataScadenzaAutorizzazioneScheda || (anag && anag.dataScadenzaAutorizzazione) || null,
      dataDecorrenzaRevoca: (anag && anag.dataDecorrenzaRevoca) || null,
      origineValori: (campi && campi.origineValori) || registro.origineValori || null
    };
  });
}

function applicaUnitaSulDom(tr, esito) {
  if (!tr || !esito) return;
  const span = tr.querySelector('.prodotto-unita');
  const scelta = tr.querySelector('.prodotto-unita-scelta');
  const nota = (esito.motivi || []).find((m) => m && m.codice === 'unita_da_etichetta');
  if (nota && span) {
    const breve = unitaBreveDaNota(nota.testo);
    if (breve) {
      span.textContent = breve;
      span.setAttribute('data-unita-etichetta', breve);
    }
  }
  const manca = (esito.motivi || []).some((m) => m && m.codice === 'unita_mancante');
  if (!scelta) return;
  if (manca) {
    scelta.hidden = false;
    return;
  }
  if (scelta.value && span && (!span.textContent || span.textContent.trim() === '-' || span.textContent.trim() === '—')) {
    span.textContent = scelta.value;
    span.setAttribute('data-unita-etichetta', scelta.value);
  }
  scelta.hidden = true;
}

const MOTIVO_CONFERMA_AVVERSITA = "Conferma l'avversità";

function esitoConConfermaAperta(riga, esito) {
  if (!riga || !riga.confermaMancante) return esito;
  const base = esito || { colore: 'verde', motivi: [] };
  const motivi = (base.motivi || []).concat([{
    codice: 'conferma_avversita',
    colore: 'giallo',
    campo: 'avversita',
    testo: MOTIVO_CONFERMA_AVVERSITA
  }]);
  const colore = base.colore === 'verde' || !base.colore ? 'giallo' : base.colore;
  return { colore, motivi };
}

function fusoConConfermaAperta(fuso, righe) {
  const aperti = (righe || []).filter((riga) => riga && riga.confermaMancante);
  if (!aperti.length) return fuso;
  const base = fuso || { colore: 'verde', motivi: [] };
  const motivi = (base.motivi || []).slice();
  aperti.forEach((riga) => {
    const nome = String(riga.prodotto || '').trim();
    const testo = (righe.length > 1 && nome ? nome + ': ' : '') + MOTIVO_CONFERMA_AVVERSITA;
    motivi.push({
      codice: 'conferma_avversita',
      colore: 'giallo',
      campo: 'avversita',
      testo
    });
  });
  const colore = base.colore === 'verde' || !base.colore ? 'giallo' : base.colore;
  return { ...base, colore, motivi };
}

/**
 * Banner sopra i prodotti. Dose e unità dalla riga, acqua dal form.
 * Le pagine lo chiamano all'apertura e a ogni modifica.
 */
export async function aggiornaBannerConformita(extra) {
  const opts = Object.assign({}, contestoBanner || {}, extra || {});
  const banner = typeof document !== 'undefined' ? document.getElementById('registro-semaforo-banner') : null;
  if (!banner) return null;
  const seq = ++bannerSeq;
  try {
    const lette = leggiRigheBanner(opts);
    const utili = lette.filter((riga) => String(riga.prodotto || '').trim() || riga.dosaggio != null);
    if (!utili.length) {
      banner.hidden = true;
      banner.innerHTML = '';
      lette.forEach((riga) => {
        const pallino = riga.tr.querySelector('.registro-pallino-riga');
        if (pallino) pallino.innerHTML = '';
      });
      return null;
    }
    const anagraficaDi = (riga) => {
      if (opts.anagrafica && riga.prodottoId) {
        const anag = opts.anagrafica(riga.prodottoId);
        if (anag) return anag;
      }
      return riga;
    };
    const pacchetto = await caricaPacchettoPerRighe(utili, anagraficaDi);
    if (seq !== bannerSeq) return null;
    const acqua = leggiAcquaDalForm();
    const dataVal = document.getElementById('trattamento-data') && document.getElementById('trattamento-data').value;
    const idTrattamento = document.getElementById('trattamento-id') && document.getElementById('trattamento-id').value;
    const specie = opts.specie ? opts.specie() : '';
    const trattamento = {
      id: idTrattamento || null,
      data: dataVal || null,
      terrenoId: opts.terrenoId ? opts.terrenoId() : null,
      specieUsata: specie || '',
      acquaEttolitriPerEttaro: acqua.ettolitriPerEttaro
    };
    const legami = legamiScheda(pacchetto, anagraficaDi);
    const perRiga = utili.map((riga) => valutaConformitaEtichetta({
      trattamento,
      riga,
      scheda: legami.schedaPerRiga(riga),
      vocabolario: legami.vocabolario,
      statoProdotto: legami.statoPerRiga(riga),
      riconoscimento: legami.riconoscimentoPerRiga(riga),
      precedenti: opts.precedenti ? opts.precedenti() : [],
      dataRaccolta: opts.dataRaccolta ? opts.dataRaccolta(dataVal) : null,
      oggi: new Date()
    })).map((esito, i) => esitoConConfermaAperta(utili[i], esito));
    const fusoBase = valutaConformitaTrattamento({
      trattamento,
      righe: utili,
      vocabolario: legami.vocabolario,
      precedenti: opts.precedenti ? opts.precedenti() : [],
      dataRaccolta: opts.dataRaccolta ? opts.dataRaccolta(dataVal) : null,
      oggi: new Date(),
      ...legami
    });
    const fuso = fusoConConfermaAperta(fusoBase, utili);
    if (seq !== bannerSeq) return null;
    banner.hidden = false;
    banner.innerHTML = htmlBannerConformita(fuso);
    utili.forEach((riga, i) => {
      const esito = perRiga[i];
      const pallino = riga.tr.querySelector('.registro-pallino-riga');
      if (pallino) pallino.innerHTML = htmlSemaforoConformita(esito, { taglia: 'riga' });
      applicaUnitaSulDom(riga.tr, esito);
    });
    const box = document.getElementById('registro-scheda-esito');
    const attivo = box && box.getAttribute('data-riga-idx');
    if (box && attivo != null) {
      const trovato = utili.findIndex((riga) => String(riga.idx) === String(attivo));
      if (trovato >= 0) dipingiCampiConformita(box, perRiga[trovato]);
    }
    return fuso;
  } catch (e) {
    return null;
  }
}

export function collegaBannerConformita(ctx) {
  contestoBanner = ctx || {};
  assicuraAscoltoConformita();
  return aggiornaBannerConformita();
}

export function attaccaLetturaScheda(opts) {
  const tbody = opts && opts.tbody;
  if (!tbody) return;
  tbody.querySelectorAll('.btn-leggi-scheda').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const tr = btn.closest('tr');
      const idx = tr ? tr.getAttribute('data-idx') : null;
      const specie = opts.specie ? opts.specie() : null;
      const nome = opts.nomeProdotto ? opts.nomeProdotto(idx) : '';
      const anag = opts.prodotto ? opts.prodotto(idx) : null;
      if (!nome) {
        scriviEsitoScheda('<p>Indica prima il nome del prodotto.</p>');
        return;
      }
      const dallaRiga = leggiRegistroRiga(tr);
      const conferma = rigaHaConferma(dallaRiga) ? dallaRiga : confermaSpecieSalvata(anag, specie);
      const metaBaseDi = (esito) => ({
        fonte: esito.fonte || FONTE_OPEN_DATA_FITOSANITARI,
        dataLettura: esito.dataLettura || null,
        specie,
        nome,
        utente: opts.utente ? opts.utente() : ''
      });
      const esegui = async (richiesta) => {
        scriviEsitoScheda('<p>Cerco il prodotto negli open data del Ministero…</p>');
        let esito = { prodotti: [], righe: [] };
        try {
          if (opts.leggiScheda) esito = await opts.leggiScheda(richiesta) || esito;
        } catch (err) {
          scriviEsitoScheda('<p>Gli open data non si leggono. Non invento numero, titolare, sostanze, avversità, carenza, numero massimo né intervallo.</p>');
          return;
        }
        const prodotti = Array.isArray(esito.prodotti) ? esito.prodotti : [];
        const metaBase = metaBaseDi(esito);
      const applica = async (registro) => {
        if (opts.onConferma) opts.onConferma(idx, registro);
        if (opts.salvaSuProdotto && anag && anag.id) {
          try { await opts.salvaSuProdotto(anag, specie, registro); } catch (e) { /* la riga trattamento resta confermata in form */ }
        }
        const quando = dataLetturaItaliana(esito.dataLettura);
        scriviEsitoScheda('<p>Conferma dell\'azienda registrata'
          + (specie ? ' per ' + esc(specie) : '')
          + '. Si può salvare il trattamento.</p>'
          + '<p class="registro-avviso-etichetta">' + esc(AVVISO_ETICHETTA_FA_FEDE) + '</p>'
          + (quando ? '<p class="registro-attribuzione">' + htmlAttribuzioneOpenData(esito.dataLettura) + '</p>' : ''));
        aggiornaBannerConformita();
      };
      const disegna = async (indiceScelto, extra) => {
        const prodottoScelto = indiceScelto == null ? (prodotti.length === 1 ? prodotti[0] : null) : prodotti[indiceScelto];
        let etichetta = null;
        let scheda = null;
        let vocabolario = null;
        if (prodottoScelto && !prodottoBloccato(prodottoScelto)) {
          const colturaRichiesta = extra && extra.coltura != null
            ? extra.coltura
            : ((conferma && conferma.riferimentoRiga && conferma.riferimentoRiga.colturaScheda)
              || (conferma && conferma.specieUsata)
              || specie
              || '');
          try {
            scheda = await caricaSchedaEtichetta(prodottoScelto.numeroRegistrazione);
            if (scheda) vocabolario = await caricaVocabolarioColture();
          } catch (e) {
            scheda = null;
          }
          let avversitaScelta;
          if (extra && Object.prototype.hasOwnProperty.call(extra, 'avversitaScelta')) {
            avversitaScelta = extra.avversitaScelta;
          }
          const dataRevisione = dataRevisioneOpenData(prodottoScelto);
          etichetta = preparaEtichetta({
            scheda,
            coltura: colturaRichiesta,
            vocabolario,
            avversitaScelta,
            dataRevisione
          });
          const forzaScelta = extra && Object.prototype.hasOwnProperty.call(extra, 'avversitaScelta');
          const ignoraConferma = extra && extra.ignoraValoriConferma;
          if (!forzaScelta && !ignoraConferma && conferma && conferma.avversita && etichetta.stato === 'pronto') {
            const salvata = normalizzaNomeColtura(conferma.avversita);
            const trovata = (etichetta.avversita || []).find((a) => normalizzaNomeColtura(a.testo) === salvata);
            etichetta = preparaEtichetta({
              scheda,
              coltura: colturaRichiesta,
              vocabolario,
              avversitaScelta: trovata ? trovata.chiave : 'altra',
              dataRevisione
            });
          }
        }
        scriviEsitoScheda(htmlPannelloOpenData({
          esito,
          nome,
          specie,
          conferma: extra && extra.ignoraValoriConferma ? null : conferma,
          indiceScelto,
          etichetta,
          colturaBozza: extra && extra.coltura != null ? extra.coltura : undefined
        }));
        const box = document.getElementById('registro-scheda-esito');
        if (!box) return;
        if (idx != null) box.setAttribute('data-riga-idx', String(idx));
        if (prodottoScelto && tr) segnaNumeroLetto(tr, prodottoScelto);
        box.querySelectorAll('[data-scegli-prodotto]').forEach((b) => {
          b.addEventListener('click', () => disegna(Number(b.getAttribute('data-scegli-prodotto'))));
        });
        const sceltaAvversita = box.querySelector('.registro-avversita-scelta');
        if (sceltaAvversita) {
          sceltaAvversita.addEventListener('change', () => {
            const coltura = box.querySelector('.registro-coltura')?.value || '';
            disegna(indiceScelto, {
              coltura,
              avversitaScelta: sceltaAvversita.value,
              ignoraValoriConferma: true
            });
          });
        }
        const campoColtura = box.querySelector('.registro-coltura');
        if (campoColtura && etichetta) {
          campoColtura.addEventListener('change', () => {
            disegna(indiceScelto, { coltura: campoColtura.value, ignoraValoriConferma: true });
          });
        }
        attaccaScelteEtichetta(box, etichetta);
        const bloccata = box.querySelector('[data-conferma-bloccata]');
        if (bloccata) {
          bloccata.addEventListener('click', () => {
            const prodotto = indiceScelto == null ? prodotti[0] : prodotti[indiceScelto];
            if (!prodotto) return;
            applica(registroConfermaBloccata(prodotto, metaBase));
          });
        }
        const manuale = box.querySelector('[data-conferma-manuale]');
        if (manuale) {
          manuale.addEventListener('click', () => {
            const prodotto = indiceScelto == null ? prodotti[0] : prodotti[indiceScelto];
            if (!prodotto) return;
            const campi = leggiCampiAzienda(box);
            const limiti = limitiDoseDaScheda(scheda, { coltura: campi.coltura, avversita: campi.avversita });
            applica(registroConfermaManuale(prodotto, { ...campi, ...limiti }, metaBase));
          });
        }
        const riprova = box.querySelector('[data-riprova-numero]');
        if (riprova) {
          riprova.addEventListener('click', () => {
            const numero = String(box.querySelector('.registro-numero-manuale')?.value || '').trim();
            if (!numero) return;
            esegui({
              nome,
              nomeProdotto: nome,
              specie: specie || '',
              numero,
              numeroRegistrazione: numero
            });
          });
        }
        assicuraAscoltoConformita();
        aggiornaBannerConformita();
      };
      disegna(prodotti.length === 1 ? 0 : null);
      };
      await esegui(richiestaLetturaScheda({ nome, prodotto: anag, specie }));
    });
  });
}

export function messaggiAvvisoForm(input) {
  return avvisiRegistrazione(input).avvisi;
}
