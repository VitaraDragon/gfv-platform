/**
 * Aggregati Report Terreni — periodo selezionato (annata agraria / solare / custom).
 * Fonti: terreni, vigneti/frutteti collegati, trattamenti (concimi = tipo fertilizzante),
 * vendemmie (q.li), attività (ore nette).
 */
import { getCollectionData, dateToTimestamp } from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';

function toDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val.toDate === 'function') return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  return new Date(val);
}

/** Data locale → YYYY-MM-DD (come in `attivita.data`, stringa). */
function formatLocalIsoDate(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Campo `data` attività: stringa YYYY-MM-DD (vedi modello Attivita). Non usare Timestamp in query.
 */
function attivitaDataInRange(val, start, end) {
  const a = formatLocalIsoDate(start);
  const b = formatLocalIsoDate(end);
  if (!a || !b) return false;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    const s = val.slice(0, 10);
    return s >= a && s <= b;
  }
  const x = toDate(val);
  if (!x || Number.isNaN(x.getTime())) return false;
  const s = formatLocalIsoDate(x);
  return s >= a && s <= b;
}

function inRange(d, start, end) {
  const x = toDate(d);
  if (!x || Number.isNaN(x.getTime())) return false;
  return x >= start && x <= end;
}

/**
 * Stesso criterio della UI trattamenti: quantità esplicita, altrimenti dosaggio × superficie trattata (l/ha × ha, kg/ha × ha, ecc.).
 */
function sumProdottiKgFromRow(row) {
  const prodotti = row.prodotti;
  const sup = Number(row.superficieTrattata) || 0;
  if (!Array.isArray(prodotti) || prodotti.length === 0) return 0;
  return prodotti.reduce((s, r) => {
    const qRaw = Number(r.quantita);
    if (!Number.isNaN(qRaw) && qRaw > 0) return s + qRaw;
    const dos = Number(r.dosaggio);
    if (!Number.isNaN(dos) && sup > 0) return s + dos * sup;
    return s;
  }, 0);
}

function addProdottiToMap(byProduct, row) {
  const prodotti = row.prodotti || [];
  const sup = Number(row.superficieTrattata) || 0;
  for (const p of prodotti) {
    let q = Number(p.quantita);
    if (Number.isNaN(q) || q <= 0) {
      const dos = Number(p.dosaggio);
      q = !Number.isNaN(dos) && sup > 0 ? dos * sup : 0;
    }
    const name = (p.prodotto && String(p.prodotto).trim()) || 'Prodotto';
    byProduct[name] = (byProduct[name] || 0) + q;
  }
}

/**
 * Carica trattamenti per path sub-collection; preferenza query per data, altrimenti filtro client.
 */
async function loadTrattamentiSubcol(tenantId, collectionPath, start, end) {
  const t0 = dateToTimestamp(start);
  const t1 = dateToTimestamp(end);
  try {
    const docs = await getCollectionData(collectionPath, {
      tenantId,
      where: [
        ['data', '>=', t0],
        ['data', '<=', t1]
      ],
      orderBy: 'data',
      orderDirection: 'desc'
    });
    return docs || [];
  } catch (e) {
    try {
      const docs = await getCollectionData(collectionPath, {
        tenantId,
        orderBy: 'data',
        orderDirection: 'desc',
        limit: 400
      });
      return (docs || []).filter((d) => inRange(d.data, start, end));
    } catch (e2) {
      console.warn('[report-terreni] trattamenti fallback', collectionPath, e2.message || e2);
      return [];
    }
  }
}

function aggregateTrattamentiDocs(docs) {
  let kgConcime = 0;
  let kgTrattamento = 0;
  let interventiConcime = 0;
  let interventiTrattamento = 0;
  /** @type {Record<string, number>} */
  const byProduct = {};

  for (const row of docs) {
    const tipo = String(row.tipoTrattamento || '').toLowerCase();
    const isConcime = tipo === 'fertilizzante';
    const kg = sumProdottiKgFromRow(row);
    if (isConcime) {
      interventiConcime += 1;
      kgConcime += kg;
    } else {
      interventiTrattamento += 1;
      kgTrattamento += kg;
    }
    addProdottiToMap(byProduct, row);
  }
  return {
    kgConcime,
    kgTrattamento,
    interventiConcime,
    interventiTrattamento,
    byProduct
  };
}

async function loadVendemmieInRange(tenantId, vignetoId, start, end) {
  const path = `vigneti/${vignetoId}/vendemmie`;
  try {
    const docs = await getCollectionData(path, {
      tenantId,
      where: [
        ['data', '>=', dateToTimestamp(start)],
        ['data', '<=', dateToTimestamp(end)]
      ],
      orderBy: 'data',
      orderDirection: 'desc'
    });
    return docs || [];
  } catch (e) {
    try {
      const docs = await getCollectionData(path, {
        tenantId,
        orderBy: 'data',
        orderDirection: 'desc',
        limit: 200
      });
      return (docs || []).filter((d) => inRange(d.data, start, end));
    } catch (e2) {
      return [];
    }
  }
}

