/**
 * Lavori Frutteto Service - Servizio per integrazione Sistema Lavori/Diario con Modulo Frutteto
 * Aggrega automaticamente le spese dai lavori registrati e aggiorna i dati del frutteto
 * 
 * @module modules/frutteto/services/lavori-frutteto-service
 */

import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { getAllLavori, getLavoro } from '../../../core/services/lavori-service.js';
import { getFrutteto, updateFrutteto, getAllFrutteti } from './frutteti-service.js';
import { getTariffaOperaio, getTariffaProprietario } from '../../../core/services/calcolo-compensi-service.js';
import {
  getCollectionData,
  getDb,
  getDocumentData
} from '../../../core/services/firebase-service.js';

/**
 * Normalizza tipo lavoro per mappatura (lowercase, rimuovi spazi)
 * @param {string} tipoLavoro - Tipo lavoro
 * @returns {string} Tipo lavoro normalizzato
 */
function normalizzaTipoLavoro(tipoLavoro) {
  if (!tipoLavoro) return 'default';
  return tipoLavoro.toLowerCase().trim().replace(/\s+/g, '_');
}

/**
 * Ottieni categoria manodopera per tipo lavoro (fallback keyword, allineato a vigneto)
 * Usato per aggregare spese per categoria (potatura, trattamenti, raccolta, lavorazione terreno, altro).
 * @param {string} tipoLavoro - Tipo lavoro (es. "Potatura Manuale", "Raccolta Frutta")
 * @param {string} sottocategoriaCodice - Codice sottocategoria (opzionale, non usato)
 * @param {Object} lavoro - Dati lavoro (opzionale)
 * @returns {Promise<{ categoriaNome: string, categoriaCodice: string }>}
 */
async function getCategoriaManodoperaPerTipoLavoro(tipoLavoro, sottocategoriaCodice = null, lavoro = null) {
  try {
    const tipoNormalizzato = (tipoLavoro || '').toLowerCase();
    let categoriaNome = 'Altro';
    let categoriaCodice = 'altro';

    if (tipoNormalizzato.includes('potatura') || tipoNormalizzato.includes('spollonatura')) {
      categoriaNome = 'Potatura';
      categoriaCodice = 'potatura';
    } else if (tipoNormalizzato.includes('trattamento') || tipoNormalizzato.includes('antifungino') || tipoNormalizzato.includes('insetticida') || tipoNormalizzato.includes('fertilizzante')) {
      categoriaNome = 'Trattamenti';
      categoriaCodice = 'trattamenti';
    } else if (tipoNormalizzato.includes('raccolta') || tipoNormalizzato.includes('vendemmia') || tipoNormalizzato.includes('frutta')) {
      categoriaNome = 'Raccolta';
      categoriaCodice = 'raccolta';
    } else if (tipoNormalizzato.includes('lavorazione') || tipoNormalizzato.includes('aratura') || tipoNormalizzato.includes('erpicatura') || tipoNormalizzato.includes('fresatura') || tipoNormalizzato.includes('vangatura')) {
      categoriaNome = 'Lavorazione del Terreno';
      categoriaCodice = 'lavorazione_terreno';
    } else if (tipoNormalizzato.includes('diserbo')) {
      categoriaNome = 'Diserbo';
      categoriaCodice = 'diserbo';
    } else if (tipoNormalizzato.includes('semina') || tipoNormalizzato.includes('piantagione') || tipoNormalizzato.includes('trapianto')) {
      categoriaNome = 'Semina e Piantagione';
      categoriaCodice = 'semina_piantagione';
    } else if ((tipoNormalizzato.includes('gestione') && tipoNormalizzato.includes('verde')) || tipoNormalizzato.includes('falciatura') || tipoNormalizzato.includes('taglio')) {
      categoriaNome = 'Gestione del Verde';
      categoriaCodice = 'gestione_verde';
    } else if (tipoNormalizzato.includes('trasporto')) {
      categoriaNome = 'Trasporto';
      categoriaCodice = 'trasporto';
    } else if (tipoNormalizzato.includes('manutenzione') || tipoNormalizzato.includes('riparazione')) {
      categoriaNome = 'Manutenzione';
      categoriaCodice = 'manutenzione';
    }

    return { categoriaNome, categoriaCodice };
  } catch (error) {
    console.warn('[LAVORI-FRUTTETO] Errore recupero categoria manodopera:', error);
    return { categoriaNome: 'Altro', categoriaCodice: 'altro' };
  }
}

