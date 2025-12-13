/**
 * Preventivi Service - Servizio per gestione preventivi (conto terzi)
 * Gestisce CRUD preventivi, calcolo automatico, invio email, accettazione
 * 
 * @module modules/conto-terzi/services/preventivi-service
 */

import { 
  createDocument, 
  getDocumentData, 
  updateDocument,
  deleteDocument,
  getCollectionData 
} from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { Preventivo } from '../models/Preventivo.js';
import { calcolaTariffaPreventivo } from './tariffe-service.js';
import { getCliente } from './clienti-service.js';

const COLLECTION_NAME = 'preventivi';

/**
 * Genera numero preventivo progressivo (es. PREV-2025-001)
 * @returns {Promise<string>} Numero preventivo
 */
async function generaNumeroPreventivo() {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const anno = new Date().getFullYear();
    const prefisso = `PREV-${anno}-`;
    
    // Ottieni tutti i preventivi dell'anno corrente
    const preventivi = await getCollectionData(COLLECTION_NAME, {
      tenantId,
      where: [['numero', '>=', prefisso], ['numero', '<', `${prefisso}Z`]]
    });
    
    // Estrai numeri progressivi
    const numeri = preventivi
      .map(p => {
        const match = p.numero?.match(new RegExp(`^${prefisso}(\\d+)$`));
        return match ? parseInt(match[1]) : 0;
      })
      .filter(n => n > 0);
    
    // Calcola prossimo numero
    const prossimoNumero = numeri.length > 0 ? Math.max(...numeri) + 1 : 1;
    
    return `${prefisso}${String(prossimoNumero).padStart(3, '0')}`;
  } catch (error) {
    console.error('Errore generazione numero preventivo:', error);
    // Fallback: usa timestamp
    const anno = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-6);
    return `PREV-${anno}-${timestamp}`;
  }
}

/**
 * Ottieni tutti i preventivi del tenant corrente
 * @param {Object} options - Opzioni di query
 * @param {string} options.orderBy - Campo per ordinamento (default: 'numero')
 * @param {string} options.orderDirection - Direzione ordinamento ('asc' | 'desc')
 * @param {string} options.stato - Filtra per stato (opzionale)
 * @param {string} options.clienteId - Filtra per cliente (opzionale)
 * @returns {Promise<Array<Preventivo>>} Array di preventivi
 */
export async function getAllPreventivi(options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const { 
      orderBy = 'numero', 
      orderDirection = 'desc',
      stato = null,
      clienteId = null
    } = options;
    
    // Costruisci filtri where
    const whereFilters = [];
    if (stato) {
      whereFilters.push(['stato', '==', stato]);
    }
    if (clienteId) {
      whereFilters.push(['clienteId', '==', clienteId]);
    }
    
    const documents = await getCollectionData(COLLECTION_NAME, {
      tenantId,
      orderBy,
      orderDirection,
      where: whereFilters.length > 0 ? whereFilters : undefined
    });
    
    return documents.map(doc => Preventivo.fromData(doc));
  } catch (error) {
    console.error('Errore recupero preventivi:', error);
    throw new Error(`Errore recupero preventivi: ${error.message}`);
  }
}

/**
 * Ottieni un preventivo per ID
 * @param {string} preventivoId - ID preventivo
 * @returns {Promise<Preventivo|null>} Preventivo o null se non trovato
 */
export async function getPreventivo(preventivoId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!preventivoId) {
      throw new Error('ID preventivo obbligatorio');
    }
    
    const data = await getDocumentData(COLLECTION_NAME, preventivoId, tenantId);
    
    if (!data) {
      return null;
    }
    
    return Preventivo.fromData(data);
  } catch (error) {
    console.error('Errore recupero preventivo:', error);
    throw new Error(`Errore recupero preventivo: ${error.message}`);
  }
}

/**
 * Ottieni preventivo per token accettazione (per link email)
 * @param {string} token - Token accettazione
 * @returns {Promise<Preventivo|null>} Preventivo o null se non trovato
 */
export async function getPreventivoByToken(token) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!token) {
      throw new Error('Token obbligatorio');
    }
    
    const preventivi = await getCollectionData(COLLECTION_NAME, {
      tenantId,
      where: [['tokenAccettazione', '==', token]]
    });
    
    if (preventivi.length === 0) {
      return null;
    }
    
    return Preventivo.fromData(preventivi[0]);
  } catch (error) {
    console.error('Errore recupero preventivo per token:', error);
    return null;
  }
}

