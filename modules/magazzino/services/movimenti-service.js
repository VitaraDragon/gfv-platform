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
  deleteDocument,
  setDocument
} from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { MovimentoMagazzino } from '../models/MovimentoMagazzino.js';
import { getProdotto, aggiornaGiacenzaProdotto, getAllProdotti } from './prodotti-service.js';
import { movimentoGiacenzaDelta } from './giacenza-utils.js';

const COLLECTION_NAME = 'movimentiMagazzino';

/** `error.code` di deleteMovimento quando il documento non esiste più (già eliminato). */
export const MOVIMENTO_NON_TROVATO = 'MOVIMENTO_NON_TROVATO';

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

    // Giacenza atomica: entrata +quantita, uscita -quantita (permesso negativo)
    await aggiornaGiacenzaProdotto(
      movimento.prodottoId,
      movimentoGiacenzaDelta(movimento.tipo, movimento.quantita)
    );

    return movimentoId;
  } catch (error) {
    console.error('Errore creazione movimento:', error);
    throw new Error(`Errore creazione movimento: ${error.message}`);
  }
}

/**
 * Aggiorna un movimento esistente senza modificare la giacenza.
 * Consentito solo per campi che non alterano quantità, tipo o prodotto.
 * @param {string} movimentoId - ID movimento
 * @param {Object} updates - Campi da aggiornare (prezzoUnitario, prezzoInAttesa, note, documentoFatturaId, …)
 * @returns {Promise<void>}
 */
export async function updateMovimento(movimentoId, updates = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    if (!movimentoId) {
      throw new Error('ID movimento obbligatorio');
    }

    const existing = await getMovimento(movimentoId);
    if (!existing) {
      throw new Error('Movimento non trovato');
    }

    if (updates.quantita != null && updates.quantita !== existing.quantita) {
      throw new Error('Aggiornamento quantità non supportato da updateMovimento');
    }
    if (updates.tipo != null && updates.tipo !== existing.tipo) {
      throw new Error('Aggiornamento tipo non supportato da updateMovimento');
    }
    if (updates.prodottoId != null && updates.prodottoId !== existing.prodottoId) {
      throw new Error('Aggiornamento prodotto non supportato da updateMovimento');
    }

    const merged = Object.assign({}, existing, updates, { id: existing.id });
    const movimento = new MovimentoMagazzino(merged);
    const validation = movimento.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }

    await updateDocument(COLLECTION_NAME, movimentoId, movimento.toFirestore(), tenantId);
  } catch (error) {
    console.error('Errore aggiornamento movimento:', error);
    throw new Error(`Errore aggiornamento movimento: ${error.message}`);
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
      const nonTrovato = new Error('Movimento non trovato');
      nonTrovato.code = MOVIMENTO_NON_TROVATO;
      throw nonTrovato;
    }

    // Ripristina giacenza: inverti il delta atomico (entrata -quantita, uscita +quantita)
    await aggiornaGiacenzaProdotto(
      movimento.prodottoId,
      -movimentoGiacenzaDelta(movimento.tipo, movimento.quantita)
    );

    await deleteDocument(COLLECTION_NAME, movimentoId, tenantId);
  } catch (error) {
    if (!error || error.code !== MOVIMENTO_NON_TROVATO) {
      console.error('Errore eliminazione movimento:', error);
    }
    const wrapped = new Error(`Errore eliminazione movimento: ${error.message}`);
    if (error && error.code === MOVIMENTO_NON_TROVATO) wrapped.code = MOVIMENTO_NON_TROVATO;
    throw wrapped;
  }
}

/**
 * Crea o riscrive un movimento con ID deterministico (setDoc) e allinea la giacenza.
 * Giacenza: delta = effetto del nuovo movimento − effetto di quello già presente con lo stesso ID
 * (stesso ID + stessa quantità = nessuna variazione, quindi salvataggi ripetuti non scaricano due volte).
 * @param {string} movimentoId - ID deterministico
 * @param {Object} movimentoData - Stessi campi di createMovimento
 * @returns {Promise<{ movimentoId: string, created: boolean, delta: number }>}
 */
export async function setMovimentoConId(movimentoId, movimentoData) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    if (!movimentoId) {
      throw new Error('ID movimento obbligatorio');
    }

    const movimento = new MovimentoMagazzino(movimentoData);
    const validation = movimento.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }

    const existing = await getMovimento(movimentoId);
    const nuovoEffetto = movimentoGiacenzaDelta(movimento.tipo, movimento.quantita);
    let delta = nuovoEffetto;
    /** @type {{ prodottoId: string, delta: number }|null} */
    let ripristinoVecchioProdotto = null;
    if (existing) {
      const vecchioEffetto = movimentoGiacenzaDelta(existing.tipo, existing.quantita);
      if (existing.prodottoId === movimento.prodottoId) {
        delta = nuovoEffetto - vecchioEffetto;
      } else {
        ripristinoVecchioProdotto = { prodottoId: existing.prodottoId, delta: -vecchioEffetto };
      }
    }

    // createdAt/updatedAt li gestisce setDocument: un null qui sovrascriverebbe createdAt esistente.
    const payload = movimento.toFirestore();
    delete payload.createdAt;
    delete payload.updatedAt;
    await setDocument(COLLECTION_NAME, movimentoId, payload, tenantId);

    if (ripristinoVecchioProdotto) {
      await aggiornaGiacenzaProdotto(ripristinoVecchioProdotto.prodottoId, ripristinoVecchioProdotto.delta);
    }
    if (delta !== 0) {
      await aggiornaGiacenzaProdotto(movimento.prodottoId, delta);
    }

    return { movimentoId, created: !existing, delta };
  } catch (error) {
    console.error('Errore scrittura movimento con ID:', error);
    throw new Error(`Errore scrittura movimento: ${error.message}`);
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
