# 👥 Processo Gestione Squadre - GFV Platform

**Data creazione**: 2025-01-13  
**Versione**: 1.0  
**Stato**: Definizione processo completo

---

## 🎯 Obiettivo

Definire il processo completo di creazione e gestione squadre da parte del Manager.

---

## ✅ Processo Creazione Squadra

### Step 1: Manager Apre Pagina "Gestione Squadre"

**Interfaccia**:
- Lista squadre esistenti (se presenti)
- Pulsante "Crea Nuova Squadra"
- Per ogni squadra: nome, caposquadra, numero operai, azioni (modifica/elimina)

### Step 2: Manager Clicca "Crea Nuova Squadra"

**Form Creazione Squadra**:

1. **Nome Squadra** (obbligatorio):
   - Campo testo
   - Esempi: "Squadra Nord", "Squadra Sud", "Squadra Est"
   - Validazione: minimo 3 caratteri, massimo 50 caratteri

2. **Seleziona Caposquadra** (obbligatorio):
   - **Dropdown/Select** con lista utenti
   - **Filtro automatico**: Mostra solo utenti con ruolo `caposquadra`
   - **Campi mostrati**: Nome, Cognome, Email
   - **Validazione**: Deve selezionare un caposquadra
   - **Nota**: Se nessun caposquadra disponibile, mostra messaggio "Nessun caposquadra disponibile. Assegna prima il ruolo caposquadra agli utenti."

3. **Seleziona Operai** (opzionale, ma consigliato):
   - **Lista checkbox** o **multi-select** con lista utenti
   - **Filtro automatico**: Mostra solo utenti con ruolo `operaio`
   - **Filtro aggiuntivo**: Mostra solo operai NON già in altre squadre (opzionale, vedi considerazioni)
   - **Campi mostrati**: Nome, Cognome, Email, Cellulare (se disponibile)
   - **Validazione**: Almeno 1 operaio consigliato (ma non obbligatorio)
   - **Nota**: Se nessun operaio disponibile, mostra messaggio "Nessun operaio disponibile. Assegna prima il ruolo operaio agli utenti."

4. **Note** (opzionale):
   - Campo testo area
   - Note aggiuntive sulla squadra

### Step 3: Manager Salva Squadra

**Validazioni Prima del Salvataggio**:
- Nome squadra obbligatorio
- Caposquadra obbligatorio
- Caposquadra deve avere ruolo `caposquadra` (verifica doppia)
- Operai devono avere ruolo `operaio` (verifica doppia)

**Salvataggio in Firestore**:
```
tenants/{tenantId}/squadre/{squadraId}
{
  nome: "Squadra Nord",
  caposquadraId: "user-paolo-001",
  operai: ["user-operaio-1", "user-operaio-2", "user-operaio-3"],
  note: "Squadra specializzata in potatura",
  creatoDa: "manager-user-id",
  creatoIl: timestamp,
  aggiornatoIl: timestamp
}
```

**Messaggio Successo**: "Squadra creata con successo!"

---

## 🔄 Processo Modifica Squadra

### Manager Modifica Squadra Esistente

**Cosa può modificare**:
1. **Nome squadra** ✅
2. **Caposquadra** ✅ (cambio caposquadra)
3. **Lista operai** ✅ (aggiungere/rimuovere operai)
4. **Note** ✅

**Interfaccia Modifica**:
- Stesso form della creazione, ma precompilato con dati esistenti
- Caposquadra attuale selezionato
- Operai attuali selezionati (checkbox checked)

**Validazioni**:
- Stesse validazioni della creazione
- Verifica che caposquadra nuovo abbia ruolo `caposquadra`
- Verifica che operai nuovi abbiano ruolo `operaio`

**Salvataggio**:
- Aggiorna documento esistente
- Aggiorna campo `aggiornatoIl`

---

## ⚠️ Considerazioni Importanti

### 1. Un Caposquadra può Essere in Più Squadre?

**Domanda**: Un caposquadra può gestire più squadre contemporaneamente?