/**
 * Ottieni tutti i lavori collegati a un terreno (e quindi potenzialmente a un frutteto)
 * @param {string} terrenoId - ID terreno
 * @param {Object} options - Opzioni
 * @param {number} options.anno - Filtra per anno (opzionale)
 * @param {string} options.stato - Filtra per stato (opzionale, default: 'completato')
 * @returns {Promise<Array>} Array di lavori con costi calcolati
 */
export async function getLavoriPerTerreno(terrenoId, options = {}) {
  try {
    const { anno = null, stato = 'completato' } = options;
    
    // Recupera TUTTI i lavori (senza filtri e senza orderBy) per evitare indice composito
    // Poi filtra lato client per terrenoId, stato e anno
    const tenantId = getCurrentTenantId();
    const { getCollectionData } = await import('../../../core/services/firebase-service.js');
    const documentsRaw = await getCollectionData('lavori', {
      tenantId,
      orderBy: null,
      orderDirection: null
    });
    
    // Converti in oggetti Lavoro ma preserva dati raw per accesso ai Timestamp
    const lavori = documentsRaw
      .filter(doc => {
        // Filtra per terrenoId
        if (doc.terrenoId !== terrenoId) return false;
        
        // Filtra per stato
        if (stato && doc.stato !== stato) return false;
        
        // Filtra per anno se specificato
        if (anno) {
          const dataInizio = doc.dataInizio?.toDate ? doc.dataInizio.toDate() : (doc.dataInizio ? new Date(doc.dataInizio) : null);
          if (!dataInizio || dataInizio.getFullYear() !== anno) return false;
        }
        
        return true;
      })
      .map(doc => ({
        id: doc.id,
        ...doc,
        // Preserva Timestamp originali per calcoli
        dataInizioRaw: doc.dataInizio,
        dataFineRaw: doc.dataFine
      }));
    
    // Ordina per data (più recente prima)
    lavori.sort((a, b) => {
      const dataA = a.dataInizioRaw?.toDate ? a.dataInizioRaw.toDate() : (a.dataInizio ? new Date(a.dataInizio) : new Date(0));
      const dataB = b.dataInizioRaw?.toDate ? b.dataInizioRaw.toDate() : (b.dataInizio ? new Date(b.dataInizio) : new Date(0));
      return dataB - dataA;
    });
    
    return lavori;
  } catch (error) {
    console.error('[LAVORI-FRUTTETO] Errore recupero lavori per terreno:', error);
    return [];
  }
}

/**
 * Aggrega spese annuali per frutteto dai lavori e dalle attività dirette del diario
 * @param {string} fruttetoId - ID frutteto
 * @param {number} anno - Anno (opzionale, default: anno corrente)
 * @returns {Promise<Object>} Spese aggregate per categoria
 */
