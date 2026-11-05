# Cosa fare adesso (Tony Guida onboarding titolare)

Hai già le 9 modifiche sul disco. Sei sul branch sbagliato (`promote/briefing-meteo-saluto`). Non c’è ancora commit né PR.

## Obiettivo
Portare le modifiche su un branch nuovo da `develop`, commit, push, apri PR verso `develop`.

## Passi (esegui tu in ordine)

1. Controlla che i file modificati siano solo questi 9 (non toccare altro):
   - `core/services/tony-guida-app.js`
   - `core/GUIDA/CORE/utente/guida.md`
   - `core/GUIDA/CORE/utente/guida-sintesi.md`
   - `core/GUIDA/CORE/tony/guida-tecnica.md`
   - `docs-sviluppo/GUIDA/CORE/utente/guida.md`
   - `docs-sviluppo/GUIDA/CORE/utente/guida-sintesi.md`
   - `docs-sviluppo/GUIDA/CORE/tony/guida-tecnica.md`
   - `core/config/tony-guida-onboarding.js`
   - `core/attivita-standalone.html`

2. **Non** aggiungere ai commit:
   - `docs-sviluppo/in-sviluppo/HANDOFF_ESTRAZIONE_SCRIPT_PAGINE.md`
   - `test-results/` (se compare)

3. Salva le modifiche da parte, poi parti da develop aggiornato:
   ```
   git stash push -u -m "tony-guida-onboarding-titolare" -- core/services/tony-guida-app.js core/GUIDA/CORE/utente/guida.md core/GUIDA/CORE/utente/guida-sintesi.md core/GUIDA/CORE/tony/guida-tecnica.md docs-sviluppo/GUIDA/CORE/utente/guida.md docs-sviluppo/GUIDA/CORE/utente/guida-sintesi.md docs-sviluppo/GUIDA/CORE/tony/guida-tecnica.md core/config/tony-guida-onboarding.js core/attivita-standalone.html
   git fetch origin
   git checkout develop
   git pull origin develop
   git checkout -b docs/tony-guida-onboarding-titolare
   git stash pop
   ```

4. Se lo stash pop dà conflitti, risolvili tenendo il testo nuovo dell’onboarding (ordine Impostazioni → Podere → Terreni / Modifica, hint Diario, welcome Free). Non toccare `firestore.rules` né `functions/`.

5. Commit solo i 9 file:
   ```
   git add core/services/tony-guida-app.js core/GUIDA/CORE/utente/guida.md core/GUIDA/CORE/utente/guida-sintesi.md core/GUIDA/CORE/tony/guida-tecnica.md docs-sviluppo/GUIDA/CORE/utente/guida.md docs-sviluppo/GUIDA/CORE/utente/guida-sintesi.md docs-sviluppo/GUIDA/CORE/tony/guida-tecnica.md core/config/tony-guida-onboarding.js core/attivita-standalone.html
   git commit -m "$(cat <<'EOF'
   docs(tony): onboarding titolare nuovo (podere, terreno, coltura)

   Tony Guida accompagna Impostazioni → Aggiungi Podere → Terreni (+ Aggiungi Terreno / Modifica per coltura). Hint sotto Coltura nel Diario. Nessun cambio a rules né functions.
   EOF
   )"
   ```

6. Push e apri la PR su develop:
   ```
   git push -u origin HEAD
   gh pr create --base develop --title "Tony Guida: onboarding titolare (podere, terreno, coltura)" --body "$(cat <<'EOF'
   ## Cosa
   Tony Guida guida il titolare nuovo: Impostazioni → ➕ Aggiungi Podere → Dashboard → Terreni → + Aggiungi Terreno; insiste su Categoria Coltura e Coltura; se terreno senza coltura → ✏️ Modifica → Salva Terreno, poi Diario. Hint sotto Coltura * nel Diario. Riga nel benvenuto Free. TODO sul mirror Cloud Functions (non toccato).

   ## Non toccato
   firestore.rules, functions/, modello Terreno, validazione Diario.

   ## Test
   tests/tony-guida-onboarding.test.js — 21 pass.
   EOF
   )"
   ```

7. In chat a Grok Bot manda solo il link della PR (es. https://github.com/VitaraDragon/gfv-platform/pull/NNN). Stop lì: niente merge.

## Criterio di fatto
- Branch `docs/tony-guida-onboarding-titolare` su origin
- PR aperta verso `develop`
- Link PR inviato a Pier / Grok Bot
