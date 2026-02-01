/**
 * Frutteto Statistiche Service - Servizio per aggregazione statistiche frutteto
 * Fornisce dati aggregati per dashboard e report
 * 
 * @module modules/frutteto/services/frutteto-statistiche-service
 */

import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { getAllFrutteti, getFrutteto } from './frutteti-service.js';
import { getRaccolte } from './raccolta-frutta-service.js';
import { getLavoriPerTerreno, aggregaSpeseFruttetoAnno, getAttivitaDirettePerTerreno } from './lavori-frutteto-service.js';
import {
  getCollectionData,
  getDb,
  dateToTimestamp
} from '../../../core/services/firebase-service.js';
import { RaccoltaFrutta } from '../models/RaccoltaFrutta.js';
import {
  getStatisticheAggregate,
  getProduzioneTemporaleAggregata,
  getCostiTemporaleAggregati
} from './frutteto-statistiche-aggregate-service.js';

/**
 * Ottieni statistiche aggregate per un frutteto specifico
 * @param {string} fruttetoId - ID frutteto (opzionale, se null aggrega tutti i frutteti)
 * @param {number} anno - Anno (opzionale, default: anno corrente)
 * @returns {Promise<Object>} Statistiche aggregate
 */
export async function getStatisticheFrutteto(fruttetoId = null, anno = null) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const annoTarget = anno || new Date().getFullYear();
    
    // Se fruttetoId specificato, carica solo quel frutteto
    // Altrimenti carica tutti i frutteti
    let frutteti = [];
    if (fruttetoId) {
      const frutteto = await getFrutteto(fruttetoId);
      if (frutteto) {
        frutteti = [frutteto];
      }
    } else {
      frutteti = await getAllFrutteti();
    }
    
    if (frutteti.length === 0) {
      return {
        produzioneTotaleKg: 0,
        resaMediaKgHa: 0,
        speseRaccoltaAnno: 0,
        speseTotaleAnno: 0,
        costoTotaleAnno: 0,
        numeroFrutteti: 0,
        numeroRaccolte: 0,
        dataUltimaRaccolta: null,
        produzionePerMese: {},
        resaPerSpecie: {},
        spesePerMese: {},
        superficieTotale: 0,
        scartoTotaleKg: 0,
        scartoPerCategoria: {}
      };
    }

    // Singolo frutteto: usa aggregazioni pre-calcolate se disponibili
    if (fruttetoId && frutteti.length === 1) {
      try {
        const stats = await getStatisticheAggregate(fruttetoId, annoTarget, false);
        const frutteto = frutteti[0];
        const superficieTotale = frutteto.superficieEttari || 0;
        const resaMediaKgHa = superficieTotale > 0
          ? parseFloat((stats.produzioneTotaleKg / superficieTotale).toFixed(2))
          : 0;
        const speseAgg = await aggregaSpeseFruttetoAnno(fruttetoId, annoTarget);
        const costoTotaleAnno = speseAgg.costoTotaleAnno ?? speseAgg.speseTotaleAnno ?? 0;
        const dataUltima = stats.dataUltimaRaccolta
          ? (stats.dataUltimaRaccolta.toDate ? stats.dataUltimaRaccolta.toDate() : new Date(stats.dataUltimaRaccolta))
          : null;
        return {
          produzioneTotaleKg: stats.produzioneTotaleKg || 0,
          resaMediaKgHa,
          speseRaccoltaAnno: stats.speseRaccoltaAnno || 0,
          speseTotaleAnno: parseFloat(costoTotaleAnno.toFixed(2)),
          costoTotaleAnno: parseFloat(costoTotaleAnno.toFixed(2)),
          numeroFrutteti: 1,
          numeroRaccolte: stats.numeroRaccolte || 0,
          dataUltimaRaccolta: dataUltima,
          produzionePerMese: stats.produzionePerMese || {},
          resaPerSpecie: stats.resaPerSpecie || {},
          spesePerMese: stats.spesePerMese || {},
          superficieTotale: parseFloat(superficieTotale.toFixed(2)),
          scartoTotaleKg: stats.scartoTotaleKg || 0,
          scartoPerCategoria: stats.scartoPerCategoria || {}
        };
      } catch (error) {
        // Continua con calcolo al volo
      }
    }

    // Calcola statistiche da raccolte e lavori
    let produzioneTotaleKg = 0;
    let speseRaccoltaAnno = 0;
    let speseTotaleAnno = 0;
    let numeroRaccolte = 0;
    let dataUltimaRaccolta = null;
    const produzionePerMese = {};
    const resaPerSpecie = {};
    const spesePerMese = {};
    const scartoPerCategoria = {};
    let superficieTotale = 0;
    let scartoTotaleKg = 0;

    for (const frutteto of frutteti) {
      superficieTotale += frutteto.superficieEttari || 0;

      // Carica raccolte dell'anno
      const raccolte = await getRaccolte(frutteto.id, {
        anno: annoTarget,
        orderBy: 'data',
        orderDirection: 'desc'
      });

      numeroRaccolte += raccolte.length;

      // Aggrega produzione, spese e scarto da raccolte
      raccolte.forEach(raccolta => {
        const quantitaKg = raccolta.quantitaKg || 0;
        const costoTotaleRaccolta = raccolta.costoTotale || 0;

        produzioneTotaleKg += quantitaKg;
        speseRaccoltaAnno += costoTotaleRaccolta;
        scartoTotaleKg += raccolta.scartoTotaleKg || 0;
        const spc = raccolta.scartoPerCategoria || {};
        Object.keys(spc).forEach(cat => {
          scartoPerCategoria[cat] = (scartoPerCategoria[cat] || 0) + (parseFloat(spc[cat]) || 0);
        });

        // Produzione per mese
        if (raccolta.data) {
          const data = raccolta.data instanceof Date ? raccolta.data : (raccolta.data?.toDate ? raccolta.data.toDate() : new Date(raccolta.data));
          if (!isNaN(data.getTime())) {
            const mese = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
            produzionePerMese[mese] = (produzionePerMese[mese] || 0) + quantitaKg;
            spesePerMese[mese] = (spesePerMese[mese] || 0) + costoTotaleRaccolta;
          }
        }

        // Resa per specie (superficie da quantitaEttari della raccolta)
        const specie = raccolta.specie || raccolta.varieta || 'Sconosciuta';
        if (!resaPerSpecie[specie]) {
          resaPerSpecie[specie] = {
            quantitaKg: 0,
            superficieHa: 0,
            resaKgHa: 0
          };
        }
        resaPerSpecie[specie].quantitaKg += quantitaKg;
        resaPerSpecie[specie].superficieHa += raccolta.quantitaEttari || 0;
        
        // Data ultima raccolta
        if (raccolta.data) {
          const data = raccolta.data instanceof Date ? raccolta.data : (raccolta.data?.toDate ? raccolta.data.toDate() : new Date(raccolta.data));
          if (!isNaN(data.getTime()) && (!dataUltimaRaccolta || data > dataUltimaRaccolta)) {
            dataUltimaRaccolta = data;
          }
        }
      });
      
      // Carica spese totali (lavori + attività dirette del diario) con aggregaSpeseFruttetoAnno
      if (frutteto.terrenoId) {
        const speseFrutteto = await aggregaSpeseFruttetoAnno(frutteto.id, annoTarget);
        speseTotaleAnno += speseFrutteto.speseTotaleAnno || 0;

        // Spese per mese dai soli lavori (per grafici; le attività diario non sono per-mese qui)
        const { getLavoriPerTerreno, calcolaCostiLavoro } = await import('./lavori-frutteto-service.js');
        const lavori = await getLavoriPerTerreno(frutteto.terrenoId, {
          anno: annoTarget,
          stato: 'completato'
        });
        for (const lavoro of lavori) {
          const costi = await calcolaCostiLavoro(lavoro.id, lavoro);
          if (lavoro.dataInizio || lavoro.dataInizioRaw) {
            const data = lavoro.dataInizioRaw?.toDate ? lavoro.dataInizioRaw.toDate() : (lavoro.dataInizio instanceof Date ? lavoro.dataInizio : (lavoro.dataInizio ? new Date(lavoro.dataInizio) : null));
            if (data && !isNaN(data.getTime())) {
              const mese = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
              spesePerMese[mese] = (spesePerMese[mese] || 0) + (costi.costoTotale || 0);
            }
          }
        }
      }
    }
    
    // Calcola resa per specie
    Object.keys(resaPerSpecie).forEach(specie => {
      const dati = resaPerSpecie[specie];
      if (dati.superficieHa > 0) {
        dati.resaKgHa = parseFloat((dati.quantitaKg / dati.superficieHa).toFixed(2));
      }
    });
    
    const resaMediaKgHa = superficieTotale > 0 
      ? parseFloat((produzioneTotaleKg / superficieTotale).toFixed(2))
      : 0;
    
    const costoTotaleAnno = parseFloat(speseTotaleAnno.toFixed(2));
    Object.keys(scartoPerCategoria).forEach(cat => {
      scartoPerCategoria[cat] = parseFloat(scartoPerCategoria[cat].toFixed(2));
    });
    return {
      produzioneTotaleKg: parseFloat(produzioneTotaleKg.toFixed(2)),
      resaMediaKgHa: resaMediaKgHa,
      speseRaccoltaAnno: parseFloat(speseRaccoltaAnno.toFixed(2)),
      speseTotaleAnno: costoTotaleAnno,
      costoTotaleAnno,
      numeroFrutteti: frutteti.length,
      numeroRaccolte: numeroRaccolte,
      dataUltimaRaccolta: dataUltimaRaccolta,
      produzionePerMese: produzionePerMese,
      resaPerSpecie: resaPerSpecie,
      spesePerMese: spesePerMese,
      superficieTotale: parseFloat(superficieTotale.toFixed(2)),
      scartoTotaleKg: parseFloat(scartoTotaleKg.toFixed(2)),
      scartoPerCategoria: { ...scartoPerCategoria }
    };
  } catch (error) {
    console.error('[FRUTTETO-STATISTICHE] Errore recupero statistiche:', error);
    throw new Error(`Errore recupero statistiche: ${error.message}`);
  }
}