export async function aggregaSpeseFruttetoAnno(fruttetoId, anno = null) {
  try {
    const frutteto = await getFrutteto(fruttetoId);
    if (!frutteto) {
      throw new Error('Frutteto non trovato');
    }
    
    const annoTarget = anno || new Date().getFullYear();
    
    // Carica tutti i lavori completati per il terreno del frutteto
    const lavori = await getLavoriPerTerreno(frutteto.terrenoId, {
      anno: annoTarget,
      stato: 'completato' // Solo lavori completati
    });
    
    // Inizializza spese (struttura allineata a vigneto: categorie dinamiche + legacy)
    const spese = {
      speseManodoperaAnno: 0,
      speseMacchineAnno: 0,
      speseProdottiAnno: 0,
      spesePotaturaAnno: 0,
      speseTrattamentiAnno: 0,
      speseRaccoltaAnno: 0,
      speseTotaleAnno: 0
    };

    /**
     * Aggiungi costo manodopera alla categoria dinamica e al totale
     * @param {Object} speseObj - Oggetto spese
     * @param {string} categoriaCodice - Codice categoria (potatura, trattamenti, raccolta, ecc.)
     * @param {string} categoriaNome - Nome categoria per visualizzazione
     * @param {number} importo - Importo da aggiungere
     */
    function aggiungiManodoperaPerCategoria(speseObj, categoriaCodice, categoriaNome, importo) {
      if (!importo || importo <= 0) return;
      const categoriaCamelCase = categoriaCodice.split('_').map((part, index) =>
        index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
      ).join('');
      const chiaveCategoria = `manodopera${categoriaCamelCase.charAt(0).toUpperCase() + categoriaCamelCase.slice(1)}`;
      if (!speseObj.hasOwnProperty(chiaveCategoria)) {
        speseObj[chiaveCategoria] = 0;
        speseObj[`${chiaveCategoria}_nome`] = categoriaNome;
      }
      speseObj[chiaveCategoria] = (speseObj[chiaveCategoria] || 0) + importo;
      speseObj.speseManodoperaAnno += importo;
    }

    // Calcola spese da ogni lavoro (con categorizzazione tipo lavoro → categoria)
    for (const lavoro of lavori) {
      const costi = await calcolaCostiLavoro(lavoro.id, lavoro);

      const risultato = await getCategoriaManodoperaPerTipoLavoro(
        lavoro.tipoLavoro,
        lavoro.sottocategoriaCodice,
        lavoro
      );
      aggiungiManodoperaPerCategoria(spese, risultato.categoriaCodice, risultato.categoriaNome, costi.costoManodopera || 0);

      spese.speseMacchineAnno += costi.costoMacchine || 0;
      spese.speseProdottiAnno += costi.costoProdotti || 0;
      spese.speseTotaleAnno += costi.costoTotale || 0;
    }
    
    // Se ci sono lavori completati, trova la data del primo lavoro per determinare il periodo non coperto
    let dataPrimoLavoro = null;
    if (lavori.length > 0) {
      // Trova la data inizio più antica tra i lavori completati
      const dateInizio = lavori
        .map(l => {
          const dataInizio = l.dataInizioRaw?.toDate ? l.dataInizioRaw.toDate() : (l.dataInizio ? new Date(l.dataInizio) : null);
          if (!dataInizio || isNaN(dataInizio.getTime())) return null;
          return dataInizio;
        })
        .filter(d => d !== null && !isNaN(d.getTime()));
      
      if (dateInizio.length > 0) {
        dataPrimoLavoro = new Date(Math.min(...dateInizio.map(d => d.getTime())));
      }
    }
    
    // Carica attività dirette del diario (senza lavoroId) per il terreno del frutteto
    const tenantId = getCurrentTenantId();
    const db = getDb();
    
    if (!db || !tenantId) {
      console.warn('[LAVORI-FRUTTETO] Database o tenantId non disponibili per caricare attività dirette');
    } else {
      try {
        const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const attivitaRef = collection(db, `tenants/${tenantId}/attivita`);
        
        // Recupera tutte le attività per il terreno (filtro lato client per lavoroId null)
        // Firestore non supporta where('lavoroId', '==', null), quindi recuperiamo tutte e filtriamo
        const attivitaQuery = query(
          attivitaRef,
          where('terrenoId', '==', frutteto.terrenoId)
        );
        
        const attivitaSnapshot = await getDocs(attivitaQuery);
        
        // Filtra lato client per anno, data, e attività dirette (senza lavoroId)
        const annoInizio = `${annoTarget}-01-01`;
        const annoFine = `${annoTarget}-12-31`;
        const dataLimite = dataPrimoLavoro ? dataPrimoLavoro.toISOString().split('T')[0] : annoFine;
        
        // Filtra tutte le attività valide
        const attivitaValide = [];
        const macchineMap = {};
        
        attivitaSnapshot.forEach(attivitaDoc => {
          const attivita = attivitaDoc.data();
          
          // Filtra solo attività dirette (senza lavoroId) e aziendali (senza clienteId)
          if (attivita.lavoroId && attivita.lavoroId !== '') {
            return;
          }
          if (attivita.clienteId && attivita.clienteId !== '') {
            return;
          }
          if (!attivita.data) {
            return;
          }
          if (!attivita.tipoLavoro) {
            return;
          }
          
          // Filtra per anno
          if (attivita.data < annoInizio || attivita.data > annoFine) {
            return;
          }
          
          // Se ci sono lavori completati, verifica se l'attività diretta è duplicata
          // Un'attività diretta è considerata duplicata se:
          // - È dello stesso giorno o dopo del primo lavoro
          // - E ha lo stesso tipo di lavoro di un lavoro completato
          // Altrimenti, è una lavorazione diversa e va inclusa (es. potatura vs erpicatura nello stesso giorno)
          if (dataPrimoLavoro && attivita.data >= dataLimite) {
            // Verifica se c'è un lavoro completato dello stesso tipo nello stesso giorno
            const attivitaData = attivita.data;
            const lavoroDuplicato = lavori.find(l => {
              const dataInizio = l.dataInizioRaw?.toDate ? l.dataInizioRaw.toDate() : (l.dataInizio ? new Date(l.dataInizio) : null);
              if (!dataInizio || isNaN(dataInizio.getTime())) return false;
              const lavoroData = dataInizio.toISOString().split('T')[0];
              return lavoroData === attivitaData && l.tipoLavoro === attivita.tipoLavoro;
            });
            
            // Se c'è un lavoro duplicato (stesso tipo, stesso giorno), escludi l'attività diretta
            if (lavoroDuplicato) {
              return;
            }
            // Altrimenti, è una lavorazione diversa e va inclusa
          }
          
          // Aggiungi a lista attività valide
          attivitaValide.push(attivita);
          
          // Aggrega ore macchina se presenti (per calcolo costi macchine)
          const oreMacchina = attivita.oreMacchina || 0;
          const macchinaId = attivita.macchinaId;
          const attrezzoId = attivita.attrezzoId;
          
          if (macchinaId && oreMacchina > 0) {
            if (!macchineMap[macchinaId]) {
              macchineMap[macchinaId] = { macchinaId: macchinaId, oreTotali: 0 };
            }
            macchineMap[macchinaId].oreTotali += oreMacchina;
          }
          
          if (attrezzoId && oreMacchina > 0) {
            if (!macchineMap[attrezzoId]) {
              macchineMap[attrezzoId] = { macchinaId: attrezzoId, oreTotali: 0 };
            }
            macchineMap[attrezzoId].oreTotali += oreMacchina;
          }
        });
        
        // Calcola costi manodopera dalle attività dirette (con categorizzazione)
        if (attivitaValide.length > 0) {
          const tariffaProprietario = await getTariffaProprietario(tenantId);

          for (const attivita of attivitaValide) {
            const oreNette = attivita.oreNette || 0;
            if (oreNette > 0) {
              const costoManodopera = oreNette * tariffaProprietario;
              const risultato = await getCategoriaManodoperaPerTipoLavoro(
                attivita.tipoLavoro,
                attivita.sottocategoriaCodice,
                attivita
              );
              aggiungiManodoperaPerCategoria(spese, risultato.categoriaCodice, risultato.categoriaNome, costoManodopera);
            }
          }
        }
        
        // Calcola costo macchine dalle attività dirette (se modulo Parco Macchine attivo)
        let hasParcoMacchineModule = false;
        try {
          const { hasModuleAccess } = await import('../../../core/services/tenant-service.js');
          hasParcoMacchineModule = await hasModuleAccess('parcoMacchine');
        } catch (error) {
          // Modulo non disponibile, ignora
        }
        
        if (hasParcoMacchineModule && Object.keys(macchineMap).length > 0) {
          const { getMacchina } = await import('../../../modules/parco-macchine/services/macchine-service.js');
          
          for (const [macchinaId, datiMacchina] of Object.entries(macchineMap)) {
            try {
              const macchina = await getMacchina(macchinaId);
              if (macchina && macchina.costoOra) {
                const costoMacchina = datiMacchina.oreTotali * macchina.costoOra;
                spese.speseMacchineAnno += costoMacchina;
              }
            } catch (error) {
              console.warn(`[LAVORI-FRUTTETO] Errore calcolo costo macchina ${macchinaId} da attività dirette:`, error);
            }
          }
        }
      } catch (error) {
        console.warn('[LAVORI-FRUTTETO] Errore caricamento attività dirette del diario:', error);
        // Non blocchiamo il calcolo, continuiamo con i lavori completati
      }
    }

    // Costi prodotti da trattamenti (frutteti/{fruttetoId}/trattamenti) per l'anno
    try {
      const { getTrattamenti } = await import('./trattamenti-frutteto-service.js');
      const trattamenti = await getTrattamenti(fruttetoId, { anno: annoTarget });
      for (const t of trattamenti) {
        const costoProdotti = (t.prodotti && t.prodotti.length)
          ? t.prodotti.reduce((s, r) => s + (Number(r.costo) || 0), 0)
          : (Number(t.costoProdotto) || 0);
        spese.speseProdottiAnno += costoProdotti;
      }
    } catch (error) {
      console.warn('[LAVORI-FRUTTETO] Errore caricamento costi prodotti da trattamenti:', error);
    }

    // Ricalcola speseTotaleAnno dopo aver aggiunto le attività dirette e i prodotti trattamenti
    spese.speseTotaleAnno = spese.speseManodoperaAnno + spese.speseMacchineAnno + spese.speseProdottiAnno;

    // Mappa categorie dinamiche su campi legacy (allineato a vigneto)
    spese.spesePotaturaAnno = spese.manodoperaPotatura || 0;
    spese.speseTrattamentiAnno = spese.manodoperaTrattamenti || 0;
    spese.speseRaccoltaAnno = spese.manodoperaRaccolta || 0;

    // API allineata: costoTotaleAnno (come vigneto)
    spese.costoTotaleAnno = spese.speseTotaleAnno;

    // Arrotonda a 2 decimali (escludi chiavi _nome)
    Object.keys(spese).forEach(key => {
      if (key.endsWith('_nome')) return;
      const valore = spese[key];
      if (typeof valore === 'number' && !isNaN(valore)) {
        spese[key] = parseFloat(valore.toFixed(2));
      }
    });

    return spese;
  } catch (error) {
    console.error('[LAVORI-FRUTTETO] Errore aggregazione spese frutteto:', error);
    return {
      speseManodoperaAnno: 0,
      speseMacchineAnno: 0,
      speseProdottiAnno: 0,
      spesePotaturaAnno: 0,
      speseTrattamentiAnno: 0,
      speseRaccoltaAnno: 0,
      speseTotaleAnno: 0,
      costoTotaleAnno: 0
    };
  }
}

