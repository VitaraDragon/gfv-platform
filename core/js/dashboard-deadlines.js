/**
 * Widget dashboard: Scadenze amministrazione + In arrivo (operativo).
 * @module core/js/dashboard-deadlines
 */

import {
    calcolaAlertAffitto,
    formattaDataScadenza,
    loadLavoriDaPianificareCount,
    countOreDaValidareManager
} from './dashboard-data.js';
import { getDashboardCountsSnapshot, ORE_READY_EVENT } from './dashboard-counts-snapshot.js';
import { dashboardPerfAsync } from './dashboard-perf.js';

const MAX_RIGHE = 8;

function toDate(val) {
    if (!val) return null;
    if (val.toDate) return val.toDate();
    if (val instanceof Date) return val;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Urgenza per scadenze a data (allineato a liste scadenze / affitti).
 * @returns {{ colore: string, testo: string, giorni: number|null, priorita: number }}
 */
export function calcolaUrgenzaData(dataScadenza) {
    const scadenza = toDate(dataScadenza);
    if (!scadenza) {
        return { colore: 'green', testo: '—', giorni: null, priorita: 3 };
    }
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    scadenza.setHours(0, 0, 0, 0);
    const giorni = Math.ceil((scadenza - oggi) / (1000 * 60 * 60 * 24));

    if (giorni < 0) return { colore: 'black', testo: 'Scaduto', giorni, priorita: 0 };
    if (giorni <= 7) return { colore: 'red', testo: `${giorni} gg`, giorni, priorita: 1 };
    if (giorni <= 30) return { colore: 'yellow', testo: `${giorni} gg`, giorni, priorita: 2 };
    if (giorni <= 180) return { colore: 'green', testo: `~${Math.floor(giorni / 30)} mesi`, giorni, priorita: 3 };
    return { colore: 'green', testo: `~${Math.floor(giorni / 30)} mesi`, giorni, priorita: 3 };
}

function calcolaUrgenzaOre(oreAttuali, sogliaOre) {
    const ore = oreAttuali != null ? parseFloat(oreAttuali) : 0;
    const soglia = sogliaOre != null ? parseFloat(sogliaOre) : null;
    if (soglia == null || isNaN(soglia)) {
        return { colore: 'green', testo: '—', giorni: null, priorita: 3 };
    }
    const rimanenti = soglia - ore;
    if (rimanenti <= 0) return { colore: 'black', testo: 'Superato', giorni: 0, priorita: 0 };
    if (rimanenti < 15) return { colore: 'red', testo: '< 15 ore', giorni: rimanenti, priorita: 1 };
    if (rimanenti < 50) return { colore: 'yellow', testo: '< 50 ore', giorni: rimanenti, priorita: 2 };
    return { colore: 'green', testo: 'Ok', giorni: rimanenti, priorita: 3 };
}

function nomeMacchina(m) {
    return m.nome || m.targa || m.id || 'Mezzo';
}

function ordinaItems(items) {
    return items.slice().sort((a, b) => {
        if (a.priorita !== b.priorita) return a.priorita - b.priorita;
        const ga = a.giorniSort != null ? a.giorniSort : 99999;
        const gb = b.giorniSort != null ? b.giorniSort : 99999;
        return ga - gb;
    });
}

/** Priorità ordinamento affitti — stessa logica di Terreni / `calcolaAlertAffitto`. */
function prioritaDaAlertAffitto(colore) {
    const order = { grey: 0, red: 1, yellow: 2, green: 3 };
    return order[colore] != null ? order[colore] : 3;
}

/** In widget ammin: tutti gli affitti; revisioni/assicurazioni solo se urgenti. */
function filterItemsScadenzeAmmin(items) {
    const affitti = items.filter((it) => it.tipoLabel === 'Affitto');
    const mezzi = items.filter((it) => it.tipoLabel !== 'Affitto' && it.priorita <= 2);
    return ordinaItems(affitti.concat(mezzi));
}

/**
 * @param {string} tenantId
 * @param {string[]} availableModules
 * @param {Object} dependencies
 * @returns {Promise<Array>}
 */
export async function fetchScadenzeAmministrazioneItems(tenantId, availableModules, dependencies) {
    const { db, collection, getDocs } = dependencies;
    const items = [];
    if (!tenantId) return items;

    const mods = Array.isArray(availableModules) ? availableModules : [];
    const hasParcoMacchine = mods.includes('parcoMacchine');

    try {
        const terreniSnap = await getDocs(collection(db, `tenants/${tenantId}/terreni`));
        terreniSnap.forEach((docSnap) => {
            const t = docSnap.data();
            if (t.clienteId && t.clienteId !== '') return;
            if ((t.tipoPossesso || '').toLowerCase() !== 'affitto' || !t.dataScadenzaAffitto) return;

            const alert = calcolaAlertAffitto(t.dataScadenzaAffitto);
            if (!alert.colore) return;
            items.push({
                priorita: prioritaDaAlertAffitto(alert.colore),
                giorniSort: alert.giorni != null ? alert.giorni : 99999,
                colore: alert.colore,
                tipoLabel: 'Affitto',
                titolo: t.nome || 'Terreno',
                dettaglio: formattaDataScadenza(t.dataScadenzaAffitto) + (alert.testo ? ` (${alert.testo})` : ''),
                href: 'terreni-standalone.html'
            });
        });
    } catch (e) {
        console.warn('fetchScadenzeAmministrazioneItems terreni:', e);
    }

    if (hasParcoMacchine) {
        try {
            const macchineSnap = await getDocs(collection(db, `tenants/${tenantId}/macchine`));
            macchineSnap.forEach((docSnap) => {
                const m = docSnap.data();
                const id = docSnap.id;
                const label = nomeMacchina(m);

                if (m.prossimaRevisione != null) {
                    const urg = calcolaUrgenzaData(m.prossimaRevisione);
                    items.push({
                        priorita: urg.priorita,
                        giorniSort: urg.giorni,
                        colore: urg.colore,
                        tipoLabel: 'Revisione',
                        titolo: label,
                        dettaglio: formattaDataScadenza(m.prossimaRevisione) + (urg.testo ? ` · ${urg.testo}` : ''),
                        href: '../modules/macchine/views/scadenze-list-standalone.html'
                    });
                }
                if (m.prossimaAssicurazione != null) {
                    const urg = calcolaUrgenzaData(m.prossimaAssicurazione);
                    items.push({
                        priorita: urg.priorita,
                        giorniSort: urg.giorni,
                        colore: urg.colore,
                        tipoLabel: 'Assicurazione',
                        titolo: label,
                        dettaglio: formattaDataScadenza(m.prossimaAssicurazione) + (urg.testo ? ` · ${urg.testo}` : ''),
                        href: '../modules/macchine/views/scadenze-list-standalone.html'
                    });
                }
            });
        } catch (e) {
            console.warn('fetchScadenzeAmministrazioneItems macchine:', e);
        }
    }

    return ordinaItems(items);
}

/**
 * @param {string} tenantId
 * @param {{ hasManodopera: boolean, hasContoTerzi: boolean, availableModules: string[] }} opts
 * @param {Object} dependencies
 * @param {Object} [countsSnapshot]
 */
export async function fetchInArrivoItems(tenantId, opts, dependencies, countsSnapshot) {
    const { db, collection, getDocs } = dependencies;
    const items = [];
    if (!tenantId) return items;

    const mods = Array.isArray(opts.availableModules) ? opts.availableModules : [];
    const hasParcoMacchine = mods.includes('parcoMacchine');
    const { hasManodopera, hasContoTerzi } = opts;

    if (hasParcoMacchine) {
        try {
            const macchineSnap = await getDocs(collection(db, `tenants/${tenantId}/macchine`));
            macchineSnap.forEach((docSnap) => {
                const m = docSnap.data();
                const label = nomeMacchina(m);

                if (m.prossimaManutenzione != null) {
                    const urg = calcolaUrgenzaData(m.prossimaManutenzione);
                    items.push({
                        priorita: urg.priorita,
                        giorniSort: urg.giorni,
                        colore: urg.colore,
                        tipoLabel: 'Manutenzione',
                        titolo: label,
                        dettaglio: formattaDataScadenza(m.prossimaManutenzione) + (urg.testo ? ` · ${urg.testo}` : ''),
                        href: '../modules/macchine/views/scadenze-list-standalone.html'
                    });
                }
                if (m.oreProssimaManutenzione != null) {
                    const urg = calcolaUrgenzaOre(m.oreAttuali, m.oreProssimaManutenzione);
                    items.push({
                        priorita: urg.priorita,
                        giorniSort: urg.giorni,
                        colore: urg.colore,
                        tipoLabel: 'Manutenzione ore',
                        titolo: label,
                        dettaglio: `Soglia ${m.oreProssimaManutenzione} h · attuali ${m.oreAttuali != null ? m.oreAttuali : '—'} h (${urg.testo})`,
                        href: '../modules/macchine/views/scadenze-list-standalone.html'
                    });
                }
            });
        } catch (e) {
            console.warn('fetchInArrivoItems macchine:', e);
        }
    }

    if (hasManodopera && hasContoTerzi) {
        try {
            const snap = countsSnapshot || getDashboardCountsSnapshot();
            const n = snap
                ? snap.daPianificare || 0
                : await loadLavoriDaPianificareCount(tenantId, dependencies);
            if (n > 0) {
                items.push({
                    priorita: 2,
                    giorniSort: 0,
                    colore: 'yellow',
                    tipoLabel: 'Lavori',
                    titolo: 'Da pianificare',
                    dettaglio: `${n} lavoro/i in bozza da assegnare`,
                    href: 'admin/gestione-lavori-standalone.html?stato=da_pianificare'
                });
            }
        } catch (e) {
            console.warn('fetchInArrivoItems da pianificare:', e);
        }
    }

    if (hasManodopera) {
        try {
            const snap = countsSnapshot || getDashboardCountsSnapshot();
            const n =
                snap && !snap.oreDaValidarePending
                    ? snap.oreDaValidare || 0
                    : snap
                      ? 0
                      : await countOreDaValidareManager(tenantId, dependencies);
            if (n > 0) {
                items.push({
                    priorita: 1,
                    giorniSort: 0,
                    colore: 'red',
                    tipoLabel: 'Ore',
                    titolo: 'Validazione ore',
                    dettaglio: `${n} registrazione/i da validare (lavori autonomi)`,
                    href: 'admin/validazione-ore-standalone.html'
                });
            }
        } catch (e) {
            console.warn('fetchInArrivoItems ore:', e);
        }
    }

    return ordinaItems(items);
}

function coloreBordo(colore) {
    if (colore === 'black') return '#37474f';
    if (colore === 'red') return '#c62828';
    if (colore === 'yellow') return '#f9a825';
    if (colore === 'grey') return '#9e9e9e';
    return '#2e7d32';
}

function coloreSfondo(colore) {
    if (colore === 'black') return '#eceff1';
    if (colore === 'red') return '#ffebee';
    if (colore === 'yellow') return '#fff8e1';
    if (colore === 'grey') return '#f5f5f5';
    return '#e8f5e9';
}

function escapeAttr(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

/**
 * @param {HTMLElement|null} listEl
 * @param {HTMLElement|null} emptyEl
 * @param {Array} items
 * @param {Function} escapeHtml
 * @param {{ footerHref?: string, footerLabel?: string, urgentOnly?: boolean }} options
 */
export function renderDeadlineWidgetList(listEl, emptyEl, items, escapeHtml, options = {}) {
    if (!listEl) return;

    const urgentOnly = options.urgentOnly !== false;
    const filtered = typeof options.filterItems === 'function'
        ? options.filterItems(items)
        : (urgentOnly ? items.filter((it) => it.priorita <= 2) : items);
    const visible = filtered.slice(0, MAX_RIGHE);
    const hidden = filtered.length - visible.length;

    if (filtered.length === 0) {
        listEl.innerHTML = '';
        if (emptyEl) {
            emptyEl.hidden = false;
            const affittiTotal = items.filter((it) => it.tipoLabel === 'Affitto').length;
            if (affittiTotal > 0 && options.emptyMessageAffittiOk) {
                emptyEl.textContent = options.emptyMessageAffittiOk.replace('{n}', String(affittiTotal));
            } else {
                emptyEl.textContent = options.emptyMessage || 'Nessuna voce urgente. Tutto in regola nelle verifiche automatiche.';
            }
        }
        return;
    }

    if (emptyEl) emptyEl.hidden = true;

    let html = '';
    visible.forEach((it) => {
        const bordo = coloreBordo(it.colore);
        const sfondo = coloreSfondo(it.colore);
        html += `
            <a class="dashboard-deadline-row" href="${escapeAttr(it.href)}" style="border-left-color:${bordo};background:${sfondo};">
                <span class="dashboard-deadline-row__type">${escapeHtml(it.tipoLabel)}</span>
                <span class="dashboard-deadline-row__title">${escapeHtml(it.titolo)}</span>
                <span class="dashboard-deadline-row__detail">${escapeHtml(it.dettaglio)}</span>
            </a>
        `;
    });

    if (hidden > 0) {
        html += `<p class="dashboard-deadline-more">+ altre ${hidden} voci non mostrate</p>`;
    }

    if (options.footerHref && options.footerLabel) {
        html += `
            <p class="dashboard-deadline-footer">
                <a href="${escapeAttr(options.footerHref)}">${escapeHtml(options.footerLabel)}</a>
            </p>
        `;
    }

    listEl.innerHTML = html;
}

/**
 * @param {Object} dependencies
 * @param {string} tenantId
 * @param {string[]} availableModules
 */
export async function loadScadenzeAmministrazioneWidget(dependencies, tenantId, availableModules) {
    const listEl = document.getElementById('scadenze-amministrazione-list');
    const emptyEl = document.getElementById('scadenze-amministrazione-empty');
    if (!listEl) return;

    const esc = dependencies.escapeHtml || ((s) => String(s || ''));
    if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = 'Caricamento scadenze…';
    }
    listEl.innerHTML = '';

    try {
        const items = await fetchScadenzeAmministrazioneItems(tenantId, availableModules, dependencies);
        const mods = Array.isArray(availableModules) ? availableModules : [];
        const footerHref = mods.includes('parcoMacchine')
            ? '../modules/macchine/views/scadenze-list-standalone.html'
            : 'terreni-standalone.html';
        const footerLabel = mods.includes('parcoMacchine')
            ? 'Vedi tutte le scadenze mezzi →'
            : 'Vai a Terreni →';

        renderDeadlineWidgetList(listEl, emptyEl, items, esc, {
            filterItems: filterItemsScadenzeAmmin,
            urgentOnly: false,
            footerHref,
            footerLabel,
            emptyMessage: 'Nessun affitto in scadenza e nessuna scadenza mezzo urgente. Aggiungi terreni in affitto da Terreni o date sui mezzi.',
            emptyMessageAffittiOk: '{n} terreno/i in affitto: scadenze non urgenti. Apri Terreni per il dettaglio.'
        });
    } catch (e) {
        console.warn('loadScadenzeAmministrazioneWidget:', e);
        listEl.innerHTML = '';
        if (emptyEl) {
            emptyEl.hidden = false;
            emptyEl.textContent = 'Impossibile caricare le scadenze. Riprova più tardi.';
        }
    }
}

/**
 * @param {Object} dependencies
 * @param {string} tenantId
 * @param {{ hasManodopera: boolean, hasContoTerzi: boolean, availableModules: string[], countsSnapshot?: Object }} opts
 */
export async function loadInArrivoWidget(dependencies, tenantId, opts) {
    const listEl = document.getElementById('in-arrivo-list');
    const emptyEl = document.getElementById('in-arrivo-empty');
    if (!listEl) return;

    const esc = dependencies.escapeHtml || ((s) => String(s || ''));
    if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = 'Caricamento…';
    }
    listEl.innerHTML = '';

    try {
        const items = await fetchInArrivoItems(tenantId, opts, dependencies, opts.countsSnapshot);
        const mods = Array.isArray(opts.availableModules) ? opts.availableModules : [];
        let footerHref = 'admin/gestione-lavori-standalone.html';
        let footerLabel = 'Gestione lavori →';
        if (mods.includes('parcoMacchine')) {
            footerHref = '../modules/macchine/views/scadenze-list-standalone.html';
            footerLabel = 'Scadenze e manutenzioni mezzi →';
        } else if (opts.hasManodopera) {
            footerHref = 'admin/gestione-lavori-standalone.html';
            footerLabel = 'Gestione lavori →';
        }

        renderDeadlineWidgetList(listEl, emptyEl, items, esc, {
            footerHref,
            footerLabel,
            emptyMessage: 'Nessuna attività operativa urgente in coda. Buon lavoro!'
        });
    } catch (e) {
        console.warn('loadInArrivoWidget:', e);
        listEl.innerHTML = '';
        if (emptyEl) {
            emptyEl.hidden = false;
            emptyEl.textContent = 'Impossibile caricare le attività in arrivo.';
        }
    }
}

