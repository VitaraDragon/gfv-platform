/**
 * Panoramica dashboard: alert aggregati, promemoria, pin/recenti (localStorage per utente).
 * @module core/js/dashboard-hub
 */

import {
    loadMagazzinoSottoScortaCount,
    loadScadenzeUrgentiCount,
    loadGuastiApertiCount,
    loadAffittiUrgentiCount,
    loadLavoriDaPianificareCount,
    countOreDaValidareManager
} from './dashboard-data.js';

const MODULE_CATALOG = {
    amministrazione: { label: 'Amministrazione', href: 'admin/amministrazione-standalone.html', icon: '👑' },
    statistiche: { label: 'Statistiche', href: 'statistiche-standalone.html', icon: '📊', hrefManodopera: 'admin/statistiche-manodopera-standalone.html' },
    terreni: { label: 'Terreni', href: 'terreni-standalone.html', icon: '🗺️' },
    diarioAttivita: { label: 'Diario attività', href: 'attivita-standalone.html', icon: '📝' },
    abbonamento: { label: 'Abbonamento', href: 'admin/abbonamento-standalone.html', icon: '💳' },
    contoTerzi: { label: 'Conto Terzi', href: '../modules/conto-terzi/views/conto-terzi-home-standalone.html', icon: '🤝' },
    vigneto: { label: 'Vigneto', href: '../modules/vigneto/views/vigneto-dashboard-standalone.html', icon: '🍇' },
    frutteto: { label: 'Frutteto', href: '../modules/frutteto/views/frutteto-dashboard-standalone.html', icon: '🍎' },
    magazzino: { label: 'Magazzino', href: '../modules/magazzino/views/magazzino-home-standalone.html', icon: '📦' },
    parcoMacchine: { label: 'Parco Macchine', href: '../modules/macchine/views/macchine-dashboard-standalone.html', icon: '🚜' },
    report: { label: 'Report', href: '../modules/report/views/report-dashboard-standalone.html', icon: '📑' }
};

function pinsStorageKey(uid) {
    return `gfv_dash_pins_${uid || 'anon'}`;
}

function recentStorageKey(uid) {
    return `gfv_dash_recent_${uid || 'anon'}`;
}

function getPins(uid) {
    try {
        const raw = localStorage.getItem(pinsStorageKey(uid));
        const arr = JSON.parse(raw || '[]');
        return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
    } catch {
        return [];
    }
}

function setPins(uid, ids) {
    const uniq = [];
    ids.forEach((id) => {
        if (id && MODULE_CATALOG[id] && !uniq.includes(id)) uniq.push(id);
    });
    localStorage.setItem(pinsStorageKey(uid), JSON.stringify(uniq.slice(0, 8)));
}