/**
 * Restituisce le attività dirette del diario (senza lavoroId) per un terreno/anno, con costo calcolato.
 * Usata dalla dashboard per mostrare sia i lavori che le attività da diario nell'elenco.
 * @param {string} terrenoId - ID terreno
 * @param {number} anno - Anno
 * @param {Array} lavori - Lista lavori già caricati per lo stesso terreno/anno (per escludere duplicati)
 * @returns {Promise<Array>} Array di { id, data, tipoLavoro, costoTotale }
 */
export async function getAttivitaDirettePerTerreno(terrenoId, anno, lavori = []) {
  try {
    const tenantId = getCurrentTenantId();
    const db = getDb();
    if (!db || !tenantId) return [];

    const annoInizio = `${anno}-01-01`;
    const annoFine = `${anno}-12-31`;
    let dataPrimoLavoro = null;
    if (lavori.length > 0) {
      const dateInizio = lavori
        .map(l => {
          const d = l.dataInizioRaw?.toDate ? l.dataInizioRaw.toDate() : (l.dataInizio ? new Date(l.dataInizio) : null);
          return d && !isNaN(d.getTime()) ? d : null;
        })
        .filter(d => d !== null);
      if (dateInizio.length > 0) {
        dataPrimoLavoro = new Date(Math.min(...dateInizio.map(d => d.getTime())));
      }
    }
    const dataLimite = dataPrimoLavoro ? dataPrimoLavoro.toISOString().split('T')[0] : annoFine;

    const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const attivitaRef = collection(db, `tenants/${tenantId}/attivita`);
    const attivitaQuery = query(attivitaRef, where('terrenoId', '==', terrenoId));
    const attivitaSnapshot = await getDocs(attivitaQuery);

    const tariffaProprietario = await getTariffaProprietario(tenantId);
    const risultati = [];

    for (const attivitaDoc of attivitaSnapshot.docs) {
      const attivita = attivitaDoc.data();
      if (attivita.lavoroId && attivita.lavoroId !== '') continue;
      if (attivita.clienteId && attivita.clienteId !== '') continue;
      if (!attivita.data || !attivita.tipoLavoro) continue;
      if (attivita.data < annoInizio || attivita.data > annoFine) continue;

      if (dataPrimoLavoro && attivita.data >= dataLimite) {
        const lavoroDuplicato = lavori.find(l => {
          const dataInizio = l.dataInizioRaw?.toDate ? l.dataInizioRaw.toDate() : (l.dataInizio ? new Date(l.dataInizio) : null);
          if (!dataInizio || isNaN(dataInizio.getTime())) return false;
          const lavoroData = dataInizio.toISOString().split('T')[0];
          return lavoroData === attivita.data && l.tipoLavoro === attivita.tipoLavoro;
        });
        if (lavoroDuplicato) continue;
      }

      const oreNette = attivita.oreNette || 0;
      const costoManodopera = oreNette * tariffaProprietario;

      risultati.push({
        id: attivitaDoc.id,
        data: attivita.data,
        tipoLavoro: attivita.tipoLavoro,
        oreNette,
        costoManodopera
      });
    }

    // costoTotale = costo manodopera (per la lista dashboard; le macchine sono incluse in aggregaSpeseFruttetoAnno)
    risultati.forEach(r => {
      r.costoTotale = parseFloat((r.costoManodopera || 0).toFixed(2));
    });

    const out = risultati.map(({ id, data, tipoLavoro, costoTotale }) => ({ id, data, tipoLavoro, costoTotale: costoTotale || 0 }));
    console.log('[LAVORI-FRUTTETO] getAttivitaDirettePerTerreno', terrenoId, anno, ':', out.length, 'attività dirette');
    return out;
  } catch (error) {
    console.warn('[LAVORI-FRUTTETO] Errore getAttivitaDirettePerTerreno:', error);
    return [];
  }
}

