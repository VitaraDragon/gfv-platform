/**
 * Terreni Service - Servizio per gestione terreni
 * Gestisce CRUD terreni con supporto multi-tenant
 * 
 * @module core/services/terreni-service
 */

import { 
  createDocument, 
  getDocumentData, 
  updateDocument,
  deleteDocument,
  getCollectionData 
} from './firebase-service.js';
import { getCurrentTenantId, getCurrentUser } from './tenant-service.js';
import { Terreno } from '../models/Terreno.js';
import { assertCanCreateTerreno } from './plan-limits-service.js';
import { contaPianoStagione, MOTIVI_ARCHIVIAZIONE } from '../../shared/js/terreno-archivio.js';
import { isLavoroChiuso } from '../../shared/js/storico-sola-lettura.js';

const COLLECTION_NAME = 'terreni';

/**
 * Ottieni tutti i terreni del tenant corrente
 * @param {Object} options - Opzioni di query
 * @param {string} options.orderBy - Campo per ordinamento (default: 'nome')
 * @param {string} options.orderDirection - Direzione ordinamento ('asc' | 'desc')
 * @param {string} options.clienteId - Filtra per cliente (opzionale, per conto terzi)
 * @param {boolean} [options.includiArchiviati=false] - Lo storico dei nomi passa true. Mai where('stato').
 * @returns {Promise<Array<Terreno>>} Array di terreni
 */
export async function getAllTerreni(options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const { 
      orderBy = 'nome', 
      orderDirection = 'asc',
      clienteId = null,
      /** Se true, non esclude i terreni con clienteId (CT / piano stagione VM). */
      includeTerreniClienti = false,
      includiArchiviati = false
    } = options;
    
    // Dobbiamo sempre filtrare lato client:
    // - Se clienteId è null: escludiamo terreni clienti (solo aziendali)
    // - Se clienteId è specificato: filtriamo per quel cliente
    // Questo evita problemi con indice composito Firestore
    const whereFilters = [];
    const useClientSideFilter = true; // Sempre filtra lato client per gestire clienteId
    
    // Carica tutti i terreni (senza filtro se dobbiamo filtrare lato client)
    const documents = await getCollectionData(COLLECTION_NAME, {
      tenantId,
      orderBy: useClientSideFilter ? undefined : orderBy, // Non ordinare se filtriamo lato client
      orderDirection: useClientSideFilter ? undefined : orderDirection,
      where: useClientSideFilter ? undefined : (whereFilters.length > 0 ? whereFilters : undefined)
    });
    
    // Crea oggetti Terreno preservando i dati originali
    let terreni = documents.map(doc => {
      const terreno = Terreno.fromData(doc);
      // Salva dati originali per accesso nel converter
      terreno._originalData = doc;
      return terreno;
    });
    
    // Filtra terreni:
    // - clienteId valorizzato → solo quel cliente
    // - includeTerreniClienti → tutti (terreni azienda + clienti)
    // - default → solo terreni aziendali (senza clienteId)
    if (clienteId) {
      terreni = terreni.filter(t => t.clienteId === clienteId);
    } else if (!includeTerreniClienti) {
      terreni = terreni.filter(t => !t.clienteId || t.clienteId === '');
    }

    // Lato client: un documento senza stato resta attivo e resta in elenco.
    if (!includiArchiviati) {
      terreni = terreni.filter(t => t.stato !== 'archiviato');
    }
    
    // Ordina lato client se necessario (sempre quando filtriamo lato client)
    if (useClientSideFilter && orderBy) {
      terreni.sort((a, b) => {
        const aVal = a[orderBy] || '';
        const bVal = b[orderBy] || '';
        const comparison = String(aVal).localeCompare(String(bVal));
        return orderDirection === 'desc' ? -comparison : comparison;
      });
    }
    
    return terreni;
  } catch (error) {
    // Errori critici (validazione, autenticazione) -> lancia eccezione
    if (error.message.includes('tenant') || error.message.includes('obbligatorio')) {
      console.error('Errore recupero terreni:', error);
      throw new Error(`Errore recupero terreni: ${error.message}`);
    }
    // Errori non critici (database, rete) -> ritorna array vuoto
    console.error('Errore recupero terreni:', error);
    return [];
  }
}

/**
 * Ottieni un terreno per ID
 * @param {string} terrenoId - ID terreno
 * @returns {Promise<Terreno|null>} Terreno o null se non trovato
 */
