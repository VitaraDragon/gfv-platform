/**
 * Liste Service - Servizio per gestione liste personalizzate
 * Gestisce liste predefinite e custom per tipi lavoro e colture
 * 
 * NOTA: Questo servizio ora sincronizza con tipiLavoro come fonte unica di verità.
 * ListePersonalizzate viene mantenuta per retrocompatibilità ma legge da tipiLavoro.
 * 
 * @module core/services/liste-service
 */

import { 
  getDocumentData, 
  setDocument 
} from './firebase-service.js';
import { getCurrentTenantId } from './tenant-service.js';
import { ListePersonalizzate, TIPI_LAVORO_PREDEFINITI, COLTURE_PREDEFINITE } from '../models/ListePersonalizzate.js';

const COLLECTION_NAME = 'liste';
const DOCUMENT_ID = 'personalizzate';

/**
 * Ottieni liste personalizzate del tenant corrente
 * Sincronizza automaticamente con tipiLavoro come fonte unica di verità
 * Se non esistono, crea con valori predefiniti
 * @returns {Promise<ListePersonalizzate>} Liste personalizzate
 */
export async function getListe() {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    // Prova a recuperare liste esistenti
    let data = await getDocumentData(COLLECTION_NAME, DOCUMENT_ID, tenantId);
    
    // Sincronizza da tipiLavoro e colture (fonti uniche di verità)
    let tipiLavoroSincronizzati = false;
    let coltureSincronizzate = false;
    
    // Sincronizza tipiLavoro
    try {
      const { getAllTipiLavoro } = await import('./tipi-lavoro-service.js');
      const tipiLavoro = await getAllTipiLavoro({ orderBy: 'nome', orderDirection: 'asc' });
      
      if (tipiLavoro && tipiLavoro.length > 0) {
        const nomiTipiLavoro = tipiLavoro.map(t => t.nome);
        
        if (data) {
          data.tipiLavoro = nomiTipiLavoro;
        } else {
          data = { tipiLavoro: nomiTipiLavoro };
        }
        tipiLavoroSincronizzati = true;
      }
    } catch (error) {
      console.warn('Impossibile sincronizzare con tipiLavoro:', error.message);
    }
    
    // Sincronizza colture
    try {
      const { getAllColture } = await import('./colture-service.js');
      const colture = await getAllColture({ orderBy: 'nome', orderDirection: 'asc' });
      
      if (colture && colture.length > 0) {
        const nomiColture = colture.map(c => c.nome);
        
        if (data) {
          data.colture = nomiColture;
        } else {
          if (!data) data = {};
          data.colture = nomiColture;
        }
        coltureSincronizzate = true;
      }
    } catch (error) {
      console.warn('Impossibile sincronizzare con colture:', error.message);
    }
    
    // Se almeno una sincronizzazione è riuscita, salva lista sincronizzata
    if (tipiLavoroSincronizzati || coltureSincronizzate) {
      // Assicura che entrambi i campi esistano
      if (!data.tipiLavoro) {
        data.tipiLavoro = data?.tipiLavoro || [...TIPI_LAVORO_PREDEFINITI];
      }
      if (!data.colture) {
        data.colture = data?.colture || [...COLTURE_PREDEFINITE];
      }
      
      const liste = new ListePersonalizzate(data);
      await setDocument(COLLECTION_NAME, DOCUMENT_ID, liste.toFirestore(), tenantId);
      return liste;
    }
    
    // Fallback: usa lista esistente o crea con predefiniti
    if (data) {
      return ListePersonalizzate.fromData(data);
    }
    
    // Se non esistono, crea con predefiniti
    const liste = new ListePersonalizzate({ id: DOCUMENT_ID });
    await setDocument(COLLECTION_NAME, DOCUMENT_ID, liste.toFirestore(), tenantId);
    
    return liste;
  } catch (error) {
    console.error('Errore recupero liste:', error);
    throw new Error(`Errore recupero liste: ${error.message}`);
  }
}

