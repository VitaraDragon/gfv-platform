/**
 * Lavori Vigneto Service - Servizio per integrazione Sistema Lavori/Diario con Modulo Vigneto
 * Aggrega automaticamente le spese dai lavori registrati e aggiorna i dati del vigneto
 * 
 * @module modules/vigneto/services/lavori-vigneto-service
 */

import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { getAllLavori, getLavoro } from '../../../core/services/lavori-service.js';
import { getVigneto, updateVigneto, getVignetiByTerreno } from './vigneti-service.js';
import { getTariffaOperaio, getTariffaProprietario } from '../../../core/services/calcolo-compensi-service.js';
import { 
  getCollectionData,
  getDb,
  getDocumentData
} from '../../../core/services/firebase-service.js';

/**
 * Cache per categorie già caricate (per performance)
 * @type {Map<string, Object>}
 */
const categorieCache = new Map();

/**
 * Recupera la categoria principale da un tipo lavoro
 * @param {string} tipoLavoroNome - Nome tipo lavoro (es. "Potatura Manuale", "Fresatura Tra le File")
 * @returns {Promise<Object|null>} { nome: string, codice: string } o null se non trovato
 */
async function getCategoriaPrincipaleDaTipoLavoro(tipoLavoroNome) {
  try {
    if (!tipoLavoroNome) return null;
    
    // Verifica cache
    const cacheKey = tipoLavoroNome.toLowerCase().trim();
    if (categorieCache.has(cacheKey)) {
      return categorieCache.get(cacheKey);
    }
    
    // Recupera TipoLavoro dal nome
    const { getTipoLavoroByNome } = await import('../../../core/services/tipi-lavoro-service.js');
    const tipoLavoro = await getTipoLavoroByNome(tipoLavoroNome);
    
    if (!tipoLavoro || !tipoLavoro.categoriaId) {
      // Se non trova TipoLavoro, prova a dedurre dalla stringa (fallback)
      return null;
    }
    
    // Recupera categoria principale
    const { getCategoria } = await import('../../../core/services/categorie-service.js');
    const categoria = await getCategoria(tipoLavoro.categoriaId);
    
    if (!categoria) {
      return null;
    }
    
    // Se la categoria ha un parentId, recupera la categoria principale (parent)
    let categoriaPrincipale = categoria;
    if (categoria.parentId) {
      categoriaPrincipale = await getCategoria(categoria.parentId);
      if (!categoriaPrincipale) {
        return null;
      }
    }
    
    const risultato = {
      nome: categoriaPrincipale.nome,
      codice: categoriaPrincipale.codice
    };
    
    // Salva in cache
    categorieCache.set(cacheKey, risultato);
    
    return risultato;
  } catch (error) {
    console.warn(`[LAVORI-VIGNETO] Errore recupero categoria per tipo lavoro "${tipoLavoroNome}":`, error);
    return null;
  }
}

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
 * Verifica se un lavoro richiede macchine in base al tipo lavoro o presenza macchina
 * @param {string} tipoLavoro - Tipo lavoro (può contenere "manuale" o "meccanico")
 * @param {string} sottocategoriaCodice - Codice sottocategoria (opzionale, es. "potatura_manuale", "lavorazione_terreno_generale")
 * @param {Object} lavoro - Dati lavoro (per verificare presenza macchina)
 * @returns {boolean} True se richiede macchine
 */
function richiedeMacchine(tipoLavoro, sottocategoriaCodice, lavoro) {
  // Verifica presenza macchina nel lavoro (priorità massima)
  if (lavoro && (lavoro.macchinaId || lavoro.attrezzoId)) {
    return true;
  }
  
  // Verifica nel tipo lavoro se contiene "meccanico" o "meccanica"
  if (tipoLavoro) {
    const tipoNormalizzato = tipoLavoro.toLowerCase();
    if (tipoNormalizzato.includes('meccanico') || tipoNormalizzato.includes('meccanica')) {
      return true;
    }
    // Se contiene "manuale" → non richiede macchine (a meno che non ci sia macchina assegnata, già verificato sopra)
    if (tipoNormalizzato.includes('manuale')) {
      return false;
    }
  }
  
  // Verifica nella sottocategoria se presente
  if (sottocategoriaCodice) {
    const sottocategoriaNormalizzata = sottocategoriaCodice.toLowerCase();
    if (sottocategoriaNormalizzata.includes('meccanico') || sottocategoriaNormalizzata.includes('meccanica')) {
      return true;
    }
    if (sottocategoriaNormalizzata.includes('manuale')) {
      return false;
    }
  }
  
  // Default: verifica presenza macchina (già fatto sopra, quindi false)
  return false;
}

/**
 * Ottieni categoria principale manodopera per tipo lavoro
 * Recupera la categoria principale dal sistema (es. "Potatura", "Lavorazione del Terreno")
 * e la usa come sotto-categoria di Manodopera
 * @param {string} tipoLavoro - Tipo lavoro (es. "Potatura Manuale", "Fresatura Tra le File")
 * @param {string} sottocategoriaCodice - Codice sottocategoria (opzionale, non più usato ma mantenuto per compatibilità)
 * @param {Object} lavoro - Dati lavoro (opzionale, per verificare presenza macchina)
 * @returns {Promise<Object>} { categoriaNome: string, categoriaCodice: string, richiedeMacchine: boolean }
 */