/**
 * Ottieni raccolte recenti per un frutteto (o tutti i frutteti)
 * @param {string} fruttetoId - ID frutteto (opzionale, se null carica da tutti i frutteti)
 * @param {number} anno - Anno (opzionale, default: anno corrente)
 * @param {number} limit - Numero massimo di raccolte (default: 10)
 * @returns {Promise<Array>} Array di raccolte con dati frutteto
 */
export async function getRaccolteRecenti(fruttetoId = null, anno = null, limit = 10) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const annoTarget = anno || new Date().getFullYear();
    
    // Se fruttetoId specificato, carica solo da quel frutteto
    // Altrimenti carica da tutti i frutteti
    let frutteti = [];
    if (fruttetoId) {
      const frutteto = await getFrutteto(fruttetoId);
      if (frutteto) {
        frutteti = [frutteto];
      }
    } else {
      frutteti = await getAllFrutteti();
    }
    
    // Carica tutte le raccolte da tutti i frutteti
    const tutteRaccolte = [];
    for (const frutteto of frutteti) {
      const raccolte = await getRaccolte(frutteto.id, { 
        anno: annoTarget, 
        orderBy: 'data', 
        orderDirection: 'desc' 
      });
      
      // Aggiungi informazioni frutteto a ogni raccolta
      raccolte.forEach(raccolta => {
        tutteRaccolte.push({
          ...raccolta,
          fruttetoNome: frutteto.specie || frutteto.varieta || 'Frutteto',
          fruttetoId: frutteto.id
        });
      });
    }
    
    // Ordina per data (più recente prima) e limita
    tutteRaccolte.sort((a, b) => {
      const dataA = a.data instanceof Date ? a.data : (a.data?.toDate ? a.data.toDate() : new Date(a.data));
      const dataB = b.data instanceof Date ? b.data : (b.data?.toDate ? b.data.toDate() : new Date(b.data));
      return dataB - dataA;
    });
    
    return tutteRaccolte.slice(0, limit);
  } catch (error) {
    console.error('[FRUTTETO-STATISTICHE] Errore recupero raccolte recenti:', error);
    return [];
  }
}

