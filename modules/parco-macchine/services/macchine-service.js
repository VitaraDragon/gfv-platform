/**
 * Macchine Service - Servizio per gestione macchine/mezzi agricoli
 * Gestisce CRUD macchine con supporto multi-tenant
 * 
 * @module modules/parco-macchine/services/macchine-service
 */

import { 
  createDocument, 
  getDocumentData, 
  updateDocument,
  deleteDocument,
  getCollectionData 
} from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { Macchina } from '../models/Macchina.js';

const COLLECTION_NAME = 'macchine';

/**
 * Ottieni tutte le macchine del tenant corrente
 * @param {Object} options - Opzioni di query
 * @param {string} options.orderBy - Campo per ordinamento (default: 'nome')
 * @param {string} options.orderDirection - Direzione ordinamento ('asc' | 'desc')
 * @param {string} options.stato - Filtra per stato (opzionale)
 * @param {string} options.tipo - Filtra per tipo (opzionale)
 * @param {boolean} options.soloAttive - Se true, mostra solo macchine attive (non dismesse)
 * @returns {Promise<Array<Macchina>>} Array di macchine
 */
export async function getAllMacchine(options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const { 
      orderBy = 'nome', 
      orderDirection = 'asc',
      stato = null,
      tipo = null,
      tipoMacchina = null, // Nuovo campo per distinguere trattore/attrezzo
      categoriaFunzione = null, // Per filtrare attrezzi per categoria
      soloAttive = false
    } = options;
    
    const whereConditions = [];
    
    if (stato) {
      whereConditions.push(['stato', '==', stato]);
    }
    
    // Supporta sia tipo (vecchio) che tipoMacchina (nuovo)
    if (tipoMacchina) {
      whereConditions.push(['tipoMacchina', '==', tipoMacchina]);
    } else if (tipo) {
      // Retrocompatibilità: se tipo è 'trattore' o 'attrezzo', usa tipoMacchina
      if (tipo === 'trattore' || tipo === 'attrezzo') {
        whereConditions.push(['tipoMacchina', '==', tipo]);
      } else {
        whereConditions.push(['tipo', '==', tipo]);
      }
    }
    
    if (categoriaFunzione) {
      whereConditions.push(['categoriaFunzione', '==', categoriaFunzione]);
    }
    
    if (soloAttive) {
      whereConditions.push(['stato', '!=', 'dismesso']);
    }
    
    const documents = await getCollectionData(COLLECTION_NAME, {
      tenantId,
      orderBy,
      orderDirection,
      where: whereConditions.length > 0 ? whereConditions : undefined
    });
    
    return documents.map(doc => Macchina.fromData(doc));
  } catch (error) {
    console.error('Errore recupero macchine:', error);
    throw new Error(`Errore recupero macchine: ${error.message}`);
  }
}

/**
 * Ottieni macchine disponibili (stato = 'disponibile')
 * @returns {Promise<Array<Macchina>>} Array di macchine disponibili
 */
export async function getMacchineDisponibili() {
  return getAllMacchine({ stato: 'disponibile', soloAttive: true });
}

/**
 * Ottieni solo trattori
 * @param {Object} options - Opzioni di query
 * @returns {Promise<Array<Macchina>>} Array di trattori
 */
export async function getTrattori(options = {}) {
  return getAllMacchine({ ...options, tipoMacchina: 'trattore' });
}

/**
 * Ottieni solo attrezzi
 * @param {Object} options - Opzioni di query
 * @param {string} options.categoriaFunzione - Filtra per categoria (opzionale)
 * @returns {Promise<Array<Macchina>>} Array di attrezzi
 */
export async function getAttrezzi(options = {}) {
  const { categoriaFunzione, ...otherOptions } = options;
  const queryOptions = { ...otherOptions, tipoMacchina: 'attrezzo' };
  
  if (categoriaFunzione) {
    queryOptions.categoriaFunzione = categoriaFunzione;
  }
  
  return getAllMacchine(queryOptions);
}

/**
 * Ottieni attrezzi compatibili con un trattore (basato su cavalli)
 * @param {string} trattoreId - ID trattore
 * @returns {Promise<Array<Macchina>>} Array di attrezzi compatibili
 */
