/**
 * Vendemmia Service - Servizio per gestione vendemmie
 * Gestisce CRUD vendemmie con calcolo compensi e aggiornamento rese vigneto
 * 
 * @module modules/vigneto/services/vendemmia-service
 */

import { 
  getDb,
  getCollection,
  getDocument,
  createDocument,
  getDocumentData,
  updateDocument,
  deleteDocument,
  getCollectionData,
  dateToTimestamp,
  timestampToDate
} from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { Vendemmia } from '../models/Vendemmia.js';
import { getVigneto, updateVigneto } from './vigneti-service.js';
import { getTariffaOperaio } from '../../../core/services/calcolo-compensi-service.js';

const SUB_COLLECTION_NAME = 'vendemmie';

/**
 * Ottieni path sub-collection vendemmie per un vigneto
 * @param {string} vignetoId - ID vigneto
 * @returns {string} Path sub-collection (senza tenant, sarà aggiunto da getCollection)
 */
function getVendemmiePath(vignetoId) {
  return `vigneti/${vignetoId}/${SUB_COLLECTION_NAME}`;
}

/**
 * Ottieni tutte le vendemmie di un vigneto
 * @param {string} vignetoId - ID vigneto
 * @param {Object} options - Opzioni di query
 * @param {string} options.orderBy - Campo per ordinamento (default: 'data')
 * @param {string} options.orderDirection - Direzione ordinamento ('asc' | 'desc', default: 'desc')
 * @param {number} options.anno - Filtra per anno (opzionale)
 * @returns {Promise<Array<Vendemmia>>} Array di vendemmie
 */
export async function getVendemmie(vignetoId, options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!vignetoId) {
      throw new Error('ID vigneto obbligatorio');
    }
    
    const { 
      orderBy = 'data', 
      orderDirection = 'desc',
      anno = null
    } = options;
    
    const collectionPath = getVendemmiePath(vignetoId);
    
    const whereFilters = [];
    
    if (anno) {
      // Filtra per anno (data >= inizio anno e < inizio anno successivo)
      const inizioAnno = new Date(anno, 0, 1);
      const fineAnno = new Date(anno + 1, 0, 1);
      whereFilters.push(['data', '>=', dateToTimestamp(inizioAnno)]);
      whereFilters.push(['data', '<', dateToTimestamp(fineAnno)]);
    }
    
    // Usa getCollectionData con path sub-collection
    const documents = await getCollectionData(collectionPath, {
      tenantId,
      orderBy,
      orderDirection,
      where: whereFilters.length > 0 ? whereFilters : undefined
    });
    
    const vendemmie = documents.map(doc => Vendemmia.fromData(doc));
    
    return vendemmie;
  } catch (error) {
    console.error('[VENDEMMIA-SERVICE] Errore recupero vendemmie:', error);
    console.error('[VENDEMMIA-SERVICE] Stack:', error.stack);
    // Errori critici -> lancia eccezione
    if (error.message.includes('tenant') || error.message.includes('obbligatorio')) {
      throw new Error(`Errore recupero vendemmie: ${error.message}`);
    }
    // Errori non critici -> ritorna array vuoto
    console.warn('[VENDEMMIA-SERVICE] Ritorno array vuoto per errore non critico');
    return [];
  }
}

/**
 * Ottieni una vendemmia per ID
 * @param {string} vignetoId - ID vigneto
 * @param {string} vendemmiaId - ID vendemmia
 * @returns {Promise<Vendemmia|null>} Vendemmia o null se non trovata
 */
export async function getVendemmia(vignetoId, vendemmiaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!vignetoId || !vendemmiaId) {
      throw new Error('ID vigneto e vendemmia obbligatori');
    }
    
    const collectionPath = getVendemmiePath(vignetoId);
    const data = await getDocumentData(collectionPath, vendemmiaId, tenantId);
    
    if (!data) {
      return null;
    }
    
    return Vendemmia.fromData({ ...data, id: vendemmiaId });
  } catch (error) {
    console.error('Errore recupero vendemmia:', error);
    throw new Error(`Errore recupero vendemmia: ${error.message}`);
  }
}

/**
 * Crea una nuova vendemmia
 * @param {string} vignetoId - ID vigneto
 * @param {Object} vendemmiaData - Dati vendemmia
 * @returns {Promise<string>} ID vendemmia creata
 */
