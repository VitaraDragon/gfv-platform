/**
 * Vigneto Statistiche Aggregate Service - Servizio per aggregazioni pre-calcolate
 * Mantiene statistiche aggregate in Firestore per performance ottimali
 * 
 * @module modules/vigneto/services/vigneto-statistiche-aggregate-service
 */

import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { 
  getDb,
  getDocument,
  getDocumentData,
  createDocument,
  updateDocument,
  deleteDocument,
  dateToTimestamp,
  timestampToDate
} from '../../../core/services/firebase-service.js';
import { getVendemmie } from './vendemmia-service.js';
import { aggregaSpeseVignetoAnno } from './lavori-vigneto-service.js';

const STATS_COLLECTION = 'statistiche_vigneto';

/**
 * Ottieni path documento statistiche aggregate
 * @param {string} vignetoId - ID vigneto
 * @param {number} anno - Anno
 * @returns {string} Path documento
 */
function getStatsPath(vignetoId, anno) {
  return `${STATS_COLLECTION}/${vignetoId}_${anno}`;
}

/**
 * Calcola e salva statistiche aggregate per un vigneto/anno
 * @param {string} vignetoId - ID vigneto
 * @param {number} anno - Anno
 * @returns {Promise<Object>} Statistiche aggregate
 */
export async function calcolaEAggiornaStatistiche(vignetoId, anno) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    // Carica vendemmie per l'anno
    const vendemmie = await getVendemmie(vignetoId, { anno: anno, orderBy: 'data', orderDirection: 'desc' });
    
    // Carica spese per l'anno
    const spese = await aggregaSpeseVignetoAnno(vignetoId, anno);
    
    // Calcola aggregazioni
    let produzioneTotaleQli = 0;
    let speseVendemmiaAnno = 0;
    let numeroVendemmie = vendemmie.length;
    let dataUltimaVendemmia = null;
    const produzionePerMese = {};
    const resaPerVarieta = {};
    const spesePerMese = {};
    const qualitaPerVarieta = {};
    
    // Processa vendemmie
    vendemmie.forEach(vendemmia => {
      // Produzione totale
      produzioneTotaleQli += vendemmia.quantitaQli || 0;
      
      // Spese vendemmia
      speseVendemmiaAnno += vendemmia.costoTotale || 0;
      
      // Data ultima vendemmia
      const dataVendemmia = vendemmia.data instanceof Date 
        ? vendemmia.data 
        : (vendemmia.data?.toDate ? vendemmia.data.toDate() : new Date(vendemmia.data));
      
      if (!dataUltimaVendemmia || dataVendemmia > dataUltimaVendemmia) {
        dataUltimaVendemmia = dataVendemmia;
      }
      
      // Produzione per mese
      const mese = dataVendemmia.getMonth() + 1;
      const meseKey = `${anno}-${String(mese).padStart(2, '0')}`;
      if (!produzionePerMese[meseKey]) {
        produzionePerMese[meseKey] = 0;
      }
      produzionePerMese[meseKey] += vendemmia.quantitaQli || 0;
      
      // Spese per mese
      if (!spesePerMese[meseKey]) {
        spesePerMese[meseKey] = 0;
      }
      spesePerMese[meseKey] += vendemmia.costoTotale || 0;
      
      // Resa per varietà
      const varieta = vendemmia.varieta || 'Sconosciuta';
      if (!resaPerVarieta[varieta]) {
        resaPerVarieta[varieta] = {
          quantitaQli: 0,
          superficieEttari: 0,
          resaQliHa: 0
        };
      }
      resaPerVarieta[varieta].quantitaQli += vendemmia.quantitaQli || 0;
      resaPerVarieta[varieta].superficieEttari += vendemmia.quantitaEttari || 0;
      
      // Qualità uva per varietà
      if (!qualitaPerVarieta[varieta]) {
        qualitaPerVarieta[varieta] = {
          gradazione: [],
          acidita: [],
          pH: [],
          quantitaQli: 0
        };
      }
      if (vendemmia.gradazione) {
        qualitaPerVarieta[varieta].gradazione.push(vendemmia.gradazione);
      }
      if (vendemmia.acidita) {
        qualitaPerVarieta[varieta].acidita.push(vendemmia.acidita);
      }
      if (vendemmia.ph !== undefined && vendemmia.ph !== null) {
        qualitaPerVarieta[varieta].pH.push(vendemmia.ph);
      }
      qualitaPerVarieta[varieta].quantitaQli += vendemmia.quantitaQli || 0;
    });
    
    // Calcola resa media per varietà
    Object.keys(resaPerVarieta).forEach(varieta => {
      const dati = resaPerVarieta[varieta];
      if (dati.superficieEttari > 0) {
        dati.resaQliHa = parseFloat((dati.quantitaQli / dati.superficieEttari).toFixed(2));
      }
    });
    
    // Calcola medie qualità per varietà
    const qualitaUva = {};
    Object.keys(qualitaPerVarieta).forEach(varieta => {
      const dati = qualitaPerVarieta[varieta];
      qualitaUva[varieta] = {
        gradazioneMedia: dati.gradazione.length > 0 
          ? parseFloat((dati.gradazione.reduce((a, b) => a + b, 0) / dati.gradazione.length).toFixed(2))
          : null,
        aciditaMedia: dati.acidita.length > 0
          ? parseFloat((dati.acidita.reduce((a, b) => a + b, 0) / dati.acidita.length).toFixed(2))
          : null,
        pHMedio: dati.pH && dati.pH.length > 0
          ? parseFloat((dati.pH.reduce((a, b) => a + b, 0) / dati.pH.length).toFixed(2))
          : null,
        quantitaQli: parseFloat(dati.quantitaQli.toFixed(2))
      };
    });
    
    // Prepara documento statistiche
    const statsData = {
      vignetoId,
      anno,
      // Produzione
      produzioneTotaleQli: parseFloat(produzioneTotaleQli.toFixed(2)),
      numeroVendemmie,
      dataUltimaVendemmia: dataUltimaVendemmia ? dateToTimestamp(dataUltimaVendemmia) : null,
      produzionePerMese,
      resaPerVarieta,
      // Spese
      speseVendemmiaAnno: parseFloat(speseVendemmiaAnno.toFixed(2)),
      spesePerMese,
      // Spese da lavori (da aggregaSpeseVignetoAnno)
      speseManodoperaAnno: spese.speseManodoperaAnno || 0,
      speseMacchineAnno: spese.speseMacchineAnno || 0,
      speseProdottiAnno: spese.speseProdottiAnno || 0,
      speseCantinaAnno: spese.speseCantinaAnno || 0,
      speseAltroAnno: spese.speseAltroAnno || 0,
      costoTotaleAnno: spese.costoTotaleAnno || 0,
      // Qualità
      qualitaUva
    };
    
    // Salva/aggiorna documento statistiche
    // Usa setDoc direttamente con merge per creare o aggiornare in un'unica operazione
    // Questo evita problemi di permessi quando si verifica se il documento esiste
    const { getDocument, setDoc, serverTimestamp } = await import('../../../core/services/firebase-service.js');
    const docId = `${vignetoId}_${anno}`;
    const docRef = getDocument(STATS_COLLECTION, docId, tenantId);
    
    // Usa setDoc con merge: crea se non esiste, aggiorna se esiste
    await setDoc(docRef, {
      ...statsData,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    return statsData;
  } catch (error) {
    throw error;
  }
}