**Risposta**: Tecnicamente sì, ma sconsigliato.

**Se permesso**:
- Dropdown caposquadra mostra tutti i caposquadra disponibili
- Nessuna validazione che impedisce selezione di caposquadra già in altra squadra
- Manager può assegnare stesso caposquadra a più squadre

**Problemi**:
- Confusione per caposquadra (vede lavori di più squadre)
- Difficile gestire validazione ore (quale squadra?)
- Complessità aggiuntiva

**Raccomandazione**: 
- **Opzione A** (Consigliato): Un caposquadra = una squadra
  - Validazione: Se caposquadra già in altra squadra, mostra avviso
  - Manager può comunque forzare (ma sconsigliato)
  
- **Opzione B**: Permettere più squadre per caposquadra
  - Nessuna validazione
  - Caposquadra vede lavori di tutte le sue squadre

**Scelta**: Opzione A (un caposquadra = una squadra) per semplicità.

### 2. Un Operaio può Essere in Più Squadre?

**Domanda**: Un operaio può appartenere a più squadre contemporaneamente?

**Risposta**: Dipende dalla logica business.

**Opzione A - Una Squadra Alla Volta** (Consigliato):
- Operaio appartiene a una sola squadra
- **Validazione**: Se operaio già in altra squadra, mostra avviso
- Manager può rimuovere da squadra vecchia e aggiungere a nuova
- Più semplice da gestire

**Opzione B - Più Squadre Contemporaneamente**:
- Operaio può essere in più squadre
- Nessuna validazione
- Più flessibile ma più complesso
- Richiede logica aggiuntiva: quale squadra per quale lavoro?

**Raccomandazione**: Opzione A (una squadra alla volta) per semplicità.

**Implementazione Opzione A**:
- Quando Manager seleziona operai, mostra solo operai NON già in altre squadre
- Oppure mostra tutti gli operai ma evidenzia quelli già in altre squadre
- Manager può comunque selezionarli (ma sistema avvisa)

### 3. Filtri Lista Utenti

**Per Caposquadra**:
- Mostra solo utenti con ruolo `caposquadra`
- Mostra solo utenti attivi (`stato == "attivo"`)
- Ordina per nome/cognome alfabetico
- Mostra: Nome, Cognome, Email

**Per Operai**:
- Mostra solo utenti con ruolo `operaio`
- Mostra solo utenti attivi (`stato == "attivo"`)
- Se Opzione A (una squadra alla volta): mostra solo operai NON già in altre squadre
- Se Opzione B (più squadre): mostra tutti gli operai
- Ordina per nome/cognome alfabetico
- Mostra: Nome, Cognome, Email, Cellulare

**Query Esempio**:
```
// Caposquadra disponibili
users/ dove tenantId == currentTenantId 
       AND ruoli contiene "caposquadra"
       AND stato == "attivo"

// Operai disponibili (Opzione A)
users/ dove tenantId == currentTenantId 
       AND ruoli contiene "operaio"
       AND stato == "attivo"
       AND id NOT IN (tutti gli operai già in altre squadre)
```

### 4. Cosa Succede quando si Modifica una Squadra?

**Cambio Caposquadra**:
- Vecchio caposquadra: perde accesso a lavori della squadra
- Nuovo caposquadra: ottiene accesso a lavori della squadra
- **Lavori esistenti**: Cosa fare?
  - **Opzione A**: Mantieni `caposquadraId` originale (storico)
  - **Opzione B**: Aggiorna `caposquadraId` a nuovo caposquadra
  - **Raccomandazione**: Opzione A (mantieni storico) + Opzione B (aggiorna lavori futuri)
    - Lavori completati: mantieni caposquadra originale
    - Lavori in corso: aggiorna a nuovo caposquadra (con conferma Manager)

