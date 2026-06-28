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
import { validateAffittiSemaforoSeed } from './seed-terreni-affitti.js';

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

function toDate(val) {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  if (val instanceof Date) return val;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

function urgenzaDataColore(dataScadenza) {
  const scadenza = toDate(dataScadenza);
  if (!scadenza) return null;
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  scadenza.setHours(0, 0, 0, 0);
  const giorni = Math.ceil((scadenza - oggi) / (1000 * 60 * 60 * 24));
  if (giorni < 0) return 'black';
  if (giorni <= 7) return 'red';
  if (giorni <= 30) return 'yellow';
  return 'green';
}

function urgenzaKmColore(kmAttuali, sogliaKm) {
  const km = kmAttuali != null ? parseFloat(kmAttuali) : 0;
  const soglia = sogliaKm != null ? parseFloat(sogliaKm) : null;
  if (soglia == null || Number.isNaN(soglia)) return null;
  const rim = soglia - km;
  if (rim <= 0) return 'black';
  if (rim < 500) return 'red';
  if (rim < 2000) return 'yellow';
  return 'green';
}

function urgenzaOreColore(oreAttuali, sogliaOre) {
  const ore = oreAttuali != null ? parseFloat(oreAttuali) : 0;
  const soglia = sogliaOre != null ? parseFloat(sogliaOre) : null;
  if (soglia == null || Number.isNaN(soglia)) return null;
  const rim = soglia - ore;
  if (rim <= 0) return 'black';
  if (rim < 15) return 'red';
  if (rim < 50) return 'yellow';
  return 'green';
}

/**
 * Verifica bucket semaforo macchine (km, ore, date) — allineato widget dashboard.
 * @param {Array<object>} macchine
 */
export function validateMacchineSemaforoSeed(macchine) {
  const errors = [];
  const kmColori = new Set();
  const oreColori = new Set();
  const dataColori = new Set();

  for (const m of macchine) {
    const tipo = (m.tipoMacchina || m.tipo || '').toLowerCase();
    if (m.prossimaManutenzione) dataColori.add(urgenzaDataColore(m.prossimaManutenzione));
    if (m.prossimaRevisione) dataColori.add(urgenzaDataColore(m.prossimaRevisione));
    if (m.prossimaAssicurazione) dataColori.add(urgenzaDataColore(m.prossimaAssicurazione));

    if (isTipoFlotta(m) && m.kmProssimaManutenzione != null) {
      const km = m.kmAttuali != null ? m.kmAttuali : m.kmIniziali;
      const c = urgenzaKmColore(km, m.kmProssimaManutenzione);
      if (c) kmColori.add(c);
    } else if (!isTipoFlotta(m) && m.oreProssimaManutenzione != null) {
      const c = urgenzaOreColore(m.oreAttuali, m.oreProssimaManutenzione);
      if (c) oreColori.add(c);
    }
  }

  const attesi = ['black', 'red', 'yellow', 'green'];
  for (const c of attesi) {
    if (!kmColori.has(c)) {
      errors.push(`macchine km: manca bucket "${c}" (presenti: ${[...kmColori].join(', ') || '—'})`);
    }
    if (!oreColori.has(c)) {
      errors.push(`macchine ore: manca bucket "${c}" (presenti: ${[...oreColori].join(', ') || '—'})`);
    }
  }
  if (!dataColori.has('black') && !dataColori.has('red')) {
    errors.push('macchine date: atteso almeno un semaforo black o red su manutenzione/revisione/assicurazione');
  }

  return {
    kmColori: [...kmColori],
    oreColori: [...oreColori],
    dataColori: [...dataColori],
    errors
  };
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
  const guasti = await listCollection(db, tenantId, 'guasti');
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

  const terreniAzienda = terreni.filter((t) => !t.clienteId);
  const affittiCheck = validateAffittiSemaforoSeed(terreniAzienda);
  errors.push(...affittiCheck.errors);

  const semMacchine = validateMacchineSemaforoSeed(macchine);
  errors.push(...semMacchine.errors);

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
      guasti: guasti.length,
      guastiAperti: guasti.filter((g) => {
        const s = (g.stato || '').toLowerCase();
        return s !== 'risolto' && s !== 'riparato' && s !== 'chiuso';
      }).length,
      potatureVigneto,
      trattamentiVigneto,
      prodottiSottoScorta: prodotti.filter((p) => {
        const min = p.scortaMinima ?? 0;
        const g = p.giacenza ?? 0;
        return min > 0 && g < min;
      }).length,
      affitti: affittiCheck.affitti,
      affittiColori: affittiCheck.colori,
      semaforiKm: semMacchine.kmColori,
      semaforiOre: semMacchine.oreColori
    },
    errors
  };
}

export { EXPECTED_COLTURA };