export async function createVendemmia(vignetoId, vendemmiaData) {
  console.log('[VENDEMMIA-SERVICE] ========== CREATE VENDEMMIA CHIAMATA ==========');
  console.log('[VENDEMMIA-SERVICE] Parametri:', { vignetoId, vendemmiaData });
  console.log('[VENDEMMIA-SERVICE] Macchine nel vendemmiaData:', vendemmiaData.macchine);
  console.log('[VENDEMMIA-SERVICE] Operai nel vendemmiaData:', vendemmiaData.operai);
  
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!vignetoId) {
      throw new Error('ID vigneto obbligatorio');
    }
    
    // Verifica che il vigneto esista
    const vigneto = await getVigneto(vignetoId);
    if (!vigneto) {
      throw new Error('Vigneto non trovato');
    }
    
    // Eredita tipoPalo dal vigneto se non specificato
    if (!vendemmiaData.tipoPalo) {
      vendemmiaData.tipoPalo = vigneto.tipoPalo;
    }
    
    // Crea modello e valida
    console.log('[VENDEMMIA-SERVICE] Creo modello Vendemmia con dati:', { ...vendemmiaData, vignetoId });
    const vendemmia = new Vendemmia({
      ...vendemmiaData,
      vignetoId
    });
    
    console.log('[VENDEMMIA-SERVICE] Modello Vendemmia creato:', {
      id: vendemmia.id,
      macchine: vendemmia.macchine,
      operai: vendemmia.operai,
      lavoroId: vendemmia.lavoroId,
      attivitaId: vendemmia.attivitaId,
      oreImpiegate: vendemmia.oreImpiegate
    });
    
    const validation = vendemmia.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Aggiorna calcoli automatici
    vendemmia.aggiornaCalcoli();
    console.log('[VENDEMMIA-SERVICE] Calcoli automatici aggiornati:', {
      resaQliHa: vendemmia.resaQliHa,
      costoTotale: vendemmia.costoTotale
    });
    
    // Calcola compensi operai e macchine se necessario
    // Calcola sempre se ci sono operai o macchine (per assicurarsi che i costi siano aggiornati)
    const hasOperai = vendemmia.operai && vendemmia.operai.length > 0;
    const hasMacchine = vendemmia.macchine && vendemmia.macchine.length > 0;
    console.log('[VENDEMMIA-SERVICE] Verifica calcolo compensi:', { hasOperai, hasMacchine });
    
    if (hasOperai || hasMacchine) {
      console.log('[VENDEMMIA-SERVICE] Chiamo calcolaCompensiVendemmia...');
      await calcolaCompensiVendemmia(vendemmia);
      console.log('[VENDEMMIA-SERVICE] calcolaCompensiVendemmia completata:', {
        costoManodopera: vendemmia.costoManodopera,
        costoMacchine: vendemmia.costoMacchine,
        costoTotale: vendemmia.costoTotale
      });
    } else {
      console.log('[VENDEMMIA-SERVICE] Skip calcolo compensi: nessun operaio o macchina');
    }
    
    // Salva su Firestore (sub-collection)
    const collectionPath = getVendemmiePath(vignetoId);
    const vendemmiaId = await createDocument(collectionPath, vendemmia.toFirestore(), tenantId);
    
    // Aggiorna vigneto: produzione totale anno e data ultima vendemmia
    await aggiornaVignetoDaVendemmia(vignetoId, vendemmia);
    
    // Aggiorna statistiche aggregate in background (non blocca la risposta)
    const annoVendemmia = vendemmia.data instanceof Date 
      ? vendemmia.data.getFullYear()
      : (vendemmia.data?.toDate ? vendemmia.data.toDate().getFullYear() : new Date(vendemmia.data).getFullYear());
    
    import('./vigneto-statistiche-aggregate-service.js').then(({ calcolaEAggiornaStatistiche }) => {
      calcolaEAggiornaStatistiche(vignetoId, annoVendemmia).catch(err => {
        console.warn('[VENDEMMIA-SERVICE] Errore aggiornamento statistiche aggregate (non critico):', err);
      });
    });
    
    return vendemmiaId;
  } catch (error) {
    console.error('[VENDEMMIA-SERVICE] Errore creazione vendemmia:', error);
    console.error('[VENDEMMIA-SERVICE] Stack:', error.stack);
    throw new Error(`Errore creazione vendemmia: ${error.message}`);
  }
}

/**
 * Aggiorna una vendemmia esistente
 * @param {string} vignetoId - ID vigneto
 * @param {string} vendemmiaId - ID vendemmia
 * @param {Object} updates - Dati da aggiornare
 * @returns {Promise<void>}
 */
export async function updateVendemmia(vignetoId, vendemmiaId, updates) {
  console.log('[VENDEMMIA-SERVICE] ========== UPDATE VENDEMMIA CHIAMATA ==========');
  console.log('[VENDEMMIA-SERVICE] Parametri:', { vignetoId, vendemmiaId, updates });
  console.log('[VENDEMMIA-SERVICE] Macchine negli updates:', updates.macchine);
  console.log('[VENDEMMIA-SERVICE] Operai negli updates:', updates.operai);
  
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!vignetoId || !vendemmiaId) {
      throw new Error('ID vigneto e vendemmia obbligatori');
    }
    
    // Recupera vendemmia esistente
    const vendemmiaEsistente = await getVendemmia(vignetoId, vendemmiaId);
    if (!vendemmiaEsistente) {
      throw new Error('Vendemmia non trovata');
    }
    
    console.log('[VENDEMMIA-SERVICE] Vendemmia esistente prima update:', {
      macchine: vendemmiaEsistente.macchine,
      operai: vendemmiaEsistente.operai,
      lavoroId: vendemmiaEsistente.lavoroId,
      attivitaId: vendemmiaEsistente.attivitaId,
      costoManodopera: vendemmiaEsistente.costoManodopera,
      costoMacchine: vendemmiaEsistente.costoMacchine,
      costoTotale: vendemmiaEsistente.costoTotale
    });
    
    // Applica aggiornamenti
    vendemmiaEsistente.update(updates);
    
    console.log('[VENDEMMIA-SERVICE] Vendemmia dopo update:', {
      macchine: vendemmiaEsistente.macchine,
      operai: vendemmiaEsistente.operai,
      lavoroId: vendemmiaEsistente.lavoroId,
      attivitaId: vendemmiaEsistente.attivitaId
    });
    
    // Valida
    const validation = vendemmiaEsistente.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Aggiorna calcoli
    vendemmiaEsistente.aggiornaCalcoli();
    console.log('[VENDEMMIA-SERVICE] Calcoli automatici aggiornati:', {
      resaQliHa: vendemmiaEsistente.resaQliHa,
      costoTotale: vendemmiaEsistente.costoTotale
    });
    
    // Ricalcola compensi se operai o macchine sono stati modificati
    // Oppure se non c'è lavoroId (perché i dati potrebbero essere cambiati manualmente)
    const shouldRecalculate = updates.operai || updates.oreImpiegate || updates.macchine || !vendemmiaEsistente.lavoroId;
    console.log('[VENDEMMIA-SERVICE] Verifica ricalcolo compensi:', {
      hasUpdatesOperai: !!updates.operai,
      hasUpdatesOreImpiegate: !!updates.oreImpiegate,
      hasUpdatesMacchine: !!updates.macchine,
      hasLavoroId: !!vendemmiaEsistente.lavoroId,
      shouldRecalculate
    });
    
    if (shouldRecalculate) {
      console.log('[VENDEMMIA-SERVICE] Chiamo calcolaCompensiVendemmia...');
      await calcolaCompensiVendemmia(vendemmiaEsistente);
      console.log('[VENDEMMIA-SERVICE] calcolaCompensiVendemmia completata:', {
        costoManodopera: vendemmiaEsistente.costoManodopera,
        costoMacchine: vendemmiaEsistente.costoMacchine,
        costoTotale: vendemmiaEsistente.costoTotale
      });
    } else {
      console.log('[VENDEMMIA-SERVICE] Skip ricalcolo compensi');
    }
    
    // Salva su Firestore
    const collectionPath = getVendemmiePath(vignetoId);
    await updateDocument(collectionPath, vendemmiaId, vendemmiaEsistente.toFirestore(), tenantId);
    
    // Aggiorna vigneto
    await aggiornaVignetoDaVendemmia(vignetoId, vendemmiaEsistente);
    
    // Aggiorna statistiche aggregate in background
    const annoVendemmia = vendemmiaEsistente.data instanceof Date 
      ? vendemmiaEsistente.data.getFullYear()
      : (vendemmiaEsistente.data?.toDate ? vendemmiaEsistente.data.toDate().getFullYear() : new Date(vendemmiaEsistente.data).getFullYear());
    
    import('./vigneto-statistiche-aggregate-service.js').then(({ calcolaEAggiornaStatistiche }) => {
      calcolaEAggiornaStatistiche(vignetoId, annoVendemmia).catch(err => {
        console.warn('[VENDEMMIA-SERVICE] Errore aggiornamento statistiche aggregate (non critico):', err);
      });
    });
  } catch (error) {
    console.error('Errore aggiornamento vendemmia:', error);
    throw new Error(`Errore aggiornamento vendemmia: ${error.message}`);
  }
}

