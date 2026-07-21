/**
 * Catalogo segnali reminder proattivi Tony (§15.6).
 * Nuovo modulo/segnale = nuova voce qui (+ eventuale collector), non if nel widget.
 * Hub entry: `hubIds` (dashboard + home modulo). Stesse fasce §15.5.
 * @module core/config/tony-proactive-signals
 */

/**
 * @typedef {Object} TonyProactiveSignalDef
 * @property {string} id
 * @property {string[]} moduleIds
 * @property {string[]} roles
 * @property {number} priority
 * @property {boolean} enabled
 * @property {string} labelSingular
 * @property {string} labelPlural
 * @property {string[]} [hubIds]  dove mostrare il segnale (dashboard / hub modulo)
 * @property {string} [openPageTarget]
 * @property {string} [openPageLabel]
 * @property {string} [openPageQuery] querystring da appendere a APRI_PAGINA (es. prezzoInAttesa=1)
 * @property {'ops'|'meteo'} [kind]
 */

/**
 * Hub entry point (home modulo o pagina “ingresso”).
 * @typedef {{ id: string, label: string, requireTonyAdvanced?: boolean }} TonyProactiveHubDef
 */

/** @type {Record<string, TonyProactiveHubDef>} */
export const TONY_PROACTIVE_HUBS = {
  dashboard: { id: 'dashboard', label: 'Dashboard', requireTonyAdvanced: true },
  manodopera: { id: 'manodopera', label: 'Manodopera', requireTonyAdvanced: true },
  magazzino: { id: 'magazzino', label: 'Magazzino', requireTonyAdvanced: true },
  vendemmia: { id: 'vendemmia', label: 'Vendemmia', requireTonyAdvanced: true },
  frutteto: { id: 'frutteto', label: 'Frutteto', requireTonyAdvanced: true },
  parcoMacchine: { id: 'parcoMacchine', label: 'Parco macchine', requireTonyAdvanced: true },
  contoTerzi: { id: 'contoTerzi', label: 'Conto terzi', requireTonyAdvanced: true },
};

