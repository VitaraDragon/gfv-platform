#!/usr/bin/env node
/**
 * Canary catena ripresa → chiusura lavoro sospeso origine.
 * Uso:
 *   node scripts/lavoro-ripresa-canary.mjs
 *   node scripts/lavoro-ripresa-canary.mjs --ripresa-id=bF4IWHLAFVkezdd6IN5V
 *   node scripts/lavoro-ripresa-canary.mjs --emulator-only
 */
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASE = process.env.GFV_E2E_BASE_URL || 'http://127.0.0.1:8000';
const RIPRESA_ID = (process.argv.find((a) => a.startsWith('--ripresa-id=')) || '').split('=')[1] || '';
const EMULATOR_ONLY = process.argv.includes('--emulator-only');
const PROD_PROBE = process.argv.includes('--prod-probe');

const results = [];
function pass(id, detail) { results.push({ id, ok: true, detail }); console.log(`  PASS  ${id}: ${detail}`); }
function fail(id, detail) { results.push({ id, ok: false, detail }); console.log(`  FAIL  ${id}: ${detail}`); }
function info(msg) { console.log(`  INFO  ${msg}`); }

async function probeProductionFirestore(targetRipresaId) {
  try {
    const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    if (!getApps().length) {
      initializeApp({ projectId: 'gfv-platform', credential: applicationDefault() });
    }
    const db = getFirestore();

    function normalizeId(ref) {
      if (ref == null || ref === '') return null;
      if (typeof ref === 'object' && ref.id) return String(ref.id);
      const raw = String(ref).trim();
      if (!raw) return null;
      if (raw.includes('/')) return raw.split('/').filter(Boolean).pop() || null;
      return raw;
    }

    function resolveOrigine(ripresa, byId) {
      const candidates = [normalizeId(ripresa.ripresaDaLavoroId), normalizeId(ripresa.lavoroRadiceId)].filter(Boolean);
      for (const id of candidates) {
        const lav = byId.get(String(id));
        if (lav?.stato === 'sospeso' && !lav.ripresaDaLavoroId) return { id: String(id), data: lav };
      }
      for (const id of candidates) {
        const lav = byId.get(String(id));
        if (lav) return { id: String(id), data: lav };
      }
      for (const [id, lav] of byId.entries()) {
        if (lav.stato !== 'sospeso' || lav.ripresaDaLavoroId) continue;
        if (ripresa.terrenoId && lav.terrenoId !== ripresa.terrenoId) continue;
        if (ripresa.operaioId && lav.operaioId !== ripresa.operaioId) continue;
        const nomeRipresa = String(ripresa.nome || '').replace(/\s*\(ripresa\)\s*$/i, '').trim().toLowerCase();
        const nomeSosp = String(lav.nome || '').trim().toLowerCase();
        if (nomeRipresa && nomeSosp && nomeRipresa !== nomeSosp) continue;
        return { id, data: lav };
      }
      return null;
    }

    const tenantsSnap = await db.collection('tenants').limit(40).get();
    for (const tenantDoc of tenantsSnap.docs) {
      const tenantId = tenantDoc.id;
      const lavoriSnap = await db.collection(`tenants/${tenantId}/lavori`).get();
      const list = lavoriSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const byId = new Map(list.map((l) => [String(l.id), l]));
      const hits = targetRipresaId
        ? list.filter((l) => l.id === targetRipresaId)
        : list.filter((l) => l.stato === 'completato' && l.ripresaDaLavoroId);
      if (!hits.length) continue;
      for (const ripresa of hits) {
        const origineId = normalizeId(ripresa.ripresaDaLavoroId);
        const origineDoc = origineId ? byId.get(origineId) : null;
        const resolved = resolveOrigine(ripresa, byId);
        const origineStato = origineDoc?.stato || resolved?.data?.stato || null;
        const wouldClose = ripresa.stato === 'completato' && origineStato === 'sospeso';
        const row = {
          tenantId,
          ripresaId: ripresa.id,
          ripresaNome: ripresa.nome,
          ripresaStato: ripresa.stato,
          ripresaDa: ripresa.ripresaDaLavoroId,
          origineId,
          origineExists: Boolean(origineDoc),
          origineStato,
          origineResolvedId: resolved?.id || null,
          parziale: ripresa.completamentoParziale === true,
          perc: ripresa.percentualeCompletamento ?? ripresa.percentualeCompletamentoTracciata ?? null,
          wouldCloseAfterFix: wouldClose
        };
        info(`prod ${JSON.stringify(row)}`);
        if (row.origineStato === 'sospeso' && row.wouldCloseAfterFix) {
          pass('prod:chain-fixable', `${ripresa.id} → ${row.origineResolvedId || row.origineId}`);
        } else if (!row.origineExists && !row.origineResolvedId) {
          fail('prod:orphan-ripresa', `${ripresa.id} punta a ${origineId} (documento assente)`);
        } else if (row.origineStato === 'sospeso' && !row.wouldCloseAfterFix) {
          fail('prod:chain-blocked', `${ripresa.id} origine ${row.origineId} ancora sospeso ma wouldClose=false`);
        }
      }
      return true;
    }
    if (targetRipresaId) fail('prod:target', `ripresa ${targetRipresaId} non trovata`);
    return false;
  } catch (e) {
    fail('prod:probe', e.message || String(e));
    return false;
  }
}