/**
 * Ottieni statistiche aggregate (da documento pre-calcolato o calcola se non esiste)
 * @param {string} vignetoId - ID vigneto
 * @param {number} anno - Anno
 * @param {boolean} forceRecalculate - Forza ricalcolo anche se esiste (default: false)
 * @returns {Promise<Object>} Statistiche aggregate
 */
export async function getStatisticheAggregate(vignetoId, anno, forceRecalculate = false) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    // Se non forzato, prova a recuperare da documento pre-calcolato
    if (!forceRecalculate) {
      try {
        const docData = await getDocumentData(STATS_COLLECTION, `${vignetoId}_${anno}`, tenantId);
        if (docData) {
          // Converti timestamp a Date se necessario
          if (docData.dataUltimaVendemmia) {
            docData.dataUltimaVendemmia = timestampToDate(docData.dataUltimaVendemmia);
          }
          return docData;
        }
      } catch (error) {
        // Se errore permessi, probabilmente documento non esiste, procedi con calcolo
        if (!error.message || !error.message.includes('permissions')) {
          throw error;
        }
      }
    }
    
    // Se non esiste o forzato, calcola e salva
    const result = await calcolaEAggiornaStatistiche(vignetoId, anno);
    return result;
  } catch (error) {
    // Fallback: calcola al volo (più lento ma funziona sempre)
    return await calcolaEAggiornaStatistiche(vignetoId, anno);
  }
}

/**
 * Invalida statistiche aggregate per un vigneto/anno (forza ricalcolo al prossimo accesso)
 * @param {string} vignetoId - ID vigneto
 * @param {number} anno - Anno (opzionale, se null invalida tutti gli anni)
 * @returns {Promise<void>}
 */
export async function invalidaStatistiche(vignetoId, anno = null) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (anno) {
      // Elimina documento specifico
      await deleteDocument(STATS_COLLECTION, `${vignetoId}_${anno}`, tenantId);
    } else {
      // Elimina tutti i documenti per questo vigneto (tutti gli anni)
      // Nota: Firestore non supporta query con "starts with" facilmente
      // Per ora eliminiamo solo l'anno corrente e gli ultimi 5 anni
      const annoCorrente = new Date().getFullYear();
      for (let i = 0; i < 6; i++) {
        const annoTarget = annoCorrente - i;
        try {
          await deleteDocument(STATS_COLLECTION, `${vignetoId}_${annoTarget}`, tenantId);
        } catch (e) {
          // Ignora se documento non esiste
        }
      }
    }
  } catch (error) {
    // Non lanciare errore, è non critico
  }
}

