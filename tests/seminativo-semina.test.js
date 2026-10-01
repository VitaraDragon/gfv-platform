/**
 * @vitest-environment node
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { SEMINATIVO_HUB_CARDS, SEMINE_SEMINATIVO_COLLECTION } from '../modules/seminativo/config/seminativo-hub.js';
import {
  SeminativoSemina,
  statoDopoSemina,
  statoDopoRimozioneSemina,
  SEMINA_UNITA_DOSE
} from '../modules/seminativo/models/SeminativoSemina.js';

const require = createRequire(import.meta.url);
const { tryTonyFilterTableQuickReply } = require('../functions/tony-filter-table-quick-reply.js');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readUtf8(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('Seminativo — semina', () => {
  it('hub semina non è più placeholder', () => {
    const card = SEMINATIVO_HUB_CARDS.find((c) => c.id === 'semina');
    expect(card.placeholder).toBe(false);
    expect(card.pageType).toBe('semina_seminativo');
    expect(SEMINE_SEMINATIVO_COLLECTION).toBe('semineSeminativo');
  });

  it('valida data e campagna e tiene la dose opzionale', () => {
    expect(new SeminativoSemina().validate().valid).toBe(false);
    const ok = new SeminativoSemina({
      campagnaId: 'c1',
      dataSemina: '2026-10-12',
      varieta: 'Bologna',
      doseSeme: 180,
      unitaDose: 'kg/ha'
    });
    expect(ok.validate()).toEqual({ valid: true, errors: [] });
    expect(ok.toFirestore().doseSeme).toBe(180);
    expect(SEMINA_UNITA_DOSE).toContain('kg/ha');

    const badDose = new SeminativoSemina({
      campagnaId: 'c1',
      dataSemina: '2026-10-12',
      doseSeme: 0
    });
    expect(badDose.validate().valid).toBe(false);
  });

  it('prima semina marca seminato, l’ultima rimozione torna a pianificato', () => {
    expect(statoDopoSemina('pianificato')).toBe('seminato');
    expect(statoDopoSemina('in_ciclo')).toBe('in_ciclo');
    expect(statoDopoSemina('raccolto')).toBe('raccolto');
    expect(statoDopoRimozioneSemina('seminato')).toBe('pianificato');
    expect(statoDopoRimozioneSemina('in_ciclo')).toBe('in_ciclo');
  });

  it('pagina, mapping Tony e regole', () => {
    const page = readUtf8('modules/seminativo/views/semina-standalone.html');
    expect(page).toContain('id="seminativo-semina-form"');
    expect(page).toContain('id="semina-campagna"');
    expect(page).toContain('initSeminePage');
    expect(page).not.toContain('initSeminativoPlaceholderPage');

    const mapping = readUtf8('core/config/tony-form-mapping.js');
    expect(mapping).toContain('SEMINATIVO_SEMINA_FORM_MAP');
    expect(mapping).toContain("'seminativo-semina-form'");
    expect(mapping).toContain('semina-varieta');

    const rules = readUtf8('firestore.rules');
    expect(rules).toContain('match /tenants/{tenantId}/semineSeminativo/{seminaId}');

    const main = readUtf8('core/js/tony/main.js');
    expect(main).toContain('semina_seminativo: { campagna:');
  });

  it('FILTER_TABLE quick reply sulla pagina semina', () => {
    const ctx = {
      page: {
        currentTableData: {
          pageType: 'semina_seminativo',
          items: [{ coltura: 'Grano', campagna: '2026/2027', varieta: 'Bologna' }]
        }
      }
    };
    const campagna = tryTonyFilterTableQuickReply({ message: 'campagna 2026/2027', ctx });
    expect(campagna.command.params.ricerca).toBe('2026/2027');
    const coltura = tryTonyFilterTableQuickReply({ message: 'filtra per grano', ctx });
    expect(coltura.command.params.ricerca).toMatch(/grano/i);
  });
});