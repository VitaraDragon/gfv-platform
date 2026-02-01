/**
 * Vigneto Statistiche Service - Servizio per aggregazione statistiche vigneto
 * Fornisce dati aggregati per dashboard e report
 * 
 * @module modules/vigneto/services/vigneto-statistiche-service
 */

import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { getAllVigneti, getVigneto } from './vigneti-service.js';
import { getVendemmie } from './vendemmia-service.js';
import { getLavoriPerTerreno, getAttivitaDirettePerTerreno, aggregaSpeseVignetoAnno } from './lavori-vigneto-service.js';
import { 
  getCollectionData,
  getDb,
  dateToTimestamp
} from '../../../core/services/firebase-service.js';
import { Vendemmia } from '../models/Vendemmia.js';
import { 
  getStatisticheAggregate,
  getProduzioneTemporaleAggregata,
  getCostiTemporaleAggregati
} from './vigneto-statistiche-aggregate-service.js';

/**
 * Ottieni statistiche aggregate per un vigneto specifico
 * @param {string} vignetoId - ID vigneto (opzionale, se null aggrega tutti i vigneti)
 * @param {number} anno - Anno (opzionale, default: anno corrente)
 * @returns {Promise<Object>} Statistiche aggregate
 */
export async function getStatisticheVigneto(vignetoId = null, anno = null) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const annoTarget = anno || new Date().getFullYear();
    
    // Se vignetoId specificato, carica solo quel vigneto
    // Altrimenti carica tutti i vigneti
    let vigneti = [];
    if (vignetoId) {
      const vigneto = await getVigneto(vignetoId);
      if (vigneto) {
        vigneti = [vigneto];
      }
    } else {
      vigneti = await getAllVigneti();
    }
    
    if (vigneti.length === 0) {
      return {
        produzioneTotaleQli: 0,
        resaMediaQliHa: 0,
        speseVendemmiaAnno: 0,
        costoTotaleAnno: 0,
        numeroVigneti: 0,
        numeroVendemmie: 0,
        dataUltimaVendemmia: null,
        produzionePerMese: {},
        resaPerVarieta: {},
        spesePerMese: {}
      };
    }
    
    // OTTIMIZZAZIONE: Usa aggregazioni pre-calcolate se disponibili
    // Per singolo vigneto, usa direttamente le aggregazioni (eccetto costoTotaleAnno: sempre calcolato al volo)
    if (vignetoId && vigneti.length === 1) {
      try {
        const stats = await getStatisticheAggregate(vignetoId, annoTarget, false);
        const vigneto = vigneti[0];
        const superficieTotale = vigneto.superficieEttari || 0;
        const resaMediaQliHa = superficieTotale > 0 
          ? parseFloat((stats.produzioneTotaleQli / superficieTotale).toFixed(2))
          : 0;
        // Spese totali sempre calcolate al volo (lavori + attività diario) così la dashboard non dipende da "Ricalcola spese"
        const speseAgg = await aggregaSpeseVignetoAnno(vignetoId, annoTarget);
        const costoTotaleAnno = speseAgg.costoTotaleAnno ?? 0;
        return {
          produzioneTotaleQli: stats.produzioneTotaleQli || 0,
          resaMediaQliHa: resaMediaQliHa,
          speseVendemmiaAnno: stats.speseVendemmiaAnno || 0,
          costoTotaleAnno: parseFloat(costoTotaleAnno.toFixed(2)),
          numeroVigneti: 1,
          numeroVendemmie: stats.numeroVendemmie || 0,
          dataUltimaVendemmia: stats.dataUltimaVendemmia ? (stats.dataUltimaVendemmia.toDate ? stats.dataUltimaVendemmia.toDate() : new Date(stats.dataUltimaVendemmia)) : null,
          produzionePerMese: stats.produzionePerMese || {},
          resaPerVarieta: stats.resaPerVarieta || {},
          spesePerMese: stats.spesePerMese || {},
          superficieTotale: parseFloat(superficieTotale.toFixed(2))
        };
      } catch (error) {
        // Continua con calcolo al volo
      }
    }
    
    // Per "Tutti i vigneti", prova a usare aggregazioni se disponibili
    const promesseStats = vigneti.map(async (vigneto) => {
      try {
        const stats = await getStatisticheAggregate(vigneto.id, annoTarget, false);
        return { vigneto, stats };
      } catch (error) {
        return { vigneto, stats: null };
      }
    });
    
    const risultatiStats = await Promise.all(promesseStats);
    const hasAggregates = risultatiStats.some(r => r.stats);
    
    // Se abbiamo aggregazioni per tutti i vigneti, combina i dati
    if (hasAggregates) {
      // Spese totali sempre calcolate al volo per ogni vigneto (così la dashboard non dipende da "Ricalcola spese")
      let costoTotaleAnnoAgg = 0;
      try {
        const promesseSpese = vigneti.map(v => aggregaSpeseVignetoAnno(v.id, annoTarget));
        const spesePerVigneto = await Promise.all(promesseSpese);
        spesePerVigneto.forEach(sp => { costoTotaleAnnoAgg += sp.costoTotaleAnno ?? 0; });
      } catch (e) {
        console.warn('[VIGNETO-STATISTICHE] Calcolo spese totali al volo fallito, uso aggregate:', e);
        risultatiStats.forEach(({ stats }) => {
          if (stats) costoTotaleAnnoAgg += stats.costoTotaleAnno ?? 0;
        });
      }
      // Combina aggregazioni di tutti i vigneti (resto dai documenti aggregate)
      let produzioneTotaleQliAgg = 0;
      let speseVendemmiaAnnoAgg = 0;
      let numeroVendemmieAgg = 0;
      let dataUltimaVendemmiaAgg = null;
      const produzionePerMeseAgg = {};
      const resaPerVarietaAgg = {};
      const spesePerMeseAgg = {};
      let superficieTotaleAgg = 0;
      
      risultatiStats.forEach(({ vigneto, stats }) => {
        superficieTotaleAgg += vigneto.superficieEttari || 0;
        if (stats) {
          produzioneTotaleQliAgg += stats.produzioneTotaleQli || 0;
          speseVendemmiaAnnoAgg += stats.speseVendemmiaAnno || 0;
          numeroVendemmieAgg += stats.numeroVendemmie || 0;
          
          if (stats.dataUltimaVendemmia) {
            const data = stats.dataUltimaVendemmia.toDate 
              ? stats.dataUltimaVendemmia.toDate() 
              : new Date(stats.dataUltimaVendemmia);
            if (!dataUltimaVendemmiaAgg || data > dataUltimaVendemmiaAgg) {
              dataUltimaVendemmiaAgg = data;
            }
          }
          
          // Combina produzione per mese
          Object.keys(stats.produzionePerMese || {}).forEach(mese => {
            produzionePerMeseAgg[mese] = (produzionePerMeseAgg[mese] || 0) + (stats.produzionePerMese[mese] || 0);
          });
          
          // Combina resa per varietà
          Object.keys(stats.resaPerVarieta || {}).forEach(varieta => {
            if (!resaPerVarietaAgg[varieta]) {
              resaPerVarietaAgg[varieta] = {
                quantitaQli: 0,
                superficieEttari: 0,
                resaQliHa: 0
              };
            }
            resaPerVarietaAgg[varieta].quantitaQli += stats.resaPerVarieta[varieta].quantitaQli || 0;
            resaPerVarietaAgg[varieta].superficieEttari += stats.resaPerVarieta[varieta].superficieEttari || 0;
          });
          
          // Combina spese per mese
          Object.keys(stats.spesePerMese || {}).forEach(mese => {
            spesePerMeseAgg[mese] = (spesePerMeseAgg[mese] || 0) + (stats.spesePerMese[mese] || 0);
          });
        }
      });
      
      // Calcola resa per varietà
      Object.keys(resaPerVarietaAgg).forEach(varieta => {
        const dati = resaPerVarietaAgg[varieta];
        if (dati.superficieEttari > 0) {
          dati.resaQliHa = parseFloat((dati.quantitaQli / dati.superficieEttari).toFixed(2));
        }
      });
      
      const resaMediaQliHaAgg = superficieTotaleAgg > 0 
        ? parseFloat((produzioneTotaleQliAgg / superficieTotaleAgg).toFixed(2))
        : 0;
      
      return {
        produzioneTotaleQli: parseFloat(produzioneTotaleQliAgg.toFixed(2)),
        resaMediaQliHa: resaMediaQliHaAgg,
        speseVendemmiaAnno: parseFloat(speseVendemmiaAnnoAgg.toFixed(2)),
        costoTotaleAnno: parseFloat(costoTotaleAnnoAgg.toFixed(2)),
        numeroVigneti: vigneti.length,
        numeroVendemmie: numeroVendemmieAgg,
        dataUltimaVendemmia: dataUltimaVendemmiaAgg,
        produzionePerMese: produzionePerMeseAgg,
        resaPerVarieta: resaPerVarietaAgg,
        spesePerMese: spesePerMeseAgg,
        superficieTotale: parseFloat(superficieTotaleAgg.toFixed(2))
      };
    }
    
    // Fallback: calcola da vendemmie (se aggregazioni non disponibili)
    let produzioneTotaleQli = 0;
    let speseVendemmiaAnno = 0;
    let numeroVendemmie = 0;
    let dataUltimaVendemmia = null;
    const produzionePerMese = {};
    const resaPerVarieta = {};
    const spesePerMese = {};
    let superficieTotale = 0;
    
    const vignetoIds = vigneti.map(v => v.id);
    const vendemmieMap = await getVendemmieRange(vignetoIds, annoTarget, annoTarget);
    
    vigneti.forEach(vigneto => {
      const vendemmie = vendemmieMap.get(vigneto.id) || [];
      superficieTotale += vigneto.superficieEttari || 0;
      
      vendemmie.forEach(vendemmia => {
        produzioneTotaleQli += vendemmia.quantitaQli || 0;
        speseVendemmiaAnno += vendemmia.costoTotale || 0;
        numeroVendemmie++;
        
        const dataVendemmia = vendemmia.data instanceof Date 
          ? vendemmia.data 
          : (vendemmia.data?.toDate ? vendemmia.data.toDate() : new Date(vendemmia.data));
        
        if (!dataUltimaVendemmia || dataVendemmia > dataUltimaVendemmia) {
          dataUltimaVendemmia = dataVendemmia;
        }
        
        const mese = dataVendemmia.getMonth() + 1;
        const meseKey = `${annoTarget}-${String(mese).padStart(2, '0')}`;
        produzionePerMese[meseKey] = (produzionePerMese[meseKey] || 0) + (vendemmia.quantitaQli || 0);
        spesePerMese[meseKey] = (spesePerMese[meseKey] || 0) + (vendemmia.costoTotale || 0);
        
        const varieta = vendemmia.varieta || 'Sconosciuta';
        if (!resaPerVarieta[varieta]) {
          resaPerVarieta[varieta] = { quantitaQli: 0, superficieEttari: 0, resaQliHa: 0 };
        }
        resaPerVarieta[varieta].quantitaQli += vendemmia.quantitaQli || 0;
        resaPerVarieta[varieta].superficieEttari += vendemmia.quantitaEttari || 0;
      });
    });
    
    Object.keys(resaPerVarieta).forEach(varieta => {
      const dati = resaPerVarieta[varieta];
      if (dati.superficieEttari > 0) {
        dati.resaQliHa = parseFloat((dati.quantitaQli / dati.superficieEttari).toFixed(2));
      }
    });
    
    const resaMediaQliHa = superficieTotale > 0 
      ? parseFloat((produzioneTotaleQli / superficieTotale).toFixed(2))
      : 0;
    
    // Spese totali sempre calcolate al volo anche in fallback (lavori + attività diario)
    let costoTotaleAnnoFallback = 0;
    try {
      const spesePerVigneto = await Promise.all(vigneti.map(v => aggregaSpeseVignetoAnno(v.id, annoTarget)));
      spesePerVigneto.forEach(sp => { costoTotaleAnnoFallback += sp.costoTotaleAnno ?? 0; });
    } catch (e) {
      console.warn('[VIGNETO-STATISTICHE] Calcolo spese totali in fallback fallito:', e);
    }
    
    return {
      produzioneTotaleQli: parseFloat(produzioneTotaleQli.toFixed(2)),
      resaMediaQliHa: resaMediaQliHa,
      speseVendemmiaAnno: parseFloat(speseVendemmiaAnno.toFixed(2)),
      costoTotaleAnno: parseFloat(costoTotaleAnnoFallback.toFixed(2)),
      numeroVigneti: vigneti.length,
      numeroVendemmie: numeroVendemmie,
      dataUltimaVendemmia: dataUltimaVendemmia,
      produzionePerMese: produzionePerMese,
      resaPerVarieta: resaPerVarieta,
      spesePerMese: spesePerMese,
      superficieTotale: parseFloat(superficieTotale.toFixed(2))
    };
  } catch (error) {
    throw new Error(`Errore recupero statistiche: ${error.message}`);
  }
}

