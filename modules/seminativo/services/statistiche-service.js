/**
 * Statistiche seminativo lette al volo da campagne, mietiture, prodotti e spese.
 * @module modules/seminativo/services/statistiche-service
 */

import { getAllSeminativi, listTerreniSeminativo } from './seminativi-service.js';
import { getAllRaccolteSeminativo } from './raccolta-service.js';
import { getAllTrattamentiSeminativo } from './trattamenti-service.js';
import { spesePerCampagne } from './seminativo-spese-service.js';
import { riepilogoCampagne } from '../models/SeminativoStatistiche.js';

export async function caricaStatisticheSeminativo() {
  const [terreni, campagne] = await Promise.all([
    listTerreniSeminativo().catch(() => []),
    getAllSeminativi().catch(() => [])
  ]);
  const [raccolte, trattamenti, spese] = await Promise.all([
    getAllRaccolteSeminativo().catch(() => []),
    getAllTrattamentiSeminativo().catch(() => []),
    spesePerCampagne(campagne).catch(() => ({}))
  ]);
  return {
    terreni,
    righe: riepilogoCampagne({ campagne, raccolte, trattamenti, spese })
  };
}
