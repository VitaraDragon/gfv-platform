/**
 * Potatura Vigneto Service - Servizio per gestione potature vigneto
 * Gestisce CRUD potature con calcolo costi e aggiornamento dati vigneto
 * 
 * @module modules/vigneto/services/potatura-vigneto-service
 */

import { 
  getCollectionData,
  getDocumentData,
  createDocument,
  updateDocument,
  deleteDocument,
  dateToTimestamp
} from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { PotaturaVigneto } from '../models/PotaturaVigneto.js';
import { getVigneto, updateVigneto } from './vigneti-service.js';

const SUB_COLLECTION_NAME = 'potature';

/**
 * Ottieni path sub-collection potature per un vigneto
 * @param {string} vignetoId - ID vigneto
 * @returns {string} Path sub-collection
 */
function getPotaturePath(vignetoId) {
  return `vigneti/${vignetoId}/${SUB_COLLECTION_NAME}`;
}

/**
 * Ottieni tutte le potature di un vigneto
 * @param {string} vignetoId - ID vigneto
 * @param {Object} options - Opzioni di query
 * @param {string} options.orderBy - Campo per ordinamento (default: 'data')
 * @param {string} options.orderDirection - Direzione ordinamento ('asc' | 'desc', default: 'desc')
 * @param {string} options.tipo - Filtra per tipo potatura (opzionale)
 * @param {number} options.anno - Filtra per anno (opzionale)
 * @returns {Promise<Array<PotaturaVigneto>>} Array di potature
 */
export async function getPotature(vignetoId, options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!vignetoId) {
      throw new Error('ID vigneto obbligatorio');
    }
    
    const { 
      orderBy = 'data', 
      orderDirection = 'desc',
      tipo = null,
      anno = null
    } = options;
    
    const collectionPath = getPotaturePath(vignetoId);
    const whereFilters = [];
    
    if (tipo) {
      whereFilters.push(['tipo', '==', tipo]);
    }
    
    if (anno) {
      const inizioAnno = new Date(anno, 0, 1);
      const fineAnno = new Date(anno + 1, 0, 1);
      whereFilters.push(['data', '>=', dateToTimestamp(inizioAnno)]);
      whereFilters.push(['data', '<', dateToTimestamp(fineAnno)]);
    }
    
    const documents = await getCollectionData(collectionPath, {
      tenantId,
      orderBy,
      orderDirection,
      where: whereFilters.length > 0 ? whereFilters : undefined
    });
    
    return documents.map(doc => PotaturaVigneto.fromData(doc));
  } catch (error) {
    console.error('Errore recupero potature:', error);
    if (error.message.includes('tenant') || error.message.includes('obbligatorio')) {
      throw new Error(`Errore recupero potature: ${error.message}`);
    }
    return [];
  }
}

/**
 * Ottieni tutte le potature di tutti i vigneti (per lista unica senza filtrare per vigneto)
 * @param {Object} options - Opzioni di query
 * @param {number} options.anno - Filtra per anno (opzionale)
 * @param {string} options.vignetoId - Filtra per singolo vigneto (opzionale)
 * @returns {Promise<Array<PotaturaVigneto>>} Array di potature (ogni elemento ha vignetoId)
 */
export async function getAllPotatureVigneti(options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
    const { getAllVigneti } = await import('./vigneti-service.js');
    const vigneti = await getAllVigneti();
    const { anno = null, vignetoId: filterVignetoId = null } = options;
    let list = [];
    for (const v of vigneti) {
      if (filterVignetoId && v.id !== filterVignetoId) continue;
      const potatureV = await getPotature(v.id, { anno, orderBy: 'data', orderDirection: 'desc' });
      list = list.concat(potatureV);
    }
    list.sort((a, b) => {
      const da = a.data instanceof Date ? a.data : (a.data?.toDate ? a.data.toDate() : new Date(a.data));
      const db = b.data instanceof Date ? b.data : (b.data?.toDate ? b.data.toDate() : new Date(b.data));
      return db - da;
    });
    return list;
  } catch (error) {
    console.error('[POTATURA-VIGNETO] getAllPotatureVigneti:', error);
    return [];
  }
}