/** @type {TonyProactiveSignalDef[]} */
export const TONY_PROACTIVE_SIGNALS = [
  {
    id: 'oreDaValidare',
    moduleIds: ['manodopera'],
    roles: ['manager', 'amministratore'],
    priority: 10,
    enabled: true,
    hubIds: ['dashboard', 'manodopera'],
    labelSingular: 'lavoro con ore da validare',
    labelPlural: 'lavori con ore da validare',
    openPageTarget: 'validazione ore',
    openPageLabel: 'Validazione ore',
    kind: 'ops',
  },
  {
    id: 'lavoriDaApprovare',
    moduleIds: ['manodopera'],
    roles: ['manager', 'amministratore'],
    priority: 12,
    enabled: true,
    hubIds: ['dashboard', 'manodopera'],
    labelSingular: 'lavoro da approvare',
    labelPlural: 'lavori da approvare',
    openPageTarget: 'lavori',
    openPageLabel: 'Gestione lavori',
    kind: 'ops',
  },
  {
    id: 'lavoriSospesiDaRiprendere',
    moduleIds: ['manodopera'],
    roles: ['manager', 'amministratore'],
    priority: 14,
    enabled: true,
    hubIds: ['dashboard', 'manodopera'],
    labelSingular: 'lavoro sospeso da riprendere',
    labelPlural: 'lavori sospesi da riprendere',
    openPageTarget: 'lavori',
    openPageLabel: 'Gestione lavori',
    kind: 'ops',
  },
  {
    id: 'lavoriInCorso',
    moduleIds: ['manodopera', 'contoTerzi'],
    roles: ['manager', 'amministratore'],
    priority: 15,
    enabled: true,
    hubIds: ['dashboard', 'manodopera', 'contoTerzi'],
    labelSingular: 'lavoro in corso',
    labelPlural: 'lavori in corso',
    openPageTarget: 'lavori',
    openPageLabel: 'Gestione lavori',
    kind: 'ops',
  },
  {
    id: 'lavoriDaPianificare',
    moduleIds: ['manodopera', 'contoTerzi'],
    roles: ['manager', 'amministratore'],
    priority: 18,
    enabled: true,
    hubIds: ['dashboard', 'manodopera', 'contoTerzi'],
    labelSingular: 'lavoro da pianificare',
    labelPlural: 'lavori da pianificare',
    openPageTarget: 'lavori',
    openPageLabel: 'Gestione lavori',
    kind: 'ops',
  },
  {
    id: 'preventiviAperti',
    moduleIds: ['contoTerzi'],
    roles: ['manager', 'amministratore'],
    priority: 16,
    enabled: true,
    hubIds: ['contoTerzi'],
    labelSingular: 'preventivo aperto',
    labelPlural: 'preventivi aperti',
    openPageTarget: 'preventivi',
    openPageLabel: 'Preventivi',
    kind: 'ops',
  },
  {
    id: 'prodottiDaCompletare',
    moduleIds: ['magazzino'],
    roles: ['manager', 'amministratore'],
    priority: 20,
    enabled: true,
    hubIds: ['dashboard', 'magazzino'],
    labelSingular: 'prodotto da completare in anagrafica',
    labelPlural: 'prodotti da completare in anagrafica',
    openPageTarget: 'prodotti',
    openPageLabel: 'Prodotti',
    kind: 'ops',
  },
  {
    id: 'prezziInAttesa',
    moduleIds: ['magazzino'],
    roles: ['manager', 'amministratore'],
    priority: 22,
    enabled: true,
    hubIds: ['dashboard', 'magazzino'],
    labelSingular: 'entrata magazzino ancora senza prezzo (bolla in attesa di fattura)',
    labelPlural: 'entrate magazzino ancora senza prezzo (bolle in attesa di fattura)',
    openPageTarget: 'movimenti',
    openPageLabel: 'Movimenti',
    openPageQuery: 'prezzoInAttesa=1',
    kind: 'ops',
  },
  {
    id: 'sottoScorta',
    moduleIds: ['magazzino'],
    roles: ['manager', 'amministratore'],
    priority: 30,
    enabled: true,
    hubIds: ['dashboard', 'magazzino'],
    labelSingular: 'prodotto sotto scorta',
    labelPlural: 'prodotti sotto scorta',
    openPageTarget: 'prodotti',
    openPageLabel: 'Prodotti',
    kind: 'ops',
  },
  {
    id: 'affittiUrgenti',
    moduleIds: [],
    roles: ['manager', 'amministratore'],
    priority: 35,
    enabled: true,
    hubIds: ['dashboard'],
    labelSingular: 'affitto terreno in scadenza',
    labelPlural: 'affitti terreni in scadenza',
    openPageTarget: 'terreni',
    openPageLabel: 'Terreni',
    kind: 'ops',
  },
  {
    id: 'guastiAperti',
    moduleIds: ['parcoMacchine'],
    roles: ['manager', 'amministratore'],
    priority: 40,
    enabled: true,
    hubIds: ['dashboard', 'parcoMacchine'],
    labelSingular: 'guasto aperto',
    labelPlural: 'guasti aperti',
    openPageTarget: 'guasti',
    openPageLabel: 'Guasti',
    kind: 'ops',
  },
  {
    id: 'scadenzeUrgenti',
    moduleIds: ['parcoMacchine'],
    roles: ['manager', 'amministratore'],
    priority: 50,
    enabled: true,
    hubIds: ['dashboard', 'parcoMacchine'],
    labelSingular: 'scadenza urgente sui mezzi',
    labelPlural: 'scadenze urgenti sui mezzi',
    openPageTarget: 'macchine',
    openPageLabel: 'Parco macchine',
    kind: 'ops',
  },
  {
    id: 'vendemmieIncomplete',
    moduleIds: ['vigneto'],
    roles: ['manager', 'amministratore'],
    priority: 25,
    enabled: true,
    hubIds: ['vendemmia'],
    labelSingular: 'vendemmia da completare',
    labelPlural: 'vendemmie da completare',
    openPageTarget: 'vendemmia',
    openPageLabel: 'Gestione vendemmia',
    kind: 'ops',
  },
  {
    id: 'raccolteIncomplete',
    moduleIds: ['frutteto'],
    roles: ['manager', 'amministratore'],
    priority: 26,
    enabled: true,
    hubIds: ['frutteto'],
    labelSingular: 'raccolta da completare',
    labelPlural: 'raccolte da completare',
    openPageTarget: 'raccolta frutta',
    openPageLabel: 'Raccolta frutta',
    kind: 'ops',
  },
  {
    id: 'meteoConsigli',
    moduleIds: ['meteo'],
    roles: ['manager', 'amministratore'],
    priority: 90,
    enabled: true,
    hubIds: ['dashboard'],
    labelSingular: 'consiglio meteo operativo',
    labelPlural: 'consigli meteo operativi',
    kind: 'meteo',
  },
];

