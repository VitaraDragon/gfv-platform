/**
 * Potatura Frutteto Service - Servizio per gestione potature frutteto
 * Allineato a potatura-vigneto-service (fonte: vigneto)
 *
 * @module modules/frutteto/services/potatura-frutteto-service
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
import { PotaturaFrutteto } from '../models/PotaturaFrutteto.js';
import { getFrutteto, updateFrutteto } from './frutteti-service.js';

const SUB_COLLECTION_NAME = 'potature';

function getPotaturePath(fruttetoId) {
  return `frutteti/${fruttetoId}/${SUB_COLLECTION_NAME}`;
}

export async function getPotature(fruttetoId, options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
    if (!fruttetoId) throw new Error('ID frutteto obbligatorio');

    const { orderBy = 'data', orderDirection = 'desc', tipo = null, anno = null } = options;
    const collectionPath = getPotaturePath(fruttetoId);
    const whereFilters = [];
    if (tipo) whereFilters.push(['tipo', '==', tipo]);
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
    return documents.map(doc => PotaturaFrutteto.fromData(doc));
  } catch (error) {
    console.error('[POTATURA-FRUTTETO] Errore recupero potature:', error);
    if (error.message.includes('tenant') || error.message.includes('obbligatorio')) throw new Error(`Errore recupero potature: ${error.message}`);
    return [];
  }
}

/**
 * Ottieni tutte le potature di tutti i frutteti (per lista unica, come vigneto).
 * @param {Object} options - Opzioni: anno, fruttetoId (filtro opzionale)
 * @returns {Promise<Array<PotaturaFrutteto>>} Array di potature (ogni elemento ha fruttetoId)
 */
export async function getAllPotatureFrutteti(options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
    const { getAllFrutteti } = await import('./frutteti-service.js');
    const frutteti = await getAllFrutteti();
    const { anno = null, fruttetoId: filterFruttetoId = null } = options;
    let list = [];
    for (const f of frutteti) {
      if (filterFruttetoId && f.id !== filterFruttetoId) continue;
      const potatureF = await getPotature(f.id, { anno, orderBy: 'data', orderDirection: 'desc' });
      list = list.concat(potatureF);
    }
    list.sort((a, b) => {
      const da = a.data instanceof Date ? a.data : (a.data?.toDate ? a.data.toDate() : new Date(a.data));
      const db = b.data instanceof Date ? b.data : (b.data?.toDate ? b.data.toDate() : new Date(b.data));
      return db - da;
    });
    return list;
  } catch (error) {
    console.error('[POTATURA-FRUTTETO] getAllPotatureFrutteti:', error);
    return [];
  }
}

export async function getPotatura(fruttetoId, potaturaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
    if (!fruttetoId || !potaturaId) throw new Error('ID frutteto e potatura obbligatori');

    const collectionPath = getPotaturePath(fruttetoId);
    const data = await getDocumentData(collectionPath, potaturaId, tenantId);
    if (!data) return null;
    return PotaturaFrutteto.fromData({ ...data, id: potaturaId });
  } catch (error) {
    console.error('Errore recupero potatura:', error);
    throw new Error(`Errore recupero potatura: ${error.message}`);
  }
}

export async function createPotatura(fruttetoId, potaturaData) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
    if (!fruttetoId) throw new Error('ID frutteto obbligatorio');

    const frutteto = await getFrutteto(fruttetoId);
    if (!frutteto) throw new Error('Frutteto non trovato');

    const potatura = new PotaturaFrutteto({ ...potaturaData, fruttetoId });
    const validation = potatura.validate();
    if (!validation.valid) throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);

    potatura.aggiornaCalcoli();
    const collectionPath = getPotaturePath(fruttetoId);
    const potaturaId = await createDocument(collectionPath, potatura.toFirestore(), tenantId);
    await aggiornaFruttetoDaPotatura(fruttetoId, potatura);
    return potaturaId;
  } catch (error) {
    console.error('Errore creazione potatura:', error);
    throw new Error(`Errore creazione potatura: ${error.message}`);
  }
}