export async function getAttrezziCompatibili(trattoreId) {
  try {
    const trattore = await getMacchina(trattoreId);
    if (!trattore || !trattore.isTrattore()) {
      throw new Error('Trattore non trovato o non valido');
    }
    
    if (trattore.cavalli === null || trattore.cavalli === undefined) {
      return [];
    }
    
    const tuttiAttrezzi = await getAttrezzi({ soloAttive: true });
    
    return tuttiAttrezzi.filter(attrezzo => {
      return attrezzo.isCompatibleWith(trattore);
    });
  } catch (error) {
    console.error('Errore recupero attrezzi compatibili:', error);
    throw new Error(`Errore recupero attrezzi compatibili: ${error.message}`);
  }
}

/**
 * Ottieni trattori compatibili con un attrezzo (basato su cavalli)
 * @param {string} attrezzoId - ID attrezzo
 * @returns {Promise<Array<Macchina>>} Array di trattori compatibili
 */
export async function getTrattoriCompatibili(attrezzoId) {
  try {
    const attrezzo = await getMacchina(attrezzoId);
    if (!attrezzo || !attrezzo.isAttrezzo()) {
      throw new Error('Attrezzo non trovato o non valido');
    }
    
    if (attrezzo.cavalliMinimiRichiesti === null || attrezzo.cavalliMinimiRichiesti === undefined) {
      return [];
    }
    
    const tuttiTrattori = await getTrattori({ soloAttive: true });
    
    return tuttiTrattori.filter(trattore => {
      return attrezzo.isCompatibleWith(trattore);
    });
  } catch (error) {
    console.error('Errore recupero trattori compatibili:', error);
    throw new Error(`Errore recupero trattori compatibili: ${error.message}`);
  }
}

/**
 * Ottieni una macchina per ID
 * @param {string} macchinaId - ID macchina
 * @returns {Promise<Macchina|null>} Macchina o null se non trovata
 */
export async function getMacchina(macchinaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!macchinaId) {
      throw new Error('ID macchina obbligatorio');
    }
    
    const data = await getDocumentData(COLLECTION_NAME, macchinaId, tenantId);
    
    if (!data) {
      return null;
    }
    
    return Macchina.fromData(data);
  } catch (error) {
    console.error('Errore recupero macchina:', error);
    throw new Error(`Errore recupero macchina: ${error.message}`);
  }
}

/**
 * Crea una nuova macchina
 * @param {Object} macchinaData - Dati macchina
 * @param {string} macchinaData.nome - Nome macchina (obbligatorio)
 * @param {string} macchinaData.tipo - Tipo macchina (obbligatorio)
 * @param {string} macchinaData.marca - Marca (opzionale)
 * @param {string} macchinaData.modello - Modello (opzionale)
 * @param {string} macchinaData.targa - Targa (opzionale)
 * @param {string} macchinaData.numeroTelaio - Numero telaio (opzionale)
 * @param {Date|string} macchinaData.dataAcquisto - Data acquisto (opzionale)
 * @param {number} macchinaData.oreIniziali - Ore iniziali (opzionale, default: 0)
 * @param {string} macchinaData.stato - Stato (opzionale, default: 'disponibile')
 * @param {string} macchinaData.note - Note (opzionale)
 * @param {string} createdBy - ID utente che crea la macchina
 * @returns {Promise<string>} ID macchina creata
 */
export async function createMacchina(macchinaData, createdBy) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const macchina = new Macchina({
      ...macchinaData,
      creatoDa: createdBy
    });
    
    // Valida
    const validation = macchina.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Se oreAttuali non specificate, usa oreIniziali
    if (macchina.oreAttuali === null || macchina.oreAttuali === undefined) {
      macchina.oreAttuali = macchina.oreIniziali || 0;
    }
    
    // Salva
    const macchinaId = await createDocument(COLLECTION_NAME, macchina.toFirestore(), tenantId);
    
    return macchinaId;
  } catch (error) {
    console.error('Errore creazione macchina:', error);
    throw new Error(`Errore creazione macchina: ${error.message}`);
  }
}

/**
 * Aggiorna una macchina esistente
 * @param {string} macchinaId - ID macchina
 * @param {Object} updates - Dati da aggiornare
 * @returns {Promise<void>}
 */
export async function updateMacchina(macchinaId, updates) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!macchinaId) {
      throw new Error('ID macchina obbligatorio');
    }
    
    // Carica macchina esistente
    const macchinaEsistente = await getMacchina(macchinaId);
    if (!macchinaEsistente) {
      throw new Error('Macchina non trovata');
    }
    
    // Aggiorna con nuovi dati
    macchinaEsistente.update(updates);
    
    // Valida
    const validation = macchinaEsistente.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Salva
    await updateDocument(COLLECTION_NAME, macchinaId, macchinaEsistente.toFirestore(), tenantId);
  } catch (error) {
    console.error('Errore aggiornamento macchina:', error);
    throw new Error(`Errore aggiornamento macchina: ${error.message}`);
  }
}

