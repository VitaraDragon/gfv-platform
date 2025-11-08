/**
 * Tenant Service - Gestione multi-tenant
 * Gestisce isolamento dati per tenant e recupero tenant corrente
 * 
 * @module core/services/tenant-service
 */

import { getDocumentData, getCollectionData, createDocument, updateDocument } from './firebase-service.js';
import { getAuthInstance, onAuthStateChanged } from 'firebase/auth';

// Cache tenant corrente
let currentTenantId = null;
let currentUser = null;
let tenantCache = null;

/**
 * Inizializza il servizio tenant
 * Ascolta cambiamenti autenticazione per aggiornare tenant corrente
 */
export function initializeTenantService() {
  const auth = getAuthInstance();
  
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      // Carica dati utente per ottenere tenantId
      try {
        const userData = await getDocumentData('users', user.uid);
        if (userData && userData.tenantId) {
          currentTenantId = userData.tenantId;
          // Pulisci cache quando cambia utente
          tenantCache = null;
        }
      } catch (error) {
        console.error('Errore caricamento tenant utente:', error);
        currentTenantId = null;
      }
    } else {
      currentUser = null;
      currentTenantId = null;
      tenantCache = null;
    }
  });
}

/**
 * Ottieni ID del tenant corrente
 * @returns {string|null} ID del tenant o null se non disponibile
 */
export function getCurrentTenantId() {
  return currentTenantId;
}

/**
 * Imposta tenant corrente (per testing o casi speciali)
 * @param {string} tenantId - ID del tenant
 */
export function setCurrentTenantId(tenantId) {
  currentTenantId = tenantId;
  tenantCache = null; // Pulisci cache
}

/**
 * Ottieni utente corrente
 * @returns {Object|null} Utente Firebase corrente
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Ottieni dati completi del tenant corrente
 * @returns {Promise<Object|null>} Dati del tenant o null
 */
export async function getCurrentTenant() {
  if (!currentTenantId) {
    return null;
  }
  
  // Usa cache se disponibile
  if (tenantCache) {
    return tenantCache;
  }
  
  try {
    const tenant = await getDocumentData('tenants', currentTenantId);
    if (tenant) {
      tenantCache = tenant;
    }
    return tenant;
  } catch (error) {
    console.error('Errore caricamento tenant:', error);
    return null;
  }
}

/**
 * Ottieni riferimento a una collection del tenant corrente
 * @param {string} collectionName - Nome della collection
 * @returns {CollectionReference} Riferimento alla collection
 */
export function getTenantCollection(collectionName) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    throw new Error('Nessun tenant corrente disponibile. Utente non autenticato o senza tenant.');
  }
  
  // Re-export da firebase-service con tenantId
  const { getCollection } = await import('./firebase-service.js');
  return getCollection(collectionName, tenantId);
}

/**
 * Crea un nuovo tenant
 * @param {Object} tenantData - Dati del tenant
 * @param {string} tenantData.name - Nome del tenant/azienda
 * @param {string} tenantData.plan - Piano abbonamento ('starter' | 'professional' | 'enterprise')
 * @param {Array<string>} tenantData.modules - Array di moduli attivi
 * @param {string} createdBy - ID utente che crea il tenant
 * @returns {Promise<string>} ID del tenant creato
 */
export async function createTenant(tenantData, createdBy) {
  try {
    const { name, plan = 'starter', modules = [] } = tenantData;
    
    if (!name || name.trim().length === 0) {
      throw new Error('Nome tenant obbligatorio');
    }
    
    const tenant = {
      name: name.trim(),
      plan,
      modules,
      status: 'active',
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const tenantId = await createDocument('tenants', tenant);
    return tenantId;
  } catch (error) {
    console.error('Errore creazione tenant:', error);
    throw new Error(`Errore creazione tenant: ${error.message}`);
  }
}

/**
 * Aggiorna dati del tenant
 * @param {string} tenantId - ID del tenant
 * @param {Object} updates - Dati da aggiornare
 * @returns {Promise<void>}
 */
export async function updateTenant(tenantId, updates) {
  try {
    await updateDocument('tenants', tenantId, updates);
    
    // Se è il tenant corrente, aggiorna cache
    if (tenantId === currentTenantId) {
      tenantCache = null;
    }
  } catch (error) {
    console.error('Errore aggiornamento tenant:', error);
    throw new Error(`Errore aggiornamento tenant: ${error.message}`);
  }
}

/**
 * Verifica se un modulo è disponibile per il tenant corrente
 * @param {string} moduleName - Nome del modulo
 * @returns {Promise<boolean>} true se il modulo è disponibile
 */
export async function hasModuleAccess(moduleName) {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return false;
  }
  
  // Modulo 'core' è sempre disponibile
  if (moduleName === 'core') {
    return true;
  }
  
  return tenant.modules && tenant.modules.includes(moduleName);
}

/**
 * Ottieni tutti i moduli disponibili per il tenant corrente
 * @returns {Promise<Array<string>>} Array di nomi moduli
 */
export async function getAvailableModules() {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return ['core']; // Almeno core è sempre disponibile
  }
  
  return ['core', ...(tenant.modules || [])];
}

/**
 * Aggiungi modulo al tenant
 * @param {string} tenantId - ID del tenant
 * @param {string} moduleName - Nome del modulo da aggiungere
 * @returns {Promise<void>}
 */
export async function addModuleToTenant(tenantId, moduleName) {
  try {
    const tenant = await getDocumentData('tenants', tenantId);
    if (!tenant) {
      throw new Error('Tenant non trovato');
    }
    
    const modules = tenant.modules || [];
    if (!modules.includes(moduleName)) {
      modules.push(moduleName);
      await updateTenant(tenantId, { modules });
    }
  } catch (error) {
    console.error('Errore aggiunta modulo:', error);
    throw new Error(`Errore aggiunta modulo: ${error.message}`);
  }
}

/**
 * Rimuovi modulo dal tenant
 * @param {string} tenantId - ID del tenant
 * @param {string} moduleName - Nome del modulo da rimuovere
 * @returns {Promise<void>}
 */
export async function removeModuleFromTenant(tenantId, moduleName) {
  try {
    const tenant = await getDocumentData('tenants', tenantId);
    if (!tenant) {
      throw new Error('Tenant non trovato');
    }
    
    const modules = (tenant.modules || []).filter(m => m !== moduleName);
    await updateTenant(tenantId, { modules });
  } catch (error) {
    console.error('Errore rimozione modulo:', error);
    throw new Error(`Errore rimozione modulo: ${error.message}`);
  }
}

/**
 * Verifica se l'utente corrente ha un tenant valido
 * @returns {boolean} true se ha un tenant valido
 */
export function hasValidTenant() {
  return currentTenantId !== null && currentTenantId !== undefined;
}

// Export default
export default {
  initializeTenantService,
  getCurrentTenantId,
  setCurrentTenantId,
  getCurrentUser,
  getCurrentTenant,
  getTenantCollection,
  createTenant,
  updateTenant,
  hasModuleAccess,
  getAvailableModules,
  addModuleToTenant,
  removeModuleFromTenant,
  hasValidTenant
};