export async function updatePotatura(fruttetoId, potaturaId, updates) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
    if (!fruttetoId || !potaturaId) throw new Error('ID frutteto e potatura obbligatori');

    const potaturaEsistente = await getPotatura(fruttetoId, potaturaId);
    if (!potaturaEsistente) throw new Error('Potatura non trovata');

    potaturaEsistente.update(updates);
    const validation = potaturaEsistente.validate();
    if (!validation.valid) throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    potaturaEsistente.aggiornaCalcoli();

    const collectionPath = getPotaturePath(fruttetoId);
    await updateDocument(collectionPath, potaturaId, potaturaEsistente.toFirestore(), tenantId);
    await aggiornaFruttetoDaPotatura(fruttetoId, potaturaEsistente);
  } catch (error) {
    console.error('Errore aggiornamento potatura:', error);
    throw new Error(`Errore aggiornamento potatura: ${error.message}`);
  }
}

export async function deletePotatura(fruttetoId, potaturaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
    if (!fruttetoId || !potaturaId) throw new Error('ID frutteto e potatura obbligatori');

    const collectionPath = getPotaturePath(fruttetoId);
    await deleteDocument(collectionPath, potaturaId, tenantId);
    await ricalcolaSpesePotaturaFrutteto(fruttetoId);
  } catch (error) {
    console.error('Errore eliminazione potatura:', error);
    throw new Error(`Errore eliminazione potatura: ${error.message}`);
  }
}

async function aggiornaFruttetoDaPotatura(fruttetoId, potatura) {
  try {
    const potature = await getPotature(fruttetoId);
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

    await updateFrutteto(fruttetoId, {
      dataUltimaPotatura: dateToTimestamp(dataUltimaPotatura),
      spesePotaturaAnno: parseFloat(spesePotaturaAnno.toFixed(2))
    });
  } catch (error) {
    console.error('[POTATURA-FRUTTETO] Errore aggiornamento frutteto da potatura:', error);
  }
}

async function ricalcolaSpesePotaturaFrutteto(fruttetoId) {
  try {
    const potature = await getPotature(fruttetoId);
    const annoCorrente = new Date().getFullYear();
    const potatureAnnoCorrente = potature.filter(p => {
      const dataPotatura = p.data instanceof Date ? p.data : (p.data?.toDate ? p.data.toDate() : new Date(p.data));
      return dataPotatura.getFullYear() === annoCorrente;
    });
    const spesePotaturaAnno = potatureAnnoCorrente.reduce((sum, p) => sum + (p.costoTotale || 0), 0);
    await updateFrutteto(fruttetoId, { spesePotaturaAnno: parseFloat(spesePotaturaAnno.toFixed(2)) });
  } catch (error) {
    console.error('[POTATURA-FRUTTETO] Errore ricalcolo spese potatura:', error);
  }
}

async function isTipoLavoroCategoriaPotatura(tipoLavoroNome) {
  try {
    if (!tipoLavoroNome) return false;
    const { getTipoLavoroByNome } = await import('../../../core/services/tipi-lavoro-service.js');
    const { getCategoria } = await import('../../../core/services/categorie-service.js');
    const tipo = await getTipoLavoroByNome(tipoLavoroNome);
    if (!tipo || !tipo.categoriaId) return false;
    let cat = await getCategoria(tipo.categoriaId);
    if (!cat) return false;
    if (cat.parentId) { cat = await getCategoria(cat.parentId); if (!cat) return false; }
    return (cat.codice || '').toLowerCase() === 'potatura';
  } catch (e) { return false; }
}

export async function findPotaturaByLavoroId(lavoroId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId || !lavoroId) return null;
    const { getAllFrutteti } = await import('./frutteti-service.js');
    const frutteti = await getAllFrutteti();
    for (const frutteto of frutteti) {
      const potature = await getPotature(frutteto.id);
      const potatura = potature.find(p => p.lavoroId === lavoroId);
      if (potatura) return { fruttetoId: frutteto.id, potaturaId: potatura.id, potatura };
    }
    return null;
  } catch (error) {
    console.error('[POTATURA-FRUTTETO] findPotaturaByLavoroId:', error);
    return null;
  }
}

