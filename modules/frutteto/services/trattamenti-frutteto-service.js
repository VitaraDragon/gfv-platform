/**
 * Trattamenti Frutteto Service - Servizio per gestione trattamenti frutteto
 * Allineato a trattamenti-vigneto-service (fonte: vigneto)
 *
 * @module modules/frutteto/services/trattamenti-frutteto-service
 */

import {
  getCollectionData,
  getDocumentData,
  createDocument,
  updateDocument,
  deleteDocument,
  dateToTimestamp,
  getDb
} from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { TrattamentoFrutteto } from '../models/TrattamentoFrutteto.js';
import { getFrutteto, updateFrutteto } from './frutteti-service.js';

const SUB_COLLECTION_NAME = 'trattamenti';

function getTrattamentiPath(fruttetoId) {
  return `frutteti/${fruttetoId}/${SUB_COLLECTION_NAME}`;
}

export async function getTrattamenti(fruttetoId, options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
    if (!fruttetoId) throw new Error('ID frutteto obbligatorio');

    const { orderBy = 'data', orderDirection = 'desc', tipoTrattamento = null, anno = null } = options;
    const collectionPath = getTrattamentiPath(fruttetoId);
    const whereFilters = [];
    if (tipoTrattamento) whereFilters.push(['tipoTrattamento', '==', tipoTrattamento]);
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
    return documents.map(doc => TrattamentoFrutteto.fromData(doc));
  } catch (error) {
    console.error('[TRATTAMENTI-FRUTTETO] Errore recupero trattamenti:', error);
    if (error.message.includes('tenant') || error.message.includes('obbligatorio')) throw new Error(`Errore recupero trattamenti: ${error.message}`);
    return [];
  }
}

export async function getTrattamento(fruttetoId, trattamentoId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
    if (!fruttetoId || !trattamentoId) throw new Error('ID frutteto e trattamento obbligatori');

    const collectionPath = getTrattamentiPath(fruttetoId);
    const data = await getDocumentData(collectionPath, trattamentoId, tenantId);
    if (!data) return null;
    return TrattamentoFrutteto.fromData({ ...data, id: trattamentoId });
  } catch (error) {
    console.error('Errore recupero trattamento:', error);
    throw new Error(`Errore recupero trattamento: ${error.message}`);
  }
}

export async function createTrattamento(fruttetoId, trattamentoData) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
    if (!fruttetoId) throw new Error('ID frutteto obbligatorio');

    const frutteto = await getFrutteto(fruttetoId);
    if (!frutteto) throw new Error('Frutteto non trovato');

    const trattamento = new TrattamentoFrutteto({ ...trattamentoData, fruttetoId });
    const validation = trattamento.validate();
    if (!validation.valid) throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    trattamento.aggiornaCalcoli();

    const collectionPath = getTrattamentiPath(fruttetoId);
    const trattamentoId = await createDocument(collectionPath, trattamento.toFirestore(), tenantId);
    await aggiornaFruttetoDaTrattamento(fruttetoId, trattamento);
    return trattamentoId;
  } catch (error) {
    console.error('Errore creazione trattamento:', error);
    throw new Error(`Errore creazione trattamento: ${error.message}`);
  }
}

export async function updateTrattamento(fruttetoId, trattamentoId, updates) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
    if (!fruttetoId || !trattamentoId) throw new Error('ID frutteto e trattamento obbligatori');

    const trattamentoEsistente = await getTrattamento(fruttetoId, trattamentoId);
    if (!trattamentoEsistente) throw new Error('Trattamento non trovato');

    trattamentoEsistente.update(updates);
    const validation = trattamentoEsistente.validate();
    if (!validation.valid) throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    trattamentoEsistente.aggiornaCalcoli();

    const collectionPath = getTrattamentiPath(fruttetoId);
    await updateDocument(collectionPath, trattamentoId, trattamentoEsistente.toFirestore(), tenantId);
    await aggiornaFruttetoDaTrattamento(fruttetoId, trattamentoEsistente);
  } catch (error) {
    console.error('Errore aggiornamento trattamento:', error);
    throw new Error(`Errore aggiornamento trattamento: ${error.message}`);
  }
}

