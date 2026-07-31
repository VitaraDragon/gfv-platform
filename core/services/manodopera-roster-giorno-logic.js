/**
 * Roster / partecipazioni giornaliere su lavoro.equipaggioGiorno[giornoKey].
 * Pure logic (no Firebase). Non modifica Squadra.operai.
 *
 * Shape slice:
 * {
 *   partecipazioni: [{ operaioId, stato, origine, ruoloSlot, sostitutoDiOperaioId,
 *                      prestitoVersoLavoroId, daManagerId }],
 *   materializzatoIl: string|null,
 *   materializzatoDa: 'auto'|'manager'|null,
 *   assenti: string[],          // audit / compat
 *   sostituzioni: Object[],
 *   prestitiUscita: Object[]
 * }
 *
 * @module core/services/manodopera-roster-giorno-logic
 */

export const ROSTER_STATO_PREVISTO = 'previsto';
export const ROSTER_STATO_ASSENTE = 'assente';
export const ROSTER_STATO_SOSTITUITO = 'sostituito';
export const ROSTER_STATO_PRESTATO_OUT = 'prestato_out';
export const ROSTER_STATO_AGGIUNTO = 'aggiunto';

export const ROSTER_ORIGINE_SQUADRA = 'squadra';
export const ROSTER_ORIGINE_AUTONOMO = 'autonomo';
export const ROSTER_ORIGINE_SOSTITUZIONE = 'sostituzione';
export const ROSTER_ORIGINE_PRESTITO_IN = 'prestito_in';
export const ROSTER_ORIGINE_MANUALE = 'manuale';

/** Stati che contano come presenti attivi sul lavoro quel giorno. */
export const ROSTER_STATI_ATTIVI = Object.freeze([
  ROSTER_STATO_PREVISTO,
  ROSTER_STATO_AGGIUNTO
]);

/**
 * @returns {{ assenti: string[], sostituzioni: Object[], prestitiUscita: Object[],
 *   partecipazioni: Object[], materializzatoIl: null, materializzatoDa: null }}
 */
export function emptyEquipaggioSlice() {
  return {
    assenti: [],
    sostituzioni: [],
    prestitiUscita: [],
    partecipazioni: [],
    shortlistCandidati: [],
    shortlistAggiornataIl: null,
    materializzatoIl: null,
    materializzatoDa: null
  };
}

/**
 * @param {Object|null|undefined} lavoro
 * @param {string} giornoKey
 * @returns {Object}
 */
export function getEquipaggioSlice(lavoro, giornoKey) {
  if (!lavoro?.equipaggioGiorno || !giornoKey) return emptyEquipaggioSlice();
  const slice = lavoro.equipaggioGiorno[giornoKey] || {};
  return {
    assenti: [...(slice.assenti || [])].filter(Boolean),
    sostituzioni: [...(slice.sostituzioni || [])],
    prestitiUscita: [...(slice.prestitiUscita || [])],
    partecipazioni: Array.isArray(slice.partecipazioni)
      ? slice.partecipazioni.map((p) => ({ ...p }))
      : [],
    shortlistCandidati: Array.isArray(slice.shortlistCandidati)
      ? slice.shortlistCandidati.map((c) => ({ ...c }))
      : [],
    shortlistAggiornataIl: slice.shortlistAggiornataIl || null,
    materializzatoIl: slice.materializzatoIl || null,
    materializzatoDa: slice.materializzatoDa || null
  };
}

/**
 * Roster già deciso per il giorno: flag `materializzatoIl` (anche se vuoto dopo A2)
 * oppure partecipazioni presenti (legacy / seed).
 *
 * @param {Object} slice
 * @returns {boolean}
 */
export function isRosterMaterializzato(slice) {
  if (!slice) return false;
  if (slice.materializzatoIl) return true;
  return Array.isArray(slice.partecipazioni) && slice.partecipazioni.length > 0;
}

/**
 * Operai anagrafici previsti (stesso criterio storico di resolvePrevistiOperaioIds).
 *
 * @param {Object|null} lavoro
 * @param {Array<Object>} [squadreList]
 * @returns {string[]}
 */
