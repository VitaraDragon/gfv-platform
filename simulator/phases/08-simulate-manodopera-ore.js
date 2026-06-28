/**
 * Fase 8 v2 — Comunicazioni squadra + ciclo segna/valida ore (operaio, capo, manager).
 * @module simulator/phases/08-simulate-manodopera-ore
 */

import { generaGiorniLavorativi } from '../generators/date-calendario.js';
import { getEmulatorDb } from '../lib/emulator-context.js';
import {
  segnaOraSim,
  validaOraSim,
  inviaComunicazioneSim,
  confermaComunicazioneSim,
  segnalaAssenzaSim,
  mettiLavoroStandbyAssenzaSim
} from '../lib/manodopera-sim-actions.js';
import { runAsPersona } from '../lib/run-as-persona.js';
import { getSimProfile } from '../lib/sim-context.js';

function toDateAtMorning(isoDate) {
  return new Date(`${isoDate}T08:00:00`);
}

function buildCounts(state) {
  return {
    giorni: state.giorni.length,
    dateRange: { from: state.giorni[0], to: state.giorni[state.giorni.length - 1] },
    counts: {
      oreSegnate: state.oreSegnate,
      oreValidate: state.oreValidate,
      oreDaValidare: state.oreDaValidare,
      comunicazioniInviate: state.comunicazioniInviate,
      comunicazioniConfermate: state.comunicazioniConfermate,
      assenzeMalattiaSegnalate: state.assenzeMalattiaSegnalate,
      assenzeMalattiaConfermate: state.assenzeMalattiaConfermate,
      lavoriStandbyAssenza: state.lavoriStandbyAssenza
    }
  };
}

/**
 * Ore lasciate in coda per validazione manager (autonomo + capo su squadra).
 */
async function seedOreDaValidarePending(ctx, manodoperaCfg, lavoriSquadra, lavoriAutonomi) {
  const pending = manodoperaCfg.oreDaValidarePending ?? 0;
  if (pending <= 0) return 0;

  const data = toDateAtMorning(ctx.giorni[ctx.giorni.length - 1]);
  let created = 0;

  if (lavoriAutonomi[0]?.operaio && created < pending) {
    await ctx.segna(lavoriAutonomi[0].operaio, lavoriAutonomi[0].id, data);
    created += 1;
  }

  const lavoro = lavoriSquadra.find((l) => l.id !== ctx.lavoroStandbyId) || lavoriSquadra[0];
  if (lavoro?.squadra?.capo && created < pending) {
    await ctx.segna(lavoro.squadra.capo, lavoro.id, data);
    created += 1;
  }

  ctx.oreDaValidare = created;
  return created;
}

/**
 * @param {{ lavoriSquadra?: Array, lavoriAutonomi?: Array }} manodopera
 */
export async function runSimulateManodoperaOre(manodopera = {}) {
  const profile = getSimProfile();
  const template = profile?.template;
  const q = template?.quantities || {};
  const manodoperaCfg = template?.manodopera || {};
  if (manodoperaCfg.regimeMax) {
    return runRegimeMax(manodopera, q, manodoperaCfg);
  }
  return runStandard(manodopera, q, manodoperaCfg);
}

