# Hook Git (GFV)

## Bump automatico cache PWA

Dopo il clone, abilita gli hook una tantum dalla root del repo:

```bash
git config core.hooksPath .githooks
```

Su Windows (Git Bash) è lo stesso comando.

L’hook `pre-commit` esegue `node scripts/bump-pwa-cache-version.mjs` e aggiunge `service-worker.js` allo stage, così **ogni commit** ottiene un nuovo `SW_CACHE_BUILD_ID` e la PWA installata può aggiornare la cache dopo il deploy.

- Per saltare l’hook su un commit: `git commit --no-verify`
- Manuale: `npm run bump:pwa-cache`
