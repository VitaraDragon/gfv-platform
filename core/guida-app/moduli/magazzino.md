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

## 3.2 Se fai questo, cosa succede

- **Aggiungi un prodotto** -> compare subito nell'anagrafica e diventa disponibile nei flussi.
- **Registri un'entrata** -> la disponibilita aumenta.
- **Registri un'uscita** -> la disponibilita diminuisce.
- **Filtri la tracciabilita** -> capisci dove sono andati davvero i prodotti.
- **Colleghi interventi campo** -> confronti meglio costi e consumi per zona/lavoro.

## 3.3 Sotto-scorta: cosa fare

Quando un prodotto scende sotto il livello minimo:

1. controlla quanto ne resta;
2. verifica dove lo stai consumando di piu;
3. pianifica un reintegro;
4. registra l'entrata appena arriva il materiale.

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

## 7. Esempio pratico rapido

Esempio: "ho comprato 10 sacchi di concime"

1. Apri `Movimenti`.
2. Inserisci un'entrata del prodotto corretto.
3. Salva.
4. Verifica la disponibilita aggiornata.

---

## 8. Procedura passo-passo: carico prodotto e controllo sotto-scorta

**Percorso schermata**  
Dashboard -> `Prodotti e Magazzino` -> `Movimenti`.

**Dove cliccare**
- `Nuovo movimento` (alto a destra);
- tipo movimento `Entrata`/`Uscita` (centro form);
- `Salva` (basso form);
- `Tracciabilita consumi` tab in alto pagina magazzino.

**Passi operativi**
1. Clicca `Nuovo movimento`.
2. Seleziona prodotto e tipo movimento.
3. Inserisci quantita.
4. Salva.
5. Controlla disponibilita e alert sotto-scorta.

**Controllo finale**
- movimento presente in elenco;
- giacenza aggiornata;
- alert sotto-scorta coerente.

**Errori frequenti**
- giacenza non cambia: movimento salvato su prodotto errato;
- tracciabilita vuota: mancano filtri corretti per periodo/prodotto.

## 9. Uso con Tony

- Esempio richiesta: "Registriamo l'entrata di 10 sacchi di concime".
- Tony guida: elenca i campi da compilare e la verifica finale.