/**
 * Ottieni lavori e attività dirette del diario collegati a un frutteto (tramite terreno)
 * @param {string} fruttetoId - ID frutteto (opzionale, se null carica da tutti i frutteti)
 * @param {number} anno - Anno (opzionale, default: anno corrente)
 * @param {string} stato - Stato lavori ('in_corso' | 'completato', default: 'completato')
 * @param {number} limit - Numero massimo di elementi (opzionale)
 * @returns {Promise<Array>} Array di lavori e attività con dati frutteto (source: 'lavoro' | 'diario')
 */
export async function getLavoriFrutteto(fruttetoId = null, anno = null, stato = 'completato', limit = null) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const annoTarget = anno || new Date().getFullYear();
    
    let frutteti = [];
    if (fruttetoId) {
      const frutteto = await getFrutteto(fruttetoId);
      if (frutteto) {
        frutteti = [frutteto];
      }
    } else {
      frutteti = await getAllFrutteti();
    }
    
    const tuttiLavori = [];
    for (const frutteto of frutteti) {
      if (!frutteto.terrenoId) continue;
      
      const lavori = await getLavoriPerTerreno(frutteto.terrenoId, {
        anno: annoTarget,
        stato: stato
      });
      
      lavori.forEach(lavoro => {
        tuttiLavori.push({
          ...lavoro,
          fruttetoNome: frutteto.specie || frutteto.varieta || 'Frutteto',
          fruttetoId: frutteto.id,
          source: 'lavoro'
        });
      });
      
      // Includi anche attività dirette del diario (senza lavoroId)
      const attivitaDirette = await getAttivitaDirettePerTerreno(frutteto.terrenoId, annoTarget, lavori);
      attivitaDirette.forEach(att => {
        tuttiLavori.push({
          id: att.id,
          data: att.data,
          dataInizio: att.data,
          tipoLavoro: att.tipoLavoro,
          stato: 'completato',
          costoTotale: att.costoTotale,
          fruttetoNome: frutteto.specie || frutteto.varieta || 'Frutteto',
          fruttetoId: frutteto.id,
          source: 'diario'
        });
      });
    }
    
    // Ordina per data (più recente prima)
    tuttiLavori.sort((a, b) => {
      const dataA = (a.dataInizio || a.data) ? (a.dataInizio instanceof Date ? a.dataInizio : (typeof a.data === 'string' ? new Date(a.data) : new Date(a.dataInizio || a.data || 0))) : new Date(0);
      const dataB = (b.dataInizio || b.data) ? (b.dataInizio instanceof Date ? b.dataInizio : (typeof b.data === 'string' ? new Date(b.data) : new Date(b.dataInizio || b.data || 0))) : new Date(0);
      return dataB - dataA;
    });
    
    if (limit) {
      return tuttiLavori.slice(0, limit);
    }
    return tuttiLavori;
  } catch (error) {
    console.error('[FRUTTETO-STATISTICHE] Errore recupero lavori frutteto:', error);
    return [];
  }
}