export async function getCategoriaManodoperaPerTipoLavoro(tipoLavoro, sottocategoriaCodice = null, lavoro = null) {
  try {
    // Recupera categoria principale dal TipoLavoro
    const categoriaPrincipale = await getCategoriaPrincipaleDaTipoLavoro(tipoLavoro);
    
    let categoriaNome = 'Altro';
    let categoriaCodice = 'altro';
    
    if (categoriaPrincipale) {
      // Usa la categoria principale del sistema
      categoriaNome = categoriaPrincipale.nome;
      categoriaCodice = categoriaPrincipale.codice;
    } else {
      // Fallback: prova a dedurre dal nome tipo lavoro
      const tipoNormalizzato = tipoLavoro.toLowerCase();
      
      // Mappa basata su parole chiave nel nome
      if (tipoNormalizzato.includes('potatura') || tipoNormalizzato.includes('spollonatura')) {
        categoriaNome = 'Potatura';
        categoriaCodice = 'potatura';
      } else if (tipoNormalizzato.includes('trattamento') || tipoNormalizzato.includes('antifungino') || tipoNormalizzato.includes('insetticida') || tipoNormalizzato.includes('fertilizzante')) {
        categoriaNome = 'Trattamenti';
        categoriaCodice = 'trattamenti';
      } else if (tipoNormalizzato.includes('vendemmia') || tipoNormalizzato.includes('raccolta_uva')) {
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
      } else if (tipoNormalizzato.includes('gestione') && tipoNormalizzato.includes('verde') || tipoNormalizzato.includes('falciatura') || tipoNormalizzato.includes('taglio')) {
        categoriaNome = 'Gestione del Verde';
        categoriaCodice = 'gestione_verde';
      } else if (tipoNormalizzato.includes('trasporto')) {
        categoriaNome = 'Trasporto';
        categoriaCodice = 'trasporto';
      } else if (tipoNormalizzato.includes('manutenzione') || tipoNormalizzato.includes('riparazione')) {
        categoriaNome = 'Manutenzione';
        categoriaCodice = 'manutenzione';
      }
      // Default: Altro (già impostato sopra)
    }
    
    // Determina se richiede macchine
    const richiedeMacchineFlag = richiedeMacchine(tipoLavoro, sottocategoriaCodice, lavoro);
    
    return {
      categoriaNome: categoriaNome,
      categoriaCodice: categoriaCodice,
      richiedeMacchine: richiedeMacchineFlag
    };
  } catch (error) {
    console.warn('[LAVORI-VIGNETO] Errore recupero categoria manodopera:', error);
    // Fallback a "Altro"
    return {
      categoriaNome: 'Altro',
      categoriaCodice: 'altro',
      richiedeMacchine: richiedeMacchine(tipoLavoro, sottocategoriaCodice, lavoro)
    };
  }
}

/**
 * Ottieni categoria spesa per tipo lavoro (DEPRECATO - mantenuto per compatibilità)
 * Versione sincrona con fallback (non può essere asincrona per compatibilità)
 * @param {string} tipoLavoro - Tipo lavoro
 * @returns {string} Categoria spesa (legacy)
 * @deprecated Usare getCategoriaManodoperaPerTipoLavoro invece (versione asincrona)
 */
function getCategoriaSpesaPerTipoLavoro(tipoLavoro) {
  // Fallback sincrono: mappa basata su parole chiave nel nome
  const tipoNormalizzato = normalizzaTipoLavoro(tipoLavoro);
  
  // Mappa basata su match parziale (per compatibilità con codice esistente)
  if (tipoNormalizzato.includes('potatura') || tipoNormalizzato.includes('spollonatura')) {
    return 'spesePotaturaAnno';
  }
  if (tipoNormalizzato.includes('trattamento') || tipoNormalizzato.includes('antifungino') || tipoNormalizzato.includes('insetticida') || tipoNormalizzato.includes('fertilizzante')) {
    return 'speseTrattamentiAnno';
  }
  if (tipoNormalizzato.includes('vendemmia') || tipoNormalizzato.includes('raccolta_uva')) {
    return 'speseVendemmiaAnno';
  }
  if (tipoNormalizzato.includes('lavorazione') || tipoNormalizzato.includes('aratura') || tipoNormalizzato.includes('erpicatura') || tipoNormalizzato.includes('fresatura')) {
    return 'speseManodoperaAnno'; // Lavorazione terreno va in manodopera generica
  }
  
  // Default: manodopera generica
  return 'speseManodoperaAnno';
}

/**
 * Calcola costi di un lavoro (manodopera + macchine)
 * @param {string} lavoroId - ID lavoro
 * @param {Object} lavoro - Dati lavoro
 * @returns {Promise<Object>} { costoManodopera: number, costoMacchine: number, costoTotale: number }
 */
export async function calcolaCostiLavoro(lavoroId, lavoro) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const db = getDb();
    if (!db) {
      throw new Error('Database non disponibile');
    }
    
    let costoManodopera = 0;
    let costoMacchine = 0;
    
    // Carica ore validate per questo lavoro
    const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const oreRef = collection(db, `tenants/${tenantId}/lavori/${lavoroId}/oreOperai`);
    const oreQuery = query(oreRef, where('stato', '==', 'validate'));
    const oreSnapshot = await getDocs(oreQuery);
    
    // Mappa per aggregare ore per operaio
    const orePerOperaio = {};
    const macchineMap = {};
    
    oreSnapshot.forEach((oraDoc, index) => {
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
        
        // Recupera tariffa
        const tariffa = await getTariffaOperaio(tenantId, {
          tipoOperaio: operaioData.tipoOperaio || null,
          tariffaPersonalizzata: operaioData.tariffaPersonalizzata || null
        });
        
        // Calcola costo
        costoManodopera += datiOre.oreTotali * tariffa;
      } catch (error) {
        console.warn(`[LAVORI-VIGNETO] Errore calcolo costo operaio ${operaioId}:`, error);
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
        console.warn('[LAVORI-VIGNETO] Errore calcolo costo da attività Diario:', error);
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
          console.warn(`[LAVORI-VIGNETO] Errore calcolo costo macchina ${macchinaId}:`, error);
        }
      }
    }
    
    const costoTotale = parseFloat((costoManodopera + costoMacchine).toFixed(2));
    
    return {
      costoManodopera: parseFloat(costoManodopera.toFixed(2)),
      costoMacchine: parseFloat(costoMacchine.toFixed(2)),
      costoTotale: costoTotale
    };
  } catch (error) {
    console.error('[LAVORI-VIGNETO] Errore calcolo costi lavoro:', error);
    console.error('[LAVORI-VIGNETO] Stack:', error.stack);
    return {
      costoManodopera: 0,
      costoMacchine: 0,
      costoTotale: 0
    };
  }
}

