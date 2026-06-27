/**
 * Ispezione qualità seed terreni su emulator.
 * @module simulator/lib/tenant-inspect
 */

import {
  COLTURE_PREDEFINITE,
  SOTTOCATEGORIE_PREDEFINITE,
  TIPI_LAVORO_PREDEFINITI,
  SIM_ALIASES_TIPI_LAVORO,
} from '../../core/config/app-catalog-seed-data.js';

const EXPECTED_COLTURA = 'Vite da Vino';
const MIN_SOTTOCATEGORIE = SOTTOCATEGORIE_PREDEFINITE.length;
const MIN_TIPI_LAVORO = new Set(
  [...TIPI_LAVORO_PREDEFINITI, ...SIM_ALIASES_TIPI_LAVORO].map((t) => String(t.nome).toLowerCase())
).size;
const MIN_COLTURE = COLTURE_PREDEFINITE.length;

const TIPI_FLOTTA = new Set(['automezzo', 'veicolo', 'furgone']);

function isTipoFlotta(m) {
  return TIPI_FLOTTA.has((m.tipoMacchina || m.tipo || '').toLowerCase());
}

/**
 * Seed flotta: contatore e tagliando in km (no ore agricole).
 * @param {Array<object>} flotta
 */
export function validateFlottaKmSeed(flotta) {
  const errors = [];
  let kmOk = 0;
  let tagliandoSuperato = 0;

  for (const m of flotta) {
    const label = m.nome || m.id || 'flotta';
    const kmAttuali = m.kmAttuali;
    const kmPross = m.kmProssimaManutenzione;

    if (typeof kmAttuali !== 'number' || kmAttuali <= 0) {
      errors.push(`flotta "${label}": kmAttuali mancante o non valido`);
      continue;
    }
    if (typeof kmPross !== 'number' || kmPross <= 0) {
      errors.push(`flotta "${label}": kmProssimaManutenzione mancante o non valido`);
      continue;
    }
    if (m.oreAttuali != null && m.oreAttuali !== 0) {
      errors.push(`flotta "${label}": oreAttuali presente (atteso solo km)`);
      continue;
    }
    if (m.oreProssimaManutenzione != null && m.oreProssimaManutenzione !== 0) {
      errors.push(`flotta "${label}": oreProssimaManutenzione presente (atteso tagliando km)`);
      continue;
    }

    kmOk += 1;
    if (kmAttuali >= kmPross) tagliandoSuperato += 1;
  }

  return { kmOk, tagliandoSuperato, errors };
}

async function listCollection(db, tenantId, name) {
  const snap = await db.collection(`tenants/${tenantId}/${name}`).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function countVignetoSubcollections(db, tenantId, subName) {
  const vigneti = await listCollection(db, tenantId, 'vigneti');
  let total = 0;
  for (const v of vigneti) {
    const snap = await db.collection(`tenants/${tenantId}/vigneti/${v.id}/${subName}`).get();
    total += snap.size;
  }
  return total;
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @returns {Promise<{ ok: boolean, tenantId: string, terreni: Array, poderi: Array, counts: object, errors: string[] }>}
 */
export async function inspectTenantSeed(db, tenantId) {
  const errors = [];
  const terreni = await listCollection(db, tenantId, 'terreni');
  const poderi = await listCollection(db, tenantId, 'poderi');
  const colture = await listCollection(db, tenantId, 'colture');
  const categorie = await listCollection(db, tenantId, 'categorie');
  const tipiLavoro = await listCollection(db, tenantId, 'tipiLavoro');
  const attivita = await listCollection(db, tenantId, 'attivita');
  const macchine = await listCollection(db, tenantId, 'macchine');
  const vigneti = await listCollection(db, tenantId, 'vigneti');
  const prodotti = await listCollection(db, tenantId, 'prodotti');
  const movimenti = await listCollection(db, tenantId, 'movimentiMagazzino');
  const potatureVigneto = await countVignetoSubcollections(db, tenantId, 'potature');
  const trattamentiVigneto = await countVignetoSubcollections(db, tenantId, 'trattamenti');

  if (poderi.length < 1) errors.push('manca almeno un podere');
  if (colture.length < MIN_COLTURE) {
    errors.push(`catalogo colture incompleto (${colture.length}/${MIN_COLTURE})`);
  }

  const sottocategorie = categorie.filter((c) => c.parentId);
  if (sottocategorie.length < MIN_SOTTOCATEGORIE) {
    errors.push(`sottocategorie lavori incomplete (${sottocategorie.length}/${MIN_SOTTOCATEGORIE})`);
  }
  if (tipiLavoro.length < MIN_TIPI_LAVORO) {
    errors.push(`tipi lavoro incompleti (${tipiLavoro.length}/${MIN_TIPI_LAVORO})`);
  }

  const flotta = macchine.filter(isTipoFlotta);
  const flottaKm = validateFlottaKmSeed(flotta);
  errors.push(...flottaKm.errors);

  const macchineConScadenze = macchine.filter(
    (m) =>
      m.prossimaManutenzione ||
      m.prossimaAssicurazione ||
      m.prossimaRevisione ||
      (isTipoFlotta(m) && m.kmProssimaManutenzione)
  );
  if (flotta.length < 1) errors.push('manca flotta aziendale (furgone/pickup)');
  if (macchineConScadenze.length < 3) {
    errors.push(`poche scadenze macchine seed (${macchineConScadenze.length})`);
  }
  if (flotta.length >= 1 && flottaKm.tagliandoSuperato < 1) {
    errors.push('flotta: atteso almeno 1 mezzo con tagliando km superato (demo scadenze)');
  }

  for (const t of terreni) {
    if (t.coltura !== EXPECTED_COLTURA) {
      errors.push(`terreno "${t.nome}": coltura "${t.coltura}" != "${EXPECTED_COLTURA}"`);
    }
    if (!t.podere) errors.push(`terreno "${t.nome}": podere mancante`);
    if (!t.tipoCampo) errors.push(`terreno "${t.nome}": tipoCampo mancante`);
    if (!Array.isArray(t.polygonCoords) || t.polygonCoords.length < 3) {
      errors.push(`terreno "${t.nome}": polygonCoords mancante o incompleto`);
    }
  }

  return {
    ok: errors.length === 0 && terreni.length > 0,
    tenantId,
    terreni,
    poderi,
    counts: {
      terreni: terreni.length,
      poderi: poderi.length,
      colture: colture.length,
      sottocategorie: sottocategorie.length,
      tipiLavoro: tipiLavoro.length,
      categorieColture: categorie.filter((c) => c.applicabileA === 'colture').length,
      attivita: attivita.length,
      macchine: macchine.length,
      flotta: flotta.length,
      flottaKmOk: flottaKm.kmOk,
      flottaTagliandoSuperato: flottaKm.tagliandoSuperato,
      macchineConScadenze: macchineConScadenze.length,
      inManutenzione: macchine.filter((m) => m.stato === 'in_manutenzione').length,
      vigneti: vigneti.length,
      prodotti: prodotti.length,
      movimentiMagazzino: movimenti.length,
      potatureVigneto,
      trattamentiVigneto,
      prodottiSottoScorta: prodotti.filter((p) => {
        const min = p.scortaMinima ?? 0;
        const g = p.giacenza ?? 0;
        return min > 0 && g < min;
      }).length
    },
    errors
  };
}

export { EXPECTED_COLTURA };
