/**
 * Economia vigneto simulatore — allineata a calcolo-compensi-service + aggregaSpeseVignetoAnno.
 * @module simulator/lib/sim-economia-vigneto
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { TIPO_LAVORO_CATEGORIA_CODICE } from './seed-lavori-catalog.js';
import { prezzoUnitarioPerScarico } from './link-scarichi-trattamento-vigneto.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const TARIFFA_PROPRIETARIO_DEFAULT = 15;

export function getSimEconomiaConfig() {
  try {
    const defaults = JSON.parse(
      readFileSync(join(__dirname, '../config/defaults.json'), 'utf-8')
    );
    return {
      tariffaProprietarioOraria: defaults.economia?.tariffaProprietarioOraria ?? TARIFFA_PROPRIETARIO_DEFAULT,
      costoOraTrattore: defaults.economia?.costoOraTrattore ?? 35,
      costoOraAttrezzo: defaults.economia?.costoOraAttrezzo ?? 12
    };
  } catch {
    return {
      tariffaProprietarioOraria: TARIFFA_PROPRIETARIO_DEFAULT,
      costoOraTrattore: 35,
      costoOraAttrezzo: 12
    };
  }
}

export function tsToDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  if (typeof v === 'string') return new Date(v);
  return null;
}

export function tenantHasModule(tenant, moduleId) {
  const mods = tenant?.modules || tenant?.moduli || [];
  return Array.isArray(mods) && mods.includes(moduleId);
}

export async function getTariffaProprietario(db, tenantId) {
  const snap = await db.doc(`tenants/${tenantId}/tariffe/proprietario`).get();
  if (!snap.exists) return getSimEconomiaConfig().tariffaProprietarioOraria;
  const data = snap.data();
  const t = data.tariffaOraria ?? data.tariffa;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : getSimEconomiaConfig().tariffaProprietarioOraria;
}

/**
 * Seed tariffa proprietario + costoOra macchine (idempotente).
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 */
export async function ensureTenantEconomia(db, tenantId) {
  const cfg = getSimEconomiaConfig();
  const tariffeRef = db.doc(`tenants/${tenantId}/tariffe/proprietario`);
  const tariffeSnap = await tariffeRef.get();
  if (!tariffeSnap.exists) {
    await tariffeRef.set({
      tariffaOraria: cfg.tariffaProprietarioOraria,
      updatedAt: new Date()
    });
  }

  const macSnap = await db.collection(`tenants/${tenantId}/macchine`).get();
  let macchineAggiornate = 0;
  for (const doc of macSnap.docs) {
    const d = doc.data();
    if (d.costoOra != null && d.costoOra !== '') continue;
    const tipo = (d.tipoMacchina || '').toLowerCase();
    const costoOra = tipo === 'attrezzo' ? cfg.costoOraAttrezzo : cfg.costoOraTrattore;
    await doc.ref.update({ costoOra, updatedAt: new Date() });
    macchineAggiornate += 1;
  }

  return { macchineAggiornate, tariffaProprietarioOraria: cfg.tariffaProprietarioOraria };
}

/**
 * Costo prodotto da movimento + anagrafica (come app / link-scarichi).
 */
export function calcCostoProdottoDaMovimento(mov, prodotto, quantita = null) {
  const q = quantita ?? mov?.quantita ?? 0;
  const qn = parseFloat(q);
  if (!Number.isFinite(qn) || qn <= 0) return 0;

  const prezzoMov = mov?.prezzoUnitario != null ? parseFloat(mov.prezzoUnitario) : NaN;
  if (Number.isFinite(prezzoMov) && prezzoMov >= 0) {
    return parseFloat((qn * prezzoMov).toFixed(2));
  }

  const prezzoProd = prodotto?.prezzoUnitario != null ? parseFloat(prodotto.prezzoUnitario) : NaN;
  if (Number.isFinite(prezzoProd) && prezzoProd >= 0) {
    return parseFloat((qn * prezzoProd).toFixed(2));
  }

  return 0;
}

