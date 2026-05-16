/**
 * Catalogo skill manodopera, mapping tipo lavoro/sottocategoria → skillId,
 * regole carro raccolta frutta e vendemmia, soglie stelline.
 * Fonte di verità per scheda operaio, batch ore e (futuro) shortlist sostituti.
 *
 * Design: docs-sviluppo/tony/PIANO_SOSTITUZIONE_MANODOPERA_SQUADRE.md § Catalogo skill
 *
 * @module core/config/manodopera-skills-config
 */

/** @typedef {{ id: string, label: string, source: 'sottocategoria'|'categoria'|'trasversale' }} ManodoperaSkillDef */

export const SKILL_ID_TRATTAMENTI = 'trattamenti';
export const SKILL_ID_GUIDA_TRATTORE = 'guida_trattore';
export const SKILL_ID_RACCOLTA_MANUALE = 'raccolta_manuale';
export const SKILL_ID_RACCOLTA_MECCANICA = 'raccolta_meccanica';
export const SKILL_ID_MANUTENZIONE = 'manutenzione';
export const SKILL_ID_ALTRO = 'altro';

/** Sottocategorie che confluiscono su un unico skillId */
export const SOTTOCATEGORIA_TO_SKILL_ID = Object.freeze({
  trattamenti_manuale: SKILL_ID_TRATTAMENTI,
  trattamenti_meccanico: SKILL_ID_TRATTAMENTI
});

/** Categorie principali (senza sottocategoria) → skillId */
export const CATEGORIA_PRINCIPALE_TO_SKILL_ID = Object.freeze({
  manutenzione: SKILL_ID_MANUTENZIONE,
  altro: SKILL_ID_ALTRO
});

/**
 * Catalogo v1 — skillId allineati a sottocategoriaCodice (+ guida_trattore).
 * @type {ManodoperaSkillDef[]}
 */
export const MANODOPERA_SKILLS_CATALOG = Object.freeze([
  { id: 'lavorazione_terreno_generale', label: 'Lavorazione terreno — Generale', source: 'sottocategoria' },
  { id: 'lavorazione_terreno_tra_file', label: 'Lavorazione terreno — Tra le file', source: 'sottocategoria' },
  { id: 'lavorazione_terreno_sulla_fila', label: 'Lavorazione terreno — Sulla fila', source: 'sottocategoria' },
  { id: SKILL_ID_TRATTAMENTI, label: 'Trattamenti', source: 'sottocategoria' },
  { id: 'concimazione_manuale', label: 'Concimazione — Manuale', source: 'sottocategoria' },
  { id: 'concimazione_meccanico', label: 'Concimazione — Meccanica', source: 'sottocategoria' },
  { id: 'potatura_manuale', label: 'Potatura — Manuale', source: 'sottocategoria' },
  { id: 'potatura_meccanico', label: 'Potatura — Meccanica', source: 'sottocategoria' },
  { id: SKILL_ID_RACCOLTA_MANUALE, label: 'Raccolta — Manuale', source: 'sottocategoria' },
  { id: SKILL_ID_RACCOLTA_MECCANICA, label: 'Raccolta — Meccanica / carro', source: 'sottocategoria' },
  { id: 'gestione_verde_manuale', label: 'Gestione verde — Manuale', source: 'sottocategoria' },
  { id: 'gestione_verde_meccanico', label: 'Gestione verde — Meccanica', source: 'sottocategoria' },
  { id: 'semina_piantagione_manuale', label: 'Semina e piantagione — Manuale', source: 'sottocategoria' },
  { id: 'semina_piantagione_meccanico', label: 'Semina e piantagione — Meccanica', source: 'sottocategoria' },
  { id: 'semina_piantagione_impianto', label: 'Semina e piantagione — Impianto', source: 'sottocategoria' },
  { id: 'diserbo_manuale', label: 'Diserbo — Manuale', source: 'sottocategoria' },
  { id: 'diserbo_meccanico', label: 'Diserbo — Meccanico', source: 'sottocategoria' },
  { id: SKILL_ID_MANUTENZIONE, label: 'Manutenzione', source: 'categoria' },
  { id: SKILL_ID_ALTRO, label: 'Altro', source: 'categoria' },
  { id: SKILL_ID_GUIDA_TRATTORE, label: 'Guida trattore / trasporto', source: 'trasversale' }
]);

