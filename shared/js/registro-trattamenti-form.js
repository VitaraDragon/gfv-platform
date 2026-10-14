/**
 * Pannello scheda e acqua sul form trattamento (vigneto, frutteto, seminativo).
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
  vociMenuScheda,
  voceUnicaDaCompilare,
  piuFinestreInMenu,
  unisciConfermaSpecie,
  htmlAvvisoRevoca,
  htmlNotaFontiEtichetta
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
    : 'Scheda non confermata';
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

function numeroUguale(a, b) {
  return a != null && b != null && Number(a) === Number(b);
}

function testoNumero(value) {
  if (value == null || !Number.isFinite(Number(value))) return '';
  return String(value).replace('.', ',');
}

function testoIntervallo(min, max) {
  const a = testoNumero(min);
  const b = testoNumero(max);
  if (!a && !b) return '';
  if (!a || !b || a === b) return a || b;
  return a + '–' + b;
}

function testoDoseVoce(voce) {
  const ha = testoIntervallo(voce.doseMinHa, voce.doseMaxHa);
  const hl = testoIntervallo(voce.doseMinHl, voce.doseMaxHl);
  const unitaHa = voce.unitaDoseHa || voce.unitaDose || '';
  const unitaHl = voce.unitaDoseHl || voce.unitaDose || '';
  const parti = [];
  if (ha) parti.push(ha + (unitaHa ? ' ' + unitaHa : '') + '/ha');
  if (hl) parti.push(hl + (unitaHl ? ' ' + unitaHl : '') + '/hl');
  return parti.join(', ');
}

function etichettaVoceMenu(voce) {
  const parti = [voce.avversita];
  if (voce.epoca) parti.push(voce.epoca);
  const dose = testoDoseVoce(voce);
  if (dose) parti.push('dose minima / massima da etichetta: ' + dose);
  if (voce.giorniCarenza != null) parti.push('carenza ' + voce.giorniCarenza + ' giorni');
  const testo = parti.join(' — ');
  return voce.giaConfermata ? 'Conferma già data: ' + testo : testo;
}

function registroDaVoceMenu(voce, specie, anag, utente) {
  const singolaHa = numeroUguale(voce.doseMinHa, voce.doseMaxHa) ? voce.doseMinHa : null;
  const singolaHl = numeroUguale(voce.doseMinHl, voce.doseMaxHl) ? voce.doseMinHl : null;
  const registro = {
    ...campiConfermaRiga({
      avversita: voce.avversita,
      epoca: voce.epoca,
      specieUsata: specie,
      riferimentoRiga: {
        nomeProdotto: (anag && anag.nome) || '',
        numeroRegistrazione: (anag && anag.numeroRegistrazione) || '',
        colturaScheda: voce.colturaScheda
      },
      confermatoDa: utente || null,
      confermatoIl: new Date().toISOString(),
      impieghiMassimiAnno: voce.impieghiMassimiAnno,
      giorniMinimiTraPassaggi: voce.giorniMinimiTraPassaggi,
      dosePerEttaroScheda: singolaHa,
      dosePerEttolitroScheda: singolaHl,
      giorniCarenzaConfermata: voce.giorniCarenza,
      doseMinHa: voce.doseMinHa,
      doseMaxHa: voce.doseMaxHa,
      doseMinHl: voce.doseMinHl,
      doseMaxHl: voce.doseMaxHl,
      unitaDose: voce.unitaDose,
      unitaDoseHa: voce.unitaDoseHa,
      unitaDoseHl: voce.unitaDoseHl
    }),
    principioAttivo: anag && anag.principioAttivo ? String(anag.principioAttivo) : null,
    fonteScheda: anag && anag.fonteScheda ? String(anag.fonteScheda) : null,
    dataLetturaScheda: anag && anag.dataLetturaScheda ? anag.dataLetturaScheda : null
  };
  if (singolaHa != null) registro.dosaggio = singolaHa;
  return registro;
}

function rigaConfermataDaScelta(scelta, specie, utente, fonte, dataLettura) {
  return campiConfermaRiga({
    avversita: scelta.avversita || null,
    specieUsata: specie,
    riferimentoRiga: {
      nomeProdotto: scelta.nomeProdotto || '',
      numeroRegistrazione: scelta.numeroRegistrazione || '',
      colturaScheda: scelta.colturaScheda || specie
    },
    confermatoDa: utente || null,
    confermatoIl: new Date().toISOString(),
    impieghiMassimiAnno: scelta.impieghiMassimiAnno,
    giorniMinimiTraPassaggi: scelta.giorniMinimiTraPassaggi,
    dosePerEttaroScheda: scelta.dosePerEttaro,
    dosePerEttolitroScheda: scelta.dosePerEttolitro,
    giorniCarenzaConfermata: scelta.giorniCarenza
  });
}

function attaccaMenuScheda(opts, tbody) {
  if (!opts.leggiRighe) return;
  let ticket = 0;
  const aggiorna = async (idx) => {
    const mio = ++ticket;
    const specie = opts.specie ? opts.specie() : null;
    if (!specie) {
      scriviEsitoScheda('');
      return;
    }
    const anag = opts.prodotto ? opts.prodotto(idx) : null;
    const fitofarmaco = anag && String(anag.categoria || '').toLowerCase() === 'fitofarmaci';
    if (!anag || (!fitofarmaco && anag.letturaSchedaStato !== 'pronta')) {
      if (mio === ticket) scriviEsitoScheda('');
      return;
    }
    if (anag.revocatoOScaduto) {
      if (mio === ticket) scriviEsitoScheda(htmlAvvisoRevoca(anag) + htmlNotaFontiEtichetta(anag));
      return;
    }
    if (anag.letturaSchedaStato !== 'pronta') {
      if (mio === ticket) {
        const attesa = anag.letturaSchedaStato === 'da_verificare'
          ? '<p>Da verificare a mano. Non propongo avversità né dose.</p>'
          : '<p>La scheda non è ancora letta: il controllo sul numero massimo e sull\'intervallo non si può fare.</p>';
        scriviEsitoScheda(htmlNotaFontiEtichetta(anag) + attesa);
      }
      return;
    }
    let righe = [];
    try {
      righe = await opts.leggiRighe(anag) || [];
    } catch (err) {
      if (mio === ticket) scriviEsitoScheda('<p>La scheda non si legge. Non invento avversità né dose.</p>');
      return;
    }
    if (mio !== ticket) return;
    const alias = opts.alias ? opts.alias() : [];
    const voci = vociMenuScheda({ righe, specie, alias, conferme: anag.confermeSpecie });
    if (!voci.length) {
      scriviEsitoScheda('<p>Per questa specie la scheda non ha impieghi. Non propongo avversità né dose.</p>');
      return;
    }
    const applica = async (voce) => {
      const utente = opts.utente ? opts.utente() : '';
      const registro = registroDaVoceMenu(voce, specie, anag, utente);
      const unito = unisciConfermaSpecie(anag, specie, registro);
      anag.confermeSpecie = unito.confermeSpecie;
      if (opts.onConferma) opts.onConferma(idx, registro);
      if (opts.salvaSuProdotto && anag.id) {
        try { await opts.salvaSuProdotto(anag, specie, registro); } catch (e) { /* la riga trattamento resta confermata in form */ }
      }
      return voce;
    };
    if (voci.length === 1 && voci[0].giaConfermata) {
      scriviEsitoScheda(htmlNotaFontiEtichetta(anag)
        + '<p>Per questa coltura la scheda ha una sola riga, già compilata. '
        + esc(etichettaVoceMenu(voci[0])) + '</p>');
      return;
    }
    const unica = voceUnicaDaCompilare(voci);
    if (unica) {
      await applica(unica);
      scriviEsitoScheda(htmlNotaFontiEtichetta(anag)
        + '<p>Per questa coltura la scheda ha una sola riga: avversità, carenza, numero massimo e intervallo sono compilati. La dose, dentro il minimo e il massimo, la sceglie l\'azienda. '
        + esc(etichettaVoceMenu(unica)) + '</p>');
      return;
    }
    const notaFinestre = piuFinestreInMenu(voci)
      ? '<p>Più finestre in etichetta: scegli quella della data di questo lavoro.</p>'
      : '';
    scriviEsitoScheda(htmlNotaFontiEtichetta(anag) + notaFinestre + '<ul style="list-style:none;padding:0;">'
      + voci.map((voce, i) => '<li style="margin:6px 0;"><button type="button" class="btn btn-sm btn-primary" data-conferma-menu="' + i + '">Conferma</button> '
        + esc(etichettaVoceMenu(voce)) + '</li>').join('')
      + '</ul>');
    const box = document.getElementById('registro-scheda-esito');
    if (!box) return;
    box.querySelectorAll('[data-conferma-menu]').forEach((b) => {
      b.addEventListener('click', async () => {
        const voce = voci[Number(b.getAttribute('data-conferma-menu'))];
        if (!voce) return;
        await applica(voce);
        scriviEsitoScheda('<p>Conferma registrata per ' + esc(voce.avversita) + (voce.epoca ? ' — ' + esc(voce.epoca) : '') + '. Si può salvare il trattamento.</p>');
      });
    });
  };
  tbody.querySelectorAll('.prodotto-select').forEach((sel) => {
    sel.addEventListener('change', () => aggiorna(sel.getAttribute('data-idx')));
  });
  const primo = Array.from(tbody.querySelectorAll('.prodotto-select')).find((sel) => sel.value);
  if (primo) aggiorna(primo.getAttribute('data-idx'));
}