/**
 * Calcola costi di un lavoro (manodopera + macchine + prodotti)
 * @param {string} lavoroId - ID lavoro
 * @param {Object} lavoro - Dati lavoro (opzionale, se non passato viene caricato)
 * @returns {Promise<Object>} { costoManodopera, costoMacchine, costoProdotti, costoTotale }
 */
export async function calcolaCostiLavoro(lavoroId, lavoro = null) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const db = getDb();
    if (!db) {
      throw new Error('Database non disponibile');
    }
    
    if (!lavoro) {
      lavoro = await getLavoro(lavoroId);
    }
    
    if (!lavoro) {
      return {
        costoManodopera: 0,
        costoMacchine: 0,
        costoProdotti: 0,
        costoTotale: 0
      };
    }
    
    let costoManodopera = 0;
    let costoMacchine = 0;
    let costoProdotti = 0;
    
    // Carica ore validate per questo lavoro
    const { collection, getDocs, query, where, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const { getDocumentData } = await import('../../../core/services/firebase-service.js');
    const oreRef = collection(db, `tenants/${tenantId}/lavori/${lavoroId}/oreOperai`);
    const oreQuery = query(oreRef, where('stato', '==', 'validate'));
    const oreSnapshot = await getDocs(oreQuery);
    
    // Mappa per aggregare ore per operaio
    const orePerOperaio = {};
    const macchineMap = {};
    
    oreSnapshot.forEach((oraDoc) => {
      const ora = oraDoc.data();
      const operaioId = ora.operaioId;
      
      if (!operaioId) {
        return;
      }
      
      // Aggrega ore manodopera
      const oreNette = ora.oreNette || 0;
      if (!orePerOperaio[operaioId]) {
        orePerOperaio[operaioId] = {
          operaioId: operaioId,
          oreTotali: 0
        };
      }
      orePerOperaio[operaioId].oreTotali += oreNette;
      
      // Aggrega ore macchina (trattore)
      const oreMacchina = ora.oreMacchina || 0;
      const macchinaId = ora.macchinaId;
      const attrezzoId = ora.attrezzoId;
      
      // Aggrega ore trattore
      if (macchinaId && oreMacchina > 0) {
        if (!macchineMap[macchinaId]) {
          macchineMap[macchinaId] = {
            macchinaId: macchinaId,
            oreTotali: 0
          };
        }
        macchineMap[macchinaId].oreTotali += oreMacchina;
      }
      
      // Aggrega ore attrezzo
      if (attrezzoId && oreMacchina > 0) {
        if (!macchineMap[attrezzoId]) {
          macchineMap[attrezzoId] = {
            macchinaId: attrezzoId,
            oreTotali: 0
          };
        }
        macchineMap[attrezzoId].oreTotali += oreMacchina;
      }
    });
    
    // Calcola costo manodopera da ore operai (se modulo Manodopera attivo)
    for (const [operaioId, datiOre] of Object.entries(orePerOperaio)) {
      try {
        // Carica dati operaio
        const operaioData = await getDocumentData('users', operaioId);
        if (!operaioData) continue;
        
        // Recupera tariffa (usa la stessa logica del vigneto)
        const tariffa = await getTariffaOperaio(tenantId, {
          tipoOperaio: operaioData.tipoOperaio || null,
          tariffaPersonalizzata: operaioData.tariffaPersonalizzata || null
        });
        
        // Calcola costo
        costoManodopera += datiOre.oreTotali * tariffa;
      } catch (error) {
        console.warn(`[LAVORI-FRUTTETO] Errore calcolo costo operaio ${operaioId}:`, error);
      }
    }
    
    // Se non ci sono ore da operai, cerca nelle attività del Diario (proprietario)
    // Questo gestisce il caso in cui il modulo Manodopera non è attivo
    if (Object.keys(orePerOperaio).length === 0) {
      try {
        // Verifica se modulo Manodopera è attivo
        let hasManodoperaModule = false;
        try {
          const { hasModuleAccess } = await import('../../../core/services/tenant-service.js');
          hasManodoperaModule = await hasModuleAccess('manodopera');
        } catch (error) {
          // Modulo non disponibile, ignora
        }
        
        // Se modulo Manodopera non attivo, cerca nelle attività del Diario
        if (!hasManodoperaModule) {
          const attivitaRef = collection(db, `tenants/${tenantId}/attivita`);
          const attivitaQuery = query(attivitaRef, where('lavoroId', '==', lavoroId));
          const attivitaSnapshot = await getDocs(attivitaQuery);
          
          let oreTotaliProprietario = 0;
          
          attivitaSnapshot.forEach(attivitaDoc => {
            const attivita = attivitaDoc.data();
            const oreNette = attivita.oreNette || 0;
            oreTotaliProprietario += oreNette;
            
            // Aggrega anche ore macchina dalle attività
            const oreMacchina = attivita.oreMacchina || 0;
            const macchinaId = attivita.macchinaId;
            const attrezzoId = attivita.attrezzoId;
            
            // Aggrega ore trattore
            if (macchinaId && oreMacchina > 0) {
              if (!macchineMap[macchinaId]) {
                macchineMap[macchinaId] = {
                  macchinaId: macchinaId,
                  oreTotali: 0
                };
              }
              macchineMap[macchinaId].oreTotali += oreMacchina;
            }
            
            // Aggrega ore attrezzo
            if (attrezzoId && oreMacchina > 0) {
              if (!macchineMap[attrezzoId]) {
                macchineMap[attrezzoId] = {
                  macchinaId: attrezzoId,
                  oreTotali: 0
                };
              }
              macchineMap[attrezzoId].oreTotali += oreMacchina;
            }
          });
          
          // Calcola costo manodopera proprietario
          if (oreTotaliProprietario > 0) {
            const tariffaProprietario = await getTariffaProprietario(tenantId);
            costoManodopera += oreTotaliProprietario * tariffaProprietario;
          }
        }
      } catch (error) {
        console.warn('[LAVORI-FRUTTETO] Errore calcolo costo da attività Diario:', error);
      }
    }
    
    // Calcola costo macchine (trattori + attrezzi)
    let hasParcoMacchineModule = false;
    try {
      const { hasModuleAccess } = await import('../../../core/services/tenant-service.js');
      hasParcoMacchineModule = await hasModuleAccess('parcoMacchine');
    } catch (error) {
      // Modulo non disponibile, ignora
    }
    
    if (hasParcoMacchineModule) {
      const { getMacchina } = await import('../../../modules/parco-macchine/services/macchine-service.js');
      
      // Calcola costo per tutte le macchine (trattori e attrezzi)
      for (const [macchinaId, datiMacchina] of Object.entries(macchineMap)) {
        try {
          const macchina = await getMacchina(macchinaId);
          
          if (macchina && macchina.costoOra) {
            const costo = datiMacchina.oreTotali * macchina.costoOra;
            costoMacchine += costo;
          }
        } catch (error) {
          console.warn(`[LAVORI-FRUTTETO] Errore calcolo costo macchina ${macchinaId}:`, error);
        }
      }
    }
    
    // Calcola costo prodotti (se presente nel lavoro)
    if (lavoro.costoProdotti) {
      costoProdotti = parseFloat(lavoro.costoProdotti) || 0;
    }
    
    const costoTotale = parseFloat((costoManodopera + costoMacchine + costoProdotti).toFixed(2));
    
    return {
      costoManodopera: parseFloat(costoManodopera.toFixed(2)),
      costoMacchine: parseFloat(costoMacchine.toFixed(2)),
      costoProdotti: parseFloat(costoProdotti.toFixed(2)),
      costoTotale: costoTotale
    };
  } catch (error) {
    console.error('[LAVORI-FRUTTETO] Errore calcolo costi lavoro:', error);
    console.error('[LAVORI-FRUTTETO] Stack:', error.stack);
    return {
      costoManodopera: 0,
      costoMacchine: 0,
      costoProdotti: 0,
      costoTotale: 0
    };
  }
}

