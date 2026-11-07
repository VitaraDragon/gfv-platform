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
import { COLTURE_PREDEFINITE } from '../config/app-catalog-seed-data.js';
import { conLockSeed, idSeed, datiSeed, scriviSeedBatch } from './catalogo-seed.js';
import { mappeCodiceCanonico } from '../js/catalogo-dedupe.js';
import {
  decidiEliminazioneColtura,
  MESSAGGIO_VERIFICA_USO_COLTURA
} from './colture-elimina-logic.js';

export { COLTURE_PREDEFINITE };
export { decidiEliminazioneColtura, MESSAGGIO_VERIFICA_USO_COLTURA };

const COLLECTION_NAME = 'colture';

/**
 * Inizializza colture predefinite per il tenant corrente.
 * Completa le voci mancanti (ripresa dopo seed interrotto); a catalogo completo zero scritture.
 * Idempotente: id deterministici (`seed_<nome>`) in writeBatch, una sola esecuzione
 * alla volta per tenant, nessuna scrittura se una lettura fallisce, categoria = copia canonica.
 * @returns {Promise<void>}
 */
export async function initializeColturePredefinite() {
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    throw new Error('Errore inizializzazione colture: Nessun tenant corrente disponibile');
  }
  return conLockSeed('colture', tenantId, () => seedColturePredefinite(tenantId));
}

async function seedColturePredefinite(tenantId) {
  try {
    // Assicura che le categorie siano inizializzate prima
    const { leggiCategorieGrezze, initializeCategoriePredefinite } = await import('./categorie-service.js');
    
    // Lettura grezza (lancia se fallisce: niente seed su errore di lettura)
    const soloColture = (lista) => lista.filter(c => c.applicabileA === 'colture');
    let categorieColture = soloColture(await leggiCategorieGrezze(tenantId));
    
    // Se non ci sono categorie, inizializzale
    if (categorieColture.length === 0) {
      try {
        await initializeCategoriePredefinite();
      } catch (catError) {
        console.warn('⚠️ Errore inizializzazione categorie:', catError.message);
      }
      // Ricarica le categorie dopo l'inizializzazione
      categorieColture = soloColture(await leggiCategorieGrezze(tenantId));
    }
    
    // codice categoria -> id canonico (stessa copia per ogni esecuzione)
    const { principali: categorieMap } = mappeCodiceCanonico(categorieColture);
    
    // Carica tutte le colture esistenti (lancia se fallisce)
    const coltureDocs = await getCollectionData(COLLECTION_NAME, { tenantId });
    const nomiEsistenti = new Set(
      (coltureDocs || []).map(c => String(c.nome || '').toLowerCase()).filter(Boolean)
    );
    
    // Raccogli colture predefinite mancanti, poi una sola (o poche) writeBatch
    const daCreare = [];
    for (const colturaData of COLTURE_PREDEFINITE) {
      if (nomiEsistenti.has(colturaData.nome.toLowerCase())) continue;

      const categoriaId = categorieMap.get(String(colturaData.categoriaCodice).toLowerCase());
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
      if (!validation.valid) continue;

      daCreare.push({
        id: idSeed(colturaData.nome),
        data: datiSeed(coltura.toFirestore())
      });
      nomiEsistenti.add(colturaData.nome.toLowerCase());
    }

    await scriviSeedBatch(COLLECTION_NAME, daCreare, tenantId);
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
    // Errori critici (validazione, autenticazione) -> lancia eccezione
    if (error.message.includes('tenant') || error.message.includes('obbligatorio')) {
      console.error('Errore recupero colture:', error);
      throw new Error(`Errore recupero colture: ${error.message}`);
    }
    // Errori non critici (database, rete) -> ritorna array vuoto
    console.error('Errore recupero colture:', error);
    return [];
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
    // Errori critici (validazione, autenticazione) -> lancia eccezione
    if (error.message.includes('tenant') || error.message.includes('obbligatorio')) {
      console.error('Errore recupero colture per categoria:', error);
      throw new Error(`Errore recupero colture per categoria: ${error.message}`);
    }
    // Errori non critici (database, rete) -> ritorna oggetto vuoto
    console.error('Errore recupero colture per categoria:', error);
    return {};
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
 * Elimina una coltura. Mai con riferimenti residui (nessun force).
 * @param {string} colturaId - ID coltura
 * @returns {Promise<void>}
 * @throws {Error} Se coltura è usata, predefinita o la verifica fallisce
 */
export async function deleteColtura(colturaId) {
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

    let numAttivita = 0;
    let numTerreni = 0;
    let verificaOk = true;
    try {
      numAttivita = await getNumeroAttivitaColtura(coltura.nome);
      numTerreni = await getNumeroTerreniColtura(coltura.nome);
    } catch (error) {
      console.error('Errore verifica uso coltura:', error);
      verificaOk = false;
    }

    const decisione = decidiEliminazioneColtura({
      predefinito: !!coltura.predefinito,
      numAttivita,
      numTerreni,
      verificaOk
    });
    if (!decisione.ok) {
      throw new Error(decisione.messaggio);
    }
    
    await deleteDocument(COLLECTION_NAME, colturaId, tenantId);
  } catch (error) {
    console.error('Errore eliminazione coltura:', error);
    throw error; // Rilancia l'errore così la UI può gestirlo
  }
}

/**
 * Verifica se una coltura è usata in attività del Diario (non Gestione lavori).
 * @param {string} nomeColtura - Nome coltura
 * @returns {Promise<number>} Numero di attività che usano questa coltura
 */
export async function getNumeroAttivitaColtura(nomeColtura) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    throw new Error('Nessun tenant corrente disponibile');
  }

  const { getCollectionData } = await import('./firebase-service.js');

  const attivita = await getCollectionData('attivita', {
    tenantId,
    where: [['coltura', '==', nomeColtura]]
  });

  return attivita.length;
}

/**
 * Verifica se una coltura è usata in terreni (inclusi archiviati).
 * @param {string} nomeColtura - Nome coltura
 * @returns {Promise<number>} Numero di terreni che usano questa coltura
 */
export async function getNumeroTerreniColtura(nomeColtura) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    throw new Error('Nessun tenant corrente disponibile');
  }

  const { getCollectionData } = await import('./firebase-service.js');

  const terreni = await getCollectionData('terreni', {
    tenantId,
    where: [['coltura', '==', nomeColtura]]
  });

  return terreni.length;
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
  decidiEliminazioneColtura,
  MESSAGGIO_VERIFICA_USO_COLTURA,
  getNumeroAttivitaColtura,
  getNumeroTerreniColtura,
  migraListaPiatta,
  COLTURE_PREDEFINITE
};




