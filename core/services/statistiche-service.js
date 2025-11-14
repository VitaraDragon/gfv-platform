/**
 * Statistiche Service - Servizio per statistiche e aggregazioni
 * Calcola metriche e aggregazioni sulle attività
 * 
 * @module core/services/statistiche-service
 */

import { getCollectionData } from './firebase-service.js';
import { getCurrentTenantId } from './tenant-service.js';
import { getAllTerreni } from './terreni-service.js';
import { getAllAttivita } from './attivita-service.js';

/**
 * Ottieni totale terreni
 * @returns {Promise<number>} Numero totale terreni
 */
export async function getTotaleTerreni() {
  try {
    const terreni = await getAllTerreni();
    return terreni.length;
  } catch (error) {
    console.error('Errore calcolo totale terreni:', error);
    return 0;
  }
}

/**
 * Ottieni totale ore lavorate in un periodo
 * @param {Object} periodo - Periodo
 * @param {string} periodo.dataDa - Data inizio (YYYY-MM-DD)
 * @param {string} periodo.dataA - Data fine (YYYY-MM-DD)
 * @param {string} periodo.terrenoId - Filtra per terreno (opzionale)
 * @param {string} periodo.tipoLavoro - Filtra per tipo lavoro (opzionale)
 * @returns {Promise<number>} Totale ore lavorate
 */
export async function getTotaleOre(periodo = {}) {
  try {
    const attivita = await getAllAttivita({
      ...periodo,
      orderBy: 'data',
      orderDirection: 'desc'
    });
    
    const totaleOre = attivita.reduce((sum, att) => sum + (att.oreNette || 0), 0);
    return parseFloat(totaleOre.toFixed(2));
  } catch (error) {
    console.error('Errore calcolo totale ore:', error);
    return 0;
  }
}

/**
 * Ottieni totale attività in un periodo
 * @param {Object} periodo - Periodo
 * @param {string} periodo.dataDa - Data inizio (YYYY-MM-DD)
 * @param {string} periodo.dataA - Data fine (YYYY-MM-DD)
 * @param {string} periodo.terrenoId - Filtra per terreno (opzionale)
 * @param {string} periodo.tipoLavoro - Filtra per tipo lavoro (opzionale)
 * @returns {Promise<number>} Numero totale attività
 */
export async function getTotaleAttivita(periodo = {}) {
  try {
    const attivita = await getAllAttivita({
      ...periodo,
      orderBy: 'data',
      orderDirection: 'desc'
    });
    
    return attivita.length;
  } catch (error) {
    console.error('Errore calcolo totale attività:', error);
    return 0;
  }
}

/**
 * Ottieni ore lavorate per tipo lavoro
 * @param {Object} periodo - Periodo
 * @param {string} periodo.dataDa - Data inizio (YYYY-MM-DD)
 * @param {string} periodo.dataA - Data fine (YYYY-MM-DD)
 * @returns {Promise<Array>} Array di {tipoLavoro: string, ore: number}
 */
export async function getOrePerTipoLavoro(periodo = {}) {
  try {
    const attivita = await getAllAttivita({
      ...periodo,
      orderBy: 'data',
      orderDirection: 'desc'
    });
    
    const orePerTipo = {};
    
    attivita.forEach(att => {
      const tipo = att.tipoLavoro || 'Non specificato';
      if (!orePerTipo[tipo]) {
        orePerTipo[tipo] = 0;
      }
      orePerTipo[tipo] += att.oreNette || 0;
    });
    
    // Converti in array e ordina per ore decrescenti
    return Object.entries(orePerTipo)
      .map(([tipoLavoro, ore]) => ({
        tipoLavoro,
        ore: parseFloat(ore.toFixed(2))
      }))
      .sort((a, b) => b.ore - a.ore);
  } catch (error) {
    console.error('Errore calcolo ore per tipo lavoro:', error);
    return [];
  }
}

/**
 * Ottieni attività per terreno
 * @param {Object} periodo - Periodo
 * @param {string} periodo.dataDa - Data inizio (YYYY-MM-DD)
 * @param {string} periodo.dataA - Data fine (YYYY-MM-DD)
 * @returns {Promise<Array>} Array di {terrenoNome: string, numeroAttivita: number, oreTotali: number}
 */