export async function findPotaturaByAttivitaId(attivitaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId || !attivitaId) return null;
    const { getAllFrutteti } = await import('./frutteti-service.js');
    const frutteti = await getAllFrutteti();
    for (const frutteto of frutteti) {
      const potature = await getPotature(frutteto.id);
      const potatura = potature.find(p => p.attivitaId === attivitaId);
      if (potatura) return { fruttetoId: frutteto.id, potaturaId: potatura.id, potatura };
    }
    return null;
  } catch (error) {
    console.error('[POTATURA-FRUTTETO] findPotaturaByAttivitaId:', error);
    return null;
  }
}

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
    if (!terreno) return null;
    const { mapColturaToCategoria } = await import('../../../core/js/attivita-utils.js');
    if (mapColturaToCategoria(terreno.coltura || '') !== 'Frutteto') return null;
    const { getFruttetiByTerreno } = await import('./frutteti-service.js');
    const frutteti = await getFruttetiByTerreno(terreno.id);
    if (!frutteti || frutteti.length === 0) return null;
    const colturaLower = (terreno.coltura || '').toLowerCase();
    const frutteto = frutteti.find(f => (f.specie || '').toLowerCase() === colturaLower) || frutteti[0];
    const potatureEsistenti = await getPotature(frutteto.id);
    const esistente = potatureEsistenti.find(p => p.lavoroId === lavoroId);
    if (esistente) return esistente.id;
    const dataPotatura = lavoro.dataInizio instanceof Date ? lavoro.dataInizio : (lavoro.dataInizio?.toDate ? lavoro.dataInizio.toDate() : new Date());
    const operai = [];
    if (lavoro.caposquadraId) {
      try {
        const { getDb } = await import('../../../core/services/firebase-service.js');
        const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const db = getDb();
        if (db) {
          const squadreRef = collection(db, `tenants/${tenantId}/squadre`);
          const q = query(squadreRef, where('caposquadraId', '==', lavoro.caposquadraId));
          const snap = await getDocs(q);
          snap.forEach(d => { const s = d.data(); if (s.operai && Array.isArray(s.operai)) operai.push(...s.operai); });
        }
      } catch (e) { /* ignore */ }
    } else if (lavoro.operaioId) operai.push(lavoro.operaioId);
    const oreImpiegate = lavoro.durataPrevista ? lavoro.durataPrevista * 8 : null;
    const potaturaData = {
      fruttetoId: frutteto.id,
      lavoroId,
      data: dataPotatura,
      tipo: '',
      parcella: null,
      piantePotate: null,
      operai,
      oreImpiegate,
      note: `Potatura creata da lavoro: ${lavoro.nome || lavoroId}`
    };
    const potatura = new PotaturaFrutteto(potaturaData);
    potatura.aggiornaCalcoli();
    const collectionPath = getPotaturePath(frutteto.id);
    const potaturaId = await createDocument(collectionPath, potatura.toFirestore(), tenantId);
    await aggiornaFruttetoDaPotatura(frutteto.id, potatura);
    return potaturaId;
  } catch (error) {
    console.error('[POTATURA-FRUTTETO] createPotaturaFromLavoro:', error);
    return null;
  }
}

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
    if (!terreno) return null;
    const { mapColturaToCategoria } = await import('../../../core/js/attivita-utils.js');
    if (mapColturaToCategoria(terreno.coltura || '') !== 'Frutteto') return null;
    const { getFruttetiByTerreno } = await import('./frutteti-service.js');
    const frutteti = await getFruttetiByTerreno(terreno.id);
    if (!frutteti || frutteti.length === 0) return null;
    const colturaLower = (terreno.coltura || '').toLowerCase();
    const frutteto = frutteti.find(f => (f.specie || '').toLowerCase() === colturaLower) || frutteti[0];
    const potatureEsistenti = await getPotature(frutteto.id);
    const esistente = potatureEsistenti.find(p => p.attivitaId === attivitaId);
    if (esistente) return esistente.id;
    const dataPotatura = attivita.data instanceof Date ? attivita.data : (attivita.data ? new Date(attivita.data) : new Date());
    
    // Calcola costo manodopera da attività (proprietario)
    let costoManodopera = 0;
    const oreNette = attivita.oreNette || 0;
    if (oreNette > 0) {
      try {
        const { getTariffaProprietario } = await import('../../../core/services/calcolo-compensi-service.js');
        const tariffaProprietario = await getTariffaProprietario(tenantId);
        costoManodopera = oreNette * tariffaProprietario;
      } catch (e) {
        console.warn('[POTATURA-FRUTTETO] createPotaturaFromAttivita calcolo costo manodopera:', e);
      }
    }
    
    // Calcola costo macchina se presente
    let costoMacchina = 0;
    const oreMacchina = attivita.oreMacchina || 0;
    if (oreMacchina > 0 && (attivita.macchinaId || attivita.attrezzoId)) {
      try {
        const { hasModuleAccess } = await import('../../../core/services/tenant-service.js');
        const hasParcoMacchineModule = await hasModuleAccess('parcoMacchine');
        if (hasParcoMacchineModule) {
          const { getMacchina } = await import('../../../modules/parco-macchine/services/macchine-service.js');
          const macchinaId = attivita.macchinaId || attivita.attrezzoId;
          if (macchinaId) {
            try {
              const macchina = await getMacchina(macchinaId);
              if (macchina && macchina.costoOra) {
                costoMacchina = oreMacchina * parseFloat(macchina.costoOra);
              }
            } catch (e) {
              console.warn('[POTATURA-FRUTTETO] createPotaturaFromAttivita calcolo costo macchina:', e);
            }
          }
        }
      } catch (e) {
        console.warn('[POTATURA-FRUTTETO] createPotaturaFromAttivita verifica modulo parco macchine:', e);
      }
    }
    
    const potaturaData = {
      fruttetoId: frutteto.id,
      attivitaId,
      data: dataPotatura,
      tipo: '',
      parcella: null,
      piantePotate: null,
      operai: [],
      oreImpiegate: oreNette || null,
      costoManodopera,
      costoMacchina,
      note: `Potatura creata da attività: ${attivita.descrizione || attivitaId}`
    };
    const potatura = new PotaturaFrutteto(potaturaData);
    potatura.aggiornaCalcoli();
    const collectionPath = getPotaturePath(frutteto.id);
    const potaturaId = await createDocument(collectionPath, potatura.toFirestore(), tenantId);
    await aggiornaFruttetoDaPotatura(frutteto.id, potatura);
    return potaturaId;
  } catch (error) {
    console.error('[POTATURA-FRUTTETO] createPotaturaFromAttivita:', error);
    return null;
  }
}