/**
 * Ottieni vendemmie recenti per un vigneto (o tutti i vigneti)
 * @param {string} vignetoId - ID vigneto (opzionale, se null carica da tutti i vigneti)
 * @param {number} anno - Anno (opzionale, default: anno corrente)
 * @param {number} limit - Numero massimo di vendemmie (default: 10)
 * @returns {Promise<Array>} Array di vendemmie con dati vigneto
 */
export async function getVendemmieRecenti(vignetoId = null, anno = null, limit = 10) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const annoTarget = anno || new Date().getFullYear();
    
    // Se vignetoId specificato, carica solo da quel vigneto
    // Altrimenti carica da tutti i vigneti
    let vigneti = [];
    if (vignetoId) {
      const vigneto = await getVigneto(vignetoId);
      if (vigneto) {
        vigneti = [vigneto];
      }
    } else {
      vigneti = await getAllVigneti();
    }
    
    // Carica tutte le vendemmie da tutti i vigneti
    const tutteVendemmie = [];
    for (const vigneto of vigneti) {
      const vendemmie = await getVendemmie(vigneto.id, { 
        anno: annoTarget, 
        orderBy: 'data', 
        orderDirection: 'desc' 
      });
      
      // Aggiungi informazioni vigneto a ogni vendemmia
      vendemmie.forEach(vendemmia => {
        tutteVendemmie.push({
          ...vendemmia,
          vignetoNome: vigneto.varieta || 'Vigneto',
          vignetoId: vigneto.id
        });
      });
    }
    
    // Ordina per data (più recente prima) e limita
    tutteVendemmie.sort((a, b) => {
      const dataA = a.data instanceof Date ? a.data : (a.data?.toDate ? a.data.toDate() : new Date(a.data));
      const dataB = b.data instanceof Date ? b.data : (b.data?.toDate ? b.data.toDate() : new Date(b.data));
      return dataB - dataA;
    });
    
    return tutteVendemmie.slice(0, limit);
  } catch (error) {
    return [];
  }
}

