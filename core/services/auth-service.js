/**
 * Auth Service - Gestione autenticazione e utenti
 * Gestisce login, registrazione, gestione sessione e utente corrente
 * 
 * @module core/services/auth-service
 */

import { 
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getAuthInstance } from './firebase-service.js';
import { getDocumentData, createDocument, updateDocument } from './firebase-service.js';
import { getCurrentTenantId, setCurrentTenantId } from './tenant-service.js';

// Utente corrente in cache
let currentUserData = null;
let authStateListeners = [];

/**
 * Inizializza il servizio di autenticazione
 * @returns {Function} Funzione per disiscriversi
 */
export function initializeAuthService() {
  const auth = getAuthInstance();
  
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Carica dati utente completi
      try {
        const userData = await getDocumentData('users', user.uid);
        currentUserData = userData;
        
        // Aggiorna tenant corrente se disponibile
        if (userData && userData.tenantId) {
          setCurrentTenantId(userData.tenantId);
        }
        
        // Notifica tutti i listener
        authStateListeners.forEach(listener => {
          try {
            listener(user, userData);
          } catch (error) {
            console.error('Errore in auth state listener:', error);
          }
        });
      } catch (error) {
        console.error('Errore caricamento dati utente:', error);
        currentUserData = null;
      }
    } else {
      currentUserData = null;
      setCurrentTenantId(null);
      
      // Notifica tutti i listener
      authStateListeners.forEach(listener => {
        try {
          listener(null, null);
        } catch (error) {
          console.error('Errore in auth state listener:', error);
        }
      });
    }
  });
}

/**
 * Registra un listener per cambiamenti stato autenticazione
 * @param {Function} callback - Callback (user, userData) => void
 * @returns {Function} Funzione per rimuovere il listener
 */
export function onAuthStateChange(callback) {
  authStateListeners.push(callback);
  
  // Chiama subito con stato corrente
  const auth = getAuthInstance();
  const user = auth.currentUser;
  if (user && currentUserData) {
    callback(user, currentUserData);
  } else if (!user) {
    callback(null, null);
  }
  
  // Ritorna funzione per rimuovere
  return () => {
    authStateListeners = authStateListeners.filter(l => l !== callback);
  };
}

/**
 * Registra un nuovo utente
 * @param {string} email - Email utente
 * @param {string} password - Password
 * @param {Object} userData - Dati aggiuntivi utente
 * @param {string} userData.nome - Nome
 * @param {string} userData.cognome - Cognome
 * @param {string} userData.tenantId - ID tenant (opzionale)
 * @param {Array<string>} userData.ruoli - Array ruoli (opzionale)
 * @returns {Promise<Object>} Dati utente creato
 */
export async function signUp(email, password, userData = {}) {
  try {
    const auth = getAuthInstance();
    
    // Valida input
    if (!email || !email.includes('@')) {
      throw new Error('Email non valida');
    }
    if (!password || password.length < 6) {
      throw new Error('Password deve essere almeno 6 caratteri');
    }
    
    // Crea utente Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    // Crea record utente in Firestore
    const userRecord = {
      id: firebaseUser.uid,
      email: email.toLowerCase().trim(),
      nome: userData.nome || '',
      cognome: userData.cognome || '',
      ruoli: userData.ruoli || [],
      tenantId: userData.tenantId || null,
      stato: 'attivo',
      creatoIl: new Date(),
      ultimoAccesso: new Date()
    };
    
    await createDocument('users', userRecord);
    
    // Aggiorna profilo Firebase
    if (userData.nome || userData.cognome) {
      await updateProfile(firebaseUser, {
        displayName: `${userData.nome || ''} ${userData.cognome || ''}`.trim()
      });
    }
    
    return userRecord;
  } catch (error) {
    console.error('Errore registrazione:', error);
    throw new Error(`Errore registrazione: ${error.message}`);
  }
}

/**
 * Effettua login
 * @param {string} email - Email utente
 * @param {string} password - Password
 * @returns {Promise<Object>} Dati utente
 */
