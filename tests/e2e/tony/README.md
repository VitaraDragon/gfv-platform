# Tony E2E (sim seed + Playwright)

## Due modalità: gate vs explore

| Modalità | Comando | Scenari | Fallimento blocca exit? |
|----------|---------|---------|-------------------------|
| **gate** (CI PR) | `npm run sim:tony:e2e:gate` | tier 1–2 `mode=gate`, mock CF | **Sì** |
| **explore** | `npm run sim:tony:e2e:explore` | tier 3 live + draft opzionale | **No** (salvo `--strict`) |

Entrambe producono **`test-results/tony-e2e-diagnostic-report.json`** con classificazione T1–T8, opzioni di fix e raccomandazioni.

### Workflow decisionale

```
Run → diagnostic report → classificazione (T1–T8) → opzioni A/B/C → decisione umana → fix + Vitest
```

- **T2 INTERCEPT_MISS** → preferire B1 (tony-routes) + B3 (Vitest), evitare patch assert isolate
- **T3 PARSER_RECOVERY_GAP** → C1 Vitest prima di toccare prompt
- **T7 LLM_NONDETERMINISM** → assert strutturati, non fix prodotto su tier 3
- **T8 TEST_HARNESS_FRAGILE** → refactor invarianti, non patch prodotto

## Gate (tier 2 mock — PR)

Prerequisiti: `npm run sim:emulators`, `npm start`, `npm run sim:run -- --template=viticola-conto-terzi-manodopera`.

```bash
npm run sim:tony:e2e:gate           # 16 scenari gate (default CI)
npm run sim:tony:e2e:gate -- --only=T-PERF-001
```

## Explore (tier 3 live + scoperta gap)

**Guida completa:** `docs-sviluppo/in-sviluppo/simulator/TONY_E2E_GUIDA_SVILUPPO.md` **§8.1**

```bash
# Tier 3 live — report diagnostico, exit 0 anche con findings
npm run sim:tony:e2e:live

# Blocca exit se ci sono findings (pre-release)
npm run sim:tony:e2e:live:strict

# Draft typo/deny in explore
npm run sim:tony:e2e:explore:draft
```

Prerequisiti live:

1. `functions/.secret.local` con `GEMINI_API_KEY=`
2. `npm run sim:emulators:live`
3. `npm start` + seed sim

**Non usare** `sim:tony:e2e:live:prod` con Auth emulator → «sessione scaduta».

## Output

| File | Contenuto |
|------|-----------|
| `test-results/tony-e2e-diagnostic-report.json` | Findings T1–T8, opzioni, raccomandazioni |
| `test-results/tony-e2e-live-report.json` | Metriche p50/p95 (solo live) |

Matrice scenari (schema v2: `mode` + `contract`): `fixtures/scenarios-matrix.json`.

Classificatore: `helpers/tony-e2e-diagnostic.mjs` — test: `tests/tony-e2e-diagnostic.test.js`.

## Variabili utili

| Env / flag | Effetto |
|------------|---------|
| `--mode=gate\|explore` | Filtra scenari per mode |
| `--include-draft` | Include scenari draft in explore |
| `--strict` | Explore blocca exit su fallimenti |
| `GFV_TONY_E2E_DIAGNOSTIC` | Path report diagnostico |
| `GFV_TONY_E2E_ONLY=T-PERF-001` | Solo scenari indicati |
