/**
 * Delete a cascata di un lavoro — logica pura (conteggi, conferma, orfani).
 * L'I/O Firestore sta in lavoro-delete-cascade.js.
 *
 * @module core/services/lavoro-delete-cascade-utils
 */

/**
 * @param {unknown} ref
 * @returns {string}
 */
export function normalizeRelatedLavoroId(ref) {
  if (ref == null || ref === '') return '';
  if (typeof ref === 'object') {
    if (typeof ref.id === 'string' && ref.id.trim()) return ref.id.trim();
    if (typeof ref.path === 'string' && ref.path.trim()) {
      const parts = ref.path.split('/').filter(Boolean);
      return parts.length ? parts[parts.length - 1] : '';
    }
  }
  const raw = String(ref).trim();
  if (!raw) return '';
  if (raw.includes('/')) {
    const parts = raw.split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : '';
  }
  return raw;
}

/**
 * @param {unknown} docLavoroId
 * @param {unknown} targetLavoroId
 * @returns {boolean}
 */
export function matchesLavoroId(docLavoroId, targetLavoroId) {
  const a = normalizeRelatedLavoroId(docLavoroId);
  const b = normalizeRelatedLavoroId(targetLavoroId);
  return Boolean(a && b && a === b);
}

/**
 * @param {{ id?: unknown, ripresaDaLavoroId?: unknown }} lavoro
 * @param {unknown} origineId
 * @returns {boolean}
 */
export function isRipresaFigliaDi(lavoro, origineId) {
  const orig = normalizeRelatedLavoroId(origineId);
  const from = normalizeRelatedLavoroId(lavoro?.ripresaDaLavoroId);
  const self = normalizeRelatedLavoroId(lavoro?.id);
  if (!orig || !from) return false;
  if (self && self === orig) return false;
  return from === orig;
}

/**
 * Comunicazione agganciata a un lavoro che non esiste più.
 * Senza lavoroId (broadcast legacy) non è orfana.
 *
 * @param {{ lavoroId?: unknown }} comm
 * @param {Set<string>|string[]|null|undefined} existingLavoroIds
 * @returns {boolean}
 */
export function comunicazioneRiferisceLavoroInesistente(comm, existingLavoroIds) {
  const id = normalizeRelatedLavoroId(comm?.lavoroId);
  if (!id) return false;
  if (!existingLavoroIds) return false;
  const set = existingLavoroIds instanceof Set
    ? existingLavoroIds
    : new Set(Array.from(existingLavoroIds).map((x) => normalizeRelatedLavoroId(x)).filter(Boolean));
  return !set.has(id);
}

/**
 * @param {Array<{ lavoroId?: unknown }>} comms
 * @param {Set<string>|string[]} existingLavoroIds
 * @returns {Array}
 */
export function filterComunicazioniSenzaLavoroMorto(comms, existingLavoroIds) {
  const list = Array.isArray(comms) ? comms : [];
  return list.filter((c) => !comunicazioneRiferisceLavoroInesistente(c, existingLavoroIds));
}

/**
 * @returns {Record<string, number>}
 */
export function emptyRelatedCounts() {
  return {
    ore: 0,
    zone: 0,
    comunicazioni: 0,
    attivita: 0,
    assenze: 0,
    assenzeStandbyUnlink: 0,
    calcoliVm: 0,
    speseVm: 0,
    movimenti: 0,
    vendemmie: 0,
    potature: 0,
    trattamenti: 0,
    raccolte: 0,
    preventivi: 0,
    guasti: 0,
    ripreseFiglie: 0
  };
}

/**
 * @param {Record<string, number>} counts
 * @returns {number}
 */
