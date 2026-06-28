/**
 * Ispezione seed manodopera v2 (squadre, lavori, ore).
 * @module simulator/lib/manodopera-inspect
 */

import {
  isLavoroAutonomo,
  isLavoroSquadra,
  isOraDelCaposquadraSuLavoroSquadra
} from '../../core/services/manodopera-ore-validazione-scope.js';
import { normalizeDestinatariIds } from '../../core/services/comunicazioni-squadra-utils.js';

async function listCollection(db, tenantId, name) {
  const snap = await db.collection(`tenants/${tenantId}/${name}`).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @param {object} [expected]
 */
export async function inspectManodoperaSeed(db, tenantId, expected = {}) {
  const errors = [];
  const squadre = await listCollection(db, tenantId, 'squadre');
  const lavori = await listCollection(db, tenantId, 'lavori');

  let oreValidate = 0;
  let oreDaValidare = 0;
  let oreOperaioValidateDaCapo = 0;
  let oreCapoValidateDaManager = 0;
  let oreAutonomoValidateDaManager = 0;
  let oreSenzaValidatoDa = 0;

  for (const lavoro of lavori) {
    const oreSnap = await db
      .collection(`tenants/${tenantId}/lavori/${lavoro.id}/oreOperai`)
      .get();

    for (const doc of oreSnap.docs) {
      const ora = doc.data();
      if (ora.stato === 'da_validare') {
        oreDaValidare += 1;
      }
      if (ora.stato === 'validate') {
        oreValidate += 1;
        if (!ora.validatoDa) {
          oreSenzaValidatoDa += 1;
          errors.push(`ora ${doc.id} validate senza validatoDa`);
        }
        if (isLavoroSquadra(lavoro) && !isOraDelCaposquadraSuLavoroSquadra(ora, lavoro)) {
          if (ora.validatoDa === lavoro.caposquadraId) {
            oreOperaioValidateDaCapo += 1;
          }
        }
        if (isLavoroSquadra(lavoro) && isOraDelCaposquadraSuLavoroSquadra(ora, lavoro)) {
          oreCapoValidateDaManager += 1;
        }
        if (isLavoroAutonomo(lavoro)) {
          oreAutonomoValidateDaManager += 1;
        }
      }
    }
  }

  const lavoriSquadra = lavori.filter((l) => isLavoroSquadra(l)).length;
  const lavoriAutonomi = lavori.filter((l) => isLavoroAutonomo(l)).length;

  const comunicazioni = await listCollection(db, tenantId, 'comunicazioni');
  const comunicazioniAttive = comunicazioni.filter((c) => c.stato === 'attiva').length;
  let comunicazioniConDestinatari = 0;
  let comunicazioniConConferme = 0;
  let confermeTotali = 0;

  for (const comm of comunicazioni) {
    const destIds = Array.isArray(comm.destinatari) ? comm.destinatari.filter(Boolean) : [];
    if (destIds.length > 0) comunicazioniConDestinatari += 1;
    const conferme = Array.isArray(comm.conferme) ? comm.conferme : [];
    confermeTotali += conferme.length;
    if (conferme.length > 0) comunicazioniConConferme += 1;
  }

  const assenze = await listCollection(db, tenantId, 'assenzeOperai');
  const assenzeMalattiaConfermate = assenze.filter(
    (a) => a.tipo === 'malattia' && a.stato === 'confermata'
  ).length;
  const assenzeMalattiaSegnalate = assenze.filter(
    (a) => a.tipo === 'malattia' && a.stato === 'segnalata'
  ).length;
  const lavoriStandbyAssenza = lavori.filter(
    (l) => l.stato === 'in_standby' && l.standbyCausa === 'assenza_personale'
  ).length;

  if (expected.minComunicazioniAttive != null && comunicazioniAttive < expected.minComunicazioniAttive) {
    errors.push(`comunicazioni attive ${comunicazioniAttive}/≥${expected.minComunicazioniAttive}`);
  }
  if (expected.minComunicazioniAttive != null && comunicazioniConDestinatari < expected.minComunicazioniAttive) {
    errors.push(
      `comunicazioni con destinatari ${comunicazioniConDestinatari}/≥${expected.minComunicazioniAttive}`
    );
  }
  if (expected.minConfermePerComunicazione != null || expected.requireConfermeDestinatari) {
    const commsAttive = comunicazioni.filter((c) => c.stato === 'attiva');
    for (const comm of commsAttive) {
      const destIds = normalizeDestinatariIds(comm.destinatari);
      if (!destIds.length) continue;
      const required = expected.requireConfermeDestinatari
        ? destIds.length
        : expected.minConfermePerComunicazione;
      const n = Array.isArray(comm.conferme) ? comm.conferme.length : 0;
      if (required != null && n < required) {
        errors.push(`comunicazione ${comm.id}: conferme ${n}/≥${required}`);
      }
    }
  }

  if (expected.minAssenzeMalattiaConfermate != null && assenzeMalattiaConfermate < expected.minAssenzeMalattiaConfermate) {
    errors.push(
      `assenze malattia confermate ${assenzeMalattiaConfermate}/≥${expected.minAssenzeMalattiaConfermate}`
    );
  }
  if (expected.minLavoriStandbyAssenza != null && lavoriStandbyAssenza < expected.minLavoriStandbyAssenza) {
    errors.push(`lavori standby assenza ${lavoriStandbyAssenza}/≥${expected.minLavoriStandbyAssenza}`);
  }
  if (assenzeMalattiaSegnalate > 0) {
    errors.push(`assenze malattia ancora segnalate: ${assenzeMalattiaSegnalate}`);
  }

  if (expected.squadre != null && squadre.length !== expected.squadre) {
    errors.push(`squadre ${squadre.length}/${expected.squadre}`);
  }
  if (expected.lavoriSquadra != null && lavoriSquadra !== expected.lavoriSquadra) {
    errors.push(`lavori squadra ${lavoriSquadra}/${expected.lavoriSquadra}`);
  }
  if (expected.lavoriAutonomi != null && lavoriAutonomi !== expected.lavoriAutonomi) {
    errors.push(`lavori autonomi ${lavoriAutonomi}/${expected.lavoriAutonomi}`);
  }
  if (oreDaValidare > 0) {
    const expectedPending = expected.oreDaValidarePending ?? expected.minOreDaValidare;
    if (expectedPending != null) {
      if (oreDaValidare !== expectedPending) {
        errors.push(`ore da_validare ${oreDaValidare}/${expectedPending}`);
      }
    } else {
      errors.push(`ore da_validare residue: ${oreDaValidare}`);
    }
  } else if (
    (expected.oreDaValidarePending != null && expected.oreDaValidarePending > 0) ||
    (expected.minOreDaValidare != null && expected.minOreDaValidare > 0)
  ) {
    const need = expected.oreDaValidarePending ?? expected.minOreDaValidare;
    errors.push(`ore da_validare ${oreDaValidare}/≥${need}`);
  }
  if (oreSenzaValidatoDa > 0) {
    errors.push(`ore validate senza validatoDa: ${oreSenzaValidatoDa}`);
  }
  if (expected.minOreOperaioValidateDaCapo != null && oreOperaioValidateDaCapo < expected.minOreOperaioValidateDaCapo) {
    errors.push(
      `ore operaio validate da capo ${oreOperaioValidateDaCapo}/≥${expected.minOreOperaioValidateDaCapo}`
    );
  }
  if (expected.minOreCapoValidateDaManager != null && oreCapoValidateDaManager < expected.minOreCapoValidateDaManager) {
    errors.push(
      `ore capo validate da manager ${oreCapoValidateDaManager}/≥${expected.minOreCapoValidateDaManager}`
    );
  }
  if (expected.minOreAutonomoValidateDaManager != null && oreAutonomoValidateDaManager < expected.minOreAutonomoValidateDaManager) {
    errors.push(
      `ore autonomo validate da manager ${oreAutonomoValidateDaManager}/≥${expected.minOreAutonomoValidateDaManager}`
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    counts: {
      squadre: squadre.length,
      lavori: lavori.length,
      lavoriSquadra,
      lavoriAutonomi,
      oreValidate,
      oreDaValidare,
      oreOperaioValidateDaCapo,
      oreCapoValidateDaManager,
      oreAutonomoValidateDaManager,
      comunicazioni: comunicazioni.length,
      comunicazioniAttive,
      comunicazioniConDestinatari,
      comunicazioniConConferme,
      confermeTotali,
      assenzeMalattiaSegnalate,
      assenzeMalattiaConfermate,
      lavoriStandbyAssenza
    }
  };
}