/**
 * Elimina una macchina
 * @param {string} macchinaId - ID macchina
 * @param {Object} options - Opzioni eliminazione
 * @param {boolean} options.force - Se true, elimina anche se usata in lavori (default: false)
 * @returns {Promise<void>}
 * @throws {Error} Se macchina è usata in lavori e force=false
 */
export async function deleteMacchina(macchinaId, options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!macchinaId) {
      throw new Error('ID macchina obbligatorio');
    }
    
    // Verifica se macchina è usata in lavori
    const numLavori = await getNumeroLavoriMacchina(macchinaId);
    
    if (numLavori > 0 && !options.force) {
      throw new Error(
        `Impossibile eliminare: la macchina è utilizzata in ${numLavori} lavori. ` +
        `Elimina prima i lavori o usa l'opzione force=true per eliminare comunque.`
      );
    }
    
    await deleteDocument(COLLECTION_NAME, macchinaId, tenantId);
  } catch (error) {
    console.error('Errore eliminazione macchina:', error);
    throw error; // Rilancia l'errore così la UI può gestirlo
  }
}

/**
 * Verifica se una macchina è usata in lavori
 * @param {string} macchinaId - ID macchina
 * @returns {Promise<number>} Numero di lavori che usano questa macchina
 */
export async function getNumeroLavoriMacchina(macchinaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    // Import dinamico per evitare dipendenze circolari
    const { getCollectionData } = await import('../../../core/services/firebase-service.js');
    
    const lavori = await getCollectionData('lavori', {
      tenantId,
      where: [['macchinaId', '==', macchinaId]]
    });
    
    return lavori.length;
  } catch (error) {
    console.error('Errore verifica uso macchina:', error);
    return 0;
  }
}

/**
 * Aggiorna ore macchina (per aggiornamento manuale o automatico)
 * @param {string} macchinaId - ID macchina
 * @param {number} nuoveOre - Nuove ore attuali
 * @returns {Promise<void>}
 */
export async function aggiornaOreMacchina(macchinaId, nuoveOre) {
  try {
    if (nuoveOre < 0) {
      throw new Error('Le ore non possono essere negative');
    }
    
    const macchina = await getMacchina(macchinaId);
    if (!macchina) {
      throw new Error('Macchina non trovata');
    }
    
    if (nuoveOre < macchina.oreIniziali) {
      throw new Error('Le ore attuali non possono essere inferiori alle ore iniziali');
    }
    
    await updateMacchina(macchinaId, { oreAttuali: nuoveOre });
  } catch (error) {
    console.error('Errore aggiornamento ore macchina:', error);
    throw new Error(`Errore aggiornamento ore macchina: ${error.message}`);
  }
}

/**
 * Assegna macchina a un operatore (solo se Manodopera attivo)
 * @param {string} macchinaId - ID macchina
 * @param {string} operatoreId - ID operatore
 * @returns {Promise<void>}
 */
export async function assegnaMacchina(macchinaId, operatoreId) {
  try {
    await updateMacchina(macchinaId, {
      operatoreAssegnatoId: operatoreId,
      stato: 'in_uso'
    });
  } catch (error) {
    console.error('Errore assegnazione macchina:', error);
    throw new Error(`Errore assegnazione macchina: ${error.message}`);
  }
}

/**
 * Libera macchina (rimuove assegnazione)
 * @param {string} macchinaId - ID macchina
 * @returns {Promise<void>}
 */
export async function liberaMacchina(macchinaId) {
  try {
    await updateMacchina(macchinaId, {
      operatoreAssegnatoId: null,
      stato: 'disponibile'
    });
  } catch (error) {
    console.error('Errore liberazione macchina:', error);
    throw new Error(`Errore liberazione macchina: ${error.message}`);
  }
}

// Export default
export default {
  getAllMacchine,
  getMacchineDisponibili,
  getTrattori,
  getAttrezzi,
  getAttrezziCompatibili,
  getTrattoriCompatibili,
  getMacchina,
  createMacchina,
  updateMacchina,
  deleteMacchina,
  getNumeroLavoriMacchina,
  aggiornaOreMacchina,
  assegnaMacchina,
  liberaMacchina
};

