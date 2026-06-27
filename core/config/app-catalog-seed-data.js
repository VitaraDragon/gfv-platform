/**
 * @module core/config/app-catalog-seed-data
 * Single source of truth for app + sim seed, no imports.
 */

// Categorie predefinite principali
export const CATEGORIE_PRINCIPALI_PREDEFINITE = [
  {
    nome: 'Lavorazione del Terreno',
    codice: 'lavorazione_terreno',
    descrizione: 'Aratura, erpicatura, fresatura, vangatura, ecc.',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 1
  },
  {
    nome: 'Trattamenti',
    codice: 'trattamenti',
    descrizione: 'Fitofarmaci, irrigazione, ecc.',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 2
  },
  {
    nome: 'Concimazione',
    codice: 'concimazione',
    descrizione: 'Concimazioni di fondo, fogliari, organici, ecc.',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 3
  },
  {
    nome: 'Potatura',
    codice: 'potatura',
    descrizione: 'Potatura manuale e meccanica',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 4
  },
  {
    nome: 'Raccolta',
    codice: 'raccolta',
    descrizione: 'Raccolta frutta, raccolta verdura, vendemmia, ecc.',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 5
  },
  {
    nome: 'Gestione del Verde',
    codice: 'gestione_verde',
    descrizione: 'Falciatura, taglio erba, manutenzione estetica, ecc.',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 6
  },
  {
    nome: 'Diserbo',
    codice: 'diserbo',
    descrizione: 'Eliminazione delle erbe infestanti',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 7
  },
  {
    nome: 'Semina e Piantagione',
    codice: 'semina_piantagione',
    descrizione: 'Semina, trapianto, piantagione, ecc.',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 8
  },
  {
    nome: 'Trasporto',
    codice: 'trasporto',
    descrizione: 'Rimorchi, carri, carrelli, ecc.',
    applicabileA: 'attrezzi',
    predefinita: true,
    ordine: 9
  },
  {
    nome: 'Manutenzione',
    codice: 'manutenzione',
    descrizione: 'Riparazioni, manutenzione impianti, ecc.',
    applicabileA: 'lavori',
    predefinita: true,
    ordine: 10
  },
  {
    nome: 'Altro',
    codice: 'altro',
    descrizione: 'Altri tipi non categorizzabili',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 11
  }
];

// Categorie predefinite per colture
export const CATEGORIE_COLTURE_PREDEFINITE = [
  {
    nome: 'Frutteto',
    codice: 'frutteto',
    descrizione: 'Alberi da frutto',
    applicabileA: 'colture',
    predefinita: true,
    ordine: 1
  },
  {
    nome: 'Seminativo',
    codice: 'seminativo',
    descrizione: 'Colture erbacee da granella',
    applicabileA: 'colture',
    predefinita: true,
    ordine: 2
  },
  {
    nome: 'Vite',
    codice: 'vite',
    descrizione: 'Vigneto',
    applicabileA: 'colture',
    predefinita: true,
    ordine: 3
  },
  {
    nome: 'Ortive',
    codice: 'ortive',
    descrizione: 'Colture orticole',
    applicabileA: 'colture',
    predefinita: true,
    ordine: 4
  },
  {
    nome: 'Prato',
    codice: 'prato',
    descrizione: 'Prati e pascoli',
    applicabileA: 'colture',
    predefinita: true,
    ordine: 5
  },
  {
    nome: 'Olivo',
    codice: 'olivo',
    descrizione: 'Oliveto',
    applicabileA: 'colture',
    predefinita: true,
    ordine: 6
  },
  {
    nome: 'Agrumeto',
    codice: 'agrumeto',
    descrizione: 'Agrumi',
    applicabileA: 'colture',
    predefinita: true,
    ordine: 7
  },
  {
    nome: 'Bosco',
    codice: 'bosco',
    descrizione: 'Bosco e foresta',
    applicabileA: 'colture',
    predefinita: true,
    ordine: 8
  },
  {
    nome: 'Altro',
    codice: 'altro_colture',
    descrizione: 'Altre colture non categorizzabili',
    applicabileA: 'colture',
    predefinita: true,
    ordine: 9
  }
];

