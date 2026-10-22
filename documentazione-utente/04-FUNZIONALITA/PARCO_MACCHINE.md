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
- Versione mobile → scheda **⚠️ Segnala un problema** (per operai/capisquadra)
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

1. Nella versione mobile apri la scheda **⚠️ Segnala un problema** (dopo **Ore**; non è nel menu ingranaggio)
2. Scegli **🔧 Guasto Macchina/Attrezzo** oppure **🌍 Segnalazione Generica**
3. Proposti in automatico (da controllare): in **Lavoro corrente** il lavoro della scheda **Lavoro** del campo (scelto o, se mai scelto, quello che la scheda propone da sola, prima il lavoro in corso; altrimenti quello già in corso) e, se quel lavoro li ha, il suo trattore e attrezzo con il **Componente**
4. Compila:
   - Trattore e **Componente con guasto** (Trattore, Attrezzo o Entrambi)
   - **Gravità**: Non grave - Posso finire il lavoro / Grave - Sospendere subito
   - **Dettagli** del problema
   - Facoltativi: lavoro corrente, posizione GPS
5. Tocca **🚨 Segnala**

**Cosa succede dopo l’invio**
- La segnalazione resta **in attesa** e la trovi in **I Miei Guasti Segnalati**. Non manda avvisi o notifiche a nessuno, nemmeno se **Grave**: il manager la vede tra i guasti aperti (contatore in **Richiede attenzione** e **Officina & Guasti**).
- **Guasto a macchina/attrezzo:** il mezzo indicato dal **componente** passa in stato di guasto (con **Non grave** il lavoro può continuare, con **Grave** il mezzo risulta **Guasto**). Finché resta così non si può scegliere per un nuovo lavoro né per una nuova segnalazione: in elenco compare «(già in guasto)».
- **Grave con un lavoro collegato:** il lavoro viene **sospeso** se segnala il manager, il **caposquadra** di quel lavoro di squadra o l’**operaio** sul proprio lavoro autonomo. Se segnala un operaio su un lavoro di squadra, o un caposquadra su un lavoro tutto suo, il mezzo va in guasto ma il lavoro non cambia e dopo l’invio si legge «Segnalazione inviata. Il lavoro lo sospende il caposquadra o il manager.»: la segnalazione è registrata e il responsabile vede il guasto nell’elenco **Officina & Guasti**.

Finché il guasto è in attesa, chi l’ha segnalato può chiuderlo con **Risolto da me** (il guasto si chiude subito; le sue note si vedono nello **storico guasti** della scheda del mezzo, non in **Officina & Guasti**) o ritirarlo con **Annulla segnalazione** (badge **Annullato**). Un guasto annullato non si riapre: se è stato un errore, si fa una nuova segnalazione.

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

