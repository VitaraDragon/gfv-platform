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
    query,
    where,
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
const selectedWorkCardEl = document.getElementById('selected-work-card');
const quickHoursFormEl = document.getElementById('quick-hours-form');
const hoursStatusEl = document.getElementById('hours-save-status');
const hoursValueEl = document.getElementById('ora-net-hours');
const oraStartEl = document.getElementById('ora-start');
const oraEndEl = document.getElementById('ora-end');
const oraBreakEl = document.getElementById('ora-break');
const oraNoteEl = document.getElementById('ora-note');
const lavoriDetailFrameEl = document.getElementById('lavori-detail-frame');
const lavoriFullDetailLinkEl = document.getElementById('lavori-full-detail-link');
const squadListEl = document.getElementById('squad-members-list');
const operaioModalEl = document.getElementById('operaio-contact-modal');
const operaioContactNameEl = document.getElementById('operaio-contact-name');
const operaioContactSubEl = document.getElementById('operaio-contact-sub');
const operaioContactCallEl = document.getElementById('operaio-contact-call');
const operaioContactMailEl = document.getElementById('operaio-contact-mail');

let currentUserData = null;
let currentUser = null;
let currentTenantId = null;
let activeSlides = [];
let currentSlideIndex = 0;
let cachedWorks = [];
let selectedWork = null;
let userIsCaposquadra = false;

function setStatus(text, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.style.color = isError ? '#fecaca' : 'rgba(255, 255, 255, 0.92)';
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
    const terreno = work.terrenoNome || work.terreno || '';
    return `${nome}${terreno ? ` - ${terreno}` : ''}`;
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
        const chosenFromUi = (selectedWorkEl && selectedWorkEl.value) || '';
        if (chosenFromUi) {
            const match = cachedWorks.find((w) => w.id === chosenFromUi);
            if (match) selectedWork = match;
        }
        if (works.length > 0 && !selectedWork) {
            selectedWork = works[0];
            if (selectedWorkEl) selectedWorkEl.value = selectedWork.id;
            if (quickWorkSelectEl) quickWorkSelectEl.value = selectedWork.id;
        }
        renderSelectedWorkCard();
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

function updateLavoriDetailEmbed() {
    if (!lavoriDetailFrameEl || !lavoriFullDetailLinkEl) return;
    const base = '../admin/lavori-caposquadra-standalone.html?ws=classic';
    if (!selectedWork) {
        lavoriDetailFrameEl.removeAttribute('src');
        lavoriFullDetailLinkEl.href = base;
        return;
    }
    const url = `${base}&focusLavoroId=${encodeURIComponent(selectedWork.id)}`;
    lavoriDetailFrameEl.src = url;
    lavoriFullDetailLinkEl.href = url;
}

function renderSquadList(squadLabel, members) {
    if (!squadListEl) return;
    squadListEl.innerHTML = '';
    const sub = document.createElement('div');
    sub.className = 'squad-squadra-name';
    sub.textContent = squadLabel;
    squadListEl.appendChild(sub);
    members.forEach((m) => {
        const fullName = `${m.nome || ''} ${m.cognome || ''}`.trim() || m.email || m.id;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'squad-member-row';
        btn.textContent = fullName;
        btn.addEventListener('click', () => openOperaioContactModal(m, fullName));
        squadListEl.appendChild(btn);
    });
}

function openOperaioContactModal(userRow, displayName) {
    if (!operaioModalEl || !operaioContactNameEl || !operaioContactSubEl) return;
    const email = String(userRow.email || '').trim();
    const cell = String(userRow.cellulare || userRow.telefono || userRow.cell || '').trim();
    operaioContactNameEl.textContent = displayName;
    const subParts = [email, cell].filter(Boolean);
    operaioContactSubEl.textContent = subParts.length ? subParts.join(' · ') : 'Contatti non disponibili in anagrafica.';

    const telCompact = cell.replace(/[\s()-]/g, '');
    if (operaioContactCallEl) {
        if (telCompact) {
            operaioContactCallEl.href = `tel:${telCompact}`;
            operaioContactCallEl.classList.remove('is-disabled');
        } else {
            operaioContactCallEl.href = '#';
            operaioContactCallEl.classList.add('is-disabled');
        }
    }
    if (operaioContactMailEl) {
        if (email) {
            operaioContactMailEl.href = `mailto:${email}`;
            operaioContactMailEl.classList.remove('is-disabled');
        } else {
            operaioContactMailEl.href = '#';
            operaioContactMailEl.classList.add('is-disabled');
        }
    }

    operaioModalEl.hidden = false;
    operaioModalEl.setAttribute('aria-hidden', 'false');
}

function closeOperaioContactModal() {
    if (!operaioModalEl) return;
    operaioModalEl.hidden = true;
    operaioModalEl.setAttribute('aria-hidden', 'true');
}

async function loadSquadMembersForCapo() {
    if (!squadListEl || !currentTenantId || !currentUser) return;
    squadListEl.innerHTML = '<div class="empty-state-inline">Caricamento squadra...</div>';
    try {
        const squadreRef = collection(getDb(), `tenants/${currentTenantId}/squadre`);
        let snapshot = await getDocs(query(squadreRef, where('caposquadraId', '==', currentUser.uid)));
        const altId = currentUserData && (currentUserData.id || currentUserData.uid);
        if (snapshot.empty && altId && altId !== currentUser.uid) {
            snapshot = await getDocs(query(squadreRef, where('caposquadraId', '==', altId)));
        }
        if (snapshot.empty) {
            squadListEl.innerHTML = '<div class="empty-state-inline">Nessuna squadra assegnata.</div>';
            return;
        }
        const squadDocs = [];
        snapshot.forEach((d) => {
            squadDocs.push({ id: d.id, ...d.data() });
        });
        squadDocs.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'it'));
        const operaioIdSet = new Set();
        squadDocs.forEach((s) => {
            (s.operai || []).forEach((oid) => {
                if (oid) operaioIdSet.add(oid);
            });
        });
        const squadLabel = squadDocs.length === 1
            ? (squadDocs[0].nome || 'Squadra')
            : `${squadDocs.length} squadre · membri unici`;
        if (operaioIdSet.size === 0) {
            squadListEl.innerHTML = '<div class="empty-state-inline">Nessun operaio in squadra.</div>';
            return;
        }
        const members = [];
        for (const oid of operaioIdSet) {
            const udoc = await getDoc(doc(getDb(), 'users', oid));
            if (udoc.exists()) {
                members.push({ id: udoc.id, ...udoc.data() });
            }
        }
        members.sort((a, b) => {
            const na = `${a.nome || ''} ${a.cognome || ''}`.trim() || a.email || '';
            const nb = `${b.nome || ''} ${b.cognome || ''}`.trim() || b.email || '';
            return na.localeCompare(nb, 'it');
        });
        renderSquadList(squadLabel, members);
    } catch (error) {
        console.error('[FIELD-WORKSPACE] Errore caricamento squadra:', error);
        squadListEl.innerHTML = '<div class="empty-state-inline">Errore caricamento squadra.</div>';
    }
}

