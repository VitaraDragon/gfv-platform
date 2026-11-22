/**
 * Miscela prevista sul form lavoro. Visibile solo se il tipo è un trattamento.
 * Senza Magazzino resta disponibile l'inserimento a testo libero.
 * @module shared/js/registro-trattamenti-lavoro
 */

import {
  calcolaMiscela,
  avvisoImpieghiEIntervallo,
  NOTA_REGISTRO_PRIVATO,
  NOTA_PASSAGGIO_NON_REGISTRATO,
  confermaSpecieSalvata,
  stessoProdotto,
  messaggiUnici
} from './registro-trattamenti.js';

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function tipoLavoroETrattamento(nome) {
  return String(nome || '').toLowerCase().includes('trattament');
}

export function configuraMiscelaPerModuli(moduli = []) {
  const hasMagazzino = Array.isArray(moduli) && moduli.includes('magazzino');
  const contenitore = document.getElementById('lavoro-miscela-prodotto-group');
  const select = document.getElementById('lavoro-miscela-prodotto');
  if (contenitore) contenitore.hidden = !hasMagazzino;
  if (select) {
    select.disabled = !hasMagazzino;
    if (!hasMagazzino) select.value = '';
  }
  const nome = document.getElementById('lavoro-miscela-nome-label');
  if (nome) nome.textContent = hasMagazzino ? 'Nome se non è in magazzino' : 'Nome prodotto';
  if (hasMagazzino) notificaSezioneMiscelaSeVisibile();
  return hasMagazzino;
}

export const MESSAGGIO_ERRORE_PRODOTTI_MISCELA = 'Non riesco a leggere i prodotti del magazzino. Puoi scrivere il nome a mano.';

let onCaricaProdottiMiscela = null;

/** Il form lavoro registra qui il caricamento reale (getAllProdotti). Restituisce il precedente. */
export function registraCaricamentoProdottiMiscela(fn) {
  const precedente = onCaricaProdottiMiscela;
  onCaricaProdottiMiscela = typeof fn === 'function' ? fn : null;
  return precedente;
}

export function aggiornaSezioneMiscelaLavoro() {
  const section = document.getElementById('lavoro-miscela-section');
  if (!section) return { visibile: false };
  const sel = document.getElementById('lavoro-tipo-lavoro');
  const nome = sel && sel.options && sel.selectedIndex >= 0
    ? (sel.options[sel.selectedIndex].text || sel.value)
    : '';
  const visibile = tipoLavoroETrattamento(nome);
  section.style.display = visibile ? 'block' : 'none';
  return { visibile };
}

/** La tendina si riempie solo a sezione visibile e select abilitata (modulo Magazzino). */
export function miscelaPuoCaricareProdotti() {
  const section = document.getElementById('lavoro-miscela-section');
  const select = document.getElementById('lavoro-miscela-prodotto');
  if (!section || section.style.display === 'none') return false;
  if (!select || select.disabled) return false;
  return true;
}

export function scriviErroreProdottiMiscela(messaggio) {
  const group = document.getElementById('lavoro-miscela-prodotto-group')
    || document.getElementById('lavoro-miscela-section');
  if (!group) return;
  let el = document.getElementById('lavoro-miscela-prodotti-errore');
  if (!el) {
    el = document.createElement('p');
    el.id = 'lavoro-miscela-prodotti-errore';
    el.style.color = '#842029';
    el.style.margin = '6px 0 0';
    group.appendChild(el);
  }
  const testo = String(messaggio || '').trim();
  el.textContent = testo;
  el.style.display = testo ? 'block' : 'none';
}

/**
 * Aggiorna la sezione e, se è visibile, carica i prodotti.
 * Copre il tipo impostato in codice, senza un change su #lavoro-tipo-lavoro.
 */
export function notificaSezioneMiscelaSeVisibile() {
  const esito = aggiornaSezioneMiscelaLavoro();
  if (esito.visibile && typeof onCaricaProdottiMiscela === 'function') {
    return onCaricaProdottiMiscela();
  }
  return esito;
}

/**
 * Carica la tendina se la sezione è pronta.
 * Se era nascosta o la select era disabilitata, segna il salto: il prossimo giro visibile riprova.
 */