/**
 * Ottieni una potatura per ID
 * @param {string} vignetoId - ID vigneto
 * @param {string} potaturaId - ID potatura
 * @returns {Promise<PotaturaVigneto|null>} Potatura o null se non trovata
 */
export async function getPotatura(vignetoId, potaturaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!vignetoId || !potaturaId) {
      throw new Error('ID vigneto e potatura obbligatori');
    }
    
    const collectionPath = getPotaturePath(vignetoId);
    const data = await getDocumentData(collectionPath, potaturaId, tenantId);
    
    if (!data) {
      return null;
    }
    
    return PotaturaVigneto.fromData({ ...data, id: potaturaId });
  } catch (error) {
    console.error('Errore recupero potatura:', error);
    throw new Error(`Errore recupero potatura: ${error.message}`);
  }
}

/**
 * Crea una nuova potatura
 * @param {string} vignetoId - ID vigneto
 * @param {Object} potaturaData - Dati potatura
 * @returns {Promise<string>} ID potatura creata
 */
export async function createPotatura(vignetoId, potaturaData) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!vignetoId) {
      throw new Error('ID vigneto obbligatorio');
    }
    
    // Verifica che il vigneto esista
    const vigneto = await getVigneto(vignetoId);
    if (!vigneto) {
      throw new Error('Vigneto non trovato');
    }
    
    // Crea modello e valida
    const potatura = new PotaturaVigneto({
      ...potaturaData,
      vignetoId
    });
    
    const validation = potatura.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Aggiorna calcoli automatici
    potatura.aggiornaCalcoli();
    
    // TODO: Calcola costo manodopera (da implementare con tariffe)
    // Per ora, costoManodopera deve essere fornito o calcolato altrove
    
    // Salva su Firestore
    const collectionPath = getPotaturePath(vignetoId);
    const potaturaId = await createDocument(collectionPath, potatura.toFirestore(), tenantId);
    
    // Aggiorna vigneto: data ultima potatura e spese potatura anno
    await aggiornaVignetoDaPotatura(vignetoId, potatura);
    
    return potaturaId;
  } catch (error) {
    console.error('Errore creazione potatura:', error);
    throw new Error(`Errore creazione potatura: ${error.message}`);
  }
}

/**
 * Aggiorna una potatura esistente
 * @param {string} vignetoId - ID vigneto
 * @param {string} potaturaId - ID potatura
 * @param {Object} updates - Dati da aggiornare
 * @returns {Promise<void>}
 */
export async function updatePotatura(vignetoId, potaturaId, updates) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!vignetoId || !potaturaId) {
      throw new Error('ID vigneto e potatura obbligatori');
    }
    
    const potaturaEsistente = await getPotatura(vignetoId, potaturaId);
    if (!potaturaEsistente) {
      throw new Error('Potatura non trovata');
    }
    
    potaturaEsistente.update(updates);
    
    const validation = potaturaEsistente.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    potaturaEsistente.aggiornaCalcoli();
    
    const collectionPath = getPotaturePath(vignetoId);
    await updateDocument(collectionPath, potaturaId, potaturaEsistente.toFirestore(), tenantId);
    
    await aggiornaVignetoDaPotatura(vignetoId, potaturaEsistente);
  } catch (error) {
    console.error('Errore aggiornamento potatura:', error);
    throw new Error(`Errore aggiornamento potatura: ${error.message}`);
  }
}

/**
 * Elimina una potatura
 * @param {string} vignetoId - ID vigneto
 * @param {string} potaturaId - ID potatura
 * @returns {Promise<void>}
 */
export async function deletePotatura(vignetoId, potaturaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!vignetoId || !potaturaId) {
      throw new Error('ID vigneto e potatura obbligatori');
    }
    
    const collectionPath = getPotaturePath(vignetoId);
    await deleteDocument(collectionPath, potaturaId, tenantId);
    
    await ricalcolaSpesePotaturaVigneto(vignetoId);
  } catch (error) {
    console.error('Errore eliminazione potatura:', error);
    throw new Error(`Errore eliminazione potatura: ${error.message}`);
  }
}

