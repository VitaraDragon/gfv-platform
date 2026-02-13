# Tony - Separazione Guida/Operativo e Gating Freemium

Documento di riferimento per implementare la separazione tra:
- `Tony Guida` (presente nei piani a pagamento base app)
- `Tony Operativo` (modulo aggiuntivo a pagamento)
- `Freemium` (Tony completamente assente)

---

## 1. Visione Generale

### Freemium (free)
- **Tony**: non disponibile (ne' Guida ne' Operativo)
- **Widget**: non visibile
- **Backend Tony**: non invocabile per tenant free

### Tony Guida (piani paid base app)
- **Funzionalità**: Risponde solo a domande sulla guida dell'app
- **Capacità**: Spiegazioni testuali su come funziona l'app, dove trovare le cose, come fare operazioni
- **Limitazioni**: Nessuna azione operativa (non apre pagine, non compila form, non esegue azioni)
- **Widget**: visibile nei tenant paid

### Tony Operativo (modulo attivabile)
- **Funzionalità**: Tutte le capacità di Tony Guida + azioni operative
- **Capacità**: 
  - Aprire pagine (`APRI_PAGINA`)
  - Compilare form (`OPEN_MODAL`, `SET_FIELD`, `CLICK_BUTTON`)
  - Mostrare grafici (`MOSTRA_GRAFICO`)
  - Estrapolare dati dai moduli attivi
  - Eseguire azioni operative (segnare ore, aggiornare magazzino, ecc.)
- **Attivazione**: Controllo `moduli_attivi.includes('tony')` nel tenant
- **Widget**: Stesso widget, ma con funzionalità avanzate abilitate

---

## 2. Architettura Proposta

### 2.1 Struttura Modulo
- **Percorso**: `modules/tony/` (come vigneto/frutteto)
- **File principali**:
  - `modules/tony/views/tony-dashboard-standalone.html` (opzionale, per gestione avanzata)
  - `modules/tony/services/tony-advanced-service.js` (logica avanzata, se necessario)
- **Service esistente**: `core/services/tony-service.js` rimane, ma con controlli condizionali
- **Widget esistente**: `core/js/tony-widget-standalone.js` rimane, ma con controlli condizionali

### 2.2 Controllo Attivazione
- **Fonte verità**: `moduli_attivi` nel tenant (come per altri moduli)
- **Check**: `moduli_attivi.includes('tony')` prima di eseguire azioni avanzate
- **Fallback**: Se modulo non attivo, Tony risponde solo con spiegazioni testuali

---

## 3. Modifiche Necessarie

### 3.1 Database / Tenant
- **Aggiungere**: `'tony'` alla lista moduli disponibili (come `'vigneto'`, `'frutteto'`, ecc.)
- **Gestione**: Attivazione/disattivazione tramite dashboard amministrazione (come altri moduli)
- **Abbonamento**: Integrare nel sistema di pagamento Piano Base (€5/mese)

### 3.2 System Instruction (functions/index.js e tony-service.js)

#### Tony Guida (tenant paid, modulo operativo non attivo)
- Rimuovere tutte le istruzioni su azioni operative
- Mantenere solo:
  - Ruolo: Capocantiere che spiega l'app
  - Regole: Rispondere solo con spiegazioni testuali
  - Guida app: Disponibile per rispondere a domande
  - **VIETATO**: Emettere `APRI_PAGINA`, `OPEN_MODAL`, `SET_FIELD`, `CLICK_BUTTON`, `MOSTRA_GRAFICO`
  - Messaggio quando necessario: "Per aprire pagine e compilare form, attiva il modulo Tony Avanzato."

#### Tony Avanzato (modulo attivo)
- System instruction completa come oggi
- Tutte le azioni operative disponibili
- Controllo contesto moduli attivi per azioni specifiche

**Implementazione**: System instruction condizionale basata su `context.moduli_attivi.includes('tony')`

### 3.3 Tony Service (core/services/tony-service.js)

#### Metodo `ask()` / `askStream()`
- **Controllo iniziale**: Verificare se `context.moduli_attivi.includes('tony')`
- **Se non attivo**: 
  - Passare system instruction "base" (solo spiegazioni)
  - Bloccare parsing azioni (`_parseAndTriggerActions` non deve emettere azioni)
- **Se attivo**: 
  - Comportamento attuale (tutte le funzionalità)

#### Metodo `_parseAndTriggerActions()`
- **Controllo**: Se modulo non attivo, non chiamare `triggerAction()`
- **Log**: Avvisare se viene tentata un'azione senza modulo attivo