/**
 * Ottieni tutti i lavori collegati a un terreno (e quindi potenzialmente a un vigneto)
 * @param {string} terrenoId - ID terreno
 * @param {Object} options - Opzioni
 * @param {number} options.anno - Filtra per anno (opzionale)
 * @param {string} options.stato - Filtra per stato (opzionale, default: 'completato')
 * @returns {Promise<Array>} Array di lavori con costi calcolati
 */
export async function getLavoriPerTerreno(terrenoId, options = {}) {
  try {
    const { anno = null, stato = 'completato' } = options;
    
    // SOLUZIONE: Recupera TUTTI i lavori (senza filtri e senza orderBy) per evitare indice composito
    // Poi filtra lato client per terrenoId, stato e anno
    // Recupera dati raw direttamente da Firestore per avere accesso ai Timestamp originali
    const tenantId = getCurrentTenantId();
    const { getCollectionData } = await import('../../../core/services/firebase-service.js');
    const documentsRaw = await getCollectionData('lavori', {
      tenantId,
      orderBy: null,
      orderDirection: null
    });
    
    // Converti in oggetti Lavoro ma preserva dati raw per accesso ai Timestamp
    const { Lavoro } = await import('../../../core/models/Lavoro.js');
    const lavoriRaw = documentsRaw.map(doc => {
      const lavoro = Lavoro.fromData(doc);
      // Salva dati raw per accesso ai Timestamp originali
      lavoro._originalData = doc;
      return lavoro;
    });
    
    // Filtra lato client per terrenoId
    let lavoriFiltrati = lavoriRaw;
    if (terrenoId) {
      lavoriFiltrati = lavoriFiltrati.filter(lavoro => lavoro.terrenoId === terrenoId);
    }
    
    // Filtra lato client per stato
    if (stato) {
      lavoriFiltrati = lavoriFiltrati.filter(lavoro => lavoro.stato === stato);
    }
    
    // Filtra per anno se specificato
    if (anno) {
      lavoriFiltrati = lavoriFiltrati.filter(lavoro => {
        if (!lavoro.dataInizio) return false;
        
        // Converti dataInizio in Date - usa dati raw se disponibili
        const lavoroRaw = lavoro._originalData || lavoro;
        const dataInizioSource = lavoroRaw.dataInizio || lavoro.dataInizio;
        let dataInizio = null;
        
        if (dataInizioSource && typeof dataInizioSource.toDate === 'function') {
          // Timestamp Firestore (metodo toDate)
          dataInizio = dataInizioSource.toDate();
        } else if (dataInizioSource && typeof dataInizioSource.seconds === 'number') {
          // Timestamp Firestore (formato object con seconds)
          dataInizio = new Date(dataInizioSource.seconds * 1000);
        } else if (dataInizioSource instanceof Date) {
          // Date JavaScript
          dataInizio = dataInizioSource;
          // Se è Invalid Date, prova a recuperare dai dati raw
          if (isNaN(dataInizio.getTime()) && lavoroRaw.dataInizio && lavoroRaw.dataInizio !== dataInizioSource) {
            if (lavoroRaw.dataInizio && typeof lavoroRaw.dataInizio.toDate === 'function') {
              dataInizio = lavoroRaw.dataInizio.toDate();
            } else if (lavoroRaw.dataInizio && typeof lavoroRaw.dataInizio.seconds === 'number') {
              dataInizio = new Date(lavoroRaw.dataInizio.seconds * 1000);
            }
          }
        } else if (typeof dataInizioSource === 'string') {
          // Stringa ISO
          dataInizio = new Date(dataInizioSource);
        } else if (typeof dataInizioSource === 'number') {
          // Timestamp Unix
          dataInizio = new Date(dataInizioSource);
        } else {
          return false;
        }
        
        // Verifica che la data sia valida
        if (!dataInizio || isNaN(dataInizio.getTime())) {
          return false;
        }
        
        return dataInizio.getFullYear() === anno;
      });
    }
    
    // Calcola costi per ogni lavoro
    const lavoriConCosti = await Promise.all(
      lavoriFiltrati.map(async (lavoro) => {
        const costi = await calcolaCostiLavoro(lavoro.id, lavoro);
        return {
          ...lavoro,
          costi
        };
      })
    );
    
    return lavoriConCosti;
  } catch (error) {
    console.error('[LAVORI-VIGNETO] Errore recupero lavori per terreno:', error);
    console.error('[LAVORI-VIGNETO] Stack:', error.stack);
    return [];
  }
}

/**
 * Aggrega spese annuali per vigneto dai lavori e dalle attività dirette del diario
 * @param {string} vignetoId - ID vigneto
 * @param {number} anno - Anno (opzionale, default: anno corrente)
 * @returns {Promise<Object>} Spese aggregate per categoria
 */
