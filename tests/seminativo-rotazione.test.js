/**
 * @vitest-environment node
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import {
  avvisoSceltaRotazione,
  proponiRotazione,
  righePianoColturale
} from '../modules/seminativo/models/SeminativoRotazione.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'modules/seminativo/views/piano-colturale-standalone.html'), 'utf8');

describe('Piano colturale Seminativo', () => {
  const now = new Date('2026-09-27T12:00:00');

  it('dopo il grano propone rinnovo e leguminosa, non un altro cereale a paglia', () => {
    const nomi = proponiRotazione('Grano', ['Grano']).map((row) => row.nome);
    expect(nomi).toEqual(['Mais', 'Soia', 'Girasole', 'Favino']);
    expect(avvisoSceltaRotazione('Grano', 'Orzo')).toContain('cereali a paglia');
    expect(avvisoSceltaRotazione('Grano', 'Mais')).toBe('');
    expect(avvisoSceltaRotazione('Grano', 'Grano')).toContain('genere');
  });

  it('dopo il girasole non propone soia o colza', () => {
    const nomi = proponiRotazione('Girasole', ['Girasole']);
    expect(nomi.map((row) => row.nome)).toEqual(['Grano', 'Favino', 'Orzo', 'Avena']);
    expect(avvisoSceltaRotazione('Girasole', 'Soia')).toContain('malattia');
  });

  it('la riga usa la coltura in campo e non la campagna futura già salvata', () => {
    const righe = righePianoColturale({
      now,
      terreni: [{ id: 't1', nome: 'Campo Grano', podere: 'Barbavara' }],
      campagne: [
        { id: 'c1', terrenoId: 't1', campagna: '2026/2027', colturaNome: 'Grano', stato: 'seminato', superficieEttari: 3.04 },
        { id: 'c2', terrenoId: 't1', campagna: '2027/2028', colturaNome: 'Mais', stato: 'pianificato', superficieEttari: 3.04 },
        { id: 'c0', terrenoId: 't1', campagna: '2024/2025', colturaNome: 'Colza', stato: 'chiuso' }
      ]
    });
    expect(righe[0].colturaAttuale).toBe('Grano');
    expect(righe[0].campagnaSuccessiva).toBe('2027/2028');
    expect(righe[0].colturaScelta).toBe('Mais');
    expect(righe[0].proposte.map((row) => row.nome)).not.toContain('Colza');
  });

  it('la pagina non è più un segnaposto', () => {
    expect(html).toContain('initPianoColturalePage');
    expect(html).not.toContain('In costruzione');
    expect(html).toContain('filter-terreno');
  });
});