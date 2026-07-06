/**
 * Caricamento Tony widget solo se piano ≠ Free (o modulo Tony attivo/in prova).
 * Espone window.gfvLoadTonyWidget e polling finché il piano tenant è noto.
 */
(function () {
    'use strict';

    function resolveCoreBase() {
        var path = (window.location.pathname || '').replace(/\\/g, '/');
        var isGH = path.indexOf('/gfv-platform/') >= 0;
        if (isGH) return window.location.origin + '/gfv-platform/core';
        if (path.indexOf('/core/admin/') >= 0) return '../';
        if (path.indexOf('/core/mobile/') >= 0) return '../';
        if (path.indexOf('/modules/') >= 0) return '../../../core/';
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

    function shouldLoadTony() {
        var plan = getPlanId();
        if (plan === 'free') return hasTonyModule();
        if (plan === 'base') return true;
        if (plan === null && (window.__gfvTenantData || window.__gfvModuliAttivi)) return true;
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

    /** Pagine legacy (es. preventivi CT) che non chiamano tenant-service: recupera tenant da auth. */
    function bootstrapTenantContextForTony() {
        if (window.__gfvTonyTenantBootstrapStarted) return;
        window.__gfvTonyTenantBootstrapStarted = true;

        var attempts = 0;
        var maxAttempts = 150;
        var timer = setInterval(function () {
            attempts += 1;
            importCoreModule('services/firebase-service.js')
                .then(function (fb) {
                    if (!fb.getAuthInstance || !fb.getDocumentData) return null;
                    var auth = fb.getAuthInstance();
                    if (!auth || !auth.currentUser) return null;
                    return importCoreModule('services/tenant-service.js').then(function (ts) {
                        var tid = ts.getCurrentTenantId();
                        if (tid) return ts.getCurrentTenant();
                        return fb.getDocumentData('users', auth.currentUser.uid).then(function (userData) {
                            if (!userData || !userData.tenantId) return null;
                            ts.setCurrentTenantId(userData.tenantId);
                            return ts.getCurrentTenant();
                        });
                    });
                })
                .then(function (tenant) {
                    if (tenant) clearInterval(timer);
                })
                .catch(function () { /* retry */ });

            if (window.__gfvSubscriptionPlanId && window.__gfvModuliAttivi) {
                clearInterval(timer);
                return;
            }
            if (attempts >= maxAttempts) clearInterval(timer);
        }, 250);
    }

    bootstrapTenantContextForTony();

    function loadTonyWidgetScript() {
        if (window.__gfvTonyWidgetRequested) {
            if (document.getElementById('tony-fab')) return;
            if (!shouldLoadTony()) return;
            window.__gfvTonyWidgetRequested = false;
        }
        if (window.__gfvTonyWidgetRequested) return;
        window.__gfvTonyWidgetRequested = true;
        var base = resolveCoreBase();
        var sep = (base && !base.endsWith('/')) ? '/' : '';
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = (base ? base + sep : '') + 'styles/tony-widget.css';
        document.head.appendChild(link);
        var s = document.createElement('script');
        s.type = 'module';
        s.src = (base ? base + sep : '') + 'js/tony-widget-standalone.js?v=2026-06-22d';
        document.body.appendChild(s);
    }

    window.gfvLoadTonyWidget = function () {
        if (shouldLoadTony()) loadTonyWidgetScript();
    };

    window.gfvTryLoadTonyWidgetWhenReady = function () {
        if (!shouldLoadTony()) return false;
        loadTonyWidgetScript();
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