export async function aggregaSpeseVignetoAnno(vignetoId, anno = null) {
  try {
    const vigneto = await getVigneto(vignetoId);
    if (!vigneto) {
      throw new Error('Vigneto non trovato');
    }
    
    const annoTarget = anno || new Date().getFullYear();
    
    // Carica tutti i lavori completati per il terreno del vigneto
    const lavori = await getLavoriPerTerreno(vigneto.terrenoId, {
      anno: annoTarget,
      stato: 'completato' // Solo lavori completati
    });
    
    // Inizializza spese con struttura gerarchica
    // Manodopera è la macro-categoria, con sotto-categorie dinamiche basate sulle categorie del sistema
    const spese = {
      // Macro-categoria Manodopera (totale)
      speseManodoperaAnno: 0,
      // Sotto-categorie Manodopera (dinamiche, basate sulle categorie del sistema)
      // Struttura: manodoperaCategoriaCodice (es. manodoperaPotatura, manodoperaLavorazioneTerreno)
      // Vengono create dinamicamente in base alle categorie trovate
      // Macchine (separata)
      speseMacchineAnno: 0,
      // Prodotti (per trattamenti)
      speseProdottiAnno: 0,
      // Spese manuali (cantina, altro)
      speseCantinaAnno: vigneto.speseCantinaAnno || 0,
      speseAltroAnno: vigneto.speseAltroAnno || 0
    };
    
    // Aggrega spese dai lavori completati
    for (const lavoro of lavori) {
      const costi = lavoro.costi || { costoTotale: 0, costoManodopera: 0, costoMacchine: 0 };
      
      // Determina categoria manodopera dal tipo lavoro
      const risultato = await getCategoriaManodoperaPerTipoLavoro(
        lavoro.tipoLavoro,
        lavoro.sottocategoriaCodice,
        lavoro
      );
      
      const categoriaCodice = risultato.categoriaCodice;
      
      // Crea chiave dinamica per la categoria (es. "manodoperaPotatura", "manodoperaLavorazioneTerreno")
      // Converte codice categoria (con underscore) a camelCase
      const categoriaCamelCase = categoriaCodice.split('_').map((part, index) => 
        index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
      ).join('');
      
      const chiaveCategoria = `manodopera${categoriaCamelCase.charAt(0).toUpperCase() + categoriaCamelCase.slice(1)}`;
      
      // Inizializza categoria se non esiste
      if (!spese.hasOwnProperty(chiaveCategoria)) {
        spese[chiaveCategoria] = 0;
        // Salva anche il nome della categoria per la visualizzazione
        spese[`${chiaveCategoria}_nome`] = risultato.categoriaNome;
      }
      
      // Aggiungi costo manodopera alla categoria specifica
      spese[chiaveCategoria] = (spese[chiaveCategoria] || 0) + costi.costoManodopera;
      
      // Aggiungi anche al totale manodopera
      spese.speseManodoperaAnno += costi.costoManodopera;
      
      // Aggiungi costo macchine sempre a speseMacchineAnno
      spese.speseMacchineAnno += costi.costoMacchine;
    }
    
    // Se ci sono lavori completati, trova la data del primo lavoro per determinare il periodo non coperto
    let dataPrimoLavoro = null;
    if (lavori.length > 0) {
      // Trova la data inizio più antica tra i lavori completati
      // dataInizio è già convertito in Date dal modello Lavoro (timestampToDate)
      const dateInizio = lavori
        .map(l => {
          if (!l.dataInizio || !(l.dataInizio instanceof Date)) return null;
          return l.dataInizio;
        })
        .filter(d => d !== null && !isNaN(d.getTime()));
      
      if (dateInizio.length > 0) {
        dataPrimoLavoro = new Date(Math.min(...dateInizio.map(d => d.getTime())));
      }
    }
    
    // Se non ci sono lavori completati OPPURE ci sono ma vogliamo considerare anche attività dirette
    // per il periodo prima del primo lavoro, carica attività dirette del diario
    const tenantId = getCurrentTenantId();
    const db = getDb();
    
    if (!db || !tenantId) {
      console.warn('[LAVORI-VIGNETO] Database o tenantId non disponibili per caricare attività dirette');
    } else {
      try {
        const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const attivitaRef = collection(db, `tenants/${tenantId}/attivita`);
        
        // Recupera tutte le attività per il terreno (filtro lato client per lavoroId null)
        // Firestore non supporta where('lavoroId', '==', null), quindi recuperiamo tutte e filtriamo
        const attivitaQuery = query(
          attivitaRef,
          where('terrenoId', '==', vigneto.terrenoId)
        );
        
        const attivitaSnapshot = await getDocs(attivitaQuery);
        
        // Filtra lato client per anno, data, e attività dirette (senza lavoroId)
        const annoInizio = `${annoTarget}-01-01`;
        const annoFine = `${annoTarget}-12-31`;
        const dataLimite = dataPrimoLavoro ? dataPrimoLavoro.toISOString().split('T')[0] : annoFine;
        
        // Prima filtra tutte le attività valide
        const attivitaValide = [];
        const macchineMap = {};
        let attivitaScartate = { lavoroId: 0, clienteId: 0, noData: 0, noTipoLavoro: 0, fuoriAnno: 0, dopoPrimoLavoro: 0 };
        
        attivitaSnapshot.forEach(attivitaDoc => {
          const attivita = attivitaDoc.data();
          
          // Filtra solo attività dirette (senza lavoroId) e aziendali (senza clienteId)
          if (attivita.lavoroId && attivita.lavoroId !== '') {
            attivitaScartate.lavoroId++;
            return;
          }
          if (attivita.clienteId && attivita.clienteId !== '') {
            attivitaScartate.clienteId++;
            return;
          }
          if (!attivita.data) {
            attivitaScartate.noData++;
            return;
          }
          if (!attivita.tipoLavoro) {
            attivitaScartate.noTipoLavoro++;
            return;
          }
          
          // Filtra per anno
          if (attivita.data < annoInizio || attivita.data > annoFine) {
            attivitaScartate.fuoriAnno++;
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
              if (!l.dataInizio || !(l.dataInizio instanceof Date)) return false;
              const lavoroData = l.dataInizio.toISOString().split('T')[0];
              return lavoroData === attivitaData && l.tipoLavoro === attivita.tipoLavoro;
            });
            
            // Se c'è un lavoro duplicato (stesso tipo, stesso giorno), escludi l'attività diretta
            if (lavoroDuplicato) {
              attivitaScartate.dopoPrimoLavoro++;
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
        
        // Ora processa tutte le attività valide per recuperare le categorie
        const attivitaPerCategoria = {};
        
        // Processa tutte le attività in parallelo per recuperare le categorie
        await Promise.all(attivitaValide.map(async (attivita) => {
          const oreNette = attivita.oreNette || 0;
          if (oreNette <= 0) return;
          
          // Recupera categoria manodopera
          const risultato = await getCategoriaManodoperaPerTipoLavoro(
            attivita.tipoLavoro,
            attivita.sottocategoriaCodice,
            attivita
          );
          
          const categoriaCodice = risultato.categoriaCodice;
          
          // Crea chiave dinamica per la categoria
          const categoriaCamelCase = categoriaCodice.split('_').map((part, index) => 
            index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
          ).join('');
          
          const chiaveCategoria = `manodopera_${categoriaCodice}`;
          
          // Inizializza categoria se non esiste
          if (!attivitaPerCategoria[chiaveCategoria]) {
            attivitaPerCategoria[chiaveCategoria] = {
              oreTotali: 0,
              categoriaNome: risultato.categoriaNome,
              categoriaCodice: categoriaCodice
            };
          }
          
          // Aggrega ore per categoria
          attivitaPerCategoria[chiaveCategoria].oreTotali += oreNette;
        }));
        
        
        // Calcola costi manodopera per categoria dalle attività dirette
        if (Object.keys(attivitaPerCategoria).length > 0) {
          const tariffaProprietario = await getTariffaProprietario(tenantId);
          
          for (const [chiaveCategoria, dati] of Object.entries(attivitaPerCategoria)) {
            if (dati.oreTotali > 0) {
              const costoManodopera = dati.oreTotali * tariffaProprietario;
              
              const categoriaCodice = dati.categoriaCodice || 'altro';
              
              // Crea chiave dinamica per la categoria (stessa logica dei lavori)
              const categoriaCamelCase = categoriaCodice.split('_').map((part, index) => 
                index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
              ).join('');
              
              const chiaveSottocategoria = `manodopera${categoriaCamelCase.charAt(0).toUpperCase() + categoriaCamelCase.slice(1)}`;
              
              // Inizializza categoria se non esiste
              if (!spese.hasOwnProperty(chiaveSottocategoria)) {
                spese[chiaveSottocategoria] = 0;
                // Salva anche il nome della categoria per la visualizzazione
                spese[`${chiaveSottocategoria}_nome`] = dati.categoriaNome || 'Altro';
              }
              
              // Aggiungi alle spese
              spese[chiaveSottocategoria] = (spese[chiaveSottocategoria] || 0) + costoManodopera;
              
              // Aggiungi anche al totale manodopera
              spese.speseManodoperaAnno += costoManodopera;
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
              console.warn(`[LAVORI-VIGNETO] Errore calcolo costo macchina ${macchinaId} da attività dirette:`, error);
            }
          }
        }
      } catch (error) {
        console.warn('[LAVORI-VIGNETO] Errore caricamento attività dirette del diario:', error);
        // Non blocchiamo il calcolo, continuiamo con i lavori completati
      }
    }
    
    // Arrotonda tutti i valori numerici a 2 decimali (escludi chiavi che terminano con _nome che contengono stringhe)
    Object.keys(spese).forEach(key => {
      // Salta chiavi che contengono nomi (non numeri)
      if (key.endsWith('_nome')) {
        return;
      }
      // Verifica che il valore sia un numero prima di arrotondare
      const valore = spese[key];
      if (typeof valore === 'number' && !isNaN(valore)) {
        spese[key] = parseFloat(valore.toFixed(2));
      }
    });
    
    return spese;
  } catch (error) {
    console.error('[LAVORI-VIGNETO] Errore aggregazione spese vigneto:', error);
    console.error('[LAVORI-VIGNETO] Stack:', error.stack);
    return {
      speseManodoperaAnno: 0,
      speseTrattamentiAnno: 0,
      spesePotaturaAnno: 0,
      speseVendemmiaAnno: 0,
      speseMacchineAnno: 0,
      speseAltroAnno: 0
    };
  }
}

/**
 * Aggiorna automaticamente le spese del vigneto basandosi sui lavori
 * @param {string} vignetoId - ID vigneto
 * @param {number} anno - Anno (opzionale, default: anno corrente)
 * @returns {Promise<void>}
 */
export async function aggiornaSpeseVignetoDaLavori(vignetoId, anno = null) {
  try {
    const spese = await aggregaSpeseVignetoAnno(vignetoId, anno);
    
    // Mantieni compatibilità con campi legacy per la tabella principale
    // I campi legacy vengono calcolati dalla nuova struttura gerarchica dinamica
    const speseAggiornate = {
      // Nuova struttura gerarchica (per dettaglio)
      ...spese,
      // Campi legacy per compatibilità (per tabella principale)
      // Mappa dalle categorie dinamiche alle categorie legacy specifiche vigneto
      spesePotaturaAnno: spese.manodoperaPotatura || 0,
      speseVendemmiaAnno: spese.manodoperaRaccolta || 0, // Raccolta include Vendemmia
      speseTrattamentiAnno: spese.manodoperaTrattamenti || 0,
      // speseManodoperaAnno è già presente (totale manodopera)
      // speseMacchineAnno è già presente
      // speseCantinaAnno è già presente
      // speseAltroAnno è già presente (include altre categorie manodopera + spese manuali)
    };
    
    // Calcola costoTotaleAnno e costoPerEttaro
    const vigneto = await getVigneto(vignetoId);
    speseAggiornate.costoTotaleAnno = 
      speseAggiornate.speseManodoperaAnno +
      speseAggiornate.speseMacchineAnno +
      (speseAggiornate.speseProdottiAnno || 0) +
      speseAggiornate.speseCantinaAnno +
      speseAggiornate.speseAltroAnno;
    
    if (vigneto && vigneto.superficieEttari && vigneto.superficieEttari > 0) {
      speseAggiornate.costoPerEttaro = speseAggiornate.costoTotaleAnno / vigneto.superficieEttari;
    } else {
      speseAggiornate.costoPerEttaro = 0;
    }
    
    // Aggiorna statistiche aggregate in background (non blocca la risposta)
    const annoTarget = anno || new Date().getFullYear();
    import('./vigneto-statistiche-aggregate-service.js').then(({ calcolaEAggiornaStatistiche }) => {
      calcolaEAggiornaStatistiche(vignetoId, annoTarget).catch(err => {
        console.warn('[LAVORI-VIGNETO] Errore aggiornamento statistiche aggregate (non critico):', err);
      });
    });
    
    // Aggiorna vigneto
    await updateVigneto(vignetoId, speseAggiornate);
  } catch (error) {
    console.error('[LAVORI-VIGNETO] Errore aggiornamento spese vigneto:', error);
    console.error('[LAVORI-VIGNETO] Stack:', error.stack);
    throw error;
  }
}

/**
 * Aggiorna automaticamente tutti i vigneti collegati a un terreno quando un lavoro viene completato
 * @param {string} terrenoId - ID terreno
 * @param {number} anno - Anno del lavoro (opzionale)
 * @returns {Promise<void>}
 */
export async function aggiornaVignetiDaTerreno(terrenoId, anno = null) {
  try {
    // Trova tutti i vigneti collegati a questo terreno
    const vigneti = await getVignetiByTerreno(terrenoId);
    
    // Aggiorna ogni vigneto
    await Promise.all(
      vigneti.map(vigneto => 
        aggiornaSpeseVignetoDaLavori(vigneto.id, anno)
      )
    );
  } catch (error) {
    console.error('[LAVORI-VIGNETO] Errore aggiornamento vigneti da terreno:', error);
    // Non blocchiamo l'operazione principale
  }
}

/**
 * Ricalcola tutte le spese di un vigneto per un anno specifico
 * Utile per correggere dati o dopo modifiche ai lavori
 * @param {string} vignetoId - ID vigneto
 * @param {number} anno - Anno
 * @returns {Promise<void>}
 */
export async function ricalcolaSpeseVignetoAnno(vignetoId, anno) {
  return aggiornaSpeseVignetoDaLavori(vignetoId, anno);
}

/**
 * Ottiene il dettaglio completo delle spese di un vigneto per un anno
 * Restituisce lavori completati e attività dirette con tutti i dettagli
 * @param {string} vignetoId - ID vigneto
 * @param {number} anno - Anno (opzionale, default: anno corrente)
 * @returns {Promise<Object>} Dettaglio completo con lavori, attività dirette e totali
 */
export async function getDettaglioSpeseVignetoAnno(vignetoId, anno = null) {
  try {
    const vigneto = await getVigneto(vignetoId);
    if (!vigneto) {
      throw new Error('Vigneto non trovato');
    }
    
    const annoTarget = anno || new Date().getFullYear();
    
    // Carica tutti i lavori completati per il terreno del vigneto
    const lavori = await getLavoriPerTerreno(vigneto.terrenoId, {
      anno: annoTarget,
      stato: 'completato'
    });
    
    // Dettagli lavori completati
    // IMPORTANTE: Ricalcola sempre i costi per avere dati aggiornati (non usare lavoro.costi che potrebbe essere obsoleto)
    const lavoriDettaglio = [];
    for (const lavoro of lavori) {
      // Ricalcola sempre i costi per avere dati aggiornati, specialmente per le macchine
      const costi = await calcolaCostiLavoro(lavoro.id, lavoro);
      
      // Determina categoria manodopera dal tipo lavoro (recupera categoria principale dal sistema)
      const risultato = await getCategoriaManodoperaPerTipoLavoro(
        lavoro.tipoLavoro,
        lavoro.sottocategoriaCodice,
        lavoro
      );
      
      // Usa categoria legacy per compatibilità con visualizzazione esistente
      const categoriaLegacy = getCategoriaSpesaPerTipoLavoro(lavoro.tipoLavoro);
      
      lavoriDettaglio.push({
        id: lavoro.id,
        nome: lavoro.nome,
        tipoLavoro: lavoro.tipoLavoro,
        dataInizio: lavoro.dataInizio instanceof Date 
          ? lavoro.dataInizio.toISOString().split('T')[0] 
          : (lavoro.dataInizio || null),
        categoria: categoriaLegacy, // Per compatibilità
        categoriaCodice: risultato.categoriaCodice, // Nuova struttura: codice categoria
        categoriaNome: risultato.categoriaNome, // Nuova struttura: nome categoria
        costoManodopera: costi.costoManodopera || 0,
        costoMacchine: costi.costoMacchine || 0,
        costoTotale: costi.costoTotale || costi.costoManodopera + costi.costoMacchine || 0
      });
    }
    
    // Trova data primo lavoro per filtrare attività dirette
    let dataPrimoLavoro = null;
    if (lavori.length > 0) {
      const dateInizio = lavori
        .map(l => {
          if (!l.dataInizio || !(l.dataInizio instanceof Date)) return null;
          return l.dataInizio;
        })
        .filter(d => d !== null && !isNaN(d.getTime()));
      
      if (dateInizio.length > 0) {
        dataPrimoLavoro = new Date(Math.min(...dateInizio.map(d => d.getTime())));
      }
    }
    
    // Carica attività dirette del diario
    const tenantId = getCurrentTenantId();
    const db = getDb();
    const attivitaDiretteDettaglio = [];
    
    if (db && tenantId) {
      try {
        const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const attivitaRef = collection(db, `tenants/${tenantId}/attivita`);
        const attivitaQuery = query(
          attivitaRef,
          where('terrenoId', '==', vigneto.terrenoId)
        );
        
        const attivitaSnapshot = await getDocs(attivitaQuery);
        const annoInizio = `${annoTarget}-01-01`;
        const annoFine = `${annoTarget}-12-31`;
        const dataLimite = dataPrimoLavoro ? dataPrimoLavoro.toISOString().split('T')[0] : annoFine;
        const tariffaProprietario = await getTariffaProprietario(tenantId);
        
        // Verifica se modulo Parco Macchine è attivo per calcolare costi macchine
        let hasParcoMacchineModule = false;
        try {
          const { hasModuleAccess } = await import('../../../core/services/tenant-service.js');
          hasParcoMacchineModule = await hasModuleAccess('parcoMacchine');
        } catch (error) {
          // Modulo non disponibile, ignora
        }
        
        // Cache per macchine già caricate
        const macchineCache = {};
        
        // Funzione helper per ottenere macchina (con cache)
        const getMacchinaCached = async (macchinaId) => {
          if (macchineCache[macchinaId]) {
            return macchineCache[macchinaId];
          }
          try {
            const { getMacchina } = await import('../../../modules/parco-macchine/services/macchine-service.js');
            const macchina = await getMacchina(macchinaId);
            macchineCache[macchinaId] = macchina;
            return macchina;
          } catch (error) {
            console.warn(`[LAVORI-VIGNETO] Errore caricamento macchina ${macchinaId}:`, error);
            return null;
          }
        };
        
        // Processa tutte le attività e calcola costi macchine
        const attivitaPromises = [];
        let attivitaScartate = { lavoroId: 0, clienteId: 0, noData: 0, noTipoLavoro: 0, fuoriAnno: 0, dopoPrimoLavoro: 0 };
        let attivitaConMacchine = 0;
        const attivitaConMacchineScartate = [];
        
        attivitaSnapshot.forEach(attivitaDoc => {
          const attivita = attivitaDoc.data();
          
          // Verifica se ha macchine (prima di filtrare)
          const hasMacchine = (attivita.macchinaId || attivita.attrezzoId) && (attivita.oreMacchina || 0) > 0;
          
          // Filtra solo attività dirette (senza lavoroId) e aziendali (senza clienteId)
          if (attivita.lavoroId && attivita.lavoroId !== '') {
            attivitaScartate.lavoroId++;
            if (hasMacchine) attivitaConMacchineScartate.push({id: attivitaDoc.id, motivo: 'lavoroId', data: attivita.data, macchinaId: attivita.macchinaId, attrezzoId: attivita.attrezzoId, oreMacchina: attivita.oreMacchina});
            return;
          }
          if (attivita.clienteId && attivita.clienteId !== '') {
            attivitaScartate.clienteId++;
            if (hasMacchine) attivitaConMacchineScartate.push({id: attivitaDoc.id, motivo: 'clienteId', data: attivita.data, macchinaId: attivita.macchinaId, attrezzoId: attivita.attrezzoId, oreMacchina: attivita.oreMacchina});
            return;
          }
          if (!attivita.data) {
            attivitaScartate.noData++;
            if (hasMacchine) attivitaConMacchineScartate.push({id: attivitaDoc.id, motivo: 'noData', macchinaId: attivita.macchinaId, attrezzoId: attivita.attrezzoId, oreMacchina: attivita.oreMacchina});
            return;
          }
          if (!attivita.tipoLavoro) {
            attivitaScartate.noTipoLavoro++;
            if (hasMacchine) attivitaConMacchineScartate.push({id: attivitaDoc.id, motivo: 'noTipoLavoro', data: attivita.data, macchinaId: attivita.macchinaId, attrezzoId: attivita.attrezzoId, oreMacchina: attivita.oreMacchina});
            return;
          }
          
          // Filtra per anno
          if (attivita.data < annoInizio || attivita.data > annoFine) {
            attivitaScartate.fuoriAnno++;
            if (hasMacchine) attivitaConMacchineScartate.push({id: attivitaDoc.id, motivo: 'fuoriAnno', data: attivita.data, annoInizio, annoFine, macchinaId: attivita.macchinaId, attrezzoId: attivita.attrezzoId, oreMacchina: attivita.oreMacchina});
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
              if (!l.dataInizio || !(l.dataInizio instanceof Date)) return false;
              const lavoroData = l.dataInizio.toISOString().split('T')[0];
              return lavoroData === attivitaData && l.tipoLavoro === attivita.tipoLavoro;
            });
            
            // Se c'è un lavoro duplicato (stesso tipo, stesso giorno), escludi l'attività diretta
            if (lavoroDuplicato) {
              attivitaScartate.dopoPrimoLavoro++;
              if (hasMacchine) attivitaConMacchineScartate.push({id: attivitaDoc.id, motivo: 'dopoPrimoLavoro (duplicato)', data: attivita.data, dataLimite, tipoLavoro: attivita.tipoLavoro, macchinaId: attivita.macchinaId, attrezzoId: attivita.attrezzoId, oreMacchina: attivita.oreMacchina});
              return;
            }
            // Altrimenti, è una lavorazione diversa e va inclusa
          }
          
          // Conta attività con macchine
          if (hasMacchine) {
            attivitaConMacchine++;
          }
          
          // Usa categoria legacy per compatibilità con visualizzazione esistente
          const categoriaLegacy = getCategoriaSpesaPerTipoLavoro(attivita.tipoLavoro);
          const oreNette = attivita.oreNette || 0;
          const costoManodopera = oreNette * tariffaProprietario;
          
          // Calcola costo macchine se modulo attivo
          const oreMacchina = attivita.oreMacchina || 0;
          const macchinaId = attivita.macchinaId;
          const attrezzoId = attivita.attrezzoId;
          
          // Promise per calcolare categoria e costo macchine
          // IMPORTANTE: Se ci sono sia macchinaId che attrezzoId, calcola il costo per entrambi (come fa aggregaSpeseVignetoAnno)
          const attivitaPromise = (async () => {
            // Determina categoria manodopera dal tipo lavoro (recupera categoria principale dal sistema)
            const risultato = await getCategoriaManodoperaPerTipoLavoro(
              attivita.tipoLavoro,
              attivita.sottocategoriaCodice,
              attivita
            );
            
            // Calcola costo macchine
            let costoMacchine = 0;
            
            if (hasParcoMacchineModule && oreMacchina > 0) {
              // Calcola costo per macchina (trattore)
              if (macchinaId) {
                const macchina = await getMacchinaCached(macchinaId);
                if (macchina && macchina.costoOra) {
                  const costoMacchina = oreMacchina * macchina.costoOra;
                  costoMacchine += costoMacchina;
                }
              }
              
              // Calcola costo per attrezzo (se presente)
              if (attrezzoId) {
                const attrezzo = await getMacchinaCached(attrezzoId);
                if (attrezzo && attrezzo.costoOra) {
                  const costoAttrezzo = oreMacchina * attrezzo.costoOra;
                  costoMacchine += costoAttrezzo;
                }
              }
            }
            
            return {
              costoMacchine: parseFloat(costoMacchine.toFixed(2)),
              risultato: risultato
            };
          })();
          
          attivitaPromises.push(attivitaPromise.then(({ costoMacchine, risultato }) => {
            attivitaDiretteDettaglio.push({
              id: attivitaDoc.id,
              data: attivita.data,
              tipoLavoro: attivita.tipoLavoro,
              categoria: categoriaLegacy, // Per compatibilità
              categoriaCodice: risultato.categoriaCodice, // Nuova struttura: codice categoria
              categoriaNome: risultato.categoriaNome, // Nuova struttura: nome categoria
              oreNette: oreNette,
              costoManodopera: parseFloat(costoManodopera.toFixed(2)),
              costoMacchine: costoMacchine,
              note: attivita.note || ''
            });
          }));
        });
        
        // Attendi che tutti i costi macchine siano calcolati
        await Promise.all(attivitaPromises);
        
        // DEBUG: Verifica costi macchine calcolati
        const totaleMacchineAttivita = attivitaDiretteDettaglio.reduce((sum, a) => sum + (a.costoMacchine || 0), 0);
      } catch (error) {
        console.warn('[LAVORI-VIGNETO] Errore caricamento dettagli attività dirette:', error);
      }
    }
    
    // Usa aggregaSpeseVignetoAnno per ottenere i totali aggregati (garantisce coerenza con la pagina principale)
    // Questo assicura che i totali nel dettaglio siano identici a quelli nella tabella principale
    const speseAggregate = await aggregaSpeseVignetoAnno(vignetoId, annoTarget);
    
    // I totaliPerCategoria vengono presi direttamente dalle spese aggregate
    // Questo garantisce che siano identici a quelli calcolati per la tabella principale
    const totaliPerCategoria = { ...speseAggregate };
    
    // Calcola totale generale (escludendo le sotto-categorie, solo macro-categorie)
    const totaleGenerale = 
      totaliPerCategoria.speseManodoperaAnno +
      totaliPerCategoria.speseMacchineAnno +
      totaliPerCategoria.speseProdottiAnno +
      totaliPerCategoria.speseCantinaAnno +
      totaliPerCategoria.speseAltroAnno;
    
    return {
      anno: annoTarget,
      vignetoId: vignetoId,
      vignetoNome: vigneto.varieta || 'Vigneto',
      lavoriCompletati: lavoriDettaglio,
      attivitaDirette: attivitaDiretteDettaglio,
      totaliPerCategoria: totaliPerCategoria,
      totaleGenerale: parseFloat(totaleGenerale.toFixed(2))
    };
  } catch (error) {
    console.error('[LAVORI-VIGNETO] Errore recupero dettaglio spese vigneto:', error);
    throw error;
  }
}

export default {
  calcolaCostiLavoro,
  getLavoriPerTerreno,
  aggregaSpeseVignetoAnno,
  aggiornaSpeseVignetoDaLavori,
  aggiornaVignetiDaTerreno,
  ricalcolaSpeseVignetoAnno,
  getCategoriaSpesaPerTipoLavoro, // Legacy, sincrono
  getCategoriaManodoperaPerTipoLavoro, // Nuova, asincrona
  getDettaglioSpeseVignetoAnno
};