export const MANODOPERA_SKILL_IDS = Object.freeze(
  MANODOPERA_SKILLS_CATALOG.map((s) => s.id)
);

const SKILL_ID_SET = new Set(MANODOPERA_SKILL_IDS);

/** Ore (ultimi 12 mesi) → stelle 1–5 — calibrazione tenant pilota */
export const STAR_THRESHOLDS_HOURS_DEFAULT = Object.freeze([
  { stelle: 1, minOre: 0, maxOre: 20 },
  { stelle: 2, minOre: 21, maxOre: 80 },
  { stelle: 3, minOre: 81, maxOre: 200 },
  { stelle: 4, minOre: 201, maxOre: 400 },
  { stelle: 5, minOre: 401, maxOre: null }
]);

/** Soglia minima stelle per entrare in shortlist sostituti (pilota) */
export const SHORTLIST_MIN_STELLE_DEFAULT = 2;

/** Skill dichiarate in assunzione da tipoOperaio (User) */
export const TIPO_OPERAIO_DEFAULT_SKILL_IDS = Object.freeze({
  trattorista: [SKILL_ID_GUIDA_TRATTORE],
  meccanico: [SKILL_ID_MANUTENZIONE],
  elettricista: [SKILL_ID_MANUTENZIONE],
  semplice: [],
  specializzato: [],
  altro: []
});

/** Carro raccolta frutta (non vendemmia): skill + equipaggio minimo */
export const CARRO_RACCOLTA_FRUTTA_RULE = Object.freeze({
  skillIdRichiesta: SKILL_ID_RACCOLTA_MECCANICA,
  minPersoneDefault: 4,
  /** Tag opzionale su documento attrezzo/macchina */
  attrezzoTag: 'carro_raccolta',
  /** Parole nel nome attrezzo (escluso contesto vendemmia/uva nel nome lavoro) */
  nomeAttrezzoKeywords: ['carro', 'raccoglit']
});

/**
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function normalizeSkillCodice(value) {
  return (value || '').toLowerCase().trim();
}

/**
 * @param {string} skillId
 * @returns {boolean}
 */
export function isValidManodoperaSkillId(skillId) {
  return SKILL_ID_SET.has(skillId);
}

/**
 * @param {string|null|undefined} sottocategoriaCodice
 * @returns {string|null}
 */
export function resolveSkillIdFromSottocategoriaCodice(sottocategoriaCodice) {
  const code = normalizeSkillCodice(sottocategoriaCodice);
  if (!code) return null;
  if (SOTTOCATEGORIA_TO_SKILL_ID[code]) {
    return SOTTOCATEGORIA_TO_SKILL_ID[code];
  }
  if (SKILL_ID_SET.has(code)) {
    return code;
  }
  return null;
}

/**
 * @param {string|null|undefined} tipoLavoroNome
 * @returns {boolean}
 */
export function isVendemmiaTipoLavoroNome(tipoLavoroNome) {
  return /\bvendemmia\b/i.test(tipoLavoroNome || '');
}

/**
 * Skill da tipo lavoro / attività (senza attrezzo).
 * @param {{ tipoLavoroNome?: string, sottocategoriaCodice?: string|null, categoriaCodice?: string|null }} input
 * @returns {string[]}
 */
export function resolveSkillIdsFromTipoLavoro(input = {}) {
  const ids = new Set();
  const nome = input.tipoLavoroNome || '';
  const sotto = normalizeSkillCodice(input.sottocategoriaCodice);
  const cat = normalizeSkillCodice(input.categoriaCodice);

  if (cat && CATEGORIA_PRINCIPALE_TO_SKILL_ID[cat]) {
    ids.add(CATEGORIA_PRINCIPALE_TO_SKILL_ID[cat]);
  }

  const fromSotto = resolveSkillIdFromSottocategoriaCodice(sotto);
  if (fromSotto) {
    if (isVendemmiaTipoLavoroNome(nome) && fromSotto === SKILL_ID_RACCOLTA_MECCANICA) {
      ids.add(SKILL_ID_RACCOLTA_MANUALE);
    } else {
      ids.add(fromSotto);
    }
  }

  return Array.from(ids);
}

/**
 * @param {Record<string, unknown>|null|undefined} attrezzo
 * @param {{ tipoLavoroNome?: string }} [opts]
 * @returns {boolean}
 */
