import {
    initializeFirebase,
    getAuthInstance,
    getDb,
    onAuthStateChanged,
    getDoc,
    doc,
    collection,
    getDocs,
    addDoc,
    serverTimestamp,
    Timestamp
} from '../../services/firebase-service.js';

const {
    normalizeRoles,
    hasAnyRole,
    setFieldWorkspacePreference
} = window.GFVDashboardUtils || {};

const statusEl = document.getElementById('field-mobile-status');
const swiperEl = document.getElementById('field-swiper');
const dotsEl = document.getElementById('slide-dots');
const btnPrevEl = document.getElementById('btn-prev-slide');
const btnNextEl = document.getElementById('btn-next-slide');
const selectedWorkEl = document.getElementById('selected-work');
const quickWorkSelectEl = document.getElementById('quick-work-select');
const gpsSuggestionEl = document.getElementById('gps-suggestion');
const quickFormEl = document.getElementById('quick-communication-form');
const quickStatusEl = document.getElementById('quick-comm-status');
const refreshWorksBtnEl = document.getElementById('btn-refresh-works');

let currentUserData = null;
let currentUser = null;
let currentTenantId = null;
let activeSlides = [];
let currentSlideIndex = 0;
let cachedWorks = [];

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

function getTodayIsoDate() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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

function setupSlidesForRole(isCaposquadra) {
    const allSlides = Array.from(swiperEl.querySelectorAll('.field-slide'));
    allSlides.forEach((slide) => {
        const isCapoOnly = slide.classList.contains('capo-only');
        if (isCapoOnly && !isCaposquadra) {
            slide.hidden = true;
        } else {
            slide.hidden = false;
        }
    });
    activeSlides = allSlides.filter((slide) => !slide.hidden);
}

function renderDots() {
    if (!dotsEl) return;
    dotsEl.innerHTML = activeSlides.map((_, idx) => (
        `<span class="slide-dot${idx === currentSlideIndex ? ' active' : ''}" data-dot-index="${idx}"></span>`
    )).join('');
}

function updateNavButtons() {
    if (btnPrevEl) btnPrevEl.disabled = currentSlideIndex <= 0;
    if (btnNextEl) {
        const isLast = currentSlideIndex >= activeSlides.length - 1;
        btnNextEl.textContent = isLast ? 'Fine' : 'Avanti';
    }
}

function goToSlide(index) {
    const bounded = Math.max(0, Math.min(index, activeSlides.length - 1));
    const slide = activeSlides[bounded];
    if (!slide || !swiperEl) return;
    currentSlideIndex = bounded;
    swiperEl.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
    renderDots();
    updateNavButtons();
}

function syncSlideFromScroll() {
    if (!swiperEl || activeSlides.length === 0) return;
    const center = swiperEl.scrollLeft + (swiperEl.clientWidth / 2);
    let bestIdx = 0;
    let bestDelta = Number.POSITIVE_INFINITY;
    activeSlides.forEach((slide, idx) => {
        const slideCenter = slide.offsetLeft + (slide.clientWidth / 2);
        const delta = Math.abs(center - slideCenter);
        if (delta < bestDelta) {
            bestDelta = delta;
            bestIdx = idx;
        }
    });
    if (bestIdx !== currentSlideIndex) {
        currentSlideIndex = bestIdx;
        renderDots();
        updateNavButtons();
    }
}

function bindSwiperNavigation() {
    if (btnPrevEl) {
        btnPrevEl.addEventListener('click', () => goToSlide(currentSlideIndex - 1));
    }
    if (btnNextEl) {
        btnNextEl.addEventListener('click', () => {
            if (currentSlideIndex < activeSlides.length - 1) {
                goToSlide(currentSlideIndex + 1);
            }
        });
    }
    if (swiperEl) {
        swiperEl.addEventListener('scroll', syncSlideFromScroll, { passive: true });
    }
    if (dotsEl) {
        dotsEl.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const raw = target.getAttribute('data-dot-index');
            if (raw == null) return;
            const idx = parseInt(raw, 10);
            if (!Number.isNaN(idx)) goToSlide(idx);
        });
    }
}