/**
 * Aggiorna vigneto basandosi su una potatura
 * @param {string} vignetoId - ID vigneto
 * @param {PotaturaVigneto} potatura - Potatura
 * @returns {Promise<void>}
 */
async function aggiornaVignetoDaPotatura(vignetoId, potatura) {
  try {
    const potature = await getPotature(vignetoId);
    
    const annoCorrente = new Date().getFullYear();
    const potatureAnnoCorrente = potature.filter(p => {
      const dataPotatura = p.data instanceof Date ? p.data : (p.data?.toDate ? p.data.toDate() : new Date(p.data));
      return dataPotatura.getFullYear() === annoCorrente;
    });
    
    const spesePotaturaAnno = potatureAnnoCorrente.reduce((sum, p) => sum + (p.costoTotale || 0), 0);
    
    const dataPotatura = potatura.data instanceof Date ? potatura.data : (potatura.data?.toDate ? potatura.data.toDate() : new Date(potatura.data));
    const dataUltimaPotatura = potature.length > 0 
      ? potature.reduce((latest, p) => {
          const pData = p.data instanceof Date ? p.data : (p.data?.toDate ? p.data.toDate() : new Date(p.data));
          return pData > latest ? pData : latest;
        }, dataPotatura)
      : dataPotatura;
    
    await updateVigneto(vignetoId, {
      dataUltimaPotatura: dateToTimestamp(dataUltimaPotatura),
      spesePotaturaAnno: parseFloat(spesePotaturaAnno.toFixed(2))
    });
  } catch (error) {
    console.error('Errore aggiornamento vigneto da potatura:', error);
  }
}

/**
 * Ricalcola spese potatura vigneto
 * @param {string} vignetoId - ID vigneto
 * @returns {Promise<void>}
 */
async function ricalcolaSpesePotaturaVigneto(vignetoId) {
  try {
    const potature = await getPotature(vignetoId);
    const annoCorrente = new Date().getFullYear();
    const potatureAnnoCorrente = potature.filter(p => {
      const dataPotatura = p.data instanceof Date ? p.data : (p.data?.toDate ? p.data.toDate() : new Date(p.data));
      return dataPotatura.getFullYear() === annoCorrente;
    });
    
    const spesePotaturaAnno = potatureAnnoCorrente.reduce((sum, p) => sum + (p.costoTotale || 0), 0);
    
    await updateVigneto(vignetoId, {
      spesePotaturaAnno: parseFloat(spesePotaturaAnno.toFixed(2))
    });
  } catch (error) {
    console.error('Errore ricalcolo spese potatura:', error);
  }
}

/**
 * Verifica se il tipo lavoro appartiene alla categoria Potatura
 * @param {string} tipoLavoroNome - Nome tipo lavoro
 * @returns {Promise<boolean>}
 */
async function isTipoLavoroCategoriaPotatura(tipoLavoroNome) {
  try {
    if (!tipoLavoroNome) return false;
    const { getTipoLavoroByNome } = await import('../../../core/services/tipi-lavoro-service.js');
    const { getCategoria } = await import('../../../core/services/categorie-service.js');
    const tipo = await getTipoLavoroByNome(tipoLavoroNome);
    if (!tipo || !tipo.categoriaId) return false;
    let cat = await getCategoria(tipo.categoriaId);
    if (!cat) return false;
    if (cat.parentId) {
      cat = await getCategoria(cat.parentId);
      if (!cat) return false;
    }
    return (cat.codice || '').toLowerCase() === 'potatura';
  } catch (e) {
    return false;
  }
}

/**
 * Trova potatura collegata a un lavoro
 * @param {string} lavoroId - ID lavoro
 * @returns {Promise<{vignetoId: string, potaturaId: string, potatura: PotaturaVigneto}|null>}
 */
export async function findPotaturaByLavoroId(lavoroId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId || !lavoroId) return null;
    const { getAllVigneti } = await import('./vigneti-service.js');
    const vigneti = await getAllVigneti();
    for (const vigneto of vigneti) {
      const potature = await getPotature(vigneto.id);
      const potatura = potature.find(p => p.lavoroId === lavoroId);
      if (potatura) {
        return { vignetoId: vigneto.id, potaturaId: potatura.id, potatura };
      }
    }
    return null;
  } catch (error) {
    console.error('[POTATURA-VIGNETO] findPotaturaByLavoroId:', error);
    return null;
  }
}

