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
  parseAttivitaData
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

export {
  TIPI_POTATURA,
  TIPI_TRATTAMENTO,
  isTipoRaccolta
};