/**
 * Ottieni lavori e attività dirette del diario collegati a un vigneto (tramite terreno)
 * @param {string} vignetoId - ID vigneto (opzionale, se null carica da tutti i vigneti)
 * @param {number} anno - Anno (opzionale, default: anno corrente)
 * @param {string} stato - Stato lavori ('in_corso' | 'completato', default: 'completato')
 * @param {number} limit - Numero massimo di elementi (opzionale)
 * @returns {Promise<Array>} Array di lavori e attività con dati vigneto (source: 'lavoro' | 'diario')
 */
export async function getLavoriVigneto(vignetoId = null, anno = null, stato = 'completato', limit = null) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const annoTarget = anno || new Date().getFullYear();
    
    let vigneti = [];
    if (vignetoId) {
      const vigneto = await getVigneto(vignetoId);
      if (vigneto) {
        vigneti = [vigneto];
      }
    } else {
      vigneti = await getAllVigneti();
    }
    
    const tuttiLavori = [];
    for (const vigneto of vigneti) {
      if (!vigneto.terrenoId) continue;

      const lavori = await getLavoriPerTerreno(vigneto.terrenoId, {
        anno: annoTarget,
        stato: stato
      });
      
      lavori.forEach(lavoro => {
        tuttiLavori.push({
          ...lavoro,
          vignetoNome: vigneto.varieta || 'Vigneto',
          vignetoId: vigneto.id,
          source: 'lavoro'
        });
      });
      
      const attivitaDirette = await getAttivitaDirettePerTerreno(vigneto.terrenoId, annoTarget, lavori);
      attivitaDirette.forEach(att => {
        tuttiLavori.push({
          id: att.id,
          data: att.data,
          dataInizio: att.data,
          tipoLavoro: att.tipoLavoro,
          stato: 'completato',
          costi: { costoTotale: att.costoTotale },
          vignetoNome: vigneto.varieta || 'Vigneto',
          vignetoId: vigneto.id,
          source: 'diario'
        });
      });
    }
    
    // Ordina per data (più recente prima)
    tuttiLavori.sort((a, b) => {
      const dataA = (a.dataInizio || a.data) ? (a.dataInizio instanceof Date ? a.dataInizio : new Date(a.dataInizio || a.data || 0)) : new Date(0);
      const dataB = (b.dataInizio || b.data) ? (b.dataInizio instanceof Date ? b.dataInizio : new Date(b.dataInizio || b.data || 0)) : new Date(0);
      return dataB - dataA;
    });
    
    if (limit) {
      return tuttiLavori.slice(0, limit);
    }
    return tuttiLavori;
  } catch (error) {
    return [];
  }
}

