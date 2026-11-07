/**
 * Intervista Gestione lavori con la cascata reale dei select:
 * la categoria ricarica le sottocategorie, sottocategoria e terreno
 * ricaricano i tipi in async e il value del tipo è il nome, come in pagina.
 * Dati fittizi, nessun tenant.
 *
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { beforeEach, describe, expect, it } from 'vitest';
import { filterTipiLavoroByCategoria, listedSelectValue } from '../core/js/lavoro-cascade-filters.js';

const CAPO = { id: 'cap-neri-bosco-01', uid: 'uid-neri-bosco', nome: 'Neri', cognome: 'Bosco', ruoli: ['caposquadra'], stato: 'attivo' };
const OPERAIO = { id: 'op-blu-fontana-01', uid: 'uid-blu-fontana', nome: 'Blu', cognome: 'Fontana', ruoli: ['operaio'], stato: 'attivo' };
const VIGNA = { id: 'ter-vigna-nord', nome: 'Vigna del Nord', coltura: 'Vite' };
const CAT_POT = { id: 'cat-potatura', nome: 'Potatura', applicabileA: 'lavori' };
const CAT_LAV = { id: 'cat-lav', nome: 'Lavorazione del Terreno', applicabileA: 'lavori' };
const SUB_MAN = { id: 'sub-pot-man', nome: 'Manuale', parentId: 'cat-potatura', codice: 'potatura_manuale' };
const SUB_MEC = { id: 'sub-pot-mec', nome: 'Meccanico', parentId: 'cat-potatura', codice: 'potatura_meccanico' };
const SUB_TRA = { id: 'sub-tra', nome: 'Tra le File', parentId: 'cat-lav', codice: 'lav_tra' };
const SUB_GEN = { id: 'sub-gen', nome: 'Generale', parentId: 'cat-lav', codice: 'lav_gen' };
const TIPI = [
  { id: 't-prod', nome: 'Potatura di Produzione', categoriaId: 'cat-potatura', sottocategoriaId: 'sub-pot-man' },
  { id: 't-rin', nome: 'Potatura di Rinnovamento', categoriaId: 'cat-potatura', sottocategoriaId: 'sub-pot-man' },
  { id: 't-verde', nome: 'Potatura a Verde Meccanica', categoriaId: 'cat-potatura', sottocategoriaId: 'sub-pot-mec' },
  { id: 't-pot', nome: 'Potatura', categoriaId: 'cat-potatura', sottocategoriaId: 'sub-pot-man' }
];

const LOAD_MS = 450;

function loadInjector() {
  const mapping = readFileSync(resolve(process.cwd(), 'core/config/tony-form-mapping.js'), 'utf8');
  const code = readFileSync(resolve(process.cwd(), 'core/js/tony-form-injector.js'), 'utf8');
  vm.runInThisContext(mapping);
  vm.runInThisContext(code);
  return globalThis.TonyFormInjector;
}

function option(select, value, text) {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = text;
  select.appendChild(o);
}

function selectedText(id) {
  const el = document.getElementById(id);
  const opt = el && el.selectedOptions && el.selectedOptions[0];
  return opt ? String(opt.textContent || '').trim() : '';
}

function subsFor(parentId) {
  const map = window.lavoriState.sottocategorieLavoriMap;
  return (map && map.get(parentId)) || [];
}

function placeholder(select, text) {
  select.innerHTML = '';
  option(select, '', text);
}

function reloadTipi(categoriaId, capturedValue, capturedText) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const select = document.getElementById('lavoro-tipo-lavoro');
      if (!select) {
        resolve();
        return;
      }
      const previous = String(select.value || '');
      const filtered = filterTipiLavoroByCategoria(
        categoriaId,
        window.lavoriState.tipiLavoroList,
        window.lavoriState.categorieLavoriPrincipali,
        window.lavoriState.sottocategorieLavoriMap
      );
      placeholder(select, '-- Seleziona tipo lavoro --');
      const keep = previous && filtered.some((t) => t.nome === previous) ? previous : '';
      filtered.forEach((t) => {
        const o = document.createElement('option');
        o.value = t.nome;
        o.textContent = t.nome;
        if (keep && keep === t.nome) o.selected = true;
        select.appendChild(o);
      });
      if (capturedValue && Array.from(select.options).some((o) => o.value === capturedValue)) {
        select.value = capturedValue;
      } else if (capturedText && !/seleziona/i.test(capturedText)) {
        const search = capturedText.trim().toLowerCase();
        const opt = Array.from(select.options).find((o) => String(o.textContent || '').trim().toLowerCase() === search);
        if (opt) select.value = opt.value;
      }
      resolve();
    }, LOAD_MS);
  });
}

function bindPageCascade() {
  const form = document.getElementById('lavoro-form');
  const subSelect = document.getElementById('lavoro-sottocategoria');
  form.addEventListener('change', (event) => {
    const target = event.target;
    if (!target || !target.id) return;
    if (target.id === 'lavoro-categoria-principale') {
      const categoriaId = listedSelectValue(target);
      const preserveSub = listedSelectValue(subSelect);
      placeholder(subSelect, '-- Nessuna sottocategoria --');
      if (categoriaId) {
        subsFor(categoriaId).forEach((sub) => {
          const o = document.createElement('option');
          o.value = sub.id;
          o.textContent = sub.nome;
          if (preserveSub && preserveSub === sub.id) o.selected = true;
          subSelect.appendChild(o);
        });
        const filterId = listedSelectValue(subSelect) || categoriaId;
        reloadTipi(filterId, '', '');
      }
      return;
    }
    if (target.id === 'lavoro-sottocategoria' || target.id === 'lavoro-terreno') {
      const categoriaId = listedSelectValue(document.getElementById('lavoro-categoria-principale'));
      const subId = listedSelectValue(subSelect);
      const filterId = target.id === 'lavoro-sottocategoria' ? (subId || categoriaId) : (subId || categoriaId);
      if (!filterId) return;
      if (target.id === 'lavoro-terreno' && !categoriaId && !subId) return;
      const tipo = document.getElementById('lavoro-tipo-lavoro');
      const capturedValue = tipo ? tipo.value : '';
      const capturedText = tipo && tipo.selectedIndex >= 0 ? (tipo.options[tipo.selectedIndex].textContent || '') : '';
      reloadTipi(filterId, capturedValue, capturedText);
    }
  });
}

function mountForm() {
  document.body.innerHTML = `
    <div id="lavoro-modal" class="active">
      <form id="lavoro-form">
        <input id="lavoro-nome" />
        <select id="lavoro-terreno"><option value="">Seleziona terreno...</option></select>
        <select id="lavoro-categoria-principale"><option value="">Seleziona...</option></select>
        <div id="lavoro-sottocategoria-group"><select id="lavoro-sottocategoria"><option value="">-- Nessuna sottocategoria --</option></select></div>
        <div id="tipo-lavoro-group"><select id="lavoro-tipo-lavoro"><option value="">-- Seleziona tipo lavoro --</option></select></div>
        <input type="radio" name="tipo-assegnazione" id="tipo-squadra" value="squadra" checked />
        <input type="radio" name="tipo-assegnazione" id="tipo-autonomo" value="autonomo" />
        <select id="lavoro-caposquadra"><option value="">Seleziona caposquadra...</option></select>
        <select id="lavoro-operaio"><option value="">Seleziona operaio...</option></select>
        <select id="lavoro-operatore-macchina"><option value=""></option></select>
        <input id="lavoro-data-inizio" />
        <input id="lavoro-durata" />
        <select id="lavoro-trattore"><option value=""></option><option value="tr-1">Trattore finto</option></select>
        <select id="lavoro-attrezzo"><option value=""></option><option value="at-1">Forbici finte</option></select>
      </form>
    </div>`;
  bindPageCascade();
}

function fixtureState() {
  window.__lavoriFormDataReady = true;
  const subMap = new Map([
    ['cat-potatura', [SUB_MAN, SUB_MEC]],
    ['cat-lav', [SUB_TRA, SUB_GEN]]
  ]);
  window.lavoriState = {
    hasManodoperaModule: true,
    hasParcoMacchineModule: false,
    terreniList: [VIGNA],
    tipiLavoroList: TIPI.slice(),
    categorieLavoriPrincipali: [CAT_POT, CAT_LAV],
    sottocategorieLavoriMap: subMap,
    caposquadraList: [CAPO],
    operaiList: [OPERAIO],
    trattoriList: [{ id: 'tr-1', nome: 'Trattore finto', stato: 'attivo' }],
    attrezziList: [{ id: 'at-1', nome: 'Forbici finte', stato: 'attivo', tipoMacchina: 'attrezzo' }]
  };
  window.Tony = { context: { lavori: window.lavoriState } };
  const terr = document.getElementById('lavoro-terreno');
  const cat = document.getElementById('lavoro-categoria-principale');
  const capo = document.getElementById('lavoro-caposquadra');
  const op = document.getElementById('lavoro-operaio');
  option(terr, VIGNA.id, VIGNA.nome);
  option(cat, CAT_POT.id, CAT_POT.nome);
  option(cat, CAT_LAV.id, CAT_LAV.nome);
  option(capo, CAPO.id, `${CAPO.nome} ${CAPO.cognome}`);
  option(op, OPERAIO.id, `${OPERAIO.nome} ${OPERAIO.cognome}`);
}

function snapshot(message) {
  return {
    message,
    nome: document.getElementById('lavoro-nome').value,
    terreno: document.getElementById('lavoro-terreno').value,
    categoria: selectedText('lavoro-categoria-principale'),
    sottocategoria: selectedText('lavoro-sottocategoria'),
    tipo: selectedText('lavoro-tipo-lavoro'),
    capo: document.getElementById('lavoro-caposquadra').value,
    operaio: document.getElementById('lavoro-operaio').value,
    squadra: document.getElementById('tipo-squadra').checked,
    autonomo: document.getElementById('tipo-autonomo').checked,
    data: document.getElementById('lavoro-data-inizio').value,
    durata: document.getElementById('lavoro-durata').value
  };
}

async function settle() {
  await new Promise((r) => setTimeout(r, LOAD_MS + 80));
}

describe('intervista lavoro — cascata pagina', () => {
  let api;

  beforeEach(() => {
    document.body.innerHTML = '';
    api = loadInjector();
    mountForm();
    fixtureState();
    api.resetLavoroInterviewSessionState();
    window.__tonyLavoroCreationFlow = true;
  });

  it('frase completa tiene tipo, sottocategoria e persona e chiede la data', async () => {
    const frase = 'Crea un lavoro di potatura manuale di produzione chiamato Filare positivo sul terreno Vigna del Nord assegnato al caposquadra Neri Bosco';
    const res = await api.applyLavoroInterviewFromUserReply(frase);
    await settle();
    const snap = snapshot(res.message);
    expect(snap.nome).toBe('Filare positivo');
    expect(snap.terreno).toBe(VIGNA.id);
    expect(snap.capo).toBe(CAPO.id);
    expect(snap.squadra).toBe(true);
    expect(snap.autonomo).toBe(false);
    expect(snap.operaio).toBe('');
    expect(snap.sottocategoria).toBe('Manuale');
    expect(snap.tipo).toBe('Potatura di Produzione');
    expect(snap.message).toMatch(/Quando vuoi iniziare/i);
    expect(snap.message).not.toMatch(/Che tipo di lavoro|manuale o meccanica|quale usare/i);

    const tipoEl = document.getElementById('lavoro-tipo-lavoro');
    const subEl = document.getElementById('lavoro-sottocategoria');
    tipoEl.innerHTML = '<option value="">-- Seleziona tipo lavoro --</option><option value="Potatura di Produzione">Potatura di Produzione</option><option value="Potatura di Rinnovamento">Potatura di Rinnovamento</option>';
    subEl.innerHTML = '<option value="">-- Nessuna sottocategoria --</option><option value="sub-pot-man">Manuale</option><option value="sub-pot-mec">Meccanico</option>';
    await new Promise((r) => setTimeout(r, 0));
    expect(tipoEl.value).toBe('Potatura di Produzione');
    expect(selectedText('lavoro-sottocategoria')).toBe('Manuale');

    const dopo = await api.applyLavoroInterviewFromUserReply('domani');
    await settle();
    const snap2 = snapshot(dopo.message);
    expect(snap2.tipo).toBe('Potatura di Produzione');
    expect(snap2.sottocategoria).toBe('Manuale');
    expect(snap2.nome).toBe('Filare positivo');
    expect(snap2.capo).toBe(CAPO.id);
    expect(snap2.data).not.toBe('');
    expect(snap2.message).toMatch(/giorni/i);
  }, 30000);

  it('sequenza guidata non torna al tipo dopo squadra e persona', async () => {
    const turns = [
      'Crea un lavoro di potatura chiamato Filare positivo',
      'Vigna del Nord',
      'Manuale',
      'Potatura di Produzione',
      'Lavoro di squadra',
      'Neri Bosco'
    ];
    const messages = [];
    let last = null;
    for (const turn of turns) {
      last = await api.applyLavoroInterviewFromUserReply(turn);
      await settle();
      messages.push(last && last.message);
    }
    expect(messages[2]).toMatch(/Potatura di Produzione/);
    expect(messages[2]).toMatch(/Rinnovamento/);
    expect(messages[2]).toMatch(/nome esatto/i);
    expect(messages[3]).toMatch(/squadra o lo assegno/i);
    expect(messages[4]).toMatch(/caposquadra/i);
    const snap = snapshot(last.message);
    expect(snap.nome).toBe('Filare positivo');
    expect(snap.terreno).toBe(VIGNA.id);
    expect(snap.sottocategoria).toBe('Manuale');
    expect(snap.tipo).toBe('Potatura di Produzione');
    expect(snap.capo).toBe(CAPO.id);
    expect(snap.squadra).toBe(true);
    expect(snap.message).toMatch(/Quando vuoi iniziare/i);
    expect(snap.message).not.toMatch(/Che tipo di lavoro|manuale o meccanica/i);
  }, 40000);

  it('caposquadra detto con un operaio non cambia ruolo e non riempie l’operaio', async () => {
    const frase = 'Crea un lavoro di potatura manuale di produzione chiamato Filare positivo sul terreno Vigna del Nord assegnato al caposquadra Blu Fontana';
    const res = await api.applyLavoroInterviewFromUserReply(frase);
    await settle();
    const snap = snapshot(res.message);
    expect(snap.capo).toBe('');
    expect(snap.operaio).toBe('');
    expect(snap.autonomo).toBe(false);
    expect(snap.squadra).toBe(true);
    expect(res.message).toMatch(/caposquadra/i);
    expect(res.message).not.toMatch(/Chi sono|Non ho riconosciuto/i);
  }, 30000);

  it('nome assente resta vuoto', async () => {
    document.getElementById('lavoro-terreno').value = VIGNA.id;
    document.getElementById('lavoro-categoria-principale').value = CAT_POT.id;
    document.getElementById('lavoro-categoria-principale').dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    window.__tonyLavoroAssignModeConfirmed = true;
    window.__tonyLavoroConfirmedAssignMode = 'squadra';
    window.__tonyLastLavoroInterviewQuestion = 'A quale caposquadra assegno il lavoro?';
    const res = await api.applyLavoroInterviewFromUserReply('Ilaria Conte');
    expect(document.getElementById('lavoro-caposquadra').value).toBe('');
    expect(document.getElementById('lavoro-operaio').value).toBe('');
    expect(document.getElementById('tipo-autonomo').checked).toBe(false);
    expect(res.message).toMatch(/Non ho trovato/i);
  }, 20000);
});
