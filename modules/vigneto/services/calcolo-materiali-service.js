/**
 * Calcolo Materiali Service - Servizio per calcolo materiali necessari per impianto
 * Calcola pali, fili, tutori, ancore e altri materiali basandosi sulla pianificazione
 * 
 * @module modules/vigneto/services/calcolo-materiali-service
 */

/**
 * Tipi impianto disponibili con configurazioni predefinite
 * Basato su caratteristiche reali dei sistemi di allevamento della vite
 */
export const TIPI_IMPIANTO = {
  'guyot': {
    nome: 'Guyot',
    numeroFiliPortata: 1,              // 1 filo di portata (sostegno principale)
    numeroFiliVegetazione: 3,        // 3 fili di vegetazione (contenimento chioma)
    diametroFiloPortata: 4.5,        // mm - filo più robusto
    diametroFiloVegetazione: 2.5,    // mm - fili più sottili
    necessitaTutori: false,
    necessitaAncore: false,
    lunghezzaLegaturaPerUnita: 0.3,  // metri
    descrizione: 'Sistema a capo a frutto e sperone. 1 filo portata + 3 fili vegetazione'
  },
  'cordone_speronato': {
    nome: 'Cordone Speronato',
    numeroFiliPortata: 1,              // 1 filo di portata
    numeroFiliVegetazione: 3,        // 3 fili di vegetazione
    diametroFiloPortata: 4.5,        // mm
    diametroFiloVegetazione: 2.5,    // mm
    necessitaTutori: false,
    necessitaAncore: false,
    lunghezzaLegaturaPerUnita: 0.3,
    descrizione: 'Sistema a cordone permanente con speroni. 1 filo portata + 3 fili vegetazione'
  },
  'cordone_libero': {
    nome: 'Cordone Libero',
    numeroFiliPortata: 1,              // Solo 1 filo di portata
    numeroFiliVegetazione: 0,        // Nessun filo di vegetazione
    diametroFiloPortata: 5.0,        // mm - diametro maggiore (sostiene tutto)
    diametroFiloVegetazione: 0,      // Non applicabile
    necessitaTutori: false,
    necessitaAncore: false,
    lunghezzaLegaturaPerUnita: 0.3,
    descrizione: 'Sistema a cordone libero. Solo 1 filo portata (nessun filo vegetazione)'
  },
  'pergola': {
    nome: 'Pergola',
    numeroFiliPortata: 2,              // 2 fili di portata (per i due cordoni)
    numeroFiliVegetazione: 2,        // 2 fili di vegetazione
    diametroFiloPortata: 4.5,        // mm
    diametroFiloVegetazione: 2.5,    // mm
    necessitaTutori: true,
    necessitaAncore: true,
    lunghezzaLegaturaPerUnita: 0.5,
    descrizione: 'Sistema a pergola con struttura sopraelevata. 2 fili portata + 2 fili vegetazione'
  },
  'spalliera': {
    nome: 'Spalliera',
    numeroFiliPortata: 1,              // 1 filo di portata
    numeroFiliVegetazione: 2,        // 2 fili di vegetazione
    diametroFiloPortata: 4.5,        // mm
    diametroFiloVegetazione: 2.5,    // mm
    necessitaTutori: false,
    necessitaAncore: false,
    lunghezzaLegaturaPerUnita: 0.4,
    descrizione: 'Sistema a spalliera. 1 filo portata + 2 fili vegetazione'
  },
  'tendone': {
    nome: 'Tendone',
    numeroFiliPortata: 4,              // 4 fili di portata (struttura a tetto)
    numeroFiliVegetazione: 2,        // 2 fili di vegetazione
    diametroFiloPortata: 4.5,        // mm
    diametroFiloVegetazione: 2.5,    // mm
    necessitaTutori: true,
    necessitaAncore: true,
    lunghezzaLegaturaPerUnita: 0.6,
    descrizione: 'Sistema a tendone con struttura a tetto. 4 fili portata + 2 fili vegetazione'
  },
  'sylvoz': {
    nome: 'Sylvoz',
    numeroFiliPortata: 1,              // 1 filo di portata
    numeroFiliVegetazione: 2,        // 2 fili di vegetazione
    diametroFiloPortata: 4.5,        // mm
    diametroFiloVegetazione: 2.5,    // mm
    necessitaTutori: false,
    necessitaAncore: false,
    lunghezzaLegaturaPerUnita: 0.3,
    descrizione: 'Sistema a spalliera con capo a frutto ricadente. 1 filo portata + 2 fili vegetazione'
  },
  'casarsa': {
    nome: 'Casarsa',
    numeroFiliPortata: 1,              // 1 filo di portata
    numeroFiliVegetazione: 3,        // 3 fili di vegetazione
    diametroFiloPortata: 4.5,        // mm
    diametroFiloVegetazione: 2.5,    // mm
    necessitaTutori: false,
    necessitaAncore: false,
    lunghezzaLegaturaPerUnita: 0.3,
    descrizione: 'Sistema a spalliera con cordone permanente. 1 filo portata + 3 fili vegetazione'
  },
  'doppio_capovolto': {
    nome: 'Doppio Capovolto',
    numeroFiliPortata: 1,              // 1 filo di portata centrale
    numeroFiliVegetazione: 2,        // 2 fili di vegetazione (uno per lato)
    diametroFiloPortata: 4.5,        // mm
    diametroFiloVegetazione: 2.5,    // mm
    necessitaTutori: false,
    necessitaAncore: false,
    lunghezzaLegaturaPerUnita: 0.4,
    descrizione: 'Sistema a spalliera con doppio capo a frutto. 1 filo portata + 2 fili vegetazione'
  },
  'raggiera': {
    nome: 'Raggiera',
    numeroFiliPortata: 1,              // 1 filo di portata centrale
    numeroFiliVegetazione: 3,        // 3 fili di vegetazione disposti a raggiera
    diametroFiloPortata: 4.5,        // mm
    diametroFiloVegetazione: 2.5,    // mm
    necessitaTutori: false,
    necessitaAncore: false,
    lunghezzaLegaturaPerUnita: 0.4,
    descrizione: 'Sistema a spalliera con fili disposti a raggiera. 1 filo portata + 3 fili vegetazione'
  },
  'gdc': {
    nome: 'GDC (Geneva Double Curtain)',
    numeroFiliPortata: 2,              // 2 fili di portata (uno per tenda)
    numeroFiliVegetazione: 4,        // 4 fili di vegetazione (2 per tenda)
    diametroFiloPortata: 4.5,        // mm
    diametroFiloVegetazione: 2.5,    // mm
    necessitaTutori: true,
    necessitaAncore: true,
    lunghezzaLegaturaPerUnita: 0.5,
    descrizione: 'Sistema a tenda doppia (Geneva Double Curtain). 2 fili portata + 4 fili vegetazione'
  },
  'lyre': {
    nome: 'Lyre',
    numeroFiliPortata: 2,              // 2 fili di portata (uno per lato)
    numeroFiliVegetazione: 4,        // 4 fili di vegetazione (2 per lato)
    diametroFiloPortata: 4.5,        // mm
    diametroFiloVegetazione: 2.5,    // mm
    necessitaTutori: true,
    necessitaAncore: true,
    lunghezzaLegaturaPerUnita: 0.5,
    descrizione: 'Sistema a Y (Lyre) con vegetazione divisa. 2 fili portata + 4 fili vegetazione'
  },
  'scott_henry': {
    nome: 'Scott Henry',
    numeroFiliPortata: 1,              // 1 filo di portata
    numeroFiliVegetazione: 4,        // 4 fili di vegetazione (2 superiori, 2 inferiori)
    diametroFiloPortata: 4.5,        // mm
    diametroFiloVegetazione: 2.5,    // mm
    necessitaTutori: false,
    necessitaAncore: false,
    lunghezzaLegaturaPerUnita: 0.4,
    descrizione: 'Sistema verticale con vegetazione divisa. 1 filo portata + 4 fili vegetazione'
  },
  'alberello': {
    nome: 'Alberello',
    numeroFiliPortata: 0,              // Nessun filo (solo pali)
    numeroFiliVegetazione: 0,        // Nessun filo di vegetazione
    diametroFiloPortata: 0,          // Non applicabile
    diametroFiloVegetazione: 0,      // Non applicabile
    necessitaTutori: false,
    necessitaAncore: false,
    lunghezzaLegaturaPerUnita: 0.2,
    descrizione: 'Sistema tradizionale senza fili, solo pali di sostegno. Nessun filo necessario'
  },
  'vite_maritata': {
    nome: 'Vite Maritata',
    numeroFiliPortata: 0,              // Nessun filo (sostegno su alberi)
    numeroFiliVegetazione: 0,        // Nessun filo
    diametroFiloPortata: 0,          // Non applicabile
    diametroFiloVegetazione: 0,      // Non applicabile
    necessitaTutori: false,
    necessitaAncore: false,
    lunghezzaLegaturaPerUnita: 0.2,
    descrizione: 'Sistema tradizionale con vite sostenuta da alberi. Nessun filo necessario'
  },
  'spalliera_doppia': {
    nome: 'Spalliera Doppia',
    numeroFiliPortata: 2,              // 2 fili di portata (uno per lato)
    numeroFiliVegetazione: 4,        // 4 fili di vegetazione (2 per lato)
    diametroFiloPortata: 4.5,        // mm
    diametroFiloVegetazione: 2.5,    // mm
    necessitaTutori: false,
    necessitaAncore: false,
    lunghezzaLegaturaPerUnita: 0.4,
    descrizione: 'Sistema a spalliera doppia con vegetazione su entrambi i lati. 2 fili portata + 4 fili vegetazione'
  },
  'cordone_doppio': {
    nome: 'Cordone Doppio',
    numeroFiliPortata: 2,              // 2 fili di portata (uno per cordone)
    numeroFiliVegetazione: 2,        // 2 fili di vegetazione
    diametroFiloPortata: 4.5,        // mm
    diametroFiloVegetazione: 2.5,    // mm
    necessitaTutori: false,
    necessitaAncore: false,
    lunghezzaLegaturaPerUnita: 0.3,
    descrizione: 'Sistema a doppio cordone permanente. 2 fili portata + 2 fili vegetazione'
  }
};

