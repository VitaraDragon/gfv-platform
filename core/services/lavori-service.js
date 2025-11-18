/**
 * Lavori Service - Servizio per gestione lavori
 * Gestisce CRUD lavori con supporto multi-tenant
 * 
 * @module core/services/lavori-service
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
import { Lavoro } from '../models/Lavoro.js';

const COLLECTION_NAME = 'lavori';

/**
 * Ottieni tutti i lavori del tenant corrente
 * @param {Object} options - Opzioni di query
 * @param {string} options.orderBy - Campo per ordinamento (default: 'dataInizio')
 * @param {string} options.orderDirection - Direzione ordinamento ('asc' | 'desc')
 * @param {string} options.caposquadraId - Filtra per caposquadra (opzionale)
 * @param {string} options.stato - Filtra per stato (opzionale)
 * @param {string} options.terrenoId - Filtra per terreno (opzionale)
 * @returns {Promise<Array<Lavoro>>} Array di lavori
 */
export async function getAllLavori(options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const { 
      orderBy = 'dataInizio', 
      orderDirection = 'desc',
      caposquadraId = null,
      stato = null,
      terrenoId = null
    } = options;
    
    // Costruisci filtri where
    const whereFilters = [];
    if (caposquadraId) {
      whereFilters.push(['caposquadraId', '==', caposquadraId]);
    }
    if (stato) {
      whereFilters.push(['stato', '==', stato]);
    }
    if (terrenoId) {
      whereFilters.push(['terrenoId', '==', terrenoId]);
    }
    
    const documents = await getCollectionData(COLLECTION_NAME, {
      tenantId,
      orderBy,
      orderDirection,
      where: whereFilters.length > 0 ? whereFilters : undefined
    });
    
    return documents.map(doc => Lavoro.fromData(doc));
  } catch (error) {
    console.error('Errore recupero lavori:', error);
    throw new Error(`Errore recupero lavori: ${error.message}`);
  }
}

/**
 * Ottieni un lavoro per ID
 * @param {string} lavoroId - ID lavoro
 * @returns {Promise<Lavoro|null>} Lavoro o null se non trovato
 */
export async function getLavoro(lavoroId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!lavoroId) {
      throw new Error('ID lavoro obbligatorio');
    }
    
    const data = await getDocumentData(COLLECTION_NAME, lavoroId, tenantId);
    
    if (!data) {
      return null;
    }
    
    return Lavoro.fromData(data);
  } catch (error) {
    console.error('Errore recupero lavoro:', error);
    throw new Error(`Errore recupero lavoro: ${error.message}`);
  }
}

/**
 * Ottieni lavori assegnati a un caposquadra
 * @param {string} caposquadraId - ID caposquadra
 * @param {Object} options - Opzioni aggiuntive
 * @param {string} options.stato - Filtra per stato (opzionale)
 * @returns {Promise<Array<Lavoro>>} Array di lavori
 */
export async function getLavoriByCaposquadra(caposquadraId, options = {}) {
  try {
    if (!caposquadraId) {
      throw new Error('ID caposquadra obbligatorio');
    }
    
    return getAllLavori({
      ...options,
      caposquadraId
    });
  } catch (error) {
    console.error('Errore recupero lavori per caposquadra:', error);
    throw new Error(`Errore recupero lavori: ${error.message}`);
  }
}

/**
 * Ottieni lavori attivi (non completati e non annullati)
 * @param {Object} options - Opzioni aggiuntive
 * @returns {Promise<Array<Lavoro>>} Array di lavori attivi
 */
export async function getLavoriAttivi(options = {}) {
  try {
    const lavori = await getAllLavori(options);
    return lavori.filter(lavoro => lavoro.isAttivo());
  } catch (error) {
    console.error('Errore recupero lavori attivi:', error);
    throw new Error(`Errore recupero lavori attivi: ${error.message}`);
  }
}

/**
 * Crea un nuovo lavoro
 * @param {Object} lavoroData - Dati lavoro
 * @param {string} lavoroData.nome - Nome lavoro (obbligatorio)
 * @param {string} lavoroData.terrenoId - ID terreno (obbligatorio)
 * @param {string} lavoroData.caposquadraId - ID caposquadra (obbligatorio)
 * @param {Date|string} lavoroData.dataInizio - Data inizio lavoro (obbligatorio)
 * @param {number} lavoroData.durataPrevista - Durata prevista in giorni (obbligatorio)
 * @param {string} lavoroData.stato - Stato lavoro (default: "assegnato")
 * @param {string} lavoroData.note - Note opzionali
 * @returns {Promise<string>} ID lavoro creato
 */
export async function createLavoro(lavoroData) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const user = getCurrentUserData();
    if (!user) {
      throw new Error('Utente non autenticato');
    }
    
    // Verifica permessi: solo manager e amministratore possono creare lavori
    if (!user.ruoli || (!user.ruoli.includes('manager') && !user.ruoli.includes('amministratore'))) {
      throw new Error('Non hai i permessi per creare lavori');
    }
    
    const lavoro = new Lavoro({
      ...lavoroData,
      stato: lavoroData.stato || 'assegnato',
      creatoDa: user.id
    });
    
    // Valida
    const validation = lavoro.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Verifica che terreno esista
    const { getTerreno } = await import('./terreni-service.js');
    const terreno = await getTerreno(lavoroData.terrenoId);
    if (!terreno) {
      throw new Error('Terreno non trovato');
    }
    
    // Verifica che caposquadra esista e abbia il ruolo corretto
    const caposquadraDoc = await getDocumentData('users', lavoroData.caposquadraId);
    if (!caposquadraDoc) {
      throw new Error('Caposquadra non trovato');
    }
    if (!caposquadraDoc.ruoli || !caposquadraDoc.ruoli.includes('caposquadra')) {
      throw new Error('L\'utente selezionato non è un caposquadra');
    }
    
    // Salva
    const lavoroId = await createDocument(COLLECTION_NAME, lavoro.toFirestore(), tenantId);
    
    return lavoroId;
  } catch (error) {
    console.error('Errore creazione lavoro:', error);
    throw new Error(`Errore creazione lavoro: ${error.message}`);
  }
}

