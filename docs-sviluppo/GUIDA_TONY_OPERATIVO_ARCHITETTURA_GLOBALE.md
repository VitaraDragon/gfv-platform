# Guida Tony Operativo - Architettura Globale Form

## Scopo del documento

Questa guida definisce l'approccio ufficiale per rendere `Tony Operativo` affidabile su tutti i modal dell'app, inclusi quelli con campi condizionali, switch, dipendenze gerarchiche e campi invisibili.

Obiettivo: permettere all'utente di dire una frase naturale (es. "ho trinciato nel campo Kaki") e ottenere compilazione automatica coerente, senza domande ridondanti.

Questo documento e' scritto per agenti tecnici: seguire le regole qui sotto evita regressioni e comportamenti "falsi positivi" (es. Tony dice "salvato" ma il form non e' valido).

---

## Decisione prodotto (vincolante)

- `Tony Guida` e `Tony Operativo` sono due esperienze diverse.
- `Tony Guida` va mantenuto stabile e non deve essere impattato dal refactor operativo.
- `Tony Operativo` e' modulo premium: deve fornire vantaggio reale di tempo, non solo chat.
- Se il vantaggio non e' misurabile (meno campi richiesti, meno turni di chat, meno correzioni), la feature non e' pronta.

### Modello piani (vincolante)

- `Freemium (free)`: **Tony completamente assente** (ne' Guida ne' Operativo).
- `Versione a pagamento base app`: `Tony Guida` presente.
- `Modulo aggiuntivo Tony`: abilita `Tony Operativo` (azioni su UI/form).

Conseguenza tecnica:
- in `free`, il modulo `tony` non deve essere inizializzato, mostrato o chiamabile;
- nei piani paid senza modulo operativo, Tony resta solo guida;
- nei piani paid con modulo operativo, Tony guida + operativo.

---

## Problemi gia' osservati (baseline)

Dalle analisi dei log:

1. Le risposte LLM arrivano spesso come testo senza comando strutturato (`command: null`).
2. I comandi possono arrivare in ordine non coerente con il ciclo vita del modal (es. `SET_FIELD` prima di `OPEN_MODAL`).
3. I campi semplici si impostano; quelli gerarchici no (`categoria -> sottocategoria -> tipo lavoro`).
4. `SAVE_ACTIVITY` puo' essere emesso anche con campi required ancora vuoti.
5. I dropdown figli sono invisibili o non popolati finche' il padre non e' impostato e processato correttamente.

Conclusione: non basta "sparare SET_FIELD"; serve orchestrazione formale del form.

---

## Principio architetturale

`Tony Operativo` non deve pilotare il DOM in modo opportunistico.

Separazione obbligatoria:

1. **NLU Layer (Tony AI)**  
   Estrae intento e dati (`job`, `terreno`, `data`, `ore`, ecc.).

2. **Form Engine Layer (centrale, deterministico)**  
   Applica regole del modal: dipendenze, visibilita', mapping, validazione, sequenza.

3. **UI Layer**  
   Esegue update dei campi solo tramite Form Engine e notifica lo stato.

Non e' consentito affidare all'LLM la responsabilita' di:
- decidere l'ordine dei click,
- capire quando un campo figlio e' pronto,
- dichiarare salvataggio riuscito.

---

## Modello dati minimo per ogni modal (Form Schema)

Ogni modal che Tony deve compilare deve avere uno schema dichiarativo.

Campi minimi richiesti nello schema:

- `modalId`
- `submitSelector`
- `fields[]` con:
  - `id`
  - `type`
  - `required`
  - `visibleWhen` (regola visibilita')
  - `dependsOn[]` (dipendenze padre/figlio)
  - `resolver` (opzionale: come mappare valore naturale -> option value)
- `saveGuard` (regole di validazione finale prima del submit)

Senza schema, il modal e' "non supportato da Tony Operativo".

---

## Regole operative obbligatorie per agenti

1. Non toccare `Tony Guida` durante lavori su Operativo.
2. Non introdurre logica speciale hardcoded solo per un modal, salvo hotfix temporaneo documentato.
3. Non considerare riuscito un comando se il contesto form dopo update non mostra il campo valorizzato.
4. Non eseguire `SAVE_ACTIVITY` se i required del modal sono incompleti.
5. Non fidarsi della frase testuale dell'LLM ("ho salvato"): lo stato reale e' il form/controller.
6. Ogni nuovo modal supportato deve avere schema + test di regressione.
7. In piano `free` Tony deve essere totalmente escluso: niente widget, niente endpoint, niente fallback guida.

---

## Flusso standard di compilazione (deterministico)

1. Assicurare modal aperto.
2. Acquisire snapshot form corrente (campi, visibilita', required, opzioni).
3. Risolvere dipendenze: impostare prima i padri.
4. Attendere segnali reali di reattivita' del controller:
   - campo figlio visibile,
   - opzioni figlio popolate,
   - valore figlio impostabile.
5. Impostare figli.
6. Rieseguire snapshot e verificare delta.
7. Solo se validazione passa, consentire salvataggio.

Se uno step fallisce, Tony deve chiedere chiarimento puntuale, non ripetere tutto il form.

---

## Gestione del gerarchico (categoria -> sottocategoria -> tipo lavoro)

Per i modal attivita':

- `categoria principale` e' padre.
- `sottocategoria` compare solo se prevista dalla categoria.
- `tipo lavoro specifico` e' figlio finale e puo' dipendere da categoria/sottocategoria.

Regola d'oro:
- Input utente su lavoro specifico deve risalire al padre prima di scendere ai figli.
- Se esiste ambiguita', chiedere una sola domanda disambiguante.

Esempio target:
- Input: "ho trinciato nel campo Kaki"
- Output atteso minimo:
  - terreno valorizzato
  - categoria valorizzata
  - eventuale sottocategoria valorizzata o motivatamente lasciata vuota
  - tipo lavoro valorizzato

---

## Contratto salvataggio (anti falso-positivo)

`SAVE_ACTIVITY` puo' essere eseguito solo se:

- modal corretto attivo,
- nessun required visibile vuoto,
- required nascosti gestiti dal controller (non bypassati),
- submit button effettivamente disponibile e abilitato.

Dopo tentativo di submit:
- verificare esito reale (chiusura modal, notifica successo, record creato, o feedback controller),
- solo allora Tony puo' dire "attivita' salvata".

---

## Strategia globale di rollout

### Fase 1 - Stabilizzazione modal Attivita
- Formalizzare schema del modal.
- Portare tutta la logica gerarchica nel Form Engine.
- Bloccare i falsi "saved".

### Fase 2 - Modal complessi (es. Gestione Lavori con switch)
- Modellare visibilita' condizionale nello schema.
- Aggiungere resolver per campi dipendenti da switch.

### Fase 3 - Standardizzazione app-wide
- Catalogo unico degli schemi modal.
- Checklist di compatibilita' Tony per ogni nuovo modal.

### Fase 4 - Hardening premium
- metriche di successo (tempo medio compilazione, numero domande, tasso retry),
- soglia minima di qualita' prima di vendere il modulo.

### Fase 5 - Gating piani (free vs paid)
- Bloccare Tony completamente in `free` (UI + backend + service).
- Tenere `Tony Guida` nei piani paid base.
- Abilitare `Tony Operativo` solo con modulo Tony attivo.
- Testare anti-bypass: chiamate dirette a funzioni/endpoint Tony da tenant free devono fallire.

---

## Checklist "pronto per Tony Operativo"

Un modal e' pronto solo se:

- [ ] schema dichiarativo presente
- [ ] dipendenze padre/figlio esplicite
- [ ] regole visibilita' esplicite
- [ ] validazione submit integrata
- [ ] test su input naturale (frase corta)
- [ ] test su campi nascosti/switch
- [ ] test su ambiguita'
- [ ] nessun falso positivo di salvataggio

---

## Test minimi obbligatori (per ogni modal)

1. **Happy path naturale**
   - una frase utente compila piu' campi correlati.
2. **Path con ambiguita'**
   - Tony chiede solo la disambiguazione minima.
3. **Campi condizionali**
   - switch/visibilita' dinamica funzionano.
4. **Save guard**
   - niente "salvato" con required mancanti.
5. **Regressione Guida**
   - Tony Guida invariato nei piani paid base.
6. **Gating piani**
   - in `free` Tony non deve comparire e non deve essere invocabile.

---

## Anti-pattern da evitare

- Prompt che prova a sostituire la logica form del frontend.
- Parsing fragile di JSON incompleti senza controllo stato reale del form.
- Hardcode di eccezioni sparse nel widget per singoli campi.
- Conferme di successo basate su testo LLM invece che su eventi applicativi.

---

## Definizione di successo business

`Tony Operativo` e' pronto per monetizzazione solo se:

- riduce passaggi utente sui form complessi,
- compila correttamente i blocchi gerarchici nella maggioranza dei casi reali,
- non genera falsi salvataggi,
- non peggiora l'esperienza rispetto alla compilazione manuale.

---

## Nota finale per futuri agenti

Se un fix locale rompe la generalita', fermarsi.
Priorita' assoluta: convergere verso Form Engine + Schema globale, mantenendo `Tony Guida` stabile.

---

## Riferimento implementazione attuale (2026-02-13)

**Fase 1 - Modal Attività: completata e funzionante.**

L'implementazione concreta del form Attività usa:
- **Treasure Map / INJECT_FORM_DATA**: Cloud Function con `SYSTEM_INSTRUCTION_ATTIVITA_STRUCTURED`, Gemini restituisce blocco \`\`\`json con `formData`.
- **TonyFormInjector**: `injectAttivitaForm()`, `deriveCategoriaFromTipo()`, ordine iniezione e delay per cascata.
- **SmartFormFiller**: usato per comandi `SET_FIELD` singoli su tipo-lavoro (path alternativo).
- **Fix implementati**: deriveCategoriaFromTipo con match specifico e override nome; ore macchina auto-compilate; eccezioni formSummary per pause=0 e sottocategoria placeholder; contesto con colture_con_filari e tipi_che_richiedono_macchina.

Documento dettagliato: `docs-sviluppo/TONY_COMPILAZIONE_ATTIVITA_IMPLEMENTAZIONE.md`.

