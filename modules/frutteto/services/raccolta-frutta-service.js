/**
 * Raccolta Frutta Service - Servizio per gestione raccolte frutta
 * Gestisce CRUD raccolte con calcolo costi e aggiornamento rese frutteto
 * 
 * @module modules/frutteto/services/raccolta-frutta-service
 */

import { 
  getCollectionData,
  createDocument,
  getDocumentData,
  updateDocument,
  deleteDocument,
  dateToTimestamp,
  timestampToDate
} from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { RaccoltaFrutta } from '../models/RaccoltaFrutta.js';
import { getFrutteto, updateFrutteto } from './frutteti-service.js';

const SUB_COLLECTION_NAME = 'raccolte';

/**
 * Ottieni path sub-collection raccolte per un frutteto
 * @param {string} fruttetoId - ID frutteto
 * @returns {string} Path sub-collection
 */
function getRaccoltePath(fruttetoId) {
  return `frutteti/${fruttetoId}/${SUB_COLLECTION_NAME}`;
}

/**
 * Ottieni tutte le raccolte di un frutteto
 * @param {string} fruttetoId - ID frutteto
 * @param {Object} options - Opzioni di query
 * @param {string} options.orderBy - Campo per ordinamento (default: 'data')
 * @param {string} options.orderDirection - Direzione ordinamento ('asc' | 'desc', default: 'desc')
 * @param {number} options.anno - Filtra per anno (opzionale)
 * @returns {Promise<Array<RaccoltaFrutta>>} Array di raccolte
 */
export async function getRaccolte(fruttetoId, options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!fruttetoId) {
      throw new Error('ID frutteto obbligatorio');
    }
    
    const { 
      orderBy = 'data', 
      orderDirection = 'desc',
      anno = null
    } = options;
    
    const collectionPath = getRaccoltePath(fruttetoId);
    
    const whereFilters = [];
    
    if (anno) {
      const inizioAnno = new Date(anno, 0, 1);
      const fineAnno = new Date(anno + 1, 0, 1);
      whereFilters.push(['data', '>=', dateToTimestamp(inizioAnno)]);
      whereFilters.push(['data', '<', dateToTimestamp(fineAnno)]);
    }
    
    const documents = await getCollectionData(collectionPath, {
      tenantId,
      orderBy,
      orderDirection,
      where: whereFilters.length > 0 ? whereFilters : undefined
    });
    
    const raccolte = documents.map(doc => RaccoltaFrutta.fromData(doc));
    
    return raccolte;
  } catch (error) {
    console.error('[RACCOLTA-FRUTTA-SERVICE] Errore recupero raccolte:', error);
    if (error.message.includes('tenant') || error.message.includes('obbligatorio')) {
      throw new Error(`Errore recupero raccolte: ${error.message}`);
    }
    return [];
  }
}

/**
 * Ottieni una raccolta per ID
 * @param {string} fruttetoId - ID frutteto
 * @param {string} raccoltaId - ID raccolta
 * @returns {Promise<RaccoltaFrutta|null>} Raccolta o null se non trovata
 */
export async function getRaccolta(fruttetoId, raccoltaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!fruttetoId || !raccoltaId) {
      throw new Error('ID frutteto e raccolta obbligatori');
    }
    
    const collectionPath = getRaccoltePath(fruttetoId);
    const data = await getDocumentData(collectionPath, raccoltaId, tenantId);
    
    if (!data) {
      return null;
    }
    
    return RaccoltaFrutta.fromData(data);
  } catch (error) {
    console.error('Errore recupero raccolta:', error);
    throw new Error(`Errore recupero raccolta: ${error.message}`);
  }
}

/**
 * Crea una nuova raccolta frutta
 * @param {string} fruttetoId - ID frutteto
 * @param {Object} raccoltaData - Dati raccolta
 * @returns {Promise<string>} ID raccolta creata
 */
