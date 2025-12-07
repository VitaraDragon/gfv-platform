/**
 * Categorie Service - Servizio unificato per gestione categorie gerarchiche
 * Gestisce CRUD categorie con supporto multi-tenant e struttura gerarchica
 * 
 * @module core/services/categorie-service
 */

import { 
  createDocument, 
  getDocumentData, 
  updateDocument,
  deleteDocument,
  getCollectionData 
} from './firebase-service.js';
import { getCurrentTenantId } from './tenant-service.js';
import { Categoria } from '../models/Categoria.js';

const COLLECTION_NAME = 'categorie';

// Categorie predefinite principali
const CATEGORIE_PRINCIPALI_PREDEFINITE = [
  {
    nome: 'Lavorazione del Terreno',
    codice: 'lavorazione_terreno',
    descrizione: 'Aratura, erpicatura, fresatura, vangatura, ecc.',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 1
  },
  {
    nome: 'Trattamenti',
    codice: 'trattamenti',
    descrizione: 'Fitofarmaci, concimazione, irrigazione, ecc.',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 2
  },
  {
    nome: 'Potatura',
    codice: 'potatura',
    descrizione: 'Potatura manuale e meccanica',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 3
  },
  {
    nome: 'Raccolta',
    codice: 'raccolta',
    descrizione: 'Raccolta frutta, raccolta verdura, vendemmia, ecc.',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 4
  },
  {
    nome: 'Gestione del Verde',
    codice: 'gestione_verde',
    descrizione: 'Falciatura, taglio erba, manutenzione estetica, ecc.',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 5
  },
  {
    nome: 'Diserbo',
    codice: 'diserbo',
    descrizione: 'Eliminazione delle erbe infestanti',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 6
  },
  {
    nome: 'Semina e Piantagione',
    codice: 'semina_piantagione',
    descrizione: 'Semina, trapianto, piantagione, ecc.',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 7
  },
  {
    nome: 'Trasporto',
    codice: 'trasporto',
    descrizione: 'Rimorchi, carri, carrelli, ecc.',
    applicabileA: 'attrezzi',
    predefinita: true,
    ordine: 8
  },
  {
    nome: 'Manutenzione',
    codice: 'manutenzione',
    descrizione: 'Riparazioni, manutenzione impianti, ecc.',
    applicabileA: 'lavori',
    predefinita: true,
    ordine: 9
  },
  {
    nome: 'Altro',
    codice: 'altro',
    descrizione: 'Altri tipi non categorizzabili',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 10
  }
];

