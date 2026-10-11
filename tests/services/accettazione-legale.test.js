/**
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import {
  validaConfigLegale,
  validaCaselleRegistrazione,
  validaPresaVisioneInvito,
  documentiRichiestiPerRuolo,
  decidiRiaccettazione,
  costruisciPayloadAccettazione
} from '../../core/services/accettazione-legale.js';

function configFinta(patch) {
  const base = {
    attiva: true,
    DOCUMENTI_LEGALI: {
      'termini-b2b': { versione: 'termini-b2b-2026-03-01', url: 'https://example.com/termini' },
      privacy: { versione: 'privacy-2026-03-01', url: 'https://example.com/privacy' },
      dpa: { versione: 'dpa-2026-03-01', url: 'https://example.com/dpa' },
      'informativa-lavoratori': {
        versione: 'informativa-lavoratori-2026-03-01',
        url: 'https://example.com/lavoratori'
      }
    },
    VERSIONI_CASELLE: {
      registrazione: 'casella-registrazione-v1',
      invito: 'casella-invito-v1'
    }
  };
  if (!patch) return base;
  return {
    ...base,
    DOCUMENTI_LEGALI: {
      ...base.DOCUMENTI_LEGALI,
      ...(patch.DOCUMENTI_LEGALI || {})
    },
    ...('attiva' in (patch || {}) ? { attiva: patch.attiva } : {})
  };
}

describe('validaConfigLegale', () => {
  it('flag spento: ok anche con placeholder', () => {
    expect(validaConfigLegale({
      'termini-b2b': { versione: 'termini-b2b-0000-00-00', url: '' }
    }, false)).toEqual({ ok: true, errori: [] });
  });

  it('config finta valida: ok', () => {
    expect(validaConfigLegale(configFinta(), true)).toEqual({ ok: true, errori: [] });
  });

  it('data invalida', () => {
    const config = configFinta({
      DOCUMENTI_LEGALI: {
        'termini-b2b': { versione: 'termini-b2b-2026-02-31', url: 'https://example.com/termini' }
      }
    });
    const esito = validaConfigLegale(config, true);
    expect(esito.ok).toBe(false);
    expect(esito.errori.join(' ')).toMatch(/termini-b2b/);
  });

  it('prefisso errato rispetto al tipo', () => {
    const config = configFinta({
      DOCUMENTI_LEGALI: {
        privacy: { versione: 'dpa-2026-03-01', url: 'https://example.com/privacy' }
      }
    });
    expect(validaConfigLegale(config, true).ok).toBe(false);
  });

  it('tipo non ammesso', () => {
    const config = configFinta();
    config.DOCUMENTI_LEGALI.altro = { versione: 'altro-2026-03-01', url: 'https://example.com/altro' };
    expect(validaConfigLegale(config, true).ok).toBe(false);
  });

  it('url http rifiutato', () => {
    const config = configFinta({
      DOCUMENTI_LEGALI: {
        dpa: { versione: 'dpa-2026-03-01', url: 'http://example.com/dpa' }
      }
    });
    expect(validaConfigLegale(config, true).ok).toBe(false);
  });

  it('versione 0000-00-00 rifiutata quando il flag è acceso', () => {
    const config = configFinta({
      DOCUMENTI_LEGALI: {
        privacy: { versione: 'privacy-0000-00-00', url: 'https://example.com/privacy' }
      }
    });
    expect(validaConfigLegale(config, true).ok).toBe(false);
  });
});

describe('caselle', () => {
  it('registrazione: entrambe obbligatorie, solo il booleano true', () => {
    expect(validaCaselleRegistrazione({ termini: true, dpa: true })).toBe(true);
    expect(validaCaselleRegistrazione({ termini: true, dpa: false })).toBe(false);
    expect(validaCaselleRegistrazione({ termini: 'true', dpa: true })).toBe(false);
    expect(validaCaselleRegistrazione({ termini: true })).toBe(false);
    expect(validaCaselleRegistrazione({})).toBe(false);
    expect(validaCaselleRegistrazione()).toBe(false);
  });

  it('invito: presa visione solo se true, nessuna preselezione', () => {
    expect(validaPresaVisioneInvito({ presaVisione: true })).toBe(true);
    expect(validaPresaVisioneInvito({ presaVisione: false })).toBe(false);
    expect(validaPresaVisioneInvito({ presaVisione: 'true' })).toBe(false);
    expect(validaPresaVisioneInvito({})).toBe(false);
  });
});

describe('documentiRichiestiPerRuolo', () => {
  it('admin in registrazione: termini, privacy, dpa', () => {
    expect(documentiRichiestiPerRuolo(['amministratore'], 'registrazione'))
      .toEqual(['termini-b2b', 'privacy', 'dpa']);
  });

  it('invitati: solo informativa lavoratori', () => {
    expect(documentiRichiestiPerRuolo(['operaio'], 'invito')).toEqual(['informativa-lavoratori']);
    expect(documentiRichiestiPerRuolo(['caposquadra'], 'invito')).toEqual(['informativa-lavoratori']);
    expect(documentiRichiestiPerRuolo(['manager'], 'invito')).toEqual(['informativa-lavoratori']);
  });

  it('un invitato non riceve termini o dpa', () => {
    expect(documentiRichiestiPerRuolo(['operaio'], 'invito')).not.toContain('dpa');
    expect(documentiRichiestiPerRuolo(['operaio'], 'invito')).not.toContain('termini-b2b');
  });
});

describe('decidiRiaccettazione', () => {
  const config = configFinta();

  it('stessa versione: nessuna', () => {
    const esito = decidiRiaccettazione(
      [{ tipo: 'privacy', versione: 'privacy-2026-03-01' }],
      ['privacy'],
      config
    );
    expect(esito).toEqual([]);
  });

  it('versione diversa: documento richiesto', () => {
    const esito = decidiRiaccettazione(
      [{ tipo: 'privacy', versione: 'privacy-2025-01-01' }],
      ['privacy'],
      config
    );
    expect(esito).toEqual([{ tipo: 'privacy', versione: 'privacy-2026-03-01' }]);
  });

  it('mai accettato: richiesto', () => {
    const esito = decidiRiaccettazione([], ['dpa'], config);
    expect(esito).toEqual([{ tipo: 'dpa', versione: 'dpa-2026-03-01' }]);
  });

  it('flag spento: elenco vuoto', () => {
    const esito = decidiRiaccettazione(
      [],
      ['termini-b2b', 'privacy', 'dpa'],
      configFinta({ attiva: false })
    );
    expect(esito).toEqual([]);
  });

  it('solo i documenti del ruolo', () => {
    const richiestiAdmin = documentiRichiestiPerRuolo(['amministratore'], 'registrazione');
    const admin = decidiRiaccettazione(
      [{ tipo: 'informativa-lavoratori', versione: 'informativa-lavoratori-2020-01-01' }],
      richiestiAdmin,
      config
    );
    expect(admin.map((riga) => riga.tipo)).toEqual(['termini-b2b', 'privacy', 'dpa']);

    const richiestiOperaio = documentiRichiestiPerRuolo(['operaio'], 'invito');
    const operaio = decidiRiaccettazione(
      [{ tipo: 'dpa', versione: 'dpa-2020-01-01' }],
      richiestiOperaio,
      config
    );
    expect(operaio).toEqual([{
      tipo: 'informativa-lavoratori',
      versione: 'informativa-lavoratori-2026-03-01'
    }]);
  });
});

describe('costruisciPayloadAccettazione', () => {
  it('nessun uid, email o ip; una riga per documento', () => {
    const payload = costruisciPayloadAccettazione({
      canale: 'registrazione',
      tenantId: 'tenant-1',
      ruolo: 'amministratore',
      documenti: ['privacy', 'termini-b2b', 'dpa'],
      uid: 'uid-segreto',
      email: 'a@b.c',
      ip: '203.0.113.5',
      config: configFinta()
    });
    expect(Object.keys(payload).sort()).toEqual(['canale', 'documenti', 'ruolo', 'tenantId']);
    expect(payload.canale).toBe('registrazione');
    expect(payload.ruolo).toBe('amministratore');
    expect(payload.documenti).toHaveLength(3);
    payload.documenti.forEach((riga) => {
      expect(Object.keys(riga).sort()).toEqual(['tipo', 'versione', 'versioneTestoCasella']);
      expect(riga.versioneTestoCasella).toBe('casella-registrazione-v1');
    });
    expect(payload.documenti.map((riga) => riga.tipo)).toEqual(['termini-b2b', 'privacy', 'dpa']);
    expect(JSON.stringify(payload)).not.toMatch(/uid-segreto|a@b\.c|203\.0\.113\.5/);
  });

  it('invito: una sola informativa e casella invito', () => {
    const payload = costruisciPayloadAccettazione({
      canale: 'invito',
      tenantId: 'tenant-1',
      ruolo: 'operaio',
      documenti: ['informativa-lavoratori'],
      config: configFinta()
    });
    expect(payload.documenti).toEqual([{
      tipo: 'informativa-lavoratori',
      versione: 'informativa-lavoratori-2026-03-01',
      versioneTestoCasella: 'casella-invito-v1'
    }]);
  });

  it('input malformato: errore', () => {
    expect(() => costruisciPayloadAccettazione(null)).toThrow(/non valido/);
    expect(() => costruisciPayloadAccettazione({
      canale: 'registrazione',
      tenantId: 'tenant-1',
      ruolo: 'amministratore',
      documenti: ['privacy'],
      config: configFinta()
    })).toThrow(/non coerenti/);
    expect(() => costruisciPayloadAccettazione({
      canale: 'invito',
      tenantId: 'tenant-1',
      ruolo: 'operaio',
      documenti: ['dpa'],
      config: configFinta()
    })).toThrow(/non coerenti/);
  });
});
