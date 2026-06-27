#!/usr/bin/env node
/**
 * Genera N aziende simulate complete (setup + asset + attività + magazzino + manodopera v2).
 * @module simulator/run-batch
 */

import { runFullSimulation } from './lib/run-simulation.js';
import { isEmulatorAvailable } from './lib/emulator-available.js';
import { initEmulatorAdmin } from './lib/emulator-context.js';
import { inspectTenantSeed } from './lib/tenant-inspect.js';
import { inspectManodoperaSeed } from './lib/manodopera-inspect.js';
import { inspectContoTerziSeed } from './lib/conto-terzi-inspect.js';
import { readManifest } from './lib/manifest.js';
import { isContoTerziTemplate, isManodoperaTemplate, loadTemplate } from './lib/load-template.js';

const args = process.argv.slice(2);
const countArg = args.find((a) => a.startsWith('--count='));
const count = Math.max(1, parseInt(countArg ? countArg.split('=')[1] : '10', 10) || 10);
const verbose = args.includes('--verbose');
const templateArg = args.find((a) => a.startsWith('--template='));
const templateId = templateArg ? templateArg.split('=')[1] : 'solo-titolare-viticola';
const operaiMinArg = args.find((a) => a.startsWith('--operai-min='));
const operaiMaxArg = args.find((a) => a.startsWith('--operai-max='));
const operaiMin = operaiMinArg ? parseInt(operaiMinArg.split('=')[1], 10) : null;
const operaiMax = operaiMaxArg ? parseInt(operaiMaxArg.split('=')[1], 10) : null;

function pickOperaiCount(min, max, seed) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 1 || max < min) {
    throw new Error(`Range operai non valido: min=${min}, max=${max}`);
  }
  return min + (Math.abs(seed) % (max - min + 1));
}

function buildManodoperaOverrides(operaiCount) {
  const nCapo = Math.min(3, Math.max(1, Math.ceil(operaiCount / 8)));
  const nSquadre = nCapo;
  return {
    quantities: {
      operai: operaiCount,
      caposquadra: nCapo,
      squadre: nSquadre,
      lavoriSquadra: Math.max(2, Math.ceil(operaiCount / 5)),
      lavoriAutonomi: Math.max(1, Math.floor(operaiCount / 6)),
      giorniOreSimulate: 10
    }
  };
}

