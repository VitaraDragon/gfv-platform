/**
 * Miscela prevista sul form lavoro. Visibile solo se il tipo è un trattamento.
 * Senza Magazzino resta disponibile l'inserimento a testo libero.
 * @module shared/js/registro-trattamenti-lavoro
 */

import {
  calcolaMiscela,
  avvisoImpieghiEIntervallo,
  NOTA_REGISTRO_PRIVATO,
  confermaSpecieSalvata,
  stessoProdotto,
  messaggiUnici
} from './registro-trattamenti.js';
import { htmlCardProdottoAgganciato, htmlPannelloOpenData } from './registro-trattamenti-form.js';
import { cercaProdottiEtichetta } from './registro-trattamenti-conformita.js';
import {
  caricaIndiceEtichette,
  caricaSchedaEtichetta,
  caricaVocabolarioColture,
  numeroFileEtichetta,
  preparaEtichetta
} from './registro-trattamenti-etichetta.js';

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Garantisce un'opzione nella select e la seleziona.
 * Serve in Modifica: prodotto/avversità salvati si vedono subito, senza aspettare
 * magazzino o etichetta.
 * @param {HTMLSelectElement|null|undefined} select
 * @param {string} value
 * @param {string} [label]
 */
export function assicuratiOpzioneSelect(select, value, label) {
  if (!select || value == null) return;
  const v = String(value).trim();
  if (!v) return;
  const esiste = Array.from(select.options || []).some((opt) => String(opt.value || '') === v);
  if (!esiste) {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = label != null && String(label).trim() ? String(label).trim() : v;
    select.appendChild(opt);
  }
  select.value = v;
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
  const salvata = nodo && nodo.getAttribute ? String(nodo.getAttribute('data-avversita') || '').trim() : '';
  if (!select) return salvata;
  const opzioni = Array.from(select.options || []).filter((opt) => String(opt.value || '').trim());
  if (!opzioni.length) return salvata;
  return '';
}

function testoAvversitaProdotto(prodotto) {
  if (!prodotto) return '';
  return String(prodotto.avversitaPianificata || prodotto.avversita || '').trim();
}

/** In magazzino resta il nome di magazzino. Sul libero si mostra il nome della scheda. */
function nomeVisibileProdotto(p) {
  if (!p) return '';
  if (p.prodottoId) return String(p.nome || '').trim();
  const scheda = p.riferimentoRiga && String(p.riferimentoRiga.nomeProdotto || '').trim();
  return scheda || String(p.nome || '').trim();
}

function testoAttributo(nodo, nome) {
  if (!nodo || !nodo.getAttribute) return '';
  return String(nodo.getAttribute(nome) || '').trim();
}

/** Legame proposto sulla riga libera. Con un prodotto di magazzino non si sovrascrive. */
function legameDalNodo(nodo, prodottoId) {
  if (prodottoId) return null;
  const numero = numeroFileEtichetta(testoAttributo(nodo, 'data-numero-registrazione'));
  const nomeScheda = testoAttributo(nodo, 'data-nome-scheda');
  if (!numero && !nomeScheda) return null;
  const legame = {
    riferimentoRiga: {
      nomeProdotto: nomeScheda,
      numeroRegistrazione: numero,
      colturaScheda: ''
    }
  };
  if (numero) legame.numeroRegistrazioneLetto = numero;
  return legame;
}

function scriviLegameSulNodo(nodo, prodotto) {
  if (!nodo) return;
  const daMagazzino = !!(prodotto && prodotto.prodottoId);
  const rif = !daMagazzino && prodotto && prodotto.riferimentoRiga;
  const numero = daMagazzino
    ? ''
    : numeroFileEtichetta((prodotto && prodotto.numeroRegistrazioneLetto) || (rif && rif.numeroRegistrazione) || '');
  const nomeScheda = daMagazzino ? '' : String((rif && rif.nomeProdotto) || '').trim();
  if (numero) nodo.setAttribute('data-numero-registrazione', numero);
  else nodo.removeAttribute('data-numero-registrazione');
  if (nomeScheda) nodo.setAttribute('data-nome-scheda', nomeScheda);
  else nodo.removeAttribute('data-nome-scheda');
  if ((numero || nomeScheda) && nodo.tagName === 'INPUT') {
    const legato = String(nodo.value || '').trim();
    if (legato) nodo.setAttribute('data-nome-legato', legato);
    else nodo.removeAttribute('data-nome-legato');
  } else {
    nodo.removeAttribute('data-nome-legato');
  }
}