/**
 * Ottieni produzione temporale da aggregazioni (ultimi N anni)
 * @param {string} vignetoId - ID vigneto
 * @param {number} anniIndietro - Numero di anni (default: 3)
 * @returns {Promise<Object>} Dati produzione per anno
 */
export async function getProduzioneTemporaleAggregata(vignetoId, anniIndietro = 3) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const annoCorrente = new Date().getFullYear();
    const annoInizio = annoCorrente - anniIndietro + 1;
    
    const produzionePerAnno = {};
    
    // Inizializza tutti gli anni
    for (let anno = annoInizio; anno <= annoCorrente; anno++) {
      produzionePerAnno[anno] = 0;
    }
    
    // Carica statistiche aggregate per tutti gli anni in parallelo
    const promises = [];
    for (let anno = annoInizio; anno <= annoCorrente; anno++) {
      promises.push(
        getStatisticheAggregate(vignetoId, anno, false).then(stats => ({
          anno,
          produzione: stats.produzioneTotaleQli || 0
        }))
      );
    }
    
    const risultati = await Promise.all(promises);
    
    // Aggrega i risultati
    risultati.forEach(({ anno, produzione }) => {
      produzionePerAnno[anno] += produzione;
    });
    
    return {
      anni: Object.keys(produzionePerAnno).map(Number).sort((a, b) => a - b),
      produzione: Object.keys(produzionePerAnno).sort((a, b) => Number(a) - Number(b)).map(anno => produzionePerAnno[anno])
    };
  } catch (error) {
    return { anni: [], produzione: [] };
  }
}

/**
 * Ottieni costi temporale da aggregazioni (ultimi N anni)
 * @param {string} vignetoId - ID vigneto
 * @param {number} anniIndietro - Numero di anni (default: 3)
 * @returns {Promise<Object>} Dati costi per anno
 */
export async function getCostiTemporaleAggregati(vignetoId, anniIndietro = 3) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const annoCorrente = new Date().getFullYear();
    const annoInizio = annoCorrente - anniIndietro + 1;
    
    const costiPerAnno = {};
    
    // Inizializza tutti gli anni
    for (let anno = annoInizio; anno <= annoCorrente; anno++) {
      costiPerAnno[anno] = {
        manodopera: 0,
        macchine: 0,
        prodotti: 0,
        cantina: 0,
        altro: 0,
        totale: 0
      };
    }
    
    // Carica statistiche aggregate per tutti gli anni in parallelo
    const promises = [];
    for (let anno = annoInizio; anno <= annoCorrente; anno++) {
      promises.push(
        getStatisticheAggregate(vignetoId, anno, false).then(stats => ({
          anno,
          spese: {
            manodopera: stats.speseManodoperaAnno || 0,
            macchine: stats.speseMacchineAnno || 0,
            prodotti: stats.speseProdottiAnno || 0,
            cantina: stats.speseCantinaAnno || 0,
            altro: stats.speseAltroAnno || 0,
            totale: stats.costoTotaleAnno || 0
          }
        }))
      );
    }
    
    const risultati = await Promise.all(promises);
    
    // Aggrega i risultati
    risultati.forEach(({ anno, spese }) => {
      costiPerAnno[anno].manodopera += spese.manodopera;
      costiPerAnno[anno].macchine += spese.macchine;
      costiPerAnno[anno].prodotti += spese.prodotti;
      costiPerAnno[anno].cantina += spese.cantina;
      costiPerAnno[anno].altro += spese.altro;
      costiPerAnno[anno].totale += spese.totale;
    });
    
    return {
      anni: Object.keys(costiPerAnno).map(Number).sort((a, b) => a - b),
      manodopera: Object.keys(costiPerAnno).sort((a, b) => Number(a) - Number(b)).map(anno => costiPerAnno[anno].manodopera),
      macchine: Object.keys(costiPerAnno).sort((a, b) => Number(a) - Number(b)).map(anno => costiPerAnno[anno].macchine),
      prodotti: Object.keys(costiPerAnno).sort((a, b) => Number(a) - Number(b)).map(anno => costiPerAnno[anno].prodotti),
      cantina: Object.keys(costiPerAnno).sort((a, b) => Number(a) - Number(b)).map(anno => costiPerAnno[anno].cantina),
      altro: Object.keys(costiPerAnno).sort((a, b) => Number(a) - Number(b)).map(anno => costiPerAnno[anno].altro),
      totale: Object.keys(costiPerAnno).sort((a, b) => Number(a) - Number(b)).map(anno => costiPerAnno[anno].totale)
    };
  } catch (error) {
    return { anni: [], manodopera: [], macchine: [], prodotti: [], cantina: [], altro: [], totale: [] };
  }
}

export default {
  calcolaEAggiornaStatistiche,
  getStatisticheAggregate,
  invalidaStatistiche,
  getProduzioneTemporaleAggregata,
  getCostiTemporaleAggregati
};
