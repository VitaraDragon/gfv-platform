/**
 * Ciclo off → on → off della migrazione dati Manodopera sull'emulatore.
 * Parte dal tenant frutteto (senza Manodopera), copia il Diario, poi torna indietro
 * senza cancellare attività, lavori, operai o squadre e senza duplicare.
 */
import { test, expect } from '@playwright/test';
import {
  ATTIVITA_LIST_PATH,
  GESTIONE_LAVORI_PATH,
  loginAsManagerFrutteto,
} from './helpers/sim-login.js';

const ABBONAMENTO_PATH = '/core/admin/abbonamento-standalone.html?emulator=1';
const NOTA_ALTRO = 'GFV_SIM_E2E_MIGRAZIONE_ALTRO';
const NOTA_APERTO = 'GFV_SIM_E2E_MIGRAZIONE_APERTO';

async function nelTenant(page, action, payload) {
  return page.evaluate(async ({ action, payload }) => {
    const NOTA_ALTRO = 'GFV_SIM_E2E_MIGRAZIONE_ALTRO';
    const NOTA_APERTO = 'GFV_SIM_E2E_MIGRAZIONE_APERTO';
    const fb = await import('/core/services/firebase-service.js');
    const ts = await import('/core/services/tenant-service.js');
    const tenantId = ts.getCurrentTenantId();
    if (!tenantId) throw new Error('tenant mancante');

    const list = async (name) => {
      try {
        return await fb.getCollectionData(name, { tenantId });
      } catch (err) {
        return [];
      }
    };

    const leggiTenant = () => fb.getDocumentData('tenants', tenantId);

    if (action === 'snapshot') {
      const tenant = await leggiTenant();
      const attivita = await list('attivita');
      const lavori = await list('lavori');
      const operai = await list('operai');
      const squadre = await list('squadre');
      const terreni = await list('terreni');
      const terreno = terreni[0] || null;
      return {
        tenantId,
        modules: Array.isArray(tenant && tenant.modules) ? tenant.modules.slice() : [],
        flag: tenant ? tenant.manodoperaModuloOsservato : null,
        nAtt: attivita.length,
        nLav: lavori.length,
        nOp: operai.length,
        nSq: squadre.length,
        terrenoId: terreno && terreno.id,
        terrenoNome: (terreno && (terreno.nome || terreno.name)) || 'Terreno',
        attivitaIds: attivita.map((row) => row.id),
        lavoroIds: lavori.map((row) => row.id)
      };
    }

    if (action === 'sweep') {
      const attivita = await list('attivita');
      const lavori = await list('lavori');
      for (const row of lavori) {
        const migrato = row.origineMigrazione === 'attivita→lavoro';
        const marker = row.note === NOTA_APERTO || row.nome === 'GFV e2e migrazione aperto';
        if (migrato || marker) await fb.deleteDocument('lavori', row.id, tenantId);
      }
      for (const row of attivita) {
        const storico = row.origineMigrazione === 'lavoro→attivita';
        const marker = row.note === NOTA_ALTRO;
        if (storico || marker) {
          await fb.deleteDocument('attivita', row.id, tenantId);
          continue;
        }
        if (row.migratoALavoroIl || row.migrazioneSolaLettura) {
          await fb.updateDocument('attivita', row.id, {
            lavoroId: null,
            migratoALavoroIl: null,
            migrazioneSolaLettura: null,
            migrazioneSolaLetturaMotivo: null
          }, tenantId);
        }
      }
      const tenant = await leggiTenant();
      const modules = (Array.isArray(tenant && tenant.modules) ? tenant.modules : []).filter((id) => id !== 'manodopera');
      await fb.updateDocument('tenants', tenantId, {
        modules,
        manodoperaModuloOsservato: null
      });
      return { ok: true };
    }

    if (action === 'seedOn') {
      const tenant = await leggiTenant();
      const modules = (Array.isArray(tenant.modules) ? tenant.modules : []).filter((id) => id !== 'manodopera');
      modules.push('manodopera');
      await fb.updateDocument('tenants', tenantId, {
        modules,
        manodoperaModuloOsservato: false
      });
      const altroId = await fb.createDocument('attivita', {
        data: '2020-05-01',
        terrenoId: payload.terrenoId,
        terrenoNome: payload.terrenoNome,
        tipoLavoro: 'Altro',
        coltura: 'Melo',
        orarioInizio: '08:00',
        orarioFine: '10:00',
        pauseMinuti: 0,
        oreNette: 2,
        note: NOTA_ALTRO
      }, tenantId);
      return { altroId };
    }

    if (action === 'seedOff') {
      const tenant = await leggiTenant();
      const modules = (Array.isArray(tenant.modules) ? tenant.modules : []).filter((id) => id !== 'manodopera');
      await fb.updateDocument('tenants', tenantId, { modules });
      return { ok: true };
    }

    if (action === 'lavoroAperto') {
      const lavoroId = await fb.createDocument('lavori', {
        nome: 'GFV e2e migrazione aperto',
        terrenoId: payload.terrenoId,
        tipoLavoro: 'Potatura',
        dataInizio: new Date(),
        durataPrevista: 1,
        stato: 'in_corso',
        caposquadraId: null,
        operaioId: null,
        note: NOTA_APERTO
      }, tenantId);
      return { lavoroId };
    }

    if (action === 'conteggi') {
      const attivita = await list('attivita');
      const lavori = await list('lavori');
      const operai = await list('operai');
      const squadre = await list('squadre');
      const lavoroId = payload && payload.lavoroId;
      const collegati = lavoroId ? attivita.filter((row) => row.lavoroId === lavoroId).length : 0;
      const originali = (payload && payload.attivitaIds) || [];
      const ids = new Set(attivita.map((row) => row.id));
      const originaliPresenti = originali.every((id) => ids.has(id));
      const apertiPresenti = lavoroId ? lavori.some((row) => row.id === lavoroId) : true;
      return {
        nAtt: attivita.length,
        nLav: lavori.length,
        nOp: operai.length,
        nSq: squadre.length,
        collegati,
        originaliPresenti,
        apertiPresenti
      };
    }

    throw new Error('azione sconosciuta ' + action);
  }, { action, payload });
}