/**
 * Trova potatura collegata a un'attività
 * @param {string} attivitaId - ID attività
 * @returns {Promise<{vignetoId: string, potaturaId: string, potatura: PotaturaVigneto}|null>}
 */
export async function findPotaturaByAttivitaId(attivitaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId || !attivitaId) return null;
    const { getAllVigneti } = await import('./vigneti-service.js');
    const vigneti = await getAllVigneti();
    for (const vigneto of vigneti) {
      const potature = await getPotature(vigneto.id);
      const potatura = potature.find(p => p.attivitaId === attivitaId);
      if (potatura) {
        return { vignetoId: vigneto.id, potaturaId: potatura.id, potatura };
      }
    }
    return null;
  } catch (error) {
    console.error('[POTATURA-VIGNETO] findPotaturaByAttivitaId:', error);
    return null;
  }
}

/**
 * Crea una potatura automaticamente da un lavoro (categoria Potatura, terreno con vigneto)
 * @param {string} lavoroId - ID lavoro
 * @returns {Promise<string|null>} ID potatura creata o null
 */
export async function createPotaturaFromLavoro(lavoroId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) return null;
    const { getLavoro } = await import('../../../core/services/lavori-service.js');
    const lavoro = await getLavoro(lavoroId);
    if (!lavoro) return null;
    if (!(await isTipoLavoroCategoriaPotatura(lavoro.tipoLavoro || ''))) return null;
    const { getTerreno } = await import('../../../core/services/terreni-service.js');
    const terreno = await getTerreno(lavoro.terrenoId);
    if (!terreno || !(terreno.coltura || '').toLowerCase().includes('vite')) return null;
    const { getAllVigneti } = await import('./vigneti-service.js');
    const vigneti = await getAllVigneti();
    const vigneto = vigneti.find(v => v.terrenoId === terreno.id);
    if (!vigneto) return null;
    const potatureEsistenti = await getPotature(vigneto.id);
    const esistente = potatureEsistenti.find(p => p.lavoroId === lavoroId);
    if (esistente) return esistente.id;
    const dataPotatura = lavoro.dataInizio instanceof Date ? lavoro.dataInizio : (lavoro.dataInizio?.toDate ? lavoro.dataInizio.toDate() : new Date());
    const operai = [];
    if (lavoro.caposquadraId) {
      try {
        const { getDb } = await import('../../../core/services/firebase-service.js');
        const { collection, getDocs, query, where } = await import('../../../core/services/firebase-service.js');
        const db = getDb();
        if (db) {
          const squadreRef = collection(db, `tenants/${tenantId}/squadre`);
          const q = query(squadreRef, where('caposquadraId', '==', lavoro.caposquadraId));
          const snap = await getDocs(q);
          snap.forEach(d => { const s = d.data(); if (s.operai && Array.isArray(s.operai)) operai.push(...s.operai); });
        }
      } catch (e) { /* ignore */ }
    } else if (lavoro.operaioId) operai.push(lavoro.operaioId);
    let oreImpiegate = null;
    if (lavoro.durataPrevista) oreImpiegate = lavoro.durataPrevista * 8;
    const potaturaData = {
      vignetoId: vigneto.id,
      lavoroId,
      data: dataPotatura,
      tipo: '',
      parcella: null,
      ceppiPotati: null,
      operai,
      oreImpiegate,
      note: `Potatura creata da lavoro: ${lavoro.nome || lavoroId}`
    };
    const potatura = new PotaturaVigneto(potaturaData);
    potatura.aggiornaCalcoli();
    const collectionPath = getPotaturePath(vigneto.id);
    const potaturaId = await createDocument(collectionPath, potatura.toFirestore(), tenantId);
    await aggiornaVignetoDaPotatura(vigneto.id, potatura);
    return potaturaId;
  } catch (error) {
    console.error('[POTATURA-VIGNETO] createPotaturaFromLavoro:', error);
    return null;
  }
}