async function probeEmulatorFirestore() {
  try {
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
    const { initializeApp, getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    const cfg = JSON.parse(readFileSync(join(ROOT, 'simulator/config/emulator.json'), 'utf8'));
    if (!getApps().length) initializeApp({ projectId: cfg.projectId });
    const db = getFirestore();
    const tenantsSnap = await db.collection('tenants').limit(20).get();
    const chains = [];
    for (const tenantDoc of tenantsSnap.docs) {
      const lavoriSnap = await db.collection(`tenants/${tenantDoc.id}/lavori`).get();
      const all = lavoriSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      for (const lav of all) {
        if (lav.stato !== 'completato' || !lav.ripresaDaLavoroId) continue;
        const raw = lav.ripresaDaLavoroId;
        const origineId = typeof raw === 'string'
          ? (raw.includes('/') ? raw.split('/').filter(Boolean).pop() : raw)
          : (raw?.id || null);
        const origine = all.find((x) => x.id === origineId);
        chains.push({
          tenantId: tenantDoc.id,
          ripresaId: lav.id,
          ripresaNome: lav.nome,
          ripresaDaRaw: raw,
          origineId,
          origineStato: origine?.stato || '(assente in tenant)',
          origineNome: origine?.nome || null,
          parziale: lav.completamentoParziale === true,
          perc: lav.percentualeCompletamento ?? lav.percentualeCompletamentoTracciata ?? null
        });
      }
    }
    return chains;
  } catch (e) {
    info(`emulator firestore probe skip: ${e.message}`);
    return [];
  }
}

async function runBrowserCanary() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ baseURL: BASE });
  await context.addInitScript(() => {
    try { localStorage.setItem('gfv_firebase_emulator', '1'); } catch (_) {}
  });
  const page = await context.newPage();
  const consoleLines = [];
  page.on('console', (msg) => {
    const t = msg.text();
    if (/ripresa|GESTIONE-LAVORI|lavori-service/i.test(t)) consoleLines.push(t);
  });

  try {
    await page.goto('/core/dev/simulator-dev-standalone.html?emulator=1');
    await page.waitForSelector('.card, .empty', { timeout: 45_000 });
    if (await page.locator('.empty').isVisible()) {
      fail('browser:manifest', 'Nessuna azienda emulator — npm run sim:run');
      return null;
    }
    const card = page.locator('.card').filter({ hasText: 'manodopera' }).first();
    if (await card.count()) {
      await card.getByRole('button', { name: /Entra come manager/i }).click();
    } else {
      await page.locator('.card').first().getByRole('button', { name: /Entra come manager/i }).click();
    }
    await page.waitForURL(/dashboard-standalone\.html/, { timeout: 60_000 });

    await page.goto('/core/admin/gestione-lavori-standalone.html?emulator=1');
    await page.waitForFunction(() => {
      const c = document.getElementById('lavori-container');
      return c && !c.querySelector('.loading') && (window.lavoriState?.lavoriList?.length ?? 0) >= 0;
    }, { timeout: 60_000 });

    const report = await page.evaluate(async (targetRipresaId) => {
      const svc = await import('/core/services/lavori-service.js');
      const list = window.lavoriState?.lavoriList || [];
      const tenantId = window.lavoriState?.currentTenantId;
      const byId = new Map(list.map((l) => [String(l.id), l]));
      const riprese = list.filter((l) => l.ripresaDaLavoroId);
      const sospesi = list.filter((l) => l.stato === 'sospeso');
      const completate = riprese.filter((l) => l.stato === 'completato');

      const chains = completate.map((r) => {
        const resolved = svc.resolveOrigineSospesoForRipresa(r, byId);
        return {
          ripresaId: r.id,
          ripresaNome: r.nome,
          ripresaStato: r.stato,
          ripresaDaRaw: r.ripresaDaLavoroId,
          ripresaDaNorm: svc.normalizeLavoroFirestoreId(r.ripresaDaLavoroId),
          parziale: r.completamentoParziale,
          perc: r.percentualeCompletamento ?? r.percentualeCompletamentoTracciata,
          origineResolved: resolved?.id || null,
          origineStato: resolved?.data?.stato || null
        };
      });

      let repairResult = [];
      if (tenantId && list.length) {
        repairResult = await svc.repairSospesiConRipresaGiaCompletata(list, tenantId, window.lavoriState?.db || null);
      }

      let target = null;
      if (targetRipresaId) {
        const r = list.find((l) => l.id === targetRipresaId);
        if (r) {
          const resolved = svc.resolveOrigineSospesoForRipresa(r, byId);
          target = {
            ripresa: r,
            resolved,
            should: resolved ? svc.shouldCompletaLavoroSospesoOrigineDaRipresa(r, resolved.data?.stato, {
              ripresaStato: 'completato',
              isParziale: false
            }) : false
          };
        }
      }

      return {
        tenantId,
        total: list.length,
        riprese: riprese.length,
        sospesi: sospesi.map((s) => ({ id: s.id, nome: s.nome })),
        chains,
        repairResult,
        target,
        sospesiAfter: list.filter((l) => l.stato === 'sospeso').map((s) => ({ id: s.id, nome: s.nome }))
      };
    }, RIPRESA_ID);

    info(`tenant=${report.tenantId} lavori=${report.total} riprese=${report.riprese} sospesi=${report.sospesi.length}`);
    for (const c of report.chains) {
      info(`chain ripresa=${c.ripresaId} → origine=${c.origineResolved} (${c.origineStato}) raw=${JSON.stringify(c.ripresaDaRaw)}`);
    }
    if (report.repairResult?.length) pass('browser:repair', `allineati: ${report.repairResult.join(', ')}`);
    else if (report.chains.some((c) => c.origineStato === 'sospeso')) {
      fail('browser:repair', `catena aperta: ${JSON.stringify(report.chains.filter((c) => c.origineStato === 'sospeso'))}`);
    } else if (report.chains.length === 0) {
      info('browser:repair', 'nessuna ripresa completata in emulator');
    } else {
      pass('browser:repair', 'nessun sospeso orfano');
    }
    if (report.sospesiAfter?.length) {
      info(`sospesi residui: ${JSON.stringify(report.sospesiAfter)}`);
    }
    return report;
  } finally {
    if (consoleLines.length) {
      info('console ripresa:');
      consoleLines.slice(-15).forEach((l) => console.log(`         ${l}`));
    }
    await browser.close();
  }
}

async function main() {
  console.log('\n=== Lavoro ripresa canary ===');
  console.log(`Base: ${BASE} | ripresa-id: ${RIPRESA_ID || '(auto)'}\n`);

  const emuChains = await probeEmulatorFirestore();
  if (emuChains.length) {
    pass('emulator:chains', `${emuChains.length} catene trovate`);
    emuChains.forEach((c) => info(JSON.stringify(c)));
  } else {
    info('emulator: nessuna catena ripresa→completato');
  }

  if (PROD_PROBE || RIPRESA_ID) {
    await probeProductionFirestore(RIPRESA_ID);
  }

  if (!EMULATOR_ONLY && !PROD_PROBE) {
    const report = await runBrowserCanary();
    if (RIPRESA_ID && report && !report.target) {
      fail('prod:target', `ripresa ${RIPRESA_ID} non trovata nel tenant corrente (browser emulator)`);
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${failed.length ? 'FAIL' : 'OK'} (${results.length} check) ===\n`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
