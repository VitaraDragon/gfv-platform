/**
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import {
  ACCETTAZIONE_LEGALE_ATTIVA,
  DOCUMENTI_LEGALI,
  VERSIONI_CASELLE,
  COOKIE_URL
} from '../../core/config/accettazione-legale-config.js';
import { validaConfigLegale } from '../../core/services/accettazione-legale.js';

describe('accettazione-legale-config', () => {
  it('il flag nel repo è spento', () => {
    expect(ACCETTAZIONE_LEGALE_ATTIVA).toBe(false);
  });

  it('placeholder: versioni 0000-00-00, url vuoti, cookie solo link vuoto', () => {
    expect(DOCUMENTI_LEGALI['termini-b2b'].versione).toBe('termini-b2b-0000-00-00');
    expect(DOCUMENTI_LEGALI.privacy.versione).toBe('privacy-0000-00-00');
    expect(DOCUMENTI_LEGALI.dpa.versione).toBe('dpa-0000-00-00');
    expect(DOCUMENTI_LEGALI['informativa-lavoratori'].versione).toBe('informativa-lavoratori-0000-00-00');
    expect(DOCUMENTI_LEGALI['termini-b2b'].url).toBe('');
    expect(DOCUMENTI_LEGALI.privacy.url).toBe('');
    expect(DOCUMENTI_LEGALI.dpa.url).toBe('');
    expect(DOCUMENTI_LEGALI['informativa-lavoratori'].url).toBe('');
    expect(COOKIE_URL).toBe('');
    expect(VERSIONI_CASELLE.registrazione).toBe('casella-registrazione-v1');
    expect(VERSIONI_CASELLE.invito).toBe('casella-invito-v1');
  });

  it('attivare il config reale fallisce: url vuoti e versioni 0000-00-00', () => {
    const esito = validaConfigLegale({ DOCUMENTI_LEGALI }, true);
    expect(esito.ok).toBe(false);
    const testo = esito.errori.join(' ');
    expect(testo).toMatch(/0000-00-00/);
    expect(testo).toMatch(/https:\/\//);
  });

  it('se il flag è acceso, il config reale deve essere valido', () => {
    if (!ACCETTAZIONE_LEGALE_ATTIVA) {
      expect(ACCETTAZIONE_LEGALE_ATTIVA).toBe(false);
      return;
    }
    expect(validaConfigLegale({ DOCUMENTI_LEGALI }, true).ok).toBe(true);
  });
});
