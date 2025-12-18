/**
 * Colture Service - Servizio per gestione colture
 * Gestisce CRUD colture con supporto multi-tenant
 * 
 * @module core/services/colture-service
 */

import { 
  createDocument, 
  getDocumentData, 
  updateDocument,
  deleteDocument,
  getCollectionData 
} from './firebase-service.js';
import { getCurrentTenantId } from './tenant-service.js';
import { Coltura } from '../models/Coltura.js';

const COLLECTION_NAME = 'colture';

// Colture predefinite organizzate per categoria
// Struttura: { nome, categoriaCodice, descrizione }
const COLTURE_PREDEFINITE = [
  // Frutteto
  { nome: 'Pesco', categoriaCodice: 'frutteto', descrizione: 'Pesco' },
  { nome: 'Melo', categoriaCodice: 'frutteto', descrizione: 'Melo' },
  { nome: 'Pero', categoriaCodice: 'frutteto', descrizione: 'Pero' },
  { nome: 'Albicocche', categoriaCodice: 'frutteto', descrizione: 'Albicocche' },
  { nome: 'Prugne', categoriaCodice: 'frutteto', descrizione: 'Prugne' },
  { nome: 'Ciliegio', categoriaCodice: 'frutteto', descrizione: 'Ciliegio' },
  { nome: 'Susino', categoriaCodice: 'frutteto', descrizione: 'Susino' },
  { nome: 'Fico', categoriaCodice: 'frutteto', descrizione: 'Fico' },
  { nome: 'Nocciolo', categoriaCodice: 'frutteto', descrizione: 'Nocciolo' },
  { nome: 'Mandorlo', categoriaCodice: 'frutteto', descrizione: 'Mandorlo' },
  { nome: 'Castagno', categoriaCodice: 'frutteto', descrizione: 'Castagno' },
  { nome: 'Cotogno', categoriaCodice: 'frutteto', descrizione: 'Cotogno' },
  { nome: 'Sorbo', categoriaCodice: 'frutteto', descrizione: 'Sorbo' },
  { nome: 'Nespolo', categoriaCodice: 'frutteto', descrizione: 'Nespolo' },
  { nome: 'Giuggiolo', categoriaCodice: 'frutteto', descrizione: 'Giuggiolo' },
  { nome: 'Corbezzolo', categoriaCodice: 'frutteto', descrizione: 'Corbezzolo' },
  { nome: 'Gelso', categoriaCodice: 'frutteto', descrizione: 'Gelso' },
  { nome: 'Mora', categoriaCodice: 'frutteto', descrizione: 'Mora' },
  { nome: 'Lampone', categoriaCodice: 'frutteto', descrizione: 'Lampone' },
  { nome: 'Mirtillo', categoriaCodice: 'frutteto', descrizione: 'Mirtillo' },
  { nome: 'Ribes', categoriaCodice: 'frutteto', descrizione: 'Ribes' },
  { nome: 'Uva Spina', categoriaCodice: 'frutteto', descrizione: 'Uva Spina' },
  { nome: 'Kiwi', categoriaCodice: 'frutteto', descrizione: 'Kiwi' },
  { nome: 'Melograno', categoriaCodice: 'frutteto', descrizione: 'Melograno' },
  { nome: 'Fico d\'India', categoriaCodice: 'frutteto', descrizione: 'Fico d\'India' },
  { nome: 'Kaki', categoriaCodice: 'frutteto', descrizione: 'Kaki' },
  { nome: 'Noce', categoriaCodice: 'frutteto', descrizione: 'Noce' },
  { nome: 'Pistacchio', categoriaCodice: 'frutteto', descrizione: 'Pistacchio' },
  // Seminativo
  { nome: 'Grano', categoriaCodice: 'seminativo', descrizione: 'Grano' },
  { nome: 'Mais', categoriaCodice: 'seminativo', descrizione: 'Mais' },
  { nome: 'Orzo', categoriaCodice: 'seminativo', descrizione: 'Orzo' },
  { nome: 'Favino', categoriaCodice: 'seminativo', descrizione: 'Favino' },
  { nome: 'Girasole', categoriaCodice: 'seminativo', descrizione: 'Girasole' },
  { nome: 'Soia', categoriaCodice: 'seminativo', descrizione: 'Soia' },
  { nome: 'Colza', categoriaCodice: 'seminativo', descrizione: 'Colza' },
  { nome: 'Avena', categoriaCodice: 'seminativo', descrizione: 'Avena' },
  { nome: 'Segale', categoriaCodice: 'seminativo', descrizione: 'Segale' },
  { nome: 'Fava', categoriaCodice: 'seminativo', descrizione: 'Fava' },
  { nome: 'Lenticchia', categoriaCodice: 'seminativo', descrizione: 'Lenticchia' },
  { nome: 'Cece', categoriaCodice: 'seminativo', descrizione: 'Cece' },
  { nome: 'Lupino', categoriaCodice: 'seminativo', descrizione: 'Lupino' },
  { nome: 'Cicerchia', categoriaCodice: 'seminativo', descrizione: 'Cicerchia' },
  { nome: 'Riso', categoriaCodice: 'seminativo', descrizione: 'Riso' },
  { nome: 'Grano Saraceno', categoriaCodice: 'seminativo', descrizione: 'Grano Saraceno' },
  { nome: 'Amaranto', categoriaCodice: 'seminativo', descrizione: 'Amaranto' },
  { nome: 'Quinoa', categoriaCodice: 'seminativo', descrizione: 'Quinoa' },
  { nome: 'Canapa', categoriaCodice: 'seminativo', descrizione: 'Canapa' },
  { nome: 'Lino', categoriaCodice: 'seminativo', descrizione: 'Lino' },
  { nome: 'Carthamo', categoriaCodice: 'seminativo', descrizione: 'Carthamo' },
  { nome: 'Erba Medica', categoriaCodice: 'seminativo', descrizione: 'Erba Medica' },
  { nome: 'Trifoglio', categoriaCodice: 'seminativo', descrizione: 'Trifoglio' },
  { nome: 'Veccia', categoriaCodice: 'seminativo', descrizione: 'Veccia' },
  { nome: 'Lupinella', categoriaCodice: 'seminativo', descrizione: 'Lupinella' },
  { nome: 'Sulla', categoriaCodice: 'seminativo', descrizione: 'Sulla' },
  { nome: 'Sorgo', categoriaCodice: 'seminativo', descrizione: 'Sorgo' },
  { nome: 'Miglio', categoriaCodice: 'seminativo', descrizione: 'Miglio' },
  { nome: 'Panico', categoriaCodice: 'seminativo', descrizione: 'Panico' },
  // Vite
  { nome: 'Vite', categoriaCodice: 'vite', descrizione: 'Vigneto' },
  { nome: 'Vite da Tavola', categoriaCodice: 'vite', descrizione: 'Vite da tavola' },
  { nome: 'Vite da Vino', categoriaCodice: 'vite', descrizione: 'Vite da vino' },
  // Ortive
  { nome: 'Pomodoro', categoriaCodice: 'ortive', descrizione: 'Pomodoro' },
  { nome: 'Zucchine', categoriaCodice: 'ortive', descrizione: 'Zucchine' },
  { nome: 'Melanzane', categoriaCodice: 'ortive', descrizione: 'Melanzane' },
  { nome: 'Peperoni', categoriaCodice: 'ortive', descrizione: 'Peperoni' },
  { nome: 'Insalata', categoriaCodice: 'ortive', descrizione: 'Insalata' },
  { nome: 'Carote', categoriaCodice: 'ortive', descrizione: 'Carote' },
  { nome: 'Patate', categoriaCodice: 'ortive', descrizione: 'Patate' },
  { nome: 'Bietole', categoriaCodice: 'ortive', descrizione: 'Bietole' },
  { nome: 'Fragole', categoriaCodice: 'ortive', descrizione: 'Fragole' },
  { nome: 'Cipolle', categoriaCodice: 'ortive', descrizione: 'Cipolle' },
  { nome: 'Aglio', categoriaCodice: 'ortive', descrizione: 'Aglio' },
  { nome: 'Fagioli', categoriaCodice: 'ortive', descrizione: 'Fagioli' },
  { nome: 'Fagiolini', categoriaCodice: 'ortive', descrizione: 'Fagiolini' },
  { nome: 'Piselli', categoriaCodice: 'ortive', descrizione: 'Piselli' },
  { nome: 'Cavolo', categoriaCodice: 'ortive', descrizione: 'Cavolo' },
  { nome: 'Broccoli', categoriaCodice: 'ortive', descrizione: 'Broccoli' },
  { nome: 'Cavolfiore', categoriaCodice: 'ortive', descrizione: 'Cavolfiore' },
  { nome: 'Spinaci', categoriaCodice: 'ortive', descrizione: 'Spinaci' },
  { nome: 'Lattuga', categoriaCodice: 'ortive', descrizione: 'Lattuga' },
  { nome: 'Radicchio', categoriaCodice: 'ortive', descrizione: 'Radicchio' },
  { nome: 'Finocchi', categoriaCodice: 'ortive', descrizione: 'Finocchi' },
  { nome: 'Sedano', categoriaCodice: 'ortive', descrizione: 'Sedano' },
  { nome: 'Cetrioli', categoriaCodice: 'ortive', descrizione: 'Cetrioli' },
  { nome: 'Angurie', categoriaCodice: 'ortive', descrizione: 'Angurie' },
  { nome: 'Meloni', categoriaCodice: 'ortive', descrizione: 'Meloni' },
  // Prato
  { nome: 'Prato', categoriaCodice: 'prato', descrizione: 'Prati e pascoli' },
  { nome: 'Prato Stabile', categoriaCodice: 'prato', descrizione: 'Prato stabile' },
  { nome: 'Pascolo', categoriaCodice: 'prato', descrizione: 'Pascolo' },
  // Olivo
  { nome: 'Olivo', categoriaCodice: 'olivo', descrizione: 'Oliveto' },
  // Agrumeto
  { nome: 'Arancio', categoriaCodice: 'agrumeto', descrizione: 'Arancio' },
  { nome: 'Limone', categoriaCodice: 'agrumeto', descrizione: 'Limone' },
  { nome: 'Mandarino', categoriaCodice: 'agrumeto', descrizione: 'Mandarino' },
  { nome: 'Clementine', categoriaCodice: 'agrumeto', descrizione: 'Clementine' },
  { nome: 'Pompelmo', categoriaCodice: 'agrumeto', descrizione: 'Pompelmo' },
  { nome: 'Bergamotto', categoriaCodice: 'agrumeto', descrizione: 'Bergamotto' },
  { nome: 'Cedro', categoriaCodice: 'agrumeto', descrizione: 'Cedro' },
  { nome: 'Lime', categoriaCodice: 'agrumeto', descrizione: 'Lime' },
  { nome: 'Kumquat', categoriaCodice: 'agrumeto', descrizione: 'Kumquat' },
  // Bosco
  { nome: 'Bosco', categoriaCodice: 'bosco', descrizione: 'Bosco e foresta' }
];

