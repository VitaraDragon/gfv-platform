/**
 * Fase 7 v2 — Squadre + lavori manodopera (attore: manager via runAsPersona).
 * @module simulator/phases/07-populate-manodopera
 */

import { generaGiorniLavorativi } from '../generators/date-calendario.js';
import { getEmulatorDb } from '../lib/emulator-context.js';
import { addTenantDocument } from '../lib/firestore-write.js';
import { runAsPersona } from '../lib/run-as-persona.js';
import { getSimProfile, requireSimTenantId, requireSimUserId } from '../lib/sim-context.js';

const TIPI_LAVORO = ['Potatura', 'Trattamento', 'Erpicatura', 'Concimazione'];

function assertSquadraPayload(data) {
  if (!data.nome || data.nome.trim().length < 3) {
    throw new Error('Nome squadra obbligatorio (min 3 caratteri)');
  }
  if (!data.caposquadraId) throw new Error('Caposquadra obbligatorio');
  if (!Array.isArray(data.operai)) throw new Error('Operai deve essere un array');
}

function assertLavoroPayload(data) {
  if (!data.nome || data.nome.trim().length < 3) throw new Error('Nome lavoro obbligatorio');
  if (!data.terrenoId) throw new Error('Terreno obbligatorio');
  if (!data.tipoLavoro) throw new Error('Tipo lavoro obbligatorio');
  if (!data.dataInizio) throw new Error('Data inizio obbligatoria');
  if (!data.durataPrevista || data.durataPrevista < 1) throw new Error('Durata prevista obbligatoria');
  if (data.caposquadraId && data.operaioId) {
    throw new Error('Lavoro non può avere caposquadraId e operaioId insieme');
  }
  if (!data.caposquadraId && !data.operaioId) {
    throw new Error('Lavoro deve avere caposquadraId o operaioId');
  }
}

function distributeOperaiRoundRobin(operai, squadreCount) {
  const buckets = Array.from({ length: squadreCount }, () => []);
  operai.forEach((op, i) => {
    buckets[i % squadreCount].push(op);
  });
  return buckets;
}

/**
 * @param {{ terreni?: Array, trattori?: Array, attrezzi?: Array }} [assets]
 */
export async function runPopulateManodopera(assets = {}) {
  const tenantId = requireSimTenantId();
  const managerId = requireSimUserId();
  const profile = getSimProfile();
  const template = profile?.template;
  const q = template?.quantities || {};
  const db = getEmulatorDb();

  const personasFull = profile?.personasFull;
  if (!personasFull?.caposquadra?.length || !personasFull?.operai?.length) {
    throw new Error('Fase 07: eseguire prima 06-setup-personas');
  }

  const managerDoc = personasFull.manager || {
    id: managerId,
    uid: managerId,
    ruoli: ['amministratore'],
    email: profile.email,
    nome: profile.nome,
    cognome: profile.cognome
  };

  const nCapo = personasFull.caposquadra.length;
  const nSquadre = Math.min(q.squadre ?? nCapo, nCapo);
  const nLavoriSquadra = q.lavoriSquadra ?? 2;
  const nLavoriAutonomi = q.lavoriAutonomi ?? 1;

  const terreni = assets.terreni || [];
  const trattori = assets.trattori || [];
  const attrezzi = assets.attrezzi || [];
  if (!terreni.length) {
    throw new Error('Fase 07: nessun terreno — eseguire populate asset');
  }

  const operaiBuckets = distributeOperaiRoundRobin(personasFull.operai, nSquadre);
  const dataInizioStr = generaGiorniLavorativi(1)[0];
  const dataInizio = new Date(`${dataInizioStr}T08:00:00`);

  const result = await runAsPersona(managerDoc, async () => {
    const squadre = [];
    for (let i = 0; i < nSquadre; i++) {
      const capo = personasFull.caposquadra[i];
      const operaiIds = operaiBuckets[i].map((o) => o.id);
      const squadraData = {
        nome: `Squadra ${capo.cognome}`,
        caposquadraId: capo.id,
        operai: operaiIds,
        note: 'Squadra simulatore GFV v2',
        creatoDa: managerId
      };
      assertSquadraPayload(squadraData);
      const squadraId = await addTenantDocument(db, tenantId, 'squadre', squadraData);
      squadre.push({
        id: squadraId,
        caposquadraId: capo.id,
        capo,
        operai: operaiBuckets[i]
      });
    }

    const lavoriSquadra = [];
    for (let i = 0; i < nLavoriSquadra; i++) {
      const squadra = squadre[i % squadre.length];
      const terreno = terreni[i % terreni.length];
      const trattore = trattori[i % Math.max(trattori.length, 1)];
      const attrezzo = attrezzi[i % Math.max(attrezzi.length, 1)];
      const tipoLavoro = TIPI_LAVORO[i % TIPI_LAVORO.length];

      const lavoroData = {
        nome: `${tipoLavoro} squadra ${i + 1}`,
        terrenoId: terreno.id,
        caposquadraId: squadra.caposquadraId,
        tipoLavoro,
        dataInizio,
        durataPrevista: 5 + (i % 3),
        stato: 'assegnato',
        note: 'Lavoro squadra simulatore v2',
        creatoDa: managerId,
        macchinaId: trattore?.id || null,
        attrezzoId: attrezzo?.id || null,
        superficieTotaleLavorata: 0,
        percentualeCompletamento: 0,
        giorniEffettivi: 0
      };

      assertLavoroPayload(lavoroData);
      const lavoroId = await addTenantDocument(db, tenantId, 'lavori', lavoroData);
      lavoriSquadra.push({
        id: lavoroId,
        ...lavoroData,
        squadra
      });
    }

    const lavoriAutonomi = [];
    for (let i = 0; i < nLavoriAutonomi; i++) {
      const operaio = personasFull.operai[i % personasFull.operai.length];
      const terreno = terreni[(i + 1) % terreni.length];
      const tipoLavoro = TIPI_LAVORO[(i + 2) % TIPI_LAVORO.length];

      const lavoroData = {
        nome: `${tipoLavoro} autonomo ${i + 1}`,
        terrenoId: terreno.id,
        operaioId: operaio.id,
        tipoLavoro,
        dataInizio,
        durataPrevista: 3 + i,
        stato: 'assegnato',
        note: 'Lavoro autonomo simulatore v2',
        creatoDa: managerId,
        superficieTotaleLavorata: 0,
        percentualeCompletamento: 0,
        giorniEffettivi: 0
      };

      assertLavoroPayload(lavoroData);
      const lavoroId = await addTenantDocument(db, tenantId, 'lavori', lavoroData);
      lavoriAutonomi.push({
        id: lavoroId,
        ...lavoroData,
        operaio
      });
    }

    return { squadre, lavoriSquadra, lavoriAutonomi };
  });

  return {
    ...result,
    counts: {
      squadre: result.squadre.length,
      lavoriSquadra: result.lavoriSquadra.length,
      lavoriAutonomi: result.lavoriAutonomi.length
    }
  };
}
