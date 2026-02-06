/**
 * Ore Service - Servizio per gestione ore lavorate
 * Gestisce CRUD ore lavorate come sub-collection di lavori
 * 
 * @module core/services/ore-service
 */

import { 
  getCurrentTenantId 
} from './tenant-service.js';
import { getCurrentUserData } from './auth-service.js';

/**
 * Ottieni tutte le ore di un lavoro
 * @param {string} lavoroId - ID lavoro
 * @param {Object} options - Opzioni di query
 * @param {string} options.operaioId - Filtra per operaio (opzionale)
 * @param {string} options.stato - Filtra per stato: "da_validare" | "validate" | "rifiutate" (opzionale)
 * @returns {Promise<Array>} Array di ore lavorate
 */
export async function getOreLavoro(lavoroId, options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!lavoroId) {
      throw new Error('ID lavoro obbligatorio');
    }

    // Import dinamico per evitare problemi di circolarità
    const { getDb, collection, getDocs, query, where } = await import('./firebase-service.js');
    const db = getDb();
    if (!db) throw new Error('Firebase non inizializzato');
    
    const { operaioId = null, stato = null } = options;
    
    // Costruisci query
    let q = collection(db, 'tenants', tenantId, 'lavori', lavoroId, 'oreOperai');
    
    const filters = [];
    if (operaioId) {
      filters.push(where('operaioId', '==', operaioId));
    }
    if (stato) {
      filters.push(where('stato', '==', stato));
    }
    
    if (filters.length > 0) {
      q = query(q, ...filters);
    }
    
    const snapshot = await getDocs(q);
    const ore = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Converti Timestamp in Date
      if (data.data && data.data.toDate) {
        data.data = data.data.toDate();
      }
      if (data.creatoIl && data.creatoIl.toDate) {
        data.creatoIl = data.creatoIl.toDate();
      }
      if (data.validatoIl && data.validatoIl.toDate) {
        data.validatoIl = data.validatoIl.toDate();
      }
      ore.push({ id: doc.id, ...data });
    });
    
    // Ordina per data (più recenti prima)
    ore.sort((a, b) => {
      const dateA = a.data instanceof Date ? a.data : new Date(a.data);
      const dateB = b.data instanceof Date ? b.data : new Date(b.data);
      return dateB - dateA;
    });
    
    return ore;
  } catch (error) {
    // Errori critici (validazione, autenticazione) -> lancia eccezione
    if (error.message.includes('tenant') || error.message.includes('obbligatorio') || error.message.includes('config')) {
      console.error('Errore recupero ore:', error);
      throw new Error(`Errore recupero ore: ${error.message}`);
    }
    // Errori non critici (database, rete) -> ritorna array vuoto
    console.error('Errore recupero ore:', error);
    return [];
  }
}

/**
 * Ottieni ore da validare per un caposquadra
 * @param {string} caposquadraId - ID caposquadra
 * @returns {Promise<Array>} Array di ore da validare
 */