export async function getAttivitaPerTerreno(periodo = {}) {
  try {
    const attivita = await getAllAttivita({
      ...periodo,
      orderBy: 'data',
      orderDirection: 'desc'
    });
    
    const attivitaPerTerreno = {};
    
    attivita.forEach(att => {
      const terrenoNome = att.terrenoNome || 'Non specificato';
      if (!attivitaPerTerreno[terrenoNome]) {
        attivitaPerTerreno[terrenoNome] = {
          terrenoNome,
          numeroAttivita: 0,
          oreTotali: 0
        };
      }
      attivitaPerTerreno[terrenoNome].numeroAttivita++;
      attivitaPerTerreno[terrenoNome].oreTotali += att.oreNette || 0;
    });
    
    // Converti in array e ordina per numero attività decrescente
    return Object.values(attivitaPerTerreno)
      .map(item => ({
        ...item,
        oreTotali: parseFloat(item.oreTotali.toFixed(2))
      }))
      .sort((a, b) => b.numeroAttivita - a.numeroAttivita);
  } catch (error) {
    console.error('Errore calcolo attività per terreno:', error);
    return [];
  }
}

/**
 * Ottieni ore lavorate per mese
 * @param {Object} periodo - Periodo
 * @param {string} periodo.dataDa - Data inizio (YYYY-MM-DD)
 * @param {string} periodo.dataA - Data fine (YYYY-MM-DD)
 * @returns {Promise<Array>} Array di {mese: string, ore: number} (mese formato YYYY-MM)
 */
export async function getOrePerMese(periodo = {}) {
  try {
    const attivita = await getAllAttivita({
      ...periodo,
      orderBy: 'data',
      orderDirection: 'asc'
    });
    
    const orePerMese = {};
    
    attivita.forEach(att => {
      if (!att.data) return;
      
      // Estrai anno-mese da data (YYYY-MM-DD -> YYYY-MM)
      const mese = att.data.substring(0, 7);
      
      if (!orePerMese[mese]) {
        orePerMese[mese] = 0;
      }
      orePerMese[mese] += att.oreNette || 0;
    });
    
    // Converti in array e ordina per mese crescente
    return Object.entries(orePerMese)
      .map(([mese, ore]) => ({
        mese,
        ore: parseFloat(ore.toFixed(2))
      }))
      .sort((a, b) => a.mese.localeCompare(b.mese));
  } catch (error) {
    console.error('Errore calcolo ore per mese:', error);
    return [];
  }
}

/**
 * Ottieni tipi lavoro più frequenti
 * @param {Object} periodo - Periodo
 * @param {string} periodo.dataDa - Data inizio (YYYY-MM-DD)
 * @param {string} periodo.dataA - Data fine (YYYY-MM-DD)
 * @param {number} limit - Numero massimo risultati (default: 5)
 * @returns {Promise<Array>} Array di {tipoLavoro: string, frequenza: number}
 */
export async function getTipiLavoroPiuFrequenti(periodo = {}, limit = 5) {
  try {
    const attivita = await getAllAttivita({
      ...periodo,
      orderBy: 'data',
      orderDirection: 'desc'
    });
    
    const frequenza = {};
    
    attivita.forEach(att => {
      const tipo = att.tipoLavoro || 'Non specificato';
      frequenza[tipo] = (frequenza[tipo] || 0) + 1;
    });
    
    // Converti in array, ordina per frequenza decrescente e limita
    return Object.entries(frequenza)
      .map(([tipoLavoro, frequenza]) => ({
        tipoLavoro,
        frequenza
      }))
      .sort((a, b) => b.frequenza - a.frequenza)
      .slice(0, limit);
  } catch (error) {
    console.error('Errore calcolo tipi lavoro più frequenti:', error);
    return [];
  }
}

/**
 * Ottieni statistiche complete per dashboard
 * @param {Object} periodo - Periodo
 * @param {string} periodo.dataDa - Data inizio (YYYY-MM-DD)
 * @param {string} periodo.dataA - Data fine (YYYY-MM-DD)
 * @returns {Promise<Object>} Oggetto con tutte le statistiche
 */
export async function getStatisticheComplete(periodo = {}) {
  try {
    const [
      totaleTerreni,
      totaleOre,
      totaleAttivita,
      orePerTipoLavoro,
      attivitaPerTerreno,
      orePerMese,
      tipiLavoroPiuFrequenti
    ] = await Promise.all([
      getTotaleTerreni(),
      getTotaleOre(periodo),
      getTotaleAttivita(periodo),
      getOrePerTipoLavoro(periodo),
      getAttivitaPerTerreno(periodo),
      getOrePerMese(periodo),
      getTipiLavoroPiuFrequenti(periodo)
    ]);
    
    return {
      totaleTerreni,
      totaleOre,
      totaleAttivita,
      orePerTipoLavoro,
      attivitaPerTerreno,
      orePerMese,
      tipiLavoroPiuFrequenti
    };
  } catch (error) {
    console.error('Errore calcolo statistiche complete:', error);
    throw new Error(`Errore calcolo statistiche: ${error.message}`);
  }
}

// Export default
export default {
  getTotaleTerreni,
  getTotaleOre,
  getTotaleAttivita,
  getOrePerTipoLavoro,
  getAttivitaPerTerreno,
  getOrePerMese,
  getTipiLavoroPiuFrequenti,
  getStatisticheComplete
};




