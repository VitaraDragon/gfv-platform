/**
 * Trattamenti Vigneto Service - Servizio per gestione trattamenti vigneto
 * Gestisce CRUD trattamenti con calcolo costi e giorni di carenza
 * 
 * @module modules/vigneto/services/trattamenti-vigneto-service
 */

import { 
  getCollectionData,
  getDocumentData,
  createDocument,
  updateDocument,
  deleteDocument,
  dateToTimestamp
} from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { TrattamentoVigneto } from '../models/TrattamentoVigneto.js';
import { getVigneto, updateVigneto } from './vigneti-service.js';

const SUB_COLLECTION_NAME = 'trattamenti';

/**
 * Ottieni path sub-collection trattamenti per un vigneto
 * @param {string} vignetoId - ID vigneto
 * @returns {string} Path sub-collection
 */
function getTrattamentiPath(vignetoId) {
  return `vigneti/${vignetoId}/${SUB_COLLECTION_NAME}`;
}

/**
 * Ottieni tutti i trattamenti di un vigneto
 * @param {string} vignetoId - ID vigneto
 * @param {Object} options - Opzioni di query
 * @param {string} options.orderBy - Campo per ordinamento (default: 'data')
 * @param {string} options.orderDirection - Direzione ordinamento ('asc' | 'desc', default: 'desc')
 * @param {string} options.tipoTrattamento - Filtra per tipo trattamento (opzionale)
 * @param {number} options.anno - Filtra per anno (opzionale)
 * @returns {Promise<Array<TrattamentoVigneto>>} Array di trattamenti
 */
export async function getTrattamenti(vignetoId, options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!vignetoId) {
      throw new Error('ID vigneto obbligatorio');
    }
    
    const { 
      orderBy = 'data', 
      orderDirection = 'desc',
      tipoTrattamento = null,
      anno = null
    } = options;
    
    const collectionPath = getTrattamentiPath(vignetoId);
    const whereFilters = [];
    
    if (tipoTrattamento) {
      whereFilters.push(['tipoTrattamento', '==', tipoTrattamento]);
    }
    
    if (anno) {
      const inizioAnno = new Date(anno, 0, 1);
      const fineAnno = new Date(anno + 1, 0, 1);
      whereFilters.push(['data', '>=', dateToTimestamp(inizioAnno)]);
      whereFilters.push(['data', '<', dateToTimestamp(fineAnno)]);
    }
    
    const documents = await getCollectionData(collectionPath, {
      tenantId,
      orderBy,
      orderDirection,
      where: whereFilters.length > 0 ? whereFilters : undefined
    });
    
    return documents.map(doc => TrattamentoVigneto.fromData(doc));
  } catch (error) {
    console.error('Errore recupero trattamenti:', error);
    if (error.message.includes('tenant') || error.message.includes('obbligatorio')) {
      throw new Error(`Errore recupero trattamenti: ${error.message}`);
    }
    return [];
  }
}

/**
 * Ottieni un trattamento per ID
 * @param {string} vignetoId - ID vigneto
 * @param {string} trattamentoId - ID trattamento
 * @returns {Promise<TrattamentoVigneto|null>} Trattamento o null se non trovato
 */
export async function getTrattamento(vignetoId, trattamentoId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!vignetoId || !trattamentoId) {
      throw new Error('ID vigneto e trattamento obbligatori');
    }
    
    const collectionPath = getTrattamentiPath(vignetoId);
    const data = await getDocumentData(collectionPath, trattamentoId, tenantId);
    
    if (!data) {
      return null;
    }
    
    return TrattamentoVigneto.fromData({ ...data, id: trattamentoId });
  } catch (error) {
    console.error('Errore recupero trattamento:', error);
    throw new Error(`Errore recupero trattamento: ${error.message}`);
  }
}

/**
 * Crea un nuovo trattamento
 * @param {string} vignetoId - ID vigneto
 * @param {Object} trattamentoData - Dati trattamento
 * @returns {Promise<string>} ID trattamento creato
 */
export async function createTrattamento(vignetoId, trattamentoData) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!vignetoId) {
      throw new Error('ID vigneto obbligatorio');
    }
    
    const vigneto = await getVigneto(vignetoId);
    if (!vigneto) {
      throw new Error('Vigneto non trovato');
    }
    
    const trattamento = new TrattamentoVigneto({
      ...trattamentoData,
      vignetoId
    });
    
    const validation = trattamento.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    trattamento.aggiornaCalcoli();
    
    // TODO: Calcola costo manodopera e macchina (da implementare)
    
    const collectionPath = getTrattamentiPath(vignetoId);
    const trattamentoId = await createDocument(collectionPath, trattamento.toFirestore(), tenantId);
    
    await aggiornaVignetoDaTrattamento(vignetoId, trattamento);
    
    return trattamentoId;
  } catch (error) {
    console.error('Errore creazione trattamento:', error);
    throw new Error(`Errore creazione trattamento: ${error.message}`);
  }
}

/**
 * Aggiorna un trattamento esistente
 * @param {string} vignetoId - ID vigneto
 * @param {string} trattamentoId - ID trattamento
 * @param {Object} updates - Dati da aggiornare
 * @returns {Promise<void>}
 */
