# Context Builder – Specifiche di Sviluppo

**Data**: 2026-03-02  
**Obiettivo**: Documento dettagliato per implementare il Context Builder lato Cloud (Opzione B), in modo che un altro agente o sviluppatore possa continuare senza perdere la rotta.

**Riferimenti**: `tony/MASTER_PLAN.md` §5, `ANALISI_SUBAGENT_MASTER_PLAN.md`, `inventario-app-form-tabelle-sezioni-grafici.md`

---

## 1. Obiettivo e motivazione

### 1.1 Problema attuale
Tony riceve il contesto solo da ciò che il client ha caricato sulla pagina corrente. Se l’utente è su Dashboard e chiede "Quanto manca alla scadenza della revisione del trattore?", Tony non ha i dati perché la Dashboard non li carica.

### 1.2 Soluzione
Un **Context Builder** nella Cloud Function `tonyAsk` che, prima di ogni chiamata a Gemini, recupera da Firestore i dati essenziali dell’azienda e li aggiunge al contesto. Tony avrà sempre accesso a memoria aziendale aggiornata, indipendentemente dalla pagina.

### 1.3 Benefici
- Entry da ovunque: "ho trinciato 6 ore nel Sangiovese" da Dashboard funziona
- Risposte a domande su scadenze, prodotti, mezzi, terreni da qualsiasi pagina
- Migliora il flusso cross-page già implementato (tony_pending_intent, APRI_PAGINA)
- Nessuna modifica al client: il contesto arriva arricchito dal server

---

## 2. Architettura

### 2.1 Posizione
Il Context Builder vive **dentro** la Cloud Function `tonyAsk` in `functions/index.js`. Non è un servizio separato.

### 2.2 Flusso
```
1. Client invia: { message, context, history }
2. tonyAsk riceve request
3. [NUOVO] buildContextAzienda(tenantId) → fetch Firestore in parallelo
4. [NUOVO] ctx.azienda = risultato
5. ctx finale = merge(ctx client, ctx.azienda)
6. Sostituisci CONTESTO_PLACEHOLDER con ctx finale
7. Chiama Gemini
8. Restituisci risposta
```

### 2.3 Gerarchia contesto (dopo implementazione)
- **ctx.azienda** (dati da Firestore): sempre presente, fornito dal Context Builder
- **ctx.attivita** (estensione 2026-03-02): se azienda.terreni è presente, la CF aggiunge `attivita.terreni` (con coltura_categoria) e `attivita.colture_con_filari = ["Vite","Frutteto","Olivo"]` per le regole sottocategoria (Erpicatura/Trinciatura su frutteti → "Tra le File", mai "Generale")
- **ctx.page** (da client): pagePath, currentTableData, availableRoutes
- **ctx.form** (da client): stato form se modal aperto
- **ctx.dashboard** (da client): moduli_attivi, info_azienda
- Il contesto client viene **sovrascritto** da ctx.azienda solo per le chiavi in azienda; il resto resta invariato.

---

## 3. Tenant ID – requisito critico

### 3.1 Fonte
Il Context Builder deve conoscere il `tenantId` per costruire i path Firestore `tenants/{tenantId}/...`.

**Opzione A (preferita)**: Il client passa `tenantId` nel contesto. Verificare che `Tony.context` includa `tenantId` o `dashboard.tenantId` prima di ogni `ask()`. Se non presente, aggiungere in `main.js` o `tony-service.js`:
```javascript
// Prima di ogni ask(), assicurarsi che context includa tenantId
var tenantId = window.getCurrentTenantId && window.getCurrentTenantId();
if (tenantId && window.Tony && window.Tony.setContext) {
  window.Tony.setContext('dashboard', Object.assign({}, window.Tony.context?.dashboard || {}, { tenantId }));
}
```

**Opzione B**: La Cloud Function deriva il tenantId da `request.auth.uid` interrogando la collection `users/{uid}` e leggendo `tenantId` o `tenantMemberships`. Più complesso e richiede logica di fallback multi-tenant.

