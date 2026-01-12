/**
 * Role Service - Gestione assegnazione e rimozione ruoli
 * Gestisce operazioni sui ruoli utente (solo amministratore)
 * 
 * @module core/services/role-service
 */

import { getDocumentData, updateDocument, getCollectionData } from './firebase-service.js';
import { canAssignRoles } from './permission-service.js';
import { getCurrentUserData } from './auth-service.js';

/**
 * Assegna un ruolo a un utente
 * Solo amministratore può assegnare ruoli
 * @param {string} userId - ID utente
 * @param {string} role - Nome ruolo da assegnare
 * @param {string} assignedBy - ID utente che assegna (se null usa utente corrente)
 * @returns {Promise<void>}
 */
export async function assignRole(userId, role, assignedBy = null) {
  try {
    // Verifica permessi
    const assigner = assignedBy ? await getDocumentData('users', assignedBy) : getCurrentUserData();
    if (!canAssignRoles(assigner)) {
      throw new Error('Solo amministratore può assegnare ruoli');
    }
    
    // Valida ruolo
    const validRoles = ['amministratore', 'manager', 'caposquadra', 'operaio'];
    if (!validRoles.includes(role)) {
      throw new Error(`Ruolo non valido. Ruoli disponibili: ${validRoles.join(', ')}`);
    }
    
    // Carica utente
    const user = await getDocumentData('users', userId);
    if (!user) {
      throw new Error('Utente non trovato');
    }
    
    // Verifica se ruolo già assegnato
    const ruoli = user.ruoli || [];
    if (ruoli.includes(role)) {
      return; // Ruolo già assegnato, nessuna operazione
    }
    
    // Aggiungi ruolo
    ruoli.push(role);
    
    // Aggiorna utente
    await updateDocument('users', userId, {
      ruoli: ruoli
    });
    
  } catch (error) {
    console.error('Errore assegnazione ruolo:', error);
    throw new Error(`Errore assegnazione ruolo: ${error.message}`);
  }
}

/**
 * Rimuovi un ruolo da un utente
 * Solo amministratore può rimuovere ruoli
 * @param {string} userId - ID utente
 * @param {string} role - Nome ruolo da rimuovere
 * @param {string} removedBy - ID utente che rimuove (se null usa utente corrente)
 * @returns {Promise<void>}
 */
export async function removeRole(userId, role, removedBy = null) {
  try {
    // Verifica permessi
    const remover = removedBy ? await getDocumentData('users', removedBy) : getCurrentUserData();
    if (!canAssignRoles(remover)) {
      throw new Error('Solo amministratore può rimuovere ruoli');
    }
    
    // Carica utente
    const user = await getDocumentData('users', userId);
    if (!user) {
      throw new Error('Utente non trovato');
    }
    
    // Verifica se utente sta cercando di rimuovere il proprio ruolo amministratore
    if (userId === (removedBy || getCurrentUserData()?.id) && role === 'amministratore') {
      // Conta quanti amministratori ci sono nel tenant
      const tenantUsers = await getCollectionData('users', {
        where: [['tenantId', '==', user.tenantId]]
      });
      const adminCount = tenantUsers.filter(u => u.ruoli && u.ruoli.includes('amministratore')).length;
      
      if (adminCount <= 1) {
        throw new Error('Non puoi rimuovere l\'ultimo amministratore del tenant');
      }
    }
    
    // Rimuovi ruolo
    const ruoli = (user.ruoli || []).filter(r => r !== role);
    
    // Verifica che rimanga almeno un ruolo (opzionale, dipende dalla logica business)
    if (ruoli.length === 0) {
      throw new Error('Un utente deve avere almeno un ruolo');
    }
    
    // Aggiorna utente
    await updateDocument('users', userId, {
      ruoli: ruoli
    });
    
  } catch (error) {
    console.error('Errore rimozione ruolo:', error);
    throw new Error(`Errore rimozione ruolo: ${error.message}`);
  }
}

/**
 * Assegna multipli ruoli a un utente
 * @param {string} userId - ID utente
 * @param {Array<string>} roles - Array di ruoli da assegnare
 * @param {string} assignedBy - ID utente che assegna
 * @returns {Promise<void>}
 */
export async function assignRoles(userId, roles, assignedBy = null) {
  try {
    for (const role of roles) {
      await assignRole(userId, role, assignedBy);
    }
  } catch (error) {
    console.error('Errore assegnazione ruoli multipli:', error);
    throw error;
  }
}

/**
 * Sostituisci tutti i ruoli di un utente
 * @param {string} userId - ID utente
 * @param {Array<string>} roles - Nuovi ruoli
 * @param {string} assignedBy - ID utente che assegna
 * @returns {Promise<void>}
 */
export async function setRoles(userId, roles, assignedBy = null) {
  try {
    // Verifica permessi
    const assigner = assignedBy ? await getDocumentData('users', assignedBy) : getCurrentUserData();
    if (!canAssignRoles(assigner)) {
      throw new Error('Solo amministratore può modificare ruoli');
    }
    
    // Valida ruoli
    const validRoles = ['amministratore', 'manager', 'caposquadra', 'operaio'];
    const invalidRoles = roles.filter(r => !validRoles.includes(r));
    if (invalidRoles.length > 0) {
      throw new Error(`Ruoli non validi: ${invalidRoles.join(', ')}`);
    }
    
    // Verifica che non si stia rimuovendo l'ultimo amministratore
    const user = await getDocumentData('users', userId);
    if (user && user.ruoli && user.ruoli.includes('amministratore') && !roles.includes('amministratore')) {
      const tenantUsers = await getCollectionData('users', {
        where: [['tenantId', '==', user.tenantId]]
      });
      const adminCount = tenantUsers.filter(u => u.ruoli && u.ruoli.includes('amministratore')).length;
      
      if (adminCount <= 1) {
        throw new Error('Non puoi rimuovere l\'ultimo amministratore del tenant');
      }
    }
    
    // Aggiorna ruoli
    await updateDocument('users', userId, {
      ruoli: roles
    });
    
  } catch (error) {
    console.error('Errore impostazione ruoli:', error);
    throw new Error(`Errore impostazione ruoli: ${error.message}`);
  }
}

/**
 * Ottieni tutti i ruoli disponibili
 * @returns {Array<string>} Array di ruoli disponibili
 */
export function getAvailableRoles() {
  return ['amministratore', 'manager', 'caposquadra', 'operaio'];
}

/**
 * Ottieni descrizione di un ruolo
 * @param {string} role - Nome ruolo
 * @returns {string} Descrizione ruolo
 */
export function getRoleDescription(role) {
  const descriptions = {
    'amministratore': 'Gestisce account aziendale, abbonamento, utenti e configurazione',
    'manager': 'Gestisce operazioni aziendali, clienti, terreni, lavori e report',
    'caposquadra': 'Gestisce squadre, valida ore lavorate, aggiorna avanzamento lavori',
    'operaio': 'Segna le proprie ore lavorate, vede lavori assegnati'
  };
  
  return descriptions[role] || 'Ruolo non definito';
}

// Export default
export default {
  assignRole,
  removeRole,
  assignRoles,
  setRoles,
  getAvailableRoles,
  getRoleDescription
};