export async function signIn(email, password) {
  try {
    const auth = getAuthInstance();
    
    // Valida input
    if (!email || !email.includes('@')) {
      throw new Error('Email non valida');
    }
    if (!password) {
      throw new Error('Password obbligatoria');
    }
    
    // Login Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    // Carica dati utente
    const userData = await getDocumentData('users', firebaseUser.uid);
    
    if (!userData) {
      throw new Error('Dati utente non trovati');
    }
    
    // Verifica stato utente
    if (userData.stato !== 'attivo') {
      await signOut();
      throw new Error('Account non attivo. Contatta l\'amministratore.');
    }
    
    // Aggiorna ultimo accesso
    await updateDocument('users', firebaseUser.uid, {
      ultimoAccesso: new Date()
    });
    
    return userData;
  } catch (error) {
    console.error('Errore login:', error);
    throw new Error(`Errore login: ${error.message}`);
  }
}

/**
 * Effettua logout
 * @returns {Promise<void>}
 */
export async function signOutUser() {
  try {
    const auth = getAuthInstance();
    await signOut(auth);
    currentUserData = null;
    setCurrentTenantId(null);
  } catch (error) {
    console.error('Errore logout:', error);
    throw new Error(`Errore logout: ${error.message}`);
  }
}

/**
 * Ottieni utente corrente (Firebase Auth)
 * @returns {Object|null} Utente Firebase corrente
 */
export function getCurrentFirebaseUser() {
  try {
    const auth = getAuthInstance();
    return auth.currentUser;
  } catch (error) {
    return null;
  }
}

/**
 * Ottieni dati completi utente corrente
 * @returns {Object|null} Dati utente o null
 */
export function getCurrentUserData() {
  return currentUserData;
}

/**
 * Verifica se l'utente è autenticato
 * @returns {boolean} true se autenticato
 */
export function isAuthenticated() {
  return getCurrentFirebaseUser() !== null && currentUserData !== null;
}

/**
 * Invia email reset password
 * @param {string} email - Email utente
 * @returns {Promise<void>}
 */
export async function resetPassword(email) {
  try {
    if (!email || !email.includes('@')) {
      throw new Error('Email non valida');
    }
    
    const auth = getAuthInstance();
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error('Errore reset password:', error);
    throw new Error(`Errore invio email reset: ${error.message}`);
  }
}

/**
 * Aggiorna password utente corrente
 * @param {string} newPassword - Nuova password
 * @returns {Promise<void>}
 */
export async function updateUserPassword(newPassword) {
  try {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password deve essere almeno 6 caratteri');
    }
    
    const user = getCurrentFirebaseUser();
    if (!user) {
      throw new Error('Utente non autenticato');
    }
    
    await updatePassword(user, newPassword);
  } catch (error) {
    console.error('Errore aggiornamento password:', error);
    throw new Error(`Errore aggiornamento password: ${error.message}`);
  }
}

/**
 * Aggiorna dati profilo utente
 * @param {Object} updates - Dati da aggiornare
 * @returns {Promise<void>}
 */
export async function updateUserProfile(updates) {
  try {
    const user = getCurrentFirebaseUser();
    if (!user) {
      throw new Error('Utente non autenticato');
    }
    
    // Aggiorna Firestore
    await updateDocument('users', user.uid, updates);
    
    // Aggiorna cache locale
    if (currentUserData) {
      currentUserData = { ...currentUserData, ...updates };
    }
    
    // Aggiorna Firebase Auth profile se necessario
    if (updates.nome || updates.cognome) {
      const displayName = `${updates.nome || currentUserData?.nome || ''} ${updates.cognome || currentUserData?.cognome || ''}`.trim();
      await updateProfile(user, { displayName });
    }
  } catch (error) {
    console.error('Errore aggiornamento profilo:', error);
    throw new Error(`Errore aggiornamento profilo: ${error.message}`);
  }
}

// Export default
export default {
  initializeAuthService,
  onAuthStateChange,
  signUp,
  signIn,
  signOutUser,
  getCurrentFirebaseUser,
  getCurrentUserData,
  isAuthenticated,
  resetPassword,
  updateUserPassword,
  updateUserProfile
};





