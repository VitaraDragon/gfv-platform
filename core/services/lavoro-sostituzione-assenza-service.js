/**
 * Assegnazione sostituto dopo standby per assenza.
 * Supporta lavoro autonomo e di squadra; doppio movimento se spostabile.
 *
 * @module core/services/lavoro-sostituzione-assenza-service
 */

import { serverTimestamp } from './firebase-service.js';
import { getLavoro, updateLavoro } from './lavori-service.js';
import {
  LAVORO_STAND_BY_CAUSA_ASSENZA,
  LAVORO_STAND_BY_CAUSA_PRESTITO,
  toGiornoKey
} from '../config/manodopera-assenze-config.js';
import { registraSostitutoSuAssenza } from './manodopera-assenze-service.js';

/**
 * @param {Object} lavoro
 * @param {string} giornoKey
 * @returns {Object}
 */
function getEquipaggioGiornoSlice(lavoro, giornoKey) {
  const root = (lavoro && lavoro.equipaggioGiorno) || {};
  const slice = root[giornoKey] || {};
  return {
    assenti: [...(slice.assenti || [])],
    sostituzioni: [...(slice.sostituzioni || [])],
    prestitiUscita: [...(slice.prestitiUscita || [])]
  };
}

/**
 * Registra buco/standby sul lavoro di origine (prestito manodopera).
 * Non modifica la squadra anagrafica globale.
 *
 * @param {Object} options
 * @returns {Promise<void>}
 */
export async function applicaBucoPrestitoSuLavoroOrigine(options) {
  const {
    lavoroOrigineId,
    operaioId,
    versoLavoroId,
    managerId,
    giornoKey,
    tenantId = null
  } = options;

  if (!lavoroOrigineId || !operaioId || !versoLavoroId || !managerId) {
    throw new Error('Parametri prestito incompleti');
  }

  const origine = await getLavoro(lavoroOrigineId);
  if (!origine) {
    throw new Error('Lavoro di origine non trovato per lo spostamento');
  }

  const dayKey = giornoKey || toGiornoKey(new Date());
  const prestitoMeta = {
    operaioId,
    versoLavoroId,
    giornoKey: dayKey,
    daManagerId: managerId,
    daIl: serverTimestamp()
  };

  const patchOrig = {
    manodoperaPrestata: prestitoMeta
  };

  if (origine.operaioId === operaioId) {
    // Autonomo: standby tracciato (buco sul lavoro di origine)
    if (origine.stato !== 'in_standby') {
      patchOrig.stato = 'in_standby';
      patchOrig.standbyStatoPrecedente = origine.stato;
    }
    patchOrig.standbyCausa = LAVORO_STAND_BY_CAUSA_PRESTITO;
    patchOrig.standbyOperaioId = operaioId;
    patchOrig.standbyGiornoKey = dayKey;
    patchOrig.standbyNota = `Prestato come sostituto sul lavoro ${versoLavoroId}`;
    patchOrig.standbyDaIl = serverTimestamp();
  } else if (origine.caposquadraId) {
    // Squadra: buco giornaliero su equipaggioGiorno (no modifica Squadra.operai)
    const slice = getEquipaggioGiornoSlice(origine, dayKey);
    if (!slice.assenti.includes(operaioId)) slice.assenti.push(operaioId);
    slice.prestitiUscita.push({
      operaioId,
      versoLavoroId,
      daManagerId: managerId
    });
    patchOrig.equipaggioGiorno = {
      ...(origine.equipaggioGiorno || {}),
      [dayKey]: slice
    };
  }

  await updateLavoro(lavoroOrigineId, patchOrig);

  if (origine.operaioId === operaioId && (origine.macchinaId || origine.attrezzoId)) {
    try {
      const { getCurrentTenantId } = await import('./tenant-service.js');
      const tid = tenantId || getCurrentTenantId();
      if (tid) {
        const { liberaMacchineDaLavoro } = await import('./lavoro-macchine-lifecycle.js');
        await liberaMacchineDaLavoro(
          { id: lavoroOrigineId, macchinaId: origine.macchinaId, attrezzoId: origine.attrezzoId },
          { tenantId: tid }
        );
      }
    } catch (e) {
      console.warn('[sostituzione] libera macchine origine prestito:', e);
    }
  }
}

/**
 * @param {Object} options
 * @param {string} options.lavoroId
 * @param {string} options.sostitutoOperaioId
 * @param {string} options.managerId
 * @param {boolean} [options.confermaSpostamento] — obbligatorio se sostituto impegnato altrove
 * @param {string} [options.impegnoLavoroId] — lavoro da cui si preleva
 * @param {string} [options.tenantId]
 * @returns {Promise<{ lavoroId: string, doppioMovimento: boolean, isLavoroSquadra: boolean }>}
 */
export async function assegnaSostitutoDaStandby(options) {
  const {
    lavoroId,
    sostitutoOperaioId,
    managerId,
    confermaSpostamento = false,
    impegnoLavoroId = null,
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

  const giornoKey = lavoro.standbyGiornoKey || toGiornoKey(new Date());
  const isLavoroSquadra = Boolean(lavoro.caposquadraId && !lavoro.operaioId);
  const needsPrestito = Boolean(impegnoLavoroId);

  if (needsPrestito && !confermaSpostamento) {
    throw new Error(
      'Conferma spostamento obbligatoria: il candidato è impegnato su un altro lavoro'
    );
  }

  const restore =
    lavoro.standbyStatoPrecedente &&
    ['da_pianificare', 'assegnato', 'in_corso'].includes(lavoro.standbyStatoPrecedente)
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

  // Autonomo: sostituisce l'assegnatario
  if (lavoro.operaioId && (!assenteId || lavoro.operaioId === assenteId)) {
    patch.operaioId = sostitutoOperaioId;
  }

  // Squadra (e anche autonomo): roster giornaliero tracciato senza toccare Squadra.operai
  const slice = getEquipaggioGiornoSlice(lavoro, giornoKey);
  if (assenteId && !slice.assenti.includes(assenteId)) {
    slice.assenti.push(assenteId);
  }
  slice.sostituzioni.push({
    assenteOperaioId: assenteId || null,
    sostitutoOperaioId,
    assegnatoDa: managerId,
    impegnoOrigineLavoroId: impegnoLavoroId || null
  });
  patch.equipaggioGiorno = {
    ...(lavoro.equipaggioGiorno || {}),
    [giornoKey]: slice
  };

  if (needsPrestito) {
    await applicaBucoPrestitoSuLavoroOrigine({
      lavoroOrigineId: impegnoLavoroId,
      operaioId: sostitutoOperaioId,
      versoLavoroId: lavoroId,
      managerId,
      giornoKey,
      tenantId
    });
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

  return {
    lavoroId,
    doppioMovimento: needsPrestito,
    isLavoroSquadra
  };
}
