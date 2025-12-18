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

// Tipi lavoro predefiniti organizzati per sottocategoria
// Struttura: { nome, sottocategoriaCodice, descrizione }
const TIPI_LAVORO_PREDEFINITI = [
  // Lavorazione del Terreno - Generale
  { nome: 'Aratura', sottocategoriaCodice: 'lavorazione_terreno_generale', descrizione: 'Lavorazione profonda del terreno' },
  { nome: 'Erpicatura', sottocategoriaCodice: 'lavorazione_terreno_generale', descrizione: 'Lavorazione superficiale del terreno' },
  { nome: 'Fresatura', sottocategoriaCodice: 'lavorazione_terreno_generale', descrizione: 'Frantumazione e rimescolamento del terreno' },
  { nome: 'Vangatura', sottocategoriaCodice: 'lavorazione_terreno_generale', descrizione: 'Lavorazione manuale o meccanica del terreno' },
  { nome: 'Ripuntatura', sottocategoriaCodice: 'lavorazione_terreno_generale', descrizione: 'Lavorazione profonda senza rivoltamento' },
  { nome: 'Estirpatura', sottocategoriaCodice: 'lavorazione_terreno_generale', descrizione: 'Lavorazione con estirpatore' },
  { nome: 'Rullatura', sottocategoriaCodice: 'lavorazione_terreno_generale', descrizione: 'Compattazione del terreno' },
  // Lavorazione del Terreno - Tra le File
  { nome: 'Fresatura Tra le File', sottocategoriaCodice: 'lavorazione_terreno_tra_file', descrizione: 'Fresatura tra le file di frutteti/vigneti' },
  { nome: 'Erpicatura Tra le File', sottocategoriaCodice: 'lavorazione_terreno_tra_file', descrizione: 'Erpicatura tra le file' },
  { nome: 'Ripasso Tra le File', sottocategoriaCodice: 'lavorazione_terreno_tra_file', descrizione: 'Ripasso lavorazione tra le file' },
  // Lavorazione del Terreno - Sulla Fila
  { nome: 'Vangatura Sulla Fila', sottocategoriaCodice: 'lavorazione_terreno_sulla_fila', descrizione: 'Vangatura sulla fila di frutteti/vigneti' },
  { nome: 'Zappatura Sulla Fila', sottocategoriaCodice: 'lavorazione_terreno_sulla_fila', descrizione: 'Zappatura sulla fila' },
  { nome: 'Diserbo Meccanico Sulla Fila', sottocategoriaCodice: 'lavorazione_terreno_sulla_fila', descrizione: 'Diserbo meccanico sulla fila' },
  // Trattamenti - Manuale
  { nome: 'Trattamento Manuale', sottocategoriaCodice: 'trattamenti_manuale', descrizione: 'Trattamento eseguito manualmente' },
  { nome: 'Trattamento Anticrittogamico Manuale', sottocategoriaCodice: 'trattamenti_manuale', descrizione: 'Trattamento contro malattie fungine eseguito manualmente' },
  { nome: 'Trattamento Insetticida Manuale', sottocategoriaCodice: 'trattamenti_manuale', descrizione: 'Trattamento contro insetti eseguito manualmente' },
  // Trattamenti - Meccanico
  { nome: 'Trattamento Meccanico', sottocategoriaCodice: 'trattamenti_meccanico', descrizione: 'Trattamento eseguito con macchine' },
  { nome: 'Trattamento Anticrittogamico Meccanico', sottocategoriaCodice: 'trattamenti_meccanico', descrizione: 'Trattamento contro malattie fungine con macchine' },
  { nome: 'Trattamento Insetticida Meccanico', sottocategoriaCodice: 'trattamenti_meccanico', descrizione: 'Trattamento contro insetti con macchine' },
  // Potatura - Manuale
  { nome: 'Potatura', sottocategoriaCodice: 'potatura_manuale', descrizione: 'Potatura eseguita manualmente' },
  { nome: 'Potatura di Formazione', sottocategoriaCodice: 'potatura_manuale', descrizione: 'Potatura di formazione per giovani piante' },
  { nome: 'Potatura di Produzione', sottocategoriaCodice: 'potatura_manuale', descrizione: 'Potatura di produzione per piante adulte' },
  { nome: 'Potatura di Rinnovamento', sottocategoriaCodice: 'potatura_manuale', descrizione: 'Potatura di rinnovamento per piante vecchie' },
  { nome: 'Innesto', sottocategoriaCodice: 'potatura_manuale', descrizione: 'Innesto di piante' },
  // Potatura - Meccanico
  { nome: 'Pre-potatura Meccanica', sottocategoriaCodice: 'potatura_meccanico', descrizione: 'Pre-potatura eseguita con macchine' },
  { nome: 'Potatura Meccanica', sottocategoriaCodice: 'potatura_meccanico', descrizione: 'Potatura eseguita con macchine' },
  // Raccolta - Manuale
  { nome: 'Raccolta Manuale', sottocategoriaCodice: 'raccolta_manuale', descrizione: 'Raccolta eseguita manualmente' },
  { nome: 'Raccolta con Cestini', sottocategoriaCodice: 'raccolta_manuale', descrizione: 'Raccolta manuale con cestini' },
  { nome: 'Raccolta con Scale', sottocategoriaCodice: 'raccolta_manuale', descrizione: 'Raccolta manuale con scale' },
  // Raccolta - Meccanica
  { nome: 'Raccolta Meccanica', sottocategoriaCodice: 'raccolta_meccanica', descrizione: 'Raccolta eseguita con macchine' },
  { nome: 'Raccolta con Scuotitore', sottocategoriaCodice: 'raccolta_meccanica', descrizione: 'Raccolta meccanica con scuotitore' },
  { nome: 'Raccolta con Raccoglitrici', sottocategoriaCodice: 'raccolta_meccanica', descrizione: 'Raccolta con macchine raccoglitrici' },
  // Gestione del Verde - Manuale
  { nome: 'Falciatura Manuale', sottocategoriaCodice: 'gestione_verde_manuale', descrizione: 'Taglio manuale dell\'erba' },
  { nome: 'Diserbo Manuale', sottocategoriaCodice: 'gestione_verde_manuale', descrizione: 'Eliminazione manuale delle erbe infestanti' },
  { nome: 'Taglio Siepi Manuale', sottocategoriaCodice: 'gestione_verde_manuale', descrizione: 'Taglio manuale delle siepi' },
  { nome: 'Manutenzione Verde Manuale', sottocategoriaCodice: 'gestione_verde_manuale', descrizione: 'Manutenzione estetica del verde eseguita manualmente' },
  { nome: 'Scacchiatura', sottocategoriaCodice: 'gestione_verde_manuale', descrizione: 'Rimozione manuale dei germogli superflui' },
  { nome: 'Spollonatura', sottocategoriaCodice: 'gestione_verde_manuale', descrizione: 'Rimozione manuale dei polloni' },
  { nome: 'Sfemminellatura', sottocategoriaCodice: 'gestione_verde_manuale', descrizione: 'Rimozione manuale dei germogli femminili' },
  { nome: 'Pettinatura', sottocategoriaCodice: 'gestione_verde_manuale', descrizione: 'Pettinatura manuale del verde' },
  // Gestione del Verde - Meccanico
  { nome: 'Potatura a Verde Meccanica', sottocategoriaCodice: 'gestione_verde_meccanico', descrizione: 'Potatura a verde eseguita con macchine' },
  { nome: 'Legatura', sottocategoriaCodice: 'gestione_verde_meccanico', descrizione: 'Legatura meccanica' },
  { nome: 'Defogliatura', sottocategoriaCodice: 'gestione_verde_meccanico', descrizione: 'Defogliatura meccanica' },
  { nome: 'Taglio Siepi Meccanico', sottocategoriaCodice: 'gestione_verde_meccanico', descrizione: 'Taglio delle siepi con macchine' },
  // Semina e Piantagione - Manuale
  { nome: 'Semina Manuale', sottocategoriaCodice: 'semina_piantagione_manuale', descrizione: 'Semina di semi eseguita manualmente' },
  { nome: 'Semina Diretta Manuale', sottocategoriaCodice: 'semina_piantagione_manuale', descrizione: 'Semina diretta in campo eseguita manualmente' },
  { nome: 'Semina in Semenzaio', sottocategoriaCodice: 'semina_piantagione_manuale', descrizione: 'Semina in semenzaio' },
  { nome: 'Trapianto Manuale', sottocategoriaCodice: 'semina_piantagione_manuale', descrizione: 'Trapianto di piantine eseguito manualmente' },
  { nome: 'Trapianto Ortaggi Manuale', sottocategoriaCodice: 'semina_piantagione_manuale', descrizione: 'Trapianto di ortaggi eseguito manualmente' },
  { nome: 'Piantagione Manuale', sottocategoriaCodice: 'semina_piantagione_manuale', descrizione: 'Piantagione di piante eseguita manualmente' },
  { nome: 'Piantagione Alberi Manuale', sottocategoriaCodice: 'semina_piantagione_manuale', descrizione: 'Piantagione di alberi eseguita manualmente' },
  { nome: 'Piantagione Viti Manuale', sottocategoriaCodice: 'semina_piantagione_manuale', descrizione: 'Piantagione di viti eseguita manualmente' },
  // Semina e Piantagione - Meccanico
  { nome: 'Semina Meccanica', sottocategoriaCodice: 'semina_piantagione_meccanico', descrizione: 'Semina di semi eseguita con macchine' },
  { nome: 'Semina Diretta Meccanica', sottocategoriaCodice: 'semina_piantagione_meccanico', descrizione: 'Semina diretta in campo eseguita con macchine' },
  { nome: 'Trapianto Meccanico', sottocategoriaCodice: 'semina_piantagione_meccanico', descrizione: 'Trapianto di piantine eseguito con macchine' },
  { nome: 'Trapianto Ortaggi Meccanico', sottocategoriaCodice: 'semina_piantagione_meccanico', descrizione: 'Trapianto di ortaggi eseguito con macchine' },
  { nome: 'Piantagione Meccanica', sottocategoriaCodice: 'semina_piantagione_meccanico', descrizione: 'Piantagione di piante eseguita con macchine' },
  { nome: 'Piantagione Alberi Meccanica', sottocategoriaCodice: 'semina_piantagione_meccanico', descrizione: 'Piantagione di alberi eseguita con macchine' },
  { nome: 'Piantagione Viti Meccanica', sottocategoriaCodice: 'semina_piantagione_meccanico', descrizione: 'Piantagione di viti eseguita con macchine' },
  // Diserbo - Manuale
  { nome: 'Diserbo Manuale', sottocategoriaCodice: 'diserbo_manuale', descrizione: 'Diserbo eseguito manualmente' },
  { nome: 'Diserbo Localizzato', sottocategoriaCodice: 'diserbo_manuale', descrizione: 'Diserbo localizzato manuale' },
  // Diserbo - Meccanico
  { nome: 'Diserbo a Pieno Campo', sottocategoriaCodice: 'diserbo_meccanico', descrizione: 'Diserbo meccanico a pieno campo' },
  { nome: 'Diserbo sulla Fila', sottocategoriaCodice: 'diserbo_meccanico', descrizione: 'Diserbo meccanico sulla fila' },
  { nome: 'Diserbo Meccanico', sottocategoriaCodice: 'diserbo_meccanico', descrizione: 'Diserbo eseguito con macchine' },
  // Manutenzione
  { nome: 'Riparazioni', categoriaCodice: 'manutenzione', descrizione: 'Riparazioni di attrezzature o impianti' },
  { nome: 'Manutenzione Impianti', categoriaCodice: 'manutenzione', descrizione: 'Manutenzione di impianti irrigui o altri' },
  // Altro
  { nome: 'Altro', categoriaCodice: 'altro', descrizione: 'Altri tipi di lavoro' }
];

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
    
    // Importa servizio categorie per ottenere ID categorie e sottocategorie
    const { getCategoriaByCodice, getAllCategorie } = await import('./categorie-service.js');
    
    // Carica tutte le categorie e sottocategorie per creare mappa codice -> id
    const tutteCategorie = await getAllCategorie();
    const categorieMap = new Map(); // codice -> id
    const sottocategorieMap = new Map(); // codice -> id
    
    tutteCategorie.forEach(cat => {
      if (cat.codice) {
        if (cat.parentId) {
          // È una sottocategoria
          sottocategorieMap.set(cat.codice.toLowerCase(), cat.id);
        } else {
          // È una categoria principale
          categorieMap.set(cat.codice.toLowerCase(), cat.id);
        }
      }
    });
    
    // Carica tutti i tipi lavoro esistenti
    const tipiEsistenti = await getAllTipiLavoro();
    const nomiEsistenti = new Set(tipiEsistenti.map(t => t.nome.toLowerCase()));
    
    // Per ogni tipo lavoro predefinito, crea se non esiste
    for (const tipoData of TIPI_LAVORO_PREDEFINITI) {
      // Crea solo se non esiste già (controllo per nome, case-insensitive)
      if (nomiEsistenti.has(tipoData.nome.toLowerCase())) {
        continue;
      }
      
      let categoriaId = null;
      let sottocategoriaId = null;
      
      // Determina categoria e sottocategoria
      if (tipoData.sottocategoriaCodice) {
        // Ha una sottocategoria
        sottocategoriaId = sottocategorieMap.get(tipoData.sottocategoriaCodice.toLowerCase());
        if (sottocategoriaId) {
          // Trova la categoria padre dalla sottocategoria
          const sottocategoria = tutteCategorie.find(c => c.id === sottocategoriaId);
          if (sottocategoria && sottocategoria.parentId) {
            categoriaId = sottocategoria.parentId;
          }
        }
      } else if (tipoData.categoriaCodice) {
        // Ha solo una categoria (senza sottocategoria)
        categoriaId = categorieMap.get(tipoData.categoriaCodice.toLowerCase());
      }
      
      if (!categoriaId) {
        console.warn(`Categoria non trovata per tipo ${tipoData.nome}, salto`);
        continue;
      }
      
      const tipo = new TipoLavoro({
        nome: tipoData.nome,
        categoriaId: categoriaId,
        sottocategoriaId: sottocategoriaId,
        descrizione: tipoData.descrizione || null,
        predefinito: true,
        creatoDa: 'system'
      });
      
      const validation = tipo.validate();
      if (validation.valid) {
        await createDocument(COLLECTION_NAME, tipo.toFirestore(), tenantId);
        nomiEsistenti.add(tipoData.nome.toLowerCase());
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
 * @param {string} options.sottocategoriaId - Filtra per sottocategoria (opzionale)
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
      sottocategoriaId = null,
      soloPredefiniti = false
    } = options;
    
    const whereConditions = [];
    
    if (categoriaId) {
      whereConditions.push(['categoriaId', '==', categoriaId]);
    }
    
    if (sottocategoriaId) {
      whereConditions.push(['sottocategoriaId', '==', sottocategoriaId]);
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
 * Ottieni tipi lavoro organizzati per categoria e sottocategoria
 * @returns {Promise<Object>} Oggetto con struttura { categoriaId: { sottocategoriaId: [tipi] } }
 */
export async function getTipiLavoroGerarchici() {
  try {
    const tipi = await getAllTipiLavoro({ orderBy: 'nome', orderDirection: 'asc' });
    const strutturaGerarchica = {};
    
    tipi.forEach(tipo => {
      const categoriaId = tipo.categoriaId || 'senza_categoria';
      const sottocategoriaId = tipo.sottocategoriaId || 'senza_sottocategoria';
      
      if (!strutturaGerarchica[categoriaId]) {
        strutturaGerarchica[categoriaId] = {};
      }
      
      if (!strutturaGerarchica[categoriaId][sottocategoriaId]) {
        strutturaGerarchica[categoriaId][sottocategoriaId] = [];
      }
      
      strutturaGerarchica[categoriaId][sottocategoriaId].push(tipo);
    });
    
    return strutturaGerarchica;
  } catch (error) {
    console.error('Errore recupero tipi lavoro gerarchici:', error);
    throw new Error(`Errore recupero tipi lavoro gerarchici: ${error.message}`);
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
    const { getCategoria } = await import('./categorie-service.js');
    const categoria = await getCategoria(tipoLavoroData.categoriaId);
    if (!categoria) {
      throw new Error('Categoria lavoro non trovata');
    }
    
    // Se ha una sottocategoria, verifica che esista e che appartenga alla categoria
    if (tipoLavoroData.sottocategoriaId) {
      const { getCategoria: getSottocategoria } = await import('./categorie-service.js');
      const sottocategoria = await getSottocategoria(tipoLavoroData.sottocategoriaId);
      if (!sottocategoria) {
        throw new Error('Sottocategoria lavoro non trovata');
      }
      if (sottocategoria.parentId !== tipoLavoroData.categoriaId) {
        throw new Error('La sottocategoria non appartiene alla categoria selezionata');
      }
    }
    
    // Verifica che non esista già un tipo con lo stesso nome nella stessa categoria/sottocategoria
    const filtro = { categoriaId: tipoLavoroData.categoriaId };
    if (tipoLavoroData.sottocategoriaId) {
      filtro.sottocategoriaId = tipoLavoroData.sottocategoriaId;
    }
    const tipiEsistenti = await getAllTipiLavoro(filtro);
    const tipoEsistente = tipiEsistenti.find(t => t.nome.toLowerCase() === tipo.nome.toLowerCase());
    if (tipoEsistente) {
      const categoriaNome = categoria.nome;
      const sottocategoriaNome = tipoLavoroData.sottocategoriaId ? ` (sottocategoria: ${sottocategoria?.nome || 'N/A'})` : '';
      throw new Error(`Un tipo lavoro con nome "${tipo.nome}" esiste già nella categoria "${categoriaNome}"${sottocategoriaNome}`);
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
      const { getCategoria } = await import('./categorie-service.js');
      const categoria = await getCategoria(updates.categoriaId);
      if (!categoria) {
        throw new Error('Categoria lavoro non trovata');
      }
    }
    
    // Se sottocategoria modificata, verifica che esista e appartenga alla categoria
    if (updates.sottocategoriaId !== undefined) {
      const categoriaId = updates.categoriaId || tipoEsistente.categoriaId;
      if (updates.sottocategoriaId) {
        const { getCategoria: getSottocategoria } = await import('./categorie-service.js');
        const sottocategoria = await getSottocategoria(updates.sottocategoriaId);
        if (!sottocategoria) {
          throw new Error('Sottocategoria lavoro non trovata');
        }
        if (sottocategoria.parentId !== categoriaId) {
          throw new Error('La sottocategoria non appartiene alla categoria selezionata');
        }
      }
    }
    
    // Se nome modificato, verifica unicità nella categoria/sottocategoria
    if (updates.nome && updates.nome !== tipoEsistente.nome) {
      const categoriaId = updates.categoriaId || tipoEsistente.categoriaId;
      const sottocategoriaId = updates.sottocategoriaId !== undefined ? updates.sottocategoriaId : tipoEsistente.sottocategoriaId;
      
      const filtro = { categoriaId };
      if (sottocategoriaId) {
        filtro.sottocategoriaId = sottocategoriaId;
      }
      
      const tipiEsistenti = await getAllTipiLavoro(filtro);
      const tipoConNome = tipiEsistenti.find(t => 
        t.id !== tipoLavoroId && t.nome.toLowerCase() === updates.nome.toLowerCase()
      );
      if (tipoConNome) {
        throw new Error(`Un tipo lavoro con nome "${updates.nome}" esiste già in questa categoria${sottocategoriaId ? '/sottocategoria' : ''}`);
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
    
    const { getCategoriaByCodice } = await import('./categorie-service.js');
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
  getTipiLavoroGerarchici,
  TIPI_LAVORO_PREDEFINITI
};