function populateWorkSelectors(works) {
    const options = ['<option value="">Seleziona lavoro</option>']
        .concat(works.map((work) => `<option value="${work.id}">${work.label}</option>`))
        .join('');
    if (selectedWorkEl) {
        selectedWorkEl.innerHTML = options;
    }
    if (quickWorkSelectEl) {
        quickWorkSelectEl.innerHTML = options;
    }
    try {
        const saved = localStorage.getItem('gfv_mobile_selected_work_id');
        if (saved) {
            if (selectedWorkEl) selectedWorkEl.value = saved;
            if (quickWorkSelectEl) quickWorkSelectEl.value = saved;
        }
    } catch (error) {
        // ignore
    }
}

function pickGpsSuggestion(works) {
    if (!gpsSuggestionEl) return;
    if (!works.length) {
        gpsSuggestionEl.textContent = 'Nessun suggerimento GPS disponibile.';
        return;
    }
    // Suggerimento semplice: il primo lavoro attivo (placeholder per futura distanza reale).
    const first = works[0];
    gpsSuggestionEl.textContent = `Suggerimento: ${first.label} (proposta rapida, conferma manualmente).`;
}

function normalizeWorkLabel(work) {
    const nome = work.nome || work.tipoLavoro || work.titolo || 'Lavoro';
    const terreno = work.terrenoNome || work.terreno || work.terrenoId || '';
    const stato = work.stato || '';
    return `${nome}${terreno ? ` - ${terreno}` : ''}${stato ? ` [${stato}]` : ''}`;
}

function isWorkRelevantForFieldRole(work) {
    const stato = (work.stato || '').toLowerCase();
    const allowedStates = ['assegnato', 'in_corso', 'in corso', 'attivo', 'pianificato', 'da_pianificare', 'aperto'];
    if (!stato) return true;
    return allowedStates.includes(stato);
}

function isAssignedToCurrentUser(work) {
    if (!currentUser) return false;
    const uid = currentUser.uid;
    const directIds = [work.operaioId, work.caposquadraId, work.assegnatoA];
    if (directIds.includes(uid)) return true;
    const arrays = [work.operai, work.operaiIds, work.utentiAssegnati];
    return arrays.some((list) => Array.isArray(list) && list.includes(uid));
}

async function loadWorksForSelection() {
    if (!currentTenantId || !currentUser) return;
    if (selectedWorkEl) {
        selectedWorkEl.innerHTML = '<option value="">Caricamento lavori...</option>';
    }
    try {
        const lavoriRef = collection(getDb(), `tenants/${currentTenantId}/lavori`);
        const snapshot = await getDocs(lavoriRef);
        const works = [];
        snapshot.forEach((docSnap) => {
            const work = { id: docSnap.id, ...docSnap.data() };
            if (!isWorkRelevantForFieldRole(work)) return;
            if (!isAssignedToCurrentUser(work)) return;
            works.push({
                id: work.id,
                label: normalizeWorkLabel(work),
                raw: work
            });
        });

        if (works.length === 0) {
            // Fallback: mostra almeno i lavori "rilevanti" se non è disponibile l'assegnazione esplicita.
            snapshot.forEach((docSnap) => {
                const work = { id: docSnap.id, ...docSnap.data() };
                if (!isWorkRelevantForFieldRole(work)) return;
                works.push({
                    id: work.id,
                    label: normalizeWorkLabel(work),
                    raw: work
                });
            });
        }

        works.sort((a, b) => a.label.localeCompare(b.label, 'it'));
        cachedWorks = works;
        populateWorkSelectors(works);
        pickGpsSuggestion(works);
    } catch (error) {
        console.error('[FIELD-WORKSPACE] Errore caricamento lavori:', error);
        if (selectedWorkEl) {
            selectedWorkEl.innerHTML = '<option value="">Errore caricamento lavori</option>';
        }
        if (gpsSuggestionEl) {
            gpsSuggestionEl.textContent = 'Errore nel recupero lavori.';
        }
    }
}

