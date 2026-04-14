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

- Sezione Lavori e attivita: preventivo -> lavoro -> ore/diario.
- Sezione Terreni: distinzione tra terreni aziendali e terreni clienti.
- Sezione Intersezioni tra moduli: flusso completo commerciale-operativo.

---

## 6. Se devi fare X, vai qui

- **Devi inserire un nuovo cliente:** entra in `Clienti`.
- **Devi preparare un'offerta:** usa `Nuovo preventivo`.
- **Devi aggiornare prezzi per lavorazione:** vai in `Tariffe`.
- **Devi controllare accettazioni e pianificare lavoro:** usa `Preventivi`.
- **Devi orientarti sui terreni cliente:** consulta `Terreni clienti` e `Mappa clienti`.

---

## 7. Procedura passo-passo: da preventivo a lavoro

1. Apri `Nuovo preventivo`.
2. Compila cliente, terreno e tariffe.
3. Invia preventivo.
4. Quando accettato, apri `Preventivi`.
5. Clicca `Pianifica lavoro`.
6. Completa assegnazione in `Lavori e attivita`.

## 8. Uso con Tony

- Esempio richiesta: "Ho preventivo accettato: come pianifico il lavoro?"
- Tony guida: indica dove cliccare e cosa verificare a fine flusso.