export function attaccaLetturaScheda(opts) {
  const tbody = opts && opts.tbody;
  if (!tbody) return;
  attaccaMenuScheda(opts, tbody);
  tbody.querySelectorAll('.btn-leggi-scheda').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const tr = btn.closest('tr');
      const idx = tr ? tr.getAttribute('data-idx') : null;
      const specie = opts.specie ? opts.specie() : null;
      const alias = opts.alias ? opts.alias() : [];
      const nome = opts.nomeProdotto ? opts.nomeProdotto(idx) : '';
      const anag = opts.prodotto ? opts.prodotto(idx) : null;
      if (!specie) {
        scriviEsitoScheda('<p>La specie di questo campo non è mappata sulla scheda: non propongo avversità né carenza.</p>');
        return;
      }
      if (!nome) {
        scriviEsitoScheda('<p>Indica prima il nome del prodotto.</p>');
        return;
      }
      const gia = confermaSpecieSalvata(anag, specie);
      scriviEsitoScheda('<p>Leggo la scheda pubblica…</p>');
      let esito = { prodotti: [], righe: [], schedaImpieghi: 'non_letta' };
      try {
        if (opts.leggiScheda) {
          esito = await opts.leggiScheda({ nome, nomeProdotto: nome, specie, alias }) || esito;
        }
      } catch (err) {
        scriviEsitoScheda('<p>La scheda non si legge. Non invento avversità, carenza, numero massimo né intervallo.</p>');
        return;
      }
      const utente = opts.utente ? opts.utente() : '';
      const fonte = esito.fonte || FONTE_OPEN_DATA_FITOSANITARI;
      const dataLettura = esito.dataLettura || null;
      const prodotti = Array.isArray(esito.prodotti) ? esito.prodotti : [];
      const primo = prodotti[0] || {};
      const righe = [];
      if (gia) {
        righe.push({
          etichetta: 'Conferma già data per ' + specie + (gia.avversita ? ' — ' + gia.avversita : ''),
          registro: campiConfermaRiga({
            ...gia,
            principioAttivo: anag && anag.principioAttivo,
            fonteScheda: anag && anag.fonteScheda,
            dataLetturaScheda: anag && anag.dataLetturaScheda
          })
        });
      }
      (esito.righe || []).forEach((row) => {
        righe.push({
          etichetta: (row.avversita || 'Impiego') + ' — carenza ' + (row.giorniCarenza != null ? row.giorniCarenza : '—') + ' giorni',
          registro: {
            ...rigaConfermataDaScelta({
              ...row,
              nomeProdotto: primo.denominazione || nome,
              numeroRegistrazione: primo.numeroRegistrazione || ''
            }, specie, utente, fonte, dataLettura),
            principioAttivo: primo.principioAttivo || null,
            fonteScheda: fonte,
            dataLetturaScheda: dataLettura
          }
        });
      });
      if (!righe.length && primo.numeroRegistrazione) {
        righe.push({
          etichetta: 'Solo anagrafica: ' + (primo.denominazione || nome) + ' n. ' + primo.numeroRegistrazione + '. La scheda impieghi non si legge: il controllo sul numero massimo non si può fare.',
          registro: {
            ...campiConfermaRiga({
              specieUsata: specie,
              riferimentoRiga: {
                nomeProdotto: primo.denominazione || nome,
                numeroRegistrazione: primo.numeroRegistrazione,
                colturaScheda: specie
              },
              confermatoDa: utente,
              confermatoIl: new Date().toISOString()
            }),
            principioAttivo: primo.principioAttivo || null,
            fonteScheda: fonte,
            dataLetturaScheda: dataLettura
          }
        });
      }
      if (!righe.length) {
        scriviEsitoScheda('<p>Non trovo il prodotto negli open data, e la scheda impieghi non si legge. Non compilo a mano numero, principio, carenza e avversità.</p>');
        return;
      }
      const html = '<p>' + esc(NOTA_REGISTRO_PRIVATO) + '</p><ul style="list-style:none;padding:0;">'
        + righe.map((item, i) => '<li style="margin:6px 0;"><button type="button" class="btn btn-sm btn-primary" data-conferma-scheda="' + i + '">Conferma</button> '
          + esc(item.etichetta) + '</li>').join('')
        + '</ul>';
      scriviEsitoScheda(html);
      const box = document.getElementById('registro-scheda-esito');
      if (!box) return;
      box.querySelectorAll('[data-conferma-scheda]').forEach((b) => {
        b.addEventListener('click', async () => {
          const scelta = righe[Number(b.getAttribute('data-conferma-scheda'))];
          if (!scelta) return;
          if (opts.onConferma) opts.onConferma(idx, scelta.registro);
          if (opts.salvaSuProdotto && anag && anag.id) {
            try { await opts.salvaSuProdotto(anag, specie, scelta.registro); } catch (e) { /* la riga trattamento resta confermata in form */ }
          }
          scriviEsitoScheda('<p>Conferma registrata per ' + esc(specie) + '. Si può salvare il trattamento.</p>');
        });
      });
    });
  });
}

export function messaggiAvvisoForm(input) {
  return avvisiRegistrazione(input).avvisi;
}