export async function updateTrattamento(vignetoId, trattamentoId, updates) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!vignetoId || !trattamentoId) {
      throw new Error('ID vigneto e trattamento obbligatori');
    }
    
    const trattamentoEsistente = await getTrattamento(vignetoId, trattamentoId);
    if (!trattamentoEsistente) {
      throw new Error('Trattamento non trovato');
    }
    
    trattamentoEsistente.update(updates);
    
    const validation = trattamentoEsistente.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    trattamentoEsistente.aggiornaCalcoli();
    
    const collectionPath = getTrattamentiPath(vignetoId);
    await updateDocument(collectionPath, trattamentoId, trattamentoEsistente.toFirestore(), tenantId);
    
    await aggiornaVignetoDaTrattamento(vignetoId, trattamentoEsistente);
  } catch (error) {
    console.error('Errore aggiornamento trattamento:', error);
    throw new Error(`Errore aggiornamento trattamento: ${error.message}`);
  }
}

/**
 * Elimina un trattamento
 * @param {string} vignetoId - ID vigneto
 * @param {string} trattamentoId - ID trattamento
 * @returns {Promise<void>}
 */
export async function deleteTrattamento(vignetoId, trattamentoId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!vignetoId || !trattamentoId) {
      throw new Error('ID vigneto e trattamento obbligatori');
    }
    
    const collectionPath = getTrattamentiPath(vignetoId);
    await deleteDocument(collectionPath, trattamentoId, tenantId);
    
    await ricalcolaSpeseTrattamentiVigneto(vignetoId);
  } catch (error) {
    console.error('Errore eliminazione trattamento:', error);
    throw new Error(`Errore eliminazione trattamento: ${error.message}`);
  }
}

/**
 * Aggiorna vigneto basandosi su un trattamento
 * @param {string} vignetoId - ID vigneto
 * @param {TrattamentoVigneto} trattamento - Trattamento
 * @returns {Promise<void>}
 */
async function aggiornaVignetoDaTrattamento(vignetoId, trattamento) {
  try {
    const trattamenti = await getTrattamenti(vignetoId);
    
    const annoCorrente = new Date().getFullYear();
    const trattamentiAnnoCorrente = trattamenti.filter(t => {
      const dataTrattamento = t.data instanceof Date ? t.data : (t.data?.toDate ? t.data.toDate() : new Date(t.data));
      return dataTrattamento.getFullYear() === annoCorrente;
    });
    
    const speseTrattamentiAnno = trattamentiAnnoCorrente.reduce((sum, t) => sum + (t.costoTotale || 0), 0);
    
    const dataTrattamento = trattamento.data instanceof Date ? trattamento.data : (trattamento.data?.toDate ? trattamento.data.toDate() : new Date(trattamento.data));
    const dataUltimoTrattamento = trattamenti.length > 0 
      ? trattamenti.reduce((latest, t) => {
          const tData = t.data instanceof Date ? t.data : (t.data?.toDate ? t.data.toDate() : new Date(t.data));
          return tData > latest ? tData : latest;
        }, dataTrattamento)
      : dataTrattamento;
    
    await updateVigneto(vignetoId, {
      dataUltimoTrattamento: dateToTimestamp(dataUltimoTrattamento),
      speseTrattamentiAnno: parseFloat(speseTrattamentiAnno.toFixed(2))
    });
  } catch (error) {
    console.error('Errore aggiornamento vigneto da trattamento:', error);
  }
}

/**
 * Ricalcola spese trattamenti vigneto
 * @param {string} vignetoId - ID vigneto
 * @returns {Promise<void>}
 */
async function ricalcolaSpeseTrattamentiVigneto(vignetoId) {
  try {
    const trattamenti = await getTrattamenti(vignetoId);
    const annoCorrente = new Date().getFullYear();
    const trattamentiAnnoCorrente = trattamenti.filter(t => {
      const dataTrattamento = t.data instanceof Date ? t.data : (t.data?.toDate ? t.data.toDate() : new Date(t.data));
      return dataTrattamento.getFullYear() === annoCorrente;
    });
    
    const speseTrattamentiAnno = trattamentiAnnoCorrente.reduce((sum, t) => sum + (t.costoTotale || 0), 0);
    
    await updateVigneto(vignetoId, {
      speseTrattamentiAnno: parseFloat(speseTrattamentiAnno.toFixed(2))
    });
  } catch (error) {
    console.error('Errore ricalcolo spese trattamenti:', error);
  }
}

/**
 * Ottieni prossimi trattamenti programmati (con alert giorni carenza)
 * @param {string} vignetoId - ID vigneto
 * @param {Date} dataVendemmiaPrevista - Data vendemmia prevista (opzionale)
 * @returns {Promise<Array<TrattamentoVigneto>>} Array di trattamenti con alert
 */
export async function getProssimiTrattamenti(vignetoId, dataVendemmiaPrevista = null) {
  try {
    const trattamenti = await getTrattamenti(vignetoId, { orderBy: 'data', orderDirection: 'asc' });
    
    if (!dataVendemmiaPrevista) {
      return trattamenti;
    }
    
    // Filtra trattamenti che potrebbero interferire con vendemmia
    return trattamenti.filter(t => {
      if (t.giorniCarenza && t.dataRaccoltaMinima) {
        return t.isTroppoVicinoAVendemmia(dataVendemmiaPrevista);
      }
      return false;
    });
  } catch (error) {
    console.error('Errore recupero prossimi trattamenti:', error);
    return [];
  }
}