/** TTL offerta «apri pagina» dopo briefing (ms). */
export const PROACTIVE_OPEN_OFFER_TTL_MS = 15 * 60 * 1000;

export const PROACTIVE_HUB_STORAGE_PREFIX = 'tony.proactiveHub.v1:';

/**
 * @param {string} tenantId
 * @param {string} hubId
 * @returns {string}
 */
export function proactiveHubStorageKey(tenantId, hubId) {
  return (
    PROACTIVE_HUB_STORAGE_PREFIX +
    String(tenantId || '').trim() +
    ':' +
    String(hubId || '').trim()
  );
}

/**
 * @param {string} hubId
 * @returns {TonyProactiveHubDef|null}
 */
export function getProactiveHub(hubId) {
  const id = String(hubId || '').trim();
  return (id && TONY_PROACTIVE_HUBS[id]) || null;
}

/**
 * @returns {string[]}
 */
export function getProactiveSignalIds() {
  return TONY_PROACTIVE_SIGNALS.filter(function (s) {
    return s && s.enabled !== false && s.id;
  }).map(function (s) {
    return s.id;
  });
}

/**
 * @param {string} hubId
 * @returns {string[]}
 */
export function getProactiveSignalIdsForHub(hubId) {
  const hub = String(hubId || '').trim();
  return TONY_PROACTIVE_SIGNALS.filter(function (s) {
    if (!s || s.enabled === false || !s.id) return false;
    const hubs = Array.isArray(s.hubIds) ? s.hubIds : [];
    if (!hub) return true;
    return hubs.indexOf(hub) >= 0;
  }).map(function (s) {
    return s.id;
  });
}

/**
 * @param {string} id
 * @returns {TonyProactiveSignalDef|null}
 */
export function getProactiveSignalById(id) {
  const hit = TONY_PROACTIVE_SIGNALS.find(function (s) {
    return s && s.id === id;
  });
  return hit || null;
}

/**
 * @param {string} id
 * @returns {{ singular: string, plural: string }}
 */
export function getProactiveSignalLabels(id) {
  const s = getProactiveSignalById(id);
  if (!s) return { singular: String(id || ''), plural: String(id || '') };
  return { singular: s.labelSingular, plural: s.labelPlural };
}

/**
 * @param {string[]|null|undefined} modules
 * @param {string} moduleId
 * @returns {boolean}
 */
function hasModule(modules, moduleId) {
  if (!moduleId) return true;
  const mods = Array.isArray(modules) ? modules : [];
  const want = String(moduleId).toLowerCase();
  return mods.some(function (m) {
    return String(m).toLowerCase() === want;
  });
}

/**
 * @param {string[]|null|undefined} roles
 * @param {string[]} requiredRoles
 * @returns {boolean}
 */
function hasAnyRole(roles, requiredRoles) {
  const req = Array.isArray(requiredRoles) ? requiredRoles : [];
  if (!req.length) return true;
  const have = Array.isArray(roles) ? roles : [];
  return req.some(function (r) {
    return have.indexOf(r) >= 0;
  });
}

/**
 * @param {{ availableModules?: string[], roles?: string[], hubId?: string }} ctx
 * @returns {TonyProactiveSignalDef[]}
 */
