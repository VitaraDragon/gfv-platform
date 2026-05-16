# Guida — report impatto (`guida:impact`) e prompt suggest (`guida:suggest`)

## `guida:impact`

`npm run guida:impact` confronta due ref Git e stampa su stdout:

- elenco file modificati;
- **moduli** sotto `docs-sviluppo/GUIDA/<MODULO>/` (e mirror `core/GUIDA/`) da allineare;
- checklist dei file tipici (utente, sintesi, Tony);
- path **senza** regola in `scripts/guida-code-map.json` (revisione manuale).

Non modifica file: serve per **tua approvazione** prima di aggiornare guide e sintesi.

```bash
npm run guida:impact
npm run guida:impact -- --base origin/main --head HEAD
node scripts/guida-impact.mjs --format json
```

Senza `--base`, prova `origin/main`, poi `main`, poi `HEAD~1`.

Lista file arbitraria (stdin):

```bash
git diff --name-only main...HEAD | node scripts/guida-impact.mjs --no-git
```

## `guida:suggest`

Dopo aver rivisto l’impatto, genera un **unico file markdown** da usare come prompt per Cursor (o altro agente): contiene istruzioni vincolate, **checklist completa** (copia di `scripts/GUIDA-AGGIORNAMENTO-CHECKLIST.md`), moduli impattati, **checklist path** (`docs-sviluppo/GUIDA/` + mirror `core/GUIDA/`) e un blocco **`git diff` troncato** (default 100000 caratteri).

```bash
npm run guida:suggest
npm run guida:suggest -- --base origin/main --head HEAD --out ./tmp/gfv-guida-prompt.md
npm run guida:suggest -- --max-chars 80000
```

- Output predefinito: `scripts/guida-suggest-output/prompt.md` (cartella in **`.gitignore`**).
- Con **`--no-git`** (stdin lista path): nessun diff automatico nel file; puoi incollare il diff a mano o rieseguire senza `--no-git`.

Flusso consigliato: `guida:impact` → approvi mentalmente il perimetro → `guida:suggest` → apri il `.md` in chat agente → applica patch → commit solo delle guide (e mirror) coerenti.

## Mappa

Regole editabili in **`scripts/guida-code-map.json`** (`prefix`, `includes`, `modules`, `label`).  
Logica condivisa in **`scripts/guida-impact-lib.mjs`**.

## CI

Su ogni PR, `.github/workflows/guida-impact-pr.yml` aggiorna un **unico commento** (marker HTML) con l’output di `guida:impact`.  
**Fork PR**: il token potrebbe non poter commentare; in quel caso usa i comandi locali.

## Note

- Il prompt **vieta** di toccare `COSA_ABBIAMO_FATTO`, `STATO_ATTUALE`, `MASTER_PLAN`, `TONY_DECISIONI_*` salvo richiesta esplicita (coerente con le regole di onboarding Tony).
- L’agente deve comunque **verificare** che il diff giustifichi ogni modifica alla guida.
