# Handoff — estrazione script pagine vigneto e frutteto

**Creato:** 2026-10-05  
**Scopo:** far continuare a un altro agente lo spostamento del comportamento dalle pagine HTML ai file JS del modulo, senza rileggere la chat.

Vigneto e frutteto restano due moduli. Il lavoro è uno spostamento, una pagina alla volta, poi si pubblica. Non è un refactor del comportamento e non è un big-bang.

---

## Come usare questo documento

Incolla all’inizio della chat:

```
Continuo l'estrazione degli script di pagina su GFV Platform.
Leggi obbligatoriamente:
1. docs-sviluppo/in-sviluppo/HANDOFF_ESTRAZIONE_SCRIPT_PAGINE.md
2. docs-sviluppo/COSA_ABBIAMO_FATTO.md (solo le voci in cima sullo spostamento script)
3. .cursor/rules/pubblicazione-e-branch.mdc

Prossima pagina: nessuna. La coda è vuota e le pagine estratte sono su main, ognuna col suo tag.
Una pagina alla volta. Vigneto e frutteto restano separati.
«procedi» = estrai, prova sul simulatore, commit, PR su develop. Non mergiare e non promuovere su main finché non te lo chiedo.
Dopo uno spostamento aggiorna la coda in questo handoff e una voce in COSA_ABBIAMO_FATTO.md.
Non aggiornare STATO_ATTUALE, MASTER_PLAN o TONY_DECISIONI: lo spostamento non cambia comandi né fasi Tony.
```

Quando una pagina esce, aggiorna la tabella «Già su main» e la coda in questo file. `COSA_ABBIAMO_FATTO.md` resta la cronaca breve. Questo file resta il metodo.

---

## 1. Da dove veniamo

Le pagine `*-standalone.html` di vigneto e frutteto avevano il comportamento in un `<script type="module">` inline, spesso oltre mille righe. L’HTML deve restare la struttura. Il comportamento va in `modules/{vigneto|frutteto}/js/{pagina}-page.js`.

La prima coppia, i trattamenti, condivide la meccanica in `shared/js/trattamenti-coltura-page.js`. Ogni modulo ha un file sottile (`trattamenti-page.js`) che chiama `mountTrattamentiColturaPage(cfg)` con i propri servizi e testi. Le pagine successive **non** entrano in quel helper: concimazioni, potatura, vendemmia, raccolta e anagrafiche sono spostamenti del proprio script, anche quando assomigliano ai trattamenti.

Decisioni già prese, da non riaprire in questo filone:

- Una verticale alla volta. Si prova, si mette su `develop`, e su `main` solo quando chi guida il lavoro lo chiede.
- Vigneto e frutteto non si fondono.
- Non si attaccano vendemmia, raccolta, anagrafiche, dashboard o statistiche a `trattamenti-coltura-page.js`.
- Non si tocca la pipeline Tony (`functions/index.js`, mapping, comandi) per questo spostamento. I `pageType` già presenti restano com’erano.
- Non si apre qui il discorso oliveto o colture orticole.
- `develop` contiene anche altro (scenario trimestre del simulatore, fix Tony `T-DIRTY`). Quel resto non va promosso insieme a queste pagine.

---

## 2. Dove siamo

`main` è il sito pubblico (GitHub Pages). Punta a `822face` (5 ottobre 2026), tag `v2026-10-05-pianifica-impianto-vigneto`.

`develop` ha gli stessi spostamenti con SHA diversi (squash diversi) e, sotto, commit che su `main` non ci sono. Un `git log origin/main..origin/develop` elenca sia gli squash dello spostamento sia quel resto. Si promuove il singolo squash della pagina, con un branch nato da `origin/main`. Mai tutto `develop`.

### Già su main