function getRecent(uid) {
    try {
        const raw = localStorage.getItem(recentStorageKey(uid));
        const arr = JSON.parse(raw || '[]');
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}

function pushRecent(uid, moduleId) {
    if (!uid || !moduleId || !MODULE_CATALOG[moduleId]) return;
    let list = getRecent(uid).filter((x) => x && x.id !== moduleId);
    list.unshift({ id: moduleId, t: Date.now() });
    list = list.slice(0, 12);
    localStorage.setItem(recentStorageKey(uid), JSON.stringify(list));
}

function resolveModuleHref(moduleId, hasManodopera) {
    const meta = MODULE_CATALOG[moduleId];
    if (!meta) return '#';
    if (moduleId === 'statistiche' && hasManodopera && meta.hrefManodopera) return meta.hrefManodopera;
    return meta.href;
}

function escapeAttr(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

function wrapTilesWithPinShells(rootEl) {
    const tiles = rootEl.querySelectorAll('.dashboard-section--module-tile > a.dashboard-module-tile[data-module]');
    tiles.forEach((tile) => {
        const section = tile.closest('.dashboard-section--module-tile');
        if (!section || section.querySelector('.dashboard-module-tile-shell')) return;
        const shell = document.createElement('div');
        shell.className = 'dashboard-module-tile-shell';
        section.insertBefore(shell, tile);
        shell.appendChild(tile);
        const mod = tile.getAttribute('data-module');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dashboard-module-tile__pin';
        btn.setAttribute('data-module-pin', mod);
        btn.setAttribute('aria-label', 'Preferito: salva o rimuovi accesso rapido su questo dispositivo');
        btn.setAttribute('title', 'Preferito (solo su questo dispositivo)');
        btn.setAttribute('aria-pressed', 'false');
        btn.textContent = '☆';
        shell.appendChild(btn);
    });
}

/**
 * @param {Object} options
 * @param {string} options.userId
 * @param {string} [options.tenantId]
 * @param {boolean} options.hasManodopera
 * @param {boolean} options.hasContoTerzi
 * @param {string[]} options.availableModules
 * @param {Object} options.dependencies
 */
export async function initDashboardPanoramaHub(options) {
    const hub = document.getElementById('dashboard-panorama-hub');
    if (!hub || hub.dataset.hubInit === '1') return;

    const {
        userId,
        tenantId,
        hasManodopera,
        hasContoTerzi,
        availableModules: rawModules,
        dependencies
    } = options;

    const availableModules = Array.isArray(rawModules) ? rawModules : [];

    const esc = dependencies.escapeHtml || ((s) => String(s || ''));
    const root = document.getElementById('dashboard-content');
    if (!root) return;

    wrapTilesWithPinShells(root);

    const attentionList = document.getElementById('dashboard-hub-attention-list');
    const attentionEmpty = document.getElementById('dashboard-hub-attention-empty');
    const todayList = document.getElementById('dashboard-hub-today-list');
    const shortcutsEl = document.getElementById('dashboard-hub-shortcuts');
    const shortcutsEmpty = document.getElementById('dashboard-hub-shortcuts-empty');

    function renderPinsState() {
        const pins = getPins(userId);
        root.querySelectorAll('.dashboard-module-tile__pin').forEach((btn) => {
            const id = btn.getAttribute('data-module-pin');
            const on = id && pins.includes(id);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
            btn.textContent = on ? '★' : '☆';
        });
    }

    function renderShortcuts() {
        if (!shortcutsEl) return;
        const pins = getPins(userId);
        const recent = getRecent(userId);
        const seen = new Set();
        const chips = [];

        pins.forEach((id) => {
            if (!MODULE_CATALOG[id] || seen.has(id)) return;
            seen.add(id);
            chips.push({ id, kind: 'pin' });
        });

        recent.forEach((entry) => {
            const id = entry && entry.id;
            if (!id || !MODULE_CATALOG[id] || seen.has(id)) return;
            seen.add(id);
            chips.push({ id, kind: 'recent' });
        });

        if (chips.length === 0) {
            shortcutsEl.innerHTML = '';
            if (shortcutsEmpty) shortcutsEmpty.hidden = false;
            return;
        }
        if (shortcutsEmpty) shortcutsEmpty.hidden = true;

        const max = 8;
        shortcutsEl.innerHTML = chips.slice(0, max).map((c) => {
            const meta = MODULE_CATALOG[c.id];
            const href = resolveModuleHref(c.id, hasManodopera);
            const badge = c.kind === 'pin' ? '<span class="dashboard-hub-chip-badge">★</span>' : '';
            return `
                <a class="dashboard-hub-chip" data-module="${escapeAttr(c.id)}" href="${escapeAttr(href)}">
                    ${badge}<span class="dashboard-hub-chip-icon" aria-hidden="true">${meta.icon}</span>
                    <span class="dashboard-hub-chip-label">${esc(meta.label)}</span>
                </a>
            `;
        }).join('');
    }

    async function refreshAttention() {
        if (!attentionList || !attentionEmpty) return;

        const items = [];
        const hasMagazzino = availableModules.includes('magazzino');
        const hasMacchine = availableModules.includes('parcoMacchine');

        try {
            const tasks = [];

            let sottoScorta = 0;
            if (hasMagazzino) {
                tasks.push(
                    loadMagazzinoSottoScortaCount(dependencies).then((n) => {
                        sottoScorta = n || 0;
                    })
                );
            }

            let scadenze = 0;
            let guasti = 0;
            if (tenantId && hasMacchine) {
                tasks.push(
                    loadScadenzeUrgentiCount(tenantId, dependencies).then((n) => {
                        scadenze = n || 0;
                    })
                );
                tasks.push(
                    loadGuastiApertiCount(tenantId, dependencies).then((n) => {
                        guasti = n || 0;
                    })
                );
            }

            let affittiUrgent = 0;
            tasks.push(
                loadAffittiUrgentiCount(dependencies, tenantId).then(({ urgentCount }) => {
                    affittiUrgent = urgentCount || 0;
                })
            );

            let daPianificare = 0;
            if (tenantId && hasManodopera && hasContoTerzi) {
                tasks.push(
                    loadLavoriDaPianificareCount(tenantId, dependencies).then((n) => {
                        daPianificare = n || 0;
                    })
                );
            }

            let oreDaValidare = 0;
            if (tenantId && hasManodopera) {
                tasks.push(
                    countOreDaValidareManager(tenantId, dependencies).then((n) => {
                        oreDaValidare = n || 0;
                    })
                );
            }

            await Promise.all(tasks);

            if (sottoScorta > 0) {
                items.push({
                    sev: 0,
                    text: `${sottoScorta} prodotto/i sotto scorta minima in magazzino.`,
                    href: resolveModuleHref('magazzino', hasManodopera),
                    mod: 'magazzino'
                });
            }
            if (guasti > 0) {
                items.push({
                    sev: 0,
                    text: `${guasti} guasto/i aperti sul parco macchine.`,
                    href: '../modules/macchine/views/guasti-list-standalone.html',
                    mod: 'parcoMacchine'
                });
            }
            if (scadenze > 0) {
                items.push({
                    sev: 1,
                    text: `${scadenze} scadenze manutenzione imminenti o in ritardo.`,
                    href: resolveModuleHref('parcoMacchine', hasManodopera),
                    mod: 'parcoMacchine'
                });
            }
            if (affittiUrgent > 0) {
                items.push({
                    sev: 1,
                    text: `${affittiUrgent} scadenza/e amministrativa/e (es. affitti) da controllare.`,
                    href: '#scadenze-amministrazione-widget',
                    mod: 'terreni'
                });
            }
            if (daPianificare > 0) {
                items.push({
                    sev: 2,
                    text: `${daPianificare} lavoro/i in bozza da pianificare.`,
                    href: 'admin/gestione-lavori-standalone.html?stato=da_pianificare',
                    mod: 'contoTerzi'
                });
            }
            if (oreDaValidare > 0) {
                items.push({
                    sev: 2,
                    text: `${oreDaValidare} registrazioni ore da validare (lavori autonomi).`,
                    href: 'admin/validazione-ore-standalone.html',
                    mod: 'statistiche'
                });
            }

            items.sort((a, b) => a.sev - b.sev);
            const top = items.slice(0, 5);

            if (top.length === 0) {
                attentionList.hidden = true;
                attentionList.innerHTML = '';
                attentionEmpty.hidden = false;
                attentionEmpty.textContent = 'Nessuna criticità rilevata nelle verifiche automatiche. Continua a monitorare da moduli e card sotto.';
            } else {
                attentionEmpty.hidden = true;
                attentionList.hidden = false;
                attentionList.innerHTML = top.map((it) => {
                    const cls = it.sev === 0 ? 'dashboard-hub-alert--danger' : it.sev === 1 ? 'dashboard-hub-alert--warn' : 'dashboard-hub-alert--info';
                    return `<li><a class="dashboard-hub-alert ${cls}" href="${escapeAttr(it.href)}">${esc(it.text)}</a></li>`;
                }).join('');
            }
        } catch (e) {
            console.warn('dashboard-hub refreshAttention:', e);
            attentionList.hidden = true;
            attentionEmpty.hidden = false;
            attentionEmpty.textContent = 'Impossibile aggiornare gli alert. Riprova più tardi.';
        }
    }

    function renderToday() {
        if (!todayList) return;
        const rows = [
            { text: 'Mappa satellitare terreni e lavori', href: 'mappa-aziendale-standalone.html' },
            { text: 'Diario attività in campo', href: 'attivita-standalone.html' },
            {
                text: hasManodopera ? 'Statistiche manodopera, ore e superficie' : 'Statistiche e indicatori aziendali',
                href: resolveModuleHref('statistiche', hasManodopera)
            }
        ];
        if (hasManodopera) {
            rows.push({ text: 'Gestione lavori, squadre e comunicazioni', href: 'admin/gestione-lavori-standalone.html' });
        } else {
            rows.push({ text: 'Anagrafica e confini dei terreni', href: 'terreni-standalone.html' });
        }
        todayList.innerHTML = rows.map((r) => (
            `<li><a class="dashboard-hub-today-link" href="${escapeAttr(r.href)}">${esc(r.text)}</a></li>`
        )).join('');
    }

    root.addEventListener('click', (ev) => {
        const pinBtn = ev.target.closest('.dashboard-module-tile__pin');
        if (pinBtn) {
            ev.preventDefault();
            ev.stopPropagation();
            const id = pinBtn.getAttribute('data-module-pin');
            if (!id) return;
            let pins = getPins(userId);
            if (pins.includes(id)) {
                pins = pins.filter((x) => x !== id);
            } else {
                pins.push(id);
            }
            setPins(userId, pins);
            renderPinsState();
            renderShortcuts();
            return;
        }

        const link = ev.target.closest('a.dashboard-module-tile[data-module]');
        if (link) {
            const id = link.getAttribute('data-module');
            if (id) pushRecent(userId, id);
        }

        const chip = ev.target.closest('a.dashboard-hub-chip[data-module]');
        if (chip) {
            const id = chip.getAttribute('data-module');
            if (id) pushRecent(userId, id);
        }
    });

    renderToday();
    renderPinsState();
    renderShortcuts();
    await refreshAttention();

    hub.dataset.hubInit = '1';
}
