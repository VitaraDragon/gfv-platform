/**
 * Categorie Lavori Service - Servizio per gestione categorie lavori
 * Gestisce CRUD categorie con supporto multi-tenant
 * 
 * @module core/services/categorie-lavori-service
 */

import { 
  createDocument, 
  getDocumentData, 
  updateDocument,
  deleteDocument,
  getCollectionData 
} from './firebase-service.js';
import { getCurrentTenantId } from './tenant-service.js';
import { CategoriaLavoro } from '../models/CategoriaLavoro.js';

const COLLECTION_NAME = 'categorieLavori';

// Categorie predefinite
const CATEGORIE_PREDEFINITE = [
  {
    nome: 'Lavorazione del Terreno',
    codice: 'lavorazione_terreno',
    descrizione: 'Aratura, erpicatura, fresatura, vangatura, ecc.',
    predefinita: true
  },
  {
    nome: 'Trattamenti',
    codice: 'trattamenti',
    descrizione: 'Fitofarmaci, concimazione, irrigazione, ecc.',
    predefinita: true
  },
  {
    nome: 'Potatura',
    codice: 'potatura',
    descrizione: 'Potatura manuale, potatura meccanica, cimatura, ecc.',
    predefinita: true
  },
  {
    nome: 'Raccolta',
    codice: 'raccolta',
    descrizione: 'Raccolta frutta, raccolta verdura, vendemmia, ecc.',
    predefinita: true
  },
  {
    nome: 'Gestione del Verde',
    codice: 'gestione_verde',
    descrizione: 'Falciatura, diserbo, taglio erba, ecc.',
    predefinita: true
  },
  {
    nome: 'Semina e Piantagione',
    codice: 'semina_piantagione',
    descrizione: 'Semina, trapianto, piantagione, ecc.',
    predefinita: true
  },
  {
    nome: 'Manutenzione',
    codice: 'manutenzione',
    descrizione: 'Riparazioni, manutenzione impianti, ecc.',
    predefinita: true
  },
  {
    nome: 'Altro',
    codice: 'altro',
    descrizione: 'Altri tipi di lavoro non categorizzabili',
    predefinita: true
  }
];

/**
 * Inizializza categorie predefinite per il tenant corrente
 * @returns {Promise<void>}
 */
export async function initializeCategoriePredefinite() {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const categorieEsistenti = await getAllCategorie();
    const codiciEsistenti = new Set(categorieEsistenti.map(c => c.codice));
    
    for (const categoriaPredefinita of CATEGORIE_PREDEFINITE) {
      // Crea solo se non esiste già
      if (!codiciEsistenti.has(categoriaPredefinita.codice)) {
        const categoria = new CategoriaLavoro({
          ...categoriaPredefinita,
          creatoDa: 'system'
        });
        
        const validation = categoria.validate();
        if (validation.valid) {
          await createDocument(COLLECTION_NAME, categoria.toFirestore(), tenantId);
        }
      }
    }
  } catch (error) {
    console.error('Errore inizializzazione categorie predefinite:', error);
    throw new Error(`Errore inizializzazione categorie: ${error.message}`);
  }
}

/**
 * Ottieni tutte le categorie del tenant corrente
 * @param {Object} options - Opzioni di query
 * @param {string} options.orderBy - Campo per ordinamento (default: 'nome')
 * @param {string} options.orderDirection - Direzione ordinamento ('asc' | 'desc')
 * @param {boolean} options.soloPredefinite - Se true, mostra solo categorie predefinite
 * @returns {Promise<Array<CategoriaLavoro>>} Array di categorie
 */
export async function getAllCategorie(options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const { 
      orderBy = 'nome', 
      orderDirection = 'asc',
      soloPredefinite = false
    } = options;
    
    const whereConditions = [];
    
    if (soloPredefinite) {
      whereConditions.push(['predefinita', '==', true]);
    }
    
    const documents = await getCollectionData(COLLECTION_NAME, {
      tenantId,
      orderBy,
      orderDirection,
      where: whereConditions.length > 0 ? whereConditions : undefined
    });
    
    return documents.map(doc => CategoriaLavoro.fromData(doc));
  } catch (error) {
    console.error('Errore recupero categorie:', error);
    throw new Error(`Errore recupero categorie: ${error.message}`);
  }
}

/**
 * Ottieni una categoria per ID
 * @param {string} categoriaId - ID categoria
 * @returns {Promise<CategoriaLavoro|null>} Categoria o null se non trovata
 */
export async function getCategoria(categoriaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!categoriaId) {
      throw new Error('ID categoria obbligatorio');
    }
    
    const data = await getDocumentData(COLLECTION_NAME, categoriaId, tenantId);
    
    if (!data) {
      return null;
    }
    
    return CategoriaLavoro.fromData(data);
  } catch (error) {
    console.error('Errore recupero categoria:', error);
    throw new Error(`Errore recupero categoria: ${error.message}`);
  }
}

/**
 * Ottieni una categoria per codice
 * @param {string} codice - Codice categoria
 * @returns {Promise<CategoriaLavoro|null>} Categoria o null se non trovata
 */
export async function getCategoriaByCodice(codice) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!codice) {
      throw new Error('Codice categoria obbligatorio');
    }
    
    const { getCollectionData } = await import('./firebase-service.js');
    
    const documents = await getCollectionData(COLLECTION_NAME, {
      tenantId,
      where: [['codice', '==', codice.toLowerCase()]]
    });
    
    if (documents.length === 0) {
      return null;
    }
    
    return CategoriaLavoro.fromData(documents[0]);
  } catch (error) {
    console.error('Errore recupero categoria per codice:', error);
    throw new Error(`Errore recupero categoria: ${error.message}`);
  }
}

