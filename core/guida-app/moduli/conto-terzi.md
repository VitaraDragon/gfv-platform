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

## 3.2 Se fai questo, cosa succede

- **Crei un nuovo preventivo** -> hai una proposta pronta da inviare al cliente.
- **Invii il preventivo** -> il cliente puo valutarlo e rispondere.
- **Il cliente accetta** -> puoi passare subito alla pianificazione lavoro.
- **Pianifichi il lavoro** -> il flusso entra nell'operativita quotidiana (ore, avanzamento, controllo).
- **Aggiorni tariffe** -> i prossimi preventivi saranno piu coerenti con i tuoi costi reali.

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

## 7. Esempio pratico rapido

Esempio: "nuovo cliente chiede preventivo potatura"

1. Inserisci cliente e terreno cliente.
2. Crea `Nuovo preventivo`.
3. Invia al cliente.
4. Dopo accettazione, pianifica il lavoro e passa al modulo lavori.

---

## 8. Procedura passo-passo: da preventivo a lavoro

**Percorso schermata**  
Dashboard -> `Conto Terzi` -> `Nuovo preventivo` / `Preventivi`.

**Dove cliccare**
- `Nuovo preventivo` (alto);
- sezione cliente/terreno/tariffe (centro);
- `Invia preventivo` (basso);
- in elenco preventivi: azione `Pianifica lavoro` (colonna destra).

**Passi operativi**
1. Crea preventivo completo.
2. Invia al cliente.
3. Quando accettato, apri elenco preventivi.
4. Clicca `Pianifica lavoro`.
5. Completa assegnazione nel modulo lavori.

**Controllo finale**
- preventivo marcato accettato;
- lavoro creato in `Lavori e attivita`.

## 9. Uso con Tony

- Esempio richiesta: "Ho un preventivo accettato, come lo trasformo in lavoro?"
- Tony guida: indica il pulsante `Pianifica lavoro` e dove verificare il risultato.
