import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  TONY_FORM_SAVE_LOCAL_CONFIG,
  isTonySaveConfirmText,
  isTonySaveDenyText,
  getTonyFormSaveLocalConfig,
  isAnyTonyFormSaveConfirmPending,
  resetTonyFormSaveConfirmFlags,
  tryInterceptTonyFormSaveConfirm,
  tryInterceptMagazzinoSaveBeforeCf,
  tryInterceptPreventivoSaveBeforeCf,
  tryInterceptQuickHoursSaveBeforeCf,
  quickHoursFormReadyForTonySave,
  quickHoursDomReadyForTonySave,
  isTonyQuickHoursCfFakeSaveText,
  isTonyMagazzinoCfFakeSaveText,
  executeTonyMagazzinoSaveLocal,
  formReadyForTonySave,
  magazzinoFormReadyForTonySave,
  magazzinoProactiveReadyForSave,
  terrenoFormReadyForTonySave,
  terrenoProactiveReadyForSave,
  tryInterceptTerrenoSaveBeforeCf,
} from '../core/js/tony-form-save-local.js';

describe('isTonySaveConfirmText', () => {
  it('riconosce conferme brevi', () => {
    expect(isTonySaveConfirmText('sì')).toBe(true);
    expect(isTonySaveConfirmText('si')).toBe(true);
    expect(isTonySaveConfirmText('salva')).toBe(true);
    expect(isTonySaveConfirmText('ok salva')).toBe(true);
    expect(isTonySaveConfirmText('ok')).toBe(true);
    expect(isTonySaveConfirmText('confermo')).toBe(true);
    expect(isTonySaveConfirmText('sì, va bene')).toBe(true);
  });

  it('rifiuta messaggi non conferma', () => {
    expect(isTonySaveConfirmText('no')).toBe(false);
    expect(isTonySaveConfirmText('domani')).toBe(false);
    expect(isTonySaveConfirmText('potatura')).toBe(false);
    expect(isTonySaveConfirmText('')).toBe(false);
  });
});

describe('isTonySaveDenyText', () => {
  it('riconosce negazioni', () => {
    expect(isTonySaveDenyText('no')).toBe(true);
    expect(isTonySaveDenyText('annulla')).toBe(true);
    expect(isTonySaveDenyText('aspetta')).toBe(true);
  });

  it('non confonde con conferma', () => {
    expect(isTonySaveDenyText('salva')).toBe(false);
    expect(isTonySaveDenyText('sì')).toBe(false);
  });
});

describe('TONY_FORM_SAVE_LOCAL_CONFIG', () => {
  it('preventivo risolve formId e messaggio', () => {
    const cfg = getTonyFormSaveLocalConfig('preventivo-form');
    expect(cfg).toBeTruthy();
    expect(cfg.formId).toBe('preventivo-form');
    expect(cfg.awaitingFlag).toBe('__tonyAwaitingPreventivoSaveConfirm');
    expect(cfg.saveMessage).toMatch(/preventivo/i);
  });

  it('lavoro mantiene backward compat flag', () => {
    const cfg = getTonyFormSaveLocalConfig('lavoro-form');
    expect(cfg.awaitingFlag).toBe('__tonyAwaitingLavoroSaveConfirm');
    expect(cfg.saveMessage).toMatch(/lavoro/i);
  });

  it('prodotto risolve formId, flag e messaggio', () => {
    const cfg = getTonyFormSaveLocalConfig('prodotto-form');
    expect(cfg).toBeTruthy();
    expect(cfg.formId).toBe('prodotto-form');
    expect(cfg.awaitingFlag).toBe('__tonyAwaitingProdottoSaveConfirm');
    expect(cfg.saveMessage).toMatch(/prodotto/i);
    expect(cfg.modalId).toBe('prodotto-modal');
  });

  it('movimento risolve formId, flag e messaggio', () => {
    const cfg = getTonyFormSaveLocalConfig('movimento-form');
    expect(cfg).toBeTruthy();
    expect(cfg.formId).toBe('movimento-form');
    expect(cfg.awaitingFlag).toBe('__tonyAwaitingMovimentoSaveConfirm');
    expect(cfg.saveMessage).toMatch(/movimento/i);
    expect(cfg.modalId).toBe('movimento-modal');
  });

  it('terreno risolve formId, flag e messaggio', () => {
    const cfg = getTonyFormSaveLocalConfig('terreno-form');
    expect(cfg).toBeTruthy();
    expect(cfg.formId).toBe('terreno-form');
    expect(cfg.awaitingFlag).toBe('__tonyAwaitingTerrenoSaveConfirm');
    expect(cfg.saveMessage).toMatch(/terreno/i);
    expect(cfg.modalId).toBe('terreno-modal');
  });
});