export async function deleteTrattamento(fruttetoId, trattamentoId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
    if (!fruttetoId || !trattamentoId) throw new Error('ID frutteto e trattamento obbligatori');

    const collectionPath = getTrattamentiPath(fruttetoId);
    await deleteDocument(collectionPath, trattamentoId, tenantId);
    await ricalcolaSpeseTrattamentiFrutteto(fruttetoId);
  } catch (error) {
    console.error('Errore eliminazione trattamento:', error);
    throw new Error(`Errore eliminazione trattamento: ${error.message}`);
  }
}

async function aggiornaFruttetoDaTrattamento(fruttetoId, trattamento) {
  try {
    const trattamenti = await getTrattamenti(fruttetoId);
    const annoCorrente = new Date().getFullYear();
    const trattamentiAnnoCorrente = trattamenti.filter(t => {
      const dataTrattamento = t.data instanceof Date ? t.data : (t.data?.toDate ? t.data.toDate() : new Date(t.data));
      return dataTrattamento.getFullYear() === annoCorrente;
    });
    const speseTrattamentiAnno = trattamentiAnnoCorrente.reduce((sum, t) => sum + (t.costoTotale || 0), 0);
    const dataTrattamento = trattamento.data instanceof Date ? trattamento.data : (trattamento.data?.toDate ? trattamento.data.toDate() : new Date(trattamento.data));
    const dataUltimoTrattamento = trattamenti.length > 0
      ? trattamenti.reduce((latest, t) => {
          const tData = t.data instanceof Date ? t.data : (t.data?.toDate ? t.data.toDate() : new Date(t.data));
          return tData > latest ? tData : latest;
        }, dataTrattamento)
      : dataTrattamento;

    await updateFrutteto(fruttetoId, {
      dataUltimoTrattamento: dateToTimestamp(dataUltimoTrattamento),
      speseTrattamentiAnno: parseFloat(speseTrattamentiAnno.toFixed(2))
    });
  } catch (error) {
    console.error('[TRATTAMENTI-FRUTTETO] Errore aggiornamento frutteto da trattamento:', error);
  }
}

async function ricalcolaSpeseTrattamentiFrutteto(fruttetoId) {
  try {
    const trattamenti = await getTrattamenti(fruttetoId);
    const annoCorrente = new Date().getFullYear();
    const trattamentiAnnoCorrente = trattamenti.filter(t => {
      const dataTrattamento = t.data instanceof Date ? t.data : (t.data?.toDate ? t.data.toDate() : new Date(t.data));
      return dataTrattamento.getFullYear() === annoCorrente;
    });
    const speseTrattamentiAnno = trattamentiAnnoCorrente.reduce((sum, t) => sum + (t.costoTotale || 0), 0);
    await updateFrutteto(fruttetoId, { speseTrattamentiAnno: parseFloat(speseTrattamentiAnno.toFixed(2)) });
  } catch (error) {
    console.error('[TRATTAMENTI-FRUTTETO] Errore ricalcolo spese trattamenti:', error);
  }
}

async function isTipoLavoroCategoriaTrattamenti(tipoLavoroNome) {
  try {
    if (!tipoLavoroNome) return false;
    const { getTipoLavoroByNome } = await import('../../../core/services/tipi-lavoro-service.js');
    const { getCategoria } = await import('../../../core/services/categorie-service.js');
    const tipo = await getTipoLavoroByNome(tipoLavoroNome);
    if (!tipo || !tipo.categoriaId) return false;
    let cat = await getCategoria(tipo.categoriaId);
    if (!cat) return false;
    if (cat.parentId) { cat = await getCategoria(cat.parentId); if (!cat) return false; }
    return (cat.codice || '').toLowerCase() === 'trattamenti';
  } catch (e) { return false; }
}

/**
 * Lista lavori e attività (categoria Trattamenti) per un frutteto e anno, con eventuale trattamento collegato.
 * Solo righe da Gestione lavori / Diario; esclude lavori/attività già collegati a un altro frutteto sullo stesso terreno.
 * @param {string} fruttetoId - ID frutteto
 * @param {number} anno - Anno (es. 2026)
 * @returns {Promise<Array<{source: string, lavoroId?: string, attivitaId?: string, data: Date, lavoroLabel: string, terrenoLabel: string, fruttetoId: string, trattamento?: TrattamentoFrutteto|null}>>}
 */