**Rimozione Operaio**:
- Operaio rimosso dalla squadra
- **Ore esistenti**: Mantengono storico (non cambiano)
- **Lavori futuri**: Operaio non vede più lavori della squadra
- **Lavori in corso**: Cosa fare?
  - **Opzione A**: Operaio continua a vedere lavori già assegnati
  - **Opzione B**: Operaio perde accesso immediatamente
  - **Raccomandazione**: Opzione A (mantieni accesso a lavori già assegnati)

**Aggiunta Operaio**:
- Operaio aggiunto alla squadra
- Operaio vede lavori futuri della squadra
- Operaio può essere assegnato a nuovi lavori

### 5. Eliminazione Squadra

**Quando possibile**:
- Solo se squadra non ha lavori attivi
- Solo se squadra non ha lavori in corso

**Validazioni**:
- Verifica lavori assegnati alla squadra
- Se ci sono lavori in corso: impedisci eliminazione
- Se ci sono lavori completati: permetti eliminazione (storico preservato)

**Cosa succede**:
- Squadra eliminata
- Caposquadra: mantiene ruolo, ma non è più caposquadra di nessuna squadra
- Operai: rimossi dalla squadra, ma mantengono ruolo operaio
- Lavori completati: mantengono storico (caposquadraId e operai)

**Messaggio**: "Squadra eliminata. Caposquadra e operai mantengono i loro ruoli."

---

## 📋 Checklist Processo Completo

### Creazione Squadra

- [ ] Manager apre pagina "Gestione Squadre"
- [ ] Manager clicca "Crea Nuova Squadra"
- [ ] Manager inserisce nome squadra
- [ ] Sistema mostra lista caposquadra disponibili (filtrati per ruolo)
- [ ] Manager seleziona caposquadra
- [ ] Sistema mostra lista operai disponibili (filtrati per ruolo e squadra)
- [ ] Manager seleziona operai (checkbox o multi-select)
- [ ] Manager inserisce note (opzionale)
- [ ] Manager salva squadra
- [ ] Sistema valida dati
- [ ] Sistema salva in Firestore
- [ ] Sistema mostra messaggio successo

### Modifica Squadra

- [ ] Manager apre pagina "Gestione Squadre"
- [ ] Manager clicca "Modifica" su una squadra
- [ ] Sistema mostra form precompilato
- [ ] Manager modifica nome/caposquadra/operai/note
- [ ] Se cambio caposquadra: sistema avvisa e chiede conferma
- [ ] Se rimozione operai: sistema avvisa e chiede conferma
- [ ] Manager salva modifiche
- [ ] Sistema valida dati
- [ ] Sistema aggiorna Firestore
- [ ] Se cambio caposquadra: sistema aggiorna lavori in corso (opzionale)
- [ ] Sistema mostra messaggio successo

### Eliminazione Squadra

- [ ] Manager apre pagina "Gestione Squadre"
- [ ] Manager clicca "Elimina" su una squadra
- [ ] Sistema verifica lavori attivi
- [ ] Se lavori attivi: sistema impedisce eliminazione e mostra messaggio
- [ ] Se nessun lavoro attivo: sistema chiede conferma
- [ ] Manager conferma eliminazione
- [ ] Sistema elimina squadra
- [ ] Sistema mostra messaggio successo

---

## 🎨 Interfaccia Utente Suggerita

### Pagina "Gestione Squadre"

**Layout**:
- Header: "Gestione Squadre" + Pulsante "Crea Nuova Squadra"
- Lista squadre esistenti (tabella o card)
- Per ogni squadra:
  - Nome squadra
  - Caposquadra (nome, cognome)
  - Numero operai
  - Azioni: Modifica, Elimina

### Form Creazione/Modifica Squadra

**Layout**:
- Modal o pagina dedicata
- Form con:
  - Campo "Nome Squadra" (testo)
  - Dropdown "Caposquadra" (con filtro ruolo)
  - Multi-select "Operai" (con filtro ruolo e squadra)
  - Campo "Note" (textarea)
  - Pulsanti: Salva, Annulla

