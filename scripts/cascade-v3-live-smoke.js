#!/usr/bin/env node
/**
 * Smoke live su dati emulator post sim:run — filtri cascata + semafori dashboard.
 * Uso: node scripts/cascade-v3-live-smoke.js [tenantId]
 */
import { initEmulatorAdmin } from '../simulator/lib/emulator-context.js';
import { isEmulatorAvailable } from '../simulator/lib/emulator-available.js';
import { readManifest } from '../simulator/lib/manifest.js';
import {
  filterTipiLavoroByCategoria,
  filterTipiLavoroVendemmia,
  extractColtureUnicheFromTerreni,
  isCategoriaRaccolta,
  terrenoHaColturaVite,
  getSottocategorieForParent,
} from '../core/js/lavoro-cascade-filters.js';
import { filterAttrezziDropdownCompatibili } from '../core/js/macchine-cv-compat.js';

const tenantId = process.argv[2] || (await readManifest())[0]?.tenantId;

if (!(await isEmulatorAvailable())) {
  console.error('[live-smoke] Emulator non raggiungibile. Avvia: npm run sim:emulators');
  process.exit(1);
}

if (!tenantId) {
  console.error('[live-smoke] Nessun tenant (manifest vuoto). Esegui: npm run sim:run:demo-max');
  process.exit(1);
}

const { db } = initEmulatorAdmin();