export async function getLavoriAttivitaTrattamentiPerFrutteto(fruttetoId, anno) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) return [];
    if (!fruttetoId || !anno) return [];

    const { getFrutteto } = await import('./frutteti-service.js');
    const frutteto = await getFrutteto(fruttetoId);
    if (!frutteto || !frutteto.terrenoId) return [];

    const { getTerreno } = await import('../../../core/services/terreni-service.js');
    const { getLavoriByTerreno } = await import('../../../core/services/lavori-service.js');
    const { getAttivitaByTerreno } = await import('../../../core/services/attivita-service.js');

    const terreno = await getTerreno(frutteto.terrenoId);
    const terrenoLabel = terreno ? (terreno.nome || frutteto.terrenoId) : frutteto.terrenoId;

    const dataDaStr = `${anno}-01-01`;
    const dataAStr = `${anno}-12-31`;

    const [lavoriRaw, attivitaRawAll] = await Promise.all([
      getLavoriByTerreno(frutteto.terrenoId),
      getAttivitaByTerreno(frutteto.terrenoId)
    ]);

    const attivitaRaw = attivitaRawAll.filter(att => {
      const dataStr = typeof att.data === 'string' ? att.data : (att.data?.toDate ? att.data.toDate().toISOString().slice(0, 10) : '');
      return dataStr >= dataDaStr && dataStr <= dataAStr;
    });

    const lavori = [];
    for (const l of lavoriRaw) {
      const dataInizio = l.dataInizio instanceof Date ? l.dataInizio : (l.dataInizio?.toDate ? l.dataInizio.toDate() : new Date(l.dataInizio));
      if (dataInizio.getFullYear() !== anno) continue;
      if (await isTipoLavoroCategoriaTrattamenti(l.tipoLavoro || '')) lavori.push(l);
    }

    const attivitaFiltrate = [];
    for (const att of attivitaRaw) {
      const ok = await isTipoLavoroCategoriaTrattamenti(att.tipoLavoro || '');
      if (ok) attivitaFiltrate.push(att);
    }

    const rows = [];

    for (const lavoro of lavori) {
      const found = await findTrattamentoByLavoroId(lavoro.id);
      if (found && found.fruttetoId !== fruttetoId) continue;
      const dataInizio = lavoro.dataInizio instanceof Date ? lavoro.dataInizio : (lavoro.dataInizio?.toDate ? lavoro.dataInizio.toDate() : new Date(lavoro.dataInizio));
      const trattamento = found && found.fruttetoId === fruttetoId ? found.trattamento : null;
      rows.push({
        source: 'lavoro',
        lavoroId: lavoro.id,
        attivitaId: null,
        data: dataInizio,
        lavoroLabel: lavoro.tipoLavoro || lavoro.nome || lavoro.id,
        terrenoLabel,
        fruttetoId,
        trattamento
      });
    }

    for (const att of attivitaFiltrate) {
      const found = await findTrattamentoByAttivitaId(att.id);
      if (found && found.fruttetoId !== fruttetoId) continue;
      const dataAtt = att.data && (typeof att.data.toDate === 'function') ? att.data.toDate() : (att.data ? new Date(att.data) : new Date());
      const trattamento = found && found.fruttetoId === fruttetoId ? found.trattamento : null;
      rows.push({
        source: 'attivita',
        lavoroId: null,
        attivitaId: att.id,
        data: dataAtt,
        lavoroLabel: att.note || att.tipoLavoro || 'Attività',
        terrenoLabel,
        fruttetoId,
        trattamento
      });
    }

    rows.sort((a, b) => (b.data.getTime ? b.data.getTime() : 0) - (a.data.getTime ? a.data.getTime() : 0));
    return rows;
  } catch (error) {
    console.error('[TRATTAMENTI-FRUTTETO] getLavoriAttivitaTrattamentiPerFrutteto:', error);
    return [];
  }
}