**Validazioni Visive**:
- Campi obbligatori evidenziati
- Avvisi se caposquadra già in altra squadra
- Avvisi se operai già in altre squadre
- Contatore operai selezionati

---

## 🔍 Cosa Potresti Aver Dimenticato

### 1. Ruoli Utenti Prima di Creare Squadre

**Problema**: Manager vuole creare squadra ma non ci sono caposquadra/operai disponibili.

**Soluzione**:
- Manager deve prima assegnare ruoli agli utenti
- Processo: Amministratore assegna ruoli → Manager crea squadre
- **Messaggio utile**: Se nessun caposquadra disponibile, mostra link "Assegna ruolo caposquadra agli utenti"

### 2. Visualizzazione Squadre per Caposquadra

**Domanda**: Il caposquadra vede la sua squadra?

**Risposta**: Sì, ma solo in lettura.

**Interfaccia Caposquadra**:
- Vede nome squadra
- Vede lista operai (nome, cognome, cellulare)
- NON può modificare squadra (solo Manager può)
- Link "La Mia Squadra" nella dashboard

### 3. Assegnazione Lavori a Squadre

**Domanda**: Come fa il Manager ad assegnare lavori a una squadra?

**Risposta**: Assegna lavoro al caposquadra (che identifica la squadra).

**Processo**:
1. Manager crea lavoro
2. Manager seleziona caposquadra (dropdown con caposquadra disponibili)
3. Sistema assegna lavoro a quel caposquadra
4. Caposquadra vede lavoro nella sua lista
5. Operai della squadra vedono lavoro (quando assegnato a loro)

**Nota**: Il lavoro è assegnato al caposquadra, non direttamente alla squadra. La squadra è implicita (caposquadra → squadra → operai).

### 4. Statistiche Squadre

**Domanda**: Il Manager vede statistiche per squadra?

**Risposta**: Sì, utile per monitoraggio.

**Statistiche Utili**:
- Numero lavori assegnati per squadra
- Ore lavorate per squadra
- Progressi lavori per squadra
- Efficienza squadra (ore vs superficie lavorata)

**Interfaccia**:
- Dashboard Manager: widget "Statistiche Squadre"
- Pagina "Gestione Squadre": statistiche per ogni squadra

### 5. Notifiche e Comunicazioni

**Domanda**: Caposquadra e operai vengono notificati quando vengono aggiunti a una squadra?

**Risposta**: Opzionale, ma utile.

**Notifiche Utili**:
- Quando caposquadra viene assegnato a squadra: email/notifica
- Quando operaio viene aggiunto a squadra: email/notifica
- Quando operaio viene rimosso da squadra: email/notifica
- Quando caposquadra cambia: email/notifica a vecchio e nuovo caposquadra

**Implementazione**: Futuro, non critico per MVP.

---

## ✅ Riepilogo: Cosa Serve

### Per Creare Squadra

1. **Lista utenti con ruolo caposquadra** (filtrata)
2. **Lista utenti con ruolo operaio** (filtrata)
3. **Form creazione** con selezione caposquadra e operai
4. **Validazioni** (nome obbligatorio, caposquadra obbligatorio)
5. **Salvataggio** in Firestore

### Per Modificare Squadra

1. **Form modifica** (stesso form creazione, precompilato)
2. **Validazioni** (stesse della creazione)
3. **Gestione cambio caposquadra** (avviso + conferma)
4. **Gestione aggiunta/rimozione operai** (avvisi)
5. **Aggiornamento** Firestore

### Per Eliminare Squadra

1. **Verifica lavori attivi** (impedisci se presenti)
2. **Conferma eliminazione**
3. **Eliminazione** Firestore

### Filtri Utenti

1. **Filtro ruolo** (caposquadra/operaio)
2. **Filtro stato** (solo attivi)
3. **Filtro squadra** (opzionale: solo non già in altre squadre)
4. **Ordinamento** (nome/cognome alfabetico)

---

**Ultimo aggiornamento**: 2025-01-13  
**Stato**: Processo completo definito, pronto per implementazione



