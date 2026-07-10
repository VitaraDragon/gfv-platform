# Sim E2E app (71 spec Playwright)

## Due modalità: gate vs explore

| Modalità | Comando | Comportamento |
|----------|---------|---------------|
| **gate** | `npm run sim:e2e:gate` | 71 scenari — **blocca CI** su fallimento + report diagnostico |
| **explore** | `npm run sim:e2e:explore` | Stessi 71 scenari — **report findings**, exit 0 (salvo `--strict`) |

Prerequisiti: `npm run sim:emulators`, `npm start`, triple-seed come in CI (viticola + frutteto + mista).

```bash
npm run sim:run -- --template=viticola-conto-terzi-manodopera
npm run sim:run -- --template=frutteto-solo-titolare
npm run sim:run -- --template=mista-viticola-frutteto-conto-terzi-manodopera
```

## Workflow decisionale

```
Run → test-results/sim-e2e-diagnostic-report.json
    → classificazione T1/T4/T5/T6/T8
    → opzioni A/D/E/F/H
    → decisione umana
    → fix prodotto o refactor test
```

### Classificazioni app (binario B)

| Codice | Significato |
|--------|-------------|
| T1 | Seed/template insufficiente |
| T4 | Regressione prodotto / save |
| T5 | Drift DOM / selettori |
| T6 | Timeout pagina |
| T8 | Test fragile |

## Output

| File | Contenuto |
|------|-----------|
| `test-results/sim-e2e-diagnostic-report.json` | Findings + opzioni fix |
| Screenshot Playwright | `test-results/` su fallimento |

## Registry scenari

Metadati auto-derivati da nome spec + override in `helpers/sim-e2e-scenario-meta.mjs`:
- `contract.invariant`
- `requiresSeedProfile`
- `category` (read / write / hub / integration)

## Comandi

```bash
npm run sim:e2e:gate              # CI / pre-merge (71 spec)
npm run sim:e2e:explore           # diagnostica locale non bloccante
npm run sim:e2e:explore -- --strict
npm run sim:e2e:gate -- --only=trattori-write

# Runner Node alternativo (71 scenari, stesso report)
npm run sim:e2e:node
npm run sim:e2e:node:explore
```

Vitest classificatore: `tests/sim-e2e-diagnostic.test.js`
