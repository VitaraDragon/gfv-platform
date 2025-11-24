/**
 * Calcolo Compensi Service - Servizio per calcolo compensi operai
 * Calcola compensi basati su ore validate e tariffe configurate
 * 
 * @module core/services/calcolo-compensi-service
 */

/**
 * Ottieni tariffa per un operaio
 * Restituisce tariffa personalizzata se presente, altrimenti tariffa default del tipo operaio
 * @param {string} tenantId - ID tenant
 * @param {Object} operaio - Dati operaio (deve avere tipoOperaio e tariffaPersonalizzata)
 * @returns {Promise<number>} Tariffa oraria in euro
 */
export async function getTariffaOperaio(tenantId, operaio) {
  try {
    // Se ha tariffa personalizzata, usa quella
    if (operaio.tariffaPersonalizzata !== null && operaio.tariffaPersonalizzata !== undefined) {
      return operaio.tariffaPersonalizzata;
    }
    
    // Altrimenti usa tariffa default del tipo operaio
    if (!operaio.tipoOperaio) {
      // Se non ha tipo operaio, usa tariffa default più bassa
      return 10.0;
    }
    
    // Carica tariffe dal tenant
    const { getFirestore, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    
    if (typeof window.firebaseConfig === 'undefined') {
      throw new Error('Firebase config non disponibile');
    }
    
    const app = initializeApp(window.firebaseConfig);
    const db = getFirestore(app);
    
    const tariffeRef = doc(db, `tenants/${tenantId}/tariffe`, 'operai');
    const tariffeSnap = await getDoc(tariffeRef);
    
    // Tariffe default
    const tariffeDefault = {
      semplice: 10.0,
      specializzato: 12.0,
      trattorista: 15.0,
      meccanico: 14.0,
      elettricista: 14.0,
      altro: 10.0
    };
    
    if (tariffeSnap.exists()) {
      const tariffe = tariffeSnap.data();
      return tariffe[operaio.tipoOperaio] || tariffeDefault[operaio.tipoOperaio] || 10.0;
    }
    
    return tariffeDefault[operaio.tipoOperaio] || 10.0;
  } catch (error) {
    console.error('Errore recupero tariffa operaio:', error);
    // Fallback a tariffa default
    return 10.0;
  }
}

/**
 * Calcola compensi per operai in un periodo
 * @param {string} tenantId - ID tenant
 * @param {Date} dataInizio - Data inizio periodo
 * @param {Date} dataFine - Data fine periodo
 * @param {Object} options - Opzioni aggiuntive
 * @param {string} options.operaioId - Filtra per singolo operaio (opzionale)
 * @param {string} options.tipoOperaio - Filtra per tipo operaio (opzionale)
 * @returns {Promise<Array>} Array di compensi calcolati
 */
export async function calcolaCompensi(tenantId, dataInizio, dataFine, options = {}) {
  try {
    const { getFirestore, collection, getDocs, query, where, Timestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    
    if (typeof window.firebaseConfig === 'undefined') {
      throw new Error('Firebase config non disponibile');
    }
    
    const app = initializeApp(window.firebaseConfig);
    const db = getFirestore(app);
    
    // Carica tutti i lavori
    const lavoriCollection = collection(db, `tenants/${tenantId}/lavori`);
    const lavoriSnapshot = await getDocs(lavoriCollection);
    
    // Mappa per aggregare ore per operaio
    const orePerOperaio = {};
    
    // Per ogni lavoro, carica le ore validate
    for (const lavoroDoc of lavoriSnapshot.docs) {
      const lavoroId = lavoroDoc.id;
      const oreRef = collection(db, `tenants/${tenantId}/lavori/${lavoroId}/oreOperai`);
      const oreQuery = query(oreRef, where('stato', '==', 'validate'));
      const oreSnapshot = await getDocs(oreQuery);
      
      oreSnapshot.forEach(oraDoc => {
        const ora = oraDoc.data();
        const dataOra = ora.data?.toDate ? ora.data.toDate() : new Date(ora.data);
        
        // Filtra per periodo
        if (dataOra < dataInizio || dataOra > dataFine) {
          return;
        }
        
        const operaioId = ora.operaioId;
        if (!operaioId) return;
        
        // Filtra per operaio se specificato
        if (options.operaioId && operaioId !== options.operaioId) {
          return;
        }
        
        const oreNette = ora.oreNette || 0;
        
        // Inizializza operaio se non esiste
        if (!orePerOperaio[operaioId]) {
          orePerOperaio[operaioId] = {
            operaioId: operaioId,
            nome: '',
            cognome: '',
            tipoOperaio: '',
            tariffaPersonalizzata: null,
            oreTotali: 0,
            compenso: 0
          };
        }
        
        // Aggrega ore
        orePerOperaio[operaioId].oreTotali += oreNette;
      });
    }
    
    // Carica dati operai e calcola compensi
    const usersCollection = collection(db, 'users');
    const usersQuery = query(usersCollection, where('tenantId', '==', tenantId));
    const usersSnapshot = await getDocs(usersQuery);
    
    const operaiMap = {};
    usersSnapshot.forEach(userDoc => {
      const userData = userDoc.data();
      const ruoli = userData.ruoli || [];
      
      // Filtra solo operai
      if (ruoli.some(r => r.toLowerCase().includes('operaio'))) {
        operaiMap[userDoc.id] = {
          nome: userData.nome || '',
          cognome: userData.cognome || '',
          tipoOperaio: userData.tipoOperaio || null,
          tariffaPersonalizzata: userData.tariffaPersonalizzata || null
        };
      }
    });
    
    // Calcola compensi
    const compensi = [];
    for (const operaioId of Object.keys(orePerOperaio)) {
      const datiOre = orePerOperaio[operaioId];
      const datiOperaio = operaiMap[operaioId];
      
      if (!datiOperaio) {
        // Operaio non trovato, salta
        continue;
      }
      
      // Filtra per tipo operaio se specificato
      if (options.tipoOperaio && datiOperaio.tipoOperaio !== options.tipoOperaio) {
        continue;
      }
      
      // Recupera tariffa
      const tariffa = await getTariffaOperaio(tenantId, {
        tipoOperaio: datiOperaio.tipoOperaio,
        tariffaPersonalizzata: datiOperaio.tariffaPersonalizzata
      });
      
      // Calcola compenso
      const compenso = datiOre.oreTotali * tariffa;
      
      compensi.push({
        operaioId: operaioId,
        nome: datiOperaio.nome,
        cognome: datiOperaio.cognome,
        tipoOperaio: datiOperaio.tipoOperaio || '',
        tariffa: tariffa,
        oreTotali: datiOre.oreTotali,
        compenso: compenso
      });
    }
    
    // Ordina per compenso decrescente
    compensi.sort((a, b) => b.compenso - a.compenso);
    
    return compensi;
  } catch (error) {
    console.error('Errore calcolo compensi:', error);
    throw new Error(`Errore calcolo compensi: ${error.message}`);
  }
}

/**
 * Formatta ore in formato leggibile (es. "8h 30min")
 * @param {number} ore - Ore in formato decimale (es. 8.5)
 * @returns {string} Ore formattate
 */
export function formattaOre(ore) {
  if (!ore || ore === 0) return '0h';
  
  const oreIntere = Math.floor(ore);
  const minuti = Math.round((ore - oreIntere) * 60);
  
  if (minuti === 0) {
    return `${oreIntere}h`;
  }
  
  return `${oreIntere}h ${minuti}min`;
}

/**
 * Formatta euro
 * @param {number} euro - Importo in euro
 * @returns {string} Importo formattato (es. "125,50 €")
 */
export function formattaEuro(euro) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(euro);
}


