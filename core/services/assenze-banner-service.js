/**
 * Letture per il banner «assenze da gestire» (Gestione lavori e Impegni giornalieri).
 * @module core/services/assenze-banner-service
 */

import { getAllLavori } from './lavori-service.js';
import { getAssenza, listAssenzeApertePerGiorno } from './manodopera-assenze-service.js';
import { lavoriStandbyPerAssenza, righeBannerAssenze } from './assenze-banner-logic.js';

/**
 * Lavori in standby raggruppati per assenza. Rilancia se la lettura fallisce
 * (getAllLavori senza throwOnError restituirebbe [] e non si distinguerebbe da «nessuno»).
 * @returns {Promise<Map<string, Array<{ id: string, nome: string }>>>}
 */
export async function leggiLavoriStandbyPerAssenza() {
  const lavori = await getAllLavori({ stato: 'in_standby', orderBy: null, throwOnError: true });
  return lavoriStandbyPerAssenza(lavori);
}

/**
 * @param {string} giornoKey YYYY-MM-DD
 * @returns {Promise<{ rows: Object[], standbyVerificato: boolean }>}
 */
export async function caricaAssenzeDaGestire(giornoKey) {
  const [aperte, standbyPerAssenza] = await Promise.all([
    listAssenzeApertePerGiorno(giornoKey),
    leggiLavoriStandbyPerAssenza().catch((err) => {
      console.warn('[Assenze] lavori in standby non letti:', err);
      return null;
    })
  ]);
  const presenti = new Set((aperte || []).map((a) => a && a.id).filter(Boolean));
  const assenzeDaStandby = [];
  if (standbyPerAssenza) {
    // Assenze con lavori ancora in standby che il giorno non porta: con sostituto su un altro lavoro o di ieri.
    for (const assenzaId of standbyPerAssenza.keys()) {
      if (presenti.has(assenzaId)) continue;
      const a = await getAssenza(assenzaId);
      if (a) assenzeDaStandby.push({ ...a, id: a.id || assenzaId });
    }
  }
  return {
    rows: righeBannerAssenze({ aperte, assenzeDaStandby, standbyPerAssenza }),
    standbyVerificato: Boolean(standbyPerAssenza)
  };
}
