# Modulo Conto Terzi

Gestione clienti esterni, preventivi e trasformazione in lavori operativi.

---

## 1. Scopo

Gestire il ciclo commerciale-operativo per lavori conto terzi: cliente, preventivo, accettazione e pianificazione lavoro.

L'idea e` semplice: partire da una richiesta cliente e arrivare a un lavoro pianificato, senza salti manuali.

---

## 2. Dove si trova

- Dashboard -> `Conto Terzi`
- Sezioni principali:
  - Clienti
  - Terreni clienti
  - Mappa clienti (solo consultazione)
  - Tariffe
  - Preventivi
  - Nuovo preventivo

---

## 3. Funzionalita principali

- Anagrafica clienti e terreni clienti.
- Tariffe per calcolo preventivo.
- Creazione preventivo con stato e tracciamento.
- Invio preventivo via canale transazionale e accettazione cliente.
- Pianificazione lavoro dal preventivo accettato.
- Collegamento con lavori e attivita per esecuzione.

## 3.1 Flusso consigliato

- Crea o aggiorna prima cliente e terreno cliente.
- Configura tariffe in modo coerente con lavorazioni reali.
- Prepara il preventivo con dati chiari e inviabile al cliente.
- Dopo accettazione, pianifica subito il lavoro per non perdere continuita.
- Segui esecuzione e ore dal modulo lavori.

---

## 4. Limitazioni e regole

- Modulo disponibile con piano Base + attivazione modulo.
- Operativita completa per manager/amministratore.
- Mappa clienti ha funzione visuale, non elimina terreni.
- Flusso documentato fino a pianificazione/esecuzione lavoro; fatturazione formale non coperta.

Nota pratica: la mappa clienti e` ottima per orientamento operativo, ma non sostituisce le pagine di gestione dati.

---

## 5. Relazioni con altri moduli

- `lavori-attivita.md`: preventivo -> lavoro -> ore/diario.
- `terreni.md`: distinzione tra terreni aziendali e terreni clienti.
- `intersezioni-moduli.md`: flusso end-to-end commerciale-operativo.
