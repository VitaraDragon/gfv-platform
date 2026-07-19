/**
 * Prodotti Service - Servizio per gestione anagrafica prodotti (Prodotti e Magazzino)
 * CRUD prodotti con supporto multi-tenant. Di norma si disattivano; eliminazione solo se senza movimenti.
 *
 * @module modules/magazzino/services/prodotti-service
 */

import {
  createDocument,
  getDocumentData,
  updateDocument,
  getCollectionData,
  deleteDocument
} from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { Prodotto } from '../models/Prodotto.js';

const COLLECTION_NAME = 'prodotti';
const MOVIMENTI_COLLECTION = 'movimentiMagazzino';

/**
 * Ottieni tutti i prodotti del tenant corrente
 * @param {Object} options - Opzioni di query
 * @param {string} options.orderBy - Campo per ordinamento (default: 'nome')
 * @param {string} options.orderDirection - Direzione ordinamento ('asc' | 'desc')
 * @param {boolean} options.soloAttivi - Se true filtra solo prodotti attivi (default: false = tutti)
 * @param {string} options.categoria - Filtra per categoria (opzionale)
 * @returns {Promise<Array<Prodotto>>} Array di prodotti
 */
export async function getAllProdotti(options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }

    const {
      orderBy = 'nome',
      orderDirection = 'asc',
      soloAttivi = false,
      categoria = null
    } = options;

    const whereFilters = [];
    if (soloAttivi) {
      whereFilters.push(['attivo', '==', true]);
    }
    if (categoria) {
      whereFilters.push(['categoria', '==', categoria]);
    }

    // Con where + orderBy su campi diversi Firestore richiede un indice composito.
    // Se ci sono filtri, recuperiamo senza orderBy e ordiniamo in memoria.
    const useOrderInMemory = whereFilters.length > 0;
    const documents = await getCollectionData(COLLECTION_NAME, {
      tenantId,
      orderBy: useOrderInMemory ? undefined : orderBy,
      orderDirection,
      where: whereFilters.length > 0 ? whereFilters : undefined
    });

    let result = documents.map((doc) => Prodotto.fromData(doc));
    if (useOrderInMemory && result.length > 0 && orderBy) {
      const key = orderBy === 'nome' ? 'nome' : orderBy;
      result = result.slice().sort((a, b) => {
        const va = a[key] != null ? String(a[key]).toLowerCase() : '';
        const vb = b[key] != null ? String(b[key]).toLowerCase() : '';
        const cmp = va.localeCompare(vb);
        return orderDirection === 'desc' ? -cmp : cmp;
      });
    }
    return result;
  } catch (error) {
    console.error('Errore recupero prodotti:', error);
    throw new Error(`Errore recupero prodotti: ${error.message}`);
  }
}

/**
 * Ottieni un prodotto per ID
 * @param {string} prodottoId - ID prodotto
 * @returns {Promise<Prodotto|null>} Prodotto o null se non trovato
 */
export async function getProdotto(prodottoId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    if (!prodottoId) {
      throw new Error('ID prodotto obbligatorio');
    }

    const data = await getDocumentData(COLLECTION_NAME, prodottoId, tenantId);
    if (!data) return null;

    return Prodotto.fromData(data);
  } catch (error) {
    console.error('Errore recupero prodotto:', error);
    throw new Error(`Errore recupero prodotto: ${error.message}`);
  }
}

/**
 * Crea un nuovo prodotto
 * @param {Object} prodottoData - Dati prodotto
 * @returns {Promise<string>} ID prodotto creato
 */
export async function createProdotto(prodottoData) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }

    const prodotto = new Prodotto({ ...prodottoData, giacenza: 0 });
    const validation = prodotto.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }

    const prodottoId = await createDocument(COLLECTION_NAME, prodotto.toFirestore(), tenantId);
    return prodottoId;
  } catch (error) {
    console.error('Errore creazione prodotto:', error);
    throw new Error(`Errore creazione prodotto: ${error.message}`);
  }
}

/**
 * Aggiorna un prodotto esistente (campi anagrafici; non modifica giacenza)
 * @param {string} prodottoId - ID prodotto
 * @param {Object} updates - Dati da aggiornare (codice, nome, categoria, unitaMisura, scortaMinima, prezzoUnitario/media, prezzoMedioAnno, prezzoMedioN, dosaggioMin, dosaggioMax, giorniCarenza, note, attivo)
 * @returns {Promise<void>}
 */
export async function updateProdotto(prodottoId, updates) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    if (!prodottoId) {
      throw new Error('ID prodotto obbligatorio');
    }

    const prodottoEsistente = await getProdotto(prodottoId);
    if (!prodottoEsistente) {
      throw new Error('Prodotto non trovato');
    }

    // Non permettere di modificare giacenza da qui (viene aggiornata dai movimenti)
    const { giacenza, ...safeUpdates } = updates;
    prodottoEsistente.update(safeUpdates);

    const validation = prodottoEsistente.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }

    await updateDocument(COLLECTION_NAME, prodottoId, prodottoEsistente.toFirestore(), tenantId);
  } catch (error) {
    console.error('Errore aggiornamento prodotto:', error);
    throw new Error(`Errore aggiornamento prodotto: ${error.message}`);
  }
}

