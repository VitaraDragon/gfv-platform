/**
 * Tony Form Mapping - "Treasure Map"
 * Configurazione centralizzata per il filling headless dei form via Gemini.
 * Ogni form ha: id, modalId, hierarchy (ordine tecnico), fields (mappatura nome->id).
 *
 * Uso: passare questa struttura a Gemini nella system instruction così conosce
 * l'albero completo e può restituire un JSON con tutti i valori in un colpo solo.
 */

(function (global) {
  'use strict';

  const ATTIVITA_FORM_MAP = {
    formId: 'attivita-form',
    modalId: 'attivita-modal',
    /** Ordine di iniezione: i campi dipendenti devono essere impostati dopo i padri */
    injectionOrder: [
      'attivita-data',
      'attivita-terreno',
      'attivita-categoria-principale',
      'attivita-sottocategoria',
      'attivita-tipo-lavoro-gerarchico',
      'attivita-coltura-categoria',
      'attivita-coltura-gerarchica',
      'attivita-orario-inizio',
      'attivita-orario-fine',
      'attivita-pause',
      'attivita-macchina',
      'attivita-attrezzo',
      'attivita-ore-macchina',
      'attivita-note'
    ],
    /** Gerarchia semantica per Gemini: Categoria → Sottocategoria → Tipo Lavoro */
    hierarchy: {
      categoria: { fieldId: 'attivita-categoria-principale', description: 'Categoria principale lavoro (es. Lavorazione del Terreno, Raccolta)' },
      sottocategoria: { fieldId: 'attivita-sottocategoria', description: 'Sottocategoria (es. Tra le File, Sulla Fila, Manuale, Meccanica)' },
      tipoLavoro: { fieldId: 'attivita-tipo-lavoro-gerarchico', description: 'Tipo lavoro specifico (es. Trinciatura, Erpicatura, Vendemmia Manuale)' }
    },
    /** Campi e come risolvere i valori (nome vs id) */
    fields: {
      'attivita-data': { type: 'date', resolve: 'as_is', description: 'Data attività (YYYY-MM-DD). Oggi = data odierna.' },
      'attivita-terreno': { type: 'select', resolve: 'by_name', lookup: 'terreni', description: 'Nome terreno (es. Sangiovese, Kaki, Seminativo)' },
      'attivita-categoria-principale': { type: 'select', resolve: 'by_name', lookup: 'categorie_lavoro', description: 'Categoria (derivabile da tipo lavoro)' },
      'attivita-sottocategoria': { type: 'select', resolve: 'by_name', lookup: 'sottocategorie', description: 'Sottocategoria (derivabile da tipo lavoro)' },
      'attivita-tipo-lavoro-gerarchico': { type: 'select', resolve: 'by_name', lookup: 'tipi_lavoro', description: 'Tipo lavoro (usa NOME esatto, es. Trinciatura, Erpicatura Tra le File)' },
      'attivita-coltura-categoria': { type: 'select', resolve: 'by_name', lookup: 'categorie_coltura', description: 'Categoria coltura (Frutteto, Vite, Seminativo...)' },
      'attivita-coltura-gerarchica': { type: 'select', resolve: 'by_name', lookup: 'colture', description: 'Coltura (es. Kaki, Vite da Vino). Spesso derivabile da terreno.' },
      'attivita-orario-inizio': { type: 'time', resolve: 'as_is', description: 'Ora inizio (HH:mm, es. 07:00, 8:30)' },
      'attivita-orario-fine': { type: 'time', resolve: 'as_is', description: 'Ora fine (HH:mm)' },
      'attivita-pause': { type: 'number', resolve: 'as_is', description: 'Minuti di pausa (default 0)' },
      'attivita-macchina': { type: 'select', resolve: 'by_name', lookup: 'macchine', description: 'Trattore usato (nome)' },
      'attivita-attrezzo': { type: 'select', resolve: 'by_name', lookup: 'attrezzi', description: 'Attrezzo usato (nome)' },
      'attivita-ore-macchina': { type: 'number', resolve: 'as_is', description: 'Ore di utilizzo macchina (per lavori meccanizzati)' },
      'attivita-note': { type: 'text', resolve: 'as_is', description: 'Note libere' }
    }
  };

  /** Schema JSON per Gemini structured output - Attività */
  const ATTIVITA_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['open_modal', 'fill_form', 'save', 'ask'],
        description: 'open_modal=apri form, fill_form=compila campi, save=salva, ask=chiedi altro'
      },
      replyText: {
        type: 'string',
        description: 'Frase breve per TTS (es. "Segno trinciatura nel Sangiovese. Data e ore?")'
      },
      modalId: {
        type: ['string', 'null'],
        description: 'Id modal da aprire (es. attivita-modal), null se fill_form'
      },
      formData: {
        type: 'object',
        description: 'Campi da iniettare nel form. Usa NOMI (terreno, tipo lavoro) non ID. Il sistema risolve.',
        properties: {
          'attivita-data': { type: 'string', description: 'YYYY-MM-DD' },
          'attivita-terreno': { type: 'string', description: 'Nome terreno' },
          'attivita-categoria-principale': { type: 'string', description: 'Nome categoria' },
          'attivita-sottocategoria': { type: 'string', description: 'Nome sottocategoria' },
          'attivita-tipo-lavoro-gerarchico': { type: 'string', description: 'Nome tipo lavoro (es. Trinciatura, Erpicatura Tra le File)' },
          'attivita-coltura-categoria': { type: 'string', description: 'Nome categoria coltura' },
          'attivita-coltura-gerarchica': { type: 'string', description: 'Nome coltura' },
          'attivita-orario-inizio': { type: 'string', description: 'HH:mm' },
          'attivita-orario-fine': { type: 'string', description: 'HH:mm' },
          'attivita-pause': { type: 'number', description: 'Minuti pause' },
          'attivita-macchina': { type: 'string', description: 'Nome trattore' },
          'attivita-attrezzo': { type: 'string', description: 'Nome attrezzo' },
          'attivita-ore-macchina': { type: 'number', description: 'Ore utilizzo macchina' },
          'attivita-note': { type: 'string', description: 'Note' }
        },
        additionalProperties: false
      }
    },
    required: ['action', 'replyText'],
    additionalProperties: false
  };

  /** Istruzione system per modal attività in modalità structured */
  const SYSTEM_INSTRUCTION_ATTIVITA_STRUCTURED = `Ruolo: Tony, assistente compilazione dati per il form Attività GFV Platform.

HAI LA MAPPA COMPLETA DEL FORM:
- Gerarchia: Categoria Principale → Sottocategoria → Tipo Lavoro Specifico
- Campi: terreno (nome), tipo lavoro (nome esatto), data, orari, coltura, macchina, attrezzo, note
- I dati contestuali (terreni, categorie, tipi lavoro, colture, macchine) sono in [CONTESTO].

REGOLE:
1. Rispondi SEMPRE con un JSON che rispetti lo schema. Non testo libero.
2. action: "open_modal" = apri attivita-modal; "fill_form" = compila i campi in formData; "save" = tutti i dati ci sono, salva; "ask" = chiedi info mancanti (formData può avere aggiornamenti parziali).
3. replyText: frase breve per TTS, colloquiale.
4. formData: solo i campi che hai capito. Usa NOMI (es. "Sangiovese", "Trinciatura", "Kaki"), non ID.
5. Per "oggi" usa la data odierna. Per "alle 7" usa "07:00".
6. Se l'utente dice "ho trinciato nel Sangiovese": formData = { attivita-tipo-lavoro-gerarchico: "Trinciatura", attivita-terreno: "Sangiovese" }. La categoria e sottocategoria sono derivabili dal tipo lavoro, puoi includerle se conosci la tassonomia dal contesto.
7. Se l'utente dice solo "erpicatura": formData = { attivita-tipo-lavoro-gerarchico: "Erpicatura" } (o "Erpicatura Tra le File" se nel contesto).
8. TRATTAMENTI: Se l'utente dice solo "trattamento" (o sinonimi generici) senza specificare insetticida, imposta in formData: attivita-categoria-principale nome "Trattamenti", attivita-sottocategoria nome "Meccanico" (usa il nome esatto presente nel contesto, es. Meccanica se così è in anagrafica), attivita-tipo-lavoro-gerarchico nome esatto "Trattamento Anticrittogamico Meccanico" se nel contesto tipi_lavoro. "Trattamento Insetticida" solo se l'utente lo chiede esplicitamente. I tipi Anticrittogamico e Insetticida sono entrambi validi sia in sottocategoria Manuale che Meccanico; il default resta Trattamenti → Meccanico → Anticrittogamico meccanico. Se hasParcoMacchineModule è true e servono macchine, chiedi attivita-macchina e attivita-attrezzo se vuoti in formSummary.

**[CONTESTO_AZIENDALE]**
{CONTESTO_PLACEHOLDER}
**[/CONTESTO_AZIENDALE]**`;

  /** Mappa form Lavori (gestione-lavori)
   * PREFISSO OBBLIGATORIO: lavoro- per tutti i campi (lavoro-terreno, lavoro-tipo-lavoro, lavoro-operaio, ecc.).
   * DIVIETO: Non usare MAI attivita-* nel modulo Lavori (es. attivita-tipo-lavoro-gerarchico). Sono moduli distinti.
   */
  const LAVORO_FORM_MAP = {
    formId: 'lavoro-form',
    modalId: 'lavoro-modal',
    injectionOrder: [
      'lavoro-nome',
      'lavoro-terreno',
      'lavoro-categoria-principale',
      'lavoro-sottocategoria',
      'lavoro-tipo-lavoro',
      'tipo-assegnazione',
      'lavoro-caposquadra',
      'lavoro-operaio',
      'lavoro-data-inizio',
      'lavoro-durata',
      'lavoro-stato',
      'lavoro-trattore',
      'lavoro-attrezzo',
      'lavoro-operatore-macchina',
      'lavoro-note'
    ],
    hierarchy: {
      categoria: { fieldId: 'lavoro-categoria-principale', description: 'Categoria principale lavoro' },
      sottocategoria: { fieldId: 'lavoro-sottocategoria', description: 'Sottocategoria' },
      tipoLavoro: { fieldId: 'lavoro-tipo-lavoro', description: 'Tipo lavoro specifico' }
    },
    fields: {
      'lavoro-nome': { type: 'text', resolve: 'as_is', description: 'Nome lavoro (es. Potatura Campo Nord)' },
      'lavoro-categoria-principale': { type: 'select', resolve: 'by_name', description: 'Categoria (derivabile da tipo)' },
      'lavoro-sottocategoria': { type: 'select', resolve: 'by_name', description: 'Sottocategoria (derivabile da tipo)' },
      'lavoro-tipo-lavoro': { type: 'select', resolve: 'by_name', description: 'Tipo lavoro (es. Trinciatura, Potatura)' },
      'lavoro-terreno': { type: 'select', resolve: 'by_name', description: 'Nome terreno' },
      'tipo-assegnazione': { type: 'radio', resolve: 'as_is', description: 'squadra o autonomo. Default squadra. Se utente nomina operaio singolo → autonomo' },
      'lavoro-caposquadra': { type: 'select', resolve: 'by_name', description: 'Caposquadra (se squadra)' },
      'lavoro-operaio': { type: 'select', resolve: 'by_name', description: 'Operaio responsabile (se autonomo)' },
      'lavoro-data-inizio': { type: 'date', resolve: 'as_is', description: 'Data inizio YYYY-MM-DD. Oggi = data odierna' },
      'lavoro-durata': { type: 'number', resolve: 'as_is', description: 'Durata prevista in giorni' },
      'lavoro-stato': { type: 'select', resolve: 'as_is', description: 'da_pianificare, assegnato, in_corso, completato, annullato' },
      'lavoro-trattore': { type: 'select', resolve: 'by_name', description: 'Trattore (opzionale)' },
      'lavoro-attrezzo': { type: 'select', resolve: 'by_name', description: 'Attrezzo (opzionale)' },
      'lavoro-operatore-macchina': { type: 'select', resolve: 'by_name', description: 'Chi guida la macchina (se autonomo e macchina: usa operaio)' },
      'lavoro-note': { type: 'text', resolve: 'as_is', description: 'Note' }
    }
  };

  /** System instruction per form Lavori - compilazione completa senza dimenticanze */
  const SYSTEM_INSTRUCTION_LAVORO_STRUCTURED = `Ruolo: Tony, assistente compilazione dati per il form Lavori GFV Platform (Gestione Lavori).

PREFISSO E MAPPING ID (OBBLIGATORIO):
- Usa ESCLUSIVAMENTE il prefisso lavoro- per ogni campo (lavoro-terreno, lavoro-tipo-lavoro, lavoro-operaio, lavoro-categoria-principale, lavoro-sottocategoria).
- NON usare MAI attivita-* nel modulo Lavori (attivita-tipo-lavoro-gerarchico, attivita-terreno, ecc.). Moduli distinti.
- tipo-assegnazione: inviare esattamente così (senza prefisso).

OBIETTIVO: Compilare TUTTI i campi obbligatori senza dimenticanze. Non saltare mai un campo required.

CONTROLLO STATO FORM:
- In [CONTESTO].form.formSummary trovi lo stato attuale: ogni riga è "Label: valore ✓" se compilato, "Label: (vuoto)" se mancante.
- Usa formSummary per sapere cosa è già fatto. I campi con ✓ non chiederli di nuovo.
- Per OGNI campo required senza ✓ devi chiedere esplicitamente all'utente. Non procedere a save finché non sono tutti pieni.

CAMPI OBBLIGATORI (tutti richiesti prima di salvare):
1. lavoro-nome, 2. lavoro-categoria-principale, 3. lavoro-sottocategoria (se applicabile), 4. lavoro-tipo-lavoro, 5. lavoro-terreno,
6. tipo-assegnazione (squadra/autonomo), 7. lavoro-caposquadra (se squadra), 8. lavoro-operaio (se autonomo),
9. lavoro-data-inizio (YYYY-MM-DD), 10. lavoro-durata (giorni), 11. lavoro-stato (default assegnato se caposquadra/operaio compilato, altrimenti da_pianificare).

CAMPI OPZIONALI: lavoro-trattore, lavoro-attrezzo, lavoro-operatore-macchina, lavoro-note.

REGOLE MACCHINE (proattivo): Se hasParcoMacchineModule true e lavoro-tipo è meccanico (Trinciatura, Erpicatura, Fresatura, ecc.) e lavoro-trattore vuoto in formSummary → chiedi "Vuoi assegnare un trattore? Quale trattore e attrezzo?" prima di salvare. Risposta no → procedi senza.

TRATTAMENTI (default Tony): Se l'utente dice solo "trattamento" senza altri dettagli, compila: lavoro-categoria-principale nome "Trattamenti", lavoro-sottocategoria nome "Meccanico" (nome esatto dal contesto), lavoro-tipo-lavoro nome esatto "Trattamento Anticrittogamico Meccanico" se nel contesto. Se chiede trattamento insetticida, usa nome esatto "Trattamento Insetticida" dal contesto. Anticrittogamico e Insetticida restano scelta valida sia con sottocategoria Manuale che Meccanico; se l'utente non specifica, resta il default Trattamenti → Meccanico → Anticrittogamico meccanico. Con hasParcoMacchineModule true, chiedi lavoro-trattore e lavoro-attrezzo se pertinenti e ancora vuoti in formSummary.

REGOLE: formData con TUTTI i campi per cui hai valore; usa formSummary; NON save se required vuoti; ordine domande: nome→terreno→tipo→assegnazione→caposquadra/operaio→data→durata.
IMPIANTI: solo campi base; vigneto/frutteto dati tecnici manuali.

**[CONTESTO_AZIENDALE]**
{CONTESTO_PLACEHOLDER}
**[/CONTESTO_AZIENDALE]**`;

  /** Mappa form Nuovo Preventivo (Conto Terzi) – id DOM come in nuovo-preventivo-standalone.html */
  const PREVENTIVO_FORM_MAP = {
    formId: 'preventivo-form',
    modalId: '',
    injectionOrder: [
      'cliente-id',
      'terreno-id',
      'lavoro-categoria-principale',
      'lavoro-sottocategoria',
      'tipo-lavoro',
      'coltura-categoria',
      'coltura',
      'tipo-campo',
      'superficie',
      'iva',
      'giorni-scadenza',
      'data-prevista',
      'note'
    ],
    hierarchy: {
      categoria: { fieldId: 'lavoro-categoria-principale', description: 'Categoria principale lavorazione (es. Lavorazione del Terreno, Raccolta)' },
      sottocategoria: { fieldId: 'lavoro-sottocategoria', description: 'Sottocategoria lavoro se presente' },
      tipoLavoro: { fieldId: 'tipo-lavoro', description: 'Tipo lavoro (nome esatto dal catalogo)' },
      colturaCategoria: { fieldId: 'coltura-categoria', description: 'Categoria coltura (Frutteto, Vigneto, Seminativo…)' },
      coltura: { fieldId: 'coltura', description: 'Coltura specifica (es. Albicocche, Sangiovese)' }
    },
    fields: {
      'cliente-id': { type: 'select', resolve: 'by_name', description: 'Cliente: ragione sociale o id' },
      'terreno-id': { type: 'select', resolve: 'by_name', description: 'Terreno del cliente (nome o id), opzionale' },
      'lavoro-categoria-principale': { type: 'select', resolve: 'by_name', description: 'Categoria lavoro' },
      'lavoro-sottocategoria': { type: 'select', resolve: 'by_name', description: 'Sottocategoria' },
      'tipo-lavoro': { type: 'select', resolve: 'by_name', description: 'Tipo lavoro' },
      'coltura-categoria': { type: 'select', resolve: 'by_name', description: 'Categoria coltura' },
      'coltura': { type: 'select', resolve: 'by_name', description: 'Nome coltura' },
      'tipo-campo': { type: 'select', resolve: 'as_is', description: 'pianura | collina | montagna' },
      'superficie': { type: 'number', resolve: 'as_is', description: 'Ettari' },
      'iva': { type: 'number', resolve: 'as_is', description: 'Percentuale IVA (default 22)' },
      'giorni-scadenza': { type: 'number', resolve: 'as_is', description: 'Giorni validità preventivo' },
      'data-prevista': { type: 'date', resolve: 'as_is', description: 'Data prevista lavoro YYYY-MM-DD' },
      'note': { type: 'text', resolve: 'as_is', description: 'Note' }
    }
  };

  const SYSTEM_INSTRUCTION_PREVENTIVO_STRUCTURED = `Ruolo: Tony, compilazione form Nuovo Preventivo (Conto Terzi).

CHIAVI CAMPO (usa ESATTAMENTE questi id nel JSON formData / fields):
cliente-id, terreno-id (opzionale), lavoro-categoria-principale, lavoro-sottocategoria, tipo-lavoro, coltura-categoria, coltura, tipo-campo (pianura|collina|montagna), superficie (ettari), iva, giorni-scadenza, data-prevista, note.

REGOLE:
- Usa NOMI leggibili (ragione sociale cliente, nome terreno, nomi categoria/tipo lavoro/coltura), non inventare id.
- Se l'utente non è sulla pagina Nuovo Preventivo: command OPEN_MODAL con id "preventivo-form" (o testo equivalente) + fields; il client aprirà la pagina e inietterà i dati.
- Se il form è già aperto (formId preventivo-form): command INJECT_FORM_DATA con formId "preventivo-form" e formData.
- Ordine logico: cliente → terreno (se noto) → tipo lavoro (categoria/sottocategoria derivabili dal tipo se nel contesto) → colture → morfologia e superficie.
- Superficie e tipo campo possono essere dedotti dal terreno se selezionato; altrimenti chiedi o usa quanto detto dall'utente.

**[CONTESTO_AZIENDALE]**
{CONTESTO_PLACEHOLDER}
**[/CONTESTO_AZIENDALE]**`;

  /** Magazzino – anagrafica prodotto (`prodotti-standalone.html`, `#prodotto-form`) */
  const PRODOTTO_FORM_MAP = {
    formId: 'prodotto-form',
    modalId: 'prodotto-modal',
    /** Domande Tony finché vuoti (non sono tutti HTML required; la proattività usa questa lista, il salvataggio solo i required). */
    tonyInterviewFieldIds: [
      'prodotto-nome',
      'prodotto-categoria',
      'prodotto-unita',
      'prodotto-scorta-minima',
      'prodotto-prezzo',
      'prodotto-dosaggio-min',
      'prodotto-dosaggio-max',
      'prodotto-giorni-carenza'
    ],
    /**
     * Solo queste categorie (value del select) usano i giorni di carenza in interviewEmpty; tutte le altre no.
     */
    prodottoCategoriaRichiedeGiorniCarenza: ['fitofarmaci'],
    injectionOrder: [
      'prodotto-codice',
      'prodotto-nome',
      'prodotto-categoria',
      'prodotto-unita',
      'prodotto-scorta-minima',
      'prodotto-prezzo',
      'prodotto-dosaggio-min',
      'prodotto-dosaggio-max',
      'prodotto-giorni-carenza',
      'prodotto-note'
    ],
    fields: {
      'prodotto-codice': { type: 'text', resolve: 'as_is', description: 'Codice interno opzionale' },
      'prodotto-nome': { type: 'text', resolve: 'as_is', description: 'Nome prodotto (obbligatorio in salvataggio)' },
      'prodotto-categoria': { type: 'select', resolve: 'as_is', description: 'fitofarmaci|fertilizzanti|materiale_impianto|ricambi|sementi|altro' },
      'prodotto-unita': { type: 'select', resolve: 'as_is', description: 'kg|L|pezzi|m|m2|confezione|sacchi|altro' },
      'prodotto-scorta-minima': { type: 'number', resolve: 'as_is', description: 'Scorta minima' },
      'prodotto-prezzo': { type: 'number', resolve: 'as_is', description: 'Prezzo unitario €' },
      'prodotto-dosaggio-min': { type: 'number', resolve: 'as_is', description: 'Dosaggio min per ha' },
      'prodotto-dosaggio-max': { type: 'number', resolve: 'as_is', description: 'Dosaggio max per ha' },
      'prodotto-giorni-carenza': { type: 'number', resolve: 'as_is', description: 'Giorni di carenza (solo categoria fitofarmaci; altre categorie: non applicabile)' },
      'prodotto-note': { type: 'text', resolve: 'as_is', description: 'Note' }
    }
  };

  /** Magazzino – movimento (`movimenti-standalone.html`, `#movimento-form`) */
  const MOVIMENTO_FORM_MAP = {
    formId: 'movimento-form',
    modalId: 'movimento-modal',
    /** Campi opzionali da chiedere se ancora vuoti (i required HTML sono gestiti da requiredEmpty). */
    tonyInterviewFieldIds: ['mov-confezione', 'mov-prezzo', 'mov-note', 'mov-lavoro', 'mov-attivita'],
    injectionOrder: [
      'mov-prodotto',
      'mov-data',
      'mov-tipo',
      'mov-quantita',
      'mov-confezione',
      'mov-prezzo',
      'mov-note',
      'mov-lavoro',
      'mov-attivita'
    ],
    fields: {
      'mov-prodotto': { type: 'select', resolve: 'by_name', description: 'Prodotto: nome o id Firestore (da elenco o da azienda.prodotti)' },
      'mov-data': { type: 'date', resolve: 'as_is', description: 'Data movimento YYYY-MM-DD' },
      'mov-tipo': { type: 'select', resolve: 'as_is', description: 'entrata | uscita' },
      'mov-quantita': { type: 'number', resolve: 'as_is', description: 'Quantità (positiva)' },
      'mov-confezione': { type: 'text', resolve: 'as_is', description: 'Testo confezione opzionale' },
      'mov-prezzo': { type: 'number', resolve: 'as_is', description: 'Prezzo unitario € (tipico entrata)' },
      'mov-note': { type: 'text', resolve: 'as_is', description: 'Note' },
      'mov-lavoro': { type: 'select', resolve: 'by_name', description: 'Collegamento lavoro opzionale (id o testo)' },
      'mov-attivita': { type: 'select', resolve: 'by_name', description: 'Collegamento attività opzionale (id o testo)' }
    }
  };

  const SYSTEM_INSTRUCTION_MAGAZZINO_FORMS = `Form Magazzino (id DOM = chiavi in fields / INJECT_FORM_DATA):
- Prodotto: formId "prodotto-form", OPEN_MODAL "prodotto-modal". Campi: prodotto-nome (obbligatorio), prodotto-categoria, prodotto-unita, prodotto-scorta-minima, prodotto-prezzo, prodotto-dosaggio-min/max, prodotto-giorni-carenza (solo fitofarmaci), prodotto-note, prodotto-codice. Il contesto form include interviewEmpty: **i giorni di carenza servono solo se prodotto-categoria è fitofarmaci**; per ogni altra categoria non esistono giorni di carenza — non chiedere e non usare SET_FIELD su prodotto-giorni-carenza salvo richiesta esplicita dell'utente. Altrimenti domande su categoria, unità, scorta, prezzo, dosaggi. Non solo il nome.
- Movimento: formId "movimento-form", OPEN_MODAL "movimento-modal". Campi: mov-prodotto (nome prodotto o id, obbligatorio), mov-data, mov-tipo (entrata|uscita), mov-quantita (obbligatori insieme agli altri required), mov-confezione, mov-prezzo (entrata), mov-note, mov-lavoro, mov-attivita (opzionali). interviewEmpty per i campi opzionali ancora vuoti.
Se il form è già aperto sulla pagina: INJECT_FORM_DATA con formId corrispondente; dopo iniezione il client può chiedere conferma salvataggio (SAVE_ACTIVITY) se tutti i required sono ok. Da altra pagina: OPEN_MODAL + fields o APRI_PAGINA target "prodotti"/"movimenti" con fields.`;

  /** Mappa form Terreno (aggiungi terreno) */
  const TERRENO_FORM_MAP = {
    formId: 'terreno-form',
    modalId: 'terreno-modal',
    injectionOrder: [
      'terreno-nome',
      'terreno-superficie',
      'terreno-coltura-categoria',
      'terreno-coltura',
      'terreno-podere',
      'terreno-tipo-possesso',
      'terreno-data-scadenza-affitto',
      'terreno-canone-affitto',
      'terreno-note'
    ],
    hierarchy: {
      colturaCategoria: { fieldId: 'terreno-coltura-categoria', description: 'Categoria coltura (Frutteto, Vigneto, Seminativo, Ortive, ecc.)' },
      coltura: { fieldId: 'terreno-coltura', description: 'Coltura specifica (Vite da Vino, Albicocche, Kaki, Grano, ecc.). Selezionare prima la categoria.' }
    },
    fields: {
      'terreno-nome': { type: 'text', resolve: 'as_is', required: true, description: 'Nome identificativo del terreno (OBBLIGATORIO)' },
      'terreno-superficie': { type: 'number', resolve: 'as_is', description: 'Superficie in ettari (es. 2.5). Può essere calcolata dalla mappa.' },
      'terreno-coltura-categoria': { type: 'select', resolve: 'by_name', lookup: 'categorie_coltura', description: 'Categoria coltura (Frutteto, Vigneto, Seminativo, Ortive)' },
      'terreno-coltura': { type: 'select', resolve: 'by_name', lookup: 'colture', description: 'Coltura specifica (Vite da Vino, Albicocche, Kaki, Grano)' },
      'terreno-podere': { type: 'select', resolve: 'by_name', lookup: 'poderi', description: 'Podere (es. Casetti, Barbavara Vecchia)' },
      'terreno-tipo-possesso': { type: 'select', resolve: 'as_is', description: 'proprieta o affitto. Default proprieta.' },
      'terreno-data-scadenza-affitto': { type: 'date', resolve: 'as_is', description: 'Data scadenza contratto affitto (YYYY-MM-DD). Richiesto se tipo-possesso=affitto.' },
      'terreno-canone-affitto': { type: 'number', resolve: 'as_is', description: 'Canone mensile in euro (opzionale)' },
      'terreno-note': { type: 'text', resolve: 'as_is', description: 'Note aggiuntive' }
    }
  };

  /**
   * Regole sottocategoria per tipo terreno (coltura).
   * Fonte unica per SmartFormFiller e injector: evita patch sparse.
   * Estensibile: nuovo tipo → aggiungi pattern.
   */
  const TERRENO_SOTTOCATEGORIA_PREFERENCE = {
    /** Pattern coltura (lowercase, partial match) → sottocategoria default per lavorazioni meccaniche */
    traLeFile: ['vite', 'vigneto', 'frutteto', 'oliveto', 'arboreo', 'alberi'],
    generale: ['seminativo', 'seminativi', 'prato', 'prati', 'generale', 'coltura erbacea', 'grano', 'mais', 'orzo']
  };

  /** @returns {'tra le file'|'generale'|null} */
  function getSottocategoriaPreferenceFromColtura(coltura) {
    if (!coltura || typeof coltura !== 'string') return null;
    const c = coltura.toLowerCase().trim();
    if (TERRENO_SOTTOCATEGORIA_PREFERENCE.traLeFile.some(p => c.includes(p))) return 'tra le file';
    if (TERRENO_SOTTOCATEGORIA_PREFERENCE.generale.some(p => c.includes(p))) return 'generale';
    return null;
  }

  const mapping = {
    'attivita-modal': ATTIVITA_FORM_MAP,
    attivita: ATTIVITA_FORM_MAP,
    'lavoro-modal': LAVORO_FORM_MAP,
    'lavoro-form': LAVORO_FORM_MAP,
    lavori: LAVORO_FORM_MAP,
    'terreno-modal': TERRENO_FORM_MAP,
    'terreno-form': TERRENO_FORM_MAP,
    terreni: TERRENO_FORM_MAP,
    'preventivo-form': PREVENTIVO_FORM_MAP,
    preventivo: PREVENTIVO_FORM_MAP,
    'nuovo-preventivo': PREVENTIVO_FORM_MAP,
    'prodotto-form': PRODOTTO_FORM_MAP,
    'prodotto-modal': PRODOTTO_FORM_MAP,
    prodotto: PRODOTTO_FORM_MAP,
    'movimento-form': MOVIMENTO_FORM_MAP,
    'movimento-modal': MOVIMENTO_FORM_MAP,
    movimento: MOVIMENTO_FORM_MAP
  };

  const schemas = {
    'attivita-modal': ATTIVITA_RESPONSE_SCHEMA,
    attivita: ATTIVITA_RESPONSE_SCHEMA
  };

  const systemInstructions = {
    'attivita-modal': SYSTEM_INSTRUCTION_ATTIVITA_STRUCTURED,
    attivita: SYSTEM_INSTRUCTION_ATTIVITA_STRUCTURED,
    'lavoro-modal': SYSTEM_INSTRUCTION_LAVORO_STRUCTURED,
    'lavoro-form': SYSTEM_INSTRUCTION_LAVORO_STRUCTURED,
    lavori: SYSTEM_INSTRUCTION_LAVORO_STRUCTURED,
    'preventivo-form': SYSTEM_INSTRUCTION_PREVENTIVO_STRUCTURED,
    preventivo: SYSTEM_INSTRUCTION_PREVENTIVO_STRUCTURED,
    'nuovo-preventivo': SYSTEM_INSTRUCTION_PREVENTIVO_STRUCTURED,
    'prodotto-form': SYSTEM_INSTRUCTION_MAGAZZINO_FORMS,
    'movimento-form': SYSTEM_INSTRUCTION_MAGAZZINO_FORMS
  };

  /** Allineato a core/config/trattamenti-lavoro-defaults.js */
  const DEFAULT_TIPO_LAVORO_TRATTAMENTO_GENERICO = 'Trattamento Anticrittogamico Meccanico';
  const DEFAULT_SOTTOCATEGORIA_TRATTAMENTI_TONY = 'Meccanico';

  global.TONY_FORM_MAPPING = {
    getFormMap: (formKey) => mapping[formKey] || null,
    getSchema: (formKey) => schemas[formKey] || null,
    getSystemInstruction: (formKey) => systemInstructions[formKey] || null,
    DEFAULT_TIPO_LAVORO_TRATTAMENTO_GENERICO,
    DEFAULT_SOTTOCATEGORIA_TRATTAMENTI_TONY,
    ATTIVITA_RESPONSE_SCHEMA,
    ATTIVITA_FORM_MAP,
    LAVORO_FORM_MAP,
    PREVENTIVO_FORM_MAP,
    TERRENO_FORM_MAP,
    TERRENO_SOTTOCATEGORIA_PREFERENCE,
    getSottocategoriaPreferenceFromColtura,
    SYSTEM_INSTRUCTION_LAVORO_STRUCTURED,
    SYSTEM_INSTRUCTION_PREVENTIVO_STRUCTURED,
    PRODOTTO_FORM_MAP,
    MOVIMENTO_FORM_MAP,
    SYSTEM_INSTRUCTION_MAGAZZINO_FORMS
  };
})(typeof window !== 'undefined' ? window : globalThis);