/**
 * Inizializza colture predefinite per il tenant corrente
 * Richiede che le categorie siano già inizializzate
 * @returns {Promise<void>}
 */
export async function initializeColturePredefinite() {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    // Carica tutte le categorie per colture
    const { getAllCategorie } = await import('./categorie-service.js');
    const categorieColture = await getAllCategorie({
      applicabileA: 'colture',
      orderBy: 'ordine',
      orderDirection: 'asc'
    });
    
    // Crea mappa codice categoria -> id categoria
    const categorieMap = new Map();
    categorieColture.forEach(cat => {
      categorieMap.set(cat.codice, cat.id);
    });
    
    // Carica tutte le colture esistenti
    const coltureEsistenti = await getAllColture();
    const nomiEsistenti = new Set(coltureEsistenti.map(c => c.nome.toLowerCase()));
    
    // Crea colture predefinite mancanti
    for (const colturaData of COLTURE_PREDEFINITE) {
      if (!nomiEsistenti.has(colturaData.nome.toLowerCase())) {
        const categoriaId = categorieMap.get(colturaData.categoriaCodice);
        if (!categoriaId) {
          console.warn(`Categoria ${colturaData.categoriaCodice} non trovata per coltura ${colturaData.nome}`);
          continue;
        }
        
        const coltura = new Coltura({
          nome: colturaData.nome,
          categoriaId: categoriaId,
          descrizione: colturaData.descrizione || null,
          predefinito: true,
          creatoDa: 'system'
        });
        
        const validation = coltura.validate();
        if (validation.valid) {
          await createDocument(COLLECTION_NAME, coltura.toFirestore(), tenantId);
          nomiEsistenti.add(colturaData.nome.toLowerCase());
        }
      }
    }
  } catch (error) {
    console.error('Errore inizializzazione colture predefinite:', error);
    throw new Error(`Errore inizializzazione colture: ${error.message}`);
  }
}