/**
 * Crea una potatura automaticamente da un'attività (categoria Potatura, terreno con vigneto)
 * @param {string} attivitaId - ID attività
 * @returns {Promise<string|null>} ID potatura creata o null
 */
export async function createPotaturaFromAttivita(attivitaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) return null;
    const { getAttivita } = await import('../../../core/services/attivita-service.js');
    const attivita = await getAttivita(attivitaId);
    if (!attivita) return null;
    if (!(await isTipoLavoroCategoriaPotatura(attivita.tipoLavoro || ''))) return null;
    const { getTerreno } = await import('../../../core/services/terreni-service.js');
    const terreno = await getTerreno(attivita.terrenoId);
    if (!terreno || !(terreno.coltura || '').toLowerCase().includes('vite')) return null;
    const { getAllVigneti } = await import('./vigneti-service.js');
    const vigneti = await getAllVigneti();
    const vigneto = vigneti.find(v => v.terrenoId === terreno.id);
    if (!vigneto) return null;
    const potatureEsistenti = await getPotature(vigneto.id);
    const esistente = potatureEsistenti.find(p => p.attivitaId === attivitaId);
    if (esistente) return esistente.id;
    const dataPotatura = attivita.data instanceof Date ? attivita.data : (attivita.data ? new Date(attivita.data) : new Date());
    
    // Calcola costo manodopera da attività
    let costoManodopera = 0;
    let costoMacchina = 0;
    const oreNette = attivita.oreNette || 0;
    if (oreNette > 0) {
      try {
        const { getTariffaProprietario } = await import('../../../core/services/calcolo-compensi-service.js');
        const tariffaProprietario = await getTariffaProprietario(tenantId);
        costoManodopera = oreNette * tariffaProprietario;
      } catch (e) {
        console.warn('[POTATURA-VIGNETO] createPotaturaFromAttivita calcolo costo manodopera:', e);
      }
    }
    
    // Calcola costo macchina se presente
    const oreMacchina = attivita.oreMacchina || 0;
    if (oreMacchina > 0 && (attivita.macchinaId || attivita.attrezzoId)) {
      try {
        const { hasModuleAccess } = await import('../../../core/services/tenant-service.js');
        const hasParcoMacchineModule = await hasModuleAccess('parcoMacchine');
        if (hasParcoMacchineModule) {
          const { getMacchina } = await import('../../../modules/parco-macchine/services/macchine-service.js');
          const macchinaId = attivita.macchinaId || attivita.attrezzoId;
          if (macchinaId) {
            const macchina = await getMacchina(macchinaId);
            if (macchina && macchina.costoOra) {
              costoMacchina = oreMacchina * parseFloat(macchina.costoOra);
            }
          }
        }
      } catch (e) {
        console.warn('[POTATURA-VIGNETO] createPotaturaFromAttivita calcolo costo macchina:', e);
      }
    }
    
    const potaturaData = {
      vignetoId: vigneto.id,
      attivitaId,
      data: dataPotatura,
      tipo: '',
      parcella: null,
      ceppiPotati: null,
      operai: [],
      oreImpiegate: attivita.oreNette || null,
      costoManodopera,
      costoMacchina,
      note: `Potatura creata da attività: ${attivita.descrizione || attivitaId}`
    };
    const potatura = new PotaturaVigneto(potaturaData);
    potatura.aggiornaCalcoli();
    const collectionPath = getPotaturePath(vigneto.id);
    const potaturaId = await createDocument(collectionPath, potatura.toFirestore(), tenantId);
    await aggiornaVignetoDaPotatura(vigneto.id, potatura);
    return potaturaId;
  } catch (error) {
    console.error('[POTATURA-VIGNETO] createPotaturaFromAttivita:', error);
    return null;
  }
}

/**
 * Mappa il nome tipo lavoro al valore tipo potatura (invernale, verde, rinnovo, spollonatura).
 * Allineato ai tipi lavoro: Potatura, Potatura di Rinnovamento, Potatura a Verde Meccanica, Spollonatura, ecc.
 * @param {string} tipoLavoroNome - Nome tipo lavoro (es. "Potatura di Rinnovamento", "Spollonatura")
 * @returns {string} '' | 'invernale' | 'verde' | 'rinnovo' | 'spollonatura'
 */
