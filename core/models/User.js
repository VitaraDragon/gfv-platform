/**
 * User Model - Modello dati utente
 * Gestisce dati utente con ruoli, tenant e stato
 * 
 * @module core/models/User
 */

import { Base } from './Base.js';

export class User extends Base {
  /**
   * Costruttore User
   * @param {Object} data - Dati utente
   * @param {string} data.id - ID utente (Firebase UID)
   * @param {string} data.email - Email
   * @param {string} data.nome - Nome
   * @param {string} data.cognome - Cognome
   * @param {Array<string>} data.ruoli - Array ruoli ['amministratore', 'manager', etc.]
   * @param {string} data.tenantId - ID tenant
   * @param {string} data.stato - Stato ('attivo' | 'invitato' | 'disattivato')
   * @param {string} data.creatoDa - ID utente che ha creato questo utente
   * @param {Date} data.creatoIl - Data creazione
   * @param {Date} data.ultimoAccesso - Data ultimo accesso
   * @param {string} data.invitoId - ID invito (se creato tramite invito)
   */
  constructor(data = {}) {
    super(data);
    
    this.email = data.email || '';
    this.nome = data.nome || '';
    this.cognome = data.cognome || '';
    this.ruoli = data.ruoli || [];
    this.tenantId = data.tenantId || null;
    this.stato = data.stato || 'attivo';
    this.creatoDa = data.creatoDa || null;
    this.creatoIl = data.creatoIl ? (data.creatoIl instanceof Date ? data.creatoIl : new Date(data.creatoIl)) : null;
    this.ultimoAccesso = data.ultimoAccesso ? (data.ultimoAccesso instanceof Date ? data.ultimoAccesso : new Date(data.ultimoAccesso)) : null;
    this.invitoId = data.invitoId || null;
  }
  
  /**
   * Valida dati utente
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validate() {
    const errors = [];
    
    if (!this.email || !this.email.includes('@')) {
      errors.push('Email non valida');
    }
    
    if (!this.nome || this.nome.trim().length === 0) {
      errors.push('Nome obbligatorio');
    }
    
    if (!this.cognome || this.cognome.trim().length === 0) {
      errors.push('Cognome obbligatorio');
    }
    
    if (!Array.isArray(this.ruoli)) {
      errors.push('Ruoli deve essere un array');
    }
    
    const validStates = ['attivo', 'invitato', 'disattivato'];
    if (this.stato && !validStates.includes(this.stato)) {
      errors.push(`Stato non valido. Deve essere uno di: ${validStates.join(', ')}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Ottieni nome completo
   * @returns {string} Nome completo
   */
  getFullName() {
    return `${this.nome} ${this.cognome}`.trim();
  }
  
  /**
   * Verifica se utente ha un ruolo specifico
   * @param {string} role - Nome ruolo
   * @returns {boolean} true se ha il ruolo
   */
  hasRole(role) {
    return this.ruoli && this.ruoli.includes(role);
  }
  
  /**
   * Verifica se utente ha almeno uno dei ruoli
   * @param {Array<string>} roles - Array di ruoli
   * @returns {boolean} true se ha almeno un ruolo
   */
  hasAnyRole(roles) {
    if (!this.ruoli || !Array.isArray(roles)) {
      return false;
    }
    return roles.some(role => this.ruoli.includes(role));
  }
  
  /**
   * Verifica se utente ha tutti i ruoli
   * @param {Array<string>} roles - Array di ruoli
   * @returns {boolean} true se ha tutti i ruoli
   */
  hasAllRoles(roles) {
    if (!this.ruoli || !Array.isArray(roles)) {
      return false;
    }
    return roles.every(role => this.ruoli.includes(role));
  }
  
  /**
   * Aggiungi ruolo
   * @param {string} role - Nome ruolo
   */
  addRole(role) {
    if (!this.ruoli) {
      this.ruoli = [];
    }
    if (!this.ruoli.includes(role)) {
      this.ruoli.push(role);
    }
  }
  
  /**
   * Rimuovi ruolo
   * @param {string} role - Nome ruolo
   */
  removeRole(role) {
    if (this.ruoli) {
      this.ruoli = this.ruoli.filter(r => r !== role);
    }
  }
  
  /**
   * Verifica se utente è attivo
   * @returns {boolean} true se attivo
   */
  isActive() {
    return this.stato === 'attivo';
  }
  
  /**
   * Verifica se utente è invitato (non ancora registrato)
   * @returns {boolean} true se invitato
   */
  isInvited() {
    return this.stato === 'invitato';
  }
  
  /**
   * Verifica se utente è disattivato
   * @returns {boolean} true se disattivato
   */
  isDisabled() {
    return this.stato === 'disattivato';
  }
  
  /**
   * Converte in formato Firestore
   * @returns {Object} Oggetto Firestore
   */
  toFirestore() {
    const data = super.toFirestore();
    
    // Assicurati che ruoli sia sempre un array
    if (!data.ruoli) {
      data.ruoli = [];
    }
    
    return data;
  }
}

export default User;



