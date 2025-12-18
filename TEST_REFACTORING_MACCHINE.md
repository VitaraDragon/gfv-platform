ho notato che ne# 🧪 Guida Test Refactoring Macchine - Validazione Ore

## 🎯 Cosa Testiamo

Verifichiamo che il refactoring funzioni correttamente:
- ✅ Le ore macchina vengono aggiornate quando si valida un'ora
- ✅ Il service unificato viene utilizzato correttamente
- ✅ Gli alert di manutenzione funzionano
- ✅ La validazione multipla funziona correttamente

---

## 📋 Prerequisiti

1. **Firebase configurato** con tenant attivo
2. **Modulo Parco Macchine attivo** nel tenant
3. **Almeno una macchina** censita nel sistema
4. **Almeno un lavoro** con ore da validare

---

## 🚀 STEP 1: Avvia il Server

### Opzione A: Usa start-server.bat (CONSIGLIATO)

1. Doppio clic su `start-server.bat` nella cartella principale
2. Attendi che il server si avvii
3. Dovresti vedere: `Starting up http-server...`

### Opzione B: Usa Python

1. Apri PowerShell nella cartella `gfv-platform`
2. Esegui:
   ```bash
   python -m http.server 8000
   ```
3. **NON chiudere** questa finestra!

### Opzione C: Usa Node.js

1. Apri PowerShell nella cartella `gfv-platform`
2. Esegui:
   ```bash
   npx http-server -p 8000 -c-1
   ```
3. **NON chiudere** questa finestra!

---

## 🔧 STEP 2: Prepara i Dati di Test

### 2.1 Verifica Modulo Parco Macchine Attivo

1. Apri: `http://localhost:8000/core/admin/impostazioni-standalone.html`
2. Accedi con un account **Manager** o **Amministratore**
3. Vai nella sezione **Moduli**
4. Verifica che **Parco Macchine** sia attivo
5. Se non è attivo, attivalo

### 2.2 Crea/Verifica Macchina di Test

1. Apri: `http://localhost:8000/core/admin/gestione-macchine-standalone.html`
2. Crea una macchina di test (se non esiste):
   - **Tipo**: Trattore
   - **Nome**: "Trattore Test"
   - **Ore iniziali**: 100
   - **Ore prossima manutenzione**: 150 (per testare alert)
   - **Stato**: Disponibile
3. **Annota l'ID della macchina** (o il nome completo)

### 2.3 Crea/Verifica Lavoro con Ore da Validare

1. Apri: `http://localhost:8000/core/segnatura-ore-standalone.html`
2. Accedi con un account **Operaio** o **Caposquadra**
3. Seleziona un lavoro esistente o creane uno nuovo
4. Segna almeno 2-3 ore con la macchina di test:
   - **Data**: Oggi o ieri
   - **Orario inizio**: 08:00
   - **Orario fine**: 12:00
   - **Pause**: 0 minuti
   - **Macchina**: Seleziona "Trattore Test"
   - **Ore macchina**: 4 (o lascia vuoto per usare ore nette)
5. Clicca **Salva**
6. Le ore saranno in stato `da_validare`

---

## ✅ STEP 3: Test Validazione Singola

### 3.1 Apri Pagina Validazione Ore

1. Apri: `http://localhost:8000/core/admin/validazione-ore-standalone.html`
2. Accedi con un account **Manager** o **Caposquadra**
3. Dovresti vedere la lista delle ore da validare

### 3.2 Verifica Ore Attuali Macchina (PRIMA)

1. Apri una nuova scheda: `http://localhost:8000/core/admin/gestione-macchine-standalone.html`
2. Trova "Trattore Test"
3. **Annota le ore attuali** (es. 100 ore)
4. **Annota le ore prossima manutenzione** (es. 150 ore)

### 3.3 Apri Console Browser (IMPORTANTE)

1. Nella pagina **Validazione Ore**, premi **F12**
2. Vai alla tab **Console**
3. Questo ti permetterà di vedere:
   - Se il service viene caricato correttamente
   - Eventuali errori
   - Messaggi di debug

### 3.4 Valida l'Ora

1. Torna alla pagina **Validazione Ore**
2. Trova l'ora che hai segnato con "Trattore Test"
3. Clicca **Valida** sull'ora
4. Conferma la validazione

### 3.5 Verifica Risultati

#### ✅ Verifica 1: Ore Macchina Aggiornate

1. Torna alla pagina **Gestione Macchine**
2. Ricarica la pagina (F5)
3. Trova "Trattore Test"
4. **Verifica che le ore attuali siano aumentate**:
   - Prima: 100 ore
   - Dopo: 104 ore (se hai validato 4 ore)
   - ✅ **SUCCESSO**: Le ore sono state aggiornate!

#### ✅ Verifica 2: Alert Manutenzione (se applicabile)

Se le ore attuali sono vicine alla manutenzione:
- **Dovresti vedere un alert** nella pagina Validazione Ore
- L'alert dice: "⚠️ ATTENZIONE: La macchina 'Trattore Test' ha superato le ore di manutenzione programmata!"
- ✅ **SUCCESSO**: Gli alert funzionano!

#### ✅ Verifica 3: Console Browser

