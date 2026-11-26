/**
 * Config IVA tenant — regime, aliquote per categoria, compensazione speciale.
 * Documento: tenants/{tenantId}/impostazioni/iva
 *
 * @module core/models/IvaConfig
 */

export const REGIMI_IVA = ['ordinario', 'speciale_agricolo'];

export const REGIME_IVA_LABELS = {
  ordinario: 'Ordinario (recupero l\'IVA)',
  speciale_agricolo: 'Speciale agricolo'
};

/** @typedef {'imponibile'|'esente'|'fuori_campo'} NaturaIva */
/** @typedef {'entrata'|'costo'|'entrambi'} TipoCategoriaIva */

/**
 * Aliquote di default (DPR 633/72 Tabella A, vigenti nov 2026).
 * Usate se il documento impostazioni/iva non esiste.
 * @type {Array<{ id: string, label: string, aliquota: number|null, natura: NaturaIva, tipo: TipoCategoriaIva }>}
 */
export const ALIQUOTE_DEFAULT = [
  { id: 'uva_da_tavola', label: 'Uva da tavola', aliquota: 4, natura: 'imponibile', tipo: 'entrata' },
  { id: 'frutta', label: 'Frutta', aliquota: 4, natura: 'imponibile', tipo: 'entrata' },
  { id: 'ortaggi', label: 'Ortaggi', aliquota: 4, natura: 'imponibile', tipo: 'entrata' },
  { id: 'olive_fresche', label: 'Olive fresche', aliquota: 4, natura: 'imponibile', tipo: 'entrata' },
  { id: 'cereali', label: 'Cereali (conferimenti/vendite)', aliquota: 4, natura: 'imponibile', tipo: 'entrata' },
  { id: 'olio_oliva', label: 'Olio d\'oliva', aliquota: 4, natura: 'imponibile', tipo: 'entrata' },
  { id: 'concimi_fertilizzanti', label: 'Concimi e fertilizzanti', aliquota: 4, natura: 'imponibile', tipo: 'costo' },

  { id: 'uva_da_vino', label: 'Uva da vino (conferimenti)', aliquota: 10, natura: 'imponibile', tipo: 'entrata' },
  { id: 'latte_non_confezionato', label: 'Latte non confezionato', aliquota: 10, natura: 'imponibile', tipo: 'entrambi' },
  { id: 'animali_vivi', label: 'Animali vivi', aliquota: 10, natura: 'imponibile', tipo: 'entrambi' },
  { id: 'legna_ardere', label: 'Legna da ardere (non pellet)', aliquota: 10, natura: 'imponibile', tipo: 'entrambi' },
  { id: 'sementi', label: 'Sementi', aliquota: 10, natura: 'imponibile', tipo: 'costo' },
  { id: 'piantine_piante_vive', label: 'Piantine e piante vive', aliquota: 10, natura: 'imponibile', tipo: 'costo' },
  { id: 'fitofarmaci', label: 'Fitofarmaci', aliquota: 10, natura: 'imponibile', tipo: 'costo' },
  { id: 'gasolio_agricolo', label: 'Gasolio agricolo', aliquota: 10, natura: 'imponibile', tipo: 'costo' },
  { id: 'energia_elettrica_agricola', label: 'Energia elettrica a uso agricolo', aliquota: 10, natura: 'imponibile', tipo: 'costo' },
  { id: 'acqua_fornitura', label: 'Acqua (fornitura)', aliquota: 10, natura: 'imponibile', tipo: 'costo' },
  {
    id: 'ct_macchine_impresa_agricola',
    label: 'Lavori conto terzi con macchine agricole (impresa agricola)',
    aliquota: 10,
    natura: 'imponibile',
    tipo: 'entrata'
  },

  { id: 'vino', label: 'Vino', aliquota: 22, natura: 'imponibile', tipo: 'entrata' },
  {
    id: 'trattori_macchine',
    label: 'Trattori e macchine agricole (acquisto, vendita, noleggio)',
    aliquota: 22,
    natura: 'imponibile',
    tipo: 'entrambi'
  },
  { id: 'ricambi_riparazioni', label: 'Ricambi e riparazioni', aliquota: 22, natura: 'imponibile', tipo: 'costo' },
  { id: 'carburante_non_agricolo', label: 'Carburante non agricolo', aliquota: 22, natura: 'imponibile', tipo: 'costo' },
  { id: 'consulenze', label: 'Consulenze professionali', aliquota: 22, natura: 'imponibile', tipo: 'costo' },
  {
    id: 'ct_privato_o_senza_macchina',
    label: 'Lavori conto terzi per privato o senza macchina agricola',
    aliquota: 22,
    natura: 'imponibile',
    tipo: 'entrata'
  },

  { id: 'affitto_terreni', label: 'Affitto di terreni agricoli', aliquota: null, natura: 'esente', tipo: 'entrata' },
  { id: 'assicurazioni', label: 'Assicurazioni', aliquota: null, natura: 'esente', tipo: 'costo' },
  { id: 'contributi_pac', label: 'Contributi PAC', aliquota: null, natura: 'fuori_campo', tipo: 'entrata' }
];