export async function createRaccolta(fruttetoId, raccoltaData) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!fruttetoId) {
      throw new Error('ID frutteto obbligatorio');
    }
    
    // Crea modello e valida
    const raccolta = new RaccoltaFrutta({
      ...raccoltaData,
      fruttetoId
    });
    const validation = raccolta.validate();
    
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Aggiorna calcoli
    raccolta.aggiornaCalcoli();
    
    // Salva su Firestore
    const collectionPath = getRaccoltePath(fruttetoId);
    const raccoltaId = await createDocument(collectionPath, raccolta.toFirestore(), tenantId);
    
    // Aggiorna dati frutteto (produzione totale, resa media, data ultima raccolta)
    await aggiornaDatiFruttetoDaRaccolta(fruttetoId, raccolta);

    // Aggiorna statistiche aggregate in background
    let anno = new Date().getFullYear();
    if (raccolta.data) {
      if (raccolta.data instanceof Date) anno = raccolta.data.getFullYear();
      else if (raccolta.data.toDate) anno = raccolta.data.toDate().getFullYear();
      else anno = new Date(raccolta.data).getFullYear();
    }
    import('./frutteto-statistiche-aggregate-service.js').then(({ calcolaEAggiornaStatistiche }) => {
      calcolaEAggiornaStatistiche(fruttetoId, anno).catch(err => {
        console.warn('[RACCOLTA-FRUTTA] Errore aggiornamento statistiche aggregate (non critico):', err);
      });
    });

    return raccoltaId;
  } catch (error) {
    console.error('Errore creazione raccolta:', error);
    throw new Error(`Errore creazione raccolta: ${error.message}`);
  }
}

/**
 * Aggiorna una raccolta esistente
 * @param {string} fruttetoId - ID frutteto
 * @param {string} raccoltaId - ID raccolta
 * @param {Object} updates - Dati da aggiornare
 * @returns {Promise<void>}
 */
export async function updateRaccolta(fruttetoId, raccoltaId, updates) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!fruttetoId || !raccoltaId) {
      throw new Error('ID frutteto e raccolta obbligatori');
    }
    
    // Recupera raccolta esistente
    const raccoltaEsistente = await getRaccolta(fruttetoId, raccoltaId);
    if (!raccoltaEsistente) {
      throw new Error('Raccolta non trovata');
    }
    
    // Applica aggiornamenti
    raccoltaEsistente.update(updates);
    
    // Valida
    const validation = raccoltaEsistente.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Aggiorna calcoli
    raccoltaEsistente.aggiornaCalcoli();
    
    // Salva su Firestore
    const collectionPath = getRaccoltePath(fruttetoId);
    await updateDocument(collectionPath, raccoltaId, raccoltaEsistente.toFirestore(), tenantId);

    // Aggiorna dati frutteto
    await aggiornaDatiFruttetoDaRaccolta(fruttetoId, raccoltaEsistente);

    const anno = raccoltaEsistente.data instanceof Date ? raccoltaEsistente.data.getFullYear() : new Date().getFullYear();
    import('./frutteto-statistiche-aggregate-service.js').then(({ calcolaEAggiornaStatistiche }) => {
      calcolaEAggiornaStatistiche(fruttetoId, anno).catch(err => {
        console.warn('[RACCOLTA-FRUTTA] Errore aggiornamento statistiche aggregate (non critico):', err);
      });
    });
  } catch (error) {
    console.error('Errore aggiornamento raccolta:', error);
    throw new Error(`Errore aggiornamento raccolta: ${error.message}`);
  }
}

/**
 * Elimina una raccolta
 * @param {string} fruttetoId - ID frutteto
 * @param {string} raccoltaId - ID raccolta
 * @returns {Promise<void>}
 */
export async function deleteRaccolta(fruttetoId, raccoltaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!fruttetoId || !raccoltaId) {
      throw new Error('ID frutteto e raccolta obbligatori');
    }
    
    const collectionPath = getRaccoltePath(fruttetoId);
    await deleteDocument(collectionPath, raccoltaId, tenantId);

    // Ricalcola dati frutteto dopo eliminazione
    await ricalcolaDatiFrutteto(fruttetoId);

    const anno = new Date().getFullYear();
    import('./frutteto-statistiche-aggregate-service.js').then(({ calcolaEAggiornaStatistiche }) => {
      calcolaEAggiornaStatistiche(fruttetoId, anno).catch(err => {
        console.warn('[RACCOLTA-FRUTTA] Errore aggiornamento statistiche aggregate (non critico):', err);
      });
    });
  } catch (error) {
    console.error('Errore eliminazione raccolta:', error);
    throw new Error(`Errore eliminazione raccolta: ${error.message}`);
  }
}

