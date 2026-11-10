# Allenatore Tony — pacchetti tematici

Telaio condiviso per le interviste scritte di Tony. Non addestra un modello e non usa un motore di valutazione esterno: è Vitest, con lo stesso `turno()` già usato dai test della landing.

`turno()` (`turno-intervista.js`) fa, in quest'ordine:

1. server `rispostaAccountDaTesto`
2. `applicaNomeTerrenoDaDomanda`
3. client `preparaTurnoOnboarding`
4. `decidiDopoRisposta`

Un pacchetto è un file di test: situazioni, tante varianti della stessa frase, esito strutturato (campi, prossima domanda, se il riepilogo si apre, testi che ci sono e testi che non ci sono) e dialoghi veri congelati. Il primo pacchetto è l'intervista account sulla landing (`pacchetto-landing.test.js`). I pacchetti successivi (Tony in-app) si innestano sullo stesso `turno()`, quando ci sarà il requisito: qui non ci sono.

I test sintetici non verificano voce né browser. La conferma vera resta la prova sul canale, soprattutto a voce.

## In locale

```bash
npx vitest run tests/allenatore tests/landing tests/tony-aiuto-account.test.js
```

Oppure `npm run sim:allenatore:vitest`.

## In CI

Job `allenatore landing (Vitest)` in `.github/workflows/simulator-ci.yml`, a ogni PR che tocca i path del workflow (inclusi `landing/**` e `tests/**`). Solo Vitest.

## Congelare un dialogo incollato da Pier

1. Pier incolla i turni (cosa ha detto, cosa Tony doveva rispondere, com'erano sede / poderi / terreni).
2. Nel pacchetto si aggiunge uno scenario che rifà la sequenza con `turno()` e asserisce l'esito strutturato.
3. Se è uscito un buco, si aggiungono anche varianti dello stesso intento: frase pulita, refuso, fuori tema, errore dell'utente.
4. I dialoghi già verdi non si allentano per far passare il caso nuovo.