/**
 * Calcola totale preventivo automaticamente usando tariffe
 * @param {Object} preventivoData - Dati preventivo
 * @returns {Promise<number>} Totale calcolato
 */
export async function calcolaTotalePreventivo(preventivoData) {
  try {
    const { tipoLavoro, coltura, tipoCampo, superficie } = preventivoData;
    
    if (!tipoLavoro || !coltura || !tipoCampo || !superficie || superficie <= 0) {
      return 0;
    }
    
    // Calcola usando tariffe
    const totale = await calcolaTariffaPreventivo(tipoLavoro, coltura, tipoCampo, superficie);
    
    // TODO: Aggiungere costi macchina e manodopera se specificati
    
    return totale;
  } catch (error) {
    console.error('Errore calcolo totale preventivo:', error);
    return 0;
  }
}

/**
 * Crea un nuovo preventivo
 * @param {Object} preventivoData - Dati preventivo
 * @param {boolean} calcolaAutomatico - Se true, calcola totale automaticamente (default: true)
 * @returns {Promise<string>} ID preventivo creato
 */
export async function createPreventivo(preventivoData, calcolaAutomatico = true) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    // Genera numero preventivo
    const numero = await generaNumeroPreventivo();
    
    // Calcola totale se richiesto
    let totale = preventivoData.totale || 0;
    if (calcolaAutomatico) {
      totale = await calcolaTotalePreventivo(preventivoData);
    }
    
    // Genera token accettazione
    const tokenAccettazione = Preventivo.generateToken();
    
    // Calcola data scadenza (default: +30 giorni)
    const giorniScadenza = preventivoData.giorniScadenza || 30;
    const dataScadenza = new Date();
    dataScadenza.setDate(dataScadenza.getDate() + giorniScadenza);
    
    const preventivo = new Preventivo({
      ...preventivoData,
      numero,
      totale,
      tokenAccettazione,
      dataScadenza,
      stato: preventivoData.stato || 'bozza'
    });
    
    // Valida
    const validation = preventivo.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Salva
    const preventivoId = await createDocument(COLLECTION_NAME, preventivo.toFirestore(), tenantId);
    
    return preventivoId;
  } catch (error) {
    console.error('Errore creazione preventivo:', error);
    throw new Error(`Errore creazione preventivo: ${error.message}`);
  }
}

/**
 * Aggiorna un preventivo esistente
 * @param {string} preventivoId - ID preventivo
 * @param {Object} updates - Dati da aggiornare
 * @param {boolean} ricalcolaTotale - Se true, ricalcola totale (default: false)
 * @returns {Promise<void>}
 */
export async function updatePreventivo(preventivoId, updates, ricalcolaTotale = false) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!preventivoId) {
      throw new Error('ID preventivo obbligatorio');
    }
    
    // Carica preventivo esistente
    const preventivoEsistente = await getPreventivo(preventivoId);
    if (!preventivoEsistente) {
      throw new Error('Preventivo non trovato');
    }
    
    // Verifica se preventivo può essere modificato (solo bozza)
    if (preventivoEsistente.stato !== 'bozza' && preventivoEsistente.stato !== 'annullato') {
      throw new Error('Preventivo non modificabile. Solo preventivi in stato "bozza" o "annullato" possono essere modificati.');
    }
    
    // Ricalcola totale se richiesto
    if (ricalcolaTotale) {
      const datiPerCalcolo = {
        ...preventivoEsistente,
        ...updates
      };
      updates.totale = await calcolaTotalePreventivo(datiPerCalcolo);
    }
    
    // Aggiorna con nuovi dati
    preventivoEsistente.update(updates);
    
    // Valida
    const validation = preventivoEsistente.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Salva
    await updateDocument(COLLECTION_NAME, preventivoId, preventivoEsistente.toFirestore(), tenantId);
  } catch (error) {
    console.error('Errore aggiornamento preventivo:', error);
    throw new Error(`Errore aggiornamento preventivo: ${error.message}`);
  }
}

/**
 * Invia preventivo via email (placeholder - da implementare)
 * @param {string} preventivoId - ID preventivo
 * @returns {Promise<void>}
 */
