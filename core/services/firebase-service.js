/**
 * Firebase Service - Servizio base per tutte le operazioni Firebase
 * Gestisce connessione, operazioni CRUD e supporto multi-tenant
 * Usa Firebase 11 da CDN gstatic (stesso build = servizi disponibili)
 * @module core/services/firebase-service
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  limit,
  setDoc,
  Timestamp,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// Re-export per moduli che importano da firebase-service (stesso SDK, niente "different Firestore SDK")
export { signOut, onAuthStateChanged };
export {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  limit,
  setDoc,
  Timestamp,
  serverTimestamp
};

// Configurazione Firebase (da centralizzare)
let firebaseConfig = null;
let app = null;
let db = null;
let auth = null;

/**
 * Inizializza Firebase con la configurazione fornita
 * @param {Object} config - Configurazione Firebase
 */
export function initializeFirebase(config) {
  if (app) {
    console.warn('Firebase già inizializzato');
    return;
  }
  
  firebaseConfig = config;
  app = initializeApp(config);
  db = getFirestore(app);
  auth = getAuth(app);
  
  return { app, db, auth };
}

/**
 * Registra istanze Firebase già inizializzate (per compatibilità con codice esistente)
 * @param {Object} instances - Istanze Firebase
 * @param {Object} instances.app - App Firebase
 * @param {Object} instances.db - Firestore instance
 * @param {Object} instances.auth - Auth instance
 */
export function setFirebaseInstances(instances) {
  if (instances.app) app = instances.app;
  if (instances.db) db = instances.db;
  if (instances.auth) auth = instances.auth;
}

/**
 * Ottieni istanza Firestore
 * @returns {Firestore} Istanza Firestore
 */
export function getDb() {
  if (!db) {
    throw new Error('Firebase non inizializzato. Chiama initializeFirebase() prima.');
  }
  return db;
}

/**
 * Ottieni istanza Auth
 * @returns {Auth} Istanza Auth
 */
export function getAuthInstance() {
  if (!auth) {
    throw new Error('Firebase non inizializzato. Chiama initializeFirebase() prima.');
  }
  return auth;
}

/**
 * Ottieni istanza App Firebase (per moduli che richiedono l'app, es. Tony / AI Logic)
 * @returns {FirebaseApp} Istanza App Firebase
 */
export function getAppInstance() {
  if (!app) {
    throw new Error('Firebase non inizializzato. Chiama initializeFirebase() prima.');
  }
  return app;
}

/**
 * Ottieni riferimento a una collection (con supporto multi-tenant).
 * Firestore JS v9 richiede path come segmenti separati (es. collection(db, 'tenants', id, 'lavori')).
 * @param {string} collectionName - Nome collection o path (es. "lavori" o "vigneti/xyz/potature")
 * @param {string} tenantId - ID del tenant (opzionale)
 * @returns {CollectionReference} Riferimento alla collection
 */
export function getCollection(collectionName, tenantId = null) {
  const dbInstance = getDb();
  const fullPath = tenantId ? `tenants/${tenantId}/${collectionName}` : collectionName;
  const segments = fullPath.split('/').filter(Boolean);
  return collection(dbInstance, ...segments);
}

/**
 * Ottieni riferimento a un documento (path come segmenti per compatibilità Firestore v9).
 * @param {string} collectionName - Nome collection o path (es. "lavori" o "vigneti/xyz/potature")
 * @param {string} documentId - ID del documento
 * @param {string} tenantId - ID del tenant (opzionale)
 * @returns {DocumentReference} Riferimento al documento
 */
export function getDocument(collectionName, documentId, tenantId = null) {
  const dbInstance = getDb();
  const fullPath = tenantId
    ? `tenants/${tenantId}/${collectionName}/${documentId}`
    : `${collectionName}/${documentId}`;
  const segments = fullPath.split('/').filter(Boolean);
  return doc(dbInstance, ...segments);
}

/**
 * Crea un nuovo documento
 * @param {string} collectionName - Nome della collection
 * @param {Object} data - Dati del documento
 * @param {string} tenantId - ID del tenant (opzionale)
 * @returns {Promise<string>} ID del documento creato
 */
