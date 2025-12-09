/**
 * Poderi Clienti Service - Servizio per gestione poderi clienti
 * 
 * @module modules/conto-terzi/services/poderi-clienti-service
 */

import {
  createDocument,
  getDocumentData,
  updateDocument,
  deleteDocument,
  getCollectionData
} from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { PodereCliente } from '../models/PodereCliente.js';

const COLLECTION_NAME = 'poderi-clienti';

/**
 * Ottieni tutti i poderi di un cliente
 * @param {string} clienteId - ID cliente
 * @param {Object} options - Opzioni di query
 * @returns {Promise<Array<PodereCliente>>}
 */
export async function getPoderiByCliente(clienteId, options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
    if (!clienteId) throw new Error('ID cliente obbligatorio');

    const { orderBy: orderByField = 'nome', orderDirection = 'asc' } = options;
    
    const documents = await getCollectionData(COLLECTION_NAME, {
      tenantId,
      orderBy: orderByField,
      orderDirection,
      where: [['clienteId', '==', clienteId]]
    });

    return documents.map(doc => PodereCliente.fromData(doc));
  } catch (error) {
    console.error('Errore recupero poderi cliente:', error);
    throw new Error(`Errore recupero poderi cliente: ${error.message}`);
  }
}

/**
 * Ottieni un podere per ID
 * @param {string} podereId - ID podere
 * @returns {Promise<PodereCliente|null>}
 */
export async function getPodere(podereId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
    if (!podereId) throw new Error('ID podere obbligatorio');

    const data = await getDocumentData(COLLECTION_NAME, podereId, tenantId);
    return data ? PodereCliente.fromData(data) : null;
  } catch (error) {
    console.error('Errore recupero podere:', error);
    throw new Error(`Errore recupero podere: ${error.message}`);
  }
}

/**
 * Crea un nuovo podere
 * @param {Object} podereData - Dati podere
 * @returns {Promise<string>} ID podere creato
 */
export async function createPodere(podereData) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error('Nessun tenant corrente disponibile');

    const podere = new PodereCliente(podereData);
    const validation = podere.validate();
    
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }

    const podereId = await createDocument(COLLECTION_NAME, podere.toFirestore(), tenantId);
    return podereId;
  } catch (error) {
    console.error('Errore creazione podere:', error);
    throw new Error(`Errore creazione podere: ${error.message}`);
  }
}

/**
 * Aggiorna un podere esistente
 * @param {string} podereId - ID podere
 * @param {Object} updates - Dati da aggiornare
 * @returns {Promise<void>}
 */
export async function updatePodere(podereId, updates) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
    if (!podereId) throw new Error('ID podere obbligatorio');

    const podereEsistente = await getPodere(podereId);
    if (!podereEsistente) throw new Error('Podere non trovato');

    podereEsistente.update(updates);
    const validation = podereEsistente.validate();
    
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }

    await updateDocument(COLLECTION_NAME, podereId, podereEsistente.toFirestore(), tenantId);
  } catch (error) {
    console.error('Errore aggiornamento podere:', error);
    throw new Error(`Errore aggiornamento podere: ${error.message}`);
  }
}

/**
 * Elimina un podere
 * @param {string} podereId - ID podere
 * @returns {Promise<void>}
 */
export async function deletePodere(podereId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
    if (!podereId) throw new Error('ID podere obbligatorio');

    // Verifica se ci sono terreni associati a questo podere
    // TODO: Implementare verifica terreni associati se necessario
    
    await deleteDocument(COLLECTION_NAME, podereId, tenantId);
  } catch (error) {
    console.error('Errore eliminazione podere:', error);
    throw error;
  }
}

export default {
  getPoderiByCliente,
  getPodere,
  createPodere,
  updatePodere,
  deletePodere
};


