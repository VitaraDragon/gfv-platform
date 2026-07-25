#!/usr/bin/env node
/**
 * Seed 5 aziende lab per prove sostituzioni / assenze / equipaggio.
 *
 * Prerequisito: npm run sim:emulators
 * Poi: npm run sim:run:sostituzioni-lab
 * UI: http://127.0.0.1:8000/core/dev/simulator-dev-standalone.html?emulator=1
 * Password: SimGFV2026!
 *
 * @module simulator/run-sostituzioni-lab
 */

import { runFullSimulation } from './lib/run-simulation.js';
import { isEmulatorAvailable } from './lib/emulator-available.js';
import { loadTemplate } from './lib/load-template.js';
import { readManifest } from './lib/manifest.js';

const RUNS = [
  {
    label: '01 Facile potatura (shortlist facile)',
    templateId: 'lab-sost-01-facile-potatura',
    seed: 910001,
    prove: [
      'Manager: Impegni giornalieri → assente non libero',
      'Gestione lavori: standby malattia → shortlist facile → assegna sostituto libero',
      'Capo: vedi avviso sostituto; Operaio sostituto: segna ore; Capo valida; chiudi lavoro; Manager approva'
    ]
  },
  {
    label: '02 Carro hard (min 4, skill scarse)',
    templateId: 'lab-sost-02-carro-hard',
    seed: 910002,
    prove: [
      'Gestione lavori: lavoro «Raccolta carro lab» in standby → banner equipaggio incompleto',
      'Shortlist difficile (pochi con raccolta_meccanica)',
      'Impegni giorno: previsti/assenti sul carro'
    ]
  },
  {
    label: '03 Prestito da occupati (doppio movimento seedato)',
    templateId: 'lab-sost-03-prestito-occupati',
    seed: 910003,
    prove: [
      'Verifica sostituzione già fatta + prestito su «Erpicatura scalabile»',
      'Impegni: badge Prestato / Sostituto',
      'Opzionale: nuova assenza e shortlist «Spostabile con conferma»'
    ]
  },
  {
    label: '04 Assenze miste (malattia/ferie/permesso/ingiustificata)',
    templateId: 'lab-sost-04-assenze-miste',
    seed: 910004,
    prove: [
      'Gestione lavori: banner assenze di tipi diversi (alcune solo segnalate)',
      'Standby aperto su assenza ingiustificata → assegna sostituto',
      'Impegni: ferie/malattia/ingiustificata non come «libero»'
    ]
  },
  {
    label: '05 Trapiantatrice min3 + potatura soft già sostituita',
    templateId: 'lab-sost-05-trapianto-e-soft',
    seed: 910005,
    prove: [
      'Standby «Trapianto lab» → shortlist stretta (skillMode difficile)',
      'Potatura: sostituzione già completata — capo vede sostituto, operaio segna ore',
      'Confronto: minimo fisso (trapianto) vs equipaggio variabile (potatura)'
    ]
  }
];

function printPlaybook(results) {
  console.log('\n========== PLAYBOOK PROVE SOSTITUZIONI ==========');
  console.log('Dev page: http://127.0.0.1:8000/core/dev/simulator-dev-standalone.html?emulator=1');
  console.log('Password tutti: SimGFV2026!');
  console.log('Doc: simulator/PLAYBOOK_SOSTITUZIONI_LAB.md\n');

  for (const r of results) {
    console.log(`--- ${r.label} ---`);
    console.log(`  tenantId: ${r.tenantId}`);
    console.log(`  template: ${r.templateId}`);
    if (r.personas?.length) {
      for (const p of r.personas) {
        const roles = (p.ruoli || p.roles || []).join(',');
        console.log(`  ${roles || p.role}: ${p.email}`);
      }
    }
    for (const step of r.prove || []) {
      console.log(`  • ${step}`);
    }
    console.log('');
  }
  console.log('Flusso tipico per standby aperti:');
  console.log('  Manager crea/vede → Capo segnala (già seedato) → Manager conferma/standby → shortlist → sostituto');
  console.log('  → Capo vede sostituto → Operaio sostituto segna ore → Capo valida → chiude → Manager approva');
  console.log('================================================\n');
}

async function main() {
  if (!(await isEmulatorAvailable())) {
    console.error('[sostituzioni-lab] Emulator non raggiungibile. Avvia: npm run sim:emulators');
    process.exit(1);
  }

  const started = Date.now();
  const before = readManifest().length;
  const results = [];
  let failed = 0;

  for (const run of RUNS) {
    console.log(`\n[sostituzioni-lab] >>> ${run.label} (${run.templateId})`);
    try {
      const template = loadTemplate(run.templateId);
      const result = await runFullSimulation({
        templateId: run.templateId,
        seed: run.seed,
        verbose: true
      });
      const tenantId = result.setup?.tenantId;
      const manifest = readManifest();
      const entry = [...manifest].reverse().find((e) => e.tenantId === tenantId);
      results.push({
        label: run.label,
        templateId: run.templateId,
        tenantId,
        personas: entry?.personas || [],
        prove: run.prove,
        labCounts: result.manodoperaOre?.counts?.labSostituzioni || null,
        ok: true
      });
      console.log(`[sostituzioni-lab] OK ${run.templateId} → ${tenantId}`);
      void template;
    } catch (e) {
      failed += 1;
      console.error(`[sostituzioni-lab] FAIL ${run.templateId}:`, e.message || e);
      results.push({
        label: run.label,
        templateId: run.templateId,
        tenantId: null,
        prove: run.prove,
        ok: false,
        error: String(e.message || e)
      });
    }
  }

  printPlaybook(results.filter((r) => r.ok));

  const after = readManifest().length;
  console.log(
    `[sostituzioni-lab] fatte ${results.filter((r) => r.ok).length}/${RUNS.length} in ${Math.round((Date.now() - started) / 1000)}s (manifest ${before} → ${after})`
  );
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