describe('tryInterceptTonyFormSaveConfirm', () => {
  beforeEach(() => {
    resetTonyFormSaveConfirmFlags();
    global.window = global.window || {};
    global.document = global.document || { getElementById: () => null };
  });

  afterEach(() => {
    resetTonyFormSaveConfirmFlags();
  });

  it('intercept preventivo «salva» → SAVE_ACTIVITY senza CF', () => {
    window.__tonyAwaitingPreventivoSaveConfirm = true;
    const prevCfg = TONY_FORM_SAVE_LOCAL_CONFIG['preventivo-form'];
    const origActive = prevCfg.isFormActive;
    prevCfg.isFormActive = () => true;

    let saved = false;
    const res = tryInterceptTonyFormSaveConfirm('salva', {
      processTonyCommand: (cmd) => {
        if (cmd.type === 'SAVE_ACTIVITY') saved = true;
      },
    });

    expect(res.handled).toBe(true);
    expect(res.confirmed).toBe(true);
    expect(saved).toBe(true);
    expect(window.__tonyAwaitingPreventivoSaveConfirm).toBe(false);

    prevCfg.isFormActive = origActive;
  });

  it('isAnyTonyFormSaveConfirmPending rileva flag attivo', () => {
    expect(isAnyTonyFormSaveConfirmPending()).toBe(false);
    window.__tonyAwaitingPreventivoSaveConfirm = true;
    expect(isAnyTonyFormSaveConfirmPending()).toBe(true);
    resetTonyFormSaveConfirmFlags(['preventivo-form']);
    expect(isAnyTonyFormSaveConfirmPending()).toBe(false);
  });

  it('intercept prodotto «salva» → SAVE_ACTIVITY senza CF', () => {
    window.__tonyAwaitingProdottoSaveConfirm = true;
    const cfg = TONY_FORM_SAVE_LOCAL_CONFIG['prodotto-form'];
    const origActive = cfg.isFormActive;
    cfg.isFormActive = () => true;

    let saved = false;
    const res = tryInterceptTonyFormSaveConfirm('salva', {
      processTonyCommand: (cmd) => {
        if (cmd.type === 'SAVE_ACTIVITY') saved = true;
      },
    });

    expect(res.handled).toBe(true);
    expect(res.confirmed).toBe(true);
    expect(saved).toBe(true);
    expect(window.__tonyAwaitingProdottoSaveConfirm).toBe(false);

    cfg.isFormActive = origActive;
  });

  it('intercept movimento «sì» → SAVE_ACTIVITY senza CF', () => {
    window.__tonyAwaitingMovimentoSaveConfirm = true;
    const cfg = TONY_FORM_SAVE_LOCAL_CONFIG['movimento-form'];
    const origActive = cfg.isFormActive;
    cfg.isFormActive = () => true;

    let saved = false;
    const res = tryInterceptTonyFormSaveConfirm('sì', {
      processTonyCommand: (cmd) => {
        if (cmd.type === 'SAVE_ACTIVITY') saved = true;
      },
    });

    expect(res.handled).toBe(true);
    expect(res.confirmed).toBe(true);
    expect(saved).toBe(true);
    expect(window.__tonyAwaitingMovimentoSaveConfirm).toBe(false);

    cfg.isFormActive = origActive;
  });

  it('isAnyTonyFormSaveConfirmPending rileva flag prodotto e movimento', () => {
    window.__tonyAwaitingProdottoSaveConfirm = true;
    expect(isAnyTonyFormSaveConfirmPending()).toBe(true);
    resetTonyFormSaveConfirmFlags(['prodotto-form']);
    window.__tonyAwaitingMovimentoSaveConfirm = true;
    expect(isAnyTonyFormSaveConfirmPending()).toBe(true);
    resetTonyFormSaveConfirmFlags(['movimento-form']);
    expect(isAnyTonyFormSaveConfirmPending()).toBe(false);
  });
});

