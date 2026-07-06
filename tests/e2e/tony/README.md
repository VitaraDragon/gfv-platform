# Tony E2E (sim seed + Playwright)

Prerequisiti: `npm run sim:emulators`, `npm start`, `npm run sim:run -- --template=viticola-conto-terzi-manodopera`.

```bash
npm run sim:tony:e2e              # tier 2 mock (Chrome locale, Node 24)
npm run sim:tony:e2e -- --only=T-PERF-001
```

Guida: `docs-sviluppo/simulator/TONY_E2E_GUIDA_SVILUPPO.md` — matrice in `fixtures/scenarios-matrix.json`.
