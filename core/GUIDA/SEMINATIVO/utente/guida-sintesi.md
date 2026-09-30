# Seminativo — sintesi per Tony

Modulo **`seminativo`** (colture a pieno campo). Questa sintesi descrive il comportamento su **main** (in vendita). Su **develop** il codice può ancora mancare: se il tenant non ha il modulo o il deploy non lo include, **non** inventare schermate.

## Ingresso
- **Moduli** → **Seminativo** → hub `seminativo-dashboard` (panoramica campagna + card).
- **← Dashboard Principale** dall’hub; dalle pagine interne tipicamente **← Dashboard** verso l’hub.

## Card hub (tutte operative)
1. **Anagrafica appezzamenti** — campagne per terreno/coltura/varietà/anno (`seminativi`).
2. **Piano colturale** — proposta coltura campagna successiva.
3. **Semina** — eventi semina, varietà, dosi.
4. **Lavorazioni terreno** — da Diario e, con Manodopera, dai lavori.
5. **Trattamenti** / **Concimazioni** — stesso completamento del vigneto (prodotti, dose, costi, scarico magazzino se Magazzino accessibile).
6. **Raccolta / mietitura** — quintali, superficie, costi.
7. **Statistiche** — quintali, resa effettiva, costi (resa prevista anagrafica a parte).

## Tony
- Target tipici: `seminativi`, `piano colturale`, `semina seminativo`, `lavorazioni/trattamenti/concimazioni/raccolta/statistiche seminativo`.
- Liste: `pageType` da hub (`seminativi`, `semina_seminativo`, …) + `currentTableData` dove pubblicato.
- Esclusi dal parallelo vigneto: potatura, pianifica impianto, calcolo materiali.

Senza modulo attivo: non descrivere l’hub come disponibile.
