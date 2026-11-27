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
 * Slug da label per id categoria personalizzata.
 * @param {string} label
 * @returns {string}
 */
export function slugifyIvaId(label) {
  const base = String(label || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return base || 'categoria';
}

/**
 * Id unico: slug label + suffisso se già presente.
 * @param {string} label
 * @param {Iterable<string>} [existingIds]
 * @returns {string}
 */
export function newCategoriaIvaId(label, existingIds = []) {
  const base = slugifyIvaId(label);
  const set = new Set([...(existingIds || [])].map((id) => String(id)));
  if (!set.has(base)) return base;
  let i = 2;
  while (set.has(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

/**
 * Normalizza una riga aliquota (senza reintrodurre default assenti).
 * @param {object} r
 * @param {number} [idx]
 * @param {Iterable<string>} [existingIds]
 */
export function normalizeAliquotaRow(r, idx = 0, existingIds = []) {
  const label =
    r && r.label != null && String(r.label).trim() ? String(r.label).trim() : '';
  const id =
    r && r.id != null && String(r.id).trim()
      ? String(r.id).trim()
      : newCategoriaIvaId(label || `categoria_${idx + 1}`, existingIds);
  const natura = r && ['imponibile', 'esente', 'fuori_campo'].includes(r.natura)
    ? r.natura
    : 'imponibile';
  const tipo = r && ['entrata', 'costo', 'entrambi'].includes(r.tipo) ? r.tipo : 'entrata';
  let aliquota = null;
  if (natura === 'imponibile') {
    aliquota =
      r && r.aliquota != null && r.aliquota !== '' && Number.isFinite(Number(r.aliquota))
        ? Number(r.aliquota)
        : 0;
  }
  return {
    id,
    label: label || id,
    aliquota,
    natura,
    tipo
  };
}

/**
 * Se `rows` è presente e non vuoto = lista azienda (niente re-add dei default tolti;
 * tiene id personalizzati). Default solo se manca o è vuoto.
 * @param {Array<{ id: string, label: string, aliquota: number|null, natura: string, tipo: string }>} [rows]
 * @returns {Array<object>}
 */
export function normalizeAliquote(rows) {
  if (!Array.isArray(rows) || !rows.length) {
    return ALIQUOTE_DEFAULT.map((r) => ({ ...r }));
  }
  const used = [];
  const out = [];
  rows.forEach((r, idx) => {
    if (!r || (!(r.id != null && String(r.id).trim()) && !(r.label != null && String(r.label).trim()))) {
      return;
    }
    const row = normalizeAliquotaRow(r, idx, used);
    used.push(row.id);
    out.push(row);
  });
  return out.length ? out : ALIQUOTE_DEFAULT.map((r) => ({ ...r }));
}

/**
 * Stessa regola delle aliquote: lista azienda se presente, altrimenti default.
 * @param {Array<{ id: string, label: string, percentuale: number|null }>} [rows]
 */
export function normalizeCompensazione(rows) {
  if (!Array.isArray(rows) || !rows.length) {
    return COMPENSAZIONE_DEFAULT.map((r) => ({ ...r }));
  }
  const used = [];
  const out = [];
  rows.forEach((r, idx) => {
    if (!r || (!(r.id != null && String(r.id).trim()) && !(r.label != null && String(r.label).trim()))) {
      return;
    }
    const label =
      r.label != null && String(r.label).trim() ? String(r.label).trim() : '';
    const id =
      r.id != null && String(r.id).trim()
        ? String(r.id).trim()
        : newCategoriaIvaId(label || `comp_${idx + 1}`, used);
    used.push(id);
    const percentuale =
      r.percentuale != null && r.percentuale !== '' && Number.isFinite(Number(r.percentuale))
        ? Number(r.percentuale)
        : null;
    out.push({ id, label: label || id, percentuale });
  });
  return out.length ? out : COMPENSAZIONE_DEFAULT.map((r) => ({ ...r }));
}

/**
 * Ripristina aliquote e compensazione ai valori di fabbrica.
 * @returns {{ aliquote: Array<object>, compensazione: Array<object> }}
 */
export function ripristinaIvaDefaults() {
  return {
    aliquote: ALIQUOTE_DEFAULT.map((r) => ({ ...r })),
    compensazione: COMPENSAZIONE_DEFAULT.map((r) => ({ ...r }))
  };
}

/**
 * Normalizza aliquote+compensazione per confronto «sporco» (numeri vs stringhe, trim label).
 * @param {{ aliquote?: Array<object>, compensazione?: Array<object> }|null|undefined} state
 * @returns {{ aliquote: Array<object>, compensazione: Array<object> }}
 */
export function canonicalizeIvaDettagliState(state) {
  const toNumOrNull = (v) => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const aliquote = Array.isArray(state && state.aliquote)
    ? state.aliquote.map((r) => {
        const natura = r && r.natura != null ? String(r.natura) : 'imponibile';
        const aliquota =
          natura === 'imponibile' ? toNumOrNull(r && r.aliquota) : null;
        return {
          id: r && r.id != null ? String(r.id) : '',
          label: r && r.label != null ? String(r.label).trim() : '',
          tipo: r && r.tipo != null ? String(r.tipo) : '',
          natura,
          aliquota
        };
      })
    : [];
  const compensazione = Array.isArray(state && state.compensazione)
    ? state.compensazione.map((r) => ({
        id: r && r.id != null ? String(r.id) : '',
        label: r && r.label != null ? String(r.label).trim() : '',
        percentuale: toNumOrNull(r && r.percentuale)
      }))
    : [];
  return { aliquote, compensazione };
}

/**
 * @param {{ aliquote?: Array<object>, compensazione?: Array<object> }|null|undefined} state
 * @returns {string}
 */
export function serializeIvaDettagliState(state) {
  return JSON.stringify(canonicalizeIvaDettagliState(state));
}

/**
 * @param {{ aliquote?: Array<object>, compensazione?: Array<object> }|null|undefined} a
 * @param {{ aliquote?: Array<object>, compensazione?: Array<object> }|null|undefined} b
 * @returns {boolean}
 */
export function ivaDettagliStatesEqual(a, b) {
  return serializeIvaDettagliState(a) === serializeIvaDettagliState(b);
}

/**
 * Copia profonda canonicalizzata (per baseline discard alla chiusura).
 * @param {{ aliquote?: Array<object>, compensazione?: Array<object> }|null|undefined} state
 * @returns {{ aliquote: Array<object>, compensazione: Array<object> }}
 */
export function cloneIvaDettagliState(state) {
  return canonicalizeIvaDettagliState(state);
}

/**
 * Aliquota predefinita di fabbrica per id categoria (solo se imponibile).
 * @param {string} id
 * @returns {number|null}
 */
export function defaultAliquotaForCategoriaId(id) {
  const row = ALIQUOTE_DEFAULT.find((a) => a && a.id === id);
  if (!row || row.natura !== 'imponibile') return null;
  return row.aliquota != null && Number.isFinite(Number(row.aliquota)) ? Number(row.aliquota) : null;
}

/**
 * Cambio Natura in UI aliquote: svuota/disabilita per esente/fuori campo;
 * tornando a Imponibile ripristina il valore ricordato o il default categoria.
 *
 * @param {{
 *   natura: string,
 *   currentValue?: string|number|null,
 *   rememberedAliquota?: number|string|null,
 *   defaultAliquota?: number|string|null
 * }} opts
 * @returns {{
 *   disabled: boolean,
 *   value: string,
 *   placeholder: string,
 *   rememberedAliquota: number|null
 * }}
 */
export function resolveAliquotaAfterNaturaChange(opts = {}) {
  const natura = opts.natura || 'imponibile';
  const labels = { esente: 'Esente', fuori_campo: 'Fuori campo' };

  const toNumOrNull = (v) => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  let remembered = toNumOrNull(opts.rememberedAliquota);

  if (natura === 'esente' || natura === 'fuori_campo') {
    const cur = toNumOrNull(opts.currentValue);
    if (cur != null) remembered = cur;
    return {
      disabled: true,
      value: '',
      placeholder: labels[natura] || '—',
      rememberedAliquota: remembered
    };
  }

  let next = remembered;
  if (next == null) next = toNumOrNull(opts.defaultAliquota);
  if (next == null) next = 0;
  return {
    disabled: false,
    value: String(next),
    placeholder: '',
    rememberedAliquota: next
  };
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
 * Mappa modulo raccolta / categoria prodotto verso chiave usata da suggerisciAliquotaPerTipo.
 * @param {string|null|undefined} modulo
 * @returns {string|null}
 */
export function categoriaProdottoDaRaccoltaModulo(modulo) {
  const m = String(modulo || '').toLowerCase().trim();
  if (m === 'frutta' || m === 'frutteto') return 'frutta';
  if (m === 'orticole' || m === 'ortaggi') return 'ortaggi';
  if (m === 'seminativo') return 'seminativo';
  if (m === 'vendemmia' || m === 'vigneto' || m === 'uva') return 'uva';
  return null;
}

/**
 * Precompilazione aliquota da tipo entrata / prodotto / coltura.
 * @param {{
 *   tipo?: string|null,
 *   categoriaProdotto?: string|null,
 *   coltura?: string|null,
 *   raccoltaModulo?: string|null,
 *   aliquote?: Array<object>
 * }} opts
 * @returns {{ categoriaIva: string|null, aliquotaIva: number|null, naturaIva: NaturaIva }|null}
 */
export function suggerisciAliquotaPerTipo(opts = {}) {
  // Se l'azienda passa la sua lista, non ripiegare sui default per id tolti.
  const companyList = Array.isArray(opts.aliquote);
  const aliquote = companyList ? opts.aliquote : ALIQUOTE_DEFAULT;
  const byId = (id) => (aliquote || []).find((a) => a && a.id === id) || null;

  const tipo = String(opts.tipo || '');
  if (tipo === 'pac_contributo') {
    const row = byId('contributi_pac');
    return row
      ? {
          categoriaIva: row.id,
          aliquotaIva: null,
          naturaIva: row.natura === 'fuori_campo' ? 'fuori_campo' : row.natura || 'fuori_campo'
        }
      : null;
  }

  const catFromModulo = categoriaProdottoDaRaccoltaModulo(opts.raccoltaModulo);
  const cat = String(opts.categoriaProdotto || catFromModulo || '')
    .toLowerCase()
    .trim();
  const coltura = String(opts.coltura || '').toLowerCase().trim();
  const blob = `${cat} ${coltura}`;

  let id = null;
  if (cat === 'uva' || /\buva\b/.test(blob)) {
    if (/tavola/.test(blob)) id = 'uva_da_tavola';
    else id = 'uva_da_vino';
  } else if (
    cat === 'frutta' ||
    /\bfrutta\b/.test(blob) ||
    /\b(pesca|pesche|pesco|albicocc|cilieg|melo|pero|susin|nettarin|redhaven|williams)\b/.test(blob)
  ) {
    id = 'frutta';
  } else if (cat === 'ortaggi' || cat === 'orticole' || /\bortagg|orticol/.test(blob)) {
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
 * In lettura (lista/KPI/dettaglio/modifica): se l'entrata non ha aliquota né natura,
 * applica il suggerimento coltura/tipo senza scrivere su Firestore.
 * @param {object|null|undefined} entrata
 * @param {Array<object>} [aliquote]
 * @param {{ categoriaProdotto?: string|null, raccoltaModulo?: string|null }} [extra]
 * @returns {object|null|undefined} stessa ref se già completa; altrimenti shallow copy arricchita
 */
export function risolviIvaEntrataInLettura(entrata, aliquote, extra = {}) {
  if (!entrata) return entrata;
  if (entrata.aliquotaIva != null || entrata.naturaIva) {
    if (entrata.importoIva != null || entrata.importo == null) return entrata;
    const calc = calcolaIva(entrata.importo, entrata.aliquotaIva);
    if (!calc) return entrata;
    return Object.assign({}, entrata, {
      importoIva: calc.importoIva,
      importoTotale: calc.importoTotale
    });
  }
  const s = suggerisciAliquotaPerTipo({
    tipo: entrata.tipo,
    coltura: entrata.coltura,
    categoriaProdotto: extra.categoriaProdotto || entrata.categoriaProdotto || null,
    raccoltaModulo: extra.raccoltaModulo || entrata.raccoltaModulo || null,
    aliquote
  });
  if (!s) return entrata;
  const out = Object.assign({}, entrata, {
    categoriaIva: s.categoriaIva,
    aliquotaIva: s.aliquotaIva,
    naturaIva: s.naturaIva
  });
  if (s.naturaIva === 'esente' || s.naturaIva === 'fuori_campo') {
    out.aliquotaIva = 0;
    out.importoIva = 0;
    out.importoTotale =
      entrata.importo != null && Number.isFinite(Number(entrata.importo))
        ? round2(Number(entrata.importo))
        : entrata.importoTotale;
    return out;
  }
  if (s.aliquotaIva != null && entrata.importo != null) {
    const calc = calcolaIva(entrata.importo, s.aliquotaIva);
    if (calc) {
      out.importoIva = calc.importoIva;
      out.importoTotale = calc.importoTotale;
    }
  }
  return out;
}

/**
 * Aggiornamento aliquota in un form: se l'utente ha scelto a mano, non sovrascrivere.
 * Usato da entrate/acconti (select) e preventivo CT (input %).
 *
 * @param {{
 *   aliquotaManuale?: boolean,
 *   suggerimento?: { aliquotaIva?: number|null, categoriaIva?: string|null }|null,
 *   corrente?: string|number|null,
 *   richiedeSceltaCliente?: boolean,
 *   sceltaClientePresente?: boolean
 * }} [opts]
 * @returns {{
 *   apply: boolean,
 *   suggerimento: object|null,
 *   showManualHint: boolean,
 *   suggestedPercent: number|null,
 *   clearForMissingCliente: boolean
 * }}
 */
export function resolveAggiornamentoAliquotaForm(opts = {}) {
  const manuale = !!opts.aliquotaManuale;
  const richiede = !!opts.richiedeSceltaCliente;
  const sceltaOk = !!opts.sceltaClientePresente;
  const sug = opts.suggerimento || null;
  const suggestedPercent =
    sug && sug.aliquotaIva != null && Number.isFinite(Number(sug.aliquotaIva))
      ? Number(sug.aliquotaIva)
      : null;

  if (richiede && !sceltaOk) {
    return {
      apply: !manuale,
      suggerimento: null,
      showManualHint: false,
      suggestedPercent: null,
      clearForMissingCliente: !manuale
    };
  }

  if (manuale) {
    let curNum = null;
    if (opts.corrente != null && opts.corrente !== '') {
      const n = Number(opts.corrente);
      if (Number.isFinite(n)) curNum = n;
    }
    return {
      apply: false,
      suggerimento: sug,
      showManualHint: suggestedPercent != null && curNum !== suggestedPercent,
      suggestedPercent,
      clearForMissingCliente: false
    };
  }

  return {
    apply: true,
    suggerimento: sug,
    showManualHint: false,
    suggestedPercent,
    clearForMissingCliente: false
  };
}

/**
 * Inferenza tipo cliente CT da anagrafica (P.IVA → impresa agricola).
 * @param {{ partitaIva?: string|null }|null|undefined} cliente
 * @returns {'impresa_agricola'|'privato'|null} null se non si può inferire
 */
export function inferisciTipoClienteContoTerzi(cliente) {
  if (!cliente) return null;
  const piva = cliente.partitaIva != null ? String(cliente.partitaIva).replace(/\s/g, '') : '';
  if (/^\d{11}$/.test(piva)) return 'impresa_agricola';
  return null;
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
 * Passare items già risolti con risolviIvaEntrataInLettura se si vogliono
 * includere i suggerimenti sui record legacy (senza scrittura Firestore).
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
  slugifyIvaId,
  newCategoriaIvaId,
  normalizeAliquotaRow,
  normalizeAliquote,
  normalizeCompensazione,
  ripristinaIvaDefaults,
  defaultAliquotaForCategoriaId,
  resolveAliquotaAfterNaturaChange,
  mergeIvaConfig,
  aliquotePerEntrate,
  labelAliquotaOption,
  categoriaProdottoDaRaccoltaModulo,
  suggerisciAliquotaPerTipo,
  risolviIvaEntrataInLettura,
  inferisciTipoClienteContoTerzi,
  suggerisciAliquotaContoTerzi,
  totaliIvaEntrate,
  formatImportoConIva
};
