/**
 * Permission Service - Controllo permessi e ruoli
 * Gestisce verifica permessi basati su ruoli utente
 * 
 * @module core/services/permission-service
 */

import { getCurrentUserData } from './auth-service.js';

/**
 * Verifica se utente ha un ruolo specifico
 * @param {Object} user - Dati utente (se null usa utente corrente)
 * @param {string} role - Nome ruolo
 * @returns {boolean} true se ha il ruolo
 */
export function hasRole(user, role) {
  const userData = user || getCurrentUserData();
  if (!userData || !userData.ruoli) {
    return false;
  }
  return userData.ruoli.includes(role);
}

/**
 * Verifica se utente ha almeno uno dei ruoli
 * @param {Object} user - Dati utente (se null usa utente corrente)
 * @param {Array<string>} roles - Array di ruoli
 * @returns {boolean} true se ha almeno un ruolo
 */
export function hasAnyRole(user, roles) {
  const userData = user || getCurrentUserData();
  if (!userData || !userData.ruoli || !Array.isArray(roles)) {
    return false;
  }
  return roles.some(role => userData.ruoli.includes(role));
}

/**
 * Verifica se utente ha tutti i ruoli
 * @param {Object} user - Dati utente (se null usa utente corrente)
 * @param {Array<string>} roles - Array di ruoli
 * @returns {boolean} true se ha tutti i ruoli
 */
export function hasAllRoles(user, roles) {
  const userData = user || getCurrentUserData();
  if (!userData || !userData.ruoli || !Array.isArray(roles)) {
    return false;
  }
  return roles.every(role => userData.ruoli.includes(role));
}

/**
 * Verifica se utente può assegnare ruoli
 * Solo amministratore può assegnare ruoli
 * @param {Object} user - Dati utente (se null usa utente corrente)
 * @returns {boolean} true se può assegnare ruoli
 */
export function canAssignRoles(user) {
  return hasRole(user, 'amministratore');
}

/**
 * Verifica se utente può vedere tutti i lavori
 * Manager e Amministratore possono vedere tutto
 * @param {Object} user - Dati utente (se null usa utente corrente)
 * @returns {boolean} true se può vedere tutti i lavori
 */
export function canViewAllLavori(user) {
  return hasAnyRole(user, ['amministratore', 'manager']);
}

/**
 * Verifica se utente può validare ore
 * Amministratore, Manager e Caposquadra possono validare
 * @param {Object} user - Dati utente (se null usa utente corrente)
 * @returns {boolean} true se può validare ore
 */
export function canValidateOre(user) {
  return hasAnyRole(user, ['amministratore', 'manager', 'caposquadra']);
}

/**
 * Verifica se utente può gestire abbonamenti
 * Solo amministratore può gestire abbonamenti
 * @param {Object} user - Dati utente (se null usa utente corrente)
 * @returns {boolean} true se può gestire abbonamenti
 */
export function canManageSubscriptions(user) {
  return hasRole(user, 'amministratore');
}

/**
 * Verifica se utente può invitare utenti
 * Solo amministratore può invitare utenti
 * @param {Object} user - Dati utente (se null usa utente corrente)
 * @returns {boolean} true se può invitare utenti
 */
export function canInviteUsers(user) {
  return hasRole(user, 'amministratore');
}

/**
 * Verifica se utente può gestire clienti
 * Manager e Amministratore possono gestire clienti
 * @param {Object} user - Dati utente (se null usa utente corrente)
 * @returns {boolean} true se può gestire clienti
 */
export function canManageClients(user) {
  return hasAnyRole(user, ['amministratore', 'manager']);
}

/**
 * Verifica se utente può gestire terreni
 * Manager e Amministratore possono gestire terreni
 * @param {Object} user - Dati utente (se null usa utente corrente)
 * @returns {boolean} true se può gestire terreni
 */
export function canManageTerreni(user) {
  return hasAnyRole(user, ['amministratore', 'manager']);
}

/**
 * Verifica se utente può creare calcoli
 * Manager e Amministratore possono creare calcoli
 * @param {Object} user - Dati utente (se null usa utente corrente)
 * @returns {boolean} true se può creare calcoli
 */
export function canCreateCalcoli(user) {
  return hasAnyRole(user, ['amministratore', 'manager']);
}

/**
 * Verifica se utente può vedere report completi
 * Manager e Amministratore possono vedere report completi
 * @param {Object} user - Dati utente (se null usa utente corrente)
 * @returns {boolean} true se può vedere report
 */
export function canViewReports(user) {
  return hasAnyRole(user, ['amministratore', 'manager']);
}

/**
 * Verifica se utente può segnare ore
 * Tutti gli utenti autenticati possono segnare le proprie ore
 * @param {Object} user - Dati utente (se null usa utente corrente)
 * @returns {boolean} true se può segnare ore
 */
export function canSignOre(user) {
  const userData = user || getCurrentUserData();
  return userData !== null && userData.stato === 'attivo';
}

/**
 * Verifica se utente può vedere lavori assegnati
 * Caposquadra può vedere lavori assegnati a lui
 * @param {Object} user - Dati utente (se null usa utente corrente)
 * @returns {boolean} true se può vedere lavori assegnati
 */
export function canViewAssignedLavori(user) {
  return hasRole(user, 'caposquadra');
}

/**
 * Verifica se utente può vedere lavori di oggi
 * Operaio può vedere solo lavori di oggi assegnati a lui
 * @param {Object} user - Dati utente (se null usa utente corrente)
 * @returns {boolean} true se può vedere lavori di oggi
 */
export function canViewTodayLavori(user) {
  return hasRole(user, 'operaio');
}

/**
 * Verifica se utente può gestire squadre
 * Manager e Amministratore possono gestire squadre
 * @param {Object} user - Dati utente (se null usa utente corrente)
 * @returns {boolean} true se può gestire squadre
 */
export function canManageSquadre(user) {
  return hasAnyRole(user, ['amministratore', 'manager']);
}

/**
 * Ottieni tutti i permessi disponibili per un utente
 * @param {Object} user - Dati utente (se null usa utente corrente)
 * @returns {Object} Oggetto con tutti i permessi
 */
export function getAllPermissions(user) {
  return {
    canAssignRoles: canAssignRoles(user),
    canViewAllLavori: canViewAllLavori(user),
    canValidateOre: canValidateOre(user),
    canManageSubscriptions: canManageSubscriptions(user),
    canInviteUsers: canInviteUsers(user),
    canManageClients: canManageClients(user),
    canManageTerreni: canManageTerreni(user),
    canCreateCalcoli: canCreateCalcoli(user),
    canViewReports: canViewReports(user),
    canSignOre: canSignOre(user),
    canViewAssignedLavori: canViewAssignedLavori(user),
    canViewTodayLavori: canViewTodayLavori(user),
    canManageSquadre: canManageSquadre(user)
  };
}

// Export default
export default {
  hasRole,
  hasAnyRole,
  hasAllRoles,
  canAssignRoles,
  canViewAllLavori,
  canValidateOre,
  canManageSubscriptions,
  canInviteUsers,
  canManageClients,
  canManageTerreni,
  canCreateCalcoli,
  canViewReports,
  canSignOre,
  canViewAssignedLavori,
  canViewTodayLavori,
  canManageSquadre,
  getAllPermissions
};

