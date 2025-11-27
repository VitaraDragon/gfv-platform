# ⏱️ Guida Funzionalità – Segnatura Ore

Tutto ciò che gli operai e i capisquadra devono sapere per registrare, validare e monitorare le ore lavorate.

---

## 👥 Ruoli e responsabilità

| Ruolo | Cosa può fare |
| --- | --- |
| **Operaio** | Segnare le proprie ore, modificare finché non validate, vedere stato (validate/rifiutate) |
| **Caposquadra** | Visualizzare ore della squadra, approvare/rifiutare, aggiungere note |
| **Manager/Amministratore** | Consultare report, statistiche, calcolare compensi |

---

## 🧭 Percorso nell’app

- **Operaio**: Dashboard → card **Segna Ore** → pagina `core/segnatura-ore-standalone.html`
- **Caposquadra**: Dashboard → card **Validazione Ore**
- **Manager**: Dashboard → **Statistiche** → sezione **Report Ore Operai**

---

## 🧑‍🌾 Segnare le ore (Operai)

1. Apri **Segna Ore**
2. Seleziona il **Lavoro** assegnato (lista filtrata sui lavori di oggi)
3. Compila i campi:
   - **Data** (default oggi)
   - **Ora inizio** e **Ora fine**
   - **Pause** (minuti totali)
   - **Note** (opzionale)
4. Clicca **Salva**

### Regole automatiche

- Il sistema calcola:
  - Ore totali = fine - inizio
  - Ore nette = ore totali – pause
- Se mancano i campi obbligatori viene mostrato un messaggio di errore
- Le ore salvate appaiono con stato **“Da validare”**

---

## ✏️ Modificare o cancellare ore

- Apri la sezione **Le Mie Ore**
- Trova la riga desiderata
- Puoi **modificare** o **cancellare** solo ore in stato “Da validare” o “Rifiutate”
- Le ore validate sono bloccate (servono per statistiche e compensi)

---

## 🧑‍✈️ Validare le ore (Caposquadra)

1. Vai su **Validazione Ore**
2. Filtra per:
   - Periodo
   - Lavoro
   - Operaio
   - Stato
3. Seleziona un’ora → controlla dettagli (lavoro, orari, note)
4. Azioni possibili:
   - **Approva**: l’ora diventa “Validata”
   - **Rifiuta**: obbligatorio inserire una nota con il motivo

### Validazione multipla

- Seleziona più righe → clicca **Approva selezionate** per risparmiare tempo

---

## 📊 Statistiche e Report

- **Dashboard Operaio**: riepilogo veloce (validate/da validare/rifiutate)
- **Dashboard Caposquadra**: ore da validare e opere della squadra
- **Report Manager**:
  - Filtri periodo (oggi/settimana/mese/personalizzato)
  - Filtri per tipo operaio e singolo operaio
  - Statistiche aggregate (ore totali, media/giorno, giorni lavorati, operai attivi)
  - Tabella con tutte le ore validate
  - Esportazione Excel

---

## 💰 Integrazione con compensi

- Le ore **validate** alimentano il calcolo compensi
- Le tariffe possono essere:
  - **Default** per tipo operaio (configurate in Impostazioni → Tariffe Operai)
  - **Personalizzate** per singolo operaio (Gestione Operai)
- La pagina **Compensi Operai** utilizza esclusivamente ore validate

---

## ⚠️ Errori comuni e soluzioni

| Problema | Causa probabile | Soluzione |
| --- | --- | --- |
| Non vedo il lavoro nella lista | Il lavoro non è assegnato o non è per oggi | Controlla assegnazione in Gestione Lavori |
| Ore salvate ma non visibili | Filtri attivi o connessione lenta | Rimuovi filtri / aggiorna pagina |
| Ore validate con valori errati | Pausa non inserita | Modifica l’ora prima della validazione |
| Ore bloccate | Stato già “Validato” | Contatta il caposquadra per eventuali correzioni |

---

## ✅ Checklist quotidiana

**Per gli operai**
- [ ] Segnare le ore alla fine di ogni giornata
- [ ] Inserire pause corrette
- [ ] Aggiungere note se succede qualcosa di particolare

**Per i capisquadra**
- [ ] Controllare la sezione “Ore da validare” ogni sera
- [ ] Approvarle entro il giorno successivo
- [ ] Rifiutare solo con nota chiara

---

## 🔗 Sezioni correlate

- [Guida Caposquadra](../03-GUIDE_RUOLO/GUIDA_CAPOSQUADRA.md)
- [Guida Operaio](../03-GUIDE_RUOLO/GUIDA_OPERAIO.md)
- [Calcolo Compensi](../02-FAQ.md#calcolo-compensi) (FAQ)

---

Per altri dubbi consulta la [FAQ](../02-FAQ.md) o la sezione **Risoluzione Problemi**.