/** Spazi e maiuscole non distinguono il nome con cui è stato fatto il legame. */
function nomeLegameConfronto(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '');
}

function legameNomeAncoraValido(nodo) {
  const legato = testoAttributo(nodo, 'data-nome-legato');
  if (!legato) return false;
  return nomeLegameConfronto(nodo.value) === nomeLegameConfronto(legato);
}

function nodoHaLegameScheda(nodo) {
  return !!(
    testoAttributo(nodo, 'data-numero-registrazione')
    || testoAttributo(nodo, 'data-nome-scheda')
    || testoAttributo(nodo, 'data-nome-legato')
  );
}

/** Il nome libero non è più quello della scheda: il legame non deve valutare l'etichetta vecchia. */
function staccaLegameSeNomeDiverso(nodo) {
  if (!nodo || !nodoHaLegameScheda(nodo) || legameNomeAncoraValido(nodo)) return;
  scriviLegameSulNodo(nodo, null);
  scriviEsitoLavoro('');
  const daEtichetta = document.getElementById('lavoro-dose-etichetta');
  if (daEtichetta) daEtichetta.textContent = '';
  const dose = document.getElementById('lavoro-miscela-dose-ha');
  if (dose) dose.dispatchEvent(new Event('change', { bubbles: true }));
}

function copiaLegameTraNodi(da, a) {
  if (!da || !a) return;
  ['data-numero-registrazione', 'data-nome-scheda'].forEach((attr) => {
    const valore = testoAttributo(da, attr);
    if (valore) a.setAttribute(attr, valore);
    else a.removeAttribute(attr);
  });
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
  const nomeInput = document.getElementById('lavoro-miscela-nome');
  const nomeLibero = nomeInput?.value?.trim() || '';
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
    const legame = legameDalNodo(nomeInput, id);
    if (legame) Object.assign(riga, legame);
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
    const legameExtra = legameDalNodo(tr, extraId);
    if (legameExtra) Object.assign(riga, legameExtra);
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
  if (sel && primo && primo.prodottoId) {
    assicuratiOpzioneSelect(sel, primo.prodottoId, nomeVisibileProdotto(primo));
  }
  if (nome) nome.value = primo && !primo.prodottoId ? nomeVisibileProdotto(primo) : '';
  if (dose) dose.value = primo && primo.dosePerEttaro != null ? primo.dosePerEttaro : '';
  const avversita = document.getElementById('lavoro-miscela-avversita');
  if (avversita) {
    const testo = testoAvversitaProdotto(primo);
    if (testo) {
      avversita.setAttribute('data-avversita', testo);
      assicuratiOpzioneSelect(avversita, testo);
    } else {
      avversita.removeAttribute('data-avversita');
      avversita.value = '';
    }
  }
  scriviLegameSulNodo(nome, primo && !primo.prodottoId ? primo : null);
  const tbody = document.getElementById('tbody-miscela-lavoro');
  if (!tbody) return;
  tbody.innerHTML = prodotti.slice(1).map((p) => rigaExtraMiscela(p)).join('');
}

function attributiLegameHtml(p) {
  if (p && p.prodottoId) return '';
  const rif = p && p.riferimentoRiga;
  const numero = numeroFileEtichetta((p && p.numeroRegistrazioneLetto) || (rif && rif.numeroRegistrazione) || '');
  const nomeScheda = String((rif && rif.nomeProdotto) || '').trim();
  return ' data-numero-registrazione="' + esc(numero) + '" data-nome-scheda="' + esc(nomeScheda) + '"';
}