/**
 * Tipi impianto per frutteto (forme di allevamento fruttifere)
 * Chiavi normalizzate da FORME_ALLEVAMENTO_FRUTTETO (lowercase, spazi → underscore)
 */
/**
 * Distanza e altezza pali per forma (metri): da letteratura tecnica frutteti.
 * Spalliera/palmetta: 3-6 m (4 m), h 3-4 m. Fusetto: 6-8 m (7 m), h ~3,2 m. Pergola/kiwi: 5 m, h 3,5 m. Vaso: sesto più ampio.
 */
export const TIPI_IMPIANTO_FRUTTETO = {
  fusetto: {
    nome: 'Fusetto',
    numeroFiliPortata: 1,
    numeroFiliVegetazione: 2,
    diametroFiloPortata: 4.0,
    diametroFiloVegetazione: 2.5,
    necessitaTutori: false,
    necessitaAncore: false,
    lunghezzaLegaturaPerUnita: 0.3,
    distanzaPali: 7,
    altezzaPali: 3.2,
    descrizione: 'Forma in parete con asta centrale. 1 filo portata + 2 fili vegetazione. Pali ogni 6-8 m.'
  },
  leader_centrale: {
    nome: 'Leader centrale',
    numeroFiliPortata: 1,
    numeroFiliVegetazione: 2,
    diametroFiloPortata: 4.0,
    diametroFiloVegetazione: 2.5,
    necessitaTutori: false,
    necessitaAncore: false,
    lunghezzaLegaturaPerUnita: 0.3,
    distanzaPali: 7,
    altezzaPali: 3.2,
    descrizione: 'Forma con asta centrale. 1 filo portata + 2 fili vegetazione. Pali ogni 6-8 m.'
  },
  palmetta: {
    nome: 'Palmetta',
    numeroFiliPortata: 1,
    numeroFiliVegetazione: 2,
    diametroFiloPortata: 4.0,
    diametroFiloVegetazione: 2.5,
    necessitaTutori: false,
    necessitaAncore: false,
    lunghezzaLegaturaPerUnita: 0.4,
    distanzaPali: 4,
    altezzaPali: 3.2,
    descrizione: 'Forma in parete a palmetta. 1 filo portata + 2 fili vegetazione. Pali ogni 3-5 m.'
  },
  palmetta_libera: {
    nome: 'Palmetta libera',
    numeroFiliPortata: 1,
    numeroFiliVegetazione: 2,
    diametroFiloPortata: 4.0,
    diametroFiloVegetazione: 2.5,
    necessitaTutori: false,
    necessitaAncore: false,
    lunghezzaLegaturaPerUnita: 0.4,
    distanzaPali: 4,
    altezzaPali: 3.2,
    descrizione: 'Palmetta libera. 1 filo portata + 2 fili vegetazione. Pali ogni 3-5 m.'
  },
  spalliera: {
    nome: 'Spalliera',
    numeroFiliPortata: 1,
    numeroFiliVegetazione: 2,
    diametroFiloPortata: 4.0,
    diametroFiloVegetazione: 2.5,
    necessitaTutori: false,
    necessitaAncore: false,
    lunghezzaLegaturaPerUnita: 0.4,
    distanzaPali: 4,
    altezzaPali: 3.2,
    descrizione: 'Spalliera frutteto. 1 filo portata + 2 fili vegetazione. Pali ogni 3-5 m (max 5-6 m).'
  },
  cordone: {
    nome: 'Cordone',
    numeroFiliPortata: 1,
    numeroFiliVegetazione: 2,
    diametroFiloPortata: 4.0,
    diametroFiloVegetazione: 2.5,
    necessitaTutori: false,
    necessitaAncore: false,
    lunghezzaLegaturaPerUnita: 0.3,
    distanzaPali: 4,
    altezzaPali: 3.2,
    descrizione: 'Cordone orizzontale. 1 filo portata + 2 fili vegetazione. Pali ogni 3-5 m.'
  },
  pergola: {
    nome: 'Pergola',
    numeroFiliPortata: 2,
    numeroFiliVegetazione: 2,
    diametroFiloPortata: 4.0,
    diametroFiloVegetazione: 2.5,
    necessitaTutori: true,
    necessitaAncore: true,
    lunghezzaLegaturaPerUnita: 0.5,
    distanzaPali: 5,
    altezzaPali: 3.5,
    descrizione: 'Pergola (es. kiwi). 2 fili portata + 2 fili vegetazione. Pali tipicamente 5 m (tendone kiwi).'
  },
  vaso: {
    nome: 'Vaso',
    numeroFiliPortata: 0,
    numeroFiliVegetazione: 0,
    diametroFiloPortata: 0,
    diametroFiloVegetazione: 0,
    necessitaTutori: false,
    necessitaAncore: false,
    lunghezzaLegaturaPerUnita: 0.2,
    distanzaPali: 6,
    altezzaPali: 3,
    descrizione: 'Forma a vaso, solo pali di sostegno. Nessun filo necessario. Sesto più ampio.'
  },
  vaso_globoso: {
    nome: 'Vaso globoso',
    numeroFiliPortata: 0,
    numeroFiliVegetazione: 0,
    diametroFiloPortata: 0,
    diametroFiloVegetazione: 0,
    necessitaTutori: false,
    necessitaAncore: false,
    lunghezzaLegaturaPerUnita: 0.2,
    distanzaPali: 6,
    altezzaPali: 3,
    descrizione: 'Vaso globoso, solo pali. Nessun filo. Sesto più ampio.'
  },
  altro: {
    nome: 'Altro',
    numeroFiliPortata: 1,
    numeroFiliVegetazione: 2,
    diametroFiloPortata: 4.0,
    diametroFiloVegetazione: 2.5,
    necessitaTutori: false,
    necessitaAncore: false,
    lunghezzaLegaturaPerUnita: 0.35,
    distanzaPali: 5,
    altezzaPali: 3,
    descrizione: 'Forma generica. 1 filo portata + 2 fili vegetazione (modificabile).'
  }
};

