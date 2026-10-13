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
  FONTE_OPEN_DATA_FITOSANITARI
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

export function attaccaLetturaScheda(opts) {
  const tbody = opts && opts.tbody;
  if (!tbody) return;
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
