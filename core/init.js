/**
 * Core Initialization - Inizializza tutti i servizi core
 * Questo file deve essere importato all'avvio dell'applicazione
 * 
 * @module core/init
 */

import { initializeFirebase } from './services/firebase-service.js';
import { initializeTenantService } from './services/tenant-service.js';
import { initializeAuthService } from './services/auth-service.js';

/**
 * Inizializza il core dell'applicazione
 * @param {Object} firebaseConfig - Configurazione Firebase
 * @returns {Promise<void>}
 */
export async function initializeCore(firebaseConfig) {
  try {
    // 1. Inizializza Firebase

    initializeFirebase(firebaseConfig);
    
    // 2. Inizializza Tenant Service

    initializeTenantService();
    
    // 3. Inizializza Auth Service

    initializeAuthService();

  } catch (error) {
    console.error('❌ Errore inizializzazione core:', error);
    throw error;
  }
}

export default {
  initializeCore
};

