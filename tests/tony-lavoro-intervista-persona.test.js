/**
 * Intervista Gestione lavori: persona reale (nome o id), campi che restano,
 * domanda sul dato davvero mancante. Dati fittizi, nessun tenant.
 *
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { beforeEach, describe, expect, it } from 'vitest';

const TIPO_NON_REGISTRATO =
  'Non ho ancora registrato il tipo di lavoro. Ripeti con il nome esatto (es. potatura di produzione).';

const CAPO = { id: 'cap-neri-bosco-01', uid: 'uid-neri-bosco', nome: 'Neri', cognome: 'Bosco', ruoli: ['caposquadra'], stato: 'attivo' };
const OPERAIO = { id: 'op-blu-fontana-01', uid: 'uid-blu-fontana', nome: 'Blu', cognome: 'Fontana', ruoli: ['operaio'], stato: 'attivo' };
const VIGNA = { id: 'ter-vigna-nord', nome: 'Vigna del Nord', coltura: 'Vite' };
const OLMO_1 = { id: 'ter-olmo-1', nome: 'Olmo Frutto 1', coltura: 'Melo' };
const OLMO_2 = { id: 'ter-olmo-2', nome: 'Olmo Campo 2', coltura: 'Olivo' };
const TIPI = [
  { id: 'tipo-pot-prod', nome: 'Potatura di Produzione' },
  { id: 'tipo-pot-all', nome: 'Potatura manuale di allevamento' },
  { id: 'tipo-pot-mecc', nome: 'Potatura meccanica' },
  { id: 'tipo-pot-verde', nome: 'Potatura verde' }
];

function loadInjector() {
  const code = readFileSync(resolve(process.cwd(), 'core/js/tony-form-injector.js'), 'utf8');
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
  return opt ? String(opt.textContent || '') : '';
}

function mountForm() {
  document.body.innerHTML = `
    <div id="lavoro-modal" class="active">
      <form id="lavoro-form">
        <input id="lavoro-nome" />
        <select id="lavoro-terreno"><option value="">Seleziona terreno...</option></select>
        <select id="lavoro-categoria-principale"><option value="">Seleziona...</option></select>
        <select id="lavoro-sottocategoria"><option value="">Seleziona...</option></select>
        <select id="lavoro-tipo-lavoro"><option value="">Seleziona tipo...</option></select>
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
  const form = document.getElementById('lavoro-form');
    form.addEventListener('change', (event) => {
    const id = event.target && event.target.id;
    if (id !== 'lavoro-terreno' && id !== 'lavoro-sottocategoria' && id !== 'lavoro-categoria-principale') return;
    const tipo = document.getElementById('lavoro-tipo-lavoro');
    const preserveValue = tipo.value;
    const preserveText = selectedText('lavoro-tipo-lavoro');
    setTimeout(() => {
      const current = document.getElementById('lavoro-tipo-lavoro');
      if (!current) return;
      const nowValue = current.value;
      const nowText = selectedText('lavoro-tipo-lavoro');
      refillTipi(nowValue || preserveValue, nowValue ? nowText : preserveText);
    }, 0);
  });
}

function refillTipi(preserveValue, preserveText) {
  const tipo = document.getElementById('lavoro-tipo-lavoro');
  if (!tipo) return;
  tipo.innerHTML = '<option value="">Seleziona tipo...</option>';
  TIPI.forEach((t) => option(tipo, t.id, t.nome));
  if (preserveValue && Array.from(tipo.options).some((o) => o.value === preserveValue)) {
    tipo.value = preserveValue;
    return;
  }
  const search = String(preserveText || '').trim().toLowerCase();
  if (!search || /seleziona/.test(search)) return;
  const opt = Array.from(tipo.options).find((o) => String(o.textContent || '').trim().toLowerCase() === search);
  if (opt) tipo.value = opt.value;
}

function fixtureState() {
  window.__lavoriFormDataReady = true;
  window.lavoriState = {
    hasManodoperaModule: true,
    hasParcoMacchineModule: false,
    terreniList: [VIGNA, OLMO_1, OLMO_2],
    tipiLavoroList: TIPI.slice(),
    categorieLavoriPrincipali: [{ id: 'cat-lav', nome: 'Lavorazione' }],
    caposquadraList: [CAPO],
    operaiList: [OPERAIO],
    trattoriList: [{ id: 'tr-1', nome: 'Trattore finto', stato: 'attivo' }],
    attrezziList: [{ id: 'at-1', nome: 'Forbici finte', stato: 'attivo', tipoMacchina: 'attrezzo' }]
  };
  window.Tony = { context: { lavori: window.lavoriState } };
  const terr = document.getElementById('lavoro-terreno');
  const cat = document.getElementById('lavoro-categoria-principale');
  const sub = document.getElementById('lavoro-sottocategoria');
  const capo = document.getElementById('lavoro-caposquadra');
  const op = document.getElementById('lavoro-operaio');
  window.lavoriState.terreniList.forEach((t) => option(terr, t.id, t.nome));
  option(cat, 'cat-lav', 'Lavorazione');
  ['Tra le File', 'Sulla Fila', 'Generale', 'Meccanico'].forEach((nome) => option(sub, nome, nome));
  refillTipi('', '');
  option(capo, CAPO.id, `${CAPO.nome} ${CAPO.cognome}`);
  option(op, OPERAIO.id, `${OPERAIO.nome} ${OPERAIO.cognome}`);
}

function confirmMode(mode) {
  window.__tonyLavoroAssignModeConfirmed = true;
  window.__tonyLavoroConfirmedAssignMode = mode;
}

describe('intervista lavoro — persona reale e campi che restano', () => {
  let api;

  beforeEach(() => {
    document.body.innerHTML = '';
    api = loadInjector();
    mountForm();
    fixtureState();
    api.resetLavoroInterviewSessionState();
    window.__tonyLavoroCreationFlow = true;
  });

  it('il ramo persone non ripristina il valore grezzo', () => {
    const src = readFileSync(resolve(process.cwd(), 'core/js/tony-form-injector.js'), 'utf8');
    expect(src).not.toMatch(
      /caposquadraList \|\| stateKey === 'operaiList'\)[\s\S]{0,500}\|\| rawValue/
    );
  });

  it('caposquadra noto per nome e per id già risolto finisce nel select', async () => {
    document.getElementById('lavoro-terreno').value = VIGNA.id;
    document.getElementById('lavoro-tipo-lavoro').value = 'tipo-pot-prod';
    document.getElementById('lavoro-nome').value = 'Filare positivo';
    confirmMode('squadra');
    window.__tonyLastLavoroInterviewQuestion = 'A quale caposquadra assegno il lavoro?';

    const byName = await api.applyLavoroInterviewFromUserReply('Neri Bosco');
    expect(document.getElementById('lavoro-caposquadra').value).toBe(CAPO.id);
    expect(document.getElementById('lavoro-terreno').value).toBe(VIGNA.id);
    expect(document.getElementById('lavoro-tipo-lavoro').value).toBe('tipo-pot-prod');
    expect(document.getElementById('lavoro-nome').value).toBe('Filare positivo');
    expect(byName.message).not.toBe(TIPO_NON_REGISTRATO);
    expect(byName.message).not.toMatch(/caposquadra/i);

    document.getElementById('lavoro-caposquadra').value = '';
    const byId = await api.injectLavoroForm(
      { 'lavoro-caposquadra': CAPO.id },
      window.Tony.context,
      { patchOnly: true, selectWaitMs: 300, formReadyMaxMs: 300 }
    );
    expect(byId).toBe(true);
    expect(document.getElementById('lavoro-caposquadra').value).toBe(CAPO.id);

    document.getElementById('lavoro-caposquadra').value = '';
    await api.injectLavoroForm(
      { 'lavoro-caposquadra': CAPO.uid },
      window.Tony.context,
      { patchOnly: true, selectWaitMs: 300, formReadyMaxMs: 300 }
    );
    expect(document.getElementById('lavoro-caposquadra').value).toBe(CAPO.id);
  });

  it('operaio noto per nome e per id finisce nel select, non nel caposquadra', async () => {
    document.getElementById('tipo-autonomo').checked = true;
    document.getElementById('tipo-squadra').checked = false;
    confirmMode('autonomo');
    window.__tonyLastLavoroInterviewQuestion = 'A chi lo assegno?';
    const byName = await api.applyLavoroInterviewFromUserReply('Blu Fontana');
    expect(document.getElementById('lavoro-operaio').value).toBe(OPERAIO.id);
    expect(document.getElementById('lavoro-caposquadra').value).toBe('');
    expect(byName.message).not.toBe(TIPO_NON_REGISTRATO);

    document.getElementById('lavoro-operaio').value = '';
    await api.injectLavoroForm(
      { 'lavoro-operaio': OPERAIO.id, 'tipo-assegnazione': 'autonomo' },
      window.Tony.context,
      { patchOnly: true, selectWaitMs: 300, formReadyMaxMs: 300 }
    );
    expect(document.getElementById('lavoro-operaio').value).toBe(OPERAIO.id);
    expect(document.getElementById('lavoro-caposquadra').value).toBe('');
  });

  it('nome assente, id sconosciuto e id di un altro ruolo restano fuori dal campo', async () => {
    confirmMode('squadra');
    window.__tonyLastLavoroInterviewQuestion = 'A quale caposquadra assegno il lavoro?';
    const absent = await api.applyLavoroInterviewFromUserReply('Ilaria Conte');
    expect(document.getElementById('lavoro-caposquadra').value).toBe('');
    expect(absent.message).toMatch(/Non ho trovato «Ilaria Conte»/i);
    expect(absent.message).not.toBe(TIPO_NON_REGISTRATO);

    await api.injectLavoroForm(
      { 'lavoro-caposquadra': 'id-inesistente-0001' },
      window.Tony.context,
      { patchOnly: true, selectWaitMs: 300, formReadyMaxMs: 300 }
    );
    expect(document.getElementById('lavoro-caposquadra').value).toBe('');

    await api.injectLavoroForm(
      { 'lavoro-caposquadra': OPERAIO.id },
      window.Tony.context,
      { patchOnly: true, selectWaitMs: 300, formReadyMaxMs: 300 }
    );
    expect(document.getElementById('lavoro-caposquadra').value).toBe('');

    await api.injectLavoroForm(
      { 'lavoro-operaio': CAPO.id },
      window.Tony.context,
      { patchOnly: true, selectWaitMs: 300, formReadyMaxMs: 300 }
    );
    expect(document.getElementById('lavoro-operaio').value).toBe('');
  });

  it('con il tipo vuoto la persona valida non viene raccontata come tipo mancante', async () => {
    confirmMode('squadra');
    window.__tonyLastLavoroInterviewQuestion = 'A quale caposquadra assegno il lavoro?';
    const res = await api.applyLavoroInterviewFromUserReply('Neri Bosco');
    expect(document.getElementById('lavoro-caposquadra').value).toBe(CAPO.id);
    expect(res.message).not.toBe(TIPO_NON_REGISTRATO);
    expect(res.message).toMatch(/terreno/i);
    expect(document.getElementById('lavoro-tipo-lavoro').value).toBe('');
  });

  it('frase completa: ruolo, nome esplicito, terreno e tipo restano e la domanda è il dato mancante', async () => {
    const phrase = 'Crea un lavoro di potatura manuale di produzione chiamato Filare positivo sul terreno Vigna del Nord assegnato al caposquadra Neri Bosco';
    const patch = api.buildLavoroInterviewPatch(phrase);
    expect(patch['lavoro-caposquadra']).toBe(CAPO.id);
    expect(patch['lavoro-nome']).toBe('Filare positivo');
    expect(patch['lavoro-terreno']).toBe(VIGNA.id);
    expect(patch['lavoro-tipo-lavoro']).toBe('Potatura di Produzione');

    const res = await api.applyLavoroCreationTurn(phrase);
    expect(document.getElementById('lavoro-caposquadra').value).toBe(CAPO.id);
    expect(document.getElementById('lavoro-terreno').value).toBe(VIGNA.id);
    expect(selectedText('lavoro-tipo-lavoro')).toBe('Potatura di Produzione');
    expect(document.getElementById('lavoro-nome').value).toBe('Filare positivo');
    expect(res.readyForSave).toBe(false);
    expect(res.message).not.toBe(TIPO_NON_REGISTRATO);
    expect(res.message).not.toMatch(/caposquadra/i);
    expect(res.message).toMatch(/Quando vuoi iniziare/i);

    const next = await api.applyLavoroCreationTurn('domani');
    expect(document.getElementById('lavoro-caposquadra').value).toBe(CAPO.id);
    expect(document.getElementById('lavoro-terreno').value).toBe(VIGNA.id);
    expect(selectedText('lavoro-tipo-lavoro')).toBe('Potatura di Produzione');
    expect(document.getElementById('lavoro-nome').value).toBe('Filare positivo');
    expect(document.getElementById('lavoro-data-inizio').value).not.toBe('');
    expect(next.message).not.toBe(TIPO_NON_REGISTRATO);
    expect(next.message).toMatch(/giorni/i);
    expect(next.readyForSave).toBe(false);
  }, 20000);

  it('sequenza guidata non perde terreno, tipo, nome e caposquadra', async () => {
    const turns = [
      'Crea un lavoro di potatura chiamato Filare positivo',
      'Vigna del Nord',
      'Manuale',
      'Potatura di Produzione',
      'Lavoro di squadra',
      'Neri Bosco'
    ];
    let last = null;
    for (const turn of turns) {
      last = await api.applyLavoroCreationTurn(turn);
    }
    expect(document.getElementById('lavoro-nome').value).toBe('Filare positivo');
    expect(document.getElementById('lavoro-terreno').value).toBe(VIGNA.id);
    expect(selectedText('lavoro-tipo-lavoro')).toBe('Potatura di Produzione');
    expect(document.getElementById('lavoro-caposquadra').value).toBe(CAPO.id);
    expect(document.getElementById('tipo-squadra').checked).toBe(true);
    expect(last.message).not.toBe(TIPO_NON_REGISTRATO);
    expect(last.message).not.toMatch(/caposquadra/i);
    expect(last.message).toMatch(/Quando vuoi iniziare/i);
    expect(last.readyForSave).toBe(false);
  });

  it('un nome fuori roster che pareggia due terreni chiede il terreno e non assegna nessuno', async () => {
    const res = await api.applyLavoroInterviewFromUserReply('Olmo Verdi');
    expect(document.getElementById('lavoro-terreno').value).toBe('');
    expect(document.getElementById('lavoro-caposquadra').value).toBe('');
    expect(document.getElementById('lavoro-operaio').value).toBe('');
    expect(res.message).toMatch(/Olmo Frutto 1/);
    expect(res.message).toMatch(/Olmo Campo 2/);
  });
});