/**
 * Carica tutte le vendemmie per un range di anni (ottimizzato - una query per vigneto invece di N query)
 * @param {Array<string>} vignetoIds - Array di ID vigneti
 * @param {number} annoInizio - Anno inizio
 * @param {number} annoFine - Anno fine
 * @returns {Promise<Map<string, Array>>} Map con chiave vignetoId e valore array vendemmie
 */
async function getVendemmieRange(vignetoIds, annoInizio, annoFine) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    throw new Error('Nessun tenant corrente disponibile');
  }
  
  const vendemmieMap = new Map();
  
  // Carica vendemmie per ogni vigneto in parallelo (una query per vigneto con range date)
  const promesse = vignetoIds.map(async (vignetoId) => {
    try {
      const collectionPath = `vigneti/${vignetoId}/vendemmie`;
      const inizioRange = new Date(annoInizio, 0, 1);
      const fineRange = new Date(annoFine + 1, 0, 1);
      
      const documents = await getCollectionData(collectionPath, {
        tenantId,
        orderBy: 'data',
        orderDirection: 'desc',
        where: [
          ['data', '>=', dateToTimestamp(inizioRange)],
          ['data', '<', dateToTimestamp(fineRange)]
        ]
      });
      
      const vendemmie = documents.map(doc => Vendemmia.fromData(doc));
      vendemmieMap.set(vignetoId, vendemmie);
    } catch (error) {
      vendemmieMap.set(vignetoId, []);
    }
  });
  
  await Promise.all(promesse);
  return vendemmieMap;
}

