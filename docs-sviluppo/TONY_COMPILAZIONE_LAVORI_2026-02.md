# Tony – Compilazione form Lavori (febbraio 2026)

Documentazione delle modifiche implementate per far compilare correttamente il form **Crea Nuovo Lavoro** tramite Tony, con sottocategoria, tipo lavoro e macchine coerenti al contesto terreno.

---

## 1. Obiettivo

Far sì che Tony compili il form Lavori **al primo tentativo** con:
- **Sottocategoria corretta**: "Tra le File" (non "Generale") per vigneti, frutteti, oliveti
- **Tipo lavoro specifico**: "Erpicatura Tra le File" (non "Trinciatura") quando l'utente dice "erpicatura"
- **Macchine**: inclusione automatica di trattore e attrezzo quando l'utente dice "completo di macchine"
- **Stato default**: "Assegnato" (non "da_pianificare") quando caposquadra/operaio è compilato
- **Messaggio finale**: richiesta conferma salvataggio ("Vuoi che salvi il lavoro?") invece di messaggio per Impianti

---

## 2. Problema iniziale

- Tony impostava sottocategoria **"Generale"** invece di **"Tra le File"** per lavori tipo erpicatura su terreno con filari (es. vigneto pinot)
- Tony confondeva **"erpicatura"** con **"trinciatura"** (operazioni diverse)
- Tony non aggiungeva macchine quando l'utente diceva "completo di macchine"
- Tony impostava stato "da_pianificare" anche con assegnazione compilata
- Messaggio finale scorretto: "Completa manualmente i dettagli tecnici (varietà, distanze)" usato per lavori normali (quella frase è solo per Impianto Nuovo Vigneto/Frutteto)

---

## 3. Modifiche implementate

### 3.1 `core/js/attivita-utils.js` – `mapColturaToCategoria`

- **Rimosse** le mappature per varietà di vite (Sangiovese, Pinot, Trebbiano, ecc.)
- **Ripristinato** il mapping solo con le colture dell'app: `nomeLower.includes('vite')` → Vite (Vite, Vite da Tavola, Vite da Vino)
- Le varietà non sono colture distinte; la categoria si deduce dalla coltura principale del terreno

### 3.2 `core/admin/gestione-lavori-standalone.html`

**Contesto Tony per form Lavori:**
- `coltura_categoria` per ogni terreno: da `terreno.colturaCategoria` se presente, altrimenti `mapColturaToCategoria(terreno.coltura)`
- `colture_con_filari: ['Vite', 'Frutteto', 'Olivo']` – terreni con queste colture hanno filari

**Parametro URL `openModal=crea`:**
- Supporto per aprire automaticamente il modal "Crea Nuovo Lavoro" all'avvio
- Esempio: `gestione-lavori-standalone.html?openModal=crea`

### 3.3 `functions/index.js` – `SYSTEM_INSTRUCTION_LAVORO_STRUCTURED`

**REGOLE SOTTOCATEGORIA:**
- Riconoscimento solo dal terreno selezionato (id, nome, coltura, coltura_categoria)
- Terreni con `coltura_categoria` in ["Vite","Frutteto","Olivo"] → sottocategoria SOLO "Tra le File" o "Sulla Fila", MAI "Generale"
- Se tipo generico (Erpicatura, Trinciatura, Fresatura) e terreno con filari → tipo SPECIFICO: "Erpicatura Tra le File", "Trinciatura tra le file", ecc.

**DISAMBIGUAZIONE TIPO LAVORO:**
- Erpicatura ≠ Trinciatura: operazioni DIVERSE
- Se utente dice "erpicatura" → usa SEMPRE "Erpicatura Tra le File" (o "Erpicatura Sulla Fila"), mai "Trinciatura"
- Se utente dice "trinciatura" → "Trinciatura tra le file" (o "Trinciatura" se terreno senza filari)

**REGOLE MACCHINE:**
- Se utente dice "completo di macchine", "con macchine", "trattore e attrezzo" → includi SUBITO lavoro-trattore e lavoro-attrezzo da trattoriList/attrezziList

**STATO DEFAULT:**
- `lavoro-stato`: default "assegnato" se caposquadra o operaio è compilato; "da_pianificare" solo se nessuna assegnazione

**MESSAGGIO QUANDO FORM COMPLETO:**
- Per lavori normali: "Ho compilato tutto. Vuoi che salvi il lavoro?" o "Posso creare il lavoro. Confermi?"
- Messaggio "Completa manualmente i dettagli tecnici (varietà, distanze)" SOLO per tipi Impianto Nuovo Vigneto/Frutteto

### 3.4 `core/config/tony-form-mapping.js`

- Descrizione `lavoro-stato`: "default assegnato se caposquadra/operaio compilato, altrimenti da_pianificare"

---

## 4. File modificati

| File | Modifiche |
|------|-----------|
| `core/js/attivita-utils.js` | mapColturaToCategoria: rimosse varietà, solo colture app |
| `core/admin/gestione-lavori-standalone.html` | coltura_categoria, colture_con_filari, openModal=crea |
| `functions/index.js` | SYSTEM_INSTRUCTION_LAVORO_STRUCTURED: regole sottocategoria, disambiguazione, macchine, stato, messaggio |
| `core/config/tony-form-mapping.js` | lavoro-stato description |

---

## 5. Deploy

Per applicare le modifiche alle Cloud Functions:

```bash
firebase deploy --only functions
```

Il frontend (HTML, JS) si aggiorna con ricarica locale; se in produzione serve anche deploy Hosting.

---

## 6. Test

Esempio di messaggio che Tony deve gestire correttamente:

> "Crea un lavoro di erpicatura sul terreno pinot completo di macchine assegnato a Luca Fabbri"

**Risultato atteso:**
- Nome: Erpicatura Pinot
- Categoria: Lavorazione del Terreno
- Sottocategoria: Tra le File
- Tipo lavoro: Erpicatura Tra le File
- Terreno: pinot
- Assegnazione: Lavoro Autonomo, Operaio: Luca Fabbri
- Trattore + Attrezzo: compilati (es. Agrifull + Frangizolle piccolo)
- Stato: Assegnato
- Messaggio Tony: "Ho compilato tutto. Vuoi che salvi il lavoro?"

---

## 7. Riferimenti

- `docs-sviluppo/GUIDA_SVILUPPO_TONY.md` – guida generale Tony
- `docs-sviluppo/TONY_FUNZIONI_E_SOLUZIONI_TECNICHE.md` – funzionalità e soluzioni tecniche
- `docs-sviluppo/TONY_COMPILAZIONE_ATTIVITA_IMPLEMENTAZIONE.md` – compilazione form Attività

---

*Ultimo aggiornamento: febbraio 2026*