async function runRegimeMax(manodopera, q, manodoperaCfg) {
  const db = getEmulatorDb();
  const personasFull = requirePersonas();
  const lavoriSquadra = manodopera.lavoriSquadra || [];
  const lavoriAutonomi = manodopera.lavoriAutonomi || [];
  const giorni = generaGiorniLavorativi(q.giorniOreSimulate ?? 30);

  const ctx = createSimContext(db, personasFull, manodoperaCfg, giorni);

  for (let d = 0; d < giorni.length; d++) {
    if (d % 5 === 0) {
      for (const lavoro of lavoriSquadra) {
        if (lavoro.id === ctx.lavoroStandbyId) continue;
        await ctx.inviaEConfermaComunicazione(lavoro, giorni[d]);
      }
    }
  }

  await ctx.completeSquadraChain(lavoriSquadra[0], toDateAtMorning(giorni[0]));
  if (lavoriAutonomi[0]) {
    await ctx.completeAutonomoChain(lavoriAutonomi[0], toDateAtMorning(giorni[0]));
  }
  await ctx.simulaAssenzaMalattia(lavoriSquadra);

  for (let d = 0; d < giorni.length; d++) {
    const data = toDateAtMorning(giorni[d]);
    for (let li = 0; li < lavoriSquadra.length; li++) {
      const lavoro = lavoriSquadra[li];
      if (lavoro.id === ctx.lavoroStandbyId) continue;
      if (d === 0 && li === 0) continue;

      const capo = lavoro.squadra?.capo;
      const operai = lavoro.squadra?.operai || [];
      if (!capo || !operai.length) continue;

      const operaio = operai[(d + li) % operai.length];
      const oraId = await ctx.segna(operaio, lavoro.id, data);
      await ctx.valida(capo, lavoro.id, oraId);
    }

    if (d > 0 && d % 7 === 0) {
      for (const lavoro of lavoriSquadra) {
        if (lavoro.id === ctx.lavoroStandbyId) continue;
        const capo = lavoro.squadra?.capo;
        if (!capo) continue;
        const oraCapoId = await ctx.segna(capo, lavoro.id, data);
        await ctx.valida(ctx.manager, lavoro.id, oraCapoId);
      }
    }

    if (d > 0 && lavoriAutonomi.length) {
      const lavoro = lavoriAutonomi[d % lavoriAutonomi.length];
      await ctx.completeAutonomoChain(lavoro, data);
    }
  }

  await seedOreDaValidarePending(ctx, manodoperaCfg, lavoriSquadra, lavoriAutonomi);

  return buildCounts(ctx);
}

async function runStandard(manodopera, q, manodoperaCfg) {
  const db = getEmulatorDb();
  const personasFull = requirePersonas();
  const lavoriSquadra = manodopera.lavoriSquadra || [];
  const lavoriAutonomi = manodopera.lavoriAutonomi || [];
  const giorni = generaGiorniLavorativi(q.giorniOreSimulate ?? 10);
  const ctx = createSimContext(db, personasFull, manodoperaCfg, giorni);

  for (let i = 0; i < lavoriSquadra.length; i++) {
    const lavoro = lavoriSquadra[i];
    const isoDate = giorni[Math.min(i, giorni.length - 1)];
    await ctx.inviaEConfermaComunicazione(lavoro, isoDate);
  }

  await ctx.simulaAssenzaMalattia(lavoriSquadra);
  await ctx.completeSquadraChain(lavoriSquadra[0], toDateAtMorning(giorni[0]));
  await ctx.completeAutonomoChain(lavoriAutonomi[0], toDateAtMorning(giorni[0]));

  for (let d = 1; d < giorni.length; d++) {
    const data = toDateAtMorning(giorni[d]);
    const lavoro = lavoriSquadra[d % lavoriSquadra.length];
    if (lavoro.id === ctx.lavoroStandbyId) continue;
    const capo = lavoro.squadra?.capo;
    const operai = lavoro.squadra?.operai || [];
    if (!capo || !operai.length) continue;

    const operaio = operai[d % operai.length];
    const oraId = await ctx.segna(operaio, lavoro.id, data);
    await ctx.valida(capo, lavoro.id, oraId);
  }

  if (lavoriSquadra.length > 1 && giorni.length > 1) {
    const lavoro = lavoriSquadra[1];
    if (lavoro.id !== ctx.lavoroStandbyId) {
      const capo = lavoro.squadra?.capo;
      if (capo) {
        const oraCapoId = await ctx.segna(capo, lavoro.id, toDateAtMorning(giorni[1]));
        await ctx.valida(ctx.manager, lavoro.id, oraCapoId);
      }
    }
  }

  for (let i = 1; i < lavoriAutonomi.length && i < giorni.length; i++) {
    await ctx.completeAutonomoChain(lavoriAutonomi[i], toDateAtMorning(giorni[i]));
  }

  await seedOreDaValidarePending(ctx, manodoperaCfg, lavoriSquadra, lavoriAutonomi);

  return buildCounts(ctx);
}

function requirePersonas() {
  const profile = getSimProfile();
  const personasFull = profile?.personasFull;
  if (!personasFull?.manager) {
    throw new Error('Fase 08: personas mancanti — eseguire 06-setup-personas');
  }
  return personasFull;
}