export function listApplicableProactiveSignals(ctx) {
  const modules = ctx && ctx.availableModules;
  const roles = ctx && ctx.roles;
  const hubId = ctx && ctx.hubId ? String(ctx.hubId).trim() : '';
  return TONY_PROACTIVE_SIGNALS.filter(function (s) {
    if (!s || s.enabled === false) return false;
    if (!hasAnyRole(roles, s.roles)) return false;
    if (hubId) {
      const hubs = Array.isArray(s.hubIds) ? s.hubIds : [];
      if (hubs.length && hubs.indexOf(hubId) < 0) return false;
    }
    const mods = Array.isArray(s.moduleIds) ? s.moduleIds : [];
    if (!mods.length) return true;
    return mods.some(function (mid) {
      return hasModule(modules, mid);
    });
  }).slice().sort(function (a, b) {
    return (a.priority || 100) - (b.priority || 100);
  });
}

/**
 * @param {{
 *   snap?: object|null,
 *   meteoConsigliCount?: number,
 *   meteoConsigli?: number,
 *   sottoScorta?: number,
 *   scadenzeUrgenti?: number,
 *   guastiAperti?: number,
 *   oreDaValidare?: number,
 *   prodottiDaCompletare?: number,
 *   prezziInAttesa?: number,
 *   lavoriInCorso?: number,
 *   lavoriDaPianificare?: number,
 *   lavoriDaApprovare?: number,
 *   lavoriSospesiDaRiprendere?: number,
 *   preventiviAperti?: number,
 *   vendemmieIncomplete?: number,
 *   raccolteIncomplete?: number,
 *   affittiUrgenti?: number
 * }} sources
 * @returns {Record<string, number>}
 */
export function buildRawProactiveCounts(sources) {
  const src = sources && typeof sources === 'object' ? sources : {};
  const snap = src.snap && typeof src.snap === 'object' ? src.snap : null;
  const op = snap && snap.operativitaOggi ? snap.operativitaOggi : null;
  function num() {
    for (var i = 0; i < arguments.length; i++) {
      var n = Number(arguments[i]);
      if (Number.isFinite(n) && n > 0) return Math.floor(n);
    }
    return 0;
  }
  return {
    oreDaValidare: num(src.oreDaValidare, snap && snap.oreDaValidare),
    lavoriDaApprovare: num(src.lavoriDaApprovare, snap && snap.lavoriDaApprovare),
    lavoriSospesiDaRiprendere: num(
      src.lavoriSospesiDaRiprendere,
      snap && snap.lavoriSospesiDaRiprendere
    ),
    lavoriInCorso: num(src.lavoriInCorso, op && op.inCorso),
    lavoriDaPianificare: num(src.lavoriDaPianificare, snap && snap.daPianificare),
    preventiviAperti: num(src.preventiviAperti),
    prodottiDaCompletare: num(src.prodottiDaCompletare, snap && snap.prodottiDaCompletare),
    prezziInAttesa: num(src.prezziInAttesa, snap && snap.prezziInAttesa),
    sottoScorta: num(src.sottoScorta, snap && snap.sottoScorta),
    affittiUrgenti: num(src.affittiUrgenti, snap && snap.affittiUrgenti),
    guastiAperti: num(src.guastiAperti, snap && snap.guastiAperti),
    scadenzeUrgenti: num(src.scadenzeUrgenti, snap && snap.scadenzeUrgenti),
    vendemmieIncomplete: num(src.vendemmieIncomplete),
    raccolteIncomplete: num(src.raccolteIncomplete),
    meteoConsigli: num(src.meteoConsigliCount, src.meteoConsigli),
  };
}

/**
 * @param {{ availableModules?: string[], roles?: string[], hubId?: string }} ctx
 * @param {Record<string, number>|object|null|undefined} rawCounts
 */
export function collectProactiveSignals(ctx, rawCounts) {
  const applicable = listApplicableProactiveSignals(ctx || {});
  const raw = rawCounts && typeof rawCounts === 'object' ? rawCounts : {};
  /** @type {Record<string, number>} */
  const fingerprint = {};
  const idScope =
    ctx && ctx.hubId
      ? getProactiveSignalIdsForHub(ctx.hubId)
      : getProactiveSignalIds();
  idScope.forEach(function (id) {
    fingerprint[id] = 0;
  });

  const active = [];
  applicable.forEach(function (signal) {
    const n = Number(raw[signal.id]);
    const count = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    if (Object.prototype.hasOwnProperty.call(fingerprint, signal.id)) {
      fingerprint[signal.id] = count;
    }
    if (count > 0) {
      active.push({ id: signal.id, count: count, signal: signal });
    }
  });

  const opsActive = active.filter(function (a) {
    return (a.signal.kind || 'ops') !== 'meteo';
  });
  const meteoActive = active.filter(function (a) {
    return a.signal.kind === 'meteo';
  });
  const total = active.reduce(function (sum, a) {
    return sum + a.count;
  }, 0);

  return {
    fingerprint: fingerprint,
    active: active,
    total: total,
    opsActive: opsActive,
    meteoActive: meteoActive,
  };
}