/**
 * Mappa nome tipo lavoro al valore tipo potatura frutteto (invernale, verde, formazione, rinnovo, diradamento).
 * @param {string} tipoLavoroNome - Nome tipo lavoro
 * @returns {string} '' | 'invernale' | 'verde' | 'formazione' | 'rinnovo' | 'diradamento'
 */
export function tipoPotaturaFruttetoFromTipoLavoro(tipoLavoroNome) {
  if (!tipoLavoroNome || typeof tipoLavoroNome !== 'string') return '';
  const n = tipoLavoroNome.toLowerCase().trim();
  if (n.includes('spollonatura') || n.includes('diradamento')) return 'diradamento';
  if (n.includes('verde')) return 'verde';
  if (n.includes('rinnovamento') || n.includes('rinnovo')) return 'rinnovo';
  if (n.includes('formazione')) return 'formazione';
  if (n.includes('invernal') || n.includes('inverno')) return 'invernale';
  if (n.includes('produzione') || n.includes('meccanica') || n === 'potatura') return 'invernale';
  return '';
}

/**
 * Dati per precompilare il modal potatura frutteto da lavoro/attività (tipo, piante, nomi operai, costi).
 * Se il modulo manodopera non è attivo, operaiNomi resta vuoto (il lavoro è del proprietario).
 * @param {string} fruttetoId - ID frutteto
 * @param {PotaturaFrutteto} potatura - Potatura con lavoroId o attivitaId
 * @param {Object} [options] - Opzioni
 * @param {boolean} [options.hasManodoperaModule] - Se false, operaiNomi non viene compilato
 * @returns {Promise<{tipoPotatura: string, piantePotate: number|null, operaiNomi: string, costoManodopera: number, costoMacchina: number}>}
 */
