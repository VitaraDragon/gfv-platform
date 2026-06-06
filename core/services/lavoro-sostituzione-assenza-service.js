/**
 * Assegnazione sostituto dopo standby per assenza.
 *
 * @module core/services/lavoro-sostituzione-assenza-service
 */

import { serverTimestamp } from './firebase-service.js';
import { getLavoro, updateLavoro } from './lavori-service.js';
import { LAVORO_STAND_BY_CAUSA_ASSENZA } from '../config/manodopera-assenze-config.js';
import { registraSostitutoSuAssenza } from './manodopera-assenze-service.js';

/**
 * @param {Object} options
 * @param {string} options.lavoroId
 * @param {string} options.sostitutoOperaioId
 * @param {string} options.managerId
 * @param {boolean} [options.confermaSpostamento] — se sostituto impegnato altrove
 * @param {string} [options.tenantId]
 * @returns {Promise<void>}
 */
export async function assegnaSostitutoDaStandby(options) {
  const {
    lavoroId,
    sostitutoOperaioId,
    managerId,
    tenantId = null
  } = options;

  if (!lavoroId || !sostitutoOperaioId || !managerId) {
    throw new Error('lavoroId, sostitutoOperaioId e managerId obbligatori');
  }

  const lavoro = await getLavoro(lavoroId);
  if (!lavoro) throw new Error('Lavoro non trovato');
  if (lavoro.stato !== 'in_standby') {
    throw new Error('Il lavoro non è in standby');
  }
  if (lavoro.standbyCausa && lavoro.standbyCausa !== LAVORO_STAND_BY_CAUSA_ASSENZA) {
    throw new Error('Standby non legato ad assenza');
  }

  const assenteId = lavoro.standbyOperaioId;
  if (assenteId && assenteId === sostitutoOperaioId) {
    throw new Error('Il sostituto non può essere la persona assente');
  }

  const restore =
    lavoro.standbyStatoPrecedente && ['da_pianificare', 'assegnato', 'in_corso'].includes(
      lavoro.standbyStatoPrecedente
    )
      ? lavoro.standbyStatoPrecedente
      : 'assegnato';

  const patch = {
    stato: restore,
    assenzaOperaioAssenteId: assenteId || lavoro.assenzaOperaioAssenteId || null,
    assenzaSostitutoOperaioId: sostitutoOperaioId,
    assenzaSostitutoDa: managerId,
    assenzaSostitutoIl: serverTimestamp(),
    standbyRipristinatoDa: managerId,
    standbyRipristinatoIl: serverTimestamp(),
    standbyStatoPrecedente: null,
    standbyCausa: null,
    standbyAssenzaId: null,
    standbyOperaioId: null,
    standbyDaIl: null,
    standbyNota: null,
    standbyGiornoKey: null
  };

  if (lavoro.operaioId && (!assenteId || lavoro.operaioId === assenteId)) {
    patch.operaioId = sostitutoOperaioId;
  }

  await updateLavoro(lavoroId, patch);

  if (lavoro.standbyAssenzaId) {
    await registraSostitutoSuAssenza(
      lavoro.standbyAssenzaId,
      sostitutoOperaioId,
      managerId,
      tenantId
    );
  }
}
