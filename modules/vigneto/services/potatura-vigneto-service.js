/**
 * Potatura Vigneto Service - Servizio per gestione potature vigneto
 * Gestisce CRUD potature con calcolo costi e aggiornamento dati vigneto
 * 
 * @module modules/vigneto/services/potatura-vigneto-service
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
import { PotaturaVigneto } from '../models/PotaturaVigneto.js';
import { getVigneto, updateVigneto } from './vigneti-service.js';

const SUB_COLLECTION_NAME = 'potature';

/**
 * Ottieni path sub-collection potature per un vigneto
 * @param {string} vignetoId - ID vigneto
 * @returns {string} Path sub-collection
 */
function getPotaturePath(vignetoId) {
  return `vigneti/${vignetoId}/${SUB_COLLECTION_NAME}`;
}

/**
 * Ottieni tutte le potature di un vigneto
 * @param {string} vignetoId - ID vigneto
 * @param {Object} options - Opzioni di query
 * @param {string} options.orderBy - Campo per ordinamento (default: 'data')
 * @param {string} options.orderDirection - Direzione ordinamento ('asc' | 'desc', default: 'desc')
 * @param {string} options.tipo - Filtra per tipo potatura (opzionale)
 * @param {number} options.anno - Filtra per anno (opzionale)
 * @returns {Promise<Array<PotaturaVigneto>>} Array di potature
 */
export async function getPotature(vignetoId, options = {}) {
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
      tipo = null,
      anno = null
    } = options;
    
    const collectionPath = getPotaturePath(vignetoId);
    const whereFilters = [];
    
    if (tipo) {
      whereFilters.push(['tipo', '==', tipo]);
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
    
    return documents.map(doc => PotaturaVigneto.fromData(doc));
  } catch (error) {
    console.error('Errore recupero potature:', error);
    if (error.message.includes('tenant') || error.message.includes('obbligatorio')) {
      throw new Error(`Errore recupero potature: ${error.message}`);
    }
    return [];
  }
}

/**
 * Ottieni una potatura per ID
 * @param {string} vignetoId - ID vigneto
 * @param {string} potaturaId - ID potatura
 * @returns {Promise<PotaturaVigneto|null>} Potatura o null se non trovata
 */
export async function getPotatura(vignetoId, potaturaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!vignetoId || !potaturaId) {
      throw new Error('ID vigneto e potatura obbligatori');
    }
    
    const collectionPath = getPotaturePath(vignetoId);
    const data = await getDocumentData(collectionPath, potaturaId, tenantId);
    
    if (!data) {
      return null;
    }
    
    return PotaturaVigneto.fromData({ ...data, id: potaturaId });
  } catch (error) {
    console.error('Errore recupero potatura:', error);
    throw new Error(`Errore recupero potatura: ${error.message}`);
  }
}

/**
 * Crea una nuova potatura
 * @param {string} vignetoId - ID vigneto
 * @param {Object} potaturaData - Dati potatura
 * @returns {Promise<string>} ID potatura creata
 */
export async function createPotatura(vignetoId, potaturaData) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!vignetoId) {
      throw new Error('ID vigneto obbligatorio');
    }
    
    // Verifica che il vigneto esista
    const vigneto = await getVigneto(vignetoId);
    if (!vigneto) {
      throw new Error('Vigneto non trovato');
    }
    
    // Crea modello e valida
    const potatura = new PotaturaVigneto({
      ...potaturaData,
      vignetoId
    });
    
    const validation = potatura.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Aggiorna calcoli automatici
    potatura.aggiornaCalcoli();
    
    // TODO: Calcola costo manodopera (da implementare con tariffe)
    // Per ora, costoManodopera deve essere fornito o calcolato altrove
    
    // Salva su Firestore
    const collectionPath = getPotaturePath(vignetoId);
    const potaturaId = await createDocument(collectionPath, potatura.toFirestore(), tenantId);
    
    // Aggiorna vigneto: data ultima potatura e spese potatura anno
    await aggiornaVignetoDaPotatura(vignetoId, potatura);
    
    return potaturaId;
  } catch (error) {
    console.error('Errore creazione potatura:', error);
    throw new Error(`Errore creazione potatura: ${error.message}`);
  }
}

