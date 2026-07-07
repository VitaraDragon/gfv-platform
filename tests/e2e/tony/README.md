# Tony E2E (sim seed + Playwright)

## Tier 2 mock (PR)

Prerequisiti: `npm run sim:emulators`, `npm start`, `npm run sim:run -- --template=viticola-conto-terzi-manodopera`.

```bash
npm run sim:tony:e2e              # 16 scenari mock
npm run sim:tony:e2e -- --only=T-PERF-001
```

## Tier 3 live (CF + Gemini reali)

**Guida completa:** `docs-sviluppo/simulator/TONY_E2E_GUIDA_SVILUPPO.md` **§8.1**

In sintesi:

1. `functions/.secret.local` con `GEMINI_API_KEY=` (gitignored)
2. `npm run sim:emulators:live` — **non** basta `sim:emulators`
3. `npm start`
4. `npm run sim:run -- --template=viticola-conto-terzi-manodopera`
5. `npm run sim:tony:e2e:live`

```bash
# Un scenario (prima verifica)
GFV_TONY_E2E_ONLY=T-PERF-003 npm run sim:tony:e2e:live

# Suite tier 3 (4 scenari)
npm run sim:tony:e2e:live
```

**Non usare** `sim:tony:e2e:live:prod` con Auth emulator → «sessione scaduta».

Report: `test-results/tony-e2e-live-report.json` (p50/p95, quickReplyHit%).

Matrice scenari: `fixtures/scenarios-matrix.json`.
