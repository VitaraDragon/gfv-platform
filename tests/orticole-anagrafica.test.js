/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  OrticolaCampagna,
  findDuplicateCampagna,
  countCicliSuTerrenoCampagna,
  isTerrenoOrticole,
  sameCampagnaKey
} from '../modules/orticole/models/OrticolaCampagna.js';
import { isTerrenoSeminativo } from '../modules/seminativo/models/SeminativoCampagna.js';
import { famigliaColtura } from '../shared/js/coltura-terreno.js';
import { cambioCategoriaColtura } from '../shared/js/effetti-salvataggio-terreno.js';
import {
  htmlAvvisoNessunTerrenoOrtivo,
  HREF_TERRENI_DA_ORTICOLE,
  mancaTerrenoOrtivoOperativo
} from '../modules/orticole/js/avviso-terreni-ortive.js';

describe('Orticole anagrafica — unicità e terreni', () => {
  it('validate rifiuta ciclo fuori da 1|2 e accetta destinazione', () => {
    const bad = new OrticolaCampagna({
      terrenoId: 't1',
      campagna: '2025/2026',
      ciclo: 3,
      colturaNome: 'Patate'
    });
    expect(bad.validate().valid).toBe(false);
    expect(bad.validate().errors.join(' ')).toMatch(/ciclo/i);

    const ok = new OrticolaCampagna({
      terrenoId: 't1',
      campagna: '2025/2026',
      ciclo: 2,
      colturaNome: 'Cipolle',
      destinazionePrevista: 'mercato',
      tipoImpianto: 'semina'
    });
    expect(ok.validate().valid).toBe(true);
  });

  it('unicità terreno + campagna + ciclo; massimo due cicli', () => {
    const list = [
      { id: 'a', terrenoId: 't1', campagna: '2025/2026', ciclo: 1 },
      { id: 'b', terrenoId: 't1', campagna: '2025/2026', ciclo: 2 }
    ];
    expect(findDuplicateCampagna(list, { terrenoId: 't1', campagna: '2025/2026', ciclo: 1 })).toBeTruthy();
    expect(findDuplicateCampagna(list, { terrenoId: 't1', campagna: '2025/2026', ciclo: 2 }, 'b')).toBeFalsy();
    expect(sameCampagnaKey(
      { terrenoId: 't1', campagna: '2025/2026', ciclo: 1 },
      { terrenoId: 't1', campagna: '2025/2026', ciclo: 2 }
    )).toBe(false);
    expect(countCicliSuTerrenoCampagna(list, 't1', '2025/2026')).toBe(2);
    expect(countCicliSuTerrenoCampagna(list, 't1', '2025/2026', null, 'a')).toBe(1);
  });

  it('isTerrenoOrticole include Pomodoro; esclusi seminativo/vite/frutteto/prato', () => {
    expect(isTerrenoOrticole({ coltura: 'Pomodoro' })).toBe(true);
    expect(isTerrenoOrticole({ colturaCategoria: 'ortive' })).toBe(true);
    expect(isTerrenoOrticole({ coltura: 'Patate' })).toBe(true);
    expect(isTerrenoOrticole({ coltura: 'Grano' })).toBe(false);
    expect(isTerrenoOrticole({ coltura: 'Vite' })).toBe(false);
    expect(isTerrenoOrticole({ coltura: 'Melo' })).toBe(false);
    expect(isTerrenoOrticole({ coltura: 'Prato' })).toBe(false);
  });

  it('un terreno Pomodoro non passa isTerrenoSeminativo; Grano non è orticole', () => {
    expect(isTerrenoSeminativo({ coltura: 'Pomodoro' })).toBe(false);
    expect(isTerrenoOrticole({ coltura: 'Grano' })).toBe(false);
    expect(famigliaColtura({ coltura: 'Pomodoro' })).toBe('orticole');
    expect(famigliaColtura({ coltura: 'Grano', colturaCategoria: 'seminativo' })).toBe('seminativo');
  });

  it('cambio coltura da/verso orticole chiude lavori (speciale come vigneto/frutteto)', () => {
    expect(cambioCategoriaColtura(
      { coltura: 'Vite', colturaCategoria: 'vite' },
      { coltura: 'Pomodoro', colturaCategoria: 'ortive' }
    )).toBe(true);
    expect(cambioCategoriaColtura(
      { coltura: 'Pomodoro', colturaCategoria: 'ortive' },
      { coltura: 'Grano', colturaCategoria: 'seminativo' }
    )).toBe(true);
    expect(cambioCategoriaColtura(
      { coltura: 'Vite', colturaCategoria: 'vite' },
      { coltura: 'Melo', colturaCategoria: 'frutteto' }
    )).toBe(true);
    // seminativo ↔ altro non speciale (orticole escluso): solo seminativo non entra nel set
    expect(cambioCategoriaColtura(
      { coltura: 'Grano', colturaCategoria: 'seminativo' },
      { coltura: 'Prato', colturaCategoria: 'prato' }
    )).toBe(false);
  });

  it('avvisa se non ci sono terreni operativi a ortive', () => {
    expect(mancaTerrenoOrtivoOperativo([])).toBe(true);
    expect(mancaTerrenoOrtivoOperativo([{ id: 'arch', stato: 'archiviato' }])).toBe(true);
    expect(mancaTerrenoOrtivoOperativo([{ id: 'ok', stato: 'attivo' }])).toBe(false);
    const html = htmlAvvisoNessunTerrenoOrtivo();
    expect(html).toContain(HREF_TERRENI_DA_ORTICOLE);
    expect(html).toContain('pomodoro');
    expect(html).toContain('Nessun terreno con coltura ortiva');
  });
});