export async function inviaPreventivoEmail(preventivoId) {
  try {
    const preventivo = await getPreventivo(preventivoId);
    if (!preventivo) {
      throw new Error('Preventivo non trovato');
    }
    
    // Carica dati cliente
    const cliente = await getCliente(preventivo.clienteId);
    if (!cliente || !cliente.email) {
      throw new Error('Cliente non trovato o email non disponibile');
    }
    
    // TODO: Implementare invio email reale
    // Per ora aggiorna solo lo stato
    await updatePreventivo(preventivoId, {
      stato: 'inviato',
      dataInvio: new Date()
    });
    
    console.log(`📧 Preventivo ${preventivo.numero} inviato a ${cliente.email}`);
    // TODO: Inviare email con link accettazione/rifiuto
  } catch (error) {
    console.error('Errore invio preventivo:', error);
    throw new Error(`Errore invio preventivo: ${error.message}`);
  }
}

/**
 * Accetta preventivo (via email o manager)
 * @param {string} preventivoId - ID preventivo
 * @param {string} metodo - 'email' | 'manager'
 * @returns {Promise<void>}
 */
export async function accettaPreventivo(preventivoId, metodo = 'manager') {
  try {
    const preventivo = await getPreventivo(preventivoId);
    if (!preventivo) {
      throw new Error('Preventivo non trovato');
    }
    
    if (!preventivo.canBeAccepted()) {
      throw new Error('Preventivo non può essere accettato (stato o scaduto)');
    }
    
    const nuovoStato = metodo === 'email' ? 'accettato_email' : 'accettato_manager';
    
    await updatePreventivo(preventivoId, {
      stato: nuovoStato,
      dataAccettazione: new Date()
    });
    
    // TODO: Inviare notifica in-app al manager
  } catch (error) {
    console.error('Errore accettazione preventivo:', error);
    throw new Error(`Errore accettazione preventivo: ${error.message}`);
  }
}

/**
 * Rifiuta preventivo
 * @param {string} preventivoId - ID preventivo
 * @returns {Promise<void>}
 */
export async function rifiutaPreventivo(preventivoId) {
  try {
    const preventivo = await getPreventivo(preventivoId);
    if (!preventivo) {
      throw new Error('Preventivo non trovato');
    }
    
    if (!preventivo.canBeAccepted()) {
      throw new Error('Preventivo non può essere rifiutato (stato o scaduto)');
    }
    
    await updatePreventivo(preventivoId, {
      stato: 'rifiutato'
    });
    
    // TODO: Inviare notifica in-app al manager
  } catch (error) {
    console.error('Errore rifiuto preventivo:', error);
    throw new Error(`Errore rifiuto preventivo: ${error.message}`);
  }
}

/**
 * Annulla preventivo
 * @param {string} preventivoId - ID preventivo
 * @returns {Promise<void>}
 */
export async function annullaPreventivo(preventivoId) {
  try {
    await updatePreventivo(preventivoId, {
      stato: 'annullato'
    });
  } catch (error) {
    console.error('Errore annullamento preventivo:', error);
    throw new Error(`Errore annullamento preventivo: ${error.message}`);
  }
}

/**
 * Elimina un preventivo
 * @param {string} preventivoId - ID preventivo
 * @returns {Promise<void>}
 */
export async function deletePreventivo(preventivoId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!preventivoId) {
      throw new Error('ID preventivo obbligatorio');
    }
    
    // Verifica se preventivo ha lavoro associato
    const preventivo = await getPreventivo(preventivoId);
    if (preventivo && preventivo.lavoroId) {
      throw new Error('Impossibile eliminare: preventivo ha un lavoro associato');
    }
    
    await deleteDocument(COLLECTION_NAME, preventivoId, tenantId);
  } catch (error) {
    console.error('Errore eliminazione preventivo:', error);
    throw new Error(`Errore eliminazione preventivo: ${error.message}`);
  }
}

/**
 * Verifica preventivi scaduti e aggiorna stato
 * @returns {Promise<number>} Numero preventivi aggiornati
 */
export async function verificaPreventiviScaduti() {
  try {
    const preventivi = await getAllPreventivi({ stato: 'inviato' });
    let aggiornati = 0;
    
    for (const preventivo of preventivi) {
      if (preventivo.isScaduto()) {
        await updatePreventivo(preventivo.id, { stato: 'scaduto' });
        aggiornati++;
      }
    }
    
    return aggiornati;
  } catch (error) {
    console.error('Errore verifica preventivi scaduti:', error);
    return 0;
  }
}

// Export default
export default {
  getAllPreventivi,
  getPreventivo,
  getPreventivoByToken,
  calcolaTotalePreventivo,
  createPreventivo,
  updatePreventivo,
  inviaPreventivoEmail,
  accettaPreventivo,
  rifiutaPreventivo,
  annullaPreventivo,
  deletePreventivo,
  verificaPreventiviScaduti
};