/**
 * Aggiunge un nuovo tipo lavoro (custom)
 * Ora crea il tipo lavoro nella collection tipiLavoro (fonte unica di verità)
 * @param {string} tipoLavoro - Nome tipo lavoro
 * @param {string} categoriaId - ID categoria (opzionale, default: categoria "altro")
 * @param {string} createdBy - ID utente che crea (opzionale)
 * @returns {Promise<Object>} { success: boolean, error: string|null, tipoLavoroId: string|null }
 */
export async function addTipoLavoro(tipoLavoro, categoriaId = null, createdBy = null) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    // Prova a creare in tipiLavoro (fonte unica di verità)
    try {
      const { getAllTipiLavoro, createTipoLavoro } = await import('./tipi-lavoro-service.js');
      const { getCategoriaByCodice } = await import('./categorie-service.js');
      
      // Verifica se esiste già
      const tipiEsistenti = await getAllTipiLavoro();
      const tipoEsistente = tipiEsistenti.find(t => t.nome.toLowerCase() === tipoLavoro.trim().toLowerCase());
      
      if (tipoEsistente) {
        // Già esiste, sincronizza ListePersonalizzate e ritorna successo
        await syncListeFromTipiLavoro();
        return { success: true, error: null, tipoLavoroId: tipoEsistente.id };
      }
      
      // Determina categoria (usa quella fornita o categoria "altro")
      let categoriaIdFinale = categoriaId;
      if (!categoriaIdFinale) {
        const categoriaAltro = await getCategoriaByCodice('altro');
        if (categoriaAltro) {
          categoriaIdFinale = categoriaAltro.id;
        } else {
          throw new Error('Categoria "altro" non trovata. Impossibile creare tipo lavoro.');
        }
      }
      
      // Crea tipo lavoro in tipiLavoro
      const tipoLavoroId = await createTipoLavoro({
        nome: tipoLavoro.trim(),
        categoriaId: categoriaIdFinale,
        descrizione: null
      }, createdBy || 'system');
      
      // Sincronizza ListePersonalizzate
      await syncListeFromTipiLavoro();
      
      return { success: true, error: null, tipoLavoroId };
    } catch (error) {
      // Fallback: se tipiLavoro non disponibile, usa metodo vecchio
      console.warn('Impossibile creare in tipiLavoro, uso ListePersonalizzate:', error.message);
      
      const liste = await getListe();
      const result = liste.addTipoLavoro(tipoLavoro);
      
      if (result.success) {
        await setDocument(COLLECTION_NAME, DOCUMENT_ID, liste.toFirestore(), tenantId);
      }
      
      return { ...result, tipoLavoroId: null };
    }
  } catch (error) {
    console.error('Errore aggiunta tipo lavoro:', error);
    return { success: false, error: error.message, tipoLavoroId: null };
  }
}

/**
 * Sincronizza ListePersonalizzate da tipiLavoro (fonte unica di verità)
 * @returns {Promise<void>}
 */
async function syncListeFromTipiLavoro() {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) return;
    
    const { getAllTipiLavoro } = await import('./tipi-lavoro-service.js');
    const tipiLavoro = await getAllTipiLavoro({ orderBy: 'nome', orderDirection: 'asc' });
    
    if (tipiLavoro && tipiLavoro.length > 0) {
      const nomiTipiLavoro = tipiLavoro.map(t => t.nome);
      
      // Recupera liste esistenti (per mantenere colture)
      const data = await getDocumentData(COLLECTION_NAME, DOCUMENT_ID, tenantId);
      
      // Recupera colture da servizio centralizzato
      let colture = data?.colture || [];
      try {
        const { getAllColture } = await import('./colture-service.js');
        const coltureList = await getAllColture({ orderBy: 'nome', orderDirection: 'asc' });
        if (coltureList && coltureList.length > 0) {
          colture = coltureList.map(c => c.nome);
        }
      } catch (error) {
        // Mantieni colture esistenti se sincronizzazione fallisce
      }
      
      // Aggiorna tipiLavoro e colture
      const liste = new ListePersonalizzate({
        id: DOCUMENT_ID,
        tipiLavoro: nomiTipiLavoro,
        colture: colture
      });
      
      await setDocument(COLLECTION_NAME, DOCUMENT_ID, liste.toFirestore(), tenantId);
    }
  } catch (error) {
    console.warn('Errore sincronizzazione ListePersonalizzate:', error);
    // Non bloccare se sincronizzazione fallisce
  }
}

