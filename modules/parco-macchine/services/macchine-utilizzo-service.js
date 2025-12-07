/**
 * Macchine Utilizzo Service - Service unificato per aggiornamento ore macchine
 * Gestisce l'aggiornamento automatico delle ore macchine da qualsiasi utilizzo
 * (Diario Attività, Segna Ore, Validazione Ore, ecc.)
 * 
 * @module modules/parco-macchine/services/macchine-utilizzo-service
 */

import { getDoc, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';

/**
 * Aggiorna ore macchina/attrezzo da qualsiasi utilizzo
 * Funzione riutilizzabile per Diario Attività, Segna Ore, Validazione Ore, ecc.
 * 
 * @param {Object} params - Parametri utilizzo
 * @param {string|null} params.macchinaId - ID trattore (opzionale)
 * @param {string|null} params.attrezzoId - ID attrezzo (opzionale)
 * @param {number} params.oreMacchina - Ore effettive macchina da aggiungere
 * @param {string} params.tenantId - ID tenant (opzionale, usa corrente se non specificato)
 * @param {Function} params.showAlertCallback - Callback per mostrare alert (opzionale)
 * @returns {Promise<Object>} Risultato aggiornamento { macchinaAggiornata: boolean, attrezzoAggiornato: boolean }
 */
export async function aggiornaOreMacchinaDaUtilizzo({
  macchinaId = null,
  attrezzoId = null,
  oreMacchina,
  tenantId = null,
  showAlertCallback = null
}) {
  // Verifica parametri
  if (!macchinaId && !attrezzoId) {
    return { macchinaAggiornata: false, attrezzoAggiornato: false };
  }
  
  if (!oreMacchina || oreMacchina <= 0) {
    return { macchinaAggiornata: false, attrezzoAggiornato: false };
  }
  
  try {
    const db = getFirestore();
    const currentTenantId = tenantId || getCurrentTenantId();
    
    if (!currentTenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    // Verifica se modulo Parco Macchine è attivo
    const tenantDoc = await getDoc(doc(db, 'tenants', currentTenantId));
    if (!tenantDoc.exists()) {
      return { macchinaAggiornata: false, attrezzoAggiornato: false };
    }
    
    const tenantData = tenantDoc.data();
    const hasParcoMacchineModule = tenantData.modules && tenantData.modules.includes('parcoMacchine');
    if (!hasParcoMacchineModule) {
      return { macchinaAggiornata: false, attrezzoAggiornato: false };
    }
    
    const result = {
      macchinaAggiornata: false,
      attrezzoAggiornato: false
    };
    
    // Aggiorna macchina (trattore) se presente
    if (macchinaId) {
      const macchinaDocRef = doc(db, 'tenants', currentTenantId, 'macchine', macchinaId);
      const macchinaDoc = await getDoc(macchinaDocRef);
      
      if (macchinaDoc.exists()) {
        const macchinaData = macchinaDoc.data();
        const oreAttuali = (macchinaData.oreAttuali || macchinaData.oreIniziali || 0) + oreMacchina;
        
        await updateDoc(macchinaDocRef, {
          oreAttuali: oreAttuali
        });
        
        result.macchinaAggiornata = true;
        
        // Verifica manutenzioni
        await verificaManutenzioniMacchina({
          macchinaId,
          macchinaData,
          oreAttuali,
          tenantId: currentTenantId,
          showAlertCallback
        });
      }
    }
    
    // Aggiorna attrezzo se presente
    if (attrezzoId) {
      const attrezzoDocRef = doc(db, 'tenants', currentTenantId, 'macchine', attrezzoId);
      const attrezzoDoc = await getDoc(attrezzoDocRef);
      
      if (attrezzoDoc.exists()) {
        const attrezzoData = attrezzoDoc.data();
        const oreAttuali = (attrezzoData.oreAttuali || attrezzoData.oreIniziali || 0) + oreMacchina;
        
        await updateDoc(attrezzoDocRef, {
          oreAttuali: oreAttuali
        });
        
        result.attrezzoAggiornato = true;
        
        // Verifica manutenzioni
        await verificaManutenzioniMacchina({
          macchinaId: attrezzoId,
          macchinaData: attrezzoData,
          oreAttuali,
          tenantId: currentTenantId,
          showAlertCallback
        });
      }
    }
    
    return result;
  } catch (error) {
    console.error('Errore aggiornamento ore macchina:', error);
    // Non bloccare l'operazione principale se c'è un errore nell'aggiornamento ore
    return { macchinaAggiornata: false, attrezzoAggiornato: false, error: error.message };
  }
}

/**
 * Verifica manutenzioni macchina e mostra alert se necessario
 * 
 * @param {Object} params - Parametri verifica
 * @param {string} params.macchinaId - ID macchina
 * @param {Object} params.macchinaData - Dati macchina
 * @param {number} params.oreAttuali - Ore attuali macchina
 * @param {string} params.tenantId - ID tenant
 * @param {Function} params.showAlertCallback - Callback per mostrare alert (opzionale)
 * @returns {Promise<void>}
 */
export async function verificaManutenzioniMacchina({
  macchinaId,
  macchinaData,
  oreAttuali,
  tenantId,
  showAlertCallback = null
}) {
  try {
    const nomeMacchina = macchinaData.nome || 'Macchina';
    const tipoMacchina = macchinaData.tipoMacchina || macchinaData.tipo || 'macchina';
    const tipoLabel = tipoMacchina === 'trattore' ? 'Trattore' : 'Attrezzo';
    
    // Verifica se supera oreProssimaManutenzione
    if (macchinaData.oreProssimaManutenzione && oreAttuali >= macchinaData.oreProssimaManutenzione) {
      const oreOltre = oreAttuali - macchinaData.oreProssimaManutenzione;
      console.warn(`⚠️ ATTENZIONE: ${tipoLabel} "${nomeMacchina}" ha superato di ${oreOltre.toFixed(1)} ore la manutenzione programmata!`);
      
      // Mostra alert visibile all'utente
      if (showAlertCallback && typeof showAlertCallback === 'function') {
        setTimeout(() => {
          showAlertCallback(
            `⚠️ ATTENZIONE: Il ${tipoLabel.toLowerCase()} "${nomeMacchina}" ha superato le ore di manutenzione programmata! Controlla in Gestione Macchine.`,
            'error'
          );
        }, 500);
      }
    } else if (macchinaData.oreProssimaManutenzione) {
      const oreRimanenti = macchinaData.oreProssimaManutenzione - oreAttuali;
      if (oreRimanenti <= 50 && oreRimanenti > 0) {
        console.info(`ℹ️ INFO: ${tipoLabel} "${nomeMacchina}" si avvicina alla manutenzione (${oreRimanenti.toFixed(1)} ore rimanenti)`);
      }
    }
    
    // Verifica anche per data (se presente)
    if (macchinaData.prossimaManutenzione) {
      const oggi = new Date();
      oggi.setHours(0, 0, 0, 0);
      const scadenza = macchinaData.prossimaManutenzione.toDate 
        ? macchinaData.prossimaManutenzione.toDate() 
        : new Date(macchinaData.prossimaManutenzione);
      scadenza.setHours(0, 0, 0, 0);
      
      const giorniRimanenti = Math.ceil((scadenza - oggi) / (1000 * 60 * 60 * 24));
      
      if (giorniRimanenti < 0) {
        console.warn(`⚠️ ATTENZIONE: ${tipoLabel} "${nomeMacchina}" ha superato la data di manutenzione programmata!`);
        
        if (showAlertCallback && typeof showAlertCallback === 'function') {
          setTimeout(() => {
            showAlertCallback(
              `⚠️ ATTENZIONE: Il ${tipoLabel.toLowerCase()} "${nomeMacchina}" ha superato la data di manutenzione programmata! Controlla in Gestione Macchine.`,
              'error'
            );
          }, 500);
        }
      } else if (giorniRimanenti <= 30 && giorniRimanenti >= 0) {
        console.info(`ℹ️ INFO: ${tipoLabel} "${nomeMacchina}" si avvicina alla manutenzione (${giorniRimanenti} giorni rimanenti)`);
      }
    }
  } catch (error) {
    console.error('Errore verifica manutenzioni macchina:', error);
    // Non bloccare l'operazione principale
  }
}

/**
 * Calcola ore macchina default (uguale a ore lavoratore se non specificato)
 * 
 * @param {number} oreLavoratore - Ore lavoratore
 * @param {number|null} oreMacchinaSpecificate - Ore macchina specificate (opzionale)
 * @returns {number} Ore macchina da utilizzare
 */
export function calcolaOreMacchinaDefault(oreLavoratore, oreMacchinaSpecificate = null) {
  if (oreMacchinaSpecificate !== null && oreMacchinaSpecificate !== undefined) {
    return parseFloat(oreMacchinaSpecificate);
  }
  return oreLavoratore || 0;
}

// Export default
export default {
  aggiornaOreMacchinaDaUtilizzo,
  verificaManutenzioniMacchina,
  calcolaOreMacchinaDefault
};





