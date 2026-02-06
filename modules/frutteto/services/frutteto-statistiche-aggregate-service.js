/**
 * Frutteto Statistiche Aggregate Service - Servizio per aggregazioni pre-calcolate
 * Mantiene statistiche aggregate in Firestore per performance ottimali
 *
 * @module modules/frutteto/services/frutteto-statistiche-aggregate-service
 */

import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import {
  getDocumentData,
  dateToTimestamp,
  getDocument
} from '../../../core/services/firebase-service.js';
import { getRaccolte } from './raccolta-frutta-service.js';
import { aggregaSpeseFruttetoAnno } from './lavori-frutteto-service.js';

const STATS_COLLECTION = 'statistiche_frutteto';

function getStatsPath(fruttetoId, anno) {
  return `${STATS_COLLECTION}/${fruttetoId}_${anno}`;
}

/**
 * Calcola e salva statistiche aggregate per un frutteto/anno
 * @param {string} fruttetoId - ID frutteto
 * @param {number} anno - Anno
 * @returns {Promise<Object>} Statistiche aggregate
 */
export async function calcolaEAggiornaStatistiche(fruttetoId, anno) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }

    const raccolte = await getRaccolte(fruttetoId, { anno, orderBy: 'data', orderDirection: 'desc' });
    const spese = await aggregaSpeseFruttetoAnno(fruttetoId, anno);

    let produzioneTotaleKg = 0;
    let speseRaccoltaAnno = 0;
    let scartoTotaleKg = 0;
    const scartoPerCategoria = {};
    let numeroRaccolte = raccolte.length;
    let dataUltimaRaccolta = null;
    const produzionePerMese = {};
    const resaPerSpecie = {};
    const spesePerMese = {};
    const qualitaPerSpecie = {};

    raccolte.forEach(raccolta => {
      const quantitaKg = raccolta.quantitaKg || 0;
      const costoTotale = raccolta.costoTotale || 0;

      produzioneTotaleKg += quantitaKg;
      speseRaccoltaAnno += costoTotale;
      scartoTotaleKg += raccolta.scartoTotaleKg || 0;
      const spc = raccolta.scartoPerCategoria || {};
      Object.keys(spc).forEach(cat => {
        scartoPerCategoria[cat] = (scartoPerCategoria[cat] || 0) + (parseFloat(spc[cat]) || 0);
      });

      const data = raccolta.data instanceof Date
        ? raccolta.data
        : (raccolta.data?.toDate ? raccolta.data.toDate() : new Date(raccolta.data));
      if (!isNaN(data.getTime())) {
        const meseKey = `${anno}-${String(data.getMonth() + 1).padStart(2, '0')}`;
        produzionePerMese[meseKey] = (produzionePerMese[meseKey] || 0) + quantitaKg;
        spesePerMese[meseKey] = (spesePerMese[meseKey] || 0) + costoTotale;
        if (!dataUltimaRaccolta || data > dataUltimaRaccolta) {
          dataUltimaRaccolta = data;
        }
      }

      const specie = raccolta.specie || raccolta.varieta || 'Sconosciuta';
      if (!resaPerSpecie[specie]) {
        resaPerSpecie[specie] = { quantitaKg: 0, superficieHa: 0, resaKgHa: 0 };
      }
      resaPerSpecie[specie].quantitaKg += quantitaKg;
      resaPerSpecie[specie].superficieHa += raccolta.quantitaEttari || 0;

      if (!qualitaPerSpecie[specie]) {
        qualitaPerSpecie[specie] = {
          calibro: {},
          gradoMaturazione: {},
          colore: {},
          quantitaKg: 0
        };
      }
      const q = qualitaPerSpecie[specie];
      const cal = typeof raccolta.calibro === 'string' ? raccolta.calibro.trim() : raccolta.calibro;
      const mat = typeof raccolta.gradoMaturazione === 'string' ? raccolta.gradoMaturazione.trim() : raccolta.gradoMaturazione;
      const col = typeof raccolta.colore === 'string' ? raccolta.colore.trim() : raccolta.colore;
      if (cal) q.calibro[cal] = (q.calibro[cal] || 0) + (quantitaKg || 0);
      if (mat) q.gradoMaturazione[mat] = (q.gradoMaturazione[mat] || 0) + (quantitaKg || 0);
      if (col) q.colore[col] = (q.colore[col] || 0) + (quantitaKg || 0);
      q.quantitaKg += quantitaKg || 0;
    });

    Object.keys(resaPerSpecie).forEach(specie => {
      const d = resaPerSpecie[specie];
      if (d.superficieHa > 0) {
        d.resaKgHa = parseFloat((d.quantitaKg / d.superficieHa).toFixed(2));
      }
    });

    Object.keys(scartoPerCategoria).forEach(cat => {
      scartoPerCategoria[cat] = parseFloat((scartoPerCategoria[cat] || 0).toFixed(2));
    });
    const statsData = {
      fruttetoId,
      anno,
      produzioneTotaleKg: parseFloat(produzioneTotaleKg.toFixed(2)),
      numeroRaccolte,
      dataUltimaRaccolta: dataUltimaRaccolta ? dateToTimestamp(dataUltimaRaccolta) : null,
      produzionePerMese,
      resaPerSpecie,
      speseRaccoltaAnno: parseFloat(speseRaccoltaAnno.toFixed(2)),
      spesePerMese,
      speseManodoperaAnno: spese.speseManodoperaAnno || 0,
      speseMacchineAnno: spese.speseMacchineAnno || 0,
      speseProdottiAnno: spese.speseProdottiAnno || 0,
      speseTotaleAnno: spese.speseTotaleAnno || 0,
      costoTotaleAnno: spese.speseTotaleAnno || 0,
      qualitaFrutta: qualitaPerSpecie,
      scartoTotaleKg: parseFloat(scartoTotaleKg.toFixed(2)),
      scartoPerCategoria: { ...scartoPerCategoria }
    };

    const { setDoc, serverTimestamp } = await import('../../../core/services/firebase-service.js');
    const docId = `${fruttetoId}_${anno}`;
    const docRef = getDocument(STATS_COLLECTION, docId, tenantId);
    await setDoc(docRef, { ...statsData, updatedAt: serverTimestamp() }, { merge: true });
    return statsData;
  } catch (error) {
    throw error;
  }
}