describe('magazzinoFormReadyForTonySave', () => {
  beforeEach(() => {
    global.window = global.window || {};
    global.document = {
      getElementById: (id) => {
        if (id === 'prodotto-form' || id === 'movimento-form') return { id };
        return null;
      },
    };
  });

  afterEach(() => {
    delete window.__tonyBuildTonyFormContext;
    delete window.__tonyGetMagazzinoInterviewEmpty;
  });

  it('false se requiredEmpty non vuoto', () => {
    window.__tonyBuildTonyFormContext = () => ({
      formId: 'prodotto-form',
      requiredEmpty: ['prodotto-nome'],
      interviewEmpty: [],
    });
    expect(magazzinoFormReadyForTonySave('prodotto-form')).toBe(false);
    expect(formReadyForTonySave('prodotto-form')).toBe(false);
  });

  it('true per prodotto anche con interviewEmpty (dosaggio, carenza — opzionali HTML)', () => {
    window.__tonyBuildTonyFormContext = () => ({
      formId: 'prodotto-form',
      requiredEmpty: [],
      interviewEmpty: ['prodotto-dosaggio-min', 'prodotto-giorni-carenza'],
    });
    expect(magazzinoFormReadyForTonySave('prodotto-form')).toBe(true);
    expect(formReadyForTonySave('prodotto-form')).toBe(true);
    expect(magazzinoProactiveReadyForSave('prodotto-form', false)).toBe(true);
  });

  it('true se requiredEmpty e interviewEmpty vuoti', () => {
    window.__tonyBuildTonyFormContext = () => ({
      formId: 'movimento-form',
      requiredEmpty: [],
      interviewEmpty: [],
    });
    expect(magazzinoFormReadyForTonySave('movimento-form')).toBe(true);
  });

  it('true per movimento anche con opzionali interviewEmpty (confezione, note, …)', () => {
    window.__tonyBuildTonyFormContext = () => ({
      formId: 'movimento-form',
      requiredEmpty: [],
      interviewEmpty: ['mov-confezione', 'mov-prezzo'],
    });
    expect(magazzinoFormReadyForTonySave('movimento-form')).toBe(true);
    expect(formReadyForTonySave('movimento-form')).toBe(true);
  });

  it('ignora formId non magazzino', () => {
    expect(magazzinoFormReadyForTonySave('lavoro-form')).toBe(false);
  });
});