export function relatedDeletableTotal(counts) {
  const c = counts || emptyRelatedCounts();
  return (
    (c.ore || 0) +
    (c.zone || 0) +
    (c.comunicazioni || 0) +
    (c.attivita || 0) +
    (c.assenze || 0) +
    (c.calcoliVm || 0) +
    (c.speseVm || 0) +
    (c.movimenti || 0) +
    (c.vendemmie || 0) +
    (c.potature || 0) +
    (c.trattamenti || 0) +
    (c.raccolte || 0)
  );
}

const COUNT_LINES = [
  ['ore', 'ora operaio', 'ore operai'],
  ['zone', 'zona lavorata', 'zone lavorate'],
  ['comunicazioni', 'comunicazione', 'comunicazioni'],
  ['attivita', 'voce diario', 'voci diario'],
  ['assenze', 'assenza collegata', 'assenze collegate'],
  ['calcoliVm', 'calcolo vendemmia meccanica', 'calcoli vendemmia meccanica'],
  ['speseVm', 'spesa vendemmia meccanica', 'spese vendemmia meccanica'],
  ['movimenti', 'movimento magazzino', 'movimenti magazzino'],
  ['vendemmie', 'vendemmia', 'vendemmie'],
  ['potature', 'potatura', 'potature'],
  ['trattamenti', 'trattamento', 'trattamenti'],
  ['raccolte', 'raccolta frutta', 'raccolte frutta']
];

/**
 * @param {string} nome
 * @param {Record<string, number>} counts
 * @returns {string}
 */
export function formatLavoroDeleteConfirmMessage(nome, counts) {
  const c = counts || emptyRelatedCounts();
  const titolo = nome ? `"${nome}"` : 'selezionato';
  const lines = [`Sei sicuro di voler eliminare il lavoro ${titolo}?`, ''];
  const extras = [];
  COUNT_LINES.forEach(([key, one, many]) => {
    const n = Number(c[key]) || 0;
    if (n <= 0) return;
    extras.push(`• ${n} ${n === 1 ? one : many}`);
  });
  if (extras.length) {
    lines.push('Verranno eliminati anche:');
    lines.push(...extras);
    lines.push('');
  }
  if ((c.preventivi || 0) > 0) {
    lines.push(
      c.preventivi === 1
        ? 'Il preventivo collegato tornerà accettato (senza lavoro).'
        : `${c.preventivi} preventivi collegati torneranno accettati (senza lavoro).`
    );
  }
  if ((c.guasti || 0) > 0) {
    lines.push(
      c.guasti === 1
        ? '1 segnalazione guasto verrà scollegata dal lavoro.'
        : `${c.guasti} segnalazioni guasto verranno scollegate dal lavoro.`
    );
  }
  if ((c.assenzeStandbyUnlink || 0) > 0) {
    lines.push(
      c.assenzeStandbyUnlink === 1
        ? '1 assenza in standby verrà scollegata (l\'assenza resta).'
        : `${c.assenzeStandbyUnlink} assenze in standby verranno scollegate (le assenze restano).`
    );
  }
  lines.push('Questa azione non può essere annullata.');
  return lines.filter((line, i, arr) => !(line === '' && arr[i - 1] === '')).join('\n');
}

/**
 * @param {Record<string, number>} counts
 * @returns {string}
 */
export function formatLavoroDeleteBlockedByRipreseMessage(counts) {
  const n = Number(counts?.ripreseFiglie) || 0;
  if (n === 1) {
    return 'Impossibile eliminare: esiste un lavoro di ripresa collegato. Elimina prima la ripresa.';
  }
  return `Impossibile eliminare: esistono ${n} lavori di ripresa collegati. Elimina prima le riprese.`;
}

/**
 * @param {{ lavoroId?: unknown, standbyLavoroId?: unknown }} assenza
 * @param {unknown} lavoroId
 * @returns {'delete'|'unlink-standby'|null}
 */
export function assenzaCascadeAction(assenza, lavoroId) {
  if (matchesLavoroId(assenza?.lavoroId, lavoroId)) return 'delete';
  if (matchesLavoroId(assenza?.standbyLavoroId, lavoroId)) return 'unlink-standby';
  return null;
}