**Raccomandazione**: Implementare Opzione A. Documentare che il client deve passare `context.dashboard.tenantId` se disponibile. Se `tenantId` è assente in `ctx`, il Context Builder non esegue fetch e `ctx.azienda` resta vuoto (o con messaggio di fallback).

---

## 4. Collection Firestore da caricare

### 4.1 Path base
Tutte le collection sono sotto `tenants/{tenantId}/<collectionName>`.

### 4.2 Scope iniziale (Fase 1)

| Collection | Path | Campi da estrarre | Limite | Uso |
|------------|------|-------------------|--------|-----|
| terreni | terreni | id, nome, podere, coltura, superficie, tipoPossesso, dataScadenzaAffitto | 200 | Solo aziendali (clienteId vuoto). Lookup, form terreno, compilazione attività |
| terreniClienti | terreni | id, nome, podere, coltura, clienteId | 200 | Terreni clienti (conto terzi). Filtro: clienteId non vuoto |
| clienti | clienti | id, ragioneSociale | 100 | Per "quali terreni ha il cliente X?" – match ragioneSociale → id → filtra terreniClienti |
| poderi | poderi | id, nome | 100 | Form terreno |
| colture | colture | id, nome, categoriaId | 100 | Form terreno, attività |
| categorie | categorie | id, nome, codice, applicabileA | 50 | Tipi lavoro, colture |
| tipiLavoro | tipiLavoro | id, nome, categoriaId, sottocategoriaId | 150 | Form attività, compilazione |
| macchine | macchine | id, nome, tipoMacchina | 100 | Form attività, guasti, mezzi |
| prodotti | prodotti | id, nome, unitaMisura, sogliaMinima | 200 | Magazzino, sotto scorta |
| guasti | guasti | id, macchina, gravita, stato, dettagli | 50 (solo aperti) | Summary alert |
| scadenze | mezzi con scadenze | - | - | Vedi §4.4 |

### 4.3 Formato output per lookup (leggero)
Per ogni collection, estrarre solo id + nome (o campi essenziali). Esempio:
```javascript
terreni: [{ id: "abc", nome: "Sangiovese" }, { id: "def", nome: "Kaki" }]
tipiLavoro: [{ id: "x", nome: "Trinciatura", categoriaId: "c1" }, ...]
```

### 4.4 Summary scadenze (da costruire)
Non esiste una collection "scadenze" dedicata. Le scadenze derivano da:
- **mezzi/macchine**: campi revisione, assicurazione, bollo (se presenti)
- **terreni**: dataScadenzaAffitto per tipoPossesso=affitto

Il Context Builder può produrre un blocco testuale:
```javascript
summaryScadenze: "2 affitti in scadenza (Sangiovese 2026-04-15, Kaki 2026-05-01). 1 revisione in scadenza (Trattore Fendt 15/03)."
```

### 4.5 Summary sotto scorta (opzionale Fase 1)
Per prodotti con `sogliaMinima` e giacenza disponibile: confrontare e produrre:
```javascript
summarySottoScorta: "3 prodotti sotto scorta: Concime NPK, Diserbante, Olio motore."
```

---

## 5. Implementazione tecnica – Cloud Function

### 5.1 Dipendenze
- `firebase-admin` è già in `functions/package.json`. Usare `admin.firestore()` per le operazioni Firestore.
- Inizializzare Admin (se non già fatto): `const admin = require('firebase-admin'); if (!admin.apps.length) admin.initializeApp();`

### 5.2 Funzione buildContextAzienda

**Signature**:
```javascript
async function buildContextAzienda(tenantId) { ... }
```

**Comportamento**:
- Se `tenantId` è null/undefined/stringa vuota → ritorna `{}`.
- Esegue fetch in parallelo con `Promise.all`:

```javascript
const [terreni, poderi, colture, categorie, tipiLavoro, macchine, prodotti, guastiAperti] = await Promise.all([
  getCollectionLight(db, tenantId, 'terreni', ['id', 'nome', 'podere', 'coltura', 'superficie', 'tipoPossesso', 'dataScadenzaAffitto'], 200),
  getCollectionLight(db, tenantId, 'poderi', ['id', 'nome'], 100),
  getCollectionLight(db, tenantId, 'colture', ['id', 'nome', 'categoriaId'], 100),
  getCollectionLight(db, tenantId, 'categorie', ['id', 'nome', 'codice', 'applicabileA'], 50),
  getCollectionLight(db, tenantId, 'tipiLavoro', ['id', 'nome', 'categoriaId', 'sottocategoriaId'], 150),
  getCollectionLight(db, tenantId, 'macchine', ['id', 'nome', 'tipoMacchina'], 100),
  getCollectionLight(db, tenantId, 'prodotti', ['id', 'nome', 'unitaMisura', 'sogliaMinima'], 200),
  getGuastiAperti(db, tenantId, 50)
]);
```

**Helper getCollectionLight**:
```javascript
async function getCollectionLight(db, tenantId, collectionName, fields, limit = 100) {
  const ref = db.collection('tenants').doc(tenantId).collection(collectionName);
  const snap = await ref.limit(limit).get();
  return snap.docs.map(d => {
    const data = d.data();
    const out = { id: d.id };
    fields.forEach(f => { if (data[f] != null) out[f] = data[f]; });
    return out;
  });
}
```

**Output**:
```javascript
return {
  terreni,
  poderi,
  colture,
  categorie,
  tipiLavoro,
  macchine,
  trattori,   // [{id, nome}] - solo tipoMacchina=trattore, esclusi dismessi
  attrezzi,   // [{id, nome}] - solo tipoMacchina=attrezzo, esclusi dismessi
  prodotti,
  guastiAperti,
  summaryScadenze: "...",  // costruito da terreni + macchine
  summarySottoScorta: "..." // opzionale, da prodotti
};
```

### 5.2.1 Domanda di conferma trattore/attrezzo (form Attività)
- **Flusso**: Quando da altra pagina (es. Dashboard) l'utente dice "ho trinciato 6 ore nel Sangiovese", Tony apre SUBITO il modal con i campi inferibili. NON fa domande nel text della prima risposta. Le domande (trattore, attrezzo) si fanno SOLO quando il form è già aperto, così l'utente risponde e Tony compila con INJECT_FORM_DATA.
- **Trattore**: se `trattori.length === 1` (o 1 solo compatibile con attrezzo) → compila; se più → chiedi con ELENCO OBBLIGATORIO: "Quale trattore hai usato? Agrifull, Nuovo T5?" (trattori compatibili: filtra dove `trattore.cavalli >= attrezzo.cavalliMinimiRichiesti`).
- **Attrezzo**: filtra per tipo lavoro (Trinciatura→"trincia", Erpicatura→"erpice", ecc.). Se 1 solo → compila; se più → chiedi con elenco.

### 5.3 Integrazione in tonyAsk

**Punto di inserimento**: Dopo aver letto `ctx` da `request.data.context` e prima di sostituire `{CONTESTO_PLACEHOLDER}`.

**Pseudocodice**:
```javascript
const ctx = reqData.context != null ? reqData.context : {};
const tenantId = ctx.dashboard?.tenantId ?? ctx.tenantId ?? null;

let azienda = {};
try {
  azienda = await buildContextAzienda(tenantId);
} catch (err) {
  console.error('[Tony Context Builder] Errore fetch:', err);
  azienda = { _error: 'Dati aziendali temporaneamente non disponibili.' };
}

const ctxFinal = { ...ctx, azienda };
const contextJson = JSON.stringify(ctxFinal, null, 2);
```

Poi usare `ctxFinal` (o `contextJson`) per la sostituzione del placeholder.

### 5.4 Gestione errori
- Se `buildContextAzienda` lancia: catch, log, assegnare `azienda = { _error: '...' }`.

- Se una singola collection fallisce: considerare fetch parziali (es. `Promise.allSettled`) e includere solo i dati raccolti con successo.

- Timeout: se i fetch sono lenti, valutare un timeout globale (es. 3 s) per non bloccare la risposta.

---

## 6. Aggiornamento system instruction (opzionale)

Aggiungere una riga nella system instruction che indica a Tony dove trovare i dati:

