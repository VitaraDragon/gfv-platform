# Promote #277 → main (categorie coltura duplicate)

Esegui tu. Niente altri file, niente force-push. Develop è già mergiato (`11b5b91e`).

## Passi
```
git fetch origin
git checkout main
git pull origin main
git checkout -b promote/fix-categorie-colture-duplicate
git cherry-pick 11b5b91ec5148886a94be690f02e8a57d52d0239
```

Se conflitto **solo** su `service-worker.js`: tieni la riga `SW_CACHE_BUILD_ID` del cherry-pick (quella più recente del commit #277). Poi:
```
git add service-worker.js
git cherry-pick --continue
```

Poi:
```
git push -u origin HEAD
gh pr create --base main --title "Promote: fix categorie coltura duplicate (#277)" --body "## Cosa
Promote su main di #277: form Terreni, dedupe categorie coltura + ripopolo select dopo seed. Niente rules/functions/Tony.

## Origine
develop squash ``11b5b91e`` (#277).
"
```

**Non mergiare.** Aspetta CI verde; Grok Bot chiederà ok a Pier.

## Fine
In chat a Grok Bot: link PR promote + SHA head. Stop.
