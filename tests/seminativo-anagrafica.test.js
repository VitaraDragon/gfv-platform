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
  SeminativoCampagna,
  findDuplicateCampagna,
  isTerrenoSeminativo,
  defaultCampagnaLabel,
  normalizeCampagnaKey
} from '../modules/seminativo/models/SeminativoCampagna.js';

const require = createRequire(import.meta.url);
const { tryTonyFilterTableQuickReply } = require('../functions/tony-filter-table-quick-reply.js');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readUtf8(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('Seminativo — anagrafica campagne', () => {
  it('hub anagrafica non è più placeholder', () => {
    const card = SEMINATIVO_HUB_CARDS.find((c) => c.id === 'anagrafica');
    expect(card.placeholder).toBe(false);
    expect(card.pageType).toBe('seminativi');
  });

  it('unicità terreno+campagna e filtro terreni categoria', () => {
    const list = [
      { id: 'a', terrenoId: 't1', campagna: '2025/2026' },
      { id: 'b', terrenoId: 't2', campagna: '2026/2027' }
    ];
    expect(findDuplicateCampagna(list, { terrenoId: 't1', campagna: '2025 / 2026' }, null)).toBeTruthy();
    expect(findDuplicateCampagna(list, { terrenoId: 't1', campagna: '2025/2026' }, 'a')).toBeNull();
    expect(findDuplicateCampagna(list, { terrenoId: 't1', campagna: '2026/2027' }, null)).toBeNull();
    expect(normalizeCampagnaKey('2025 / 2026')).toBe('2025/2026');
    expect(isTerrenoSeminativo({ colturaCategoria: 'Seminativo' })).toBe(true);
    expect(isTerrenoSeminativo({ colturaCategoria: 'Prato' })).toBe(false);
    expect(isTerrenoSeminativo({ coltura: 'Grano' })).toBe(false);
    expect(defaultCampagnaLabel(new Date(2026, 8, 26))).toBe('2026/2027');
    expect(defaultCampagnaLabel(new Date(2026, 2, 1))).toBe('2025/2026');
  });

  it('fromData e update restano validabili', () => {
    const row = SeminativoCampagna.fromData({
      id: 'c1',
      terrenoId: 't1',
      campagna: '2026/2027',
      colturaId: 'gr',
      colturaNome: 'Grano'
    });
    expect(row.validate().valid).toBe(true);
    row.update({ superficieEttari: 3.5, stato: 'seminato' });
    expect(row.superficieEttari).toBe(3.5);
    expect(row.toFirestore().stato).toBe('seminato');
  });

  it('pagina lista+form e mapping Tony in config', () => {
    const page = readUtf8('modules/seminativo/views/seminativi-standalone.html');
    expect(page).toContain('id="seminativo-campagna-modal"');
    expect(page).toContain('id="seminativo-campagna-form"');
    expect(page).toContain('id="seminativi-table"');
    expect(page).toContain('initSeminativiAnagraficaPage');
    expect(page).not.toContain('initSeminativoPlaceholderPage');

    const mapping = readUtf8('core/config/tony-form-mapping.js');
    expect(mapping).toContain('SEMINATIVO_CAMPAGNA_FORM_MAP');
    expect(mapping).toContain("'seminativo-campagna-form'");
    expect(mapping).toContain('campagna-terreno');

    const main = readUtf8('core/js/tony/main.js');
    expect(main).toContain('seminativi: { terreno: \'filter-terreno\'');
    expect(main).toContain('pageType === \'seminativi\'');
    expect(main).toContain('injectForm');

    const rules = readUtf8('firestore.rules');
    expect(rules).toContain('match /tenants/{tenantId}/seminativi/{campagnaId}');

    const cf = readUtf8('functions/index.js');
    expect(cf).toContain('FILTRO TABELLA SEMINATIVI');
    expect(cf).toContain('seminativo-campagna-form');
  });

  it('FILTER_TABLE quick reply su pageType seminativi', () => {
    const ctx = {
      page: {
        currentTableData: {
          pageType: 'seminativi',
          items: [
            { terreno: 'Campo Nord', coltura: 'Grano', campagna: '2026/2027', stato: 'pianificato' }
          ]
        }
      }
    };
    const stato = tryTonyFilterTableQuickReply({ message: 'solo pianificate', ctx });
    expect(stato).not.toBeNull();
    expect(stato.command.params.stato).toBe('pianificato');

    const campagna = tryTonyFilterTableQuickReply({ message: 'campagna 2026/2027', ctx });
    expect(campagna.command.params.campagna).toBe('2026/2027');

    const coltura = tryTonyFilterTableQuickReply({ message: 'filtra per grano', ctx });
    expect(coltura.command.params.coltura).toMatch(/grano/i);
  });
});