/**
 * Manodopera + macchina da attività diario (allineato a potatura-vigneto / trattamenti-vigneto).
 * @param {object} att
 * @param {{ tariffaProprietario: number, parcoMacchine: boolean, macchine: Map<string, object> }} ctx
 * @param {{ sommaTrattoreEAttrezzo?: boolean }} [options] — trattamenti: true; potatura: false
 */
export function calcCostiManodoperaMacchinaAttivita(att, ctx, options = {}) {
  const { sommaTrattoreEAttrezzo = false } = options;
  const oreNette = att.oreNette || 0;
  const costoManodopera =
    oreNette > 0 ? parseFloat((oreNette * ctx.tariffaProprietario).toFixed(2)) : 0;

  let costoMacchina = 0;
  const oreMacchina = att.oreMacchina ?? att.oreNette ?? 0;

  if (ctx.parcoMacchine && oreMacchina > 0) {
    if (sommaTrattoreEAttrezzo) {
      for (const mid of [att.macchinaId, att.attrezzoId].filter(Boolean)) {
        const mac = ctx.macchine.get(mid);
        const co = mac?.costoOra != null ? parseFloat(mac.costoOra) : NaN;
        if (Number.isFinite(co)) costoMacchina += oreMacchina * co;
      }
    } else {
      const mid = att.macchinaId || att.attrezzoId;
      const mac = mid ? ctx.macchine.get(mid) : null;
      const co = mac?.costoOra != null ? parseFloat(mac.costoOra) : NaN;
      if (Number.isFinite(co)) costoMacchina = oreMacchina * co;
    }
  }

  return {
    costoManodopera,
    costoMacchina: parseFloat(costoMacchina.toFixed(2)),
    costoTotale: parseFloat((costoManodopera + costoMacchina).toFixed(2))
  };
}

function categoriaCodiceFromTipoLavoro(tipoLavoro) {
  if (TIPO_LAVORO_CATEGORIA_CODICE[tipoLavoro]) {
    return TIPO_LAVORO_CATEGORIA_CODICE[tipoLavoro];
  }
  const n = String(tipoLavoro || '').toLowerCase();
  if (n.includes('potatura') || n.includes('spollonatura')) return 'potatura';
  if (n.includes('concimazione')) return 'concimazione';
  if (n.includes('trattamento') || n.includes('fitosanitario')) return 'trattamenti';
  if (n.includes('erpicatura') || n.includes('lavorazione')) return 'lavorazione_terreno';
  return 'altro';
}

function chiaveManodoperaCategoria(categoriaCodice) {
  const camel = categoriaCodice
    .split('_')
    .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
  return `manodopera${camel.charAt(0).toUpperCase()}${camel.slice(1)}`;
}

function isAttivitaDirettaValida(att, anno) {
  if (att.lavoroId && att.lavoroId !== '') return false;
  if (att.clienteId && att.clienteId !== '') return false;
  if (!att.data || !att.tipoLavoro) return false;
  if (parseInt(String(att.data).slice(0, 4), 10) !== anno) return false;
  return true;
}