export function resolveAnagraficaPrevistiIds(lavoro, squadreList = []) {
  if (!lavoro) return [];
  if (lavoro.operaioId) return [lavoro.operaioId];
  if (lavoro.caposquadraId) {
    const squadra = (squadreList || []).find(
      (s) => s.caposquadraId === lavoro.caposquadraId
    );
    return [...(squadra?.operai || [])].filter(Boolean);
  }
  return [];
}

/**
 * @param {string} operaioId
 * @param {Object} lavoro
 * @returns {Object}
 */
function makePartecipazioneSeed(operaioId, lavoro) {
  const origine = lavoro?.operaioId
    ? ROSTER_ORIGINE_AUTONOMO
    : ROSTER_ORIGINE_SQUADRA;
  return {
    operaioId,
    stato: ROSTER_STATO_PREVISTO,
    origine,
    ruoloSlot: null,
    sostitutoDiOperaioId: null,
    prestitoVersoLavoroId: null,
    daManagerId: null
  };
}

/**
 * Applica delta legacy (assenti / sostituzioni / prestiti) sulle partecipazioni seed.
 *
 * @param {Object[]} partecipazioni
 * @param {Object} sliceLegacy
 * @returns {Object[]}
 */
export function applyLegacyDeltaToPartecipazioni(partecipazioni, sliceLegacy = {}) {
  const list = (partecipazioni || []).map((p) => ({ ...p }));
  const byId = new Map(list.map((p) => [p.operaioId, p]));

  for (const aid of sliceLegacy.assenti || []) {
    if (!aid) continue;
    const row = byId.get(aid);
    if (row) {
      if (row.stato === ROSTER_STATO_PREVISTO) {
        row.stato = ROSTER_STATO_ASSENTE;
      }
    } else {
      const neu = {
        operaioId: aid,
        stato: ROSTER_STATO_ASSENTE,
        origine: ROSTER_ORIGINE_SQUADRA,
        ruoloSlot: null,
        sostitutoDiOperaioId: null,
        prestitoVersoLavoroId: null,
        daManagerId: null
      };
      list.push(neu);
      byId.set(aid, neu);
    }
  }

  for (const p of sliceLegacy.prestitiUscita || []) {
    if (!p?.operaioId) continue;
    let row = byId.get(p.operaioId);
    if (!row) {
      row = {
        operaioId: p.operaioId,
        stato: ROSTER_STATO_PRESTATO_OUT,
        origine: ROSTER_ORIGINE_SQUADRA,
        ruoloSlot: null,
        sostitutoDiOperaioId: null,
        prestitoVersoLavoroId: p.versoLavoroId || null,
        daManagerId: p.daManagerId || null
      };
      list.push(row);
      byId.set(p.operaioId, row);
    } else {
      row.stato = ROSTER_STATO_PRESTATO_OUT;
      row.prestitoVersoLavoroId = p.versoLavoroId || row.prestitoVersoLavoroId;
      row.daManagerId = p.daManagerId || row.daManagerId;
    }
  }

  for (const s of sliceLegacy.sostituzioni || []) {
    const assenteId = s?.assenteOperaioId || null;
    const sostId = s?.sostitutoOperaioId;
    if (!sostId) continue;

    if (assenteId && byId.has(assenteId)) {
      const assente = byId.get(assenteId);
      assente.stato = ROSTER_STATO_SOSTITUITO;
      assente.daManagerId = s.assegnatoDa || assente.daManagerId;
    } else if (assenteId && !byId.has(assenteId)) {
      const neu = {
        operaioId: assenteId,
        stato: ROSTER_STATO_SOSTITUITO,
        origine: ROSTER_ORIGINE_SQUADRA,
        ruoloSlot: null,
        sostitutoDiOperaioId: null,
        prestitoVersoLavoroId: null,
        daManagerId: s.assegnatoDa || null
      };
      list.push(neu);
      byId.set(assenteId, neu);
    }

    if (!byId.has(sostId)) {
      const origine = s.impegnoOrigineLavoroId
        ? ROSTER_ORIGINE_PRESTITO_IN
        : ROSTER_ORIGINE_SOSTITUZIONE;
      const neu = {
        operaioId: sostId,
        stato: ROSTER_STATO_AGGIUNTO,
        origine,
        ruoloSlot: null,
        sostitutoDiOperaioId: assenteId,
        prestitoVersoLavoroId: null,
        daManagerId: s.assegnatoDa || null
      };
      list.push(neu);
      byId.set(sostId, neu);
    } else {
      const row = byId.get(sostId);
      row.stato = ROSTER_STATO_AGGIUNTO;
      row.origine =
        row.origine === ROSTER_ORIGINE_SQUADRA || row.origine === ROSTER_ORIGINE_AUTONOMO
          ? row.origine
          : s.impegnoOrigineLavoroId
            ? ROSTER_ORIGINE_PRESTITO_IN
            : ROSTER_ORIGINE_SOSTITUZIONE;
      row.sostitutoDiOperaioId = assenteId || row.sostitutoDiOperaioId;
      row.daManagerId = s.assegnatoDa || row.daManagerId;
    }
  }

  return list;
}

