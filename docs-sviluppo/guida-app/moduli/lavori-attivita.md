# Modulo Lavori e Attivita

Questo e` il centro operativo della giornata: qui pianifichi, esegui, controlli e consolidi il lavoro svolto.

---

## 1. Scopo

Gestire il ciclo completo del lavoro: creazione, assegnazione, avanzamento, sospensione/ripresa, completamento, segnatura e validazione ore.

---

## 2. Dove si trova

- Dashboard manager: `Gestione Lavori`, `Validazione ore`, `Diario Attivita`
- Dashboard caposquadra/operaio: aree operative dedicate
- Pagine principali:
  - `admin/gestione-lavori-standalone.html`
  - `segnatura-ore-standalone.html`
  - `admin/validazione-ore-standalone.html`
  - `attivita-standalone.html`

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

- `terreni.md`: base geografica e anagrafica di ogni lavoro.
- `vigneto.md` / `frutteto.md`: operazioni tecniche di campo collegate ai lavori.
- `conto-terzi.md`: lavori che nascono dal ciclo preventivo-cliente.
- `magazzino.md`: consumi e movimenti legati al lavoro/intervento.