/**
 * Ottieni statistiche aggregate (da documento pre-calcolato o calcola se non esiste)
 * @param {string} fruttetoId - ID frutteto
 * @param {number} anno - Anno
 * @param {boolean} forceRecalculate - Forza ricalcolo (default: false)
 * @returns {Promise<Object>} Statistiche aggregate
 */
export async function getStatisticheAggregate(fruttetoId, anno, forceRecalculate = false) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    if (!forceRecalculate) {
      try {
        const docData = await getDocumentData(STATS_COLLECTION, `${fruttetoId}_${anno}`, tenantId);
        if (docData) {
          if (docData.dataUltimaRaccolta && docData.dataUltimaRaccolta.toDate) {
            docData.dataUltimaRaccolta = docData.dataUltimaRaccolta.toDate();
          } else if (docData.dataUltimaRaccolta) {
            docData.dataUltimaRaccolta = new Date(docData.dataUltimaRaccolta);
          }
          return docData;
        }
      } catch (err) {
        if (!err.message || !err.message.includes('permissions')) {
          throw err;
        }
      }
    }
    return await calcolaEAggiornaStatistiche(fruttetoId, anno);
  } catch (error) {
    return await calcolaEAggiornaStatistiche(fruttetoId, anno);
  }
}

/**
 * Invalida statistiche aggregate per un frutteto/anno
 * @param {string} fruttetoId - ID frutteto
 * @param {number} anno - Anno (opzionale)
 */
export async function invalidaStatistiche(fruttetoId, anno = null) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) return;
    const { deleteDocument } = await import('../../../core/services/firebase-service.js');
    if (anno) {
      await deleteDocument(STATS_COLLECTION, `${fruttetoId}_${anno}`, tenantId);
    } else {
      const annoCorrente = new Date().getFullYear();
      for (let i = 0; i < 6; i++) {
        try {
          await deleteDocument(STATS_COLLECTION, `${fruttetoId}_${annoCorrente - i}`, tenantId);
        } catch (e) {}
      }
    }
  } catch (error) {}
}

/**
 * Produzione temporale da aggregazioni (ultimi N anni)
 * @param {string} fruttetoId - ID frutteto
 * @param {number} anniIndietro - Anni (default: 3)
 * @returns {Promise<Object>} { anni, produzione }
 */
export async function getProduzioneTemporaleAggregata(fruttetoId, anniIndietro = 3) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
    const annoCorrente = new Date().getFullYear();
    const annoInizio = annoCorrente - anniIndietro + 1;
    const produzionePerAnno = {};
    for (let anno = annoInizio; anno <= annoCorrente; anno++) {
      produzionePerAnno[anno] = 0;
    }
    const promises = [];
    for (let anno = annoInizio; anno <= annoCorrente; anno++) {
      promises.push(
        getStatisticheAggregate(fruttetoId, anno, false).then(stats => ({
          anno,
          produzione: stats.produzioneTotaleKg || 0
        }))
      );
    }
    const risultati = await Promise.all(promises);
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
 * Costi temporale da aggregazioni (ultimi N anni)
 * @param {string} fruttetoId - ID frutteto
 * @param {number} anniIndietro - Anni (default: 3)
 * @returns {Promise<Object>} { anni, manodopera, macchine, prodotti, cantina, altro, totale }
 */
export async function getCostiTemporaleAggregati(fruttetoId, anniIndietro = 3) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
    const annoCorrente = new Date().getFullYear();
    const annoInizio = annoCorrente - anniIndietro + 1;
    const costiPerAnno = {};
    for (let anno = annoInizio; anno <= annoCorrente; anno++) {
      costiPerAnno[anno] = { manodopera: 0, macchine: 0, prodotti: 0, cantina: 0, altro: 0, totale: 0 };
    }
    const promises = [];
    for (let anno = annoInizio; anno <= annoCorrente; anno++) {
      promises.push(
        getStatisticheAggregate(fruttetoId, anno, false).then(stats => ({
          anno,
          spese: {
            manodopera: stats.speseManodoperaAnno || 0,
            macchine: stats.speseMacchineAnno || 0,
            prodotti: stats.speseProdottiAnno || 0,
            cantina: 0,
            altro: 0,
            totale: stats.speseTotaleAnno || stats.costoTotaleAnno || 0
          }
        }))
      );
    }
    const risultati = await Promise.all(promises);
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
