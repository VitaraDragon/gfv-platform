/**
 * Frutteti Service - Servizio per gestione anagrafica frutteti
 * Gestisce CRUD frutteti con supporto multi-tenant
 * 
 * @module modules/frutteto/services/frutteti-service
 */

import { 
  createDocument, 
  getDocumentData, 
  updateDocument,
  deleteDocument,
  getCollectionData 
} from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { Frutteto } from '../models/Frutteto.js';

const COLLECTION_NAME = 'frutteti';

/**
 * Ottieni tutti i frutteti del tenant corrente
 * @param {Object} options - Opzioni di query
 * @param {string} options.orderBy - Campo per ordinamento (default: 'specie')
 * @param {string} options.orderDirection - Direzione ordinamento ('asc' | 'desc')
 * @param {string} options.terrenoId - Filtra per terreno (opzionale)
 * @param {string} options.specie - Filtra per specie (opzionale)
 * @param {string} options.varieta - Filtra per varietà (opzionale)
 * @param {string} options.statoImpianto - Filtra per stato impianto (opzionale)
 * @returns {Promise<Array<Frutteto>>} Array di frutteti
 */
export async function getAllFrutteti(options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const { 
      orderBy = null,
      orderDirection = 'asc',
      terrenoId = null,
      specie = null,
      varieta = null,
      statoImpianto = null
    } = options;
    
    // Costruisci filtri where
    const whereFilters = [];
    if (terrenoId) {
      whereFilters.push(['terrenoId', '==', terrenoId]);
    }
    if (specie) {
      whereFilters.push(['specie', '==', specie]);
    }
    if (varieta) {
      whereFilters.push(['varieta', '==', varieta]);
    }
    if (statoImpianto) {
      whereFilters.push(['statoImpianto', '==', statoImpianto]);
    }
    
    const documents = await getCollectionData(COLLECTION_NAME, {
      tenantId,
      orderBy: orderBy || undefined,
      orderDirection,
      where: whereFilters.length > 0 ? whereFilters : undefined
    });
    
    const frutteti = documents.map(doc => {
      const frutteto = Frutteto.fromData(doc);
      // Ricalcola alias
      frutteto.densitaPiante = frutteto.densita;
      frutteto.distanzaPiante = frutteto.distanzaUnita;
      frutteto.sistemaAllevamento = frutteto.formaAllevamento;

      // Ricalcola costi solo se costoTotaleAnno non è già presente o è 0
      // Questo evita di sovrascrivere un valore già calcolato correttamente
      if (!frutteto.costoTotaleAnno || frutteto.costoTotaleAnno === 0) {
        if (frutteto.speseManodoperaAnno !== undefined || frutteto.speseMacchineAnno !== undefined) {
          frutteto.aggiornaCostiCalcolati();
        }
      }
      return frutteto;
    });
    
    return frutteti;
  } catch (error) {
    console.error('[FRUTTETI-SERVICE] Errore recupero frutteti:', error);
    if (error.message.includes('tenant') || error.message.includes('obbligatorio')) {
      throw new Error(`Errore recupero frutteti: ${error.message}`);
    }
    return [];
  }
}

/**
 * Ottieni un frutteto per ID
 * @param {string} fruttetoId - ID frutteto
 * @returns {Promise<Frutteto|null>} Frutteto o null se non trovato
 */
export async function getFrutteto(fruttetoId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!fruttetoId) {
      throw new Error('ID frutteto obbligatorio');
    }
    
    const data = await getDocumentData(COLLECTION_NAME, fruttetoId, tenantId);
    
    if (!data) {
      return null;
    }
    
    const frutteto = Frutteto.fromData(data);
    // Ricalcola alias
    frutteto.densitaPiante = frutteto.densita;
    frutteto.distanzaPiante = frutteto.distanzaUnita;
    frutteto.sistemaAllevamento = frutteto.formaAllevamento;

    // Ricalcola costi solo se costoTotaleAnno non è già presente o è 0
    // Questo evita di sovrascrivere un valore già calcolato correttamente
    if (!frutteto.costoTotaleAnno || frutteto.costoTotaleAnno === 0) {
      if (frutteto.speseManodoperaAnno !== undefined || frutteto.speseMacchineAnno !== undefined) {
        frutteto.aggiornaCostiCalcolati();
      }
    }
    return frutteto;
  } catch (error) {
    console.error('Errore recupero frutteto:', error);
    throw new Error(`Errore recupero frutteto: ${error.message}`);
  }
}

/**
 * Crea un nuovo frutteto
 * @param {Object} fruttetoData - Dati frutteto
 * @returns {Promise<string>} ID frutteto creato
 */
export async function createFrutteto(fruttetoData) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    // Crea modello e valida
    const frutteto = new Frutteto(fruttetoData);
    const validation = frutteto.validate();
    
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Aggiorna costi calcolati
    frutteto.aggiornaCostiCalcolati();
    
    // Salva su Firestore
    const fruttetoId = await createDocument(COLLECTION_NAME, frutteto.toFirestore(), tenantId);
    
    return fruttetoId;
  } catch (error) {
    console.error('Errore creazione frutteto:', error);
    throw new Error(`Errore creazione frutteto: ${error.message}`);
  }
}

/**
 * Aggiorna un frutteto esistente
 * @param {string} fruttetoId - ID frutteto
 * @param {Object} updates - Dati da aggiornare
 * @returns {Promise<void>}
 */
export async function updateFrutteto(fruttetoId, updates) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!fruttetoId) {
      throw new Error('ID frutteto obbligatorio');
    }
    
    // Recupera frutteto esistente
    const fruttetoEsistente = await getFrutteto(fruttetoId);
    if (!fruttetoEsistente) {
      throw new Error('Frutteto non trovato');
    }
    
    // Applica aggiornamenti
    fruttetoEsistente.update(updates);
    
    // Valida
    const validation = fruttetoEsistente.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Aggiorna costi calcolati
    fruttetoEsistente.aggiornaCostiCalcolati();
    
    // Salva su Firestore
    await updateDocument(COLLECTION_NAME, fruttetoId, fruttetoEsistente.toFirestore(), tenantId);
  } catch (error) {
    console.error('Errore aggiornamento frutteto:', error);
    throw new Error(`Errore aggiornamento frutteto: ${error.message}`);
  }
}

/**
 * Elimina un frutteto
 * @param {string} fruttetoId - ID frutteto
 * @returns {Promise<void>}
 */
export async function deleteFrutteto(fruttetoId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!fruttetoId) {
      throw new Error('ID frutteto obbligatorio');
    }
    
    await deleteDocument(COLLECTION_NAME, fruttetoId, tenantId);
  } catch (error) {
    console.error('Errore eliminazione frutteto:', error);
    throw new Error(`Errore eliminazione frutteto: ${error.message}`);
  }
}

/**
 * Ottieni frutteti per terreno
 * @param {string} terrenoId - ID terreno
 * @returns {Promise<Array<Frutteto>>} Array di frutteti
 */
export async function getFruttetiByTerreno(terrenoId) {
  return getAllFrutteti({ terrenoId });
}

/**
 * Verifica se esiste già un frutteto per un terreno
 * @param {string} terrenoId - ID terreno
 * @returns {Promise<boolean>} true se esiste già un frutteto per questo terreno
 */
export async function existsFruttetoForTerreno(terrenoId) {
  try {
    const frutteti = await getFruttetiByTerreno(terrenoId);
    return frutteti.length > 0;
  } catch (error) {
    console.error('Errore verifica esistenza frutteto:', error);
    return false;
  }
}
