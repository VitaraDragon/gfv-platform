/**
 * Tenant Service - Gestione multi-tenant
 * Gestisce isolamento dati per tenant e recupero tenant corrente
 * Supporta multi-tenant membership: un utente può appartenere a più tenant
 * 
 * @module core/services/tenant-service
 */

import { getDocumentData, getCollectionData, createDocument, updateDocument, getAuthInstance, getCollection } from './firebase-service.js';
import { onAuthStateChanged } from './firebase-service.js';

// Cache tenant corrente
let currentTenantId = null;
let currentUser = null;
let tenantCache = null;
let userTenantsCache = null; // Cache tenant disponibili per utente

// Chiavi per sessionStorage/localStorage
const STORAGE_KEY_TENANT = 'gfv_current_tenant_id';
const STORAGE_KEY_TENANT_PREFERRED = 'gfv_preferred_tenant_id';

/**
 * Inizializza il servizio tenant
 * Ascolta cambiamenti autenticazione per aggiornare tenant corrente
 * Supporta multi-tenant: se utente ha più tenant, usa sessionStorage per tenant corrente
 */
export function initializeTenantService() {
  const auth = getAuthInstance();
  
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      // Carica dati utente per ottenere tenantMemberships
      try {
        const userData = await getDocumentData('users', user.uid);
        if (userData) {
          // Carica tenant disponibili
          const tenants = getUserTenantsFromData(userData);
          userTenantsCache = tenants;
          
          // Se un solo tenant, imposta automaticamente
          if (tenants.length === 1) {
            currentTenantId = tenants[0].tenantId;
            // Salva in sessionStorage
            if (typeof sessionStorage !== 'undefined') {
              sessionStorage.setItem(STORAGE_KEY_TENANT, currentTenantId);
            }
          } else if (tenants.length > 1) {
            // Più tenant: usa sessionStorage se disponibile, altrimenti usa tenant predefinito
            if (typeof sessionStorage !== 'undefined') {
              const storedTenantId = sessionStorage.getItem(STORAGE_KEY_TENANT);
              if (storedTenantId && tenants.some(t => t.tenantId === storedTenantId)) {
                currentTenantId = storedTenantId;
              } else {
                // Usa tenant predefinito
                const defaultTenant = tenants.find(t => t.tenantIdPredefinito) || tenants[0];
                currentTenantId = defaultTenant?.tenantId || null;
                if (currentTenantId) {
                  sessionStorage.setItem(STORAGE_KEY_TENANT, currentTenantId);
                }
              }
            } else {
              // Fallback: usa tenant predefinito
              const defaultTenant = tenants.find(t => t.tenantIdPredefinito) || tenants[0];
              currentTenantId = defaultTenant?.tenantId || null;
            }
          } else {
            // Nessun tenant: retrocompatibilità con tenantId deprecato
            if (userData.tenantId) {
              currentTenantId = userData.tenantId;
            } else {
              currentTenantId = null;
            }
          }
          
          // Pulisci cache quando cambia utente
          tenantCache = null;
        }
      } catch (error) {
        console.error('Errore caricamento tenant utente:', error);
        currentTenantId = null;
        userTenantsCache = null;
      }
    } else {
      currentUser = null;
      currentTenantId = null;
      tenantCache = null;
      userTenantsCache = null;
      
      // Pulisci sessionStorage
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(STORAGE_KEY_TENANT);
      }
    }
  });
}

/**
 * Estrae lista tenant da userData (supporta sia tenantMemberships che tenantId deprecato)
 * @param {Object} userData - Dati utente
 * @returns {Array<Object>} Array di { tenantId, ruoli, stato, ... }
 */
function getUserTenantsFromData(userData) {
  // Usa tenantMemberships se disponibile
  if (userData.tenantMemberships && Object.keys(userData.tenantMemberships).length > 0) {
    return Object.entries(userData.tenantMemberships).map(([tenantId, membership]) => ({
      tenantId,
      ...membership
    }));
  }
  
  // Retrocompatibilità: usa tenantId deprecato
  if (userData.tenantId) {
    return [{
      tenantId: userData.tenantId,
      ruoli: userData.ruoli || [],
      stato: userData.stato || 'attivo',
      tenantIdPredefinito: true
    }];
  }
  
  return [];
}