export async function getTerreno(terrenoId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!terrenoId) {
      throw new Error('ID terreno obbligatorio');
    }
    
    const data = await getDocumentData(COLLECTION_NAME, terrenoId, tenantId);
    
    if (!data) {
      return null;
    }
    
    return Terreno.fromData(data);
  } catch (error) {
    console.error('Errore recupero terreno:', error);
    throw new Error(`Errore recupero terreno: ${error.message}`);
  }
}

/**
 * Crea un nuovo terreno
 * @param {Object} terrenoData - Dati terreno
 * @param {string} terrenoData.nome - Nome terreno (obbligatorio)
 * @param {number} terrenoData.superficie - Superficie in ettari (opzionale)
 * @param {Object} terrenoData.coordinate - Coordinate punto centrale {lat, lng} (opzionale)
 * @param {Array} terrenoData.polygonCoords - Coordinate poligono mappa (opzionale)
 * @param {string} terrenoData.note - Note opzionali
 * @returns {Promise<string>} ID terreno creato
 */
export async function createTerreno(terrenoData) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const terreno = new Terreno(terrenoData);
    
    // Valida
    const validation = terreno.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }

    const limitCheck = await assertCanCreateTerreno(tenantId);
    if (!limitCheck.ok) {
      throw new Error(limitCheck.message);
    }
    
    // Salva
    const terrenoId = await createDocument(COLLECTION_NAME, terreno.toFirestore(), tenantId);
    
    return terrenoId;
  } catch (error) {
    console.error('Errore creazione terreno:', error);
    throw new Error(`Errore creazione terreno: ${error.message}`);
  }
}

/**
 * Aggiorna un terreno esistente
 * @param {string} terrenoId - ID terreno
 * @param {Object} updates - Dati da aggiornare
 * @returns {Promise<void>}
 */
export async function updateTerreno(terrenoId, updates) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!terrenoId) {
      throw new Error('ID terreno obbligatorio');
    }
    
    // Carica terreno esistente
    const terrenoEsistente = await getTerreno(terrenoId);
    if (!terrenoEsistente) {
      throw new Error('Terreno non trovato');
    }
    
    // Aggiorna con nuovi dati
    terrenoEsistente.update(updates);
    
    // Valida
    const validation = terrenoEsistente.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Salva
    await updateDocument(COLLECTION_NAME, terrenoId, terrenoEsistente.toFirestore(), tenantId);
  } catch (error) {
    console.error('Errore aggiornamento terreno:', error);
    throw new Error(`Errore aggiornamento terreno: ${error.message}`);
  }
}

/**
 * Elimina un terreno
 * @param {string} terrenoId - ID terreno
 * @param {Object} options - Opzioni eliminazione
 * @param {boolean} options.force - Se true, elimina anche se usato in attività (default: false)
 * @returns {Promise<void>}
 * @throws {Error} Se terreno è usato in attività e force=false
 */
export async function deleteTerreno(terrenoId, options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!terrenoId) {
      throw new Error('ID terreno obbligatorio');
    }
    
    // Verifica se terreno è usato in attività
    const numAttivita = await getNumeroAttivitaTerreno(terrenoId);
    
    if (numAttivita > 0 && !options.force) {
      throw new Error(
        `Impossibile eliminare: il terreno è utilizzato in ${numAttivita} attività. ` +
        `Elimina prima le attività o usa l'opzione force=true per eliminare comunque.`
      );
    }
    
    await deleteDocument(COLLECTION_NAME, terrenoId, tenantId);
  } catch (error) {
    console.error('Errore eliminazione terreno:', error);
    throw error; // Rilancia l'errore così la UI può gestirlo
  }
}

/**
 * Verifica se un terreno è usato in attività
 * @param {string} terrenoId - ID terreno
 * @returns {Promise<number>} Numero di attività che usano questo terreno
 */
export async function getNumeroAttivitaTerreno(terrenoId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    // Import dinamico per evitare dipendenze circolari
    const { getCollectionData } = await import('./firebase-service.js');
    
    const attivita = await getCollectionData('attivita', {
      tenantId,
      where: [['terrenoId', '==', terrenoId]]
    });
    
    return attivita.length;
  } catch (error) {
    console.error('Errore verifica uso terreno:', error);
    throw error;
  }
}

const COLLEZIONI_COLLEGATE = [
  ['attivita', 'attivita'],
  ['lavori', 'lavori'],
  ['vigneti', 'vigneti'],
  ['frutteti', 'frutteti'],
  ['seminativi', 'campagne'],
  ['preventivi', 'preventivi']
];

function riepilogoLavoroAperto(doc) {
  return {
    id: doc.id,
    nome: doc.nome || doc.tipoLavoro || 'Lavoro senza nome',
    dataInizio: doc.dataInizio || doc.createdAt || null,
    stato: doc.stato || null
  };
}

