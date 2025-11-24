/**
 * Tipi Lavoro Service - Servizio per gestione tipi lavoro organizzati per categoria
 * Gestisce CRUD tipi lavoro con supporto multi-tenant
 * 
 * @module core/services/tipi-lavoro-service
 */

import { 
  createDocument, 
  getDocumentData, 
  updateDocument,
  deleteDocument,
  getCollectionData 
} from './firebase-service.js';
import { getCurrentTenantId } from './tenant-service.js';
import { TipoLavoro } from '../models/TipoLavoro.js';

const COLLECTION_NAME = 'tipiLavoro';

// Tipi lavoro predefiniti organizzati per categoria
const TIPI_LAVORO_PREDEFINITI = {
  'lavorazione_terreno': [
    { nome: 'Aratura', descrizione: 'Lavorazione profonda del terreno' },
    { nome: 'Erpicatura', descrizione: 'Lavorazione superficiale del terreno' },
    { nome: 'Fresatura', descrizione: 'Frantumazione e rimescolamento del terreno' },
    { nome: 'Vangatura', descrizione: 'Lavorazione manuale o meccanica del terreno' }
  ],
  'trattamenti': [
    { nome: 'Trattamento Fitofarmaci', descrizione: 'Trattamento con prodotti fitosanitari' },
    { nome: 'Concimazione', descrizione: 'Distribuzione di concimi' },
    { nome: 'Irrigazione', descrizione: 'Somministrazione di acqua alle colture' }
  ],
  'potatura': [
    { nome: 'Potatura Manuale', descrizione: 'Potatura eseguita manualmente' },
    { nome: 'Potatura Meccanica', descrizione: 'Potatura eseguita con macchine' },
    { nome: 'Cimatura', descrizione: 'Taglio delle cime delle piante' }
  ],
  'raccolta': [
    { nome: 'Raccolta Frutta', descrizione: 'Raccolta di frutti' },
    { nome: 'Raccolta Verdura', descrizione: 'Raccolta di verdure' },
    { nome: 'Vendemmia', descrizione: 'Raccolta dell\'uva' }
  ],
  'gestione_verde': [
    { nome: 'Falciatura', descrizione: 'Taglio dell\'erba' },
    { nome: 'Diserbo', descrizione: 'Eliminazione delle erbe infestanti' },
    { nome: 'Taglio Erba', descrizione: 'Taglio dell\'erba con macchine' }
  ],
  'semina_piantagione': [
    { nome: 'Semina', descrizione: 'Semina di semi' },
    { nome: 'Trapianto', descrizione: 'Trapianto di piantine' },
    { nome: 'Piantagione', descrizione: 'Piantagione di piante' }
  ],
  'manutenzione': [
    { nome: 'Riparazioni', descrizione: 'Riparazioni di attrezzature o impianti' },
    { nome: 'Manutenzione Impianti', descrizione: 'Manutenzione di impianti irrigui o altri' }
  ],
  'altro': [
    { nome: 'Altro', descrizione: 'Altri tipi di lavoro' }
  ]
};

/**
 * Inizializza tipi lavoro predefiniti per il tenant corrente
 * @returns {Promise<void>}
 */
export async function initializeTipiLavoroPredefiniti() {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    // Importa servizio categorie per ottenere ID categorie
    const { getCategoriaByCodice } = await import('./categorie-lavori-service.js');
    
    // Carica tutti i tipi lavoro esistenti
    const tipiEsistenti = await getAllTipiLavoro();
    const nomiEsistenti = new Set(tipiEsistenti.map(t => t.nome.toLowerCase()));
    
    // Per ogni categoria, crea i tipi predefiniti
    for (const [codiceCategoria, tipi] of Object.entries(TIPI_LAVORO_PREDEFINITI)) {
      const categoria = await getCategoriaByCodice(codiceCategoria);
      if (!categoria) {
        console.warn(`Categoria ${codiceCategoria} non trovata, salto tipi predefiniti`);
        continue;
      }
      
      for (const tipoData of tipi) {
        // Crea solo se non esiste già (controllo per nome, case-insensitive)
        if (!nomiEsistenti.has(tipoData.nome.toLowerCase())) {
          const tipo = new TipoLavoro({
            ...tipoData,
            categoriaId: categoria.id,
            predefinito: true,
            creatoDa: 'system'
          });
          
          const validation = tipo.validate();
          if (validation.valid) {
            await createDocument(COLLECTION_NAME, tipo.toFirestore(), tenantId);
            nomiEsistenti.add(tipoData.nome.toLowerCase());
          }
        }
      }
    }
  } catch (error) {
    console.error('Errore inizializzazione tipi lavoro predefiniti:', error);
    throw new Error(`Errore inizializzazione tipi lavoro: ${error.message}`);
  }
}