/**
 * Elimina una vendemmia
 * @param {string} vignetoId - ID vigneto
 * @param {string} vendemmiaId - ID vendemmia
 * @returns {Promise<void>}
 */
export async function deleteVendemmia(vignetoId, vendemmiaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!vignetoId || !vendemmiaId) {
      throw new Error('ID vigneto e vendemmia obbligatori');
    }
    
    // Recupera vendemmia prima di eliminarla per sapere l'anno
    const vendemmia = await getVendemmia(vignetoId, vendemmiaId);
    const annoVendemmia = vendemmia && vendemmia.data 
      ? (vendemmia.data instanceof Date 
          ? vendemmia.data.getFullYear()
          : (vendemmia.data?.toDate ? vendemmia.data.toDate().getFullYear() : new Date(vendemmia.data).getFullYear()))
      : new Date().getFullYear();
    
    const collectionPath = getVendemmiePath(vignetoId);
    await deleteDocument(collectionPath, vendemmiaId, tenantId);
    
    // Ricalcola produzione vigneto (rimuovendo questa vendemmia)
    await ricalcolaProduzioneVigneto(vignetoId);
    
    // Aggiorna statistiche aggregate in background
    import('./vigneto-statistiche-aggregate-service.js').then(({ calcolaEAggiornaStatistiche }) => {
      calcolaEAggiornaStatistiche(vignetoId, annoVendemmia).catch(err => {
        console.warn('[VENDEMMIA-SERVICE] Errore aggiornamento statistiche aggregate (non critico):', err);
      });
    });
  } catch (error) {
    console.error('Errore eliminazione vendemmia:', error);
    throw new Error(`Errore eliminazione vendemmia: ${error.message}`);
  }
}

/**
 * Trova vendemmia collegata a un lavoro
 * @param {string} lavoroId - ID lavoro
 * @returns {Promise<{vignetoId: string, vendemmiaId: string, vendemmia: Vendemmia}|null>} Dati vendemmia o null se non trovata
 */