/**
 * Materializza partecipazioni da anagrafica (+ idrata delta legacy se presente).
 * Idempotente se già materializzato (restituisce copia slice).
 *
 * @param {Object} options
 * @param {Object} options.lavoro
 * @param {string} options.giornoKey
 * @param {Array<Object>} [options.squadreList]
 * @param {'auto'|'manager'} [options.materializzatoDa]
 * @param {string|null} [options.materializzatoIl] — ISO string; default now ISO
 * @returns {{ slice: Object, created: boolean }}
 */
export function ensureRosterSlice(options = {}) {
  const {
    lavoro,
    giornoKey,
    squadreList = [],
    materializzatoDa = 'auto',
    materializzatoIl = null
  } = options;

  const existing = getEquipaggioSlice(lavoro, giornoKey);
  if (isRosterMaterializzato(existing)) {
    return { slice: existing, created: false };
  }

  const seedIds = resolveAnagraficaPrevistiIds(lavoro, squadreList);
  let partecipazioni = seedIds.map((id) => makePartecipazioneSeed(id, lavoro));

  // Se esistono solo delta legacy, idrata le partecipazioni
  if (
    existing.assenti.length ||
    existing.sostituzioni.length ||
    existing.prestitiUscita.length
  ) {
    partecipazioni = applyLegacyDeltaToPartecipazioni(partecipazioni, existing);
  }

  // Edge: nessun anagrafico ma ci sono delta (es. solo sostituti) → resta da delta
  if (!partecipazioni.length && (existing.assenti.length || existing.sostituzioni.length)) {
    partecipazioni = applyLegacyDeltaToPartecipazioni([], existing);
  }

  // Seed vuoto senza delta: non marcare materializzato (evita write inutili; A2 setta il flag).
  if (!partecipazioni.length) {
    return { slice: existing, created: false };
  }

  const slice = {
    ...existing,
    partecipazioni,
    materializzatoIl: materializzatoIl || new Date().toISOString(),
    materializzatoDa
  };

  return { slice, created: true };
}

/**
 * @param {Object[]} partecipazioni
 * @param {string} operaioId
 * @returns {Object|null}
 */
function findPartecipazione(partecipazioni, operaioId) {
  return (partecipazioni || []).find((p) => p.operaioId === operaioId) || null;
}

/**
 * Segna assente sul roster (prima della sostituzione o senza sostituto).
 *
 * @param {Object} slice
 * @param {string} assenteOperaioId
 * @param {string|null} [daManagerId]
 * @returns {Object}
 */
export function applyAssenzaToRoster(slice, assenteOperaioId, daManagerId = null) {
  const next = {
    ...slice,
    assenti: [...(slice.assenti || [])],
    sostituzioni: [...(slice.sostituzioni || [])],
    prestitiUscita: [...(slice.prestitiUscita || [])],
    partecipazioni: (slice.partecipazioni || []).map((p) => ({ ...p }))
  };
  if (!assenteOperaioId) return next;

  if (!next.assenti.includes(assenteOperaioId)) {
    next.assenti.push(assenteOperaioId);
  }

  let row = findPartecipazione(next.partecipazioni, assenteOperaioId);
  if (!row) {
    row = {
      operaioId: assenteOperaioId,
      stato: ROSTER_STATO_ASSENTE,
      origine: ROSTER_ORIGINE_SQUADRA,
      ruoloSlot: null,
      sostitutoDiOperaioId: null,
      prestitoVersoLavoroId: null,
      daManagerId: daManagerId || null
    };
    next.partecipazioni.push(row);
  } else if (
    row.stato === ROSTER_STATO_PREVISTO ||
    row.stato === ROSTER_STATO_AGGIUNTO
  ) {
    row.stato = ROSTER_STATO_ASSENTE;
    row.daManagerId = daManagerId || row.daManagerId;
  }

  return next;
}

