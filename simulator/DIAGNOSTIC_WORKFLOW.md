# Simulatore — workflow diagnostico unificato

Due binari (app + Tony), un solo flusso decisionale.

## Comandi quotidiani

| Quando | Comando |
|--------|---------|
| **Dopo modifiche (locale, non blocca)** | `npm run sim:diagnostic:explore` |
| **Prima del push (blocca se fail)** | `npm run sim:diagnostic:gate` |
| **Gate locale se Playwright hang (Windows)** | `npm run sim:e2e:node` + `npm run sim:tony:e2e:gate` (+ opz. `sim:diagnostic:merge`) |
| **Verifica pipeline (2 scenari)** | `npm run sim:diagnostic:smoke` |
| **Solo merge report esistenti** | `npm run sim:diagnostic:merge` |

## Prerequisiti (terminale 1–3)

```bash
# T1 — emulator
npm run sim:emulators

# T2 — ERP
npm start

# T3 — seed (minimo viticola+CT+manodopera; CI usa triple-seed)
npm run sim:run -- --template=viticola-conto-terzi-manodopera
```

Per app explore completo come CI, aggiungere anche frutteto e mista:

```bash
npm run sim:run -- --template=frutteto-solo-titolare
npm run sim:run -- --template=mista-viticola-frutteto-conto-terzi-manodopera
```

## Output unificato

`test-results/diagnostic-merged-report.json` — findings app + Tony ordinati per priorità:

1. T4 regressione prodotto  
2. T1 seed  
3. T2 intercept Tony  
4. T5 DOM  
5. T3 parser  
6. T6 perf  
7. T8 test fragile  
8. T7 LLM  

## Filtro rapido

```bash
npm run sim:diagnostic:explore -- --only=prodotti;T-SMOKE-001
```

## Modalità fast (explore)

`sim:diagnostic:explore` e `sim:e2e:node:explore` attivano **`GFV_E2E_FAST=1`** automaticamente:

| Parametro | gate (CI) | explore/fast |
|-----------|-----------|--------------|
| Timeout login/nav | 60s / 45s | **18s / 12s** |
| Timeout Playwright test | 120s | **45s** |
| Pause UI Tony | 600–800ms | **200–250ms** |
| Pagina browser | condivisa (node runner: **nuova pagina per scenario**) | stesso |

Override globale: `GFV_E2E_TIMEOUT_MS=25000 npm run sim:e2e:node:explore`

Per gate/CI i timeout restano quelli conservativi (nessun `GFV_E2E_FAST`).

## Runner app: explore vs gate

| Comando unificato | Runner app | Note |
|-------------------|------------|------|
| `sim:diagnostic:explore` | **Node** (`sim:e2e:node:explore`) | Fast mode, ~8 min, 71 scenari |
| `sim:diagnostic:gate` | **Playwright CLI** (`sim:e2e:gate`) | CI Linux; timeout 120s/spec |

**Windows locale (2026-07-10):** `npx playwright test` può restare **appeso** dopo l’avvio (nessun test in output, anche con 1 spec). Explore e gate via **node runner** funzionano. Se `sim:diagnostic:gate` non procede:

```bash
npm run sim:e2e:node          # 71 scenari, mode gate
npm run sim:tony:e2e:gate     # Tony tier 2 mock
npm run sim:diagnostic:merge  # opzionale
```

La validazione Playwright gate resta su **CI** (`sim-ci-e2e-inner.sh` → `sim:e2e:gate`).

## Workflow

```
modifica codice
  → sim:diagnostic:explore
  → leggi diagnostic-merged-report.json
  → fix seguendo recommended (+ Vitest)
  → sim:diagnostic:gate
  → push
```

Guide dettagliate:
- App: `tests/e2e/sim/README.md`
- Tony: `tests/e2e/tony/README.md`