export async function caricaProdottiMiscelaNelForm({ getProdotti, specie } = {}) {
  aggiornaSezioneMiscelaLavoro();
  const section = document.getElementById('lavoro-miscela-section');
  if (!miscelaPuoCaricareProdotti()) {
    if (section) section.dataset.prodottiSaltati = '1';
    return { esito: 'saltato' };
  }
  if (section) delete section.dataset.prodottiSaltati;
  try {
    const prodotti = typeof getProdotti === 'function' ? await getProdotti() : [];
    await riempiSelectProdottiMiscela(prodotti, specie);
    scriviErroreProdottiMiscela('');
    return { esito: 'ok' };
  } catch (err) {
    scriviErroreProdottiMiscela(MESSAGGIO_ERRORE_PRODOTTI_MISCELA);
    return { esito: 'errore', errore: err };
  }
}

function avversitaDalCampo(select, nodoFallback) {
  const valore = select && select.value ? String(select.value).trim() : '';
  if (valore) return valore;
  const nodo = nodoFallback || select;
  return nodo && nodo.getAttribute ? String(nodo.getAttribute('data-avversita') || '').trim() : '';
}

function testoAvversitaProdotto(prodotto) {
  if (!prodotto) return '';
  return String(prodotto.avversitaPianificata || prodotto.avversita || '').trim();
}

function leggiProdottiMiscelaDalForm() {
  const rows = [];
  const aggiungi = (riga) => {
    if (rows.some((r) => stessoProdotto(r, riga))) return;
    rows.push(riga);
  };
  const id = document.getElementById('lavoro-miscela-prodotto')?.value || '';
  const nomeSel = document.getElementById('lavoro-miscela-prodotto');
  const nomeOpt = nomeSel && nomeSel.selectedIndex >= 0 ? nomeSel.options[nomeSel.selectedIndex].text : '';
  const nomeLibero = document.getElementById('lavoro-miscela-nome')?.value?.trim() || '';
  const dose = document.getElementById('lavoro-miscela-dose-ha')?.value;
  const nome = id ? nomeOpt : nomeLibero;
  const selectAvversita = document.getElementById('lavoro-miscela-avversita');
  const avversitaPrincipale = avversitaDalCampo(selectAvversita);
  if (nome && nome !== '— Nessun prodotto —') {
    const riga = {
      prodottoId: id || null,
      nome,
      dosePerEttaro: dose,
      unita: nomeSel?.selectedOptions?.[0]?.getAttribute('data-unita') || null,
      dosePerEttolitro: nomeSel?.selectedOptions?.[0]?.getAttribute('data-dose-hl') || null
    };
    if (avversitaPrincipale) riga.avversitaPianificata = avversitaPrincipale;
    aggiungi(riga);
  }
  document.querySelectorAll('#tbody-miscela-lavoro tr[data-extra]').forEach((tr) => {
    const extraId = tr.getAttribute('data-prodotto-id') || null;
    const extraNome = tr.getAttribute('data-nome') || '';
    const extraDose = tr.querySelector('.miscela-dose-extra')?.value;
    const extraSelect = tr.querySelector('.miscela-avversita-extra');
    const extraAvversita = avversitaDalCampo(extraSelect, tr);
    if (!extraNome) return;
    const riga = {
      prodottoId: extraId,
      nome: extraNome,
      dosePerEttaro: extraDose,
      unita: tr.getAttribute('data-unita') || null,
      dosePerEttolitro: tr.getAttribute('data-dose-hl') || null
    };
    if (extraAvversita) riga.avversitaPianificata = extraAvversita;
    aggiungi(riga);
  });
  return rows;
}

export function componiMiscelaDalForm(ettari, attrezzo) {
  const quintali = attrezzo && attrezzo.capacitaBotteQuintali != null ? attrezzo.capacitaBotteQuintali : null;
  return calcolaMiscela({
    ettari,
    ettolitriPerEttaro: document.getElementById('lavoro-acqua-hl-ha')?.value,
    ettolitriTotali: document.getElementById('lavoro-acqua-hl-tot')?.value,
    capacitaBotteQuintali: quintali,
    nomeAttrezzo: attrezzo && attrezzo.nome ? attrezzo.nome : null,
    prodotti: leggiProdottiMiscelaDalForm()
  });
}

export function scriviMiscelaNelForm(miscela) {
  const m = miscela || {};
  const perHa = document.getElementById('lavoro-acqua-hl-ha');
  const tot = document.getElementById('lavoro-acqua-hl-tot');
  if (perHa) perHa.value = m.ettolitriPerEttaro != null ? m.ettolitriPerEttaro : '';
  if (tot) tot.value = m.ettolitriTotali != null ? m.ettolitriTotali : '';
  const prodotti = Array.isArray(m.prodotti) ? m.prodotti : [];
  const primo = prodotti[0];
  const sel = document.getElementById('lavoro-miscela-prodotto');
  const nome = document.getElementById('lavoro-miscela-nome');
  const dose = document.getElementById('lavoro-miscela-dose-ha');
  if (sel && primo && primo.prodottoId) sel.value = primo.prodottoId;
  if (nome) nome.value = primo && !primo.prodottoId ? (primo.nome || '') : '';
  if (dose) dose.value = primo && primo.dosePerEttaro != null ? primo.dosePerEttaro : '';
  const avversita = document.getElementById('lavoro-miscela-avversita');
  if (avversita) {
    const testo = testoAvversitaProdotto(primo);
    avversita.setAttribute('data-avversita', testo);
    avversita.value = testo;
  }
  const tbody = document.getElementById('tbody-miscela-lavoro');
  if (!tbody) return;
  tbody.innerHTML = prodotti.slice(1).map((p) => rigaExtraMiscela(p)).join('');
}

