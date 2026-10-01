/**
 * @vitest-environment node
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { SEMINATIVO_HUB_CARDS } from '../modules/seminativo/config/seminativo-hub.js';
import {
  nomiSeedRaccoltaCampo,
  resaQliHa,
  selezionaRigheRaccolta,
  statoDopoRaccolta,
  statoDopoRimozioneRaccolta
} from '../modules/seminativo/models/SeminativoRaccolta.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('Seminativo — raccolta a pieno campo', () => {
  it('hub raccolta non è più placeholder', () => {
    const card = SEMINATIVO_HUB_CARDS.find((item) => item.id === 'raccolta');
    expect(card.placeholder).toBe(false);
    expect(card.pageType).toBe('raccolta_seminativo');
  });

  it('il catalogo tiene la raccolta di campo e lascia fuori la vendemmia', () => {
    const nomi = nomiSeedRaccoltaCampo();
    expect(nomi).toContain('raccolta meccanica');
    expect(nomi).toContain('raccolta manuale');
    expect(nomi.some((nome) => nome.includes('vendemmia'))).toBe(false);
    expect(nomi.some((nome) => nome.includes('sulla fila'))).toBe(false);
  });

  it('la lista segue la campagna e ignora vendemmia ed erpicatura', () => {
    const righe = selezionaRigheRaccolta({
      terreni: [{ id: 't-grano' }],
      nomiTipi: nomiSeedRaccoltaCampo(),
      campagne: [{ id: 'c1', terrenoId: 't-grano', campagna: '2026/2027', colturaNome: 'Grano' }],
      lavori: [
        { id: 'l1', terrenoId: 't-grano', stato: 'completato', tipoLavoro: 'Raccolta Meccanica', dataInizio: '2027-06-12' },
        { id: 'l2', terrenoId: 't-grano', stato: 'completato', tipoLavoro: 'Vendemmia Meccanica', dataInizio: '2027-06-12' },
        { id: 'l3', terrenoId: 't-grano', stato: 'completato', tipoLavoro: 'Erpicatura', dataInizio: '2027-06-12' }
      ],
      attivita: [
        { id: 'a1', terrenoId: 't-grano', tipoLavoro: 'Raccolta Manuale', data: '2027-07-02' }
      ],
      trattamenti: []
    });
    expect(righe.map((row) => row.lavoroId || row.attivitaId)).toEqual(['a1', 'l1']);
    expect(righe[0].campagna).toBe('2026/2027');
  });

  it('resa e stato campagna', () => {
    expect(resaQliHa(128, 3.2)).toBe(40);
    expect(statoDopoRaccolta('seminato')).toBe('raccolto');
    expect(statoDopoRaccolta('chiuso')).toBe('chiuso');
    expect(statoDopoRimozioneRaccolta('raccolto')).toBe('seminato');
  });

  it('la pagina ha il form raccolta', () => {
    const page = readFileSync(join(root, 'modules/seminativo/views/raccolta-standalone.html'), 'utf8');
    expect(page).toContain('initRaccoltaPage');
    expect(page).toContain('id="form-raccolta"');
    expect(page).toContain('raccolta_seminativo');
    expect(page).not.toContain('initSeminativoPlaceholderPage');
  });
});
