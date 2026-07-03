/**
 * Stub frutteto (catena A §11.3.12) — stessa shape Firestore dei service app.
 * @module simulator/lib/frutteto-stub-from-trigger
 */

import { Timestamp } from 'firebase-admin/firestore';
import { inferTipoTrattamentoColturaFromTipoLavoroNome } from '../../core/config/trattamenti-lavoro-defaults.js';
import { addTenantNestedDocument, normalizeForAdmin } from './firestore-write.js';
import { calcCostiManodoperaMacchinaAttivita } from './sim-economia-vigneto.js';
import {
  TIPI_POTATURA,
  TIPI_TRATTAMENTO,
  dateStringToTimestamp,
  parseAttivitaData,
  parseLavoroData
} from './vigneto-stub-from-trigger.js';

function isTipoRaccolta(tipoLavoro) {
  return (tipoLavoro || '').toLowerCase().includes('raccolta');
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @param {object} att
 * @param {object} frutteto
 * @param {object} costiCtx
 */
export async function createPotaturaStubFromAttivita(db, tenantId, att, frutteto, costiCtx) {
  const costi = calcCostiManodoperaMacchinaAttivita(att, costiCtx, { sommaTrattoreEAttrezzo: false });
  const dataTs = dateStringToTimestamp(
    typeof att.data === 'string' ? att.data : parseAttivitaData(att).toISOString().slice(0, 10)
  );

  const payload = normalizeForAdmin({
    fruttetoId: frutteto.id,
    attivitaId: att.id,
    data: dataTs,
    tipo: '',
    parcella: null,
    piantePotate: null,
    operai: [],
    oreImpiegate: att.oreNette || null,
    costoManodopera: costi.costoManodopera,
    costoMacchina: costi.costoMacchina,
    note: `Potatura creata da attività: ${att.note || att.descrizione || att.id}`
  });

  return addTenantNestedDocument(db, tenantId, ['frutteti', frutteto.id, 'potature'], payload);
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @param {object} att
 * @param {object} frutteto
 */
export async function createTrattamentoStubFromAttivita(db, tenantId, att, frutteto) {
  const tipo = att.tipoLavoro || '';
  const dataTs = dateStringToTimestamp(
    typeof att.data === 'string' ? att.data : parseAttivitaData(att).toISOString().slice(0, 10)
  );

  const payload = normalizeForAdmin({
    fruttetoId: frutteto.id,
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

  return addTenantNestedDocument(db, tenantId, ['frutteti', frutteto.id, 'trattamenti'], payload);
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @param {object} att
 * @param {object} frutteto
 */
export async function createRaccoltaStubFromAttivita(db, tenantId, att, frutteto) {
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
    fruttetoId: frutteto.id,
    attivitaId: att.id,
    data: dataTs,
    specie: frutteto.specie || '',
    varieta: frutteto.varieta || '',
    quantitaKg: null,
    quantitaEttari: null,
    operai: [],
    macchine,
    oreImpiegate: att.oreNette || 0,
    posizioneRilevamento: att.posizioneRilevamento || null,
    note: `Raccolta creata automaticamente dall'attività diario`
  });

  return addTenantNestedDocument(db, tenantId, ['frutteti', frutteto.id, 'raccolte'], payload);
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @param {object} lavoro
 * @param {object} frutteto
 * @param {object} [options]
 * @param {string[]} [options.operaiIds]
 */
export async function createRaccoltaStubFromLavoro(db, tenantId, lavoro, frutteto, options = {}) {
  if (!isTipoRaccolta(lavoro.tipoLavoro)) return null;

  const operai = options.operaiIds || [];
  const macchine = [];
  if (lavoro.macchinaId) macchine.push(lavoro.macchinaId);
  if (lavoro.attrezzoId) macchine.push(lavoro.attrezzoId);

  let oreImpiegate = null;
  if (lavoro.durataPrevista) oreImpiegate = lavoro.durataPrevista * 8;

  const payload = normalizeForAdmin({
    fruttetoId: frutteto.id,
    lavoroId: lavoro.id,
    data: Timestamp.fromDate(parseLavoroData(lavoro)),
    specie: frutteto.specie || '',
    varieta: frutteto.varieta || '',
    quantitaKg: null,
    quantitaEttari: null,
    operai,
    macchine,
    oreImpiegate,
    note: `Raccolta creata automaticamente dal lavoro: ${lavoro.nome || lavoro.id}`
  });

  return addTenantNestedDocument(db, tenantId, ['frutteti', frutteto.id, 'raccolte'], payload);
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @param {object} lavoro
 * @param {object} frutteto
 * @param {object} [options]
 * @param {number|null} [options.superficieTrattata]
 */
export async function createTrattamentoStubFromLavoro(db, tenantId, lavoro, frutteto, options = {}) {
  const tipo = lavoro.tipoLavoro || '';
  if (!TIPI_TRATTAMENTO.has(tipo)) return null;

  const operatore = lavoro.caposquadraId || lavoro.operaioId || null;
  const payload = normalizeForAdmin({
    fruttetoId: frutteto.id,
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

  return addTenantNestedDocument(db, tenantId, ['frutteti', frutteto.id, 'trattamenti'], payload);
}

/**
 * Crea stub raccolta/trattamento da lavori manodopera (fase 07).
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @param {Array<object>} lavori
 * @param {Map<string, object>} fruttetoByTerreno
 */
export async function seedCateneFruttetoFromLavori(db, tenantId, lavori, fruttetoByTerreno) {
  const raccoltaIds = [];
  const trattamentoIds = [];

  for (const lavoro of lavori) {
    const frutteto = fruttetoByTerreno.get(lavoro.terrenoId);
    if (!frutteto) continue;

    let operaiIds = [];
    if (lavoro.caposquadraId && lavoro.squadra?.operai?.length) {
      operaiIds = lavoro.squadra.operai.map((o) => o.id);
    } else if (lavoro.operaioId) {
      operaiIds = [lavoro.operaioId];
    }

    if (isTipoRaccolta(lavoro.tipoLavoro)) {
      const id = await createRaccoltaStubFromLavoro(db, tenantId, lavoro, frutteto, { operaiIds });
      if (id) raccoltaIds.push({ fruttetoId: frutteto.id, id, lavoroId: lavoro.id });
    }

    if (TIPI_TRATTAMENTO.has(lavoro.tipoLavoro)) {
      const terrenoSnap = await db.doc(`tenants/${tenantId}/terreni/${lavoro.terrenoId}`).get();
      const superficie = terrenoSnap.exists && terrenoSnap.data()?.superficie
        ? parseFloat(terrenoSnap.data().superficie)
        : null;
      const id = await createTrattamentoStubFromLavoro(db, tenantId, lavoro, frutteto, {
        superficieTrattata: superficie
      });
      if (id) trattamentoIds.push({ fruttetoId: frutteto.id, id, lavoroId: lavoro.id });
    }
  }

  return { raccoltaIds, trattamentoIds };
}

/** Extra attesi su template manodopera frutteto (lavoro raccolta + stub trattamento da lavoro fase 07). */
export function extraCatenaCountsManodoperaFrutteto(template) {
  if (!template?.moduli?.includes('manodopera')) {
    return { lavoriSquadra: 0, trattamenti: 0, raccolte: 0 };
  }
  return { lavoriSquadra: 1, trattamenti: 1, raccolte: 1 };
}

export {
  TIPI_POTATURA,
  TIPI_TRATTAMENTO,
  isTipoRaccolta
};
