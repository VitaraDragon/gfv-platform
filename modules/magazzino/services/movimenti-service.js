/**
 * Movimenti Service - Servizio per gestione movimenti di magazzino (entrate/uscite)
 * CRUD movimenti e aggiornamento giacenza prodotto. Scarico oltre giacenza permesso (alert in UI).
 *
 * @module modules/magazzino/services/movimenti-service
 */

import {
  createDocument,
  getDocumentData,
  getCollectionData,
  updateDocument,
  deleteDocument
} from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { MovimentoMagazzino } from '../models/MovimentoMagazzino.js';
import { getProdotto, aggiornaGiacenzaProdotto, getAllProdotti } from './prodotti-service.js';

const COLLECTION_NAME = 'movimentiMagazzino';

/**
 * Ottieni tutti i movimenti del tenant
 * @param {Object} options - Opzioni di query
 * @param {string} options.orderBy - Campo per ordinamento (default: 'data')
 * @param {string} options.orderDirection - Direzione ordinamento ('asc' | 'desc', default: 'desc')
 * @param {string} options.prodottoId - Filtra per prodotto (opzionale)
 * @param {string} options.tipo - Filtra per tipo 'entrata' | 'uscita' (opzionale)
 * @param {number} options.limit - Limite risultati (opzionale)
 * @returns {Promise<Array<MovimentoMagazzino>>} Array di movimenti
 */
export async function getAllMovimenti(options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }

    const {
      orderBy = 'data',
      orderDirection = 'desc',
      prodottoId = null,
      tipo = null,
      limit: limitCount = null
    } = options;

    const whereFilters = [];
    if (prodottoId) {
      whereFilters.push(['prodottoId', '==', prodottoId]);
    }
    if (tipo) {
      whereFilters.push(['tipo', '==', tipo]);
    }

    const documents = await getCollectionData(COLLECTION_NAME, {
      tenantId,
      orderBy,
      orderDirection,
      where: whereFilters.length > 0 ? whereFilters : undefined,
      limit: limitCount || undefined
    });

    return documents.map((doc) => MovimentoMagazzino.fromData(doc));
  } catch (error) {
    console.error('Errore recupero movimenti:', error);
    throw new Error(`Errore recupero movimenti: ${error.message}`);
  }
}

/**
 * Ottieni un movimento per ID
 * @param {string} movimentoId - ID movimento
 * @returns {Promise<MovimentoMagazzino|null>} Movimento o null
 */
export async function getMovimento(movimentoId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    if (!movimentoId) {
      throw new Error('ID movimento obbligatorio');
    }

    const data = await getDocumentData(COLLECTION_NAME, movimentoId, tenantId);
    if (!data) return null;

    return MovimentoMagazzino.fromData(data);
  } catch (error) {
    console.error('Errore recupero movimento:', error);
    throw new Error(`Errore recupero movimento: ${error.message}`);
  }
}

/**
 * Crea un nuovo movimento e aggiorna la giacenza del prodotto
 * Scarico oltre giacenza è permesso (la giacenza può diventare negativa; alert in UI).
 * @param {Object} movimentoData - Dati movimento (prodottoId, data, tipo, quantita, prezzoUnitario?, lavoroId?, attivitaId?, note?, userId?)
 * @returns {Promise<string>} ID movimento creato
 */
export async function createMovimento(movimentoData) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }

    const movimento = new MovimentoMagazzino(movimentoData);
    const validation = movimento.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }

    const movimentoId = await createDocument(COLLECTION_NAME, movimento.toFirestore(), tenantId);

    // Aggiorna giacenza prodotto: entrata +quantita, uscita -quantita (permesso negativo)
    const delta = movimento.tipo === 'entrata' ? movimento.quantita : -movimento.quantita;
    await aggiornaGiacenzaProdotto(movimento.prodottoId, delta);

    return movimentoId;
  } catch (error) {
    console.error('Errore creazione movimento:', error);
    throw new Error(`Errore creazione movimento: ${error.message}`);
  }
}

/**
 * Elimina un movimento e ripristina la giacenza del prodotto
 * @param {string} movimentoId - ID movimento
 * @returns {Promise<void>}
 */
export async function deleteMovimento(movimentoId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    if (!movimentoId) {
      throw new Error('ID movimento obbligatorio');
    }

    const movimento = await getMovimento(movimentoId);
    if (!movimento) {
      throw new Error('Movimento non trovato');
    }

    // Ripristina giacenza: inverti il delta (entrata -quantita, uscita +quantita)
    const delta = movimento.tipo === 'entrata' ? -movimento.quantita : movimento.quantita;
    await aggiornaGiacenzaProdotto(movimento.prodottoId, delta);

    await deleteDocument(COLLECTION_NAME, movimentoId, tenantId);
  } catch (error) {
    console.error('Errore eliminazione movimento:', error);
    throw new Error(`Errore eliminazione movimento: ${error.message}`);
  }
}

/**
 * Prodotti sotto scorta minima (per alert in home e dashboard Manager)
 * @returns {Promise<Array<Prodotto>>} Array di prodotti sotto scorta minima (solo attivi)
 */
export async function getProdottiSottoScortaMinima() {
  try {
    const prodotti = await getAllProdotti({ soloAttivi: true });
    return prodotti.filter((p) => p.isSottoScortaMinima());
  } catch (error) {
    console.error('Errore recupero prodotti sotto scorta:', error);
    throw new Error(`Errore recupero prodotti sotto scorta: ${error.message}`);
  }
}