/**
 * Rimuove un tipo lavoro (solo custom)
 * Ora rimuove da tipiLavoro (fonte unica di verità)
 * @param {string} tipoLavoro - Nome tipo lavoro
 * @returns {Promise<Object>} { success: boolean, error: string|null }
 */
export async function removeTipoLavoro(tipoLavoro) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    // Prova a rimuovere da tipiLavoro (fonte unica di verità)
    try {
      const { getAllTipiLavoro, getTipoLavoroByNome, deleteTipoLavoro } = await import('./tipi-lavoro-service.js');
      
      // Trova tipo lavoro per nome
      const tipoLavoroObj = await getTipoLavoroByNome(tipoLavoro);
      
      if (!tipoLavoroObj) {
        return { success: false, error: 'Tipo lavoro non trovato' };
      }
      
      // Verifica se è predefinito
      if (tipoLavoroObj.predefinito) {
        return { success: false, error: 'Non è possibile eliminare un tipo lavoro predefinito' };
      }
      
      // Elimina da tipiLavoro
      await deleteTipoLavoro(tipoLavoroObj.id);
      
      // Sincronizza ListePersonalizzate
      await syncListeFromTipiLavoro();
      
      return { success: true, error: null };
    } catch (error) {
      // Fallback: se tipiLavoro non disponibile, usa metodo vecchio
      console.warn('Impossibile rimuovere da tipiLavoro, uso ListePersonalizzate:', error.message);
      
      const liste = await getListe();
      const result = liste.removeTipoLavoro(tipoLavoro);
      
      if (result.success) {
        await setDocument(COLLECTION_NAME, DOCUMENT_ID, liste.toFirestore(), tenantId);
      }
      
      return result;
    }
  } catch (error) {
    console.error('Errore rimozione tipo lavoro:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Aggiunge una nuova coltura (custom)
 * Ora crea la coltura nella collection colture (fonte unica di verità)
 * @param {string} coltura - Nome coltura
 * @param {string} createdBy - ID utente che crea (opzionale)
 * @returns {Promise<Object>} { success: boolean, error: string|null, colturaId: string|null }
 */
export async function addColtura(coltura, createdBy = null) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    // Prova a creare in colture (fonte unica di verità)
    try {
      const { getAllColture, createColtura } = await import('./colture-service.js');
      
      // Verifica se esiste già
      const coltureEsistenti = await getAllColture();
      const colturaEsistente = coltureEsistenti.find(c => c.nome.toLowerCase() === coltura.trim().toLowerCase());
      
      if (colturaEsistente) {
        // Già esiste, sincronizza ListePersonalizzate e ritorna successo
        await syncListeFromColture();
        return { success: true, error: null, colturaId: colturaEsistente.id };
      }
      
      // Determina categoria (default: categoria "altro_colture")
      const { getAllCategorie } = await import('./categorie-service.js');
      const categorieColture = await getAllCategorie({
        applicabileA: 'colture',
        orderBy: 'ordine',
        orderDirection: 'asc'
      });
      const categoriaAltro = categorieColture.find(c => c.codice === 'altro_colture');
      const categoriaId = categoriaAltro ? categoriaAltro.id : null;
      
      if (!categoriaId) {
        throw new Error('Categoria "altro_colture" non trovata. Impossibile creare coltura.');
      }
      
      // Crea coltura in collection colture
      const colturaId = await createColtura({
        nome: coltura.trim(),
        categoriaId: categoriaId,
        descrizione: null
      }, createdBy || 'system');
      
      // Sincronizza ListePersonalizzate
      await syncListeFromColture();
      
      return { success: true, error: null, colturaId };
    } catch (error) {
      // Fallback: se colture non disponibile, usa metodo vecchio
      console.warn('Impossibile creare in colture, uso ListePersonalizzate:', error.message);
      
      const liste = await getListe();
      const result = liste.addColtura(coltura);
      
      if (result.success) {
        await setDocument(COLLECTION_NAME, DOCUMENT_ID, liste.toFirestore(), tenantId);
      }
      
      return { ...result, colturaId: null };
    }
  } catch (error) {
    console.error('Errore aggiunta coltura:', error);
    return { success: false, error: error.message, colturaId: null };
  }
}

