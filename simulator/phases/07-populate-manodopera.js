/**
 * Fase 7 v2 — Squadre + lavori manodopera (attore: manager via runAsPersona).
 * @module simulator/phases/07-populate-manodopera
 */

import { generaGiorniLavorativi } from '../generators/date-calendario.js';
import { getEmulatorDb } from '../lib/emulator-context.js';
import { addTenantDocument } from '../lib/firestore-write.js';
import { runAsPersona } from '../lib/run-as-persona.js';
import { getSimProfile, requireSimTenantId, requireSimUserId } from '../lib/sim-context.js';
import { hasFruttetoModule, hasVignetoModule, isFruttetoTemplate } from '../lib/load-template.js';
import { seedCateneFruttetoFromLavori } from '../lib/frutteto-stub-from-trigger.js';
import { seedCateneVignetoFromLavori } from '../lib/vigneto-stub-from-trigger.js';

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

function terrenoForLavoroSquadra(ctx, index) {
  if (!ctx.misto) return ctx.terreni[index % ctx.terreni.length];
  const pool = index % 2 === 0 ? ctx.vineTerreni : ctx.fruitTerreni;
  return pool[Math.floor(index / 2) % pool.length] || ctx.terreni[index % ctx.terreni.length];
}

function terrenoForLavoroAutonomo(ctx, index) {
  if (!ctx.misto) return ctx.terreni[(index + 1) % ctx.terreni.length];
  return ctx.fruitTerreni[index % ctx.fruitTerreni.length] || ctx.terreni[index % ctx.terreni.length];
}

/**
 * @param {{ terreni?: Array, trattori?: Array, attrezzi?: Array, vigneti?: Array }} [assets]
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
  const vigneti = assets.vigneti || [];
  const frutteti = assets.frutteti || [];
  const fruttetoOnly = isFruttetoTemplate(template);
  const vignetoEnabled = hasVignetoModule(template);
  const fruttetoEnabled = hasFruttetoModule(template);
  const misto = vignetoEnabled && fruttetoEnabled;
  const vineTerreni = misto
    ? terreni.filter((t) => vigneti.some((v) => v.terrenoId === t.id))
    : terreni;
  const fruitTerreni = misto
    ? terreni.filter((t) => frutteti.some((f) => f.terrenoId === t.id))
    : terreni;
  const terrenoCtx = { misto, vineTerreni, fruitTerreni, terreni };
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
      const terreno = terrenoForLavoroSquadra(terrenoCtx, i);
      const trattore = trattori[i % Math.max(trattori.length, 1)];
      const attrezzo = attrezzi[i % Math.max(attrezzi.length, 1)];
      const tipoLavoro = misto && i === 0
        ? 'Trattamento'
        : TIPI_LAVORO[i % TIPI_LAVORO.length];

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
      const terreno = terrenoForLavoroAutonomo(terrenoCtx, i);
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

    // Lavori catena A — vendemmia (vite) e/o raccolta (frutteto) su terreno coltura
    const lavoriCatena = [];
    if (fruttetoEnabled && frutteti.length && squadre.length) {
      const frutteto = frutteti[0];
      const terrenoFrutteto = terreni.find((t) => t.id === frutteto.terrenoId) || terreni[0];
      const squadra = squadre[0];
      const trattore = trattori[0] || null;
      const raccoltaData = {
        nome: 'Raccolta catena sim',
        terrenoId: terrenoFrutteto.id,
        caposquadraId: squadra.caposquadraId,
        tipoLavoro: 'Raccolta',
        dataInizio,
        durataPrevista: 4,
        stato: 'assegnato',
        note: 'Lavoro raccolta seed catena A (§11.3.12)',
        creatoDa: managerId,
        macchinaId: trattore?.id || null,
        superficieTotaleLavorata: 0,
        percentualeCompletamento: 0,
        giorniEffettivi: 0
      };
      assertLavoroPayload(raccoltaData);
      const raccoltaLavoroId = await addTenantDocument(db, tenantId, 'lavori', raccoltaData);
      lavoriCatena.push({
        id: raccoltaLavoroId,
        ...raccoltaData,
        squadra
      });
    }
    if (vignetoEnabled && vigneti.length && squadre.length) {
      const vigneto = vigneti[0];
      const terrenoVite = terreni.find((t) => t.id === vigneto.terrenoId) || terreni[0];
      const squadra = squadre[0];
      const trattore = trattori[0] || null;
      const vendemmiaData = {
        nome: 'Vendemmia Manuale catena sim',
        terrenoId: terrenoVite.id,
        caposquadraId: squadra.caposquadraId,
        tipoLavoro: 'Vendemmia Manuale',
        dataInizio,
        durataPrevista: 4,
        stato: 'assegnato',
        note: 'Lavoro vendemmia seed catena A (§11.3.12)',
        creatoDa: managerId,
        macchinaId: trattore?.id || null,
        superficieTotaleLavorata: 0,
        percentualeCompletamento: 0,
        giorniEffettivi: 0
      };
      assertLavoroPayload(vendemmiaData);
      const vendemmiaLavoroId = await addTenantDocument(db, tenantId, 'lavori', vendemmiaData);
      lavoriCatena.push({
        id: vendemmiaLavoroId,
        ...vendemmiaData,
        squadra
      });
    }

    return { squadre, lavoriSquadra, lavoriAutonomi, lavoriCatena };
  });

  const tuttiLavori = [
    ...result.lavoriSquadra,
    ...result.lavoriAutonomi,
    ...(result.lavoriCatena || [])
  ];

  let cateneVigneto = null;
  let cateneFrutteto = null;
  if (vignetoEnabled && vigneti.length) {
    const vignetoByTerreno = new Map(vigneti.map((v) => [v.terrenoId, v]));
    cateneVigneto = await seedCateneVignetoFromLavori(db, tenantId, tuttiLavori, vignetoByTerreno);
  }
  if (fruttetoEnabled && frutteti.length) {
    const fruttetoByTerreno = new Map(frutteti.map((f) => [f.terrenoId, f]));
    cateneFrutteto = await seedCateneFruttetoFromLavori(db, tenantId, tuttiLavori, fruttetoByTerreno);
  }

  const counts = {
    squadre: result.squadre.length,
    lavoriSquadra: result.lavoriSquadra.length + (result.lavoriCatena || []).length,
    lavoriAutonomi: result.lavoriAutonomi.length,
    lavoriCatena: (result.lavoriCatena || []).length
  };

  if (cateneFrutteto) {
    counts.raccolteStubLavoro = cateneFrutteto.raccoltaIds.length;
    counts.trattamentiStubLavoroFrutteto = cateneFrutteto.trattamentoIds.length;
  }
  if (cateneVigneto) {
    counts.vendemmieStubLavoro = cateneVigneto.vendemmiaIds.length;
    counts.trattamentiStubLavoroVigneto = cateneVigneto.trattamentoIds.length;
  }
  if (fruttetoOnly && cateneFrutteto) {
    counts.trattamentiStubLavoro = cateneFrutteto.trattamentoIds.length;
  } else if (!fruttetoEnabled && cateneVigneto) {
    counts.trattamentiStubLavoro = cateneVigneto.trattamentoIds.length;
  }

  return {
    ...result,
    cateneVigneto,
    cateneFrutteto,
    counts
  };
}