export async function findVendemmiaByLavoroId(lavoroId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId || !lavoroId) {
      return null;
    }
    
    // Carica tutti i vigneti
    const { getAllVigneti } = await import('./vigneti-service.js');
    const vigneti = await getAllVigneti();
    
    // Cerca vendemmia con questo lavoroId in tutti i vigneti
    for (const vigneto of vigneti) {
      const vendemmie = await getVendemmie(vigneto.id);
      const vendemmia = vendemmie.find(v => v.lavoroId === lavoroId);
      
      if (vendemmia) {
        return {
          vignetoId: vigneto.id,
          vendemmiaId: vendemmia.id,
          vendemmia: vendemmia
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('[VENDEMMIA-SERVICE] Errore ricerca vendemmia per lavoroId:', error);
    return null;
  }
}

/**
 * Trova vendemmia collegata a un'attività
 * @param {string} attivitaId - ID attività
 * @returns {Promise<{vignetoId: string, vendemmiaId: string, vendemmia: Vendemmia}|null>} Dati vendemmia o null se non trovata
 */
export async function findVendemmiaByAttivitaId(attivitaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId || !attivitaId) {
      return null;
    }
    
    // Carica tutti i vigneti
    const { getAllVigneti } = await import('./vigneti-service.js');
    const vigneti = await getAllVigneti();
    
    // Cerca vendemmia con questo attivitaId in tutti i vigneti
    for (const vigneto of vigneti) {
      const vendemmie = await getVendemmie(vigneto.id);
      const vendemmia = vendemmie.find(v => v.attivitaId === attivitaId);
      
      if (vendemmia) {
        return {
          vignetoId: vigneto.id,
          vendemmiaId: vendemmia.id,
          vendemmia: vendemmia
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('[VENDEMMIA-SERVICE] Errore ricerca vendemmia per attivitaId:', error);
    return null;
  }
}

/**
 * Aggiorna vigneto basandosi su una vendemmia
 * @param {string} vignetoId - ID vigneto
 * @param {Vendemmia} vendemmia - Vendemmia
 * @returns {Promise<void>}
 */
async function aggiornaVignetoDaVendemmia(vignetoId, vendemmia) {
  try {
    const vendemmie = await getVendemmie(vignetoId);
    
    // Calcola produzione totale anno corrente
    const annoCorrente = new Date().getFullYear();
    const vendemmieAnnoCorrente = vendemmie.filter(v => {
      const dataVendemmia = v.data instanceof Date ? v.data : (v.data?.toDate ? v.data.toDate() : new Date(v.data));
      return dataVendemmia.getFullYear() === annoCorrente;
    });
    
    const produzioneTotaleAnno = vendemmieAnnoCorrente.reduce((sum, v) => sum + (v.quantitaQli || 0), 0);
    
    // Aggiorna data ultima vendemmia
    const dataVendemmia = vendemmia.data instanceof Date ? vendemmia.data : (vendemmia.data?.toDate ? vendemmia.data.toDate() : new Date(vendemmia.data));
    const dataUltimaVendemmia = vendemmie.length > 0 
      ? vendemmie.reduce((latest, v) => {
          const vData = v.data instanceof Date ? v.data : (v.data?.toDate ? v.data.toDate() : new Date(v.data));
          return vData > latest ? vData : latest;
        }, dataVendemmia)
      : dataVendemmia;
    
    // Aggiorna spese vendemmia anno
    const speseVendemmiaAnno = vendemmieAnnoCorrente.reduce((sum, v) => sum + (v.costoTotale || 0), 0);
    
    await updateVigneto(vignetoId, {
      produzioneTotaleAnno: parseFloat(produzioneTotaleAnno.toFixed(2)),
      dataUltimaVendemmia: dateToTimestamp(dataUltimaVendemmia),
      speseVendemmiaAnno: parseFloat(speseVendemmiaAnno.toFixed(2))
    });
  } catch (error) {
    console.error('Errore aggiornamento vigneto da vendemmia:', error);
    // Non blocchiamo l'operazione principale
  }
}

/**
 * Ricalcola produzione vigneto (dopo eliminazione vendemmia)
 * @param {string} vignetoId - ID vigneto
 * @returns {Promise<void>}
 */
async function ricalcolaProduzioneVigneto(vignetoId) {
  try {
    const vendemmie = await getVendemmie(vignetoId);
    const annoCorrente = new Date().getFullYear();
    const vendemmieAnnoCorrente = vendemmie.filter(v => {
      const dataVendemmia = v.data instanceof Date ? v.data : (v.data?.toDate ? v.data.toDate() : new Date(v.data));
      return dataVendemmia.getFullYear() === annoCorrente;
    });
    
    const produzioneTotaleAnno = vendemmieAnnoCorrente.reduce((sum, v) => sum + (v.quantitaQli || 0), 0);
    const speseVendemmiaAnno = vendemmieAnnoCorrente.reduce((sum, v) => sum + (v.costoTotale || 0), 0);
    
    await updateVigneto(vignetoId, {
      produzioneTotaleAnno: parseFloat(produzioneTotaleAnno.toFixed(2)),
      speseVendemmiaAnno: parseFloat(speseVendemmiaAnno.toFixed(2))
    });
  } catch (error) {
    console.error('Errore ricalcolo produzione vigneto:', error);
  }
}

/**
 * Calcola resa media vigneto (da tutte le vendemmie)
 * @param {string} vignetoId - ID vigneto
 * @returns {Promise<number>} Resa media in quintali/ettaro
 */
export async function calcolaResaMediaVigneto(vignetoId) {
  try {
    const vendemmie = await getVendemmie(vignetoId);
    
    if (vendemmie.length === 0) {
      return 0;
    }
    
    const resaTotale = vendemmie.reduce((sum, v) => sum + (v.resaQliHa || 0), 0);
    return parseFloat((resaTotale / vendemmie.length).toFixed(2));
  } catch (error) {
    console.error('Errore calcolo resa media:', error);
    return 0;
  }
}

/**
 * Crea una vendemmia automaticamente da un lavoro
 * Viene chiamata quando si crea un lavoro con tipo "Vendemmia Manuale" o "Vendemmia Meccanica"
 * su un terreno con coltura "VITE"
 * @param {string} lavoroId - ID lavoro
 * @returns {Promise<string|null>} ID vendemmia creata o null se non creata
 */
export async function createVendemmiaFromLavoro(lavoroId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      return null;
    }
    
    // Carica lavoro
    const { getLavoro } = await import('../../../core/services/lavori-service.js');
    const lavoro = await getLavoro(lavoroId);
    if (!lavoro) {
      return null;
    }
    
    // Verifica tipo lavoro: deve essere "Vendemmia Manuale" o "Vendemmia Meccanica"
    const tipoLavoro = lavoro.tipoLavoro || '';
    if (!tipoLavoro.toLowerCase().includes('vendemmia')) {
      return null;
    }
    
    // Carica terreno per verificare coltura
    const { getTerreno } = await import('../../../core/services/terreni-service.js');
    const terreno = await getTerreno(lavoro.terrenoId);
    if (!terreno) {
      return null;
    }
    
    // Verifica coltura: deve contenere "vite" (può essere "Vite", "Vite da Vino", "Vite da Tavola", etc.)
    const coltura = terreno.coltura || '';
    if (!coltura.toLowerCase().includes('vite')) {
      return null;
    }
    
    // Trova vigneto collegato al terreno
    const { getAllVigneti } = await import('./vigneti-service.js');
    const vigneti = await getAllVigneti();
    const vigneto = vigneti.find(v => v.terrenoId === terreno.id);
    
    if (!vigneto) {
      return null;
    }
    
    // Verifica se vendemmia già esiste per questo lavoro
    const vendemmieEsistenti = await getVendemmie(vigneto.id);
    const vendemmiaEsistente = vendemmieEsistenti.find(v => v.lavoroId === lavoroId);
    
    if (vendemmiaEsistente) {
      return vendemmiaEsistente.id;
    }
    
    // Prepara dati vendemmia dal lavoro
    const dataVendemmia = lavoro.dataInizio instanceof Date 
      ? lavoro.dataInizio 
      : (lavoro.dataInizio?.toDate ? lavoro.dataInizio.toDate() : new Date());
    
    // Carica operai dal lavoro (se presente)
    const operai = [];
    if (lavoro.caposquadraId) {
      // Se ha caposquadra, carica operai dalla squadra
      const { getFirestore, collection, getDocs, query, where, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
      
      if (typeof window.firebaseConfig !== 'undefined') {
        const app = initializeApp(window.firebaseConfig);
        const db = getFirestore(app);
        
        // Cerca squadra del caposquadra
        const squadreRef = collection(db, `tenants/${tenantId}/squadre`);
        const squadreQuery = query(squadreRef, where('caposquadraId', '==', lavoro.caposquadraId));
        const squadreSnapshot = await getDocs(squadreQuery);
        
        squadreSnapshot.forEach(squadraDoc => {
          const squadra = squadraDoc.data();
          if (squadra.operai && Array.isArray(squadra.operai)) {
            operai.push(...squadra.operai);
          }
        });
      }
    } else if (lavoro.operaioId) {
      operai.push(lavoro.operaioId);
    }
    
    // Carica macchine dal lavoro (se presente)
    const macchine = [];
    if (lavoro.macchinaId) {
      macchine.push(lavoro.macchinaId);
    }
    if (lavoro.attrezzoId) {
      macchine.push(lavoro.attrezzoId);
    }
    
    // Calcola ore totali dal lavoro (se presente)
    let oreImpiegate = null;
    if (lavoro.durataPrevista) {
      // Stima ore: durata prevista in giorni × 8 ore/giorno
      oreImpiegate = lavoro.durataPrevista * 8;
    }
    
    // Crea vendemmia con dati precompilati
    const vendemmiaData = {
      vignetoId: vigneto.id,
      lavoroId: lavoroId,
      data: dataVendemmia,
      varieta: vigneto.varieta || '',
      // Dati produzione: da completare manualmente
      quantitaQli: null,
      quantitaEttari: null,
      destinazione: null,
      // Dati qualità: opzionali
      gradazione: null,
      acidita: null,
      ph: null,
      // Dati operativi: precompilati dal lavoro
      operai: operai,
      macchine: macchine,
      oreImpiegate: oreImpiegate,
      parcella: null,
      note: `Vendemmia creata automaticamente dal lavoro: ${lavoro.nome || lavoroId}`
    };
    
    // Crea vendemmia (senza validazione completa perché dati produzione mancanti)
    // La validazione permette vendemmia incompleta se collegata a lavoro
    const vendemmia = new Vendemmia(vendemmiaData);
    
    // Aggiorna calcoli automatici (resa sarà 0 finché non si completa)
    vendemmia.aggiornaCalcoli();
    
    // Calcola compensi operai e macchine se necessario
    if ((vendemmia.operai && vendemmia.operai.length > 0) || 
        (vendemmia.macchine && vendemmia.macchine.length > 0)) {
      await calcolaCompensiVendemmia(vendemmia);
    }
    
    // Salva su Firestore (sub-collection)
    const collectionPath = getVendemmiePath(vigneto.id);
    const vendemmiaId = await createDocument(collectionPath, vendemmia.toFirestore(), tenantId);
    
    return vendemmiaId;
  } catch (error) {
    console.error('Errore creazione vendemmia da lavoro:', error);
    // Non blocchiamo l'operazione principale
    return null;
  }
}

/**
 * Crea una vendemmia automaticamente da un'attività (senza lavoro collegato)
 * Viene chiamata quando si crea un'attività con tipo "Vendemmia Manuale" o "Vendemmia Meccanica"
 * su un terreno con coltura "VITE" direttamente dal diario (senza lavoro)
 * @param {string} attivitaId - ID attività
 * @returns {Promise<string|null>} ID vendemmia creata o null se non creata
 */
export async function createVendemmiaFromAttivita(attivitaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      return null;
    }
    
    // Carica attività
    const { getAttivita } = await import('../../../core/services/attivita-service.js');
    const attivita = await getAttivita(attivitaId);
    if (!attivita) {
      return null;
    }
    
    // Verifica tipo lavoro: deve essere "Vendemmia Manuale" o "Vendemmia Meccanica"
    const tipoLavoro = attivita.tipoLavoro || '';
    if (!tipoLavoro.toLowerCase().includes('vendemmia')) {
      return null;
    }
    
    // Carica terreno per verificare coltura
    const { getTerreno } = await import('../../../core/services/terreni-service.js');
    const terreno = await getTerreno(attivita.terrenoId);
    if (!terreno) {
      return null;
    }
    
    // Verifica coltura: deve contenere "vite"
    const coltura = terreno.coltura || '';
    if (!coltura.toLowerCase().includes('vite')) {
      return null;
    }
    
    // Trova vigneto collegato al terreno
    const { getAllVigneti } = await import('./vigneti-service.js');
    const vigneti = await getAllVigneti();
    const vigneto = vigneti.find(v => v.terrenoId === terreno.id);
    
    if (!vigneto) {
      return null;
    }
    
    // Verifica se vendemmia già esiste per questa attività
    // (controlla per data e vigneto, perché attivitaId potrebbe non essere ancora presente)
    const vendemmieEsistenti = await getVendemmie(vigneto.id);
    const vendemmiaEsistente = vendemmieEsistenti.find(v => {
      // Verifica se esiste già una vendemmia per questa attività (se attivitaId è presente)
      if (v.attivitaId === attivitaId) return true;
      // Verifica anche per data (se stessa data, potrebbe essere la stessa vendemmia)
      const dataVendemmiaEsistente = v.data instanceof Date ? v.data : (v.data?.toDate ? v.data.toDate() : null);
      const dataAttivita = attivita.data instanceof Date ? attivita.data : (attivita.data ? new Date(attivita.data) : null);
      if (dataVendemmiaEsistente && dataAttivita && 
          dataVendemmiaEsistente.getTime() === dataAttivita.getTime()) {
        // Stessa data, potrebbe essere la stessa vendemmia - verifica se non ha lavoroId (quindi creata da attività)
        if (!v.lavoroId) return true;
      }
      return false;
    });
    
    if (vendemmiaEsistente) {
      // Aggiorna attivitaId se non presente
      if (!vendemmiaEsistente.attivitaId) {
        const { updateVendemmia } = await import('./vendemmia-service.js');
        await updateVendemmia(vendemmiaEsistente.id, { attivitaId: attivitaId });
      }
      return vendemmiaEsistente.id;
    }
    
    // Prepara dati vendemmia dall'attività
    const dataVendemmia = attivita.data instanceof Date 
      ? attivita.data 
      : (attivita.data ? new Date(attivita.data) : new Date());
    
    // Dati operativi dall'attività (se disponibili)
    // Nota: le attività non hanno direttamente operai, ma potrebbero essere collegate a un lavoro
    // Per ora, lasciamo operai vuoto se non c'è lavoro collegato
    const operai = [];
    const macchine = [];
    if (attivita.macchinaId) macchine.push({ id: attivita.macchinaId, ore: attivita.oreMacchina || attivita.oreNette || 0 });
    if (attivita.attrezzoId) macchine.push({ id: attivita.attrezzoId, ore: attivita.oreMacchina || attivita.oreNette || 0 });
    const oreImpiegate = attivita.oreNette || 0;
    
    // Crea vendemmia con dati precompilati
    const vendemmiaData = {
      vignetoId: vigneto.id,
      attivitaId: attivitaId, // Collegamento all'attività invece del lavoro
      data: dataVendemmia,
      varieta: vigneto.varieta || '',
      // Dati produzione: da completare manualmente
      quantitaQli: null,
      quantitaEttari: null,
      destinazione: null,
      // Dati qualità: opzionali
      gradazione: null,
      acidita: null,
      ph: null,
      // Dati operativi: precompilati dall'attività
      operai: operai,
      macchine: macchine,
      oreImpiegate: oreImpiegate,
      parcella: null,
      note: '' // Note vuote per vendemmia creata automaticamente
    };
    
    // Crea vendemmia (senza validazione completa perché dati produzione mancanti)
    const vendemmia = new Vendemmia(vendemmiaData);
    
    // Aggiorna calcoli automatici (resa sarà 0 finché non si completa)
    vendemmia.aggiornaCalcoli();
    
    // Calcola compensi operai e macchine se necessario
    if ((vendemmia.operai && vendemmia.operai.length > 0) || 
        (vendemmia.macchine && vendemmia.macchine.length > 0)) {
      await calcolaCompensiVendemmia(vendemmia);
    }
    
    // Salva su Firestore (sub-collection)
    const collectionPath = getVendemmiePath(vigneto.id);
    const vendemmiaId = await createDocument(collectionPath, vendemmia.toFirestore(), tenantId);
    
    return vendemmiaId;
  } catch (error) {
    console.error('Errore creazione vendemmia da attività:', error);
    return null;
  }
}