function renderSelectedWorkCard() {
    if (!selectedWorkCardEl) return;
    if (!selectedWork) {
        selectedWorkCardEl.innerHTML = '<div class="empty-state-inline">Seleziona un lavoro nella prima schermata.</div>';
        updateLavoriDetailEmbed();
        return;
    }
    const raw = selectedWork.raw || {};
    const tipo = raw.tipoLavoro || raw.nome || '-';
    const terreno = raw.terrenoNome || raw.terreno || 'Non specificato';
    const data = raw.dataInizio && raw.dataInizio.toDate ? raw.dataInizio.toDate() : (raw.dataInizio ? new Date(raw.dataInizio) : null);
    const dataText = data && !Number.isNaN(data.getTime()) ? data.toLocaleDateString('it-IT') : 'Non specificata';
    const stato = raw.stato || 'in lavorazione';

    selectedWorkCardEl.innerHTML = `
        <div class="selected-work-title">${selectedWork.label}</div>
        <div class="selected-work-line"><strong>Tipo lavoro:</strong> ${tipo}</div>
        <div class="selected-work-line"><strong>Terreno:</strong> ${terreno}</div>
        <div class="selected-work-line"><strong>Data:</strong> ${dataText}</div>
        <div class="selected-work-line"><strong>Stato:</strong> ${stato}</div>
    `;
    updateLavoriDetailEmbed();
}

function calculateNetHours() {
    if (!hoursValueEl || !oraStartEl || !oraEndEl || !oraBreakEl) return 0;
    const start = oraStartEl.value;
    const end = oraEndEl.value;
    const breakMin = Math.max(0, parseInt(oraBreakEl.value || '0', 10) || 0);

    if (!start || !end) {
        hoursValueEl.textContent = '0.00';
        return 0;
    }

    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const startMinutes = (sh * 60) + sm;
    const endMinutes = (eh * 60) + em;
    if (endMinutes <= startMinutes) {
        hoursValueEl.textContent = '0.00';
        return 0;
    }
    const netMinutes = Math.max(0, endMinutes - startMinutes - breakMin);
    const netHours = netMinutes / 60;
    hoursValueEl.textContent = netHours.toFixed(2);
    return netHours;
}