/**
 * Ottieni tutte le colture del tenant corrente
 * @param {Object} options - Opzioni di query
 * @param {string} options.orderBy - Campo per ordinamento (default: 'nome')
 * @param {string} options.orderDirection - Direzione ordinamento ('asc' | 'desc')
 * @param {string} options.categoriaId - Filtra per categoria (ID categoria)
 * @param {boolean} options.soloPredefinite - Se true, mostra solo colture predefinite
 * @returns {Promise<Array<Coltura>>} Array di colture
 */
export async function getAllColture(options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const { 
      orderBy = 'nome', 
      orderDirection = 'asc',
      categoriaId = undefined,
      soloPredefinite = false
    } = options;
    
    const whereConditions = [];
    
    if (categoriaId) {
      whereConditions.push(['categoriaId', '==', categoriaId]);
    }
    
    if (soloPredefinite) {
      whereConditions.push(['predefinito', '==', true]);
    }
    
    const documents = await getCollectionData(COLLECTION_NAME, {
      tenantId,
      orderBy,
      orderDirection,
      where: whereConditions.length > 0 ? whereConditions : undefined
    });
    
    return documents.map(doc => Coltura.fromData(doc));
  } catch (error) {
    console.error('Errore recupero colture:', error);
    throw new Error(`Errore recupero colture: ${error.message}`);
  }
}

