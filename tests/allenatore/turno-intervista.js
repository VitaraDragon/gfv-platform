/**
 * Un turno dell'intervista account.
 * Stesso giro dei test landing, nello stesso ordine:
 *   server rispostaAccountDaTesto
 *   → applicaNomeTerrenoDaDomanda
 *   → client preparaTurnoOnboarding
 *   → decidiDopoRisposta
 *
 * I pacchetti tematici (landing, e dopo il Tony in-app) riusano questa funzione.
 * Non è un motore di valutazione: non dichiara esiti di voce né di browser.
 * Un turno non accumula i contatori della chat (fuori tema consecutivi,
 * domande rimaste): quelli restano argomenti di decidiDopoRisposta, come nei
 * test che li passano espliciti.
 *
 * @param {{ passo: string, dati: object }} stato mutato sul posto
 * @param {string} domanda
 * @param {object|string} modello JSON che il modello avrebbe restituito
 */
import { createRequire } from 'node:module';
import {
  decidiDopoRisposta,
  preparaTurnoOnboarding,
  serializzaRaccolti,
  utenteChiedeRiepilogo,
} from '../../landing/src/lib/tony-aiuto-account.js';

const require = createRequire(import.meta.url);
const {
  applicaNomeTerrenoDaDomanda,
  rispostaAccountDaTesto,
} = require('../../functions/lib/tony-landing-account.js');

export function turno(stato, domanda, modello) {
  const raccolti = serializzaRaccolti(stato.dati);
  const grezzo = typeof modello === 'string' ? modello : JSON.stringify(modello);
  let pulita = rispostaAccountDaTesto(grezzo, {
    raccolti,
    argomento: stato.passo,
    domanda,
  });
  if (pulita.dati) {
    pulita.dati = applicaNomeTerrenoDaDomanda(domanda, pulita.dati);
  }
  const client = preparaTurnoOnboarding({
    domanda,
    passo: stato.passo,
    datiAttuali: stato.dati,
    datiNuovi: pulita.dati,
    testo: pulita.testo,
  });
  stato.dati = client.dati.dati;
  stato.passo = client.passo || stato.passo;
  const nTerreni = (stato.dati.terreni || []).filter(
    (t) => t && (t.nome || typeof t.superficie === 'number' || t.coltura)
  ).length;
  const dopo = decidiDopoRisposta({
    passo: stato.passo,
    nTerreni,
    domanda,
    turniSenzaNovitaNelPasso: 0,
    domandeRimaste: 20,
    terreni: stato.dati.terreni,
  });
  const chiedeRiepilogo = utenteChiedeRiepilogo(domanda);
  const apreSuRichiesta =
    chiedeRiepilogo && client.bloccaAvanti !== true && client.vaiATerreni !== true;
  return {
    testo: client.testo != null ? client.testo : pulita.testo,
    apriRiepilogo:
      client.apriRiepilogo === true || dopo.apriRiepilogo === true || apreSuRichiesta,
    azioneDopo: dopo.azione,
    bloccaAvanti: client.bloccaAvanti === true,
    troppi: client.dati.troppiTerreni === true,
    chiedeRiepilogo,
    terreni: stato.dati.terreni || [],
    sede: stato.dati.sede,
    poderi: stato.dati.poderi,
    passo: stato.passo,
  };
}
