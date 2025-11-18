/**
 * Squadre Service - Servizio per gestione squadre
 * Gestisce CRUD squadre con supporto multi-tenant
 * 
 * @module core/services/squadre-service
 */

import { 
  createDocument, 
  getDocumentData, 
  updateDocument,
  deleteDocument,
  getCollectionData 
} from './firebase-service.js';
import { getCurrentTenantId } from './tenant-service.js';
import { getCurrentUserData } from './auth-service.js';
import { Squadra } from '../models/Squadra.js';

const COLLECTION_NAME = 'squadre';

/**
 * Ottieni tutte le squadre del tenant corrente
 * @param {Object} options - Opzioni di query
 * @param {string} options.orderBy - Campo per ordinamento (default: 'nome')
 * @param {string} options.orderDirection - Direzione ordinamento ('asc' | 'desc')
 * @returns {Promise<Array<Squadra>>} Array di squadre
 */
export async function getAllSquadre(options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const { orderBy = 'nome', orderDirection = 'asc' } = options;
    
    const documents = await getCollectionData(COLLECTION_NAME, {
      tenantId,
      orderBy,
      orderDirection
    });
    
    return documents.map(doc => Squadra.fromData(doc));
  } catch (error) {
    console.error('Errore recupero squadre:', error);
    throw new Error(`Errore recupero squadre: ${error.message}`);
  }
}

/**
 * Ottieni una squadra per ID
 * @param {string} squadraId - ID squadra
 * @returns {Promise<Squadra|null>} Squadra o null se non trovata
 */
export async function getSquadra(squadraId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!squadraId) {
      throw new Error('ID squadra obbligatorio');
    }
    
    const data = await getDocumentData(COLLECTION_NAME, squadraId, tenantId);
    
    if (!data) {
      return null;
    }
    
    return Squadra.fromData(data);
  } catch (error) {
    console.error('Errore recupero squadra:', error);
    throw new Error(`Errore recupero squadra: ${error.message}`);
  }
}

/**
 * Ottieni squadra per caposquadra
 * @param {string} caposquadraId - ID caposquadra
 * @returns {Promise<Squadra|null>} Squadra o null se non trovata
 */
export async function getSquadraByCaposquadra(caposquadraId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!caposquadraId) {
      throw new Error('ID caposquadra obbligatorio');
    }
    
    const documents = await getCollectionData(COLLECTION_NAME, {
      tenantId,
      where: [['caposquadraId', '==', caposquadraId]]
    });
    
    if (documents.length === 0) {
      return null;
    }
    
    return Squadra.fromData(documents[0]);
  } catch (error) {
    console.error('Errore recupero squadra per caposquadra:', error);
    throw new Error(`Errore recupero squadra: ${error.message}`);
  }
}

/**
 * Crea una nuova squadra
 * @param {Object} squadraData - Dati squadra
 * @param {string} squadraData.nome - Nome squadra (obbligatorio)
 * @param {string} squadraData.caposquadraId - ID caposquadra (obbligatorio)
 * @param {Array<string>} squadraData.operai - Array di ID operai (opzionale)
 * @param {string} squadraData.note - Note opzionali
 * @returns {Promise<string>} ID squadra creata
 */
export async function createSquadra(squadraData) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const user = getCurrentUserData();
    if (!user) {
      throw new Error('Utente non autenticato');
    }
    
    const squadra = new Squadra({
      ...squadraData,
      creatoDa: user.id
    });
    
    // Valida
    const validation = squadra.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Verifica che caposquadra non sia già in un'altra squadra (opzionale, ma consigliato)
    const squadraEsistente = await getSquadraByCaposquadra(squadraData.caposquadraId);
    if (squadraEsistente && squadraEsistente.id !== squadra.id) {
      console.warn(`Caposquadra già assegnato alla squadra: ${squadraEsistente.nome}`);
      // Non blocchiamo, ma avvisiamo (il Manager può decidere)
    }
    
    // Salva
    const squadraId = await createDocument(COLLECTION_NAME, squadra.toFirestore(), tenantId);
    
    return squadraId;
  } catch (error) {
    console.error('Errore creazione squadra:', error);
    throw new Error(`Errore creazione squadra: ${error.message}`);
  }
}

/**
 * Aggiorna una squadra esistente
 * @param {string} squadraId - ID squadra
 * @param {Object} updates - Dati da aggiornare
 * @returns {Promise<void>}
 */
