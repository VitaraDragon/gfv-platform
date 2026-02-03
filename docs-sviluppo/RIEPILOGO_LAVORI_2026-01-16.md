# 📋 Riepilogo Lavori - 2026-01-16

## 📝 Pianificazione: Integrazione Vendemmia-Lavori - Rilevamento Automatico

### Obiettivo
Definire e documentare l'architettura per l'integrazione automatica tra il sistema Lavori/Diario e il modulo Vigneto, implementando un sistema di rilevamento automatico della vendemmia basato sulla creazione di lavori/attività.

---

## 🎯 Decisioni Architetturali

### 1. Rilevamento Automatico Vendemmia

**Principio Fondamentale**:
- La vendemmia viene rilevata automaticamente quando si crea un Lavoro o Attività con:
  - Tipo lavoro: "Vendemmia Manuale" o "Vendemmia Meccanica"
  - Terreno con coltura: "VITE"
- Creazione automatica della vendemmia al salvataggio del lavoro
- Elenco vendemmie popolato automaticamente

**Vantaggi**:
- ✅ Zero duplicazione: un solo punto di inserimento (lavoro)
- ✅ Rilevamento automatico: nessuna azione manuale
- ✅ Elenco sempre aggiornato: vendemmie compaiono automaticamente
- ✅ Dati base già presenti: operai, ore, macchine dal lavoro

### 2. Tipi Lavoro Specifici

**Tipi da Pre-creare**:
- "Vendemmia Manuale" (Categoria: RACCOLTA → Sottocategoria: Manuale)
- "Vendemmia Meccanica" (Categoria: RACCOLTA → Sottocategoria: Meccanica)

**Filtro Dropdown**:
- Quando terreno = "VITE" e categoria = "RACCOLTA"
- Mostrare solo: "Vendemmia Manuale" e "Vendemmia Meccanica"
- Nascondere: tipi raccolta di altre colture (es. "Raccolta Frutta")

### 3. Struttura Dati

**Collegamento Lavoro ↔ Vendemmia**:
- `vendemmia.lavoroId` → `lavoro.id` (collegamento bidirezionale)
- `vendemmia.vignetoId` → trovato tramite `lavoro.terrenoId`

**Dati Precompilati dal Lavoro**:
- Data, vignetoId, varieta, operai, macchine, oreImpiegate, zone

**Dati da Completare Manualmente**:
- quantitaQli (obbligatorio)
- quantitaEttari (obbligatorio)
- destinazione (obbligatorio)
- gradazione, acidita, ph (opzionali)

### 4. Integrazione con Sistema Spese

**Classificazione**:
- Vendemmia Manuale → Voce "Vendemmia" sotto **MANODOPERA**
- Vendemmia Meccanica → Voce "Vendemmia" sotto **MACCHINE**

**Breakdown Spese**:
```
Spese Manodopera Anno: 5000€
  ├── Potatura: 1500€
  ├── Lavorazione Terreno: 2000€
  └── Vendemmia: 1500€  ← Nuova voce

Spese Macchine Anno: 2000€
  ├── Trattamenti: 800€
  └── Vendemmia: 1200€  ← Nuova voce
```

### 5. Gestione Modifiche ed Eliminazioni

**Regole Definite**:
- **Modifica Lavoro**: Aggiorna automaticamente vendemmia (operai, ore, macchine, zone)
- **Modifica Tipo Lavoro**: Se cambia da "Vendemmia" → elimina vendemmia automaticamente
- **Cambio Terreno**: Se cambia da "VITE" → mantiene vendemmia ma scollega lavoro
- **Eliminazione Lavoro**: Elimina automaticamente anche la vendemmia

### 6. Validazione e Stato

**Vendemmia Completa**:
- Criteri: `quantitaQli`, `quantitaEttari`, `destinazione` presenti
- Badge "Completa" nell'elenco
- Inclusa nei report produzione

**Vendemmia Incompleta**:
- Criteri: manca almeno uno dei campi obbligatori
- Badge "Incompleta" nell'elenco (colore arancione/giallo)
- Alert quando si apre modulo vigneto
- Permettere salvataggio incompleto (con alert)
- Escludere dai report produzione finché non completa

### 7. Interfaccia Utente

**Elenco Vendemmie**:
- Tabella con colonne: Data, Vigneto/Varietà, Quantità, Resa, Qualità, Stato, Azioni
- Badge stato: "Completa" / "Incompleta"
- Link "Vedi Lavoro" per ogni vendemmia
- Filtri: Anno, Vigneto/Varietà, Stato, Destinazione

**Modal Completamento Vendemmia**:
- Sezione "Dati Lavoro" (sola lettura):
  - Data, operai, ore, macchine (dal lavoro)
  - Tabella operai: Data, Nome Operaio, Ore (precompilata, non editabile)
  - Tabella macchine: Data, Macchina/Attrezzo, Ore (precompilata, non editabile)
  - Zone tracciate (visualizzazione Maps)
  - Link "Vedi Dettagli Lavoro"
- Sezione "Dati Vendemmia" (editabile):
  - Quantità (qli) *, Superficie (ha) *, Resa (calcolata)
  - Gradazione, acidità, pH
  - Destinazione *, Parcella, Note

### 8. Tabelle Operai e Macchine

**Comportamento**:
- Se precompilate dal lavoro: **sola consultazione** (modifiche nel lavoro)
- Se manuali (senza modulo Manodopera): **sempre editabili**
- Stesso comportamento per operai e macchine

---

## 📋 Checklist Implementazione

### Fase 1: Preparazione
- [ ] Creare tipi lavoro "Vendemmia Manuale" e "Vendemmia Meccanica" nel sistema
- [ ] Aggiungere campo `lavoroId` al modello Vendemmia
- [ ] Aggiornare struttura dati Firestore (sub-collection vendemmie)

