/**
 * Blocco scritture sullo storico. Vale anche per Tony, perché passa dai servizi.
 * @module core/services/storico-guard
 */

import { getDocumentData } from './firebase-service.js';
import { getCurrentTenantId } from './tenant-service.js';
import { getTerreno } from './terreni-service.js';
import {
  isLavoroSolaLettura,
  isRegistroSolaLettura,
  isAttivitaSolaLettura,
  MESSAGGIO_SOLA_LETTURA
} from '../../shared/js/storico-sola-lettura.js';

export async function assertLavoroModificabile(lavoro) {
  if (!lavoro || !lavoro.terrenoId) return;
  const terreno = await getTerreno(lavoro.terrenoId);
  if (isLavoroSolaLettura(lavoro, terreno)) {
    throw new Error(MESSAGGIO_SOLA_LETTURA);
  }
}

export async function assertAttivitaModificabile(attivita) {
  if (!attivita) return;
  const tenantId = getCurrentTenantId();
  const terreno = attivita.terrenoId ? await getTerreno(attivita.terrenoId) : null;
  let lavoro = null;
  if (attivita.lavoroId && tenantId) {
    lavoro = await getDocumentData('lavori', attivita.lavoroId, tenantId);
  }
  if (isAttivitaSolaLettura(attivita, terreno, lavoro)) {
    throw new Error(MESSAGGIO_SOLA_LETTURA);
  }
}

export async function assertRegistroImpiantoModificabile(registro, collezioneImpianto, impiantoId) {
  const tenantId = getCurrentTenantId();
  const impianto = impiantoId && tenantId
    ? await getDocumentData(collezioneImpianto, impiantoId, tenantId)
    : null;
  const terreno = impianto && impianto.terrenoId ? await getTerreno(impianto.terrenoId) : null;
  let lavoro = null;
  if (registro && registro.lavoroId && tenantId) {
    lavoro = await getDocumentData('lavori', registro.lavoroId, tenantId);
  }
  if (isRegistroSolaLettura({ registro, lavoro, terreno, impianto })) {
    throw new Error(MESSAGGIO_SOLA_LETTURA);
  }
}