test.describe('Migrazione dati Manodopera', () => {
  test('off → on → off non perde lo storico e non duplica', async ({ page }) => {
    test.setTimeout(240_000);
    await loginAsManagerFrutteto(page);
    await nelTenant(page, 'sweep');
    const prima = await nelTenant(page, 'snapshot');
    expect(prima.terrenoId).toBeTruthy();
    expect(prima.nAtt).toBeGreaterThan(0);

    let lavoroApertoId = null;
    try {
      await nelTenant(page, 'seedOn', {
        terrenoId: prima.terrenoId,
        terrenoNome: prima.terrenoNome
      });

      await page.goto(ABBONAMENTO_PATH);
      await expect(page.locator('#gfv-standalone-toast-layer')).toContainText(/creati/, { timeout: 90_000 });

      const dopoOn = await nelTenant(page, 'conteggi', { attivitaIds: prima.attivitaIds });
      expect(dopoOn.nLav).toBeGreaterThan(prima.nLav);
      expect(dopoOn.nAtt).toBe(prima.nAtt + 1);
      expect(dopoOn.originaliPresenti).toBe(true);
      expect(dopoOn.nOp).toBe(prima.nOp);
      expect(dopoOn.nSq).toBe(prima.nSq);

      await page.goto(GESTIONE_LAVORI_PATH);
      await expect(page.locator('#gestione-lavori-gate')).toBeHidden();
      await expect(page.locator('#attivita-precedenti-section')).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('.attivita-precedente-row')).toContainText('Altro');

      await page.goto(ATTIVITA_LIST_PATH);
      await page.waitForFunction(() => document.body.dataset.gfvDiario === 'storico');
      await expect(page.locator('#btn-aggiungi-attivita')).toBeHidden();

      const aperto = await nelTenant(page, 'lavoroAperto', { terrenoId: prima.terrenoId });
      lavoroApertoId = aperto.lavoroId;
      await nelTenant(page, 'seedOff');

      await page.goto(ABBONAMENTO_PATH);
      await expect(page.locator('#abbonamento-confirm-title')).toHaveText('Lavori ancora aperti', { timeout: 60_000 });
      await expect(page.locator('#abbonamento-confirm-body')).toContainText('lavori ancora aperti');
      await page.locator('#abbonamento-confirm-cancel').click();

      const dopoAnnulla = await nelTenant(page, 'conteggi', {
        attivitaIds: prima.attivitaIds,
        lavoroId: lavoroApertoId
      });
      expect(dopoAnnulla.collegati).toBe(0);
      expect(dopoAnnulla.apertiPresenti).toBe(true);

      await page.reload();
      await expect(page.locator('#abbonamento-confirm-title')).toHaveText('Lavori ancora aperti', { timeout: 60_000 });
      await page.locator('#abbonamento-confirm-ok').click();
      await expect(page.locator('#gfv-standalone-toast-layer')).toContainText(/creati/, { timeout: 90_000 });

      const dopoOff = await nelTenant(page, 'conteggi', {
        attivitaIds: prima.attivitaIds,
        lavoroId: lavoroApertoId
      });
      expect(dopoOff.collegati).toBe(1);
      expect(dopoOff.apertiPresenti).toBe(true);
      expect(dopoOff.originaliPresenti).toBe(true);
      expect(dopoOff.nOp).toBe(prima.nOp);
      expect(dopoOff.nSq).toBe(prima.nSq);
      expect(dopoOff.nLav).toBeGreaterThanOrEqual(dopoOn.nLav + 1);

      await page.goto(ATTIVITA_LIST_PATH);
      await expect(page.locator('#btn-aggiungi-attivita')).toBeVisible({ timeout: 60_000 });

      const stabili = dopoOff.nAtt;
      await page.goto(ABBONAMENTO_PATH);
      await expect(page.locator('#current-plan-name')).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('#abbonamento-confirm-overlay')).not.toHaveClass(/is-open/);
      const ripetuta = await nelTenant(page, 'conteggi', {
        attivitaIds: prima.attivitaIds,
        lavoroId: lavoroApertoId
      });
      expect(ripetuta.nAtt).toBe(stabili);
      expect(ripetuta.nLav).toBe(dopoOff.nLav);
      expect(ripetuta.collegati).toBe(1);
    } finally {
      await nelTenant(page, 'sweep');
    }
  });
});
