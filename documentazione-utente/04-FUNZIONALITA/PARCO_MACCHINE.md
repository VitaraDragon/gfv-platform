# 🚜 Guida Funzionalità – Parco Macchine

Traccia trattori, attrezzi, manutenzioni e guasti integrando il modulo Parco Macchine con Core Base e Manodopera.

---

## 👥 Ruoli coinvolti

| Ruolo | Permessi |
| --- | --- |
| **Manager / Amministratore** | Gestione completa di macchine, categorie, manutenzioni e guasti |
| **Caposquadra** | Visualizza macchine assegnate ai suoi lavori, segnala guasti |
| **Operaio** | Segnala guasti dal modulo dedicato |

---

## 🧭 Percorsi principali

- Dashboard → **Gestione Macchine**
- Dashboard → **Segnalazione Guasti** (per operai/capisquadra)
- Gestione Lavori → assegnazione trattori/attrezzi

---

## 🗂️ Struttura categorie

- **Categorie attrezzi** (es. Potatura, Trattamento, Raccolta)
- **Categorie lavoro** collegate (via sistema gerarchico)
- **Compatibilità CV**: ogni attrezzo può richiedere una potenza minima del trattore

Gestisci categorie da:
- `modules/parco-macchine/services/categorie-attrezzi-service.js`
- UI dedicata in **Gestione Macchine**

---

## ➕ Aggiungere una macchina

1. Vai su **Gestione Macchine**
2. Seleziona tab **Trattori** o **Attrezzi**
3. Clicca **Nuovo**
4. Compila:
   - Marca/Modello
   - Anno, targa, note
   - Stato (attivo, manutenzione, dismesso)
   - Ore iniziali (per il calcolo manutenzione)
5. Salva

### Aggiungere un attrezzo

1. Tab **Attrezzi**
2. Clic **Nuovo Attrezzo**
3. Compila:
   - Nome
   - Categoria funzionale
   - CV minimo richiesto
   - Note
4. Salva

---

## 🔄 Assegnazione ai lavori

Quando crei o modifichi un lavoro:

1. Seleziona **Trattore** disponibile
2. Seleziona **Attrezzo** (filtrato automaticamente in base ai CV del trattore)
3. Il sistema imposta lo stato macchina su **“in_uso”** fino al completamento del lavoro
4. Al completamento o alla chiusura lavoro, le macchine vengono liberate automaticamente

---

## 🛠️ Manutenzioni

- Ogni macchina tiene traccia di:
  - **Ore attuali**
  - **Ore prossima manutenzione**
  - **Data prossima manutenzione**
- Quando le ore scendono sotto la soglia di 50 o la data è prossima:
  - Appare un avviso nella dashboard
  - Le macchine vengono elencate in “Manutenzioni in scadenza”

Per aggiornare le ore:
- Usa il servizio `macchine-utilizzo-service.js`
- Ogni volta che si validano ore lavorative, le ore macchina vengono incrementate automaticamente (se il lavoro ha una macchina assegnata)

---

## 🚨 Segnalazione guasti

### Operai/Capisquadra

1. Vai su **Segnalazione Guasti**
2. Campi precompilati:
   - Trattore/attrezzo dal lavoro in corso
   - Lavoro associato
3. Compila:
   - Gravità (grave/non grave)
   - Dettagli guasto
4. Invia

Finché il guasto è in attesa, chi l’ha segnalato può chiuderlo con **Risolto da me** (il guasto si chiude subito) o ritirarlo con **Annulla segnalazione** (badge **Annullato**). Un guasto annullato non si riapre: se è stato un errore, si fa una nuova segnalazione.

### Manager

1. Vai su **Parco Macchine** → **Officina & Guasti**
2. Filtro **Solo aperti** / **Tutti**
3. Per chiudere un guasto: **Segna risolto** → note di risoluzione (facoltative) → **Segna risolto**. Il mezzo torna allo stato di prima
4. I guasti ritirati da chi li ha segnalati compaiono con il badge **Annullato**, senza pulsanti
5. Per fermare un lavoro: **Sospendi / Rinvia** in **Gestione Lavori**

---

## 📊 Statistiche macchine

Nella pagina **Statistiche** (quando modulo attivo) trovi:

- Ore macchina totali per periodo
- Macchine utilizzate
- Manutenzioni imminenti
- Grafici:
  - Top 5 macchine più usate
  - Ore per terreno
  - Ore macchina vs ore lavoratore
  - Trend mensile utilizzo

---

## 🧪 Checklist Manager

- [ ] Macchine/attrezzi inseriti con dati completi
- [ ] Categorie attrezzi aggiornate
- [ ] Lavori assegnati con macchine corrette
- [ ] Manutenzioni pianificate
- [ ] Log guasti monitorato

---

## 🆘 Problemi frequenti

| Problema | Spiegazione | Soluzione |
| --- | --- | --- |
| Macchina bloccata “in uso” | Lavoro non completato o errore segnalazione | Completa il lavoro o usa la funzione “Liberazione forzata” in Gestione Lavori |
| Attrezzo non selezionabile | CV trattore insufficiente | Seleziona trattore più potente o modifica requisito attrezzo |
| Guasti non visibili in dashboard | Modulo Parco Macchine disattivo | Attiva il modulo nelle impostazioni abbonamento |

---

Per ulteriori info consulta:
- [Gestione Lavori](GESTIONE_LAVORI.md)
- [FAQ](../02-FAQ.md#parco-macchine)