| Tag | Cosa |
|-----|------|
| `v2026-10-03-trattamenti-page-js` | Script trattamenti vigneto e frutteto fuori dall’HTML |
| `v2026-10-03-trattamenti-helper` | Meccanica comune in `shared/js/trattamenti-coltura-page.js` |
| `v2026-10-03-concimazioni-vigneto` | `modules/vigneto/js/concimazioni-page.js` |
| `v2026-10-03-concimazioni-frutteto` | `modules/frutteto/js/concimazioni-page.js` |
| `v2026-10-03-potatura-vigneto` | `modules/vigneto/js/potatura-page.js` |
| `v2026-10-03-potatura-frutteto` | `modules/frutteto/js/potatura-page.js` |
| `v2026-10-03-vendemmia-vigneto` | `modules/vigneto/js/vendemmia-page.js` |
| `v2026-10-03-raccolta-frutteto` | `modules/frutteto/js/raccolta-page.js` |
| `v2026-10-04-anagrafica-vigneti` | `modules/vigneto/js/vigneti-page.js` |
| `v2026-10-05-anagrafica-frutteto` | `modules/frutteto/js/frutteti-page.js` |
| `v2026-10-05-dashboard-vigneto` | `modules/vigneto/js/vigneto-dashboard-page.js` |
| `v2026-10-05-dashboard-frutteto` | `modules/frutteto/js/frutteto-dashboard-page.js` |
| `v2026-10-05-statistiche-vigneto` | `modules/vigneto/js/vigneto-statistiche-page.js` |
| `v2026-10-05-statistiche-frutteto` | `modules/frutteto/js/frutteto-statistiche-page.js` |
| `v2026-10-05-calcolo-materiali-vigneto` | `modules/vigneto/js/calcolo-materiali-page.js` |
| `v2026-10-05-pianifica-impianto-vigneto` | `modules/vigneto/js/pianifica-impianto-page.js` |

Modello di chiusura HTML, anagrafica vigneti:

```html
<script type="module" src="../../../core/js/standalone-bootstrap.js" data-config-base="../../../core"></script>
<script type="module" src="../js/vigneti-page.js"></script>
```

Intestazione del JS:

```javascript
/**
 * Pagina Anagrafica vigneti.
 * L'HTML in views/ resta la struttura; qui c'è il comportamento.
 * Gli import dinamici via resolvePath restano relativi all'URL della pagina.
 * @module modules/vigneto/js/vigneti-page
 */
```

### Coda — ancora con `<script type="module">` inline

Nessuna pagina ancora inline. Le sette pagine della coda sono su `main`, ognuna col suo tag (tabella «Già su main»). Su `develop` restano gli squash corrispondenti, più i commit che non fanno parte di questo spostamento.

---

## 3. Dove vogliamo arrivare

Ogni pagina vigneto e frutteto della coda ha l’HTML come struttura e il comportamento nel JS del proprio modulo, pubblicata su `main` con il suo tag. Il helper dei trattamenti resta solo per i trattamenti. A quel punto questo handoff si può chiudere con la coda vuota.

---

## 4. Come si sposta una pagina

È un trasloco. Il corpo dello script nel file nuovo deve coincidere con il corpo che stava nell’HTML.

1. Branch da `origin/develop`, nome `cursor/<modulo>-<pagina>-page-extract`. Mai da `main`.
2. Copia il corpo del `<script type="module">` inline in `modules/<modulo>/js/<pagina>-page.js`. Togli l’indentazione di 8 spazi che aveva dentro l’HTML. Aggiungi solo l’intestazione del modello sopra.
3. Nell’HTML lascia gli script già esterni (bootstrap, e il loader Google Maps se c’è come script a parte). Sostituisci il module inline con `<script type="module" src="../js/<pagina>-page.js"></script>`.
4. Gli import statici sono relativi al file JS. `views/` e `js/` sono fratelli, quindi `../../../core/...` e `../services/...` restano validi. Gli import dinamici `resolvePath(...)` restano relativi all’URL della pagina (`window.location`), non al file JS nuovo.
5. `node --check` sul file nuovo. Il test import-guard «ogni import relativo punta a un file esistente» è quello che conta. Il fallimento «eccezioni note sono ancora necessarie» c’era già prima di questi spostamenti.
6. Voce in cima a `docs-sviluppo/COSA_ABBIAMO_FATTO.md`: la pagina nuova diventa «Ultimo aggiornamento documentazione», la precedente diventa «Ultimo aggiornamento precedente». Non toccare `STATO_ATTUALE.md`, `MASTER_PLAN.md`, `TONY_DECISIONI_E_REQUISITI.md`.
7. `npm run bump:pwa-cache` e `git add service-worker.js` prima del commit. Il hook di commit può alzare di nuovo l’id: se il working tree resta pulito, va bene.
8. Commit solo di quella pagina (HTML, JS, `COSA_ABBIAMO_FATTO.md`, `service-worker.js`). Non committare `simulator/manifest.json`: il seed lo sporca.
9. Prova sul simulatore (sezione 5) prima della PR. Push con refspec esplicito: `git push -u origin HEAD:refs/heads/<branch>`. Un branch creato da `origin/main` traccia `main`: un `git push` nudo finirebbe lì. Su questo lavoro il branch nasce da `develop`, ma il refspec esplicito evita l’errore anche in promozione.
10. PR su `develop`. In PowerShell non usare `&&` né l’heredoc bash. Il body della PR va in un file temporaneo (`gh pr create --body-file`) e il file si cancella. Non lasciarlo nel commit.