/**
 * Sincronizza i dati operativi di una vendemmia collegata a un lavoro.
 * Aggiorna SOLO i campi "operativi" (data/operai/macchine/oreImpiegate) lasciando invariati
 * i dati produzione/qualità (quantitaQli, quantitaEttari, destinazione, gradazione, acidita, ph).
 *
 * Uso tipico: quando si modifica un lavoro di tipo vendemmia o cambiano assegnazioni/macchine.
 *
 * @param {string} lavoroId
 * @returns {Promise<string|null>} vendemmiaId sincronizzata o null se non esiste/condizioni non soddisfatte
 */
export async function syncVendemmiaFromLavoro(lavoroId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId || !lavoroId) return null;

    // Trova vendemmia collegata
    const vendemmiaCollegata = await findVendemmiaByLavoroId(lavoroId);
    if (!vendemmiaCollegata) return null;

    // Carica lavoro
    const { getLavoro } = await import('../../../core/services/lavori-service.js');
    const lavoro = await getLavoro(lavoroId);
    if (!lavoro) return null;

    // Se non è più una vendemmia, non sincronizziamo (gestione a monte: delete/unlink)
    const tipoLavoro = (lavoro.tipoLavoro || '').toLowerCase();
    if (!tipoLavoro.includes('vendemmia')) return null;

    // Carica terreno e verifica che sia VITE (se non lo è, gestione a monte: unlink)
    const { getTerreno } = await import('../../../core/services/terreni-service.js');
    const terreno = await getTerreno(lavoro.terrenoId);
    const coltura = (terreno?.coltura || '').toLowerCase();
    if (!coltura.includes('vite')) return null;

    // Data dal lavoro
    const dataVendemmia = lavoro.dataInizio instanceof Date
      ? lavoro.dataInizio
      : (lavoro.dataInizio?.toDate ? lavoro.dataInizio.toDate() : null);

    // Operai dal lavoro (stessa logica createVendemmiaFromLavoro)
    const operai = [];
    if (lavoro.caposquadraId) {
      try {
        const { getFirestore, collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
        if (typeof window.firebaseConfig !== 'undefined') {
          const app = initializeApp(window.firebaseConfig);
          const db = getFirestore(app);

          const squadreRef = collection(db, `tenants/${tenantId}/squadre`);
          const squadreQuery = query(squadreRef, where('caposquadraId', '==', lavoro.caposquadraId));
          const squadreSnapshot = await getDocs(squadreQuery);
          squadreSnapshot.forEach(squadraDoc => {
            const squadra = squadraDoc.data();
            if (squadra.operai && Array.isArray(squadra.operai)) {
              operai.push(...squadra.operai);
            }
          });
        }
      } catch (e) {
        console.warn('[VENDEMMIA-SERVICE] Sync operai da squadra fallito (non critico):', e);
      }
    } else if (lavoro.operaioId) {
      operai.push(lavoro.operaioId);
    }

    // Macchine dal lavoro
    const macchine = [];
    if (lavoro.macchinaId) macchine.push(lavoro.macchinaId);
    if (lavoro.attrezzoId) macchine.push(lavoro.attrezzoId);

    // Ore: se ci sono ore validate le userà comunque calcolaCompensiVendemmia via lavoroId,
    // ma manteniamo un valore "display" coerente (fallback su durata prevista).
    let oreImpiegate = null;
    if (lavoro.durataPrevista) {
      oreImpiegate = lavoro.durataPrevista * 8;
    }

    const updates = {
      ...(dataVendemmia ? { data: dataVendemmia } : {}),
      operai,
      macchine,
      oreImpiegate
    };

    await updateVendemmia(
      vendemmiaCollegata.vignetoId,
      vendemmiaCollegata.vendemmiaId,
      updates
    );

    return vendemmiaCollegata.vendemmiaId;
  } catch (error) {
    console.warn('[VENDEMMIA-SERVICE] Errore syncVendemmiaFromLavoro (non critico):', error);
    return null;
  }
}