function createSimContext(db, personasFull, manodoperaCfg, giorni) {
  const orarioInizio = manodoperaCfg.orarioInizio || '07:30';
  const orarioFine = manodoperaCfg.orarioFine || '12:00';
  const pauseMinuti = manodoperaCfg.pauseMinuti ?? 30;
  const simComunicazioni = manodoperaCfg.comunicazioniSquadra !== false;
  const simConferme = manodoperaCfg.confermeOperai !== false;
  const simAssenzaMalattia = manodoperaCfg.assenzaMalattia !== false;

  const state = {
    db,
    manager: personasFull.manager,
    giorni,
    orarioInizio,
    orarioFine,
    pauseMinuti,
    orarioComm: orarioInizio,
    simComunicazioni,
    simConferme,
    simAssenzaMalattia,
    lavoroStandbyId: null,
    oreSegnate: 0,
    oreValidate: 0,
    oreDaValidare: 0,
    comunicazioniInviate: 0,
    comunicazioniConfermate: 0,
    assenzeMalattiaSegnalate: 0,
    assenzeMalattiaConfermate: 0,
    lavoriStandbyAssenza: 0
  };

  state.segna = async (persona, lavoroId, data) => {
    const oraId = await runAsPersona(persona, () =>
      segnaOraSim(db, lavoroId, {
        operaioId: persona.id,
        data,
        orarioInizio,
        orarioFine,
        pauseMinuti,
        note: 'Ore simulate GFV Farm Simulator v2'
      })
    );
    state.oreSegnate += 1;
    return oraId;
  };

  state.valida = async (persona, lavoroId, oraId) => {
    await runAsPersona(persona, () => validaOraSim(db, lavoroId, oraId));
    state.oreValidate += 1;
  };

  state.inviaEConfermaComunicazione = async (lavoro, isoDate) => {
    if (!simComunicazioni) return null;
    const capo = lavoro.squadra?.capo;
    const operai = lavoro.squadra?.operai || [];
    if (!capo || !operai.length) return null;

    const destinatari = operai.map((o) => o.id);
    const commId = await runAsPersona(capo, () =>
      inviaComunicazioneSim(db, lavoro.id, {
        messaggio: `Briefing squadra — ${lavoro.nome}. Ritrovo alle ${orarioInizio}, attrezzatura completa.`,
        data: toDateAtMorning(isoDate),
        orario: orarioInizio,
        destinatari
      })
    );
    state.comunicazioniInviate += 1;

    if (simConferme) {
      for (const operaio of operai) {
        await runAsPersona(operaio, () => confermaComunicazioneSim(db, commId));
        state.comunicazioniConfermate += 1;
      }
    }
    return commId;
  };

  state.simulaAssenzaMalattia = async (lavoriSquadra) => {
    if (!simAssenzaMalattia || !lavoriSquadra.length) return;
    const lavoro = lavoriSquadra.length > 1 ? lavoriSquadra[1] : lavoriSquadra[0];
    const capo = lavoro.squadra?.capo;
    const operai = lavoro.squadra?.operai || [];
    if (!capo || operai.length < 2) return;

    const operaioAssente = operai[1];
    const giornoKey = giorni[0];
    const assenzaId = await runAsPersona(capo, () =>
      segnalaAssenzaSim(db, {
        operaioId: operaioAssente.id,
        tipo: 'malattia',
        dataGiorno: giornoKey,
        nota: 'Febbre — segnalazione simulata GFV Farm Simulator',
        lavoroId: lavoro.id
      })
    );
    state.assenzeMalattiaSegnalate += 1;

    await runAsPersona(state.manager, () =>
      mettiLavoroStandbyAssenzaSim(db, lavoro.id, assenzaId, operaioAssente.id, giornoKey)
    );
    state.assenzeMalattiaConfermate += 1;
    state.lavoriStandbyAssenza += 1;
    state.lavoroStandbyId = lavoro.id;
  };

  state.completeSquadraChain = async (lavoro, data) => {
    const capo = lavoro.squadra?.capo;
    const operai = lavoro.squadra?.operai || [];
    if (!capo || !operai.length) {
      throw new Error(`Lavoro squadra ${lavoro.id} senza capo/operai`);
    }
    const oraOperaioId = await state.segna(operai[0], lavoro.id, data);
    await state.valida(capo, lavoro.id, oraOperaioId);
    const oraCapoId = await state.segna(capo, lavoro.id, data);
    await state.valida(state.manager, lavoro.id, oraCapoId);
  };

  state.completeAutonomoChain = async (lavoro, data) => {
    const operaio = lavoro.operaio;
    if (!operaio) throw new Error(`Lavoro autonomo ${lavoro.id} senza operaio`);
    const oraId = await state.segna(operaio, lavoro.id, data);
    await state.valida(state.manager, lavoro.id, oraId);
  };

  return state;
}
