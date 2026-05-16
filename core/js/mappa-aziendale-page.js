/**
 * Pagina dedicata Mappa aziendale (stessa logica della dashboard, fullscreen).
 * Solo manager / amministratore (stesso criterio d’uso della mappa in dashboard).
 */
import { createMappaAziendaleSection, loadMappaAziendale } from './dashboard-maps.js';

async function resolveCurrentTenantId(userData) {
    if (!userData) return null;
    const { getCurrentTenantId, setCurrentTenantId } = await import('../services/tenant-service.js');
    let tid = getCurrentTenantId();
    if (tid) return tid;
    if (userData.tenantId) {
        setCurrentTenantId(userData.tenantId);
        return userData.tenantId;
    }
    if (userData.tenantMemberships && typeof userData.tenantMemberships === 'object') {
        const entries = Object.entries(userData.tenantMemberships);
        for (const [id, m] of entries) {
            if (m && m.stato === 'attivo') {
                setCurrentTenantId(id);
                return id;
            }
        }
        const def = entries.find(([, m]) => m && m.tenantIdPredefinito);
        if (def) {
            setCurrentTenantId(def[0]);
            return def[0];
        }
        if (entries.length === 1) {
            const id = entries[0][0];
            setCurrentTenantId(id);
            return id;
        }
        if (entries.length > 1) {
            const id = entries[0][0];
            setCurrentTenantId(id);
            return id;
        }
    }
    return null;
}

function renderDenied(message) {
    const root = document.getElementById('mappa-page-root');
    if (!root) return;
    root.innerHTML = `
        <div class="dashboard-section" style="max-width:640px;margin:24px auto;">
            <h2>🗺️ Mappa aziendale</h2>
            <p style="color:#666;margin:16px 0;">${message}</p>
            <p><a href="dashboard-standalone.html" class="action-card" style="display:inline-block;padding:12px 20px;text-decoration:none;color:#333;">← Torna alla dashboard</a></p>
        </div>
    `;
}

function renderError(message) {
    const root = document.getElementById('mappa-page-root');
    if (!root) return;
    root.innerHTML = `
        <div class="dashboard-section" style="max-width:640px;margin:24px auto;">
            <h2 style="color:#dc3545;">⚠️ Errore</h2>
            <p style="color:#666;">${message}</p>
        </div>
    `;
}

export async function bootstrapMappaAziendalePage() {
    const { waitForConfig, loadGoogleMapsAPI } = window.GFVConfigLoader;
    const { hasRole, hasManodoperaModule, normalizeRoles, escapeHtml } = window.GFVDashboardUtils;

    const firebaseConfig = await waitForConfig();

    const {
        initializeFirebase,
        getAuthInstance,
        getDb,
        getAppInstance,
        onAuthStateChanged,
        getDoc,
        doc,
        collection,
        getDocs,
        signOut
    } = await import('../services/firebase-service.js');

    initializeFirebase(firebaseConfig);
    const auth = getAuthInstance();
    const db = getDb();
    const app = getAppInstance();

    window.googleMapsReady = false;
    loadGoogleMapsAPI().then(() => {
        window.googleMapsReady = true;
    }).catch(() => {});

    const dependencies = {
        app,
        db,
        auth,
        collection,
        getDocs,
        escapeHtml,
        loadGoogleMapsAPI
    };

    const logoutBtn = document.getElementById('mappa-logout-button');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
            } catch (e) {
                console.warn(e);
            }
            window.location.href = './auth/login-standalone.html';
        });
    }

    onAuthStateChanged(auth, async (user) => {
        const root = document.getElementById('mappa-page-root');
        if (!user) {
            window.location.href = './auth/login-standalone.html';
            return;
        }

        try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            if (!userDoc.exists()) {
                renderError('Profilo utente non trovato.');
                return;
            }

            const userData = userDoc.data();
            const { getUserRolesForTenant } = await import('../services/tenant-service.js');
            const currentTenantId = await resolveCurrentTenantId(userData);

            let rolesForCurrentTenant = [];
            if (currentTenantId) {
                rolesForCurrentTenant = await getUserRolesForTenant(currentTenantId, user.uid);
            }
            if (rolesForCurrentTenant.length === 0) {
                rolesForCurrentTenant = userData.ruoli || [];
            }

            const normalizedRoles = normalizeRoles(rolesForCurrentTenant);
            const userDataNormalized = {
                ...userData,
                ruoli: normalizedRoles,
                tenantId: currentTenantId
            };

            const canUseMap = hasRole(userDataNormalized, 'manager') || hasRole(userDataNormalized, 'amministratore');
            if (!canUseMap) {
                renderDenied('La mappa aziendale è riservata a manager e amministratori.');
                return;
            }

            let availableModules = [];
            if (currentTenantId) {
                try {
                    const tenantDoc = await getDoc(doc(db, 'tenants', currentTenantId));
                    if (tenantDoc.exists()) {
                        availableModules = tenantDoc.data().modules || [];
                    }
                } catch (e) {
                    console.warn('Moduli tenant:', e);
                }
            }

            const hasManodopera = hasManodoperaModule(availableModules);

            const userInfo = document.getElementById('mappa-user-info');
            if (userInfo) {
                userInfo.textContent = `${userData.nome || ''} ${userData.cognome || ''}`.trim() || user.email || '';
            }

            if (!root) return;
            root.innerHTML = '';

            const section = createMappaAziendaleSection(userDataNormalized, hasManodopera, (ud, hm) => {
                loadMappaAziendale(ud, hm, dependencies);
            });
            section.classList.add('mappa-page-map-section');
            root.appendChild(section);
        } catch (err) {
            console.error('[Mappa aziendale]', err);
            renderError(err.message || 'Errore durante il caricamento.');
        }
    });
}