export async function getOreDaValidare(caposquadraId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!caposquadraId) {
      throw new Error('ID caposquadra obbligatorio');
    }

    // Import dinamico
    const { getDb, collection, getDocs, query, where } = await import('./firebase-service.js');
    const db = getDb();
    if (!db) throw new Error('Firebase non inizializzato');
    
    // Ottieni tutti i lavori del caposquadra
    const lavoriRef = collection(db, 'tenants', tenantId, 'lavori');
    const lavoriQuery = query(lavoriRef, where('caposquadraId', '==', caposquadraId));
    const lavoriSnapshot = await getDocs(lavoriQuery);
    
    const oreDaValidare = [];
    
    // Per ogni lavoro, ottieni le ore da validare
    for (const lavoroDoc of lavoriSnapshot.docs) {
      const lavoroId = lavoroDoc.id;
      const oreRef = collection(db, 'tenants', tenantId, 'lavori', lavoroId, 'oreOperai');
      const oreQuery = query(oreRef, where('stato', '==', 'da_validare'));
      const oreSnapshot = await getDocs(oreQuery);
      
      oreSnapshot.forEach(oraDoc => {
        const data = oraDoc.data();
        // Converti Timestamp in Date
        if (data.data && data.data.toDate) {
          data.data = data.data.toDate();
        }
        if (data.creatoIl && data.creatoIl.toDate) {
          data.creatoIl = data.creatoIl.toDate();
        }
        oreDaValidare.push({
          id: oraDoc.id,
          lavoroId: lavoroId,
          lavoroNome: lavoroDoc.data().nome || 'N/A',
          ...data
        });
      });
    }
    
    // Ordina per data creazione (più vecchie prima, per validare in ordine)
    oreDaValidare.sort((a, b) => {
      const dateA = a.creatoIl instanceof Date ? a.creatoIl : new Date(a.creatoIl);
      const dateB = b.creatoIl instanceof Date ? b.creatoIl : new Date(b.creatoIl);
      return dateA - dateB;
    });
    
    return oreDaValidare;
  } catch (error) {
    // Errori critici (validazione, autenticazione) -> lancia eccezione
    if (error.message.includes('tenant') || error.message.includes('obbligatorio') || error.message.includes('config')) {
      console.error('Errore recupero ore da validare:', error);
      throw new Error(`Errore recupero ore da validare: ${error.message}`);
    }
    // Errori non critici (database, rete) -> ritorna array vuoto
    console.error('Errore recupero ore da validare:', error);
    return [];
  }
}

/**
 * Ottieni ore di un operaio
 * @param {string} operaioId - ID operaio
 * @param {Object} options - Opzioni aggiuntive
 * @param {string} options.stato - Filtra per stato (opzionale)
 * @returns {Promise<Array>} Array di ore lavorate
 */
export async function getOreOperaio(operaioId, options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!operaioId) {
      throw new Error('ID operaio obbligatorio');
    }

    // Import dinamico
    const { getDb, collection, getDocs, query, where } = await import('./firebase-service.js');
    const db = getDb();
    if (!db) throw new Error('Firebase non inizializzato');
    
    // Ottieni tutti i lavori del tenant
    const lavoriRef = collection(db, 'tenants', tenantId, 'lavori');
    const lavoriSnapshot = await getDocs(lavoriRef);
    
    const oreOperaio = [];
    const { stato = null } = options;
    
    // Per ogni lavoro, ottieni le ore dell'operaio
    for (const lavoroDoc of lavoriSnapshot.docs) {
      const lavoroId = lavoroDoc.id;
      const oreRef = collection(db, 'tenants', tenantId, 'lavori', lavoroId, 'oreOperai');
      
      let oreQuery = query(oreRef, where('operaioId', '==', operaioId));
      if (stato) {
        oreQuery = query(oreRef, where('operaioId', '==', operaioId), where('stato', '==', stato));
      }
      
      const oreSnapshot = await getDocs(oreQuery);
      
      oreSnapshot.forEach(oraDoc => {
        const data = oraDoc.data();
        // Converti Timestamp in Date
        if (data.data && data.data.toDate) {
          data.data = data.data.toDate();
        }
        if (data.creatoIl && data.creatoIl.toDate) {
          data.creatoIl = data.creatoIl.toDate();
        }
        if (data.validatoIl && data.validatoIl.toDate) {
          data.validatoIl = data.validatoIl.toDate();
        }
        oreOperaio.push({
          id: oraDoc.id,
          lavoroId: lavoroId,
          lavoroNome: lavoroDoc.data().nome || 'N/A',
          ...data
        });
      });
    }
    
    // Ordina per data (più recenti prima)
    oreOperaio.sort((a, b) => {
      const dateA = a.data instanceof Date ? a.data : new Date(a.data);
      const dateB = b.data instanceof Date ? b.data : new Date(b.data);
      return dateB - dateA;
    });
    
    return oreOperaio;
  } catch (error) {
    // Errori critici (validazione, autenticazione) -> lancia eccezione
    if (error.message.includes('tenant') || error.message.includes('obbligatorio') || error.message.includes('config')) {
      console.error('Errore recupero ore operaio:', error);
      throw new Error(`Errore recupero ore operaio: ${error.message}`);
    }
    // Errori non critici (database, rete) -> ritorna array vuoto
    console.error('Errore recupero ore operaio:', error);
    return [];
  }
}