/**
 * @typedef {{ id: string, openPageTarget: string, openPageLabel: string, count: number, openPageQuery?: string }} ProactiveOpenFollowUp
 */

export function pickProactiveOpenFollowUp(opsActive) {
  const list = Array.isArray(opsActive) ? opsActive : [];
  for (var i = 0; i < list.length; i++) {
    const item = list[i];
    const sig = item && item.signal;
    if (!sig || !sig.openPageTarget) continue;
    const label = String(sig.openPageLabel || sig.openPageTarget).trim();
    if (!label) continue;
    /** @type {ProactiveOpenFollowUp} */
    const follow = {
      id: sig.id,
      openPageTarget: String(sig.openPageTarget).trim(),
      openPageLabel: label,
      count: item.count || 0,
    };
    if (sig.openPageQuery) follow.openPageQuery = String(sig.openPageQuery).trim();
    return follow;
  }
  return null;
}

export function pickProactiveOpenFollowUpFromDelta(worsened) {
  const list = Array.isArray(worsened) ? worsened : [];
  const asActive = list
    .map(function (w) {
      const sig = getProactiveSignalById(w && w.id);
      if (!sig || (sig.kind || 'ops') === 'meteo') return null;
      return { id: sig.id, count: w.to || 0, signal: sig };
    })
    .filter(Boolean)
    .sort(function (a, b) {
      return (a.signal.priority || 100) - (b.signal.priority || 100);
    });
  return pickProactiveOpenFollowUp(asActive);
}

export function formatProactiveOpenFollowUpOffer(followUp) {
  if (!followUp || !followUp.openPageLabel) return '';
  return (
    ' Se vuoi posso aprire ' +
    followUp.openPageLabel +
    ': dimmi «apri».'
  );
}

/**
 * @param {Array<{ id: string, count: number, signal: TonyProactiveSignalDef }>} opsActive
 * @param {ProactiveOpenFollowUp|null|undefined} [followUp]
 * @param {{ hubLabel?: string, offerRiassunto?: boolean }} [opts]
 * @returns {string}
 */
export function formatProactiveOpsAttentionSnippet(opsActive, followUp, opts) {
  const list = Array.isArray(opsActive) ? opsActive : [];
  if (!list.length) return '';
  const hubLabel = opts && opts.hubLabel ? String(opts.hubLabel).trim() : '';
  const offerRiassunto = !(opts && opts.offerRiassunto === false);
  const parts = list.map(function (item) {
    const label =
      item.count === 1 ? item.signal.labelSingular : item.signal.labelPlural;
    return item.count + ' ' + label;
  });
  var intro = hubLabel
    ? ' Qui in ' + hubLabel + ': '
    : ' Ho controllato la situazione: ';
  var core = '';
  if (parts.length === 1) {
    core = intro + 'c\'è da considerare ' + parts[0] + '.';
  } else {
    const last = parts[parts.length - 1];
    const head = parts.slice(0, -1).join(', ');
    core =
      intro +
      'ci sono alcune cose che richiedono attenzione — ' +
      head +
      ' e ' +
      last +
      '.';
  }
  if (offerRiassunto) {
    core += ' Vuoi che ti faccia un riassunto o preferisci procedere tu?';
  }
  return core + formatProactiveOpenFollowUpOffer(followUp);
}

/**
 * Risposta se l’utente chiede «riassunto» dopo un reminder hub (niente eco dei soli conteggi).
 * @param {{ hubId?: string }|null|undefined} briefing
 * @param {{ openPageLabel?: string }|null|undefined} openOffer
 * @param {{ hubLabel?: string }|null|undefined} [hub]
 * @returns {string}
 */
