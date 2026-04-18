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
    updateDoc,
    query,
    where,
    serverTimestamp,
    Timestamp
} from '../../services/firebase-service.js';

import {
    fetchLavoriDocumentsForFieldUser,
    sliceOperaioLavoriWindow
} from '../../services/manodopera-lavori-scope.js';

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
const inlineTeamSectionEl = document.getElementById('inline-team-section');
const inlineValidateHoursSectionEl = document.getElementById('inline-validate-hours-section');
const pendingHoursListEl = document.getElementById('pending-hours-list');
const sentCommunicationsListEl = document.getElementById('sent-communications-list');
const operaioModalEl = document.getElementById('operaio-contact-modal');
const operaioContactNameEl = document.getElementById('operaio-contact-name');
const operaioContactSubEl = document.getElementById('operaio-contact-sub');
const operaioContactCallEl = document.getElementById('operaio-contact-call');
const operaioContactMailEl = document.getElementById('operaio-contact-mail');
const btnModeMobileEl = document.getElementById('btn-mode-mobile');
const btnModeDesktopEl = document.getElementById('btn-mode-desktop');
const btnOpenOptionsEl = document.getElementById('btn-open-options');
const optionsMenuEl = document.getElementById('field-options-menu');
const fieldToolbarUserEl = document.getElementById('field-toolbar-user');
const fieldToolbarUserNameEl = document.getElementById('field-toolbar-user-name');
const fieldToolbarUserRolesEl = document.getElementById('field-toolbar-user-roles');

let currentUserData = null;
let currentUser = null;
let currentTenantId = null;
let activeSlides = [];
let currentSlideIndex = 0;
let cachedWorks = [];
let selectedWork = null;
let userIsCaposquadra = false;
let userIsOperaio = false;
let currentPendingHours = [];
let pullTouchStartY = 0;
let pullTouchStartX = 0;
let pendingFocusLavoroIdFromUrl = null;
let pendingOpenSlideFromUrl = null;

function setStatus(text, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.style.color = isError ? '#fecaca' : 'rgba(255, 255, 255, 0.92)';
}

function formatRoleLabelsItalian(roles) {
    if (!Array.isArray(roles) || roles.length === 0) return '';
    const map = {
        operaio: 'Operaio',
        caposquadra: 'Caposquadra',
        manager: 'Manager',
        amministratore: 'Amministratore'
    };
    return roles.map((r) => {
        const key = String(r || '').toLowerCase();
        if (map[key]) return map[key];
        const s = String(r || '').trim();
        if (!s) return '';
        return s.charAt(0).toUpperCase() + s.slice(1);
    }).filter(Boolean).join(' · ');
}

function updateFieldHeaderUser(displayName, roles) {
    if (!fieldToolbarUserEl || !fieldToolbarUserNameEl || !fieldToolbarUserRolesEl) return;
    const name = (displayName || '').trim() || 'Account';
    fieldToolbarUserNameEl.textContent = name;
    const rolesText = formatRoleLabelsItalian(roles);
    fieldToolbarUserRolesEl.textContent = rolesText || 'Utente campo';
    fieldToolbarUserEl.hidden = false;
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

function readBootParamsFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        pendingFocusLavoroIdFromUrl = params.get('focusLavoroId') || null;
        pendingOpenSlideFromUrl = params.get('openSlide') || null;
    } catch (error) {
        pendingFocusLavoroIdFromUrl = null;
        pendingOpenSlideFromUrl = null;
    }
}

