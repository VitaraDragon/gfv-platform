/**
 * Box giallo di carenza su vendemmia, raccolta, pianificazione e diario.
 * Non chiede conferma e non blocca il salvataggio.
 * @module shared/js/avviso-carenza-raccolta
 */

import { caricaPacchettoPerRighe, legamiScheda } from './registro-trattamenti-conformita.js';
import { allineaTrattamentiAiLavori } from './registro-trattamenti-passaggi.js';
import {
  avvisoCarenzaRaccolta,
  tipoLavoroRaccolta,
  verboRaccolta
} from './semaforo-etichetta-pianificazione.js';

function stileBox(box) {
  box.style.background = '#fff3cd';
  box.style.color = '#664d03';
  box.style.padding = '8px 10px';
  box.style.borderRadius = '6px';
  box.style.marginTop = '8px';
  box.style.fontSize = '14px';
}

export function scriviBoxCarenza(box, esito) {
  if (!box) return;
  const testo = esito && esito.testo ? String(esito.testo) : '';
  if (!testo) {
    box.hidden = true;
    box.textContent = '';
    return;
  }
  stileBox(box);
  box.hidden = false;
  box.textContent = testo;
}

function prodottoRiga(riga) {
  if (!riga) return null;
  const nome = String(riga.prodotto || riga.nome || '').trim();
  if (!nome && !riga.prodottoId) return null;
  return {
    prodottoId: riga.prodottoId || null,
    prodotto: nome,
    dosaggio: riga.dosaggio != null ? riga.dosaggio : riga.dosePerEttaro,
    unitaDosaggio: riga.unitaDosaggio || riga.unita || null,
    avversita: riga.avversita || ''
  };
}

function normalizzaTrattamento(trattamento, extra = {}) {
  if (!trattamento) return null;
  const prodotti = Array.isArray(trattamento.prodotti) && trattamento.prodotti.length
    ? trattamento.prodotti.map(prodottoRiga).filter(Boolean)
    : [prodottoRiga({
      prodotto: trattamento.prodotto,
      prodottoId: trattamento.prodottoId,
      dosaggio: trattamento.dosaggio,
      avversita: trattamento.avversita
    })].filter(Boolean);
  if (!prodotti.length) return null;
  return {
    id: trattamento.id || null,
    data: trattamento.data,
    lavoroId: trattamento.lavoroId || null,
    terrenoId: trattamento.terrenoId || extra.terrenoId || null,
    campagnaId: trattamento.campagnaId || extra.campagnaId || null,
    vignetoId: trattamento.vignetoId || extra.vignetoId || null,
    fruttetoId: trattamento.fruttetoId || extra.fruttetoId || null,
    prodotti
  };
}

function stessoContesto(trattamento, filtro) {
  if (filtro.campagnaId && trattamento.campagnaId && String(trattamento.campagnaId) === String(filtro.campagnaId)) return true;
  if (filtro.terrenoId && trattamento.terrenoId && String(trattamento.terrenoId) === String(filtro.terrenoId)) return true;
  return false;
}

/**
 * Schede del terreno, con le righe prodotto. Stessi moduli di contestoRegistroTerreno.
 */