// Sottocategorie predefinite
export const SOTTOCATEGORIE_PREDEFINITE = [
  // Sottocategorie per Lavorazione del Terreno
  {
    nome: 'Generale',
    codice: 'lavorazione_terreno_generale',
    parentCodice: 'lavorazione_terreno',
    descrizione: 'Lavorazione standard per campi aperti',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 1
  },
  {
    nome: 'Tra le File',
    codice: 'lavorazione_terreno_tra_file',
    parentCodice: 'lavorazione_terreno',
    descrizione: 'Lavorazione tra le file di frutteti/vigneti',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 2
  },
  {
    nome: 'Sulla Fila',
    codice: 'lavorazione_terreno_sulla_fila',
    parentCodice: 'lavorazione_terreno',
    descrizione: 'Lavorazione sulla fila di frutteti/vigneti',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 3
  },
  // Sottocategorie per Trattamenti
  {
    nome: 'Manuale',
    codice: 'trattamenti_manuale',
    parentCodice: 'trattamenti',
    descrizione: 'Trattamenti eseguiti manualmente',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 1
  },
  {
    nome: 'Meccanico',
    codice: 'trattamenti_meccanico',
    parentCodice: 'trattamenti',
    descrizione: 'Trattamenti eseguiti con macchine',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 2
  },
  // Sottocategorie per Concimazione
  {
    nome: 'Manuale',
    codice: 'concimazione_manuale',
    parentCodice: 'concimazione',
    descrizione: 'Concimazione eseguita manualmente',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 1
  },
  {
    nome: 'Meccanico',
    codice: 'concimazione_meccanico',
    parentCodice: 'concimazione',
    descrizione: 'Concimazione eseguita con macchine',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 2
  },
  // Sottocategorie per Potatura
  {
    nome: 'Manuale',
    codice: 'potatura_manuale',
    parentCodice: 'potatura',
    descrizione: 'Potatura eseguita manualmente',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 1
  },
  {
    nome: 'Meccanico',
    codice: 'potatura_meccanico',
    parentCodice: 'potatura',
    descrizione: 'Potatura eseguita con attrezzi meccanici',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 2
  },
  // Sottocategorie per Raccolta
  {
    nome: 'Raccolta Manuale',
    codice: 'raccolta_manuale',
    parentCodice: 'raccolta',
    descrizione: 'Raccolta eseguita manualmente',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 1
  },
  {
    nome: 'Raccolta Meccanica',
    codice: 'raccolta_meccanica',
    parentCodice: 'raccolta',
    descrizione: 'Raccolta eseguita con macchine',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 2
  },
  // Sottocategorie per Gestione del Verde
  {
    nome: 'Manuale',
    codice: 'gestione_verde_manuale',
    parentCodice: 'gestione_verde',
    descrizione: 'Gestione del verde eseguita manualmente',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 1
  },
  {
    nome: 'Meccanico',
    codice: 'gestione_verde_meccanico',
    parentCodice: 'gestione_verde',
    descrizione: 'Gestione del verde eseguita con macchine',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 2
  },
  // Sottocategorie per Semina e Piantagione
  {
    nome: 'Manuale',
    codice: 'semina_piantagione_manuale',
    parentCodice: 'semina_piantagione',
    descrizione: 'Semina e piantagione eseguite manualmente',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 1
  },
  {
    nome: 'Meccanico',
    codice: 'semina_piantagione_meccanico',
    parentCodice: 'semina_piantagione',
    descrizione: 'Semina e piantagione eseguite con macchine',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 2
  },
  {
    nome: 'Impianto',
    codice: 'semina_piantagione_impianto',
    parentCodice: 'semina_piantagione',
    descrizione: 'Impianto completo di nuove colture con struttura di sostegno (vigneti, frutteti, oliveti)',
    applicabileA: 'lavori',
    predefinita: true,
    ordine: 3
  },
  // Sottocategorie per Diserbo
  {
    nome: 'Manuale',
    codice: 'diserbo_manuale',
    parentCodice: 'diserbo',
    descrizione: 'Diserbo eseguito manualmente',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 1
  },
  {
    nome: 'Meccanico',
    codice: 'diserbo_meccanico',
    parentCodice: 'diserbo',
    descrizione: 'Diserbo eseguito con macchine',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 2
  }
];