export function tipoPotaturaFromTipoLavoro(tipoLavoroNome) {
  if (!tipoLavoroNome || typeof tipoLavoroNome !== 'string') return '';
  const n = tipoLavoroNome.toLowerCase().trim();
  if (n.includes('spollonatura')) return 'spollonatura';
  if (n.includes('verde')) return 'verde';
  if (n.includes('rinnovamento') || n.includes('rinnovo')) return 'rinnovo';
  if (n.includes('invernal') || n.includes('inverno')) return 'invernale';
  if (n.includes('formazione') || n.includes('produzione') || n.includes('meccanica') || n === 'potatura') return 'invernale';
  return '';
}

/**
 * Dati per precompilare il modal potatura da lavoro/attività (tipo, ceppi, nomi operai, costi)
 * Se il modulo manodopera non è attivo, operaiNomi resta vuoto (il lavoro è del proprietario).
 * @param {string} vignetoId - ID vigneto
 * @param {PotaturaVigneto} potatura - Potatura con lavoroId o attivitaId
 * @param {Object} [options] - Opzioni
 * @param {boolean} [options.hasManodoperaModule] - Se false, operaiNomi non viene compilato
 * @returns {Promise<{tipoPotatura: string, ceppiPotati: number|null, operaiNomi: string, costoManodopera: number, costoMacchina: number}>}
 */
export async function getDatiPrecompilazionePotatura(vignetoId, potatura, options = {}) {
  const out = {
    tipoPotatura: potatura.tipo || '',
    ceppiPotati: potatura.ceppiPotati ?? null,
    operaiNomi: '',
    costoManodopera: potatura.costoManodopera ?? 0,
    costoMacchina: potatura.costoMacchina ?? 0
  };
  const hasManodopera = options.hasManodoperaModule !== false;

  const lavoroId = potatura.lavoroId || null;
  const attivitaId = potatura.attivitaId || null;

  let lavoro = null;
  let superficieHa = null;
  let tipoLavoroNome = '';

  if (lavoroId) {
    const { getLavoro } = await import('../../../core/services/lavori-service.js');
    lavoro = await getLavoro(lavoroId);
    if (lavoro) {
      tipoLavoroNome = lavoro.tipoLavoro || '';
      superficieHa = lavoro.superficieTotaleLavorata != null ? parseFloat(lavoro.superficieTotaleLavorata) : null;
    }
  } else if (attivitaId) {
    const { getAttivita } = await import('../../../core/services/attivita-service.js');
    const attivita = await getAttivita(attivitaId);
    if (attivita) {
      tipoLavoroNome = attivita.tipoLavoro || '';
      if (attivita.lavoroId) {
        const { getLavoro } = await import('../../../core/services/lavori-service.js');
        lavoro = await getLavoro(attivita.lavoroId);
        if (lavoro) superficieHa = lavoro.superficieTotaleLavorata != null ? parseFloat(lavoro.superficieTotaleLavorata) : null;
      }
    }
  }

  out.tipoPotatura = tipoPotaturaFromTipoLavoro(tipoLavoroNome) || out.tipoPotatura;

  const vigneto = await getVigneto(vignetoId);
  if (vigneto && superficieHa != null && superficieHa > 0) {
    const densita = vigneto.densita != null ? parseFloat(vigneto.densita) : null;
    if (densita != null && densita > 0) {
      out.ceppiPotati = Math.round(superficieHa * densita);
    }
  }

  // Operai solo se potatura da lavoro e modulo manodopera attivo. Da attività/diario o senza modulo: lavoro del proprietario.
  if (hasManodopera && lavoroId) {
    const operaioIds = Array.isArray(potatura.operai) ? potatura.operai : [];
    if (operaioIds.length > 0) {
      const nomi = [];
      for (const uid of operaioIds) {
        const userData = await getDocumentData('users', uid);
        const nome = (userData?.nome || '').trim();
        const cognome = (userData?.cognome || '').trim();
        nomi.push((nome + ' ' + cognome).trim() || userData?.email || uid);
      }
      out.operaiNomi = nomi.join('\n');
    }
  }

  if (lavoroId && lavoro) {
    try {
      const { calcolaCostiLavoro } = await import('./lavori-vigneto-service.js');
      const costi = await calcolaCostiLavoro(lavoroId, lavoro);
      if (costi) {
        out.costoManodopera = costi.costoManodopera ?? 0;
        out.costoMacchina = costi.costoMacchine ?? 0;
      }
    } catch (e) {
      console.warn('[POTATURA-VIGNETO] getDatiPrecompilazionePotatura calcolaCostiLavoro:', e);
    }
  } else if (attivitaId && !lavoroId) {
    // Calcola costo manodopera da attività (diario) se non c'è lavoro collegato
    try {
      const { getAttivita } = await import('../../../core/services/attivita-service.js');
      const attivita = await getAttivita(attivitaId);
      if (attivita) {
        const oreNette = attivita.oreNette || 0;
        if (oreNette > 0) {
          const { getTariffaProprietario } = await import('../../../core/services/calcolo-compensi-service.js');
          const tariffaProprietario = await getTariffaProprietario(getCurrentTenantId());
          out.costoManodopera = oreNette * tariffaProprietario;
        }
        
        // Calcola anche costo macchina se presente
        const oreMacchina = attivita.oreMacchina || 0;
        if (oreMacchina > 0 && (attivita.macchinaId || attivita.attrezzoId)) {
          try {
            const { hasModuleAccess } = await import('../../../core/services/tenant-service.js');
            const hasParcoMacchineModule = await hasModuleAccess('parcoMacchine');
            if (hasParcoMacchineModule) {
              const { getMacchina } = await import('../../../modules/parco-macchine/services/macchine-service.js');
              const macchinaId = attivita.macchinaId || attivita.attrezzoId;
              if (macchinaId) {
                                    const macchina = await getMacchina(macchinaId);
                                    if (macchina && macchina.costoOra) {
                                      out.costoMacchina = oreMacchina * parseFloat(macchina.costoOra);
                                    }
              }
            }
          } catch (e) {
            console.warn('[POTATURA-VIGNETO] getDatiPrecompilazionePotatura calcolo costo macchina:', e);
          }
        }
      }
    } catch (e) {
      console.warn('[POTATURA-VIGNETO] getDatiPrecompilazionePotatura calcolo costo da attività:', e);
    }
  }

  return out;
}