export async function caricaTrattamentiPerCarenza(filtro = {}) {
  const out = [];
  const spingi = (lista, extra) => {
    (lista || []).forEach((trattamento) => {
      const voce = normalizzaTrattamento(trattamento, extra);
      if (!voce) return;
      if ((filtro.terrenoId || filtro.campagnaId) && !filtro.vignetoId && !filtro.fruttetoId) {
        if (!stessoContesto(voce, filtro)) return;
      }
      out.push(voce);
    });
  };
  if (filtro.vignetoId) {
    try {
      const { getTrattamenti } = await import('../../modules/vigneto/services/trattamenti-vigneto-service.js');
      spingi(await getTrattamenti(filtro.vignetoId), { vignetoId: filtro.vignetoId, terrenoId: filtro.terrenoId });
    } catch (e) { /* modulo assente */ }
    return out;
  }
  if (filtro.fruttetoId) {
    try {
      const { getTrattamenti } = await import('../../modules/frutteto/services/trattamenti-frutteto-service.js');
      spingi(await getTrattamenti(filtro.fruttetoId), { fruttetoId: filtro.fruttetoId, terrenoId: filtro.terrenoId });
    } catch (e) { /* modulo assente */ }
    return out;
  }
  const terrenoId = filtro.terrenoId ? String(filtro.terrenoId) : '';
  if (!terrenoId && !filtro.campagnaId) return out;
  try {
    const { getAllVigneti } = await import('../../modules/vigneto/services/vigneti-service.js');
    const { getTrattamenti } = await import('../../modules/vigneto/services/trattamenti-vigneto-service.js');
    const vigneti = (await getAllVigneti()).filter((v) => !terrenoId || String(v.terrenoId || '') === terrenoId);
    for (const vigneto of vigneti) {
      spingi(await getTrattamenti(vigneto.id), { vignetoId: vigneto.id, terrenoId: vigneto.terrenoId });
    }
  } catch (e) { /* modulo assente */ }
  try {
    const { getAllFrutteti } = await import('../../modules/frutteto/services/frutteti-service.js');
    const { getTrattamenti } = await import('../../modules/frutteto/services/trattamenti-frutteto-service.js');
    const frutteti = (await getAllFrutteti()).filter((v) => !terrenoId || String(v.terrenoId || '') === terrenoId);
    for (const frutteto of frutteti) {
      spingi(await getTrattamenti(frutteto.id), { fruttetoId: frutteto.id, terrenoId: frutteto.terrenoId });
    }
  } catch (e) { /* modulo assente */ }
  try {
    const { getAllTrattamentiSeminativo } = await import('../../modules/seminativo/services/trattamenti-service.js');
    spingi(await getAllTrattamentiSeminativo(), {});
  } catch (e) { /* modulo assente */ }
  try {
    const { getAllTrattamentiOrticole } = await import('../../modules/orticole/services/trattamenti-service.js');
    spingi(await getAllTrattamentiOrticole(), {});
  } catch (e) { /* modulo assente */ }
  return out;
}

async function lavoriDelTerreno(terrenoId, lavori) {
  if (Array.isArray(lavori)) return lavori;
  if (!terrenoId) return [];
  try {
    const { getLavoriByTerreno } = await import('../../core/services/lavori-service.js');
    return await getLavoriByTerreno(terrenoId) || [];
  } catch (e) {
    return [];
  }
}

/**
 * Calcola l'avviso e lo scrive nel box. Se non serve, il box resta nascosto.
 */
export async function aggiornaAvvisoCarenzaRaccolta({
  box,
  dataRaccolta,
  coltura,
  verbo,
  trattamenti,
  terrenoId,
  lavori,
  tipoLavoro,
  terrenoColtura
} = {}) {
  if (!box) return null;
  const lista = allineaTrattamentiAiLavori(
    Array.isArray(trattamenti) ? trattamenti : [],
    await lavoriDelTerreno(terrenoId, lavori)
  );
  const righe = lista.flatMap((trattamento) => trattamento.prodotti || []);
  let legami = { vocabolario: null, schedaPerRiga: () => null };
  try {
    const pacchetto = await caricaPacchettoPerRighe(righe, () => null);
    legami = legamiScheda(pacchetto, () => null);
  } catch (e) {
    legami = { vocabolario: null, schedaPerRiga: () => null };
  }
  const esito = avvisoCarenzaRaccolta({
    dataRaccolta,
    coltura,
    verbo: verbo || verboRaccolta({ coltura, tipoLavoro, terrenoColtura }),
    trattamenti: lista,
    vocabolario: legami.vocabolario,
    schedaPerRiga: legami.schedaPerRiga
  });
  scriviBoxCarenza(box, esito);
  return esito;
}

