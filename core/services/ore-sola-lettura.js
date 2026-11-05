import {
  isLavoroSolaLettura,
  MESSAGGIO_ORE_SOLA_LETTURA
} from '../../shared/js/storico-sola-lettura.js';

export function assertOraLavoroModificabile(lavoro, terreno) {
  if (isLavoroSolaLettura(lavoro, terreno)) {
    throw new Error(MESSAGGIO_ORE_SOLA_LETTURA);
  }
}