/**
 * Percentuali compensazione regime speciale (solo salvate in questa PR).
 * @type {Array<{ id: string, label: string, percentuale: number|null }>}
 */
export const COMPENSAZIONE_DEFAULT = [
  { id: 'cereali', label: 'Cereali', percentuale: 4 },
  { id: 'latte_non_confezionato', label: 'Latte non confezionato', percentuale: 10 },
  { id: 'vino', label: 'Vino', percentuale: 12.3 },
  { id: 'uva', label: 'Uva', percentuale: 4 },
  { id: 'altro', label: 'Altro (verifica col commercialista)', percentuale: null }
];

/**
 * Arrotonda a 2 decimali (half-up via Math.round).
 * @param {number} n
 * @returns {number}
 */
export function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Calcola IVA da imponibile e aliquota percentuale.
 * Esente / fuori campo: passare aliquota 0 o null → IVA 0.
 * @param {number|string|null|undefined} imponibile
 * @param {number|string|null|undefined} aliquota
 * @returns {{ importoIva: number, importoTotale: number }|null} null se imponibile non numerico
 */
export function calcolaIva(imponibile, aliquota) {
  if (imponibile == null || imponibile === '') return null;
  const base = Number(imponibile);
  if (!Number.isFinite(base)) return null;
  let rate = aliquota == null || aliquota === '' ? 0 : Number(aliquota);
  if (!Number.isFinite(rate) || rate < 0) rate = 0;
  const importoIva = round2((base * rate) / 100);
  const importoTotale = round2(base + importoIva);
  return { importoIva, importoTotale };
}

/**
 * @param {Array<{ id: string, label: string, aliquota: number|null, natura: string, tipo: string }>} [rows]
 * @returns {Array<object>}
 */
export function normalizeAliquote(rows) {
  const base = ALIQUOTE_DEFAULT.map((r) => ({ ...r }));
  if (!Array.isArray(rows) || !rows.length) return base;
  const byId = new Map();
  for (const r of rows) {
    if (!r || !r.id) continue;
    byId.set(String(r.id), r);
  }
  return base.map((def) => {
    const ov = byId.get(def.id);
    if (!ov) return { ...def };
    const aliquota =
      ov.natura === 'esente' || ov.natura === 'fuori_campo'
        ? null
        : ov.aliquota != null && ov.aliquota !== '' && Number.isFinite(Number(ov.aliquota))
          ? Number(ov.aliquota)
          : def.aliquota;
    return {
      id: def.id,
      label: ov.label != null && String(ov.label).trim() ? String(ov.label).trim() : def.label,
      aliquota,
      natura: ['imponibile', 'esente', 'fuori_campo'].includes(ov.natura) ? ov.natura : def.natura,
      tipo: ['entrata', 'costo', 'entrambi'].includes(ov.tipo) ? ov.tipo : def.tipo
    };
  });
}

/**
 * @param {Array<{ id: string, label: string, percentuale: number|null }>} [rows]
 */
export function normalizeCompensazione(rows) {
  const base = COMPENSAZIONE_DEFAULT.map((r) => ({ ...r }));
  if (!Array.isArray(rows) || !rows.length) return base;
  const byId = new Map();
  for (const r of rows) {
    if (!r || !r.id) continue;
    byId.set(String(r.id), r);
  }
  return base.map((def) => {
    const ov = byId.get(def.id);
    if (!ov) return { ...def };
    const percentuale =
      ov.percentuale != null && ov.percentuale !== '' && Number.isFinite(Number(ov.percentuale))
        ? Number(ov.percentuale)
        : null;
    return {
      id: def.id,
      label: ov.label != null && String(ov.label).trim() ? String(ov.label).trim() : def.label,
      percentuale
    };
  });
}

