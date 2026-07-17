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
import { formatOreNette } from '../../js/attivita-utils.js';

import {
    fetchLavoriDocumentsForFieldUser,
    resolveCaposquadraIdsForOperaio,
    isLavoroSegnabileOperaio,
    resolveSegnaturaOreRoleFlags,
    sliceOperaioLavoriWindow,
} from '../../services/manodopera-lavori-scope.js';
import { fetchOperaioIdsForCaposquadraSquadre } from '../../services/comunicazioni-squadra-service.js';
import { segnalaAssenza } from '../../services/manodopera-assenze-service.js';
import { toGiornoKey } from '../../config/manodopera-assenze-config.js';
import {
    lavoroHaSostitutoAttivo,
    resolveAssenzaSostitutoDisplay
} from '../../services/lavoro-sostituto-context.js';
import {
    confermeIncludesUser,
    isComunicazioneAttivaPerData,
    formatComunicazioneLuogo,
    formatComunicazioneTesto,
    caposquadraIdsForQuery,
    primaryManodoperaUserId,
    comunicazioneVisibilePerOperaio,
    normalizeDestinatariIds,
    partitionComunicazioniRicevuteOperaio,
    partitionComunicazioniInviateCapo,
    countConfermePendentiInvio,
} from '../../services/comunicazioni-squadra-utils.js';
import { isOraDelCaposquadraSuLavoroSquadra } from '../../services/manodopera-ore-validazione-scope.js';

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
const oraDataEl = document.getElementById('ora-data');
const oraStartEl = document.getElementById('ora-start');
const oraEndEl = document.getElementById('ora-end');
const oraBreakEl = document.getElementById('ora-break');
const oraNoteEl = document.getElementById('ora-note');
const lavoriDetailFrameEl = document.getElementById('lavori-detail-frame');
const statsEmbedFrameEl = document.getElementById('stats-embed-frame');
const lavoriFullDetailLinkEl = document.getElementById('lavori-full-detail-link');
const squadListEl = document.getElementById('squad-members-list');
const inlineTeamSectionEl = document.getElementById('inline-team-section');
const inlineValidateHoursSectionEl = document.getElementById('inline-validate-hours-section');
const inlineSegnalaAssenzaSectionEl = document.getElementById('inline-segnala-assenza-section');
const segnalaAssenzaFormEl = document.getElementById('segnala-assenza-form');
const assenzaSegnalaOperaioEl = document.getElementById('assenza-segnala-operaio');
const assenzaSegnalaGiornoEl = document.getElementById('assenza-segnala-giorno');
const assenzaSegnalaStatusEl = document.getElementById('assenza-segnala-status');
const lavoroSostitutoBannerEl = document.getElementById('lavoro-sostituto-banner');
const pendingHoursListEl = document.getElementById('pending-hours-list');
const pendingHoursAllListEl = document.getElementById('pending-hours-all-list');
const btnRefreshPendingHoursEl = document.getElementById('btn-refresh-pending-hours');
const fieldValidazioneOreLinkEl = document.getElementById('field-validazione-ore-link');
const sentCommunicationsListEl = document.getElementById('sent-communications-list');
const receivedCommunicationsListEl = document.getElementById('received-communications-list');
const sentCommunicationsHistoryEl = document.getElementById('sent-communications-history');
const receivedCommunicationsHistoryEl = document.getElementById('received-communications-history');
const toggleSentCommunicationsHistoryEl = document.getElementById('toggle-sent-communications-history');
const toggleReceivedCommunicationsHistoryEl = document.getElementById('toggle-received-communications-history');
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
let fieldWorkspaceInitializedForUid = null;
let selectedWork = null;
let userIsCaposquadra = false;
let lastSquadMembers = [];
let lastSquadLabel = 'Squadra';
let userIsOperaio = false;
let currentPendingHours = [];
let currentAllPendingHours = [];
let pullTouchStartY = 0;
let pullTouchStartX = 0;
let pendingFocusLavoroIdFromUrl = null;
let pendingOpenSlideFromUrl = null;
let receivedCommunicationsHistoryExpanded = false;
let sentCommunicationsHistoryExpanded = false;

function setStatus(text, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.style.color = isError ? '#fecaca' : 'rgba(255, 255, 255, 0.92)';
}

