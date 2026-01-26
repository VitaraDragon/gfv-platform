# 📋 Standard Error Handling - GFV Platform

**Data Creazione**: 2026-01-11  
**Versione**: 1.0  
**Stato**: Proposta Standard

---

## 🎯 Obiettivo

Definire uno standard coerente per la gestione degli errori in tutti i servizi dell'applicazione, garantendo:
- Comportamento prevedibile
- Messaggi di errore chiari
- Logging appropriato
- Facile debugging

---

## 📐 Standard Proposto

### 1. Pattern Generale

Tutti i servizi devono seguire questo pattern:

```javascript
export async function nomeFunzione(params) {
  try {
    // Validazione input
    if (!param) {
      throw new Error('Parametro obbligatorio mancante');
    }
    
    // Logica business
    const result = await operazione();
    
    return result;
  } catch (error) {
    // Log errore
    console.error('Errore in nomeFunzione:', error);
    
    // Rilancia errore con contesto
    throw new Error(`Errore nomeFunzione: ${error.message}`);
  }
}
```

---

### 2. Valori di Ritorno in Caso di Errore

#### Per Funzioni che Ritornano Array
**Standard**: Ritornare `[]` (array vuoto) in caso di errore

```javascript
export async function getAllItems() {
  try {
    const items = await fetchItems();
    return items;
  } catch (error) {
    console.error('Errore recupero items:', error);
    return []; // Array vuoto invece di lanciare errore
  }
}
```

**Eccezione**: Se l'errore è critico e l'operazione non può continuare, lanciare eccezione.

#### Per Funzioni che Ritornano Numeri
**Standard**: Ritornare `0` in caso di errore

```javascript
export async function getTotal() {
  try {
    const items = await fetchItems();
    return items.length;
  } catch (error) {
    console.error('Errore calcolo totale:', error);
    return 0; // Zero invece di lanciare errore
  }
}
```

#### Per Funzioni che Ritornano Oggetti
**Standard**: Ritornare `null` in caso di errore

```javascript
export async function getItem(id) {
  try {
    const item = await fetchItem(id);
    return item;
  } catch (error) {
    console.error('Errore recupero item:', error);
    return null; // Null invece di lanciare errore
  }
}
```

#### Per Funzioni CRUD (Create, Update, Delete)
**Standard**: Lanciare eccezione con messaggio chiaro

```javascript
export async function createItem(data) {
  try {
    // Validazione
    if (!data.name) {
      throw new Error('Nome obbligatorio');
    }
    
    // Creazione
    const id = await saveItem(data);
    return id;
  } catch (error) {
    console.error('Errore creazione item:', error);
    throw new Error(`Errore creazione item: ${error.message}`);
  }
}
```

---

### 3. Tipi di Errore

#### Errori di Validazione
**Pattern**: Lanciare immediatamente con messaggio chiaro

```javascript
if (!email || !email.includes('@')) {
  throw new Error('Email non valida');
}
```

#### Errori di Autenticazione
**Pattern**: Lanciare con codice errore Firebase preservato

```javascript
catch (error) {
  if (error.code === 'auth/user-not-found') {
    throw new Error('Utente non trovato');
  }
  throw error;
}
```

#### Errori di Database
**Pattern**: Wrappare con contesto ma preservare dettagli

```javascript
catch (error) {
  console.error('Errore database:', error);
  throw new Error(`Errore database: ${error.message}`);
}
```

---

### 4. Logging

#### Livelli di Log

- **`console.error()`**: Errori critici che impediscono l'operazione
- **`console.warn()`**: Avvisi che non bloccano l'operazione
- **`console.log()`**: Info di debug (rimossi in produzione)

#### Formato Log

```javascript
console.error('Errore in nomeFunzione:', {
  error: error.message,
  code: error.code,
  params: { /* parametri rilevanti */ }
});
```

---

### 5. Messaggi di Errore

#### Regole

1. **Chiaro e specifico**: "Email non valida" invece di "Errore"
2. **In italiano**: Tutti i messaggi visibili all'utente in italiano
3. **Con contesto**: "Errore creazione terreno: Nome obbligatorio"
4. **Senza dettagli tecnici**: Non esporre stack trace o dettagli interni

#### Esempi

✅ **Buono**:
```javascript
throw new Error('Email non valida');
throw new Error('Terreno non trovato');
throw new Error('Impossibile eliminare: terreno utilizzato in 5 attività');
```

❌ **Cattivo**:
```javascript
throw new Error('Error');
throw new Error('Failed');
throw new Error('Error: Cannot read property "name" of undefined');
```

---

### 6. Gestione Errori Multi-tenant

#### Verifica Tenant

```javascript
export async function getItems() {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    // ... resto del codice
  } catch (error) {
    console.error('Errore recupero items:', error);
    throw new Error(`Errore recupero items: ${error.message}`);
  }
}
```

---

## 📊 Mappatura Servizi Esistenti

### Servizi da Aggiornare

#### `statistiche-service.js`
- ✅ `getOrePerTipoLavoro()`: Ritorna `[]` - **OK**
- ✅ `getTotaleOre()`: Ritorna `0` - **OK**
- ✅ `getTotaleAttivita()`: Ritorna `0` - **OK**
- ✅ `getTotaleTerreni()`: Ritorna `0` - **OK**

**Stato**: ✅ Già conforme allo standard