/**
 * Restituisce l'oggetto tipi impianto per la coltura indicata.
 * @param {string} coltura - 'vigneto' | 'frutteto' | 'oliveto'
 * @returns {Object} Oggetto tipi impianto (chiave -> config)
 */
export function getTipiImpiantoPerColtura(coltura) {
  const c = (coltura || 'vigneto').toLowerCase();
  if (c === 'frutteto') return TIPI_IMPIANTO_FRUTTETO;
  if (c === 'oliveto') return TIPI_IMPIANTO_FRUTTETO; // riuso stesso set per oliveto (vaso, ecc.)
  return TIPI_IMPIANTO;
}

/**
 * Restituisce il tipo impianto di default per la coltura.
 * @param {string} coltura - 'vigneto' | 'frutteto' | 'oliveto'
 * @returns {string} Chiave tipo impianto default
 */
export function getDefaultTipoImpiantoPerColtura(coltura) {
  const c = (coltura || 'vigneto').toLowerCase();
  if (c === 'frutteto' || c === 'oliveto') return 'fusetto';
  return 'guyot';
}

/**
 * Normalizza il nome forma di allevamento (es. "Fusetto", "Vaso globoso") in chiave tecnica (fusetto, vaso_globoso).
 * @param {string} formaAllevamento - Nome visualizzato
 * @returns {string} Chiave normalizzata (lowercase, spazi → underscore)
 */