export function buildHubProactiveRiassuntoReply(briefing, openOffer, hub) {
  var label =
    (hub && hub.label && String(hub.label).trim()) ||
    (briefing && briefing.hubId ? String(briefing.hubId) : '') ||
    'questo modulo';
  if (label === 'manodopera') label = 'Manodopera';
  if (label === 'magazzino') label = 'Magazzino';
  if (label === 'vendemmia') label = 'Vendemmia';
  if (label === 'frutteto') label = 'Frutteto';
  if (label === 'parcoMacchine') label = 'Parco macchine';
  if (label === 'contoTerzi') label = 'Conto terzi';
  var page =
    openOffer && openOffer.openPageLabel
      ? String(openOffer.openPageLabel).trim()
      : '';
  var base =
    'Su ' +
    label +
    ' i punti sono quelli del reminder — qui non c’è un secondo livello di dettaglio.';
  if (page) {
    return (
      base +
      ' Dimmi «apri» per andare a ' +
      page +
      ', oppure apri la Dashboard per un riassunto completo azienda.'
    );
  }
  return (
    base +
    ' Apri la Dashboard se vuoi un riassunto completo azienda (meteo e altri moduli).'
  );
}

export function normalizeProactiveOpenMsg(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''«»]/g, '')
    .trim();
}

export function tonyWantsProactiveOpenPage(text, opts) {
  opts = opts || {};
  const m = normalizeProactiveOpenMsg(text);
  if (!m) return false;
  if (m === 'si' || m === 'ok' || m === 'okay') return false;

  const offer = opts.offer || null;
  const labelNorm = offer && offer.openPageLabel
    ? normalizeProactiveOpenMsg(offer.openPageLabel)
    : '';
  const targetNorm = offer && offer.openPageTarget
    ? normalizeProactiveOpenMsg(offer.openPageTarget)
    : '';

  if (/^(apri|apriamola|apriamolo|aprila|aprilo)(\s|$)/.test(m)) return true;
  if (/\b(si|ok|okay)\s*,?\s*(apri|portami|vai)\b/.test(m)) return true;
  if (/\b(apri|portami|portami (su|in|a)|vai (a|in|su)|apri (la )?pagina)\b/.test(m)) {
    return true;
  }
  if (labelNorm && m.indexOf(labelNorm) >= 0 && /\b(apri|portami|vai)\b/.test(m)) {
    return true;
  }
  if (targetNorm && m.indexOf(targetNorm) >= 0 && /\b(apri|portami|vai)\b/.test(m)) {
    return true;
  }
  return false;
}

export function isProactiveOpenOfferFresh(offer, nowMs) {
  if (!offer || !offer.openPageTarget) return false;
  const at = Number(offer.at);
  if (!Number.isFinite(at) || at <= 0) return true;
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  return now - at <= PROACTIVE_OPEN_OFFER_TTL_MS;
}

export function createProactiveOpenOffer(followUp) {
  if (!followUp || !followUp.openPageTarget) return null;
  /** @type {{ id: string, openPageTarget: string, openPageLabel: string, count: number, at: number, openPageQuery?: string }} */
  const offer = {
    id: followUp.id || '',
    openPageTarget: followUp.openPageTarget,
    openPageLabel: followUp.openPageLabel || followUp.openPageTarget,
    count: followUp.count || 0,
    at: Date.now(),
  };
  if (followUp.openPageQuery) offer.openPageQuery = String(followUp.openPageQuery).trim();
  return offer;
}

export function formatProactiveOpenAck(offer) {
  const label = offer && offer.openPageLabel ? String(offer.openPageLabel).trim() : '';
  if (!label) return 'Ok, ti porto lì.';
  return 'Ok, ti porto in ' + label + '.';
}

/**
 * Vendemmia incompleta: manca qli, ettari o destinazione (allineato a UI vendemmia).
 * @param {object|null|undefined} v
 * @returns {boolean}
 */
export function isVendemmiaIncompleteRecord(v) {
  if (!v || typeof v !== 'object') return true;
  const qli = v.quantitaQli;
  const ha = v.quantitaEttari;
  const dest = v.destinazione != null ? String(v.destinazione).trim() : '';
  const hasQli = typeof qli === 'number' && !Number.isNaN(qli) && qli > 0;
  const hasHa = typeof ha === 'number' && !Number.isNaN(ha) && ha > 0;
  return !(hasQli && hasHa && dest.length > 0);
}