/**
 * Aggiorna dati frutteto basandosi sulle raccolte
 * @param {string} fruttetoId - ID frutteto
 * @param {RaccoltaFrutta} raccolta - Raccolta da considerare (opzionale, se null ricalcola da tutte)
 * @private
 */
async function aggiornaDatiFruttetoDaRaccolta(fruttetoId, raccolta = null) {
  try {
    const frutteto = await getFrutteto(fruttetoId);
    if (!frutteto) {
      return;
    }
    
    // Ottieni tutte le raccolte dell'anno corrente
    const annoCorrente = new Date().getFullYear();
    const raccolteAnno = await getRaccolte(fruttetoId, { anno: annoCorrente });
    
    // Calcola produzione totale anno
    const produzioneTotaleAnno = raccolteAnno.reduce((totale, r) => totale + (r.quantitaKg || 0), 0);
    
    // Calcola resa media (kg/ha) se ci sono raccolte
    let resaMediaKgHa = null;
    if (raccolteAnno.length > 0 && frutteto.superficieEttari > 0) {
      const resaTotale = raccolteAnno.reduce((totale, r) => totale + (r.resaKgHa || 0), 0);
      resaMediaKgHa = resaTotale / raccolteAnno.length;
    }
    
    // Trova data ultima raccolta
    let dataUltimaRaccolta = null;
    if (raccolteAnno.length > 0) {
      const raccolteOrdinate = [...raccolteAnno].sort((a, b) => {
        const dataA = a.data instanceof Date ? a.data : timestampToDate(a.data);
        const dataB = b.data instanceof Date ? b.data : timestampToDate(b.data);
        return dataB - dataA;
      });
      dataUltimaRaccolta = raccolteOrdinate[0].data;
    }
    
    // Aggiorna frutteto
    await updateFrutteto(fruttetoId, {
      produzioneTotaleAnno,
      resaMediaKgHa,
      dataUltimaRaccolta
    });
  } catch (error) {
    console.error('Errore aggiornamento dati frutteto da raccolta:', error);
    // Non bloccare il flusso se l'aggiornamento fallisce
  }
}

/**
 * Ricalcola tutti i dati frutteto dalle raccolte
 * @param {string} fruttetoId - ID frutteto
 * @private
 */
async function ricalcolaDatiFrutteto(fruttetoId) {
  await aggiornaDatiFruttetoDaRaccolta(fruttetoId, null);
}

/**
 * Crea una raccolta frutta automaticamente da un lavoro.
 * Chiamata quando si crea un lavoro di tipo "Raccolta" (o simile) su un terreno con coltura frutteto.
 * @param {string} lavoroId - ID lavoro
 * @returns {Promise<{raccoltaId: string, fruttetoId: string}|null>} { raccoltaId, fruttetoId } per aprire il modal in Gestione Raccolta, o null
 */
export async function createRaccoltaFromLavoro(lavoroId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) return null;

    const { getLavoro } = await import('../../../core/services/lavori-service.js');
    const lavoro = await getLavoro(lavoroId);
    if (!lavoro) return null;

    const tipoLavoro = (lavoro.tipoLavoro || '').toLowerCase();
    if (!tipoLavoro.includes('raccolta')) return null;

    const { getTerreno } = await import('../../../core/services/terreni-service.js');
    const terreno = await getTerreno(lavoro.terrenoId);
    if (!terreno) return null;

    const { mapColturaToCategoria } = await import('../../../core/js/attivita-utils.js');
    if (mapColturaToCategoria(terreno.coltura || '') !== 'Frutteto') return null;

    const { getFruttetiByTerreno } = await import('./frutteti-service.js');
    const frutteti = await getFruttetiByTerreno(terreno.id);
    if (!frutteti || frutteti.length === 0) return null;

    // Preferisci frutteto con specie uguale alla coltura del terreno, altrimenti il primo
    const colturaLower = (terreno.coltura || '').toLowerCase();
    const frutteto = frutteti.find(f => (f.specie || '').toLowerCase() === colturaLower) || frutteti[0];

    const raccolteEsistenti = await getRaccolte(frutteto.id);
    const esistente = raccolteEsistenti.find(r => r.lavoroId === lavoroId);
    if (esistente) return { raccoltaId: esistente.id, fruttetoId: frutteto.id };

    const dataRaccolta = lavoro.dataInizio instanceof Date
      ? lavoro.dataInizio
      : (lavoro.dataInizio?.toDate ? lavoro.dataInizio.toDate() : new Date());

    const raccoltaData = {
      fruttetoId: frutteto.id,
      lavoroId: lavoroId,
      data: dataRaccolta,
      specie: frutteto.specie || terreno.coltura || '',
      varieta: frutteto.varieta || '',
      quantitaKg: null,
      quantitaEttari: null,
      operai: [],
      macchine: [],
      oreImpiegate: lavoro.durataPrevista ? lavoro.durataPrevista * 8 : null,
      note: `Raccolta creata automaticamente dal lavoro: ${lavoro.nome || lavoroId}`
    };

    const raccoltaId = await createRaccolta(frutteto.id, raccoltaData);
    return { raccoltaId, fruttetoId: frutteto.id };
  } catch (error) {
    console.error('[RACCOLTA-FRUTTA-SERVICE] Errore creazione raccolta da lavoro:', error);
    return null;
  }
}