/**
 * Calcola compensi operai per una vendemmia
 * Se la vendemmia è collegata a un lavoro, calcola dalle ore validate del lavoro
 * Altrimenti, calcola dalle oreImpiegate e tariffe operai
 * @param {Vendemmia} vendemmia - Vendemmia
 * @returns {Promise<void>}
 */
async function calcolaCompensiVendemmia(vendemmia) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      return;
    }
    
    const { getFirestore, collection, getDocs, query, where, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    
    if (typeof window.firebaseConfig === 'undefined') {
      return;
    }
    
    const app = initializeApp(window.firebaseConfig);
    const db = getFirestore(app);
    
    let costoManodopera = 0;
    
    // Se vendemmia collegata a lavoro, calcola dalle ore validate del lavoro
    if (vendemmia.lavoroId) {
      const oreRef = collection(db, `tenants/${tenantId}/lavori/${vendemmia.lavoroId}/oreOperai`);
      const oreQuery = query(oreRef, where('stato', '==', 'validate'));
      const oreSnapshot = await getDocs(oreQuery);
      
      for (const oraDoc of oreSnapshot.docs) {
        const ora = oraDoc.data();
        const operaioId = ora.operaioId;
        if (!operaioId) continue;
        
        // Carica dati operaio
        const userDoc = await getDoc(doc(db, 'users', operaioId));
        if (!userDoc.exists()) continue;
        
        const userData = userDoc.data();
        const tariffa = await getTariffaOperaio(tenantId, {
          tipoOperaio: userData.tipoOperaio || null,
          tariffaPersonalizzata: userData.tariffaPersonalizzata || null
        });
        
        const oreNette = ora.oreNette || 0;
        costoManodopera += oreNette * tariffa;
      }
    } else {
      // Calcola dalle oreImpiegate e tariffe operai
      if (vendemmia.operai && vendemmia.operai.length > 0) {
        // Verifica se operai è array di ID o array di oggetti
        const isArrayOfObjects = vendemmia.operai.length > 0 && typeof vendemmia.operai[0] === 'object' && vendemmia.operai[0].nome !== undefined;
        
        if (isArrayOfObjects) {
          // Array di oggetti (tabella editabile senza modulo manodopera)
          // In questo caso, non possiamo calcolare automaticamente i compensi
          // perché non abbiamo le tariffe degli operai (non sono nel sistema)
          // Il costo manodopera verrà lasciato a 0 o calcolato manualmente
          costoManodopera = 0;
        } else {
          // Array di ID (modulo manodopera attivo)
          if (vendemmia.oreImpiegate) {
            const orePerOperaio = vendemmia.oreImpiegate / vendemmia.operai.length;
            
            for (const operaioId of vendemmia.operai) {
              // Carica dati operaio
              const userDoc = await getDoc(doc(db, 'users', operaioId));
              if (!userDoc.exists()) continue;
              
              const userData = userDoc.data();
              const tariffa = await getTariffaOperaio(tenantId, {
                tipoOperaio: userData.tipoOperaio || null,
                tariffaPersonalizzata: userData.tariffaPersonalizzata || null
              });
              
              costoManodopera += orePerOperaio * tariffa;
            }
          }
        }
      }
    }
    
    vendemmia.costoManodopera = parseFloat(costoManodopera.toFixed(2));
    console.log('[VENDEMMIA-SERVICE] Costo manodopera calcolato:', vendemmia.costoManodopera);
    
    // Calcola costo macchine (se modulo Parco Macchine attivo)
    let costoMacchine = 0;
    try {
      console.log('[VENDEMMIA-SERVICE] Inizio calcolo costo macchine...');
      console.log('[VENDEMMIA-SERVICE] Vendemmia macchine:', vendemmia.macchine);
      console.log('[VENDEMMIA-SERVICE] Vendemmia lavoroId:', vendemmia.lavoroId);
      console.log('[VENDEMMIA-SERVICE] Vendemmia attivitaId:', vendemmia.attivitaId);
      console.log('[VENDEMMIA-SERVICE] Vendemmia oreImpiegate:', vendemmia.oreImpiegate);
      
      const { hasModuleAccess } = await import('../../../core/services/tenant-service.js');
      const hasParcoMacchineModule = await hasModuleAccess('parcoMacchine');
      console.log('[VENDEMMIA-SERVICE] Modulo Parco Macchine attivo?', hasParcoMacchineModule);
      
      if (!hasParcoMacchineModule) {
        console.log('[VENDEMMIA-SERVICE] Modulo Parco Macchine non attivo, skip calcolo costo macchine');
      } else if (!vendemmia.macchine || vendemmia.macchine.length === 0) {
        console.log('[VENDEMMIA-SERVICE] Nessuna macchina nella vendemmia, costo macchine = 0');
      } else {
        console.log('[VENDEMMIA-SERVICE] Trovate', vendemmia.macchine.length, 'macchine nella vendemmia');
        const { getMacchina } = await import('../../../modules/parco-macchine/services/macchine-service.js');
        
        // Verifica se macchine è array di ID o array di oggetti {id, ore}
        const isArrayOfObjects = vendemmia.macchine.length > 0 && 
                                 typeof vendemmia.macchine[0] === 'object' && 
                                 vendemmia.macchine[0].id !== undefined;
        console.log('[VENDEMMIA-SERVICE] Formato macchine:', isArrayOfObjects ? 'array di oggetti {id, ore}' : 'array di ID');
        
        for (let i = 0; i < vendemmia.macchine.length; i++) {
          const macchinaItem = vendemmia.macchine[i];
          try {
            console.log(`[VENDEMMIA-SERVICE] Elaborazione macchina ${i + 1}/${vendemmia.macchine.length}:`, macchinaItem);
            let macchinaId, oreMacchina;
            
            if (isArrayOfObjects) {
              // Array di oggetti {id, ore}
              macchinaId = macchinaItem.id;
              oreMacchina = macchinaItem.ore || 0;
              console.log(`[VENDEMMIA-SERVICE] Macchina ${i + 1} - ID:`, macchinaId, 'Ore:', oreMacchina);
            } else {
              // Array di ID (string)
              macchinaId = macchinaItem;
              console.log(`[VENDEMMIA-SERVICE] Macchina ${i + 1} - ID:`, macchinaId);
              
              // Se vendemmia collegata a lavoro, cerca ore nelle oreOperai
              // Altrimenti usa oreImpiegate divise per numero macchine
              if (vendemmia.lavoroId) {
                console.log(`[VENDEMMIA-SERVICE] Vendemmia collegata a lavoro ${vendemmia.lavoroId}, cerco ore nelle oreOperai...`);
                // Cerca nelle oreOperai del lavoro
                const oreRef = collection(db, `tenants/${tenantId}/lavori/${vendemmia.lavoroId}/oreOperai`);
                const oreQuery = query(oreRef, where('stato', '==', 'validate'));
                const oreSnapshot = await getDocs(oreQuery);
                console.log(`[VENDEMMIA-SERVICE] Trovate ${oreSnapshot.size} ore validate nel lavoro`);
                
                let oreTotaliMacchina = 0;
                oreSnapshot.forEach(oraDoc => {
                  const ora = oraDoc.data();
                  console.log(`[VENDEMMIA-SERVICE] Ora documento:`, { macchinaId: ora.macchinaId, attrezzoId: ora.attrezzoId, oreMacchina: ora.oreMacchina });
                  if ((ora.macchinaId === macchinaId || ora.attrezzoId === macchinaId) && ora.oreMacchina) {
                    oreTotaliMacchina += ora.oreMacchina;
                    console.log(`[VENDEMMIA-SERVICE] Trovata corrispondenza! Ore aggiunte:`, ora.oreMacchina, 'Totale parziale:', oreTotaliMacchina);
                  }
                });
                oreMacchina = oreTotaliMacchina || (vendemmia.oreImpiegate || 0);
                console.log(`[VENDEMMIA-SERVICE] Ore totali macchina ${macchinaId}:`, oreMacchina);
              } else if (vendemmia.attivitaId) {
                console.log(`[VENDEMMIA-SERVICE] Vendemmia collegata ad attività ${vendemmia.attivitaId}`);
                // Per attività, usa oreImpiegate divise per numero macchine (stima)
                oreMacchina = vendemmia.oreImpiegate ? (vendemmia.oreImpiegate / vendemmia.macchine.length) : 0;
                console.log(`[VENDEMMIA-SERVICE] Ore stimate per macchina (da oreImpiegate/${vendemmia.macchine.length}):`, oreMacchina);
              } else {
                // Usa oreImpiegate divise per numero macchine (stima)
                oreMacchina = vendemmia.oreImpiegate ? (vendemmia.oreImpiegate / vendemmia.macchine.length) : 0;
                console.log(`[VENDEMMIA-SERVICE] Ore stimate per macchina (da oreImpiegate/${vendemmia.macchine.length}):`, oreMacchina);
              }
            }
            
            if (!macchinaId) {
              console.warn(`[VENDEMMIA-SERVICE] Macchina ${i + 1} senza ID, skip`);
              continue;
            }
            
            if (oreMacchina <= 0) {
              console.warn(`[VENDEMMIA-SERVICE] Macchina ${macchinaId} con ore <= 0 (${oreMacchina}), skip`);
              continue;
            }
            
            console.log(`[VENDEMMIA-SERVICE] Caricamento dati macchina ${macchinaId}...`);
            const macchina = await getMacchina(macchinaId);
            console.log(`[VENDEMMIA-SERVICE] Macchina caricata:`, macchina ? { id: macchina.id, nome: macchina.nome, costoOra: macchina.costoOra } : 'non trovata');
            
            if (!macchina) {
              console.warn(`[VENDEMMIA-SERVICE] Macchina ${macchinaId} non trovata, skip`);
              continue;
            }
            
            if (!macchina.costoOra) {
              console.warn(`[VENDEMMIA-SERVICE] Macchina ${macchinaId} senza costoOra, skip`);
              continue;
            }
            
            const costo = oreMacchina * macchina.costoOra;
            console.log(`[VENDEMMIA-SERVICE] Costo macchina ${macchinaId}:`, oreMacchina, 'ore ×', macchina.costoOra, '€/ora =', costo, '€');
            costoMacchine += costo;
            console.log(`[VENDEMMIA-SERVICE] Costo macchine totale parziale:`, costoMacchine, '€');
          } catch (error) {
            console.error(`[VENDEMMIA-SERVICE] Errore calcolo costo macchina ${macchinaItem.id || macchinaItem}:`, error);
            console.error(`[VENDEMMIA-SERVICE] Stack:`, error.stack);
          }
        }
      }
    } catch (error) {
      console.error('[VENDEMMIA-SERVICE] Errore verifica modulo Parco Macchine:', error);
      console.error('[VENDEMMIA-SERVICE] Stack:', error.stack);
      // Non blocchiamo l'operazione principale
    }
    
    console.log('[VENDEMMIA-SERVICE] Costo macchine finale:', costoMacchine, '€');
    vendemmia.costoMacchine = parseFloat(costoMacchine.toFixed(2));
    console.log('[VENDEMMIA-SERVICE] Costo macchine salvato:', vendemmia.costoMacchine, '€');
    vendemmia.aggiornaCalcoli();
    console.log('[VENDEMMIA-SERVICE] Costo totale dopo aggiornamento calcoli:', vendemmia.costoTotale, '€');
  } catch (error) {
    console.error('Errore calcolo compensi vendemmia:', error);
    // Non blocchiamo l'operazione principale
  }
}
