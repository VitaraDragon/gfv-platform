/**
 * Snapshot conteggi dashboard — un fetch per tipo per sessione pagina.
 * @module core/js/dashboard-counts-snapshot
 */

import { parseLavoroDataInizio } from '../services/manodopera-lavori-scope.js';
import {
    loadAffittiUrgentiCount,
    countOreDaValidareFromLavoriDocs,
} from './dashboard-data.js';
import {
    buildSottoScortaBriefingFromProdotti,
    buildGuastiApertiBriefingFromGuasti,
    buildScadenzeUrgentiBriefingFromMacchine,
} from './dashboard-tony-briefing-text.js';
import { countProdottiDaCompletare } from './tony/document-prodotto-reminder.js';
import { countMovimentiPrezzoInAttesa } from './tony/document-register.js';
import {
    countLavoriDaApprovareFromDocs,
    countLavoriSospesiDaRiprendereFromDocs,
} from '../config/tony-proactive-signals.js';
import { dashboardPerfAsync } from './dashboard-perf.js';

/** @type {DashboardCountsSnapshot|null} */
let _cache = null;
/** @type {Promise<DashboardCountsSnapshot|null>|null} */
let _loadPromise = null;
/** @type {string|null} */
let _loadTenantId = null;

/**
 * @typedef {Object} DashboardOperativitaOggi
 * @property {number} programmatiOggi
 * @property {number} inCorso
 * @property {number} oreDaValidare
 */

/**
 * @typedef {Object} DashboardCountsSnapshot
 * @property {string} tenantId
 * @property {number} loadedAt
 * @property {number} sottoScorta
 * @property {number} prodottiDaCompletare
 * @property {number} prezziInAttesa
 * @property {number} guastiAperti
 * @property {number} scadenzeUrgenti
 * @property {number} affittiUrgenti
 * @property {number} affittiTotal
 * @property {number} daPianificare
 * @property {number} lavoriDaApprovare
 * @property {number} lavoriSospesiDaRiprendere
 * @property {number} oreDaValidare
 * @property {boolean} [oreDaValidarePending]
 * @property {DashboardOperativitaOggi} operativitaOggi
 * @property {Promise<void>} [oreRefreshPromise]
 * @property {string} [summarySottoScorta]
 * @property {string} [summaryGuasti]
 * @property {string} [summaryScadenze]
 */

const EMPTY_OPERATIVITA = { programmatiOggi: 0, inCorso: 0, oreDaValidare: 0 };
const ORE_READY_EVENT = 'dashboard-counts-ore-ready';
const PREFETCH_STORAGE_KEY = 'gfv_dashboard_counts_prefetch_v1';
/** TTL prefetch login → dashboard (ms) */
export const DASHBOARD_COUNTS_PREFETCH_TTL_MS = 120 * 1000;

/** @returns {DashboardCountsSnapshot|null} */
export function getDashboardCountsSnapshot() {
    return _cache;
}

export function invalidateDashboardCountsSnapshot() {
    _cache = null;
    _loadPromise = null;
    _loadTenantId = null;
}

export function clearDashboardCountsPrefetch() {
    try {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem(PREFETCH_STORAGE_KEY);
        }
    } catch (_) {
        /* ignore */
    }
}

/**
 * @param {DashboardCountsSnapshot} snapshot
 */
function serializeSnapshotForPrefetch(snapshot) {
    return {
        tenantId: snapshot.tenantId,
        loadedAt: snapshot.loadedAt,
        sottoScorta: snapshot.sottoScorta,
        prodottiDaCompletare: snapshot.prodottiDaCompletare || 0,
        prezziInAttesa: snapshot.prezziInAttesa || 0,
        guastiAperti: snapshot.guastiAperti,
        scadenzeUrgenti: snapshot.scadenzeUrgenti,
        affittiUrgenti: snapshot.affittiUrgenti,
        affittiTotal: snapshot.affittiTotal,
        daPianificare: snapshot.daPianificare,
        oreDaValidare: snapshot.oreDaValidare,
        oreDaValidarePending: !!snapshot.oreDaValidarePending,
        operativitaOggi: Object.assign({}, EMPTY_OPERATIVITA, snapshot.operativitaOggi || {}),
        summarySottoScorta: snapshot.summarySottoScorta || '',
        summaryGuasti: snapshot.summaryGuasti || '',
        summaryScadenze: snapshot.summaryScadenze || '',
    };
}