Nella console del browser dovresti vedere:
- ✅ Nessun errore rosso
- ✅ Eventuali messaggi di debug del service
- ✅ Se vedi "Service macchine non disponibile": significa che stai usando file:// invece di http://

---

## ✅ STEP 4: Test Validazione Multipla

### 4.1 Prepara Più Ore

1. Segna altre 2-3 ore con la stessa macchina (vedi STEP 2.3)
2. Assicurati che siano tutte in stato `da_validare`

### 4.2 Valida Multiple Ore

1. Nella pagina **Validazione Ore**
2. Seleziona più ore (se c'è un checkbox)
3. Oppure valida le ore una per una rapidamente
4. Verifica che tutte vengano validate correttamente

### 4.3 Verifica Ore Finali

1. Torna a **Gestione Macchine**
2. Ricarica la pagina
3. **Verifica che le ore siano aumentate correttamente**:
   - Se hai validato 3 ore da 4 ore ciascuna = +12 ore totali
   - ✅ **SUCCESSO**: La validazione multipla funziona!

---

## ✅ STEP 5: Test con Attrezzo

### 5.1 Crea Attrezzo di Test

1. In **Gestione Macchine**, vai alla tab **Attrezzi**
2. Crea un attrezzo:
   - **Nome**: "Attrezzo Test"
   - **Ore iniziali**: 50
   - **Ore prossima manutenzione**: 100
   - **CV minimo**: Compatibile con il trattore di test

### 5.2 Segna Ora con Trattore + Attrezzo

1. In **Segna Ore**, segna un'ora con:
   - **Trattore**: "Trattore Test"
   - **Attrezzo**: "Attrezzo Test"
   - **Ore macchina**: 2

### 5.3 Valida e Verifica

1. Valida l'ora (vedi STEP 3.4)
2. Verifica che **entrambe** le macchine abbiano le ore aggiornate:
   - Trattore: +2 ore
   - Attrezzo: +2 ore
   - ✅ **SUCCESSO**: Funziona con trattore + attrezzo!

---

## ✅ STEP 6: Test Rifiuto Ora

### 6.1 Segna Ora con Macchina

1. Segna un'ora con macchina (vedi STEP 2.3)

### 6.2 Rifiuta l'Ora

1. In **Validazione Ore**, clicca **Rifiuta**
2. Inserisci un motivo
3. Conferma il rifiuto

### 6.3 Verifica che le Ore NON siano Aggiornate

1. Controlla le ore della macchina in **Gestione Macchine**
2. **Le ore NON devono essere aumentate**
3. ✅ **SUCCESSO**: Il rifiuto non aggiorna le ore (corretto!)

---

## 🐛 Troubleshooting

### Problema: "Service macchine non disponibile"

**Causa**: Stai aprendo il file direttamente (file://) invece di usare un server HTTP

**Soluzione**:
1. Assicurati di usare `http://localhost:8000/...`
2. NON aprire il file direttamente con doppio clic
3. Usa uno dei metodi in STEP 1

### Problema: Le ore non si aggiornano

**Verifica**:
1. Controlla la console del browser (F12) per errori
2. Verifica che il modulo Parco Macchine sia attivo
3. Verifica che la macchina esista nel database
4. Verifica che l'ora abbia `macchinaId` o `attrezzoId` nel documento

### Problema: Alert manutenzione non appare

**Verifica**:
1. Le ore attuali devono essere >= ore prossima manutenzione
2. Controlla la console per messaggi di debug
3. Verifica che `showAlertCallback` sia passato correttamente

### Problema: Errore "Cannot find module"

**Causa**: Il percorso del service non è corretto

**Verifica**:
1. Il file `modules/parco-macchine/services/macchine-utilizzo-service.js` esiste
2. Il percorso relativo è corretto: `../../modules/parco-macchine/services/macchine-utilizzo-service.js`
3. Stai usando un server HTTP (non file://)

---

## 📊 Checklist Test Completo

- [ ] Server avviato correttamente (http://localhost:8000)
- [ ] Modulo Parco Macchine attivo
- [ ] Macchina di test creata
- [ ] Lavoro con ore da validare creato
- [ ] Ore macchina iniziali annotate
- [ ] Console browser aperta (F12)
- [ ] Validazione singola funziona
- [ ] Ore macchina aggiornate dopo validazione
- [ ] Alert manutenzione funziona (se applicabile)
- [ ] Validazione multipla funziona
- [ ] Test con attrezzo funziona
- [ ] Rifiuto ora NON aggiorna le ore
- [ ] Nessun errore nella console

---

## 🎉 Test Completato!

Se tutti i test passano:
- ✅ Il refactoring è **funzionante**
- ✅ Il service unificato viene utilizzato correttamente
- ✅ Le ore macchina vengono aggiornate solo alla validazione
- ✅ Gli alert di manutenzione funzionano
- ✅ La gestione errori funziona correttamente

---

## 📝 Note Importanti

1. **Le ore vengono aggiornate SOLO alla validazione**, non alla segnatura
2. **Il rifiuto NON aggiorna le ore** (comportamento corretto)
3. **Gli alert appaiono solo se le ore superano la soglia di manutenzione**
4. **Il service gestisce automaticamente** trattore e attrezzo separatamente

---

**Buon test!** 🚀



