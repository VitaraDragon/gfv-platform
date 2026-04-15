import {
    initializeFirebase,
    getAuthInstance,
    getDb,
    onAuthStateChanged,
    getDoc,
    doc
} from '../../services/firebase-service.js';

const {
    normalizeRoles,
    hasAnyRole,
    setFieldWorkspacePreference
} = window.GFVDashboardUtils || {};

const statusEl = document.getElementById('field-mobile-status');

function setStatus(text, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.style.color = isError ? '#b91c1c' : '#4b5563';
}

function getWorkspacePreferenceFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        const ws = params.get('ws');
        if (ws === 'classic' || ws === 'mobile' || ws === 'auto') {
            return ws;
        }
    } catch (error) {
        // ignore
    }
    return null;
}

async function resolveCurrentTenantId(userData) {
    if (!userData) return null;
    const { getCurrentTenantId, setCurrentTenantId } = await import('../../services/tenant-service.js');
    let tenantId = getCurrentTenantId();
    if (tenantId) return tenantId;

    if (userData.tenantId) {
        setCurrentTenantId(userData.tenantId);
        return userData.tenantId;
    }

    const memberships = userData.tenantMemberships && typeof userData.tenantMemberships === 'object'
        ? Object.entries(userData.tenantMemberships)
        : [];
    if (memberships.length === 0) return null;

    const active = memberships.find(([, item]) => item && item.stato === 'attivo');
    const fallback = active || memberships[0];
    if (fallback && fallback[0]) {
        setCurrentTenantId(fallback[0]);
        return fallback[0];
    }
    return null;
}

function bindToolbar() {
    const btnClassic = document.getElementById('btn-switch-classic');
    const btnAuto = document.getElementById('btn-switch-auto');
    const btnRefresh = document.getElementById('btn-refresh-frames');

    if (btnClassic) {
        btnClassic.addEventListener('click', () => {
            setFieldWorkspacePreference('classic');
            window.location.href = '../dashboard-standalone.html?ws=classic';
        });
    }

    if (btnAuto) {
        btnAuto.addEventListener('click', () => {
            setFieldWorkspacePreference('auto');
            setStatus('Preferenza impostata su automatico (mobile).');
        });
    }

    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            const iframes = Array.from(document.querySelectorAll('iframe[data-refreshable="1"]'));
            iframes.forEach((frame) => {
                frame.src = frame.src;
            });
            setStatus('Contenuti ricaricati.');
        });
    }
}

function applyUrlPreference() {
    const pref = getWorkspacePreferenceFromUrl();
    if (!pref) return;
    setFieldWorkspacePreference(pref);
}

async function initFieldWorkspace() {
    setStatus('Caricamento workspace mobile...');
    applyUrlPreference();
    bindToolbar();

    try {
        const firebaseConfig = await window.GFVConfigLoader.waitForConfig();
        initializeFirebase(firebaseConfig);
        const auth = getAuthInstance();
        const db = getDb();

        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                window.location.href = '../auth/login-standalone.html';
                return;
            }

            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (!userDoc.exists()) {
                    window.location.href = '../dashboard-standalone.html?ws=classic';
                    return;
                }

                const userData = userDoc.data();
                const tenantId = await resolveCurrentTenantId(userData);
                const { getUserRolesForTenant } = await import('../../services/tenant-service.js');
                let availableModules = [];
                if (tenantId) {
                    const tenantDoc = await getDoc(doc(db, 'tenants', tenantId));
                    if (tenantDoc.exists()) {
                        const tenantData = tenantDoc.data();
                        availableModules = Array.isArray(tenantData.modules) ? tenantData.modules : [];
                    }
                }

                let roles = [];
                if (tenantId) {
                    roles = await getUserRolesForTenant(tenantId, user.uid);
                }
                if (!Array.isArray(roles) || roles.length === 0) {
                    roles = Array.isArray(userData.ruoli) ? userData.ruoli : [];
                }
                const normalizedRoles = normalizeRoles ? normalizeRoles(roles) : roles;

                const isManagerOrAdmin = hasAnyRole
                    ? hasAnyRole({ ruoli: normalizedRoles }, ['manager', 'amministratore'])
                    : false;
                const isFieldRole = hasAnyRole
                    ? hasAnyRole({ ruoli: normalizedRoles }, ['operaio', 'caposquadra'])
                    : false;

                if (isManagerOrAdmin || !isFieldRole) {
                    window.location.href = '../dashboard-standalone.html?ws=classic';
                    return;
                }

                if (!availableModules.includes('manodopera')) {
                    window.location.href = '../dashboard-standalone.html?ws=classic';
                    return;
                }

                const roleLabel = normalizedRoles.join(', ') || 'utente campo';
                setStatus(`Workspace mobile attivo (${roleLabel}).`);
            } catch (error) {
                console.error('[FIELD-WORKSPACE] Errore inizializzazione utente:', error);
                setStatus(`Errore caricamento: ${error.message}`, true);
            }
        });
    } catch (error) {
        console.error('[FIELD-WORKSPACE] Errore avvio:', error);
        setStatus(`Errore avvio: ${error.message}`, true);
    }
}

initFieldWorkspace();