function celleExtraMiscela(p) {
  const avversita = testoAvversitaProdotto(p);
  return '<td>' + esc(p.nome || '') + ' <span class="lavoro-semaforo-pallino"></span></td>'
    + '<td><select class="miscela-avversita-extra" data-avversita="' + esc(avversita) + '"><option value="">— da scegliere —</option></select></td>'
    + '<td><input type="number" class="miscela-dose-extra" min="0" step="0.001" value="' + esc(p.dosePerEttaro != null ? p.dosePerEttaro : '') + '"></td>'
    + '<td><span class="lavoro-dose-etichetta-extra"></span></td>'
    + '<td><button type="button" class="btn btn-sm btn-danger miscela-togli">Togli</button></td>';
}

function rigaExtraMiscela(p) {
  const avversita = testoAvversitaProdotto(p);
  return '<tr data-extra="1" data-prodotto-id="' + esc(p.prodottoId || '') + '" data-nome="' + esc(p.nome || '') + '" data-unita="' + esc(p.unita || '') + '" data-dose-hl="' + esc(p.dosePerEttolitro != null ? p.dosePerEttolitro : '') + '" data-avversita="' + esc(avversita) + '">'
    + celleExtraMiscela(p) + '</tr>';
}

export function testoAnteprimaMiscela(miscela) {
  if (!miscela || !miscela.prodotti || !miscela.prodotti.length) return '';
  const righe = miscela.prodotti.map((p) => {
    const pezzi = [
      p.nome,
      'dose/ha ' + (p.dosePerEttaro != null ? p.dosePerEttaro : '—'),
      'totale campo ' + (p.quantita != null ? p.quantita : '—') + (p.unita ? ' ' + p.unita : ''),
      'dose/hl ' + (p.dosePerEttolitro != null ? p.dosePerEttolitro : '—')
    ];
    if (p.doseBottePiena != null) pezzi.push('botte piena ' + p.doseBottePiena);
    return pezzi.join(' · ');
  });
  let extra = 'Acqua ' + (miscela.ettolitriPerEttaro != null ? miscela.ettolitriPerEttaro : '—')
    + ' hl/ha, totale ' + (miscela.ettolitriTotali != null ? miscela.ettolitriTotali : '—') + ' hl.';
  if (miscela.nomeAttrezzo && miscela.capacitaBotteQuintali) {
    extra += ' ' + miscela.nomeAttrezzo + ', ' + miscela.capacitaBotteQuintali + ' quintali, botti: ' + (miscela.bottiPiene != null ? miscela.bottiPiene : '—') + '.';
    if (miscela.ultimaBotte) {
      extra += ' Ultima botte parziale ' + miscela.ultimaBotte.ettolitri + ' hl.';
    }
  }
  return righe.join('\n') + '\n' + extra;
}

export function avvisiMiscelaLavoro({ miscela, terrenoId, data, precedenti, prodottiAnagrafica, specie }) {
  const messaggi = [];
  ((miscela && miscela.prodotti) || []).forEach((p) => {
    const anag = (prodottiAnagrafica || []).find((a) => a.id === p.prodottoId);
    const conferma = confermaSpecieSalvata(anag, specie);
    const esito = avvisoImpieghiEIntervallo({
      data,
      terrenoId,
      prodottoId: p.prodottoId,
      nome: p.nome,
      conferma,
      precedenti,
      includiNotaNonRegistrato: false
    });
    messaggi.push(...esito.avvisi);
  });
  const unici = messaggiUnici(messaggi);
  if (unici.length) unici.push(NOTA_PASSAGGIO_NON_REGISTRATO);
  return unici;
}

