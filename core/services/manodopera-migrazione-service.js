/**
 * Migrazione dati Manodopera sul tenant corrente.
 * Non usa createLavoro: quel percorso obbliga un assegnatario.
 * Non cancella attività, lavori, operai o squadre.
 * Una seconda esecuzione non duplica: il collegamento è lavoroId / migratoDaAttivitaId.
 *
 * @module core/services/manodopera-migrazione-service
 */

import {
  costruisciAttivitaDaLavoro,
  costruisciLavoroDaAttivita,
  contaLavoriAperti,
  direzioneManodopera,
  messaggioLavoriAperti,
  serveSpinnerMigrazione
} from './manodopera-migrazione-logic.js';

export {
  messaggioLavoriAperti,
  contaLavoriAperti,
  direzioneManodopera,
  serveSpinnerMigrazione
} from './manodopera-migrazione-logic.js';

/**
 * @param {string} tenantId
 * @param {object} [options]
 * @param {object} [options.io]
 * @returns {Promise<object>}
 */
export async function migraAttivitaVersoLavori(tenantId, options = {}) {
  const io = options.io || await createDefaultIo();
  assertTenant(io, tenantId);
  const adesso = options.adesso || new Date().toISOString();
  const oggi = options.oggi;
  const attivita = await io.list('attivita', tenantId);
  const lavori = await io.list('lavori', tenantId);
  const report = reportVuoto(attivita.length);
  avvisaPrimaDelleScritture(options, report.documenti, 'attivazione');

  const lavoriById = new Map(lavori.map((row) => [row.id, row]));
  const lavoriBySorgente = new Map();
  lavori.forEach((row) => {
    if (row && row.migratoDaAttivitaId) lavoriBySorgente.set(row.migratoDaAttivitaId, row);
  });

  for (let i = 0; i < attivita.length; i += 1) {
    const row = attivita[i];
    if (!row || !row.id) continue;
    if (row.lavoroId && lavoriById.has(row.lavoroId)) {
      report.skipped += 1;
      continue;
    }
    const giaCreato = lavoriBySorgente.get(row.id);
    if (giaCreato) {
      try {
        if (row.lavoroId !== giaCreato.id) {
          await io.update('attivita', row.id, {
            lavoroId: giaCreato.id,
            migratoALavoroIl: row.migratoALavoroIl || adesso
          }, tenantId);
        }
        report.skipped += 1;
      } catch (err) {
        report.errori += 1;
      }
      continue;
    }
    if (row.migrazioneSolaLettura === true) {
      report.solaLettura += 1;
      continue;
    }
    const piano = costruisciLavoroDaAttivita(row, { oggi, adesso });
    if (piano.solaLettura) {
      try {
        await io.update('attivita', row.id, {
          migrazioneSolaLettura: true,
          migrazioneSolaLetturaMotivo: piano.motivo,
          migratoIl: adesso
        }, tenantId);
        report.solaLettura += 1;
        if (piano.motivo) report.motivi.push(piano.motivo);
      } catch (err) {
        report.errori += 1;
      }
      continue;
    }
    try {
      const lavoroId = await io.create('lavori', dataInizioComeDate(piano.lavoro), tenantId);
      await io.update('attivita', row.id, {
        lavoroId,
        migratoALavoroIl: adesso
      }, tenantId);
      report.creati += 1;
      lavoriById.set(lavoroId, { id: lavoroId });
      lavoriBySorgente.set(row.id, { id: lavoroId, migratoDaAttivitaId: row.id });
    } catch (err) {
      report.errori += 1;
    }
  }
  return report;
}

/**
 * @param {string} tenantId
 * @param {object} [options]
 * @returns {Promise<object>}
 */
export async function migraLavoriVersoAttivita(tenantId, options = {}) {
  const io = options.io || await createDefaultIo();
  assertTenant(io, tenantId);
  const adesso = options.adesso || new Date().toISOString();
  const lavori = await io.list('lavori', tenantId);
  const attivita = await io.list('attivita', tenantId);
  const terreni = await io.list('terreni', tenantId);
  const report = reportVuoto(lavori.length);
  avvisaPrimaDelleScritture(options, report.documenti, 'disattivazione');

  const terreniById = new Map((terreni || []).map((row) => [row.id, row]));
  const attivitaByLavoro = new Map();
  attivita.forEach((row) => {
    if (!row) return;
    if (row.lavoroId && !attivitaByLavoro.has(row.lavoroId)) attivitaByLavoro.set(row.lavoroId, row);
    if (row.migratoDaLavoroId && !attivitaByLavoro.has(row.migratoDaLavoroId)) {
      attivitaByLavoro.set(row.migratoDaLavoroId, row);
    }
  });

  for (let i = 0; i < lavori.length; i += 1) {
    const row = lavori[i];
    if (!row || !row.id) continue;
    const collegata = attivitaByLavoro.get(row.id);
    if (collegata) {
      report.skipped += 1;
      continue;
    }
    if (row.migrazioneSolaLettura === true) {
      report.solaLettura += 1;
      continue;
    }
    const piano = costruisciAttivitaDaLavoro(row, {
      terreno: terreniById.get(row.terrenoId) || null,
      adesso
    });
    if (piano.solaLettura) {
      try {
        await io.update('lavori', row.id, {
          migrazioneSolaLettura: true,
          migrazioneSolaLetturaMotivo: piano.motivo,
          migratoIl: adesso
        }, tenantId);
        report.solaLettura += 1;
        if (piano.motivo) report.motivi.push(piano.motivo);
      } catch (err) {
        report.errori += 1;
      }
      continue;
    }
    try {
      const attivitaId = await io.create('attivita', piano.attivita, tenantId);
      attivitaByLavoro.set(row.id, { id: attivitaId, lavoroId: row.id });
      report.creati += 1;
    } catch (err) {
      report.errori += 1;
    }
  }
  return report;
}

