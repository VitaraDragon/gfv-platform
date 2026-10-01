/**
 * @vitest-environment node
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { SEMINATIVO_HUB_CARDS } from '../modules/seminativo/config/seminativo-hub.js';
import {
  avvisoDosaggioProdotti,
  SeminativoTrattamento,
  selezionaRigheTrattamento
} from '../modules/seminativo/models/SeminativoTrattamento.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('Seminativo — trattamenti da diario e lavori', () => {
  it('hub trattamenti non è più placeholder', () => {
    const card = SEMINATIVO_HUB_CARDS.find((item) => item.id === 'trattamenti');
    expect(card.placeholder).toBe(false);
    expect(card.pageType).toBe('trattamenti_seminativo');
  });

  it('tiene solo la categoria trattamenti sulla campagna del terreno', () => {
    const righe = selezionaRigheTrattamento({
      terreni: [{ id: 't-grano' }],
      nomiTipi: ['trattamento meccanico'],
      campagne: [{ id: 'c1', terrenoId: 't-grano', campagna: '2025/2026', colturaNome: 'Grano' }],
      lavori: [
        { id: 'l1', terrenoId: 't-grano', stato: 'completato', tipoLavoro: 'Trattamento Meccanico', dataInizio: '2026-03-04' },
        { id: 'l2', terrenoId: 't-grano', stato: 'completato', tipoLavoro: 'Erpicatura', dataInizio: '2026-03-04' },
        { id: 'l3', terrenoId: 't-grano', stato: 'annullato', tipoLavoro: 'Trattamento Meccanico', dataInizio: '2026-04-01' }
      ],
      attivita: [
        { id: 'a1', terrenoId: 't-grano', tipoLavoro: 'Trattamento Meccanico', data: '2026-03-04', lavoroId: 'l1' },
        { id: 'a2', terrenoId: 't-grano', tipoLavoro: 'Trattamento Meccanico', data: '2026-05-02' }
      ],
      trattamenti: [{ id: 't1', lavoroId: 'l1', prodotto: 'Rame' }]
    });
    expect(righe.map((row) => row.lavoroId || row.attivitaId)).toEqual(['a2', 'l1']);
    expect(righe[1].trattamento.prodotto).toBe('Rame');
    expect(righe[0].campagnaId).toBe('c1');
  });

  it('somma i costi delle righe prodotto e segnala il dosaggio fuori range', () => {
    const vuoto = new SeminativoTrattamento({ campagnaId: 'c1', lavoroId: 'l1', data: '2026-03-04' });
    expect(vuoto.validate().valid).toBe(false);
    const ok = new SeminativoTrattamento({
      campagnaId: 'c1',
      lavoroId: 'l1',
      data: '2026-03-04',
      prodotti: [
        { prodottoId: 'p1', prodotto: 'Rame', dosaggio: 4, quantita: 12, costo: 12.5 }
      ],
      costoManodopera: 20,
      costoMacchina: 5
    });
    expect(ok.validate().valid).toBe(true);
    expect(ok.toFirestore().costoTotale).toBe(37.5);
    expect(ok.toFirestore().costoProdotto).toBe(12.5);
    const avviso = avvisoDosaggioProdotti(ok.prodotti, [{ id: 'p1', nome: 'Rame', dosaggioMax: 3 }]);
    expect(avviso.hasWarning).toBe(true);
    expect(avviso.tooltip).toContain('Rame');
  });

  it('pagina usa lo stesso form del vigneto', () => {
    const page = readFileSync(join(root, 'modules/seminativo/views/trattamenti-standalone.html'), 'utf8');
    expect(page).toContain('initTrattamentiPage');
    expect(page).toContain('id="form-trattamento"');
    expect(page).toContain('id="modal-trattamento"');
    expect(page).toContain('trattamento-costo-mano');
    expect(page).toContain('trattamento-registra-scarico-magazzino');
    expect(page).toContain('Lavoro / Attività');
    expect(page).not.toContain('initSeminativoPlaceholderPage');
    const rules = readFileSync(join(root, 'firestore.rules'), 'utf8');
    expect(rules).toContain('trattamentiSeminativo');
  });
});