/** Dopo «Aggiungi» i campi di inserimento tornano vuoti: la riga è passata in tabella. */
function puliscaCampiMiscela() {
  const sel = document.getElementById('lavoro-miscela-prodotto');
  const nome = document.getElementById('lavoro-miscela-nome');
  const dose = document.getElementById('lavoro-miscela-dose-ha');
  const avversita = document.getElementById('lavoro-miscela-avversita');
  if (sel) sel.value = '';
  if (nome) nome.value = '';
  if (dose) dose.value = '';
  if (avversita) {
    avversita.value = '';
    avversita.removeAttribute('data-avversita');
  }
}

export function installaMiscelaLavoro(opts = {}) {
  const form = document.getElementById('lavoro-form');
  if (!form || form.dataset.miscelaRegistro === '1') return;
  form.dataset.miscelaRegistro = '1';
  const nota = document.getElementById('lavoro-miscela-nota');
  if (nota) nota.textContent = NOTA_REGISTRO_PRIVATO;
  form.addEventListener('change', (e) => {
    const id = e.target && e.target.id;
    const target = e.target;
    if (target && (target.id === 'lavoro-miscela-avversita' || (target.classList && target.classList.contains('miscela-avversita-extra')))) {
      target.setAttribute('data-avversita', target.value || '');
      const tr = target.closest ? target.closest('tr') : null;
      if (tr) tr.setAttribute('data-avversita', target.value || '');
    }
    if (id === 'lavoro-tipo-lavoro' || id === 'lavoro-categoria-principale' || id === 'lavoro-sottocategoria') {
      const esito = aggiornaSezioneMiscelaLavoro();
      if (esito.visibile && typeof onCaricaProdottiMiscela === 'function') onCaricaProdottiMiscela();
    }
  });
  const btn = document.getElementById('btn-miscela-aggiungi');
  if (btn) {
    btn.addEventListener('click', () => {
      const sel = document.getElementById('lavoro-miscela-prodotto');
      const nomeLibero = document.getElementById('lavoro-miscela-nome')?.value?.trim() || '';
      const dose = document.getElementById('lavoro-miscela-dose-ha')?.value || '';
      const avversitaScelta = document.getElementById('lavoro-miscela-avversita')?.value?.trim() || '';
      const id = sel?.value || '';
      const nome = id && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text : nomeLibero;
      if (!nome) return;
      const tbody = document.getElementById('tbody-miscela-lavoro');
      if (!tbody) return;
      const nuovo = { prodottoId: id || null, nome };
      const giaPresente = Array.from(tbody.querySelectorAll('tr[data-extra]')).find((riga) => stessoProdotto({
        prodottoId: riga.getAttribute('data-prodotto-id') || null,
        nome: riga.getAttribute('data-nome') || ''
      }, nuovo));
      if (giaPresente) {
        const inputDose = giaPresente.querySelector('.miscela-dose-extra');
        if (inputDose && dose !== '') inputDose.value = dose;
        puliscaCampiMiscela();
        return;
      }
      const tr = document.createElement('tr');
      tr.setAttribute('data-extra', '1');
      tr.setAttribute('data-prodotto-id', id);
      tr.setAttribute('data-nome', nome);
      tr.setAttribute('data-unita', (sel?.selectedOptions?.[0]?.getAttribute('data-unita')) || '');
      tr.setAttribute('data-dose-hl', (sel?.selectedOptions?.[0]?.getAttribute('data-dose-hl')) || '');
      tr.setAttribute('data-avversita', avversitaScelta);
      tr.innerHTML = celleExtraMiscela({ nome, dosePerEttaro: dose, avversita: avversitaScelta });
      tbody.appendChild(tr);
      puliscaCampiMiscela();
    });
  }
  form.addEventListener('click', (e) => {
    const btnTogli = e.target && e.target.closest ? e.target.closest('.miscela-togli') : null;
    if (!btnTogli) return;
    const tr = btnTogli.closest('tr');
    if (tr) tr.remove();
  });
  if (typeof opts.onReady === 'function') opts.onReady();
}

export async function riempiSelectProdottiMiscela(prodotti, specie) {
  const sel = document.getElementById('lavoro-miscela-prodotto');
  if (!sel) return;
  const corrente = sel.value;
  const righe = (prodotti || []).filter((p) => p && p.attivo !== false);
  sel.innerHTML = '<option value="">— Nessun prodotto —</option>' + righe.map((p) => {
    const conferma = confermaSpecieSalvata(p, specie);
    const doseHl = conferma && conferma.dosePerEttolitroScheda != null ? conferma.dosePerEttolitroScheda : '';
    return '<option value="' + esc(p.id) + '" data-unita="' + esc(p.unitaMisura || '') + '" data-dose-hl="' + esc(doseHl) + '">'
      + esc(p.nome || p.codice || p.id) + '</option>';
  }).join('');
  if (corrente) sel.value = corrente;
}