/** Ricarica widget In arrivo quando arriva il conteggio ore (background). */
export function bindInArrivoOreRefresh(dependencies, tenantId, opts) {
    window.addEventListener(ORE_READY_EVENT, () => {
        loadInArrivoWidget(dependencies, tenantId, {
            ...opts,
            countsSnapshot: getDashboardCountsSnapshot(),
        });
    });
}

/**
 * Carica entrambi i widget scadenze (dopo render dashboard manager/admin).
 */
export async function loadDashboardDeadlinesWidgets(dependencies, tenantId, opts = {}) {
    const availableModules = Array.isArray(opts.availableModules) ? opts.availableModules : [];
    const inArrivoOpts = {
        hasManodopera: !!opts.hasManodopera,
        hasContoTerzi: !!opts.hasContoTerzi,
        availableModules,
        countsSnapshot: opts.countsSnapshot
    };
    await Promise.all([
        dashboardPerfAsync('deadlines.scadenze', () =>
            loadScadenzeAmministrazioneWidget(dependencies, tenantId, availableModules)),
        dashboardPerfAsync('deadlines.inArrivo', () =>
            loadInArrivoWidget(dependencies, tenantId, inArrivoOpts))
    ]);
    bindInArrivoOreRefresh(dependencies, tenantId, inArrivoOpts);
}
