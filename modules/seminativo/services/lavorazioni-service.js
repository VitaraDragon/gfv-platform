/**
 * Lettura lavorazioni seminativo da diario e lavori (niente collezione dedicata).
 * @module modules/seminativo/services/lavorazioni-service
 */

import { getAllAttivita } from '../../../core/services/attivita-service.js';
import { getAllLavori } from '../../../core/services/lavori-service.js';
import { listTerreniSeminativo, getAllSeminativi } from './seminativi-service.js';
import {
  TIPI_LAVORAZIONE_CAMPO_APERTO,
  SOTTOCATEGORIA_LAVORAZIONE_CAMPO_APERTO,
  isTipoLavorazioneCampoAperto,
  selezionaLavorazioniCollegate
} from '../models/SeminativoLavorazione.js';

export { selezionaLavorazioniCollegate };

/**
 * Tipi del catalogo aziendale in sottocategoria Generale.
 * Se il catalogo non risponde, restano i nomi predefiniti di campo aperto.
 * @returns {Promise<Array<{id: string, nome: string}>>}
 */
export async function listTipiLavorazioneCampoAperto() {
  try {
    const { getAllCategorie } = await import('../../../core/services/categorie-service.js');
    const { getAllTipiLavoro } = await import('../../../core/services/tipi-lavoro-service.js');
    const categorie = await getAllCategorie();
    const generaleIds = new Set();
    (categorie || []).forEach((cat) => {
      const codice = String(cat.codice || '').toLowerCase();
      if (codice === SOTTOCATEGORIA_LAVORAZIONE_CAMPO_APERTO && cat.id) {
        generaleIds.add(String(cat.id));
      }
    });
    const tipi = await getAllTipiLavoro({ orderBy: 'nome', orderDirection: 'asc' });
    const seen = new Set();
    const aperti = (tipi || []).filter((tipo) => {
      if (!isTipoLavorazioneCampoAperto(tipo, { generaleIds })) return false;
      const key = String(tipo.nome || '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (aperti.length) {
      return aperti.map((tipo) => ({ id: tipo.id, nome: tipo.nome }));
    }
  } catch (err) {
    console.warn('[seminativo] tipi lavorazione:', err && err.message);
  }
  return TIPI_LAVORAZIONE_CAMPO_APERTO.map((nome) => ({ id: nome, nome }));
}

/**
 * @param {{ includeLavori?: boolean }} [options]
 */
export async function listLavorazioniCollegate(options = {}) {
  const includeLavori = options.includeLavori !== false;
  const [terreni, tipi, campagne, attivita, lavori] = await Promise.all([
    listTerreniSeminativo(),
    listTipiLavorazioneCampoAperto(),
    getAllSeminativi().catch(() => []),
    getAllAttivita().catch(() => []),
    includeLavori ? getAllLavori().catch(() => []) : Promise.resolve([])
  ]);
  return {
    terreni,
    tipi,
    campagne,
    righe: selezionaLavorazioniCollegate({
      terreni,
      nomiConsentiti: tipi.map((tipo) => tipo.nome),
      attivita,
      lavori,
      includeLavori,
      campagne
    })
  };
}