/** Link guida: solo capitolo Operaio o Caposquadra (nessun tab Manager / intro condivisa). */
function updateFieldDocumentationGuideLink() {
    const a = document.getElementById('field-documentation-guide-link');
    if (!a) return;
    const ruolo = userIsCaposquadra ? 'caposquadra' : 'operaio';
    const qs = new URLSearchParams();
    qs.set('ruolo', ruolo);
    qs.set('soloRuolo', '1');
    a.href = `../../documentazione-utente/guida-manodopera-utente.html?${qs.toString()}`;
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
        const isOperaioOnly = slide.classList.contains('operaio-only');
        if (isCapoOnly && !isCaposquadra) {
            slide.hidden = true;
        } else if (isOperaioOnly && isCaposquadra) {
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

function ensureStatsEmbedLoaded() {
    if (!statsEmbedFrameEl || statsEmbedFrameEl.dataset.loaded === '1') return;
    statsEmbedFrameEl.src = 'statistiche-lavoratore-standalone.html';
    statsEmbedFrameEl.dataset.loaded = '1';
}

function maybeLoadEmbedsForSlide(slideTitle) {
    const title = String(slideTitle || '').trim();
    if (title === 'Statistiche') {
        ensureStatsEmbedLoaded();
    }
    if (title === 'Ore') {
        updateLavoriDetailEmbed(true);
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
    maybeLoadEmbedsForSlide(slide.dataset.slideTitle);
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
        if (normalized === 'valida-ore' || normalized === 'validazione-ore' || normalized === 'validazione') {
            return title === 'valida ore';
        }
        if (normalized === 'statistiche' || normalized === 'statistiche-lavoratore' || normalized === 'statistiche lavoratore') {
            return title === 'statistiche';
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
        maybeLoadEmbedsForSlide(activeSlides[bestIdx]?.dataset?.slideTitle);
    }
}

/** Tony / automazione: vai alla slide «Segna ore» (form inline quick-hours-form). */
function goToHoursSlideForTony() {
    const idx = findSlideIndexByToken('ore');
    if (idx >= 0) goToSlide(idx);
}

/**
 * Tony: apri una slide del workspace per token (es. comunicazioni, ore, valida-ore).
 * @param {string} token
 * @returns {boolean}
 */
function goToSlideByTokenForTony(token) {
    const idx = findSlideIndexByToken(token);
    if (idx < 0) return false;
    goToSlide(idx);
    const tok = String(token || '').trim().toLowerCase();
    if (tok === 'comunicazioni' || tok === 'comunicazioni-squadra') {
        // Ricarica elenco (anche se già sulla slide) e porta in vista la lista.
        Promise.resolve(loadReceivedCommunications()).then(() => {
            try {
                if (receivedCommunicationsListEl && typeof receivedCommunicationsListEl.scrollIntoView === 'function') {
                    receivedCommunicationsListEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            } catch (eScroll) { /* ignore */ }
        }).catch(() => { /* ignore */ });
    }
    return true;
}

/**
 * Tony: seleziona lavoro per id opzione o match sul testo visibile.
 * @param {string} rawId
 * @returns {Promise<boolean>}
 */
function selectLavoroByIdOrLabelForTony(rawId) {
    return (async () => {
        const raw = String(rawId || '').trim();
        if (!raw || !selectedWorkEl) return false;

        function attempt() {
            const opts = Array.from(selectedWorkEl.options || []).filter((o) => o.value && String(o.value).trim());
            const hitVal = opts.find((o) => o.value === raw);
            if (hitVal) {
                selectedWorkEl.value = raw;
                if (quickWorkSelectEl) quickWorkSelectEl.value = raw;
                selectedWorkEl.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }
            const low = raw.toLowerCase();
            const byLabel = opts.find((o) => (o.textContent || '').toLowerCase().includes(low));
            if (byLabel && byLabel.value) {
                selectedWorkEl.value = byLabel.value;
                if (quickWorkSelectEl) quickWorkSelectEl.value = byLabel.value;
                selectedWorkEl.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }
            return false;
        }

        if (attempt()) return true;
        try {
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem('gfv_tony_expand_lavoro_for_select', raw);
            }
            await loadWorksForSelection();
        } catch (eReload) {
            console.warn('[FIELD-WORKSPACE] selectLavoroByIdOrLabelForTony reload:', eReload);
        } finally {
            try {
                if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.removeItem('gfv_tony_expand_lavoro_for_select');
                }
            } catch (eRm) { /* ignore */ }
        }
        return attempt();
    })();
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

function syncTonyFieldWorkspaceTableData() {
    try {
        var ruolo = userIsCaposquadra ? 'caposquadra' : 'operaio';
        var list = Array.isArray(cachedWorks) ? cachedWorks : [];
        var items = list.map(function (w) {
            var raw = w.raw || {};
            return {
                id: w.id,
                label: w.label,
                nome: raw.nome || '',
                stato: raw.stato || '',
                tipoLavoro: raw.tipoLavoro || ''
            };
        });
        var summary = 'Workspace mobile campo: ' + items.length + ' lavori in elenco. Ruolo: ' + ruolo + '.';
        if (!window.currentTableData) window.currentTableData = { pageType: 'field_workspace', summary: '', items: [] };
        window.currentTableData.pageType = 'field_workspace';
        window.currentTableData.summary = summary;
        window.currentTableData.items = items;
        window.currentTableData.fieldRole = ruolo;
        var selLavoroId = '';
        try {
            if (selectedWorkEl && selectedWorkEl.value) selLavoroId = selectedWorkEl.value;
            else if (selectedWork && selectedWork.id) selLavoroId = selectedWork.id;
        } catch (eSel) { /* ignore */ }
        var page = (window.Tony && window.Tony.context && window.Tony.context.page) || {};
        if (window.Tony && typeof window.Tony.setContext === 'function') {
            window.Tony.setContext('page', Object.assign({}, page, {
                tableDataSummary: window.currentTableData.summary,
                currentTableData: window.currentTableData,
                /** Lavoro scelto nella prima schermata — Tony usa come ora-lavoro in inject */
                selectedLavoroId: selLavoroId || null
            }));
        }
        window.dispatchEvent(new CustomEvent('table-data-ready', { detail: { currentTableData: window.currentTableData } }));
    } catch (e) {
        console.warn('[FIELD-WORKSPACE] syncTonyFieldWorkspaceTableData', e);
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

async function loadWorksForSelection() {
    if (!currentTenantId || !currentUser) return;
    if (selectedWorkEl) {
        selectedWorkEl.innerHTML = '<option value="">Caricamento lavori...</option>';
    }
    try {
        const userId = (currentUserData && (currentUserData.id || currentUserData.uid)) || currentUser.uid;
        const roleFlags = userIsCaposquadra && !userIsOperaio
            ? { isCaposquadra: true, isOperaio: false }
            : resolveSegnaturaOreRoleFlags(currentUserData || {});
        const rawList = await fetchLavoriDocumentsForFieldUser(
            getDb(),
            currentTenantId,
            userId,
            roleFlags,
            currentUserData || null
        );

        const eligible = rawList.filter((w) => isLavoroSegnabileOperaio(w));

        let narrowed = eligible;
        // Mostra tutti i lavori segnabili fino a 12; oltre, finestra attorno al focus (con ripresa/in_corso sempre incluse)
        if (narrowed.length > 12) {
            narrowed = sliceOperaioLavoriWindow(narrowed, {
                focusLavoroId: pendingFocusLavoroIdFromUrl,
                maxNeighbors: 3,
            });
        }

        const works = narrowed.map((work) => ({
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
        syncTonyFieldWorkspaceTableData();
    } catch (error) {
        console.error('[FIELD-WORKSPACE] Errore caricamento lavori:', error);
        if (selectedWorkEl) {
            selectedWorkEl.innerHTML = '<option value="">Errore caricamento lavori</option>';
        }
        if (gpsSuggestionEl) {
            gpsSuggestionEl.textContent = 'Errore nel recupero lavori.';
        }
        try {
            if (!window.currentTableData) window.currentTableData = { pageType: 'field_workspace', summary: '', items: [] };
            window.currentTableData.pageType = 'field_workspace';
            window.currentTableData.summary = 'Workspace campo: errore caricamento lavori.';
            window.currentTableData.items = [];
            window.dispatchEvent(new CustomEvent('table-data-ready', { detail: { currentTableData: window.currentTableData } }));
        } catch (e2) { /* ignore */ }
    }
}

function updateLavoriDetailEmbed(loadIframe = false) {
    if (!lavoriDetailFrameEl || !lavoriFullDetailLinkEl) return;
    const base = '../admin/lavori-caposquadra-standalone.html?ws=classic';
    if (!selectedWork) {
        lavoriDetailFrameEl.removeAttribute('src');
        lavoriDetailFrameEl.removeAttribute('data-embed-loaded');
        lavoriFullDetailLinkEl.href = base;
        return;
    }
    const fullUrl = `${base}&focusLavoroId=${encodeURIComponent(selectedWork.id)}`;
    lavoriFullDetailLinkEl.href = fullUrl;
    const activeTitle = activeSlides[currentSlideIndex]?.dataset?.slideTitle;
    if (!loadIframe && activeTitle !== 'Ore') return;
    const compactUrl = `${fullUrl}&embed=mobile`;
    if (lavoriDetailFrameEl.dataset.embedLoaded === selectedWork.id) return;
    lavoriDetailFrameEl.src = compactUrl;
    lavoriDetailFrameEl.dataset.embedLoaded = selectedWork.id;
}

async function refreshLavoroSostitutoBanner() {
    if (!lavoroSostitutoBannerEl) return;
    const raw = selectedWork?.raw;
    if (!userIsCaposquadra || !raw || !lavoroHaSostitutoAttivo(raw)) {
        lavoroSostitutoBannerEl.hidden = true;
        lavoroSostitutoBannerEl.innerHTML = '';
        return;
    }
    try {
        const info = await resolveAssenzaSostitutoDisplay(getDb(), raw);
        lavoroSostitutoBannerEl.hidden = false;
        lavoroSostitutoBannerEl.innerHTML = `
            <strong>👤 Sostituzione attiva</strong><br>
            <span style="font-size:13px;">Assente: ${escapeHtmlUnsafe(info.assenteNome || '—')} · 
            <strong>Sostituto: ${escapeHtmlUnsafe(info.sostitutoNome || info.sostitutoId)}</strong></span><br>
            <span style="font-size:12px;">Valida le sue ore in «Valida ore» sotto; il sostituto le segna da Segna ore.</span>
        `;
    } catch (e) {
        console.warn('[FIELD-WORKSPACE] banner sostituto:', e);
        lavoroSostitutoBannerEl.hidden = true;
    }
}

async function refreshSquadraConSostituto() {
    if (!userIsCaposquadra || !squadListEl || !lastSquadMembers.length) return;
    let members = lastSquadMembers.slice();
    let label = lastSquadLabel;
    const raw = selectedWork?.raw;
    if (raw && lavoroHaSostitutoAttivo(raw)) {
        const info = await resolveAssenzaSostitutoDisplay(getDb(), raw);
        if (info.sostitutoId && !members.some((m) => (m.id || m.uid) === info.sostitutoId)) {
            const udoc = await getDoc(doc(getDb(), 'users', info.sostitutoId));
            if (udoc.exists()) {
                members.push({ id: info.sostitutoId, ...udoc.data(), _isSostituto: true });
            }
        }
        label = `${lastSquadLabel} · sostituto in campo`;
    }
    renderSquadList(label, members);
}

function syncLavoroOperativoEmbeds() {
    updateLavoriDetailEmbed();
    if (userIsCaposquadra) {
        loadPendingHoursForSelectedWork().catch(() => {});
        refreshLavoroSostitutoBanner().catch(() => {});
        refreshSquadraConSostituto().catch(() => {});
    } else if (lavoroSostitutoBannerEl) {
        lavoroSostitutoBannerEl.hidden = true;
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
        const label = m._isSostituto ? `${fullName} (sostituto)` : fullName;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'squad-member-row';
        if (m._isSostituto) btn.style.borderLeft = '3px solid #4caf50';
        btn.textContent = label;
        btn.addEventListener('click', () => openOperaioContactModal(m, label));
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

function populateAssenzaSegnalaOperaiSelect(members) {
    if (!assenzaSegnalaOperaioEl) return;
    const list = members || lastSquadMembers || [];
    assenzaSegnalaOperaioEl.innerHTML =
        '<option value="">-- Seleziona --</option>' +
        list
            .map((m) => {
                const id = m.id || m.uid;
                const nome = `${m.nome || ''} ${m.cognome || ''}`.trim() || m.email || id;
                return `<option value="${escapeHtmlUnsafe(id)}">${escapeHtmlUnsafe(nome)}</option>`;
            })
            .join('');
}

async function submitSegnalaAssenza(event) {
    event.preventDefault();
    if (!currentUser || !currentTenantId) return;
    const operaioId = assenzaSegnalaOperaioEl?.value;
    const tipo = document.getElementById('assenza-segnala-tipo')?.value || 'malattia';
    const giorno = assenzaSegnalaGiornoEl?.value || toGiornoKey(new Date());
    const nota = document.getElementById('assenza-segnala-nota')?.value || '';
    const segnalatoDa = currentUserData?.id || currentUser.uid;
    if (!operaioId) {
        if (assenzaSegnalaStatusEl) assenzaSegnalaStatusEl.textContent = 'Seleziona un operaio.';
        return;
    }
    try {
        if (assenzaSegnalaStatusEl) assenzaSegnalaStatusEl.textContent = 'Invio...';
        await segnalaAssenza({
            operaioId,
            tipo,
            dataGiorno: giorno,
            nota,
            lavoroId: selectedWork?.id || null,
            segnalatoDa
        }, currentTenantId);
        if (assenzaSegnalaStatusEl) {
            assenzaSegnalaStatusEl.textContent = 'Segnalazione inviata al manager.';
        }
        if (segnalaAssenzaFormEl) segnalaAssenzaFormEl.reset();
        if (assenzaSegnalaGiornoEl) assenzaSegnalaGiornoEl.value = toGiornoKey(new Date());
    } catch (error) {
        console.error('[FIELD-WORKSPACE] segnala assenza:', error);
        if (assenzaSegnalaStatusEl) {
            assenzaSegnalaStatusEl.textContent = error.message || 'Errore invio segnalazione.';
        }
    }
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
        lastSquadLabel = squadLabel;
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
        lastSquadMembers = members;
        renderSquadList(squadLabel, members);
        populateAssenzaSegnalaOperaiSelect(members);
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
    pendingHoursListEl.innerHTML = currentPendingHours.map((row) => renderPendingHourRowHtml(row, false)).join('');
}

function renderPendingHourRowHtml(row, showLavoro) {
    const who = escapeHtmlUnsafe(row.operaioNome || row.operaioId || 'Operaio');
    const ore = Number(row.oreNette || 0).toFixed(2);
    const time = `${escapeHtmlUnsafe(row.orarioInizio || '--:--')} - ${escapeHtmlUnsafe(row.orarioFine || '--:--')}`;
    const lavoroLine = showLavoro && row.lavoroNome
        ? `<div class="inline-item-sub" style="font-weight:600;color:#2E8B57;">${escapeHtmlUnsafe(row.lavoroNome)}</div>`
        : '';
    const lavAttr = row.lavoroId ? ` data-lavoro-id="${escapeHtmlUnsafe(row.lavoroId)}"` : '';
    return `
        <div class="inline-item">
            <div class="inline-item-head">
                <div class="inline-item-title">${who}</div>
                <div class="inline-item-sub">${formatDateShort(row.data) || 'Data non indicata'}</div>
            </div>
            ${lavoroLine}
            <div class="inline-item-sub">${time} • ${ore} h</div>
            <div class="inline-item-actions">
                <button type="button" class="mini-btn approve" data-approve-hour-id="${escapeHtmlUnsafe(row.id)}"${lavAttr}>✅ Approva</button>
                <button type="button" class="mini-btn reject" data-reject-hour-id="${escapeHtmlUnsafe(row.id)}"${lavAttr}>❌ Rifiuta</button>
            </div>
        </div>
    `;
}

function renderAllPendingHours() {
    if (!pendingHoursAllListEl) return;
    if (!currentAllPendingHours.length) {
        pendingHoursAllListEl.innerHTML = '<div class="empty-state-inline">Nessuna ora in attesa di validazione.</div>';
        return;
    }
    pendingHoursAllListEl.innerHTML = currentAllPendingHours.map((row) => renderPendingHourRowHtml(row, true)).join('');
}

async function loadAllPendingHoursForCapo() {
    if (!pendingHoursAllListEl || !currentTenantId || !currentUser || !userIsCaposquadra) return;
    pendingHoursAllListEl.innerHTML = '<div class="empty-state-inline">Caricamento ore da validare...</div>';
    try {
        const userId = primaryManodoperaUserId(currentUser, currentUserData);
        const works = await fetchLavoriDocumentsForFieldUser(getDb(), currentTenantId, userId, {
            isCaposquadra: true,
            isOperaio: false
        });
        const rows = [];
        const userNameCache = new Map();
        for (const lav of works) {
            const oreRef = collection(getDb(), `tenants/${currentTenantId}/lavori/${lav.id}/oreOperai`);
            const snap = await getDocs(query(oreRef, where('stato', '==', 'da_validare')));
            const lavoroData = {
                caposquadraId: lav.caposquadraId || lav.raw?.caposquadraId || userId,
                operaioId: lav.operaioId || lav.raw?.operaioId || null
            };
            for (const docSnap of snap.docs) {
                const data = docSnap.data();
                if (isOraDelCaposquadraSuLavoroSquadra(data, lavoroData)) continue;
                let operaioNome = '';
                if (data.operaioId) {
                    if (userNameCache.has(data.operaioId)) {
                        operaioNome = userNameCache.get(data.operaioId);
                    } else {
                        const userDoc = await getDoc(doc(getDb(), 'users', data.operaioId));
                        if (userDoc.exists()) {
                            const u = userDoc.data();
                            operaioNome = `${u.nome || ''} ${u.cognome || ''}`.trim() || u.email || '';
                            userNameCache.set(data.operaioId, operaioNome);
                        }
                    }
                }
                rows.push({
                    id: docSnap.id,
                    lavoroId: lav.id,
                    lavoroNome: lav.nome || 'Lavoro',
                    ...data,
                    operaioNome
                });
            }
        }
        rows.sort((a, b) => {
            const ad = (a.creatoIl && a.creatoIl.toDate) ? a.creatoIl.toDate().getTime() : 0;
            const bd = (b.creatoIl && b.creatoIl.toDate) ? b.creatoIl.toDate().getTime() : 0;
            return bd - ad;
        });
        currentAllPendingHours = rows;
        renderAllPendingHours();
    } catch (error) {
        console.error('[FIELD-WORKSPACE] Errore caricamento ore da validare (tutti i lavori):', error);
        pendingHoursAllListEl.innerHTML = '<div class="empty-state-inline">Errore caricamento ore da validare.</div>';
    }
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
        const capoUserId = primaryManodoperaUserId(currentUser, currentUserData);
        const lavoroData = {
            caposquadraId: selectedWork.caposquadraId || selectedWork.raw?.caposquadraId || capoUserId,
            operaioId: selectedWork.operaioId || selectedWork.raw?.operaioId || null
        };
        const rows = [];
        for (const docSnap of snap.docs) {
            const data = docSnap.data();
            if (isOraDelCaposquadraSuLavoroSquadra(data, lavoroData)) continue;
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

async function updateHourValidationStatus(hourId, status, lavoroIdOpt) {
    const lavoroId = lavoroIdOpt || selectedWork?.id;
    if (!lavoroId || !currentTenantId || !currentUser || !hourId) return;
    const pendingRow = currentPendingHours.find((r) => r.id === hourId)
        || currentAllPendingHours.find((r) => r.id === hourId);
    const capoUserId = primaryManodoperaUserId(currentUser, currentUserData);
    if (pendingRow && String(pendingRow.operaioId) === String(capoUserId)) {
        console.warn('[FIELD-WORKSPACE] Le ore del caposquadra sono validate dal manager');
        return;
    }
    const hourRef = doc(getDb(), `tenants/${currentTenantId}/lavori/${lavoroId}/oreOperai`, hourId);
    if (status === 'validate') {
        await updateDoc(hourRef, {
            stato: 'validate',
            validatoDa: currentUser.uid,
            validatoIl: serverTimestamp(),
            rifiutatoDa: null
        });
        const operaioId = pendingRow?.operaioId;
        if (operaioId) {
            const { requestSkillCalcolateRefresh } = await import('../../services/profilo-manodopera-skill-auto-refresh.js');
            requestSkillCalcolateRefresh(currentTenantId, operaioId, currentUser.uid);
        }
    } else {
        await updateDoc(hourRef, {
            stato: 'rifiutate',
            rifiutatoDa: currentUser.uid,
            rifiutatoIl: serverTimestamp()
        });
    }
}

async function resolveDestinatariIdsForSend() {
    const fromSquadra = await fetchOperaioIdsForCaposquadraSquadre(
        getDb(),
        currentTenantId,
        currentUser,
        currentUserData
    );
    if (fromSquadra.length > 0) return fromSquadra;
    if (squadListEl) await loadSquadMembersForCapo();
    const fallback = new Set();
    (lastSquadMembers || []).forEach((m) => {
        const id = m.id || m.uid;
        if (id) fallback.add(String(id));
    });
    caposquadraIdsForQuery(currentUser, currentUserData).forEach((id) => fallback.delete(String(id)));
    return Array.from(fallback);
}

async function fetchReceivedCommunicationRows() {
    const operaioUserId = primaryManodoperaUserId(currentUser, currentUserData);
    const capoIdsOperaio = await resolveCaposquadraIdsForOperaio(getDb(), currentTenantId, operaioUserId);
    // Elenco lavori completo (non la finestra ridotta di cachedWorks): serve per visibilità legacy senza destinatari.
    const lavoriDocs = await fetchLavoriDocumentsForFieldUser(
        getDb(),
        currentTenantId,
        operaioUserId,
        resolveSegnaturaOreRoleFlags(currentUserData || {}),
        currentUserData || null
    );
    const operaioLavoroIds = lavoriDocs.map((l) => String(l.id));
    const cachedIds = (Array.isArray(cachedWorks) ? cachedWorks : []).map((w) => String(w.id));
    const lavoroIdsForVisibility = Array.from(new Set([...operaioLavoroIds, ...cachedIds]));
    const commRef = collection(getDb(), `tenants/${currentTenantId}/comunicazioni`);
    const snap = await getDocs(query(commRef, where('stato', '==', 'attiva')));
    const rows = [];
    snap.forEach((d) => {
        const data = d.data();
        const rawData = data.data;
        const dataCom = rawData && typeof rawData.toDate === 'function'
            ? rawData.toDate()
            : (rawData ? new Date(rawData) : null);
        if (!comunicazioneVisibilePerOperaio(data, currentUser, currentUserData, capoIdsOperaio, lavoroIdsForVisibility)) return;
        if (!isComunicazioneAttivaPerData(dataCom)) return;
        rows.push({
            id: d.id,
            ...data,
            dataCom: dataCom && !Number.isNaN(dataCom.getTime()) ? dataCom : new Date(),
            haConfermato: confermeIncludesUser(data.conferme, currentUser, currentUserData)
        });
    });
    return rows;
}

function renderReceivedCommunicationCard(row, { readOnly = false } = {}) {
    const luogo = formatComunicazioneLuogo(row);
    const testo = formatComunicazioneTesto(row);
    const dataLabel = row.dataCom
        ? row.dataCom.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
        : '-';
    const confermaBtn = row.haConfermato || readOnly
        ? '<span class="inline-item-badge">✅ Confermato</span>'
        : `<button type="button" class="field-mobile-btn primary" data-confirm-comm-id="${escapeHtmlUnsafe(row.id)}" style="margin-top:8px;">Conferma ricezione</button>`;
    return `
        <div class="inline-item" style="border-left: 3px solid ${row.haConfermato ? '#28a745' : '#ffc107'};">
            <div class="inline-item-head">
                <div class="inline-item-title">${escapeHtmlUnsafe(luogo)}</div>
                <div class="inline-item-sub">${escapeHtmlUnsafe(row.orario || '--:--')} • ${escapeHtmlUnsafe(dataLabel)}</div>
            </div>
            ${testo ? `<div class="inline-item-sub">${escapeHtmlUnsafe(testo)}</div>` : ''}
            <div class="inline-item-sub">Da: ${escapeHtmlUnsafe(row.caposquadraNome || 'Caposquadra')}</div>
            ${confermaBtn}
        </div>
    `;
}

function setCommunicationsHistoryToggle(toggleEl, historyEl, count, expanded) {
    if (!toggleEl || !historyEl) return;
    if (count <= 0) {
        toggleEl.hidden = true;
        historyEl.hidden = true;
        return;
    }
    toggleEl.hidden = false;
    toggleEl.textContent = expanded
        ? 'Nascondi comunicazioni precedenti'
        : `Vedi comunicazioni precedenti (${count})`;
    historyEl.hidden = !expanded;
}

function renderSentCommunicationCard(row, { readOnly = false } = {}) {
    const destCount = normalizeDestinatariIds(row.destinatari).length;
    const confermeCount = Array.isArray(row.conferme) ? row.conferme.length : 0;
    const pending = countConfermePendentiInvio(row);
    const badge = pending > 0
        ? `<span class="inline-item-badge" style="background:#fef3c7;color:#92400e;">⏳ ${pending} in attesa</span>`
        : `<span class="inline-item-badge">👍 ${confermeCount}/${destCount || '0'}</span>`;
    const statoLabel = row.stato && row.stato !== 'attiva'
        ? `<span class="inline-item-badge">${escapeHtmlUnsafe(String(row.stato))}</span>`
        : '';
    return `
        <div class="inline-item"${readOnly ? ' style="opacity:0.92;"' : ''}>
            <div class="inline-item-head">
                <div class="inline-item-title">${escapeHtmlUnsafe(row.lavoroNome || 'Lavoro')}</div>
                <div class="inline-item-sub">${escapeHtmlUnsafe(row.orario || '--:--')} • ${formatDateShort(row.data) || '-'}</div>
            </div>
            <div class="inline-item-sub">${escapeHtmlUnsafe((row.messaggio || '').slice(0, 120))}</div>
            <div class="inline-item-head" style="margin-top: 6px; margin-bottom: 0;">
                <div class="inline-item-sub">Conferme ricezione</div>
                ${statoLabel || badge}
            </div>
        </div>
    `;
}

async function loadReceivedCommunications() {
    if (!receivedCommunicationsListEl || !currentTenantId || !currentUser) return;
    receivedCommunicationsListEl.innerHTML = '<div class="empty-state-inline">Caricamento comunicazioni...</div>';
    if (receivedCommunicationsHistoryEl) receivedCommunicationsHistoryEl.innerHTML = '';
    setCommunicationsHistoryToggle(
        toggleReceivedCommunicationsHistoryEl,
        receivedCommunicationsHistoryEl,
        0,
        false
    );
    try {
        const rows = await fetchReceivedCommunicationRows();
        const { pending, history } = partitionComunicazioniRicevuteOperaio(rows);
        if (!pending.length && !history.length) {
            receivedCommunicationsListEl.innerHTML = '<div class="empty-state-inline">Nessuna comunicazione dal caposquadra negli ultimi 60 giorni.</div>';
            return;
        }
        // Mostra TUTTO in lista principale (da confermare + già lette): lo storico collassabile restava invisibile su mobile/Tony.
        const mainParts = [];
        if (pending.length) {
            mainParts.push(...pending.map((row) => renderReceivedCommunicationCard(row)));
        }
        if (history.length) {
            mainParts.push(...history.map((row) => renderReceivedCommunicationCard(row, { readOnly: true })));
        }
        receivedCommunicationsListEl.innerHTML = mainParts.join('');
        // Pannello storico opzionale (duplicato) nascosto di default — tutto è già in lista.
        if (receivedCommunicationsHistoryEl) receivedCommunicationsHistoryEl.innerHTML = '';
        setCommunicationsHistoryToggle(
            toggleReceivedCommunicationsHistoryEl,
            receivedCommunicationsHistoryEl,
            0,
            false
        );
    } catch (error) {
        console.error('[FIELD-WORKSPACE] Errore comunicazioni ricevute:', error);
        receivedCommunicationsListEl.innerHTML = '<div class="empty-state-inline">Errore caricamento comunicazioni.</div>';
    }
}

async function confirmReceivedCommunication(communicationId) {
    if (!communicationId || !currentTenantId || !currentUser) return;
    try {
        const commRef = doc(getDb(), `tenants/${currentTenantId}/comunicazioni`, communicationId);
        const commDoc = await getDoc(commRef);
        if (!commDoc.exists()) return;
        const comm = commDoc.data();
        const conferme = Array.isArray(comm.conferme) ? comm.conferme.slice() : [];
        if (confermeIncludesUser(conferme, currentUser, currentUserData)) {
            setStatus('Hai già confermato questa comunicazione.');
            return;
        }
        conferme.push({
            userId: primaryManodoperaUserId(currentUser, currentUserData),
            timestamp: Timestamp.now()
        });
        await updateDoc(commRef, { conferme });
        setStatus('Conferma inviata al caposquadra.');
        await loadReceivedCommunications();
    } catch (error) {
        console.error('[FIELD-WORKSPACE] Errore conferma comunicazione:', error);
        setStatus(`Errore conferma: ${error.message}`, true);
    }
}

async function loadSentCommunications() {
    if (!sentCommunicationsListEl || !currentTenantId || !currentUser) return;
    sentCommunicationsListEl.innerHTML = '<div class="empty-state-inline">Caricamento comunicazioni inviate...</div>';
    if (sentCommunicationsHistoryEl) sentCommunicationsHistoryEl.innerHTML = '';
    setCommunicationsHistoryToggle(
        toggleSentCommunicationsHistoryEl,
        sentCommunicationsHistoryEl,
        0,
        sentCommunicationsHistoryExpanded
    );
    try {
        const commRef = collection(getDb(), `tenants/${currentTenantId}/comunicazioni`);
        const byId = new Map();
        const capoIds = caposquadraIdsForQuery(currentUser, currentUserData);
        for (const capoId of capoIds) {
            const snap = await getDocs(query(commRef, where('caposquadraId', '==', capoId)));
            snap.forEach((d) => byId.set(d.id, { id: d.id, ...d.data() }));
        }
        const { inEvidenza, storico } = partitionComunicazioniInviateCapo(Array.from(byId.values()));
        if (!inEvidenza.length && !storico.length) {
            sentCommunicationsListEl.innerHTML = '<div class="empty-state-inline">Nessuna comunicazione inviata.</div>';
            return;
        }
        if (!inEvidenza.length && storico.length) {
            sentCommunicationsHistoryExpanded = true;
        }
        if (!inEvidenza.length) {
            sentCommunicationsListEl.innerHTML = '<div class="empty-state-inline">Nessun invio in evidenza.</div>';
        } else {
            sentCommunicationsListEl.innerHTML = inEvidenza.map((row) => renderSentCommunicationCard(row)).join('');
        }
        if (sentCommunicationsHistoryEl && storico.length) {
            sentCommunicationsHistoryEl.innerHTML = storico.map((row) => renderSentCommunicationCard(row, { readOnly: true })).join('');
        }
        setCommunicationsHistoryToggle(
            toggleSentCommunicationsHistoryEl,
            sentCommunicationsHistoryEl,
            storico.length,
            sentCommunicationsHistoryExpanded
        );
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
        await loadAllPendingHoursForCapo();
        await loadSentCommunications();
        if (quickStatusEl) {
            const n = await resolveDestinatariIdsForSend();
            if (n.length > 0) {
                quickStatusEl.textContent = `Squadra pronta: il messaggio arriverà a ${n.length} operai.`;
                quickStatusEl.style.color = '#166534';
            } else {
                quickStatusEl.textContent = 'Nessun operaio in squadra: configura Gestione squadre prima di inviare.';
                quickStatusEl.style.color = '#b91c1c';
            }
        }
    } else if (userIsOperaio) {
        await loadReceivedCommunications();
    }
}

/** Dopo salvataggio riuscito: svuota orari/note così Tony e l’utente possono segnare un’altra giornata senza valori “bloccati”. */
function resetQuickHoursFormFieldsForNextEntry() {
    const today = getTodayIsoDate();
    if (oraDataEl) oraDataEl.value = today;
    if (oraStartEl) oraStartEl.value = '';
    if (oraEndEl) oraEndEl.value = '';
    if (oraBreakEl) oraBreakEl.value = '0';
    if (oraNoteEl) oraNoteEl.value = '';
    calculateNetHours();
}

function calculateNetHours() {
    if (!hoursValueEl || !oraStartEl || !oraEndEl || !oraBreakEl) return 0;
    const start = oraStartEl.value;
    const end = oraEndEl.value;
    const breakMin = Math.max(0, parseInt(oraBreakEl.value || '0', 10) || 0);

    if (!start || !end) {
        hoursValueEl.textContent = formatOreNette(0);
        return 0;
    }

    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const startMinutes = (sh * 60) + sm;
    const endMinutes = (eh * 60) + em;
    if (endMinutes <= startMinutes) {
        hoursValueEl.textContent = formatOreNette(0);
        return 0;
    }
    const netMinutes = Math.max(0, endMinutes - startMinutes - breakMin);
    const netHours = netMinutes / 60;
    hoursValueEl.textContent = formatOreNette(netHours);
    return netHours;
}

window.gfvFieldWorkspaceGoToHoursSlide = goToHoursSlideForTony;
window.gfvFieldWorkspaceGoToSlide = goToSlideByTokenForTony;
window.gfvFieldWorkspaceRecalcHours = calculateNetHours;
window.gfvFieldWorkspaceSelectLavoroById = selectLavoroByIdOrLabelForTony;
window.gfvFieldWorkspaceGetSelectedLavoroId = function () {
    try {
        if (selectedWorkEl && selectedWorkEl.value) return selectedWorkEl.value;
        if (selectedWork && selectedWork.id) return selectedWork.id;
        return localStorage.getItem('gfv_mobile_selected_work_id') || '';
    } catch (e) {
        return '';
    }
};

async function saveQuickHours(event) {
    event.preventDefault();
    if (!hoursStatusEl) return;
    if (!selectedWork || !currentTenantId || !currentUser) {
        hoursStatusEl.textContent = 'Seleziona prima un lavoro.';
        hoursStatusEl.style.color = '#b91c1c';
        return;
    }
    const dateIso = (oraDataEl && oraDataEl.value) ? oraDataEl.value.trim() : '';
    const start = oraStartEl ? oraStartEl.value : '';
    const end = oraEndEl ? oraEndEl.value : '';
    if (!dateIso) {
        hoursStatusEl.textContent = 'Inserisci la data del lavoro.';
        hoursStatusEl.style.color = '#b91c1c';
        return;
    }
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
        const [y, m, d] = dateIso.split('-').map(Number);
        if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
            hoursStatusEl.textContent = 'Data non valida.';
            hoursStatusEl.style.color = '#b91c1c';
            return;
        }
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
        hoursStatusEl.textContent = `Ore salvate: ${formatOreNette(netHours)}. Puoi registrare un altro turno.`;
        hoursStatusEl.style.color = '#166534';
        resetQuickHoursFormFieldsForNextEntry();
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
        syncTonyFieldWorkspaceTableData();
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
    const destinatari = await resolveDestinatariIdsForSend();
    if (!destinatari.length) {
        quickStatusEl.textContent = 'Nessun operaio in squadra da avvisare. In Gestione squadre assegna operai al tuo profilo caposquadra.';
        quickStatusEl.style.color = '#b91c1c';
        return;
    }
    const caposquadraNome = `${currentUserData?.nome || ''} ${currentUserData?.cognome || ''}`.trim();
    try {
        const [y, m, d] = dateIso.split('-').map(Number);
        const dataDate = new Date(y, (m || 1) - 1, d || 1);
        await addDoc(collection(getDb(), `tenants/${currentTenantId}/comunicazioni`), {
            caposquadraId: primaryManodoperaUserId(currentUser, currentUserData),
            caposquadraNome: caposquadraNome || undefined,
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
        quickStatusEl.textContent = `Comunicazione inviata a ${destinatari.length} operai.`;
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
    if (receivedCommunicationsListEl) {
        receivedCommunicationsListEl.addEventListener('click', async (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const commId = target.getAttribute('data-confirm-comm-id');
            if (!commId) return;
            await confirmReceivedCommunication(commId);
        });
    }
    if (toggleReceivedCommunicationsHistoryEl) {
        toggleReceivedCommunicationsHistoryEl.addEventListener('click', () => {
            receivedCommunicationsHistoryExpanded = !receivedCommunicationsHistoryExpanded;
            const count = receivedCommunicationsHistoryEl
                ? receivedCommunicationsHistoryEl.querySelectorAll('.inline-item').length
                : 0;
            setCommunicationsHistoryToggle(
                toggleReceivedCommunicationsHistoryEl,
                receivedCommunicationsHistoryEl,
                count,
                receivedCommunicationsHistoryExpanded
            );
        });
    }
    if (toggleSentCommunicationsHistoryEl) {
        toggleSentCommunicationsHistoryEl.addEventListener('click', () => {
            sentCommunicationsHistoryExpanded = !sentCommunicationsHistoryExpanded;
            const count = sentCommunicationsHistoryEl
                ? sentCommunicationsHistoryEl.querySelectorAll('.inline-item').length
                : 0;
            setCommunicationsHistoryToggle(
                toggleSentCommunicationsHistoryEl,
                sentCommunicationsHistoryEl,
                count,
                sentCommunicationsHistoryExpanded
            );
        });
    }
    const onPendingHoursClick = async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const approveId = target.getAttribute('data-approve-hour-id');
        const rejectId = target.getAttribute('data-reject-hour-id');
        if (!approveId && !rejectId) return;
        const lavoroId = target.getAttribute('data-lavoro-id') || selectedWork?.id;
        try {
            if (approveId) {
                await updateHourValidationStatus(approveId, 'validate', lavoroId);
            } else if (rejectId) {
                await updateHourValidationStatus(rejectId, 'rifiutate', lavoroId);
            }
            await loadPendingHoursForSelectedWork();
            await loadAllPendingHoursForCapo();
        } catch (error) {
            console.error('[FIELD-WORKSPACE] Errore aggiornamento validazione ore:', error);
        }
    };
    if (pendingHoursListEl) pendingHoursListEl.addEventListener('click', onPendingHoursClick);
    if (pendingHoursAllListEl) pendingHoursAllListEl.addEventListener('click', onPendingHoursClick);
    if (btnRefreshPendingHoursEl) {
        btnRefreshPendingHoursEl.addEventListener('click', () => {
            loadAllPendingHoursForCapo().catch(() => {});
        });
    }
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
    if (segnalaAssenzaFormEl) {
        segnalaAssenzaFormEl.addEventListener('submit', submitSegnalaAssenza);
    }
    if (assenzaSegnalaGiornoEl && !assenzaSegnalaGiornoEl.value) {
        assenzaSegnalaGiornoEl.value = toGiornoKey(new Date());
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
        const { awaitFirebaseEmulatorConnect, awaitAuthStateReady } = await import('../../services/firebase-service.js');
        await awaitFirebaseEmulatorConnect();
        await awaitAuthStateReady();
        const auth = getAuthInstance();
        const db = getDb();
        try {
            const { ensureSimulatorSession } = await import('../../js/simulator-browser-auth.js');
            await ensureSimulatorSession(auth);
        } catch (_) { /* ignore */ }

        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                try {
                    const { ensureSimulatorSession } = await import('../../js/simulator-browser-auth.js');
                    const recovered = await ensureSimulatorSession(auth);
                    if (recovered) return;
                } catch (_) { /* ignore */ }
                window.location.href = '../auth/login-standalone.html';
                return;
            }
            if (fieldWorkspaceInitializedForUid === user.uid) return;

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
                // Conserva eventuale id documento users diverso da auth.uid (match destinatari comunicazioni).
                currentUserData = {
                    ...userData,
                    id: userData.id || userDoc.id || user.uid,
                    uid: user.uid,
                    ruoli: normalizedRoles
                };
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
                if (inlineSegnalaAssenzaSectionEl) {
                    inlineSegnalaAssenzaSectionEl.hidden = !isCaposquadra;
                }
                setupSlidesForRole(isCaposquadra);
                // Ordine caposquadra richiesto:
                // Seleziona lavoro (+ squadra inline) -> Comunicazioni -> Segna ore -> I miei lavori -> Statistiche
                if (fieldValidazioneOreLinkEl) {
                    fieldValidazioneOreLinkEl.hidden = !isCaposquadra;
                }
                if (isCaposquadra || isOperaio) {
                    const order = isCaposquadra
                        ? ['Lavoro', 'Comunicazioni', 'Valida ore', 'Ore', 'Statistiche']
                        : ['Lavoro', 'Comunicazioni', 'Ore', 'Statistiche'];
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
                updateFieldDocumentationGuideLink();

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
                if (oraDataEl) oraDataEl.value = getTodayIsoDate();

                fieldWorkspaceInitializedForUid = user.uid;
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