function celleExtraMiscela(p) {
  const avversita = testoAvversitaProdotto(p);
  const nome = nomeVisibileProdotto(p);
  const optAvversita = avversita
    ? '<option value="' + esc(avversita) + '" selected>' + esc(avversita) + '</option>'
    : '';
  return '<td>' + esc(nome) + ' <span class="lavoro-semaforo-pallino"></span></td>'
    + '<td><select class="miscela-avversita-extra" data-avversita="' + esc(avversita) + '"><option value="">— da scegliere —</option>' + optAvversita + '</select></td>'
    + '<td><input type="number" class="miscela-dose-extra" min="0" step="0.001" value="' + esc(p.dosePerEttaro != null ? p.dosePerEttaro : '') + '"></td>'
    + '<td><span class="lavoro-dose-etichetta-extra"></span></td>'
    + '<td><button type="button" class="btn btn-sm btn-secondary btn-leggi-scheda">Leggi scheda</button> '
    + '<button type="button" class="btn btn-sm btn-danger miscela-togli">Togli</button></td>';
}

function rigaExtraMiscela(p) {
  const avversita = testoAvversitaProdotto(p);
  const nome = nomeVisibileProdotto(p);
  return '<tr data-extra="1" data-prodotto-id="' + esc(p.prodottoId || '') + '" data-nome="' + esc(nome) + '" data-unita="' + esc(p.unita || '') + '" data-dose-hl="' + esc(p.dosePerEttolitro != null ? p.dosePerEttolitro : '') + '" data-avversita="' + esc(avversita) + '"' + attributiLegameHtml(p) + '>'
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
  return messaggiUnici(messaggi);
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
  scriviLegameSulNodo(nome, null);
}

let prodottiLeggiScheda = [];
let rigaLeggiScheda = null;

function scriviEsitoLavoro(html) {
  const el = document.getElementById('lavoro-scheda-esito');
  if (!el) return null;
  el.innerHTML = html || '';
  return el;
}

function vociIndice(lista) {
  return (lista || []).map((p) => ({
    denominazione: p && p.nome_prodotto ? String(p.nome_prodotto) : '',
    numeroRegistrazione: numeroFileEtichetta(p && p.numero_registrazione) || ''
  })).filter((p) => p.denominazione || p.numeroRegistrazione);
}

function disegnaSceltaIndice(nome) {
  scriviEsitoLavoro(htmlPannelloOpenData({
    esito: { prodotti: prodottiLeggiScheda },
    nome,
    soloScelta: true
  }));
}

async function cercaEDisegna(nome) {
  const richiesto = String(nome || '').trim();
  if (!richiesto) {
    scriviEsitoLavoro('<p>Indica prima il nome del prodotto.</p>');
    return;
  }
  scriviEsitoLavoro('<p>Cerco il prodotto nell\'indice delle etichette…</p>');
  let indice = { prodotti: [] };
  try {
    indice = await caricaIndiceEtichette();
  } catch (e) {
    scriviEsitoLavoro('<p>L\'indice delle etichette non si legge. Non invento numero, titolare o stato.</p>');
    return;
  }
  prodottiLeggiScheda = vociIndice(cercaProdottiEtichetta(richiesto, indice));
  disegnaSceltaIndice(richiesto);
}

function scriviNomeScelto(nodo, nomeScheda) {
  const nome = String(nomeScheda || '').trim();
  if (!nodo || !nome) return;
  if (nodo.tagName === 'INPUT') {
    nodo.value = nome;
    return;
  }
  if (nodo.getAttribute && nodo.getAttribute('data-extra') != null) {
    nodo.setAttribute('data-nome', nome);
    const cella = nodo.querySelector('td');
    if (!cella) return;
    const pallino = cella.querySelector('.lavoro-semaforo-pallino');
    cella.textContent = nome + ' ';
    if (pallino) cella.appendChild(pallino);
  }
}