/**
 * Sincronizza ListePersonalizzate da colture (fonte unica di verità)
 * @returns {Promise<void>}
 */
async function syncListeFromColture() {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) return;
    
    const { getAllColture } = await import('./colture-service.js');
    const colture = await getAllColture({ orderBy: 'nome', orderDirection: 'asc' });
    
    if (colture && colture.length > 0) {
      // Estrai nomi colture dalla struttura gerarchica
      const nomiColture = colture.map(c => c.nome);
      
      // Recupera liste esistenti (per mantenere tipiLavoro sincronizzato)
      const data = await getDocumentData(COLLECTION_NAME, DOCUMENT_ID, tenantId);
      
      // Sincronizza anche tipiLavoro se disponibile
      let tipiLavoro = data?.tipiLavoro || [];
      try {
        const { getAllTipiLavoro } = await import('./tipi-lavoro-service.js');
        const tipiLavoroList = await getAllTipiLavoro({ orderBy: 'nome', orderDirection: 'asc' });
        if (tipiLavoroList && tipiLavoroList.length > 0) {
          tipiLavoro = tipiLavoroList.map(t => t.nome);
        }
      } catch (error) {
        // Mantieni tipiLavoro esistenti se sincronizzazione fallisce
      }
      
      // Aggiorna colture, mantieni tipiLavoro sincronizzato
      const liste = new ListePersonalizzate({
        id: DOCUMENT_ID,
        tipiLavoro: tipiLavoro,
        colture: nomiColture
      });
      
      await setDocument(COLLECTION_NAME, DOCUMENT_ID, liste.toFirestore(), tenantId);
    }
  } catch (error) {
    console.warn('Errore sincronizzazione ListePersonalizzate da colture:', error);
    // Non bloccare se sincronizzazione fallisce
  }
}

/**
 * Rimuove una coltura (solo custom)
 * Ora rimuove da colture (fonte unica di verità)
 * @param {string} coltura - Nome coltura
 * @returns {Promise<Object>} { success: boolean, error: string|null }
 */