/**
 * Registra sostituzione sul roster destinazione.
 *
 * @param {Object} slice
 * @param {Object} opts
 * @param {string|null} opts.assenteOperaioId
 * @param {string} opts.sostitutoOperaioId
 * @param {string|null} [opts.assegnatoDa]
 * @param {string|null} [opts.impegnoOrigineLavoroId]
 * @returns {Object}
 */
export function applySostituzioneToRoster(slice, opts = {}) {
  const {
    assenteOperaioId = null,
    sostitutoOperaioId,
    assegnatoDa = null,
    impegnoOrigineLavoroId = null
  } = opts;

  let next = applyAssenzaToRoster(slice, assenteOperaioId, assegnatoDa);
  if (!sostitutoOperaioId) return next;

  if (assenteOperaioId) {
    const assente = findPartecipazione(next.partecipazioni, assenteOperaioId);
    if (assente) assente.stato = ROSTER_STATO_SOSTITUITO;
  }

  next.sostituzioni = [
    ...(next.sostituzioni || []),
    {
      assenteOperaioId,
      sostitutoOperaioId,
      assegnatoDa,
      impegnoOrigineLavoroId: impegnoOrigineLavoroId || null
    }
  ];

  let sost = findPartecipazione(next.partecipazioni, sostitutoOperaioId);
  const origine = impegnoOrigineLavoroId
    ? ROSTER_ORIGINE_PRESTITO_IN
    : ROSTER_ORIGINE_SOSTITUZIONE;
  if (!sost) {
    next.partecipazioni.push({
      operaioId: sostitutoOperaioId,
      stato: ROSTER_STATO_AGGIUNTO,
      origine,
      ruoloSlot: null,
      sostitutoDiOperaioId: assenteOperaioId,
      prestitoVersoLavoroId: null,
      daManagerId: assegnatoDa
    });
  } else {
    sost.stato = ROSTER_STATO_AGGIUNTO;
    sost.origine = origine;
    sost.sostitutoDiOperaioId = assenteOperaioId || sost.sostitutoDiOperaioId;
    sost.daManagerId = assegnatoDa || sost.daManagerId;
  }

  return next;
}

/**
 * A2 — true se il manager può togliere la riga dal roster del giorno
 * (senza passare da assenza/sostituzione/prestito).
 *
 * @param {Object|null} p
 * @returns {boolean}
 */
export function canRemovePartecipazioneManuale(p) {
  if (!p?.operaioId) return false;
  if (p.origine === ROSTER_ORIGINE_MANUALE) {
    return p.stato === ROSTER_STATO_AGGIUNTO || p.stato === ROSTER_STATO_PREVISTO;
  }
  if (p.stato === ROSTER_STATO_PREVISTO) {
    return (
      p.origine === ROSTER_ORIGINE_SQUADRA ||
      p.origine === ROSTER_ORIGINE_AUTONOMO ||
      !p.origine
    );
  }
  return false;
}

/**
 * A2 — aggiunge operaio al roster del giorno (origine manuale).
 * Non modifica Squadra.operai.
 *
 * @param {Object} slice
 * @param {Object} opts
 * @param {string} opts.operaioId
 * @param {string|null} [opts.daManagerId]
 * @returns {Object}
 */