/**
 * Calcola ore nette da orari e pause
 * @param {string} orarioInizio - Orario inizio (HH:MM)
 * @param {string} orarioFine - Orario fine (HH:MM)
 * @param {number} pauseMinuti - Minuti di pausa
 * @returns {number} Ore nette (in ore decimali, es. 8.5 = 8h 30min)
 */
export function calcolaOreNette(orarioInizio, orarioFine, pauseMinuti) {
  if (!orarioInizio || !orarioFine) {
    return 0;
  }
  
  const [inizioOre, inizioMinuti] = orarioInizio.split(':').map(Number);
  const [fineOre, fineMinuti] = orarioFine.split(':').map(Number);
  
  const inizioMinutiTotali = inizioOre * 60 + inizioMinuti;
  const fineMinutiTotali = fineOre * 60 + fineMinuti;
  
  const minutiLavoro = fineMinutiTotali - inizioMinutiTotali;
  const minutiNetti = minutiLavoro - pauseMinuti;
  
  if (minutiNetti < 0) {
    return 0;
  }
  
  return minutiNetti / 60; // Converti in ore decimali
}

/**
 * Formatta ore in formato leggibile (es. "8h 30min")
 * @param {number} oreDecimali - Ore in formato decimale (es. 8.5)
 * @returns {string} Ore formattate
 */
export function formattaOre(oreDecimali) {
  if (!oreDecimali || oreDecimali <= 0) {
    return '0h';
  }
  
  const ore = Math.floor(oreDecimali);
  const minuti = Math.round((oreDecimali - ore) * 60);
  
  if (minuti === 0) {
    return `${ore}h`;
  }
  
  return `${ore}h ${minuti}min`;
}

/**
 * Crea nuova ora lavorata
 * @param {string} lavoroId - ID lavoro
 * @param {Object} oraData - Dati ora
 * @param {string} oraData.operaioId - ID operaio (obbligatorio)
 * @param {Date|string} oraData.data - Data lavoro (obbligatorio)
 * @param {string} oraData.orarioInizio - Orario inizio (HH:MM, obbligatorio)
 * @param {string} oraData.orarioFine - Orario fine (HH:MM, obbligatorio)
 * @param {number} oraData.pauseMinuti - Minuti di pausa (default: 0)
 * @param {string} oraData.note - Note opzionali
 * @returns {Promise<string>} ID ora creata
 */