/**
 * Ottieni ID del tenant corrente
 * Legge da sessionStorage se disponibile, altrimenti usa cache in memoria
 * @returns {string|null} ID del tenant o null se non disponibile
 */
export function getCurrentTenantId() {
  // Prova a leggere da sessionStorage (priorità)
  if (typeof sessionStorage !== 'undefined') {
    const storedTenantId = sessionStorage.getItem(STORAGE_KEY_TENANT);
    if (storedTenantId) {
      return storedTenantId;
    }
  }
  
  // Fallback: usa cache in memoria
  return currentTenantId;
}

/**
 * Imposta tenant corrente
 * Salva sia in memoria che in sessionStorage
 * @param {string} tenantId - ID del tenant
 */
export function setCurrentTenantId(tenantId) {
  currentTenantId = tenantId;
  tenantCache = null; // Pulisci cache
  
  // Salva in sessionStorage
  if (typeof sessionStorage !== 'undefined') {
    if (tenantId) {
      sessionStorage.setItem(STORAGE_KEY_TENANT, tenantId);
      // Salva anche come preferito in localStorage (per persistenza tra sessioni)
      localStorage.setItem(STORAGE_KEY_TENANT_PREFERRED, tenantId);
    } else {
      sessionStorage.removeItem(STORAGE_KEY_TENANT);
    }
  }
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
  
  // Usa getCollection importato all'inizio del file
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
  const tenantId = getCurrentTenantId();
  return tenantId !== null && tenantId !== undefined;
}

/**
 * Ottieni tutti i tenant disponibili per un utente
 * Carica anche i nomi dei tenant da Firestore
 * @param {string} userId - ID utente (opzionale, usa utente corrente se non specificato)
 * @returns {Promise<Array<Object>>} Array di { tenantId, ruoli, stato, nome, ... }
 */
export async function getUserTenants(userId = null) {
  // Se abbiamo cache e stiamo chiedendo per l'utente corrente, usa cache
  // MA solo se non è stata esplicitamente pulita (userTenantsCache === null significa pulita)
  if (!userId && userTenantsCache !== null) {
    return userTenantsCache;
  }
  
  // Ottieni userId: usa parametro, poi currentUser locale, poi Firebase Auth come fallback
  let targetUserId = userId;
  if (!targetUserId) {
    if (currentUser) {
      targetUserId = currentUser.uid;
    } else {
      // Fallback: usa Firebase Auth direttamente
      try {
        const auth = getAuthInstance();
        const firebaseUser = auth.currentUser;
        if (firebaseUser) {
          targetUserId = firebaseUser.uid;
        }
      } catch (authError) {
        console.warn('Errore accesso Firebase Auth:', authError);
      }
    }
  }
  
  if (!targetUserId) {
    return [];
  }
  
  try {
    const userData = await getDocumentData('users', targetUserId);
    if (!userData) {
      return [];
    }
    
    const tenants = getUserTenantsFromData(userData);
    
    // Carica nomi tenant da Firestore
    const tenantsWithNames = await Promise.all(
      tenants.map(async (tenant) => {
        try {
          const tenantData = await getDocumentData('tenants', tenant.tenantId);
          return {
            ...tenant,
            nome: tenantData?.nome || tenantData?.name || null
          };
        } catch (error) {
          console.warn(`Errore caricamento nome tenant ${tenant.tenantId}:`, error);
          return tenant; // Restituisci tenant senza nome se errore
        }
      })
    );
    
    // Aggiorna cache se è l'utente corrente
    if (!userId) {
      userTenantsCache = tenantsWithNames;
    }
    
    return tenantsWithNames;
  } catch (error) {
    console.error('Errore caricamento tenant utente:', error);
    return [];
  }
}