/**
 * Ottieni dati produzione per grafico temporale (ultimi N anni)
 * @param {string} vignetoId - ID vigneto (opzionale, se null aggrega tutti i vigneti)
 * @param {number} anniIndietro - Numero di anni da considerare (default: 3 per performance)
 * @returns {Promise<Object>} Dati produzione per anno
 */
export async function getProduzioneTemporale(vignetoId = null, anniIndietro = 3) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const annoCorrente = new Date().getFullYear();
    const annoInizio = annoCorrente - anniIndietro + 1;
    
    let vigneti = [];
    if (vignetoId) {
      const vigneto = await getVigneto(vignetoId);
      if (vigneto) {
        vigneti = [vigneto];
      }
    } else {
      vigneti = await getAllVigneti();
    }
    
    if (vigneti.length === 0) {
      return { anni: [], produzione: [] };
    }
    
    // OTTIMIZZAZIONE: Se è un singolo vigneto, usa aggregazioni pre-calcolate
    if (vignetoId && vigneti.length === 1) {
      try {
        return await getProduzioneTemporaleAggregata(vignetoId, anniIndietro);
      } catch (error) {
        // Continua con calcolo al volo
      }
    }
    
    const vignetoIds = vigneti.map(v => v.id);
    
    // Carica tutte le vendemmie per il range di anni in una volta (ottimizzato)
    const vendemmieMap = await getVendemmieRange(vignetoIds, annoInizio, annoCorrente);
    
    const produzionePerAnno = {};
    
    // Inizializza tutti gli anni
    for (let anno = annoInizio; anno <= annoCorrente; anno++) {
      produzionePerAnno[anno] = 0;
    }
    
    // Aggrega produzione per anno (filtro lato client)
    vendemmieMap.forEach((vendemmie, vignetoId) => {
      vendemmie.forEach(vendemmia => {
        const dataVendemmia = vendemmia.data instanceof Date 
          ? vendemmia.data 
          : (vendemmia.data?.toDate ? vendemmia.data.toDate() : new Date(vendemmia.data));
        const anno = dataVendemmia.getFullYear();
        
        if (anno >= annoInizio && anno <= annoCorrente) {
          produzionePerAnno[anno] += vendemmia.quantitaQli || 0;
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
 * Ottieni dati qualità uva per grafici (gradazione, acidità, pH)
 * @param {string} vignetoId - ID vigneto (opzionale, se null aggrega tutti i vigneti)
 * @param {number} anno - Anno (opzionale, default: anno corrente)
 * @returns {Promise<Object>} Dati qualità uva
 */
export async function getQualitaUva(vignetoId = null, anno = null) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const annoTarget = anno || new Date().getFullYear();
    
    let vigneti = [];
    if (vignetoId) {
      const vigneto = await getVigneto(vignetoId);
      if (vigneto) {
        vigneti = [vigneto];
      }
    } else {
      vigneti = await getAllVigneti();
    }
    
    if (vigneti.length === 0) {
      return {};
    }
    
    // OTTIMIZZAZIONE: Se è un singolo vigneto, usa aggregazioni pre-calcolate
    if (vignetoId && vigneti.length === 1) {
      try {
        const stats = await getStatisticheAggregate(vignetoId, annoTarget, false);
        if (stats && stats.qualitaUva) {
          return stats.qualitaUva;
        }
      } catch (error) {
        // Continua con calcolo al volo
      }
    }
    
    const qualitaPerVarieta = {};
    
    // Ottimizzazione: carica vendemmie per tutti i vigneti in una volta (range anno)
    const vignetoIds = vigneti.map(v => v.id);
    const vendemmieMap = await getVendemmieRange(vignetoIds, annoTarget, annoTarget);
    
    // Processa vendemmie per ogni vigneto
    const risultatiVendemmie = vigneti.map(vigneto => ({
      vigneto,
      vendemmie: vendemmieMap.get(vigneto.id) || []
    }));
    
    // Processa tutte le vendemmie
    risultatiVendemmie.forEach(({ vigneto, vendemmie }) => {
      vendemmie.forEach(vendemmia => {
        if (!vendemmia.quantitaQli || vendemmia.quantitaQli === 0) return;
        
        const varieta = vendemmia.varieta || vigneto.varieta || 'Sconosciuta';
        
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
    });
    
    // Calcola medie per varietà
    const risultato = {};
    Object.keys(qualitaPerVarieta).forEach(varieta => {
      const dati = qualitaPerVarieta[varieta];
      risultato[varieta] = {
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
    
    return risultato;
  } catch (error) {
    return {};
  }
}

/**
 * Ottieni dati costi per grafico temporale (ultimi N anni)
 * @param {string} vignetoId - ID vigneto (opzionale, se null aggrega tutti i vigneti)
 * @param {number} anniIndietro - Numero di anni da considerare (default: 3 per performance)
 * @returns {Promise<Object>} Dati costi per anno
 */
export async function getCostiTemporale(vignetoId = null, anniIndietro = 3) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const annoCorrente = new Date().getFullYear();
    const annoInizio = annoCorrente - anniIndietro + 1;
    
    let vigneti = [];
    if (vignetoId) {
      const vigneto = await getVigneto(vignetoId);
      if (vigneto) {
        vigneti = [vigneto];
      }
    } else {
      vigneti = await getAllVigneti();
    }
    
    if (vigneti.length === 0) {
      return { anni: [], manodopera: [], macchine: [], prodotti: [], cantina: [], altro: [], totale: [] };
    }
    
    // OTTIMIZZAZIONE: Se è un singolo vigneto, usa aggregazioni pre-calcolate
    if (vignetoId && vigneti.length === 1) {
      try {
        return await getCostiTemporaleAggregati(vignetoId, anniIndietro);
      } catch (error) {
        // Continua con calcolo al volo
      }
    }
    
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
    
    // Ottimizzazione: carica costi per tutti i vigneti in parallelo (una chiamata per vigneto)
    const { aggregaSpeseVignetoAnno } = await import('./lavori-vigneto-service.js');
    
    // Crea array di promesse per caricare tutti i costi in parallelo (una per vigneto, poi aggrega per anno)
    const promesseCosti = vigneti.map(vigneto => 
      Promise.all(
        Array.from({ length: anniIndietro }, (_, i) => {
          const anno = annoInizio + i;
          return aggregaSpeseVignetoAnno(vigneto.id, anno).then(spese => ({ anno, spese }));
        })
      )
    );
    
    // Esegui tutte le chiamate in parallelo
    const risultatiPerVigneto = await Promise.all(promesseCosti);
    
    // Aggrega i risultati per anno
    risultatiPerVigneto.forEach(risultatiVigneto => {
      risultatiVigneto.forEach(({ anno, spese }) => {
        costiPerAnno[anno].manodopera += spese.speseManodoperaAnno || 0;
        costiPerAnno[anno].macchine += spese.speseMacchineAnno || 0;
        costiPerAnno[anno].prodotti += spese.speseProdottiAnno || 0;
        costiPerAnno[anno].cantina += spese.speseCantinaAnno || 0;
        costiPerAnno[anno].altro += spese.speseAltroAnno || 0;
        costiPerAnno[anno].totale += spese.costoTotaleAnno || 0;
      });
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
  getStatisticheVigneto,
  getVendemmieRecenti,
  getLavoriVigneto,
  getProduzioneTemporale,
  getQualitaUva,
  getCostiTemporale
};