async function list(name) {
  const snap = await db.collection(`tenants/${tenantId}/${name}`).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function bench(label, fn, n = 500) {
  const t0 = performance.now();
  let last;
  for (let i = 0; i < n; i++) last = fn();
  const ms = performance.now() - t0;
  console.log(`  ${label}: ${(ms / n).toFixed(4)} ms/op (${n} iter)`);
  return last;
}

const terreni = await list('terreni');
const macchine = await list('macchine');
const tipiLavoro = await list('tipiLavoro');
const categorie = await list('categorie');

function toDate(val) {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  if (val instanceof Date) return val;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

function calcolaUrgenzaData(dataScadenza) {
  const scadenza = toDate(dataScadenza);
  if (!scadenza) return { colore: 'green' };
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  scadenza.setHours(0, 0, 0, 0);
  const giorni = Math.ceil((scadenza - oggi) / (1000 * 60 * 60 * 24));
  if (giorni < 0) return { colore: 'black' };
  if (giorni <= 7) return { colore: 'red' };
  if (giorni <= 30) return { colore: 'yellow' };
  return { colore: 'green' };
}

function calcolaUrgenzaKm(kmAttuali, sogliaKm) {
  const km = kmAttuali != null ? parseFloat(kmAttuali) : 0;
  const soglia = sogliaKm != null ? parseFloat(sogliaKm) : null;
  if (soglia == null || Number.isNaN(soglia)) return { colore: 'green' };
  const rimanenti = soglia - km;
  if (rimanenti <= 0) return { colore: 'black' };
  if (rimanenti < 500) return { colore: 'red' };
  if (rimanenti < 2000) return { colore: 'yellow' };
  return { colore: 'green' };
}

function isTipoFlotta(tipo) {
  return ['automezzo', 'veicolo', 'furgone'].includes(String(tipo || '').toLowerCase());
}

function analizzaSemaforiMacchine(macchine) {
  const colori = new Set();
  let voci = 0;
  for (const m of macchine) {
    if (m.prossimaManutenzione) {
      colori.add(calcolaUrgenzaData(m.prossimaManutenzione).colore);
      voci += 1;
    }
    const tipo = m.tipoMacchina || m.tipo || '';
    if (isTipoFlotta(tipo) && m.kmProssimaManutenzione != null) {
      const km = m.kmAttuali != null ? m.kmAttuali : m.kmIniziali;
      colori.add(calcolaUrgenzaKm(km, m.kmProssimaManutenzione).colore);
      voci += 1;
    } else if (!isTipoFlotta(tipo) && m.oreProssimaManutenzione != null) {
      const ore = m.oreAttuali != null ? parseFloat(m.oreAttuali) : 0;
      const rim = parseFloat(m.oreProssimaManutenzione) - ore;
      if (rim <= 0) colori.add('black');
      else if (rim < 15) colori.add('red');
      else if (rim < 50) colori.add('yellow');
      else colori.add('green');
      voci += 1;
    }
  }
  return { colori: [...colori], voci };
}

function analizzaAffitti(terreni) {
  const colori = new Set();
  let n = 0;
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  for (const t of terreni) {
    if ((t.tipoPossesso || '').toLowerCase() !== 'affitto' || !t.dataScadenzaAffitto) continue;
    n += 1;
    const sc = toDate(t.dataScadenzaAffitto);
    sc.setHours(0, 0, 0, 0);
    const g = Math.ceil((sc - oggi) / (86400000));
    if (g < 0) colori.add('grey');
    else if (g <= 30) colori.add('red');
    else if (g <= 180) colori.add('yellow');
    else colori.add('green');
  }
  return { colori: [...colori], n };
}

const principali = categorie.filter((c) => !c.parentId);
const sottoMap = new Map();
for (const c of categorie) {
  if (c.parentId) {
    if (!sottoMap.has(c.parentId)) sottoMap.set(c.parentId, []);
    sottoMap.get(c.parentId).push(c);
  }
}

const trattori = macchine.filter((m) => (m.tipoMacchina || m.tipo) === 'trattore');
const attrezzi = macchine.filter((m) => (m.tipoMacchina || m.tipo) === 'attrezzo');
const colture = extractColtureUnicheFromTerreni(terreni);

console.log(`\n=== cascade v3 live smoke — ${tenantId} ===\n`);
console.log('Dati:', {
  terreni: terreni.length,
  trattori: trattori.length,
  attrezzi: attrezzi.length,
  tipiLavoro: tipiLavoro.length,
  categoriePrincipali: principali.length,
  coltureUniche: colture.length,
});

const issues = [];

if (colture.length === 0) issues.push('Nessuna coltura sui terreni');
if (trattori.length === 0) issues.push('Nessun trattore');
if (tipiLavoro.length === 0) issues.push('Nessun tipo lavoro');

const catRaccolta = principali.find((c) => /raccolta/i.test(c.nome || ''));
const catLav = principali.find((c) => /lavorazione/i.test(c.nome || ''));

if (catLav) {
  const subs = getSottocategorieForParent(catLav.id, sottoMap);
  if (subs.length === 0) issues.push(`Categoria "${catLav.nome}" senza sottocategorie`);
  bench('filterTipiLavoroByCategoria (lavorazione)', () =>
    filterTipiLavoroByCategoria(catLav.id, tipiLavoro, principali, sottoMap)
  );
}

if (catRaccolta) {
  const terrenoVite = terreni.find((t) => terrenoHaColturaVite(t));
  const tipiRac = filterTipiLavoroByCategoria(catRaccolta.id, tipiLavoro, principali, sottoMap);
  console.log(`  tipi raccolta: ${tipiRac.length}`);
  if (terrenoVite) {
    const vend = filterTipiLavoroVendemmia(tipiRac, {
      isRaccolta: isCategoriaRaccolta(catRaccolta.id, principali, sottoMap),
      isTerrenoVite: true,
    });
    console.log(`  vendemmia (vite): ${vend.length} — ${vend.map((t) => t.nome).slice(0, 4).join(', ')}`);
    if (vend.length === 0 && tipiRac.some((t) => /vendemmia/i.test(t.nome || ''))) {
      issues.push('Filtro vendemmia ha escluso tutti i tipi pur avendo vendemmia in DB');
    }
  }
}

for (const tr of trattori.slice(0, 3)) {
  const compat = filterAttrezziDropdownCompatibili(tr, attrezzi);
  console.log(`  CV ${tr.cavalli || '?'} (${tr.nome}): ${compat.length}/${attrezzi.length} attrezzi`);
  if (compat.length === 0 && attrezzi.filter((a) => a.stato !== 'dismesso').length > 0) {
    issues.push(`Trattore "${tr.nome}" — zero attrezzi compatibili`);
  }
}

bench('filterAttrezziDropdownCompatibili', () =>
  filterAttrezziDropdownCompatibili(trattori[0], attrezzi)
);

const t0dash = performance.now();
const semMacchine = analizzaSemaforiMacchine(macchine);
const semAffitti = analizzaAffitti(terreni);
const dashMs = performance.now() - t0dash;

console.log('\nSemafori (da dati emulator):');
console.log(`  analisi: ${dashMs.toFixed(2)} ms`);
console.log(`  macchine: ${semMacchine.voci} voci, colori [${semMacchine.colori.join(', ')}]`);
console.log(`  affitti: ${semAffitti.n} terreni, colori [${semAffitti.colori.join(', ') || '—'}]`);

if (semMacchine.voci === 0) issues.push('Nessuna scadenza/manutenzione su macchine');
if (!semMacchine.colori.some((c) => ['black', 'red', 'yellow'].includes(c))) {
  issues.push('Macchine: nessun semaforo urgente (black/red/yellow) — verifica seed scadenze');
}
if (semAffitti.n > 0 && semAffitti.colori.length === 0) {
  issues.push('Affitti presenti ma colori semaforo non calcolati');
}

const macchineConDate = macchine.filter((m) => m.prossimaManutenzione || m.prossimaRevisione);
let urgenzeOk = 0;
for (const m of macchineConDate.slice(0, 5)) {
  if (m.prossimaManutenzione) {
    const u = calcolaUrgenzaData(m.prossimaManutenzione);
    if (u.colore) urgenzeOk += 1;
  }
}
if (macchineConDate.length > 0 && urgenzeOk === 0) issues.push('calcolaUrgenzaData non produce colori su macchine campione');

console.log('\n---');
if (issues.length === 0) {
  console.log('[live-smoke] OK — nessun problema rilevato');
  process.exit(0);
} else {
  console.log('[live-smoke] WARN/ISSUES:');
  issues.forEach((i) => console.log(`  - ${i}`));
  process.exit(issues.some((i) => i.startsWith('Nessun')) ? 1 : 0);
}