export async function createDocument(collectionName, data, tenantId = null) {
  try {
    const collectionRef = getCollection(collectionName, tenantId);
    
    // Aggiungi timestamp automatici
    const documentData = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(collectionRef, documentData);
    return docRef.id;
  } catch (error) {
    console.error(`Errore creazione documento in ${collectionName}:`, error);
    throw new Error(`Errore creazione documento: ${error.message}`);
  }
}

/**
 * Aggiorna un documento esistente
 * @param {string} collectionName - Nome della collection
 * @param {string} documentId - ID del documento
 * @param {Object} data - Dati da aggiornare
 * @param {string} tenantId - ID del tenant (opzionale)
 * @returns {Promise<void>}
 */
export async function updateDocument(collectionName, documentId, data, tenantId = null) {
  try {
    const docRef = getDocument(collectionName, documentId, tenantId);
    
    // Aggiungi updatedAt automatico
    const updateData = {
      ...data,
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(docRef, updateData);
  } catch (error) {
    console.error(`Errore aggiornamento documento ${documentId} in ${collectionName}:`, error);
    throw new Error(`Errore aggiornamento documento: ${error.message}`);
  }
}

/**
 * Elimina un documento
 * @param {string} collectionName - Nome della collection
 * @param {string} documentId - ID del documento
 * @param {string} tenantId - ID del tenant (opzionale)
 * @returns {Promise<void>}
 */
export async function deleteDocument(collectionName, documentId, tenantId = null) {
  try {
    const docRef = getDocument(collectionName, documentId, tenantId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Errore eliminazione documento ${documentId} in ${collectionName}:`, error);
    throw new Error(`Errore eliminazione documento: ${error.message}`);
  }
}

/**
 * Leggi un singolo documento
 * @param {string} collectionName - Nome della collection
 * @param {string} documentId - ID del documento
 * @param {string} tenantId - ID del tenant (opzionale)
 * @returns {Promise<Object|null>} Dati del documento o null se non trovato
 */
export async function getDocumentData(collectionName, documentId, tenantId = null) {
  try {
    const docRef = getDocument(collectionName, documentId, tenantId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Errore lettura documento ${documentId} in ${collectionName}:`, error);
    throw new Error(`Errore lettura documento: ${error.message}`);
  }
}

/**
 * Leggi tutti i documenti di una collection con filtri opzionali
 * @param {string} collectionName - Nome della collection
 * @param {Object} options - Opzioni di query
 * @param {string} options.tenantId - ID del tenant (opzionale)
 * @param {string} options.orderBy - Campo per ordinamento
 * @param {string} options.orderDirection - Direzione ordinamento ('asc' | 'desc')
 * @param {Array} options.where - Array di filtri [['campo', 'operatore', 'valore']]
 * @param {number} options.limit - Limite risultati
 * @returns {Promise<Array>} Array di documenti
 */
export async function getCollectionData(collectionName, options = {}) {
  try {
    const { tenantId, orderBy: orderByField, orderDirection = 'asc', where: whereFilters = [], limit: limitCount } = options;

    const collectionPath = tenantId ? `tenants/${tenantId}/${collectionName}` : collectionName;
    
    let collectionRef = getCollection(collectionName, tenantId);

    // Applica filtri where
    if (whereFilters.length > 0) {
      whereFilters.forEach(([field, operator, value]) => {
        collectionRef = query(collectionRef, where(field, operator, value));
      });
    }

    // Applica ordinamento
    if (orderByField) {
      collectionRef = query(collectionRef, orderBy(orderByField, orderDirection));
    }

    // Applica limite
    if (limitCount) {
      collectionRef = query(collectionRef, limit(limitCount));
    }
    
    const querySnapshot = await getDocs(collectionRef);
    
    const documents = [];
    querySnapshot.forEach((doc) => {
      documents.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return documents;
  } catch (error) {
    // Se è un errore di indice, sarà gestito dal fallback nei servizi
    // Non loggare come errore per non spaventare l'utente
    if (error.message && error.message.includes('index')) {
      throw error; // Rilancia per gestione nel servizio
    }
    console.error(`Errore lettura collection ${collectionName}:`, error);
    throw new Error(`Errore lettura collection: ${error.message}`);
  }
}

/**
 * Ascolta cambiamenti in tempo reale su una collection
 * @param {string} collectionName - Nome della collection
 * @param {Function} callback - Callback chiamato ad ogni cambiamento
 * @param {Object} options - Opzioni di query
 * @param {string} options.tenantId - ID del tenant (opzionale)
 * @param {string} options.orderBy - Campo per ordinamento
 * @param {string} options.orderDirection - Direzione ordinamento
 * @param {Array} options.where - Array di filtri
 * @returns {Function} Funzione per disiscriversi
 */
export function subscribeToCollection(collectionName, callback, options = {}) {
  try {
    const { tenantId, orderBy: orderByField, orderDirection = 'asc', where: whereFilters = [] } = options;
    
    let collectionRef = getCollection(collectionName, tenantId);
    
    // Applica filtri
    if (whereFilters.length > 0) {
      whereFilters.forEach(([field, operator, value]) => {
        collectionRef = query(collectionRef, where(field, operator, value));
      });
    }
    
    if (orderByField) {
      collectionRef = query(collectionRef, orderBy(orderByField, orderDirection));
    }
    
    // Ascolta cambiamenti
    const unsubscribe = onSnapshot(collectionRef, (querySnapshot) => {
      const documents = [];
      querySnapshot.forEach((doc) => {
        documents.push({
          id: doc.id,
          ...doc.data()
        });
      });
      callback(documents);
    }, (error) => {
      console.error(`Errore subscription ${collectionName}:`, error);
      callback([], error);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error(`Errore setup subscription ${collectionName}:`, error);
    throw new Error(`Errore setup subscription: ${error.message}`);
  }
}

/**
 * Ascolta cambiamenti in tempo reale su un documento
 * @param {string} collectionName - Nome della collection
 * @param {string} documentId - ID del documento
 * @param {Function} callback - Callback chiamato ad ogni cambiamento
 * @param {string} tenantId - ID del tenant (opzionale)
 * @returns {Function} Funzione per disiscriversi
 */
export function subscribeToDocument(collectionName, documentId, callback, tenantId = null) {
  try {
    const docRef = getDocument(collectionName, documentId, tenantId);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback({
          id: docSnap.id,
          ...docSnap.data()
        });
      } else {
        callback(null);
      }
    }, (error) => {
      console.error(`Errore subscription documento ${documentId}:`, error);
      callback(null, error);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error(`Errore setup subscription documento ${documentId}:`, error);
    throw new Error(`Errore setup subscription documento: ${error.message}`);
  }
}

/**
 * Crea o aggiorna un documento (upsert)
 * @param {string} collectionName - Nome della collection
 * @param {string} documentId - ID del documento
 * @param {Object} data - Dati del documento
 * @param {string} tenantId - ID del tenant (opzionale)
 * @returns {Promise<void>}
 */
export async function setDocument(collectionName, documentId, data, tenantId = null) {
  try {
    const docRef = getDocument(collectionName, documentId, tenantId);
    
    const documentData = {
      ...data,
      updatedAt: serverTimestamp()
    };
    
    // Se il documento esiste, aggiungi createdAt solo se non presente
    const existingDoc = await getDoc(docRef);
    if (!existingDoc.exists()) {
      documentData.createdAt = serverTimestamp();
    }
    
    await setDoc(docRef, documentData, { merge: true });
  } catch (error) {
    console.error(`Errore set documento ${documentId} in ${collectionName}:`, error);
    throw new Error(`Errore set documento: ${error.message}`);
  }
}

/**
 * Converte Firestore Timestamp in Date JavaScript
 * @param {Timestamp} timestamp - Firestore Timestamp
 * @returns {Date|null} Date JavaScript o null
 */
export function timestampToDate(timestamp) {
  if (!timestamp) return null;
  if (timestamp.toDate) {
    return timestamp.toDate();
  }
  return new Date(timestamp);
}

/**
 * Converte Date JavaScript in Firestore Timestamp
 * @param {Date} date - Date JavaScript
 * @returns {Timestamp} Firestore Timestamp
 */
export function dateToTimestamp(date) {
  if (!date) return null;
  return Timestamp.fromDate(date instanceof Date ? date : new Date(date));
}

// Export default
export default {
  initializeFirebase,
  getDb,
  getAuthInstance,
  getAppInstance,
  getCollection,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  getDocumentData,
  getCollectionData,
  subscribeToCollection,
  subscribeToDocument,
  setDocument,
  timestampToDate,
  dateToTimestamp
};