#### `terreni-service.js`
- ✅ `getAllTerreni()`: Ritorna `[]` per errori non critici - **AGGIORNATO**
- ✅ `getTerreno()`: Ritorna `null` - **OK**
- ✅ `createTerreno()`: Lancia eccezione - **OK**
- ✅ `updateTerreno()`: Lancia eccezione - **OK**
- ✅ `deleteTerreno()`: Lancia eccezione - **OK**
- ✅ `getNumeroAttivitaTerreno()`: Ritorna `0` - **OK**

**Stato**: ✅ Conforme allo standard

#### `attivita-service.js`
- ✅ `getAllAttivita()`: Ritorna `[]` per errori non critici - **AGGIORNATO**
- ✅ `getAttivita()`: Ritorna `null` - **OK**
- ✅ `createAttivita()`: Lancia eccezione - **OK**

**Stato**: ✅ Conforme allo standard

#### `lavori-service.js`
- ✅ `getAllLavori()`: Ritorna `[]` per errori non critici - **AGGIORNATO**
- ✅ `getLavoro()`: Ritorna `null` - **OK**
- ✅ `getLavoriAttivi()`: Ritorna `[]` per errori non critici - **AGGIORNATO**
- ✅ `createLavoro()`: Lancia eccezione - **OK**
- ✅ `updateLavoro()`: Lancia eccezione - **OK**
- ✅ `deleteLavoro()`: Lancia eccezione - **OK**
- ✅ `getNumeroLavoriCaposquadra()`: Ritorna `0` - **OK**

**Stato**: ✅ Conforme allo standard

#### `squadre-service.js`
- ✅ `getAllSquadre()`: Ritorna `[]` per errori non critici - **AGGIORNATO**
- ✅ `getSquadra()`: Ritorna `null` - **OK**
- ✅ `getUtentiByRuolo()`: Ritorna `[]` per errori non critici - **AGGIORNATO**
- ✅ `createSquadra()`: Lancia eccezione - **OK**
- ✅ `updateSquadra()`: Lancia eccezione - **OK**
- ✅ `deleteSquadra()`: Lancia eccezione - **OK**

**Stato**: ✅ Conforme allo standard

#### `ore-service.js`
- ✅ `getOreLavoro()`: Ritorna `[]` per errori non critici - **AGGIORNATO**
- ✅ `getOreDaValidare()`: Ritorna `[]` per errori non critici - **AGGIORNATO**
- ✅ `getOreOperaio()`: Ritorna `[]` per errori non critici - **AGGIORNATO**
- ✅ `createOra()`: Lancia eccezione - **OK**
- ✅ `validaOra()`: Lancia eccezione - **OK**
- ✅ `rifiutaOra()`: Lancia eccezione - **OK**

**Stato**: ✅ Conforme allo standard

#### `categorie-service.js`
- ✅ `getAllCategorie()`: Ritorna `[]` per errori non critici - **AGGIORNATO**
- ✅ `getCategorieGerarchiche()`: Ritorna `[]` per errori non critici - **AGGIORNATO**
- ✅ `getCategoria()`: Ritorna `null` - **OK**

**Stato**: ✅ Conforme allo standard

#### `colture-service.js`
- ✅ `getAllColture()`: Ritorna `[]` per errori non critici - **AGGIORNATO**
- ✅ `getColturePerCategoria()`: Ritorna `{}` per errori non critici - **AGGIORNATO**
- ✅ `getColtura()`: Ritorna `null` - **OK**

**Stato**: ✅ Conforme allo standard

#### `tipi-lavoro-service.js`
- ✅ `getAllTipiLavoro()`: Ritorna `[]` per errori non critici - **AGGIORNATO**
- ✅ `getTipiLavoroGerarchici()`: Ritorna `{}` per errori non critici - **AGGIORNATO**
- ✅ `getTipoLavoro()`: Ritorna `null` - **OK**

**Stato**: ✅ Conforme allo standard

---

## 🔄 Piano Migrazione

### Fase 1: Documentazione ✅
- [x] Creare standard documentato
- [x] Analizzare servizi esistenti
- [x] Identificare inconsistenze

### Fase 2: Aggiornamento Servizi ✅
- [x] Verificare tutti i servizi
- [x] Aggiornare servizi non conformi
- [x] Standardizzare funzioni che ritornano array (ritornano `[]` per errori non critici)
- [x] Standardizzare funzioni che ritornano oggetti strutturati (ritornano `{}` per errori non critici)
- [ ] Testare aggiornamenti

### Fase 3: Validazione
- [ ] Test error handling
- [ ] Verifica messaggi utente
- [ ] Documentazione aggiornata

---

## ✅ Checklist Conformità

Per ogni servizio, verificare:

- [ ] Errori di validazione lanciano eccezioni con messaggi chiari
- [ ] Errori di database sono wrappati con contesto
- [ ] Funzioni che ritornano array ritornano `[]` in caso di errore
- [ ] Funzioni che ritornano numeri ritornano `0` in caso di errore
- [ ] Funzioni che ritornano oggetti ritornano `null` in caso di errore
- [ ] Funzioni CRUD lanciano eccezioni
- [ ] Logging appropriato con `console.error()`
- [ ] Messaggi di errore in italiano e chiari
- [ ] Verifica tenant prima di operazioni multi-tenant

---

## 📝 Note

- Questo standard si applica a tutti i servizi in `core/services/`
- I moduli (`modules/`) possono avere standard leggermente diversi se necessario
- Gli errori critici (autenticazione, permessi) devono sempre lanciare eccezioni
- Gli errori non critici (query vuote, dati mancanti) possono ritornare valori default

---

**Ultimo aggiornamento**: 2026-01-11
