/**
 * @vitest-environment node
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { SEMINATIVO_HUB_CARDS } from '../modules/seminativo/config/seminativo-hub.js';
import { riepilogoCampagne, totaliStatistiche } from '../modules/seminativo/models/SeminativoStatistiche.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('Seminativo — statistiche di campagna', () => {
  it('hub statistiche non è più placeholder', () => {
    const card = SEMINATIVO_HUB_CARDS.find((item) => item.id === 'statistiche');
    expect(card.placeholder).toBe(false);
    expect(card.pageType).toBe('statistiche_seminativo');
  });

  it('resa prevista e resa effettiva restano distinte, i prodotti si sommano ai lavori', () => {
    const righe = riepilogoCampagne({
      campagne: [{
        id: 'c1',
        terrenoId: 't1',
        campagna: '2026/2027',
        colturaNome: 'Grano',
        varieta: 'Bologna',
        superficieEttari: 3.2,
        resaPrevistaQliHa: 45
      }],
      raccolte: [{ campagnaId: 'c1', quantitaQli: 128 }],
      trattamenti: [{ campagnaId: 'c1', costoProdotto: 76.8, costoManodopera: 60, costoMacchina: 48 }],
      spese: { c1: { costoManodopera: 120, costoMacchine: 96, costoTotale: 216 } }
    });
    expect(righe[0].resaPrevistaQliHa).toBe(45);
    expect(righe[0].resaEffettivaQliHa).toBe(40);
    expect(righe[0].produzioneQli).toBe(128);
    expect(righe[0].costoProdotti).toBe(76.8);
    expect(righe[0].costoTotale).toBe(292.8);
    const tot = totaliStatistiche(righe);
    expect(tot.resaPrevistaMediaQliHa).toBe(45);
    expect(tot.resaEffettivaQliHa).toBe(40);
  });

  it('la pagina è in sola lettura', () => {
    const page = readFileSync(join(root, 'modules/seminativo/views/seminativo-statistiche-standalone.html'), 'utf8');
    expect(page).toContain('initStatistichePage');
    expect(page).toContain('statistiche_seminativo');
    expect(page).not.toContain('initSeminativoPlaceholderPage');
    expect(page).not.toContain('gradazione');
  });
});