export function isCarroRaccoltaFruttaAttrezzo(attrezzo, opts = {}) {
  if (!attrezzo || typeof attrezzo !== 'object') return false;
  if (isVendemmiaTipoLavoroNome(opts.tipoLavoroNome)) {
    return false;
  }

  const tags = attrezzo.skillTags || attrezzo.manodoperaTags;
  if (Array.isArray(tags) && tags.includes(CARRO_RACCOLTA_FRUTTA_RULE.attrezzoTag)) {
    return true;
  }

  const nome = normalizeSkillCodice(String(attrezzo.nome || ''));
  if (!nome) return false;
  if (/vendemmia|uva/.test(nome)) return false;

  return CARRO_RACCOLTA_FRUTTA_RULE.nomeAttrezzoKeywords.some((kw) => nome.includes(kw));
}

/**
 * Skill richieste per sostituzione / equipaggio (tipo lavoro + attrezzo + macchina).
 * @param {{
 *   tipoLavoroNome?: string,
 *   sottocategoriaCodice?: string|null,
 *   categoriaCodice?: string|null,
 *   attrezzo?: Record<string, unknown>|null,
 *   macchinaId?: string|null,
 *   operatoreMacchinaId?: string|null
 * }} lavoroContext
 * @returns {{ skillIds: string[], equipaggioMinimo: number|null, note?: string[] }}
 */
export function resolveRequiredSkillsForLavoro(lavoroContext = {}) {
  const note = [];
  const skillIds = new Set(
    resolveSkillIdsFromTipoLavoro({
      tipoLavoroNome: lavoroContext.tipoLavoroNome,
      sottocategoriaCodice: lavoroContext.sottocategoriaCodice,
      categoriaCodice: lavoroContext.categoriaCodice
    })
  );

  let equipaggioMinimo = null;

  if (isCarroRaccoltaFruttaAttrezzo(lavoroContext.attrezzo, {
    tipoLavoroNome: lavoroContext.tipoLavoroNome
  })) {
    skillIds.add(CARRO_RACCOLTA_FRUTTA_RULE.skillIdRichiesta);
    const minFromAttrezzo = lavoroContext.attrezzo?.minPersoneEquipaggio;
    equipaggioMinimo =
      typeof minFromAttrezzo === 'number' && minFromAttrezzo > 0
        ? minFromAttrezzo
        : CARRO_RACCOLTA_FRUTTA_RULE.minPersoneDefault;
    note.push('equipaggio_carro_raccolta_frutta');
  }

  const hasMacchina =
    Boolean(lavoroContext.macchinaId) || Boolean(lavoroContext.operatoreMacchinaId);

  if (hasMacchina && isVendemmiaTipoLavoroNome(lavoroContext.tipoLavoroNome)) {
    skillIds.add(SKILL_ID_GUIDA_TRATTORE);
    note.push('vendemmia_trasporto_guida_trattore');
  }

  return {
    skillIds: Array.from(skillIds),
    equipaggioMinimo,
    note: note.length ? note : undefined
  };
}

/**
 * Ore lavorate → stelle (1–5).
 * @param {number} ore
 * @param {typeof STAR_THRESHOLDS_HOURS_DEFAULT} [thresholds]
 * @returns {number}
 */
export function oreToStelle(ore, thresholds = STAR_THRESHOLDS_HOURS_DEFAULT) {
  const h = Number(ore);
  if (!Number.isFinite(h) || h < 0) return 1;
  let stelle = 1;
  for (const band of thresholds) {
    const max = band.maxOre;
    if (max == null || h <= max) {
      stelle = band.stelle;
    }
    if (max != null && h <= max) break;
    if (max == null && h >= band.minOre) {
      stelle = band.stelle;
    }
  }
  return Math.min(5, Math.max(1, stelle));
}

/**
 * @param {string|null|undefined} tipoOperaio
 * @returns {string[]}
 */
export function getDefaultDeclaredSkillIdsForTipoOperaio(tipoOperaio) {
  const key = normalizeSkillCodice(tipoOperaio);
  return [...(TIPO_OPERAIO_DEFAULT_SKILL_IDS[key] || [])];
}

/**
 * Per UI scheda operaio / checkbox skill dichiarate.
 * @returns {ManodoperaSkillDef[]}
 */