export function normalizeFormaAllevamentoToKey(formaAllevamento) {
  if (!formaAllevamento || typeof formaAllevamento !== 'string') return '';
  return formaAllevamento.trim().toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[àáâãä]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u');
}

/** Default per tipo struttura antigrandine (distanza pali m, altezza pali m) */
const ANTIGRANDINE_DEFAULT = {
  rete_piana: { distanzaPali: 8, altezzaPali: 4 },
  capannina: { distanzaPali: 10, altezzaPali: 4.5 },
  sistema_v: { distanzaPali: 8, altezzaPali: 4 }
};

/**
 * Calcola materiali necessari per l'impianto
 * @param {Object} pianificazione - Oggetto PianificazioneImpianto
 * @param {Object} configurazione - Configurazione calcolo materiali
 * @param {string} configurazione.tipoImpianto - Tipo impianto (guyot, cordone_speronato, ecc.)
 * @param {number} configurazione.distanzaPali - Distanza tra pali in metri (default: 5.0)
 * @param {number} configurazione.numeroFiliPortata - Numero fili di portata (override tipo impianto, opzionale)
 * @param {number} configurazione.numeroFiliVegetazione - Numero fili di vegetazione (override tipo impianto, opzionale)
 * @param {number} configurazione.diametroFiloPortata - Diametro filo portata in mm (override tipo impianto, opzionale)
 * @param {number} configurazione.diametroFiloVegetazione - Diametro filo vegetazione in mm (override tipo impianto, opzionale)
 * @param {number} configurazione.altezzaPali - Altezza pali in metri (default: 2.5)
 * @param {boolean} configurazione.usaTutori - Usa braccetti strutturali (override tipo impianto, opzionale)
 * @param {boolean} configurazione.usaAncore - Usa ancore (override tipo impianto, opzionale)
 * @param {string} configurazione.fissaggioTutori - Metodo fissaggio tutori: 'legacci' | 'gancetti' (default: 'legacci')
 * @param {Object} [configurazione.antigrandine] - Config reti antigrandine (opzionale)
 * @param {boolean} configurazione.antigrandine.attivo - Se true calcola anche materiali antigrandine
 * @param {string} configurazione.antigrandine.tipoStruttura - 'rete_piana' | 'capannina' | 'sistema_v'
 * @param {number} configurazione.antigrandine.distanzaPali - Distanza tra pali antigrandine (m)
 * @param {number} configurazione.antigrandine.altezzaPali - Altezza pali fuori terra (m)
 * @param {number} configurazione.antigrandine.diametroCavi - Diametro cavi/funi (mm)
 * @param {boolean} configurazione.antigrandine.usaTiranti - Usa tiranti/ancore
 * @returns {Object} Oggetto con elenco materiali calcolati (+ antigrandine se attivo)
 */