export async function removeColtura(coltura) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    // Prova a rimuovere da colture (fonte unica di verità)
    try {
      const { getColturaByNome, deleteColtura } = await import('./colture-service.js');
      
      // Trova coltura per nome
      const colturaObj = await getColturaByNome(coltura);
      
      if (!colturaObj) {
        return { success: false, error: 'Coltura non trovata' };
      }
      
      // Verifica se è predefinita
      if (colturaObj.predefinito) {
        return { success: false, error: 'Non è possibile eliminare una coltura predefinita' };
      }
      
      // Elimina da colture
      await deleteColtura(colturaObj.id);
      
      // Sincronizza ListePersonalizzate
      await syncListeFromColture();
      
      return { success: true, error: null };
    } catch (error) {
      // Fallback: se colture non disponibile, usa metodo vecchio
      console.warn('Impossibile rimuovere da colture, uso ListePersonalizzate:', error.message);
      
      const liste = await getListe();
      const result = liste.removeColtura(coltura);
      
      if (result.success) {
        await setDocument(COLLECTION_NAME, DOCUMENT_ID, liste.toFirestore(), tenantId);
      }
      
      return result;
    }
  } catch (error) {
    console.error('Errore rimozione coltura:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Verifica se un tipo lavoro è predefinito
 * @param {string} tipoLavoro - Nome tipo lavoro
 * @returns {boolean} true se è predefinito
 */
export function isPredefinitoTipoLavoro(tipoLavoro) {
  return TIPI_LAVORO_PREDEFINITI.some(
    predefinito => predefinito.toLowerCase() === tipoLavoro.toLowerCase()
  );
}

/**
 * Verifica se una coltura è predefinita
 * @param {string} coltura - Nome coltura
 * @returns {boolean} true se è predefinita
 */
export function isPredefinitaColtura(coltura) {
  return COLTURE_PREDEFINITE.some(
    predefinita => predefinita.toLowerCase() === coltura.toLowerCase()
  );
}

/**
 * Verifica se un tipo lavoro è usato in attività
 * @param {string} tipoLavoro - Nome tipo lavoro
 * @returns {Promise<number>} Numero di attività che usano questo tipo lavoro
 */
export async function getNumeroAttivitaTipoLavoro(tipoLavoro) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const { getCollectionData } = await import('./firebase-service.js');
    
    const attivita = await getCollectionData('attivita', {
      tenantId,
      where: [['tipoLavoro', '==', tipoLavoro]]
    });
    
    return attivita.length;
  } catch (error) {
    console.error('Errore verifica uso tipo lavoro:', error);
    return 0;
  }
}

/**
 * Verifica se una coltura è usata in attività
 * @param {string} coltura - Nome coltura
 * @returns {Promise<number>} Numero di attività che usano questa coltura
 */
export async function getNumeroAttivitaColtura(coltura) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const { getCollectionData } = await import('./firebase-service.js');
    
    const attivita = await getCollectionData('attivita', {
      tenantId,
      where: [['coltura', '==', coltura]]
    });
    
    return attivita.length;
  } catch (error) {
    console.error('Errore verifica uso coltura:', error);
    return 0;
  }
}

/**
 * Ottiene array di nomi tipi lavoro sincronizzato con tipiLavoro
 * Funzione di utilità per retrocompatibilità
 * @returns {Promise<Array<string>>} Array di nomi tipi lavoro
 */
export async function getTipiLavoroNomi() {
  try {
    // Prova a leggere da tipiLavoro (fonte unica di verità)
    const { getAllTipiLavoro } = await import('./tipi-lavoro-service.js');
    const tipiLavoro = await getAllTipiLavoro({ orderBy: 'nome', orderDirection: 'asc' });
    
    if (tipiLavoro && tipiLavoro.length > 0) {
      return tipiLavoro.map(t => t.nome);
    }
  } catch (error) {
    console.warn('Impossibile leggere da tipiLavoro, uso ListePersonalizzate:', error.message);
  }
  
  // Fallback: usa ListePersonalizzate
  const liste = await getListe();
  return liste.tipiLavoro || [];
}

/**
 * Migra tipi lavoro da ListePersonalizzate a tipiLavoro
 * Funzione di migrazione una tantum
 * @param {string} createdBy - ID utente che esegue la migrazione
 * @returns {Promise<Object>} { success: boolean, migrati: number, error: string|null }
 */