export function addPartecipazioneManuale(slice, opts = {}) {
  const { operaioId, daManagerId = null } = opts;
  if (!operaioId) {
    throw new Error('operaioId obbligatorio');
  }

  const next = {
    ...slice,
    assenti: [...(slice.assenti || [])],
    sostituzioni: [...(slice.sostituzioni || [])],
    prestitiUscita: [...(slice.prestitiUscita || [])],
    partecipazioni: (slice.partecipazioni || []).map((p) => ({ ...p })),
    shortlistCandidati: [...(slice.shortlistCandidati || [])],
    shortlistAggiornataIl: slice.shortlistAggiornataIl || null,
    materializzatoIl: slice.materializzatoIl || null,
    materializzatoDa: slice.materializzatoDa || null
  };

  const existing = findPartecipazione(next.partecipazioni, operaioId);
  if (existing) {
    if (ROSTER_STATI_ATTIVI.includes(existing.stato)) {
      throw new Error('Operaio già presente nel roster di questo lavoro per il giorno');
    }
    throw new Error(
      'Operaio già nel roster in stato non modificabile da qui (usa assenza/sostituzione)'
    );
  }

  next.partecipazioni.push({
    operaioId,
    stato: ROSTER_STATO_AGGIUNTO,
    origine: ROSTER_ORIGINE_MANUALE,
    ruoloSlot: null,
    sostitutoDiOperaioId: null,
    prestitoVersoLavoroId: null,
    daManagerId: daManagerId || null
  });

  if (!next.materializzatoIl) {
    next.materializzatoIl = new Date().toISOString();
    next.materializzatoDa = 'manager';
  } else if (next.materializzatoDa === 'auto') {
    next.materializzatoDa = 'manager';
  }

  return next;
}

/**
 * A2 — rimuove partecipazione giornaliera (previsto anagrafico o aggiunto manuale).
 * Non tocca Squadra.operai né flussi assenza/sostituzione.
 *
 * @param {Object} slice
 * @param {Object} opts
 * @param {string} opts.operaioId
 * @returns {Object}
 */
export function removePartecipazioneManuale(slice, opts = {}) {
  const { operaioId } = opts;
  if (!operaioId) {
    throw new Error('operaioId obbligatorio');
  }

  const next = {
    ...slice,
    assenti: [...(slice.assenti || [])],
    sostituzioni: [...(slice.sostituzioni || [])],
    prestitiUscita: [...(slice.prestitiUscita || [])],
    partecipazioni: (slice.partecipazioni || []).map((p) => ({ ...p })),
    shortlistCandidati: [...(slice.shortlistCandidati || [])],
    shortlistAggiornataIl: slice.shortlistAggiornataIl || null,
    materializzatoIl: slice.materializzatoIl || null,
    materializzatoDa: slice.materializzatoDa || null
  };

  const row = findPartecipazione(next.partecipazioni, operaioId);
  if (!row) {
    throw new Error('Operaio non presente nel roster del giorno');
  }
  if (!canRemovePartecipazioneManuale(row)) {
    throw new Error(
      'Non rimuovibile da qui: gestisci assenza, sostituzione o prestito dal flusso dedicato'
    );
  }

  next.partecipazioni = next.partecipazioni.filter((p) => p.operaioId !== operaioId);
  if (next.materializzatoDa === 'auto') {
    next.materializzatoDa = 'manager';
  }

  return next;
}

/**
 * Buco/prestito in uscita sul lavoro di origine.
 *
 * @param {Object} slice
 * @param {Object} opts
 * @param {string} opts.operaioId
 * @param {string} opts.versoLavoroId
 * @param {string|null} [opts.daManagerId]
 * @returns {Object}
 */
export function applyPrestitoUscitaToRoster(slice, opts = {}) {
  const { operaioId, versoLavoroId, daManagerId = null } = opts;
  let next = applyAssenzaToRoster(slice, operaioId, daManagerId);
  if (!operaioId) return next;

  const row = findPartecipazione(next.partecipazioni, operaioId);
  if (row) {
    row.stato = ROSTER_STATO_PRESTATO_OUT;
    row.prestitoVersoLavoroId = versoLavoroId || null;
    row.daManagerId = daManagerId || row.daManagerId;
  }

  next.prestitiUscita = [
    ...(next.prestitiUscita || []),
    {
      operaioId,
      versoLavoroId: versoLavoroId || null,
      daManagerId
    }
  ];

  return next;
}