function getTodayIsoDate() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function setModeButtonsState(mode) {
    if (btnModeMobileEl) btnModeMobileEl.classList.toggle('active', mode === 'mobile' || mode === 'auto');
    if (btnModeDesktopEl) btnModeDesktopEl.classList.toggle('active', mode === 'classic');
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

function findSlideIndexByToken(token) {
    if (!token || activeSlides.length === 0) return -1;
    const normalized = String(token).trim().toLowerCase();
    return activeSlides.findIndex((slide) => {
        const title = String(slide.dataset.slideTitle || '').trim().toLowerCase();
        if (normalized === 'dettaglio-lavoro' || normalized === 'lavoro-selezionato') {
            return title === 'ore';
        }
        if (normalized === 'ore' || normalized === 'segna-ore') {
            return title === 'ore';
        }
        if (normalized === 'lavoro') {
            return title === 'lavoro';
        }
        if (normalized === 'comunicazioni') {
            return title === 'comunicazioni';
        }
        return title === normalized;
    });
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
        if (pendingFocusLavoroIdFromUrl) {
            if (selectedWorkEl) selectedWorkEl.value = pendingFocusLavoroIdFromUrl;
            if (quickWorkSelectEl) quickWorkSelectEl.value = pendingFocusLavoroIdFromUrl;
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

async function loadWorksForSelection() {
    if (!currentTenantId || !currentUser) return;
    if (selectedWorkEl) {
        selectedWorkEl.innerHTML = '<option value="">Caricamento lavori...</option>';
    }
    try {
        const userId = (currentUserData && (currentUserData.id || currentUserData.uid)) || currentUser.uid;
        const rawList = await fetchLavoriDocumentsForFieldUser(getDb(), currentTenantId, userId, {
            isCaposquadra: userIsCaposquadra,
            isOperaio: userIsOperaio
        });

        let eligible = rawList.filter((w) => isWorkRelevantForFieldRole(w));

        if (userIsOperaio && !userIsCaposquadra && eligible.length > 3) {
            let focus = pendingFocusLavoroIdFromUrl;
            try {
                if (!focus) focus = localStorage.getItem('gfv_mobile_selected_work_id');
            } catch (error) {
                // ignore
            }
            eligible = sliceOperaioLavoriWindow(eligible, { focusLavoroId: focus || null, maxNeighbors: 1 });
        }

        const works = eligible.map((work) => ({
            id: work.id,
            label: normalizeWorkLabel(work),
            raw: work
        }));

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
        syncLavoroOperativoEmbeds();
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
    const fullUrl = `${base}&focusLavoroId=${encodeURIComponent(selectedWork.id)}`;
    const compactUrl = `${fullUrl}&embed=mobile`;
    lavoriDetailFrameEl.src = compactUrl;
    lavoriFullDetailLinkEl.href = fullUrl;
}

function syncLavoroOperativoEmbeds() {
    updateLavoriDetailEmbed();
    if (userIsCaposquadra) {
        loadPendingHoursForSelectedWork().catch(() => {});
    }
}

function formatDateShort(dateLike) {
    if (!dateLike) return '';
    const d = dateLike.toDate ? dateLike.toDate() : new Date(dateLike);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('it-IT');
}

function escapeHtmlUnsafe(raw) {
    return String(raw || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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

function renderPendingHours() {
    if (!pendingHoursListEl) return;
    if (!selectedWork) {
        pendingHoursListEl.innerHTML = '<div class="empty-state-inline">Seleziona un lavoro per vedere le ore da validare.</div>';
        return;
    }
    if (!currentPendingHours.length) {
        pendingHoursListEl.innerHTML = '<div class="empty-state-inline">Nessuna ora in attesa di validazione.</div>';
        return;
    }
    pendingHoursListEl.innerHTML = currentPendingHours.map((row) => {
        const who = escapeHtmlUnsafe(row.operaioNome || row.operaioId || 'Operaio');
        const ore = Number(row.oreNette || 0).toFixed(2);
        const time = `${escapeHtmlUnsafe(row.orarioInizio || '--:--')} - ${escapeHtmlUnsafe(row.orarioFine || '--:--')}`;
        return `
            <div class="inline-item">
                <div class="inline-item-head">
                    <div class="inline-item-title">${who}</div>
                    <div class="inline-item-sub">${formatDateShort(row.data) || 'Data non indicata'}</div>
                </div>
                <div class="inline-item-sub">${time} • ${ore} h</div>
                <div class="inline-item-actions">
                    <button type="button" class="mini-btn approve" data-approve-hour-id="${row.id}">✅ Approva</button>
                    <button type="button" class="mini-btn reject" data-reject-hour-id="${row.id}">❌ Rifiuta</button>
                </div>
            </div>
        `;
    }).join('');
}

async function loadPendingHoursForSelectedWork() {
    if (!pendingHoursListEl) return;
    if (!selectedWork || !currentTenantId) {
        renderPendingHours();
        return;
    }
    pendingHoursListEl.innerHTML = '<div class="empty-state-inline">Caricamento ore da validare...</div>';
    try {
        const oreRef = collection(getDb(), `tenants/${currentTenantId}/lavori/${selectedWork.id}/oreOperai`);
        const snap = await getDocs(query(oreRef, where('stato', '==', 'da_validare')));
        const rows = [];
        for (const docSnap of snap.docs) {
            const data = docSnap.data();
            let operaioNome = '';
            if (data.operaioId) {
                const userDoc = await getDoc(doc(getDb(), 'users', data.operaioId));
                if (userDoc.exists()) {
                    const u = userDoc.data();
                    operaioNome = `${u.nome || ''} ${u.cognome || ''}`.trim() || u.email || '';
                }
            }
            rows.push({ id: docSnap.id, ...data, operaioNome });
        }
        rows.sort((a, b) => {
            const ad = (a.creatoIl && a.creatoIl.toDate) ? a.creatoIl.toDate().getTime() : 0;
            const bd = (b.creatoIl && b.creatoIl.toDate) ? b.creatoIl.toDate().getTime() : 0;
            return bd - ad;
        });
        currentPendingHours = rows;
        renderPendingHours();
    } catch (error) {
        console.error('[FIELD-WORKSPACE] Errore ore da validare:', error);
        pendingHoursListEl.innerHTML = '<div class="empty-state-inline">Errore caricamento ore da validare.</div>';
    }
}

async function updateHourValidationStatus(hourId, status) {
    if (!selectedWork || !currentTenantId || !currentUser || !hourId) return;
    const hourRef = doc(getDb(), `tenants/${currentTenantId}/lavori/${selectedWork.id}/oreOperai`, hourId);
    if (status === 'validate') {
        await updateDoc(hourRef, {
            stato: 'validate',
            validatoDa: currentUser.uid,
            validatoIl: serverTimestamp(),
            rifiutatoDa: null
        });
    } else {
        await updateDoc(hourRef, {
            stato: 'rifiutate',
            rifiutatoDa: currentUser.uid,
            rifiutatoIl: serverTimestamp()
        });
    }
}

async function loadSentCommunications() {
    if (!sentCommunicationsListEl || !currentTenantId || !currentUser) return;
    sentCommunicationsListEl.innerHTML = '<div class="empty-state-inline">Caricamento comunicazioni inviate...</div>';
    try {
        const commRef = collection(getDb(), `tenants/${currentTenantId}/comunicazioni`);
        const snap = await getDocs(query(commRef, where('caposquadraId', '==', currentUser.uid)));
        const rows = [];
        snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
        rows.sort((a, b) => {
            const ad = (a.createdAt && a.createdAt.toDate) ? a.createdAt.toDate().getTime() : 0;
            const bd = (b.createdAt && b.createdAt.toDate) ? b.createdAt.toDate().getTime() : 0;
            return bd - ad;
        });
        const top = rows.slice(0, 5);
        if (!top.length) {
            sentCommunicationsListEl.innerHTML = '<div class="empty-state-inline">Nessuna comunicazione inviata.</div>';
            return;
        }
        sentCommunicationsListEl.innerHTML = top.map((row) => `
            <div class="inline-item">
                <div class="inline-item-head">
                    <div class="inline-item-title">${escapeHtmlUnsafe(row.lavoroNome || 'Lavoro')}</div>
                    <div class="inline-item-sub">${escapeHtmlUnsafe(row.orario || '--:--')} • ${formatDateShort(row.data) || '-'}</div>
                </div>
                <div class="inline-item-sub">${escapeHtmlUnsafe((row.messaggio || '').slice(0, 120))}</div>
                <div class="inline-item-head" style="margin-top: 6px; margin-bottom: 0;">
                    <div class="inline-item-sub">Conferme ricezione</div>
                    <span class="inline-item-badge">👍 ${(Array.isArray(row.conferme) ? row.conferme.length : 0)}/${(Array.isArray(row.destinatari) && row.destinatari.length > 0) ? row.destinatari.length : '?'}</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('[FIELD-WORKSPACE] Errore comunicazioni inviate:', error);
        sentCommunicationsListEl.innerHTML = '<div class="empty-state-inline">Errore caricamento comunicazioni.</div>';
    }
}

async function refreshWorkspaceData() {
    await loadWorksForSelection();
    if (userIsCaposquadra) {
        await loadSquadMembersForCapo();
        await loadPendingHoursForSelectedWork();
        await loadSentCommunications();
    }
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
            syncLavoroOperativoEmbeds();
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
            await refreshWorkspaceData();
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
    const destinatari = (() => {
        const raw = selected?.raw || {};
        const all = []
            .concat(Array.isArray(raw.operai) ? raw.operai : [])
            .concat(Array.isArray(raw.operaiIds) ? raw.operaiIds : [])
            .concat(Array.isArray(raw.utentiAssegnati) ? raw.utentiAssegnati : []);
        return Array.from(new Set(all.filter((id) => id && id !== currentUser.uid)));
    })();
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
            destinatari,
            createdAt: serverTimestamp(),
            source: 'mobile_field_workspace'
        });
        quickStatusEl.textContent = 'Comunicazione inviata.';
        quickStatusEl.style.color = '#166534';
        const msgInput = document.getElementById('quick-comm-message');
        if (msgInput) msgInput.value = '';
        await loadSentCommunications();
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

function bindInlineSectionsActions() {
    if (!pendingHoursListEl) return;
    pendingHoursListEl.addEventListener('click', async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const approveId = target.getAttribute('data-approve-hour-id');
        const rejectId = target.getAttribute('data-reject-hour-id');
        if (!approveId && !rejectId) return;
        try {
            if (approveId) {
                await updateHourValidationStatus(approveId, 'validate');
            } else if (rejectId) {
                await updateHourValidationStatus(rejectId, 'rifiutate');
            }
            await loadPendingHoursForSelectedWork();
        } catch (error) {
            console.error('[FIELD-WORKSPACE] Errore aggiornamento validazione ore:', error);
        }
    });
}

function bindPullToRefresh() {
    if (!swiperEl) return;
    swiperEl.addEventListener('touchstart', (event) => {
        const t = event.touches && event.touches[0];
        if (!t) return;
        pullTouchStartY = t.clientY;
        pullTouchStartX = t.clientX;
    }, { passive: true });

    swiperEl.addEventListener('touchend', async (event) => {
        const t = event.changedTouches && event.changedTouches[0];
        if (!t) return;
        const deltaY = t.clientY - pullTouchStartY;
        const deltaX = Math.abs(t.clientX - pullTouchStartX);
        const onFirstSlide = currentSlideIndex === 0;
        const pageOnTop = (window.scrollY || document.documentElement.scrollTop || 0) <= 4;
        if (onFirstSlide && pageOnTop && deltaY > 80 && deltaX < 45) {
            setStatus('Aggiornamento dati...');
            try {
                await refreshWorkspaceData();
                setStatus('Dati aggiornati.');
            } catch (error) {
                console.error('[FIELD-WORKSPACE] Errore pull-to-refresh:', error);
                setStatus('Errore aggiornamento dati.', true);
            }
        }
    }, { passive: true });
}

function bindToolbar() {
    if (btnModeDesktopEl) {
        btnModeDesktopEl.addEventListener('click', () => {
            setFieldWorkspacePreference('classic');
            setModeButtonsState('classic');
            window.location.href = '../dashboard-standalone.html?ws=classic';
        });
    }

    if (btnModeMobileEl) {
        btnModeMobileEl.addEventListener('click', () => {
            setFieldWorkspacePreference('auto');
            setModeButtonsState('mobile');
            setStatus('Versione mobile attiva.');
        });
    }

    if (btnOpenOptionsEl && optionsMenuEl) {
        btnOpenOptionsEl.addEventListener('click', (event) => {
            event.stopPropagation();
            optionsMenuEl.hidden = !optionsMenuEl.hidden;
        });
        document.addEventListener('click', (event) => {
            if (!optionsMenuEl.hidden) {
                const target = event.target;
                if (!(target instanceof Node)) return;
                const wrap = btnOpenOptionsEl.closest('.field-options-wrap');
                if (wrap && !wrap.contains(target)) {
                    optionsMenuEl.hidden = true;
                }
            }
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
    if (pref) {
        setFieldWorkspacePreference(pref);
        setModeButtonsState(pref);
        return;
    }
    setModeButtonsState('mobile');
}

async function initFieldWorkspace() {
    setStatus('Caricamento workspace mobile...');
    readBootParamsFromUrl();
    applyUrlPreference();
    bindToolbar();
    bindOperaioModal();
    bindInlineSectionsActions();
    bindPullToRefresh();

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
                const isOperaio = hasAnyRole
                    ? hasAnyRole({ ruoli: normalizedRoles }, ['operaio'])
                    : false;
                userIsCaposquadra = isCaposquadra;
                userIsOperaio = isOperaio;
                if (inlineTeamSectionEl) {
                    inlineTeamSectionEl.hidden = !isCaposquadra;
                }
                if (inlineValidateHoursSectionEl) {
                    inlineValidateHoursSectionEl.hidden = !isCaposquadra;
                }
                setupSlidesForRole(isCaposquadra);
                // Ordine caposquadra richiesto:
                // Seleziona lavoro (+ squadra inline) -> Comunicazioni -> Segna ore -> I miei lavori -> Statistiche
                if (isCaposquadra) {
                    const order = ['Lavoro', 'Comunicazioni', 'Ore', 'Statistiche'];
                    activeSlides.sort((a, b) => order.indexOf(a.dataset.slideTitle) - order.indexOf(b.dataset.slideTitle));
                    activeSlides.forEach((slide) => swiperEl.appendChild(slide));
                }
                bindSwiperNavigation();
                renderDots();
                updateNavButtons();
                const requestedSlideIdx = findSlideIndexByToken(pendingOpenSlideFromUrl);
                goToSlide(requestedSlideIdx >= 0 ? requestedSlideIdx : 0);
                bindWorkSelection();
                await refreshWorkspaceData();

                const displayName = `${currentUserData.nome || ''} ${currentUserData.cognome || ''}`.trim()
                    || (user && user.email) || '';
                updateFieldHeaderUser(displayName, normalizedRoles);

                try {
                    const fieldDashboardPayload = {
                        tenantId: tenantId,
                        moduli_attivi: availableModules,
                        utente_corrente: {
                            nome: displayName,
                            ruoli: normalizedRoles
                        },
                        info_azienda: { moduli_attivi: availableModules }
                    };
                    function applyFieldTonyDashboard() {
                        if (typeof window.setTonyContext === 'function') {
                            window.setTonyContext(fieldDashboardPayload);
                            return true;
                        }
                        if (window.Tony && typeof window.Tony.setContext === 'function') {
                            const d = (window.Tony.context && window.Tony.context.dashboard) || {};
                            window.Tony.setContext('dashboard', Object.assign({}, d, fieldDashboardPayload));
                            return true;
                        }
                        return false;
                    }
                    if (!applyFieldTonyDashboard()) {
                        let tonyAttempts = 0;
                        const tonyIv = setInterval(function() {
                            tonyAttempts += 1;
                            if (applyFieldTonyDashboard() || tonyAttempts >= 30) {
                                clearInterval(tonyIv);
                            }
                        }, 400);
                    }
                    if (typeof window.syncTonyModules === 'function') {
                        window.syncTonyModules(availableModules);
                    }
                } catch (tonyErr) {
                    console.warn('[Field workspace] Tony context:', tonyErr);
                }
                const dateInput = document.getElementById('quick-comm-date');
                if (dateInput) dateInput.value = getTodayIsoDate();

                setStatus('Workspace mobile attivo.');
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
