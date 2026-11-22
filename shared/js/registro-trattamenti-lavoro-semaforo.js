/**
 * Banner e pallini del semaforo nel modale lavoro. Nessuna valutazione propria:
 * legge il form e chiama il motore puro.
 * @module shared/js/registro-trattamenti-lavoro-semaforo
 */

import { preparaEtichetta } from './registro-trattamenti-etichetta.js';
import {
  caricaPacchettoPerRighe,
  htmlBannerConformita,
  htmlSemaforoConformita,
  legamiScheda
} from './registro-trattamenti-conformita.js';
import {
  componiMiscelaDalForm,
  tipoLavoroETrattamento
} from './registro-trattamenti-lavoro.js';
import { testoDoseDaEtichetta, valutaTrattamentoPianificato } from './semaforo-etichetta-pianificazione.js';

let bannerSeq = 0;
let leggiContestoRegistrato = null;
let timerSemaforo = null;
let cacheSemaforo = null;
let attesaSemaforoMs = 400;
const CAMPI_CHE_NON_RICALCOLANO = new Set(['lavoro-nome', 'lavoro-note']);

function chiaveCacheSemaforo() {
  const terreno = document.getElementById('lavoro-terreno')?.value || '';
  const data = document.getElementById('lavoro-data-inizio')?.value || '';
  return terreno + '|' + String(data).slice(0, 4);
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nomeTipoLavoro() {
  const sel = document.getElementById('lavoro-tipo-lavoro');
  if (!sel || sel.selectedIndex < 0) return '';
  return sel.options[sel.selectedIndex].text || sel.value || '';
}

function nascondiBanner() {
  const banner = document.getElementById('lavoro-semaforo-banner');
  if (!banner) return;
  banner.hidden = true;
  banner.innerHTML = '';
  const principale = document.getElementById('lavoro-semaforo-riga');
  if (principale) principale.innerHTML = '';
  const dose = document.getElementById('lavoro-dose-etichetta');
  if (dose) dose.textContent = '';
  document.querySelectorAll('#tbody-miscela-lavoro .lavoro-semaforo-pallino, #tbody-miscela-lavoro .lavoro-dose-etichetta-extra').forEach((el) => {
    el.innerHTML = '';
    el.textContent = '';
  });
}

function riempiTendinaAvversita(select, scheda, coltura, vocabolario) {
  if (!select) return;
  const vista = preparaEtichetta({
    scheda,
    coltura: coltura || '',
    vocabolario,
    avversitaScelta: ''
  });
  const lista = (vista && vista.avversita) || [];
  const chiave = (coltura || '') + '|' + lista.map((voce) => voce.chiave).join('|');
  const scelta = select.value || select.getAttribute('data-avversita') || '';
  if (select.dataset.chiave === chiave) {
    if (scelta && !select.value) select.value = scelta;
    return;
  }
  select.innerHTML = '<option value="">— da scegliere —</option>' + lista.map((voce) => (
    '<option value="' + esc(voce.testo) + '">' + esc(voce.testo) + '</option>'
  )).join('');
  select.dataset.chiave = chiave;
  if (scelta) select.value = scelta;
}

function scriviDose(el, scheda, coltura, avversita) {
  if (!el) return;
  el.textContent = testoDoseDaEtichetta(scheda, coltura, avversita);
}

/**
 * Ricalcola banner, pallini, tendine avversità e testo «Da etichetta».
 * Una risposta vecchia non sovrascrive una più nuova.
 */
export async function aggiornaSemaforoPianificazione(ctx = {}) {
  const seq = ++bannerSeq;
  const banner = document.getElementById('lavoro-semaforo-banner');
  if (!tipoLavoroETrattamento(nomeTipoLavoro())) {
    nascondiBanner();
    return null;
  }
  const terreno = (ctx.terreni || []).find((t) => t && t.id === (document.getElementById('lavoro-terreno')?.value || ctx.terrenoId));
  const ettari = terreno && terreno.superficie != null ? Number(terreno.superficie) : null;
  const miscela = componiMiscelaDalForm(Number.isFinite(ettari) ? ettari : null, ctx.attrezzo || null);
  const anagrafica = Array.isArray(ctx.prodotti) ? ctx.prodotti : [];
  const anagraficaDi = (riga) => anagrafica.find((prodotto) => prodotto && riga && prodotto.id === riga.prodottoId) || null;
  let pacchetto = { schede: new Map(), vocabolario: null, indice: { prodotti: [] } };
  try {
    pacchetto = await caricaPacchettoPerRighe(miscela.prodotti || [], anagraficaDi);
  } catch (err) {
    pacchetto = { schede: new Map(), vocabolario: null, indice: { prodotti: [] } };
  }
  if (seq !== bannerSeq) return null;
  const legami = legamiScheda(pacchetto, anagraficaDi);
  const esito = valutaTrattamentoPianificato({
    miscela,
    data: document.getElementById('lavoro-data-inizio')?.value || ctx.data,
    terrenoId: document.getElementById('lavoro-terreno')?.value || ctx.terrenoId || null,
    specie: ctx.specie || '',
    lavoroId: document.getElementById('lavoro-id')?.value || ctx.lavoroId || '',
    precedenti: ctx.precedenti || [],
    legami,
    oggi: ctx.oggi || new Date(),
    superficieHa: Number.isFinite(ettari) ? ettari : null
  });
  if (seq !== bannerSeq) return null;
  if (banner) {
    banner.hidden = false;
    banner.innerHTML = htmlBannerConformita(esito);
  }
  const coltura = ctx.specie || '';
  const nomeLibero = document.getElementById('lavoro-miscela-nome')?.value?.trim() || '';
  const idProdotto = document.getElementById('lavoro-miscela-prodotto')?.value || '';
  const haPrincipale = !!(nomeLibero || idProdotto);
  const principale = haPrincipale ? (miscela.prodotti && miscela.prodotti[0]) : null;
  const selectPrincipale = document.getElementById('lavoro-miscela-avversita');
  const schedaPrincipale = principale ? legami.schedaPerRiga(principale) : null;
  riempiTendinaAvversita(selectPrincipale, schedaPrincipale, coltura, legami.vocabolario);
  scriviDose(
    document.getElementById('lavoro-dose-etichetta'),
    schedaPrincipale,
    coltura,
    selectPrincipale ? selectPrincipale.value : ''
  );
  const pallino = document.getElementById('lavoro-semaforo-riga');
  if (pallino) {
    pallino.innerHTML = haPrincipale && esito.perRiga[0]
      ? htmlSemaforoConformita(esito.perRiga[0].esito, { taglia: 'riga' })
      : '';
  }
  const extra = Array.from(document.querySelectorAll('#tbody-miscela-lavoro tr[data-extra]'));
  extra.forEach((tr, index) => {
    const voce = esito.perRiga[haPrincipale ? index + 1 : index];
    const select = tr.querySelector('.miscela-avversita-extra');
    const scheda = voce ? legami.schedaPerRiga(voce.riga) : null;
    riempiTendinaAvversita(select, scheda, coltura, legami.vocabolario);
    scriviDose(tr.querySelector('.lavoro-dose-etichetta-extra'), scheda, coltura, select ? select.value : '');
    const punto = tr.querySelector('.lavoro-semaforo-pallino');
    if (punto) punto.innerHTML = voce ? htmlSemaforoConformita(voce.esito, { taglia: 'riga' }) : '';
  });
  return esito;
}

export function azzeraCacheSemaforoPianificazione() {
  cacheSemaforo = null;
}

export function chiudiSemaforoPianificazione() {
  if (timerSemaforo) clearTimeout(timerSemaforo);
  timerSemaforo = null;
  cacheSemaforo = null;
  bannerSeq += 1;
  nascondiBanner();
}

function eseguiLetturaSemaforo() {
  if (!tipoLavoroETrattamento(nomeTipoLavoro())) {
    nascondiBanner();
    return Promise.resolve(null);
  }
  const chiave = chiaveCacheSemaforo();
  const applica = (ctx) => aggiornaSemaforoPianificazione(ctx || {});
  if (cacheSemaforo && cacheSemaforo.chiave === chiave) {
    return Promise.resolve(applica(cacheSemaforo.valore));
  }
  const lettura = typeof leggiContestoRegistrato === 'function' ? leggiContestoRegistrato() : {};
  const atteso = lettura && typeof lettura.then === 'function' ? lettura : Promise.resolve(lettura);
  return atteso.then((ctx) => {
    if (!tipoLavoroETrattamento(nomeTipoLavoro())) return null;
    cacheSemaforo = { chiave, valore: ctx || {} };
    return applica(ctx);
  }).catch(() => null);
}

function programmaSemaforo(subito) {
  if (!tipoLavoroETrattamento(nomeTipoLavoro())) {
    if (timerSemaforo) clearTimeout(timerSemaforo);
    timerSemaforo = null;
    nascondiBanner();
    return Promise.resolve(null);
  }
  if (subito) {
    if (timerSemaforo) clearTimeout(timerSemaforo);
    timerSemaforo = null;
    return eseguiLetturaSemaforo();
  }
  if (timerSemaforo) clearTimeout(timerSemaforo);
  return new Promise((resolve) => {
    timerSemaforo = setTimeout(() => {
      timerSemaforo = null;
      resolve(eseguiLetturaSemaforo());
    }, attesaSemaforoMs);
  });
}

export function chiediSemaforoPianificazione(opzioni = {}) {
  return programmaSemaforo(!!(opzioni && opzioni.subito));
}

export function collegaSemaforoPianificazione(leggiContesto, opzioni = {}) {
  leggiContestoRegistrato = leggiContesto;
  if (opzioni && opzioni.attesaMs != null) attesaSemaforoMs = opzioni.attesaMs;
  const form = document.getElementById('lavoro-form');
  if (!form || form.dataset.semaforoPianificazione === '1') return;
  form.dataset.semaforoPianificazione = '1';
  const suEvento = (evento) => {
    const id = evento && evento.target && evento.target.id;
    if (CAMPI_CHE_NON_RICALCOLANO.has(id)) return;
    programmaSemaforo(false);
  };
  form.addEventListener('input', suEvento);
  form.addEventListener('change', suEvento);
  form.addEventListener('click', (evento) => {
    const nodo = evento.target;
    if (!nodo || !nodo.closest) return;
    if (nodo.closest('#btn-miscela-aggiungi, .miscela-togli')) programmaSemaforo(false);
  });
}
