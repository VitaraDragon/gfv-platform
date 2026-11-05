# Promote #279 → main (catalogo senza doppioni)

Esegui tu. Niente altri file, niente force-push. Develop è già mergiato (squash `38dde025`).
Se ci sono modifiche non committate (a parte i prompt non tracciati in `docs-sviluppo/in-sviluppo/`), fermati e dimmelo.

## Passi
```
git fetch origin
git checkout main
git pull origin main
git checkout -b promote/fix-catalogo-doppioni
git cherry-pick 38dde025fc2f1be7084f41329e37001b9533cd29
```

Se c'è conflitto **solo** su `service-worker.js`: tieni la riga `SW_CACHE_BUILD_ID` del cherry-pick. Poi:
```
git add service-worker.js
git cherry-pick --continue
```
Se c'è conflitto su qualunque altro file: `git cherry-pick --abort`, fermati e riporta l'errore.

Controllo veloce prima del push:
```
npx vitest run tests/catalogo-dedupe.test.js tests/catalogo-doppioni-scenario.test.js tests/catalogo-seed-idempotente.test.js tests/terreni-categorie-colture.test.js tests/moduli-identificatori-definiti.test.js
```

Poi:
```
git push -u origin HEAD
gh pr create --base main --title "Promote: catalogo senza doppioni (#279)" --body "## Cosa
Promote su main di #279: unione in codice di categorie, colture e tipi lavoro doppi + seed idempotente (id seed_*, lock, nessuna scrittura se la lettura fallisce). Niente rules, functions, Tony, pulizia dati.

## Origine
develop squash \`38dde025\` (#279).
"
```

**Non mergiare.** Aspetta la CI verde: sarà Grok Bot a chiedere l'ok a Pier.

## Fine
In chat: link della PR promote, SHA head, esito dei test. Poi fermati.