```
I dati aziendali (terreni, macchine, prodotti, tipi lavoro, colture, poderi, scadenze, guasti) sono in [CONTESTO].azienda. Usali per rispondere e compilare form. Se azienda._error è presente, non hai dati aziendali aggiornati; informa l'utente e suggerisci di riprovare.
```

---

## 7. Client – passaggio tenantId

### 7.1 Verifica
Controllare se `Tony.context.dashboard` o `Tony.context` include già `tenantId` quando viene chiamato `ask()`.

### 7.2 Modifica necessaria
Se non presente, in `main.js` (dove viene invocato `setContext` prima di `ask`) o in `tony-service.js` nella funzione che prepara il contesto per la callable, aggiungere:

```javascript
// Leggi tenantId da tenant-service
const tenantId = getCurrentTenantId ? getCurrentTenantId() : (window.currentTenantId || null);
if (tenantId && context.dashboard) {
  context.dashboard.tenantId = tenantId;
} else if (tenantId) {
  context.tenantId = tenantId;
}
```

Nota: `getCurrentTenantId` è in `core/services/tenant-service.js`. Il widget Tony potrebbe non avere accesso diretto; in tal caso usare `window.currentTenantId` se popolato dalle pagine, oppure esporre un metodo `Tony.setTenantId(id)` chiamato dalle pagine al bootstrap.

---

## 8. Criteri di done

1. **buildContextAzienda** implementato e testato in isolamento (con tenantId mock).
2. **tonyAsk** integra il Context Builder e passa `ctx.azienda` a Gemini.
3. **Client** passa `tenantId` nel contesto (verificato con log).
4. **Test manuale**: da Dashboard, chiedere "Quali terreni ha l'azienda?" → Tony risponde con nomi reali.
5. **Test manuale**: da Dashboard, "ho trinciato 6 ore nel Sangiovese" → Tony emette OPEN_MODAL con campi corretti e il flusso cross-page completa.
6. **Fallback**: se tenantId manca o fetch fallisce, Tony risponde comunque (con contesto ridotto o messaggio di errore).

---

## 9. Estensioni future (Fase 2+)

- **Cache in memoria** (per tenant): se la stessa sessione fa più richieste in pochi minuti, evitare fetch ripetuti per lo stesso tenant (TTL 1–2 min).

- **Scadenze dettagliate**: query su mezzi con filtri per revisione/assicurazione in scadenza.

- **Sotto scorta**: query per prodotti con giacenza < sogliaMinima (richiede collection movimenti o giacenze).

- **Summary aggiuntivi**: ore del mese, lavori in corso, ecc.

---

## 10. Riferimenti file

| File | Ruolo |
|------|-------|
| `functions/index.js` | tonyAsk, integrazione Context Builder |
| `core/services/tony-service.js` | Invio contesto client a tonyAsk |
| `core/js/tony/main.js` | setContext prima di ask, invio message |
| `core/services/tenant-service.js` | getCurrentTenantId |
| `core/config/tony-form-mapping.js` | Mapping form (invariato) |
| `docs-sviluppo/INVENTARIO_APP_FORM_TABELLE_SEZIONI_GRAFICI.md` | Collection e strutture |
| `docs-sviluppo/tony/MASTER_PLAN.md` | Visione e architettura |

---

## 11. Riepilogo azioni prioritarie

| # | Azione | File | Priorità |
|---|--------|------|----------|
| 1 | Inizializzare firebase-admin e getFirestore in functions | functions/index.js | Alta |
| 2 | Implementare getCollectionLight e buildContextAzienda | functions/index.js | Alta |
| 3 | Integrare buildContextAzienda in tonyAsk prima di Gemini | functions/index.js | Alta |
| 4 | Garantire passaggio tenantId dal client | main.js / tony-service.js | Alta |
| 5 | Aggiungere gestione errori e fallback | functions/index.js | Alta |
| 6 | (Opzionale) summaryScadenze e summarySottoScorta | functions/index.js | Media |
| 7 | Test end-to-end da Dashboard | - | Alta |

---

*Documento creato per il proseguimento dello sviluppo da parte di un altro agente o sviluppatore.*