/**
 * Carica raccolte per un range di anni (una query per frutteto)
 * @param {Array<string>} fruttetoIds - ID frutteti
 * @param {number} annoInizio - Anno inizio
 * @param {number} annoFine - Anno fine
 * @returns {Promise<Map<string, Array>>} Map fruttetoId -> array raccolte
 */
async function getRaccolteRange(fruttetoIds, annoInizio, annoFine) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
  const raccolteMap = new Map();
  const inizioRange = new Date(annoInizio, 0, 1);
  const fineRange = new Date(annoFine + 1, 0, 1);
  const promesse = fruttetoIds.map(async (fid) => {
    try {
      const collectionPath = `frutteti/${fid}/raccolte`;
      const documents = await getCollectionData(collectionPath, {
        tenantId,
        orderBy: 'data',
        orderDirection: 'desc',
        where: [
          ['data', '>=', dateToTimestamp(inizioRange)],
          ['data', '<', dateToTimestamp(fineRange)]
        ]
      });
      const raccolte = documents.map(doc => RaccoltaFrutta.fromData(doc));
      raccolteMap.set(fid, raccolte);
    } catch (error) {
      raccolteMap.set(fid, []);
    }
  });
  await Promise.all(promesse);
  return raccolteMap;
}

/**
 * Produzione temporale (ultimi N anni) in kg
 * @param {string} fruttetoId - ID frutteto (opzionale, null = tutti)
 * @param {number} anniIndietro - Anni (default: 3)
 * @returns {Promise<Object>} { anni, produzione }
 */