/**
 * @param {object|null|undefined} data documento Firestore o parziale
 * @returns {{ regime: string, aliquote: Array<object>, compensazione: Array<object> }}
 */
export function mergeIvaConfig(data = {}) {
  const regime =
    data && REGIMI_IVA.includes(data.regime) ? data.regime : 'ordinario';
  return {
    regime,
    aliquote: normalizeAliquote(data && data.aliquote),
    compensazione: normalizeCompensazione(data && data.compensazione)
  };
}

/**
 * Categorie usabili sulle entrate (tipo entrata o entrambi).
 * @param {Array<object>} aliquote
 */
export function aliquotePerEntrate(aliquote) {
  return (aliquote || []).filter((a) => a && (a.tipo === 'entrata' || a.tipo === 'entrambi'));
}

/**
 * Etichetta aliquota per tendina / display.
 * @param {{ label: string, aliquota: number|null, natura: string }} row
 */
export function labelAliquotaOption(row) {
  if (!row) return '';
  if (row.natura === 'esente') return `${row.label} — esente`;
  if (row.natura === 'fuori_campo') return `${row.label} — fuori campo IVA`;
  const a = row.aliquota != null ? row.aliquota : 0;
  return `${row.label} — ${a}%`;
}

/**
 * Precompilazione aliquota da tipo entrata / prodotto / coltura.
 * @param {{
 *   tipo?: string|null,
 *   categoriaProdotto?: string|null,
 *   coltura?: string|null,
 *   aliquote?: Array<object>
 * }} opts
 * @returns {{ categoriaIva: string|null, aliquotaIva: number|null, naturaIva: NaturaIva }|null}
 */
export function suggerisciAliquotaPerTipo(opts = {}) {
  const aliquote = opts.aliquote && opts.aliquote.length ? opts.aliquote : ALIQUOTE_DEFAULT;
  const byId = (id) => aliquote.find((a) => a.id === id) || ALIQUOTE_DEFAULT.find((a) => a.id === id);

  const tipo = String(opts.tipo || '');
  if (tipo === 'pac_contributo') {
    const row = byId('contributi_pac');
    return row
      ? { categoriaIva: row.id, aliquotaIva: null, naturaIva: 'fuori_campo' }
      : null;
  }

  const cat = String(opts.categoriaProdotto || '').toLowerCase().trim();
  const coltura = String(opts.coltura || '').toLowerCase().trim();
  const blob = `${cat} ${coltura}`;

  let id = null;
  if (cat === 'uva' || /\buva\b/.test(blob)) {
    if (/tavola/.test(blob)) id = 'uva_da_tavola';
    else id = 'uva_da_vino';
  } else if (cat === 'frutta' || /\bfrutta\b/.test(blob)) {
    id = 'frutta';
  } else if (cat === 'ortaggi' || /\bortagg/.test(blob)) {
    id = 'ortaggi';
  } else if (cat === 'seminativo' || /\bcereal|grano|mais|orzo|seminat/.test(blob)) {
    id = 'cereali';
  } else if (/\boliv|olio/.test(blob)) {
    id = /\bolio/.test(blob) ? 'olio_oliva' : 'olive_fresche';
  } else if (/\bvino\b/.test(blob)) {
    id = 'vino';
  }

  if (!id && (tipo === 'acconto' || tipo === 'saldo' || tipo === 'vendita_prodotto')) {
    return null;
  }
  if (!id) return null;

  const row = byId(id);
  if (!row) return null;
  return {
    categoriaIva: row.id,
    aliquotaIva: row.natura === 'imponibile' ? row.aliquota : null,
    naturaIva: row.natura
  };
}

/**
 * Precompilazione per lavori conto terzi in base al tipo cliente.
 * @param {'impresa_agricola'|'privato'|string|null|undefined} tipoCliente
 * @param {Array<object>} [aliquote]
 * @returns {{ categoriaIva: string, aliquotaIva: number, naturaIva: 'imponibile', nota: string|null }}
 */