export function calcolaMateriali(pianificazione, configurazione = {}) {
  const {
    tipoImpianto: tipoImpiantoFromConfig = null,
    coltura: colturaFromConfig = null,
    distanzaPali = 5.0,
    numeroFiliPortata = null,
    numeroFiliVegetazione = null,
    diametroFiloPortata = null,
    diametroFiloVegetazione = null,
    altezzaPali = 2.5,
    usaTutori = null,
    usaAncore = null,
    fissaggioTutori = 'legacci', // 'legacci' o 'gancetti'
    antigrandine: configAntigrandine = null
  } = configurazione;

  // Coltura: da config, da pianificazione o default vigneto
  const coltura = (colturaFromConfig || (pianificazione && pianificazione.tipoColtura) || 'vigneto').toLowerCase();
  const tipiImpianto = getTipiImpiantoPerColtura(coltura);
  const defaultKey = getDefaultTipoImpiantoPerColtura(coltura);

  // Chiave tipo impianto: da config, da forma allevamento pianificazione (normalizzata) o default
  const tipoImpiantoKey = tipoImpiantoFromConfig
    || (pianificazione && pianificazione.formaAllevamento && normalizeFormaAllevamentoToKey(pianificazione.formaAllevamento))
    || defaultKey;

  // Recupera configurazione tipo impianto dal set della coltura
  const tipoImpiantoConfig = tipiImpianto[tipoImpiantoKey] || tipiImpianto[defaultKey];
  
  // Usa override se specificati, altrimenti usa configurazione tipo impianto
  const numFiliPortata = numeroFiliPortata !== null ? numeroFiliPortata : tipoImpiantoConfig.numeroFiliPortata;
  const numFiliVegetazione = numeroFiliVegetazione !== null ? numeroFiliVegetazione : tipoImpiantoConfig.numeroFiliVegetazione;
  const diamFiloPortata = diametroFiloPortata !== null ? diametroFiloPortata : tipoImpiantoConfig.diametroFiloPortata;
  const diamFiloVegetazione = diametroFiloVegetazione !== null ? diametroFiloVegetazione : tipoImpiantoConfig.diametroFiloVegetazione;
  const necessitaTutori = usaTutori !== null ? usaTutori : tipoImpiantoConfig.necessitaTutori;
  const necessitaAncore = usaAncore !== null ? usaAncore : tipoImpiantoConfig.necessitaAncore;

  // Dati dalla pianificazione
  const numeroFile = pianificazione.numeroFile || 0;
  const numeroUnitaTotale = pianificazione.numeroUnitaTotale || 0;
  
  // Calcola lunghezza filari se non presente (da reticolatoCoords o stima)
  let lunghezzaFilariTotale = pianificazione.lunghezzaFilariTotale || 0;
  if (lunghezzaFilariTotale === 0 && pianificazione.reticolatoCoords && pianificazione.reticolatoCoords.length > 0) {
    // Calcola da coordinate reticolato se disponibili
    // Nota: questo richiederebbe Google Maps API, per ora usiamo una stima
    // Stima: lunghezza media fila = sqrt(superficieNetta / numeroFile) * 2 (approssimazione)
    if (pianificazione.superficieNettaImpianto > 0 && numeroFile > 0) {
      const lunghezzaMediaStimata = Math.sqrt(pianificazione.superficieNettaImpianto * 10000 / numeroFile) * 2;
      lunghezzaFilariTotale = lunghezzaMediaStimata * numeroFile;
    }
  }

  // Calcolo pali
  const lunghezzaMediaFila = numeroFile > 0 ? (lunghezzaFilariTotale / numeroFile) : 0;
  const paliPerFila = Math.ceil(lunghezzaMediaFila / distanzaPali) + 2; // +2 per pali testata
  const numeroPali = numeroFile * paliPerFila;
  const numeroPaliTestata = numeroFile * 2; // 2 pali per fila (inizio e fine)
  const numeroPaliIntermedi = numeroPali - numeroPaliTestata;

  // Calcolo fili (separati per tipo)
  const lunghezzaFiliPortata = numFiliPortata > 0 ? lunghezzaFilariTotale * numFiliPortata : 0;
  const lunghezzaFiliVegetazione = numFiliVegetazione > 0 ? lunghezzaFilariTotale * numFiliVegetazione : 0;
  const lunghezzaFiliTotale = lunghezzaFiliPortata + lunghezzaFiliVegetazione;

  // Calcolo braccetti (sostegni strutturali per pali - solo per sistemi sopraelevati)
  const numeroBraccetti = necessitaTutori ? numeroPali * 2 : 0; // 2 braccetti per palo

  // Calcolo ancore (se necessari)
  const numeroAncore = necessitaAncore ? numeroPaliTestata : 0; // Ancore solo per pali testata

  // Altri materiali
  const numeroTutori = numeroUnitaTotale; // Tutori per sostegno piante (1 per unità)
  
  // Legacci o Gancetti per fissare tutori al filo di portata (solo uno dei due, non entrambi)
  const numeroLegacciTutori = (fissaggioTutori === 'legacci') ? numeroTutori : 0; // Legacci per fissare tutori al filo portata
  const numeroGancettiTutori = (fissaggioTutori === 'gancetti') ? numeroTutori : 0; // Gancetti per fissare tutori al filo portata
  
    const numeroGanci = necessitaTutori ? numeroPali * 2 : 0; // Ganci per braccetti (2 per palo)

  // Calcolo materiali antigrandine (se attivo)
  let antigrandine = null;
  if (configAntigrandine && configAntigrandine.attivo && numeroFile > 0) {
    const tipoStruttura = configAntigrandine.tipoStruttura || 'rete_piana';
    const def = ANTIGRANDINE_DEFAULT[tipoStruttura] || ANTIGRANDINE_DEFAULT.rete_piana;
    const distanzaPaliAntigrandine = configAntigrandine.distanzaPali != null ? configAntigrandine.distanzaPali : def.distanzaPali;
    const altezzaPaliAntigrandine = configAntigrandine.altezzaPali != null ? configAntigrandine.altezzaPali : def.altezzaPali;
    const diametroCavi = configAntigrandine.diametroCavi != null ? configAntigrandine.diametroCavi : 6;
    const usaTirantiAntigrandine = configAntigrandine.usaTiranti !== false;

    const paliPerFilaAntigrandine = Math.ceil(lunghezzaMediaFila / distanzaPaliAntigrandine) + 2;
    const numeroPaliAntigrandine = numeroFile * paliPerFilaAntigrandine;
    const numeroPaliTestataAntigrandine = numeroFile * 2;
    const numeroPaliIntermediAntigrandine = numeroPaliAntigrandine - numeroPaliTestataAntigrandine;

    const lunghezzaColmo = numeroFile * lunghezzaMediaFila;
    const distanzaFile = pianificazione.distanzaFile != null ? pianificazione.distanzaFile : 3;
    const lunghezzaCaviTrasversali = (paliPerFilaAntigrandine - 1) * Math.max(0, numeroFile - 1) * distanzaFile;
    const lunghezzaCaviTotaleAntigrandine = lunghezzaColmo + lunghezzaCaviTrasversali;

    const numeroAncoreAntigrandine = usaTirantiAntigrandine ? numeroPaliTestataAntigrandine : 0;

    const superficieNettaM2 = (pianificazione.superficieNettaImpianto || 0) * 10000;
    const marginePercentuale = configAntigrandine.marginePercentuale != null ? configAntigrandine.marginePercentuale : 10;
    const fattoreMargine = 1 + marginePercentuale / 100;
    const superficieReteM2 = configAntigrandine.superficieReteOverride != null
      ? configAntigrandine.superficieReteOverride
      : Math.round(superficieNettaM2 * fattoreMargine);

    // Accessori: valori precompilati da letteratura (1 copripalo per palo, placchette ~1 ogni 2 m cavi, staffe 2 per palo testata, tendifuni 2 per filare)
    const copripali = configAntigrandine.copripaliOverride != null ? configAntigrandine.copripaliOverride : numeroPaliAntigrandine;
    const placchetteStimate = Math.ceil(lunghezzaCaviTotaleAntigrandine / 2);
    const placchette = configAntigrandine.placchetteOverride != null ? configAntigrandine.placchetteOverride : placchetteStimate;
    const staffeFermafuneStimate = numeroPaliTestataAntigrandine * 2;
    const staffeFermafune = configAntigrandine.staffeFermafuneOverride != null ? configAntigrandine.staffeFermafuneOverride : staffeFermafuneStimate;
    const tendifuniStimati = numeroFile * 2;
    const tendifuni = configAntigrandine.tendifuniOverride != null ? configAntigrandine.tendifuniOverride : tendifuniStimati;

    antigrandine = {
      pali: {
        totale: numeroPaliAntigrandine,
        testata: numeroPaliTestataAntigrandine,
        intermedi: numeroPaliIntermediAntigrandine,
        altezza: altezzaPaliAntigrandine,
        unitaMisura: 'pezzi',
        descrizione: `Pali antigrandine (cemento/ferro), h = ${altezzaPaliAntigrandine}m fuori terra`
      },
      cavi: {
        lunghezza: lunghezzaCaviTotaleAntigrandine,
        lunghezzaColmo,
        lunghezzaTrasversali: lunghezzaCaviTrasversali,
        diametro: diametroCavi,
        unitaMisura: 'metri',
        descrizione: `Cavi/funi acciaio zincato Ø ${diametroCavi}mm per struttura antigrandine`
      },
      ancore: usaTirantiAntigrandine ? {
        totale: numeroAncoreAntigrandine,
        unitaMisura: 'pezzi',
        descrizione: 'Tiranti/ancore per pali di testata antigrandine'
      } : null,
      rete: {
        superficieM2: superficieReteM2,
        unitaMisura: 'm²',
        descrizione: `Rete antigrandine HDPE (m²) - margine ${marginePercentuale}%`
      },
      accessori: {
        copripali: { totale: copripali, unitaMisura: 'pezzi', descrizione: 'Copripali (protezione rete sui pali)' },
        placchette: { totale: placchette, unitaMisura: 'pezzi', descrizione: 'Placchette fissaggio rete al cavo (es. PL4, 1 ogni ~2 m)' },
        staffeFermafune: { totale: staffeFermafune, unitaMisura: 'pezzi', descrizione: 'Staffe fermafune (blocco funi su pali testata)' },
        tendifuni: { totale: tendifuni, unitaMisura: 'pezzi', descrizione: 'Tendifuni/tirafuni (tensionamento cavi)' }
      }
    };
  }

  // Risultato
  return {
    // Pali
    pali: {
      totale: numeroPali,
      testata: numeroPaliTestata,
      intermedi: numeroPaliIntermedi,
      altezza: altezzaPali,
      unitaMisura: 'pezzi',
      descrizione: `Pali in cemento/ferro altezza ${altezzaPali}m`
    },
    
    // Fili (separati per tipo)
    fili: {
      portata: numFiliPortata > 0 ? {
        lunghezza: lunghezzaFiliPortata,
        numero: numFiliPortata,
        diametro: diamFiloPortata,
        unitaMisura: 'metri',
        descrizione: `Fili di portata (${numFiliPortata} per filare, diametro ${diamFiloPortata}mm)`
      } : null,
      vegetazione: numFiliVegetazione > 0 ? {
        lunghezza: lunghezzaFiliVegetazione,
        numero: numFiliVegetazione,
        diametro: diamFiloVegetazione,
        unitaMisura: 'metri',
        descrizione: `Fili di vegetazione (${numFiliVegetazione} per filare, diametro ${diamFiloVegetazione}mm)`
      } : null,
      totale: {
        lunghezza: lunghezzaFiliTotale,
        unitaMisura: 'metri',
        descrizione: numFiliPortata === 0 && numFiliVegetazione === 0 ? 
          'Nessun filo (sistema senza fili di sostegno)' :
          `Filo totale (portata + vegetazione)`
      }
    },
    
    // Braccetti (sostegni strutturali per pali - solo per sistemi sopraelevati)
    braccetti: necessitaTutori ? {
      totale: numeroBraccetti,
      unitaMisura: 'pezzi',
      descrizione: 'Braccetti (sostegni strutturali per pali nelle strutture sopraelevate)'
    } : null,
    
    // Tutori (sostegno per piante - sempre necessari)
    tutori: {
      totale: numeroTutori,
      unitaMisura: 'pezzi',
      descrizione: coltura === 'frutteto' || coltura === 'oliveto'
        ? 'Tutori (sostegno per pianta per farla crescere eretta)'
        : 'Tutori (sostegno per pianta di vite per farla crescere eretta)'
    },
    
    // Ancore (se necessari)
    ancore: necessitaAncore ? {
      totale: numeroAncore,
      unitaMisura: 'pezzi',
      descrizione: 'Ancore per pali testata'
    } : null,
    
    // Altri materiali
    legacci: numeroLegacciTutori > 0 ? {
      totale: numeroLegacciTutori,
      unitaMisura: 'pezzi',
      descrizione: 'Legacci per fissare i tutori al filo di portata (1 legaccio per tutore)'
    } : null,
    
    ganci: numeroGanci > 0 ? {
      totale: numeroGanci,
      unitaMisura: 'pezzi',
      descrizione: 'Ganci per fissare i braccetti ai pali (2 ganci per palo)'
    } : null,
    
    gancettiTutori: numeroGancettiTutori > 0 ? {
      totale: numeroGancettiTutori,
      unitaMisura: 'pezzi',
      descrizione: 'Gancetti per fissare i tutori al filo di portata (1 gancetto per tutore)'
    } : null,
    
    // Dati di riepilogo
    riepilogo: {
      numeroFile: numeroFile,
      numeroUnitaTotale: numeroUnitaTotale,
      lunghezzaFilariTotale: lunghezzaFilariTotale,
      tipoImpianto: tipoImpiantoConfig.nome,
      distanzaPali: distanzaPali,
      numeroFiliPortata: numFiliPortata,
      numeroFiliVegetazione: numFiliVegetazione,
      diametroFiloPortata: diamFiloPortata,
      diametroFiloVegetazione: diamFiloVegetazione
    },

    // Reti antigrandine (solo se config.antigrandine.attivo)
    antigrandine
  };
}

