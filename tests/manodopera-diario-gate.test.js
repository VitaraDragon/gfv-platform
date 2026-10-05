/**
 * @vitest-environment node
 */

import { readFileSync } from 'node:fs';
import { describe, test, expect } from 'vitest';
import {
  tenantHasManodopera,
  registroLavoriHref,
  applyRegistroLavoriLinks,
  applyDiarioVsLavoroCta
} from '../core/config/manodopera-diario-gate.js';

describe('gate manodopera / diario', () => {
  test('riconosce il modulo indipendentemente dalle maiuscole', () => {
    expect(tenantHasManodopera(['Vigneto', 'Manodopera'])).toBe(true);
    expect(tenantHasManodopera(['vigneto', 'contoTerzi'])).toBe(false);
    expect(tenantHasManodopera(null)).toBe(false);
  });

  test('senza Manodopera i lavori CT restano sul Diario', () => {
    expect(registroLavoriHref({
      hasManodopera: false,
      stato: 'in_corso',
      from: 'module'
    })).toBe('../../../core/attivita-standalone.html?contoTerzi=true&stato=in_corso');
    expect(registroLavoriHref({
      hasManodopera: false,
      stato: 'completato',
      from: 'module'
    })).toContain('attivita-standalone.html');
    expect(registroLavoriHref({
      hasManodopera: false,
      stato: 'da_pianificare',
      from: 'module'
    })).toBe('');
  });

  test('con Manodopera i lavori CT aprono Gestione lavori, non il Diario', () => {
    const inCorso = registroLavoriHref({
      hasManodopera: true,
      stato: 'in_corso',
      from: 'module'
    });
    expect(inCorso).toContain('gestione-lavori-standalone.html');
    expect(inCorso).toContain('contoTerzi=true');
    expect(inCorso).toContain('stato=in_corso');
    expect(inCorso).not.toContain('attivita-standalone');

    const vm = registroLavoriHref({ hasManodopera: true, from: 'module' });
    expect(vm).toBe('../../../core/admin/gestione-lavori-standalone.html?contoTerzi=true');

    expect(registroLavoriHref({
      hasManodopera: true,
      stato: 'da_pianificare',
      from: 'core'
    })).toBe('admin/gestione-lavori-standalone.html?stato=da_pianificare');
  });

  test('la quick bar CT usa lo stesso href di Gestione lavori', () => {
    const src = readFileSync(new URL('../core/js/dashboard-quick-bar.js', import.meta.url), 'utf8');
    expect(src).toContain(registroLavoriHref({
      hasManodopera: true,
      stato: 'in_corso',
      from: 'core'
    }));
    expect(src).toContain(registroLavoriHref({
      hasManodopera: true,
      stato: 'completato',
      from: 'core'
    }));
  });

  test('i link marcati cambiano destinazione e nascondono Da pianificare', () => {
    const links = {
      in_corso: { hidden: false, href: '', kind: 'in_corso' },
      da_pianificare: { hidden: false, href: '', kind: 'da_pianificare' }
    };
    const root = {
      querySelectorAll(sel) {
        expect(sel).toBe('[data-gfv-registro]');
        return Object.values(links).map((link) => ({
          getAttribute(name) {
            if (name === 'data-gfv-registro') return link.kind;
            if (name === 'data-gfv-registro-from') return null;
            return null;
          },
          setAttribute(name, value) {
            if (name === 'href') link.href = value;
          },
          set hidden(value) {
            link.hidden = value;
          }
        }));
      }
    };

    applyRegistroLavoriLinks(root, false);
    expect(links.in_corso.href).toContain('attivita-standalone.html');
    expect(links.in_corso.hidden).toBe(false);
    expect(links.da_pianificare.hidden).toBe(true);

    applyRegistroLavoriLinks(root, true);
    expect(links.in_corso.href).toContain('gestione-lavori-standalone.html');
    expect(links.da_pianificare.hidden).toBe(false);
    expect(links.da_pianificare.href).toContain('stato=da_pianificare');
  });

  test('Registra nel diario sparisce quando Manodopera è attiva', () => {
    const nodes = {
      'link-diario': { hidden: false },
      'link-nuovo-lavoro': { hidden: true }
    };
    const root = {
      getElementById(id) {
        return nodes[id] || null;
      }
    };
    applyDiarioVsLavoroCta(root, true);
    expect(nodes['link-diario'].hidden).toBe(true);
    expect(nodes['link-nuovo-lavoro'].hidden).toBe(false);
    applyDiarioVsLavoroCta(root, false);
    expect(nodes['link-diario'].hidden).toBe(false);
    expect(nodes['link-nuovo-lavoro'].hidden).toBe(true);
  });
});
