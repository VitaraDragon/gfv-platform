/**
 * Domanda sui caposquadra durante l'intervista, errore sul token nome,
 * tendina non pronta, chiusura flusso senza toccare campi né chat.
 * Dati fittizi, nessun tenant.
 *
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { beforeEach, describe, expect, it } from 'vitest';

const CAPO = { id: 'cap-neri-bosco-01', uid: 'uid-neri', nome: 'Neri', cognome: 'Bosco', ruoli: ['caposquadra'], stato: 'attivo' };
const CAPO_OFF = { id: 'cap-spento-01', nome: 'Spento', cognome: 'Rossi', ruoli: ['caposquadra'], stato: 'sospeso' };
const MARIO = { id: 'op-mario-verdi-01', nome: 'Mario', cognome: 'Verdi', ruoli: ['operaio'], stato: 'attivo' };
const MARIO2 = { id: 'op-mario-rossi-01', nome: 'Mario', cognome: 'Rossi', ruoli: ['operaio'], stato: 'attivo' };
const OPERAIO_QA = { id: 'op-qa-01', nome: 'Operaio', cognome: 'QA', ruoli: ['operaio'], stato: 'attivo' };
const VIGNA = { id: 'ter-vigna-nord', nome: 'Vigna del Nord' };

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

function mount(people) {
  document.body.innerHTML = `
    <div id="lavoro-modal" class="active">
      <form id="lavoro-form">
        <input id="lavoro-nome" />
        <select id="lavoro-terreno"><option value="">Seleziona terreno...</option></select>
        <select id="lavoro-tipo-lavoro"><option value="">Seleziona tipo...</option></select>
        <input type="radio" name="tipo-assegnazione" id="tipo-squadra" value="squadra" checked />
        <input type="radio" name="tipo-assegnazione" id="tipo-autonomo" value="autonomo" />
        <select id="lavoro-caposquadra"><option value="">Seleziona caposquadra...</option></select>
        <select id="lavoro-operaio"><option value="">Seleziona operaio...</option></select>
        <select id="lavoro-operatore-macchina"><option value=""></option></select>
        <input id="lavoro-data-inizio" />
        <input id="lavoro-durata" />
      </form>
    </div>`;
  window.__lavoriFormDataReady = true;
  window.lavoriState = {
    hasManodoperaModule: true,
    hasParcoMacchineModule: false,
    terreniList: [VIGNA],
    tipiLavoroList: [{ id: 'tipo-pot', nome: 'Potatura di Produzione' }],
    categorieLavoriPrincipali: [{ id: 'cat', nome: 'Potatura' }],
    caposquadraList: people.capi,
    operaiList: people.operai,
    trattoriList: [],
    attrezziList: []
  };
  window.Tony = {
    context: { lavori: window.lavoriState },
    chatHistory: [
      { role: 'user', parts: [{ text: 'crea un lavoro' }] },
      { role: 'model', parts: [{ text: 'A quale caposquadra assegno il lavoro?' }] }
    ]
  };
  option(document.getElementById('lavoro-terreno'), VIGNA.id, VIGNA.nome);
  option(document.getElementById('lavoro-tipo-lavoro'), 'tipo-pot', 'Potatura di Produzione');
  const capo = document.getElementById('lavoro-caposquadra');
  const op = document.getElementById('lavoro-operaio');
  if (!people.omitOptions) {
    people.capi.filter((p) => !p.stato || p.stato === 'attivo').forEach((p) => option(capo, p.id, `${p.nome} ${p.cognome}`));
    people.operai.forEach((p) => option(op, p.id, `${p.nome} ${p.cognome}`));
  }
}

function campiAcquisiti() {
  document.getElementById('lavoro-nome').value = 'Filare positivo';
  document.getElementById('lavoro-terreno').value = VIGNA.id;
  document.getElementById('lavoro-tipo-lavoro').value = 'tipo-pot';
}

function expectCampiRimasti() {
  expect(document.getElementById('lavoro-nome').value).toBe('Filare positivo');
  expect(document.getElementById('lavoro-terreno').value).toBe(VIGNA.id);
  expect(document.getElementById('lavoro-tipo-lavoro').value).toBe('tipo-pot');
}

const roster = () => ({ capi: [CAPO, CAPO_OFF], operai: [OPERAIO_QA, MARIO] });

describe('intervista — domanda caposquadra, token, tendina, chiusura', () => {
  let api;

  beforeEach(() => {
    document.body.innerHTML = '';
    api = loadInjector();
    mount(roster());
    api.resetLavoroInterviewSessionState();
    window.__tonyLavoroCreationFlow = true;
    campiAcquisiti();
    window.__tonyLavoroAssignModeConfirmed = true;
    window.__tonyLavoroConfirmedAssignMode = 'squadra';
    window.__tonyLastLavoroInterviewQuestion = 'A quale caposquadra assegno il lavoro?';
  });

  it('con il modal aperto la domanda resta un elenco e conserva i campi', async () => {
    expect(api.userCanReplyToLavoroInterview('chi sono i caposquadra?')).toBe(true);
    const storia = window.Tony.chatHistory;
    const res = await api.applyLavoroInterviewFromUserReply('chi sono i caposquadra?');
    expect(res.message).toMatch(/Neri Bosco/);
    expect(res.message).not.toMatch(/Non ho trovato «chi sono/i);
    expect(res.message).not.toMatch(/Operaio QA|Mario Verdi|Spento Rossi/);
    expect(res.message).toMatch(/A quale caposquadra assegno il lavoro/i);
    expect(document.getElementById('lavoro-caposquadra').value).toBe('');
    expectCampiRimasti();
    expect(window.Tony.chatHistory).toBe(storia);
    expect(storia).toHaveLength(2);
  });

  it('«disponibili» e «quali sono» usano lo stesso elenco', async () => {
    const a = await api.applyLavoroInterviewFromUserReply('Chi sono i caposquadra disponibili?');
    const b = await api.applyLavoroInterviewFromUserReply('quali sono i caposquadra?');
    expect(a.message).toMatch(/Neri Bosco/);
    expect(b.message).toMatch(/Neri Bosco/);
    expect(a.message).not.toMatch(/Non ho trovato/i);
    expect(b.message).not.toMatch(/Non ho trovato/i);
    expectCampiRimasti();
  });

  it('a modal chiuso la domanda non entra nell\'intervista', () => {
    document.getElementById('lavoro-modal').classList.remove('active');
    expect(api.userCanReplyToLavoroInterview('chi sono i caposquadra?')).toBe(false);
    expect(api.userCanReplyToLavoroInterview('Chi sono i caposquadra disponibili?')).toBe(false);
  });

  it('Operaio QA come caposquadra cita il nome, non la frase', async () => {
    const frasi = [
      ['Operaio QA', 'Operaio QA'],
      ['assegnato al caposquadra Operaio QA', 'Operaio QA'],
      ['prova Operaio QA come caposquadra', 'Operaio QA'],
      ['il caposquadra è Operaio QA', 'Operaio QA'],
      ['caposquadra Operaio QA', 'Operaio QA']
    ];
    for (const [frase, citazione] of frasi) {
      document.getElementById('lavoro-caposquadra').value = '';
      const res = await api.applyLavoroInterviewFromUserReply(frase);
      expect(res.message).toMatch(new RegExp('Non ho trovato «' + citazione + '»'));
      if (frase !== citazione) expect(res.message).not.toContain('«' + frase + '»');
      expect(document.getElementById('lavoro-caposquadra').value).toBe('');
      expect(document.getElementById('lavoro-operaio').value).toBe('');
      expectCampiRimasti();
    }
  });

  it('roster caposquadra vuoto non cita l\'operaio e non chiede di nuovo l\'assegnazione', async () => {
    mount({ capi: [], operai: [OPERAIO_QA] });
    campiAcquisiti();
    window.__tonyLavoroAssignModeConfirmed = true;
    window.__tonyLavoroConfirmedAssignMode = 'squadra';
    const res = await api.applyLavoroInterviewFromUserReply('prova Operaio QA come caposquadra');
    expect(res.message).toMatch(/elenco dei caposquadra non è ancora pronto/i);
    expect(res.message).not.toMatch(/Operaio QA/);
    expect(res.message).not.toMatch(/A chi lo assegno/i);
    expectCampiRimasti();
  });

  it('persona univoca con tendina vuota non viene chiesta come se mancasse', async () => {
    mount({ capi: [CAPO], operai: [MARIO], omitOptions: true });
    campiAcquisiti();
    window.__tonyLavoroAssignModeConfirmed = true;
    window.__tonyLavoroConfirmedAssignMode = 'autonomo';
    document.getElementById('tipo-squadra').checked = false;
    document.getElementById('tipo-autonomo').checked = true;
    window.__tonyLastLavoroInterviewQuestion = 'A chi lo assegno?';
    const res = await api.applyLavoroInterviewFromUserReply('Mario Verdi');
    expect(res.message).toMatch(/tendina non è ancora pronta/i);
    expect(res.message).toMatch(/Mario Verdi/);
    expect(res.message).not.toMatch(/A chi lo assegno/i);
    expect(document.getElementById('lavoro-operaio').value).toBe('');
    expectCampiRimasti();
  });

  it('omonimi: il nome completo resta univoco e non rifà la domanda', async () => {
    mount({ capi: [CAPO], operai: [MARIO, MARIO2] });
    campiAcquisiti();
    window.__tonyLavoroAssignModeConfirmed = true;
    window.__tonyLavoroConfirmedAssignMode = 'autonomo';
    document.getElementById('tipo-squadra').checked = false;
    document.getElementById('tipo-autonomo').checked = true;
    const res = await api.applyLavoroInterviewFromUserReply('Mario Verdi');
    expect(document.getElementById('lavoro-operaio').value).toBe(MARIO.id);
    expect(document.getElementById('lavoro-caposquadra').value).toBe('');
    expect(res.message).not.toMatch(/A chi lo assegno/i);
    expect(res.message).not.toMatch(/tendina non è ancora pronta/i);
    expectCampiRimasti();
  });

  it('chiusura e riapertura spengono il flusso e lasciano campi e storico', async () => {
    const storia = window.Tony.chatHistory.map((m) => m.parts[0].text);
    api.stopLavoroCreationFlow();
    document.getElementById('lavoro-modal').classList.remove('active');
    expect(window.__tonyLavoroCreationFlow).toBe(false);
    expectCampiRimasti();
    expect(window.Tony.chatHistory.map((m) => m.parts[0].text)).toEqual(storia);
    expect(api.userCanReplyToLavoroInterview('chi sono i caposquadra?')).toBe(false);

    document.getElementById('lavoro-modal').classList.add('active');
    expect(window.__tonyLavoroCreationFlow).toBe(false);
    expectCampiRimasti();
    const res = await api.applyLavoroInterviewFromUserReply('chi sono i caposquadra?');
    expect(res.message).toMatch(/Neri Bosco/);
    expect(res.message).not.toMatch(/Non ho trovato «chi sono/i);
    expectCampiRimasti();
    expect(window.Tony.chatHistory.map((m) => m.parts[0].text)).toEqual(storia);
  });

  it('a modal chiuso «chi sono i caposquadra?» elenca Capo QA e non Operaio QA', () => {
    mount({
      capi: [{ id: 'capo-qa', nome: 'Capo', cognome: 'QA', ruoli: ['caposquadra'], stato: 'attivo' }],
      operai: [{ id: 'op-qa', nome: 'Operaio', cognome: 'QA', ruoli: ['operaio'], stato: 'attivo' }]
    });
    campiAcquisiti();
    window.__tonyLavoroCreationFlow = false;
    window.__lavoriFormDataReady = true;
    document.getElementById('lavoro-modal').classList.remove('active');
    expect(api.userCanReplyToLavoroInterview('chi sono i caposquadra?')).toBe(false);
    const reply = api.localCaposquadraRosterReply('chi sono i caposquadra?');
    expect(reply.handled).toBe(true);
    expect(reply.message).toMatch(/Capo QA/);
    expect(reply.message).not.toMatch(/Operaio QA/);
    expect(reply.message).not.toMatch(/A quale caposquadra|A chi lo assegno/i);
    expect(document.getElementById('lavoro-modal').classList.contains('active')).toBe(false);
    expect(window.__tonyLavoroCreationFlow).toBe(false);
    expectCampiRimasti();
  });

  it('«assegnalo a Operaio QA come caposquadra» cita Operaio QA', async () => {
    mount({
      capi: [{ id: 'capo-qa', nome: 'Capo', cognome: 'QA', ruoli: ['caposquadra'], stato: 'attivo' }],
      operai: [{ id: 'op-qa', nome: 'Operaio', cognome: 'QA', ruoli: ['operaio'], stato: 'attivo' }]
    });
    campiAcquisiti();
    window.__tonyLavoroAssignModeConfirmed = true;
    window.__tonyLavoroConfirmedAssignMode = 'squadra';
    const frase = 'assegnalo a Operaio QA come caposquadra';
    const res = await api.applyLavoroInterviewFromUserReply(frase);
    expect(res.message).toMatch(/Non ho trovato «Operaio QA»/);
    expect(res.message).not.toMatch(/«QA come»/);
    expect(document.getElementById('lavoro-caposquadra').value).toBe('');
    expect(document.getElementById('lavoro-operaio').value).toBe('');
    expectCampiRimasti();
  });

  it('Capo QA va nel caposquadra e Operaio QA nell’operaio', async () => {
    mount({
      capi: [{ id: 'capo-qa', nome: 'Capo', cognome: 'QA', ruoli: ['caposquadra'], stato: 'attivo' }],
      operai: [{ id: 'op-qa', nome: 'Operaio', cognome: 'QA', ruoli: ['operaio'], stato: 'attivo' }]
    });
    campiAcquisiti();
    window.__tonyLavoroAssignModeConfirmed = true;
    window.__tonyLavoroConfirmedAssignMode = 'squadra';
    const capo = await api.applyLavoroInterviewFromUserReply('Capo QA');
    expect(document.getElementById('lavoro-caposquadra').value).toBe('capo-qa');
    expect(document.getElementById('lavoro-operaio').value).toBe('');
    expect(capo.message).not.toMatch(/Non ho trovato/i);
    expectCampiRimasti();

    document.getElementById('lavoro-caposquadra').value = '';
    window.__tonyLavoroConfirmedAssignMode = 'autonomo';
    document.getElementById('tipo-squadra').checked = false;
    document.getElementById('tipo-autonomo').checked = true;
    const operaio = await api.applyLavoroInterviewFromUserReply('Operaio QA');
    expect(document.getElementById('lavoro-operaio').value).toBe('op-qa');
    expect(document.getElementById('lavoro-caposquadra').value).toBe('');
    expect(operaio.message).not.toMatch(/Non ho trovato/i);
    expectCampiRimasti();
  });

  it('modal, pannello e stop non cancellano chat né sessionStorage', () => {
    const events = readFileSync(resolve(process.cwd(), 'core/admin/js/gestione-lavori-events.js'), 'utf8');
    const closeAt = events.indexOf('export function closeLavoroModal');
    const closeBody = events.slice(closeAt, closeAt + 700);
    expect(closeBody).toMatch(/fermaFlussoCreazioneLavoroTony/);
    expect(closeBody).not.toMatch(/chatHistory|sessionStorage|tony_session_state/);

    const sessionAt = events.indexOf('function chiudiModaleLavoroSeSessione');
    const sessionBody = events.slice(sessionAt, sessionAt + 500);
    expect(sessionBody).toMatch(/fermaFlussoCreazioneLavoroTony/);

    const main = readFileSync(resolve(process.cwd(), 'core/js/tony/main.js'), 'utf8');
    const panelAt = main.indexOf("closeBtn.addEventListener('click'");
    const panelBody = main.slice(panelAt, panelAt + 700);
    expect(panelBody).toMatch(/stopLavoroCreationFlow/);
    expect(panelBody).not.toMatch(/chatHistory\s*=\s*\[\]|sessionStorage\.removeItem/);

    const rosterAt = main.indexOf('Domanda sui caposquadra a scheda chiusa');
    const rosterBody = main.slice(rosterAt, rosterAt + 1200);
    expect(rosterBody).toMatch(/localCaposquadraRosterReply/);
    expect(rosterBody).not.toMatch(/__tonyLavoroCreationFlow = true|openCreaModal|sessionStorage/);

    const injector = readFileSync(resolve(process.cwd(), 'core/js/tony-form-injector.js'), 'utf8');
    const stopAt = injector.indexOf('function stopLavoroCreationFlow');
    const stopBody = injector.slice(stopAt, stopAt + 180);
    expect(stopBody).toMatch(/__tonyLavoroCreationFlow = false/);
    expect(stopBody).not.toMatch(/chatHistory|sessionStorage|lavoro-nome/);
  });
});