/**
 * @param {DashboardCountsSnapshot} snapshot
 */
function persistPrefetchSnapshot(snapshot) {
    if (!snapshot || !snapshot.tenantId) return;
    try {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(
                PREFETCH_STORAGE_KEY,
                JSON.stringify(serializeSnapshotForPrefetch(snapshot))
            );
        }
    } catch (e) {
        console.warn('persistPrefetchSnapshot:', e);
    }
}

/**
 * @param {string} tenantId
 * @returns {DashboardCountsSnapshot|null}
 */
function hydratePrefetchSnapshot(tenantId) {
    try {
        if (typeof sessionStorage === 'undefined') return null;
        const raw = sessionStorage.getItem(PREFETCH_STORAGE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || data.tenantId !== tenantId) return null;
        const age = Date.now() - (data.loadedAt || 0);
        if (age > DASHBOARD_COUNTS_PREFETCH_TTL_MS) return null;
        return Object.assign({}, data, {
            operativitaOggi: Object.assign({}, EMPTY_OPERATIVITA, data.operativitaOggi || {}),
            oreDaValidarePending: !!data.oreDaValidarePending,
        });
    } catch (_) {
        return null;
    }
}

/**
 * @param {import('firebase/firestore').QueryDocumentSnapshot[]} docs
 */
function computeLavoriCountsFromDocs(docs) {
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);

    let daPianificare = 0;
    let programmatiOggi = 0;
    let inCorso = 0;

    docs.forEach((docSnap) => {
        const lav = docSnap.data() || {};
        const stato = String(lav.stato || '').toLowerCase();

        if (stato === 'da_pianificare') daPianificare += 1;
        if (stato === 'completato' || stato === 'annullato' || stato === 'sospeso') return;

        if (stato === 'in_corso') inCorso += 1;

        const start = parseLavoroDataInizio(lav.dataInizio);
        if (!start || Number.isNaN(start.getTime())) return;
        start.setHours(0, 0, 0, 0);
        if (start.getTime() !== oggi.getTime()) return;

        if (
            stato === 'assegnato' ||
            stato === 'programmato' ||
            stato === 'pianificato' ||
            stato === 'da_iniziare' ||
            stato === 'da_pianificare'
        ) {
            programmatiOggi += 1;
        }
    });

    return { daPianificare, programmatiOggi, inCorso };
}

/**
 * @param {string} tenantId
 * @param {import('firebase/firestore').QueryDocumentSnapshot[]} lavoriDocs
 * @param {Object} dependencies
 * @param {DashboardCountsSnapshot} result
 * @returns {Promise<void>}
 */
async function refreshOreDaValidareInSnapshot(tenantId, lavoriDocs, dependencies, result) {
    const v = await dashboardPerfAsync('counts.oreDaValidare', () =>
        countOreDaValidareFromLavoriDocs(tenantId, lavoriDocs, dependencies)
    );
    result.oreDaValidare = v || 0;
    result.operativitaOggi.oreDaValidare = v || 0;
    result.oreDaValidarePending = false;

    if (_cache && _cache.tenantId === tenantId) {
        _cache.oreDaValidare = result.oreDaValidare;
        _cache.operativitaOggi.oreDaValidare = result.oreDaValidare;
        _cache.oreDaValidarePending = false;
    }

    try {
        window.dispatchEvent(
            new CustomEvent(ORE_READY_EVENT, {
                detail: {
                    tenantId,
                    oreDaValidare: result.oreDaValidare,
                    operativitaOggi: { ...result.operativitaOggi },
                },
            })
        );
    } catch (_) {
        /* ignore */
    }
}

export async function awaitDashboardCountsSnapshot(tenantId) {
    if (!tenantId) return getDashboardCountsSnapshot();
    if (_loadPromise && _loadTenantId === tenantId) {
        try {
            await _loadPromise;
        } catch (_) {
            /* ignore */
        }
    }
    const snap = getDashboardCountsSnapshot();
    if (snap && snap.tenantId === tenantId) return snap;
    return null;
}