export async function getProduzioneTemporale(fruttetoId = null, anniIndietro = 3) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
    const annoCorrente = new Date().getFullYear();
    const annoInizio = annoCorrente - anniIndietro + 1;
    let frutteti = [];
    if (fruttetoId) {
      const frutteto = await getFrutteto(fruttetoId);
      if (frutteto) frutteti = [frutteto];
    } else {
      frutteti = await getAllFrutteti();
    }
    if (frutteti.length === 0) return { anni: [], produzione: [] };
    if (fruttetoId && frutteti.length === 1) {
      try {
        return await getProduzioneTemporaleAggregata(fruttetoId, anniIndietro);
      } catch (error) {}
    }
    const fruttetoIds = frutteti.map(f => f.id);
    const raccolteMap = await getRaccolteRange(fruttetoIds, annoInizio, annoCorrente);
    const produzionePerAnno = {};
    for (let anno = annoInizio; anno <= annoCorrente; anno++) produzionePerAnno[anno] = 0;
    raccolteMap.forEach((raccolte) => {
      raccolte.forEach((r) => {
        const data = r.data instanceof Date ? r.data : (r.data?.toDate ? r.data.toDate() : new Date(r.data));
        const anno = data.getFullYear();
        if (anno >= annoInizio && anno <= annoCorrente) {
          produzionePerAnno[anno] += r.quantitaKg || 0;
        }
      });
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
 * Qualità frutta per specie/varietà (calibro, grado maturazione, colore)
 * @param {string} fruttetoId - ID frutteto (opzionale)
 * @param {number} anno - Anno (opzionale)
 * @returns {Promise<Object>} Per specie: { calibro: { S: kg, M: kg }, gradoMaturazione: {}, colore: {}, quantitaKg }
 */
export async function getQualitaFrutta(fruttetoId = null, anno = null) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
    const annoTarget = anno || new Date().getFullYear();
    let frutteti = [];
    if (fruttetoId) {
      const frutteto = await getFrutteto(fruttetoId);
      if (frutteto) frutteti = [frutteto];
    } else {
      frutteti = await getAllFrutteti();
    }
    if (frutteti.length === 0) return {};
    const hasQualitaData = (qualitaFrutta) => {
      if (!qualitaFrutta || typeof qualitaFrutta !== 'object') return false;
      return Object.values(qualitaFrutta).some((q) => {
        if (!q || typeof q !== 'object') return false;
        const c = Object.keys(q.calibro || {}).length;
        const m = Object.keys(q.gradoMaturazione || {}).length;
        const col = Object.keys(q.colore || {}).length;
        return c > 0 || m > 0 || col > 0;
      });
    };
    if (fruttetoId && frutteti.length === 1) {
      try {
        const stats = await getStatisticheAggregate(fruttetoId, annoTarget, false);
        if (stats && stats.qualitaFrutta && hasQualitaData(stats.qualitaFrutta)) {
          return stats.qualitaFrutta;
        }
      } catch (error) {}
    }
    const qualitaPerSpecie = {};
    const fruttetoIds = frutteti.map(f => f.id);
    const raccolteMap = await getRaccolteRange(fruttetoIds, annoTarget, annoTarget);
    const trimVal = (v) => (typeof v === 'string' ? v.trim() : v) || null;
    frutteti.forEach((frutteto) => {
      const raccolte = raccolteMap.get(frutteto.id) || [];
      raccolte.forEach((r) => {
        if (!r.quantitaKg || r.quantitaKg === 0) return;
        const specie = r.specie || r.varieta || 'Sconosciuta';
        if (!qualitaPerSpecie[specie]) {
          qualitaPerSpecie[specie] = { calibro: {}, gradoMaturazione: {}, colore: {}, quantitaKg: 0 };
        }
        const q = qualitaPerSpecie[specie];
        const cal = trimVal(r.calibro);
        const mat = trimVal(r.gradoMaturazione);
        const col = trimVal(r.colore);
        if (cal) q.calibro[cal] = (q.calibro[cal] || 0) + (r.quantitaKg || 0);
        if (mat) q.gradoMaturazione[mat] = (q.gradoMaturazione[mat] || 0) + (r.quantitaKg || 0);
        if (col) q.colore[col] = (q.colore[col] || 0) + (r.quantitaKg || 0);
        q.quantitaKg += r.quantitaKg || 0;
      });
    });
    return qualitaPerSpecie;
  } catch (error) {
    return {};
  }
}

/**
 * Costi temporale (ultimi N anni) per categoria
 * @param {string} fruttetoId - ID frutteto (opzionale)
 * @param {number} anniIndietro - Anni (default: 3)
 * @returns {Promise<Object>} { anni, manodopera, macchine, prodotti, cantina, altro, totale }
 */
