import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  validateMovimentoCarburante,
  parseCarburanteMovimentoQuery,
  movimentoMatchesCarburanteFiltro,
  matchMezzoByName,
  carburanteMovimentoSearchFromDraft,
  dashboardLinkForCategoria,
} from '../modules/magazzino/lib/carburante-movimento.js';

describe('validateMovimentoCarburante', () => {
  it('rifiuta il pieno senza macchinaId', () => {
    const r = validateMovimentoCarburante({ tipo: 'uscita', origineCarburante: 'pieno', macchinaId: '' });
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/Mezzo obbligatorio/);
  });

  it('rifiuta il pieno registrato come entrata', () => {
    const r = validateMovimentoCarburante({ tipo: 'entrata', origineCarburante: 'pieno', macchinaId: 't5' });
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/uscita/);
  });

  it('accetta il carico cisterna senza mezzo', () => {
    const r = validateMovimentoCarburante({ tipo: 'entrata', origineCarburante: 'carico_cisterna', macchinaId: null });
    expect(r.valid).toBe(true);
    expect(r.origineCarburante).toBe('carico_cisterna');
  });
});

describe('parseCarburanteMovimentoQuery', () => {
  it('carico apre il form entrata', () => {
    const q = parseCarburanteMovimentoQuery('?categoria=carburante&tipo=entrata');
    expect(q.apriForm).toBe(true);
    expect(q.origineForm).toBe('carico_cisterna');
    expect(q.tipo).toBe('entrata');
  });

  it('pieno apre il form uscita', () => {
    const q = parseCarburanteMovimentoQuery('?categoria=carburante&tipo=uscita&pieno=1');
    expect(q.apriForm).toBe(true);
    expect(q.origineForm).toBe('pieno');
  });

  it('solo categoria non apre il form', () => {
    const q = parseCarburanteMovimentoQuery('?categoria=carburante');
    expect(q.apriForm).toBe(false);
    expect(q.categoria).toBe('carburante');
  });
});

describe('filtro lista e mezzo', () => {
  it('filtra i movimenti della categoria e dell’origine', () => {
    const gas = { id: 'g', categoria: 'carburante' };
    const urea = { id: 'u', categoria: 'fertilizzanti' };
    expect(movimentoMatchesCarburanteFiltro(
      { tipo: 'entrata', prodottoId: 'g', origineCarburante: 'carico_cisterna' },
      gas,
      { categoria: 'carburante', origineCarburante: 'carico_cisterna' }
    )).toBe(true);
    expect(movimentoMatchesCarburanteFiltro(
      { tipo: 'entrata', prodottoId: 'u' },
      urea,
      { categoria: 'carburante' }
    )).toBe(false);
  });

  it('un solo T5 viene scelto, due omonimi no', () => {
    const one = matchMezzoByName([{ id: 'a', nome: 'Nuovo T5' }], 'T5');
    expect(one.status).toBe('unique');
    expect(one.match.id).toBe('a');
    const two = matchMezzoByName([{ id: 'a', nome: 'Nuovo T5' }, { id: 'b', nome: 'T5 110' }], 'T5');
    expect(two.status).toBe('ambiguous');
    expect(two.match).toBeNull();
  });

  it('la query Tony distingue carico e pieno', () => {
    expect(carburanteMovimentoSearchFromDraft({ 'mov-origine-carburante': 'carico_cisterna' }))
      .toBe('categoria=carburante&tipo=entrata');
    expect(carburanteMovimentoSearchFromDraft({ 'mov-origine-carburante': 'pieno' }))
      .toContain('pieno=1');
  });
});

describe('dashboard sottopagine carburante', () => {
  it('con categoria carburante torna all’hub, altrimenti al magazzino', () => {
    expect(dashboardLinkForCategoria('carburante')).toEqual({
      href: 'carburante-home-standalone.html',
      label: '← Dashboard carburante',
    });
    expect(dashboardLinkForCategoria('').href).toBe('magazzino-home-standalone.html');
    expect(dashboardLinkForCategoria('fitofarmaco').label).toBe('← Dashboard');
  });

  it('il link in pagina usa le stesse stringhe e sta sulle sottopagine', () => {
    const link = dashboardLinkForCategoria('carburante');
    const src = readFileSync(fileURLToPath(new URL('../modules/magazzino/js/dashboard-sezione-link.js', import.meta.url)), 'utf8');
    expect(src).toContain(link.href);
    expect(src).toContain(link.label);
    for (const page of ['movimenti-standalone.html', 'prodotti-standalone.html', 'tracciabilita-consumi-standalone.html']) {
      const html = readFileSync(fileURLToPath(new URL('../modules/magazzino/views/' + page, import.meta.url)), 'utf8');
      expect(html).toContain('id="link-dashboard-sezione"');
      expect(html).toContain('dashboard-sezione-link.js');
    }
  });
});
