/**
 * Pannello open data e acqua sul form trattamento (vigneto, frutteto, seminativo, orticole).
 * Coltura, avversità, dose e carenza le scrive l'azienda. Il CSV non le propone.
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
  dataLetturaItaliana
} from './registro-trattamenti.js';

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
      perHa.value = acqua.ettolitriPerEttaro;
    }
    if (sorgente !== 'tot' && acqua.ettolitriTotali != null && document.activeElement !== tot) {
      tot.value = acqua.ettolitriTotali;
    }
  };
  perHa.addEventListener('input', () => ricalcola('ha'));
  tot.addEventListener('input', () => ricalcola('tot'));
  if (superficie) superficie.addEventListener('input', () => ricalcola('ha'));
}

export function scriviAcquaNelForm(trattamento) {
  const perHa = document.getElementById('trattamento-acqua-hl-ha');
  const tot = document.getElementById('trattamento-acqua-hl-tot');
  if (perHa) perHa.value = trattamento && trattamento.acquaEttolitriPerEttaro != null ? trattamento.acquaEttolitriPerEttaro : '';
  if (tot) tot.value = trattamento && trattamento.acquaEttolitriTotali != null ? trattamento.acquaEttolitriTotali : '';
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

function campiManuali(conferma, specie) {
  const c = conferma || {};
  const coltura = (c.riferimentoRiga && c.riferimentoRiga.colturaScheda) || c.specieUsata || specie || '';
  return '<div class="registro-campi-azienda" style="margin-top:8px;">'
    + '<p>Coltura, avversità, dose e carenza le inserisce l\'azienda. Non arrivano dal Ministero.</p>'
    + '<label>Coltura <input class="registro-coltura" type="text" value="' + valoreCampo(coltura) + '"></label> '
    + '<label>Avversità <input class="registro-avversita" type="text" value="' + valoreCampo(c.avversita) + '"></label> '
    + '<label>Dose per ha <input class="registro-dose-ha" type="text" inputmode="decimal" value="' + valoreCampo(c.dosePerEttaroScheda) + '"></label> '
    + '<label>Dose per hl <input class="registro-dose-hl" type="text" inputmode="decimal" value="' + valoreCampo(c.dosePerEttolitroScheda) + '"></label> '
    + '<label>Carenza (giorni) <input class="registro-carenza" type="text" inputmode="numeric" value="' + valoreCampo(c.giorniCarenzaConfermata) + '"></label> '
    + '<label>Numero massimo <input class="registro-massimo" type="text" inputmode="numeric" value="' + valoreCampo(c.impieghiMassimiAnno) + '"></label> '
    + '<label>Intervallo (giorni) <input class="registro-intervallo" type="text" inputmode="numeric" value="' + valoreCampo(c.giorniMinimiTraPassaggi) + '"></label>'
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
  const parti = ['<p class="registro-avviso-etichetta">' + esc(AVVISO_ETICHETTA_FA_FEDE) + '</p>'];
  if (!prodotti.length) {
    parti.push('<p>Non trovo «' + esc(input.nome || 'questo prodotto') + '» negli open data del Ministero. Non invento numero, titolare, sostanze o stato.</p>');
    parti.push('<p><a href="' + URL_BANCA_FITOSANITARI + '" target="_blank" rel="noopener noreferrer">Apri la banca dati fitosanitari del Ministero</a></p>');
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
    const cls = classificaStatoAmministrativo(scelto.stato);
    const quando = dataRevocaOScadenza(scelto);
    parti.push('<p class="registro-banner-stato" style="background:#f8d7da;color:#842029;padding:8px;border-radius:6px;">'
      + esc(etichettaStato(cls) + (quando ? ' — ' + quando : '') + '. ' + (scelto.stato || ''))
      + ' Non propongo dose, carenza né avversità.</p>');
    parti.push('<p><button type="button" class="btn btn-sm btn-primary" data-conferma-bloccata="1">Conferma</button></p>');
    return parti.join('');
  }
  if (input.conferma && (input.conferma.confermatoIl || input.conferma.avversita)) {
    const quando = dataAziendaItaliana(input.conferma.confermatoIl);
    parti.push('<p class="registro-conferma-azienda">Inserita dalla tua azienda'
      + (quando ? ' il ' + esc(quando) : '')
      + '. Non è un dato del Ministero.</p>');
  }
  parti.push(campiManuali(input.conferma, input.specie));
  parti.push('<p><button type="button" class="btn btn-sm btn-primary" data-conferma-manuale="1">Conferma</button></p>');
  return parti.join('');
}

function anagraficaRegistro(prodotto, meta) {
  return {
    principioAttivo: prodotto && prodotto.principioAttivo ? String(prodotto.principioAttivo) : null,
    titolare: prodotto && prodotto.titolare ? String(prodotto.titolare) : null,
    statoAmministrativoScheda: prodotto && prodotto.stato ? String(prodotto.stato) : null,
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

/** Conferma con i valori scritti dall'azienda. */
export function registroConfermaManuale(prodotto, campi = {}, meta = {}) {
  const specie = campi.coltura || meta.specie || '';
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
      impieghiMassimiAnno: campi.massimo,
      giorniMinimiTraPassaggi: campi.intervallo,
      dosePerEttaroScheda: campi.doseHa,
      dosePerEttolitroScheda: campi.doseHl,
      giorniCarenzaConfermata: campi.carenza
    }),
    ...anagraficaRegistro(prodotto, meta)
  };
  if (campi.doseHa != null && campi.doseHa !== '' && Number.isFinite(Number(String(campi.doseHa).replace(',', '.')))) {
    registro.dosaggio = Number(String(campi.doseHa).replace(',', '.'));
  }
  return registro;
}