describe('tryInterceptMagazzinoSaveBeforeCf', () => {
  beforeEach(() => {
    resetTonyFormSaveConfirmFlags();
    global.window = global.window || {};
    global.document = {
      getElementById: (id) => {
        if (id === 'prodotto-form') return { id: 'prodotto-form' };
        if (id === 'prodotto-modal') return { id: 'prodotto-modal', classList: { contains: () => true } };
        return null;
      },
    };
  });

  afterEach(() => {
    resetTonyFormSaveConfirmFlags();
    delete window.__tonyBuildTonyFormContext;
  });

  it('«salva» con form pronto → prompt + SAVE_ACTIVITY senza CF', () => {
    window.__tonyBuildTonyFormContext = () => ({
      formId: 'prodotto-form',
      requiredEmpty: [],
      interviewEmpty: [],
    });
    const cfg = TONY_FORM_SAVE_LOCAL_CONFIG['prodotto-form'];
    const origActive = cfg.isFormActive;
    cfg.isFormActive = () => true;

    const messages = [];
    let saved = false;
    const res = tryInterceptMagazzinoSaveBeforeCf('salva', {
      appendMessage: (msg, role) => messages.push({ msg, role }),
      processTonyCommand: (cmd) => {
        if (cmd.type === 'SAVE_ACTIVITY') saved = true;
      },
    });

    expect(res.handled).toBe(true);
    expect(res.confirmed).toBe(true);
    expect(saved).toBe(true);
    expect(messages.some((m) => /prodotto/i.test(m.msg))).toBe(true);

    cfg.isFormActive = origActive;
  });

  it('isTonyMagazzinoCfFakeSaveText rileva falso successo CF', () => {
    expect(isTonyMagazzinoCfFakeSaveText('Prodotto salvato!')).toBe(true);
    expect(isTonyMagazzinoCfFakeSaveText('Perfetto, salvo?')).toBe(true);
    expect(isTonyMagazzinoCfFakeSaveText('Quale dosaggio minimo?')).toBe(false);
  });
});

describe('tryInterceptPreventivoSaveBeforeCf', () => {
  beforeEach(() => {
    resetTonyFormSaveConfirmFlags();
    global.window = global.window || {};
    global.document = {
      getElementById: (id) => {
        if (id === 'preventivo-form') return { id: 'preventivo-form' };
        return null;
      },
    };
  });

  afterEach(() => {
    resetTonyFormSaveConfirmFlags();
    delete window.__tonyBuildTonyFormContext;
  });

  it('«salva» con preventivo pronto → SAVE_ACTIVITY senza CF', () => {
    window.__tonyBuildTonyFormContext = () => ({
      formId: 'preventivo-form',
      requiredEmpty: [],
      interviewEmpty: [],
    });
    let saved = false;
    const res = tryInterceptPreventivoSaveBeforeCf('salva', {
      processTonyCommand: (cmd) => {
        if (cmd.type === 'SAVE_ACTIVITY') saved = true;
      },
    });
    expect(res.handled).toBe(true);
    expect(res.confirmed).toBe(true);
    expect(saved).toBe(true);
  });
});

describe('tryInterceptQuickHoursSaveBeforeCf', () => {
  function mockQuickHoursDom(overrides) {
    overrides = overrides || {};
    global.window = Object.assign({ parent: global.window }, overrides.window || {});
    global.document = {
      getElementById: (id) => {
        const vals = Object.assign({
          'quick-hours-form': { id: 'quick-hours-form' },
          'selected-work': { value: 'lav1' },
          'ora-data': { value: '2026-06-04' },
          'ora-start': { value: '07:00' },
          'ora-end': { value: '18:00' },
          'ora-break': { value: '60' },
        }, overrides.fields || {});
        return vals[id] || null;
      },
    };
  }

  beforeEach(() => {
    mockQuickHoursDom();
    window.__tonyGetCurrentFormContext = () => ({
      formId: 'field-workspace-ore-form',
      requiredEmpty: [],
      interviewEmpty: [],
    });
  });

  afterEach(() => {
    delete window.__tonyGetCurrentFormContext;
    delete global.document;
    delete global.window;
    delete global.sessionStorage;
  });

  it('«sì» con form pronto invoca salva senza CF', () => {
    let saved = false;
    const res = tryInterceptQuickHoursSaveBeforeCf('sì', {
      salvaQuickHours: () => { saved = true; },
    });
    expect(res.handled).toBe(true);
    expect(saved).toBe(true);
  });

  it('«ok» con orari completi salva anche con pausa 0', () => {
    mockQuickHoursDom({
      window: { __tonyQuickHoursPauseAckAt: Date.now() },
      fields: {
        'ora-start': { value: '07:30' },
        'ora-end': { value: '18:30' },
        'ora-break': { value: '0' },
      },
    });
    window.__tonyGetCurrentFormContext = () => ({
      formId: 'field-workspace-ore-form',
      requiredEmpty: [],
      interviewEmpty: ['ora-break'],
    });
    let saved = false;
    const res = tryInterceptQuickHoursSaveBeforeCf('ok', {
      salvaQuickHours: () => { saved = true; },
    });
    expect(res.handled).toBe(true);
    expect(saved).toBe(true);
  });

  it('ignora se form incompleto', () => {
    delete global.document;
    window.__tonyGetCurrentFormContext = () => ({
      formId: 'field-workspace-ore-form',
      requiredEmpty: ['ora-start'],
      interviewEmpty: [],
    });
    const res = tryInterceptQuickHoursSaveBeforeCf('salva', {
      processTonyCommand: () => {},
    });
    expect(res.handled).toBe(false);
  });
});

