# Modulo Frutteto

Gestione tecnica del frutteto: operazioni colturali, raccolta e risultati.

---

## 1. Scopo

Gestire il ciclo operativo del frutteto con registrazioni tecniche e collegamento ai flussi aziendali.

In pratica: avere un quadro chiaro delle operazioni di campo e dei risultati, senza dover ricostruire tutto a fine stagione.

---

## 2. Dove si trova

- Dashboard -> `Frutteto`
- Dashboard frutteto con sezioni dedicate:
  - Trattamenti
  - Concimazioni
  - Potatura
  - Raccolta frutta
  - Statistiche

---

## 3. Funzionalita principali

- Anagrafica frutteti su terreni aziendali.
- Registro trattamenti e registro concimazioni separati.
- Potatura e raccolta con metriche produttive.
- Collegamento eventi a `lavoroId` e, dove previsto, `attivitaId`.
- Gestione superficie intervento e continuita interventi.
- Integrazione con magazzino per prodotti e consumi.

## 3.1 Flusso consigliato

- Aggiorna anagrafica frutteti in modo ordinato.
- Registra trattamenti/concimazioni quando avvengono.
- Collega gli eventi a lavoro/attivita quando disponibile.
- Usa raccolta e potatura come base per statistiche affidabili.
- Verifica periodicamente numeri e costi per specie/appezzamento.

---

## 4. Limitazioni e regole

- Modulo disponibile con piano Base + attivazione modulo.
- Funzioni magazzino complete solo con modulo Magazzino attivo.
- Ruoli operativi distinti tra manager, caposquadra, operaio.
- Le operazioni registrate alimentano statistiche e flussi lavoro.

Suggerimento pratico: se lavori su piu appezzamenti, usa naming coerente per evitare confusione nei riepiloghi.

---

## 5. Relazioni con altri moduli

- `terreni.md`: riferimento area e anagrafiche.
- `lavori-attivita.md`: assegnazioni, ore, avanzamento.
- `magazzino.md`: prodotti, scarichi, tracciabilita.
- `intersezioni-moduli.md`: visione completa dei flussi.
