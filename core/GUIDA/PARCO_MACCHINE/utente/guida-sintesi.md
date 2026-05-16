# Parco Macchine — sintesi per Tony

Modulo **Parco macchine** attivo nell’**abbonamento** (scheda moduli per l’amministratore). Linguaggio allineato alla guida utente.

## In sintesi

- **Dashboard** → **Parco Macchine** → hub con statistiche e **azioni rapide** (trattori, attrezzi, flotta, gestione macchine, scadenze, officina/guasti).
- **Liste rapide** (Trattori / Attrezzi / Flotta): solo **creazione** rapida (**Nuovo** → campi minimi → **Salva**); **modifica / elimina / stato completo** da **Gestione macchine**.
- **Trattori:** nome + **CV** obbligatori alla creazione rapida; colonna **Stato** (Disponibile, In uso, Manutenzione, Guasto).
- **Attrezzi:** nome, **categoria** (elenco), **CV minimi** obbligatori — servono per **compatibilità** con il trattore (CV trattore ≥ CV minimi attrezzo); Stato spesso Disponibile / In uso.
- **Flotta:** nome + **tipo** (Automezzo / Veicolo / Furgone).
- **Gestione macchine:** filtri stato/tipo/categoria/attive; **Nuova macchina** (Trattore vs Attrezzo); form completo — **Stato** (incluso **Dismesso**), CV trattore o CV minimi attrezzo, marca/modello/targa/telaio, ore, costo/h, prossima manutenzione, note, storico guasti; righe con **Modifica** / **Elimina**.
- **Scadenze:** filtro Tutti / Solo scaduti; rinnovo con **nuova data** o **nuove ore** limite; indicatori colore (rosso/giallo/verde).
- **Guasti:** filtro Solo aperti / Tutti; **Segnala guasto** → pagina dedicata; **Segna risolto** + note; può aggiornare stato macchina collegata.
- **Diario attività:** trattore / attrezzo / ore macchina **opzionali**; combinazioni rispettano CV.

Senza modulo **non** mostrare card né istruzioni come se il parco esistesse.
