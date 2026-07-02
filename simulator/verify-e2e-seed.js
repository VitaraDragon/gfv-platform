#!/usr/bin/env node
/**
 * Verifica seed operativo dell'ultima entry manifest (post sim:run in CI E2E).
 * @module simulator/verify-e2e-seed
 */

import { readManifest } from './lib/manifest.js';
import { initEmulatorAdmin } from './lib/emulator-context.js';
import { inspectTenantSeed } from './lib/tenant-inspect.js';
import { inspectManodoperaSeed } from './lib/manodopera-inspect.js';
import { inspectContoTerziSeed } from './lib/conto-terzi-inspect.js';
import { verifyScarichiTrattamentoVignetoTenant } from './lib/link-scarichi-trattamento-vigneto.js';
import { verifySpeseVignetoTenant } from './lib/verify-spese-vigneto-tenant.js';
import { loadTemplate, isFruttetoTemplate } from './lib/load-template.js';
import { expectedMovimentiFromTemplate } from './phases/04-simulate-magazzino.js';
import { expectedVignetoCountsFromTemplate } from './phases/05-simulate-vigneto.js';
import { expectedFruttetoCountsFromTemplate } from './phases/05-simulate-frutteto.js';
import { extraCatenaCountsManodopera } from './lib/vigneto-stub-from-trigger.js';

const templateId = process.env.GFV_SIM_E2E_TEMPLATE || 'viticola-conto-terzi-manodopera';

async function main() {
  const manifest = readManifest();
  const entry = [...manifest].reverse().find((e) => e.templateId === templateId);
  if (!entry?.tenantId) {
    console.error(`[sim:verify:e2e-seed] Nessuna entry manifest per template ${templateId}`);
    process.exit(1);
  }

  const template = loadTemplate(templateId);
  const q = template.quantities;
  const hasFrutteto = isFruttetoTemplate(template);
  const catenaExtra = extraCatenaCountsManodopera(template);
  const vigExpected = hasFrutteto ? null : expectedVignetoCountsFromTemplate(template);
  const fruttetoExpected = hasFrutteto ? expectedFruttetoCountsFromTemplate(template) : null;
  const movExpected = expectedMovimentiFromTemplate(template);
  const expectedTrattamenti = hasFrutteto
    ? fruttetoExpected.trattamenti
    : vigExpected.trattamenti + catenaExtra.trattamenti;
  const expectedLavoriSquadra = q.lavoriSquadra + catenaExtra.lavoriSquadra;

  const { db } = initEmulatorAdmin();
  const tenantId = entry.tenantId;

  const tenantSnap = await db.doc(`tenants/${tenantId}`).get();
  if (!tenantSnap.exists) {
    console.error(`[sim:verify:e2e-seed] Tenant ${tenantId} assente su emulator`);
    process.exit(1);
  }

  const inspect = await inspectTenantSeed(db, tenantId);
  if (!inspect.ok) {
    console.error(`[sim:verify:e2e-seed] inspect tenant: ${inspect.errors.join('; ')}`);
    process.exit(1);
  }

  const errors = [];
  if (inspect.counts.attivita !== q.attivitaGiorniLavorativi) {
    errors.push(`attività: attese ${q.attivitaGiorniLavorativi}, got ${inspect.counts.attivita}`);
  }
  if (hasFrutteto) {
    if (inspect.counts.trattamentiFrutteto !== expectedTrattamenti) {
      errors.push(`trattamenti frutteto: attesi ${expectedTrattamenti}, got ${inspect.counts.trattamentiFrutteto}`);
    }
    if (inspect.counts.potatureFrutteto !== fruttetoExpected.potature) {
      errors.push(`potature frutteto: attese ${fruttetoExpected.potature}, got ${inspect.counts.potatureFrutteto}`);
    }
    if (inspect.counts.raccolteFrutteto !== fruttetoExpected.raccolte) {
      errors.push(`raccolte frutteto: attese ${fruttetoExpected.raccolte}, got ${inspect.counts.raccolteFrutteto}`);
    }
  } else if (inspect.counts.trattamentiVigneto !== expectedTrattamenti) {
    errors.push(`trattamenti: attesi ${expectedTrattamenti}, got ${inspect.counts.trattamentiVigneto}`);
  }
  if (inspect.counts.movimentiMagazzino !== movExpected) {
    errors.push(`movimenti: attesi ${movExpected}, got ${inspect.counts.movimentiMagazzino}`);
  }

  const scarichi = await verifyScarichiTrattamentoVignetoTenant(db, tenantId);
  if (!hasFrutteto) {
    if (scarichi.trattamentiConScarico !== expectedTrattamenti || scarichi.origineMissing > 0) {
      errors.push(
        `scarichi catena B: trattamenti=${scarichi.trattamentiConScarico}/${expectedTrattamenti}, origineMissing=${scarichi.origineMissing}`
      );
    }

    const spese = await verifySpeseVignetoTenant(db, tenantId);
    if (!spese.ok || spese.totals.costoTotaleAnno <= 0) {
      errors.push(`spese vigneto: ${spese.errors.join('; ') || 'costoTotaleAnno <= 0'}`);
    }
  }

  if (template.moduli?.includes('manodopera')) {
    const mo = await inspectManodoperaSeed(db, tenantId, {
      squadre: Math.min(q.squadre ?? q.caposquadra, q.caposquadra),
      lavoriSquadra: expectedLavoriSquadra,
      lavoriAutonomi: q.lavoriAutonomi,
      minOreOperaioValidateDaCapo: 1,
      minOreCapoValidateDaManager: 1,
      minOreAutonomoValidateDaManager: 1,
      oreDaValidarePending: template.manodopera?.oreDaValidarePending ?? 0,
      minComunicazioniAttive: q.lavoriSquadra,
      requireConfermeDestinatari: true,
      minAssenzeMalattiaConfermate: 1,
      minLavoriStandbyAssenza: 1
    });
    if (!mo.ok) errors.push(`manodopera: ${mo.errors.join('; ')}`);
  }

  if (template.moduli?.includes('contoTerzi')) {
    const ct = await inspectContoTerziSeed(db, tenantId, {
      clienti: q.clienti,
      poderiClienti: q.poderiClienti,
      terreniClienti: q.terreniClienti,
      tariffe: q.tariffe,
      preventivi: q.preventivi,
      minPreventiviInviati: 1,
      minPreventiviAccettati: 1
    });
    if (!ct.ok) errors.push(`conto terzi: ${ct.errors.join('; ')}`);
  }

  if (errors.length) {
    console.error('[sim:verify:e2e-seed] FAIL');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log('[sim:verify:e2e-seed] OK');
  console.log(`  tenant: ${tenantId} (${entry.aziendaNome})`);
  console.log(
    `  attività ${inspect.counts.attivita}, trattamenti ${hasFrutteto ? inspect.counts.trattamentiFrutteto : inspect.counts.trattamentiVigneto}, movimenti ${inspect.counts.movimentiMagazzino}${hasFrutteto ? '' : `, scarichi ${scarichi.movimentiCollegati}`}`
  );
}

main().catch((err) => {
  console.error('[sim:verify:e2e-seed]', err.message);
  process.exit(1);
});