export async function getDatiPrecompilazionePotatura(fruttetoId, potatura, options = {}) {
  const out = {
    tipoPotatura: potatura.tipo || '',
    piantePotate: potatura.piantePotate ?? null,
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

  out.tipoPotatura = tipoPotaturaFruttetoFromTipoLavoro(tipoLavoroNome) || out.tipoPotatura;

  const frutteto = await getFrutteto(fruttetoId);
  if (frutteto && superficieHa != null && superficieHa > 0) {
    const densita = frutteto.densita != null ? parseFloat(frutteto.densita) : null;
    if (densita != null && densita > 0) {
      out.piantePotate = Math.round(superficieHa * densita);
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
      const { calcolaCostiLavoro } = await import('../../../modules/vigneto/services/lavori-vigneto-service.js');
      const costi = await calcolaCostiLavoro(lavoroId, lavoro);
      if (costi) {
        out.costoManodopera = costi.costoManodopera ?? 0;
        out.costoMacchina = costi.costoMacchine ?? 0;
      }
    } catch (e) {
      console.warn('[POTATURA-FRUTTETO] getDatiPrecompilazionePotatura calcolaCostiLavoro:', e);
    }
  } else if (attivitaId && !lavoroId) {
    // Calcola costo manodopera da attività (diario) - lavoro del proprietario
    try {
      const { getAttivita } = await import('../../../core/services/attivita-service.js');
      const attivita = await getAttivita(attivitaId);
      if (attivita) {
        const oreNette = attivita.oreNette || 0;
        if (oreNette > 0) {
          const { getTariffaProprietario } = await import('../../../core/services/calcolo-compensi-service.js');
          const tenantId = getCurrentTenantId();
          const tariffaProprietario = await getTariffaProprietario(tenantId);
          out.costoManodopera = oreNette * tariffaProprietario;
        }
        
        // Calcola costo macchina se presente
        const oreMacchina = attivita.oreMacchina || 0;
        if (oreMacchina > 0 && (attivita.macchinaId || attivita.attrezzoId)) {
          let hasParcoMacchineModule = false;
          try {
            const { hasModuleAccess } = await import('../../../core/services/tenant-service.js');
            hasParcoMacchineModule = await hasModuleAccess('parcoMacchine');
          } catch (e) { /* ignore */ }
          
          if (hasParcoMacchineModule) {
            const { getMacchina } = await import('../../../modules/parco-macchine/services/macchine-service.js');
            const macchinaId = attivita.macchinaId || attivita.attrezzoId;
            if (macchinaId) {
              try {
                const macchina = await getMacchina(macchinaId);
                if (macchina && macchina.costoOra) {
                  out.costoMacchina = oreMacchina * parseFloat(macchina.costoOra);
                }
              } catch (e) {
                console.warn('[POTATURA-FRUTTETO] getDatiPrecompilazionePotatura calcolo costo macchina:', e);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[POTATURA-FRUTTETO] getDatiPrecompilazionePotatura calcolo costo da attività:', e);
    }
  }

  return out;
}

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
        const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
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
    await updatePotatura(found.fruttetoId, found.potaturaId, { data: dataPotatura, operai, oreImpiegate });
    return found.potaturaId;
  } catch (error) {
    console.error('[POTATURA-FRUTTETO] syncPotaturaFromLavoro:', error);
    return null;
  }
}