/**
 * Crea una raccolta frutta automaticamente da un'attività (senza lavoro collegato).
 * Chiamata quando si crea un'attività di tipo "Raccolta" su un terreno con coltura frutteto dal diario.
 * @param {string} attivitaId - ID attività
 * @returns {Promise<{raccoltaId: string, fruttetoId: string}|null>} { raccoltaId, fruttetoId } per aprire il modal in Gestione Raccolta, o null
 */
export async function createRaccoltaFromAttivita(attivitaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) return null;

    const { getAttivita } = await import('../../../core/services/attivita-service.js');
    const attivita = await getAttivita(attivitaId);
    if (!attivita) return null;

    const tipoLavoro = (attivita.tipoLavoro || '').toLowerCase();
    if (!tipoLavoro.includes('raccolta')) return null;

    const { getTerreno } = await import('../../../core/services/terreni-service.js');
    const terreno = await getTerreno(attivita.terrenoId);
    if (!terreno) return null;

    const { mapColturaToCategoria } = await import('../../../core/js/attivita-utils.js');
    if (mapColturaToCategoria(terreno.coltura || '') !== 'Frutteto') return null;

    const { getFruttetiByTerreno } = await import('./frutteti-service.js');
    const frutteti = await getFruttetiByTerreno(terreno.id);
    if (!frutteti || frutteti.length === 0) return null;

    const colturaLower = (terreno.coltura || '').toLowerCase();
    const frutteto = frutteti.find(f => (f.specie || '').toLowerCase() === colturaLower) || frutteti[0];

    const raccolteEsistenti = await getRaccolte(frutteto.id);
    const esistente = raccolteEsistenti.find(r => {
      if (r.attivitaId === attivitaId) return true;
      const dataR = r.data instanceof Date ? r.data : (r.data?.toDate ? r.data.toDate() : null);
      const dataA = attivita.data instanceof Date ? attivita.data : (attivita.data ? new Date(attivita.data) : null);
      if (dataR && dataA && dataR.getTime() === dataA.getTime() && !r.lavoroId) return true;
      return false;
    });
    if (esistente) {
      if (!esistente.attivitaId) {
        await updateRaccolta(frutteto.id, esistente.id, { attivitaId });
      }
      return { raccoltaId: esistente.id, fruttetoId: frutteto.id };
    }

    const dataRaccolta = attivita.data instanceof Date
      ? attivita.data
      : (attivita.data ? new Date(attivita.data) : new Date());

    const raccoltaData = {
      fruttetoId: frutteto.id,
      attivitaId: attivitaId,
      data: dataRaccolta,
      specie: frutteto.specie || terreno.coltura || '',
      varieta: frutteto.varieta || '',
      quantitaKg: null,
      quantitaEttari: null,
      operai: [],
      macchine: [],
      oreImpiegate: attivita.oreNette || null,
      note: `Raccolta creata automaticamente dall'attività diario`
    };

    const raccoltaId = await createRaccolta(frutteto.id, raccoltaData);
    return { raccoltaId, fruttetoId: frutteto.id };
  } catch (error) {
    console.error('[RACCOLTA-FRUTTA-SERVICE] Errore creazione raccolta da attività:', error);
    return null;
  }
}