/**
 * @param {Date} start
 * @param {Date} end
 * @returns {Promise<Array<{ terreno: object, stats: object, alerts: string[] }>>}
 */
export async function buildReportTerreniRows(start, end) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    throw new Error('Tenant non disponibile');
  }

  const terreniRaw = await getCollectionData('terreni', { tenantId });
  const terreni = (terreniRaw || []).filter((t) => !t.clienteId || String(t.clienteId).trim() === '');

  const vigneti = await getCollectionData('vigneti', { tenantId }).catch(() => []);
  const frutteti = await getCollectionData('frutteti', { tenantId }).catch(() => []);

  /** @type {Record<string, { vigneti: any[], frutteti: any[] }>} */
  const byTerreno = {};
  for (const t of terreni) {
    byTerreno[t.id] = { vigneti: [], frutteti: [] };
  }
  for (const v of vigneti || []) {
    const tid = v.terrenoId;
    if (tid && byTerreno[tid]) {
      byTerreno[tid].vigneti.push(v);
    }
  }
  for (const f of frutteti || []) {
    const tid = f.terrenoId;
    if (tid && byTerreno[tid]) {
      byTerreno[tid].frutteti.push(f);
    }
  }

  const dataDaStr = formatLocalIsoDate(start);
  const dataAStr = formatLocalIsoDate(end);

  let attivitaDocs = [];
  try {
    attivitaDocs = await getCollectionData('attivita', {
      tenantId,
      where: [
        ['data', '>=', dataDaStr],
        ['data', '<=', dataAStr]
      ],
      orderBy: 'data',
      orderDirection: 'desc'
    });
  } catch (e) {
    try {
      const raw = await getCollectionData('attivita', {
        tenantId,
        orderBy: 'data',
        orderDirection: 'desc',
        limit: 1500
      });
      attivitaDocs = (raw || []).filter((a) => attivitaDataInRange(a.data, start, end));
    } catch (e2) {
      console.warn('[report-terreni] attività', e2);
    }
  }

  /** @type {Record<string, number>} */
  const oreByTerreno = {};
  for (const a of attivitaDocs || []) {
    if (a.clienteId) continue;
    const tid = a.terrenoId;
    if (!tid || !byTerreno[tid]) continue;
    const ore = Number(a.oreNette) || 0;
    oreByTerreno[tid] = (oreByTerreno[tid] || 0) + ore;
  }

  const rows = [];

  for (const terreno of terreni) {
    const links = byTerreno[terreno.id] || { vigneti: [], frutteti: [] };
    const alerts = [];

    const scadenza = terreno.dataScadenzaAffitto ? toDate(terreno.dataScadenzaAffitto) : null;
    if (scadenza && !Number.isNaN(scadenza.getTime())) {
      const days = (scadenza - new Date()) / (1000 * 60 * 60 * 24);
      if (days >= 0 && days <= 120) {
        alerts.push(`Affitto in scadenza (${Math.ceil(days)} g)`);
      }
    }

    let allTrattDocs = [];
    for (const v of links.vigneti) {
      const path = `vigneti/${v.id}/trattamenti`;
      const docs = await loadTrattamentiSubcol(tenantId, path, start, end);
      allTrattDocs = allTrattDocs.concat(docs);
    }
    for (const f of links.frutteti) {
      const path = `frutteti/${f.id}/trattamenti`;
      const docs = await loadTrattamentiSubcol(tenantId, path, start, end);
      allTrattDocs = allTrattDocs.concat(docs);
    }

    const agg = aggregateTrattamentiDocs(allTrattDocs);

    let qliVendemmia = 0;
    let vendemmiaCount = 0;
    for (const v of links.vigneti) {
      const vend = await loadVendemmieInRange(tenantId, v.id, start, end);
      for (const row of vend) {
        qliVendemmia += Number(row.quantitaQli) || 0;
        vendemmiaCount += 1;
      }
    }

    const ore = oreByTerreno[terreno.id] || 0;

    const stats = {
      kgConcime: Math.round(agg.kgConcime * 100) / 100,
      kgTrattamento: Math.round(agg.kgTrattamento * 100) / 100,
      interventiConcime: agg.interventiConcime,
      interventiTrattamento: agg.interventiTrattamento,
      qliVendemmia: Math.round(qliVendemmia * 100) / 100,
      vendemmiaCount,
      oreAttivita: Math.round(ore * 100) / 100,
      prodottiByName: agg.byProduct,
      hasVigneto: links.vigneti.length > 0,
      hasFrutteto: links.frutteti.length > 0
    };

    if (links.vigneti.length === 0 && links.frutteti.length === 0) {
      alerts.push('Nessun vigneto/frutteto collegato in anagrafica');
    }

    rows.push({ terreno, stats, alerts });
  }

  rows.sort((a, b) => {
    const na = (a.terreno.nome || a.terreno.podere || '').toLowerCase();
    const nb = (b.terreno.nome || b.terreno.podere || '').toLowerCase();
    return na.localeCompare(nb, 'it');
  });

  return rows;
}