export async function updateSquadra(squadraId, updates) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!squadraId) {
      throw new Error('ID squadra obbligatorio');
    }
    
    // Carica squadra esistente
    const squadraEsistente = await getSquadra(squadraId);
    if (!squadraEsistente) {
      throw new Error('Squadra non trovata');
    }
    
    // Se cambia caposquadra, verifica che nuovo caposquadra non sia già in altra squadra
    if (updates.caposquadraId && updates.caposquadraId !== squadraEsistente.caposquadraId) {
      const squadraConNuovoCapo = await getSquadraByCaposquadra(updates.caposquadraId);
      if (squadraConNuovoCapo && squadraConNuovoCapo.id !== squadraId) {
        console.warn(`Nuovo caposquadra già assegnato alla squadra: ${squadraConNuovoCapo.nome}`);
        // Non blocchiamo, ma avvisiamo
      }
    }
    
    // Aggiorna con nuovi dati
    squadraEsistente.update(updates);
    
    // Valida
    const validation = squadraEsistente.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Salva
    await updateDocument(COLLECTION_NAME, squadraId, squadraEsistente.toFirestore(), tenantId);
  } catch (error) {
    console.error('Errore aggiornamento squadra:', error);
    throw new Error(`Errore aggiornamento squadra: ${error.message}`);
  }
}

/**
 * Elimina una squadra
 * @param {string} squadraId - ID squadra
 * @param {Object} options - Opzioni eliminazione
 * @param {boolean} options.force - Se true, elimina anche se ha lavori attivi (default: false)
 * @returns {Promise<void>}
 * @throws {Error} Se squadra ha lavori attivi e force=false
 */
export async function deleteSquadra(squadraId, options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!squadraId) {
      throw new Error('ID squadra obbligatorio');
    }
    
    // Verifica se squadra ha lavori attivi (se collezione lavori esiste)
    // Nota: questa verifica sarà implementata quando avremo il modulo lavori
    // Per ora, permettiamo eliminazione
    
    await deleteDocument(COLLECTION_NAME, squadraId, tenantId);
  } catch (error) {
    console.error('Errore eliminazione squadra:', error);
    throw error; // Rilancia l'errore così la UI può gestirlo
  }
}

/**
 * Ottieni tutti gli utenti con un ruolo specifico
 * @param {string} ruolo - Ruolo da cercare ('caposquadra' | 'operaio')
 * @returns {Promise<Array>} Array di utenti con quel ruolo
 */
export async function getUtentiByRuolo(ruolo) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!ruolo) {
      throw new Error('Ruolo obbligatorio');
    }
    
    // Carica tutti gli utenti del tenant
    const { getCollectionData } = await import('./firebase-service.js');
    const users = await getCollectionData('users', {
      tenantId,
      where: [['ruoli', 'array-contains', ruolo], ['stato', '==', 'attivo']]
    });
    
    return users;
  } catch (error) {
    console.error('Errore recupero utenti per ruolo:', error);
    throw new Error(`Errore recupero utenti: ${error.message}`);
  }
}

/**
 * Ottieni tutti i caposquadra disponibili
 * @returns {Promise<Array>} Array di caposquadra
 */
export async function getCaposquadraDisponibili() {
  return getUtentiByRuolo('caposquadra');
}

/**
 * Ottieni tutti gli operai disponibili
 * @param {Array<string>} excludeOperaiIds - Array di ID operai da escludere (già in altre squadre)
 * @returns {Promise<Array>} Array di operai
 */
export async function getOperaiDisponibili(excludeOperaiIds = []) {
  const operai = await getUtentiByRuolo('operaio');
  
  // Filtra operai già in altre squadre se richiesto
  if (excludeOperaiIds.length > 0) {
    return operai.filter(operaio => !excludeOperaiIds.includes(operaio.id));
  }
  
  return operai;
}

/**
 * Ottieni tutti gli operai già assegnati a squadre
 * @returns {Promise<Array<string>>} Array di ID operai già assegnati
 */
export async function getOperaiAssegnati() {
  try {
    const squadre = await getAllSquadre();
    const operaiAssegnati = new Set();
    
    squadre.forEach(squadra => {
      if (squadra.operai && Array.isArray(squadra.operai)) {
        squadra.operai.forEach(operaioId => {
          operaiAssegnati.add(operaioId);
        });
      }
    });
    
    return Array.from(operaiAssegnati);
  } catch (error) {
    console.error('Errore recupero operai assegnati:', error);
    return [];
  }
}

// Export default
export default {
  getAllSquadre,
  getSquadra,
  getSquadraByCaposquadra,
  createSquadra,
  updateSquadra,
  deleteSquadra,
  getUtentiByRuolo,
  getCaposquadraDisponibili,
  getOperaiDisponibili,
  getOperaiAssegnati
};