export function getManodoperaSkillsCatalog() {
  return MANODOPERA_SKILLS_CATALOG.map((s) => ({ ...s }));
}

/** Raggruppamento checkbox in scheda operaio (ordine visualizzazione). */
export const MANODOPERA_SKILL_UI_GROUPS = Object.freeze([
  {
    title: 'Lavorazione del terreno',
    skillIds: [
      'lavorazione_terreno_generale',
      'lavorazione_terreno_tra_file',
      'lavorazione_terreno_sulla_fila'
    ]
  },
  { title: 'Trattamenti', skillIds: [SKILL_ID_TRATTAMENTI] },
  { title: 'Concimazione', skillIds: ['concimazione_manuale', 'concimazione_meccanico'] },
  { title: 'Potatura', skillIds: ['potatura_manuale', 'potatura_meccanico'] },
  {
    title: 'Raccolta',
    skillIds: [SKILL_ID_RACCOLTA_MANUALE, SKILL_ID_RACCOLTA_MECCANICA]
  },
  { title: 'Gestione del verde', skillIds: ['gestione_verde_manuale', 'gestione_verde_meccanico'] },
  {
    title: 'Semina e piantagione',
    skillIds: [
      'semina_piantagione_manuale',
      'semina_piantagione_meccanico',
      'semina_piantagione_impianto'
    ]
  },
  { title: 'Diserbo', skillIds: ['diserbo_manuale', 'diserbo_meccanico'] },
  { title: 'Altro', skillIds: [SKILL_ID_MANUTENZIONE, SKILL_ID_ALTRO] },
  { title: 'Trasversale', skillIds: [SKILL_ID_GUIDA_TRATTORE] }
]);

const SKILL_LABEL_BY_ID = Object.freeze(
  Object.fromEntries(MANODOPERA_SKILLS_CATALOG.map((s) => [s.id, s.label]))
);

/**
 * @param {string} skillId
 * @returns {string}
 */
export function getManodoperaSkillLabel(skillId) {
  return SKILL_LABEL_BY_ID[skillId] || skillId;
}

/**
 * @param {number} stelle 1–5
 * @returns {string}
 */
export function formatStelleDisplay(stelle) {
  const n = Math.min(5, Math.max(0, Math.round(Number(stelle) || 0)));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

/**
 * Mapping batch ore: contesto registrazione → skillId per aggregazione.
 * @param {{
 *   tipoLavoroNome?: string,
 *   sottocategoriaCodice?: string|null,
 *   categoriaCodice?: string|null,
 *   attrezzo?: Record<string, unknown>|null,
 *   macchinaId?: string|null,
 *   operatoreMacchinaId?: string|null,
 *   ruoloOre?: 'raccolta'|'trasporto'|'guida'|string
 * }} oreContext
 * @returns {string[]}
 */
export function resolveSkillIdsForOreAggregation(oreContext = {}) {
  const base = resolveSkillIdsFromTipoLavoro({
    tipoLavoroNome: oreContext.tipoLavoroNome,
    sottocategoriaCodice: oreContext.sottocategoriaCodice,
    categoriaCodice: oreContext.categoriaCodice
  });

  const ids = new Set(base);

  if (oreContext.ruoloOre === 'trasporto' || oreContext.ruoloOre === 'guida') {
    ids.add(SKILL_ID_GUIDA_TRATTORE);
    if (isVendemmiaTipoLavoroNome(oreContext.tipoLavoroNome)) {
      ids.delete(SKILL_ID_RACCOLTA_MECCANICA);
    }
    return Array.from(ids);
  }

  if (
    (oreContext.macchinaId || oreContext.operatoreMacchinaId) &&
    isVendemmiaTipoLavoroNome(oreContext.tipoLavoroNome) &&
    oreContext.ruoloOre !== 'raccolta'
  ) {
    ids.add(SKILL_ID_GUIDA_TRATTORE);
  }

  if (
    isCarroRaccoltaFruttaAttrezzo(oreContext.attrezzo, {
      tipoLavoroNome: oreContext.tipoLavoroNome
    }) &&
    !isVendemmiaTipoLavoroNome(oreContext.tipoLavoroNome)
  ) {
    ids.add(SKILL_ID_RACCOLTA_MECCANICA);
  }

  return Array.from(ids);
}
