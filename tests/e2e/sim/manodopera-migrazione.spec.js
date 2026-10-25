/**
 * Ciclo off → on → off della migrazione dati Manodopera sull'emulatore.
 * Parte dal tenant frutteto (senza Manodopera), copia il Diario, poi torna indietro
 * senza cancellare attività, lavori, operai o squadre e senza duplicare.
 *
 * `modules` sul doc tenant è protetto dalle rules (solo Admin SDK): le scritture
 * di piano/moduli in questo e2e passano da firebase-admin sull'emulatore.
 */
import { test, expect } from '@playwright/test';
import {
  ATTIVITA_LIST_PATH,
  GESTIONE_LAVORI_PATH,
  loginAsManagerFrutteto,
} from './helpers/sim-login.js';
import { getEmulatorDb } from '../../../simulator/lib/emulator-context.js';

const ABBONAMENTO_PATH = '/core/admin/abbonamento-standalone.html?emulator=1';
const NOTA_ALTRO = 'GFV_SIM_E2E_MIGRAZIONE_ALTRO';
const NOTA_APERTO = 'GFV_SIM_E2E_MIGRAZIONE_APERTO';

/**
 * Scrive modules (+ flag osservato) bypassando le rules client.
 * @param {string} tenantId
 * @param {{ manodopera: boolean, manodoperaModuloOsservato?: boolean|null }} opts
 */
async function patchTenantManodoperaAdmin(tenantId, opts) {
  const db = getEmulatorDb();
  const ref = db.collection('tenants').doc(tenantId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`tenant ${tenantId} assente sull'emulatore`);
  const modules = (Array.isArray(snap.data().modules) ? snap.data().modules : []).filter(
    (id) => id !== 'manodopera'
  );
  if (opts.manodopera) modules.push('manodopera');
  const patch = { modules };
  if (Object.prototype.hasOwnProperty.call(opts, 'manodoperaModuloOsservato')) {
    patch.manodoperaModuloOsservato = opts.manodoperaModuloOsservato;
  }
  await ref.update(patch);
}

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
      // modules / manodoperaModuloOsservato: Admin SDK lato Node (rules client)
      return { ok: true, tenantId };
    }

    if (action === 'seedOn') {
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
      return { altroId, tenantId };
    }

    if (action === 'seedOff') {
      return { ok: true, tenantId };
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
    const sweep1 = await nelTenant(page, 'sweep');
    await patchTenantManodoperaAdmin(sweep1.tenantId, {
      manodopera: false,
      manodoperaModuloOsservato: null,
    });
    const prima = await nelTenant(page, 'snapshot');
    expect(prima.terrenoId).toBeTruthy();
    expect(prima.nAtt).toBeGreaterThan(0);

    let lavoroApertoId = null;
    try {
      await patchTenantManodoperaAdmin(prima.tenantId, {
        manodopera: true,
        manodoperaModuloOsservato: false,
      });
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
      await patchTenantManodoperaAdmin(prima.tenantId, { manodopera: false });
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
      const sweep2 = await nelTenant(page, 'sweep');
      await patchTenantManodoperaAdmin(sweep2.tenantId || prima.tenantId, {
        manodopera: false,
        manodoperaModuloOsservato: null,
      });
    }
  });
});