/**
 * Formatta materiali per visualizzazione in tabella
 * @param {Object} materiali - Oggetto materiali da calcolaMateriali()
 * @returns {Array} Array di oggetti per tabella
 */
export function formattaMaterialiPerTabella(materiali) {
  const righe = [];
  
  // Pali
  righe.push({
    categoria: 'Pali',
    materiale: 'Pali Testata',
    quantita: materiali.pali.testata,
    unitaMisura: materiali.pali.unitaMisura,
    descrizione: materiali.pali.descrizione + ' (testata)'
  });
  
  righe.push({
    categoria: 'Pali',
    materiale: 'Pali Intermedi',
    quantita: materiali.pali.intermedi,
    unitaMisura: materiali.pali.unitaMisura,
    descrizione: materiali.pali.descrizione + ' (intermedi)'
  });
  
  righe.push({
    categoria: 'Pali',
    materiale: 'Pali Totali',
    quantita: materiali.pali.totale,
    unitaMisura: materiali.pali.unitaMisura,
    descrizione: materiali.pali.descrizione + ' (totale)',
    isTotal: true
  });
  
  // Fili di Portata (solo se presenti)
  if (materiali.fili.portata) {
    righe.push({
      categoria: 'Fili',
      materiale: 'Fili di Portata',
      quantita: materiali.fili.portata.lunghezza.toFixed(2),
      unitaMisura: materiali.fili.portata.unitaMisura,
      descrizione: `${materiali.fili.portata.descrizione} - Diametro ${materiali.fili.portata.diametro}mm`
    });
  }
  
  // Fili di Vegetazione (solo se presenti)
  if (materiali.fili.vegetazione) {
    righe.push({
      categoria: 'Fili',
      materiale: 'Fili di Vegetazione',
      quantita: materiali.fili.vegetazione.lunghezza.toFixed(2),
      unitaMisura: materiali.fili.vegetazione.unitaMisura,
      descrizione: `${materiali.fili.vegetazione.descrizione} - Diametro ${materiali.fili.vegetazione.diametro}mm`
    });
  }
  
  // Totale Fili
  righe.push({
    categoria: 'Fili',
    materiale: 'Filo Totale',
    quantita: materiali.fili.totale.lunghezza.toFixed(2),
    unitaMisura: materiali.fili.totale.unitaMisura,
    descrizione: materiali.fili.totale.descrizione,
    isTotal: true
  });
  
  // Braccetti (solo per sistemi sopraelevati)
  if (materiali.braccetti) {
    righe.push({
      categoria: 'Supporti',
      materiale: 'Braccetti',
      quantita: materiali.braccetti.totale,
      unitaMisura: materiali.braccetti.unitaMisura,
      descrizione: materiali.braccetti.descrizione + ' (2 braccetti per palo)'
    });
  }
  
  // Tutori (sempre presenti - 1 per unità)
  righe.push({
    categoria: 'Supporti',
    materiale: 'Tutori',
    quantita: materiali.tutori.totale,
    unitaMisura: materiali.tutori.unitaMisura,
    descrizione: materiali.tutori.descrizione + ' (1 tutore per unità)'
  });
  
  // Ancore
  if (materiali.ancore) {
    righe.push({
      categoria: 'Supporti',
      materiale: 'Ancore',
      quantita: materiali.ancore.totale,
      unitaMisura: materiali.ancore.unitaMisura,
      descrizione: materiali.ancore.descrizione
    });
  }
  
  // Legacci per tutori (solo se scelti invece dei gancetti)
  if (materiali.legacci) {
    righe.push({
      categoria: 'Accessori',
      materiale: 'Legacci per Tutori',
      quantita: materiali.legacci.totale,
      unitaMisura: materiali.legacci.unitaMisura,
      descrizione: materiali.legacci.descrizione
    });
  }
  
  // Ganci per braccetti
  if (materiali.ganci) {
    righe.push({
      categoria: 'Accessori',
      materiale: 'Ganci per Braccetti',
      quantita: materiali.ganci.totale,
      unitaMisura: materiali.ganci.unitaMisura,
      descrizione: materiali.ganci.descrizione
    });
  }
  
  // Gancetti per tutori (alternativa ai legacci)
  if (materiali.gancettiTutori) {
    righe.push({
      categoria: 'Accessori',
      materiale: 'Gancetti per Tutori',
      quantita: materiali.gancettiTutori.totale,
      unitaMisura: materiali.gancettiTutori.unitaMisura,
      descrizione: materiali.gancettiTutori.descrizione
    });
  }

  // Reti antigrandine (se presente)
  if (materiali.antigrandine) {
    const ag = materiali.antigrandine;
    righe.push({
      categoria: 'Reti antigrandine',
      materiale: 'Pali antigrandine (testata)',
      quantita: ag.pali.testata,
      unitaMisura: ag.pali.unitaMisura,
      descrizione: ag.pali.descrizione + ' (testata)'
    });
    righe.push({
      categoria: 'Reti antigrandine',
      materiale: 'Pali antigrandine (intermedi)',
      quantita: ag.pali.intermedi,
      unitaMisura: ag.pali.unitaMisura,
      descrizione: ag.pali.descrizione + ' (intermedi)'
    });
    righe.push({
      categoria: 'Reti antigrandine',
      materiale: 'Pali antigrandine (totale)',
      quantita: ag.pali.totale,
      unitaMisura: ag.pali.unitaMisura,
      descrizione: ag.pali.descrizione + ' (totale)',
      isTotal: true
    });
    righe.push({
      categoria: 'Reti antigrandine',
      materiale: 'Cavi/funi struttura',
      quantita: ag.cavi.lunghezza.toFixed(2),
      unitaMisura: ag.cavi.unitaMisura,
      descrizione: ag.cavi.descrizione
    });
    if (ag.ancore) {
      righe.push({
        categoria: 'Reti antigrandine',
        materiale: 'Tiranti/ancore',
        quantita: ag.ancore.totale,
        unitaMisura: ag.ancore.unitaMisura,
        descrizione: ag.ancore.descrizione
      });
    }
    righe.push({
      categoria: 'Reti antigrandine',
      materiale: 'Rete antigrandine',
      quantita: ag.rete.superficieM2,
      unitaMisura: ag.rete.unitaMisura,
      descrizione: ag.rete.descrizione
    });
    if (ag.accessori) {
      righe.push({ categoria: 'Reti antigrandine', materiale: 'Copripali', quantita: ag.accessori.copripali.totale, unitaMisura: ag.accessori.copripali.unitaMisura, descrizione: ag.accessori.copripali.descrizione });
      righe.push({ categoria: 'Reti antigrandine', materiale: 'Placchette fissaggio', quantita: ag.accessori.placchette.totale, unitaMisura: ag.accessori.placchette.unitaMisura, descrizione: ag.accessori.placchette.descrizione });
      righe.push({ categoria: 'Reti antigrandine', materiale: 'Staffe fermafune', quantita: ag.accessori.staffeFermafune.totale, unitaMisura: ag.accessori.staffeFermafune.unitaMisura, descrizione: ag.accessori.staffeFermafune.descrizione });
      righe.push({ categoria: 'Reti antigrandine', materiale: 'Tendifuni/tirafuni', quantita: ag.accessori.tendifuni.totale, unitaMisura: ag.accessori.tendifuni.unitaMisura, descrizione: ag.accessori.tendifuni.descrizione });
    }
  }

  return righe;
}