async function applicaProdottoScelto(prodotto) {
  if (!prodotto) return;
  const numero = numeroFileEtichetta(prodotto.numeroRegistrazione);
  const nomeScheda = String(prodotto.denominazione || '').trim();
  const nodo = rigaLeggiScheda || document.getElementById('lavoro-miscela-nome');
  scriviNomeScelto(nodo, nomeScheda);
  scriviLegameSulNodo(nodo, {
    numeroRegistrazioneLetto: numero || null,
    riferimentoRiga: {
      nomeProdotto: nomeScheda,
      numeroRegistrazione: numero,
      colturaScheda: ''
    }
  });
  let scheda = null;
  try {
    scheda = numero ? await caricaSchedaEtichetta(numero) : null;
    if (scheda) {
      const vocabolario = await caricaVocabolarioColture();
      preparaEtichetta({ scheda, coltura: '', vocabolario, avversitaScelta: '' });
    }
  } catch (e) {
    scheda = null;
  }
  scriviEsitoLavoro(htmlCardProdottoAgganciato({
    numeroRegistrazioneLetto: numero || null,
    riferimentoRiga: {
      nomeProdotto: nomeScheda,
      numeroRegistrazione: numero,
      colturaScheda: ''
    }
  }, scheda));
  const dose = document.getElementById('lavoro-miscela-dose-ha');
  if (dose) dose.dispatchEvent(new Event('change', { bubbles: true }));
}

/** «Leggi scheda» sulla miscela prevista: stesso indice e stesso pannello del registro, senza conferma. */
export function attaccaLeggiSchedaLavoro() {
  const section = document.getElementById('lavoro-miscela-section');
  if (!section || section.dataset.leggiScheda === '1') return;
  section.dataset.leggiScheda = '1';
  const nomeCampo = document.getElementById('lavoro-miscela-nome');
  if (nomeCampo) {
    nomeCampo.addEventListener('input', () => staccaLegameSeNomeDiverso(nomeCampo));
  }
  section.addEventListener('click', (evento) => {
    const nodo = evento.target && evento.target.closest ? evento.target : null;
    if (!nodo || !nodo.closest) return;
    const scegli = nodo.closest('[data-scegli-prodotto]');
    if (scegli && section.contains(scegli)) {
      const indice = Number(scegli.getAttribute('data-scegli-prodotto'));
      applicaProdottoScelto(prodottiLeggiScheda[indice]);
      return;
    }
    const riprova = nodo.closest('[data-riprova-numero]');
    if (riprova && section.contains(riprova)) {
      const numero = String(section.querySelector('.registro-numero-manuale')?.value || '').trim();
      if (!numero) return;
      cercaEDisegna(numero);
      return;
    }
    const btn = nodo.closest('.btn-leggi-scheda');
    if (!btn || !section.contains(btn)) return;
    const tr = btn.closest('tr[data-extra]');
    const giaAgganciata = tr && (
      String(tr.getAttribute('data-numero-registrazione') || '').trim()
      || String(tr.getAttribute('data-nome-scheda') || '').trim()
    );
    if (tr && String(tr.getAttribute('data-prodotto-id') || '').trim() && !giaAgganciata) {
      scriviEsitoLavoro('<p>Questo prodotto arriva dal magazzino: il numero già in anagrafica non si sostituisce.</p>');
      return;
    }
    rigaLeggiScheda = tr || null;
    const nome = tr
      ? String(tr.getAttribute('data-nome') || '').trim()
      : String(document.getElementById('lavoro-miscela-nome')?.value || '').trim();
    cercaEDisegna(nome);
  });
}

export function installaMiscelaLavoro(opts = {}) {
  const form = document.getElementById('lavoro-form');
  if (!form || form.dataset.miscelaRegistro === '1') return;
  form.dataset.miscelaRegistro = '1';
  attaccaLeggiSchedaLavoro();
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
    if (id === 'lavoro-miscela-prodotto' && String(target && target.value || '').trim()) {
      scriviLegameSulNodo(document.getElementById('lavoro-miscela-nome'), null);
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
      const nomeNodo = document.getElementById('lavoro-miscela-nome');
      if (id) scriviLegameSulNodo(nomeNodo, null);
      else copiaLegameTraNodi(nomeNodo, tr);
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
