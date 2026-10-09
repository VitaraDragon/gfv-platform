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
import { isOraDelCaposquadraSuLavoroSquadra, assertUtentePuoValidareOra } from './manodopera-ore-validazione-scope.js';
import {
  calcolaOreNette as calcolaOreNettePura,
  formattaOreMinuti,
  chiaveGiornoOra,
  dataMezzanotteLocale,
  trovaSovrapposizioni,
  creaErroreSovrapposizione,
  permessiOra,
  validaIntervalloOra,
  buildVoceStorico,
  aggiungiVoceStorico,
  snapshotCampiOra,
  assicuraVoceValidazione,
  assicuraVoceRifiuto,
  pianoRettificaOreMacchina,
  oreMacchinaDaSalvare,
  deveRichiedereRefreshSkill
} from './ore-operai-logic.js';

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
      
      const lavoroData = lavoroDoc.data();
      oreSnapshot.forEach(oraDoc => {
        const data = oraDoc.data();
        if (isOraDelCaposquadraSuLavoroSquadra(data, lavoroData)) {
          return;
        }
        if (data.data && data.data.toDate) {
          data.data = data.data.toDate();
        }
        if (data.creatoIl && data.creatoIl.toDate) {
          data.creatoIl = data.creatoIl.toDate();
        }
        oreDaValidare.push({
          id: oraDoc.id,
          lavoroId: lavoroId,
          lavoroNome: lavoroData.nome || 'N/A',
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
    const { getDb, collection, getDocs, query, where, doc, getDoc } = await import('./firebase-service.js');
    const { fetchLavoriDocumentsForFieldUser } = await import('./manodopera-lavori-scope.js');
    const db = getDb();
    if (!db) throw new Error('Firebase non inizializzato');

    let isCaposquadra = false;
    let isOperaio = true;
    try {
      const userSnap = await getDoc(doc(db, 'users', operaioId));
      if (userSnap.exists()) {
        const ruoli = userSnap.data().ruoli || [];
        isCaposquadra = Array.isArray(ruoli) && ruoli.includes('caposquadra');
        isOperaio = Array.isArray(ruoli) && ruoli.includes('operaio');
      }
    } catch (e) {
      console.warn('getOreOperaio: impossibile leggere ruoli utente, uso solo filtro operaio', e);
    }

    const lavoriVisibili = await fetchLavoriDocumentsForFieldUser(db, tenantId, operaioId, {
      isCaposquadra,
      isOperaio: isOperaio || !isCaposquadra
    });

    const oreOperaio = [];
    const { stato = null } = options;

    for (const lav of lavoriVisibili) {
      const lavoroId = lav.id;
      const lavoroDocData = lav;
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
          lavoroNome: lavoroDocData.nome || 'N/A',
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
  return calcolaOreNettePura(orarioInizio, orarioFine, pauseMinuti);
}

/**
 * Formatta ore in formato leggibile (es. "8h 30min")
 * @param {number} oreDecimali - Ore in formato decimale (es. 8.5)
 * @returns {string} Ore formattate
 */
export function formattaOre(oreDecimali) {
  return formattaOreMinuti(oreDecimali);
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

function uidUtente(user) {
  return String((user && (user.id || user.uid)) || '');
}

function ruoliUtente(user) {
  const ruoli = Array.isArray(user && user.ruoli) ? user.ruoli : [];
  return {
    isCaposquadra: ruoli.includes('caposquadra'),
    isManager: ruoli.includes('manager') || ruoli.includes('amministratore'),
    isOperaio: ruoli.includes('operaio')
  };
}

function richiediContesto(db, tenantId, user) {
  if (!db) throw new Error('Firebase non inizializzato');
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
  const userId = uidUtente(user);
  if (!userId) throw new Error('Utente non autenticato');
  return { userId, ...ruoliUtente(user) };
}

async function firebaseOre() {
  return import('./firebase-service.js');
}

async function leggiLavoro(db, docFn, getDocFn, tenantId, lavoroId) {
  const snap = await getDocFn(docFn(db, 'tenants', tenantId, 'lavori', lavoroId));
  if (!snap.exists()) throw new Error('Lavoro non trovato');
  return { id: snap.id, ...snap.data() };
}

async function leggiOra(db, docFn, getDocFn, tenantId, lavoroId, oraId) {
  const snap = await getDocFn(docFn(db, 'tenants', tenantId, 'lavori', lavoroId, 'oreOperai', oraId));
  if (!snap.exists()) throw new Error('Ora non trovata');
  return { id: snap.id, ref: snap.ref, ...snap.data() };
}

/**
 * Ore dell'utente in un giorno, su tutti i lavori visibili.
 * Nessun indice composito: filtro del giorno lato client.
 * Il controllo di sovrapposizione è solo lato client: Firestore Rules non può interrogare altre righe.
 *
 * @param {object} db
 * @param {string} tenantId
 * @param {string} userId
 * @param {string} giornoKey YYYY-MM-DD
 * @param {object} userData
 * @returns {Promise<object[]>}
 */
export async function caricaOreUtenteGiorno(db, tenantId, userId, giornoKey, userData) {
  const tutte = await caricaOreUtente(db, tenantId, userId, userData);
  const giorno = chiaveGiornoOra(giornoKey);
  return tutte.filter((row) => chiaveGiornoOra(row.data) === giorno);
}

/**
 * Tutte le ore dell'utente sui lavori visibili (per il riquadro del giorno e le sovrapposizioni).
 */
export async function caricaOreUtente(db, tenantId, userId, userData) {
  if (!db || !tenantId || !userId) return [];
  const { collection, getDocs, query, where } = await firebaseOre();
  const {
    fetchLavoriDocumentsForFieldUser,
    resolveSegnaturaOreRoleFlags,
    resolveFieldWorkspaceLavoriRoleFlags
  } = await import('./manodopera-lavori-scope.js');
  const flags = ruoliUtente(userData);
  const roleFlags = flags.isCaposquadra
    ? resolveFieldWorkspaceLavoriRoleFlags(userData || { ruoli: ['caposquadra'] })
    : resolveSegnaturaOreRoleFlags(userData || {});
  const lavori = await fetchLavoriDocumentsForFieldUser(db, tenantId, userId, roleFlags, userData || null);
  const ore = [];
  for (const lav of lavori) {
    const oreRef = collection(db, 'tenants', tenantId, 'lavori', lav.id, 'oreOperai');
    const snap = await getDocs(query(oreRef, where('operaioId', '==', userId)));
    snap.forEach((oraDoc) => {
      ore.push({
        id: oraDoc.id,
        lavoroId: lav.id,
        lavoroNome: lav.nome || 'N/A',
        ...oraDoc.data()
      });
    });
  }
  return ore;
}

function normalizzaPayloadOra(oraData) {
  const pauseMinuti = Number(oraData && oraData.pauseMinuti) || 0;
  const orarioInizio = oraData && oraData.orarioInizio;
  const orarioFine = oraData && oraData.orarioFine;
  const err = validaIntervalloOra(orarioInizio, orarioFine, pauseMinuti);
  if (err) throw new Error(err);
  const giorno = dataMezzanotteLocale(oraData.data);
  if (!giorno || Number.isNaN(giorno.getTime())) throw new Error('Data obbligatoria');
  const macchinaId = oraData.macchinaId || null;
  const attrezzoId = oraData.attrezzoId || null;
  const oreNette = calcolaOreNettePura(orarioInizio, orarioFine, pauseMinuti);
  return {
    orarioInizio,
    orarioFine,
    pauseMinuti,
    oreNette,
    note: (oraData.note || '').trim(),
    giorno,
    giornoKey: chiaveGiornoOra(giorno),
    macchinaId,
    attrezzoId,
    oreMacchina: oreMacchinaDaSalvare({ macchinaId, attrezzoId, oreMacchina: oraData.oreMacchina }, oreNette),
    posizioneRilevamento: oraData.posizioneRilevamento || null
  };
}

async function assertNessunaSovrapposizione(db, tenantId, user, userId, candidata, escludiId) {
  const esistenti = await caricaOreUtente(db, tenantId, userId, user);
  const conflitti = trovaSovrapposizioni(candidata, esistenti, { escludiId });
  if (conflitti.length) throw creaErroreSovrapposizione(conflitti);
}

/**
 * Nuova riga dell'utente. Blocca se si sovrappone (R2).
 * La data è la mezzanotte locale del giorno scelto.
 * @returns {Promise<string>} id documento
 */
export async function salvaNuovaOra(db, tenantId, user, oraData) {
  const { userId } = richiediContesto(db, tenantId, user);
  if (!oraData || !oraData.lavoroId) throw new Error('ID lavoro obbligatorio');
  if (oraData.operaioId && String(oraData.operaioId) !== userId) {
    throw new Error('Puoi segnare solo le tue ore');
  }
  const norm = normalizzaPayloadOra(oraData);
  const { collection, addDoc, doc, getDoc, Timestamp, serverTimestamp } = await firebaseOre();
  const lavoro = await leggiLavoro(db, doc, getDoc, tenantId, oraData.lavoroId);
  const candidata = {
    operaioId: userId,
    data: norm.giornoKey,
    orarioInizio: norm.orarioInizio,
    orarioFine: norm.orarioFine,
    stato: 'da_validare'
  };
  await assertNessunaSovrapposizione(db, tenantId, user, userId, candidata);
  const payload = {
    operaioId: userId,
    lavoroId: oraData.lavoroId,
    terrenoId: oraData.terrenoId || lavoro.terrenoId || null,
    data: Timestamp.fromDate(norm.giorno),
    orarioInizio: norm.orarioInizio,
    orarioFine: norm.orarioFine,
    pauseMinuti: norm.pauseMinuti,
    oreNette: norm.oreNette,
    note: norm.note,
    stato: 'da_validare',
    creatoIl: serverTimestamp()
  };
  if (norm.posizioneRilevamento) payload.posizioneRilevamento = norm.posizioneRilevamento;
  if (norm.macchinaId) payload.macchinaId = norm.macchinaId;
  if (norm.attrezzoId) payload.attrezzoId = norm.attrezzoId;
  if (norm.oreMacchina != null && Number.isFinite(norm.oreMacchina)) payload.oreMacchina = norm.oreMacchina;
  const oraRef = collection(db, 'tenants', tenantId, 'lavori', oraData.lavoroId, 'oreOperai');
  const created = await addDoc(oraRef, payload);
  return created.id;
}

function voceStorico(azione, userId, motivo, prima, dopo, Timestamp) {
  return buildVoceStorico({
    azione,
    da: userId,
    il: Timestamp.now(),
    motivo: motivo || '',
    prima,
    dopo
  });
}

/**
 * Modifica della propria riga da_validare o rifiutate. Il lavoro non cambia.
 * Una riga rifiutata torna in attesa.
 */
export async function modificaOraPropria(db, tenantId, user, lavoroId, oraId, patch) {
  const { userId, isCaposquadra, isManager } = richiediContesto(db, tenantId, user);
  const { doc, getDoc, updateDoc, Timestamp, serverTimestamp } = await firebaseOre();
  const lavoro = await leggiLavoro(db, doc, getDoc, tenantId, lavoroId);
  const ora = await leggiOra(db, doc, getDoc, tenantId, lavoroId, oraId);
  const perm = permessiOra({ ora, lavoro, userId, isCaposquadra, isManager });
  if (!perm.puoModificare) {
    throw new Error(perm.motivoBlocco || 'Non puoi modificare questa ora');
  }
  const unito = {
    data: patch && patch.data != null ? patch.data : ora.data,
    orarioInizio: patch && patch.orarioInizio != null ? patch.orarioInizio : ora.orarioInizio,
    orarioFine: patch && patch.orarioFine != null ? patch.orarioFine : ora.orarioFine,
    pauseMinuti: patch && patch.pauseMinuti != null ? patch.pauseMinuti : ora.pauseMinuti,
    note: patch && patch.note != null ? patch.note : (ora.note || ''),
    macchinaId: patch && Object.prototype.hasOwnProperty.call(patch, 'macchinaId') ? patch.macchinaId : ora.macchinaId,
    attrezzoId: patch && Object.prototype.hasOwnProperty.call(patch, 'attrezzoId') ? patch.attrezzoId : ora.attrezzoId,
    oreMacchina: patch && Object.prototype.hasOwnProperty.call(patch, 'oreMacchina') ? patch.oreMacchina : ora.oreMacchina,
    posizioneRilevamento: patch && patch.posizioneRilevamento ? patch.posizioneRilevamento : null
  };
  const norm = normalizzaPayloadOra(unito);
  await assertNessunaSovrapposizione(db, tenantId, user, userId, {
    operaioId: userId,
    data: norm.giornoKey,
    orarioInizio: norm.orarioInizio,
    orarioFine: norm.orarioFine
  }, oraId);
  const dopo = {
    data: norm.giornoKey,
    orarioInizio: norm.orarioInizio,
    orarioFine: norm.orarioFine,
    pauseMinuti: norm.pauseMinuti,
    oreNette: norm.oreNette,
    note: norm.note,
    stato: 'da_validare'
  };
  const storicoConRifiuto = assicuraVoceRifiuto(ora.storicoModifiche, ora);
  const update = {
    data: Timestamp.fromDate(norm.giorno),
    orarioInizio: norm.orarioInizio,
    orarioFine: norm.orarioFine,
    pauseMinuti: norm.pauseMinuti,
    oreNette: norm.oreNette,
    note: norm.note,
    macchinaId: norm.macchinaId,
    attrezzoId: norm.attrezzoId,
    oreMacchina: norm.oreMacchina != null && Number.isFinite(norm.oreMacchina) ? norm.oreMacchina : null,
    stato: 'da_validare',
    rifiutatoDa: null,
    rifiutatoIl: null,
    motivoRifiuto: null,
    modificatoDa: userId,
    modificatoIl: serverTimestamp(),
    storicoModifiche: aggiungiVoceStorico(
      storicoConRifiuto,
      voceStorico('modifica', userId, '', ora, dopo, Timestamp)
    )
  };
  if (norm.posizioneRilevamento) update.posizioneRilevamento = norm.posizioneRilevamento;
  await updateDoc(ora.ref, update);
}

/** Cancellazione fisica: solo il proprietario, su righe non validate. */
export async function eliminaOraPropria(db, tenantId, user, lavoroId, oraId) {
  const { userId, isCaposquadra, isManager } = richiediContesto(db, tenantId, user);
  const { doc, getDoc, deleteDoc } = await firebaseOre();
  const lavoro = await leggiLavoro(db, doc, getDoc, tenantId, lavoroId);
  const ora = await leggiOra(db, doc, getDoc, tenantId, lavoroId, oraId);
  const perm = permessiOra({ ora, lavoro, userId, isCaposquadra, isManager });
  if (!perm.puoEliminare) {
    throw new Error(perm.motivoBlocco || 'Non puoi eliminare questa ora');
  }
  await deleteDoc(ora.ref);
}

async function applicaDeltaMacchine(tenantId, operazioni) {
  if (!operazioni || !operazioni.length) return { ok: true, avviso: '' };
  const { incrementDocumentField } = await firebaseOre();
  try {
    for (const op of operazioni) {
      await incrementDocumentField('macchine', op.id, 'oreAttuali', op.delta, tenantId);
    }
    return { ok: true, avviso: '' };
  } catch (error) {
    console.error('Rettifica ore macchina non applicata (le ore della riga restano aggiornate):', error);
    return { ok: false, avviso: 'ore macchina da verificare a mano' };
  }
}

async function contabilizzaAllaValidazione(tenantId, oraData) {
  const macchinaId = oraData.macchinaId || null;
  const attrezzoId = oraData.attrezzoId || null;
  const ore = Number(oraData.oreMacchina != null ? oraData.oreMacchina : oraData.oreNette) || 0;
  if ((!macchinaId && !attrezzoId) || ore <= 0) return { contabilizzate: null, avviso: '' };
  try {
    const service = await import('../../modules/parco-macchine/services/macchine-utilizzo-service.js');
    const result = await service.aggiornaOreMacchinaDaUtilizzo({
      macchinaId,
      attrezzoId,
      oreMacchina: ore,
      tenantId
    });
    if (result && result.error) {
      console.error('Aggiornamento ore macchina in validazione non riuscito:', result.error);
      return { contabilizzate: null, avviso: 'ore macchina da verificare a mano' };
    }
    const cont = { ore };
    if (result && result.macchinaAggiornata && macchinaId) cont.macchinaId = macchinaId;
    if (result && result.attrezzoAggiornato && attrezzoId) cont.attrezzoId = attrezzoId;
    if (!cont.macchinaId && !cont.attrezzoId) {
      console.warn('Ore macchina non aggiornate in validazione', { macchinaId, attrezzoId });
      return { contabilizzate: null, avviso: '' };
    }
    return { contabilizzate: cont, avviso: '' };
  } catch (error) {
    console.error('Aggiornamento ore macchina in validazione non riuscito:', error);
    return { contabilizzate: null, avviso: 'ore macchina da verificare a mano' };
  }
}

async function chiediRefreshSkill(tenantId, operaioId, userId, isManager) {
  if (!deveRichiedereRefreshSkill(isManager) || !operaioId) return;
  try {
    const { chiediRefreshSkillOreValidate } = await import('./ore-skill-refresh-client.js');
    await chiediRefreshSkillOreValidate({ tenantId, operaioId, userId, isManager: true });
  } catch (error) {
    console.warn('Refresh skill non eseguito:', error);
  }
}

/**
 * Valida una riga in coda. Permessi: assertUtentePuoValidareOra (capo o manager, come la coda).
 * Se le ore macchina vengono davvero aggiunte, salva oreMacchinaContabilizzate.
 * @returns {Promise<{ avvisi: string[] }>}
 */
export async function validaOraContesto(db, tenantId, user, lavoroId, oraId) {
  const { userId, isCaposquadra, isManager } = richiediContesto(db, tenantId, user);
  if (!lavoroId || !oraId) throw new Error('ID lavoro e ora obbligatori');
  const { doc, getDoc, updateDoc, Timestamp } = await firebaseOre();
  const lavoro = await leggiLavoro(db, doc, getDoc, tenantId, lavoroId);
  const ora = await leggiOra(db, doc, getDoc, tenantId, lavoroId, oraId);
  if (ora.stato !== 'da_validare') throw new Error('Questa ora è già stata validata o rifiutata');
  assertUtentePuoValidareOra({
    oraData: ora,
    lavoroData: lavoro,
    userId,
    isCaposquadra,
    isManager
  });
  const macchina = await contabilizzaAllaValidazione(tenantId, ora);
  const ilValidazione = Timestamp.now();
  const dopoValidazione = { ...snapshotCampiOra(ora), stato: 'validate' };
  const update = {
    stato: 'validate',
    validatoDa: userId,
    validatoIl: ilValidazione,
    rifiutatoDa: null,
    motivoRifiuto: null,
    storicoModifiche: aggiungiVoceStorico(
      ora.storicoModifiche,
      buildVoceStorico({
        azione: 'validazione',
        da: userId,
        il: ilValidazione,
        motivo: '',
        prima: ora,
        dopo: dopoValidazione
      })
    )
  };
  if (macchina.contabilizzate) update.oreMacchinaContabilizzate = macchina.contabilizzate;
  await updateDoc(ora.ref, update);
  await chiediRefreshSkill(tenantId, ora.operaioId, userId, isManager);
  return { avvisi: macchina.avviso ? [macchina.avviso] : [] };
}

/**
 * Rifiuto di una riga ancora in coda (non toglie ore macchina: non erano state sommate).
 */
export async function rifiutaOraContesto(db, tenantId, user, lavoroId, oraId, motivoRifiuto) {
  const { userId, isCaposquadra, isManager } = richiediContesto(db, tenantId, user);
  const motivo = String(motivoRifiuto || '').trim();
  if (!motivo) throw new Error('Motivo rifiuto obbligatorio');
  if (!lavoroId || !oraId) throw new Error('ID lavoro e ora obbligatori');
  const { doc, getDoc, updateDoc, serverTimestamp, Timestamp } = await firebaseOre();
  const lavoro = await leggiLavoro(db, doc, getDoc, tenantId, lavoroId);
  const ora = await leggiOra(db, doc, getDoc, tenantId, lavoroId, oraId);
  if (ora.stato !== 'da_validare') throw new Error('Questa ora è già stata validata o rifiutata');
  assertUtentePuoValidareOra({
    oraData: ora,
    lavoroData: lavoro,
    userId,
    isCaposquadra,
    isManager
  });
  const dopo = { ...snapshotCampiOra(ora), stato: 'rifiutate' };
  await updateDoc(ora.ref, {
    stato: 'rifiutate',
    rifiutatoDa: userId,
    rifiutatoIl: serverTimestamp(),
    motivoRifiuto: motivo,
    validatoDa: null,
    validatoIl: null,
    modificatoDa: userId,
    modificatoIl: serverTimestamp(),
    storicoModifiche: aggiungiVoceStorico(
      ora.storicoModifiche,
      voceStorico('rifiuto', userId, motivo, ora, dopo, Timestamp)
    )
  });
}

/**
 * Correzione del validatore: la riga resta nello stato in cui è.
 * Sulle validate si applica solo la differenza delle ore macchina.
 * @returns {Promise<{ avvisi: string[] }>}
 */
export async function correggiOra(db, tenantId, user, lavoroId, oraId, patch, motivo) {
  const { userId, isCaposquadra, isManager } = richiediContesto(db, tenantId, user);
  const motivoTesto = String(motivo || '').trim();
  if (!motivoTesto) throw new Error('Motivo obbligatorio');
  const { doc, getDoc, updateDoc, serverTimestamp, Timestamp } = await firebaseOre();
  const lavoro = await leggiLavoro(db, doc, getDoc, tenantId, lavoroId);
  const ora = await leggiOra(db, doc, getDoc, tenantId, lavoroId, oraId);
  const perm = permessiOra({ ora, lavoro, userId, isCaposquadra, isManager });
  if (!perm.puoCorreggere) throw new Error('Non puoi correggere questa ora');
  const unito = {
    data: ora.data,
    orarioInizio: patch && patch.orarioInizio != null ? patch.orarioInizio : ora.orarioInizio,
    orarioFine: patch && patch.orarioFine != null ? patch.orarioFine : ora.orarioFine,
    pauseMinuti: patch && patch.pauseMinuti != null ? patch.pauseMinuti : ora.pauseMinuti,
    note: patch && patch.note != null ? patch.note : (ora.note || ''),
    macchinaId: patch && Object.prototype.hasOwnProperty.call(patch, 'macchinaId') ? patch.macchinaId : (ora.macchinaId || null),
    attrezzoId: patch && Object.prototype.hasOwnProperty.call(patch, 'attrezzoId') ? patch.attrezzoId : (ora.attrezzoId || null),
    oreMacchina: patch && Object.prototype.hasOwnProperty.call(patch, 'oreMacchina') ? patch.oreMacchina : ora.oreMacchina
  };
  const norm = normalizzaPayloadOra(unito);
  const avvisi = [];
  let prossimoCont = ora.oreMacchinaContabilizzate || null;
  let aggiornaContabilizzate = false;
  if (ora.stato === 'validate') {
    const oreDesiderate = norm.oreMacchina != null && Number.isFinite(norm.oreMacchina)
      ? norm.oreMacchina
      : norm.oreNette;
    const prossimo = (norm.macchinaId || norm.attrezzoId)
      ? { macchinaId: norm.macchinaId, attrezzoId: norm.attrezzoId, ore: oreDesiderate }
      : null;
    const haMezzo = Boolean(
      ora.macchinaId || ora.attrezzoId || norm.macchinaId || norm.attrezzoId
      || (ora.oreMacchinaContabilizzate && (ora.oreMacchinaContabilizzate.macchinaId || ora.oreMacchinaContabilizzate.attrezzoId))
    );
    const piano = pianoRettificaOreMacchina(ora.oreMacchinaContabilizzate, 'correzione', prossimo, ora);
    if (piano.avviso && haMezzo) {
      avvisi.push(piano.avviso);
    } else if (piano.operazioni.length) {
      const esito = await applicaDeltaMacchine(tenantId, piano.operazioni);
      if (!esito.ok) {
        avvisi.push(esito.avviso);
      } else {
        prossimoCont = piano.prossimoContabilizzate;
        aggiornaContabilizzate = true;
      }
    } else {
      prossimoCont = piano.prossimoContabilizzate;
      aggiornaContabilizzate = true;
    }
  }
  const dopo = {
    data: chiaveGiornoOra(ora.data),
    orarioInizio: norm.orarioInizio,
    orarioFine: norm.orarioFine,
    pauseMinuti: norm.pauseMinuti,
    oreNette: norm.oreNette,
    note: norm.note,
    stato: ora.stato
  };
  const update = {
    orarioInizio: norm.orarioInizio,
    orarioFine: norm.orarioFine,
    pauseMinuti: norm.pauseMinuti,
    oreNette: norm.oreNette,
    note: norm.note,
    macchinaId: norm.macchinaId,
    attrezzoId: norm.attrezzoId,
    oreMacchina: norm.oreMacchina != null && Number.isFinite(norm.oreMacchina) ? norm.oreMacchina : null,
    modificatoDa: userId,
    modificatoIl: serverTimestamp(),
    storicoModifiche: aggiungiVoceStorico(
      ora.storicoModifiche,
      voceStorico('correzione', userId, motivoTesto, ora, dopo, Timestamp)
    )
  };
  if (aggiornaContabilizzate) {
    update.oreMacchinaContabilizzate = prossimoCont;
  }
  await updateDoc(ora.ref, update);
  if (ora.stato === 'validate') {
    await chiediRefreshSkill(tenantId, ora.operaioId, userId, isManager);
  }
  return { avvisi };
}

async function togliValidazioneConRettifica(db, tenantId, user, lavoroId, oraId, motivo, azioneStorico, patchStato) {
  const { userId, isCaposquadra, isManager } = richiediContesto(db, tenantId, user);
  const motivoTesto = String(motivo || '').trim();
  if (!motivoTesto) throw new Error('Motivo obbligatorio');
  const { doc, getDoc, updateDoc, serverTimestamp, Timestamp } = await firebaseOre();
  const lavoro = await leggiLavoro(db, doc, getDoc, tenantId, lavoroId);
  const ora = await leggiOra(db, doc, getDoc, tenantId, lavoroId, oraId);
  const perm = permessiOra({ ora, lavoro, userId, isCaposquadra, isManager });
  if (azioneStorico === 'annulla_validazione' && !perm.puoAnnullareValidazione) {
    throw new Error('Non puoi annullare la validazione di questa ora');
  }
  if (azioneStorico === 'rifiuto' && !perm.puoRifiutare) {
    throw new Error('Non puoi rifiutare questa ora');
  }
  if (ora.stato !== 'validate') throw new Error('Questa ora non è validata');
  const piano = pianoRettificaOreMacchina(
    ora.oreMacchinaContabilizzate,
    azioneStorico === 'annulla_validazione' ? 'annulla' : 'rifiuto',
    null,
    ora
  );
  const avvisi = [];
  let azzera = false;
  const cont = ora.oreMacchinaContabilizzate || {};
  const haMezzo = Boolean(ora.macchinaId || ora.attrezzoId || cont.macchinaId || cont.attrezzoId);
  if (piano.avviso && haMezzo) {
    avvisi.push(piano.avviso);
  } else if (piano.operazioni.length) {
    const esito = await applicaDeltaMacchine(tenantId, piano.operazioni);
    if (esito.ok) azzera = true;
    else avvisi.push(esito.avviso);
  } else if (piano.azzeraCampo) {
    azzera = true;
  }
  const dopo = { ...snapshotCampiOra(ora), stato: patchStato.stato };
  const storicoConValidazione = assicuraVoceValidazione(ora.storicoModifiche, ora);
  const update = {
    ...patchStato,
    modificatoDa: userId,
    modificatoIl: serverTimestamp(),
    storicoModifiche: aggiungiVoceStorico(
      storicoConValidazione,
      voceStorico(azioneStorico, userId, motivoTesto, ora, dopo, Timestamp)
    )
  };
  if (azzera) update.oreMacchinaContabilizzate = null;
  await updateDoc(ora.ref, update);
  await chiediRefreshSkill(tenantId, ora.operaioId, userId, isManager);
  return { avvisi };
}

/** La riga torna da_validare e si azzerano validatoDa e validatoIl. */
export async function annullaValidazioneOra(db, tenantId, user, lavoroId, oraId, motivo) {
  return togliValidazioneConRettifica(db, tenantId, user, lavoroId, oraId, motivo, 'annulla_validazione', {
    stato: 'da_validare',
    validatoDa: null,
    validatoIl: null
  });
}

/** Togliere una riga validata: rifiuto con motivo, senza cancellazione fisica. */
export async function rifiutaOraValidata(db, tenantId, user, lavoroId, oraId, motivo) {
  const { serverTimestamp } = await firebaseOre();
  return togliValidazioneConRettifica(db, tenantId, user, lavoroId, oraId, motivo, 'rifiuto', {
    stato: 'rifiutate',
    rifiutatoDa: uidUtente(user),
    rifiutatoIl: serverTimestamp(),
    motivoRifiuto: String(motivo || '').trim(),
    validatoDa: null,
    validatoIl: null
  });
}

/**
 * Valida un'ora lavorata (caposquadra assegnato o manager, come la coda).
 * @param {string} lavoroId
 * @param {string} oraId
 * @returns {Promise<{ avvisi: string[] }>}
 */
export async function validaOra(lavoroId, oraId) {
  const tenantId = getCurrentTenantId();
  const user = getCurrentUserData();
  const { getDb } = await firebaseOre();
  return validaOraContesto(getDb(), tenantId, user, lavoroId, oraId);
}

/**
 * Rifiuta un'ora ancora da validare.
 * @param {string} lavoroId
 * @param {string} oraId
 * @param {string} motivoRifiuto
 * @returns {Promise<void>}
 */
export async function rifiutaOra(lavoroId, oraId, motivoRifiuto) {
  const tenantId = getCurrentTenantId();
  const user = getCurrentUserData();
  const { getDb } = await firebaseOre();
  await rifiutaOraContesto(getDb(), tenantId, user, lavoroId, oraId, motivoRifiuto);
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
  rifiutaOra,
  caricaOreUtenteGiorno,
  caricaOreUtente,
  salvaNuovaOra,
  modificaOraPropria,
  eliminaOraPropria,
  validaOraContesto,
  rifiutaOraContesto,
  correggiOra,
  annullaValidazioneOra,
  rifiutaOraValidata
};