/**
 * Aggiorna solo il prezzo medio (Tony Occhi / fattura) senza ri-validare dosaggi anagrafica.
 * @param {string} prodottoId
 * @param {{ prezzoUnitario: number, prezzoMedioAnno?: number, prezzoMedioN?: number, prezzoMedioAggiornatoAt?: string }} data
 * @returns {Promise<void>}
 */
export async function updateProdottoPrezzoMedio(prodottoId, data) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    if (!prodottoId) {
      throw new Error('ID prodotto obbligatorio');
    }
    const prezzo = Number(data && data.prezzoUnitario);
    if (!Number.isFinite(prezzo) || prezzo < 0) {
      throw new Error('Prezzo medio non valido');
    }
    const patch = {
      prezzoUnitario: prezzo,
      prezzoMedioAnno: data.prezzoMedioAnno != null ? Number(data.prezzoMedioAnno) : null,
      prezzoMedioN: data.prezzoMedioN != null ? Number(data.prezzoMedioN) : null,
      prezzoMedioAggiornatoAt: data.prezzoMedioAggiornatoAt || new Date().toISOString(),
    };
    await updateDocument(COLLECTION_NAME, prodottoId, patch, tenantId);
  } catch (error) {
    console.error('Errore aggiornamento prezzo medio prodotto:', error);
    throw new Error(`Errore aggiornamento prezzo medio: ${error.message}`);
  }
}

/**
 * Disattiva un prodotto (non elimina; mantiene storico movimenti)
 * @param {string} prodottoId - ID prodotto
 * @returns {Promise<void>}
 */
export async function disattivaProdotto(prodottoId) {
  try {
    await updateProdotto(prodottoId, { attivo: false });
  } catch (error) {
    console.error('Errore disattivazione prodotto:', error);
    throw new Error(`Errore disattivazione prodotto: ${error.message}`);
  }
}

/**
 * Riattiva un prodotto disattivato
 * @param {string} prodottoId - ID prodotto
 * @returns {Promise<void>}
 */
export async function riattivaProdotto(prodottoId) {
  try {
    await updateProdotto(prodottoId, { attivo: true });
  } catch (error) {
    console.error('Errore riattivazione prodotto:', error);
    throw new Error(`Errore riattivazione prodotto: ${error.message}`);
  }
}

/**
 * Conta i movimenti collegati a un prodotto.
 * @param {string} prodottoId
 * @returns {Promise<number>}
 */
export async function countMovimentiForProdotto(prodottoId) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
  if (!prodottoId) throw new Error('ID prodotto obbligatorio');
  const all = await getCollectionData(MOVIMENTI_COLLECTION, {
    tenantId,
    where: [['prodottoId', '==', prodottoId]]
  });
  return (all || []).length;
}

/**
 * Elimina un prodotto solo se non ha movimenti collegati.
 * @param {string} prodottoId
 * @returns {Promise<void>}
 */
export async function deleteProdotto(prodottoId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
    if (!prodottoId) throw new Error('ID prodotto obbligatorio');

    const esistente = await getProdotto(prodottoId);
    if (!esistente) throw new Error('Prodotto non trovato');

    const n = await countMovimentiForProdotto(prodottoId);
    if (n > 0) {
      throw new Error(
        'Impossibile eliminare: ci sono ' + n + ' moviment' + (n === 1 ? 'o' : 'i') +
        ' collegati. Elimina prima i movimenti oppure usa Disattiva.'
      );
    }

    await deleteDocument(COLLECTION_NAME, prodottoId, tenantId);
  } catch (error) {
    console.error('Errore eliminazione prodotto:', error);
    throw new Error(error.message || 'Errore eliminazione prodotto');
  }
}

/**
 * Aggiorna la giacenza di un prodotto (usato internamente da movimenti-service)
 * @param {string} prodottoId - ID prodotto
 * @param {number} delta - Variazione (+ per entrata, - per uscita)
 * @returns {Promise<void>}
 */
export async function aggiornaGiacenzaProdotto(prodottoId, delta) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    if (!prodottoId) {
      throw new Error('ID prodotto obbligatorio');
    }

    const prodotto = await getProdotto(prodottoId);
    if (!prodotto) {
      throw new Error('Prodotto non trovato');
    }

    const nuovaGiacenza = (prodotto.giacenza || 0) + delta;
    await updateDocument(COLLECTION_NAME, prodottoId, { giacenza: nuovaGiacenza }, tenantId);
  } catch (error) {
    console.error('Errore aggiornamento giacenza:', error);
    throw new Error(`Errore aggiornamento giacenza: ${error.message}`);
  }
}