/**
 * Ottieni tutte le colture organizzate per categoria
 * @returns {Promise<Object>} Oggetto con chiavi categoriaId e valori array di colture
 */
export async function getColturePerCategoria() {
  try {
    const colture = await getAllColture({ orderBy: 'nome', orderDirection: 'asc' });
    const colturePerCategoria = {};
    
    colture.forEach(coltura => {
      const categoriaId = coltura.categoriaId || 'senza_categoria';
      if (!colturePerCategoria[categoriaId]) {
        colturePerCategoria[categoriaId] = [];
      }
      colturePerCategoria[categoriaId].push(coltura);
    });
    
    return colturePerCategoria;
  } catch (error) {
    console.error('Errore recupero colture per categoria:', error);
    throw new Error(`Errore recupero colture per categoria: ${error.message}`);
  }
}

/**
 * Ottieni una coltura per ID
 * @param {string} colturaId - ID coltura
 * @returns {Promise<Coltura|null>} Coltura o null se non trovata
 */
export async function getColtura(colturaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!colturaId) {
      throw new Error('ID coltura obbligatorio');
    }
    
    const data = await getDocumentData(COLLECTION_NAME, colturaId, tenantId);
    
    if (!data) {
      return null;
    }
    
    return Coltura.fromData(data);
  } catch (error) {
    console.error('Errore recupero coltura:', error);
    throw new Error(`Errore recupero coltura: ${error.message}`);
  }
}

/**
 * Ottieni coltura per nome (per retrocompatibilità)
 * @param {string} nome - Nome coltura
 * @returns {Promise<Coltura|null>} Coltura o null se non trovata
 */
export async function getColturaByNome(nome) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!nome) {
      throw new Error('Nome coltura obbligatorio');
    }
    
    const { getCollectionData } = await import('./firebase-service.js');
    
    const documents = await getCollectionData(COLLECTION_NAME, {
      tenantId,
      where: [['nome', '==', nome]]
    });
    
    if (documents.length === 0) {
      return null;
    }
    
    return Coltura.fromData(documents[0]);
  } catch (error) {
    console.error('Errore recupero coltura per nome:', error);
    throw new Error(`Errore recupero coltura: ${error.message}`);
  }
}

/**
 * Crea una nuova coltura
 * @param {Object} colturaData - Dati coltura
 * @param {string} colturaData.nome - Nome coltura (obbligatorio)
 * @param {string} colturaData.categoriaId - ID categoria (obbligatorio)
 * @param {string} colturaData.descrizione - Descrizione (opzionale)
 * @param {string} createdBy - ID utente che crea la coltura
 * @returns {Promise<string>} ID coltura creata
 */