/**
 * Ottieni ruoli utente per un tenant specifico
 * @param {string} tenantId - ID tenant
 * @param {string} userId - ID utente (opzionale, usa utente corrente se non specificato)
 * @returns {Promise<Array<string>>} Array di ruoli
 */
export async function getUserRolesForTenant(tenantId, userId = null) {
  if (!tenantId) {
    return [];
  }
  
  const targetUserId = userId || (currentUser ? currentUser.uid : null);
  if (!targetUserId) {
    return [];
  }
  
  try {
    const userData = await getDocumentData('users', targetUserId);
    if (!userData) {
      return [];
    }
  
    // Usa tenantMemberships se disponibile
    if (userData.tenantMemberships && userData.tenantMemberships[tenantId]) {
      const membership = userData.tenantMemberships[tenantId];
      return membership.ruoli && Array.isArray(membership.ruoli) ? membership.ruoli : [];
    }
    
    // Retrocompatibilità: se tenantId corrisponde al tenantId deprecato
    if (userData.tenantId === tenantId && userData.ruoli && Array.isArray(userData.ruoli)) {
      return userData.ruoli;
    }
    
    return [];
  } catch (error) {
    console.error('Errore caricamento ruoli utente:', error);
    return [];
  }
}

/**
 * Cambia tenant corrente (switch tenant)
 * @param {string} tenantId - ID del nuovo tenant
 * @returns {Promise<boolean>} true se switch riuscito
 */
export async function switchTenant(tenantId) {
  if (!tenantId) {
    throw new Error('tenantId obbligatorio');
  }
  
  // Ottieni userId corrente da Firebase Auth (più affidabile di currentUser locale)
  const auth = getAuthInstance();
  const firebaseUser = auth.currentUser;
  
  if (!firebaseUser) {
    throw new Error('Utente non autenticato');
  }
  
  const userId = firebaseUser.uid;
  
  // Pulisci cache tenant disponibili per forzare ricaricamento da Firestore
  userTenantsCache = null;
  
  // Verifica che l'utente appartenga a questo tenant (passa userId esplicitamente)
  const tenants = await getUserTenants(userId);
  
  const hasAccess = tenants.some(t => t.tenantId === tenantId && t.stato === 'attivo');
  
  if (!hasAccess) {
    throw new Error('Utente non ha accesso a questo tenant');
  }
  
  // Imposta nuovo tenant
  setCurrentTenantId(tenantId);
  
  // Pulisci cache tenant
  tenantCache = null;
  
  return true;
}

/**
 * Verifica se utente appartiene a un tenant
 * @param {string} tenantId - ID tenant
 * @param {string} userId - ID utente (opzionale, usa utente corrente se non specificato)
 * @returns {Promise<boolean>} true se appartiene al tenant
 */
export async function userBelongsToTenant(tenantId, userId = null) {
  if (!tenantId) {
    return false;
  }
  
  const tenants = await getUserTenants(userId);
  return tenants.some(t => t.tenantId === tenantId && t.stato === 'attivo');
}

/**
 * Ottieni tenant predefinito per un utente
 * @param {string} userId - ID utente (opzionale, usa utente corrente se non specificato)
 * @returns {Promise<string|null>} ID del tenant predefinito o null
 */
export async function getDefaultTenant(userId = null) {
  const tenants = await getUserTenants(userId);
  
  // Cerca tenant con flag tenantIdPredefinito
  const defaultTenant = tenants.find(t => t.tenantIdPredefinito === true);
  if (defaultTenant) {
    return defaultTenant.tenantId;
  }
  
  // Altrimenti usa il primo tenant attivo
  const firstActive = tenants.find(t => t.stato === 'attivo');
  return firstActive ? firstActive.tenantId : null;
}

/**
 * Pulisci cache tenant utente (utile dopo aggiunta nuova membership)
 */
export function clearUserTenantsCache() {
  userTenantsCache = null;
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
  hasValidTenant,
  getUserTenants,
  getUserRolesForTenant,
  switchTenant,
  userBelongsToTenant,
  getDefaultTenant,
  clearUserTenantsCache
};