/**
 * Ottieni tutti i tipi lavoro del tenant corrente
 * @param {Object} options - Opzioni di query
 * @param {string} options.orderBy - Campo per ordinamento (default: 'nome')
 * @param {string} options.orderDirection - Direzione ordinamento ('asc' | 'desc')
 * @param {string} options.categoriaId - Filtra per categoria (opzionale)
 * @param {boolean} options.soloPredefiniti - Se true, mostra solo tipi predefiniti
 * @returns {Promise<Array<TipoLavoro>>} Array di tipi lavoro
 */
export async function getAllTipiLavoro(options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const { 
      orderBy = 'nome', 
      orderDirection = 'asc',
      categoriaId = null,
      soloPredefiniti = false
    } = options;
    
    const whereConditions = [];
    
    if (categoriaId) {
      whereConditions.push(['categoriaId', '==', categoriaId]);
    }
    
    if (soloPredefiniti) {
      whereConditions.push(['predefinito', '==', true]);
    }
    
    const documents = await getCollectionData(COLLECTION_NAME, {
      tenantId,
      orderBy,
      orderDirection,
      where: whereConditions.length > 0 ? whereConditions : undefined
    });
    
    return documents.map(doc => TipoLavoro.fromData(doc));
  } catch (error) {
    console.error('Errore recupero tipi lavoro:', error);
    throw new Error(`Errore recupero tipi lavoro: ${error.message}`);
  }
}

/**
 * Ottieni un tipo lavoro per ID
 * @param {string} tipoLavoroId - ID tipo lavoro
 * @returns {Promise<TipoLavoro|null>} Tipo lavoro o null se non trovato
 */
export async function getTipoLavoro(tipoLavoroId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!tipoLavoroId) {
      throw new Error('ID tipo lavoro obbligatorio');
    }
    
    const data = await getDocumentData(COLLECTION_NAME, tipoLavoroId, tenantId);
    
    if (!data) {
      return null;
    }
    
    return TipoLavoro.fromData(data);
  } catch (error) {
    console.error('Errore recupero tipo lavoro:', error);
    throw new Error(`Errore recupero tipo lavoro: ${error.message}`);
  }
}

/**
 * Ottieni tipi lavoro per nome (per retrocompatibilità)
 * @param {string} nome - Nome tipo lavoro
 * @returns {Promise<TipoLavoro|null>} Tipo lavoro o null se non trovato
 */
export async function getTipoLavoroByNome(nome) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!nome) {
      throw new Error('Nome tipo lavoro obbligatorio');
    }
    
    const { getCollectionData } = await import('./firebase-service.js');
    
    const documents = await getCollectionData(COLLECTION_NAME, {
      tenantId,
      where: [['nome', '==', nome]]
    });
    
    if (documents.length === 0) {
      return null;
    }
    
    return TipoLavoro.fromData(documents[0]);
  } catch (error) {
    console.error('Errore recupero tipo lavoro per nome:', error);
    throw new Error(`Errore recupero tipo lavoro: ${error.message}`);
  }
}

/**
 * Crea un nuovo tipo lavoro
 * @param {Object} tipoLavoroData - Dati tipo lavoro
 * @param {string} tipoLavoroData.nome - Nome tipo lavoro (obbligatorio)
 * @param {string} tipoLavoroData.categoriaId - ID categoria (obbligatorio)
 * @param {string} tipoLavoroData.descrizione - Descrizione (opzionale)
 * @param {string} createdBy - ID utente che crea il tipo
 * @returns {Promise<string>} ID tipo lavoro creato
 */