/**
 * Lista lavori e attività (categoria Trattamenti) per TUTTI i frutteti e anno.
 * Usata quando non è selezionato un frutteto; il frutteto serve poi come filtro in UI.
 * @param {number} anno - Anno (es. 2026)
 * @returns {Promise<Array<{source: string, lavoroId?: string, attivitaId?: string, data: Date, lavoroLabel: string, terrenoLabel: string, fruttetoId: string, fruttetoNome?: string, trattamento?: TrattamentoFrutteto|null}>>}
 */
export async function getLavoriAttivitaTrattamentiTuttiFrutteti(anno) {
  try {
    const { getAllFrutteti } = await import('./frutteti-service.js');
    const frutteti = await getAllFrutteti();
    if (!frutteti || frutteti.length === 0) return [];

    const allRows = [];
    for (const f of frutteti) {
      const rows = await getLavoriAttivitaTrattamentiPerFrutteto(f.id, anno);
      const fruttetoNome = f.specie || f.varieta || f.nome || f.id;
      for (const row of rows) {
        allRows.push({ ...row, fruttetoNome });
      }
    }
    allRows.sort((a, b) => (b.data.getTime ? b.data.getTime() : 0) - (a.data.getTime ? a.data.getTime() : 0));
    return allRows;
  } catch (error) {
    console.error('[TRATTAMENTI-FRUTTETO] getLavoriAttivitaTrattamentiTuttiFrutteti:', error);
    return [];
  }
}

/**
 * Dati per precompilare il modal trattamento da lavoro/attività: costi (manodopera, macchina) e macchine impiegate.
 * @param {string} fruttetoId - ID frutteto (non usato per calcolo, per coerenza API)
 * @param {TrattamentoFrutteto|Object} trattamento - Trattamento con lavoroId o attivitaId
 * @returns {Promise<{costoManodopera: number, costoMacchina: number, macchine: Array<{tipo: string, nome: string, ore: number}>}>}
 */