export async function createOra(lavoroId, oraData) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const user = getCurrentUserData();
    if (!user) {
      throw new Error('Utente non autenticato');
    }
    
    // Verifica permessi: solo operaio può creare ore
    if (!user.ruoli || !user.ruoli.includes('operaio')) {
      throw new Error('Solo gli operai possono segnare le ore');
    }
    
    if (!lavoroId) {
      throw new Error('ID lavoro obbligatorio');
    }
    
    const { 
      operaioId, 
      data, 
      orarioInizio, 
      orarioFine, 
      pauseMinuti = 0,
      note = '' 
    } = oraData;
    
    // Validazioni
    if (!operaioId) {
      throw new Error('ID operaio obbligatorio');
    }
    
    // Verifica che l'operaio sia l'utente corrente
    if (operaioId !== user.id) {
      throw new Error('Puoi segnare solo le tue ore');
    }
    
    if (!data) {
      throw new Error('Data obbligatoria');
    }
    
    if (!orarioInizio || !orarioFine) {
      throw new Error('Orario inizio e fine obbligatori');
    }
    
    // Valida formato orari (HH:MM)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(orarioInizio) || !timeRegex.test(orarioFine)) {
      throw new Error('Formato orario non valido (usa HH:MM)');
    }
    
    // Valida logica orari
    const [inizioOre, inizioMinuti] = orarioInizio.split(':').map(Number);
    const [fineOre, fineMinuti] = orarioFine.split(':').map(Number);
    
    const inizioMinutiTotali = inizioOre * 60 + inizioMinuti;
    const fineMinutiTotali = fineOre * 60 + fineMinuti;
    
    if (fineMinutiTotali <= inizioMinutiTotali) {
      throw new Error('Orario fine deve essere maggiore di orario inizio');
    }
    
    const minutiLavoro = fineMinutiTotali - inizioMinutiTotali;
    if (pauseMinuti < 0) {
      throw new Error('Pause non possono essere negative');
    }
    if (pauseMinuti >= minutiLavoro) {
      throw new Error('Pause non possono essere maggiori o uguali al tempo di lavoro');
    }
    
    // Calcola ore nette
    const oreNette = calcolaOreNette(orarioInizio, orarioFine, pauseMinuti);
    
    // Converti data in Timestamp
    let dataTimestamp;
    if (data instanceof Date) {
      dataTimestamp = data;
    } else {
      dataTimestamp = new Date(data);
    }
    
    // Import dinamico
    const { getDb, collection, addDoc, Timestamp, serverTimestamp, getDoc, doc } = await import('./firebase-service.js');
    const db = getDb();
    if (!db) throw new Error('Firebase non inizializzato');
    
    // Verifica che il lavoro esista
    const lavoroDoc = await getDoc(doc(db, 'tenants', tenantId, 'lavori', lavoroId));
    if (!lavoroDoc.exists()) {
      throw new Error('Lavoro non trovato');
    }
    
    const lavoroData = lavoroDoc.data();
    
    // Verifica che l'operaio sia assegnato al lavoro (tramite squadra)
    // Per ora, permettiamo a tutti gli operai del tenant di segnare ore su qualsiasi lavoro
    // In futuro, possiamo aggiungere verifica squadra
    
    // Crea documento ora
    const oraData = {
      operaioId,
      lavoroId,
      terrenoId: lavoroData.terrenoId || null,
      data: Timestamp.fromDate(dataTimestamp),
      orarioInizio,
      orarioFine,
      pauseMinuti,
      oreNette,
      note: note || '',
      stato: 'da_validare', // Stato iniziale: da validare
      creatoIl: serverTimestamp()
    };
    
    const oraRef = collection(db, 'tenants', tenantId, 'lavori', lavoroId, 'oreOperai');
    const oraDoc = await addDoc(oraRef, oraData);
    
    return oraDoc.id;
  } catch (error) {
    console.error('Errore creazione ora:', error);
    throw new Error(`Errore creazione ora: ${error.message}`);
  }
}

/**
 * Valida un'ora lavorata (Caposquadra)
 * @param {string} lavoroId - ID lavoro
 * @param {string} oraId - ID ora
 * @returns {Promise<void>}
 */
