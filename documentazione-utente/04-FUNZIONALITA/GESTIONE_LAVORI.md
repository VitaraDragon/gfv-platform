# 📋 Guida Funzionalità – Gestione Lavori

Gestisci l’intero ciclo di vita dei lavori: pianificazione, assegnazione, avanzamento e completamento.

---

## 🎯 Obiettivi

- Pianificare lavori per terreni e colture specifiche
- Assegnare incarichi a capisquadra o operai autonomi
- Tracciare avanzamento e zone lavorate
- Collegare macchine e attrezzi

---

## 👥 Ruoli richiesti

- **Manager** (pieno accesso)
- **Amministratore** (se modulo Manodopera attivo)

---

## 🧭 Percorso

1. Dashboard → sezione **Gestione Manodopera**
2. Click su **Gestione Lavori**

---

## ➕ Creare un lavoro

1. Click **Nuovo Lavoro**
2. Compila i campi principali:
   - **Nome lavoro**
   - **Terreno** (solo terreni con mappa inclusa)
   - **Tipo lavoro** (dalla struttura gerarchica categorie)
   - **Data inizio** e **Durata prevista**
   - **Note** (es. obiettivi specifici)
3. Assegnazione:
   - **A caposquadra** → il caposquadra coordina la squadra
   - **Diretta a operaio** → lavoro autonomo, ideale per trattoristi
   - **Squadra** (opzionale): seleziona la squadra preconfigurata
4. Macchine (opzionale):
   - Seleziona **Trattore** e **Attrezzo** compatibili
5. Salva

📌 Il sistema imposta automaticamente lo stato **“Pianificato”**.

---

## ✏️ Modificare un lavoro

1. Apri il lavoro dalla lista
2. Clicca **Modifica**
3. Aggiorna campi necessari (assegnatari, date, note, macchine)
4. Salva

⚠️ Se cambi caposquadra/operai, avvisa la squadra: eventuali comunicazioni rapide non si aggiornano automaticamente.

---

## 🔄 Stati lavoro

| Stato | Descrizione | Come si imposta |
| --- | --- | --- |
| Pianificato | Lavoro creato, non assegnato | Creazione |
| Assegnato | Assegnato a caposquadra/operaio | Salvataggio con assegnazione |
| In corso | Lavoro iniziato | Caposquadra → “Inizia lavoro” |
| Completato | Attività finite | Caposquadra/Manager → “Completa lavoro” |
| Approvato | Validato dal Manager | Manager → “Approva lavoro” |
| Sospeso | Lavoro interrotto (es. condizioni meteo); si può creare una **ripresa** | Caposquadra → sospensione; Manager → **Crea ripresa** |

### ⏸️ Sospensione e ripresa

- Il **caposquadra** può **sospendere** un lavoro **In corso** (con indicazione del motivo). Il lavoro passa allo stato **Sospeso**.
- Il **Manager**, in **Gestione Lavori**, può creare un **nuovo lavoro di ripresa** collegato al lavoro sospeso tramite il pulsante **Crea ripresa**. Si apre una finestra in cui scegliere la **data di inizio** del nuovo lavoro (non è impostata automaticamente sul solo “oggi”): vengono copiati terreno, tipo lavoro e assegnazione; il nuovo lavoro è in stato **Assegnato** e collegato al precedente per tracciabilità.

---

## 🗺️ Tracciamento zone lavorate

- Caposquadra può disegnare poligoni direttamente nella pagina lavoro
- Ogni poligono indica una zona completata
- I dati vengono mostrati sulla **Mappa Aziendale** per distinguere superfici lavorate/restanti
- Lo stato di avanzamento (% completamento) si aggiorna in base alla superficie coperta e alle ore segnate

---

## 🕒 Avanzamento & Diario da Lavori

- Ogni lavoro “In corso” appare nella sezione **Diario da Lavori**
- Le ore validate generano automaticamente attività giornaliere con:
  - Data
  - Terreno
  - Tipo lavoro
  - Ore totali e operai coinvolti
- Il Manager può filtrare per periodo e terreno

---

## 💬 Comunicazioni e squadra

- In caso di lavori di squadra, il caposquadra può inviare **Comunicazioni di Ritrovo**
- Gli operai ricevono notifiche nella loro dashboard e devono confermare
- I contatti squadra (email/cellulare) sono sempre accessibili

---

## 🧮 Integrazione con altre sezioni

- **Segnatura ore**: gli operai associano ogni ora a un lavoro → fondamentali per avanzamento e compensi
- **Calcolo compensi**: usa le ore validate per calcolare il costo lavoro per operaio
- **Parco macchine**: aggiorna automaticamente ore macchine e segnala guasti
- **Statistiche**: riepiloga lavori attivi/pianificati/completati e superficie lavorata

---

## ✅ Checklist Manager

- [ ] Terreno e tipo lavoro corretti
- [ ] Assegnazione confermata
- [ ] Durata realistica
- [ ] Trattori/attrezzi disponibili
- [ ] Comunicazione inviata alla squadra
- [ ] Monitoraggio ore e zone giornaliero

---

## 🆘 Problemi frequenti

| Sintomo | Possibile causa | Soluzione |
| --- | --- | --- |
| Lavoro non visibile al caposquadra | Assegnazione mancante | Modifica lavoro e assegna |
| Percentuale completamento errata | Zone non tracciate | Disegna poligoni aggiornati |
| Macchina bloccata “in uso” | Lavoro non completato | Completa lavoro o libera macchine in Gestione Lavori |
| Comunicazioni non ricevute | Operai non nella squadra | Aggiorna squadra o invia comunicazione manuale |

---

Hai bisogno di approfondire? Consulta le guide caposquadra/operaio o la [FAQ](../02-FAQ.md).