// Tipi lavoro predefiniti organizzati per sottocategoria
// Struttura: { nome, sottocategoriaCodice, descrizione }
/** Nomi -> sottocategoriaCodice per lookup batch skill (e seed). */
export const TIPI_LAVORO_PREDEFINITI = [
  // Lavorazione del Terreno - Generale
  { nome: 'Aratura', sottocategoriaCodice: 'lavorazione_terreno_generale', descrizione: 'Lavorazione profonda del terreno' },
  { nome: 'Erpicatura', sottocategoriaCodice: 'lavorazione_terreno_generale', descrizione: 'Lavorazione superficiale del terreno' },
  { nome: 'Fresatura', sottocategoriaCodice: 'lavorazione_terreno_generale', descrizione: 'Frantumazione e rimescolamento del terreno' },
  { nome: 'Vangatura', sottocategoriaCodice: 'lavorazione_terreno_generale', descrizione: 'Lavorazione manuale o meccanica del terreno' },
  { nome: 'Ripuntatura', sottocategoriaCodice: 'lavorazione_terreno_generale', descrizione: 'Lavorazione profonda senza rivoltamento' },
  { nome: 'Estirpatura', sottocategoriaCodice: 'lavorazione_terreno_generale', descrizione: 'Lavorazione con estirpatore' },
  { nome: 'Rullatura', sottocategoriaCodice: 'lavorazione_terreno_generale', descrizione: 'Compattazione del terreno' },
  // Lavorazione del Terreno - Tra le File
  { nome: 'Fresatura Tra le File', sottocategoriaCodice: 'lavorazione_terreno_tra_file', descrizione: 'Fresatura tra le file di frutteti/vigneti' },
  { nome: 'Erpicatura Tra le File', sottocategoriaCodice: 'lavorazione_terreno_tra_file', descrizione: 'Erpicatura tra le file' },
  { nome: 'Ripasso Tra le File', sottocategoriaCodice: 'lavorazione_terreno_tra_file', descrizione: 'Ripasso lavorazione tra le file' },
  // Lavorazione del Terreno - Sulla Fila
  { nome: 'Vangatura Sulla Fila', sottocategoriaCodice: 'lavorazione_terreno_sulla_fila', descrizione: 'Vangatura sulla fila di frutteti/vigneti' },
  { nome: 'Zappatura Sulla Fila', sottocategoriaCodice: 'lavorazione_terreno_sulla_fila', descrizione: 'Zappatura sulla fila' },
  { nome: 'Diserbo Meccanico Sulla Fila', sottocategoriaCodice: 'lavorazione_terreno_sulla_fila', descrizione: 'Diserbo meccanico sulla fila' },
  // Trattamenti - Manuale
  { nome: 'Trattamento Manuale', sottocategoriaCodice: 'trattamenti_manuale', descrizione: 'Trattamento eseguito manualmente' },
  { nome: 'Trattamento Anticrittogamico Manuale', sottocategoriaCodice: 'trattamenti_manuale', descrizione: 'Trattamento contro malattie fungine eseguito manualmente' },
  { nome: 'Trattamento Insetticida Manuale', sottocategoriaCodice: 'trattamenti_manuale', descrizione: 'Trattamento contro insetti eseguito manualmente' },
  // Trattamenti - Meccanico
  { nome: 'Trattamento Meccanico', sottocategoriaCodice: 'trattamenti_meccanico', descrizione: 'Trattamento eseguito con macchine' },
  { nome: 'Trattamento Anticrittogamico Meccanico', sottocategoriaCodice: 'trattamenti_meccanico', descrizione: 'Trattamento contro malattie fungine con macchine' },
  { nome: 'Trattamento Insetticida Meccanico', sottocategoriaCodice: 'trattamenti_meccanico', descrizione: 'Trattamento contro insetti con macchine' },
  // Concimazione - Manuale
  { nome: 'Concimazione manuale sulla fila', sottocategoriaCodice: 'concimazione_manuale', descrizione: 'Distribuzione manuale lungo la fila' },
  { nome: 'Concimazione manuale a pieno campo', sottocategoriaCodice: 'concimazione_manuale', descrizione: 'Distribuzione manuale su tutta la superficie' },
  // Concimazione - Meccanico
  { nome: 'Concimazione meccanica sulla fila', sottocategoriaCodice: 'concimazione_meccanico', descrizione: 'Distribuzione meccanica lungo la fila' },
  { nome: 'Concimazione meccanica a pieno campo', sottocategoriaCodice: 'concimazione_meccanico', descrizione: 'Distribuzione meccanica su tutta la superficie' },
  // Potatura - Manuale
  { nome: 'Potatura', sottocategoriaCodice: 'potatura_manuale', descrizione: 'Potatura eseguita manualmente' },
  { nome: 'Potatura di Formazione', sottocategoriaCodice: 'potatura_manuale', descrizione: 'Potatura di formazione per giovani piante' },
  { nome: 'Potatura di Produzione', sottocategoriaCodice: 'potatura_manuale', descrizione: 'Potatura di produzione per piante adulte' },
  { nome: 'Potatura di Rinnovamento', sottocategoriaCodice: 'potatura_manuale', descrizione: 'Potatura di rinnovamento per piante vecchie' },
  { nome: 'Innesto', sottocategoriaCodice: 'potatura_manuale', descrizione: 'Innesto di piante' },
  // Potatura - Meccanico
  { nome: 'Pre-potatura Meccanica', sottocategoriaCodice: 'potatura_meccanico', descrizione: 'Pre-potatura eseguita con macchine' },
  { nome: 'Potatura Meccanica', sottocategoriaCodice: 'potatura_meccanico', descrizione: 'Potatura eseguita con macchine' },
  // Raccolta - Manuale
  { nome: 'Raccolta Manuale', sottocategoriaCodice: 'raccolta_manuale', descrizione: 'Raccolta eseguita manualmente' },
  { nome: 'Raccolta con Cestini', sottocategoriaCodice: 'raccolta_manuale', descrizione: 'Raccolta manuale con cestini' },
  { nome: 'Raccolta con Scale', sottocategoriaCodice: 'raccolta_manuale', descrizione: 'Raccolta manuale con scale' },
  { nome: 'Vendemmia Manuale', sottocategoriaCodice: 'raccolta_manuale', descrizione: 'Vendemmia eseguita manualmente (specifico per vigneti)' },
  // Raccolta - Meccanica
  { nome: 'Raccolta Meccanica', sottocategoriaCodice: 'raccolta_meccanica', descrizione: 'Raccolta eseguita con macchine' },
  { nome: 'Raccolta con Scuotitore', sottocategoriaCodice: 'raccolta_meccanica', descrizione: 'Raccolta meccanica con scuotitore' },
  { nome: 'Raccolta con Raccoglitrici', sottocategoriaCodice: 'raccolta_meccanica', descrizione: 'Raccolta con macchine raccoglitrici' },
  { nome: 'Vendemmia Meccanica', sottocategoriaCodice: 'raccolta_meccanica', descrizione: 'Vendemmia eseguita con macchine (specifico per vigneti)' },
  // Gestione del Verde - Manuale
  { nome: 'Falciatura Manuale', sottocategoriaCodice: 'gestione_verde_manuale', descrizione: 'Taglio manuale dell\'erba' },
  { nome: 'Taglio Siepi Manuale', sottocategoriaCodice: 'gestione_verde_manuale', descrizione: 'Taglio manuale delle siepi' },
  { nome: 'Manutenzione Verde Manuale', sottocategoriaCodice: 'gestione_verde_manuale', descrizione: 'Manutenzione estetica del verde eseguita manualmente' },
  { nome: 'Scacchiatura', sottocategoriaCodice: 'gestione_verde_manuale', descrizione: 'Rimozione manuale dei germogli superflui' },
  { nome: 'Spollonatura', sottocategoriaCodice: 'gestione_verde_manuale', descrizione: 'Rimozione manuale dei polloni' },
  { nome: 'Sfemminellatura', sottocategoriaCodice: 'gestione_verde_manuale', descrizione: 'Rimozione manuale dei germogli femminili' },
  { nome: 'Pettinatura', sottocategoriaCodice: 'gestione_verde_manuale', descrizione: 'Pettinatura manuale del verde' },
  // Gestione del Verde - Meccanico
  { nome: 'Potatura a Verde Meccanica', sottocategoriaCodice: 'gestione_verde_meccanico', descrizione: 'Potatura a verde eseguita con macchine' },
  { nome: 'Legatura', sottocategoriaCodice: 'gestione_verde_meccanico', descrizione: 'Legatura meccanica' },
  { nome: 'Defogliatura', sottocategoriaCodice: 'gestione_verde_meccanico', descrizione: 'Defogliatura meccanica' },
  { nome: 'Taglio Siepi Meccanico', sottocategoriaCodice: 'gestione_verde_meccanico', descrizione: 'Taglio delle siepi con macchine' },
  // Semina e Piantagione - Manuale
  { nome: 'Semina Manuale', sottocategoriaCodice: 'semina_piantagione_manuale', descrizione: 'Semina di semi eseguita manualmente' },
  { nome: 'Semina Diretta Manuale', sottocategoriaCodice: 'semina_piantagione_manuale', descrizione: 'Semina diretta in campo eseguita manualmente' },
  { nome: 'Semina in Semenzaio', sottocategoriaCodice: 'semina_piantagione_manuale', descrizione: 'Semina in semenzaio' },
  { nome: 'Trapianto Manuale', sottocategoriaCodice: 'semina_piantagione_manuale', descrizione: 'Trapianto di piantine eseguito manualmente' },
  { nome: 'Trapianto Ortaggi Manuale', sottocategoriaCodice: 'semina_piantagione_manuale', descrizione: 'Trapianto di ortaggi eseguito manualmente' },
  { nome: 'Piantagione Manuale', sottocategoriaCodice: 'semina_piantagione_manuale', descrizione: 'Piantagione di piante eseguita manualmente' },
  { nome: 'Piantagione Alberi Manuale', sottocategoriaCodice: 'semina_piantagione_manuale', descrizione: 'Piantagione di alberi eseguita manualmente' },
  { nome: 'Piantagione Viti Manuale', sottocategoriaCodice: 'semina_piantagione_manuale', descrizione: 'Piantagione di viti eseguita manualmente' },
  // Semina e Piantagione - Meccanico
  { nome: 'Semina Meccanica', sottocategoriaCodice: 'semina_piantagione_meccanico', descrizione: 'Semina di semi eseguita con macchine' },
  { nome: 'Semina Diretta Meccanica', sottocategoriaCodice: 'semina_piantagione_meccanico', descrizione: 'Semina diretta in campo eseguita con macchine' },
  { nome: 'Trapianto Meccanico', sottocategoriaCodice: 'semina_piantagione_meccanico', descrizione: 'Trapianto di piantine eseguito con macchine' },
  { nome: 'Trapianto Ortaggi Meccanico', sottocategoriaCodice: 'semina_piantagione_meccanico', descrizione: 'Trapianto di ortaggi eseguito con macchine' },
  { nome: 'Piantagione Meccanica', sottocategoriaCodice: 'semina_piantagione_meccanico', descrizione: 'Piantagione di piante eseguita con macchine' },
  { nome: 'Piantagione Alberi Meccanica', sottocategoriaCodice: 'semina_piantagione_meccanico', descrizione: 'Piantagione di alberi eseguita con macchine' },
  { nome: 'Piantagione Viti Meccanica', sottocategoriaCodice: 'semina_piantagione_meccanico', descrizione: 'Piantagione di viti eseguita con macchine' },
  // Semina e Piantagione - Impianto
  { nome: 'Impianto Nuovo Vigneto', sottocategoriaCodice: 'semina_piantagione_impianto', descrizione: 'Impianto completo di nuovo vigneto con struttura di sostegno (pali, fili, piante)' },
  { nome: 'Impianto Nuovo Frutteto', sottocategoriaCodice: 'semina_piantagione_impianto', descrizione: 'Impianto completo di nuovo frutteto con struttura di sostegno' },
  { nome: 'Impianto Nuovo Oliveto', sottocategoriaCodice: 'semina_piantagione_impianto', descrizione: 'Impianto completo di nuovo oliveto con struttura di sostegno' },
  // Diserbo - Manuale
  { nome: 'Diserbo Manuale', sottocategoriaCodice: 'diserbo_manuale', descrizione: 'Diserbo eseguito manualmente' },
  { nome: 'Diserbo Localizzato', sottocategoriaCodice: 'diserbo_manuale', descrizione: 'Diserbo localizzato manuale' },
  // Diserbo - Meccanico
  { nome: 'Diserbo a Pieno Campo', sottocategoriaCodice: 'diserbo_meccanico', descrizione: 'Diserbo meccanico a pieno campo' },
  { nome: 'Diserbo sulla Fila', sottocategoriaCodice: 'diserbo_meccanico', descrizione: 'Diserbo meccanico sulla fila' },
  { nome: 'Diserbo Meccanico', sottocategoriaCodice: 'diserbo_meccanico', descrizione: 'Diserbo eseguito con macchine' },
  // Manutenzione
  { nome: 'Riparazioni', categoriaCodice: 'manutenzione', descrizione: 'Riparazioni di attrezzature o impianti' },
  { nome: 'Manutenzione Impianti', categoriaCodice: 'manutenzione', descrizione: 'Manutenzione di impianti irrigui o altri' },
  // Altro
  { nome: 'Altro', categoriaCodice: 'altro', descrizione: 'Altri tipi di lavoro' }
];

