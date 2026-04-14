# Modulo Vigneto

Gestione tecnica del vigneto: anagrafiche, registri di campo e risultati produttivi.

---

## 1. Scopo

Tracciare tutte le operazioni del vigneto, dalla fase agronomica alla raccolta, con collegamento ai lavori aziendali.

Questo modulo ti aiuta a non perdere passaggi tra intervento in campo, ore e risultati finali.

---

## 2. Dove si trova

- Dashboard -> `Vigneto`
- Dashboard vigneto con sezioni dedicate:
  - Trattamenti
  - Concimazioni
  - Potatura
  - Vendemmia
  - Statistiche

---

## 3. Funzionalita principali

- Anagrafica vigneti collegata ai terreni.
- Registro trattamenti e registro concimazioni separati.
- Potatura e vendemmia con dati operativi.
- Collegamento eventi a `lavoroId` e, dove previsto, `attivitaId`.
- Gestione area/superficie trattata e avanzamento campo.
- Integrazione prodotti con magazzino (quando modulo attivo).

## 3.1 Flusso consigliato

- Mantieni aggiornata l'anagrafica vigneti.
- Registra trattamenti e concimazioni subito dopo l'intervento.
- Collega quando possibile a lavoro/attivita, cosi i dati restano coerenti.
- Registra potature e vendemmie con continuita, non solo a fine stagione.
- Controlla le statistiche per confrontare costi e resa.

---

## 4. Limitazioni e regole

- Modulo disponibile con piano Base + attivazione modulo.
- Flussi completi su prodotti/scarichi richiedono anche Magazzino.
- Permessi operativi dipendono da ruolo.
- Le operazioni in campo si riflettono su lavori/ore quando collegate.

Suggerimento pratico: se usi anche Magazzino, conviene registrare sempre i prodotti in modo puntuale per avere tracciabilita reale dei consumi.

---

## 5. Relazioni con altri moduli

- `terreni.md`: base anagrafica e geospaziale.
- `lavori-attivita.md`: esecuzione operativa con assegnazioni e ore.
- `magazzino.md`: prodotti, scarichi e tracciabilita consumi.
- `intersezioni-moduli.md`: flussi end-to-end.
