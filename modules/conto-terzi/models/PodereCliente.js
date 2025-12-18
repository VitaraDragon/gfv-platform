/**
 * PodereCliente Model - Modello dati podere cliente
 * Gestisce poderi associati ai clienti per lavori conto terzi
 * 
 * @module modules/conto-terzi/models/PodereCliente
 */

import { Base } from '../../../core/models/Base.js';

export class PodereCliente extends Base {
  /**
   * Costruttore PodereCliente
   * @param {Object} data - Dati podere
   * @param {string} data.id - ID documento
   * @param {string} data.clienteId - ID cliente proprietario (obbligatorio)
   * @param {string} data.nome - Nome podere (obbligatorio)
   * @param {string} data.indirizzo - Indirizzo completo (opzionale)
   * @param {string} data.localita - Località/Comune (opzionale)
   * @param {string} data.cap - CAP (opzionale)
   * @param {Object} data.coordinate - Coordinate GPS {lat, lng} (opzionale)
   * @param {string} data.note - Note aggiuntive (opzionale)
   * @param {Date|Timestamp} data.createdAt - Data creazione
   * @param {Date|Timestamp} data.updatedAt - Data ultimo aggiornamento
   */
  constructor(data = {}) {
    super(data);
    
    this.clienteId = data.clienteId || null;
    this.nome = data.nome || '';
    this.indirizzo = data.indirizzo || null;
    this.localita = data.localita || null;
    this.cap = data.cap || null;
    this.coordinate = data.coordinate || null; // {lat: number, lng: number}
    this.note = data.note || null;
  }

  /**
   * Valida dati podere
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validate() {
    const errors = [];
    
    if (!this.clienteId || this.clienteId.trim().length === 0) {
      errors.push('Cliente obbligatorio');
    }
    
    if (!this.nome || this.nome.trim().length === 0) {
      errors.push('Nome podere obbligatorio');
    }
    
    if (this.coordinate) {
      if (typeof this.coordinate.lat !== 'number' || typeof this.coordinate.lng !== 'number') {
        errors.push('Coordinate non valide');
      }
      if (this.coordinate.lat < -90 || this.coordinate.lat > 90) {
        errors.push('Latitudine non valida');
      }
      if (this.coordinate.lng < -180 || this.coordinate.lng > 180) {
        errors.push('Longitudine non valida');
      }
    }
    
    return { valid: errors.length === 0, errors };
  }

  /**
   * Verifica se il podere ha coordinate
   * @returns {boolean}
   */
  hasCoordinate() {
    return this.coordinate && 
           typeof this.coordinate.lat === 'number' && 
           typeof this.coordinate.lng === 'number';
  }

  /**
   * Ottieni indirizzo completo formattato
   * @returns {string}
   */
  getIndirizzoCompleto() {
    const parts = [];
    if (this.indirizzo) parts.push(this.indirizzo);
    if (this.localita) parts.push(this.localita);
    if (this.cap) parts.push(this.cap);
    return parts.join(', ') || 'Nessun indirizzo';
  }

  /**
   * Crea istanza da dati Firestore
   * @param {Object} data - Dati Firestore
   * @returns {PodereCliente}
   */
  static fromData(data) {
    return new PodereCliente(data);
  }
}

export default PodereCliente;








