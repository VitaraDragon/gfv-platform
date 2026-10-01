/**
 * @vitest-environment node
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { SEMINATIVO_HUB_CARDS } from '../modules/seminativo/config/seminativo-hub.js';
import { nomiSeedCategoriaCampo, selezionaRigheTrattamento } from '../modules/seminativo/models/SeminativoTrattamento.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('Seminativo — concimazioni a pieno campo', () => {
  it('hub concimazioni non è più placeholder', () => {
    const card = SEMINATIVO_HUB_CARDS.find((item) => item.id === 'concimazioni');
    expect(card.placeholder).toBe(false);
    expect(card.pageType).toBe('concimazioni_seminativo');
  });

  it('il catalogo tiene il pieno campo e lascia fuori la fila', () => {
    const nomi = nomiSeedCategoriaCampo('concimazione');
    expect(nomi).toContain('concimazione meccanica a pieno campo');
    expect(nomi).toContain('concimazione manuale a pieno campo');
    expect(nomi.some((nome) => nome.includes('sulla fila'))).toBe(false);
    expect(nomi.some((nome) => nome.includes('trattamento'))).toBe(false);
  });

  it('la lista segue la campagna e ignora trattamenti ed erpicature', () => {
    const nomi = nomiSeedCategoriaCampo('concimazione');
    const righe = selezionaRigheTrattamento({
      terreni: [{ id: 't-grano' }],
      nomiTipi: nomi,
      campagne: [{ id: 'c1', terrenoId: 't-grano', campagna: '2026/2027', colturaNome: 'Grano' }],
      lavori: [
        { id: 'l1', terrenoId: 't-grano', stato: 'completato', tipoLavoro: 'Concimazione meccanica a pieno campo', dataInizio: '2026-10-02' },
        { id: 'l2', terrenoId: 't-grano', stato: 'completato', tipoLavoro: 'Trattamento Meccanico', dataInizio: '2026-10-02' },
        { id: 'l3', terrenoId: 't-grano', stato: 'completato', tipoLavoro: 'Erpicatura', dataInizio: '2026-10-02' }
      ],
      attivita: [
        { id: 'a1', terrenoId: 't-grano', tipoLavoro: 'Concimazione manuale a pieno campo', data: '2026-11-04' }
      ],
      trattamenti: []
    });
    expect(righe.map((row) => row.lavoroId || row.attivitaId)).toEqual(['a1', 'l1']);
    expect(righe[0].campagna).toBe('2026/2027');
  });

  it('la pagina riusa il form trattamento', () => {
    const page = readFileSync(join(root, 'modules/seminativo/views/concimazioni-standalone.html'), 'utf8');
    expect(page).toContain('initConcimazioniPage');
    expect(page).toContain('id="form-trattamento"');
    expect(page).toContain('concimazioni_seminativo');
    expect(page).not.toContain('initSeminativoPlaceholderPage');
  });
});