export function suggerisciAliquotaContoTerzi(tipoCliente, aliquote) {
  const list = aliquote && aliquote.length ? aliquote : ALIQUOTE_DEFAULT;
  const byId = (id) => list.find((a) => a.id === id) || ALIQUOTE_DEFAULT.find((a) => a.id === id);
  const t = String(tipoCliente || '').toLowerCase().trim();
  if (t === 'privato' || t === 'persona_fisica' || t === 'privato_cittadino') {
    const row = byId('ct_privato_o_senza_macchina');
    return {
      categoriaIva: row.id,
      aliquotaIva: row.aliquota,
      naturaIva: 'imponibile',
      nota: null
    };
  }
  if (t === 'impresa_agricola' || t === 'azienda_agricola' || t === 'impresa') {
    const row = byId('ct_macchine_impresa_agricola');
    return {
      categoriaIva: row.id,
      aliquotaIva: row.aliquota,
      naturaIva: 'imponibile',
      nota: null
    };
  }
  const row = byId('ct_macchine_impresa_agricola');
  return {
    categoriaIva: row.id,
    aliquotaIva: row.aliquota,
    naturaIva: 'imponibile',
    nota: '22% se il cliente non è un\'impresa agricola'
  };
}

/**
 * Totale IVA sulle entrate (imponibili restano in totaliEntrate).
 * Entrate senza aliquota non contribuiscono all'IVA (vecchi record).
 * @param {Array<object>} items
 * @returns {{ ivaRegistrate: number, ivaIncassate: number, ivaDaIncassare: number }}
 */
export function totaliIvaEntrate(items) {
  let ivaRegistrate = 0;
  let ivaIncassate = 0;
  let ivaDaIncassare = 0;
  for (const item of items || []) {
    let iva = item && item.importoIva != null ? Number(item.importoIva) : NaN;
    if (!Number.isFinite(iva)) {
      if (item && item.aliquotaIva != null && item.importo != null) {
        const calc = calcolaIva(item.importo, item.aliquotaIva);
        iva = calc ? calc.importoIva : 0;
      } else {
        continue;
      }
    }
    if (iva <= 0 && (item.naturaIva === 'esente' || item.naturaIva === 'fuori_campo' || item.aliquotaIva == null)) {
      // conta 0 solo se natura esplicita con aliquota 0? per KPI mostriamo somma IVA reale
    }
    if (!Number.isFinite(iva) || iva < 0) continue;
    ivaRegistrate += iva;
    if (item.incassato) ivaIncassate += iva;
    else ivaDaIncassare += iva;
  }
  return {
    ivaRegistrate: round2(ivaRegistrate),
    ivaIncassate: round2(ivaIncassate),
    ivaDaIncassare: round2(ivaDaIncassare)
  };
}

/**
 * Testo display importo + IVA accanto (grigio).
 * @param {object} e entrata
 * @param {(n: number) => string} euroFmt
 */
export function formatImportoConIva(e, euroFmt) {
  const fmt = typeof euroFmt === 'function' ? euroFmt : (n) => String(n);
  const imp = e && e.importo != null && Number.isFinite(Number(e.importo)) ? Number(e.importo) : null;
  if (imp == null) return '—';
  const main = fmt(imp);
  if (!e || (e.aliquotaIva == null && !e.naturaIva && e.importoIva == null)) {
    return main;
  }
  if (e.naturaIva === 'esente') return `${main} (esente)`;
  if (e.naturaIva === 'fuori_campo') return `${main} (fuori campo IVA)`;
  let iva = e.importoIva != null ? Number(e.importoIva) : NaN;
  if (!Number.isFinite(iva) && e.aliquotaIva != null) {
    const c = calcolaIva(imp, e.aliquotaIva);
    iva = c ? c.importoIva : NaN;
  }
  if (!Number.isFinite(iva)) return main;
  return `${main} (+ IVA ${fmt(iva)})`;
}

export default {
  REGIMI_IVA,
  REGIME_IVA_LABELS,
  ALIQUOTE_DEFAULT,
  COMPENSAZIONE_DEFAULT,
  round2,
  calcolaIva,
  mergeIvaConfig,
  aliquotePerEntrate,
  labelAliquotaOption,
  suggerisciAliquotaPerTipo,
  suggerisciAliquotaContoTerzi,
  totaliIvaEntrate,
  formatImportoConIva
};
