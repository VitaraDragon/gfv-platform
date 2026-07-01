/**
 * Stub vigneto (catena A §11.3.12) — stessa shape Firestore dei service app,
 * scritti via Admin SDK (createVendemmiaFromLavoro / createTrattamentoFromLavoro / …).
 * @module simulator/lib/vigneto-stub-from-trigger
 */

import { Timestamp } from 'firebase-admin/firestore';
import { inferTipoTrattamentoColturaFromTipoLavoroNome } from '../../core/config/trattamenti-lavoro-defaults.js';
import { addTenantNestedDocument, normalizeForAdmin } from './firestore-write.js';
import {
  calcCostiManodoperaMacchinaAttivita,
  getTariffaProprietario,
  tenantHasModule
} from './sim-economia-vigneto.js';

function dateStringToTimestamp(dateStr) {
  if (!dateStr) return Timestamp.fromDate(new Date());
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0));
}

function parseAttivitaData(att) {
  if (!att.data) return new Date();
  if (typeof att.data === 'string') return new Date(att.data);
  if (typeof att.data.toDate === 'function') return att.data.toDate();
  return new Date(att.data);
}

function parseLavoroData(lavoro) {
  if (!lavoro.dataInizio) return new Date();
  if (lavoro.dataInizio instanceof Date) return lavoro.dataInizio;
  if (typeof lavoro.dataInizio.toDate === 'function') return lavoro.dataInizio.toDate();
  return new Date(lavoro.dataInizio);
}

function isTipoVendemmia(tipoLavoro) {
  return (tipoLavoro || '').toLowerCase().includes('vendemmia');
}

const TIPI_POTATURA = new Set(['Potatura']);
const TIPI_TRATTAMENTO = new Set(['Trattamento', 'Concimazione', 'Controllo fitosanitario']);

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @param {object} lavoro
 * @param {object} vigneto
 * @param {object} [options]
 * @param {string[]} [options.operaiIds]
 */