export async function migraTipiLavoroDaListePersonalizzate(createdBy = 'system') {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const { getAllTipiLavoro, createTipoLavoro, migraListaPiatta } = await import('./tipi-lavoro-service.js');
    
    // Verifica se ci sono già tipi lavoro in tipiLavoro
    const tipiEsistenti = await getAllTipiLavoro();
    
    if (tipiEsistenti.length > 0) {
      // Già migrato, sincronizza ListePersonalizzate
      await syncListeFromTipiLavoro();
      return { success: true, migrati: 0, error: null, message: 'Migrazione già completata' };
    }
    
    // Leggi da ListePersonalizzate
    const liste = await getListe();
    const tipiLavoroDaMigrare = liste.tipiLavoro || [];
    
    if (tipiLavoroDaMigrare.length === 0) {
      return { success: true, migrati: 0, error: null, message: 'Nessun tipo lavoro da migrare' };
    }
    
    // Usa funzione di migrazione esistente
    const tipiCreati = await migraListaPiatta(tipiLavoroDaMigrare, createdBy);
    
    // Sincronizza ListePersonalizzate
    await syncListeFromTipiLavoro();
    
    return { 
      success: true, 
      migrati: tipiCreati.length, 
      error: null,
      message: `Migrati ${tipiCreati.length} tipi lavoro`
    };
  } catch (error) {
    console.error('Errore migrazione tipi lavoro:', error);
    return { success: false, migrati: 0, error: error.message };
  }
}

// Export default
export default {
  getListe,
  addTipoLavoro,
  removeTipoLavoro,
  addColtura,
  removeColtura,
  isPredefinitoTipoLavoro,
  isPredefinitaColtura,
  getNumeroAttivitaTipoLavoro,
  getNumeroAttivitaColtura,
  getTipiLavoroNomi,
  migraTipiLavoroDaListePersonalizzate,
  syncListeFromColture
};

/**
 * Ottiene array di nomi colture sincronizzato con colture
 * Funzione di utilità per retrocompatibilità
 * @returns {Promise<Array<string>>} Array di nomi colture
 */
export async function getColtureNomi() {
  try {
    // Prova a leggere da colture (fonte unica di verità)
    const { getAllColture } = await import('./colture-service.js');
    const colture = await getAllColture({ orderBy: 'nome', orderDirection: 'asc' });
    
    if (colture && colture.length > 0) {
      return colture.map(c => c.nome);
    }
  } catch (error) {
    console.warn('Impossibile leggere da colture, uso ListePersonalizzate:', error.message);
  }
  
  // Fallback: usa ListePersonalizzate
  const liste = await getListe();
  return liste.colture || [];
}

/**
 * Migra colture da ListePersonalizzate a colture (struttura gerarchica)
 * Funzione di migrazione una tantum
 * Richiede che le categorie siano già inizializzate
 * @param {string} createdBy - ID utente che esegue la migrazione
 * @returns {Promise<Object>} { success: boolean, migrati: number, error: string|null }
 */
export async function migraColtureDaListePersonalizzate(createdBy = 'system') {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    // Assicura che categorie siano inizializzate
    const { initializeCategoriePredefinite } = await import('./categorie-service.js');
    await initializeCategoriePredefinite();
    
    const { getAllColture, migraListaPiatta } = await import('./colture-service.js');
    
    // Verifica se ci sono già colture in collection colture
    const coltureEsistenti = await getAllColture();
    
    if (coltureEsistenti.length > 0) {
      // Già migrato, sincronizza ListePersonalizzate
      await syncListeFromColture();
      return { success: true, migrati: 0, error: null, message: 'Migrazione già completata' };
    }
    
    // Leggi da ListePersonalizzate
    const liste = await getListe();
    const coltureDaMigrare = liste.colture || [];
    
    if (coltureDaMigrare.length === 0) {
      return { success: true, migrati: 0, error: null, message: 'Nessuna coltura da migrare' };
    }
    
    // Usa funzione di migrazione esistente (gestisce struttura gerarchica)
    const coltureCreate = await migraListaPiatta(coltureDaMigrare, createdBy);
    
    // Sincronizza ListePersonalizzate
    await syncListeFromColture();
    
    return { 
      success: true, 
      migrati: coltureCreate.length, 
      error: null,
      message: `Migrate ${coltureCreate.length} colture`
    };
  } catch (error) {
    console.error('Errore migrazione colture:', error);
    return { success: false, migrati: 0, error: error.message };
  }
}