export async function getDatiPrecompilazioneTrattamento(fruttetoId, trattamento) {
  const out = {
    costoManodopera: trattamento.costoManodopera ?? 0,
    costoMacchina: trattamento.costoMacchina ?? 0,
    macchine: []
  };
  const lavoroId = trattamento.lavoroId || null;
  const attivitaId = trattamento.attivitaId || null;

  if (lavoroId) {
    try {
      const { getLavoro } = await import('../../../core/services/lavori-service.js');
      const lavoro = await getLavoro(lavoroId);
      if (lavoro) {
        const { calcolaCostiLavoro } = await import('./lavori-frutteto-service.js');
        const costi = await calcolaCostiLavoro(lavoroId, lavoro);
        if (costi) {
          out.costoManodopera = costi.costoManodopera ?? 0;
          out.costoMacchina = costi.costoMacchine ?? 0;
        }
      }
      const tenantId = getCurrentTenantId();
      const db = getDb();
      if (tenantId && db) {
        const { collection, getDocs, query, where } = await import('../../../core/services/firebase-service.js');
        const oreRef = collection(db, `tenants/${tenantId}/lavori/${lavoroId}/oreOperai`);
        const q = query(oreRef, where('stato', '==', 'validate'));
        const snap = await getDocs(q);
        const macchineMap = {};
        snap.forEach(oraDoc => {
          const ora = oraDoc.data();
          const oreMac = ora.oreMacchina || 0;
          if (ora.macchinaId && oreMac > 0) {
            if (!macchineMap[ora.macchinaId]) macchineMap[ora.macchinaId] = { tipo: 'Trattore', nome: ora.macchinaId, oreTotali: 0 };
            macchineMap[ora.macchinaId].oreTotali += oreMac;
          }
          if (ora.attrezzoId && oreMac > 0) {
            if (!macchineMap[ora.attrezzoId]) macchineMap[ora.attrezzoId] = { tipo: 'Attrezzo', nome: ora.attrezzoId, oreTotali: 0 };
            macchineMap[ora.attrezzoId].oreTotali += oreMac;
          }
        });
        try {
          const { hasModuleAccess } = await import('../../../core/services/tenant-service.js');
          if (await hasModuleAccess('parcoMacchine')) {
            const { getMacchina } = await import('../../../modules/parco-macchine/services/macchine-service.js');
            for (const [macId, dati] of Object.entries(macchineMap)) {
              try {
                const mac = await getMacchina(macId);
                if (mac) dati.nome = mac.nome || mac.marca || macId;
              } catch (_) { /* keep id as name */ }
            }
          }
        } catch (_) { /* no parco macchine */ }
        out.macchine = Object.values(macchineMap).map(m => ({ tipo: m.tipo, nome: m.nome, ore: m.oreTotali || 0 }));
      }
    } catch (e) {
      console.warn('[TRATTAMENTI-FRUTTETO] getDatiPrecompilazioneTrattamento da lavoro:', e);
    }
    return out;
  }

  if (attivitaId && !lavoroId) {
    try {
      const { getAttivita } = await import('../../../core/services/attivita-service.js');
      const attivita = await getAttivita(attivitaId);
      if (attivita) {
        const oreNette = attivita.oreNette || 0;
        if (oreNette > 0) {
          const { getTariffaProprietario } = await import('../../../core/services/calcolo-compensi-service.js');
          const tariffa = await getTariffaProprietario(getCurrentTenantId());
          out.costoManodopera = oreNette * tariffa;
        }
        const oreMacchina = attivita.oreMacchina || attivita.oreNette || 0;
        let getMacchinaFn = null;
        try {
          const { hasModuleAccess } = await import('../../../core/services/tenant-service.js');
          if (await hasModuleAccess('parcoMacchine')) {
            const mod = await import('../../../modules/parco-macchine/services/macchine-service.js');
            getMacchinaFn = mod.getMacchina;
          }
        } catch (_) { /* ignore */ }
        if (attivita.macchinaId && oreMacchina > 0) {
          const mac = getMacchinaFn ? await getMacchinaFn(attivita.macchinaId).catch(() => null) : null;
          out.macchine.push({ tipo: 'Trattore', nome: mac ? (mac.nome || mac.marca) : attivita.macchinaId, ore: oreMacchina });
          if (mac && mac.costoOra) out.costoMacchina += oreMacchina * parseFloat(mac.costoOra);
        }
        if (attivita.attrezzoId && oreMacchina > 0) {
          const att = getMacchinaFn ? await getMacchinaFn(attivita.attrezzoId).catch(() => null) : null;
          out.macchine.push({ tipo: 'Attrezzo', nome: att ? (att.nome || att.marca) : attivita.attrezzoId, ore: oreMacchina });
          if (att && att.costoOra) out.costoMacchina += oreMacchina * parseFloat(att.costoOra);
        }
      }
    } catch (e) {
      console.warn('[TRATTAMENTI-FRUTTETO] getDatiPrecompilazioneTrattamento da attività:', e);
    }
    return out;
  }

  return out;
}

export async function findTrattamentoByLavoroId(lavoroId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId || !lavoroId) return null;
    const { getAllFrutteti } = await import('./frutteti-service.js');
    const frutteti = await getAllFrutteti();
    for (const frutteto of frutteti) {
      const trattamenti = await getTrattamenti(frutteto.id);
      const trattamento = trattamenti.find(t => t.lavoroId === lavoroId);
      if (trattamento) return { fruttetoId: frutteto.id, trattamentoId: trattamento.id, trattamento };
    }
    return null;
  } catch (error) {
    console.error('[TRATTAMENTI-FRUTTETO] findTrattamentoByLavoroId:', error);
    return null;
  }
}

export async function findTrattamentoByAttivitaId(attivitaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId || !attivitaId) return null;
    const { getAllFrutteti } = await import('./frutteti-service.js');
    const frutteti = await getAllFrutteti();
    for (const frutteto of frutteti) {
      const trattamenti = await getTrattamenti(frutteto.id);
      const trattamento = trattamenti.find(t => t.attivitaId === attivitaId);
      if (trattamento) return { fruttetoId: frutteto.id, trattamentoId: trattamento.id, trattamento };
    }
    return null;
  } catch (error) {
    console.error('[TRATTAMENTI-FRUTTETO] findTrattamentoByAttivitaId:', error);
    return null;
  }
}

