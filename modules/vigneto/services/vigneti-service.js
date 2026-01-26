/**
 * Vigneti Service - Servizio per gestione anagrafica vigneti
 * Gestisce CRUD vigneti con supporto multi-tenant
 * 
 * @module modules/vigneto/services/vigneti-service
 */

import { 
  createDocument, 
  getDocumentData, 
  updateDocument,
  deleteDocument,
  getCollectionData 
} from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { Vigneto } from '../models/Vigneto.js';

const COLLECTION_NAME = 'vigneti';

/**
 * Ottieni tutti i vigneti del tenant corrente
 * @param {Object} options - Opzioni di query
 * @param {string} options.orderBy - Campo per ordinamento (default: 'varieta')
 * @param {string} options.orderDirection - Direzione ordinamento ('asc' | 'desc')
 * @param {string} options.terrenoId - Filtra per terreno (opzionale)
 * @param {string} options.varieta - Filtra per varietà (opzionale)
 * @param {string} options.statoImpianto - Filtra per stato impianto (opzionale)
 * @returns {Promise<Array<Vigneto>>} Array di vigneti
 */
export async function getAllVigneti(options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const { 
      orderBy = null, // Temporaneamente rimosso per test - potrebbe causare problemi se campo non esiste
      orderDirection = 'asc',
      terrenoId = null,
      varieta = null,
      statoImpianto = null
    } = options;
    
    // Costruisci filtri where
    const whereFilters = [];
    if (terrenoId) {
      whereFilters.push(['terrenoId', '==', terrenoId]);
    }
    if (varieta) {
      whereFilters.push(['varieta', '==', varieta]);
    }
    if (statoImpianto) {
      whereFilters.push(['statoImpianto', '==', statoImpianto]);
    }
    
    const documents = await getCollectionData(COLLECTION_NAME, {
      tenantId,
      orderBy: orderBy || undefined, // Se null, non ordinare
      orderDirection,
      where: whereFilters.length > 0 ? whereFilters : undefined
    });
    
    const vigneti = documents.map(doc => {
      const vigneto = Vigneto.fromData(doc);
      // Ricalcola alias
      vigneto.densitaCepi = vigneto.densita;
      vigneto.distanzaCepi = vigneto.distanzaUnita;
      vigneto.sistemaAllevamento = vigneto.formaAllevamento;
      // Ricalcola costi se le spese sono presenti (per assicurarsi che costoTotaleAnno sia corretto)
      if (vigneto.speseManodoperaAnno !== undefined || vigneto.speseMacchineAnno !== undefined) {
        vigneto.aggiornaCostiCalcolati();
      }
      return vigneto;
    });
    
    return vigneti;
  } catch (error) {
    console.error('[VIGNETI-SERVICE] Errore recupero vigneti:', error);
    console.error('[VIGNETI-SERVICE] Stack:', error.stack);
    // Errori critici (validazione, autenticazione) -> lancia eccezione
    if (error.message.includes('tenant') || error.message.includes('obbligatorio')) {
      throw new Error(`Errore recupero vigneti: ${error.message}`);
    }
    // Errori non critici (database, rete) -> ritorna array vuoto
    return [];
  }
}

/**
 * Ottieni un vigneto per ID
 * @param {string} vignetoId - ID vigneto
 * @returns {Promise<Vigneto|null>} Vigneto o null se non trovato
 */
export async function getVigneto(vignetoId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!vignetoId) {
      throw new Error('ID vigneto obbligatorio');
    }
    
    const data = await getDocumentData(COLLECTION_NAME, vignetoId, tenantId);
    
    if (!data) {
      return null;
    }
    
    const vigneto = Vigneto.fromData(data);
    // Ricalcola alias
    vigneto.densitaCepi = vigneto.densita;
    vigneto.distanzaCepi = vigneto.distanzaUnita;
    vigneto.sistemaAllevamento = vigneto.formaAllevamento;
    // Ricalcola costi se le spese sono presenti (per assicurarsi che costoTotaleAnno sia corretto)
    if (vigneto.speseManodoperaAnno !== undefined || vigneto.speseMacchineAnno !== undefined) {
      vigneto.aggiornaCostiCalcolati();
    }
    return vigneto;
  } catch (error) {
    console.error('Errore recupero vigneto:', error);
    throw new Error(`Errore recupero vigneto: ${error.message}`);
  }
}

