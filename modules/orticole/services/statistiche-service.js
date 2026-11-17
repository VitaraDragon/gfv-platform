/**
 * Statistiche orticole lette al volo da campagne, mietiture, prodotti e spese.
 * @module modules/orticole/services/statistiche-service
 */

import { getAllOrticole, listTerreniOrticole } from './orticole-service.js';
import { getAllRaccolteOrticole } from './raccolta-service.js';
import { getAllTrattamentiOrticole } from './trattamenti-service.js';
import { getAllIrrigazioniOrticole } from './irrigazione-service.js';
import { spesePerCampagne } from './orticole-spese-service.js';
import { riepilogoCampagne } from '../models/OrticolaStatistiche.js';

export async function caricaStatisticheOrticole() {
  const [terreni, campagne] = await Promise.all([
    listTerreniOrticole({ includiArchiviati: true }).catch(() => []),
    getAllOrticole().catch(() => [])
  ]);
  const [raccolte, trattamenti, spese, irrigazioni] = await Promise.all([
    getAllRaccolteOrticole().catch(() => []),
    getAllTrattamentiOrticole().catch(() => []),
    spesePerCampagne(campagne).catch(() => ({})),
    getAllIrrigazioniOrticole().catch(() => [])
  ]);
  return {
    terreni,
    righe: riepilogoCampagne({ campagne, raccolte, trattamenti, spese, irrigazioni })
  };
}
