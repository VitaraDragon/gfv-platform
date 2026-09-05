/**
 * Caricamento Tony widget solo se piano ≠ Free (o modulo Tony attivo/in prova).
 * FAB placeholder subito; widget (~900 KB) a idle o al tap. E2E (`tonyE2e=1`) resta eager.
 * Espone window.gfvLoadTonyWidget e gfvTryLoadTonyWidgetWhenReady.
 */
(function () {
    'use strict';

    var TONY_LOADER_QUERY = '2026-09-05a';

    function resolveCoreBase() {
        var path = (window.location.pathname || '').replace(/\\/g, '/');
        var isGH = path.indexOf('/gfv-platform/') >= 0;
        if (isGH) return window.location.origin + '/gfv-platform/core';
        if (path.indexOf('/core/dev/') >= 0) return '../';
        if (path.indexOf('/core/admin/') >= 0) return '../';
        if (path.indexOf('/core/mobile/') >= 0) return '../';
        if (path.indexOf('/modules/') >= 0) return '../../../core/';
        if (/\/core\/[^/]+\.html$/i.test(path)) return '';
        return '';
    }

    function normalizePlan(raw) {
        if (raw == null || raw === '') return null;
        var p = String(raw).trim().toLowerCase();
        if (p === 'free' || p === 'freemium') return 'free';
        if (p === 'base') return 'base';
        if (p === 'starter' || p === 'professional' || p === 'enterprise') return 'base';
        return 'base';
    }

    function getPlanId() {
        var fromWindow = null;
        var fromTenant = null;
        if (window.__gfvSubscriptionPlanId != null && window.__gfvSubscriptionPlanId !== '') {
            fromWindow = normalizePlan(window.__gfvSubscriptionPlanId);
        }
        var td = window.__gfvTenantData;
        if (td && (td.plan || td.piano)) {
            fromTenant = normalizePlan(td.plan || td.piano);
        }
        if (fromTenant !== 'base' && fromWindow !== 'base' && td && td.stripeSubscriptionId) {
            var st = td.status ? String(td.status).toLowerCase() : 'active';
            if (st === 'active' || st === 'trialing' || st === 'expiring') return 'base';
        }
        if (fromTenant === 'base' || fromWindow === 'base') return 'base';
        if (fromTenant === 'free' || fromWindow === 'free') return 'free';
        return fromWindow || fromTenant || null;
    }

    function hasTonyModule() {
        var mods = window.__gfvModuliAttivi;
        if (!Array.isArray(mods) && window.__gfvTenantData && Array.isArray(window.__gfvTenantData.modules)) {
            mods = window.__gfvTenantData.modules;
        }
        if (!Array.isArray(mods)) return false;
        return mods.some(function (m) { return String(m).toLowerCase() === 'tony'; });
    }

    /**
     * Iframe embed (es. dettaglio lavoro / stats nel field-workspace): Tony resta sul parent.
     * Evita doppio FAB e due chat indipendenti.
     */
    function shouldSuppressTonyAsEmbed() {
        try {
            var params = new URLSearchParams(window.location.search || '');
            var embed = String(params.get('embed') || '').toLowerCase();
            if (embed === 'mobile' || embed === '1' || embed === 'true') return true;
            if (params.get('noTony') === '1') return true;
            if (window.parent && window.parent !== window) {
                try {
                    if (window.parent.document && window.parent.document.getElementById('tony-fab')) {
                        return true;
                    }
                    var pp = String(window.parent.location.pathname || '').toLowerCase();
                    if (pp.indexOf('field-workspace') >= 0) return true;
                } catch (eCross) { /* cross-origin */ }
            }
        } catch (e) { /* ignore */ }
        return false;
    }

    function shouldLoadTony() {
        if (shouldSuppressTonyAsEmbed()) return false;
        var plan = getPlanId();
        if (plan === 'free') return hasTonyModule();
        if (plan === 'base') return true;
        if (plan === null && (window.__gfvTenantData || window.__gfvModuliAttivi)) return true;
        return false;
    }

    function shouldLoadTonyEager() {
        try {
            var sp = new URLSearchParams(window.location.search || '');
            if (sp.get('tonyE2e') === '1' || sp.get('tonyEager') === '1') return true;
            if (localStorage.getItem('gfv_tony_e2e') === '1') return true;
        } catch (e) { /* ignore */ }
        return false;
    }

    function publishTenantForTony(tenantData, modulesOpt) {
        if (!tenantData || typeof tenantData !== 'object') return;
        var modules = modulesOpt;
        if (!Array.isArray(modules)) {
            modules = Array.isArray(tenantData.modules) ? tenantData.modules.slice() : [];
        }
        var rawPlan = tenantData.plan || tenantData.piano || 'base';
        var planId = normalizePlan(rawPlan) || 'base';
        window.__gfvTenantData = Object.assign({}, tenantData, { plan: planId, piano: planId });
        window.__gfvModuliAttivi = modules;
        window.__gfvSubscriptionPlanId = planId;
        try {
            window.dispatchEvent(new CustomEvent('gfv-subscription-plan', { detail: { planId: planId } }));
        } catch (ePub) { /* ignore */ }
        try {
            window.dispatchEvent(new CustomEvent('gfv-tenant-tony-ready'));
        } catch (eReady) { /* ignore */ }
        importCoreModule('config/feature-flags.js').then(function (ff) {
            if (ff && typeof ff.publishFeatureFlags === 'function') {
                ff.publishFeatureFlags(tenantData, tenantData.id || null);
            }
        }).catch(function () { /* ignore */ });
        if (typeof window.gfvTryLoadTonyWidgetWhenReady === 'function') {
            window.gfvTryLoadTonyWidgetWhenReady();
        }
    }

    function ensureStandaloneShell() {
        if (window.__gfvStandaloneShellRequested) return;
        if (document.querySelector('script[src*="gfv-standalone-shell"]')) {
            window.__gfvStandaloneShellRequested = true;
            return;
        }
        window.__gfvStandaloneShellRequested = true;
        var base = resolveCoreBase();
        var sep = (base && !base.endsWith('/')) ? '/' : '';
        var s = document.createElement('script');
        s.src = (base ? base + sep : '') + 'js/gfv-standalone-shell.js';
        document.body.appendChild(s);
    }

    window.gfvPublishTenantForTony = publishTenantForTony;
    window.gfvEnsureStandaloneShell = ensureStandaloneShell;

    function importCoreModule(relativePath) {
        var base = resolveCoreBase();
        var sep = (base && !base.endsWith('/')) ? '/' : '';
        return import((base ? base + sep : '') + relativePath);
    }

    function whenBodyReady(fn) {
        if (document.body) {
            fn();
            return;
        }
        document.addEventListener('DOMContentLoaded', fn);
    }

    function injectPlaceholderFab() {
        if (document.getElementById('tony-fab') || document.getElementById('tony-fab-placeholder')) return;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'tony-fab-placeholder';
        btn.className = 'tony-widget-fab';
        btn.title = 'Chiedi a Tony';
        btn.setAttribute('aria-label', 'Apri assistente Tony');
        btn.setAttribute('aria-busy', 'true');
        btn.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9998;width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#2E8B57 0%,#228B22 100%);color:#fff;border:none;box-shadow:0 4px 12px rgba(46,139,87,.4);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:26px;padding:0;';
        btn.textContent = '\uD83E\uDD16';
        btn.addEventListener('click', function () {
            window.__gfvTonyOpenAfterLoad = true;
            loadTonyWidgetScript();
        });
        document.body.appendChild(btn);
    }

    function removePlaceholderFab() {
        var p = document.getElementById('tony-fab-placeholder');
        if (p && p.parentNode) p.parentNode.removeChild(p);
    }

    function watchForRealFabAndOpen() {
        if (window.__gfvTonyFabWatchStarted) return;
        window.__gfvTonyFabWatchStarted = true;
        var n = 0;
        var t = setInterval(function () {
            n += 1;
            var fab = document.getElementById('tony-fab');
            var ready = !!(window.Tony && typeof window.Tony.isReady === 'function' && window.Tony.isReady());
            if (fab) {
                removePlaceholderFab();
                if (window.__gfvTonyOpenAfterLoad && ready) {
                    window.__gfvTonyOpenAfterLoad = false;
                    try {
                        if (typeof window.__tonyOpenChatPanel === 'function') window.__tonyOpenChatPanel();
                        else fab.click();
                    } catch (eOpen) { /* ignore */ }
                    clearInterval(t);
                    return;
                }
                if (!window.__gfvTonyOpenAfterLoad) {
                    clearInterval(t);
                    return;
                }
            }
            if (n >= 100) {
                clearInterval(t);
            }
        }, 80);
    }

    /** Pagine legacy (es. preventivi CT) che non chiamano tenant-service: recupera tenant da auth. */
    function bootstrapTenantContextForTony() {
        if (window.__gfvTonyTenantBootstrapStarted) return;
        window.__gfvTonyTenantBootstrapStarted = true;
        if (window.__gfvSubscriptionPlanId && window.__gfvModuliAttivi) return;

        var attempts = 0;
        var maxAttempts = 150;
        var cached = null;

        function tryResolve(fb, ts) {
            if (!fb.getAuthInstance || !fb.getDocumentData) return;
            var auth = fb.getAuthInstance();
            if (!auth || !auth.currentUser) return;
            var tid = ts.getCurrentTenantId && ts.getCurrentTenantId();
            var p = tid
                ? ts.getCurrentTenant()
                : fb.getDocumentData('users', auth.currentUser.uid).then(function (userData) {
                    if (!userData || !userData.tenantId) return null;
                    ts.setCurrentTenantId(userData.tenantId);
                    return ts.getCurrentTenant();
                });
            Promise.resolve(p).catch(function () { /* retry */ });
        }

        var timer = setInterval(function () {
            attempts += 1;
            if (window.__gfvSubscriptionPlanId && window.__gfvModuliAttivi) {
                clearInterval(timer);
                return;
            }
            if (cached) {
                tryResolve(cached.fb, cached.ts);
            } else {
                Promise.all([
                    importCoreModule('services/firebase-service.js'),
                    importCoreModule('services/tenant-service.js')
                ]).then(function (pair) {
                    cached = { fb: pair[0], ts: pair[1] };
                    tryResolve(cached.fb, cached.ts);
                }).catch(function () { /* retry */ });
            }
            if (attempts >= maxAttempts) clearInterval(timer);
        }, 250);
    }

    bootstrapTenantContextForTony();

    function loadTonyWidgetScript() {
        if (document.getElementById('tony-fab')) {
            removePlaceholderFab();
            return;
        }
        if (window.__gfvTonyWidgetRequested) {
            watchForRealFabAndOpen();
            return;
        }
        if (!shouldLoadTony()) return;
        window.__gfvTonyWidgetRequested = true;
        var base = resolveCoreBase();
        var sep = (base && !base.endsWith('/')) ? '/' : '';
        var s = document.createElement('script');
        s.type = 'module';
        s.src = (base ? base + sep : '') + 'js/tony-widget-standalone.js?v=' + TONY_LOADER_QUERY;
        document.body.appendChild(s);
        watchForRealFabAndOpen();
    }

    function scheduleDeferredTonyLoad() {
        if (window.__gfvTonyDeferScheduled) return;
        window.__gfvTonyDeferScheduled = true;
        whenBodyReady(function () {
            injectPlaceholderFab();
            if (shouldLoadTonyEager()) {
                loadTonyWidgetScript();
                return;
            }
            var start = function () { loadTonyWidgetScript(); };
            if (typeof requestIdleCallback === 'function') {
                requestIdleCallback(start, { timeout: 2500 });
            } else {
                setTimeout(start, 1800);
            }
        });
    }

    window.gfvLoadTonyWidget = function () {
        if (!shouldLoadTony()) return;
        if (shouldLoadTonyEager()) {
            whenBodyReady(function () {
                injectPlaceholderFab();
                loadTonyWidgetScript();
            });
            return;
        }
        scheduleDeferredTonyLoad();
    };

    window.gfvTryLoadTonyWidgetWhenReady = function () {
        if (!shouldLoadTony()) return false;
        scheduleDeferredTonyLoad();
        return true;
    };

    function onPlanMaybeChanged(ev) {
        try {
            var pid = ev && ev.detail && ev.detail.planId;
            if (pid != null) {
                window.__gfvSubscriptionPlanId = normalizePlan(pid) || String(pid).trim().toLowerCase();
            }
        } catch (e) { /* ignore */ }
        window.gfvTryLoadTonyWidgetWhenReady();
    }

    window.addEventListener('gfv-subscription-plan', onPlanMaybeChanged);

    window.addEventListener('gfv-tenant-tony-ready', function () {
        window.gfvTryLoadTonyWidgetWhenReady();
    });

    window.addEventListener('gfv-firebase-ready', function () {
        importCoreModule('js/gfv-tony-tenant-bootstrap.js')
            .then(function (m) { m.bootstrapTonyTenantFromAuth(); })
            .catch(function () { /* init hook già eseguito da firebase-service */ });
    });

    window.addEventListener('pageshow', function (ev) {
        if (ev && ev.persisted) window.gfvTryLoadTonyWidgetWhenReady();
    });

    if (window.gfvTryLoadTonyWidgetWhenReady()) return;

    var attempts = 0;
    var maxAttempts = 120;
    var timer = setInterval(function () {
        attempts += 1;
        if (window.gfvTryLoadTonyWidgetWhenReady()) {
            clearInterval(timer);
            return;
        }
        var plan = getPlanId();
        if (plan === 'free' && !hasTonyModule()) {
            clearInterval(timer);
            return;
        }
        if (attempts >= maxAttempts) clearInterval(timer);
    }, 150);
})();