/**
 * Crea un nuovo vigneto
 * @param {Object} vignetoData - Dati vigneto
 * @param {string} vignetoData.terrenoId - Riferimento terreno (obbligatorio)
 * @param {string} vignetoData.varieta - Varietà uva (obbligatorio)
 * @param {number} vignetoData.annataImpianto - Anno impianto (obbligatorio)
 * @param {string} vignetoData.portainnesto - Tipo portainnesto (opzionale)
 * @param {number} vignetoData.densita - Densità ceppi/ha (obbligatorio)
 * @param {string} vignetoData.formaAllevamento - Sistema allevamento (obbligatorio)
 * @param {string} vignetoData.tipoImpianto - Tipo impianto (opzionale)
 * @param {number} vignetoData.distanzaFile - Distanza tra file in metri (obbligatorio)
 * @param {number} vignetoData.distanzaUnita - Distanza tra ceppi in metri (obbligatorio)
 * @param {string} vignetoData.orientamentoFilari - Orientamento filari (opzionale)
 * @param {number} vignetoData.superficieEttari - Superficie dedicata in ettari (obbligatorio)
 * @param {string} vignetoData.tipoPalo - Tipo palo (obbligatorio)
 * @param {string} vignetoData.destinazioneUva - Destinazione uva (obbligatorio)
 * @param {string} vignetoData.cantina - Nome cantina (opzionale)
 * @param {string} vignetoData.note - Note (opzionale)
 * @returns {Promise<string>} ID vigneto creato
 */
export async function createVigneto(vignetoData) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    // Crea modello e valida
    const vigneto = new Vigneto(vignetoData);
    const validation = vigneto.validate();
    
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Aggiorna costi calcolati
    vigneto.aggiornaCostiCalcolati();
    
    // Salva su Firestore
    const vignetoId = await createDocument(COLLECTION_NAME, vigneto.toFirestore(), tenantId);
    
    return vignetoId;
  } catch (error) {
    console.error('Errore creazione vigneto:', error);
    throw new Error(`Errore creazione vigneto: ${error.message}`);
  }
}

/**
 * Aggiorna un vigneto esistente
 * @param {string} vignetoId - ID vigneto
 * @param {Object} updates - Dati da aggiornare
 * @returns {Promise<void>}
 */
export async function updateVigneto(vignetoId, updates) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!vignetoId) {
      throw new Error('ID vigneto obbligatorio');
    }
    
    // Recupera vigneto esistente
    const vignetoEsistente = await getVigneto(vignetoId);
    if (!vignetoEsistente) {
      throw new Error('Vigneto non trovato');
    }
    
    // Applica aggiornamenti
    vignetoEsistente.update(updates);
    
    // Valida
    const validation = vignetoEsistente.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Aggiorna costi calcolati
    vignetoEsistente.aggiornaCostiCalcolati();
    
    // Salva su Firestore
    await updateDocument(COLLECTION_NAME, vignetoId, vignetoEsistente.toFirestore(), tenantId);
  } catch (error) {
    console.error('Errore aggiornamento vigneto:', error);
    throw new Error(`Errore aggiornamento vigneto: ${error.message}`);
  }
}

/**
 * Elimina un vigneto
 * @param {string} vignetoId - ID vigneto
 * @returns {Promise<void>}
 */
export async function deleteVigneto(vignetoId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!vignetoId) {
      throw new Error('ID vigneto obbligatorio');
    }
    
    await deleteDocument(COLLECTION_NAME, vignetoId, tenantId);
  } catch (error) {
    console.error('Errore eliminazione vigneto:', error);
    throw new Error(`Errore eliminazione vigneto: ${error.message}`);
  }
}

/**
 * Ottieni vigneti per terreno
 * @param {string} terrenoId - ID terreno
 * @returns {Promise<Array<Vigneto>>} Array di vigneti
 */
export async function getVignetiByTerreno(terrenoId) {
  return getAllVigneti({ terrenoId });
}

/**
 * Verifica se esiste già un vigneto per un terreno
 * @param {string} terrenoId - ID terreno
 * @returns {Promise<boolean>} true se esiste già un vigneto per questo terreno
 */
export async function existsVignetoForTerreno(terrenoId) {
  try {
    const vigneti = await getVignetiByTerreno(terrenoId);
    return vigneti.length > 0;
  } catch (error) {
    console.error('Errore verifica esistenza vigneto:', error);
    return false;
  }
}