export async function createColtura(colturaData, createdBy) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const coltura = new Coltura({
      ...colturaData,
      creatoDa: createdBy
    });
    
    // Verifica che non esista già una coltura con lo stesso nome nella stessa categoria
    const coltureEsistenti = await getAllColture({ categoriaId: coltura.categoriaId });
    const colturaEsistente = coltureEsistenti.find(c => 
      c.nome.toLowerCase() === coltura.nome.toLowerCase() && 
      c.categoriaId === coltura.categoriaId
    );
    if (colturaEsistente) {
      throw new Error(`Una coltura con nome "${coltura.nome}" esiste già in questa categoria`);
    }
    
    // Valida
    const validation = coltura.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Salva
    const colturaId = await createDocument(COLLECTION_NAME, coltura.toFirestore(), tenantId);
    
    return colturaId;
  } catch (error) {
    console.error('Errore creazione coltura:', error);
    throw new Error(`Errore creazione coltura: ${error.message}`);
  }
}

/**
 * Aggiorna una coltura esistente
 * @param {string} colturaId - ID coltura
 * @param {Object} updates - Dati da aggiornare
 * @returns {Promise<void>}
 */
export async function updateColtura(colturaId, updates) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!colturaId) {
      throw new Error('ID coltura obbligatorio');
    }
    
    // Carica coltura esistente
    const colturaEsistente = await getColtura(colturaId);
    if (!colturaEsistente) {
      throw new Error('Coltura non trovata');
    }
    
    // Non permettere modifica di colture predefinite
    if (colturaEsistente.predefinito && (updates.nome || updates.predefinito === false)) {
      throw new Error('Non è possibile modificare colture predefinite del sistema');
    }
    
    // Se nome modificato, verifica unicità
    if (updates.nome && updates.nome !== colturaEsistente.nome) {
      const coltureEsistenti = await getAllColture();
      const colturaConNome = coltureEsistenti.find(c => 
        c.id !== colturaId && c.nome.toLowerCase() === updates.nome.toLowerCase()
      );
      if (colturaConNome) {
        throw new Error(`Una coltura con nome "${updates.nome}" esiste già`);
      }
    }
    
    // Aggiorna con nuovi dati
    colturaEsistente.update(updates);
    
    // Valida
    const validation = colturaEsistente.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Salva
    await updateDocument(COLLECTION_NAME, colturaId, colturaEsistente.toFirestore(), tenantId);
  } catch (error) {
    console.error('Errore aggiornamento coltura:', error);
    throw new Error(`Errore aggiornamento coltura: ${error.message}`);
  }
}

/**
 * Elimina una coltura
 * @param {string} colturaId - ID coltura
 * @param {Object} options - Opzioni eliminazione
 * @param {boolean} options.force - Se true, elimina anche se usata (default: false)
 * @returns {Promise<void>}
 * @throws {Error} Se coltura è usata e force=false
 */
export async function deleteColtura(colturaId, options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!colturaId) {
      throw new Error('ID coltura obbligatorio');
    }
    
    // Carica coltura
    const coltura = await getColtura(colturaId);
    if (!coltura) {
      throw new Error('Coltura non trovata');
    }
    
    // Non permettere eliminazione di colture predefinite
    if (coltura.predefinito) {
      throw new Error('Non è possibile eliminare colture predefinite del sistema');
    }
    
    // Verifica se coltura è usata in attività o terreni
    const numAttivita = await getNumeroAttivitaColtura(coltura.nome);
    const numTerreni = await getNumeroTerreniColtura(coltura.nome);
    
    if ((numAttivita > 0 || numTerreni > 0) && !options.force) {
      throw new Error(
        `Impossibile eliminare: la coltura è utilizzata da ${numAttivita} attività e ${numTerreni} terreni. ` +
        `Elimina prima le attività/terreni o usa l'opzione force=true per eliminare comunque.`
      );
    }
    
    await deleteDocument(COLLECTION_NAME, colturaId, tenantId);
  } catch (error) {
    console.error('Errore eliminazione coltura:', error);
    throw error; // Rilancia l'errore così la UI può gestirlo
  }
}

/**
 * Verifica se una coltura è usata in attività
 * @param {string} nomeColtura - Nome coltura
 * @returns {Promise<number>} Numero di attività che usano questa coltura
 */
export async function getNumeroAttivitaColtura(nomeColtura) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    // Import dinamico per evitare dipendenze circolari
    const { getCollectionData } = await import('./firebase-service.js');
    
    const attivita = await getCollectionData('attivita', {
      tenantId,
      where: [['coltura', '==', nomeColtura]]
    });
    
    return attivita.length;
  } catch (error) {
    console.error('Errore verifica uso coltura:', error);
    return 0;
  }
}