/**
 * @param {string} tenantId
 * @param {{ availableModules?: string[], hasManodopera?: boolean, hasContoTerzi?: boolean }} ctx
 * @param {Object} dependencies
 * @returns {Promise<DashboardCountsSnapshot|null>}
 */
export async function loadDashboardCountsSnapshot(tenantId, ctx, dependencies) {
    if (!tenantId) return null;
    if (_cache && _cache.tenantId === tenantId) return _cache;
    if (_loadPromise && _loadTenantId === tenantId) return _loadPromise;

    const prefetched = hydratePrefetchSnapshot(tenantId);
    if (prefetched && !_cache) {
        _cache = prefetched;
    }

    _loadTenantId = tenantId;
    _loadPromise = buildSnapshot(tenantId, ctx, dependencies)
        .then((snap) => {
            _cache = snap;
            persistPrefetchSnapshot(snap);
            applyDashboardCountsToDom(snap);
            return snap;
        })
        .finally(() => {
            _loadPromise = null;
            _loadTenantId = null;
        });

    if (prefetched) {
        return prefetched;
    }

    return _loadPromise;
}

/**
 * Prefetch al login: carica snapshot e persiste in sessionStorage per il redirect.
 * @param {string} tenantId
 * @param {{ availableModules?: string[], hasManodopera?: boolean, hasContoTerzi?: boolean }} ctx
 * @param {Object} dependencies
 * @returns {Promise<DashboardCountsSnapshot|null>}
 */
export async function prefetchDashboardCountsSnapshot(tenantId, ctx, dependencies) {
    if (!tenantId) return null;
    invalidateDashboardCountsSnapshot();
    clearDashboardCountsPrefetch();
    const snap = await loadDashboardCountsSnapshot(tenantId, ctx, dependencies);
    if (snap) persistPrefetchSnapshot(snap);
    return snap;
}

/**
 * @param {string} tenantId
 * @param {{ availableModules?: string[], hasManodopera?: boolean, hasContoTerzi?: boolean }} ctx
 * @param {Object} dependencies
 * @returns {Promise<DashboardCountsSnapshot>}
 */