async function main() {
  if (!(await isEmulatorAvailable())) {
    console.error('[sim:batch] Emulator non raggiungibile. Avvia: npm run sim:emulators');
    process.exit(1);
  }

  const withManodopera = isManodoperaTemplate(loadTemplate(templateId));
  const withContoTerzi = isContoTerziTemplate(loadTemplate(templateId));
  if (withManodopera && (operaiMin == null || operaiMax == null)) {
    console.error('[sim:batch] Template manodopera richiede --operai-min e --operai-max');
    process.exit(1);
  }

  const started = Date.now();
  const before = readManifest().length;
  const rows = [];

  console.log(
    `[sim:batch] Creazione ${count} aziende (template ${templateId}` +
      (withManodopera ? `, operai ${operaiMin}–${operaiMax}` : '') +
      ')…'
  );

  for (let i = 1; i <= count; i += 1) {
    const t0 = Date.now();
    const seed = 710000 + i * 7919;
    const operaiCount = withManodopera ? pickOperaiCount(operaiMin, operaiMax, seed) : null;
    const templateOverrides = operaiCount ? buildManodoperaOverrides(operaiCount) : undefined;

    try {
      const result = await runFullSimulation({
        templateId,
        seed,
        templateOverrides
      });
      const { setup, assets, simulation, magazzino, personas, manodoperaOre, contoTerzi } = result;
      const { db } = initEmulatorAdmin();
      const inspect = await inspectTenantSeed(db, setup.tenantId);
      const movimenti = magazzino.counts.movimenti;
      let manodoperaOk = true;
      let manodoperaDetail = '';
      let contoTerziOk = true;
      let contoTerziDetail = '';

      if (withContoTerzi && contoTerzi) {
        const ctTemplate = loadTemplate(templateId);
        const q = ctTemplate.quantities || {};
        const ct = await inspectContoTerziSeed(db, setup.tenantId, {
          clienti: q.clienti ?? 3,
          poderiClienti: q.poderiClienti ?? q.clienti ?? 3,
          terreniClienti: q.terreniClienti ?? 6,
          tariffe: q.tariffe ?? 8,
          preventivi: q.preventivi ?? 5,
          minPreventiviInviati: 1,
          minPreventiviAccettati: 1
        });
        contoTerziOk = ct.ok;
        contoTerziDetail = contoTerziOk
          ? `clienti ${ct.counts.clienti}, prev ${ct.counts.preventivi}`
          : ct.errors.slice(0, 2).join('; ');
      }

      if (withManodopera && personas) {
        const q = templateOverrides.quantities;
        const mo = await inspectManodoperaSeed(db, setup.tenantId, {
          squadre: Math.min(q.squadre, q.caposquadra),
          lavoriSquadra: q.lavoriSquadra,
          lavoriAutonomi: q.lavoriAutonomi,
          minOreOperaioValidateDaCapo: 1,
          minOreCapoValidateDaManager: 1,
          minOreAutonomoValidateDaManager: 1,
          minComunicazioniAttive: q.lavoriSquadra,
          requireConfermeDestinatari: true
        });
        manodoperaOk = mo.ok;
        manodoperaDetail = manodoperaOk
          ? `operai ${operaiCount}, ore ${mo.counts.oreValidate}, comm ${mo.counts.comunicazioniAttive}`
          : mo.errors.slice(0, 2).join('; ');
      }

      const ok =
        inspect.ok &&
        movimenti >= 8 &&
        simulation.counts.attivita >= 20 &&
        manodoperaOk &&
        contoTerziOk;

      rows.push({
        ok,
        aziendaNome: setup.aziendaNome,
        tenantId: setup.tenantId,
        email: setup.email,
        attivita: simulation.counts.attivita,
        movimenti,
        operai: operaiCount,
        personas: personas?.counts?.totalPersonas,
        oreValidate: manodoperaOre?.counts?.oreValidate,
        ms: Date.now() - t0
      });

      const mark = ok ? 'OK' : 'WARN';
      const extraParts = [];
      if (withManodopera) extraParts.push(manodoperaDetail);
      if (withContoTerzi) extraParts.push(contoTerziDetail);
      const extra = extraParts.length ? ` — ${extraParts.join(' | ')}` : '';
      console.log(
        `[sim:batch] ${i}/${count} ${mark} ${setup.aziendaNome} — attività ${simulation.counts.attivita}, movimenti ${movimenti}${extra} (${Date.now() - t0}ms)`
      );
      if (verbose && !inspect.ok) {
        console.warn(`  seed terreni: ${inspect.errors.join('; ')}`);
      }
      if (verbose && withManodopera && !manodoperaOk) {
        console.warn(`  manodopera: ${manodoperaDetail}`);
      }
      if (verbose && withContoTerzi && !contoTerziOk) {
        console.warn(`  conto terzi: ${contoTerziDetail}`);
      }
    } catch (err) {
      rows.push({ ok: false, error: err.message, ms: Date.now() - t0 });
      console.error(`[sim:batch] ${i}/${count} FAILED: ${err.message}`);
    }
  }

  const okCount = rows.filter((r) => r.ok).length;
  const failCount = rows.filter((r) => r.ok === false).length;
  const manifestTotal = readManifest().length;

  console.log('\n[sim:batch] Riepilogo');
  console.log(`  create in questo run: ${rows.length}`);
  console.log(`  OK: ${okCount} | errori: ${failCount}`);
  console.log(`  manifest: ${before} → ${manifestTotal} aziende`);
  if (withManodopera) {
    const operaiList = rows.filter((r) => r.operai != null).map((r) => r.operai);
    if (operaiList.length) {
      console.log(
        `  operai per azienda: min ${Math.min(...operaiList)}, max ${Math.max(...operaiList)}`
      );
    }
  }
  console.log(`  durata totale: ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`  dev UI: http://127.0.0.1:8000/core/dev/simulator-dev-standalone.html?emulator=1`);
  console.log('  password: SimGFV2026!');

  if (failCount > 0) process.exit(1);
}

main().catch((err) => {
  console.error('[sim:batch] FAILED:', err.message);
  process.exit(1);
});