/**
 * Conta i collegamenti di un terreno. Se una query fallisce, l'errore sale:
 * non si restituisce mai 0 al posto di un guasto.
 * @param {string} terrenoId
 */
export async function getCollegamentiTerreno(terrenoId) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    throw new Error('Nessun tenant corrente disponibile');
  }
  if (!terrenoId) {
    throw new Error('ID terreno obbligatorio');
  }

  const collegamenti = {
    attivita: 0,
    lavori: 0,
    vigneti: 0,
    frutteti: 0,
    campagne: 0,
    preventivi: 0,
    pianoStagione: 0,
    lavoriAperti: []
  };

  for (const [collectionName, chiave] of COLLEZIONI_COLLEGATE) {
    const conteggioEsatto = chiave === 'lavori';
    const documenti = await getCollectionData(collectionName, {
      tenantId,
      where: [['terrenoId', '==', terrenoId]],
      limit: conteggioEsatto ? undefined : 1
    });
    if (conteggioEsatto) {
      collegamenti[chiave] = documenti.length;
    } else {
      collegamenti[chiave] = 0;
      collegamenti[`${chiave}Presenti`] = documenti.length > 0;
    }
    if (chiave === 'lavori') {
      collegamenti.lavoriAperti = documenti
        .filter((doc) => !isLavoroChiuso(doc))
        .map(riepilogoLavoroAperto);
    }
  }

  const terreno = await getDocumentData(COLLECTION_NAME, terrenoId, tenantId);
  if (!terreno) {
    throw new Error('Terreno non trovato');
  }
  collegamenti.pianoStagione = contaPianoStagione(terreno.vendemmiaMeccanica);
  return collegamenti;
}

async function chiudiImpiantiAttivi(collectionName, terrenoId, tenantId, quando) {
  const documenti = await getCollectionData(collectionName, {
    tenantId,
    where: [['terrenoId', '==', terrenoId]]
  });
  const chiusi = [];
  for (const doc of documenti) {
    if (doc.statoImpianto === 'chiuso') continue;
    await updateDocument(collectionName, doc.id, {
      statoImpianto: 'chiuso',
      dataChiusura: quando,
      motivoChiusura: 'terreno_archiviato'
    }, tenantId);
    chiusi.push({ id: doc.id, nome: doc.varieta || doc.nome || doc.specie || collectionName });
  }
  return chiusi;
}

/**
 * Archivia il terreno (soft delete) e chiude vigneti e frutteti ancora aperti.
 * @param {string} terrenoId
 * @param {{ motivo?: string, nota?: string, archiviatoDa?: string }} [meta]
 */
export async function archiviaTerreno(terrenoId, meta = {}) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
  if (!terrenoId) throw new Error('ID terreno obbligatorio');
  const motivo = meta.motivo || 'altro';
  if (!MOTIVI_ARCHIVIAZIONE.includes(motivo)) {
    throw new Error('Motivo archiviazione non valido');
  }
  const quando = new Date().toISOString();
  const utente = getCurrentUser();
  await updateDocument(COLLECTION_NAME, terrenoId, {
    stato: 'archiviato',
    archiviatoIl: quando,
    archiviatoDa: meta.archiviatoDa || (utente && (utente.uid || utente.id)) || null,
    motivoArchiviazione: motivo,
    notaArchiviazione: meta.nota || null
  }, tenantId);
  const vignetiChiusi = await chiudiImpiantiAttivi('vigneti', terrenoId, tenantId, quando);
  const fruttetiChiusi = await chiudiImpiantiAttivi('frutteti', terrenoId, tenantId, quando);
  return { vignetiChiusi, fruttetiChiusi };
}

/**
 * Riporta il terreno negli elenchi. I vigneti chiusi con l'archiviazione restano chiusi.
 * @param {string} terrenoId
 */
export async function ripristinaTerreno(terrenoId) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
  if (!terrenoId) throw new Error('ID terreno obbligatorio');
  const limitCheck = await assertCanCreateTerreno(tenantId);
  if (!limitCheck.ok) {
    const err = new Error(limitCheck.message);
    err.limitePiano = true;
    throw err;
  }
  await updateDocument(COLLECTION_NAME, terrenoId, {
    stato: 'attivo',
    archiviatoIl: null,
    archiviatoDa: null,
    motivoArchiviazione: null,
    notaArchiviazione: null
  }, tenantId);
}

// Export default
export default {
  getAllTerreni,
  getTerreno,
  createTerreno,
  updateTerreno,
  deleteTerreno,
  getNumeroAttivitaTerreno,
  getCollegamentiTerreno,
  archiviaTerreno,
  ripristinaTerreno
};