export async function createTipoLavoro(tipoLavoroData, createdBy) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const tipo = new TipoLavoro({
      ...tipoLavoroData,
      creatoDa: createdBy
    });
    
    // Verifica che la categoria esista
    const { getCategoria } = await import('./categorie-lavori-service.js');
    const categoria = await getCategoria(tipoLavoroData.categoriaId);
    if (!categoria) {
      throw new Error('Categoria lavoro non trovata');
    }
    
    // Verifica che non esista già un tipo con lo stesso nome nella stessa categoria
    const tipiEsistenti = await getAllTipiLavoro({ categoriaId: tipoLavoroData.categoriaId });
    const tipoEsistente = tipiEsistenti.find(t => t.nome.toLowerCase() === tipo.nome.toLowerCase());
    if (tipoEsistente) {
      throw new Error(`Un tipo lavoro con nome "${tipo.nome}" esiste già nella categoria "${categoria.nome}"`);
    }
    
    // Valida
    const validation = tipo.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Salva
    const tipoId = await createDocument(COLLECTION_NAME, tipo.toFirestore(), tenantId);
    
    return tipoId;
  } catch (error) {
    console.error('Errore creazione tipo lavoro:', error);
    throw new Error(`Errore creazione tipo lavoro: ${error.message}`);
  }
}

/**
 * Aggiorna un tipo lavoro esistente
 * @param {string} tipoLavoroId - ID tipo lavoro
 * @param {Object} updates - Dati da aggiornare
 * @returns {Promise<void>}
 */
export async function updateTipoLavoro(tipoLavoroId, updates) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!tipoLavoroId) {
      throw new Error('ID tipo lavoro obbligatorio');
    }
    
    // Carica tipo esistente
    const tipoEsistente = await getTipoLavoro(tipoLavoroId);
    if (!tipoEsistente) {
      throw new Error('Tipo lavoro non trovato');
    }
    
    // Non permettere modifica di tipi predefiniti
    if (tipoEsistente.predefinito && (updates.nome || updates.predefinito === false)) {
      throw new Error('Non è possibile modificare tipi lavoro predefiniti del sistema');
    }
    
    // Se categoria modificata, verifica che esista
    if (updates.categoriaId && updates.categoriaId !== tipoEsistente.categoriaId) {
      const { getCategoria } = await import('./categorie-lavori-service.js');
      const categoria = await getCategoria(updates.categoriaId);
      if (!categoria) {
        throw new Error('Categoria lavoro non trovata');
      }
    }
    
    // Se nome modificato, verifica unicità nella categoria
    if (updates.nome && updates.nome !== tipoEsistente.nome) {
      const categoriaId = updates.categoriaId || tipoEsistente.categoriaId;
      const tipiEsistenti = await getAllTipiLavoro({ categoriaId });
      const tipoConNome = tipiEsistenti.find(t => 
        t.id !== tipoLavoroId && t.nome.toLowerCase() === updates.nome.toLowerCase()
      );
      if (tipoConNome) {
        throw new Error(`Un tipo lavoro con nome "${updates.nome}" esiste già in questa categoria`);
      }
    }
    
    // Aggiorna con nuovi dati
    tipoEsistente.update(updates);
    
    // Valida
    const validation = tipoEsistente.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Salva
    await updateDocument(COLLECTION_NAME, tipoLavoroId, tipoEsistente.toFirestore(), tenantId);
  } catch (error) {
    console.error('Errore aggiornamento tipo lavoro:', error);
    throw new Error(`Errore aggiornamento tipo lavoro: ${error.message}`);
  }
}

/**
 * Elimina un tipo lavoro
 * @param {string} tipoLavoroId - ID tipo lavoro
 * @param {Object} options - Opzioni eliminazione
 * @param {boolean} options.force - Se true, elimina anche se usato da lavori (default: false)
 * @returns {Promise<void>}
 * @throws {Error} Se tipo è usato da lavori e force=false
 */