describe('quickHoursDomReadyForTonySave', () => {
  afterEach(() => {
    delete global.document;
    delete global.window;
  });

  it('true se DOM ha lavoro, orari e pausa', () => {
    global.window = {};
    global.document = {
      getElementById: (id) => {
        const vals = {
          'quick-hours-form': { id: 'quick-hours-form' },
          'selected-work': { value: 'lav1' },
          'ora-data': { value: '2026-06-04' },
          'ora-start': { value: '07:00' },
          'ora-end': { value: '18:00' },
          'ora-break': { value: '60' },
        };
        return vals[id] || null;
      },
    };
    expect(quickHoursDomReadyForTonySave()).toBe(true);
  });

  it('false se manca pausa e ultimo messaggio non è numero', () => {
    global.window = { parent: global.window };
    global.sessionStorage = { getItem: () => 'sì' };
    global.document = {
      getElementById: (id) => {
        const vals = {
          'quick-hours-form': { id: 'quick-hours-form' },
          'selected-work': { value: 'lav1' },
          'ora-data': { value: '2026-06-04' },
          'ora-start': { value: '07:00' },
          'ora-end': { value: '18:00' },
          'ora-break': { value: '0' },
        };
        return vals[id] || null;
      },
    };
    expect(quickHoursDomReadyForTonySave()).toBe(false);
  });

  it('true con pausa 0 se ultimo messaggio è «nessuna»', () => {
    global.window = { parent: global.window, __tonyLastUserMessage: 'nessuna' };
    global.sessionStorage = { getItem: () => 'nessuna' };
    global.document = {
      getElementById: (id) => {
        const vals = {
          'quick-hours-form': { id: 'quick-hours-form' },
          'selected-work': { value: 'lav1' },
          'ora-data': { value: '2026-06-04' },
          'ora-start': { value: '07:30' },
          'ora-end': { value: '18:30' },
          'ora-break': { value: '0' },
        };
        return vals[id] || null;
      },
    };
    expect(quickHoursDomReadyForTonySave()).toBe(true);
  });

  it('true su conferma «ok» se orari completi (forceIfSaveConfirm)', () => {
    global.window = { parent: global.window };
    global.document = {
      getElementById: (id) => {
        const vals = {
          'quick-hours-form': { id: 'quick-hours-form' },
          'selected-work': { value: 'lav1' },
          'ora-data': { value: '2026-06-04' },
          'ora-start': { value: '07:30' },
          'ora-end': { value: '18:30' },
          'ora-break': { value: '0' },
        };
        return vals[id] || null;
      },
    };
    expect(quickHoursDomReadyForTonySave({ forceIfSaveConfirm: true })).toBe(true);
  });
});

describe('isTonyQuickHoursCfFakeSaveText', () => {
  it('rileva falso salvato ore', () => {
    expect(isTonyQuickHoursCfFakeSaveText('Ore salvate correttamente!')).toBe(true);
    expect(isTonyQuickHoursCfFakeSaveText('Quanti minuti di pausa?')).toBe(false);
  });
});
