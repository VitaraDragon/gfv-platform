# GUIDA GFV Platform

Documentazione divisa per **ambito** e per **pubblico**:

- **`utente/`** — linguaggio semplice, passi pratici, nessun dettaglio tecnico.
- **`tony/`** — riferimento tecnico per l’assistente (path, moduli, integrazioni).

## Struttura

| Cartella | Contenuto |
|----------|-----------|
| `CORE/` | App base senza moduli opzionali attivi |
| `PARCO_MACCHINE/` | Modulo Parco Macchine (trattori, attrezzi, flotta, scadenze, guasti, legame Diario) |
| `VIGNETO/` | Modulo Vigneto (dashboard, anagrafica vigneti, registri, statistiche, pianificazione) |
| `FRUTTETO/` | Modulo Frutteto (dashboard, anagrafica frutteti, registri, raccolta, statistiche; strumenti impianto condivisi con Vigneto) |
| `MAGAZZINO/` | Modulo Magazzino (home, prodotti, movimenti, tracciabilità consumi, sotto scorta; legami Vigneto/Frutteto dove abilitati) |
| `MANODOPERA/` | Manodopera: guide utente per ruolo (`guida-manager`, `guida-caposquadra`, `guida-operaio`) + indice; versione mobile campo; pagine admin |
| `CONTO_TERZI/` | Conto Terzi: clienti esterni, terreni clienti, mappa, tariffe, preventivi (bozza–invio–accettazione–pianifica lavoro), legame con Gestione lavori e Diario |
| `TONY/` | Modulo Tony (Tony Avanzato): assistente in chat, widget, voce, differenza tra guida e automazioni, piani, profilo campo, briefing dashboard |
| `INTERSEZIONI/` | Flussi che attraversano più moduli |
| Altri ambiti | Da compilare modulo per modulo dove manca ancora una cartella `GUIDA/<MODULO>/` |

## Allineamento codice

La fonte di verità resta il **codice**. Questa cartella va aggiornata quando cambiano schermate o permessi.

## Tony

In runtime, `core/services/tony-service.js` concatena in ordine: **`CORE/utente/guida.md`**, **`CORE/tony/guida-tecnica.md`**, **`TONY/utente/guida.md`** (modulo Tony — uso assistente), **`TONY/tony/guida-tecnica.md`**, poi **intersezioni**, poi altri moduli in **`GUIDA/`** ( **`PARCO_MACCHINE`**, **`VIGNETO`**, **`FRUTTETO`**, **`MAGAZZINO`**, **`MANODOPERA`**, **`CONTO_TERZI`**: `utente` + `tony`), infine **legacy** `guida-app/moduli/`. **Riassunti:** `guida_sintesi` (Core), `guida_sintesi_parco_macchine`, `guida_sintesi_vigneto`, `guida_sintesi_frutteto`, `guida_sintesi_magazzino`, `guida_sintesi_manodopera`, `guida_sintesi_conto_terzi`, **`guida_sintesi_tony`** (modulo Tony) — dedup primo turno vs `guida_app` (vedi `tony-service.js`).

## Deploy

Copia speculare sotto [`core/GUIDA/README.md`](../../core/GUIDA/README.md) per il caricamento via HTTP nelle pagine standalone (stesso principio della precedente `guida-app`).