// Colture predefinite organizzate per categoria
// Struttura: { nome, categoriaCodice, descrizione }
export const COLTURE_PREDEFINITE = [
  // Frutteto
  { nome: 'Pesco', categoriaCodice: 'frutteto', descrizione: 'Pesco' },
  { nome: 'Melo', categoriaCodice: 'frutteto', descrizione: 'Melo' },
  { nome: 'Pero', categoriaCodice: 'frutteto', descrizione: 'Pero' },
  { nome: 'Albicocche', categoriaCodice: 'frutteto', descrizione: 'Albicocche' },
  { nome: 'Prugne', categoriaCodice: 'frutteto', descrizione: 'Prugne' },
  { nome: 'Ciliegio', categoriaCodice: 'frutteto', descrizione: 'Ciliegio' },
  { nome: 'Susino', categoriaCodice: 'frutteto', descrizione: 'Susino' },
  { nome: 'Fico', categoriaCodice: 'frutteto', descrizione: 'Fico' },
  { nome: 'Nocciolo', categoriaCodice: 'frutteto', descrizione: 'Nocciolo' },
  { nome: 'Mandorlo', categoriaCodice: 'frutteto', descrizione: 'Mandorlo' },
  { nome: 'Castagno', categoriaCodice: 'frutteto', descrizione: 'Castagno' },
  { nome: 'Cotogno', categoriaCodice: 'frutteto', descrizione: 'Cotogno' },
  { nome: 'Sorbo', categoriaCodice: 'frutteto', descrizione: 'Sorbo' },
  { nome: 'Nespolo', categoriaCodice: 'frutteto', descrizione: 'Nespolo' },
  { nome: 'Giuggiolo', categoriaCodice: 'frutteto', descrizione: 'Giuggiolo' },
  { nome: 'Corbezzolo', categoriaCodice: 'frutteto', descrizione: 'Corbezzolo' },
  { nome: 'Gelso', categoriaCodice: 'frutteto', descrizione: 'Gelso' },
  { nome: 'Mora', categoriaCodice: 'frutteto', descrizione: 'Mora' },
  { nome: 'Lampone', categoriaCodice: 'frutteto', descrizione: 'Lampone' },
  { nome: 'Mirtillo', categoriaCodice: 'frutteto', descrizione: 'Mirtillo' },
  { nome: 'Ribes', categoriaCodice: 'frutteto', descrizione: 'Ribes' },
  { nome: 'Uva Spina', categoriaCodice: 'frutteto', descrizione: 'Uva Spina' },
  { nome: 'Kiwi', categoriaCodice: 'frutteto', descrizione: 'Kiwi' },
  { nome: 'Melograno', categoriaCodice: 'frutteto', descrizione: 'Melograno' },
  { nome: 'Fico d\'India', categoriaCodice: 'frutteto', descrizione: 'Fico d\'India' },
  { nome: 'Kaki', categoriaCodice: 'frutteto', descrizione: 'Kaki' },
  { nome: 'Noce', categoriaCodice: 'frutteto', descrizione: 'Noce' },
  { nome: 'Pistacchio', categoriaCodice: 'frutteto', descrizione: 'Pistacchio' },
  // Seminativo
  { nome: 'Grano', categoriaCodice: 'seminativo', descrizione: 'Grano' },
  { nome: 'Mais', categoriaCodice: 'seminativo', descrizione: 'Mais' },
  { nome: 'Orzo', categoriaCodice: 'seminativo', descrizione: 'Orzo' },
  { nome: 'Favino', categoriaCodice: 'seminativo', descrizione: 'Favino' },
  { nome: 'Girasole', categoriaCodice: 'seminativo', descrizione: 'Girasole' },
  { nome: 'Soia', categoriaCodice: 'seminativo', descrizione: 'Soia' },
  { nome: 'Colza', categoriaCodice: 'seminativo', descrizione: 'Colza' },
  { nome: 'Avena', categoriaCodice: 'seminativo', descrizione: 'Avena' },
  { nome: 'Segale', categoriaCodice: 'seminativo', descrizione: 'Segale' },
  { nome: 'Fava', categoriaCodice: 'seminativo', descrizione: 'Fava' },
  { nome: 'Lenticchia', categoriaCodice: 'seminativo', descrizione: 'Lenticchia' },
  { nome: 'Cece', categoriaCodice: 'seminativo', descrizione: 'Cece' },
  { nome: 'Lupino', categoriaCodice: 'seminativo', descrizione: 'Lupino' },
  { nome: 'Cicerchia', categoriaCodice: 'seminativo', descrizione: 'Cicerchia' },
  { nome: 'Riso', categoriaCodice: 'seminativo', descrizione: 'Riso' },
  { nome: 'Grano Saraceno', categoriaCodice: 'seminativo', descrizione: 'Grano Saraceno' },
  { nome: 'Amaranto', categoriaCodice: 'seminativo', descrizione: 'Amaranto' },
  { nome: 'Quinoa', categoriaCodice: 'seminativo', descrizione: 'Quinoa' },
  { nome: 'Canapa', categoriaCodice: 'seminativo', descrizione: 'Canapa' },
  { nome: 'Lino', categoriaCodice: 'seminativo', descrizione: 'Lino' },
  { nome: 'Carthamo', categoriaCodice: 'seminativo', descrizione: 'Carthamo' },
  { nome: 'Erba Medica', categoriaCodice: 'seminativo', descrizione: 'Erba Medica' },
  { nome: 'Trifoglio', categoriaCodice: 'seminativo', descrizione: 'Trifoglio' },
  { nome: 'Veccia', categoriaCodice: 'seminativo', descrizione: 'Veccia' },
  { nome: 'Lupinella', categoriaCodice: 'seminativo', descrizione: 'Lupinella' },
  { nome: 'Sulla', categoriaCodice: 'seminativo', descrizione: 'Sulla' },
  { nome: 'Sorgo', categoriaCodice: 'seminativo', descrizione: 'Sorgo' },
  { nome: 'Miglio', categoriaCodice: 'seminativo', descrizione: 'Miglio' },
  { nome: 'Panico', categoriaCodice: 'seminativo', descrizione: 'Panico' },
  // Vite
  { nome: 'Vite', categoriaCodice: 'vite', descrizione: 'Vigneto' },
  { nome: 'Vite da Tavola', categoriaCodice: 'vite', descrizione: 'Vite da tavola' },
  { nome: 'Vite da Vino', categoriaCodice: 'vite', descrizione: 'Vite da vino' },
  // Ortive
  { nome: 'Pomodoro', categoriaCodice: 'ortive', descrizione: 'Pomodoro' },
  { nome: 'Zucchine', categoriaCodice: 'ortive', descrizione: 'Zucchine' },
  { nome: 'Melanzane', categoriaCodice: 'ortive', descrizione: 'Melanzane' },
  { nome: 'Peperoni', categoriaCodice: 'ortive', descrizione: 'Peperoni' },
  { nome: 'Insalata', categoriaCodice: 'ortive', descrizione: 'Insalata' },
  { nome: 'Carote', categoriaCodice: 'ortive', descrizione: 'Carote' },
  { nome: 'Patate', categoriaCodice: 'ortive', descrizione: 'Patate' },
  { nome: 'Bietole', categoriaCodice: 'ortive', descrizione: 'Bietole' },
  { nome: 'Fragole', categoriaCodice: 'ortive', descrizione: 'Fragole' },
  { nome: 'Cipolle', categoriaCodice: 'ortive', descrizione: 'Cipolle' },
  { nome: 'Aglio', categoriaCodice: 'ortive', descrizione: 'Aglio' },
  { nome: 'Fagioli', categoriaCodice: 'ortive', descrizione: 'Fagioli' },
  { nome: 'Fagiolini', categoriaCodice: 'ortive', descrizione: 'Fagiolini' },
  { nome: 'Piselli', categoriaCodice: 'ortive', descrizione: 'Piselli' },
  { nome: 'Cavolo', categoriaCodice: 'ortive', descrizione: 'Cavolo' },
  { nome: 'Broccoli', categoriaCodice: 'ortive', descrizione: 'Broccoli' },
  { nome: 'Cavolfiore', categoriaCodice: 'ortive', descrizione: 'Cavolfiore' },
  { nome: 'Spinaci', categoriaCodice: 'ortive', descrizione: 'Spinaci' },
  { nome: 'Lattuga', categoriaCodice: 'ortive', descrizione: 'Lattuga' },
  { nome: 'Radicchio', categoriaCodice: 'ortive', descrizione: 'Radicchio' },
  { nome: 'Finocchi', categoriaCodice: 'ortive', descrizione: 'Finocchi' },
  { nome: 'Sedano', categoriaCodice: 'ortive', descrizione: 'Sedano' },
  { nome: 'Cetrioli', categoriaCodice: 'ortive', descrizione: 'Cetrioli' },
  { nome: 'Angurie', categoriaCodice: 'ortive', descrizione: 'Angurie' },
  { nome: 'Meloni', categoriaCodice: 'ortive', descrizione: 'Meloni' },
  // Prato
  { nome: 'Prato', categoriaCodice: 'prato', descrizione: 'Prati e pascoli' },
  { nome: 'Prato Stabile', categoriaCodice: 'prato', descrizione: 'Prato stabile' },
  { nome: 'Pascolo', categoriaCodice: 'prato', descrizione: 'Pascolo' },
  // Olivo
  { nome: 'Olivo', categoriaCodice: 'olivo', descrizione: 'Oliveto' },
  // Agrumeto
  { nome: 'Arancio', categoriaCodice: 'agrumeto', descrizione: 'Arancio' },
  { nome: 'Limone', categoriaCodice: 'agrumeto', descrizione: 'Limone' },
  { nome: 'Mandarino', categoriaCodice: 'agrumeto', descrizione: 'Mandarino' },
  { nome: 'Clementine', categoriaCodice: 'agrumeto', descrizione: 'Clementine' },
  { nome: 'Pompelmo', categoriaCodice: 'agrumeto', descrizione: 'Pompelmo' },
  { nome: 'Bergamotto', categoriaCodice: 'agrumeto', descrizione: 'Bergamotto' },
  { nome: 'Cedro', categoriaCodice: 'agrumeto', descrizione: 'Cedro' },
  { nome: 'Lime', categoriaCodice: 'agrumeto', descrizione: 'Lime' },
  { nome: 'Kumquat', categoriaCodice: 'agrumeto', descrizione: 'Kumquat' },
  // Bosco
  { nome: 'Bosco', categoriaCodice: 'bosco', descrizione: 'Bosco e foresta' }
];