#### Metodo `setContext()`
- **Sempre disponibile**: Contesto guida app, dashboard base
- **Condizionale**: Contesto moduli avanzati solo se modulo attivo

### 3.4 Widget (core/js/tony-widget-standalone.js)

#### Inizializzazione
- **Controllo modulo**: Verificare `moduli_attivi` dal contesto dashboard
- **Se non attivo**: 
  - Widget visibile ma con messaggio iniziale: "Tony Guida: posso rispondere a domande sull'app. Attiva il modulo Tony Avanzato per aprire pagine e compilare form."
  - Disabilitare funzionalità avanzate (se presenti nell'UI)

#### Gestione `onAction`
- **Controllo**: Prima di eseguire azioni, verificare se modulo attivo
- **Se non attivo**: 
  - Mostrare messaggio: "Questa funzionalità richiede il modulo Tony Avanzato."
  - Non eseguire azione
- **Se attivo**: Eseguire azione normalmente

#### Parsing risposte
- **Controllo**: Se modulo non attivo e risposta contiene comando JSON, ignorare comando
- **Messaggio utente**: "Per eseguire questa azione, attiva il modulo Tony Avanzato."

### 3.5 Dashboard (core/dashboard-standalone.html)

#### Card Modulo Tony
- **Aggiungere**: Card "Tony Avanzato" nella sezione moduli (come Vigneto/Frutteto)
- **Stato**: Mostrare se attivo/disattivo
- **Attivazione**: Pulsante per attivare/disattivare (se Piano Base attivo)
- **Messaggio**: Spiegare differenza tra Base e Avanzato

#### Contesto Dashboard
- **Sempre**: Passare `moduli_attivi` a Tony (include o meno `'tony'`)
- **Tony Guida**: Funziona comunque con contesto base

### 3.6 Cloud Functions (functions/index.js)

#### tonyAsk
- **Controllo modulo**: Verificare `context.moduli_attivi.includes('tony')`
- **System instruction condizionale**: 
  - Se non attivo: Versione "base" (solo spiegazioni)
  - Se attivo: Versione completa (tutte le azioni)
- **Parsing risposta**: Se modulo non attivo, rimuovere eventuali comandi JSON dalla risposta

#### getTonyAudio
- **Sempre disponibile**: TTS funziona anche per Tony Base
- **Nessuna modifica necessaria**

---

## 4. Flusso Operativo

### 4.1 Utente free (freemium)
1. Apre app -> Tony non e' presente
2. Nessuna chat, nessuna chiamata endpoint Tony

### 4.2 Utente paid senza modulo operativo
1. Apre app → Widget Tony visibile
2. Chiede: "Come si crea un terreno?"
3. Tony risponde: Spiegazione testuale completa
4. Chiede: "Apri la pagina terreni"
5. Tony risponde: "Per aprire pagine automaticamente, attiva il modulo Tony Avanzato. Posso spiegarti come arrivare manualmente: vai in Dashboard → Terreni."
6. Utente può attivare modulo dalla dashboard

### 4.3 Utente paid con modulo operativo
1. Apre app → Widget Tony visibile
2. Chiede: "Come si crea un terreno?"
3. Tony risponde: Spiegazione + propone apertura pagina
4. Chiede: "Apri la pagina terreni"
5. Tony risponde: "Apro la pagina Terreni" + emette `APRI_PAGINA` + dialog conferma
6. Utente conferma → Navigazione eseguita

---

## 5. Checklist Implementazione

### Fase 1: Database e Abbonamento
- [x] Aggiungere `'tony'` alla lista moduli disponibili ✅ (implementato in `core/config/subscription-plans.js`)
- [x] Creare card modulo Tony in dashboard amministrazione ✅ (gestito tramite `abbonamento-standalone.html` con sistema moduli esistente)
- [x] Implementare attivazione/disattivazione modulo ✅ (sistema moduli esistente)
- [x] Integrare nel sistema di pagamento Piano Base ✅ (modulo disponibile con prezzo €5/mese)

### Fase 2: System Instruction Condizionale
- [x] Creare `SYSTEM_INSTRUCTION_BASE` (solo spiegazioni) ✅ (implementato in `functions/index.js`)
- [x] Creare `SYSTEM_INSTRUCTION_ADVANCED` (completa) ✅ (implementato in `functions/index.js`)
- [x] Modificare `functions/index.js` per usare istruzione condizionale ✅ (controllo `isTonyAdvancedActive` basato su `moduli_attivi.includes('tony')`)
- [x] Modificare `tony-service.js` per usare istruzione condizionale ✅ (helper `initContextWithModules` implementato)

### Fase 3: Controlli Service
- [x] Aggiungere controllo `moduli_attivi.includes('tony')` in `ask()` ✅ (implementato in Cloud Function `tonyAsk`)
- [x] Modificare `_parseAndTriggerActions()` per bloccare azioni se non attivo ✅ (server-side: rimozione comandi JSON se modulo non attivo)
- [x] Aggiungere log/messaggi quando azioni sono bloccate ✅ (implementato)

### Fase 4: Controlli Widget
- [x] Verificare `moduli_attivi` all'inizializzazione widget ✅ (implementato in `tony-widget-standalone.js` con `checkTonyModuleStatus()`)
- [x] Modificare `onAction` callback per controllare modulo attivo ✅ (controllo `isTonyAdvancedActive` prima di eseguire azioni)
- [x] Aggiungere messaggi informativi quando funzionalità avanzate non disponibili ✅ (messaggi differenziati per Base/Avanzato)

### Fase 5: Dashboard
- [x] Aggiungere card "Tony Avanzato" nella sezione moduli ✅ (gestito tramite sistema moduli esistente in `abbonamento-standalone.html`)
- [x] Implementare UI attivazione/disattivazione ✅ (sistema moduli esistente)
- [x] Aggiornare contesto dashboard per includere stato modulo Tony ✅ (implementato in tutte le pagine standalone con `initContextWithModules`)

### Fase 6: Testing
- [x] Test Tony Guida: solo spiegazioni, nessuna azione ✅ (testato e funzionante)
- [x] Test attivazione modulo: funzionalità avanzate disponibili ✅ (testato e funzionante)
- [x] Test disattivazione: ritorno a modalità guida ✅ (testato e funzionante)
- [x] Test integrazione con altri moduli (vigneto, frutteto, ecc.) ✅ (testato su pagine terreni, statistiche, dashboard frutteto)

---

## 6. Messaggi Utente

### Quando tenant e' free
- Nessun messaggio Tony: widget assente.

### Quando modulo operativo non attivo (tenant paid)
- **Messaggio iniziale widget**: "Ciao! Sono Tony, la guida dell'app. Posso rispondere a domande su come funziona l'app e dove trovare le cose." (Nessun upsell: non invadente)
- **Tentativo azione** (utente chiede di aprire/compilare): "Questa funzionalità richiede il modulo Tony Avanzato. Attivalo dalla Dashboard per aprire pagine, compilare form e molto altro."
- **Risposta Gemini a richiesta azione**: "Per automatizzare questa operazione, attiva il modulo Tony Avanzato dalla pagina Abbonamento. Nel frattempo, posso spiegarti come farlo manualmente: ..."
- **Risposta Gemini a richiesta spiegazione**: Solo spiegazione, NESSUN richiamo al modulo (non invasivo)
- **Chiusura interazione** (ciao, grazie, a dopo): Opzionale P.S. soft "Se vorrai automatizzare operazioni in futuro, attiva il modulo Tony Avanzato dalla pagina Abbonamento."

### Quando Modulo Attivo
- **Messaggio iniziale widget**: "Ciao! Sono Tony, il tuo assistente. Posso rispondere a domande, aprire pagine, compilare form e molto altro."
- **Comportamento**: Normale, tutte le funzionalità disponibili

---

## 7. Considerazioni Tecniche

### 7.1 Performance
- **Nessun impatto**: Controllo modulo è semplice `includes()`
- **System instruction**: Versione base più leggera (meno token)

### 7.2 Compatibilità
- **Retrocompatibilità**: Utenti paid esistenti con Tony attivo continuano a funzionare
- **Freemium**: Tony non disponibile per definizione

### 7.3 Sicurezza
- **Controllo lato server**: Cloud Function verifica modulo attivo
- **Controllo lato client**: Widget verifica prima di eseguire azioni
- **Doppio controllo**: Previene bypass client-side

---

## 8. Vantaggi Implementazione

### Per Utenti
- **Paid base**: hanno Tony Guida utile senza operativita'
- **Scelta**: decidono se attivare anche Tony Operativo
- **Freemium**: esperienza core semplificata, senza Tony

### Per Business
- **Monetizzazione**: Modulo a pagamento genera revenue
- **Upsell**: da Tony Guida (paid base) a Tony Operativo
- **Flessibilità**: tenant paid possono attivare/disattivare modulo operativo

### Per Sviluppo
- **Architettura modulare**: Coerente con resto dell'app
- **Manutenibilità**: Separazione chiara base/avanzato
- **Estendibilità**: Facile aggiungere nuove funzionalità avanzate

---

## 9. Note Implementative

### 9.1 Contesto Moduli
- **Sempre disponibile**: `context.moduli_attivi` viene passato a Tony
- **Check**: `moduli_attivi.includes('tony')` determina comportamento
- **Fallback**: Se `moduli_attivi` non presente o vuoto, assumere modulo non attivo

### 9.2 Parsing Risposte
- **Tony Guida**: Se Gemini emette comando JSON per errore, ignorarlo silenziosamente
- **Tony Operativo**: Parsing normale, esecuzione azioni

### 9.3 Widget Globale
- **Tenant free**: widget non caricato/visibile
- **Tenant paid**: widget caricato
- **Comportamento condizionale**: funzionalita' avanzate abilitate solo se modulo operativo attivo

---

## 10. Stato Implementazione (aggiornato 2026-02-10)

**NOTA IMPORTANTE**: la separazione Guida/Operativo e' implementata lato tecnico.  
Resta vincolante l'allineamento prodotto: in `free` Tony deve essere totalmente escluso (UI + service + backend), non solo limitato.

### Componenti Implementati

1. **Database e Configurazione**:
   - ✅ Modulo `'tony'` aggiunto a `AVAILABLE_MODULES` (`core/config/subscription-plans.js`)
   - ✅ Prezzo: €5/mese, disponibile per Piano Base
   - ✅ Attivazione/disattivazione tramite pagina Abbonamento

2. **Backend (Cloud Functions)**:
   - ✅ `SYSTEM_INSTRUCTION_BASE` implementata (solo spiegazioni, no azioni)
   - ✅ `SYSTEM_INSTRUCTION_ADVANCED` implementata (completa con azioni operative)
   - ✅ Logica condizionale in `tonyAsk` basata su `moduli_attivi.includes('tony')`
   - ✅ Rimozione server-side di comandi JSON se modulo non attivo

3. **Client (Service e Widget)**:
   - ✅ Helper `Tony.initContextWithModules()` per inizializzazione context
   - ✅ Controllo `isTonyAdvancedActive` nel widget
   - ✅ Blocco client-side di azioni se modulo non attivo
   - ✅ Messaggi differenziati per Base/Avanzato
   - ✅ Evento `tony-module-updated` per sincronizzazione widget

4. **Inizializzazione Context**:
   - ✅ Implementata in tutte le pagine standalone (28+ pagine)
   - ✅ Pattern robusto con retry e fallback
   - ✅ Emissione eventi per sincronizzazione widget

### Funzionalità Verificate

- ✅ **Tony Guida**: Risponde solo con spiegazioni, nessuna azione operativa
- ✅ **Tony Operativo**: Tutte le funzionalità operative disponibili (APRI_PAGINA, OPEN_MODAL, ecc.)
- ✅ **Attivazione/Disattivazione**: Funziona correttamente dalla pagina Abbonamento
- ✅ **Persistenza**: Lo stato del modulo viene mantenuto correttamente tra le pagine
- ✅ **Sicurezza**: Doppio controllo server-side e client-side

---

## 11. Problemi Risolti e Correzioni (2026-02-08)

**Contesto**: Le seguenti correzioni sono state necessarie per garantire il corretto funzionamento della separazione Tony Guida/Operativo, in particolare per il sistema di rilevamento dei moduli attivi (`moduli_attivi.includes('tony')`) che determina se Tony opera in modalità Guida o Operativo.

### 10.1 Errori di Sintassi con `getDb` Duplicato

**Problema**: Errori `SyntaxError: Identifier 'getDb' has already been declared` in alcune pagine standalone.

**Causa**: Dichiarazioni duplicate di `getDb` nello stesso scope di funzione, causate da import multipli di `firebase-service.js` con destrutturazione diretta.

**File interessati**:
- `modules/vigneto/views/potatura-standalone.html` (righe 526-529 e 667-668)
- `modules/frutteto/views/potatura-standalone.html` (preventivo, righe 509-510)

**Soluzione applicata**:
1. **Vigneto**: Rimosse dichiarazioni duplicate, mantenuta solo quella completa con tutte le funzioni necessarie.
2. **Frutteto**: Modificato l'import per usare import del modulo completo e poi destrutturazione, evitando conflitti:
   ```javascript
   // Prima (poteva causare conflitti):
   const { getDb, ... } = await import(...);
   
   // Dopo (più sicuro):
   const firebaseService = await import(...);
   const { getDb, ... } = firebaseService;
   ```

**Risultato**: Nessun errore di sintassi, tutte le pagine si caricano correttamente.

### 10.2 Inizializzazione Tony nella Dashboard Frutteto

**Problema**: Il widget Tony non rilevava correttamente i moduli attivi nella dashboard frutteto, mostrando `moduli_attivi: []` anche quando i moduli erano presenti. Questo impediva il corretto funzionamento della separazione Guida/Operativo, poiché Tony non poteva determinare se il modulo `'tony'` era attivo o meno.

**Causa**: Problema di timing - il widget si inizializzava prima che il context venisse impostato, e l'evento `tony-module-updated` non veniva emesso correttamente.

**File interessato**: `modules/frutteto/views/frutteto-dashboard-standalone.html`

**Soluzione applicata**:
1. **Aumentati i tentativi**: Da 10 a 20 per dare più tempo a Tony di caricarsi.
2. **Aggiunto `await`**: Alla chiamata di `initContextWithModules` per garantire che l'inizializzazione sia completata.
3. **Emissione evento migliorata**: 
   - Creata funzione centralizzata `emitModuleUpdate()` per emettere l'evento `tony-module-updated`.
   - L'evento viene emesso sia quando Tony è disponibile che come fallback se non lo è dopo 20 tentativi.
   - Aggiunto ultimo tentativo dopo 2 secondi nel caso Tony si carichi dopo.
4. **Fallback robusto**: Anche se Tony non è disponibile dopo 20 tentativi, l'evento viene emesso comunque così il widget può recuperare i moduli quando sarà pronto.

**Codice implementato**:
```javascript
// Funzione per emettere evento e inizializzare context
var emitModuleUpdate = function() {
    window.dispatchEvent(new CustomEvent('tony-module-updated', { detail: { modules: modules } }));
};

// Inizializza context Tony con i moduli attivi usando helper
if (window.Tony && window.Tony.initContextWithModules) {
    await window.Tony.initContextWithModules(modules);
    emitModuleUpdate();
} else {
    // Fallback con retry migliorato (20 tentativi)
    var initTonyContext = function(retries) {
        retries = retries || 0;
        if (window.Tony && typeof window.Tony.setContext === 'function') {
            window.Tony.setContext('dashboard', {
                info_azienda: { moduli_attivi: modules },
                moduli_attivi: modules
            });
            emitModuleUpdate();
        } else if (retries < 20) {
            setTimeout(function() { initTonyContext(retries + 1); }, 500);
        } else {
            // Emetti evento anche se Tony non è disponibile
            emitModuleUpdate();
            // Ultimo tentativo dopo 2 secondi
            setTimeout(function() {
                if (window.Tony && typeof window.Tony.setContext === 'function') {
                    window.Tony.setContext('dashboard', {
                        info_azienda: { moduli_attivi: modules },
                        moduli_attivi: modules
                    });
                    emitModuleUpdate();
                }
            }, 2000);
        }
    };
    initTonyContext();
}
```

**Risultato**: Il widget riceve correttamente l'evento e aggiorna lo stato dei moduli, anche in caso di timing sfavorevole.

### 10.3 Best Practices per Inizializzazione Context

**Raccomandazioni**:
1. **Usare sempre `await`** quando si chiama `initContextWithModules` (se disponibile).
2. **Emettere sempre l'evento** `tony-module-updated` dopo aver impostato il context, sia nel caso principale che nel fallback.
3. **Aumentare i tentativi** a 20 invece di 10 per pagine che potrebbero avere timing più lento.
4. **Aggiungere fallback finale** che emette l'evento anche se Tony non è disponibile, così il widget può recuperare i moduli quando sarà pronto.

**Pattern consigliato**:
```javascript
const modules = Array.isArray(tenant?.modules) ? tenant.modules : [];

var emitModuleUpdate = function() {
    window.dispatchEvent(new CustomEvent('tony-module-updated', { detail: { modules: modules } }));
};

if (window.Tony && window.Tony.initContextWithModules) {
    await window.Tony.initContextWithModules(modules);
    emitModuleUpdate();
} else {
    // Fallback con retry (20 tentativi) + emissione evento finale
    // ... (vedi codice sopra)
}
```

---

## 12. Riferimenti

- **Moduli esistenti**: Vedere struttura `modules/vigneto/`, `modules/frutteto/`
- **Sistema abbonamento**: Vedere `core/admin/abbonamento-standalone.html`
- **Attivazione moduli**: Vedere dashboard amministrazione
- **Tony attuale**: `docs-sviluppo/GUIDA_SVILUPPO_TONY.md`
- **Funzionalità tecniche**: `docs-sviluppo/TONY_FUNZIONI_E_SOLUZIONI_TECNICHE.md`

---

*Documento creato per implementare separazione Tony Guida/Operativo con esclusione completa in freemium. Aggiornato il 2026-02-10 con problemi risolti e best practices.*
