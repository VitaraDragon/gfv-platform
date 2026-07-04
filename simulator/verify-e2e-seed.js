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
import { loadTemplate, isFruttetoTemplate, isMistoColtureTemplate } from './lib/load-template.js';
import { expectedMixedColtureCountsFromTemplate } from './lib/mixed-colture-utils.js';
import { expectedMovimentiFromTemplate } from './phases/04-simulate-magazzino.js';
import { expectedVignetoCountsFromTemplate } from './phases/05-simulate-vigneto.js';
import { expectedFruttetoCountsFromTemplate } from './phases/05-simulate-frutteto.js';
import { extraCatenaCountsManodopera } from './lib/vigneto-stub-from-trigger.js';
import { extraCatenaCountsManodoperaFrutteto } from './lib/frutteto-stub-from-trigger.js';

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
  const fruttetoOnly = isFruttetoTemplate(template);
  const misto = isMistoColtureTemplate(template);
  const catenaExtraV = extraCatenaCountsManodopera(template);
  const catenaExtraF = extraCatenaCountsManodoperaFrutteto(template);
  const mixedExpected = misto ? expectedMixedColtureCountsFromTemplate(template) : null;
  const vigExpected = misto ? mixedExpected.vigneto : (fruttetoOnly ? null : expectedVignetoCountsFromTemplate(template));
  const fruttetoExpected = misto
    ? mixedExpected.frutteto
    : (fruttetoOnly ? expectedFruttetoCountsFromTemplate(template) : null);
  const movExpected = expectedMovimentiFromTemplate(template);
  const expectedTrattamentiVigneto = misto
    ? vigExpected.trattamenti + catenaExtraV.trattamenti
    : (fruttetoOnly ? 0 : vigExpected.trattamenti + catenaExtraV.trattamenti);
  const expectedTrattamentiFrutteto = misto
    ? fruttetoExpected.trattamenti + catenaExtraF.trattamenti
    : (fruttetoOnly ? fruttetoExpected.trattamenti : 0);
  const expectedLavoriSquadra = q.lavoriSquadra
    + (fruttetoOnly ? 0 : catenaExtraV.lavoriSquadra)
    + (misto || fruttetoOnly ? catenaExtraF.lavoriSquadra : 0);

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
  if (misto || fruttetoOnly) {
    const expectedRaccolte = fruttetoExpected.raccolte
      + (template.moduli?.includes('manodopera') ? catenaExtraF.raccolte : 0);
    if (inspect.counts.trattamentiFrutteto !== expectedTrattamentiFrutteto) {
      errors.push(`trattamenti frutteto: attesi ${expectedTrattamentiFrutteto}, got ${inspect.counts.trattamentiFrutteto}`);
    }
    if (inspect.counts.potatureFrutteto !== fruttetoExpected.potature) {
      errors.push(`potature frutteto: attese ${fruttetoExpected.potature}, got ${inspect.counts.potatureFrutteto}`);
    }
    if (inspect.counts.raccolteFrutteto !== expectedRaccolte) {
      errors.push(`raccolte frutteto: attese ${expectedRaccolte}, got ${inspect.counts.raccolteFrutteto}`);
    }
  }
  if (misto || !fruttetoOnly) {
    if (inspect.counts.trattamentiVigneto !== expectedTrattamentiVigneto) {
      errors.push(`trattamenti vigneto: attesi ${expectedTrattamentiVigneto}, got ${inspect.counts.trattamentiVigneto}`);
    }
    if (misto) {
      const expectedVendemmie = vigExpected.vendemmie + catenaExtraV.vendemmie;
      if (inspect.counts.potatureVigneto !== vigExpected.potature) {
        errors.push(`potature vigneto: attese ${vigExpected.potature}, got ${inspect.counts.potatureVigneto}`);
      }
      if (inspect.counts.vendemmieVigneto !== expectedVendemmie) {
        errors.push(`vendemmie vigneto: attese ${expectedVendemmie}, got ${inspect.counts.vendemmieVigneto}`);
      }
    }
  }
  if (inspect.counts.movimentiMagazzino !== movExpected) {
    errors.push(`movimenti: attesi ${movExpected}, got ${inspect.counts.movimentiMagazzino}`);
  }

  const scarichi = await verifyScarichiTrattamentoVignetoTenant(db, tenantId);
  if (misto || !fruttetoOnly) {
    if (!misto && (scarichi.trattamentiConScarico !== movExpected || scarichi.origineMissing > 0)) {
      errors.push(
        `scarichi catena B: trattamenti=${scarichi.trattamentiConScarico}/${movExpected}, origineMissing=${scarichi.origineMissing}`
      );
    }
    if (misto && scarichi.origineMissing > 0) {
      errors.push(`scarichi catena B vigneto: origineMissing=${scarichi.origineMissing}`);
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
    `  attività ${inspect.counts.attivita}, trattamenti vigneto ${inspect.counts.trattamentiVigneto}, trattamenti frutteto ${inspect.counts.trattamentiFrutteto}, movimenti ${inspect.counts.movimentiMagazzino}${fruttetoOnly ? '' : `, scarichi vigneto ${scarichi.movimentiCollegati}`}`
  );
}

main().catch((err) => {
  console.error('[sim:verify:e2e-seed]', err.message);
  process.exit(1);
});