/** Riposiziona tipi già seedati con sottocategoria obsoleta (es. duplicati rimossi dal catalogo). */
export const TIPI_LAVORO_CANONICAL_FIXES = [
  { nome: 'Diserbo Manuale', sottocategoriaCodice: 'diserbo_manuale', descrizione: 'Diserbo eseguito manualmente' },
];

export const SIM_ALIASES_TIPI_LAVORO = [
  { nome: 'Trattamento', sottocategoriaCodice: 'trattamenti_meccanico', descrizione: 'Alias simulatore per trattamenti meccanici' },
  { nome: 'Concimazione', sottocategoriaCodice: 'concimazione_meccanico', descrizione: 'Alias simulatore per concimazioni meccaniche' },
  { nome: 'Controllo fitosanitario', sottocategoriaCodice: 'trattamenti_meccanico', descrizione: 'Alias simulatore per controlli fitosanitari' }
];

/** Nomi tipo lavoro attività sim → codice categoria radice (economia vigneto / legacy sim). */
export const TIPO_LAVORO_CATEGORIA_CODICE = {
  Potatura: 'potatura',
  Trattamento: 'trattamenti',
  Concimazione: 'concimazione',
  'Controllo fitosanitario': 'trattamenti',
  Erpicatura: 'lavorazione_terreno',
};
