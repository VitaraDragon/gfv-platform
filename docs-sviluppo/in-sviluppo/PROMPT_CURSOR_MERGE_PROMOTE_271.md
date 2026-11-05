# Merge #271 → develop, poi promote → main

Esegui tu, in ordine. Niente altri file, niente force-push.

## 1) Merge su develop
```
gh pr merge 271 --repo VitaraDragon/gfv-platform --merge --delete-branch
git fetch origin
git checkout develop
git pull origin develop
```
Annota lo SHA di develop dopo il merge (`git rev-parse --short HEAD`).

## 2) Promote su main
Crea branch da main aggiornato, cherry-pick (o merge) del commit di onboarding da develop, apri PR verso main, aspetta CI verde, mergia.

Passi tipici GFV:
```
git fetch origin
git checkout main
git pull origin main
git checkout -b promote/tony-guida-onboarding-titolare
git merge origin/develop -m "Promote Tony Guida onboarding titolare → main (#271)"
# Se ci sono conflitti solo su service-worker.js: tieni la versione develop (SW_CACHE più recente).
git push -u origin HEAD
gh pr create --base main --title "Promote: Tony Guida onboarding titolare (#271)" --body "## Cosa
Promote su main di #271: Tony Guida guida Impostazioni → Podere → Terreni (coltura / Modifica), hint Diario, welcome Free. Niente rules/functions.

## Origine
develop dopo merge #271.
"
```

Poi aspetta CI verde sulla PR di promote e:
```
gh pr merge <NUMERO_PR_PROMOTE> --repo VitaraDragon/gfv-platform --merge --delete-branch
```

## 3) Fine
In chat a Grok Bot manda: link PR promote, SHA develop, SHA main. Stop.