/**
 * Aggiorna un lavoro esistente
 * @param {string} lavoroId - ID lavoro
 * @param {Object} updates - Dati da aggiornare
 * @returns {Promise<void>}
 */
export async function updateLavoro(lavoroId, updates) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const user = getCurrentUserData();
    if (!user) {
      throw new Error('Utente non autenticato');
    }
    
    if (!lavoroId) {
      throw new Error('ID lavoro obbligatorio');
    }
    
    // Carica lavoro esistente
    const lavoroEsistente = await getLavoro(lavoroId);
    if (!lavoroEsistente) {
      throw new Error('Lavoro non trovato');
    }
    
    // Verifica permessi: solo manager e amministratore possono modificare dati base
    // Caposquadra può modificare solo certi campi (gestito separatamente)
    if (!user.ruoli || (!user.ruoli.includes('manager') && !user.ruoli.includes('amministratore'))) {
      // Se è caposquadra, può modificare solo certi campi
      if (user.ruoli && user.ruoli.includes('caposquadra') && lavoroEsistente.caposquadraId === user.id) {
        // Caposquadra può modificare solo stato e note
        const allowedFields = ['stato', 'note'];
        const updatesFiltered = {};
        Object.keys(updates).forEach(key => {
          if (allowedFields.includes(key)) {
            updatesFiltered[key] = updates[key];
          }
        });
        updates = updatesFiltered;
        
        if (Object.keys(updates).length === 0) {
          throw new Error('Non hai i permessi per modificare questi campi');
        }
      } else {
        throw new Error('Non hai i permessi per modificare questo lavoro');
      }
    }
    
    // Aggiorna con nuovi dati
    lavoroEsistente.update(updates);
    
    // Valida
    const validation = lavoroEsistente.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Salva
    await updateDocument(COLLECTION_NAME, lavoroId, lavoroEsistente.toFirestore(), tenantId);
  } catch (error) {
    console.error('Errore aggiornamento lavoro:', error);
    throw new Error(`Errore aggiornamento lavoro: ${error.message}`);
  }
}

/**
 * Elimina un lavoro
 * @param {string} lavoroId - ID lavoro
 * @param {Object} options - Opzioni eliminazione
 * @param {boolean} options.force - Se true, elimina anche se ha zone lavorate o ore (default: false)
 * @returns {Promise<void>}
 * @throws {Error} Se lavoro ha zone lavorate o ore e force=false
 */
export async function deleteLavoro(lavoroId, options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const user = getCurrentUserData();
    if (!user) {
      throw new Error('Utente non autenticato');
    }
    
    // Verifica permessi: solo manager e amministratore possono eliminare lavori
    if (!user.ruoli || (!user.ruoli.includes('manager') && !user.ruoli.includes('amministratore'))) {
      throw new Error('Non hai i permessi per eliminare lavori');
    }
    
    if (!lavoroId) {
      throw new Error('ID lavoro obbligatorio');
    }
    
    // Verifica se lavoro ha zone lavorate (se sub-collection esiste)
    // Nota: questa verifica sarà implementata quando avremo il modulo zone lavorate
    // Per ora, permettiamo eliminazione se force=true
    
    // Verifica se lavoro ha ore associate (se collezione ore esiste)
    // Nota: questa verifica sarà implementata quando avremo il modulo ore
    // Per ora, permettiamo eliminazione se force=true
    
    const { force = false } = options;
    
    if (!force) {
      // TODO: Verifica zone lavorate e ore quando moduli saranno implementati
      // Per ora, chiediamo sempre conferma forzata
      throw new Error('Per eliminare un lavoro con dati associati, usa force=true');
    }
    
    await deleteDocument(COLLECTION_NAME, lavoroId, tenantId);
  } catch (error) {
    console.error('Errore eliminazione lavoro:', error);
    throw error; // Rilancia l'errore così la UI può gestirlo
  }
}

/**
 * Ottieni numero lavori per caposquadra
 * @param {string} caposquadraId - ID caposquadra
 * @param {string} stato - Filtra per stato (opzionale)
 * @returns {Promise<number>} Numero lavori
 */
export async function getNumeroLavoriCaposquadra(caposquadraId, stato = null) {
  try {
    const lavori = await getLavoriByCaposquadra(caposquadraId, { stato });
    return lavori.length;
  } catch (error) {
    console.error('Errore conteggio lavori:', error);
    return 0;
  }
}

// Export default
export default {
  getAllLavori,
  getLavoro,
  getLavoriByCaposquadra,
  getLavoriAttivi,
  createLavoro,
  updateLavoro,
  deleteLavoro,
  getNumeroLavoriCaposquadra
};