function dateOnlyStr(v) {
  const d = tsToDate(v);
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function lavoroDuplicatoAttivita(lavori, attivitaData, attivitaTipo) {
  return lavori.some((l) => {
    const ld = dateOnlyStr(l.dataInizio);
    return ld === attivitaData && l.tipoLavoro === attivitaTipo;
  });
}

function sumProdottiTrattamento(t) {
  if (t.prodotti?.length) {
    return t.prodotti.reduce((s, r) => s + (Number(r.costo) || 0), 0);
  }
  return Number(t.costoProdotto) || 0;
}

/**
 * Replica aggregaSpeseVignetoAnno + mapping legacy aggiornaSpeseVignetoDaLavori.
 */
export function computeSpeseVignetoAggregated(ctx, vigneto, anno) {
  const spese = {
    speseManodoperaAnno: 0,
    speseMacchineAnno: 0,
    speseProdottiAnno: 0,
    speseCantinaAnno: vigneto.speseCantinaAnno || 0,
    speseAltroAnno: vigneto.speseAltroAnno || 0,
    attivitaContate: 0,
    attivitaEscluse: 0
  };

  const lavoriAnno = ctx.lavori.filter((l) => {
    if (l.terrenoId !== vigneto.terrenoId || l.stato !== 'completato') return false;
    const d = tsToDate(l.dataInizio);
    return d && d.getFullYear() === anno;
  });

  let dataPrimoLavoro = null;
  if (lavoriAnno.length > 0) {
    const ms = lavoriAnno
      .map((l) => tsToDate(l.dataInizio))
      .filter((d) => d && !Number.isNaN(d.getTime()))
      .map((d) => d.getTime());
    if (ms.length) dataPrimoLavoro = new Date(Math.min(...ms));
  }
  const dataLimite = dataPrimoLavoro ? dataPrimoLavoro.toISOString().slice(0, 10) : `${anno}-12-31`;

  for (const l of lavoriAnno) {
    const costi = l.costi || {};
    const cm = Number(costi.costoManodopera) || 0;
    spese.speseManodoperaAnno += cm;
    spese.speseMacchineAnno += Number(costi.costoMacchine) || 0;
    const cat = categoriaCodiceFromTipoLavoro(l.tipoLavoro);
    const key = chiaveManodoperaCategoria(cat);
    spese[key] = (spese[key] || 0) + cm;
  }

  const macchineMap = {};
  for (const att of ctx.attivita) {
    if (att.terrenoId !== vigneto.terrenoId) continue;
    if (!isAttivitaDirettaValida(att, anno)) {
      spese.attivitaEscluse += 1;
      continue;
    }
    if (dataPrimoLavoro && att.data >= dataLimite) {
      if (lavoroDuplicatoAttivita(lavoriAnno, att.data, att.tipoLavoro)) {
        spese.attivitaEscluse += 1;
        continue;
      }
    }

    const oreNette = att.oreNette || 0;
    if (oreNette > 0) {
      const cm = oreNette * ctx.tariffaProprietario;
      spese.speseManodoperaAnno += cm;
      spese.attivitaContate += 1;
      const key = chiaveManodoperaCategoria(categoriaCodiceFromTipoLavoro(att.tipoLavoro));
      spese[key] = (spese[key] || 0) + cm;
    }

    const oreMacchina = att.oreMacchina || 0;
    if (ctx.parcoMacchine && oreMacchina > 0) {
      for (const mid of [att.macchinaId, att.attrezzoId].filter(Boolean)) {
        if (!macchineMap[mid]) macchineMap[mid] = 0;
        macchineMap[mid] += oreMacchina;
      }
    }
  }

  if (ctx.parcoMacchine) {
    for (const [macchinaId, oreTotali] of Object.entries(macchineMap)) {
      const mac = ctx.macchine.get(macchinaId);
      const costoOra = mac?.costoOra != null ? parseFloat(mac.costoOra) : NaN;
      if (Number.isFinite(costoOra)) {
        spese.speseMacchineAnno += oreTotali * costoOra;
      }
    }
  }

  for (const t of ctx.trattamenti.filter((x) => x._vignetoId === vigneto.id)) {
    const dt = tsToDate(t.data);
    if (!dt || dt.getFullYear() !== anno) continue;
    spese.speseProdottiAnno += sumProdottiTrattamento(t);
  }

  spese.costoTotaleAnno =
    spese.speseManodoperaAnno +
    spese.speseMacchineAnno +
    spese.speseProdottiAnno +
    spese.speseCantinaAnno +
    spese.speseAltroAnno;

  Object.keys(spese).forEach((k) => {
    if (typeof spese[k] === 'number') spese[k] = parseFloat(spese[k].toFixed(2));
  });

  return spese;
}

/**
 * Patch documenti vigneto con campi aggregati (come aggiornaSpeseVignetoDaLavori).
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @param {{ anno?: number }} [options]
 */
export async function syncSpeseVignetoTenant(db, tenantId, options = {}) {
  const anno = options.anno ?? new Date().getFullYear();
  const tenantSnap = await db.doc(`tenants/${tenantId}`).get();
  if (!tenantSnap.exists) throw new Error(`Tenant ${tenantId} non trovato`);
  const tenant = tenantSnap.data();
  const parcoMacchine = tenantHasModule(tenant, 'parcoMacchine');

  const [vignetiSnap, attivitaSnap, lavoriSnap, macchineSnap] = await Promise.all([
    db.collection(`tenants/${tenantId}/vigneti`).get(),
    db.collection(`tenants/${tenantId}/attivita`).get(),
    db.collection(`tenants/${tenantId}/lavori`).get(),
    db.collection(`tenants/${tenantId}/macchine`).get()
  ]);

  const vigneti = vignetiSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
  const attivita = attivitaSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lavori = lavoriSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const macchine = new Map(macchineSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
  const tariffaProprietario = await getTariffaProprietario(db, tenantId);

  const trattamenti = [];
  for (const v of vigneti) {
    const trtSnap = await db.collection(`tenants/${tenantId}/vigneti/${v.id}/trattamenti`).get();
    trtSnap.docs.forEach((d) => trattamenti.push({ id: d.id, _vignetoId: v.id, ...d.data() }));
  }

  const ctx = { attivita, lavori, macchine, tariffaProprietario, parcoMacchine, trattamenti };
  const totals = {
    costoTotaleAnno: 0,
    speseManodoperaAnno: 0,
    speseMacchineAnno: 0,
    speseProdottiAnno: 0
  };

  for (const v of vigneti) {
    const spese = computeSpeseVignetoAggregated(ctx, v, anno);
    const superficie = parseFloat(v.superficieEttari) || 0;
    const costoPerEttaro =
      superficie > 0 ? parseFloat((spese.costoTotaleAnno / superficie).toFixed(2)) : 0;

    const patch = {
      ...spese,
      spesePotaturaAnno: spese.manodoperaPotatura || 0,
      speseVendemmiaAnno: spese.manodoperaRaccolta || 0,
      speseTrattamentiAnno: spese.manodoperaTrattamenti || 0,
      costoPerEttaro,
      updatedAt: new Date()
    };

    await v.ref.set(patch, { merge: true });

    totals.costoTotaleAnno += spese.costoTotaleAnno;
    totals.speseManodoperaAnno += spese.speseManodoperaAnno;
    totals.speseMacchineAnno += spese.speseMacchineAnno;
    totals.speseProdottiAnno += spese.speseProdottiAnno;
  }

  Object.keys(totals).forEach((k) => {
    totals[k] = parseFloat(totals[k].toFixed(2));
  });

  return { anno, tariffaProprietario, parcoMacchine, vigneti: vigneti.length, totals };
}

/**
 * Allinea costi schede potatura/trattamento alle attività collegate (backfill).
 */
export async function reconcileSchedeVignetoFromAttivita(db, tenantId) {
  const tenantSnap = await db.doc(`tenants/${tenantId}`).get();
  const tenant = tenantSnap.data() || {};
  const parcoMacchine = tenantHasModule(tenant, 'parcoMacchine');
  const tariffaProprietario = await getTariffaProprietario(db, tenantId);

  const [attSnap, macSnap, prodSnap, movSnap] = await Promise.all([
    db.collection(`tenants/${tenantId}/attivita`).get(),
    db.collection(`tenants/${tenantId}/macchine`).get(),
    db.collection(`tenants/${tenantId}/prodotti`).get(),
    db.collection(`tenants/${tenantId}/movimentiMagazzino`).get()
  ]);

  const attById = new Map(attSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
  const macchine = new Map(macSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
  const prodById = new Map(prodSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
  const movByAttivita = new Map();
  for (const d of movSnap.docs) {
    const data = d.data();
    if (data.attivitaId) movByAttivita.set(data.attivitaId, { id: d.id, ...data });
  }

  const ctx = { tariffaProprietario, parcoMacchine, macchine };
  let potatureAggiornate = 0;
  let trattamentiAggiornati = 0;

  const vignetiSnap = await db.collection(`tenants/${tenantId}/vigneti`).get();
  for (const vDoc of vignetiSnap.docs) {
    const [potSnap, trtSnap] = await Promise.all([
      db.collection(`tenants/${tenantId}/vigneti/${vDoc.id}/potature`).get(),
      db.collection(`tenants/${tenantId}/vigneti/${vDoc.id}/trattamenti`).get()
    ]);

    for (const pDoc of potSnap.docs) {
      const p = pDoc.data();
      const att = p.attivitaId ? attById.get(p.attivitaId) : null;
      if (!att) continue;
      const costi = calcCostiManodoperaMacchinaAttivita(att, ctx, { sommaTrattoreEAttrezzo: false });
      await pDoc.ref.update({
        costoManodopera: costi.costoManodopera,
        costoMacchina: costi.costoMacchina,
        costoTotale: costi.costoTotale,
        oreImpiegate: att.oreNette ?? p.oreImpiegate ?? null,
        updatedAt: new Date()
      });
      potatureAggiornate += 1;
    }

    for (const tDoc of trtSnap.docs) {
      const t = tDoc.data();
      const att = t.attivitaId ? attById.get(t.attivitaId) : null;
      if (!att) continue;
      const costi = calcCostiManodoperaMacchinaAttivita(att, ctx, { sommaTrattoreEAttrezzo: true });
      const mov = movByAttivita.get(att.id);
      const prodotto = mov?.prodottoId ? prodById.get(mov.prodottoId) : null;
      const quantita = mov?.quantita ?? t.prodotti?.[0]?.quantita ?? 0;
      const costoProdotto = calcCostoProdottoDaMovimento(mov, prodotto, quantita);

      let prodotti = t.prodotti;
      if (prodotti?.length && prodotto) {
        prodotti = prodotti.map((r, i) =>
          i === 0
            ? {
              ...r,
              prodottoId: prodotto.id,
              prodotto: prodotto.nome || r.prodotto,
              quantita,
              costo: costoProdotto
            }
            : r
        );
      } else if (prodotto && costoProdotto > 0) {
        prodotti = [{
          prodottoId: prodotto.id,
          prodotto: prodotto.nome || 'Prodotto',
          dosaggio: 2,
          unitaDosaggio: 'l/ha',
          quantita,
          costo: costoProdotto
        }];
      }

      const costoTotale = parseFloat(
        (costoProdotto + costi.costoManodopera + costi.costoMacchina).toFixed(2)
      );

      await tDoc.ref.update({
        costoProdotto,
        costoManodopera: costi.costoManodopera,
        costoMacchina: costi.costoMacchina,
        costoTotale,
        prodotti: prodotti || t.prodotti || [],
        updatedAt: new Date()
      });
      trattamentiAggiornati += 1;

      if (mov?.id) {
        const riga = prodotti?.[0] || null;
        const prezzoU = prezzoUnitarioPerScarico(prodotto, riga);
        if (prezzoU != null) {
          await db.doc(`tenants/${tenantId}/movimentiMagazzino/${mov.id}`).set(
            { prezzoUnitario: prezzoU, updatedAt: new Date() },
            { merge: true }
          );
        }
      }
    }
  }

  return { potatureAggiornate, trattamentiAggiornati };
}