// Sottocategorie predefinite
const SOTTOCATEGORIE_PREDEFINITE = [
  // Sottocategorie per Lavorazione del Terreno
  {
    nome: 'Generale',
    codice: 'lavorazione_terreno_generale',
    parentCodice: 'lavorazione_terreno',
    descrizione: 'Lavorazione standard per campi aperti',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 1
  },
  {
    nome: 'Tra le File',
    codice: 'lavorazione_terreno_tra_file',
    parentCodice: 'lavorazione_terreno',
    descrizione: 'Lavorazione tra le file di frutteti/vigneti',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 2
  },
  {
    nome: 'Sulla Fila',
    codice: 'lavorazione_terreno_sulla_fila',
    parentCodice: 'lavorazione_terreno',
    descrizione: 'Lavorazione sulla fila di frutteti/vigneti',
    applicabileA: 'entrambi',
    predefinita: true,
    ordine: 3
  },
  // Sottocategorie per Potatura
  {
    nome: 'Manuale',
    codice: 'potatura_manuale',
    parentCodice: 'potatura',
    descrizione: 'Potatura eseguita manualmente',
    applicabileA: 'lavori',
    predefinita: true,
    ordine: 1
  },
  {
    nome: 'Meccanica',
    codice: 'potatura_meccanica',
    parentCodice: 'potatura',
    descrizione: 'Potatura eseguita con attrezzi meccanici',
    applicabileA: 'attrezzi',
    predefinita: true,
    ordine: 2
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
    const categorieMap = new Map(); // codice -> id
    
    // Crea categorie principali
    for (const categoriaPredefinita of CATEGORIE_PRINCIPALI_PREDEFINITE) {
      if (!codiciEsistenti.has(categoriaPredefinita.codice)) {
        const categoria = new Categoria({
          ...categoriaPredefinita,
          creatoDa: 'system'
        });
        
        const validation = categoria.validate();
        if (validation.valid) {
          const categoriaId = await createDocument(COLLECTION_NAME, categoria.toFirestore(), tenantId);
          categorieMap.set(categoriaPredefinita.codice, categoriaId);
        }
      } else {
        // Trova ID esistente
        const categoriaEsistente = categorieEsistenti.find(c => c.codice === categoriaPredefinita.codice);
        if (categoriaEsistente) {
          categorieMap.set(categoriaPredefinita.codice, categoriaEsistente.id);
        }
      }
    }
    
    // Crea sottocategorie
    for (const sottocategoriaPredefinita of SOTTOCATEGORIE_PREDEFINITE) {
      if (!codiciEsistenti.has(sottocategoriaPredefinita.codice)) {
        const parentId = categorieMap.get(sottocategoriaPredefinita.parentCodice);
        if (!parentId) {
          console.warn(`Categoria padre ${sottocategoriaPredefinita.parentCodice} non trovata per sottocategoria ${sottocategoriaPredefinita.codice}`);
          continue;
        }
        
        const sottocategoria = new Categoria({
          ...sottocategoriaPredefinita,
          parentId: parentId,
          creatoDa: 'system'
        });
        
        // Rimuovi parentCodice prima di salvare
        delete sottocategoria.parentCodice;
        
        const validation = sottocategoria.validate();
        if (validation.valid) {
          await createDocument(COLLECTION_NAME, sottocategoria.toFirestore(), tenantId);
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
 * @param {string} options.orderBy - Campo per ordinamento (default: 'ordine')
 * @param {string} options.orderDirection - Direzione ordinamento ('asc' | 'desc')
 * @param {string} options.parentId - Filtra per categoria padre (null per solo principali)
 * @param {string} options.applicabileA - Filtra per applicabilità ('attrezzi' | 'lavori' | 'entrambi')
 * @param {boolean} options.soloPredefinite - Se true, mostra solo categorie predefinite
 * @returns {Promise<Array<Categoria>>} Array di categorie
 */
export async function getAllCategorie(options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const { 
      orderBy = 'ordine', 
      orderDirection = 'asc',
      parentId = undefined,
      applicabileA = undefined,
      soloPredefinite = false
    } = options;
    
    const whereConditions = [];
    
    if (parentId !== undefined) {
      if (parentId === null) {
        // Solo categorie principali
        whereConditions.push(['parentId', '==', null]);
      } else {
        whereConditions.push(['parentId', '==', parentId]);
      }
    }
    
    if (applicabileA) {
      // Categorie applicabili a attrezzi o lavori o entrambi
      if (applicabileA === 'attrezzi') {
        whereConditions.push(['applicabileA', 'in', ['attrezzi', 'entrambi']]);
      } else if (applicabileA === 'lavori') {
        whereConditions.push(['applicabileA', 'in', ['lavori', 'entrambi']]);
      } else {
        whereConditions.push(['applicabileA', '==', applicabileA]);
      }
    }
    
    if (soloPredefinite) {
      whereConditions.push(['predefinita', '==', true]);
    }
    
    const documents = await getCollectionData(COLLECTION_NAME, {
      tenantId,
      orderBy,
      orderDirection,
      where: whereConditions.length > 0 ? whereConditions : undefined
    });
    
    return documents.map(doc => Categoria.fromData(doc));
  } catch (error) {
    console.error('Errore recupero categorie:', error);
    throw new Error(`Errore recupero categorie: ${error.message}`);
  }
}

/**
 * Ottieni categorie principali (senza parent)
 * @param {Object} options - Opzioni di query
 * @param {string} options.applicabileA - Filtra per applicabilità
 * @returns {Promise<Array<Categoria>>} Array di categorie principali
 */
export async function getCategoriePrincipali(options = {}) {
  return getAllCategorie({ ...options, parentId: null });
}

/**
 * Ottieni sottocategorie di una categoria principale
 * @param {string} parentId - ID categoria padre
 * @param {Object} options - Opzioni di query
 * @returns {Promise<Array<Categoria>>} Array di sottocategorie
 */
export async function getSottocategorie(parentId, options = {}) {
  return getAllCategorie({ ...options, parentId });
}

/**
 * Ottieni struttura gerarchica completa (categorie con sottocategorie)
 * @param {Object} options - Opzioni di query
 * @returns {Promise<Array<Object>>} Array di categorie con proprietà 'sottocategorie'
 */
export async function getCategorieGerarchiche(options = {}) {
  try {
    const categoriePrincipali = await getCategoriePrincipali(options);
    const strutturaGerarchica = [];
    
    for (const categoria of categoriePrincipali) {
      const sottocategorie = await getSottocategorie(categoria.id, options);
      strutturaGerarchica.push({
        ...categoria,
        sottocategorie: sottocategorie
      });
    }
    
    return strutturaGerarchica;
  } catch (error) {
    console.error('Errore recupero categorie gerarchiche:', error);
    throw new Error(`Errore recupero categorie gerarchiche: ${error.message}`);
  }
}

/**
 * Ottieni una categoria per ID
 * @param {string} categoriaId - ID categoria
 * @returns {Promise<Categoria|null>} Categoria o null se non trovata
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
    
    return Categoria.fromData(data);
  } catch (error) {
    console.error('Errore recupero categoria:', error);
    throw new Error(`Errore recupero categoria: ${error.message}`);
  }
}

/**
 * Ottieni una categoria per codice
 * @param {string} codice - Codice categoria
 * @returns {Promise<Categoria|null>} Categoria o null se non trovata
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
    
    return Categoria.fromData(documents[0]);
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
 * @param {string} categoriaData.parentId - ID categoria padre (opzionale, null per categoria principale)
 * @param {string} categoriaData.applicabileA - Applicabile a: 'attrezzi' | 'lavori' | 'entrambi' (default: 'entrambi')
 * @param {number} categoriaData.ordine - Ordine di visualizzazione (opzionale)
 * @param {string} createdBy - ID utente che crea la categoria
 * @returns {Promise<string>} ID categoria creata
 */
export async function createCategoria(categoriaData, createdBy) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const categoria = new Categoria({
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
    
    // Se è una sottocategoria, verifica che il parent esista
    if (categoria.parentId) {
      const parent = await getCategoria(categoria.parentId);
      if (!parent) {
        throw new Error('Categoria padre non trovata');
      }
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
    
    // Se parentId modificato, verifica che il nuovo parent esista
    if (updates.parentId !== undefined && updates.parentId !== categoriaEsistente.parentId) {
      if (updates.parentId) {
        const parent = await getCategoria(updates.parentId);
        if (!parent) {
          throw new Error('Categoria padre non trovata');
        }
        // Non permettere cicli gerarchici
        if (updates.parentId === categoriaId) {
          throw new Error('Una categoria non può essere padre di se stessa');
        }
        // Verifica che non si crei un ciclo (parent non può essere discendente)
        let currentParent = await getCategoria(updates.parentId);
        while (currentParent && currentParent.parentId) {
          if (currentParent.parentId === categoriaId) {
            throw new Error('Impossibile creare un ciclo gerarchico');
          }
          currentParent = await getCategoria(currentParent.parentId);
        }
      }
    }
    
    // Se codice modificato, verifica unicità
    if (updates.codice && updates.codice !== categoriaEsistente.codice) {
      const categoriaConCodice = await getCategoriaByCodice(updates.codice.toLowerCase());
      if (categoriaConCodice && categoriaConCodice.id !== categoriaId) {
        throw new Error(`Una categoria con codice "${updates.codice}" esiste già`);
      }
      updates.codice = updates.codice.toLowerCase();
    }
    
    // Aggiorna con nuovi dati
    categoriaEsistente.update(updates);
    
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
 * @param {boolean} options.force - Se true, elimina anche se usata o ha sottocategorie (default: false)
 * @returns {Promise<void>}
 * @throws {Error} Se categoria è usata o ha sottocategorie e force=false
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
    
    // Verifica se categoria ha sottocategorie
    const sottocategorie = await getSottocategorie(categoriaId);
    if (sottocategorie.length > 0 && !options.force) {
      throw new Error(
        `Impossibile eliminare: la categoria ha ${sottocategorie.length} sottocategoria/e. ` +
        `Elimina prima le sottocategorie o usa l'opzione force=true per eliminare comunque.`
      );
    }
    
    // Verifica se categoria è usata da attrezzi o tipi lavoro
    const numUsi = await getNumeroUsiCategoria(categoriaId);
    if (numUsi > 0 && !options.force) {
      throw new Error(
        `Impossibile eliminare: la categoria è utilizzata da ${numUsi} elemento/i. ` +
        `Elimina prima gli elementi o usa l'opzione force=true per eliminare comunque.`
      );
    }
    
    // Se force=true, elimina anche sottocategorie
    if (options.force && sottocategorie.length > 0) {
      for (const sottocategoria of sottocategorie) {
        await deleteDocument(COLLECTION_NAME, sottocategoria.id, tenantId);
      }
    }
    
    await deleteDocument(COLLECTION_NAME, categoriaId, tenantId);
  } catch (error) {
    console.error('Errore eliminazione categoria:', error);
    throw error; // Rilancia l'errore così la UI può gestirlo
  }
}

/**
 * Verifica se una categoria è usata da attrezzi o tipi lavoro
 * @param {string} categoriaId - ID categoria
 * @returns {Promise<number>} Numero di elementi che usano questa categoria
 */
export async function getNumeroUsiCategoria(categoriaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const { getCollectionData } = await import('./firebase-service.js');
    
    // Conta attrezzi che usano questa categoria
    const attrezzi = await getCollectionData('macchine', {
      tenantId,
      where: [
        ['tipoMacchina', '==', 'attrezzo'],
        ['categoriaFunzione', '==', categoriaId]
      ]
    });
    
    // Conta tipi lavoro che usano questa categoria
    const tipiLavoro = await getCollectionData('tipiLavoro', {
      tenantId,
      where: [['categoriaId', '==', categoriaId]]
    });
    
    return attrezzi.length + tipiLavoro.length;
  } catch (error) {
    console.error('Errore verifica uso categoria:', error);
    return 0;
  }
}

// Export default
export default {
  initializeCategoriePredefinite,
  getAllCategorie,
  getCategoriePrincipali,
  getSottocategorie,
  getCategorieGerarchiche,
  getCategoria,
  getCategoriaByCodice,
  createCategoria,
  updateCategoria,
  deleteCategoria,
  getNumeroUsiCategoria,
  CATEGORIE_PRINCIPALI_PREDEFINITE,
  SOTTOCATEGORIE_PREDEFINITE
};







