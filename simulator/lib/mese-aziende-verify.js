/**
 * Verify profilato per lab “1 mese / 5 aziende”.
 * @module simulator/lib/mese-aziende-verify
 */

import {
  hasFruttetoModule,
  hasVignetoModule,
  isContoTerziTemplate,
  isFruttetoTemplate,
  isManodoperaTemplate
} from './load-template.js';
import { inspectManodoperaSeed } from './manodopera-inspect.js';
import { seedCarichiMeseCount } from '../phases/04-simulate-magazzino.js';
import { inspectTenantSeed } from './tenant-inspect.js';
import { initEmulatorAdmin } from './emulator-context.js';

async function listCollection(db, tenantId, name) {
  const snap = await db.collection(`tenants/${tenantId}/${name}`).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * @param {object} result — output runFullSimulation
 * @param {object} template
 * @returns {Promise<string[]>} issues
 */
export async function verifyMeseAzienda(result, template) {
  const { db } = initEmulatorAdmin();
  const tenantId = result.setup.tenantId;
  const q = template.quantities || {};
  const issues = [];

  const inspect = await inspectTenantSeed(db, tenantId);
  if (!inspect.ok) issues.push(...inspect.errors);

  const minAttivita = Math.min(20, q.attivitaGiorniLavorativi || 22);
  if ((result.simulation?.counts?.attivita || 0) < minAttivita) {
    issues.push(`attività ${result.simulation?.counts?.attivita || 0}/≥${minAttivita}`);
  }

  const dateFrom = result.simulation?.dateRange?.from;
  const dateTo = result.simulation?.dateRange?.to;
  if (!dateFrom || !dateTo) {
    issues.push('dateRange attività mancante');
  }

  const movimenti = await listCollection(db, tenantId, 'movimentiMagazzino');
  const uscite = movimenti.filter((m) => m.tipo === 'uscita');
  const entrate = movimenti.filter((m) => m.tipo === 'entrata');
  const usciteCollegate = uscite.filter(
    (m) => m.origineTrattamentoId || m.attivitaId
  );

  if (uscite.length < 6) {
    issues.push(`uscite magazzino ${uscite.length}/≥6`);
  }
  if (usciteCollegate.length < 5) {
    issues.push(`uscite collegate trattamento/attività ${usciteCollegate.length}/≥5`);
  }

  const nCarichi = seedCarichiMeseCount(template);
  if (nCarichi > 0 && entrate.length < nCarichi) {
    issues.push(`carichi magazzino ${entrate.length}/≥${nCarichi}`);
  }

  const guastiExpected = q.guasti || 0;
  if (guastiExpected > 0 && (inspect.counts.guasti || 0) < guastiExpected) {
    issues.push(`guasti ${inspect.counts.guasti || 0}/≥${guastiExpected}`);
  }

  if (hasVignetoModule(template)) {
    const tratt = inspect.counts.trattamentiVigneto || 0;
    if (tratt < 6) issues.push(`trattamenti vigneto ${tratt}/≥6`);
  }
  if (hasFruttetoModule(template) || isFruttetoTemplate(template)) {
    const trattF = inspect.counts.trattamentiFrutteto || 0;
    if (trattF < 4) issues.push(`trattamenti frutteto ${trattF}/≥4`);
  }

  if (isContoTerziTemplate(template)) {
    const clienti = await listCollection(db, tenantId, 'clienti');
    const preventivi = await listCollection(db, tenantId, 'preventivi');
    const minClienti = q.clienti || 2;
    const minPrev = Math.min(4, q.preventivi || 4);
    if (clienti.length < minClienti) issues.push(`clienti CT ${clienti.length}/≥${minClienti}`);
    if (preventivi.length < minPrev) issues.push(`preventivi CT ${preventivi.length}/≥${minPrev}`);
  }

  if (isManodoperaTemplate(template)) {
    const lavori = await listCollection(db, tenantId, 'lavori');
    const squadra = lavori.filter((l) => l.caposquadraId && !l.operaioId);
    const has1g = squadra.some((l) => Number(l.durataPrevista) === 1);
    const hasMulti = squadra.some((l) => Number(l.durataPrevista) >= 3);
    if (!has1g) issues.push('manca lavoro squadra durata 1 giorno');
    if (!hasMulti) issues.push('manca lavoro squadra durata ≥3 giorni');

    const mo = await inspectManodoperaSeed(db, tenantId, {
      squadre: q.squadre,
      minOreOperaioValidateDaCapo: 1,
      minOreCapoValidateDaManager: 1,
      minOreAutonomoValidateDaManager: 1,
      minComunicazioniAttive: 1,
      requireConfermeDestinatari: true,
      minAssenzeMalattiaConfermate: 1,
      minLavoriStandbyAssenza: 1,
      oreDaValidarePending: template.manodopera?.oreDaValidarePending ?? 2
    });
    if (!mo.ok) issues.push(...mo.errors);

    const oreValidate = result.manodoperaOre?.counts?.oreValidate || mo.counts.oreValidate || 0;
    if (oreValidate < 15) {
      issues.push(`ore validate ${oreValidate}/≥15`);
    }
  } else if (result.manodopera || result.personas) {
    issues.push('template senza manodopera ma seed manodopera presente');
  }

  return issues;
}
