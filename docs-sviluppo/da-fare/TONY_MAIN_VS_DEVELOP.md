# Tony: cosa c'è su develop e manca su main

Inventario di contenuto, solo locale. Nessun branch, nessun commit, nessuna PR.

- Data: 2026-10-26
- Confronto: `git diff origin/main origin/develop` (due punti, contenuto, non antenati)
- `origin/main`: `7e5513f1` (Merge PR #300, graffetta a sinistra)
- `origin/develop`: `84663f42` (PR #299, stessi testi guida)
- Path: `core/js/tony`, `core/services/tony-*`, `core/config/tony-*`, `functions`

## Esito del diff

```
core/js/tony/engine.js | 315 ++++++++++++++++++++++++++++++++++++++++++++++++-
core/js/tony/main.js   |  30 +++--
functions/index.js     |   7 +-
3 files changed, 338 insertions(+), 14 deletions(-)
```

Nessun altro file in quei path è diverso. Ogni hunk qui sotto è ricondotto a un commit di develop. Non resta differenza orfana.

`engine.js` oggi è main più due innesti (311 righe aggiunte, 4 righe sostituite nello stesso punto). Non c'è un delta carburante residuo. Per questo un `--theirs` sull'intero file porterebbe insieme #123 e #124: non è un pacchetto selettivo, e non va usato.

## Tabella

| Commit / PR | Data | Titolo | File ancora diversi | Per l'utente | Stato su main | Deploy functions | Dipendenze | Rischio |
|---|---|---|---|---|---|---|---|---|
| `0db04887` / #123 | 2026-10-05 | La chat mostra solo la frase, non il JSON dei comandi | `core/js/tony/engine.js`, `core/js/tony/main.js` | Se la risposta arriva troncata o con un comando attaccato (`OPEN_MODAL`, `INJECT_FORM_DATA`, …), in chat e in voce resta la frase; il comando, se è chiudibile, viene eseguito lo stesso. Una bolla vuota non viene mostrata. | Assente, con un aggancio già presente: `doDisplay` chiama già una volta `cleanTextFromJsonResidue` prima di «Tutto pronto» (promote #158 di #157, `7c552aff`). Su main quella funzione non estrae la frase da un JSON troncato e non taglia i token di comando. Manca la seconda pulizia dopo `tonyEnsureSegnaOraAssistantVisible`, manca la pulizia nello streaming (su main è ancora la regex delle graffe) e nel wrapper di ogni bolla. | No | Nessuna. Va prima di #124, perché #124 pulisce la frase già estratta. | Alto. Cherry-pick su `origin/main` confligge in `engine.js` e `main.js` (`git merge-tree`). Le stesse funzioni le ha riscritte a mano #298 per #297. Il wrapper bolla su main è quello di #160 («Tutto pronto» sempre col nome) e non la funzione originale di #123: su develop #159 (`bde6cdbd`) ha innestato la pulizia JSON dentro quel wrapper. |
| `ec0bd83d` / #124 | 2026-10-05 | Reset slot di turno: niente campo e ore del lavoro prima | `core/js/tony/engine.js`, `core/js/tony/main.js`, `functions/index.js` (regola 7) | Dopo un oliveto, se l'utente passa a mietitura o trebbiatura, Tony non conferma il campo né le ore del turno prima: chiede l'appezzamento e tiene le ore solo se sono state dette per questo lavoro. Il mezzo non sostituisce la domanda sul campo. | Assente. Né `dropStaleJobCarryover` né la regola 7 «CAMBIO LAVORO» sono su main. | Sì. La regola 7 sta nel prompt della callable. Il client da solo copre solo la mietitura. | Dopo #123. Non dipende da #84. | Medio. Su main com'è oggi il merge-tree applica `engine.js` e la riga del prompt senza conflitto, e confligge su `main.js`. Dopo il porting di #123 quel punto di `main.js` va copiato a mano. Il client scatta solo se il messaggio matcha mietitura/trebbiatura; il prompt vale per qualsiasi cambio lavoro o coltura. Senza deploy la rete di sicurezza è solo quella regex. |
| `cbc9c44e` / #84 | 2026-10-02 | T-DIRTY-007: la ripresa con un luogo non può rispondere solo «Ti porto al diario.» | `functions/index.js` (eccezione nella regola di apertura del diario, più l'esempio «fila 4 verso il fosso») | «Continua da dove avevo lasciato sulla fila 4 verso il fosso», da una pagina senza form, deve ripetere fila e fosso. Su main la regola 4 lo chiede già, ma la regola successiva impone ancora il testo unico «Ti porto al diario.» senza eccezione. | Presente in parte. La regola 4 «RIPRESA CONTESTO» (casi A/B/C, fila, fosso, zona) è identica sui due rami; su main è arrivata con `71d96aef` (promote degli scenari T-TRIM-DIRTY). Mancano l'eccezione e l'esempio, introdotti da #84 e mai riportati. | Sì. Solo prompt. | Nessuna. Indipendente da #123 e #124. | Basso. Il merge-tree contro main confligge solo su `docs-sviluppo/COSA_ABBIAMO_FATTO.md`, non su `functions/index.js`. Si copiano tre frasi, oppure si fa il cherry-pick scartando docs, service worker e il resto del commit. |

Il commit #84 contiene anche l'attesa di `tipiLavoroList` per il test T-FLOW-013. Quel pezzo è fuori dai path chiesti e non è in questo diff.

I due commit di comportamento portano anche test che su main non ci sono (fuori dai path del diff): `tests/tony/tony-visible-chat-text.test.js` (#123) e `tests/tony/tony-job-slot-carryover.test.js` (#124). Vanno decisi nel porting, non sono una quarta differenza di prodotto.

## Già su main (controllati, non vanno ripromossi)

| Commit / PR di develop | Cosa si era sospettato | Equivalente su main |
|---|---|---|
| `056ee54f` / #83, 2026-10-05, carburante Fase 0–2 | Hub, carico, pieno, `registraPienoCampo`, route e form Tony | Presente. `056ee54f` non è antenato di main. Il contenuto dei file Tony di quel commit è già lì via #85 (`ecc89a2c`, stesso branch `cursor/carburante-piano-898d`) e i commit carburante successivi. Blob identici su main e develop: `functions/registra-pieno-campo.js`, `functions/lib/registra-pieno-campo-core.js`, `functions/tony-module-gate.js`, `functions/tony-nav-quick-reply.js`, `core/config/tony-routes.json`, `core/config/tony-module-gate.js`, `core/config/tony-form-mapping.js`, `core/js/tony/document-product-match.js`. In `engine.js` le voci `carburante` / `gasolio` ci sono su entrambi e non compaiono nel diff. La regola 6 «PIENO MEZZO vs CARICO CISTERNA» (anche il non riusare i litri del carico, #125 `1c3d3c1e`) è identica. |
| `01260261` / #297 | Estrazione tollerante del JSON in chat, graffetta | Presente, portato a mano in #298 (`c47a1278`, merge `969f07ea`). `sanitizeTonyVisibleChatText` di #123 non è quel lavoro: su main non c'è. |

## Ordine di promote

Tre pacchetti. Il carburante non è un pacchetto.

1. **#123, porting a mano.** Non un cherry-pick. In `engine.js`: JSON troncato che non finisce in chat, `sanitizeTonyVisibleChatText`, recupero del comando solo se id/formId/target sono chiusi. In `main.js`: pulizia dentro il wrapper che già chiama `tonyTestoUscitaSegnaOre` (non sostituirlo), salto della bolla vuota, streaming via `cleanTextFromJsonResidue`, seconda pulizia dopo `tonyEnsureSegnaOraAssistantVisible`. Tenere il comportamento di #160. Nessun deploy delle functions.
2. **#124, dopo #123.** Porting a mano della chiamata `dropStaleJobCarryover` in `main.js` (non sui messaggi proactive) e dell'import. Le funzioni nuove in `engine.js` e la regola 7 del prompt, su main odierno, il merge-tree le applica; dopo il passo 1 la chiamata in `main.js` si copia dal commit. Deploy delle functions, insieme al client: senza prompt il client corregge solo mietitura e trebbiatura.
3. **Resto di #84, indipendente.** Si può fare prima degli altri due, è il più piccolo. Tre frasi nel prompt (eccezione «RIPRESA CONTESTO» sulla regola di apertura del diario, riga degli esempi, esempio fila 4 / fosso). Non riprendere la regola 4: c'è già. Deploy delle functions. Si può unire al deploy del pacchetto 2 per non deployare due volte.

Cherry-pick dell'intero commit, per tutti e tre, sporca anche `service-worker.js`, `COSA_ABBIAMO_FATTO.md` e `STATO_ATTUALE.md`. Quei conflitti non vanno risolti prendendo develop.
