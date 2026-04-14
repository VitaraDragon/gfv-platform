# Modulo Lavori e Attivita

Questo e` il centro operativo della giornata: qui pianifichi, esegui, controlli e consolidi il lavoro svolto.

---

## 1. Scopo

Gestire il ciclo completo del lavoro: creazione, assegnazione, avanzamento, sospensione/ripresa, completamento, segnatura e validazione ore.

---

## 2. Dove si trova

- Dashboard manager: `Gestione Lavori`, `Validazione ore`, `Diario Attivita`
- Dashboard caposquadra/operaio: aree operative dedicate

---

## 3. Funzionalita principali

- Creazione lavoro (manager/amministratore).
- Assegnazione a caposquadra o operaio.
- Stati lavoro: pianificazione, esecuzione, sospensione, ripresa, completamento e passaggi di approvazione.
- Segnatura ore da operaio e caposquadra.
- Validazione ore secondo regole di ruolo.
- Diario attivita collegato al lavoro e aggregazioni ore.
- Tracciamento note operative e aree lavorate nei flussi collegati.

## 3.1 Flusso consigliato

- Crea il lavoro con obiettivo chiaro e assegnazione corretta.
- Avvia il lavoro e usa stato/note per tenere allineata la squadra.
- Fai segnare le ore ogni giorno, non a fine settimana.
- Valida le ore con regolarita per mantenere diario e numeri affidabili.
- Chiudi il lavoro solo quando avanzamento e dati sono coerenti.

## 3.2 Se fai questo, cosa succede

- **Segni le ore oggi** -> le ore entrano nel riepilogo operativo della giornata.
- **Aggiorni stato lavoro** -> tutta la squadra vede subito il nuovo stato.
- **Sospendi un lavoro** -> il lavoro non avanza finche non lo riattivi.
- **Riprendi un lavoro sospeso** -> torna nel flusso operativo normale.
- **Validi ore** -> i dati diventano affidabili per controllo e riepiloghi.
- **Completi il lavoro** -> il lavoro passa a chiusura operativa e resta nello storico.

## 3.3 Passaggio lavoro tra ruoli

Flusso tipico:

1. **Manager** pianifica e assegna.
2. **Caposquadra** organizza e coordina.
3. **Operaio** esegue e registra ore.
4. **Caposquadra** consolida avanzamento squadra.
5. **Manager** controlla il risultato complessivo e chiusura giornata.

---

## 4. Ruoli operativi

- **Manager/Amministratore:** impostano strategia e pianificazione complessiva.
- **Caposquadra:** guida l'esecuzione dei lavori assegnati e gestisce le ore operative.
- **Operaio:** esegue i lavori assegnati e registra le proprie ore.

Nota importante: il caposquadra non puo modificare i campi gestionali riservati al manager.

---

## 5. Limitazioni e regole

- Le dashboard sono diverse per ruolo e non sovrapponibili.
- Le regole di validazione ore dipendono dal tipo lavoro e assegnazione.
- Alcune funzioni avanzate richiedono modulo Manodopera attivo.
- Le aree lavorate si consolidano nei moduli specialistici quando il lavoro e` collegato a vigneto/frutteto.

Nota pratica: se un caposquadra non riesce ad agire su un campo, spesso e` un limite ruolo e non un errore del sistema.

---

## 6. Relazioni con altri moduli

- Sezione Terreni: base geografica e anagrafica di ogni lavoro.
- Sezioni Vigneto e Frutteto: operazioni tecniche di campo collegate ai lavori.
- Sezione Conto terzi: lavori che nascono dal ciclo preventivo-cliente.
- Sezione Magazzino: consumi e movimenti legati al lavoro/intervento.

---

## 7. Se devi fare X, vai qui

- **Devi creare e assegnare un lavoro:** apri `Gestione Lavori`.
- **Devi registrare ore giornaliere:** apri `Segnatura ore`.
- **Devi approvare o rifiutare ore:** usa `Validazione ore`.
- **Devi vedere attivita operative consolidate:** consulta `Diario Attivita`.
- **Devi far avanzare il lavoro in campo:** aggiorna stato e note nel lavoro assegnato.

## 8. Esempio pratico rapido

Esempio: "ho finito una trinciatura nel campo Nord"

1. Apri il lavoro assegnato.
2. Aggiorna lo stato.
3. Registra le ore della giornata.
4. Aggiungi una nota breve (esempio: lavoro chiuso senza criticita).
5. Passa al lavoro successivo.

---

## 9. Procedura passo-passo: da pianificazione a completamento

**Quando usarla**  
Quando devi creare un lavoro e portarlo a chiusura.

**Percorso schermata**  
Dashboard manager -> `Gestione Lavori`.

**Dove cliccare**
- `Nuovo lavoro` (alto a destra);
- campi assegnazione nella parte centrale del form;
- menu stato nella scheda lavoro;
- `Salva`/`Conferma` in basso.

**Passi operativi**
1. Crea il lavoro.
2. Seleziona terreno e squadra.
3. Salva e passa stato a `In corso`.
4. Aggiorna stato/note durante l'esecuzione.
5. Imposta `Completato` a fine attività.

**Controllo finale**
- lavoro in storico completati;
- note finali presenti;
- ore collegate disponibili per validazione.

## 10. Procedura passo-passo: segnatura e validazione ore

**Percorso schermata**  
Dashboard operaio/caposquadra -> `Segnatura ore`; manager -> `Validazione ore`.

**Passi operativi**
1. Operaio apre il lavoro e clicca `Segna ore`.
2. Inserisce ore e salva.
3. Caposquadra controlla avanzamento squadra.
4. Manager apre `Validazione ore` e approva/rifiuta.

**Controllo finale**
- ore visibili come validate;
- riepiloghi coerenti su diario/statistiche.

**Errori frequenti**
- ore non visibili: filtro periodo attivo;
- tasto validazione assente: ruolo non abilitato.

## 11. Uso con Tony

- "Segna 8 ore sul lavoro Trinciatura Nord": Tony guida spiega i click; Tony operativo (se attivo) può accompagnare l'azione consentita.
