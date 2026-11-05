# Promote #281 → main (accettazione legale: invito minimo, niente account a metà, gate bloccante, accettazioni per azienda)

Esegui tu. Niente altri file, niente force-push, niente deploy. Develop è già mergiato (squash `372907ce`).
Se ci sono modifiche non committate (a parte i prompt non tracciati in `docs-sviluppo/in-sviluppo/`), fermati e dimmelo.

## Passi
```
git fetch origin
git checkout main
git pull origin main
git checkout -b promote/fix-accettazione-legale
git cherry-pick 372907ce50562d89bb8270dba4f16ed397d593a1
```

Se c'è conflitto **solo** su `service-worker.js`: tieni la riga `SW_CACHE_BUILD_ID` del cherry-pick. Poi:
```
git add service-worker.js
git cherry-pick --continue
```
Se c'è conflitto su qualunque altro file: `git cherry-pick --abort`, fermati e riporta l'errore.

Controllo veloce prima del push (se mancano le dipendenze di functions: `npm ci --prefix functions`):
```
npx vitest run tests/accettazione-legale-registrazione.test.js tests/accettazione-legale-gate.test.js tests/accettazione-legale-functions.test.js tests/services/invito-pubblico.test.js tests/moduli-identificatori-definiti.test.js
```

Poi:
```
git push -u origin HEAD
gh pr create --base main --title "Promote: accettazione legale robusta (#281)" --body "## Cosa
Promote su main di #281: getInvitoPubblico senza cellulare/token/stato; registrazione senza rollback se fallisce solo la callable (gate chiede l'accettazione al primo accesso); gate bloccante se lo stato non si legge; accettazioni per azienda (id uid_tenantId_tipo_versione). Flag ACCETTAZIONE_LEGALE_ATTIVA resta false. Niente rules, niente Tony.

## Deploy (manuale, dopo il merge, lo fa Pier)
firebase deploy --only \"functions:getInvitoPubblico,functions:registraAccettazioniLegali\" --project gfv-platform

## Origine
develop squash \`372907ce\` (#281).
"
```

**Non mergiare e non fare deploy.** Aspetta la CI verde: sarà Grok Bot a chiedere l'ok a Pier.

## Fine
In chat: link della PR promote, SHA head, esito dei test. Poi fermati.