export async function createVendemmiaStubFromLavoro(db, tenantId, lavoro, vigneto, options = {}) {
  if (!isTipoVendemmia(lavoro.tipoLavoro)) return null;

  const operai = options.operaiIds || [];
  const macchine = [];
  if (lavoro.macchinaId) macchine.push(lavoro.macchinaId);
  if (lavoro.attrezzoId) macchine.push(lavoro.attrezzoId);

  let oreImpiegate = null;
  if (lavoro.durataPrevista) oreImpiegate = lavoro.durataPrevista * 8;

  const payload = normalizeForAdmin({
    vignetoId: vigneto.id,
    lavoroId: lavoro.id,
    data: Timestamp.fromDate(parseLavoroData(lavoro)),
    varieta: vigneto.varieta || '',
    quantitaQli: null,
    quantitaEttari: null,
    destinazione: null,
    gradazione: null,
    acidita: null,
    ph: null,
    operai,
    macchine,
    oreImpiegate,
    parcella: null,
    note: `Vendemmia creata automaticamente dal lavoro: ${lavoro.nome || lavoro.id}`
  });

  return addTenantNestedDocument(db, tenantId, ['vigneti', vigneto.id, 'vendemmie'], payload);
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @param {object} lavoro
 * @param {object} vigneto
 * @param {object} [options]
 * @param {number|null} [options.superficieTrattata]
 */
export async function createTrattamentoStubFromLavoro(db, tenantId, lavoro, vigneto, options = {}) {
  const tipo = lavoro.tipoLavoro || '';
  if (!TIPI_TRATTAMENTO.has(tipo)) return null;

  const operatore = lavoro.caposquadraId || lavoro.operaioId || null;
  const payload = normalizeForAdmin({
    vignetoId: vigneto.id,
    lavoroId: lavoro.id,
    data: Timestamp.fromDate(parseLavoroData(lavoro)),
    prodotto: '',
    dosaggio: '',
    tipoTrattamento: inferTipoTrattamentoColturaFromTipoLavoroNome(tipo),
    operatore,
    superficieTrattata: options.superficieTrattata ?? null,
    costoProdotto: 0,
    note: `Trattamento creato da lavoro: ${lavoro.nome || lavoro.id}`
  });

  return addTenantNestedDocument(db, tenantId, ['vigneti', vigneto.id, 'trattamenti'], payload);
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @param {object} att
 * @param {object} vigneto
 * @param {object} costiCtx
 */
export async function createPotaturaStubFromAttivita(db, tenantId, att, vigneto, costiCtx) {
  const costi = calcCostiManodoperaMacchinaAttivita(att, costiCtx, { sommaTrattoreEAttrezzo: false });
  const dataTs = dateStringToTimestamp(
    typeof att.data === 'string' ? att.data : parseAttivitaData(att).toISOString().slice(0, 10)
  );

  const payload = normalizeForAdmin({
    vignetoId: vigneto.id,
    attivitaId: att.id,
    data: dataTs,
    tipo: '',
    parcella: null,
    ceppiPotati: null,
    operai: [],
    oreImpiegate: att.oreNette || null,
    costoManodopera: costi.costoManodopera,
    costoMacchina: costi.costoMacchina,
    note: `Potatura creata da attività: ${att.note || att.descrizione || att.id}`
  });

  return addTenantNestedDocument(db, tenantId, ['vigneti', vigneto.id, 'potature'], payload);
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @param {object} att
 * @param {object} vigneto
 */
export async function createTrattamentoStubFromAttivita(db, tenantId, att, vigneto) {
  const tipo = att.tipoLavoro || '';
  const dataTs = dateStringToTimestamp(
    typeof att.data === 'string' ? att.data : parseAttivitaData(att).toISOString().slice(0, 10)
  );

  const payload = normalizeForAdmin({
    vignetoId: vigneto.id,
    attivitaId: att.id,
    data: dataTs,
    prodotto: '',
    dosaggio: '',
    tipoTrattamento: inferTipoTrattamentoColturaFromTipoLavoroNome(tipo),
    operatore: null,
    superficieTrattata: null,
    costoProdotto: 0,
    note: `Trattamento creato da attività: ${att.note || att.descrizione || att.id}`
  });

  return addTenantNestedDocument(db, tenantId, ['vigneti', vigneto.id, 'trattamenti'], payload);
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @param {object} att
 * @param {object} vigneto
 */
export async function createVendemmiaStubFromAttivita(db, tenantId, att, vigneto) {
  const macchine = [];
  if (att.macchinaId) {
    macchine.push({ id: att.macchinaId, ore: att.oreMacchina || att.oreNette || 0 });
  }
  if (att.attrezzoId) {
    macchine.push({ id: att.attrezzoId, ore: att.oreMacchina || att.oreNette || 0 });
  }

  const dataTs = dateStringToTimestamp(
    typeof att.data === 'string' ? att.data : parseAttivitaData(att).toISOString().slice(0, 10)
  );

  const payload = normalizeForAdmin({
    vignetoId: vigneto.id,
    attivitaId: att.id,
    data: dataTs,
    varieta: vigneto.varieta || '',
    quantitaQli: null,
    quantitaEttari: null,
    destinazione: null,
    gradazione: null,
    acidita: null,
    ph: null,
    operai: [],
    macchine,
    oreImpiegate: att.oreNette || 0,
    parcella: null,
    posizioneRilevamento: att.posizioneRilevamento || null,
    note: ''
  });

  return addTenantNestedDocument(db, tenantId, ['vigneti', vigneto.id, 'vendemmie'], payload);
}

/**
 * Crea stub vendemmia/trattamento da lavori manodopera (fase 07).
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @param {Array<object>} lavori
 * @param {Map<string, object>} vignetoByTerreno
 */
export async function seedCateneVignetoFromLavori(db, tenantId, lavori, vignetoByTerreno) {
  const vendemmiaIds = [];
  const trattamentoIds = [];

  for (const lavoro of lavori) {
    const vigneto = vignetoByTerreno.get(lavoro.terrenoId);
    if (!vigneto) continue;

    let operaiIds = [];
    if (lavoro.caposquadraId && lavoro.squadra?.operai?.length) {
      operaiIds = lavoro.squadra.operai.map((o) => o.id);
    } else if (lavoro.operaioId) {
      operaiIds = [lavoro.operaioId];
    }

    if (isTipoVendemmia(lavoro.tipoLavoro)) {
      const id = await createVendemmiaStubFromLavoro(db, tenantId, lavoro, vigneto, { operaiIds });
      if (id) vendemmiaIds.push({ vignetoId: vigneto.id, id, lavoroId: lavoro.id });
    }

    if (TIPI_TRATTAMENTO.has(lavoro.tipoLavoro)) {
      const terrenoSnap = await db.doc(`tenants/${tenantId}/terreni/${lavoro.terrenoId}`).get();
      const superficie = terrenoSnap.exists && terrenoSnap.data()?.superficie
        ? parseFloat(terrenoSnap.data().superficie)
        : null;
      const id = await createTrattamentoStubFromLavoro(db, tenantId, lavoro, vigneto, {
        superficieTrattata: superficie
      });
      if (id) trattamentoIds.push({ vignetoId: vigneto.id, id, lavoroId: lavoro.id });
    }
  }

  return { vendemmiaIds, trattamentoIds };
}

export {
  TIPI_POTATURA,
  TIPI_TRATTAMENTO,
  isTipoVendemmia,
  dateStringToTimestamp,
  parseAttivitaData
};

/** Extra attesi su template manodopera (lavoro vendemmia + stub trattamento da lavoro fase 07). */
export function extraCatenaCountsManodopera(template) {
  if (!template?.moduli?.includes('manodopera')) {
    return { lavoriSquadra: 0, trattamenti: 0, vendemmie: 0 };
  }
  return { lavoriSquadra: 1, trattamenti: 1, vendemmie: 1 };
}
