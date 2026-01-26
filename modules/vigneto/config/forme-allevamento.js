/**
 * Forme Allevamento Config - Configurazione centralizzata forme di allevamento
 * Fornisce lista unificata basata su TIPI_IMPIANTO con mappatura varianti nome
 * 
 * @module modules/vigneto/config/forme-allevamento
 */

// Importa TIPI_IMPIANTO per uso interno
import { TIPI_IMPIANTO } from '../services/calcolo-materiali-service.js';

// Esporta TIPI_IMPIANTO per uso esterno
export { TIPI_IMPIANTO };

/**
 * Mappatura varianti nome visualizzato → chiave tecnica
 * Varianti di nome che mappano alla stessa configurazione tecnica
 */
const MAPPA_VARIANTI = {
  // Guyot (tutte le varianti → stessa configurazione tecnica)
  'Guyot': 'guyot',
  'Guyot semplice': 'guyot',
  'Guyot doppio': 'guyot',
  
  // Cordone
  'Cordone speronato': 'cordone_speronato',
  'Cordone permanente': 'cordone_speronato', // Cordone permanente = Cordone speronato
  'Cordone Libero': 'cordone_libero',
  'Cordone Doppio': 'cordone_doppio',
  
  // Pergola (tutte le varianti → stessa configurazione tecnica)
  'Pergola': 'pergola',
  'Pergola trentina': 'pergola',
  'Pergola veronese': 'pergola',
  
  // Spalliera
  'Spalliera': 'spalliera',
  'Spalliera semplice': 'spalliera',
  'Spalliera doppia': 'spalliera_doppia',
  
  // Altri sistemi
  'Sylvoz': 'sylvoz',
  'Casarsa': 'casarsa',
  'Tendone': 'tendone',
  'Alberello': 'alberello',
  'Cappuccina': 'spalliera', // Variante di spalliera
  'Ritocchino': 'spalliera', // Variante di spalliera
  'Sistema a tenda': 'tendone',
  'Sistema a cortina': 'spalliera',
  'Sistema a raggiera': 'raggiera'
};

/**
 * Ottieni lista nomi per dropdown (tutti i nomi unici)
 * Include nomi base da TIPI_IMPIANTO + varianti comuni
 * @returns {Array<string>} Array di nomi ordinati alfabeticamente
 */
export function getFormeAllevamentoList() {
  // Prendi tutti i nomi base da TIPI_IMPIANTO
  const nomiBase = Object.values(TIPI_IMPIANTO).map(t => t.nome);
  
  // Aggiungi varianti che non sono già nei nomi base
  const varianti = Object.keys(MAPPA_VARIANTI).filter(k => !nomiBase.includes(k));
  
  // Combina e ordina
  return [...nomiBase, ...varianti].sort();
}

/**
 * Mappa nome visualizzato → chiave tecnica
 * @param {string} nomeVisualizzato - Nome visualizzato (es. "Guyot semplice")
 * @returns {string|null} Chiave tecnica (es. "guyot") o null se non trovato
 */
export function getChiaveTecnica(nomeVisualizzato) {
  if (!nomeVisualizzato) return null;
  
  // Se è già una chiave tecnica, ritorna direttamente
  if (TIPI_IMPIANTO[nomeVisualizzato]) {
    return nomeVisualizzato;
  }
  
  // Altrimenti cerca nella mappa varianti
  return MAPPA_VARIANTI[nomeVisualizzato] || null;
}

/**
 * Ottieni configurazione impianto da chiave tecnica o nome visualizzato
 * @param {string} chiaveONome - Chiave tecnica (es. "guyot") o nome visualizzato (es. "Guyot semplice")
 * @returns {Object|null} Configurazione impianto o null se non trovato
 */
export function getConfigurazioneImpianto(chiaveONome) {
  if (!chiaveONome) return null;
  
  // Se è già una chiave tecnica, ritorna direttamente
  if (TIPI_IMPIANTO[chiaveONome]) {
    return TIPI_IMPIANTO[chiaveONome];
  }
  
  // Altrimenti mappa il nome alla chiave tecnica
  const chiave = MAPPA_VARIANTI[chiaveONome];
  return chiave ? TIPI_IMPIANTO[chiave] : null;
}

/**
 * Ottieni nome visualizzato da chiave tecnica
 * @param {string} chiaveTecnica - Chiave tecnica (es. "guyot")
 * @returns {string|null} Nome visualizzato (es. "Guyot") o null se non trovato
 */
export function getNomeVisualizzato(chiaveTecnica) {
  if (!chiaveTecnica) return null;
  
  const config = TIPI_IMPIANTO[chiaveTecnica];
  return config ? config.nome : null;
}