/**
 * Ricalcola e aggiorna le spese di un frutteto per un anno specifico
 * @param {string} fruttetoId - ID frutteto
 * @param {number} anno - Anno (opzionale, default: anno corrente)
 * @returns {Promise<void>}
 */
export async function ricalcolaSpeseFruttetoAnno(fruttetoId, anno = null) {
  try {
    const spese = await aggregaSpeseFruttetoAnno(fruttetoId, anno);
    const frutteto = await getFrutteto(fruttetoId);
    
    if (!frutteto) {
      throw new Error('Frutteto non trovato');
    }
    
    // Aggiorna spese nel frutteto
    // Nota: speseProdottiAnno viene salvato come speseAltroAnno per compatibilità con BaseColtura
    await updateFrutteto(fruttetoId, {
      speseManodoperaAnno: spese.speseManodoperaAnno,
      speseMacchineAnno: spese.speseMacchineAnno,
      speseAltroAnno: spese.speseProdottiAnno, // Usa speseAltroAnno per prodotti
      speseRaccoltaAnno: spese.speseRaccoltaAnno,
      speseTotaleAnno: spese.speseTotaleAnno,
      costoTotaleAnno: spese.speseTotaleAnno // Salva anche costoTotaleAnno per compatibilità con BaseColtura
    });

    // Aggiorna statistiche aggregate in background (non blocca la risposta)
    const annoTarget = anno || new Date().getFullYear();
    import('./frutteto-statistiche-aggregate-service.js').then(({ calcolaEAggiornaStatistiche }) => {
      calcolaEAggiornaStatistiche(fruttetoId, annoTarget).catch(err => {
        console.warn('[LAVORI-FRUTTETO] Errore aggiornamento statistiche aggregate (non critico):', err);
      });
    });
  } catch (error) {
    console.error('[LAVORI-FRUTTETO] Errore ricalcolo spese frutteto:', error);
    throw error;
  }
}

export default {
  getLavoriPerTerreno,
  aggregaSpeseFruttetoAnno,
  getAttivitaDirettePerTerreno,
  calcolaCostiLavoro,
  ricalcolaSpeseFruttetoAnno
};
