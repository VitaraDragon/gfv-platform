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

**[CONTESTO_AZIENDALE]**
{CONTESTO_PLACEHOLDER}
**[/CONTESTO_AZIENDALE]**`;

  const mapping = {
    'attivita-modal': ATTIVITA_FORM_MAP,
    attivita: ATTIVITA_FORM_MAP
  };

  const schemas = {
    'attivita-modal': ATTIVITA_RESPONSE_SCHEMA,
    attivita: ATTIVITA_RESPONSE_SCHEMA
  };

  const systemInstructions = {
    'attivita-modal': SYSTEM_INSTRUCTION_ATTIVITA_STRUCTURED,
    attivita: SYSTEM_INSTRUCTION_ATTIVITA_STRUCTURED
  };

  global.TONY_FORM_MAPPING = {
    getFormMap: (formKey) => mapping[formKey] || null,
    getSchema: (formKey) => schemas[formKey] || null,
    getSystemInstruction: (formKey) => systemInstructions[formKey] || null,
    ATTIVITA_RESPONSE_SCHEMA,
    ATTIVITA_FORM_MAP
  };
})(typeof window !== 'undefined' ? window : globalThis);