export async function validaOra(lavoroId, oraId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const user = getCurrentUserData();
    if (!user) {
      throw new Error('Utente non autenticato');
    }
    
    // Verifica permessi: solo caposquadra può validare
    if (!user.ruoli || !user.ruoli.includes('caposquadra')) {
      throw new Error('Solo i caposquadra possono validare le ore');
    }
    
    if (!lavoroId || !oraId) {
      throw new Error('ID lavoro e ora obbligatori');
    }
    
    // Import dinamico
    const { getDb, doc, getDoc, updateDoc, serverTimestamp } = await import('./firebase-service.js');
    const db = getDb();
    if (!db) throw new Error('Firebase non inizializzato');
    
    // Verifica che il lavoro esista e sia assegnato al caposquadra
    const lavoroDoc = await getDoc(doc(db, 'tenants', tenantId, 'lavori', lavoroId));
    if (!lavoroDoc.exists()) {
      throw new Error('Lavoro non trovato');
    }
    
    const lavoroData = lavoroDoc.data();
    if (lavoroData.caposquadraId !== user.id) {
      throw new Error('Non sei il caposquadra assegnato a questo lavoro');
    }
    
    // Verifica che l'ora esista e sia in stato "da_validare"
    const oraDoc = await getDoc(doc(db, 'tenants', tenantId, 'lavori', lavoroId, 'oreOperai', oraId));
    if (!oraDoc.exists()) {
      throw new Error('Ora non trovata');
    }
    
    const oraData = oraDoc.data();
    if (oraData.stato !== 'da_validare') {
      throw new Error('Questa ora è già stata validata o rifiutata');
    }
    
    // Aggiorna stato
    await updateDoc(oraDoc.ref, {
      stato: 'validate',
      validatoDa: user.id,
      validatoIl: serverTimestamp(),
      rifiutatoDa: null,
      motivoRifiuto: null
    });
  } catch (error) {
    console.error('Errore validazione ora:', error);
    throw new Error(`Errore validazione ora: ${error.message}`);
  }
}

/**
 * Rifiuta un'ora lavorata (Caposquadra)
 * @param {string} lavoroId - ID lavoro
 * @param {string} oraId - ID ora
 * @param {string} motivoRifiuto - Motivo del rifiuto (obbligatorio)
 * @returns {Promise<void>}
 */
export async function rifiutaOra(lavoroId, oraId, motivoRifiuto) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const user = getCurrentUserData();
    if (!user) {
      throw new Error('Utente non autenticato');
    }
    
    // Verifica permessi: solo caposquadra può rifiutare
    if (!user.ruoli || !user.ruoli.includes('caposquadra')) {
      throw new Error('Solo i caposquadra possono rifiutare le ore');
    }
    
    if (!lavoroId || !oraId) {
      throw new Error('ID lavoro e ora obbligatori');
    }
    
    if (!motivoRifiuto || motivoRifiuto.trim().length === 0) {
      throw new Error('Motivo rifiuto obbligatorio');
    }
    
    // Import dinamico
    const { getDb, doc, getDoc, updateDoc, serverTimestamp } = await import('./firebase-service.js');
    const db = getDb();
    if (!db) throw new Error('Firebase non inizializzato');
    
    // Verifica che il lavoro esista e sia assegnato al caposquadra
    const lavoroDoc = await getDoc(doc(db, 'tenants', tenantId, 'lavori', lavoroId));
    if (!lavoroDoc.exists()) {
      throw new Error('Lavoro non trovato');
    }
    
    const lavoroData = lavoroDoc.data();
    if (lavoroData.caposquadraId !== user.id) {
      throw new Error('Non sei il caposquadra assegnato a questo lavoro');
    }
    
    // Verifica che l'ora esista e sia in stato "da_validare"
    const oraDoc = await getDoc(doc(db, 'tenants', tenantId, 'lavori', lavoroId, 'oreOperai', oraId));
    if (!oraDoc.exists()) {
      throw new Error('Ora non trovata');
    }
    
    const oraData = oraDoc.data();
    if (oraData.stato !== 'da_validare') {
      throw new Error('Questa ora è già stata validata o rifiutata');
    }
    
    // Aggiorna stato
    await updateDoc(oraDoc.ref, {
      stato: 'rifiutate',
      rifiutatoDa: user.id,
      motivoRifiuto: motivoRifiuto.trim(),
      validatoDa: null,
      validatoIl: null
    });
  } catch (error) {
    console.error('Errore rifiuto ora:', error);
    throw new Error(`Errore rifiuto ora: ${error.message}`);
  }
}

// Export default
export default {
  getOreLavoro,
  getOreDaValidare,
  getOreOperaio,
  calcolaOreNette,
  formattaOre,
  createOra,
  validaOra,
  rifiutaOra
};