export async function deleteTipoLavoro(tipoLavoroId, options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!tipoLavoroId) {
      throw new Error('ID tipo lavoro obbligatorio');
    }
    
    // Carica tipo
    const tipo = await getTipoLavoro(tipoLavoroId);
    if (!tipo) {
      throw new Error('Tipo lavoro non trovato');
    }
    
    // Non permettere eliminazione di tipi predefiniti
    if (tipo.predefinito) {
      throw new Error('Non è possibile eliminare tipi lavoro predefiniti del sistema');
    }
    
    // Verifica se tipo è usato da lavori
    const numLavori = await getNumeroLavoriTipoLavoro(tipo.nome);
    
    if (numLavori > 0 && !options.force) {
      throw new Error(
        `Impossibile eliminare: il tipo lavoro è utilizzato da ${numLavori} lavoro/i. ` +
        `Elimina prima i lavori o usa l'opzione force=true per eliminare comunque.`
      );
    }
    
    await deleteDocument(COLLECTION_NAME, tipoLavoroId, tenantId);
  } catch (error) {
    console.error('Errore eliminazione tipo lavoro:', error);
    throw error; // Rilancia l'errore così la UI può gestirlo
  }
}

/**
 * Verifica se un tipo lavoro è usato da lavori
 * @param {string} nomeTipoLavoro - Nome tipo lavoro
 * @returns {Promise<number>} Numero di lavori che usano questo tipo
 */
export async function getNumeroLavoriTipoLavoro(nomeTipoLavoro) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    // Import dinamico per evitare dipendenze circolari
    const { getCollectionData } = await import('./firebase-service.js');
    
    const lavori = await getCollectionData('lavori', {
      tenantId,
      where: [['tipoLavoro', '==', nomeTipoLavoro]]
    });
    
    return lavori.length;
  } catch (error) {
    console.error('Errore verifica uso tipo lavoro:', error);
    return 0;
  }
}

/**
 * Migra lista piatta di tipi lavoro alla struttura gerarchica
 * @param {Array<string>} listaPiatta - Array di nomi tipi lavoro
 * @param {string} createdBy - ID utente che esegue la migrazione
 * @returns {Promise<Array<string>>} Array di ID tipi lavoro creati
 */
export async function migraListaPiatta(listaPiatta, createdBy) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const { getCategoriaByCodice } = await import('./categorie-lavori-service.js');
    const tipiCreati = [];
    
    // Mappa tipi predefiniti alle categorie
    const mappaturaPredefiniti = {
      'Potatura': 'potatura',
      'Raccolta': 'raccolta',
      'Raccolta frutta': 'raccolta',
      'Raccolta verdura': 'raccolta',
      'Trattamento': 'trattamenti',
      'Semina': 'semina_piantagione',
      'Aratura': 'lavorazione_terreno',
      'Irrigazione': 'trattamenti',
      'Concimazione': 'trattamenti',
      'Diserbo': 'gestione_verde'
    };
    
    for (const nomeTipo of listaPiatta) {
      // Verifica se tipo esiste già
      const tipoEsistente = await getTipoLavoroByNome(nomeTipo);
      if (tipoEsistente) {
        continue; // Salta se già esiste
      }
      
      // Determina categoria (usa mappatura o categoria "Altro")
      const codiceCategoria = mappaturaPredefiniti[nomeTipo] || 'altro';
      const categoria = await getCategoriaByCodice(codiceCategoria);
      
      if (!categoria) {
        console.warn(`Categoria ${codiceCategoria} non trovata per tipo ${nomeTipo}, uso categoria "Altro"`);
        const categoriaAltro = await getCategoriaByCodice('altro');
        if (categoriaAltro) {
          const tipoId = await createTipoLavoro({
            nome: nomeTipo,
            categoriaId: categoriaAltro.id,
            descrizione: 'Migrato da lista piatta'
          }, createdBy);
          tipiCreati.push(tipoId);
        }
        continue;
      }
      
      // Crea tipo lavoro
      const tipoId = await createTipoLavoro({
        nome: nomeTipo,
        categoriaId: categoria.id,
        descrizione: 'Migrato da lista piatta'
      }, createdBy);
      
      tipiCreati.push(tipoId);
    }
    
    return tipiCreati;
  } catch (error) {
    console.error('Errore migrazione lista piatta:', error);
    throw new Error(`Errore migrazione: ${error.message}`);
  }
}

// Export default
export default {
  initializeTipiLavoroPredefiniti,
  getAllTipiLavoro,
  getTipoLavoro,
  getTipoLavoroByNome,
  createTipoLavoro,
  updateTipoLavoro,
  deleteTipoLavoro,
  getNumeroLavoriTipoLavoro,
  migraListaPiatta,
  TIPI_LAVORO_PREDEFINITI
};