/**
 * Verifica se una coltura è usata in terreni
 * @param {string} nomeColtura - Nome coltura
 * @returns {Promise<number>} Numero di terreni che usano questa coltura
 */
export async function getNumeroTerreniColtura(nomeColtura) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    // Import dinamico per evitare dipendenze circolari
    const { getCollectionData } = await import('./firebase-service.js');
    
    const terreni = await getCollectionData('terreni', {
      tenantId,
      where: [['coltura', '==', nomeColtura]]
    });
    
    return terreni.length;
  } catch (error) {
    console.error('Errore verifica uso coltura in terreni:', error);
    return 0;
  }
}

/**
 * Migra lista piatta di colture alla struttura gerarchica documenti
 * @param {Array<string>} listaPiatta - Array di nomi colture
 * @param {string} createdBy - ID utente che esegue la migrazione
 * @returns {Promise<Array<string>>} Array di ID colture create
 */
export async function migraListaPiatta(listaPiatta, createdBy) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    // Carica categorie per colture
    const { getAllCategorie } = await import('./categorie-service.js');
    const categorieColture = await getAllCategorie({
      applicabileA: 'colture',
      orderBy: 'ordine',
      orderDirection: 'asc'
    });
    
    // Crea mappa codice categoria -> id categoria
    const categorieMap = new Map();
    categorieColture.forEach(cat => {
      categorieMap.set(cat.codice, cat.id);
    });
    
    // Mappatura nomi colture piatti a categorie (per retrocompatibilità)
    const mappaturaColture = {
      'vite': 'vite',
      'frutteto': 'frutteto',
      'seminativo': 'seminativo',
      'orto': 'ortive',
      'prato': 'prato',
      'olivo': 'olivo',
      'agrumeto': 'agrumeto',
      'bosco': 'bosco'
    };
    
    const coltureCreate = [];
    
    for (const nomeColtura of listaPiatta) {
      // Verifica se coltura esiste già
      const coltureEsistenti = await getAllColture();
      const colturaEsistente = coltureEsistenti.find(c => c.nome.toLowerCase() === nomeColtura.toLowerCase());
      if (colturaEsistente) {
        continue; // Salta se già esiste
      }
      
      // Determina categoria dalla mappatura o cerca nelle predefinite
      let categoriaCodice = mappaturaColture[nomeColtura.toLowerCase()];
      if (!categoriaCodice) {
        // Cerca nelle predefinite
        const colturaPredefinita = COLTURE_PREDEFINITE.find(c => c.nome.toLowerCase() === nomeColtura.toLowerCase());
        if (colturaPredefinita) {
          categoriaCodice = colturaPredefinita.categoriaCodice;
        } else {
          // Default: categoria "Altro"
          categoriaCodice = 'altro_colture';
        }
      }
      
      const categoriaId = categorieMap.get(categoriaCodice);
      if (!categoriaId) {
        console.warn(`Categoria ${categoriaCodice} non trovata per coltura ${nomeColtura}, uso "altro_colture"`);
        const altroId = categorieMap.get('altro_colture');
        if (!altroId) {
          console.error(`Categoria "altro_colture" non trovata, salto coltura ${nomeColtura}`);
          continue;
        }
        categoriaCodice = 'altro_colture';
      }
      
      // Determina se è predefinita
      const colturaPredefinita = COLTURE_PREDEFINITE.find(c => c.nome.toLowerCase() === nomeColtura.toLowerCase());
      const isPredefinita = !!colturaPredefinita;
      const descrizione = colturaPredefinita?.descrizione || null;
      
      // Crea coltura
      const colturaId = await createColtura({
        nome: nomeColtura,
        categoriaId: categoriaId || categorieMap.get('altro_colture'),
        descrizione: descrizione,
        predefinito: isPredefinita
      }, createdBy);
      
      coltureCreate.push(colturaId);
    }
    
    return coltureCreate;
  } catch (error) {
    console.error('Errore migrazione lista piatta colture:', error);
    throw new Error(`Errore migrazione: ${error.message}`);
  }
}

// Export default
export default {
  initializeColturePredefinite,
  getAllColture,
  getColturePerCategoria,
  getColtura,
  getColturaByNome,
  createColtura,
  updateColtura,
  deleteColtura,
  getNumeroAttivitaColtura,
  getNumeroTerreniColtura,
  migraListaPiatta,
  COLTURE_PREDEFINITE
};