async function buildSnapshot(tenantId, ctx, dependencies) {
    const mods = Array.isArray(ctx && ctx.availableModules) ? ctx.availableModules : [];
    const hasManodopera = !!(ctx && ctx.hasManodopera);
    const hasContoTerzi = !!(ctx && ctx.hasContoTerzi);
    const hasMagazzino = mods.includes('magazzino');
    const hasMacchine = mods.includes('parcoMacchine');

    /** @type {DashboardCountsSnapshot} */
    const result = {
        tenantId,
        loadedAt: Date.now(),
        sottoScorta: 0,
        prodottiDaCompletare: 0,
        prezziInAttesa: 0,
        guastiAperti: 0,
        scadenzeUrgenti: 0,
        affittiUrgenti: 0,
        affittiTotal: 0,
        daPianificare: 0,
        lavoriDaApprovare: 0,
        lavoriSospesiDaRiprendere: 0,
        oreDaValidare: 0,
        oreDaValidarePending: false,
        operativitaOggi: { ...EMPTY_OPERATIVITA },
    };

    const tasks = [];

    tasks.push(
        loadAffittiUrgentiCount(dependencies, tenantId).then(({ urgentCount, totalAffitti }) => {
            result.affittiUrgenti = urgentCount || 0;
            result.affittiTotal = totalAffitti || 0;
        })
    );

    const { db, collection, getDocs } = dependencies;

    if (hasMagazzino && db && collection && getDocs) {
        tasks.push(
            getDocs(collection(db, 'tenants', tenantId, 'prodotti')).then((snap) => {
                const rows = snap.docs.map(function (d) {
                    return Object.assign({ id: d.id }, d.data());
                });
                const briefing = buildSottoScortaBriefingFromProdotti(snap.docs);
                result.sottoScorta = briefing.count || 0;
                result.summarySottoScorta = briefing.summarySottoScorta || '';
                result.prodottiDaCompletare = countProdottiDaCompletare(rows) || 0;
            })
        );
        tasks.push(
            (async function () {
                const { query, where } = dependencies;
                let movDocs = [];
                try {
                    if (typeof query === 'function' && typeof where === 'function') {
                        const q = query(
                            collection(db, 'tenants', tenantId, 'movimentiMagazzino'),
                            where('prezzoInAttesa', '==', true)
                        );
                        const snap = await getDocs(q);
                        movDocs = snap.docs.map(function (d) {
                            return Object.assign({ id: d.id }, d.data());
                        });
                    } else {
                        const snap = await getDocs(collection(db, 'tenants', tenantId, 'movimentiMagazzino'));
                        movDocs = snap.docs.map(function (d) {
                            return Object.assign({ id: d.id }, d.data());
                        });
                    }
                } catch (err) {
                    console.warn('[dashboard-counts] prezziInAttesa query fallback:', err && err.message);
                    try {
                        const snap = await getDocs(collection(db, 'tenants', tenantId, 'movimentiMagazzino'));
                        movDocs = snap.docs.map(function (d) {
                            return Object.assign({ id: d.id }, d.data());
                        });
                    } catch (e2) {
                        movDocs = [];
                    }
                }
                result.prezziInAttesa = countMovimentiPrezzoInAttesa(movDocs) || 0;
            })()
        );
    }

    if (hasMacchine && db && collection && getDocs) {
        tasks.push(
            Promise.all([
                getDocs(collection(db, 'tenants', tenantId, 'macchine')),
                getDocs(collection(db, 'tenants', tenantId, 'guasti')),
            ]).then(function (pair) {
                const macchineSnap = pair[0];
                const guastiSnap = pair[1];
                const macchineList = macchineSnap.docs.map(function (d) {
                    return Object.assign({ id: d.id }, d.data());
                });
                const scadenzeBrief = buildScadenzeUrgentiBriefingFromMacchine(macchineSnap.docs);
                const guastiBrief = buildGuastiApertiBriefingFromGuasti(guastiSnap.docs, macchineList);
                result.scadenzeUrgenti = scadenzeBrief.count || 0;
                result.summaryScadenze = scadenzeBrief.summaryScadenze || '';
                result.guastiAperti = guastiBrief.count || 0;
                result.summaryGuasti = guastiBrief.summaryGuasti || '';
            })
        );
    }

    let oreRefreshPromise = Promise.resolve();

    if (hasManodopera) {
        const { db, collection, getDocs } = dependencies;
        const lavoriDocsPromise = getDocs(collection(db, `tenants/${tenantId}/lavori`)).then((snap) => snap.docs);

        tasks.push(
            lavoriDocsPromise.then((docs) => {
                const derived = computeLavoriCountsFromDocs(docs);
                if (hasContoTerzi) result.daPianificare = derived.daPianificare;
                result.operativitaOggi.programmatiOggi = derived.programmatiOggi;
                result.operativitaOggi.inCorso = derived.inCorso;
                result.lavoriDaApprovare = countLavoriDaApprovareFromDocs(docs);
                result.lavoriSospesiDaRiprendere = countLavoriSospesiDaRiprendereFromDocs(docs);
            })
        );

        result.oreDaValidarePending = true;
        oreRefreshPromise = lavoriDocsPromise
            .then((docs) => refreshOreDaValidareInSnapshot(tenantId, docs, dependencies, result))
            .catch((e) => {
                console.warn('refreshOreDaValidareInSnapshot:', e);
                result.oreDaValidarePending = false;
            });
    }

    await Promise.all(tasks);
    result.oreRefreshPromise = oreRefreshPromise;
    return result;
}

/**
 * Applica conteggi snapshot al DOM (badge magazzino menu + evento).
 * @param {DashboardCountsSnapshot|null|undefined} snapshot
 */
export function applyDashboardCountsToDom(snapshot) {
    if (!snapshot) return;
    const n = snapshot.sottoScorta != null ? snapshot.sottoScorta : 0;
    if (
        typeof window !== 'undefined' &&
        window.GFVDashboardSections &&
        typeof window.GFVDashboardSections.updateMagazzinoSottoScortaBadge === 'function'
    ) {
        window.GFVDashboardSections.updateMagazzinoSottoScortaBadge(n);
    }
    try {
        window.dispatchEvent(
            new CustomEvent('dashboard-counts-ready', { detail: { sottoScortaMagazzino: n } })
        );
    } catch (_) {
        /* ignore */
    }
}

export { ORE_READY_EVENT };
