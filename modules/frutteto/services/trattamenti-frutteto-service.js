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
  dateToTimestamp
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