export function installaAvvisoCarenzaVendemmia({ vigneti } = {}) {
  const form = document.getElementById('vendemmia-form');
  if (!form || form.dataset.avvisoCarenza === '1') return;
  form.dataset.avvisoCarenza = '1';
  const aggiorna = async () => {
    const vignetoId = document.getElementById('vignetoId')?.value || '';
    const data = document.getElementById('data')?.value || '';
    const elenco = typeof vigneti === 'function' ? vigneti() : [];
    const vigneto = (elenco || []).find((voce) => voce && voce.id === vignetoId);
    const { colturaSchedaRegistro } = await import('../../core/config/registro-trattamenti-specie.js');
    const coltura = vigneto
      ? colturaSchedaRegistro({ modulo: 'vigneto', destinazioneUva: vigneto.destinazioneUva })
      : '';
    const trattamenti = vignetoId ? await caricaTrattamentiPerCarenza({ vignetoId, terrenoId: vigneto && vigneto.terrenoId }) : [];
    await aggiornaAvvisoCarenzaRaccolta({
      box: document.getElementById('avviso-carenza-raccolta'),
      dataRaccolta: data,
      coltura,
      verbo: 'vendemmiare',
      trattamenti,
      terrenoId: vigneto && vigneto.terrenoId
    });
  };
  aggiornaVendemmia = aggiorna;
  form.addEventListener('change', (evento) => {
    const id = evento.target && evento.target.id;
    if (id === 'vignetoId' || id === 'data') aggiorna();
  });
}

export function installaAvvisoCarenzaFrutteto({ frutteti } = {}) {
  const form = document.getElementById('raccolta-form');
  if (!form || form.dataset.avvisoCarenza === '1') return;
  form.dataset.avvisoCarenza = '1';
  const aggiorna = async () => {
    const fruttetoId = document.getElementById('fruttetoId')?.value || '';
    const data = document.getElementById('data')?.value || '';
    const elenco = typeof frutteti === 'function' ? frutteti() : [];
    const frutteto = (elenco || []).find((voce) => voce && voce.id === fruttetoId);
    const { colturaSchedaRegistro } = await import('../../core/config/registro-trattamenti-specie.js');
    const coltura = frutteto
      ? colturaSchedaRegistro({ modulo: 'frutteto', specie: frutteto.specie })
      : '';
    const trattamenti = fruttetoId
      ? await caricaTrattamentiPerCarenza({ fruttetoId, terrenoId: frutteto && frutteto.terrenoId })
      : [];
    await aggiornaAvvisoCarenzaRaccolta({
      box: document.getElementById('avviso-carenza-raccolta'),
      dataRaccolta: data,
      coltura,
      verbo: 'raccogliere',
      trattamenti,
      terrenoId: frutteto && frutteto.terrenoId
    });
  };
  aggiornaFrutteto = aggiorna;
  form.addEventListener('change', (evento) => {
    const id = evento.target && evento.target.id;
    if (id === 'fruttetoId' || id === 'data') aggiorna();
  });
}

export async function aggiornaAvvisoCarenzaDaRiga({ box, dataRaccolta, terrenoId, campagnaId, coltura, verbo } = {}) {
  const trattamenti = await caricaTrattamentiPerCarenza({ terrenoId, campagnaId });
  return aggiornaAvvisoCarenzaRaccolta({
    box,
    dataRaccolta,
    coltura: coltura || '',
    verbo: verbo || 'raccogliere',
    trattamenti,
    terrenoId
  });
}

let seqAttivita = 0;
let aggiornaAttivita = null;
let timerAttivita = null;
let aggiornaVendemmia = null;
let aggiornaFrutteto = null;
const ATTESA_LETTURA_MS = 400;

export function azzeraBoxCarenza(box) {
  scriviBoxCarenza(box, null);
}

function pianificaAttivita(subito) {
  if (timerAttivita) clearTimeout(timerAttivita);
  if (subito) {
    timerAttivita = null;
    if (aggiornaAttivita) aggiornaAttivita();
    return;
  }
  timerAttivita = setTimeout(() => {
    timerAttivita = null;
    if (aggiornaAttivita) aggiornaAttivita();
  }, ATTESA_LETTURA_MS);
}