/**
 * @param {{ stato?: string, lavoroId?: unknown, calcoloVmId?: unknown }} preventivo
 * @param {Set<string>|string[]} [calcoliVmIdsDaEliminare]
 * @returns {{ lavoroId: null, stato?: string, calcoloVmId?: null }}
 */
export function unlinkPreventivoPatch(preventivo, calcoliVmIdsDaEliminare) {
  const patch = { lavoroId: null };
  if (preventivo?.stato === 'pianificato') {
    patch.stato = 'accettato_manager';
  }
  const calcId = preventivo?.calcoloVmId != null ? String(preventivo.calcoloVmId) : '';
  if (calcId && calcoliVmIdsDaEliminare) {
    const set = calcoliVmIdsDaEliminare instanceof Set
      ? calcoliVmIdsDaEliminare
      : new Set(Array.from(calcoliVmIdsDaEliminare).map(String));
    if (set.has(calcId)) patch.calcoloVmId = null;
  }
  return patch;
}

/**
 * @param {{
 *   lavoroId: unknown,
 *   lavori?: Array<{ id?: unknown, ripresaDaLavoroId?: unknown }>,
 *   ore?: Array,
 *   zone?: Array,
 *   comunicazioni?: Array,
 *   attivita?: Array,
 *   assenze?: Array,
 *   calcoliVm?: Array,
 *   speseVm?: Array,
 *   movimenti?: Array,
 *   vendemmie?: Array,
 *   potature?: Array,
 *   trattamenti?: Array,
 *   raccolte?: Array,
 *   preventivi?: Array,
 *   guasti?: Array
 * }} input
 * @returns {{
 *   blocked: boolean,
 *   reason: string|null,
 *   counts: Record<string, number>,
 *   confirmMessage: string,
 *   blockedMessage: string|null,
 *   ripreseFiglie: Array
 * }}
 */
export function buildLavoroCascadePlan(input) {
  const lavoroId = input?.lavoroId;
  const lavori = Array.isArray(input?.lavori) ? input.lavori : [];
  const ripreseFiglie = lavori.filter((l) => isRipresaFigliaDi(l, lavoroId));
  const counts = emptyRelatedCounts();
  counts.ore = (input?.ore || []).length;
  counts.zone = (input?.zone || []).length;
  counts.comunicazioni = (input?.comunicazioni || []).length;
  counts.attivita = (input?.attivita || []).length;
  counts.calcoliVm = (input?.calcoliVm || []).length;
  counts.speseVm = (input?.speseVm || []).length;
  counts.movimenti = (input?.movimenti || []).length;
  counts.vendemmie = (input?.vendemmie || []).length;
  counts.potature = (input?.potature || []).length;
  counts.trattamenti = (input?.trattamenti || []).length;
  counts.raccolte = (input?.raccolte || []).length;
  counts.preventivi = (input?.preventivi || []).length;
  counts.guasti = (input?.guasti || []).length;
  counts.ripreseFiglie = ripreseFiglie.length;

  (input?.assenze || []).forEach((a) => {
    const action = assenzaCascadeAction(a, lavoroId);
    if (action === 'delete') counts.assenze += 1;
    else if (action === 'unlink-standby') counts.assenzeStandbyUnlink += 1;
  });

  const nome = input?.lavoroNome || input?.lavoro?.nome || '';
  if (ripreseFiglie.length > 0) {
    return {
      blocked: true,
      reason: 'riprese_figlie',
      counts,
      confirmMessage: '',
      blockedMessage: formatLavoroDeleteBlockedByRipreseMessage(counts),
      ripreseFiglie
    };
  }
  return {
    blocked: false,
    reason: null,
    counts,
    confirmMessage: formatLavoroDeleteConfirmMessage(nome, counts),
    blockedMessage: null,
    ripreseFiglie: []
  };
}