/**
 * @param {Array<object>} vendemmie
 * @returns {number}
 */
export function countVendemmieIncomplete(vendemmie) {
  return (vendemmie || []).filter(isVendemmiaIncompleteRecord).length;
}

/**
 * Normalizza doc Firestore o plain object lavoro.
 * @param {object} docSnapOrRow
 * @returns {{ id: string, stato: string, ripresaDaLavoroId: string }}
 */
function normalizeLavoroRow(docSnapOrRow) {
  if (!docSnapOrRow || typeof docSnapOrRow !== 'object') {
    return { id: '', stato: '', ripresaDaLavoroId: '' };
  }
  var data =
    typeof docSnapOrRow.data === 'function' ? docSnapOrRow.data() || {} : docSnapOrRow;
  var id =
    docSnapOrRow.id != null
      ? String(docSnapOrRow.id)
      : data.id != null
        ? String(data.id)
        : '';
  return {
    id: id,
    stato: String(data.stato || '').toLowerCase(),
    ripresaDaLavoroId:
      data.ripresaDaLavoroId != null ? String(data.ripresaDaLavoroId).trim() : '',
  };
}

/**
 * Lavori in attesa di approvazione manager (`completato_da_approvare`).
 * @param {Array<object>} docs
 * @returns {number}
 */
export function countLavoriDaApprovareFromDocs(docs) {
  var n = 0;
  (docs || []).forEach(function (row) {
    if (normalizeLavoroRow(row).stato === 'completato_da_approvare') n += 1;
  });
  return n;
}

/**
 * Lavori sospesi senza ripresa già creata (CTA «Crea ripresa»).
 * @param {Array<object>} docs
 * @returns {number}
 */
export function countLavoriSospesiDaRiprendereFromDocs(docs) {
  var list = (docs || []).map(normalizeLavoroRow);
  var ripresaOrigineIds = {};
  list.forEach(function (lav) {
    if (lav.ripresaDaLavoroId) ripresaOrigineIds[lav.ripresaDaLavoroId] = true;
  });
  var n = 0;
  list.forEach(function (lav) {
    if (lav.stato !== 'sospeso') return;
    if (lav.ripresaDaLavoroId) return;
    if (ripresaOrigineIds[lav.id]) return;
    n += 1;
  });
  return n;
}

const PREVENTIVI_APERTI_STATI = [
  'bozza',
  'inviato',
  'accettato_email',
  'accettato_manager',
];

/**
 * @param {object|null|undefined} p
 * @returns {boolean}
 */
export function isPreventivoApertoRecord(p) {
  if (!p || typeof p !== 'object') return false;
  return PREVENTIVI_APERTI_STATI.indexOf(String(p.stato || '').toLowerCase()) >= 0;
}

/**
 * @param {Array<object>} preventivi
 * @returns {number}
 */
export function countPreventiviAperti(preventivi) {
  return (preventivi || []).filter(isPreventivoApertoRecord).length;
}

/**
 * Raccolta incompleta (allineato a RaccoltaFrutta.isCompleta).
 * @param {object|null|undefined} r
 * @returns {boolean}
 */
export function isRaccoltaIncompleteRecord(r) {
  if (!r || typeof r !== 'object') return true;
  const kg = r.quantitaKg != null ? Number(r.quantitaKg) : NaN;
  const ha = r.quantitaEttari != null ? Number(r.quantitaEttari) : NaN;
  const specie = r.specie != null ? String(r.specie).trim() : '';
  const varieta = r.varieta != null ? String(r.varieta).trim() : '';
  return !(
    Number.isFinite(kg) &&
    kg > 0 &&
    Number.isFinite(ha) &&
    ha > 0 &&
    specie.length > 0 &&
    varieta.length > 0
  );
}

/**
 * @param {Array<object>} raccolte
 * @returns {number}
 */
export function countRaccolteIncomplete(raccolte) {
  return (raccolte || []).filter(isRaccoltaIncompleteRecord).length;
}