«procedi» si ferma alla PR aperta. Merge su `develop` e promozione su `main` solo se chi guida lo chiede e la prova sul simulatore è riuscita.

### Promozione su main

CI verde (`.github/workflows/simulator-ci.yml`) sulla PR di `develop`, poi:

1. `gh pr merge <n> --squash --delete-branch` su `develop`.
2. Branch nuovo da `origin/main`: `git checkout -b cursor/promote-<pagina> origin/main`.
3. `git cherry-pick <squash-di-develop>`. `service-worker.js` va in conflitto: `git checkout --ours` (tieni l’id di `main`), `npm run bump:pwa-cache`, `git add`, `git -c core.editor=true cherry-pick --continue`. `COSA_ABBIAMO_FATTO.md` di solito si applica da solo se la voce precedente in cima coincide. Se due PR toccano la stessa cima, si mergiano su `develop` in ordine e le voci si impilano (la più recente in alto) prima di promuovere.
4. Push con refspec `refs/heads/cursor/promote-<pagina>`. PR con base `main`. Attendi la CI. Squash-merge. Tag annotato sul SHA di `main`, stile `v2026-10-04-anagrafica-vigneti`, e `git push origin refs/tags/<tag>`.
5. Mai `git push` diretto su `main`. Mai force-push. Mai promuovere gli altri commit di `develop`.

Se `T-FLOW-013` («nessun tipo lavoro nel tenant») fallisce una volta sulla CI di `main`, è una corsa già vista: `gh run rerun <run> --failed` una volta. Lo spostamento non tocca Tony. Un secondo rosso si ferma e si guarda.

---

## 5. Prova sul simulatore

C’è un solo progetto Firebase. `develop` e `main` condividono gli stessi dati. Le scritture di prova vanno sull’emulatore, mai sull’ambiente reale.

- Emulatori: `npm run sim:emulators` (Auth 9099, Firestore 8080).
- Sito: `npm start` → `http://127.0.0.1:8000`.
- Entrata: `http://127.0.0.1:8000/core/dev/simulator-dev-standalone.html?emulator=1`.
- Password: `SimGFV2026!` (già scritta in `COSA_ABBIAMO_FATTO.md`).
- Vigneto: `npm run sim:run -- --template=solo-titolare-viticola` (azienda Gallo). Non ha il modulo frutteto: la raccolta reindirizza all’abbonamento.
- Frutteto: `npm run sim:run -- --template=frutteto-solo-titolare` (azienda Ferrari). Non ha il modulo vigneto: vendemmia e anagrafica vigneti reindirizzano all’abbonamento.
- Per l’anagrafica frutteto usa Ferrari.

Non salvare e non eliminare. Controlla lista, un filtro che svuota, il reset, l’apertura della modale di modifica e la chiusura.

A larghezza stretta (~300px) `core/js/ui-pelle.js` clona i pulsanti in `.gfv-pelle-cards` senza i listener. I listener veri sono sul `tbody` reale, anche se la tabella è `display: none`. Il click va fatto con `HTMLElement.click()` sul bottone vero. Sull’anagrafica il primo bottone della riga è Dettaglio: la modale di modifica si apre dal bottone Modifica.

Sull’anagrafica vigneti, filtrare lo stato `da_rimuovere` può dare zero righe con l’empty-state ancora nascosto, perché il render guarda il banner di retrocompatibilità. È il comportamento originale. Il filtro per varietà è il controllo buono.

`NaN` sulla superficie di qualche riga di concimazioni o potatura c’era già (`toFixed` su un valore non finito). Non si corregge in questi spostamenti.

---

## 6. Trappole già viste

- Il checkout verso `origin/main` fallisce se `simulator/manifest.json` è sporco. `git restore simulator/manifest.json`. Non committarlo. Non fare `stash drop` sugli stash `tony-e2e-retest-stash*`.
- Un cherry-pick di un commit già nel branch corrente esce vuoto. `--abort`, non `--allow-empty`.
- Due PR che riscrivono la prima riga di `COSA_ABBIAMO_FATTO.md` confliggono. Si tiene la pagina più recente in cima e sotto le voci già uscite, nell’ordine.
- La porta 8080 occupata da un emulatore precedente fa fallire `sim:emulators`. Non puntare il simulatore al Firebase vero per aggirarlo.
- In PowerShell `&&` non vale. Per il commit e per `gh` usare `;` e un file di body.