export async function getCostiTemporale(fruttetoId = null, anniIndietro = 3) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
    const annoCorrente = new Date().getFullYear();
    const annoInizio = annoCorrente - anniIndietro + 1;
    let frutteti = [];
    if (fruttetoId) {
      const frutteto = await getFrutteto(fruttetoId);
      if (frutteto) frutteti = [frutteto];
    } else {
      frutteti = await getAllFrutteti();
    }
    if (frutteti.length === 0) {
      return { anni: [], manodopera: [], macchine: [], prodotti: [], cantina: [], altro: [], totale: [] };
    }
    if (fruttetoId && frutteti.length === 1) {
      try {
        return await getCostiTemporaleAggregati(fruttetoId, anniIndietro);
      } catch (error) {}
    }
    const costiPerAnno = {};
    for (let anno = annoInizio; anno <= annoCorrente; anno++) {
      costiPerAnno[anno] = { manodopera: 0, macchine: 0, prodotti: 0, cantina: 0, altro: 0, totale: 0 };
    }
    const promesseCosti = frutteti.map((f) =>
      Promise.all(
        Array.from({ length: anniIndietro }, (_, i) => {
          const anno = annoInizio + i;
          return aggregaSpeseFruttetoAnno(f.id, anno).then((spese) => ({ anno, spese }));
        })
      )
    );
    const risultatiPerFrutteto = await Promise.all(promesseCosti);
    risultatiPerFrutteto.forEach((risultati) => {
      risultati.forEach(({ anno, spese }) => {
        costiPerAnno[anno].manodopera += spese.speseManodoperaAnno || 0;
        costiPerAnno[anno].macchine += spese.speseMacchineAnno || 0;
        costiPerAnno[anno].prodotti += spese.speseProdottiAnno || 0;
        costiPerAnno[anno].cantina += 0;
        costiPerAnno[anno].altro += 0;
        costiPerAnno[anno].totale += spese.speseTotaleAnno || 0;
      });
    });
    return {
      anni: Object.keys(costiPerAnno).map(Number).sort((a, b) => a - b),
      manodopera: Object.keys(costiPerAnno).sort((a, b) => Number(a) - Number(b)).map((anno) => costiPerAnno[anno].manodopera),
      macchine: Object.keys(costiPerAnno).sort((a, b) => Number(a) - Number(b)).map((anno) => costiPerAnno[anno].macchine),
      prodotti: Object.keys(costiPerAnno).sort((a, b) => Number(a) - Number(b)).map((anno) => costiPerAnno[anno].prodotti),
      cantina: Object.keys(costiPerAnno).sort((a, b) => Number(a) - Number(b)).map((anno) => costiPerAnno[anno].cantina),
      altro: Object.keys(costiPerAnno).sort((a, b) => Number(a) - Number(b)).map((anno) => costiPerAnno[anno].altro),
      totale: Object.keys(costiPerAnno).sort((a, b) => Number(a) - Number(b)).map((anno) => costiPerAnno[anno].totale)
    };
  } catch (error) {
    return { anni: [], manodopera: [], macchine: [], prodotti: [], cantina: [], altro: [], totale: [] };
  }
}

/**
 * Scarto temporale (ultimi N anni) in kg
 * @param {string} fruttetoId - ID frutteto (opzionale)
 * @param {number} anniIndietro - Anni (default: 3)
 * @returns {Promise<Object>} { anni, scarto }
 */
export async function getScartoTemporale(fruttetoId = null, anniIndietro = 3) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
    const annoCorrente = new Date().getFullYear();
    const annoInizio = annoCorrente - anniIndietro + 1;
    const scartoPerAnno = {};
    for (let anno = annoInizio; anno <= annoCorrente; anno++) {
      scartoPerAnno[anno] = 0;
    }
    const promesse = [];
    for (let anno = annoInizio; anno <= annoCorrente; anno++) {
      promesse.push(getStatisticheFrutteto(fruttetoId, anno).then(stats => ({ anno, scarto: stats.scartoTotaleKg || 0 })));
    }
    const risultati = await Promise.all(promesse);
    risultati.forEach(({ anno, scarto }) => {
      scartoPerAnno[anno] += scarto;
    });
    return {
      anni: Object.keys(scartoPerAnno).map(Number).sort((a, b) => a - b),
      scarto: Object.keys(scartoPerAnno).sort((a, b) => Number(a) - Number(b)).map(anno => scartoPerAnno[anno])
    };
  } catch (error) {
    return { anni: [], scarto: [] };
  }
}

export default {
  getStatisticheFrutteto,
  getRaccolteRecenti,
  getLavoriFrutteto,
  getProduzioneTemporale,
  getQualitaFrutta,
  getCostiTemporale,
  getScartoTemporale
};