/**
 * Aggiorna una potatura esistente
 * @param {string} vignetoId - ID vigneto
 * @param {string} potaturaId - ID potatura
 * @param {Object} updates - Dati da aggiornare
 * @returns {Promise<void>}
 */
export async function updatePotatura(vignetoId, potaturaId, updates) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!vignetoId || !potaturaId) {
      throw new Error('ID vigneto e potatura obbligatori');
    }
    
    const potaturaEsistente = await getPotatura(vignetoId, potaturaId);
    if (!potaturaEsistente) {
      throw new Error('Potatura non trovata');
    }
    
    potaturaEsistente.update(updates);
    
    const validation = potaturaEsistente.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    potaturaEsistente.aggiornaCalcoli();
    
    const collectionPath = getPotaturePath(vignetoId);
    await updateDocument(collectionPath, potaturaId, potaturaEsistente.toFirestore(), tenantId);
    
    await aggiornaVignetoDaPotatura(vignetoId, potaturaEsistente);
  } catch (error) {
    console.error('Errore aggiornamento potatura:', error);
    throw new Error(`Errore aggiornamento potatura: ${error.message}`);
  }
}

/**
 * Elimina una potatura
 * @param {string} vignetoId - ID vigneto
 * @param {string} potaturaId - ID potatura
 * @returns {Promise<void>}
 */
export async function deletePotatura(vignetoId, potaturaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!vignetoId || !potaturaId) {
      throw new Error('ID vigneto e potatura obbligatori');
    }
    
    const collectionPath = getPotaturePath(vignetoId);
    await deleteDocument(collectionPath, potaturaId, tenantId);
    
    await ricalcolaSpesePotaturaVigneto(vignetoId);
  } catch (error) {
    console.error('Errore eliminazione potatura:', error);
    throw new Error(`Errore eliminazione potatura: ${error.message}`);
  }
}

/**
 * Aggiorna vigneto basandosi su una potatura
 * @param {string} vignetoId - ID vigneto
 * @param {PotaturaVigneto} potatura - Potatura
 * @returns {Promise<void>}
 */
async function aggiornaVignetoDaPotatura(vignetoId, potatura) {
  try {
    const potature = await getPotature(vignetoId);
    
    const annoCorrente = new Date().getFullYear();
    const potatureAnnoCorrente = potature.filter(p => {
      const dataPotatura = p.data instanceof Date ? p.data : (p.data?.toDate ? p.data.toDate() : new Date(p.data));
      return dataPotatura.getFullYear() === annoCorrente;
    });
    
    const spesePotaturaAnno = potatureAnnoCorrente.reduce((sum, p) => sum + (p.costoTotale || 0), 0);
    
    const dataPotatura = potatura.data instanceof Date ? potatura.data : (potatura.data?.toDate ? potatura.data.toDate() : new Date(potatura.data));
    const dataUltimaPotatura = potature.length > 0 
      ? potature.reduce((latest, p) => {
          const pData = p.data instanceof Date ? p.data : (p.data?.toDate ? p.data.toDate() : new Date(p.data));
          return pData > latest ? pData : latest;
        }, dataPotatura)
      : dataPotatura;
    
    await updateVigneto(vignetoId, {
      dataUltimaPotatura: dateToTimestamp(dataUltimaPotatura),
      spesePotaturaAnno: parseFloat(spesePotaturaAnno.toFixed(2))
    });
  } catch (error) {
    console.error('Errore aggiornamento vigneto da potatura:', error);
  }
}

/**
 * Ricalcola spese potatura vigneto
 * @param {string} vignetoId - ID vigneto
 * @returns {Promise<void>}
 */
async function ricalcolaSpesePotaturaVigneto(vignetoId) {
  try {
    const potature = await getPotature(vignetoId);
    const annoCorrente = new Date().getFullYear();
    const potatureAnnoCorrente = potature.filter(p => {
      const dataPotatura = p.data instanceof Date ? p.data : (p.data?.toDate ? p.data.toDate() : new Date(p.data));
      return dataPotatura.getFullYear() === annoCorrente;
    });
    
    const spesePotaturaAnno = potatureAnnoCorrente.reduce((sum, p) => sum + (p.costoTotale || 0), 0);
    
    await updateVigneto(vignetoId, {
      spesePotaturaAnno: parseFloat(spesePotaturaAnno.toFixed(2))
    });
  } catch (error) {
    console.error('Errore ricalcolo spese potatura:', error);
  }
}
