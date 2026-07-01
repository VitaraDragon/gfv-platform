/**
 * Fase 3 — Simula 4 settimane di attività diario.
 * @module simulator/phases/03-simulate-attivita
 */

import { generaGiorniLavorativi } from '../generators/date-calendario.js';
import { getEmulatorDb } from '../lib/emulator-context.js';
import { addTenantDocument } from '../lib/firestore-write.js';
import { requireSimTenantId, getSimProfile } from '../lib/sim-context.js';

function orarioToMinuti(orario) {
  const [h, m] = orario.split(':').map(Number);
  return h * 60 + m;
}

function calcolaOreNette(orarioInizio, orarioFine, pauseMinuti) {
  const diff = orarioToMinuti(orarioFine) - orarioToMinuti(orarioInizio) - pauseMinuti;
  return Math.max(0, parseFloat((diff / 60).toFixed(2)));
}

/**
 * @param {{ terreni: Array, trattori: Array, attrezzi: Array }} assets
 */
export async function runSimulateAttivita(assets) {
  const tenantId = requireSimTenantId();
  const profile = getSimProfile();
  const template = profile?.template;
  const attCfg = template?.attivita || {};
  const count = template?.quantities?.attivitaGiorniLavorativi || 20;
  const dates = generaGiorniLavorativi(count);
  const db = getEmulatorDb();

  const tipiLavoro = attCfg.tipiLavoro || ['Potatura', 'Trattamento'];
  const { terreni, trattori, attrezzi } = assets;
  if (!terreni?.length) {
    throw new Error('Nessun terreno disponibile per simulazione attività');
  }

  const attivitaIds = [];

  /** Sostituisce un giorno Erpicatura (nessun record vigneto) con vendemmia stub — catena A. */
  let vendemmiaDayIndex = -1;
  for (let j = dates.length - 1; j >= 0; j--) {
    if (tipiLavoro[j % tipiLavoro.length] === 'Erpicatura') {
      vendemmiaDayIndex = j;
      break;
    }
  }
  if (vendemmiaDayIndex < 0) vendemmiaDayIndex = dates.length - 1;

  for (let i = 0; i < dates.length; i++) {
    const terreno = terreni[i % terreni.length];
    const trattore = trattori[i % Math.max(trattori.length, 1)] || null;
    const attrezzo = attrezzi[i % Math.max(attrezzi.length, 1)] || null;
    const orarioInizio = attCfg.orarioInizio || '08:00';
    const orarioFine = attCfg.orarioFine || '12:30';
    const pauseMinuti = attCfg.pauseMinuti ?? 30;
    const oreNette = calcolaOreNette(orarioInizio, orarioFine, pauseMinuti);

    // Giorno Erpicatura → Vendemmia Manuale (stub catena A, non altera conteggi vigneto)
    const tipoLavoro = i === vendemmiaDayIndex
      ? 'Vendemmia Manuale'
      : tipiLavoro[i % tipiLavoro.length];

    const payload = {
      data: dates[i],
      terrenoId: terreno.id,
      terrenoNome: terreno.nome,
      tipoLavoro,
      coltura: attCfg.coltura || 'Vite',
      orarioInizio,
      orarioFine,
      pauseMinuti,
      oreNette,
      note: `Attività simulata — ${tipoLavoro}`,
      macchinaId: trattore?.id || null,
      attrezzoId: attrezzo?.id || null,
      oreMacchina: trattore ? oreNette : null
    };

    const id = await addTenantDocument(db, tenantId, 'attivita', payload);
    attivitaIds.push(id);
  }

  return {
    attivitaIds,
    dates,
    counts: { attivita: attivitaIds.length },
    dateRange: { from: dates[0], to: dates[dates.length - 1] }
  };
}