export function aggiornaAvvisoCarenzaAttivitaOra() {
  pianificaAttivita(true);
}

export function azzeraAvvisoCarenzaAttivita() {
  if (timerAttivita) clearTimeout(timerAttivita);
  timerAttivita = null;
  azzeraBoxCarenza(typeof document !== 'undefined' ? document.getElementById('avviso-carenza-attivita') : null);
}

export function aggiornaAvvisoCarenzaVendemmiaOra() {
  if (aggiornaVendemmia) return aggiornaVendemmia();
  azzeraBoxCarenza(typeof document !== 'undefined' ? document.getElementById('avviso-carenza-raccolta') : null);
  return null;
}

export function aggiornaAvvisoCarenzaFruttetoOra() {
  if (aggiornaFrutteto) return aggiornaFrutteto();
  azzeraBoxCarenza(typeof document !== 'undefined' ? document.getElementById('avviso-carenza-raccolta') : null);
  return null;
}

export function azzeraAvvisoCarenzaRaccolta() {
  azzeraBoxCarenza(typeof document !== 'undefined' ? document.getElementById('avviso-carenza-raccolta') : null);
}

/**
 * Diario attività. In Conto Terzi il box non compare: il registro non è dell'azienda.
 * Il salvataggio non viene toccato.
 */
export function installaAvvisoCarenzaAttivita({ contoTerzi } = {}) {
  const form = document.getElementById('attivita-form');
  if (!form || form.dataset.avvisoCarenza === '1') return;
  form.dataset.avvisoCarenza = '1';
  const aggiorna = async () => {
    const seq = ++seqAttivita;
    const box = document.getElementById('avviso-carenza-attivita');
    if (!box) return;
    if (typeof contoTerzi === 'function' && contoTerzi()) {
      scriviBoxCarenza(box, null);
      return;
    }
    const tipoGerarchico = document.getElementById('attivita-tipo-lavoro-gerarchico');
    const tipoPiatto = document.getElementById('attivita-tipo-lavoro');
    const tipo = (tipoGerarchico && tipoGerarchico.value) || (tipoPiatto && tipoPiatto.value) || '';
    if (!tipoLavoroRaccolta(tipo).eRaccolta) {
      scriviBoxCarenza(box, null);
      return;
    }
    const terrenoId = document.getElementById('attivita-terreno')?.value || '';
    const data = document.getElementById('attivita-data')?.value || '';
    let terrenoColtura = '';
    let coltura = '';
    try {
      const { getTerreno } = await import('../../core/services/terreni-service.js');
      const terreno = terrenoId ? await getTerreno(terrenoId) : null;
      terrenoColtura = terreno && terreno.coltura ? terreno.coltura : '';
    } catch (e) { terrenoColtura = ''; }
    let trattamenti = [];
    try {
      const { contestoRegistroTerreno } = await import('./registro-trattamenti-passaggi.js');
      const ctx = terrenoId ? await contestoRegistroTerreno(terrenoId) : null;
      coltura = (ctx && ctx.specie) || '';
    } catch (e) { coltura = ''; }
    trattamenti = terrenoId ? await caricaTrattamentiPerCarenza({ terrenoId }) : [];
    if (seq !== seqAttivita) return;
    if (!coltura) coltura = terrenoColtura;
    await aggiornaAvvisoCarenzaRaccolta({
      box,
      dataRaccolta: data,
      coltura,
      tipoLavoro: tipo,
      terrenoColtura,
      trattamenti,
      terrenoId
    });
  };
  aggiornaAttivita = aggiorna;
  form.addEventListener('change', (evento) => {
    const id = evento.target && evento.target.id;
    if (id === 'attivita-data' || id === 'attivita-terreno' || id === 'attivita-tipo-lavoro' || id === 'attivita-tipo-lavoro-gerarchico') {
      pianificaAttivita(false);
    }
  });
  form.addEventListener('input', (evento) => {
    if (evento.target && evento.target.id === 'attivita-data') pianificaAttivita(false);
  });
}