/**
 * Ids «previsti» (slot anagrafici / seed), esclusi i soli aggiunti.
 * Se roster materializzato: partecipazioni con origine squadra|autonomo|manuale
 * oppure stato diverso da aggiunto senza essere solo-aggiunto.
 *
 * @param {Object} slice
 * @returns {string[]}
 */
export function getRosterPrevistiIds(slice) {
  if (!isRosterMaterializzato(slice)) return [];
  const ids = [];
  for (const p of slice.partecipazioni) {
    if (!p?.operaioId) continue;
    if (p.stato === ROSTER_STATO_AGGIUNTO && p.origine !== ROSTER_ORIGINE_MANUALE) {
      continue;
    }
    if (
      p.origine === ROSTER_ORIGINE_SOSTITUZIONE ||
      p.origine === ROSTER_ORIGINE_PRESTITO_IN
    ) {
      continue;
    }
    ids.push(p.operaioId);
  }
  return ids;
}

/**
 * @param {Object} slice
 * @returns {string[]}
 */
export function getRosterAttiviIds(slice) {
  if (!isRosterMaterializzato(slice)) return [];
  return slice.partecipazioni
    .filter((p) => p?.operaioId && ROSTER_STATI_ATTIVI.includes(p.stato))
    .map((p) => p.operaioId);
}

/**
 * @param {Object} slice
 * @returns {string[]}
 */
export function getRosterAssentiIds(slice) {
  if (!isRosterMaterializzato(slice)) {
    return [...(slice?.assenti || [])].filter(Boolean);
  }
  return slice.partecipazioni
    .filter((p) =>
      [
        ROSTER_STATO_ASSENTE,
        ROSTER_STATO_SOSTITUITO,
        ROSTER_STATO_PRESTATO_OUT
      ].includes(p.stato)
    )
    .map((p) => p.operaioId)
    .filter(Boolean);
}

/**
 * @param {Object} slice
 * @returns {string[]}
 */
export function getRosterSostitutiIds(slice) {
  if (!isRosterMaterializzato(slice)) {
    return [...(slice?.sostituzioni || [])]
      .map((s) => s.sostitutoOperaioId)
      .filter(Boolean);
  }
  return slice.partecipazioni
    .filter(
      (p) =>
        p.stato === ROSTER_STATO_AGGIUNTO &&
        (p.origine === ROSTER_ORIGINE_SOSTITUZIONE ||
          p.origine === ROSTER_ORIGINE_PRESTITO_IN)
    )
    .map((p) => p.operaioId)
    .filter(Boolean);
}

/**
 * Previsti per lavoro/giorno: roster materializzato se presente, altrimenti anagrafica.
 *
 * @param {Object|null} lavoro
 * @param {Array<Object>} [squadreList]
 * @param {string|null} [giornoKey]
 * @returns {string[]}
 */
export function resolvePrevistiOperaioIdsForGiorno(lavoro, squadreList = [], giornoKey = null) {
  if (!lavoro) return [];
  if (giornoKey) {
    const slice = getEquipaggioSlice(lavoro, giornoKey);
    if (isRosterMaterializzato(slice)) {
      return getRosterPrevistiIds(slice);
    }
  }
  return resolveAnagraficaPrevistiIds(lavoro, squadreList);
}

/**
 * Merge slice aggiornato in equipaggioGiorno del lavoro (puro).
 *
 * @param {Object|null} lavoro
 * @param {string} giornoKey
 * @param {Object} slice
 * @returns {Object}
 */
export function mergeEquipaggioGiornoPatch(lavoro, giornoKey, slice) {
  return {
    ...(lavoro?.equipaggioGiorno || {}),
    [giornoKey]: {
      assenti: [...(slice.assenti || [])],
      sostituzioni: [...(slice.sostituzioni || [])],
      prestitiUscita: [...(slice.prestitiUscita || [])],
      partecipazioni: [...(slice.partecipazioni || [])],
      shortlistCandidati: [...(slice.shortlistCandidati || [])],
      shortlistAggiornataIl: slice.shortlistAggiornataIl || null,
      materializzatoIl: slice.materializzatoIl || null,
      materializzatoDa: slice.materializzatoDa || null
    }
  };
}
