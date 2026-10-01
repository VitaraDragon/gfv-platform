/**
 * @vitest-environment node
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { SEMINATIVO_HUB_CARDS } from '../modules/seminativo/config/seminativo-hub.js';
import {
  isTipoLavorazioneCampoAperto,
  isLavorazioneDiFilare,
  selezionaLavorazioniCollegate,
  TIPI_LAVORAZIONE_CAMPO_APERTO
} from '../modules/seminativo/models/SeminativoLavorazione.js';

const require = createRequire(import.meta.url);
const { tryTonyFilterTableQuickReply } = require('../functions/tony-filter-table-quick-reply.js');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readUtf8(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('Seminativo — lavorazioni da diario e lavori', () => {
  it('hub lavorazioni non è più placeholder', () => {
    const card = SEMINATIVO_HUB_CARDS.find((c) => c.id === 'lavorazioni');
    expect(card.placeholder).toBe(false);
    expect(card.pageType).toBe('lavorazioni_seminativo');
  });

  it('tiene il campo aperto e scarta i filari', () => {
    expect(TIPI_LAVORAZIONE_CAMPO_APERTO).toContain('Aratura');
    expect(isLavorazioneDiFilare('Fresatura Tra le File')).toBe(true);
    expect(isTipoLavorazioneCampoAperto('Aratura')).toBe(true);
    expect(isTipoLavorazioneCampoAperto('Zappatura Sulla Fila')).toBe(false);
    expect(isTipoLavorazioneCampoAperto('Trinciatura', { nomiConsentiti: ['trinciatura'] })).toBe(true);
  });

  it('unisce diario e lavori senza doppioni', () => {
    const terreni = [{ id: 't-grano', nome: 'Seminativo' }, { id: 't-vite', nome: 'Larghetta' }];
    const campagne = [{ terrenoId: 't-grano', campagna: '2026/2027' }];
    const righe = selezionaLavorazioniCollegate({
      terreni: [terreni[0]],
      includeLavori: true,
      campagne,
      lavori: [
        { id: 'lav1', terrenoId: 't-grano', tipoLavoro: 'Aratura', dataInizio: '2026-10-02', stato: 'completato' },
        { id: 'lav2', terrenoId: 't-vite', tipoLavoro: 'Aratura', dataInizio: '2026-10-02', stato: 'completato' },
        { id: 'lav3', terrenoId: 't-grano', tipoLavoro: 'Erpicatura Tra le File', dataInizio: '2026-10-03', stato: 'completato' },
        { id: 'lav4', terrenoId: 't-grano', tipoLavoro: 'Aratura', dataInizio: '2026-10-04', stato: 'annullato' }
      ],
      attivita: [
        { id: 'a1', terrenoId: 't-grano', tipoLavoro: 'Aratura', data: '2026-10-02' },
        { id: 'a2', terrenoId: 't-grano', tipoLavoro: 'Erpicatura', data: '2026-09-20', lavoroId: 'lav9' },
        { id: 'a3', terrenoId: 't-grano', tipoLavoro: 'Rullatura', data: '2026-09-15' },
        { id: 'a4', terrenoId: 't-grano', tipoLavoro: 'Potatura', data: '2026-09-15' }
      ]
    });
    expect(righe.map((r) => r.id)).toEqual(['lav1', 'a3']);
    expect(righe[0].source).toBe('lavoro');
    expect(righe[0].campagna).toBe('2026/2027');
    expect(righe[1].source).toBe('diario');

    const soloDiario = selezionaLavorazioniCollegate({
      terreni: [terreni[0]],
      includeLavori: false,
      attivita: [
        { id: 'a1', terrenoId: 't-grano', tipoLavoro: 'Aratura', data: '2026-10-02' }
      ],
      lavori: [
        { id: 'lav1', terrenoId: 't-grano', tipoLavoro: 'Erpicatura', dataInizio: '2026-10-01', stato: 'completato' }
      ]
    });
    expect(soloDiario.map((r) => r.id)).toEqual(['a1']);
  });

  it('pagina senza form locale e senza collezione dedicata', () => {
    const page = readUtf8('modules/seminativo/views/lavorazioni-standalone.html');
    expect(page).toContain('initLavorazioniPage');
    expect(page).toContain('attivita-standalone.html');
    expect(page).toContain('gestione-lavori-standalone.html');
    expect(page).not.toContain('seminativo-lavorazione-form');
    expect(page).not.toContain('initSeminativoPlaceholderPage');

    const mapping = readUtf8('core/config/tony-form-mapping.js');
    expect(mapping).not.toContain('SEMINATIVO_LAVORAZIONE_FORM_MAP');

    const rules = readUtf8('firestore.rules');
    expect(rules).not.toContain('lavorazioniSeminativo');

    const main = readUtf8('core/js/tony/main.js');
    expect(main).toContain("lavorazioni_seminativo: { terreno:");
  });

  it('FILTER_TABLE quick reply su tipo e origine', () => {
    const ctx = {
      page: { currentTableData: { pageType: 'lavorazioni_seminativo', items: [] } }
    };
    const tipo = tryTonyFilterTableQuickReply({ message: 'filtra per aratura', ctx });
    expect(tipo.command.params.tipo).toBe('Aratura');
    const diario = tryTonyFilterTableQuickReply({ message: 'solo dal diario', ctx });
    expect(diario.command.params.origine).toBe('diario');
  });
});
