import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';
import {
  isTonySegnaOreIntent as isTonySegnaOreIntentClient,
  rewriteDiarioNavSpeechForGestioneLavori,
  TONY_MANODOPERA_SEGNA_ORE_MANAGER_TEXT,
} from '../../core/js/tony/engine.js';

const require = createRequire(import.meta.url);
const {
  tryTonyActivityPatterns,
  tryTonySegnaOreManagerManodopera,
  MANODOPERA_ORE_MANAGER_INFO_BODY,
} = require('../../functions/tony-activity-patterns.js');
const { isTonySegnaOreIntent } = require('../../functions/tony-quick-replies.js');

const GENERIC = [
  'aiutami a segnare le ore di oggi per un lavoro',
  'segna le ore di oggi',
  'devo mettere le ore di ieri',
];

const HO_FATTO = "ho fatto 4 ore di potatura nell'Oliveto Nord";

function ctxCon(moduli) {
  return {
    azienda: {
      terreni: [{ id: 'oliveto-nord', nome: 'Oliveto Nord' }],
      tipiLavoro: [{ nome: 'Potatura' }],
    },
    dashboard: { moduli_attivi: moduli },
  };
}

const CTX_MANO = ctxCon(['tony', 'manodopera']);
const CTX_SENZA = ctxCon(['tony']);

describe('segna ore manager con Manodopera', () => {
  it('il testo client è la stessa fonte del server', () => {
    expect(TONY_MANODOPERA_SEGNA_ORE_MANAGER_TEXT).toBe(MANODOPERA_ORE_MANAGER_INFO_BODY);
  });

  it.each(GENERIC)('manager: risposta informativa, nessun comando (%s)', (phrase) => {
    expect(isTonySegnaOreIntent(phrase)).toBe(true);
    const hit = tryTonySegnaOreManagerManodopera({
      message: phrase,
      ctx: CTX_MANO,
      fieldProfile: null,
    });
    expect(hit).not.toBeNull();
    expect(hit.id).toBe('segna_ore_manager_manodopera_info');
    expect(hit.command).toBeNull();
    expect(hit.text).toBe(MANODOPERA_ORE_MANAGER_INFO_BODY);
    expect(JSON.stringify(hit)).not.toMatch(/lavoro-modal/);
    expect(hit.text).toMatch(/operai e caposquadra/i);
    expect(hit.text).toMatch(/Validazione ore/);
  });

  it.each(['operaio', 'caposquadra'])('profilo %s: il nuovo ramo non risponde', (profile) => {
    GENERIC.forEach((phrase) => {
      expect(
        tryTonySegnaOreManagerManodopera({
          message: phrase,
          ctx: CTX_MANO,
          fieldProfile: profile,
        })
      ).toBeNull();
    });
  });

  it.each(GENERIC)('senza Manodopera non intercetta (%s)', (phrase) => {
    expect(
      tryTonySegnaOreManagerManodopera({
        message: phrase,
        ctx: CTX_SENZA,
        fieldProfile: null,
      })
    ).toBeNull();
    expect(tryTonyActivityPatterns({ message: phrase, ctx: CTX_SENZA })).toBeNull();
  });

  it('ho fatto 4 ore di potatura resta activity_pattern_manodopera_info', () => {
    const hit = tryTonyActivityPatterns({ message: HO_FATTO, ctx: CTX_MANO });
    expect(hit).not.toBeNull();
    expect(hit.id).toBe('activity_pattern_manodopera_info');
    expect(hit.command).toBeNull();
    expect(hit.text).toMatch(/Ho capito: potatura nel Oliveto Nord, 4 ore/);
    expect(hit.text).toContain(MANODOPERA_ORE_MANAGER_INFO_BODY);
    expect(
      tryTonySegnaOreManagerManodopera({
        message: HO_FATTO,
        ctx: CTX_MANO,
        fieldProfile: null,
      })
    ).toBeNull();
  });

  it('senza Manodopera «ho fatto 4 ore di potatura» resta il diario', () => {
    const hit = tryTonyActivityPatterns({ message: HO_FATTO, ctx: CTX_SENZA });
    expect(hit).not.toBeNull();
    expect(hit.id).toBe('activity_pattern');
    expect(hit.command.formId).toBe('attivita-form');
    expect(hit.command.type).toBe('INJECT_FORM_DATA');
  });

  it('crea un lavoro non è una richiesta di segnare ore', () => {
    const phrase = "crea un lavoro di potatura nell'Oliveto Nord";
    expect(isTonySegnaOreIntent(phrase)).toBe(false);
    expect(
      tryTonySegnaOreManagerManodopera({
        message: phrase,
        ctx: CTX_MANO,
        fieldProfile: null,
      })
    ).toBeNull();
  });

  it('registra 3 ore di potatura oggi resta il pattern già previsto', () => {
    const phrase = 'registra 3 ore di potatura oggi';
    const hit = tryTonyActivityPatterns({ message: phrase, ctx: CTX_MANO });
    expect(hit.id).toBe('activity_pattern_manodopera_info');
    expect(
      tryTonySegnaOreManagerManodopera({
        message: phrase,
        ctx: CTX_MANO,
        fieldProfile: null,
      })
    ).toBeNull();
  });
});

describe('rewrite testo diario → gestione lavori', () => {
  it('sostituisce la frase di navigazione', () => {
    expect(rewriteDiarioNavSpeechForGestioneLavori('Ti porto al diario.')).toBe(
      'Ti porto a gestione lavori.'
    );
    expect(
      rewriteDiarioNavSpeechForGestioneLavori('Ti porto al diario. Su quale appezzamento?')
    ).toBe('Ti porto a gestione lavori. Su quale appezzamento?');
  });

  it('lascia stare un testo che non promette il diario', () => {
    expect(rewriteDiarioNavSpeechForGestioneLavori('Ok, segno la potatura.')).toBe(
      'Ok, segno la potatura.'
    );
  });

  it('la gemella client coincide con il server anche su ho fatto e crea lavoro', () => {
    [HO_FATTO, "crea un lavoro di potatura nell'Oliveto Nord"].forEach((phrase) => {
      expect(isTonySegnaOreIntentClient(phrase)).toBe(isTonySegnaOreIntent(phrase));
    });
  });
});