/**
 * @param {string} tenantId
 * @param {object} [options]
 * @returns {Promise<number>}
 */
export async function contaLavoriApertiTenant(tenantId, options = {}) {
  const io = options.io || await createDefaultIo();
  assertTenant(io, tenantId);
  const lavori = await io.list('lavori', tenantId);
  return contaLavoriAperti(lavori);
}

/**
 * @param {string} tenantId
 * @param {object} [options]
 * @returns {Promise<Array<object>>}
 */
export async function elencoAttivitaSolaLettura(tenantId, options = {}) {
  const io = options.io || await createDefaultIo();
  assertTenant(io, tenantId);
  const rows = await io.list('attivita', tenantId);
  return rows.filter((row) => row && row.migrazioneSolaLettura === true);
}

/**
 * Allinea i dati allo stato effettivo di Manodopera.
 * Se manca l'osservazione precedente e non viene passata, registra solo la baseline
 * (i tenant che hanno già il modulo non vengono rimigrati).
 * In disattivazione, con lavori aperti, non scrive finché confermaLavoriAperti non è true.
 *
 * @param {string} tenantId
 * @param {boolean} manodoperaAttiva
 * @param {object} [options]
 * @param {boolean} [options.previousEffective]
 * @param {boolean} [options.confermaLavoriAperti]
 * @returns {Promise<object>}
 */
export async function allineaDatiManodopera(tenantId, manodoperaAttiva, options = {}) {
  const io = options.io || await createDefaultIo();
  assertTenant(io, tenantId);
  const attivo = !!manodoperaAttiva;
  let previous = options.previousEffective;
  if (typeof previous !== 'boolean') {
    const tenant = await io.getTenant(tenantId);
    if (tenant && typeof tenant.manodoperaModuloOsservato === 'boolean') {
      previous = tenant.manodoperaModuloOsservato;
    } else {
      await io.updateTenant(tenantId, { manodoperaModuloOsservato: attivo });
      return { baseline: true, manodoperaAttiva: attivo };
    }
  }
  const direzione = direzioneManodopera(previous, attivo);
  if (!direzione) {
    const tenant = await io.getTenant(tenantId);
    if (tenant && tenant.manodoperaModuloOsservato !== attivo) {
      await io.updateTenant(tenantId, { manodoperaModuloOsservato: attivo });
    }
    return { unchanged: true, manodoperaAttiva: attivo };
  }
  if (direzione === 'disattivazione') {
    const lavori = await io.list('lavori', tenantId);
    const aperti = contaLavoriAperti(lavori);
    if (aperti > 0 && options.confermaLavoriAperti !== true) {
      return {
        needsConfirm: true,
        lavoriAperti: aperti,
        messaggio: messaggioLavoriAperti(aperti),
        direzione
      };
    }
    const report = await migraLavoriVersoAttivita(tenantId, { ...options, io });
    if ((report.errori || 0) === 0) {
      await io.updateTenant(tenantId, { manodoperaModuloOsservato: false });
    }
    return { ...report, direzione };
  }
  const report = await migraAttivitaVersoLavori(tenantId, { ...options, io });
  if ((report.errori || 0) === 0) {
    await io.updateTenant(tenantId, { manodoperaModuloOsservato: true });
  }
  return { ...report, direzione };
}

function reportVuoto(documenti) {
  return { creati: 0, skipped: 0, solaLettura: 0, errori: 0, documenti: documenti || 0, motivi: [] };
}

function avvisaPrimaDelleScritture(options, documenti, direzione) {
  if (typeof options.onBeforeWrite === 'function') {
    options.onBeforeWrite({ documenti, direzione, spinner: serveSpinnerMigrazione(documenti) });
  }
}

function assertTenant(io, tenantId) {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('Migrazione consentita solo per il tenant corrente');
  }
  if (typeof io.currentTenantId === 'function') {
    const current = io.currentTenantId();
    if (!current || current !== tenantId) {
      throw new Error('Migrazione consentita solo per il tenant corrente');
    }
  }
}

function dataInizioComeDate(lavoro) {
  const copia = { ...lavoro };
  if (typeof copia.dataInizio === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(copia.dataInizio)) {
    const parti = copia.dataInizio.split('-').map(Number);
    copia.dataInizio = new Date(parti[0], parti[1] - 1, parti[2], 12, 0, 0, 0);
  }
  return copia;
}

async function createDefaultIo() {
  const fb = await import('./firebase-service.js');
  const tenantService = await import('./tenant-service.js');
  return {
    currentTenantId: () => tenantService.getCurrentTenantId(),
    getTenant: (tenantId) => fb.getDocumentData('tenants', tenantId),
    updateTenant: (tenantId, patch) => tenantService.updateTenant(tenantId, patch),
    list: (collectionName, tenantId) => fb.getCollectionData(collectionName, { tenantId }),
    create: (collectionName, data, tenantId) => fb.createDocument(collectionName, data, tenantId),
    update: (collectionName, documentId, data, tenantId) => fb.updateDocument(
      collectionName,
      documentId,
      data,
      tenantId
    )
  };
}
