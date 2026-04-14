# Modulo Magazzino

Gestione prodotti, movimenti e consumi collegati all'operativita in campo.

---

## 1. Scopo

Controllare anagrafica prodotti, giacenze e movimentazioni, con tracciabilita dell'uso nei lavori/interventi.

Il vantaggio principale: sapere sempre cosa hai disponibile, cosa stai consumando e dove.

---

## 2. Dove si trova

- Dashboard -> `Prodotti e Magazzino`
- Sezioni principali:
  - Anagrafica prodotti
  - Movimenti
  - Tracciabilita consumi

---

## 3. Funzionalita principali

- Gestione prodotti (categorie, unita, soglie, stato attivo).
- Registrazione entrate/uscite con aggiornamento giacenze.
- Modifica/eliminazione movimenti dove consentito.
- Tracciabilita consumi con viste `raggruppata` e `dettaglio`.
- Filtri per categoria e terreno in tracciabilita.
- Collegamento automatico scarichi da trattamenti/concimazioni quando abilitato.

## 3.1 Flusso consigliato

- Cura bene l'anagrafica prodotti all'inizio.
- Registra entrate e uscite con costanza.
- Usa la tracciabilita per controllare consumi reali per terreno/intervento.
- Allinea sempre movimenti e interventi in campo quando usi i moduli coltura.

---

## 4. Limitazioni e regole

- Disponibile con piano Base + modulo Magazzino attivo.
- Tipicamente riservato a manager/amministratore.
- Alcuni flussi sono parziali senza moduli coltura attivi.
- Le giacenze dipendono dalla corretta registrazione movimenti.

Nota pratica: se mancano movimenti, le giacenze diventano poco affidabili anche se il prodotto esiste in anagrafica.

---

## 5. Relazioni con altri moduli

- Sezioni Vigneto e Frutteto: consumo prodotti in trattamenti/concimazioni.
- Sezione Lavori e attivita: movimenti legati a contesto operativo.
- Sezione Intersezioni tra moduli: ciclo trattamento -> scarico -> tracciabilita.

---

## 6. Se devi fare X, vai qui

- **Devi aggiungere un prodotto:** usa `Anagrafica prodotti`.
- **Devi registrare acquisto o uso:** inserisci un movimento in `Movimenti`.
- **Devi capire dove e` stato consumato un prodotto:** consulta `Tracciabilita consumi`.
- **Devi verificare sotto-scorta:** controlla dashboard magazzino e filtri per categoria.

---

## 7. Procedura passo-passo: carico e controllo sotto-scorta

1. Apri `Movimenti`.
2. Clicca `Nuovo movimento`.
3. Seleziona prodotto e tipo `Entrata` o `Uscita`.
4. Inserisci quantita.
5. Salva.
6. Controlla giacenza e alert sotto-scorta.

## 8. Uso con Tony

- Esempio richiesta: "Registriamo l'entrata di concime e controlliamo la giacenza".
- Tony guida: indica campi da compilare e verifica finale.