function leggiCampiAzienda(box) {
  const valore = (sel) => {
    const el = box.querySelector(sel);
    return el ? el.value : '';
  };
  return {
    coltura: valore('.registro-coltura'),
    avversita: valore('.registro-avversita'),
    doseHa: valore('.registro-dose-ha'),
    doseHl: valore('.registro-dose-hl'),
    carenza: valore('.registro-carenza'),
    massimo: valore('.registro-massimo'),
    intervallo: valore('.registro-intervallo')
  };
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
      scriviEsitoScheda('<p>Cerco il prodotto negli open data del Ministero…</p>');
      let esito = { prodotti: [], righe: [] };
      try {
        if (opts.leggiScheda) {
          esito = await opts.leggiScheda({ nome, nomeProdotto: nome, specie: specie || '' }) || esito;
        }
      } catch (err) {
        scriviEsitoScheda('<p>Gli open data non si leggono. Non invento numero, titolare, sostanze, avversità, carenza, numero massimo né intervallo.</p>');
        return;
      }
      const conferma = confermaSpecieSalvata(anag, specie);
      const prodotti = Array.isArray(esito.prodotti) ? esito.prodotti : [];
      const metaBase = {
        fonte: esito.fonte || FONTE_OPEN_DATA_FITOSANITARI,
        dataLettura: esito.dataLettura || null,
        specie,
        nome,
        utente: opts.utente ? opts.utente() : ''
      };
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
      };
      const disegna = (indiceScelto) => {
        scriviEsitoScheda(htmlPannelloOpenData({
          esito,
          nome,
          specie,
          conferma,
          indiceScelto
        }));
        const box = document.getElementById('registro-scheda-esito');
        if (!box) return;
        box.querySelectorAll('[data-scegli-prodotto]').forEach((b) => {
          b.addEventListener('click', () => disegna(Number(b.getAttribute('data-scegli-prodotto'))));
        });
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
            applica(registroConfermaManuale(prodotto, leggiCampiAzienda(box), metaBase));
          });
        }
      };
      disegna(prodotti.length === 1 ? 0 : null);
    });
  });
}

export function messaggiAvvisoForm(input) {
  return avvisiRegistrazione(input).avvisi;
}