/**
 * Crea una nuova categoria
 * @param {Object} categoriaData - Dati categoria
 * @param {string} categoriaData.nome - Nome categoria (obbligatorio)
 * @param {string} categoriaData.codice - Codice categoria (opzionale, generato automaticamente se non fornito)
 * @param {string} categoriaData.descrizione - Descrizione (opzionale)
 * @param {string} createdBy - ID utente che crea la categoria
 * @returns {Promise<string>} ID categoria creata
 */
export async function createCategoria(categoriaData, createdBy) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const categoria = new CategoriaLavoro({
      ...categoriaData,
      creatoDa: createdBy
    });
    
    // Genera codice se non fornito
    if (!categoria.codice) {
      categoria.codice = categoria.generateCodice();
    } else {
      categoria.codice = categoria.codice.toLowerCase();
    }
    
    // Verifica che il codice non esista già
    const categoriaEsistente = await getCategoriaByCodice(categoria.codice);
    if (categoriaEsistente) {
      throw new Error(`Una categoria con codice "${categoria.codice}" esiste già`);
    }
    
    // Valida
    const validation = categoria.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Salva
    const categoriaId = await createDocument(COLLECTION_NAME, categoria.toFirestore(), tenantId);
    
    return categoriaId;
  } catch (error) {
    console.error('Errore creazione categoria:', error);
    throw new Error(`Errore creazione categoria: ${error.message}`);
  }
}

/**
 * Aggiorna una categoria esistente
 * @param {string} categoriaId - ID categoria
 * @param {Object} updates - Dati da aggiornare
 * @returns {Promise<void>}
 */
export async function updateCategoria(categoriaId, updates) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!categoriaId) {
      throw new Error('ID categoria obbligatorio');
    }
    
    // Carica categoria esistente
    const categoriaEsistente = await getCategoria(categoriaId);
    if (!categoriaEsistente) {
      throw new Error('Categoria non trovata');
    }
    
    // Non permettere modifica di categorie predefinite
    if (categoriaEsistente.predefinita && (updates.nome || updates.codice || updates.predefinita === false)) {
      throw new Error('Non è possibile modificare categorie predefinite del sistema');
    }
    
    // Aggiorna con nuovi dati
    categoriaEsistente.update(updates);
    
    // Se codice modificato, verifica unicità
    if (updates.codice && updates.codice !== categoriaEsistente.codice) {
      const categoriaConCodice = await getCategoriaByCodice(updates.codice.toLowerCase());
      if (categoriaConCodice && categoriaConCodice.id !== categoriaId) {
        throw new Error(`Una categoria con codice "${updates.codice}" esiste già`);
      }
      categoriaEsistente.codice = updates.codice.toLowerCase();
    }
    
    // Valida
    const validation = categoriaEsistente.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Salva
    await updateDocument(COLLECTION_NAME, categoriaId, categoriaEsistente.toFirestore(), tenantId);
  } catch (error) {
    console.error('Errore aggiornamento categoria:', error);
    throw new Error(`Errore aggiornamento categoria: ${error.message}`);
  }
}

/**
 * Elimina una categoria
 * @param {string} categoriaId - ID categoria
 * @param {Object} options - Opzioni eliminazione
 * @param {boolean} options.force - Se true, elimina anche se usata da tipi lavoro (default: false)
 * @returns {Promise<void>}
 * @throws {Error} Se categoria è usata da tipi lavoro e force=false
 */
export async function deleteCategoria(categoriaId, options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!categoriaId) {
      throw new Error('ID categoria obbligatorio');
    }
    
    // Carica categoria
    const categoria = await getCategoria(categoriaId);
    if (!categoria) {
      throw new Error('Categoria non trovata');
    }
    
    // Non permettere eliminazione di categorie predefinite
    if (categoria.predefinita) {
      throw new Error('Non è possibile eliminare categorie predefinite del sistema');
    }
    
    // Verifica se categoria è usata da tipi lavoro
    const numTipiLavoro = await getNumeroTipiLavoroCategoria(categoriaId);
    
    if (numTipiLavoro > 0 && !options.force) {
      throw new Error(
        `Impossibile eliminare: la categoria è utilizzata da ${numTipiLavoro} tipo/i lavoro. ` +
        `Elimina prima i tipi lavoro o usa l'opzione force=true per eliminare comunque.`
      );
    }
    
    await deleteDocument(COLLECTION_NAME, categoriaId, tenantId);
  } catch (error) {
    console.error('Errore eliminazione categoria:', error);
    throw error; // Rilancia l'errore così la UI può gestirlo
  }
}

/**
 * Verifica se una categoria è usata da tipi lavoro
 * @param {string} categoriaId - ID categoria
 * @returns {Promise<number>} Numero di tipi lavoro che usano questa categoria
 */
export async function getNumeroTipiLavoroCategoria(categoriaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    // Import dinamico per evitare dipendenze circolari
    const { getCollectionData } = await import('./firebase-service.js');
    
    const tipiLavoro = await getCollectionData('tipiLavoro', {
      tenantId,
      where: [['categoriaId', '==', categoriaId]]
    });
    
    return tipiLavoro.length;
  } catch (error) {
    console.error('Errore verifica uso categoria:', error);
    return 0;
  }
}

// Export default
export default {
  initializeCategoriePredefinite,
  getAllCategorie,
  getCategoria,
  getCategoriaByCodice,
  createCategoria,
  updateCategoria,
  deleteCategoria,
  getNumeroTipiLavoroCategoria,
  CATEGORIE_PREDEFINITE
};