### Fase 2: Rilevamento Automatico
- [ ] Implementare hook creazione vendemmia automatica al salvataggio lavoro
- [ ] Implementare funzione `createVendemmiaFromLavoro(lavoroId)`
- [ ] Implementare logica rilevamento: `IF (tipoLavoro.includes("Vendemmia") AND terreno.coltura === "VITE")`
- [ ] Test creazione automatica vendemmia

### Fase 3: UI Elenco Vendemmie
- [ ] Aggiornare elenco vendemmie con badge stato (Completa/Incompleta)
- [ ] Aggiungere link "Vedi Lavoro" per ogni vendemmia
- [ ] Implementare filtri: Anno, Vigneto/Varietà, Stato, Destinazione
- [ ] Aggiornare query per includere vendemmie da lavori

### Fase 4: UI Modal Vendemmia
- [ ] Aggiungere sezione "Dati Lavoro" (sola lettura)
- [ ] Implementare tabella operai precompilata (Data, Nome, Ore)
- [ ] Implementare tabella macchine precompilata (Data, Macchina/Attrezzo, Ore)
- [ ] Aggiungere visualizzazione zone tracciate (Maps)
- [ ] Aggiungere link "Vedi Dettagli Lavoro"
- [ ] Aggiornare sezione "Dati Vendemmia" (editabile)

### Fase 5: Filtro Dropdown Tipi Lavoro
- [ ] Implementare filtro dinamico: quando terreno=VITE e categoria=RACCOLTA
- [ ] Mostrare solo "Vendemmia Manuale" e "Vendemmia Meccanica"
- [ ] Nascondere tipi raccolta di altre colture

### Fase 6: Integrazione Spese
- [ ] Aggiornare `lavori-vigneto-service.js` per riconoscere lavori "Vendemmia"
- [ ] Classificare come voce "Vendemmia" nelle spese
- [ ] Aggregare sotto MANODOPERA o MACCHINE in base al tipo
- [ ] Test calcolo spese vendemmia

### Fase 7: Gestione Modifiche/Eliminazioni
- [ ] Implementare aggiornamento automatico vendemmia quando si modifica lavoro
- [ ] Implementare eliminazione vendemmia quando si cambia tipo lavoro
- [ ] Implementare scollegamento vendemmia quando si cambia terreno
- [ ] Implementare eliminazione vendemmia quando si elimina lavoro
- [ ] Aggiungere avvisi all'utente per operazioni distruttive

### Fase 8: Validazione e Stato
- [ ] Implementare validazione stato vendemmia (completa/incompleta)
- [ ] Implementare badge nell'elenco
- [ ] Implementare alert quando si apre modulo vigneto con vendemmie incomplete
- [ ] Implementare esclusione dai report produzione per vendemmie incomplete

### Fase 9: Test e Validazione
- [ ] Test creazione vendemmia automatica da lavoro
- [ ] Test precompilazione dati dal lavoro
- [ ] Test completamento dati vendemmia
- [ ] Test modifiche/eliminazioni lavoro
- [ ] Test integrazione spese
- [ ] Test filtri e UI
- [ ] Test con/senza moduli avanzati (Manodopera, Macchine)

---

## 📚 Documentazione Aggiornata

### Documenti Modificati
1. **PLAN_MODULO_VIGNETO_DETTAGLIATO.md**
   - Aggiunta sezione completa "🔄 Integrazione Vendemmia-Lavori: Rilevamento Automatico"
   - Dettagli tecnici, flusso operativo, struttura dati, UI, implementazione

2. **PLAN_MODULI_COLTURA_SPECIALIZZATI.md**
   - Aggiunta sezione "🔄 Integrazione Vendemmia-Lavori: Rilevamento Automatico"
   - Riepilogo principi architetturali e vantaggi
   - Aggiornata sezione "In Pianificazione" con checklist

3. **RIEPILOGO_LAVORI_2026-01-16.md** (questo documento)
   - Riepilogo completo decisioni architetturali
   - Checklist implementazione dettagliata

---

## ✅ Risultati

### Decisioni Confermate
- ✅ Rilevamento automatico vendemmia da lavori
- ✅ Tipi lavoro specifici "Vendemmia Manuale" e "Vendemmia Meccanica"
- ✅ Filtro dropdown tipi lavoro (solo vendemmia quando terreno=VITE)
- ✅ Collegamento bidirezionale lavoro ↔ vendemmia
- ✅ Dati operativi nel lavoro, dati produzione nella vendemmia
- ✅ Tabelle operai/macchine: consultazione se precompilate, editabili se manuali
- ✅ Integrazione spese: voce "Vendemmia" sotto MANODOPERA o MACCHINE
- ✅ Gestione modifiche/eliminazioni lavoro
- ✅ Validazione stato vendemmia (completa/incompleta)
- ✅ UI completa con badge, link, filtri

### Prossimi Passi
1. Implementare creazione tipi lavoro "Vendemmia Manuale" e "Vendemmia Meccanica"
2. Implementare hook creazione vendemmia automatica
3. Aggiornare modello Vendemmia con campo `lavoroId`
4. Implementare UI elenco vendemmie con badge e link
5. Implementare modal vendemmia con sezione dati lavoro
6. Implementare filtro dropdown tipi lavoro
7. Aggiornare integrazione spese
8. Test completo sistema

---

**Data**: 2026-01-16  
**Stato**: 📝 PIANIFICAZIONE COMPLETATA - Pronto per implementazione  
**Prossimo Step**: Implementazione creazione tipi lavoro e hook rilevamento automatico