function bindWorkSelection() {
    const onChange = (value) => {
        if (!value) return;
        if (selectedWorkEl && selectedWorkEl.value !== value) selectedWorkEl.value = value;
        if (quickWorkSelectEl && quickWorkSelectEl.value !== value) quickWorkSelectEl.value = value;
        try {
            localStorage.setItem('gfv_mobile_selected_work_id', value);
        } catch (error) {
            // ignore
        }
    };
    if (selectedWorkEl) {
        selectedWorkEl.addEventListener('change', (e) => onChange(e.target.value));
    }
    if (quickWorkSelectEl) {
        quickWorkSelectEl.addEventListener('change', (e) => onChange(e.target.value));
    }
    if (refreshWorksBtnEl) {
        refreshWorksBtnEl.addEventListener('click', async () => {
            await loadWorksForSelection();
            setStatus('Elenco lavori aggiornato.');
        });
    }
}

async function sendQuickCommunication(event) {
    event.preventDefault();
    if (!quickStatusEl) return;
    if (!currentTenantId || !currentUser) {
        quickStatusEl.textContent = 'Sessione non pronta.';
        quickStatusEl.style.color = '#b91c1c';
        return;
    }

    const workId = quickWorkSelectEl ? quickWorkSelectEl.value : '';
    const dateIso = document.getElementById('quick-comm-date')?.value || getTodayIsoDate();
    const timeValue = document.getElementById('quick-comm-time')?.value || '07:00';
    const message = (document.getElementById('quick-comm-message')?.value || '').trim();

    if (!workId || !message) {
        quickStatusEl.textContent = 'Seleziona lavoro e inserisci un messaggio.';
        quickStatusEl.style.color = '#b91c1c';
        return;
    }

    const selected = cachedWorks.find((w) => w.id === workId);
    try {
        const [y, m, d] = dateIso.split('-').map(Number);
        const dataDate = new Date(y, (m || 1) - 1, d || 1);
        await addDoc(collection(getDb(), `tenants/${currentTenantId}/comunicazioni`), {
            caposquadraId: currentUser.uid,
            lavoroId: workId,
            lavoroNome: selected?.label || 'Lavoro',
            messaggio: message,
            data: Timestamp.fromDate(dataDate),
            orario: timeValue,
            stato: 'attiva',
            conferme: [],
            createdAt: serverTimestamp(),
            source: 'mobile_field_workspace'
        });
        quickStatusEl.textContent = 'Comunicazione inviata.';
        quickStatusEl.style.color = '#166534';
        const msgInput = document.getElementById('quick-comm-message');
        if (msgInput) msgInput.value = '';
    } catch (error) {
        console.error('[FIELD-WORKSPACE] Errore invio comunicazione:', error);
        quickStatusEl.textContent = `Errore invio: ${error.message}`;
        quickStatusEl.style.color = '#b91c1c';
    }
}

function bindToolbar() {
    const btnClassic = document.getElementById('btn-switch-classic');
    const btnAuto = document.getElementById('btn-switch-auto');

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

    if (quickFormEl) {
        quickFormEl.addEventListener('submit', sendQuickCommunication);
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
                currentUserData = { ...userData, ruoli: normalizedRoles };
                currentUser = user;
                currentTenantId = tenantId;

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

                const isCaposquadra = hasAnyRole
                    ? hasAnyRole({ ruoli: normalizedRoles }, ['caposquadra'])
                    : false;
                setupSlidesForRole(isCaposquadra);
                bindSwiperNavigation();
                renderDots();
                updateNavButtons();
                goToSlide(0);
                bindWorkSelection();
                await loadWorksForSelection();
                const dateInput = document.getElementById('quick-comm-date');
                if (dateInput) dateInput.value = getTodayIsoDate();

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