/**
 * Sincronizza dati base potatura dal lavoro (data, operai, ore)
 * @param {string} lavoroId - ID lavoro
 * @returns {Promise<string|null>} potaturaId sincronizzata o null
 */
export async function syncPotaturaFromLavoro(lavoroId) {
  try {
    const found = await findPotaturaByLavoroId(lavoroId);
    if (!found) return null;
    const { getLavoro } = await import('../../../core/services/lavori-service.js');
    const lavoro = await getLavoro(lavoroId);
    if (!lavoro) return null;
    const operai = [];
    if (lavoro.caposquadraId) {
      try {
        const { getDb } = await import('../../../core/services/firebase-service.js');
        const { collection, getDocs, query, where } = await import('../../../core/services/firebase-service.js');
        const db = getDb();
        if (db) {
          const squadreRef = collection(db, `tenants/${getCurrentTenantId()}/squadre`);
          const q = query(squadreRef, where('caposquadraId', '==', lavoro.caposquadraId));
          const snap = await getDocs(q);
          snap.forEach(d => { const s = d.data(); if (s.operai && Array.isArray(s.operai)) operai.push(...s.operai); });
        }
      } catch (e) { /* ignore */ }
    } else if (lavoro.operaioId) operai.push(lavoro.operaioId);
    const dataPotatura = lavoro.dataInizio instanceof Date ? lavoro.dataInizio : (lavoro.dataInizio?.toDate ? lavoro.dataInizio.toDate() : new Date());
    const oreImpiegate = lavoro.durataPrevista ? lavoro.durataPrevista * 8 : null;
    await updatePotatura(found.vignetoId, found.potaturaId, { data: dataPotatura, operai, oreImpiegate });
    return found.potaturaId;
  } catch (error) {
    console.error('[POTATURA-VIGNETO] syncPotaturaFromLavoro:', error);
    return null;
  }
}
