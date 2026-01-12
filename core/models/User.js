/**
 * User Model - Modello dati utente
 * Gestisce dati utente con ruoli, tenant e stato
 * Supporta multi-tenant membership: un utente può appartenere a più tenant con ruoli diversi
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
   * @param {Array<string>} data.ruoli - Array ruoli ['amministratore', 'manager', etc.] (DEPRECATO - usa tenantMemberships)
   * @param {string} data.tenantId - ID tenant (DEPRECATO - usa tenantMemberships)
   * @param {Object} data.tenantMemberships - Oggetto con membership per tenant { tenantId: { ruoli, stato, ... } }
   * @param {string} data.stato - Stato ('attivo' | 'invitato' | 'disattivato')
   * @param {string} data.creatoDa - ID utente che ha creato questo utente
   * @param {Date} data.creatoIl - Data creazione
   * @param {Date} data.ultimoAccesso - Data ultimo accesso
   * @param {string} data.invitoId - ID invito (se creato tramite invito)
   * @param {string} data.tipoOperaio - Tipo operaio ('semplice' | 'specializzato' | 'trattorista' | 'meccanico' | 'elettricista' | 'altro')
   * @param {string} data.tipoContratto - Tipo contratto ('stagionale' | 'determinato' | 'indeterminato')
   * @param {Date|Timestamp} data.dataInizioContratto - Data inizio contratto
   * @param {Date|Timestamp} data.dataScadenzaContratto - Data scadenza contratto
   * @param {string} data.noteContratto - Note contratto
   */
  constructor(data = {}) {
    super(data);
    
    this.email = data.email || '';
    this.nome = data.nome || '';
    this.cognome = data.cognome || '';
    
    // NUOVO: Multi-tenant membership
    this.tenantMemberships = data.tenantMemberships || {};
    
    // DEPRECATO: Mantenuto per retrocompatibilità
    this.ruoli = data.ruoli || [];
    this.tenantId = data.tenantId || null;
    
    this.stato = data.stato || 'attivo';
    this.creatoDa = data.creatoDa || null;
    this.creatoIl = data.creatoIl ? (data.creatoIl instanceof Date ? data.creatoIl : new Date(data.creatoIl)) : null;
    this.ultimoAccesso = data.ultimoAccesso ? (data.ultimoAccesso instanceof Date ? data.ultimoAccesso : new Date(data.ultimoAccesso)) : null;
    this.invitoId = data.invitoId || null;
    
    // Campi contratto
    this.tipoOperaio = data.tipoOperaio || null;
    this.tipoContratto = data.tipoContratto || null;
    this.dataInizioContratto = data.dataInizioContratto ? (data.dataInizioContratto instanceof Date ? data.dataInizioContratto : (data.dataInizioContratto.toDate ? data.dataInizioContratto.toDate() : new Date(data.dataInizioContratto))) : null;
    this.dataScadenzaContratto = data.dataScadenzaContratto ? (data.dataScadenzaContratto instanceof Date ? data.dataScadenzaContratto : (data.dataScadenzaContratto.toDate ? data.dataScadenzaContratto.toDate() : new Date(data.dataScadenzaContratto))) : null;
    this.noteContratto = data.noteContratto || null;
    
    // Campo tariffa personalizzata (opzionale, override tariffa tipo operaio)
    this.tariffaPersonalizzata = data.tariffaPersonalizzata || null;
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
   * @param {string} tenantId - ID tenant (opzionale, se non specificato usa tenantId deprecato)
   * @returns {boolean} true se ha il ruolo
   */
  hasRole(role, tenantId = null) {
    // Se specificato tenantId, usa tenantMemberships
    if (tenantId && this.tenantMemberships && this.tenantMemberships[tenantId]) {
      const membership = this.tenantMemberships[tenantId];
      return membership.ruoli && Array.isArray(membership.ruoli) && membership.ruoli.includes(role);
    }
    
    // Retrocompatibilità: usa ruoli deprecati
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
  
  // ============================================
  // METODI MULTI-TENANT MEMBERSHIP
  // ============================================
  
  /**
   * Ottieni tutte le membership tenant dell'utente
   * @returns {Object} Oggetto con tutte le membership { tenantId: { ruoli, stato, ... } }
   */
  getTenantMemberships() {
    return this.tenantMemberships || {};
  }
  
  /**
   * Ottieni ruoli utente per un tenant specifico
   * @param {string} tenantId - ID tenant
   * @returns {Array<string>} Array di ruoli per quel tenant
   */
  getRolesForTenant(tenantId) {
    if (!tenantId) {
      return [];
    }
    
    // Usa tenantMemberships se disponibile
    if (this.tenantMemberships && this.tenantMemberships[tenantId]) {
      const membership = this.tenantMemberships[tenantId];
      return membership.ruoli && Array.isArray(membership.ruoli) ? membership.ruoli : [];
    }
    
    // Retrocompatibilità: se tenantId corrisponde al tenantId deprecato, usa ruoli deprecati
    if (this.tenantId === tenantId && this.ruoli && Array.isArray(this.ruoli)) {
      return this.ruoli;
    }
    
    return [];
  }
  
  /**
   * Verifica se utente appartiene a un tenant
   * @param {string} tenantId - ID tenant
   * @returns {boolean} true se appartiene al tenant
   */
  belongsToTenant(tenantId) {
    if (!tenantId) {
      return false;
    }
    
    // Usa tenantMemberships se disponibile
    if (this.tenantMemberships && this.tenantMemberships[tenantId]) {
      const membership = this.tenantMemberships[tenantId];
      return membership.stato === 'attivo';
    }
    
    // Retrocompatibilità: verifica tenantId deprecato
    return this.tenantId === tenantId;
  }
  
  /**
   * Ottieni tenant predefinito (quello con tenantIdPredefinito: true o il primo)
   * @returns {string|null} ID del tenant predefinito o null
   */
  getDefaultTenant() {
    // Cerca tenant con flag tenantIdPredefinito
    if (this.tenantMemberships) {
      for (const [tenantId, membership] of Object.entries(this.tenantMemberships)) {
        if (membership.tenantIdPredefinito === true) {
          return tenantId;
        }
      }
      
      // Se nessuno ha il flag, restituisci il primo tenant attivo
      for (const [tenantId, membership] of Object.entries(this.tenantMemberships)) {
        if (membership.stato === 'attivo') {
          return tenantId;
        }
      }
    }
    
    // Retrocompatibilità: usa tenantId deprecato
    return this.tenantId || null;
  }
  
  /**
   * Aggiungi membership a un tenant
   * @param {string} tenantId - ID tenant
   * @param {Object} membershipData - Dati membership
   * @param {Array<string>} membershipData.ruoli - Array di ruoli
   * @param {string} membershipData.stato - Stato ('attivo' | 'disattivato')
   * @param {Date|Timestamp} membershipData.dataInizio - Data inizio membership
   * @param {string} membershipData.creatoDa - ID utente che ha creato la membership
   * @param {boolean} membershipData.tenantIdPredefinito - Se true, questo è il tenant predefinito
   */
  addTenantMembership(tenantId, membershipData) {
    if (!tenantId) {
      throw new Error('tenantId obbligatorio');
    }
    
    if (!this.tenantMemberships) {
      this.tenantMemberships = {};
    }
    
    this.tenantMemberships[tenantId] = {
      ruoli: membershipData.ruoli || [],
      stato: membershipData.stato || 'attivo',
      dataInizio: membershipData.dataInizio || new Date(),
      creatoDa: membershipData.creatoDa || null,
      tenantIdPredefinito: membershipData.tenantIdPredefinito || false
    };
    
    // Se è il primo tenant o è marcato come predefinito, aggiorna anche tenantId deprecato per retrocompatibilità
    if (membershipData.tenantIdPredefinito || Object.keys(this.tenantMemberships).length === 1) {
      this.tenantId = tenantId;
      this.ruoli = membershipData.ruoli || [];
    }
  }
  
  /**
   * Rimuovi membership da un tenant
   * @param {string} tenantId - ID tenant
   */
  removeTenantMembership(tenantId) {
    if (!tenantId || !this.tenantMemberships) {
      return;
    }
    
    delete this.tenantMemberships[tenantId];
    
    // Se era il tenant predefinito, aggiorna tenantId deprecato con un altro tenant
    if (this.tenantId === tenantId) {
      const remainingTenants = Object.keys(this.tenantMemberships);
      if (remainingTenants.length > 0) {
        this.tenantId = remainingTenants[0];
        const newMembership = this.tenantMemberships[this.tenantId];
        this.ruoli = newMembership ? (newMembership.ruoli || []) : [];
      } else {
        this.tenantId = null;
        this.ruoli = [];
      }
    }
  }
  
  /**
   * Ottieni lista di tutti i tenant a cui l'utente appartiene
   * @returns {Array<Object>} Array di oggetti { tenantId, ruoli, stato, ... }
   */
  getUserTenants() {
    if (!this.tenantMemberships || Object.keys(this.tenantMemberships).length === 0) {
      // Retrocompatibilità: se non ci sono tenantMemberships ma c'è tenantId, restituisci quello
      if (this.tenantId) {
        return [{
          tenantId: this.tenantId,
          ruoli: this.ruoli || [],
          stato: this.stato || 'attivo',
          tenantIdPredefinito: true
        }];
      }
      return [];
    }
    
    return Object.entries(this.tenantMemberships).map(([tenantId, membership]) => ({
      tenantId,
      ...membership
    }));
  }
  
  /**
   * Converte in formato Firestore
   * @returns {Object} Oggetto Firestore
   */
  toFirestore() {
    const data = super.toFirestore();
    
    // Assicurati che ruoli sia sempre un array (retrocompatibilità)
    if (!data.ruoli) {
      data.ruoli = [];
    }
    
    // Assicurati che tenantMemberships sia sempre un oggetto
    if (!data.tenantMemberships) {
      data.tenantMemberships = {};
    }
    
    return data;
  }
}

export default User;