async function saveQuickHours(event) {
    event.preventDefault();
    if (!hoursStatusEl) return;
    if (!selectedWork || !currentTenantId || !currentUser) {
        hoursStatusEl.textContent = 'Seleziona prima un lavoro.';
        hoursStatusEl.style.color = '#b91c1c';
        return;
    }
    const start = oraStartEl ? oraStartEl.value : '';
    const end = oraEndEl ? oraEndEl.value : '';
    if (!start || !end) {
        hoursStatusEl.textContent = 'Inserisci orario inizio e fine.';
        hoursStatusEl.style.color = '#b91c1c';
        return;
    }
    const netHours = calculateNetHours();
    if (netHours <= 0) {
        hoursStatusEl.textContent = 'Le ore nette devono essere maggiori di 0.';
        hoursStatusEl.style.color = '#b91c1c';
        return;
    }

    try {
        const [y, m, d] = getTodayIsoDate().split('-').map(Number);
        const nowDate = new Date(y, m - 1, d);
        const pauseMin = Math.max(0, parseInt((oraBreakEl && oraBreakEl.value) || '0', 10) || 0);
        const oraData = {
            operaioId: currentUser.uid,
            lavoroId: selectedWork.id,
            terrenoId: selectedWork.raw?.terrenoId || null,
            data: Timestamp.fromDate(nowDate),
            orarioInizio: start,
            orarioFine: end,
            pauseMinuti: pauseMin,
            oreNette: netHours,
            note: (oraNoteEl && oraNoteEl.value) ? oraNoteEl.value.trim() : '',
            stato: 'da_validare',
            creatoIl: serverTimestamp()
        };
        const oraRef = collection(getDb(), `tenants/${currentTenantId}/lavori/${selectedWork.id}/oreOperai`);
        await addDoc(oraRef, oraData);
        hoursStatusEl.textContent = `Ore salvate: ${netHours.toFixed(2)} h`;
        hoursStatusEl.style.color = '#166534';
    } catch (error) {
        console.error('[FIELD-WORKSPACE] Errore salvataggio ore:', error);
        hoursStatusEl.textContent = `Errore salvataggio: ${error.message}`;
        hoursStatusEl.style.color = '#b91c1c';
    }
}

function bindWorkSelection() {
    const onChange = (value) => {
        if (!value) return;
        const found = cachedWorks.find((w) => w.id === value);
        if (found) {
            selectedWork = found;
            renderSelectedWorkCard();
            updateLavoriDetailEmbed();
        }
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
            if (userIsCaposquadra) {
                await loadSquadMembersForCapo();
            }
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

function bindOperaioModal() {
    if (!operaioModalEl) return;
    operaioModalEl.addEventListener('click', (event) => {
        const t = event.target;
        if (t instanceof HTMLElement && t.getAttribute('data-close-modal') != null) {
            closeOperaioContactModal();
        }
    });
    const blockDisabled = (event) => {
        const a = event.currentTarget;
        if (a instanceof HTMLAnchorElement && a.classList.contains('is-disabled')) {
            event.preventDefault();
        }
    };
    if (operaioContactCallEl) operaioContactCallEl.addEventListener('click', blockDisabled);
    if (operaioContactMailEl) operaioContactMailEl.addEventListener('click', blockDisabled);
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
    if (quickHoursFormEl) {
        quickHoursFormEl.addEventListener('submit', saveQuickHours);
    }
    if (oraStartEl) oraStartEl.addEventListener('input', calculateNetHours);
    if (oraEndEl) oraEndEl.addEventListener('input', calculateNetHours);
    if (oraBreakEl) oraBreakEl.addEventListener('input', calculateNetHours);
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
    bindOperaioModal();

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
                userIsCaposquadra = isCaposquadra;
                setupSlidesForRole(isCaposquadra);
                // Ordine caposquadra richiesto:
                // Seleziona lavoro -> Segna ore -> Lavoro selezionato -> Squadra -> Comunicazioni -> Statistiche
                if (isCaposquadra) {
                    const order = ['Lavoro', 'Ore', 'Lavoro selezionato', 'Squadra', 'Comunicazioni', 'Statistiche'];
                    activeSlides.sort((a, b) => order.indexOf(a.dataset.slideTitle) - order.indexOf(b.dataset.slideTitle));
                    activeSlides.forEach((slide) => swiperEl.appendChild(slide));
                }
                bindSwiperNavigation();
                renderDots();
                updateNavButtons();
                goToSlide(0);
                bindWorkSelection();
                await loadWorksForSelection();
                if (isCaposquadra) {
                    await loadSquadMembersForCapo();
                }
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