export async function createTrattamentoFromLavoro(lavoroId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) return null;
    const { getLavoro } = await import('../../../core/services/lavori-service.js');
    const lavoro = await getLavoro(lavoroId);
    if (!lavoro) return null;
    if (!(await isTipoLavoroCategoriaTrattamenti(lavoro.tipoLavoro || ''))) return null;
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
    const trattamentiEsistenti = await getTrattamenti(frutteto.id);
    const esistente = trattamentiEsistenti.find(t => t.lavoroId === lavoroId);
    if (esistente) return esistente.id;
    const dataTrattamento = lavoro.dataInizio instanceof Date ? lavoro.dataInizio : (lavoro.dataInizio?.toDate ? lavoro.dataInizio.toDate() : new Date());
    const operatore = lavoro.caposquadraId || lavoro.operaioId || null;
    const trattamentoData = {
      fruttetoId: frutteto.id,
      lavoroId,
      data: dataTrattamento,
      prodotto: '',
      dosaggio: '',
      tipoTrattamento: '',
      operatore,
      superficieTrattata: terreno.superficie ? parseFloat(terreno.superficie) : null,
      costoProdotto: 0,
      note: `Trattamento creato da lavoro: ${lavoro.nome || lavoroId}`
    };
    const trattamento = new TrattamentoFrutteto(trattamentoData);
    trattamento.aggiornaCalcoli();
    const collectionPath = getTrattamentiPath(frutteto.id);
    const trattamentoId = await createDocument(collectionPath, trattamento.toFirestore(), tenantId);
    await aggiornaFruttetoDaTrattamento(frutteto.id, trattamento);
    return trattamentoId;
  } catch (error) {
    console.error('[TRATTAMENTI-FRUTTETO] createTrattamentoFromLavoro:', error);
    return null;
  }
}

export async function createTrattamentoFromAttivita(attivitaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) return null;
    const { getAttivita } = await import('../../../core/services/attivita-service.js');
    const attivita = await getAttivita(attivitaId);
    if (!attivita) return null;
    if (!(await isTipoLavoroCategoriaTrattamenti(attivita.tipoLavoro || ''))) return null;
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
    const trattamentiEsistenti = await getTrattamenti(frutteto.id);
    const esistente = trattamentiEsistenti.find(t => t.attivitaId === attivitaId);
    if (esistente) return esistente.id;
    const dataTrattamento = attivita.data instanceof Date ? attivita.data : (attivita.data ? new Date(attivita.data) : new Date());
    const trattamentoData = {
      fruttetoId: frutteto.id,
      attivitaId,
      data: dataTrattamento,
      prodotto: '',
      dosaggio: '',
      tipoTrattamento: '',
      operatore: null,
      superficieTrattata: null,
      costoProdotto: 0,
      note: `Trattamento creato da attività: ${attivita.descrizione || attivitaId}`
    };
    const trattamento = new TrattamentoFrutteto(trattamentoData);
    trattamento.aggiornaCalcoli();
    const collectionPath = getTrattamentiPath(frutteto.id);
    const trattamentoId = await createDocument(collectionPath, trattamento.toFirestore(), tenantId);
    await aggiornaFruttetoDaTrattamento(frutteto.id, trattamento);
    return trattamentoId;
  } catch (error) {
    console.error('[TRATTAMENTI-FRUTTETO] createTrattamentoFromAttivita:', error);
    return null;
  }
}

export async function syncTrattamentoFromLavoro(lavoroId) {
  try {
    const found = await findTrattamentoByLavoroId(lavoroId);
    if (!found) return null;
    const { getLavoro } = await import('../../../core/services/lavori-service.js');
    const lavoro = await getLavoro(lavoroId);
    if (!lavoro) return null;
    const operatore = lavoro.caposquadraId || lavoro.operaioId || null;
    const { getTerreno } = await import('../../../core/services/terreni-service.js');
    const terreno = await getTerreno(lavoro.terrenoId);
    const superficieTrattata = terreno && terreno.superficie ? parseFloat(terreno.superficie) : null;
    const dataTrattamento = lavoro.dataInizio instanceof Date ? lavoro.dataInizio : (lavoro.dataInizio?.toDate ? lavoro.dataInizio.toDate() : new Date());
    await updateTrattamento(found.fruttetoId, found.trattamentoId, { data: dataTrattamento, operatore, superficieTrattata });
    return found.trattamentoId;
  } catch (error) {
    console.error('[TRATTAMENTI-FRUTTETO] syncTrattamentoFromLavoro:', error);
    return null;
  }
}
