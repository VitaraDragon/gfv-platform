/**
 * Tony Widget – Main: orchestra ui, voice, engine.
 * @module core/js/tony/main
 */

import { injectWidget } from './ui.js';
import { initTonyVoice } from './voice.js';
import { TONY_PAGE_MAP, TONY_LABEL_MAP, resolveTarget, getUrlForTarget, cleanTextFromJsonResidue, extractTonyResponseFromString, normalizeTonyCommand, resolveTonyUserVisibleText, matchSegnaOraTimeRangeFromBlob, matchSegnaOraSingleTimeFromBlob, matchSegnaOraBareHourFromBlob, matchSegnaOraTimeRangeFromUserTexts, collectSegnaOraAlleTimesFromUserTexts } from './engine.js';
import { hasActiveModule, getModuliAttiviFromTonyContext, isApriPaginaTargetAllowed, tonyNotifyModuleInactive } from '../../config/tony-module-gate.js';
import {
    getTonyFieldProfileFromContext,
    isRawTonyApriPaginaAllowed,
    isTonyOpenModalBlockedForFieldProfile
} from './field-role-guard.js';
import {
    formReadyForTonySave,
    magazzinoFormReadyForTonySave,
    magazzinoProactiveReadyForSave,
    getActiveMagazzinoFormIdForSave,
    isTonySaveConfirmText,
    isTonyMagazzinoCfFakeSaveText,
    executeTonyMagazzinoSaveLocal,
    isAnyTonyFormSaveConfirmPending,
    promptTonyFormSaveLocal,
    tryInterceptTonyFormSaveConfirm,
    tryInterceptTerrenoSaveBeforeCf,
    terrenoFormReadyForTonySave,
    terrenoProactiveReadyForSave,
    tryInterceptMagazzinoSaveBeforeCf,
    tryInterceptQuickHoursSaveBeforeCf,
    quickHoursFormReadyForTonySave,
    isTonyQuickHoursCfFakeSaveText,
} from '../tony-form-save-local.js';
import {
    tryInterceptMovimentoCreateBeforeCf,
    tryRecoverMovimentoCfFakeSave,
} from '../tony-movimento-create-local.js';
import {
    tryInterceptProdottoCreateBeforeCf,
    tryRecoverProdottoCfFakeSave,
} from '../tony-prodotto-create-local.js';
import { enrichMovimentoFormDataFromCatalog } from '../movimento-prezzo-catalogo.js';
import { applyStreamingTtsChunks, getStreamingTtsRemainder } from './stream-tts-chunk.js';
import { tonyWantsDashboardRiassunto, buildDashboardRiassuntoText, formatDashboardOpsBriefingText } from './meteo-dashboard-quick-reply-utils.js';

    /** Bump con tony-widget-standalone.js TONY_LOADER_BUILD — verifica in console: [Tony] Client build */
export const TONY_CLIENT_BUILD = '2026-06-14a';
if (typeof window !== 'undefined') window.__TONY_CLIENT_BUILD = TONY_CLIENT_BUILD;

(function() {
    'use strict';

    window.__tonyAudioQueue = window.__tonyAudioQueue || [];
    window.__tonyIsSpeaking = window.__tonyIsSpeaking || false;

    var scriptBase = window.__tonyScriptBase || (typeof import.meta !== 'undefined' && import.meta.url) || (document.currentScript && document.currentScript.src) || '';

    var _lastModalOpenTime = 0;
    var _tonyCommandQueue = [];
    var _isProcessingTonyCommand = false;
    var _isSendingMessage = false; // Anti-flood: blocca invii concorrenti

    // Timer proattivo form: delay post-inject (stabilizzazione) poi check; timer inattività parte dopo il check
    var POST_INJECT_CHECK_DELAY_MS = 2800;
    var POST_INJECT_CHECK_DELAY_LAVORO_MS = 450;
    var IDLE_REMINDER_MS = 7000;
    var MACCHINE_ONLY_ASK_DELAY_MS = 400;

    /** True se l'ultima risposta CF/chat di Tony contiene già una domanda all'utente. */
    function tonyCfReplyAlreadyAsksUser(text) {
        if (!text || typeof text !== 'string') return false;
        var t = String(text).trim();
        if (!t) return false;
        if (t.indexOf('?') >= 0) return true;
        return /\b(quali|quante|quale|che ora|cosa|come|quando|dove|confermi|mi manca|devo sapere|indica|scegli|dimmi)\b/i.test(t);
    }

    /** Domanda generica («controlla il form») — non blocca ask client-side su trattore/attrezzo. */
    function tonyCfReplyAlreadyAsksAboutMacchine(text) {
        if (!text || typeof text !== 'string') return false;
        var t = String(text).toLowerCase();
        if (t.indexOf('?') < 0 && !/\b(quale|quali)\b/.test(t)) return false;
        return /\b(trattor|attrezz|macchin|erpice|trincia|fresa|vanga)\w*/.test(t);
    }

    function tonyShouldArmProactiveMissingFieldsAsk() {
        return !tonyCfReplyAlreadyAsksUser(window.__tonyLastCfAssistantText || '');
    }

    function tonyShouldArmProactiveMacchineAsk() {
        if (tonyCfReplyAlreadyAsksAboutMacchine(window.__tonyLastCfAssistantText || '')) return false;
        return true;
    }

    /** True se il messaggio utente sembra già indicare trattore e/o attrezzo (Gestione Lavori). */
    function tonyUserMentionedLavoroMacchine(userText) {
        if (!userText) return false;
        var t = String(userText).toLowerCase();
        if (/\bcon\s+[^\n,]{1,48}\s+e\s+[^\n,]{1,48}/.test(t)) return true;
        if (/\b(trattrice|trattor)\b/.test(t)) return true;
        if (/\b(agrifull|erpice|nebulizz|atomizz|irrorat|spand|zappat|spread)\w*\b/.test(t)) return true;
        return false;
    }

    /** True se il messaggio utente assegna già il lavoro a una persona ("per Luca", "assegna a Marco"). */
    function tonyUserMentionedLavoroAssignee(userText) {
        if (!userText) return false;
        var t = String(userText);
        if (/\bassegn\w*\s+(a|ad|al|alla|allo)\s+/i.test(t)) return true;
        if (/\bper\s+(un|una|il|lo|la|l'|domani|oggi|esempio|favore|conto)\b/i.test(t)) return false;
        if (/\bper\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'`\-\s]{0,35}?\s+(nel|nella|nello|in|sul|sulla|al|alla)\b/i.test(t)) return true;
        if (/\bper\s+[A-Za-zÀ-ÿ]{2,}\b/.test(t)) return true;
        return false;
    }

    /** Rimuove "A chi assegni?" se l'utente aveva già indicato il destinatario (per Luca, ecc.). */
    function tonySanitizeLavoroOperaioQuestionInReply(displayText, userText) {
        if (!displayText || !userText || !tonyUserMentionedLavoroAssignee(userText)) return displayText;
        var s = String(displayText);
        s = s.replace(/\bA\s+chi\s+(lo\s+)?assegni\s*\??\s*/gi, '');
        s = s.replace(/\bA\s+chi\s+lo\s+assegno\s*\??\s*/gi, '');
        s = s.replace(/\s{2,}/g, ' ').trim();
        return s.length ? s : displayText;
    }

    /** True se il messaggio utente indica già inizio e/o durata (Gestione Lavori). */
    function tonyUserMentionedLavoroDataDurata(userText) {
        if (!userText) return false;
        var t = String(userText).toLowerCase();
        if (/\b(domani|oggi|ieri|dopodomani|luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica)\b/.test(t)) return true;
        if (/\b(inizio|inizia|parte|partenza)\s+(domani|oggi|luned)/.test(t)) return true;
        if (/\b(durata|giornat[ae]|giorn[oi])\b/.test(t) && /\b(un|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|\d+)\b/.test(t)) return true;
        if (/\b(per|di)\s+(un|due|tre|\d+)\s+giorn/.test(t)) return true;
        return false;
    }

    /** Messaggio entity-dense crea lavoro (operaio + mezzi + data/durata nel testo iniziale). */
    function tonyUserMessageEntityDenseForLavoro(userText) {
        if (!userText) return false;
        return tonyUserMentionedLavoroAssignee(userText) &&
            tonyUserMentionedLavoroMacchine(userText) &&
            tonyUserMentionedLavoroDataDurata(userText);
    }

    function tonyOnGestioneLavoriPage() {
        var p = (window.location && window.location.pathname ? String(window.location.pathname).toLowerCase() : '');
        return p.indexOf('gestione-lavori') >= 0;
    }

    function tonyIsBareCreaLavoroIntent(userText) {
        var t = String(userText || '').trim();
        return /^(crea(\s+un)?\s+lavoro|nuovo\s+lavoro)\s*$/i.test(t);
    }

    /** Avvio locale: «crea lavoro …» con eventuali hint (tipo/terreno/persona), escluso messaggio entity-dense CF cross-page. */
    function tonyIsLocalLavoroCreationIntent(userText) {
        var t = String(userText || '').trim();
        if (!t) return false;
        if (!/^(crea(\s+un)?\s+lavoro|nuovo\s+lavoro)\b/i.test(t)) return false;
        if (tonyUserMessageEntityDenseForLavoro(userText) && !tonyOnGestioneLavoriPage()) return false;
        return true;
    }

    function tonyFormSaveLocalDeps() {
        return {
            appendMessage: appendMessage,
            speak: (window.Tony && typeof window.Tony.speak === 'function') ? window.Tony.speak.bind(window.Tony) : null,
        };
    }

    function tonyTryPromptLavoroSaveIfComplete() {
        if (window.__tonyAwaitingLavoroSaveConfirm) return;
        if (window.TonyFormInjector && typeof window.TonyFormInjector.lavoroInterviewReadyForSave === 'function' &&
            window.TonyFormInjector.lavoroInterviewReadyForSave() &&
            typeof window.__tonyPromptLavoroSaveLocal === 'function') {
            setTimeout(function () { window.__tonyPromptLavoroSaveLocal(); }, 600);
        }
    }

    function tonyEnsureLavoroModalForInterview() {
        return new Promise(function (resolve) {
            var modal = document.getElementById('lavoro-modal');
            if (modal && modal.classList.contains('active')) {
                resolve(true);
                return;
            }
            if (typeof window.openCreaModal !== 'function') {
                resolve(false);
                return;
            }
            if (window.TonyFormInjector && typeof window.TonyFormInjector.resetLavoroInterviewSessionState === 'function') {
                window.TonyFormInjector.resetLavoroInterviewSessionState();
            }
            var openResult = window.openCreaModal();
            function waitModalActive() {
                var tries = 0;
                var iv = setInterval(function () {
                    tries++;
                    var m = document.getElementById('lavoro-modal');
                    if (m && m.classList.contains('active')) {
                        clearInterval(iv);
                        resolve(true);
                    } else if (tries > 50) {
                        clearInterval(iv);
                        resolve(false);
                    }
                }, 100);
            }
            if (openResult && typeof openResult.then === 'function') {
                openResult.then(function () { waitModalActive(); }).catch(function () { waitModalActive(); });
            } else {
                waitModalActive();
            }
        });
    }

    function tonyFinishLavoroInterviewTurn(resIv, opts) {
        removeTyping();
        if (resIv && resIv.handled) {
            if (resIv.message) {
                appendMessage(resIv.message, 'tony');
                if (window.Tony && typeof window.Tony.speak === 'function' && resIv.voiceText) {
                    window.Tony.speak(resIv.voiceText);
                }
            }
            if (resIv.readyForSave && typeof window.__tonyPromptLavoroSaveLocal === 'function') {
                setTimeout(function () { window.__tonyPromptLavoroSaveLocal(); }, 600);
            } else {
                tonyTryPromptLavoroSaveIfComplete();
            }
        } else {
            appendMessage('Non ho capito. Ripeti con squadra/persona, terreno, tipo lavoro, data o durata (es. martedì, domani, 3).', 'tony');
        }
        if (opts.fromVoice) isWaitingForTonyResponse = false;
    }

    /** Rimuove domande ridondanti su data/durata se l'utente le aveva già nel messaggio. */
    function tonySanitizeLavoroDataDurataQuestionInReply(displayText, userText) {
        if (!displayText || !userText || !tonyUserMentionedLavoroDataDurata(userText)) return displayText;
        var s = String(displayText);
        s = s.replace(/\b[Qq]uando\s+vuoi\s+iniziare\s*\??\s*/gi, '');
        s = s.replace(/\b[Ee]\s+per\s+quanti\s+giorni\s+dura\s*\??\s*/gi, '');
        s = s.replace(/\b[Qq]uando\s+inizi\b[^?.!]*[?.!]/gi, '');
        s = s.replace(/\bper\s+quanti\s+giorni\b[^?.!]*[?.!]/gi, '');
        s = s.replace(/\s{2,}/g, ' ').replace(/^\s*[.,;]+\s*/g, '').replace(/\s+[.,;]+$/g, '').trim();
        return s.length ? s : displayText;
    }

    /** Rimuove domande ridondanti su trattore/attrezzo se l'utente li aveva già nel messaggio. */
    function tonySanitizeLavoroMacchineQuestionInReply(displayText, userText) {
        if (!displayText || !userText || !tonyUserMentionedLavoroMacchine(userText)) return displayText;
        var s = String(displayText);
        var patterns = [
            /\b[Qq]uale\s+trattor[ei]?\s+e\s+attrezzo\b[^?]*\?/gi,
            /\b[Qq]uale\s+trattor[ei]\b[^?]*\?/gi,
            /\b[Cc]he\s+trattor[ei]\b[^?]*\?/gi
        ];
        for (var pi = 0; pi < patterns.length; pi++) {
            s = s.replace(patterns[pi], '');
        }
        s = s.replace(/\s{2,}/g, ' ').replace(/\s+([.!?])/g, '$1').trim();
        s = s.replace(/^[\s.,;]+|[\s.,;]+$/g, '').trim();
        return s.length ? s : displayText;
    }

    /** True se il tenant ha modulo Manodopera (Segna ore vs Diario attività). */
    function tonyModuliAttiviIncludeManodopera() {
        try {
            var ctx = window.Tony && window.Tony.context;
            var mods = ctx && (ctx.dashboard && ctx.dashboard.moduli_attivi || ctx.moduli_attivi || (ctx.info_azienda && ctx.info_azienda.moduli_attivi));
            if (!Array.isArray(mods) || mods.length === 0) {
                try {
                    var st = sessionStorage.getItem('tony_moduli_attivi');
                    if (st) mods = JSON.parse(st);
                } catch (e0) { /* ignore */ }
            }
            if (!Array.isArray(mods)) return false;
            return mods.some(function (m) { return String(m).toLowerCase() === 'manodopera'; });
        } catch (e) { return false; }
    }

    /** Mappa campi diario (attivita-*) su form Segna ora (ora-*) quando la CF emette ancora attivita-modal. */
    function tonyMapAttivitaFieldsToSegnaOra(fields) {
        if (!fields || typeof fields !== 'object') return fields;
        var out = Object.assign({}, fields);
        var map = {
            'attivita-data': 'ora-data',
            'attivita-orario-inizio': 'ora-inizio',
            'attivita-orario-fine': 'ora-fine',
            'attivita-pause': 'ora-pause',
            'attivita-note': 'ora-note',
            'attivita-macchina': 'ora-macchina',
            'attivita-attrezzo': 'ora-attrezzo',
            'attivita-ore-macchina': 'ora-ore-macchina'
        };
        Object.keys(map).forEach(function (ak) {
            if (out[ak] != null && String(out[ak]).trim() !== '' && (out[map[ak]] == null || String(out[map[ak]]).trim() === '')) {
                out[map[ak]] = out[ak];
            }
        });
        return out;
    }

    /** Finestra che contiene `#quick-hours-form` (documento locale o parent workspace). */
    function tonyResolveQuickHoursWindow() {
        try {
            if (window.TonyFormInjector && typeof window.TonyFormInjector.resolveQuickHoursTargetWindow === 'function') {
                var tw = window.TonyFormInjector.resolveQuickHoursTargetWindow({});
                if (tw) return tw;
            }
        } catch (e0) { /* ignore */ }
        if (document.getElementById('quick-hours-form')) return window;
        try {
            if (window.parent && window.parent !== window && window.parent.document.getElementById('quick-hours-form')) {
                return window.parent;
            }
        } catch (e1) { /* cross-origin */ }
        return null;
    }

    /** Se manca ora-lavoro: focus URL, lavoro selezionato sul workspace mobile, o un solo item in lista. */
    function tonyTryOraLavoroFromPageContext(fields) {
        var out = fields && typeof fields === 'object' ? Object.assign({}, fields) : {};
        if (out['ora-lavoro'] != null && String(out['ora-lavoro']).trim() !== '') return out;
        try {
            var sp = new URLSearchParams(window.location.search || '');
            var fid = sp.get('focusLavoroId');
            if (fid) out['ora-lavoro'] = fid;
        } catch (e) {}
        try {
            var pageTony = window.Tony && window.Tony.context && window.Tony.context.page;
            if (!out['ora-lavoro'] && pageTony && pageTony.selectedLavoroId) {
                out['ora-lavoro'] = String(pageTony.selectedLavoroId);
            }
        } catch (e1b) {}
        try {
            if (!out['ora-lavoro'] && window.parent && window.parent !== window) {
                var psp = new URLSearchParams(window.parent.location.search || '');
                var pfid = psp.get('focusLavoroId');
                if (pfid) out['ora-lavoro'] = pfid;
            }
        } catch (e1d) {}
        try {
            if (!out['ora-lavoro'] && window.parent && window.parent !== window && window.parent.Tony && window.parent.Tony.context && window.parent.Tony.context.page && window.parent.Tony.context.page.selectedLavoroId) {
                out['ora-lavoro'] = String(window.parent.Tony.context.page.selectedLavoroId);
            }
        } catch (e1e) {}
        try {
            if (!out['ora-lavoro'] && typeof window.gfvFieldWorkspaceGetSelectedLavoroId === 'function') {
                var gfvId = window.gfvFieldWorkspaceGetSelectedLavoroId();
                if (gfvId && String(gfvId).trim()) out['ora-lavoro'] = String(gfvId).trim();
            }
        } catch (e1c) {}
        try {
            if (!out['ora-lavoro'] && window.parent && window.parent !== window && typeof window.parent.gfvFieldWorkspaceGetSelectedLavoroId === 'function') {
                var gfvIdP = window.parent.gfvFieldWorkspaceGetSelectedLavoroId();
                if (gfvIdP && String(gfvIdP).trim()) out['ora-lavoro'] = String(gfvIdP).trim();
            }
        } catch (e1f) {}
        try {
            if (!out['ora-lavoro'] && window.currentTableData && Array.isArray(window.currentTableData.items) && window.currentTableData.items.length === 1) {
                var it = window.currentTableData.items[0];
                if (it && it.id) out['ora-lavoro'] = it.id;
            }
        } catch (e2) {}
        try {
            if (!out['ora-lavoro'] && window.parent && window.parent !== window && window.parent.currentTableData && Array.isArray(window.parent.currentTableData.items) && window.parent.currentTableData.items.length === 1) {
                var itp = window.parent.currentTableData.items[0];
                if (itp && itp.id) out['ora-lavoro'] = itp.id;
            }
        } catch (e2b) {}
        return out;
    }

    var TONY_ORA_LAVORO_USER_MATCH_STOP = {
        segnare: 1,
        segniamo: 1,
        registare: 1,
        registrare: 1,
        oggi: 1,
        ieri: 1,
        ore: 1,
        orario: 1,
        orari: 1,
        lavoro: 1,
        lavori: 1,
        nelle: 1,
        nella: 1,
        nello: 1,
        negli: 1,
        delle: 1,
        della: 1,
        minuti: 1,
        pausa: 1,
        inizio: 1,
        fine: 1,
        dalle: 1,
        alle: 1,
        confermo: 1,
        certo: 1,
        perfetto: 1,
        quanti: 1,
        vuoi: 1,
        quando: 1,
        dopo: 1,
        prima: 1,
        turno: 1,
        vuole: 1,
        indicami: 1
    };

    /** Items lavori campo per abbinare il nome nel messaggio utente a ora-lavoro (evita solo il lavoro già selezionato in UI). */
    function tonyGetFieldWorkspaceTableItemsForOraLavoroMatch() {
        try {
            var pg = window.Tony && window.Tony.context && window.Tony.context.page;
            var ctd = pg && pg.currentTableData;
            if (ctd && Array.isArray(ctd.items) && ctd.items.length && (ctd.pageType === 'field_workspace' || ctd.pageType === 'lavori_caposquadra')) {
                return ctd.items;
            }
        } catch (e0) {}
        try {
            if (window.parent && window.parent !== window) {
                var pctd = window.parent.currentTableData;
                if (pctd && Array.isArray(pctd.items) && pctd.items.length && (pctd.pageType === 'field_workspace' || pctd.pageType === 'lavori_caposquadra')) {
                    return pctd.items;
                }
            }
        } catch (e1) {}
        try {
            if (window.currentTableData && Array.isArray(window.currentTableData.items) && window.currentTableData.items.length) {
                var wpt = window.currentTableData.pageType;
                if (wpt === 'field_workspace' || wpt === 'lavori_caposquadra') return window.currentTableData.items;
            }
        } catch (e2) {}
        return [];
    }

    /**
     * Se il messaggio (solo utente) contiene parole che matchano label/nome/tipo di un solo lavoro in elenco, restituisce il suo id.
     */
    function tonyMatchOraLavoroIdFromUserBlob(userBlob) {
        if (!userBlob || typeof userBlob !== 'string') return null;
        var items = tonyGetFieldWorkspaceTableItemsForOraLavoroMatch();
        if (!items || items.length < 1) return null;
        var lower = userBlob.toLowerCase();
        var tokens = lower.split(/[^a-zàèéìòù0-9]+/i).filter(function (t) {
            if (!t || t.length < 4) return false;
            if (TONY_ORA_LAVORO_USER_MATCH_STOP[t]) return false;
            return true;
        });
        if (!tokens.length) return null;
        var matches = [];
        for (var j = 0; j < items.length; j++) {
            var it = items[j];
            if (!it || !it.id) continue;
            var hay = (String(it.label || '') + ' ' + String(it.nome || '') + ' ' + String(it.tipoLavoro || '')).toLowerCase();
            var bestLen = 0;
            for (var k = 0; k < tokens.length; k++) {
                var tok = tokens[k];
                if (hay.indexOf(tok) >= 0 && tok.length > bestLen) bestLen = tok.length;
            }
            if (bestLen > 0) matches.push({ id: String(it.id), score: bestLen });
        }
        if (matches.length === 0) return null;
        matches.sort(function (a, b) {
            return b.score - a.score;
        });
        if (matches.length >= 2 && matches[0].score === matches[1].score && matches[0].id !== matches[1].id) return null;
        return matches[0].id;
    }

    /**
     * Risolve ora-lavoro: prima nome lavoro nel messaggio utente (se flusso segna ore), altrimenti contesto pagina / select.
     */
    function tonyResolveOraLavoroForQuickHours(fields, userBlob) {
        var out = fields && typeof fields === 'object' ? Object.assign({}, fields) : {};
        var ub = userBlob != null ? String(userBlob) : '';
        if (ub && tonyUserMessageSuggestsSegnaOre(ub)) {
            var mid = tonyMatchOraLavoroIdFromUserBlob(ub);
            if (mid) {
                out['ora-lavoro'] = mid;
                return out;
            }
        }
        return tonyTryOraLavoroFromPageContext(out);
    }

    /**
     * Su field-workspace-standalone: non navigare alla segnatura desktop — l'utente ha già il form inline (slide 2).
     */
    function tonyBlockApriSegnaturaIfOnFieldWorkspace(rawTarget, dataOrParams) {
        try {
            var path = (window.location.pathname || '').toLowerCase();
            var onFieldWs =
                path.indexOf('field-workspace-standalone') >= 0 ||
                (window.currentTableData && window.currentTableData.pageType === 'field_workspace');
            if (!onFieldWs) {
                try {
                    if (window.parent && window.parent !== window) {
                        var ppath = (window.parent.location.pathname || '').toLowerCase();
                        if (ppath.indexOf('field-workspace-standalone') >= 0) onFieldWs = true;
                        else if (window.parent.currentTableData && window.parent.currentTableData.pageType === 'field_workspace') onFieldWs = true;
                    }
                } catch (ePw) { /* cross-origin */ }
            }
            if (!onFieldWs) return false;
            var resolved = resolveTarget(rawTarget) || rawTarget;
            var r = String(resolved).toLowerCase();
            if (r.indexOf('segnatura') < 0 && r.indexOf('segnare ore') < 0) return false;
        } catch (e) { return false; }
        console.log('[Tony] APRI_PAGINA verso segnatura ore bloccato: già su workspace campo mobile (nessun messaggio chat: inject/recovery gestiscono il flusso).');
        try {
            var flds = null;
            if (dataOrParams && typeof dataOrParams === 'object') {
                flds = dataOrParams._tonyPendingFields || dataOrParams.fields || (dataOrParams.params && dataOrParams.params.fields);
            }
            if (tonyResolveQuickHoursWindow()) {
                if (flds && typeof flds === 'object' && Object.keys(flds).length > 0) {
                    var fdM = tonyMapAttivitaFieldsToSegnaOra(Object.assign({}, flds));
                    fdM = tonyResolveOraLavoroForQuickHours(fdM, tonyBuildSegnaOraUserBlobLastNUserTurns(6));
                    fdM = tonySanitizeCfWorkspaceOraFormData(fdM);
                    enqueueTonyCommand({ type: 'INJECT_FORM_DATA', formId: 'field-workspace-ore-form', formData: fdM }, { source: 'block-segnatura-inject', delayMs: 400 });
                } else {
                    // La CF spesso manda solo APRI_PAGINA senza fields: compila comunque dalla chat («dalle 7 alle 18», …).
                    setTimeout(function() {
                        Promise.resolve(tonyRecoverSegnaOraFromChatHistory()).then(function(okRec) {
                            if (!okRec) {
                                console.log('[Tony] Blocco segnatura: nessun orario ricavato dalla chat (es. «dalle 7 alle 18» o «iniziato alle 7 e finito alle 18»).');
                            }
                        });
                    }, 380);
                }
            } else {
                console.warn('[Tony] Blocco segnatura: contesto workspace ma #quick-hours-form non trovato (né nel parent). Scorri alla slide Segna ore o apri il workspace campo.');
            }
        } catch (eInj) { /* ignore */ }
        return true;
    }

    /**
     * Estrae fascia oraria da testo libero (alias export engine per test e recovery).
     */
    function tonyMatchSegnaOraTimeRangeFromBlob(blob) {
        return matchSegnaOraTimeRangeFromBlob(blob);
    }

    /** Testo utente + sessionStorage + ultimi turni chat (stesso ordine della recovery inject). */
    function tonyBuildSegnaOraChatBlobForMatch(optExtraUserText) {
        var blob = '';
        try {
            if (optExtraUserText && String(optExtraUserText).trim()) {
                blob += ' ' + String(optExtraUserText).trim();
            }
        } catch (e0) { /* ignore */ }
        try {
            var lastU = tonyGetLastUserMessage();
            if (lastU && String(lastU).trim()) blob += ' ' + String(lastU).trim();
        } catch (e1) { /* ignore */ }
        try {
            var hist = (window.Tony && window.Tony.chatHistory) ? window.Tony.chatHistory : [];
            for (var i = Math.max(0, hist.length - 16); i < hist.length; i++) {
                var e = hist[i];
                if (!e || !e.parts || !e.parts.length) continue;
                var t = e.parts[0] && e.parts[0].text ? String(e.parts[0].text) : '';
                blob += ' ' + t;
            }
        } catch (e2) { /* ignore */ }
        return blob;
    }

    /** Solo messaggi utente (no Tony): evita pausa/note estratte dalle risposte del modello. */
    function tonyBuildSegnaOraUserOnlyBlobForMatch(optExtraUserText) {
        var blob = '';
        try {
            if (optExtraUserText && String(optExtraUserText).trim()) {
                blob += ' ' + String(optExtraUserText).trim();
            }
        } catch (e0) { /* ignore */ }
        try {
            var lastU = tonyGetLastUserMessage();
            if (lastU && String(lastU).trim()) blob += ' ' + String(lastU).trim();
        } catch (e1) { /* ignore */ }
        try {
            var hist = (window.Tony && window.Tony.chatHistory) ? window.Tony.chatHistory : [];
            for (var i = Math.max(0, hist.length - 16); i < hist.length; i++) {
                var e = hist[i];
                if (!e || e.role !== 'user' || !e.parts || !e.parts.length) continue;
                var t = e.parts[0] && e.parts[0].text ? String(e.parts[0].text) : '';
                blob += ' ' + t;
            }
        } catch (e2) { /* ignore */ }
        return blob;
    }

    /**
     * Ultimi N messaggi utente (cronologici) + prefisso come UserOnlyBlob (turno corrente opzionale, sessionStorage).
     * Così orari/pausa/lavoro non trascinano turni lontani, ma il messaggio appena inviato resta visibile se la history ritarda.
     */
    function tonyBuildSegnaOraUserBlobLastNUserTurns(maxTurns, optExtraUserText) {
        var n = maxTurns && maxTurns > 0 ? maxTurns : 6;
        var prefix = '';
        try {
            if (optExtraUserText && String(optExtraUserText).trim()) {
                prefix += ' ' + String(optExtraUserText).trim();
            }
        } catch (e0) { /* ignore */ }
        try {
            var lastUss = tonyGetLastUserMessage();
            if (lastUss && String(lastUss).trim()) prefix += ' ' + String(lastUss).trim();
        } catch (e1) { /* ignore */ }
        var parts = [];
        try {
            var hist = (window.Tony && window.Tony.chatHistory) ? window.Tony.chatHistory : [];
            for (var i = hist.length - 1; i >= 0 && parts.length < n; i--) {
                var e = hist[i];
                if (!e || e.role !== 'user' || !e.parts || !e.parts.length) continue;
                var t = e.parts[0] && e.parts[0].text ? String(e.parts[0].text).trim() : '';
                if (!t) continue;
                parts.unshift(t);
            }
        } catch (eH) { /* ignore */ }
        return String(prefix + ' ' + parts.join(' ')).trim();
    }

    /** Ultimi N messaggi utente (array cronologico), opzionale turno corrente in coda se non già presente. */
    function tonyGetSegnaOraUserTurnTexts(maxTurns, optExtraUserText) {
        var n = maxTurns && maxTurns > 0 ? maxTurns : 6;
        var parts = [];
        try {
            var hist = (window.Tony && window.Tony.chatHistory) ? window.Tony.chatHistory : [];
            for (var i = hist.length - 1; i >= 0 && parts.length < n; i--) {
                var e = hist[i];
                if (!e || e.role !== 'user' || !e.parts || !e.parts.length) continue;
                var t = e.parts[0] && e.parts[0].text ? String(e.parts[0].text).trim() : '';
                if (!t) continue;
                parts.unshift(t);
            }
        } catch (eH) { /* ignore */ }
        try {
            if (optExtraUserText && String(optExtraUserText).trim()) {
                var extra = String(optExtraUserText).trim();
                if (!parts.length || parts[parts.length - 1] !== extra) parts.push(extra);
            }
        } catch (eX) { /* ignore */ }
        return parts;
    }

    function tonyMatchSegnaOraTimeRangeFromUserHistory(maxTurns, optExtraUserText) {
        var turns = tonyGetSegnaOraUserTurnTexts(maxTurns, optExtraUserText);
        if (!turns.length) return null;
        return matchSegnaOraTimeRangeFromUserTexts(turns);
    }

    function tonyMatchSegnaOraSingleTimeFromBlob(blob) {
        return matchSegnaOraSingleTimeFromBlob(blob);
    }

    function tonyMatchSegnaOraSingleTimeForQuickHoursForm(blob, formHint) {
        var single = matchSegnaOraSingleTimeFromBlob(blob);
        if (single) return single;
        return matchSegnaOraBareHourFromBlob(blob, formHint);
    }

    function tonySegnaOraUnrecognizedTurnMessage(text) {
        var ub = String(text || '').trim();
        var qhWin = tonyResolveQuickHoursWindow();
        var startVal = '';
        var endVal = '';
        if (qhWin && qhWin.document) {
            var st = qhWin.document.getElementById('ora-start');
            var en = qhWin.document.getElementById('ora-end');
            startVal = st ? String(st.value || '').trim() : '';
            endVal = en ? String(en.value || '').trim() : '';
        }
        if (startVal && !endVal) {
            return 'Non ho capito l\'orario di fine. Scrivi ad esempio «alle 18», «18:30», «18,30» o «18 30».';
        }
        if (!startVal) {
            return 'Non ho capito l\'orario di inizio. Scrivi ad esempio «alle 7», «7:30» o solo «7».';
        }
        if (startVal && endVal && /^\s*(\d{1,3})\s*$/.test(ub)) {
            return 'Quanti minuti di pausa hai fatto? (es. 45, oppure «nessuna pausa»).';
        }
        return TONY_SEGNA_ORE_ASK_FALLBACK;
    }

    var TONY_SEGNA_ORE_LOCAL_INTERVIEW_MS = 30 * 60 * 1000;
    var TONY_SEGNA_ORE_MODEL_INTERVIEW_RE =
        /iniziato|inizio alle|ok,?\s*inizio alle|fino a che ora|a che ora hai iniziato|minuti di pausa|orari nel form|impostato la pausa|impostato orari|segn.*ore/i;

    function tonyMarkSegnaOraLocalInterview() {
        try {
            if (typeof window !== 'undefined') window.__tonySegnaOraLocalInterviewAt = Date.now();
        } catch (eMark) { /* ignore */ }
    }

    function tonySegnaOraLocalInterviewRecent() {
        try {
            return !!(window.__tonySegnaOraLocalInterviewAt &&
                (Date.now() - window.__tonySegnaOraLocalInterviewAt) < TONY_SEGNA_ORE_LOCAL_INTERVIEW_MS);
        } catch (eRec) {
            return false;
        }
    }

    /** Evita buchi in chatHistory: appendMessage UI non aggiorna Tony.chatHistory (solo CF / intercettazioni locali). */
    function tonyEnsureUserTurnInChatHistory(userText) {
        try {
            var t = String(userText || '').trim();
            if (!t || !window.Tony || !Array.isArray(window.Tony.chatHistory)) return;
            var hist = window.Tony.chatHistory;
            for (var i = hist.length - 1; i >= 0; i--) {
                var e = hist[i];
                if (!e || e.role !== 'user' || !e.parts || !e.parts.length) continue;
                var prev = e.parts[0] && e.parts[0].text ? String(e.parts[0].text).trim() : '';
                if (prev === t) return;
                break;
            }
            tonyPushLocalChatTurn(t, null, { skipModelPush: true });
        } catch (eEns) { /* ignore */ }
    }

    /** Intervista Segna ore già avviata (intent, form parziale o ultima domanda Tony su orari/pausa). */
    function tonyIsActiveSegnaOraInterview() {
        try {
            if (tonySegnaOraLocalInterviewRecent()) return true;
            var recentUb = tonyBuildSegnaOraUserBlobLastNUserTurns(4);
            if (tonyUserMessageSuggestsSegnaOre(recentUb)) return true;
            var qhWin = tonyResolveQuickHoursWindow();
            if (qhWin && qhWin.document) {
                var st = qhWin.document.getElementById('ora-start');
                var en = qhWin.document.getElementById('ora-end');
                if (st && String(st.value || '').trim()) return true;
                if (en && String(en.value || '').trim()) return true;
            }
            var hist = (window.Tony && window.Tony.chatHistory) ? window.Tony.chatHistory : [];
            var modelScanned = 0;
            for (var i = hist.length - 1; i >= 0 && modelScanned < 4; i--) {
                var e = hist[i];
                if (!e || e.role !== 'model' || !e.parts || !e.parts.length) continue;
                modelScanned++;
                var t = e.parts[0] && e.parts[0].text ? String(e.parts[0].text) : '';
                if (TONY_SEGNA_ORE_MODEL_INTERVIEW_RE.test(t)) return true;
            }
        } catch (eInt) { /* ignore */ }
        return false;
    }

    function tonyPadQuickHoursTime(val) {
        if (val == null || String(val).trim() === '') return null;
        var hm = String(val).trim().match(/^(\d{1,2})(?::(\d{2}))?/);
        if (!hm) return null;
        var h = parseInt(hm[1], 10);
        var mi = hm[2] ? parseInt(hm[2], 10) : 0;
        if (!Number.isFinite(h) || h < 0 || h > 23 || !Number.isFinite(mi) || mi < 0 || mi > 59) return null;
        function pad(n) { return (n < 10 ? '0' : '') + n; }
        return pad(h) + ':' + pad(mi);
    }

    function tonyUserBlobContainsHour(ub, hour) {
        if (hour == null || !ub) return false;
        var re = new RegExp('(?:^|\\D)' + hour + '(?:\\D|$)');
        if (re.test(ub)) return true;
        if (hour < 10) {
            re = new RegExp('(?:^|\\D)0' + hour + '(?:\\D|$)');
            if (re.test(ub)) return true;
        }
        return false;
    }

    /** Orari CF plausibili se l'utente ha citato quelle ore (es. «6» e «18» in «daklle 6 aslle 18»). */
    function tonyCfTimesPlausibleForUserBlob(fd, ub, optUserTurns) {
        if (!fd || !ub) return false;
        var ni = tonyPadQuickHoursTime(fd['ora-inizio'] || fd['ora-start'] || fd['attivita-orario-inizio']);
        var nf = tonyPadQuickHoursTime(fd['ora-fine'] || fd['ora-end'] || fd['attivita-orario-fine']);
        if (!ni || !nf) return false;
        var h1 = parseInt(ni.split(':')[0], 10);
        var h2 = parseInt(nf.split(':')[0], 10);
        if (!Number.isFinite(h1) || !Number.isFinite(h2) || h1 === h2) return false;
        var turns = Array.isArray(optUserTurns) ? optUserTurns : tonyGetSegnaOraUserTurnTexts(6);
        var ordered = matchSegnaOraTimeRangeFromUserTexts(turns);
        if (ordered) {
            return parseInt(ordered[1], 10) === h1 && parseInt(ordered[3], 10) === h2;
        }
        return tonyUserBlobContainsHour(ub, h1) && tonyUserBlobContainsHour(ub, h2) && h1 < h2;
    }

    function tonyApplySegnaOraTimeRangeMatchToFields(fd, m) {
        if (!m || !fd) return;
        function pad(n) { return (n < 10 ? '0' : '') + n; }
        var h1 = parseInt(m[1], 10);
        var mi1 = m[2] ? parseInt(m[2], 10) : 0;
        var h2 = parseInt(m[3], 10);
        var mi2 = m[4] ? parseInt(m[4], 10) : 0;
        fd['ora-inizio'] = pad(h1) + ':' + pad(mi1);
        fd['ora-fine'] = pad(h2) + ':' + pad(mi2);
    }

    /** Corregge inversione inizio/fine se i turni utente citano due «alle H» in ordine cronologico. */
    function tonyFixSegnaOraFieldsOrderFromUserTurns(fd, userTurns) {
        if (!fd || typeof fd !== 'object') return fd;
        var ni = tonyPadQuickHoursTime(fd['ora-inizio'] || fd['ora-start'] || fd['attivita-orario-inizio']);
        var nf = tonyPadQuickHoursTime(fd['ora-fine'] || fd['ora-end'] || fd['attivita-orario-fine']);
        if (!ni || !nf) return fd;
        var turns = Array.isArray(userTurns) ? userTurns : [];
        var ordered = matchSegnaOraTimeRangeFromUserTexts(turns);
        if (ordered) {
            tonyApplySegnaOraTimeRangeMatchToFields(fd, ordered);
            return fd;
        }
        var hStart = parseInt(ni.split(':')[0], 10);
        var hEnd = parseInt(nf.split(':')[0], 10);
        if (!Number.isFinite(hStart) || !Number.isFinite(hEnd) || hStart < hEnd) return fd;
        var alle = collectSegnaOraAlleTimesFromUserTexts(turns);
        if (alle.length >= 2) {
            var a0 = alle[0];
            var a1 = alle[alle.length - 1];
            if (a0.h < a1.h || (a0.h === a1.h && a0.mi < a1.mi)) {
                tonyApplySegnaOraTimeRangeMatchToFields(fd, [
                    turns.join(' '),
                    String(a0.h),
                    a0.mi ? String(a0.mi) : '',
                    String(a1.h),
                    a1.mi ? String(a1.mi) : '',
                ]);
            }
        }
        return fd;
    }

    /** True se in chat l'utente ha già parlato di pausa (anche «0» o «nessuna pausa»). */
    function tonyQuickHoursUserAcknowledgedPause(blob) {
        if (!blob || typeof blob !== 'string') blob = '';
        if (/(\d+)\s*min(?:uti)?(?:\s+di\s*pausa)?/i.test(blob)) return true;
        if (/un['']?ora\s+di\s+pausa/i.test(blob)) return true;
        if (/nessun[ao]?\s+pausa|senza\s+pausa|no\s+pausa|zero\s+pausa|non\s+ho\s+fatto\s+pausa|mai\s+fatto\s+pausa|non\s+ho\s+paus/i.test(blob)) return true;
        if (/\bpausa\b/i.test(blob) && /\b(nessun|niente|nulla|\b0\b)\b/i.test(blob)) return true;
        try {
            if (window.__tonyQuickHoursPauseAckAt &&
                (Date.now() - window.__tonyQuickHoursPauseAckAt) < TONY_SEGNA_ORE_LOCAL_INTERVIEW_MS) {
                return true;
            }
        } catch (eFl) { /* ignore */ }
        try {
            var turns = tonyGetSegnaOraUserTurnTexts(8);
            for (var i = 0; i < turns.length; i++) {
                var t = String(turns[i] || '').trim();
                if (!t) continue;
                var loneNum = t.match(/^\s*(\d{1,3})\s*$/);
                if (loneNum) {
                    var n = parseInt(loneNum[1], 10);
                    if (Number.isFinite(n) && n >= 0 && n <= 600) return true;
                }
                if (/^\s*(nessuna|nessun|niente|nulla)\s*$/i.test(t)) return true;
                if (/nessun[ao]?\s+pausa|senza\s+pausa|no\s+pausa|zero\s+pausa/i.test(t)) return true;
            }
        } catch (eT) { /* ignore */ }
        return false;
    }

    /**
     * Minuti pausa solo da testo utente (blob da tonyBuildSegnaOraUserOnlyBlobForMatch).
     * Non usare cronologia mista utente+Tony: il modello può ripetere «60 minuti» e far matchare il primo numero.
     */
    function tonyExtractPauseMinutesFromUserBlob(userBlob) {
        if (!userBlob || typeof userBlob !== 'string') return null;
        var pm = userBlob.match(/(\d+)\s*min(?:uti)?(?:\s+di\s*pausa)?/i);
        if (pm) {
            var n0 = parseInt(pm[1], 10);
            if (Number.isFinite(n0) && n0 >= 0 && n0 <= 600) return n0;
        }
        if (/un['']?ora\s+di\s+pausa/i.test(userBlob)) return 60;
        if (/^\s*(nessuna|nessun|niente|nulla)\s*$/i.test(userBlob.trim())) return 0;
        if (/nessun[ao]?\s+pausa|senza\s+pausa|no\s+pausa|zero\s+pausa|non\s+ho\s+fatto\s+pausa/i.test(userBlob)) return 0;
        try {
            var lastU2 = tonyGetLastUserMessage();
            if (lastU2 && /^\s*(\d{1,3})\s*$/.test(String(lastU2).trim())) {
                var lone = parseInt(RegExp.$1, 10);
                if (Number.isFinite(lone) && lone >= 0 && lone <= 600) return lone;
            }
        } catch (e2) { /* ignore */ }
        return null;
    }

    /** @deprecated Preferisci user-only: passa il risultato di tonyBuildSegnaOraUserOnlyBlobForMatch(). */
    function tonyExtractQuickHoursPauseMinutesFromBlob(blob) {
        return tonyExtractPauseMinutesFromUserBlob(blob);
    }

    /**
     * Note da prefissi «note/nota/annotazione: …» nel blob solo-utente.
     * Il blob è spesso una sola riga (turni concatenati): cercare «note» ovunque, non solo a inizio riga.
     */
    function tonyExtractQuickHoursNoteFromUserBlob(userBlob) {
        if (!userBlob || typeof userBlob !== 'string') userBlob = '';
        var s = userBlob.replace(/\s+/g, ' ').trim();
        if (!s) return null;
        try {
            var re = /\b(note|nota|annotazioni?)\s*[:\.](.+?)(?=\s+(?:note|nota|annotazioni?)\s*[:\.]|\s*$)/gi;
            var lastChunk = null;
            var m;
            while ((m = re.exec(s)) !== null) {
                var chunk = (m[2] || '').trim();
                if (chunk) lastChunk = chunk;
            }
            if (lastChunk != null && lastChunk !== '') {
                lastChunk = lastChunk.replace(/\s+(si|sì|ok|yes|salva)\s*$/i, '').trim();
                if (lastChunk) return tonySanitizeQuickHoursNoteText(lastChunk) || lastChunk;
            }
        } catch (eL) { /* ignore */ }
        try {
            var lastU = tonyGetLastUserMessage();
            if (lastU) {
                var nu = lastU.match(/^\s*(note|nota|annotazioni?)\s*[:\.]?\s*(.+)$/i);
                if (nu && nu[2]) {
                    var o = tonySanitizeQuickHoursNoteText(nu[2].trim());
                    return o || nu[2].trim();
                }
            }
        } catch (eU) { /* ignore */ }
        try {
            var lines = s.split(/\n/).map(function (x) { return String(x || '').trim(); }).filter(Boolean);
            for (var i = lines.length - 1; i >= 0; i--) {
                var lm = lines[i].match(/^(note|nota|annotazioni?)\s*[:\.]?\s*(.+)$/i);
                if (lm && lm[2]) {
                    var o2 = tonySanitizeQuickHoursNoteText(lm[2].trim());
                    return o2 || lm[2].trim();
                }
            }
        } catch (eL2) { /* ignore */ }
        return null;
    }

    function tonyExtractQuickHoursNoteFromBlob(blob) {
        return tonyExtractQuickHoursNoteFromUserBlob(blob);
    }

    /** Taglia parti di intento («segniamo le ore…», fascia oraria) incollate dopo «note:». */
    function tonySanitizeQuickHoursNoteText(note) {
        if (!note || typeof note !== 'string') return note;
        var t = note.trim();
        t = t.replace(/\s+(segniamo|segna)\s+(le\s+)?ore\b[\s\S]*$/i, '').trim();
        t = t.replace(/\s+dalle\s+\d{1,2}(?:[:.]\d{2})?\s+alle\s+\d{1,2}(?:[:.]\d{2})?[\s\S]*$/i, '').trim();
        t = t.replace(/\s+ore\s+di\s+(ieri|oggi)[\s\S]*$/i, '').trim();
        return t || null;
    }

    /**
     * INJECT dalla CF: non accettare pausa/note inventate dal modello se l’utente non le ha dette.
     * La pausa/nota restano solo se ricavabili dal blob solo-utente (stesse regole della recovery).
     */
    function tonySanitizeCfWorkspaceOraFormData(formDataIn) {
        var fd = formDataIn && typeof formDataIn === 'object' ? Object.assign({}, formDataIn) : {};
        var lastU = tonyGetLastUserMessage();
        var userTurns = tonyGetSegnaOraUserTurnTexts(6, lastU || null);
        var ub = tonyBuildSegnaOraUserBlobLastNUserTurns(6, lastU || null);
        var m = matchSegnaOraTimeRangeFromUserTexts(userTurns);
        if (!m && lastU) m = tonyMatchSegnaOraTimeRangeFromBlob(lastU);
        if (m) {
            tonyApplySegnaOraTimeRangeMatchToFields(fd, m);
        } else if (tonyCfTimesPlausibleForUserBlob(fd, ub, userTurns)) {
            var ni = tonyPadQuickHoursTime(fd['ora-inizio'] || fd['ora-start'] || fd['attivita-orario-inizio']);
            var nf = tonyPadQuickHoursTime(fd['ora-fine'] || fd['ora-end'] || fd['attivita-orario-fine']);
            if (ni) fd['ora-inizio'] = ni;
            if (nf) fd['ora-fine'] = nf;
        } else {
            delete fd['ora-inizio'];
            delete fd['ora-fine'];
            delete fd['ora-start'];
            delete fd['ora-end'];
            delete fd['attivita-orario-inizio'];
            delete fd['attivita-orario-fine'];
        }
        tonyFixSegnaOraFieldsOrderFromUserTurns(fd, userTurns);
        delete fd['ora-pause'];
        delete fd['attivita-pause'];
        var pu = tonyExtractPauseMinutesFromUserBlob(ub);
        if (pu != null) fd['ora-pause'] = String(pu);
        else if (/nessun[ao]?\s+pausa|senza\s+pausa|no\s+pausa|zero\s+pausa|non\s+ho\s+fatto\s+pausa/i.test(ub)) fd['ora-pause'] = '0';
        delete fd['ora-note'];
        delete fd['attivita-note'];
        var nu = tonyExtractQuickHoursNoteFromUserBlob(ub);
        nu = nu ? tonySanitizeQuickHoursNoteText(nu) : null;
        if (nu && String(nu).trim()) fd['ora-note'] = String(nu).trim();
        return fd;
    }

    function tonyTrackQuickHoursCfInterviewFromSpeech(speech) {
        try {
            if (!speech || typeof speech !== 'string') return;
            var s = speech.toLowerCase();
            if (/minut[io].*pausa|pausa.*minut|quanti minuti|nessuna pausa|per quanti minuti/i.test(s)) {
                window.__tonyQuickHoursCfAskedPauseAt = Date.now();
            }
            if (/vuoi salvare|confermi|salvo\?|ok salva|scrivi «sì»|scrivi "sì"/i.test(s)) {
                window.__tonyQuickHoursCfAskedSaveAt = Date.now();
            }
        } catch (eTr) { /* ignore */ }
    }

    function tonyCfSpeechCoversQuickHoursInterview(speech) {
        if (!speech || typeof speech !== 'string') return false;
        var s = speech.toLowerCase();
        if (/minut[io].*pausa|pausa.*minut|quanti minuti|nessuna pausa|per quanti minuti/i.test(s)) return true;
        if (/vuoi salvare|confermi|salvo\?|ok salva|scrivi «sì»|scrivi "sì"/i.test(s)) return true;
        return false;
    }

    function tonyPushLocalChatTurn(userText, assistantText, opts) {
        opts = opts || {};
        try {
            if (!window.Tony || !Array.isArray(window.Tony.chatHistory)) return;
            if (!opts.skipUserPush && userText && String(userText).trim()) {
                window.Tony.chatHistory.push({ role: 'user', parts: [{ text: String(userText).trim() }] });
            }
            if (!opts.skipModelPush && assistantText && String(assistantText).trim()) {
                window.Tony.chatHistory.push({ role: 'model', parts: [{ text: String(assistantText).trim() }] });
            }
            while (window.Tony.chatHistory.length > 80) window.Tony.chatHistory.shift();
        } catch (ePush) { /* ignore */ }
    }

    function tonyFinishSegnaOreLocalIntercept(userText, msg, handlers) {
        handlers = handlers || {};
        if (typeof handlers.clearEarlyTyping === 'function') handlers.clearEarlyTyping();
        if (typeof handlers.removeTyping === 'function') handlers.removeTyping();
        tonyMarkSegnaOraLocalInterview();
        tonyPushLocalChatTurn(userText, msg, { skipUserPush: true });
        window.__tonyLastCfAssistantText = msg;
        if (typeof handlers.appendMessage === 'function') handlers.appendMessage(msg, 'tony');
        if (typeof handlers.speak === 'function') handlers.speak(msg);
        if (typeof handlers.saveState === 'function') handlers.saveState();
    }

    /** Messaggio utente appartenente al flusso Segna ore workspace (intercettabile senza CF). */
    function tonyMessageIsFieldWorkspaceSegnaOreTurn(text) {
        var ub = String(text || '').trim();
        if (!ub) return false;
        if (isTonySaveConfirmText(ub)) return true;
        if (tonyUserMessageSuggestsSegnaOre(ub)) return true;
        if (tonyMatchSegnaOraTimeRangeFromBlob(ub)) return true;
        if (tonyIsActiveSegnaOraInterview() || tonySegnaOraLocalInterviewRecent()) {
            var qhWin = tonyResolveQuickHoursWindow();
            if (qhWin && qhWin.document) {
                var st = qhWin.document.getElementById('ora-start');
                var en = qhWin.document.getElementById('ora-end');
                var formHint = {
                    hasStart: !!(st && String(st.value || '').trim()),
                    hasEnd: !!(en && String(en.value || '').trim()),
                };
                if (tonyMatchSegnaOraSingleTimeForQuickHoursForm(ub, formHint)) return true;
                if (formHint.hasStart && formHint.hasEnd && /^\s*(\d{1,3})\s*$/.test(ub)) return true;
            }
        }
        if (/nessun[ao]?\s+pausa|senza\s+pausa|no\s+pausa|zero\s+pausa/i.test(ub)) return true;
        return false;
    }

    /**
     * @returns {{ handled: boolean }}
     */
    function tryInterceptSegnaOreIntentBeforeCf(text, handlers) {
        handlers = handlers || {};
        if (!tonyResolveQuickHoursWindow() || !tonyIsCampoLikeWorkspaceForTony()) return { handled: false };
        var ub = String(text || '').trim();
        if (!ub || isTonySaveConfirmText(ub)) return { handled: false };
        if (!tonyUserMessageSuggestsSegnaOre(ub)) return { handled: false };
        if (tonyMatchSegnaOraTimeRangeFromBlob(ub)) return { handled: false };
        if (/^\s*(\d{1,3})\s*$/.test(ub)) return { handled: false };
        var qhWin = tonyResolveQuickHoursWindow();
        try {
            if (qhWin && typeof qhWin.gfvFieldWorkspaceGoToHoursSlide === 'function') qhWin.gfvFieldWorkspaceGoToHoursSlide();
        } catch (eSl) { /* ignore */ }
        var doc = qhWin.document;
        var st = doc.getElementById('ora-start');
        var en = doc.getElementById('ora-end');
        var hasTimes = st && en && String(st.value || '').trim() && String(en.value || '').trim();
        var msg;
        if (hasTimes && quickHoursFormReadyForTonySave()) {
            msg = 'Ho già orari e pausa nel form. Vuoi salvare? Scrivi «sì» o «salva».';
        } else if (hasTimes) {
            msg = 'Ho già gli orari nel form. Quanti minuti di pausa hai fatto? (es. 30, oppure «nessuna pausa»).';
        } else {
            msg = TONY_SEGNA_ORE_ASK_FALLBACK;
        }
        tonyFinishSegnaOreLocalIntercept(ub, msg, handlers);
        console.log('[Tony] Segna ore: intervista locale avvio (0 CF).');
        return { handled: true };
    }

    /**
     * Primo messaggio con fascia oraria su workspace campo: inject locale + domanda pausa, 0 CF.
     * @returns {{ handled: boolean }}
     */
    function tryInterceptSegnaOreTurnBeforeCf(text, handlers) {
        handlers = handlers || {};
        if (!tonyResolveQuickHoursWindow() || !tonyIsCampoLikeWorkspaceForTony()) return { handled: false };
        var ub = String(text || '').trim();
        if (!ub || isTonySaveConfirmText(ub)) return { handled: false };
        if (!tonyUserMessageSuggestsSegnaOre(ub) && !tonyMatchSegnaOraTimeRangeFromBlob(ub)) return { handled: false };
        if (!tonyMatchSegnaOraTimeRangeFromBlob(ub)) return { handled: false };
        if (typeof handlers.clearEarlyTyping === 'function') handlers.clearEarlyTyping();
        if (typeof handlers.appendTyping === 'function') handlers.appendTyping();
        Promise.resolve(tonyRecoverSegnaOraFromChatHistory({ userText: ub, maxTurns: 2 })).then(function(ok) {
            if (typeof handlers.removeTyping === 'function') handlers.removeTyping();
            if (!ok) return;
            var fc = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
            var intE = (fc && fc.interviewEmpty) ? fc.interviewEmpty : [];
            var onlyPause = intE.length === 1 && intE[0] === 'ora-break';
            var msg = onlyPause
                ? 'Ho impostato orari nel form. Quanti minuti di pausa hai fatto? (es. 30, oppure «nessuna pausa»).'
                : 'Ho impostato orari nel form. Vuoi salvare? Scrivi «sì» o «salva».';
            tonyFinishSegnaOreLocalIntercept(ub, msg, handlers);
            console.log('[Tony] Segna ore: inject locale da fascia oraria (senza tonyAsk).');
        }).catch(function() {
            if (typeof handlers.removeTyping === 'function') handlers.removeTyping();
        });
        return { handled: true };
    }

    /**
     * Un solo orario per messaggio (es. «alle 7» poi «alle 18»): inject locale campo per campo, 0 CF.
     * @returns {{ handled: boolean }}
     */
    function tryInterceptSegnaOreSingleTimeBeforeCf(text, handlers) {
        handlers = handlers || {};
        if (!tonyResolveQuickHoursWindow() || !tonyIsCampoLikeWorkspaceForTony()) return { handled: false };
        var ub = String(text || '').trim();
        if (!ub || isTonySaveConfirmText(ub)) return { handled: false };
        if (tonyMatchSegnaOraTimeRangeFromBlob(ub)) return { handled: false };
        if (!tonyIsActiveSegnaOraInterview()) return { handled: false };
        tonyMarkSegnaOraLocalInterview();
        var qhWin = tonyResolveQuickHoursWindow();
        var doc = qhWin.document;
        var st = doc.getElementById('ora-start');
        var en = doc.getElementById('ora-end');
        if (!st || !en) return { handled: false };
        var startVal = String(st.value || '').trim();
        var endVal = String(en.value || '').trim();
        var single = tonyMatchSegnaOraSingleTimeForQuickHoursForm(ub, {
            hasStart: !!startVal,
            hasEnd: !!endVal,
        });
        if (!single) return { handled: false };
        var kind = single[3] || 'unknown';
        var time = tonyPadQuickHoursTime(single[1] + ':' + (single[2] || '00'));
        if (!time) return { handled: false };
        var fd = {};
        var msg;
        if (kind === 'end' || (startVal && !endVal)) {
            fd['ora-fine'] = time;
            msg = 'Ok, fine alle ' + time + '. Quanti minuti di pausa hai fatto? (es. 30, oppure «nessuna pausa»).';
        } else if (!startVal || kind === 'start') {
            fd['ora-inizio'] = time;
            msg = 'Ok, inizio alle ' + time + '. Fino a che ora hai lavorato?';
        } else {
            fd['ora-fine'] = time;
            msg = 'Ok, fine alle ' + time + '. Quanti minuti di pausa hai fatto? (es. 30, oppure «nessuna pausa»).';
        }
        if (typeof handlers.clearEarlyTyping === 'function') handlers.clearEarlyTyping();
        if (typeof handlers.appendTyping === 'function') handlers.appendTyping();
        Promise.resolve(
            window.TonyFormInjector && typeof window.TonyFormInjector.injectFieldWorkspaceQuickHoursForm === 'function'
                ? window.TonyFormInjector.injectFieldWorkspaceQuickHoursForm(fd, window.Tony && window.Tony.context, { targetWindow: qhWin })
                : false
        ).then(function(ok) {
            if (typeof handlers.removeTyping === 'function') handlers.removeTyping();
            if (!ok) return;
            tonyFinishSegnaOreLocalIntercept(ub, msg, handlers);
            console.log('[Tony] Segna ore: inject locale singolo orario (senza tonyAsk).');
        }).catch(function() {
            if (typeof handlers.removeTyping === 'function') handlers.removeTyping();
        });
        return { handled: true };
    }

    /**
     * Risposta solo minuti pausa (es. «60») con orari già nel form: inject pausa + domanda salva, 0 CF.
     * @returns {{ handled: boolean }}
     */
    function tryInterceptSegnaOrePauseBeforeCf(text, handlers) {
        handlers = handlers || {};
        if (!tonyResolveQuickHoursWindow() || !tonyIsCampoLikeWorkspaceForTony()) return { handled: false };
        var ub = String(text || '').trim();
        if (!ub || isTonySaveConfirmText(ub)) return { handled: false };
        if (tonyMatchSegnaOraTimeRangeFromBlob(ub)) {
            return tryInterceptSegnaOreTurnBeforeCf(text, handlers);
        }
        var pauseMin = tonyExtractPauseMinutesFromUserBlob(ub);
        if (pauseMin == null) return { handled: false };
        var qhWin = tonyResolveQuickHoursWindow();
        var doc = qhWin.document;
        var st = doc.getElementById('ora-start');
        var en = doc.getElementById('ora-end');
        if (!st || !en || !String(st.value || '').trim() || !String(en.value || '').trim()) {
            return { handled: false };
        }
        if (typeof handlers.clearEarlyTyping === 'function') handlers.clearEarlyTyping();
        if (typeof handlers.appendTyping === 'function') handlers.appendTyping();
        var fdPause = { 'ora-pause': String(pauseMin) };
        Promise.resolve(
            window.TonyFormInjector && typeof window.TonyFormInjector.injectFieldWorkspaceQuickHoursForm === 'function'
                ? window.TonyFormInjector.injectFieldWorkspaceQuickHoursForm(fdPause, window.Tony && window.Tony.context, { targetWindow: qhWin })
                : false
        ).then(function(ok) {
            if (typeof handlers.removeTyping === 'function') handlers.removeTyping();
            if (!ok) return;
            try { window.__tonyQuickHoursPauseAckAt = Date.now(); } catch (eAck) { /* ignore */ }
            var msg = quickHoursFormReadyForTonySave()
                ? 'Ho impostato la pausa nel form. Vuoi salvare? Scrivi «sì», «ok» o «salva».'
                : 'Ho impostato la pausa nel form. Controlla i campi e conferma quando sei pronto.';
            tonyFinishSegnaOreLocalIntercept(ub, msg, handlers);
            console.log('[Tony] Segna ore: pausa inject locale (senza tonyAsk).');
        }).catch(function() {
            if (typeof handlers.removeTyping === 'function') handlers.removeTyping();
        });
        return { handled: true };
    }

    /** Ultimo messaggio utente chiede esplicitamente di salvare / confermare (no solo orari, pausa o «note:»). */
    function tonyLastUserMessageExplicitSegnaOraSubmitIntent() {
        try {
            var lastU = tonyGetLastUserMessage();
            if (!lastU) return false;
            if (/^\s*\d{1,3}\s*$/.test(lastU)) return false;
            if (/^\s*(note|nota|annotazioni?)\s*[:\.]/i.test(lastU)) return false;
            if (/dalle\s+\d|^(ho\s+)?iniziat/i.test(lastU) && lastU.length < 140 && !/\b(salva|s[iì1]\b|ok\b|confermo|procedi)\b/i.test(lastU)) return false;
            if (/^\s*s[iì1]\s*[!.,]*\s*$/i.test(lastU)) return true;
            if (/^\s*(ok|va\s*bene)\s*[!.,]*\s*$/i.test(lastU)) return true;
            if (/\bsalva\b/i.test(lastU)) return true;
            if (/\b(confermo|procedi|conferma)\b/i.test(lastU)) return true;
            return false;
        } catch (eLu) { return false; }
    }

    /** blob deve essere solo messaggi utente per confronto affidabile con #ora-break. */
    function tonyQuickHoursPauseInjectNeeded(blob, doc) {
        if (!doc) return false;
        var brEl = doc.getElementById('ora-break');
        var cur = 0;
        if (brEl && String(brEl.value || '').trim() !== '') {
            var bp = parseInt(String(brEl.value).trim(), 10);
            cur = Number.isFinite(bp) ? bp : 0;
        }
        var fromBlob = tonyExtractPauseMinutesFromUserBlob(blob);
        if (fromBlob == null) return false;
        return String(fromBlob) !== String(cur);
    }

    function tonyLocalDateToIsoYmd(d) {
        if (!d || typeof d.getFullYear !== 'function') return null;
        function p(n) { return (n < 10 ? '0' : '') + n; }
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }

    /** Ricava YYYY-MM-DD da chat (oggi/ieri o data già in formato ISO nel testo). */
    function tonyGuessOraDataIsoFromBlob(blob) {
        if (!blob || typeof blob !== 'string') return null;
        if (/\bieri\b/i.test(blob)) {
            var d0 = new Date();
            d0.setDate(d0.getDate() - 1);
            return tonyLocalDateToIsoYmd(d0);
        }
        if (/\boggi\b/i.test(blob)) {
            return tonyLocalDateToIsoYmd(new Date());
        }
        var iso = blob.match(/\b(\d{4}-\d{2}-\d{2})\b/);
        if (iso) return iso[1];
        return null;
    }

    /** Pagina o contesto tabella tipici di operaio/caposquadra sul workspace mobile. */
    function tonyIsCampoLikeWorkspaceForTony() {
        try {
            if (getTonyFieldProfileFromContext()) return true;
            var pg = window.Tony && window.Tony.context && window.Tony.context.page;
            var ctd = pg && pg.currentTableData;
            if (ctd && (ctd.pageType === 'field_workspace' || ctd.pageType === 'lavori_caposquadra')) return true;
            var path = (window.location.pathname || '').toLowerCase();
            if (path.indexOf('field-workspace-standalone') >= 0) return true;
            if (path.indexOf('lavori-caposquadra-standalone') >= 0) return true;
            if (window.currentTableData && (window.currentTableData.pageType === 'field_workspace' || window.currentTableData.pageType === 'lavori_caposquadra')) return true;
            if (window.parent && window.parent !== window) {
                var pp = (window.parent.location.pathname || '').toLowerCase();
                if (pp.indexOf('field-workspace-standalone') >= 0) return true;
                if (pp.indexOf('lavori-caposquadra-standalone') >= 0) return true;
                try {
                    if (window.parent.currentTableData && (window.parent.currentTableData.pageType === 'field_workspace' || window.parent.currentTableData.pageType === 'lavori_caposquadra')) return true;
                } catch (eP) { /* ignore */ }
            }
        } catch (e) { /* ignore */ }
        return false;
    }

    function tonyUserMessageSuggestsSegnaOre(userBlob) {
        if (!userBlob || typeof userBlob !== 'string') return false;
        if (/segn\w*\s+le\s+ore|registr\w*\s+le\s+ore|ore\s+di\s+(ieri|oggi)|segnatura\s+ore|segna\s+ore/i.test(userBlob)) return true;
        var u = userBlob.toLowerCase();
        if (/\b(ore|orari)\b/.test(u) && /\b(lavoro|lavorato|turno|ieri|oggi|pausa|inizio|fine)\b/.test(u)) return true;
        if (/\b(ho\s+lavorato|ho\s+iniziat|iniziat\w*\s+alle\s+\d|ore\s+lavorate|finito\s+il\s+turno|inizio\s+turno|registr\w*\s+il\s+tempo)\b/.test(u)) return true;
        if (tonyMatchSegnaOraTimeRangeFromBlob(userBlob)) return true;
        return false;
    }

    var TONY_SEGNA_ORE_ASK_FALLBACK = 'A che ora hai iniziato e finito? Quanti minuti di pausa?';

    /** Fallback RAM quando Tracking Prevention blocca sessionStorage. */
    function tonyGetLastUserMessage() {
        try {
            if (typeof sessionStorage !== 'undefined') {
                var stored = sessionStorage.getItem('tony_last_user_message');
                if (stored && String(stored).trim()) return String(stored).trim();
            }
        } catch (_) { /* ignore */ }
        try {
            if (typeof window !== 'undefined' && window.__tonyLastUserMessage) {
                return String(window.__tonyLastUserMessage).trim();
            }
        } catch (_) { /* ignore */ }
        return '';
    }

    function tonySetLastUserMessage(text) {
        var t = String(text || '').trim();
        if (!t) return;
        try {
            if (typeof window !== 'undefined') window.__tonyLastUserMessage = t;
        } catch (_) { /* ignore */ }
        try {
            if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('tony_last_user_message', t);
        } catch (_) { /* ignore */ }
    }

    function tonyEnsureSegnaOraAssistantVisible(text) {
        var t = String(text || '').trim();
        if (t) return t;
        if (!tonyIsCampoLikeWorkspaceForTony()) return '';
        var ub = String(tonyBuildSegnaOraUserBlobLastNUserTurns(6) || '').trim();
        if (!tonyUserMessageSuggestsSegnaOre(ub)) return '';
        return TONY_SEGNA_ORE_ASK_FALLBACK;
    }

    function tonyStripRedundantSegnaOraOpener(speech) {
        var s = String(speech || '').trim();
        if (!s) return '';
        if (/apri(re)?\s+(la\s+)?pagin|vai\s+alla\s+segnatur|vado\s+alla\s+pagin|inserisc(i|ite)\s+.{0,40}dati|compila(re)?\s+(il\s+)?form\s+a\s+mano|porto\s+.{0,30}segnatur|ok,?\s*apri\s+la\s+pagin/i.test(s)) {
            return '';
        }
        var out = s.replace(/\b(?:ok\.?\s*,?\s*)?(?:certo\.?\s*,?\s*)?(?:vuoi\s+(?:segnare|registrare)\s+le\s+ore(?:\s+per\s+oggi)?\??)\s*/gi, ' ').trim();
        out = out.replace(/^ok\.?\s*,?\s*vuoi\b[^.?!]*[.?!]?\s*/i, '').trim();
        if (/^ok\.?!?$/i.test(out) || /^va\s*bene\.?!?$/i.test(out) || /^certo\.?!?$/i.test(out)) return '';
        if (/cambio\s+(la\s+)?data\b/i.test(out) && !/\b(orario|dalle\s+\d|alle\s+\d|inizio|fine)\b/i.test(out)) return '';
        return out;
    }

    /**
     * Su workspace campo: evita il primo bubble fuorviante («apri la pagina…») quando il client esegue già INJECT / navigazione.
     */
    function tonySanitizeFieldWorkspaceSegnaOraAssistantText(userMsg, cmd, speech) {
        if (!tonyIsCampoLikeWorkspaceForTony()) return speech;
        var segnaOreBlob = String(tonyBuildSegnaOraUserBlobLastNUserTurns(6, userMsg || '') || '').trim();
        if (!tonyUserMessageSuggestsSegnaOre(segnaOreBlob)) return speech;
        var qhGuard = tonyResolveQuickHoursWindow();
        if (qhGuard) {
            var stG = qhGuard.document.getElementById('ora-start');
            var enG = qhGuard.document.getElementById('ora-end');
            var domTimesOk = stG && enG && String(stG.value || '').trim() && String(enG.value || '').trim();
            var rangeOk = !!tonyMatchSegnaOraTimeRangeFromBlob(segnaOreBlob);
            var sG = String(speech || '');
            var claimsSaved = /ore\s+segnate\b|salvat[ao]\b|registrat[ei]\s+.{0,20}ore|perfetto\s*[,.]?\s*(tutto|ore)|tutto\s+chiaro\s*[.!]*\s*perfetto|perfetto\s*[,.]?\s*tutto\s+chiaro|(?:^|[.!?\s])segna(?:te|to)\s+le\s+ore\b/i.test(sG);
            if (claimsSaved && (!rangeOk || !domTimesOk)) {
                if (!rangeOk) {
                    return 'Indica fascia oraria e pausa (es. «dalle 7 alle 18» o «iniziato alle 7 e finito alle 18»), così compilo il form.';
                }
                return 'Ok, imposto gli orari nel form. Poi ti chiedo la pausa e la conferma per salvare.';
            }
        }
        var ct = cmd && cmd.type ? String(cmd.type).toUpperCase() : '';
        var isOraFlow = false;
        if (ct === 'INJECT_FORM_DATA') {
            var fid = cmd.formId || '';
            if (fid === 'field-workspace-ore-form' || fid === 'ora-form') isOraFlow = true;
        }
        if (ct === 'APRI_PAGINA' || ct === 'APRI_MODULO') {
            var tgt = (cmd.params && cmd.params.target) || cmd.target || cmd.modulo || '';
            var ts = String(tgt).toLowerCase();
            if (ts.indexOf('segnatura') >= 0 || ts.indexOf('segnare') >= 0 || ts.indexOf('workspace') >= 0 || ts.indexOf('campo') >= 0) isOraFlow = true;
        }
        if (ct === 'SALVA' || ct === 'SAVE') isOraFlow = true;
        if (ct === 'SUBMIT_FORM' || ct === 'QUICK_SAVE') {
            var sid = String((cmd && (cmd.formId || cmd.id)) || '').toLowerCase();
            if (sid === 'quick-hours-form' || sid === 'field-workspace-ore-form' || ct === 'QUICK_SAVE') isOraFlow = true;
        }
        if (ct === 'OPEN_MODAL') {
            var oid = String(cmd.id || cmd.target || '').toLowerCase();
            if (oid.indexOf('ora') >= 0) isOraFlow = true;
        }
        if (!isOraFlow) return speech;
        var s = (speech || '').trim();
        if (!s) return s;
        var cleaned = tonyStripRedundantSegnaOraOpener(s);
        if (cleaned) return cleaned;
        if (/[?]/.test(s) || /\b(a che ora|quanti minuti|orari|pausa|iniziato|finito)\b/i.test(s)) return s;
        return TONY_SEGNA_ORE_ASK_FALLBACK;
    }

    /**
     * La CF profilo campo può emettere «non ho accesso» anche su segnatura ore lecita; evita contrasto con recovery/proattivo.
     */
    function tonyReplaceFieldSegnaOreSpuriousRefusal(finalSpeech, turnUserText) {
        try {
            if (!tonyIsCampoLikeWorkspaceForTony()) return finalSpeech;
            var ub = String(tonyBuildSegnaOraUserBlobLastNUserTurns(6, turnUserText || '') || '').trim();
            if (!tonyUserMessageSuggestsSegnaOre(ub)) return finalSpeech;
            var s = String(finalSpeech || '').trim();
            if (!/non ho accesso|chiedi al manager|dal tuo account/i.test(s)) return finalSpeech;
            if (tonyMatchSegnaOraTimeRangeFromBlob(ub)) return '';
            return 'Ok. A che ora hai iniziato e finito? (es. dalle 7 alle 18)';
        } catch (eR) {
            return finalSpeech;
        }
    }

    /**
     * Se la CF chiede orari/pausa ma #quick-hours-form ha già inizio, fine e pausa valorizzati, sostituisci con conferma breve
     * (evita doppi bubble rispetto alla recovery che compila subito dopo).
     */
    function tonySanitizeQuickHoursSpeechVsFormDom(speech, turnUserText) {
        try {
            if (!speech || !tonyIsCampoLikeWorkspaceForTony()) return speech;
            var qhWin = tonyResolveQuickHoursWindow();
            if (!qhWin || !qhWin.document) return speech;
            var doc = qhWin.document;
            var st = doc.getElementById('ora-start');
            var en = doc.getElementById('ora-end');
            var brEl = doc.getElementById('ora-break');
            var hasTimes = st && en && String(st.value || '').trim() && String(en.value || '').trim();
            if (!hasTimes) return speech;
            var brNum = 0;
            if (brEl && String(brEl.value || '').trim() !== '') {
                var bp = parseInt(String(brEl.value).trim(), 10);
                brNum = Number.isFinite(bp) ? bp : 0;
            }
            var ub = tonyBuildSegnaOraUserBlobLastNUserTurns(6, turnUserText || '');
            var pauseOk = brNum > 0 || tonyQuickHoursUserAcknowledgedPause(ub);
            if (!pauseOk) return speech;
            var s = String(speech || '').trim();
            if (!s) return speech;
            var soundsLikeNeedData =
                /a che ora (hai )?inizi|iniziato e finito|quanti minuti (di )?pausa|minuti di pausa|non posso salvare finché|finché non mi dai|orari?\b[\s\S]{0,40}\bpausa/i.test(s);
            if (!soundsLikeNeedData) return speech;
            return 'Ho impostato data, orari e pausa nel form. Controlla e premi «Salva ore lavorate» se va bene.';
        } catch (eS) {
            return speech;
        }
    }

    /**
     * Se la CF risponde solo a parole (nessun INJECT) ma il blob utente ha fascia/pausa: compila #quick-hours-form prima del messaggio in chat.
     * @returns {Promise<boolean>} true se inject eseguito con successo
     */
    function tonyQuickHoursRecoveryAfterCfReply(commandToExecute, userMessagePlain) {
        return new Promise(function(resolve) {
            try {
                var qhWin = tonyResolveQuickHoursWindow();
                if (!qhWin) {
                    resolve(false);
                    return;
                }
                var doc = qhWin.document;
                var st = doc.getElementById('ora-start');
                var en = doc.getElementById('ora-end');
                var recentUb = tonyBuildSegnaOraUserBlobLastNUserTurns(6, userMessagePlain || '');
                var curMsg = String(userMessagePlain || '').trim();
                if (tonyIsCampoLikeWorkspaceForTony()) {
                    var curRange = !!tonyMatchSegnaOraTimeRangeFromBlob(curMsg);
                    var curPause = /^\s*(\d{1,3})\s*$/.test(curMsg) ||
                        (tonyExtractPauseMinutesFromUserBlob(curMsg) != null && !curRange);
                    if (!curRange && !curPause) {
                        resolve(false);
                        return;
                    }
                }
                var hasTimeRange = !!tonyMatchSegnaOraTimeRangeFromBlob(curMsg) ||
                    !!tonyMatchSegnaOraTimeRangeFromBlob(recentUb);
                if (st && en && String(st.value || '').trim() && String(en.value || '').trim()) {
                    if (!tonyQuickHoursPauseInjectNeeded(recentUb, doc)) {
                        resolve(false);
                        return;
                    }
                } else if (!hasTimeRange) {
                    resolve(false);
                    return;
                }
                var fieldLike = false;
                try {
                    if (window.currentTableData && window.currentTableData.pageType === 'field_workspace') fieldLike = true;
                    if (!fieldLike && window.parent && window.parent !== window && window.parent.currentTableData && window.parent.currentTableData.pageType === 'field_workspace') fieldLike = true;
                } catch (e0) { /* ignore */ }
                var pathL = (window.location.pathname || '').toLowerCase();
                if (!fieldLike && pathL.indexOf('field-workspace-standalone') >= 0) fieldLike = true;
                try {
                    if (!fieldLike && window.parent && window.parent !== window && String(window.parent.location.pathname || '').toLowerCase().indexOf('field-workspace-standalone') >= 0) fieldLike = true;
                } catch (e0b) { /* ignore */ }
                if (!fieldLike && qhWin && tonyIsCampoLikeWorkspaceForTony()) fieldLike = true;
                if (!fieldLike) {
                    resolve(false);
                    return;
                }
                var ctype = commandToExecute && commandToExecute.type ? String(commandToExecute.type).toUpperCase() : '';
                if (ctype === 'INJECT' || ctype === 'INJECT_FORM_DATA') {
                    var fid = commandToExecute.formId || commandToExecute.target || '';
                    if (fid === 'field-workspace-ore-form' || fid === 'ora-form' ||
                        String(fid).toLowerCase() === 'quick-hours-form') {
                        resolve(false);
                        return;
                    }
                }
                if (ctype === 'APRI_PAGINA' || ctype === 'APRI_MODULO') {
                    var tgt = (commandToExecute.params && commandToExecute.params.target) || commandToExecute.target || commandToExecute.modulo || '';
                    if (String(tgt).toLowerCase().indexOf('segnatura') >= 0 || String(tgt).toLowerCase().indexOf('segnare') >= 0) {
                        resolve(false);
                        return;
                    }
                }
                Promise.resolve(tonyRecoverSegnaOraFromChatHistory({ userText: userMessagePlain, maxTurns: 2 })).then(function(ok) {
                    if (ok) console.log('[Tony] Fallback post-CF: ore compilate sul workspace (risposta senza inject affidabile).');
                    resolve(!!ok);
                }).catch(function() {
                    resolve(false);
                });
            } catch (eR) {
                resolve(false);
            }
        });
    }

    /**
     * Dopo una risposta CF senza INJECT affidabile (o testo-only): se l'utente parla di ore e il form inline è incompleto,
     * avvia il timer proattivo domande/salva — altrimenti senza inject il timer post-inject non partiva mai.
     */
    function tonyMaybeScheduleQuickHoursInterviewAfterCfReply(commandToExecute, userMessagePlain, opts, cfSpeech) {
        try {
            if (opts && opts.proactive) return;
            if (!tonyResolveQuickHoursWindow()) return;
            if (!tonyIsCampoLikeWorkspaceForTony()) return;
            var ctype = commandToExecute && commandToExecute.type ? String(commandToExecute.type).toUpperCase() : '';
            if (ctype === 'INJECT' || ctype === 'INJECT_FORM_DATA') {
                var fid = commandToExecute.formId || commandToExecute.target || '';
                if (fid === 'field-workspace-ore-form' || fid === 'ora-form' ||
                    String(fid).toLowerCase() === 'quick-hours-form') return;
            }
            if (ctype === 'QUICK_SAVE' || ctype === 'SUBMIT' || ctype === 'SUBMIT_FORM' || ctype === 'SALVA' || ctype === 'SAVE') return;
            var speech = cfSpeech || window.__tonyLastCfAssistantText || '';
            if (tonyCfSpeechCoversQuickHoursInterview(speech)) return;
            if (quickHoursFormReadyForTonySave()) return;
            var userBlob = String(tonyBuildSegnaOraUserBlobLastNUserTurns(6) || '').trim();
            if (!userBlob || !tonyUserMessageSuggestsSegnaOre(userBlob)) return;
            var schedWin = tonyResolveQuickHoursProactiveScheduleWindow();
            if (!schedWin) return;
            if (typeof schedWin.__tonyScheduleQuickHoursProactiveAfterUserTurn === 'function') {
                schedWin.__tonyScheduleQuickHoursProactiveAfterUserTurn();
            } else if (typeof schedWin.__tonyScheduleQuickHoursProactiveAfterInject === 'function') {
                schedWin.__tonyScheduleQuickHoursProactiveAfterInject();
            }
        } catch (eR) { /* ignore */ }
    }

    /**
     * Finestra su cui gira il widget Tony con handler proattivo quick-hours (preferisci il documento che contiene #quick-hours-form).
     * Così da iframe lavori-caposquadra il timer e sendMessage proattivo usano il parent field-workspace.
     */
    function tonyResolveQuickHoursProactiveScheduleWindow() {
        var qh = tonyResolveQuickHoursWindow();
        try {
            if (qh && typeof qh.__tonyScheduleQuickHoursProactiveAfterInject === 'function') {
                return qh;
            }
        } catch (eQ) { /* cross-origin */ }
        if (typeof window.__tonyScheduleQuickHoursProactiveAfterInject === 'function') return window;
        try {
            if (window.parent && window.parent !== window && typeof window.parent.__tonyScheduleQuickHoursProactiveAfterInject === 'function') {
                return window.parent;
            }
        } catch (eP) { /* cross-origin */ }
        return null;
    }

    /** Dopo inject su #quick-hours-form: timer proattivo (campi mancanti vs conferma salvataggio), se il widget ha già inizializzato il blocco invio. */
    function tonyPromptSaveAfterQuickHoursInject() {
        try {
            if (quickHoursFormReadyForTonySave()) {
                if (window.__tonyQuickHoursCfAskedSaveAt &&
                    (Date.now() - window.__tonyQuickHoursCfAskedSaveAt) < 15000) {
                    return;
                }
            } else {
                var fcPause = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                var intPause = (fcPause && fcPause.interviewEmpty) ? fcPause.interviewEmpty : [];
                if (intPause.length === 1 && intPause[0] === 'ora-break' &&
                    window.__tonyQuickHoursCfAskedPauseAt &&
                    (Date.now() - window.__tonyQuickHoursCfAskedPauseAt) < 15000) {
                    return;
                }
            }
            var schedWin = tonyResolveQuickHoursProactiveScheduleWindow();
            if (schedWin && typeof schedWin.__tonyScheduleQuickHoursProactiveAfterInject === 'function') {
                schedWin.__tonyScheduleQuickHoursProactiveAfterInject();
                return;
            }
            if (typeof showMessageInChat !== 'function') return;
            setTimeout(function() {
                showMessageInChat('Ho impostato data e orari nel form. Vuoi salvare? Scrivi «sì» o «salva».', 'tony');
            }, 200);
        } catch (eP) { /* ignore */ }
    }

    /**
     * Se la CF emette ancora complete_task (non gestito), prova a compilare #quick-hours-form
     * estraendo "dalle X alle Y" e pausa dalla cronologia chat.
     * @param {{ skipSavePrompt?: boolean }} [opts] — se skipSavePrompt, non mostrare la richiesta salva (es. ramo SALVA che fa submit subito).
     */
    function tonyRecoverSegnaOraFromChatHistory(opts) {
        opts = opts || {};
        try {
            var qhWin = tonyResolveQuickHoursWindow();
            if (!qhWin) return Promise.resolve(false);
            var userText = opts.userText != null ? String(opts.userText).trim() : '';
            var maxTurns = typeof opts.maxTurns === 'number' ? opts.maxTurns : (userText ? 2 : 6);
            var userTurns = tonyGetSegnaOraUserTurnTexts(maxTurns, userText || null);
            var recentUb = userTurns.join(' ');
            var m = userText ? tonyMatchSegnaOraTimeRangeFromBlob(userText) : null;
            if (!m) m = matchSegnaOraTimeRangeFromUserTexts(userTurns);
            if (userText && tonyUserMessageSuggestsSegnaOre(userText) &&
                !tonyMatchSegnaOraTimeRangeFromBlob(userText) &&
                !/^\s*(\d{1,3})\s*$/.test(userText) &&
                !/nessun[ao]?\s+pausa|senza\s+pausa|no\s+pausa|zero\s+pausa/i.test(userText)) {
                m = null;
            }
            var doc0 = qhWin.document;
            var st0 = doc0.getElementById('ora-start');
            var en0 = doc0.getElementById('ora-end');
            var domHasTimes = st0 && en0 && String(st0.value || '').trim() && String(en0.value || '').trim();
            var noteTxt = tonyExtractQuickHoursNoteFromUserBlob(recentUb);
            if (!m && !domHasTimes && (!noteTxt || !String(noteTxt).trim())) return Promise.resolve(false);
            var fd = {};
            if (m) {
                tonyApplySegnaOraTimeRangeMatchToFields(fd, m);
            }
            var pauseMin = tonyExtractPauseMinutesFromUserBlob(recentUb);
            if (pauseMin != null) fd['ora-pause'] = String(pauseMin);
            if (noteTxt && String(noteTxt).trim()) fd['ora-note'] = String(noteTxt).trim();
            var hasPayload = Object.keys(fd).length > 0;
            if (!hasPayload) return Promise.resolve(false);
            var guessedDate = tonyGuessOraDataIsoFromBlob(recentUb);
            if (guessedDate && (fd['ora-data'] == null || String(fd['ora-data']).trim() === '')) fd['ora-data'] = guessedDate;
            fd = tonyResolveOraLavoroForQuickHours(fd, recentUb);
            if (window.TonyFormInjector && typeof window.TonyFormInjector.injectFieldWorkspaceQuickHoursForm === 'function') {
                return Promise.resolve(window.TonyFormInjector.injectFieldWorkspaceQuickHoursForm(fd, window.Tony && window.Tony.context, { targetWindow: qhWin })).then(function (ok) {
                    if (ok) {
                        console.log('[Tony] Segna ore: compilazione da chat / ultimo messaggio utente (sessionStorage).');
                        if (!opts.skipSavePrompt) tonyPromptSaveAfterQuickHoursInject();
                    }
                    return ok;
                });
            }
        } catch (eR) { console.warn('[Tony] tonyRecoverSegnaOraFromChatHistory:', eR); }
        return Promise.resolve(false);
    }

    /**
     * Comando modello "salva" su workspace mobile: prima compila da chat, poi submit su #quick-hours-form.
     * Stesso flusso dati della segnatura desktop (ora-*), DOM diverso — niente duplicazione mapping iniettivo.
     */
    function tonySalvaQuickHoursWorkspace(opts) {
        opts = opts || {};
        var qhWin = tonyResolveQuickHoursWindow();
        if (!qhWin) return;
        var form = qhWin.document.getElementById('quick-hours-form');
        if (!form) return;
        function runSubmitAfterMs(ms) {
            setTimeout(function() {
                var doc = qhWin.document;
                var dateEl = doc.getElementById('ora-data');
                var start = doc.getElementById('ora-start');
                var end = doc.getElementById('ora-end');
                if (!dateEl || !start || !end ||
                    !String(dateEl.value || '').trim() ||
                    !String(start.value || '').trim() ||
                    !String(end.value || '').trim()) {
                    if (typeof showMessageInChat === 'function') {
                        showMessageInChat('Indica data, orario inizio e fine (es. «dalle 7 alle 18») così compilo e salvo.', 'error');
                    }
                    return;
                }
                var brEl = doc.getElementById('ora-break');
                var brNum = 0;
                if (brEl && String(brEl.value || '').trim() !== '') {
                    var bp = parseInt(String(brEl.value).trim(), 10);
                    brNum = Number.isFinite(bp) ? bp : 0;
                }
                if (brNum === 0 && !tonyQuickHoursUserAcknowledgedPause(tonyBuildSegnaOraUserBlobLastNUserTurns(6))) {
                    if (typeof showMessageInChat === 'function') {
                        showMessageInChat('Prima di salvare indica i minuti di pausa (es. «30») oppure scrivi «nessuna pausa».', 'tony');
                    }
                    return;
                }
                try {
                    form.requestSubmit();
                    console.log('[Tony] SALVA: submit su quick-hours-form');
                } catch (eSub) {
                    var btn = form.querySelector('button[type="submit"]');
                    if (btn) btn.click();
                }
                setTimeout(function () {
                    var statusEl = doc.getElementById('hours-save-status');
                    var statusTxt = statusEl ? String(statusEl.textContent || '').trim() : '';
                    if (/^Ore salvate:/i.test(statusTxt)) {
                        if (typeof showMessageInChat === 'function') {
                            showMessageInChat(statusTxt, 'tony');
                        }
                        try {
                            window.__tonyQuickHoursPauseAckAt = 0;
                            window.__tonySegnaOraLocalInterviewAt = 0;
                        } catch (eReset) { /* ignore */ }
                    } else if (/^Errore salvataggio:/i.test(statusTxt) && typeof showMessageInChat === 'function') {
                        showMessageInChat(statusTxt, 'error');
                    }
                }, 1200);
            }, ms);
        }
        if (opts.skipRecover) {
            /** Salva rapido («sì»): recovery saltata ma le note vanno comunque dal testo utente precedente. */
            var delayMs = typeof opts.submitDelayMs === 'number' ? opts.submitDelayMs : 80;
            var ub = tonyBuildSegnaOraUserBlobLastNUserTurns(6);
            var noteOnly = tonyExtractQuickHoursNoteFromUserBlob(ub);
            if (noteOnly && window.TonyFormInjector && typeof window.TonyFormInjector.injectFieldWorkspaceQuickHoursForm === 'function') {
                Promise.resolve(window.TonyFormInjector.injectFieldWorkspaceQuickHoursForm(
                    { 'ora-note': noteOnly },
                    window.Tony && window.Tony.context,
                    { targetWindow: qhWin }
                )).then(function() {
                    runSubmitAfterMs(delayMs);
                }).catch(function() {
                    runSubmitAfterMs(delayMs);
                });
            } else {
                runSubmitAfterMs(delayMs);
            }
            return;
        }
        Promise.resolve(tonyRecoverSegnaOraFromChatHistory({ skipSavePrompt: true })).then(function() {
            runSubmitAfterMs(550);
        });
    }

    function getTonyCommandPriority(command) {
        var type = command && command.type ? String(command.type).toUpperCase() : '';
        if (type === 'OPEN_MODAL') return 10;
        if (type === '_WAIT_MODAL_READY') return 15;
        if (type === 'INJECT_FORM_DATA') return 18;
        if (type === 'SET_FIELD' || type === 'SET_VALUE' || type === 'QUICK_FORM_FILL') return 20;
        if (type === 'CLICK_BUTTON' || type === 'SAVE_ACTIVITY' || type === 'SALVA' || type === 'SAVE' || type === 'SUBMIT_FORM' || type === 'QUICK_SAVE') return 30;
        return 40;
    }

    function getTonyQueueDelayByType(command) {
        var type = command && command.type ? String(command.type).toUpperCase() : '';
        if (type === 'OPEN_MODAL') return 700;
        if (type === 'INJECT_FORM_DATA') return 400;
        if (type === 'SET_FIELD' || type === 'SET_VALUE' || type === 'QUICK_FORM_FILL') return 350;
        if (type === 'CLICK_BUTTON' || type === 'SAVE_ACTIVITY') return 300;
        return 120;
    }

    function drainTonyCommandQueue() {
        if (_isProcessingTonyCommand) return;
        if (_tonyCommandQueue.length === 0) return;

        _isProcessingTonyCommand = true;
        var queued = _tonyCommandQueue.shift();
        var command = queued.command;
        var delay = typeof queued.delayMs === 'number' ? queued.delayMs : getTonyQueueDelayByType(command);
        var source = queued.source || 'unknown';

        setTimeout(function() {
            try {
                console.log('[Tony Queue] Eseguo comando da coda:', source, command && command.type ? command.type : 'UNKNOWN');
                processTonyCommand(command);
            } finally {
                _isProcessingTonyCommand = false;
                drainTonyCommandQueue();
            }
        }, Math.max(0, delay));
    }

    function enqueueTonyCommand(command, options) {
        command = normalizeTonyCommand(command);
        if (!command || !command.type) return;
        options = options || {};

        var entry = {
            command: command,
            source: options.source || 'unknown',
            delayMs: options.delayMs,
            priority: getTonyCommandPriority(command)
        };

        // Evita duplicati consecutivi identici (tipico caso di parse ridondante).
        var lastEntry = _tonyCommandQueue.length ? _tonyCommandQueue[_tonyCommandQueue.length - 1] : null;
        if (lastEntry && JSON.stringify(lastEntry.command) === JSON.stringify(command)) {
            return;
        }

        _tonyCommandQueue.push(entry);
        _tonyCommandQueue.sort(function(a, b) { return a.priority - b.priority; });
        drainTonyCommandQueue();
    }

    function isSmartFillerEligibleField(fieldId) {
        if (!fieldId) return false;
        return fieldId.indexOf('attivita-') === 0 ||
               fieldId.indexOf('ora-') === 0 ||
               fieldId.indexOf('lavoro-') === 0;
    }

    /** Mappa ID alternativi → ID corretti (es. modal-attivita → attivita-modal) */
    var MODAL_ID_FALLBACK = {
        'modal-attivita': 'attivita-modal',
        'attivita': 'attivita-modal',
        'diario': 'attivita-modal',
        'modulo-ore': 'attivita-modal',
        'modulo_ore': 'attivita-modal',
        'ore': 'attivita-modal',
        'modal-ora': 'ora-modal',
        'ora': 'ora-modal',
        'modal-lavoro': 'lavoro-modal',
        'lavoro': 'lavoro-modal'
    };

    /**
     * True se l'oggetto fields/formData ha chiavi tipiche del Nuovo Preventivo, non del diario attività / modal Gestione Lavori.
     * Nota: il preventivo usa anche lavoro-categoria-principale / lavoro-sottocategoria — non vanno contati come modal lavoro.
     */
    function tonyPayloadLooksLikePreventivoFormData(obj) {
        if (!obj || typeof obj !== 'object') return false;
        var keys = Object.keys(obj);
        if (!keys.length) return false;
        var prevHints = ['tipo-lavoro', 'terreno-id', 'cliente-id', 'coltura-categoria', 'coltura', 'tipo-campo', 'superficie', 'lavoro-categoria-principale', 'lavoro-sottocategoria', 'iva', 'giorni-scadenza', 'data-prevista', 'note'];
        var looks = keys.some(function (k) { return prevHints.indexOf(k) >= 0; });
        var hasAttivita = keys.some(function (k) { return k.indexOf('attivita-') === 0; });
        var preventivoLavoroKeys = { 'lavoro-categoria-principale': 1, 'lavoro-sottocategoria': 1 };
        var hasLavoroModal = keys.some(function (k) {
            if (k === 'tipo-assegnazione') return true;
            if (k.indexOf('lavoro-') !== 0) return false;
            return !preventivoLavoroKeys[k];
        });
        return looks && !hasAttivita && !hasLavoroModal;
    }

    /** Ultimo messaggio utente in Tony.chatHistory (persiste finché non si ricarica senza restore). */
    function tonyGetLastUserMessageText() {
        var hist = (window.Tony && window.Tony.chatHistory) ? window.Tony.chatHistory : [];
        for (var i = hist.length - 1; i >= 0; i--) {
            var entry = hist[i];
            if (!entry || entry.role !== 'user' || !entry.parts || !entry.parts.length) continue;
            var p = entry.parts[0];
            var text = String((p && p.text) != null ? p.text : '');
            if (text.trim()) return text.trim();
        }
        return '';
    }

    /** Prompt utente per pending dopo navigazione: chatHistory può non essere ancora aggiornata al click «Apri pagina» (triggerAction prima di _pushChatTurn nel service). */
    function tonyGetUserPromptForPendingNav() {
        var fromHist = tonyGetLastUserMessageText();
        if (fromHist) return fromHist;
        return tonyGetLastUserMessage();
    }

    /**
     * Ultimo turno utente in chatHistory: intento Nuovo Preventivo (il modello a volte emette OPEN_MODAL lavoro/attività senza fields).
     * Evitare match su sole parole tipo "trinciatura" (gestione lavori) — richiedere lessico preventivo esplicito.
     */
    function tonyLastUserMessageSuggestsPreventivo() {
        var text = tonyGetLastUserMessageText();
        if (!text) return false;
        var low = text.toLowerCase();
        if (/\bpreventiv[a-z]*\b/i.test(text)) return true;
        if (/nuovo\s+preventivo/i.test(low)) return true;
        if (/conto\s+terzi/i.test(low)) return true;
        if (/\b(fare|creare|aprire|serve)\s+(un\s+)?preventivo\b/i.test(low)) return true;
        return false;
    }

    function tonyOpenModalShouldRouteToPreventivo(dataFields) {
        return tonyPayloadLooksLikePreventivoFormData(dataFields) || tonyLastUserMessageSuggestsPreventivo();
    }

    var PREVENTIVO_LAVORAZIONE_FIELD_IDS = ['tipo-lavoro', 'lavoro-categoria-principale', 'lavoro-sottocategoria'];

    /** True se #tipo-lavoro non ha ancora un valore reale (placeholder o option vuota). */
    function tonyIsPreventivoTipoLavoroUnset(tipoEl) {
        if (!tipoEl || !tipoEl.options || tipoEl.selectedIndex < 0) return true;
        var opt = tipoEl.options[tipoEl.selectedIndex];
        if (!opt) return true;
        var val = String(opt.value != null ? opt.value : '').trim();
        if (!val) return true;
        var txt = String(opt.text || '').trim();
        if (/^--/.test(txt)) return true;
        if (/seleziona\s+tipo\s*lavoro/i.test(txt)) return true;
        return false;
    }

    /**
     * La CF può emettere un secondo INJECT_FORM_DATA che sovrascrive categoria/sottocategoria/tipo-lavoro
     * con valori incoerenti rispetto al primo inject (es. Diserbo al posto di Trinciatura), lasciando
     * la sottocategoria vuota e rompendo validazione/salvataggio. Se il DOM ha già un tipo-lavoro
     * selezionato e il payload propone un'altra lavorazione, ignoriamo le chiavi gerarchiche.
     * Opzionale: formData._tonyAllowLavorazioneOverride per forzare l'override.
     */
    function tonyStripConflictingPreventivoLavorazione(formData) {
        if (!formData || typeof formData !== 'object') return formData;
        if (formData._tonyAllowLavorazioneOverride) return formData;
        var tipoEl = document.getElementById('tipo-lavoro');
        if (tonyIsPreventivoTipoLavoroUnset(tipoEl)) return formData;
        var curText = '';
        if (tipoEl && tipoEl.options && tipoEl.selectedIndex >= 0) {
            var opt = tipoEl.options[tipoEl.selectedIndex];
            curText = String((opt && (opt.text || opt.value)) || '').trim();
        }
        function normTipo(s) {
            return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
        }
        function tipoLavoroCompatibile(domText, incoming) {
            var a = normTipo(domText);
            var b = normTipo(incoming);
            if (!a || !b) return false;
            if (a === b) return true;
            if (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return true;
            return false;
        }
        function tipoLavoroIncomingMoreSpecific(domText, incoming) {
            var a = normTipo(domText);
            var b = normTipo(incoming);
            if (!a || !b || a === b) return false;
            if (b.length > a.length + 2 && (b.indexOf(a) >= 0 || a.indexOf(b) >= 0)) return true;
            return false;
        }
        function preventivoSubIncomingDowngradesDom(domSubText, incomingSub) {
            var ds = normTipo(domSubText);
            var inc = normTipo(incomingSub);
            if (!ds || !inc || ds === inc) return false;
            if (ds === 'tra le file' && inc === 'generale') return true;
            if (ds === 'sulla fila' && inc === 'generale') return true;
            return false;
        }
        var hasHierarchyPayload = PREVENTIVO_LAVORAZIONE_FIELD_IDS.some(function (k) {
            return formData[k] != null && String(formData[k]).trim() !== '';
        });
        if (!hasHierarchyPayload) return formData;
        if (!curText) return formData;
        var incTipo = formData['tipo-lavoro'] != null ? String(formData['tipo-lavoro']).trim() : '';
        var conflict = false;
        if (incTipo) {
            if (tipoLavoroIncomingMoreSpecific(curText, incTipo)) {
                return formData;
            }
            if (!tipoLavoroCompatibile(curText, incTipo)) conflict = true;
        } else {
            var incSubOnly = String(formData['lavoro-sottocategoria'] || '').trim();
            if (incSubOnly && !formData['lavoro-categoria-principale']) {
                return formData;
            }
            conflict = !!(formData['lavoro-categoria-principale'] || formData['lavoro-sottocategoria']);
        }
        if (!conflict) return formData;
        if (incTipo && tipoLavoroCompatibile(curText, incTipo) && formData['lavoro-sottocategoria']) {
            var subEl = document.getElementById('lavoro-sottocategoria');
            var curSubText = '';
            if (subEl && subEl.options && subEl.selectedIndex >= 0) {
                var subOpt = subEl.options[subEl.selectedIndex];
                curSubText = String((subOpt && (subOpt.text || subOpt.value)) || '').trim();
            }
            var outPartial = Object.assign({}, formData);
            delete outPartial['tipo-lavoro'];
            delete outPartial['lavoro-categoria-principale'];
            if (preventivoSubIncomingDowngradesDom(curSubText, formData['lavoro-sottocategoria'])) {
                delete outPartial['lavoro-sottocategoria'];
                console.log('[Tony] Preventivo: ignorata sottocategoria downgrade (DOM già: "' + curSubText + '")');
            }
            return outPartial;
        }
        var out = Object.assign({}, formData);
        PREVENTIVO_LAVORAZIONE_FIELD_IDS.forEach(function (k) { delete out[k]; });
        console.log('[Tony] Preventivo: ignorata sovrascrittura lavorazione (DOM già: "' + curText + '")');
        return out;
    }

    /** Mappa nomi campo alternativi → ID reali nel DOM (attivita-standalone.html) */
    var FIELD_ID_FALLBACK = {
        'terreno': 'attivita-terreno',
        'id_terreno': 'attivita-terreno',
        'data': 'attivita-data',
        'inizio': 'attivita-orario-inizio',
        'ora_inizio': 'attivita-orario-inizio',
        'orario_inizio': 'attivita-orario-inizio',
        'fine': 'attivita-orario-fine',
        'ora_fine': 'attivita-orario-fine',
        'orario_fine': 'attivita-orario-fine',
        'lavoro': 'attivita-tipo-lavoro',
        'tipo_lavoro': 'attivita-tipo-lavoro',
        'tipo lavoro': 'attivita-tipo-lavoro',
        'pause': 'attivita-pause',
        'note': 'attivita-note',
        'coltura': 'attivita-coltura'
    };

    /**
     * Helper: Gestisce la deduzione automatica di categoria e sottocategoria quando viene impostato il tipo lavoro.
     * Implementa il flusso bottom-up: tipo lavoro → categoria automatica → preselezione sottocategoria.
     * @param {string} tipoLavoroValue - Valore (ID) del tipo lavoro selezionato
     * @param {string} tipoLavoroText - Testo del tipo lavoro selezionato
     */
    function handleSmartTipoLavoroSet(tipoLavoroValue, tipoLavoroText) {
        console.log('[Tony Smart SET_FIELD] Deduzione automatica per tipo lavoro:', tipoLavoroValue, tipoLavoroText);
        
        // Verifica se SmartFormFiller è disponibile (caricato dinamicamente)
        if (window.SmartFormFiller) {
             const filler = new SmartFormFiller();
             const context = window.Tony ? window.Tony.context : {};
             
             // Il filler si occupa ora di TUTTO: Categoria -> Tipo Lavoro -> Sottocategoria
             // Non serve più chiamare handleSmartSottocategoriaSet manualmente qui
             filler.fillField('attivita-tipo-lavoro-gerarchico', tipoLavoroValue, context).then(() => {
                 console.log('[Tony Smart SET_FIELD] Filler completato per:', tipoLavoroValue);
             });
             return;
        }

        // --- FALLBACK: VECCHIA LOGICA (se SmartFormFiller non è caricato) ---
        
        // Cerca il tipo lavoro nei dati disponibili
        var tipoLavoroObj = null;
        
        // Prova 1: Cerca in window.attivitaState (se disponibile)
        if (window.attivitaState && window.attivitaState.tipiLavoroList) {
            tipoLavoroObj = window.attivitaState.tipiLavoroList.find(function(t) {
                return t.id === tipoLavoroValue || t.nome === tipoLavoroText || 
                       (tipoLavoroText && t.nome && t.nome.toLowerCase() === tipoLavoroText.toLowerCase());
            });
        }
        
        // Prova 2: Cerca nel context di Tony (se disponibile)
        if (!tipoLavoroObj && window.Tony && window.Tony.context && window.Tony.context.attivita) {
            var tipiLavoro = window.Tony.context.attivita.tipi_lavoro || [];
            tipoLavoroObj = tipiLavoro.find(function(t) {
                return t.id === tipoLavoroValue || t.nome === tipoLavoroText ||
                       (tipoLavoroText && t.nome && t.nome.toLowerCase() === tipoLavoroText.toLowerCase());
            });
        }
        
        // MAPPAZIONE INVERSA INTEGRATA: Se non trovato per ID/nome, cerca per testo parziale
        if (!tipoLavoroObj && tipoLavoroText) {
            var searchText = tipoLavoroText.toLowerCase();
            if (window.attivitaState && window.attivitaState.tipiLavoroList) {
                tipoLavoroObj = window.attivitaState.tipiLavoroList.find(function(t) {
                    return t.nome && t.nome.toLowerCase().indexOf(searchText) !== -1;
                });
            }
            if (!tipoLavoroObj && window.Tony && window.Tony.context && window.Tony.context.attivita) {
                var tipiLavoro = window.Tony.context.attivita.tipi_lavoro || [];
                tipoLavoroObj = tipiLavoro.find(function(t) {
                    return t.nome && t.nome.toLowerCase().indexOf(searchText) !== -1;
                });
            }
        }
        
        if (!tipoLavoroObj) {
            console.warn('[Tony Smart SET_FIELD] Tipo lavoro non trovato nei dati disponibili');
            return;
        }
        
        console.log('[Tony Smart SET_FIELD] Tipo lavoro trovato:', tipoLavoroObj);
        
        // Deduzione categoria principale
        var categoriaId = tipoLavoroObj.categoriaId;
        if (categoriaId) {
            var categoriaSelect = document.getElementById('attivita-categoria-principale');
            if (categoriaSelect) {
                // MAPPAZIONE INVERSA: Verifica se la categoria è una sottocategoria (ha parentId)
                // Se è una sottocategoria, trova la categoria principale
                var categoriaFound = false;
                if (window.attivitaState && window.attivitaState.sottocategorieLavoriMap) {
                    var sottocatMap = window.attivitaState.sottocategorieLavoriMap;
                    for (var parentId in sottocatMap) {
                        if (sottocatMap[parentId].some(function(sc) { return sc.id === categoriaId; })) {
                            categoriaId = parentId;
                            categoriaFound = true;
                            console.log('[Tony Smart SET_FIELD] Categoria trovata come sottocategoria, uso parent:', categoriaId);
                            break;
                        }
                    }
                }
                
                // MAPPAZIONE INVERSA: Se categoriaId non corrisponde a nessuna opzione, cerca per nome categoria
                var categoriaOpt = Array.from(categoriaSelect.options).find(function(o) {
                    return o.value === categoriaId;
                });
                
                if (!categoriaOpt && window.Tony && window.Tony.context && window.Tony.context.attivita) {
                    // Cerca la categoria per nome nel context
                    var categorie = window.Tony.context.attivita.categorie_lavoro || [];
                    var categoriaObj = categorie.find(function(c) {
                        return c.id === categoriaId;
                    });
                    
                    if (categoriaObj) {
                        // Cerca l'opzione nel dropdown per nome
                        categoriaOpt = Array.from(categoriaSelect.options).find(function(o) {
                            return o.text && o.text.toLowerCase() === categoriaObj.nome.toLowerCase();
                        });
                        if (categoriaOpt) {
                            categoriaId = categoriaOpt.value;
                            console.log('[Tony Smart SET_FIELD] Mappatura inversa categoria: trovato per nome, uso ID:', categoriaId);
                        }
                    }
                }
                
                // Imposta categoria principale
                var categoriaOpt = Array.from(categoriaSelect.options).find(function(o) {
                    return o.value === categoriaId;
                });
                if (categoriaOpt) {
                    categoriaSelect.value = categoriaId;
                    
                    // TRIGGER DELLA CASCATA: Scatena tutti gli eventi per attivare la logica gerarchica
                    categoriaSelect.dispatchEvent(new Event('input', { bubbles: true }));
                    categoriaSelect.dispatchEvent(new Event('change', { bubbles: true }));
                    if (window.jQuery || window.$) {
                        var $cat = (window.jQuery || window.$)(categoriaSelect);
                        $cat.trigger('change');
                        console.log('[Tony Smart SET_FIELD] Trigger jQuery change per categoria');
                    }
                    console.log('[Tony Smart SET_FIELD] Categoria principale impostata con trigger cascata:', categoriaId);
                    
                    // MONITORAGGIO CASCATA: Attendi che il dropdown tipo-lavoro-gerarchico si popoli
                    var tipoLavoroSelect = document.getElementById('attivita-tipo-lavoro-gerarchico');
                    if (tipoLavoroSelect) {
                        var initialOptionsCount = tipoLavoroSelect.options.length;
                        console.log('[Tony Smart SET_FIELD] Opzioni tipo lavoro iniziali:', initialOptionsCount);
                        
                        // Monitora fino a quando il dropdown non si popola (da 1 opzione a molte)
                        var checkInterval = setInterval(function() {
                            var currentOptionsCount = tipoLavoroSelect.options.length;
                            if (currentOptionsCount > initialOptionsCount) {
                                clearInterval(checkInterval);
                                console.log('[Tony Smart SET_FIELD] Dropdown tipo lavoro popolato! Opzioni:', currentOptionsCount);
                                
                                // Ora procedi con sottocategoria e tipo lavoro
                                setTimeout(function() {
                                    handleSmartSottocategoriaSet(tipoLavoroObj, categoriaId, tipoLavoroValue);
                                }, 200);
                            }
                        }, 100);
                        
                        // Timeout di sicurezza: dopo 2 secondi procedi comunque
                        setTimeout(function() {
                            clearInterval(checkInterval);
                            console.warn('[Tony Smart SET_FIELD] Timeout monitoraggio cascata, procedo comunque');
                            handleSmartSottocategoriaSet(tipoLavoroObj, categoriaId, tipoLavoroValue);
                        }, 2000);
                    } else {
                        // Fallback: se il dropdown non esiste ancora, aspetta e riprova
                        setTimeout(function() {
                            handleSmartSottocategoriaSet(tipoLavoroObj, categoriaId, tipoLavoroValue);
                        }, 400);
                    }
                } else {
                    console.warn('[Tony Smart SET_FIELD] Categoria principale non trovata nel dropdown:', categoriaId);
                }
            }
        } else {
            console.warn('[Tony Smart SET_FIELD] Tipo lavoro non ha categoriaId');
        }
    }
    
    /**
     * Helper: Gestisce la preselezione della sottocategoria basata sul tipo lavoro e terreno.
     * @param {Object} tipoLavoroObj - Oggetto tipo lavoro con categoriaId e sottocategoriaId
     * @param {string} categoriaPrincipaleId - ID categoria principale
     * @param {string} tipoLavoroValue - Valore (ID) del tipo lavoro da ri-impostare dopo la sincronizzazione
     */
    function handleSmartSottocategoriaSet(tipoLavoroObj, categoriaPrincipaleId, tipoLavoroValue) {
        var sottocategoriaSelect = document.getElementById('attivita-sottocategoria');
        if (!sottocategoriaSelect || sottocategoriaSelect.style.display === 'none') {
            console.log('[Tony Smart SET_FIELD] Sottocategoria non visibile o non disponibile');
            return;
        }
        
        var sottocategoriaId = null;
        
        // Priorità 1: Se il tipo lavoro ha già una sottocategoriaId predefinita, usala
        if (tipoLavoroObj.sottocategoriaId) {
            sottocategoriaId = tipoLavoroObj.sottocategoriaId;
            console.log('[Tony Smart SET_FIELD] Usando sottocategoriaId predefinita:', sottocategoriaId);
        } else {
            // Priorità 2: Preselezione basata sul terreno
            var terrenoSelect = document.getElementById('attivita-terreno');
            var terrenoId = terrenoSelect ? terrenoSelect.value : null;
            
            if (terrenoId) {
                // Cerca il terreno nei dati disponibili
                var terreno = null;
                if (window.attivitaState && window.attivitaState.terreniList) {
                    terreno = window.attivitaState.terreniList.find(function(t) { return t.id === terrenoId; });
                } else if (window.Tony && window.Tony.context && window.Tony.context.attivita) {
                    var terreni = window.Tony.context.attivita.terreni || [];
                    terreno = terreni.find(function(t) { return t.id === terrenoId; });
                }
                
                if (terreno && terreno.coltura) {
                    var coltura = terreno.coltura.toLowerCase();
                    var tipoLavoroNome = (tipoLavoroObj.nome || '').toLowerCase();
                    
                    // Preselezione per Vite/Frutteto → "Tra le File"
                    if ((coltura === 'vite' || coltura === 'frutteto')) {
                        var lavoriTraLeFile = ['erpicatura', 'trinciatura', 'fresatura', 'ripasso'];
                        if (lavoriTraLeFile.some(function(l) { return tipoLavoroNome.indexOf(l) !== -1; })) {
                            // Cerca ID "Tra le File" nel dropdown
                            var traLeFileOpt = Array.from(sottocategoriaSelect.options).find(function(o) {
                                return o.text && o.text.toLowerCase().indexOf('tra le file') !== -1;
                            });
                            if (traLeFileOpt) {
                                sottocategoriaId = traLeFileOpt.value;
                                console.log('[Tony Smart SET_FIELD] Preselezione "Tra le File" per terreno Vite/Frutteto');
                            }
                        }
                    }
                    
                    // Preselezione per Seminativo → "Generale"
                    if (!sottocategoriaId && coltura === 'seminativo') {
                        var generaleOpt = Array.from(sottocategoriaSelect.options).find(function(o) {
                            return o.text && o.text.toLowerCase().indexOf('generale') !== -1;
                        });
                        if (generaleOpt) {
                            sottocategoriaId = generaleOpt.value;
                            console.log('[Tony Smart SET_FIELD] Preselezione "Generale" per terreno Seminativo');
                        }
                    }
                }
            }
        }
        
        // Imposta sottocategoria se trovata
        if (sottocategoriaId) {
            var sottocatOpt = Array.from(sottocategoriaSelect.options).find(function(o) {
                return o.value === sottocategoriaId;
            });
            if (sottocatOpt) {
                sottocategoriaSelect.value = sottocategoriaId;
                
                // TRIGGER DELLA CASCATA: Scatena tutti gli eventi per attivare la logica gerarchica
                sottocategoriaSelect.dispatchEvent(new Event('input', { bubbles: true }));
                sottocategoriaSelect.dispatchEvent(new Event('change', { bubbles: true }));
                if (window.jQuery || window.$) {
                    var $subcat = (window.jQuery || window.$)(sottocategoriaSelect);
                    $subcat.trigger('change');
                    console.log('[Tony Smart SET_FIELD] Trigger jQuery change per sottocategoria');
                }
                console.log('[Tony Smart SET_FIELD] Sottocategoria impostata con trigger cascata:', sottocategoriaId);
                
                // Attendi che il dropdown tipo lavoro si aggiorni dopo il cambio sottocategoria
                setTimeout(function() {
                    // Ri-imposta il tipo lavoro selezionato (potrebbe essere stato deselezionato dal ricaricamento dropdown)
                    if (tipoLavoroValue) {
                        var tipoLavoroSelect = document.getElementById('attivita-tipo-lavoro-gerarchico');
                        if (tipoLavoroSelect) {
                            var tipoLavoroOpt = Array.from(tipoLavoroSelect.options).find(function(o) {
                                return o.value === tipoLavoroValue;
                            });
                            if (tipoLavoroOpt) {
                                tipoLavoroSelect.value = tipoLavoroValue;
                                
                                // TRIGGER DELLA CASCATA per tipo lavoro
                                tipoLavoroSelect.dispatchEvent(new Event('input', { bubbles: true }));
                                tipoLavoroSelect.dispatchEvent(new Event('change', { bubbles: true }));
                                if (window.jQuery || window.$) {
                                    var $tl = (window.jQuery || window.$)(tipoLavoroSelect);
                                    $tl.trigger('change');
                                }
                                console.log('[Tony Smart SET_FIELD] Tipo lavoro ri-impostato dopo sincronizzazione:', tipoLavoroValue);
                            } else {
                                console.warn('[Tony Smart SET_FIELD] Tipo lavoro non più disponibile dopo cambio sottocategoria:', tipoLavoroValue);
                            }
                        }
                    }
                }, 300);
            } else {
                console.warn('[Tony Smart SET_FIELD] Sottocategoria non trovata nel dropdown:', sottocategoriaId);
            }
        } else {
            console.log('[Tony Smart SET_FIELD] Nessuna preselezione sottocategoria disponibile');
            // Anche se non c'è sottocategoria, ri-imposta il tipo lavoro dopo un breve delay
            if (tipoLavoroValue) {
                setTimeout(function() {
                    var tipoLavoroSelect = document.getElementById('attivita-tipo-lavoro-gerarchico');
                    if (tipoLavoroSelect) {
                        var tipoLavoroOpt = Array.from(tipoLavoroSelect.options).find(function(o) {
                            return o.value === tipoLavoroValue;
                        });
                        if (tipoLavoroOpt) {
                            tipoLavoroSelect.value = tipoLavoroValue;
                            
                            // TRIGGER DELLA CASCATA per tipo lavoro
                            tipoLavoroSelect.dispatchEvent(new Event('input', { bubbles: true }));
                            tipoLavoroSelect.dispatchEvent(new Event('change', { bubbles: true }));
                            if (window.jQuery || window.$) {
                                var $tl = (window.jQuery || window.$)(tipoLavoroSelect);
                                $tl.trigger('change');
                            }
                            console.log('[Tony Smart SET_FIELD] Tipo lavoro ri-impostato dopo sincronizzazione (senza sottocategoria):', tipoLavoroValue);
                        }
                    }
                }, 300);
            }
        }
    }

    /**
     * checkFormCompleteness è definita dentro if (sendBtn); processTonyCommand vive nello scope IIFE.
     * Bridge via window impostato quando il widget inizializza il blocco sendBtn.
     */
    function tonyCheckFormCompletenessSafe(formCtx) {
        if (typeof window.__tonyCheckFormCompleteness === 'function') {
            return window.__tonyCheckFormCompleteness(formCtx);
        }
        return { isComplete: false, missingFields: ['Contesto form Tony non ancora disponibile'] };
    }

    /** Normalizza testo per confronto hint terreno (nome/coltura) vs messaggio utente. Scope IIFE: usato da processTonyCommand. */
    function normTxtPreventivoTerrenoHint(str) {
        if (str == null || str === '') return '';
        try {
            return String(str).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();
        } catch (e) {
            return String(str).toLowerCase().replace(/[^a-z0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();
        }
    }

    var PREVENTIVO_TERRENO_HINT_STOP = {
        dobbiamo: 1, preventivo: 1, per: 1, con: 1, dalla: 1, del: 1, della: 1, delle: 1, degli: 1, deve: 1, devo: 1, essere: 1,
        fare: 1, fatto: 1, sono: 1, stato: 1, questa: 1, questo: 1, quale: 1, quelli: 1, anche: 1, solo: 1, tipo: 1, lavoro: 1,
        trinciare: 1, trinciatura: 1, trincia: 1, nostro: 1, nostri: 1, cliente: 1, conto: 1, terzi: 1, avere: 1, bisogno: 1,
        campo: 1, campi: 1, ecco: 1, qua: 1, qui: 1, nome: 1, indicami: 1, indicare: 1, quando: 1, dove: 1, come: 1, cosa: 1,
        signor: 1, signora: 1, luca: 1, marco: 1, paolo: 1, andrea: 1, giuseppe: 1,
        allora: 1, facciamo: 1, imposta: 1, procediamo: 1, salva: 1, bozza: 1, data: 1, prevista: 1, bene: 1, va: 1,
        oggi: 1, domani: 1, dopodomani: 1,
        lunedi: 1, martedi: 1, mercoledi: 1, giovedi: 1, venerdi: 1, sabato: 1, domenica: 1
    };

    function userMessageIsPreventivoScheduleHint(text) {
        if (!text || typeof text !== 'string') return false;
        var m = normTxtPreventivoTerrenoHint(text);
        if (!m) return false;
        var hasDay = /\b(lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica|oggi|domani|dopodomani)\b/.test(m);
        if (!hasDay) return false;
        return /\b(allora|facciamo|imposta|procediamo|ok|salva|bozza|data|prevista)\b/.test(m) ||
            m.split(/\s+/).filter(Boolean).length <= 4;
    }

    function userMessageIsShortAffirmative(text) {
        if (!text || typeof text !== 'string') return false;
        var m = normTxtPreventivoTerrenoHint(text).trim();
        if (!m || m.length > 40) return false;
        return /^(si|sì|ok|va bene|confermo|esatto|perfetto|certo)(\s|$|[,.!])/.test(m) ||
            /^(si|sì),?\s*(ok|va bene)/.test(m);
    }

    function injectPreventivoIsDateOnlyUpdate(fd) {
        if (!fd || typeof fd !== 'object') return false;
        var keys = Object.keys(fd).filter(function(k) {
            return k.indexOf('_') !== 0 && fd[k] != null && String(fd[k]).trim() !== '';
        });
        if (keys.indexOf('data-prevista') < 0) return false;
        var substantive = keys.filter(function(k) {
            return k !== 'cliente-id' && k !== 'iva' && k !== 'giorni-scadenza';
        });
        return substantive.length <= 1;
    }

    function terrenoClienteNormBlob(t) {
        if (!t || typeof t !== 'object') return '';
        return normTxtPreventivoTerrenoHint([
            t.nome, t.descrizione, t.note, t.podere,
            t.coltura, t.colturaSottocategoria, t.colturaSottoCategoria, t.colturaNome, t.nomeColtura, t.colturaCategoria
        ].join(' '));
    }

    function tokenMatchesTerrenoClienteBlob(tok, blob) {
        if (!tok || !blob) return false;
        if (blob.indexOf(tok) >= 0) return true;
        if (tok.length >= 5) {
            var pref = tok.slice(0, Math.min(6, tok.length));
            if (pref.length >= 5 && blob.indexOf(pref) >= 0) return true;
        }
        if (tok.indexOf('trebb') === 0 && /trebb/i.test(blob)) return true;
        return false;
    }

    /** Hint da campi preventivo (coltura, ecc.) + ultimo messaggio utente in chatHistory. */
    function getPreventivoTerrenoHintString(fdPrev) {
        var parts = [];
        if (fdPrev && typeof fdPrev === 'object') {
            ['coltura', 'coltura-categoria', 'lavoro-terreno'].forEach(function(k) {
                var v = fdPrev[k];
                if (v == null || v === '') return;
                var s = String(v).trim();
                if (!s) return;
                if (k === 'lavoro-terreno' && /^[a-zA-Z0-9_-]{15,}$/.test(s)) return;
                parts.push(s);
            });
            var tid = fdPrev['terreno-id'];
            if (tid != null && String(tid).trim() !== '') {
                var ts = String(tid).trim();
                if (!/^[a-zA-Z0-9_-]{15,}$/.test(ts)) parts.push(ts);
            }
        }
        var hist = (window.Tony && window.Tony.chatHistory) ? window.Tony.chatHistory : [];
        for (var i = hist.length - 1; i >= 0; i--) {
            var m = hist[i];
            if (m.role === 'user' && m.parts && m.parts[0] && m.parts[0].text) {
                var lastUserText = m.parts[0].text;
                if (!userMessageIsPreventivoScheduleHint(lastUserText) && !userMessageIsShortAffirmative(lastUserText)) {
                    parts.push(lastUserText);
                }
                break;
            }
        }
        return parts.join(' ');
    }

    /**
     * Restringe i terreni del cliente a quelli con match parziale su hint (messaggio / coltura).
     * @returns {{ listForAsk: Array, intro: string, hintTokens: string }}
     */
    function filterPreventivoTerreniForDisambiguation(listRaw, hintStr) {
        if (!listRaw || !listRaw.length) return { listForAsk: listRaw || [], intro: '', hintTokens: '' };
        var hintNorm = normTxtPreventivoTerrenoHint(hintStr);
        var toks = hintNorm.split(/\s+/).filter(function(t) {
            return t.length >= 4 && !PREVENTIVO_TERRENO_HINT_STOP[t];
        });
        var hintTokens = toks.slice(0, 4).join(', ');
        if (!toks.length) {
            return { listForAsk: listRaw, intro: '', hintTokens: '' };
        }
        var filtered = listRaw.filter(function(ter) {
            var b = terrenoClienteNormBlob(ter);
            return toks.some(function(tok) { return tokenMatchesTerrenoClienteBlob(tok, b); });
        });
        if (filtered.length >= 2) {
            return {
                listForAsk: filtered,
                intro: hintTokens ? ('Tra i terreni del cliente, questi richiamano «' + hintTokens + '»:\n') : '',
                hintTokens: hintTokens
            };
        }
        if (filtered.length === 1) {
            return {
                listForAsk: filtered,
                intro: hintTokens
                    ? ('Risulta un solo terreno compatibile con «' + hintTokens + '»:\n')
                    : 'Risulta un solo terreno compatibile con la tua richiesta:\n',
                hintTokens: hintTokens
            };
        }
        return {
            listForAsk: listRaw,
            intro: hintTokens
                ? ('Non ho trovato terreni con nome o coltura che richiamino «' + hintTokens + '»; ecco tutti i terreni del cliente:\n')
                : '',
            hintTokens: hintTokens
        };
    }

    /** Nome terreno per messaggi disambiguazione (evita coltura/ha in elenco breve). */
    function preventivoTerrenoNomeDisplay(t) {
        if (!t || typeof t !== 'object') return '';
        return String(t.nome || t.id || '').trim();
    }

    /** Una frase discorsiva adatta a chat e TTS (es. «Dobbiamo lavorare su A o B?»). */
    function buildPreventivoTerrenoChoiceQuestion(names) {
        var n = (names || []).map(function (s) { return String(s || '').trim(); }).filter(Boolean);
        if (n.length === 0) return '';
        if (n.length === 1) return 'Dobbiamo lavorare su ' + n[0] + '?';
        if (n.length === 2) return 'Dobbiamo lavorare su ' + n[0] + ' o ' + n[1] + '?';
        var last = n.pop();
        return 'Dobbiamo lavorare su ' + n.join(', ') + ' o ' + last + '?';
    }

    /**
     * Campi magazzino ancora da chiedere (da TONY_FORM_MAPPING.tonyInterviewFieldIds). Non sostituisce i required HTML per SAVE_ACTIVITY.
     */
    function tonyGetMagazzinoInterviewEmpty(formCtx, formId) {
        if (!formCtx || !formCtx.fields || !formId) return [];
        var getMap = (typeof window !== 'undefined' && window.TONY_FORM_MAPPING && window.TONY_FORM_MAPPING.getFormMap);
        var map = getMap ? window.TONY_FORM_MAPPING.getFormMap(formId) : null;
        var ids = map && map.tonyInterviewFieldIds;
        if (!ids || !ids.length) return [];
        var byId = {};
        formCtx.fields.forEach(function(f) { byId[f.id] = f; });
        if (formId === 'prodotto-form' && map.prodottoCategoriaRichiedeGiorniCarenza && map.prodottoCategoriaRichiedeGiorniCarenza.length) {
            var catF = byId['prodotto-categoria'];
            var catVal = catF && catF.value != null ? String(catF.value).trim().toLowerCase() : '';
            if (!catVal || map.prodottoCategoriaRichiedeGiorniCarenza.indexOf(catVal) < 0) {
                ids = ids.filter(function(id) { return id !== 'prodotto-giorni-carenza'; });
            }
        }
        if (formId === 'prodotto-form' && map.prodottoCategoriaRichiedeDosaggio && map.prodottoCategoriaRichiedeDosaggio.length) {
            var catD = byId['prodotto-categoria'];
            var catValD = catD && catD.value != null ? String(catD.value).trim().toLowerCase() : '';
            if (!catValD || map.prodottoCategoriaRichiedeDosaggio.indexOf(catValD) < 0) {
                ids = ids.filter(function(id) {
                    return id !== 'prodotto-dosaggio-min' && id !== 'prodotto-dosaggio-max';
                });
            }
        }
        var placeholderRe = /^(seleziona|--\s*seleziona|--\s*nessun|scegli\.\.\.|select\.\.\.)/i;
        var empty = [];
        ids.forEach(function(id) {
            var f = byId[id];
            if (!f) return;
            var v = f.value;
            var isEmpty = v == null || v === '' || String(v).trim() === '';
            var t = (f.type || '').toLowerCase();
            if (!isEmpty && (t === 'select-one' || t === 'select' || /^select/.test(t))) {
                var vl = f.valueLabel || '';
                if (vl && placeholderRe.test(String(vl).trim())) isEmpty = true;
            }
            if (isEmpty) empty.push(id);
        });
        return empty;
    }
    window.__tonyGetMagazzinoInterviewEmpty = tonyGetMagazzinoInterviewEmpty;
    window.__tonyEnrichMovimentoFormDataFromCatalog = enrichMovimentoFormDataFromCatalog;

    function tonyGetTerrenoInterviewEmpty(formCtx, formId) {
        if (!formCtx || !formCtx.fields || formId !== 'terreno-form') return [];
        var getMap = (typeof window !== 'undefined' && window.TONY_FORM_MAPPING && window.TONY_FORM_MAPPING.getFormMap);
        var map = getMap ? window.TONY_FORM_MAPPING.getFormMap(formId) : null;
        var ids = map && map.tonyInterviewFieldIds;
        if (!ids || !ids.length) return [];
        var byId = {};
        formCtx.fields.forEach(function (f) { byId[f.id] = f; });
        var placeholderRe = /^(seleziona|--\s*seleziona|--\s*nessun|scegli\.\.\.|select\.\.\.)/i;
        var empty = [];
        ids.forEach(function (id) {
            var f = byId[id];
            if (!f) return;
            var v = f.value;
            var isEmpty = v == null || v === '' || String(v).trim() === '';
            var t = (f.type || '').toLowerCase();
            if (!isEmpty && (t === 'select-one' || t === 'select' || /^select/.test(t))) {
                var vl = f.valueLabel || '';
                if (vl && placeholderRe.test(String(vl).trim())) isEmpty = true;
            }
            if (isEmpty) empty.push(id);
        });
        return empty;
    }
    window.__tonyGetTerrenoInterviewEmpty = tonyGetTerrenoInterviewEmpty;

    function tonyTerrenoInterviewLabels(formCtx, ids) {
        if (!ids || !ids.length || !formCtx || !formCtx.fields) return ids.join(', ');
        var byId = {};
        formCtx.fields.forEach(function (f) { byId[f.id] = f; });
        return ids.map(function (id) {
            var f = byId[id];
            return f ? String(f.label || id).replace(/\s*\*?\s*$/, '') : id;
        }).join(', ');
    }

    function tonyTerrenoProactiveMissingPrompt(formCtx) {
        if (!formCtx) return;
        var reqT = formCtx.requiredEmpty && formCtx.requiredEmpty.length ? formCtx.requiredEmpty : [];
        var intT = (formCtx.interviewEmpty && formCtx.interviewEmpty.length)
            ? formCtx.interviewEmpty
            : (typeof tonyGetTerrenoInterviewEmpty === 'function' ? tonyGetTerrenoInterviewEmpty(formCtx, 'terreno-form') : []);
        var missMsg;
        if (reqT.indexOf('terreno-data-scadenza-affitto') >= 0) {
            missMsg = 'Per l\'affitto serve la data di scadenza del contratto (es. 2026-12-31).';
        } else if (reqT.length) {
            missMsg = 'Mi mancano ancora: ' + tonyTerrenoInterviewLabels(formCtx, reqT) + '.';
        } else if (intT.length) {
            missMsg = 'Per completare il terreno mi servono: ' + tonyTerrenoInterviewLabels(formCtx, intT) + '.';
        } else {
            missMsg = 'Come vuoi chiamare il terreno?';
        }
        appendMessage(missMsg, 'tony');
        if (window.Tony && typeof window.Tony.speak === 'function') window.Tony.speak(missMsg);
    }

    function tonyScheduleTerrenoProactiveAfterInject() {
        if (window.__tonyProactiveAskTimerId) clearTimeout(window.__tonyProactiveAskTimerId);
        if (window.__tonyIdleReminderTimerId) { clearTimeout(window.__tonyIdleReminderTimerId); window.__tonyIdleReminderTimerId = null; }
        window.__tonyProactiveAskTimerId = setTimeout(function () {
            window.__tonyProactiveAskTimerId = null;
            var formCtx = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
            var modalEl = document.getElementById('terreno-modal');
            if (!formCtx || formCtx.formId !== 'terreno-form' || !modalEl || !modalEl.classList.contains('active')) return;
            var hasRequiredEmpty = formCtx.requiredEmpty && formCtx.requiredEmpty.length > 0;
            var formComplete = terrenoProactiveReadyForSave('terreno-form', !!hasRequiredEmpty);
            window.__tonyProactiveFormState = { active: true, type: formComplete ? 'ready_for_save' : 'missing_fields', formId: 'terreno-form', modalId: 'terreno-modal' };
            var idleDelayTerreno = formComplete ? 800 : IDLE_REMINDER_MS;
            window.__tonyIdleReminderTimerId = setTimeout(function () {
                window.__tonyIdleReminderTimerId = null;
                if (window.__tonyInjectionInProgress) return;
                if (isAnyTonyFormSaveConfirmPending()) return;
                var state = window.__tonyProactiveFormState;
                if (!state || !state.active) return;
                var el = document.getElementById(state.modalId);
                if (!el || !el.classList.contains('active')) { window.__tonyProactiveFormState = null; return; }
                if (state.type === 'ready_for_save' && typeof window.__tonyTriggerAskForSaveConfirmation === 'function') {
                    window.__tonyTriggerAskForSaveConfirmation();
                } else if (state.type === 'missing_fields') {
                    var fcT = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                    tonyTerrenoProactiveMissingPrompt(fcT);
                }
                window.__tonyProactiveFormState = null;
            }, idleDelayTerreno);
        }, POST_INJECT_CHECK_DELAY_MS);
    }

    function tonyScheduleMagazzinoSavePromptIfReady(formId, delayMs) {
        delayMs = typeof delayMs === 'number' ? delayMs : 800;
        setTimeout(function() {
            if (window.__tonyInjectionInProgress) return;
            if (isAnyTonyFormSaveConfirmPending()) return;
            if (!magazzinoFormReadyForTonySave(formId)) return;
            var mid = formId === 'prodotto-form' ? 'prodotto-modal' : 'movimento-modal';
            var mel = document.getElementById(mid);
            if (!mel || !mel.classList.contains('active')) return;
            if (typeof window.__tonyTriggerAskForSaveConfirmation === 'function') {
                window.__tonyTriggerAskForSaveConfirmation();
            }
        }, delayMs);
    }

    function tonyMagazzinoInterviewLabels(formCtx, ids) {
        if (!ids || !ids.length || !formCtx || !formCtx.fields) return ids.join(', ');
        var byId = {};
        formCtx.fields.forEach(function(f) { byId[f.id] = f; });
        return ids.map(function(id) {
            var f = byId[id];
            return f ? String(f.label || id).replace(/\s*\*?\s*$/, '') : id;
        }).join(', ');
    }

    /** Messaggio proattivo campi mancanti magazzino: prodotto in chat locale (no CF), movimento via CF se opzionali. */
    function tonyMagazzinoProactiveMissingPrompt(formId, fc) {
        if (!fc || !formId) return;
        var reqP = fc.requiredEmpty && fc.requiredEmpty.length ? fc.requiredEmpty : [];
        var intP = (fc.interviewEmpty && fc.interviewEmpty.length) ? fc.interviewEmpty : (typeof tonyGetMagazzinoInterviewEmpty === 'function' ? tonyGetMagazzinoInterviewEmpty(fc, formId) : []);
        var missMsg;
        if (formId === 'prodotto-form') {
            if (reqP.indexOf('prodotto-dosaggio-min') >= 0 || reqP.indexOf('prodotto-dosaggio-max') >= 0) {
                missMsg = 'Indica il dosaggio minimo e massimo per ettaro (es. dosaggio 0.5-1).';
            } else if (reqP.indexOf('prodotto-giorni-carenza') >= 0) {
                missMsg = 'Quanti giorni di carenza ha il fitofarmaco? (es. carenza 30)';
            } else {
                missMsg = reqP.length
                    ? ('Mi mancano ancora: ' + tonyMagazzinoInterviewLabels(fc, reqP) + '.')
                    : (intP.length ? ('Indica ancora ' + tonyMagazzinoInterviewLabels(fc, intP) + '.') : undefined);
            }
            if (missMsg && typeof appendMessage === 'function') {
                appendMessage(missMsg, 'tony');
                return;
            }
            if (missMsg && typeof window !== 'undefined' && typeof window.appendMessage === 'function') {
                window.appendMessage(missMsg, 'tony');
                return;
            }
        } else {
            missMsg = reqP.length
                ? ('Form movimento: obbligatori mancanti: ' + tonyMagazzinoInterviewLabels(fc, reqP) + '.')
                : (intP.length ? ('Form movimento: indica ancora ' + tonyMagazzinoInterviewLabels(fc, intP) + '.') : undefined);
        }
        if (missMsg && typeof window.__tonyTriggerAskForMissingFields === 'function') {
            window.__tonyTriggerAskForMissingFields(missMsg);
        }
    }

    /** Dopo SET_FIELD su prodotto/movimento la CF spesso non rimanda subito un turno: schedula lo stesso check proattivo di post-INJECT (debounced). */
    var MAGAZZINO_POST_SETFIELD_DEBOUNCE_MS = 2000;
    var MAGAZZINO_IDLE_AFTER_SETFIELD_SAVE_MS = 2200;

    function scheduleTonyMagazzinoProactiveAfterSetField() {
        if (window.__tonyMagazzinoSetFieldDebounceTimer) {
            clearTimeout(window.__tonyMagazzinoSetFieldDebounceTimer);
        }
        window.__tonyMagazzinoSetFieldDebounceTimer = setTimeout(function() {
            window.__tonyMagazzinoSetFieldDebounceTimer = null;
            runTonyMagazzinoProactiveFromSetField(0);
        }, MAGAZZINO_POST_SETFIELD_DEBOUNCE_MS);
    }

    function runTonyMagazzinoProactiveFromSetField(retryCount) {
        retryCount = retryCount || 0;
        if (window.__tonyInjectionInProgress) {
            if (retryCount < 10) {
                setTimeout(function() { runTonyMagazzinoProactiveFromSetField(retryCount + 1); }, 400);
            }
            return;
        }
        var fc = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
        if (!fc || (fc.formId !== 'prodotto-form' && fc.formId !== 'movimento-form')) return;
        var mid = fc.formId === 'prodotto-form' ? 'prodotto-modal' : 'movimento-modal';
        var mel = document.getElementById(mid);
        if (!mel || !mel.classList.contains('active')) return;
        if (window.__tonyProactiveAskTimerId) { clearTimeout(window.__tonyProactiveAskTimerId); window.__tonyProactiveAskTimerId = null; }
        if (window.__tonyIdleReminderTimerId) { clearTimeout(window.__tonyIdleReminderTimerId); window.__tonyIdleReminderTimerId = null; }
        var hasReq = fc.requiredEmpty && fc.requiredEmpty.length > 0;
        var complete = magazzinoProactiveReadyForSave(fc.formId, !!hasReq);
        window.__tonyProactiveFormState = { active: true, type: complete ? 'ready_for_save' : 'missing_fields', formId: fc.formId, modalId: mid };
        var idleDelay = complete ? MAGAZZINO_IDLE_AFTER_SETFIELD_SAVE_MS : IDLE_REMINDER_MS;
        window.__tonyIdleReminderTimerId = setTimeout(function() {
            window.__tonyIdleReminderTimerId = null;
            if (window.__tonyInjectionInProgress) return;
            var state = window.__tonyProactiveFormState;
            if (!state || !state.active) return;
            var el = document.getElementById(state.modalId);
            if (!el || !el.classList.contains('active')) { window.__tonyProactiveFormState = null; return; }
            var fc2 = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
            if (!fc2 || fc2.formId !== state.formId) { window.__tonyProactiveFormState = null; return; }
            var hasReq2 = fc2.requiredEmpty && fc2.requiredEmpty.length > 0;
            var complete2 = magazzinoProactiveReadyForSave(fc2.formId, !!hasReq2);
            if (complete2 && typeof window.__tonyTriggerAskForSaveConfirmation === 'function') {
                window.__tonyTriggerAskForSaveConfirmation();
            } else if (!complete2) {
                tonyMagazzinoProactiveMissingPrompt(state.formId, fc2);
            }
            window.__tonyProactiveFormState = null;
        }, idleDelay);
    }

    /**
     * Messaggio in chat + stessa domanda letta ad alta voce (Tony.speak → TTS), come SUM_COLUMN/RIASSUNTO.
     */
    function appendPreventivoTerrenoAskAndSpeak(chatText, voiceText) {
        try {
            appendMessage(String(chatText || ''), 'tony');
        } catch (_) {}
        var v = (voiceText != null && String(voiceText).trim() !== '')
            ? String(voiceText).trim()
            : String(chatText || '').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        if (v) {
            try {
                if (window.Tony && typeof window.Tony.speak === 'function') window.Tony.speak(v);
            } catch (_) {}
        }
    }

    /**
     * Elabora i comandi operativi inviati da Tony.
     * Gestisce OPEN_MODAL, SET_FIELD (input/textarea e select), CLICK_BUTTON.
     * IMPORTANTE: non chiamare mai sendMessage da qui; dopo OPEN_MODAL/SET_FIELD il widget si ferma e aspetta input utente.
     * @param {Object} data - L'oggetto comando (es. { type: 'OPEN_MODAL', id: '...' })
     */
    function processTonyCommand(data) {
        data = normalizeTonyCommand(data);
        // console.log('[DEBUG CURSOR] processTonyCommand: Chiamata ricevuta');
        // console.log('[DEBUG CURSOR] processTonyCommand: Dati comando:', JSON.stringify(data, null, 2));
        console.log('[Tony] Esecuzione comando:', data && data.type, data && (data.field || data.id || ''));

        if (!data || !data.type) {
            console.warn('[Tony] Comando malformato o vuoto.');
            return;
        }

        if (!isTonyAdvancedActive) {
            console.warn('[Tony] Comando bloccato: modulo Tony Avanzato non attivo.');
            showMessageInChat('Questa funzionalità richiede il modulo Tony Avanzato. Attivalo dalla pagina Abbonamento per navigare, compilare form e automatizzare operazioni. Posso spiegarti come procedere a mano.', 'tony');
            return;
        }

        var $ = window.$ || window.jQuery;
        try {
            switch (String(data.type).toUpperCase()) {
                case '_WAIT_MODAL_READY':
                    console.log('[Tony] Attesa popolamento modal completata, proseguo con i SET_FIELD');
                    break;
                case 'INJECT_FORM_DATA':
                    // CF / modello possono usare "fields" o "fieldValues" (come OPEN_MODAL) invece di "formData"
                    (function normalizeInjectPayload(d) {
                        var alt = d.fieldValues || d.fields || (d.params && typeof d.params === 'object' && (d.params.formData || d.params.fields));
                        if (!alt || typeof alt !== 'object' || Array.isArray(alt)) return;
                        if (!d.formData || typeof d.formData !== 'object' || Array.isArray(d.formData)) {
                            d.formData = alt;
                            return;
                        }
                        var keysAlt = Object.keys(alt).filter(function(k) { return alt[k] != null && String(alt[k]).trim() !== ''; });
                        if (keysAlt.length > 0 && Object.keys(d.formData).length === 0) {
                            d.formData = alt;
                        }
                    })(data);
                    if ((data.formId === 'prodotto-form' || data.formId === 'movimento-form') && data.formData && typeof data.formData === 'object') {
                        var lastMagInj = window.__tonyMagazzinoLastInject;
                        if (lastMagInj && lastMagInj.formId === data.formId && (Date.now() - lastMagInj.t) < 15000 && lastMagInj.formData && typeof lastMagInj.formData === 'object') {
                            data.formData = Object.assign({}, lastMagInj.formData, data.formData);
                            console.log('[Tony] INJECT_FORM_DATA magazzino: merge con inject precedente (<15s)');
                        }
                        window.__tonyMagazzinoLastInject = { formId: data.formId, formData: Object.assign({}, data.formData), t: Date.now() };
                    }
                    if (data.formData && !window.TonyFormInjector) {
                        var injectRetryN = (typeof data._injectRetryCount === 'number' ? data._injectRetryCount : 0) + 1;
                        if (injectRetryN <= 10) {
                            var injectRetryCmd = Object.assign({}, data, { _injectRetryCount: injectRetryN });
                            console.warn('[Tony] INJECT_FORM_DATA: injector non pronto, retry', injectRetryN, '/10');
                            enqueueTonyCommand(injectRetryCmd, { source: 'inject-wait-injector', delayMs: 400 });
                            break;
                        }
                        console.warn('[Tony] INJECT_FORM_DATA: TonyFormInjector assente dopo retry — compilazione saltata');
                        break;
                    }
                    if (data.formData && window.TonyFormInjector) {
                        // Muto durante iniezione: disabilita timer proattivi e resetta a ogni avvio INJECT
                        if (window.__tonyProactiveAskTimerId) { clearTimeout(window.__tonyProactiveAskTimerId); window.__tonyProactiveAskTimerId = null; }
                        if (window.__tonyIdleReminderTimerId) { clearTimeout(window.__tonyIdleReminderTimerId); window.__tonyIdleReminderTimerId = null; }
                        if (window.__tonyProactiveFormState) window.__tonyProactiveFormState = null;
                        window.__tonyInjectionInProgress = true;
                        var ctx = window.Tony ? window.Tony.context : {};
                        if (data.formId === 'preventivo-form' && !document.getElementById('preventivo-form')) {
                            window.__tonyInjectionInProgress = false;
                            if (window.Tony && typeof window.Tony.triggerAction === 'function') {
                                console.log('[Tony] INJECT_FORM_DATA: form preventivo assente, apro Nuovo Preventivo con intent pendente');
                                window.Tony.triggerAction('APRI_PAGINA', {
                                    target: 'nuovo preventivo',
                                    _tonyPendingModal: 'preventivo-form',
                                    _tonyPendingFields: (data.formData && typeof data.formData === 'object') ? data.formData : null
                                });
                            }
                            break;
                        }
                        var modalTrattamentoInjectGuard = (function() {
                            var m = document.getElementById('modal-trattamento');
                            return m && m.classList.contains('active');
                        })();
                        if (modalTrattamentoInjectGuard && (data.formId === 'attivita-form' || data.formId === 'attivita-modal')) {
                            window.__tonyInjectionInProgress = false;
                            console.warn('[Tony] INJECT attivita-form ignorato: modal Completa trattamento/concimazione attivo (evita comando errato dalla CF).');
                            break;
                        }
                        if (data.formData && typeof data.formData === 'object') {
                            var fdInj = data.formData;
                            if (data.formId === 'attivita-form' && tonyPayloadLooksLikePreventivoFormData(fdInj)) {
                                console.log('[Tony] INJECT_FORM_DATA: attivita-form con chiavi preventivo → uso preventivo-form (anche cross-page)');
                                data.formId = 'preventivo-form';
                            }
                        }
                        if (document.getElementById('preventivo-form') && data.formData && typeof data.formData === 'object') {
                            var fdInj = data.formData;
                            if ((fdInj['data-prevista'] == null || String(fdInj['data-prevista']).trim() === '') &&
                                (fdInj['attivita-data'] != null && String(fdInj['attivita-data']).trim() !== '' ||
                                 fdInj['dataPrevista'] != null && String(fdInj['dataPrevista']).trim() !== '' ||
                                 fdInj['data_prevista'] != null && String(fdInj['data_prevista']).trim() !== '')) {
                                data.formData = Object.assign({}, fdInj);
                                if (data.formData['attivita-data'] != null && String(data.formData['attivita-data']).trim() !== '') {
                                    data.formData['data-prevista'] = data.formData['attivita-data'];
                                    delete data.formData['attivita-data'];
                                } else if (data.formData['dataPrevista'] != null && String(data.formData['dataPrevista']).trim() !== '') {
                                    data.formData['data-prevista'] = data.formData['dataPrevista'];
                                    delete data.formData['dataPrevista'];
                                } else {
                                    data.formData['data-prevista'] = data.formData['data_prevista'];
                                    delete data.formData['data_prevista'];
                                }
                                console.log('[Tony] INJECT_FORM_DATA: alias data → data-prevista (Nuovo Preventivo)');
                                fdInj = data.formData;
                            }
                        }
                        if (data.formId === 'attivita-form' && tonyModuliAttiviIncludeManodopera() && !document.getElementById('attivita-modal')) {
                            window.__tonyInjectionInProgress = false;
                            if (getTonyFieldProfileFromContext()) {
                                var fdOraFromAtt = tonyMapAttivitaFieldsToSegnaOra(Object.assign({}, data.formData || {}));
                                if (data.formData && data.formData['attivita-tipo-lavoro'] && !fdOraFromAtt['ora-note']) {
                                    var noteAtt = String(data.formData['attivita-tipo-lavoro']);
                                    if (data.formData['attivita-ore']) noteAtt += ' — ' + data.formData['attivita-ore'] + ' ore';
                                    fdOraFromAtt['ora-note'] = noteAtt;
                                }
                                fdOraFromAtt = tonyResolveOraLavoroForQuickHours(fdOraFromAtt, tonyBuildSegnaOraUserBlobLastNUserTurns(6));
                                console.log('[Tony] INJECT attivita-form con manodopera: profilo campo → workspace Segna ore');
                                window.Tony.triggerAction('APRI_PAGINA', {
                                    target: 'workspace campo',
                                    _tonyPendingModal: 'quick-hours-form',
                                    _tonyPendingFields: Object.keys(fdOraFromAtt).length > 0 ? fdOraFromAtt : null
                                });
                            } else {
                                console.log('[Tony] INJECT attivita-form ignorato: manodopera attivo, profilo manager (né diario né Segna ore)');
                            }
                            break;
                        }
                        var targetModalId = (data.formId === 'lavoro-form' || data.formId === 'lavoro-modal') ? 'lavoro-modal' : (data.formId === 'attivita-form' ? 'attivita-modal' : (data.formId === 'prodotto-form' ? 'prodotto-modal' : (data.formId === 'movimento-form' ? 'movimento-modal' : (data.formId === 'terreno-form' ? 'terreno-modal' : (data.formId === 'zona-form' ? 'zona-modal' : (data.formId === 'ora-form' ? 'ora-modal' : null))))));
                        var modalEl = targetModalId ? document.getElementById(targetModalId) : null;
                        var isModalOpen = modalEl && modalEl.classList.contains('active');
                        if (data.formId === 'terreno-form' && !document.getElementById('terreno-form')) {
                            window.__tonyInjectionInProgress = false;
                            if (window.Tony && typeof window.Tony.triggerAction === 'function') {
                                console.log('[Tony] INJECT_FORM_DATA: form terreno assente, apro pagina Terreni con intent pendente');
                                window.Tony.triggerAction('APRI_PAGINA', {
                                    target: 'terreni',
                                    _tonyPendingModal: 'terreno-modal',
                                    _tonyPendingFields: (data.formData && typeof data.formData === 'object') ? data.formData : null
                                });
                            }
                            break;
                        }
                        if (targetModalId && !isModalOpen && data.formData && Object.keys(data.formData).length > 0) {
                            console.log('[Tony] INJECT_FORM_DATA: modal non aperto, apro prima ' + targetModalId + ' e poi inietto');
                            window.__tonyInjectionInProgress = false;
                            enqueueTonyCommand({ type: 'OPEN_MODAL', id: targetModalId, fields: data.formData }, { source: 'inject-guard-open-first' });
                            break;
                        }
                        if (data.formId === 'lavoro-form' || data.formId === 'lavoro-modal') {
                            console.log('[Tony] INJECT_FORM_DATA: iniezione formData lavoro');
                            if (window.Tony && typeof window.Tony.setContext === 'function') {
                                window.Tony.setContext('lavori', ctx.lavori || {});
                            }
                            var formDataToInject = data.formData;
                            var formCtxMerge = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                            var patchOnlyLavoro = false;
                            if (formCtxMerge && formCtxMerge.fields && formCtxMerge.fields.length > 0) {
                                var merged = Object.assign({}, formDataToInject);
                                formCtxMerge.fields.forEach(function(f) {
                                    var hasVal = f.value != null && (f.value === 0 || f.value !== '');
                                    if (f.id && hasVal && !(f.id in formDataToInject)) {
                                        merged[f.id] = f.value;
                                    }
                                    if (f.id && hasVal) patchOnlyLavoro = true;
                                });
                                if (Object.keys(merged).length > Object.keys(formDataToInject).length) {
                                    formDataToInject = merged;
                                    console.log('[Tony] INJECT_FORM_DATA: merge con valori esistenti, campi totali:', Object.keys(formDataToInject).length);
                                }
                            }
                            window.TonyFormInjector.injectLavoroForm(formDataToInject, ctx, patchOnlyLavoro ? { patchOnly: true } : undefined).then(function(ok) {
                                window.__tonyInjectionInProgress = false;
                                if (ok) {
                                    console.log('[Tony] Form lavoro iniettato con successo');
                                    window.__tonyLavoroCreationFlow = true;
                                    if (window.__tonyLavoroPersonDisambCandidates && window.__tonyLavoroPersonDisambCandidates.length > 1 &&
                                        window.TonyFormInjector && typeof window.TonyFormInjector.promptLavoroInterviewMissing === 'function') {
                                        window.TonyFormInjector.promptLavoroInterviewMissing().then(function(locDis) {
                                            if (locDis && locDis.message) {
                                                appendMessage(locDis.message, 'tony');
                                                if (window.Tony && typeof window.Tony.speak === 'function') window.Tony.speak(locDis.message);
                                            }
                                        });
                                    } else if (window.__tonyLavoroTerrenoDisambCandidates && window.__tonyLavoroTerrenoDisambCandidates.length > 1 &&
                                        window.TonyFormInjector && typeof window.TonyFormInjector.promptLavoroInterviewMissing === 'function') {
                                        window.TonyFormInjector.promptLavoroInterviewMissing().then(function(locDisT) {
                                            if (locDisT && locDisT.message) {
                                                appendMessage(locDisT.message, 'tony');
                                                if (window.Tony && typeof window.Tony.speak === 'function') window.Tony.speak(locDisT.message);
                                            }
                                        });
                                    }
                                    var formCtxAfterInj = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                                    window.__tonyLavoroInterviewPending = !!(formCtxAfterInj && formCtxAfterInj.requiredEmpty && formCtxAfterInj.requiredEmpty.length > 0);
                                    if (window.__tonyProactiveAskTimerId) clearTimeout(window.__tonyProactiveAskTimerId);
                                    if (window.__tonyIdleReminderTimerId) { clearTimeout(window.__tonyIdleReminderTimerId); window.__tonyIdleReminderTimerId = null; }
                                    function runProactiveCheckLavoro(retryCount) {
                                        retryCount = retryCount || 0;
                                        if (window.__tonyInjectionInProgress) return;
                                        var formCtx = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                                        var modalEl = document.getElementById('lavoro-modal');
                                        if (!modalEl || !modalEl.classList.contains('active')) {
                                            if (retryCount === 0) console.log('[Tony] Timer proattivo lavoro: modal non aperto, skip');
                                            return;
                                        }
                                        if (!formCtx || !formCtx.formId) {
                                            if (retryCount < 2) {
                                                window.__tonyProactiveAskTimerId = setTimeout(function() { window.__tonyProactiveAskTimerId = null; runProactiveCheckLavoro(retryCount + 1); }, 1500);
                                                return;
                                            }
                                            console.log('[Tony] Timer proattivo lavoro: formCtx non disponibile dopo retry, uso solo DOM per needsMacchine');
                                        }
                                        var hasRequiredEmpty = (formCtx && formCtx.requiredEmpty && formCtx.requiredEmpty.length > 0);
                                        var needsMacchine = false;
                                        var tipoEl = document.getElementById('lavoro-tipo-lavoro');
                                        var tipoVal = (tipoEl && tipoEl.options && tipoEl.options[tipoEl.selectedIndex]) ? (tipoEl.options[tipoEl.selectedIndex].text || '').toLowerCase() : '';
                                        var isMeccanico = /erpicatur|trinciatur|fresatur|pre-potatur|potatur\s+meccanica|vendemmia\s+meccanica|vangatur|raccolta\s+meccanica/.test(tipoVal)
                                            || /\bmeccanic[oa]\b/.test(tipoVal);
                                        if (isMeccanico) {
                                            var trEl = document.getElementById('lavoro-trattore');
                                            var atEl = document.getElementById('lavoro-attrezzo');
                                            needsMacchine = !trEl || !trEl.value || !atEl || !atEl.value;
                                        }
                                        var formComplete = !hasRequiredEmpty && !needsMacchine;
                                        var needsMacchineOnly = !hasRequiredEmpty && needsMacchine;
                                        var lastUpDense = tonyGetLastUserMessage();
                                        if (lastUpDense && tonyUserMessageEntityDenseForLavoro(lastUpDense) && (hasRequiredEmpty || needsMacchine)) {
                                            console.log('[Tony] Timer proattivo lavoro: skip (messaggio entity-dense, attendo inject completo)');
                                            window.__tonyProactiveFormState = null;
                                            return;
                                        }
                                        if (!tonyShouldArmProactiveMissingFieldsAsk() && (hasRequiredEmpty || needsMacchine)) {
                                            if (!(needsMacchineOnly && tonyShouldArmProactiveMacchineAsk())) {
                                                console.log('[Tony] Timer proattivo lavoro: skip (CF chiede già all\'utente)');
                                                window.__tonyProactiveFormState = null;
                                                return;
                                            }
                                        }
                                        window.__tonyProactiveFormState = { active: true, type: formComplete ? 'ready_for_save' : 'missing_fields', formId: 'lavoro-form', modalId: 'lavoro-modal', needsMacchineOnly: !!needsMacchineOnly };
                                        console.log('[Tony] Timer proattivo lavoro: check eseguito, type=', window.__tonyProactiveFormState.type, 'hasRequiredEmpty=', hasRequiredEmpty, 'needsMacchine=', needsMacchine);
                                        var idleDelayLavoro = needsMacchineOnly ? MACCHINE_ONLY_ASK_DELAY_MS : (formComplete ? 800 : IDLE_REMINDER_MS);
                                        window.__tonyIdleReminderTimerId = setTimeout(function() {
                                            window.__tonyIdleReminderTimerId = null;
                                            if (window.__tonyInjectionInProgress) return;
                                            var state = window.__tonyProactiveFormState;
                                            if (!state || !state.active) return;
                                            var el = document.getElementById(state.modalId);
                                            if (!el || !el.classList.contains('active')) { window.__tonyProactiveFormState = null; return; }
                                            if (window.__tonyMacchineDisambAskedAt && Date.now() - window.__tonyMacchineDisambAskedAt < 120000) {
                                                window.__tonyProactiveFormState = null;
                                                return;
                                            }
                                            if (state.type === 'ready_for_save' && typeof window.__tonyTriggerAskForSaveConfirmation === 'function') {
                                                window.__tonyTriggerAskForSaveConfirmation();
                                            } else if (state.type === 'missing_fields') {
                                                var lastUpM = tonyGetLastUserMessage();
                                                if (state.needsMacchineOnly && lastUpM && tonyUserMentionedLavoroMacchine(lastUpM)) {
                                                    window.__tonyProactiveFormState = null;
                                                    return;
                                                }
                                                if (state.formId === 'lavoro-form' && lastUpM && tonyUserMentionedLavoroAssignee(lastUpM) && !state.needsMacchineOnly) {
                                                    var opElPro = document.getElementById('lavoro-operaio');
                                                    var capElPro = document.getElementById('lavoro-caposquadra');
                                                    var assigneeSet = (opElPro && String(opElPro.value || '').trim()) ||
                                                        (capElPro && String(capElPro.value || '').trim());
                                                    if (assigneeSet && !(window.__tonyLavoroPersonDisambCandidates &&
                                                        window.__tonyLavoroPersonDisambCandidates.length > 1)) {
                                                        window.__tonyProactiveFormState = null;
                                                        return;
                                                    }
                                                }
                                                if (window.__tonyLavoroPersonDisambCandidates && window.__tonyLavoroPersonDisambCandidates.length > 1 &&
                                                    window.TonyFormInjector && typeof window.TonyFormInjector.promptLavoroInterviewMissing === 'function') {
                                                    window.TonyFormInjector.promptLavoroInterviewMissing().then(function(locPd) {
                                                        if (locPd && locPd.message) {
                                                            appendMessage(locPd.message, 'tony');
                                                            if (window.Tony && typeof window.Tony.speak === 'function') window.Tony.speak(locPd.message);
                                                        }
                                                    });
                                                    window.__tonyProactiveFormState = null;
                                                    return;
                                                }
                                                if (window.__tonyLavoroTerrenoDisambCandidates && window.__tonyLavoroTerrenoDisambCandidates.length > 1 &&
                                                    window.TonyFormInjector && typeof window.TonyFormInjector.promptLavoroInterviewMissing === 'function') {
                                                    window.TonyFormInjector.promptLavoroInterviewMissing().then(function(locPt) {
                                                        if (locPt && locPt.message) {
                                                            appendMessage(locPt.message, 'tony');
                                                            if (window.Tony && typeof window.Tony.speak === 'function') window.Tony.speak(locPt.message);
                                                        }
                                                    });
                                                    window.__tonyProactiveFormState = null;
                                                    return;
                                                }
                                                if (state.needsMacchineOnly && window.TonyFormInjector && typeof window.TonyFormInjector.promptLavoroMacchineMissing === 'function') {
                                                    if (window.__tonyMacchineDisambAskedAt && Date.now() - window.__tonyMacchineDisambAskedAt < 12000) {
                                                        return;
                                                    }
                                                    window.TonyFormInjector.promptLavoroMacchineMissing().then(function(res) {
                                                        if (res && (res.asked || res.resolved)) return;
                                                        if (window.__tonyMacchineDisambAskedAt && Date.now() - window.__tonyMacchineDisambAskedAt < 12000) return;
                                                        if (window.TonyFormInjector && typeof window.TonyFormInjector.promptLavoroInterviewMissing === 'function') {
                                                            window.TonyFormInjector.promptLavoroInterviewMissing().then(function(loc) {
                                                                if (loc && loc.asked && loc.message) {
                                                                    appendMessage(loc.message, 'tony');
                                                                    if (window.Tony && typeof window.Tony.speak === 'function') window.Tony.speak(loc.message);
                                                                    return;
                                                                }
                                                                if (tonyShouldArmProactiveMacchineAsk() && typeof window.__tonyTriggerAskForMissingFields === 'function') {
                                                                    window.__tonyTriggerAskForMissingFields('Mancano solo trattore e attrezzo per questo lavoro meccanico. Quale trattore e attrezzo vuoi usare?');
                                                                }
                                                            });
                                                            return;
                                                        }
                                                        if (tonyShouldArmProactiveMacchineAsk() && typeof window.__tonyTriggerAskForMissingFields === 'function') {
                                                            window.__tonyTriggerAskForMissingFields('Mancano solo trattore e attrezzo per questo lavoro meccanico. Quale trattore e attrezzo vuoi usare?');
                                                        }
                                                    });
                                                } else if (window.TonyFormInjector && typeof window.TonyFormInjector.promptLavoroInterviewMissing === 'function') {
                                                    window.TonyFormInjector.promptLavoroInterviewMissing().then(function(loc) {
                                                        if (loc && loc.asked && loc.message) {
                                                            appendMessage(loc.message, 'tony');
                                                            if (window.Tony && typeof window.Tony.speak === 'function') window.Tony.speak(loc.message);
                                                            return;
                                                        }
                                                        if (typeof window.__tonyTriggerAskForMissingFields === 'function' && tonyShouldArmProactiveMissingFieldsAsk()) {
                                                            var msg = (state.needsMacchineOnly) ? 'Mancano solo trattore e attrezzo per questo lavoro meccanico. Quale trattore e attrezzo vuoi usare?' : null;
                                                            window.__tonyTriggerAskForMissingFields(msg);
                                                        }
                                                    });
                                                } else if (typeof window.__tonyTriggerAskForMissingFields === 'function' && tonyShouldArmProactiveMissingFieldsAsk()) {
                                                    var msg = (state.needsMacchineOnly) ? 'Mancano solo trattore e attrezzo per questo lavoro meccanico. Quale trattore e attrezzo vuoi usare?' : null;
                                                    window.__tonyTriggerAskForMissingFields(msg);
                                                }
                                            }
                                            window.__tonyProactiveFormState = null;
                                        }, idleDelayLavoro);
                                    }
                                    window.__tonyProactiveAskTimerId = setTimeout(function() {
                                        window.__tonyProactiveAskTimerId = null;
                                        runProactiveCheckLavoro(0);
                                    }, POST_INJECT_CHECK_DELAY_LAVORO_MS);
                                } else {
                                    console.warn('[Tony] Iniezione form lavoro fallita');
                                }
                            });
                        } else if (data.formId === 'preventivo-form') {
                            console.log('[Tony] INJECT_FORM_DATA: iniezione formData Nuovo Preventivo');
                            var formDataPrev = data.formData;
                            var formCtxPrev = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                            if (formCtxPrev && formCtxPrev.fields && formCtxPrev.fields.length > 0) {
                                var mergedPrev = Object.assign({}, formDataPrev);
                                formCtxPrev.fields.forEach(function(f) {
                                    var hasVal = f.value != null && (f.value === 0 || f.value !== '');
                                    if (f.id && hasVal && !(f.id in formDataPrev)) {
                                        mergedPrev[f.id] = f.value;
                                    }
                                });
                                if (Object.keys(mergedPrev).length > Object.keys(formDataPrev).length) {
                                    formDataPrev = mergedPrev;
                                }
                            }
                            formDataPrev = tonyStripConflictingPreventivoLavorazione(formDataPrev);
                            window.TonyFormInjector.injectPreventivoForm(formDataPrev, ctx).then(function(ok) {
                                window.__tonyInjectionInProgress = false;
                                var dis = window.__tonyPreventivoTerrenoDisambiguation;
                                if (dis && Array.isArray(dis.options) && dis.options.length > 1) {
                                    var namesDis = dis.options.map(function (o) { return (o.nome || o.id || '').toString().trim(); }).filter(Boolean);
                                    var qDis = buildPreventivoTerrenoChoiceQuestion(namesDis);
                                    var chatDis = qDis ? qDis : 'Su quale terreno vuoi calcolare il preventivo?';
                                    appendPreventivoTerrenoAskAndSpeak(chatDis, qDis || null);
                                    // Fallback: fermati qui e attendi scelta utente, evita reminder fuorvianti.
                                    window.__tonyPreventivoTerrenoDisambiguation = null;
                                    return;
                                }
                                var fdPrev = formDataPrev;
                                function proceedPreventivoInjectRest() {
                                    window.__tonyPreventivoTerrenoDisambiguation = null;
                                    if (!ok) {
                                        console.warn('[Tony] Iniezione form preventivo fallita');
                                        return;
                                    }
                                    console.log('[Tony] Form preventivo iniettato con successo');
                                    if (window.__tonyProactiveAskTimerId) clearTimeout(window.__tonyProactiveAskTimerId);
                                    if (window.__tonyIdleReminderTimerId) { clearTimeout(window.__tonyIdleReminderTimerId); window.__tonyIdleReminderTimerId = null; }
                                    function runProactiveCheckPreventivo(retryCount) {
                                        retryCount = retryCount || 0;
                                        var formPreventivo = document.getElementById('preventivo-form');
                                        if (!formPreventivo) {
                                            if (retryCount < 4) {
                                                window.__tonyProactiveAskTimerId = setTimeout(function() {
                                                    window.__tonyProactiveAskTimerId = null;
                                                    runProactiveCheckPreventivo(retryCount + 1);
                                                }, 1200);
                                                return;
                                            }
                                            console.log('[Tony] Timer proattivo preventivo: #preventivo-form assente, skip');
                                            return;
                                        }
                                        var buildPrev = window.__tonyBuildTonyFormContext;
                                        var formCtxP = (buildPrev && formPreventivo)
                                            ? buildPrev(formPreventivo, formPreventivo, '', 'preventivo proactive')
                                            : (typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null);
                                        if (!formCtxP || formCtxP.formId !== 'preventivo-form') {
                                            if (retryCount < 4) {
                                                window.__tonyProactiveAskTimerId = setTimeout(function() {
                                                    window.__tonyProactiveAskTimerId = null;
                                                    runProactiveCheckPreventivo(retryCount + 1);
                                                }, 1200);
                                                return;
                                            }
                                            console.log('[Tony] Timer proattivo preventivo: formCtx non disponibile dopo retry');
                                            return;
                                        }
                                        var reqEmpty = (formCtxP.requiredEmpty && formCtxP.requiredEmpty.slice) ? formCtxP.requiredEmpty.slice() : [];
                                        var formCompleteP = reqEmpty.length === 0;
                                        var proactiveMissingMsg = null;
                                        if (!formCompleteP) {
                                            if (reqEmpty.length === 1 && reqEmpty[0] === 'data-prevista') {
                                                proactiveMissingMsg = 'Prima di salvare serve la data prevista del lavoro. Indicala nel campo "Data prevista lavoro" o scrivila qui (es. 15 aprile 2026).';
                                            } else if (reqEmpty.indexOf('data-prevista') >= 0) {
                                                proactiveMissingMsg = 'Nel preventivo manca ancora la data prevista del lavoro; compilala nel form o indicamela nel messaggio.';
                                            }
                                        }
                                        window.__tonyProactiveFormState = {
                                            active: true,
                                            type: formCompleteP ? 'ready_for_save' : 'missing_fields',
                                            formId: 'preventivo-form',
                                            modalId: 'preventivo-form',
                                            proactiveMissingMessage: proactiveMissingMsg
                                        };
                                        console.log('[Tony] Timer proattivo preventivo: check eseguito, type=', window.__tonyProactiveFormState.type, 'requiredEmpty=', reqEmpty);
                                        window.__tonyIdleReminderTimerId = setTimeout(function() {
                                            window.__tonyIdleReminderTimerId = null;
                                            if (window.__tonyInjectionInProgress) return;
                                            if (isAnyTonyFormSaveConfirmPending()) return;
                                            var stateP = window.__tonyProactiveFormState;
                                            if (!stateP || !stateP.active || stateP.formId !== 'preventivo-form') return;
                                            if (!document.getElementById('preventivo-form')) {
                                                window.__tonyProactiveFormState = null;
                                                return;
                                            }
                                            if (stateP.type === 'ready_for_save' && typeof window.__tonyTriggerAskForSaveConfirmation === 'function') {
                                                window.__tonyTriggerAskForSaveConfirmation();
                                            } else if (stateP.type === 'missing_fields' && typeof window.__tonyTriggerAskForMissingFields === 'function') {
                                                if (tonyShouldArmProactiveMissingFieldsAsk()) {
                                                    window.__tonyTriggerAskForMissingFields(stateP.proactiveMissingMessage);
                                                }
                                            }
                                            window.__tonyProactiveFormState = null;
                                        }, formCompleteP ? 800 : IDLE_REMINDER_MS);
                                    }
                                    window.__tonyProactiveAskTimerId = setTimeout(function() {
                                        window.__tonyProactiveAskTimerId = null;
                                        runProactiveCheckPreventivo(0);
                                    }, POST_INJECT_CHECK_DELAY_MS);
                                }
                                var cidPrev = fdPrev && fdPrev['cliente-id'];
                                var hadTerrenoPayload = fdPrev && String(fdPrev['terreno-id'] || '').trim() !== '';
                                var terElNow = document.getElementById('terreno-id');
                                var terrenoGiaSelezionato = terElNow && String(terElNow.value || '').trim() !== '';
                                if (ok && cidPrev && !hadTerrenoPayload && !terrenoGiaSelezionato && !injectPreventivoIsDateOnlyUpdate(fdPrev)) {
                                    var checkMultiTerrenoCliente = function(attempt) {
                                        attempt = attempt || 0;
                                        var ps = window.preventivoState;
                                        var listRaw = ps && Array.isArray(ps.terreni) ? ps.terreni : [];
                                        var terEl = document.getElementById('terreno-id');
                                        var terEmpty = !terEl || !String(terEl.value || '').trim();
                                        var hintStr = getPreventivoTerrenoHintString(fdPrev);
                                        var filt = filterPreventivoTerreniForDisambiguation(listRaw, hintStr);
                                        var list = filt.listForAsk;

                                        if (listRaw.length > 1 && terEmpty && list.length > 1) {
                                            var namesM = list.map(preventivoTerrenoNomeDisplay).filter(Boolean);
                                            var fullListFallback = !!(filt.intro && filt.intro.indexOf('Non ho trovato') === 0);
                                            var shortLimit = 5;
                                            if (namesM.length <= shortLimit) {
                                                var qM = buildPreventivoTerrenoChoiceQuestion(namesM);
                                                var chatM = qM;
                                                if (fullListFallback) {
                                                    chatM = filt.intro.replace(/\n/g, ' ').trim() + '\n' + qM;
                                                }
                                                appendPreventivoTerrenoAskAndSpeak(chatM, qM);
                                            } else {
                                                var elencoNomi = namesM.map(function (n) { return '- ' + n; }).join('\n');
                                                var chatLong = (filt.intro ? filt.intro : 'Per questo cliente ci sono molti terreni.\n') + elencoNomi + '\n\n' + 'Indica il nome del terreno che preferisci.';
                                                var voiceLong = 'Ci sono molti terreni per questo cliente. Leggi l\'elenco nella chat e dimmi il nome che preferisci.';
                                                appendPreventivoTerrenoAskAndSpeak(chatLong, voiceLong);
                                            }
                                            window.__tonyPreventivoTerrenoDisambiguation = null;
                                            return;
                                        }
                                        if (listRaw.length > 1 && terEmpty && list.length === 1) {
                                            var nSolo = preventivoTerrenoNomeDisplay(list[0]);
                                            var askOne = (filt.hintTokens ? ('Per «' + filt.hintTokens + '» ho trovato solo ' + nSolo + '. ') : ('Ho trovato solo ' + nSolo + '. ')) + 'Va bene? Selezionalo nel modulo Terreno o scrivilo qui.';
                                            appendPreventivoTerrenoAskAndSpeak(askOne, askOne);
                                            window.__tonyPreventivoTerrenoDisambiguation = null;
                                            return;
                                        }
                                        if (terEmpty && listRaw.length <= 1 && attempt < 10) {
                                            setTimeout(function() { checkMultiTerrenoCliente(attempt + 1); }, 400);
                                            return;
                                        }
                                        proceedPreventivoInjectRest();
                                    };
                                    checkMultiTerrenoCliente(0);
                                    return;
                                }
                                proceedPreventivoInjectRest();
                            });
                        } else if (data.formId === 'attivita-form') {
                            console.log('[Tony] INJECT_FORM_DATA: iniezione formData attività');
                            var formDataAttivita = data.formData;
                            var formCtxAttivita = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                            if (formCtxAttivita && formCtxAttivita.fields && formCtxAttivita.fields.length > 0) {
                                var mergedAtt = Object.assign({}, formDataAttivita);
                                formCtxAttivita.fields.forEach(function(f) {
                                    var hasVal = f.value != null && (f.value === 0 || f.value !== '');
                                    if (f.id && hasVal && !(f.id in formDataAttivita)) {
                                        mergedAtt[f.id] = f.value;
                                    }
                                });
                                if (Object.keys(mergedAtt).length > Object.keys(formDataAttivita).length) {
                                    formDataAttivita = mergedAtt;
                                }
                            }
                            window.TonyFormInjector.injectAttivitaForm(formDataAttivita, ctx).then(function(ok) {
                                window.__tonyInjectionInProgress = false;
                                if (ok) {
                                    console.log('[Tony] Form data iniettato con successo');
                                    if (window.__tonyProactiveAskTimerId) clearTimeout(window.__tonyProactiveAskTimerId);
                                    if (window.__tonyIdleReminderTimerId) { clearTimeout(window.__tonyIdleReminderTimerId); window.__tonyIdleReminderTimerId = null; }
                                    window.__tonyProactiveAskTimerId = setTimeout(function() {
                                        window.__tonyProactiveAskTimerId = null;
                                        var formCtx = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                                        var modalEl = document.getElementById('attivita-modal');
                                        if (!formCtx || !formCtx.formId || !modalEl || !modalEl.classList.contains('active')) return;
                                        var hasRequiredEmpty = formCtx.requiredEmpty && formCtx.requiredEmpty.length > 0;
                                        var formComplete = !hasRequiredEmpty;
                                        window.__tonyProactiveFormState = { active: true, type: formComplete ? 'ready_for_save' : 'missing_fields', formId: 'attivita-form', modalId: 'attivita-modal' };
                                        window.__tonyIdleReminderTimerId = setTimeout(function() {
                                            window.__tonyIdleReminderTimerId = null;
                                            if (window.__tonyInjectionInProgress) return;
                                            var state = window.__tonyProactiveFormState;
                                            if (!state || !state.active) return;
                                            var el = document.getElementById(state.modalId);
                                            if (!el || !el.classList.contains('active')) { window.__tonyProactiveFormState = null; return; }
                                            if (state.type === 'ready_for_save' && typeof window.__tonyTriggerAskForSaveConfirmation === 'function') {
                                                window.__tonyTriggerAskForSaveConfirmation();
                                            } else if (state.type === 'missing_fields' && typeof window.__tonyTriggerAskForMissingFields === 'function') {
                                                if (tonyShouldArmProactiveMissingFieldsAsk()) {
                                                    window.__tonyTriggerAskForMissingFields();
                                                }
                                            }
                                            window.__tonyProactiveFormState = null;
                                        }, IDLE_REMINDER_MS);
                                    }, POST_INJECT_CHECK_DELAY_MS);
                                } else {
                                    console.warn('[Tony] Iniezione formData fallita');
                                }
                            });
                        } else if (data.formId === 'prodotto-form') {
                            console.log('[Tony] INJECT_FORM_DATA: iniezione formData prodotto');
                            var formDataProdotto = data.formData;
                            var formCtxProdotto = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                            if (formCtxProdotto && formCtxProdotto.fields && formCtxProdotto.fields.length > 0) {
                                var mergedPro = Object.assign({}, formDataProdotto);
                                formCtxProdotto.fields.forEach(function(f) {
                                    var hasVal = f.value != null && (f.value === 0 || f.value !== '');
                                    if (f.id && hasVal && !(f.id in formDataProdotto)) {
                                        mergedPro[f.id] = f.value;
                                    }
                                });
                                if (Object.keys(mergedPro).length > Object.keys(formDataProdotto).length) {
                                    formDataProdotto = mergedPro;
                                }
                            }
                            window.TonyFormInjector.injectProdottoForm(formDataProdotto, ctx).then(function(ok) {
                                window.__tonyInjectionInProgress = false;
                                if (ok) {
                                    console.log('[Tony] Form prodotto iniettato con successo');
                                    if (typeof window.__tonySyncProdottoDosaggioCarenzaRequired === 'function') {
                                        window.__tonySyncProdottoDosaggioCarenzaRequired();
                                    }
                                    if (window.__tonyProactiveAskTimerId) clearTimeout(window.__tonyProactiveAskTimerId);
                                    if (window.__tonyIdleReminderTimerId) { clearTimeout(window.__tonyIdleReminderTimerId); window.__tonyIdleReminderTimerId = null; }
                                    window.__tonyProactiveAskTimerId = setTimeout(function() {
                                        window.__tonyProactiveAskTimerId = null;
                                        var formCtx = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                                        var modalEl = document.getElementById('prodotto-modal');
                                        if (!formCtx || formCtx.formId !== 'prodotto-form' || !modalEl || !modalEl.classList.contains('active')) return;
                                        var hasRequiredEmpty = formCtx.requiredEmpty && formCtx.requiredEmpty.length > 0;
                                        var formComplete = magazzinoProactiveReadyForSave('prodotto-form', !!hasRequiredEmpty);
                                        window.__tonyProactiveFormState = { active: true, type: formComplete ? 'ready_for_save' : 'missing_fields', formId: 'prodotto-form', modalId: 'prodotto-modal' };
                                        var idleDelayProdotto = formComplete ? 800 : IDLE_REMINDER_MS;
                                        window.__tonyIdleReminderTimerId = setTimeout(function() {
                                            window.__tonyIdleReminderTimerId = null;
                                            if (window.__tonyInjectionInProgress) return;
                                            if (isAnyTonyFormSaveConfirmPending()) return;
                                            var state = window.__tonyProactiveFormState;
                                            if (!state || !state.active) return;
                                            var el = document.getElementById(state.modalId);
                                            if (!el || !el.classList.contains('active')) { window.__tonyProactiveFormState = null; return; }
                                            if (state.type === 'ready_for_save' && typeof window.__tonyTriggerAskForSaveConfirmation === 'function') {
                                                window.__tonyTriggerAskForSaveConfirmation();
                                            } else if (state.type === 'missing_fields') {
                                                var fcP = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                                                tonyMagazzinoProactiveMissingPrompt('prodotto-form', fcP);
                                            }
                                            window.__tonyProactiveFormState = null;
                                        }, idleDelayProdotto);
                                    }, POST_INJECT_CHECK_DELAY_MS);
                                } else {
                                    console.warn('[Tony] Iniezione form prodotto fallita');
                                }
                            });
                        } else if (data.formId === 'movimento-form') {
                            console.log('[Tony] INJECT_FORM_DATA: iniezione formData movimento');
                            var formDataMov = data.formData;
                            var formCtxMov = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                            if (formCtxMov && formCtxMov.fields && formCtxMov.fields.length > 0) {
                                var mergedMov = Object.assign({}, formDataMov);
                                formCtxMov.fields.forEach(function(f) {
                                    var hasVal = f.value != null && (f.value === 0 || f.value !== '');
                                    if (f.id && hasVal && !(f.id in formDataMov)) {
                                        mergedMov[f.id] = f.value;
                                    }
                                });
                                if (Object.keys(mergedMov).length > Object.keys(formDataMov).length) {
                                    formDataMov = mergedMov;
                                }
                            }
                            window.TonyFormInjector.injectMovimentoForm(formDataMov, ctx).then(function(ok) {
                                window.__tonyInjectionInProgress = false;
                                if (ok) {
                                    console.log('[Tony] Form movimento iniettato con successo');
                                    if (window.__tonyProactiveAskTimerId) clearTimeout(window.__tonyProactiveAskTimerId);
                                    if (window.__tonyIdleReminderTimerId) { clearTimeout(window.__tonyIdleReminderTimerId); window.__tonyIdleReminderTimerId = null; }
                                    window.__tonyProactiveAskTimerId = setTimeout(function() {
                                        window.__tonyProactiveAskTimerId = null;
                                        var formCtxM = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                                        var modalMov = document.getElementById('movimento-modal');
                                        if (!formCtxM || formCtxM.formId !== 'movimento-form' || !modalMov || !modalMov.classList.contains('active')) return;
                                        var hasReqM = formCtxM.requiredEmpty && formCtxM.requiredEmpty.length > 0;
                                        var completeM = magazzinoProactiveReadyForSave('movimento-form', !!hasReqM);
                                        window.__tonyProactiveFormState = { active: true, type: completeM ? 'ready_for_save' : 'missing_fields', formId: 'movimento-form', modalId: 'movimento-modal' };
                                        var idleDelayMov = completeM ? 800 : IDLE_REMINDER_MS;
                                        window.__tonyIdleReminderTimerId = setTimeout(function() {
                                            window.__tonyIdleReminderTimerId = null;
                                            if (window.__tonyInjectionInProgress) return;
                                            if (isAnyTonyFormSaveConfirmPending()) return;
                                            var stateM = window.__tonyProactiveFormState;
                                            if (!stateM || !stateM.active) return;
                                            var elM = document.getElementById(stateM.modalId);
                                            if (!elM || !elM.classList.contains('active')) { window.__tonyProactiveFormState = null; return; }
                                            if (stateM.type === 'ready_for_save' && typeof window.__tonyTriggerAskForSaveConfirmation === 'function') {
                                                window.__tonyTriggerAskForSaveConfirmation();
                                            } else if (stateM.type === 'missing_fields' && typeof window.__tonyTriggerAskForMissingFields === 'function') {
                                                var fcMv = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                                                var reqMv = fcMv && fcMv.requiredEmpty && fcMv.requiredEmpty.length ? fcMv.requiredEmpty : [];
                                                var intMv = fcMv && fcMv.interviewEmpty && fcMv.interviewEmpty.length ? fcMv.interviewEmpty : (fcMv && typeof tonyGetMagazzinoInterviewEmpty === 'function' ? tonyGetMagazzinoInterviewEmpty(fcMv, 'movimento-form') : []);
                                                var msgM = reqMv.length
                                                    ? ('Form movimento: obbligatori mancanti: ' + tonyMagazzinoInterviewLabels(fcMv, reqMv) + '.')
                                                    : (intMv.length ? ('Form movimento: opzionali ancora da completare: ' + tonyMagazzinoInterviewLabels(fcMv, intMv) + '.') : undefined);
                                                window.__tonyTriggerAskForMissingFields(msgM);
                                            }
                                            window.__tonyProactiveFormState = null;
                                        }, idleDelayMov);
                                    }, POST_INJECT_CHECK_DELAY_MS);
                                } else {
                                    console.warn('[Tony] Iniezione form movimento fallita');
                                }
                            });
                        } else if (data.formId === 'terreno-form' || data.formId === 'terreno-modal') {
                            console.log('[Tony] INJECT_FORM_DATA: iniezione formData terreno');
                            var formDataTerreno = data.formData;
                            var formCtxTerreno = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                            if (formCtxTerreno && formCtxTerreno.fields && formCtxTerreno.fields.length > 0) {
                                var mergedTer = Object.assign({}, formDataTerreno);
                                formCtxTerreno.fields.forEach(function (f) {
                                    var hasVal = f.value != null && (f.value === 0 || f.value !== '');
                                    if (f.id && hasVal && !(f.id in formDataTerreno)) {
                                        mergedTer[f.id] = f.value;
                                    }
                                });
                                if (Object.keys(mergedTer).length > Object.keys(formDataTerreno).length) {
                                    formDataTerreno = mergedTer;
                                }
                            }
                            if (!window.TonyFormInjector || typeof window.TonyFormInjector.injectTerrenoForm !== 'function') {
                                window.__tonyInjectionInProgress = false;
                                console.warn('[Tony] INJECT terreno-form: injector assente');
                                break;
                            }
                            window.TonyFormInjector.injectTerrenoForm(formDataTerreno, ctx).then(function (ok) {
                                window.__tonyInjectionInProgress = false;
                                if (ok) {
                                    console.log('[Tony] Form terreno iniettato con successo');
                                    tonyScheduleTerrenoProactiveAfterInject();
                                } else {
                                    console.warn('[Tony] Iniezione form terreno fallita');
                                }
                            });
                        } else if (data.formId === 'zona-form') {
                            console.log('[Tony] INJECT_FORM_DATA: zona-form (traccia segmento lavorato)');
                            var formDataZona = data.formData;
                            if (!document.getElementById('zona-form')) {
                                window.__tonyInjectionInProgress = false;
                                console.warn('[Tony] INJECT zona-form: form assente (apri Traccia segmento da I miei lavori).');
                                break;
                            }
                            window.TonyFormInjector.injectZonaSegmentoForm(formDataZona, ctx).then(function (ok) {
                                window.__tonyInjectionInProgress = false;
                                if (ok) console.log('[Tony] Form zona segmento iniettato');
                                else console.warn('[Tony] Iniezione zona-form fallita');
                            });
                        } else if (data.formId === 'ora-form' || data.formId === 'field-workspace-ore-form') {
                            console.log('[Tony] INJECT_FORM_DATA: ora-form / workspace mobile ore');
                            var formDataOra = tonySanitizeCfWorkspaceOraFormData(data.formData);
                            formDataOra = tonyResolveOraLavoroForQuickHours(formDataOra, tonyBuildSegnaOraUserBlobLastNUserTurns(6));
                            if (!document.getElementById('ora-form') && !tonyResolveQuickHoursWindow()) {
                                if (getTonyFieldProfileFromContext() && tonyModuliAttiviIncludeManodopera() && window.Tony && typeof window.Tony.triggerAction === 'function') {
                                    var fdNav = (formDataOra && typeof formDataOra === 'object') ? Object.assign({}, formDataOra) : {};
                                    fdNav = tonyMapAttivitaFieldsToSegnaOra(fdNav);
                                    fdNav = tonyResolveOraLavoroForQuickHours(fdNav, tonyBuildSegnaOraUserBlobLastNUserTurns(6));
                                    window.__tonyInjectionInProgress = false;
                                    console.log('[Tony] INJECT ora-form: form assente — navigo a workspace campo (Segna ore inline)');
                                    window.Tony.triggerAction('APRI_PAGINA', {
                                        target: 'workspace campo',
                                        _tonyPendingModal: 'quick-hours-form',
                                        _tonyPendingFields: Object.keys(fdNav).length > 0 ? fdNav : null
                                    });
                                    break;
                                }
                                if (tonyModuliAttiviIncludeManodopera() && !getTonyFieldProfileFromContext()) {
                                    window.__tonyInjectionInProgress = false;
                                    console.log('[Tony] INJECT ora-form ignorato: Segna ore riservato a operai/caposquadra');
                                    break;
                                }
                                if (window.Tony && typeof window.Tony.triggerAction === 'function') {
                                    window.__tonyInjectionInProgress = false;
                                    console.log('[Tony] INJECT ora-form: form assente — navigo a Segna ore standalone');
                                    window.Tony.triggerAction('APRI_PAGINA', {
                                        target: 'segnatura ore',
                                        _tonyPendingModal: 'ora-modal',
                                        _tonyPendingFields: (formDataOra && typeof formDataOra === 'object' && Object.keys(formDataOra).length > 0) ? formDataOra : null
                                    });
                                    break;
                                }
                                window.__tonyInjectionInProgress = false;
                                console.warn('[Tony] INJECT ora-form: nessun form ore nel DOM (Segna ore standalone o workspace mobile).');
                                break;
                            }
                            var qhWinOraInj = tonyResolveQuickHoursWindow();
                            var injectOraPromise;
                            if (qhWinOraInj && window.TonyFormInjector &&
                                typeof window.TonyFormInjector.injectFieldWorkspaceQuickHoursForm === 'function') {
                                injectOraPromise = window.TonyFormInjector.injectFieldWorkspaceQuickHoursForm(
                                    formDataOra, ctx, { targetWindow: qhWinOraInj }
                                );
                            } else if (window.TonyFormInjector &&
                                typeof window.TonyFormInjector.injectSegnaOraForm === 'function') {
                                injectOraPromise = window.TonyFormInjector.injectSegnaOraForm(formDataOra, ctx);
                            } else {
                                window.__tonyInjectionInProgress = false;
                                console.warn('[Tony] INJECT ora-form: injector assente');
                                break;
                            }
                            Promise.resolve(injectOraPromise).then(function (ok) {
                                window.__tonyInjectionInProgress = false;
                                if (ok) {
                                    console.log('[Tony] Form segna ora iniettato');
                                    var cfSaveAsk = window.__tonyQuickHoursCfAskedSaveAt &&
                                        (Date.now() - window.__tonyQuickHoursCfAskedSaveAt) < 15000;
                                    if (!cfSaveAsk) tonyPromptSaveAfterQuickHoursInject();
                                } else {
                                    console.warn('[Tony] Iniezione ora-form fallita');
                                    try {
                                        var _schedFail = tonyResolveQuickHoursProactiveScheduleWindow();
                                        if (_schedFail && typeof _schedFail.__tonyScheduleQuickHoursProactiveAfterUserTurn === 'function') {
                                            _schedFail.__tonyScheduleQuickHoursProactiveAfterUserTurn();
                                        }
                                    } catch (eQh) { /* ignore */ }
                                }
                            });
                        } else if (data.formId === 'form-trattamento' || data.formId === 'trattamento-concimazione-form') {
                            var fdTratt0 = data.formData;
                            var ctxTratt0 = ctx;
                            var tryInjectTrattamento = function(attempt) {
                                attempt = attempt || 0;
                                var formTratt = document.getElementById('form-trattamento');
                                var modalTratt = document.getElementById('modal-trattamento');
                                var active = modalTratt && modalTratt.classList.contains('active');
                                if (formTratt && modalTratt && !active && attempt < 15) {
                                    setTimeout(function() { tryInjectTrattamento(attempt + 1); }, 100);
                                    return;
                                }
                                if (!formTratt || !modalTratt || !active) {
                                    window.__tonyInjectionInProgress = false;
                                    console.warn('[Tony] INJECT form-trattamento: apri prima «Completa» dalla lista concimazioni/trattamenti.');
                                    return;
                                }
                                var fdTratt = fdTratt0;
                                var formCtxTratt = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                                if (formCtxTratt && formCtxTratt.fields && fdTratt) {
                                    var mergedTratt = Object.assign({}, fdTratt);
                                    formCtxTratt.fields.forEach(function(f) {
                                        if (!f || !f.id) return;
                                        // Non copiare checkbox dal DOM se il comando Cloud Function non le ha incluse:
                                        // nel contesto `value` è spesso `false` (non spuntato) ma `hasVal` risulta true,
                                        // e si reiniettava sempre false sovrascrivendo un eventuale true dal modello.
                                        var skipCheckboxMerge =
                                            (f.id === 'trattamento-superficie-anagrafe' ||
                                                f.id === 'trattamento-prosegue-precedente' ||
                                                f.id === 'trattamento-registra-scarico-magazzino') &&
                                            !(f.id in fdTratt);
                                        if (skipCheckboxMerge) return;
                                        var hasVal = f.value != null && (f.value === 0 || f.value !== '');
                                        if (hasVal && !(f.id in fdTratt)) mergedTratt[f.id] = f.value;
                                    });
                                    if (Object.keys(mergedTratt).length > Object.keys(fdTratt).length) fdTratt = mergedTratt;
                                }
                                window.TonyFormInjector.injectTrattamentoCampoForm(fdTratt, ctxTratt0).then(function(ok) {
                                    window.__tonyInjectionInProgress = false;
                                    if (ok) console.log('[Tony] Form trattamento campo iniettato');
                                    else console.warn('[Tony] Iniezione form trattamento campo fallita');
                                    // Nessun timer proattivo «Form completo, confermi salvataggio?» qui: dopo ~10s inviava un secondo
                                    // messaggio alla CF mentre l’utente stava ancora leggendo / rispondendo alla domanda su
                                    // anagrafe/scarico, causava inject duplicati o comandi errati (es. attivita-form). La CF
                                    // già invita a «ok salva» nel replyText; l’utente conferma quando vuole.
                                });
                            };
                            if (!document.getElementById('form-trattamento')) {
                                window.__tonyInjectionInProgress = false;
                                console.warn('[Tony] INJECT form-trattamento: form assente dalla pagina.');
                                break;
                            }
                            tryInjectTrattamento(0);
                        } else {
                            window.__tonyInjectionInProgress = false;
                            console.warn('[Tony] INJECT_FORM_DATA: formId non supportato:', data.formId);
                        }
                    } else {
                        window.__tonyInjectionInProgress = false;
                        console.warn('[Tony] INJECT_FORM_DATA: formData vuoto o injector non caricato');
                    }
                    break;
                case 'OPEN_MODAL':
                    console.log('[DEBUG CURSOR] processTonyCommand: Caso OPEN_MODAL');
                    var modalId = data.id || data.target;
                    console.log('[DEBUG CURSOR] processTonyCommand: modalId originale:', modalId);
                    
                    if (modalId && isTonyOpenModalBlockedForFieldProfile(modalId)) {
                        console.warn('[Tony] OPEN_MODAL bloccato per profilo campo:', modalId);
                        tonyNotifyFieldProfileBlocked('modal', modalId);
                        break;
                    }

                    var _mkQuick = (modalId || '').toString().toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
                    var _isOraModalQuick = modalId === 'ora-modal' || _mkQuick === 'ora-modal' || MODAL_ID_FALLBACK[modalId] === 'ora-modal' || MODAL_ID_FALLBACK[_mkQuick] === 'ora-modal';
                    if (modalId && _isOraModalQuick && tonyResolveQuickHoursWindow()) {
                        var _oraWsFlds = (data.fields && typeof data.fields === 'object') ? tonySanitizeCfWorkspaceOraFormData(data.fields) : null;
                        if (_oraWsFlds && typeof _oraWsFlds === 'object') {
                            _oraWsFlds = tonyResolveOraLavoroForQuickHours(_oraWsFlds, tonyBuildSegnaOraUserBlobLastNUserTurns(6));
                        }
                        var _qhTwOra = tonyResolveQuickHoursWindow();
                        if (window.TonyFormInjector && typeof window.TonyFormInjector.injectFieldWorkspaceQuickHoursForm === 'function' && _qhTwOra) {
                            window.TonyFormInjector.injectFieldWorkspaceQuickHoursForm(_oraWsFlds || {}, window.Tony && window.Tony.context, { targetWindow: _qhTwOra }).then(function (okOraWs) {
                                if (okOraWs) console.log('[Tony] Ore compilate sul form inline workspace mobile (stessa schermata Segna ore).');
                            });
                        }
                        break;
                    }
                    // Su pagine senza quick-hours (es. lavori-caposquadra embed): non usare fallback «segnatura ore» se profilo campo + manodopera — stesso meccanismo APRI_PAGINA + pending quick-hours-form del workspace mobile.
                    if (modalId) {
                        var _mkPre = (modalId || '').toString().toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
                        var _resolvedOraEarly = MODAL_ID_FALLBACK[modalId] || MODAL_ID_FALLBACK[_mkPre] || modalId;
                        if (_resolvedOraEarly === 'ora-modal' && !tonyResolveQuickHoursWindow() && getTonyFieldProfileFromContext() && tonyModuliAttiviIncludeManodopera() && window.Tony && typeof window.Tony.triggerAction === 'function') {
                            var _oraNavFlds = (data.fields && typeof data.fields === 'object') ? Object.assign({}, data.fields) : {};
                            _oraNavFlds = tonyMapAttivitaFieldsToSegnaOra(_oraNavFlds);
                            _oraNavFlds = tonyResolveOraLavoroForQuickHours(_oraNavFlds, tonyBuildSegnaOraUserBlobLastNUserTurns(6));
                            console.log('[Tony] OPEN_MODAL ora-modal senza form inline: navigo a workspace campo (quick-hours-form)');
                            window.Tony.triggerAction('APRI_PAGINA', {
                                target: 'workspace campo',
                                _tonyPendingModal: 'quick-hours-form',
                                _tonyPendingFields: Object.keys(_oraNavFlds).length > 0 ? _oraNavFlds : null
                            });
                            break;
                        }
                    }

                    if (modalId) {
                        var resolvedId = modalId;
                        var modalKey = (modalId || '').toString().toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
                        console.log('[DEBUG CURSOR] processTonyCommand: modalKey normalizzato:', modalKey);
                        
                        // Verifica se l'ID esiste nel DOM
                        var originalExists = !!document.getElementById(modalId);
                        console.log('[DEBUG CURSOR] processTonyCommand: Modal con ID originale esiste nel DOM:', originalExists);
                        
                        // Se attivita-modal richiesto ma non esiste (es. dashboard): Diario — salvo che i campi siano chiaramente Nuovo Preventivo (errore comune del modello).
                        if ((modalId === 'attivita-modal' || (modalKey && modalKey.indexOf('attivita') >= 0)) && !document.getElementById('attivita-modal')) {
                            var modalTrattamentoAttivo = (function() {
                                var m = document.getElementById('modal-trattamento');
                                return m && m.classList.contains('active');
                            })();
                            if (modalTrattamentoAttivo) {
                                console.log('[Tony] OPEN_MODAL attivita-modal ignorato: aperto modal Completa trattamento/concimazione campo (usa INJECT su form-trattamento).');
                                break;
                            }
                            if (tonyOpenModalShouldRouteToPreventivo(data.fields) && window.Tony && typeof window.Tony.triggerAction === 'function') {
                                console.log('[Tony] OPEN_MODAL attivita-modal → Nuovo Preventivo (campi preventivo o ultimo messaggio utente)');
                                window.Tony.triggerAction('APRI_PAGINA', {
                                    target: 'nuovo preventivo',
                                    _tonyPendingModal: 'preventivo-form',
                                    _tonyPendingFields: (data.fields && typeof data.fields === 'object') ? data.fields : null
                                });
                                break;
                            }
                            if (window.Tony && typeof window.Tony.triggerAction === 'function') {
                                var _fpAtt = getTonyFieldProfileFromContext();
                                var _man = tonyModuliAttiviIncludeManodopera();
                                var _pendingFields = (data.fields && typeof data.fields === 'object') ? data.fields : null;
                                if (_fpAtt && _man) {
                                    _pendingFields = tonyMapAttivitaFieldsToSegnaOra(_pendingFields || {});
                                    if (_pendingFields && _pendingFields['attivita-tipo-lavoro'] && !_pendingFields['ora-note']) {
                                        var _noteAtt = String(_pendingFields['attivita-tipo-lavoro']);
                                        if (_pendingFields['attivita-ore']) _noteAtt += ' — ' + _pendingFields['attivita-ore'] + ' ore';
                                        _pendingFields['ora-note'] = _noteAtt;
                                    }
                                    _pendingFields = tonyResolveOraLavoroForQuickHours(_pendingFields, tonyBuildSegnaOraUserBlobLastNUserTurns(6));
                                }
                                if (_man && !_fpAtt) {
                                    console.log('[Tony] OPEN_MODAL attivita-modal ignorato: manodopera attivo, profilo manager (né diario né Segna ore)');
                                    break;
                                }
                                var _attNavTarget = _fpAtt ? 'workspace campo' : 'attivita';
                                var _pendModal = _fpAtt ? (_man ? 'quick-hours-form' : null) : 'attivita-modal';
                                console.log('[Tony] Modal attività non presente in questa pagina, apro', _attNavTarget);
                                window.Tony.triggerAction('APRI_PAGINA', {
                                    target: _attNavTarget,
                                    _tonyPendingModal: _pendModal,
                                    _tonyPendingFields: _pendingFields && typeof _pendingFields === 'object' && Object.keys(_pendingFields).length > 0 ? _pendingFields : null
                                });
                                break;
                            }
                        }

                        if (modalId === 'lavoro-modal' && !document.getElementById('lavoro-modal')) {
                            if (tonyOpenModalShouldRouteToPreventivo(data.fields) && window.Tony && typeof window.Tony.triggerAction === 'function') {
                                console.log('[Tony] OPEN_MODAL lavoro-modal → Nuovo Preventivo (campi preventivo o ultimo messaggio utente, non Gestione Lavori)');
                                window.Tony.triggerAction('APRI_PAGINA', {
                                    target: 'nuovo preventivo',
                                    _tonyPendingModal: 'preventivo-form',
                                    _tonyPendingFields: (data.fields && typeof data.fields === 'object') ? data.fields : null
                                });
                                break;
                            }
                        }

                        var wantsPreventivoPage = (
                            modalId === 'preventivo-form' ||
                            modalKey === 'preventivo-form' ||
                            modalKey === 'nuovo-preventivo' ||
                            modalKey === 'preventivo' ||
                            (modalKey.indexOf('nuovo') >= 0 && modalKey.indexOf('preventivo') >= 0)
                        );
                        if (wantsPreventivoPage) {
                            var pfOpen = document.getElementById('preventivo-form');
                            if (pfOpen) {
                                if (data.fields && typeof data.fields === 'object' && Object.keys(data.fields).length > 0 && window.TonyFormInjector) {
                                    enqueueTonyCommand({ type: 'INJECT_FORM_DATA', formId: 'preventivo-form', formData: data.fields }, { source: 'open-preventivo-on-page', delayMs: 900 });
                                }
                                break;
                            }
                            if (window.Tony && typeof window.Tony.triggerAction === 'function') {
                                console.log('[Tony] Form preventivo non in pagina, apro Nuovo Preventivo');
                                window.Tony.triggerAction('APRI_PAGINA', {
                                    target: 'nuovo preventivo',
                                    _tonyPendingModal: 'preventivo-form',
                                    _tonyPendingFields: (data.fields && typeof data.fields === 'object') ? data.fields : null
                                });
                                break;
                            }
                        }
                        
                        if (!originalExists && (MODAL_ID_FALLBACK[modalId] || MODAL_ID_FALLBACK[modalKey])) {
                            resolvedId = MODAL_ID_FALLBACK[modalId] || MODAL_ID_FALLBACK[modalKey];
                            console.log('[DEBUG CURSOR] processTonyCommand: ID non trovato, fallback da', modalId, '→', resolvedId);
                            console.log('[Tony] OPEN_MODAL: ID non trovato, fallback da', modalId, '→', resolvedId);
                        }
                        
                        console.log('[DEBUG CURSOR] processTonyCommand: resolvedId finale:', resolvedId);
                        console.log('[DEBUG CURSOR] processTonyCommand: Verifica esistenza modal nel DOM...');
                        var modalExists = !!document.getElementById(resolvedId);
                        console.log('[DEBUG CURSOR] processTonyCommand: Modal con resolvedId esiste:', modalExists);
                        
                        // Lista tutti i modal presenti nel DOM per debug
                        var allModals = document.querySelectorAll('.modal, [id*="modal"], [id*="Modal"]');
                        console.log('[DEBUG CURSOR] processTonyCommand: Tutti i modal trovati nel DOM:', Array.from(allModals).map(function(m) { return m.id || '(senza id)'; }));
                        
                        console.log('[Tony] Apertura modal:', resolvedId);
                        var opened = false;
                        if (resolvedId === 'prodotto-modal') {
                            var btnNuovoProd = document.getElementById('btn-nuovo-prodotto');
                            if (btnNuovoProd) {
                                btnNuovoProd.click();
                                opened = true;
                                console.log('[Tony] Apertura prodotto-modal via btn-nuovo-prodotto (form reset)');
                            }
                        } else if (resolvedId === 'movimento-modal') {
                            var btnNuovoMov = document.getElementById('btn-nuovo-movimento');
                            if (btnNuovoMov) {
                                btnNuovoMov.click();
                                opened = true;
                                console.log('[Tony] Apertura movimento-modal via btn-nuovo-movimento (form reset)');
                            }
                        }
                        if (!opened && $ && $.fn && $.fn.modal) {
                            console.log('[DEBUG CURSOR] processTonyCommand: Uso jQuery per aprire modal');
                            var $modal = $('#' + resolvedId);
                            console.log('[DEBUG CURSOR] processTonyCommand: jQuery selector trovato:', $modal.length, 'elementi');
                            if ($modal.length) {
                                $modal.modal('show');
                                opened = true;
                                console.log('[DEBUG CURSOR] processTonyCommand: Modal aperto con jQuery');
                            } else {
                                console.warn('[DEBUG CURSOR] processTonyCommand: jQuery selector non ha trovato elementi');
                            }
                        } else if (!opened) {
                            console.log('[DEBUG CURSOR] processTonyCommand: Uso metodo nativo per aprire modal');
                            var modalEl = document.getElementById(resolvedId);
                            console.log('[DEBUG CURSOR] processTonyCommand: Elemento trovato:', !!modalEl);
                            if (modalEl) {
                                modalEl.classList.add('active');
                                opened = true;
                                console.log('[DEBUG CURSOR] processTonyCommand: Classe "active" aggiunta al modal');
                            } else {
                                console.warn('[DEBUG CURSOR] processTonyCommand: Elemento modal non trovato con getElementById');
                            }
                        }
                        if (opened) {
                            _lastModalOpenTime = Date.now();
                            console.log('[DEBUG CURSOR] processTonyCommand: Modal aperto con successo, _lastModalOpenTime aggiornato');
                            if (resolvedId === 'attivita-modal') {
                                function tryOpenAttivitaModal(retries) {
                                    retries = retries || 0;
                                    if (typeof window.openAttivitaModal === 'function') {
                                        console.log('[Tony] Inizializzo modal attività (popolamento dropdown categoria/tipi)');
                                        window.openAttivitaModal().catch(function(e) {
                                            console.warn('[Tony] openAttivitaModal fallito:', e);
                                        });
                                        enqueueTonyCommand({ type: '_WAIT_MODAL_READY' }, { source: 'post-open-attivita', delayMs: 1200 });
                                    } else if (retries < 5) {
                                        setTimeout(function() { tryOpenAttivitaModal(retries + 1); }, 300);
                                    }
                                }
                                tryOpenAttivitaModal();
                            } else if (resolvedId === 'lavoro-modal') {
                                if (typeof window.openCreaModal === 'function') {
                                    console.log('[Tony] Inizializzo modal lavoro (popolamento dropdown)');
                                    window.__tonyLavoroCreationFlow = true;
                                    if (window.TonyFormInjector && typeof window.TonyFormInjector.resetLavoroInterviewSessionState === 'function') {
                                        window.TonyFormInjector.resetLavoroInterviewSessionState();
                                    } else {
                                        window.__tonyLavoroAssignModeConfirmed = false;
                                    }
                                    window.openCreaModal();
                                    enqueueTonyCommand({ type: '_WAIT_MODAL_READY' }, { source: 'post-open-lavoro', delayMs: 800 });
                                }
                            } else if (resolvedId === 'terreno-modal') {
                                if (typeof window.openTerrenoModal === 'function') {
                                    console.log('[Tony] Inizializzo modal terreno (popolamento poderi/colture)');
                                    window.openTerrenoModal(null).catch(function(e) {
                                        console.warn('[Tony] openTerrenoModal fallito:', e);
                                    });
                                    enqueueTonyCommand({ type: '_WAIT_MODAL_READY' }, { source: 'post-open-terreno', delayMs: 1500 });
                                }
                            } else if (resolvedId === 'ora-modal') {
                                if (typeof window.openSegnaOraModal === 'function') {
                                    console.log('[Tony] Inizializzo modal Segna ora (dropdown lavori)');
                                    window.openSegnaOraModal(null);
                                    enqueueTonyCommand({ type: '_WAIT_MODAL_READY' }, { source: 'post-open-ora', delayMs: 900 });
                                }
                            }
                            // Supporto fields: INJECT_FORM_DATA atomico per attivita/lavoro/magazzino (evita perdita compilazione)
                            if (data.fields && typeof data.fields === 'object' && Object.keys(data.fields).length > 0) {
                                var fieldsObj = data.fields;
                                if ((resolvedId === 'attivita-modal' || resolvedId === 'lavoro-modal' || resolvedId === 'prodotto-modal' || resolvedId === 'movimento-modal' || resolvedId === 'terreno-modal' || resolvedId === 'ora-modal') && window.TonyFormInjector) {
                                    var formId = resolvedId === 'attivita-modal' ? 'attivita-form' : resolvedId === 'lavoro-modal' ? 'lavoro-form' : resolvedId === 'prodotto-modal' ? 'prodotto-form' : resolvedId === 'ora-modal' ? 'ora-form' : resolvedId === 'terreno-modal' ? 'terreno-form' : 'movimento-form';
                                    var delayMag = (resolvedId === 'prodotto-modal' || resolvedId === 'movimento-modal') ? 1200 : (resolvedId === 'terreno-modal' ? 1500 : (resolvedId === 'ora-modal' ? 1400 : (resolvedId === 'lavoro-modal' ? 350 : 1800)));
                                    enqueueTonyCommand({ type: 'INJECT_FORM_DATA', formId: formId, formData: fieldsObj }, { source: 'open-modal-fields', delayMs: delayMag });
                                } else {
                                    var formMap = (typeof TONY_FORM_MAPPING !== 'undefined' && TONY_FORM_MAPPING.getFormMap) ? TONY_FORM_MAPPING.getFormMap(resolvedId) : null;
                                    var fieldOrder = (formMap && formMap.injectionOrder) ? formMap.injectionOrder : (resolvedId === 'terreno-modal' ? ['terreno-nome', 'terreno-superficie', 'terreno-coltura-categoria', 'terreno-coltura', 'terreno-podere', 'terreno-tipo-possesso', 'terreno-data-scadenza-affitto', 'terreno-canone-affitto', 'terreno-note'] : Object.keys(fieldsObj));
                                    var idx = 0;
                                    for (var i = 0; i < fieldOrder.length; i++) {
                                        var fk = fieldOrder[i];
                                        if (fieldsObj[fk] != null && fieldsObj[fk] !== '') {
                                            enqueueTonyCommand({ type: 'SET_FIELD', field: fk, value: String(fieldsObj[fk]) }, { source: 'open-modal-fields', delayMs: 1600 + (idx * 250) });
                                            idx++;
                                        }
                                    }
                                }
                            }
                            // Magazzino: OPEN_MODAL senza campi compilabili → stessi timer del post-INJECT (Tony deve chiedere nome, ecc.)
                            var magOpenFields = data.fields && typeof data.fields === 'object' ? data.fields : null;
                            var hasMagazzinoOpenPayload = magOpenFields && Object.keys(magOpenFields).some(function(k) {
                                var vv = magOpenFields[k];
                                return vv != null && String(vv).trim() !== '';
                            });
                            if ((resolvedId === 'prodotto-modal' || resolvedId === 'movimento-modal') && !hasMagazzinoOpenPayload) {
                                var fidMagOpen = resolvedId === 'prodotto-modal' ? 'prodotto-form' : 'movimento-form';
                                var midMagOpen = resolvedId;
                                if (window.__tonyProactiveAskTimerId) clearTimeout(window.__tonyProactiveAskTimerId);
                                if (window.__tonyIdleReminderTimerId) { clearTimeout(window.__tonyIdleReminderTimerId); window.__tonyIdleReminderTimerId = null; }
                                window.__tonyProactiveAskTimerId = setTimeout(function() {
                                    window.__tonyProactiveAskTimerId = null;
                                    if (window.__tonyInjectionInProgress) return;
                                    var gcfMag = window.__tonyGetCurrentFormContext;
                                    var fcMagOpen = typeof gcfMag === 'function' ? gcfMag() : null;
                                    var mElMagOpen = document.getElementById(midMagOpen);
                                    if (!fcMagOpen || fcMagOpen.formId !== fidMagOpen || !mElMagOpen || !mElMagOpen.classList.contains('active')) return;
                                    var hasReqMagOpen = fcMagOpen.requiredEmpty && fcMagOpen.requiredEmpty.length > 0;
                                    var doneMagOpen = magazzinoProactiveReadyForSave(fidMagOpen, !!hasReqMagOpen);
                                    window.__tonyProactiveFormState = { active: true, type: doneMagOpen ? 'ready_for_save' : 'missing_fields', formId: fidMagOpen, modalId: midMagOpen };
                                    window.__tonyIdleReminderTimerId = setTimeout(function() {
                                        window.__tonyIdleReminderTimerId = null;
                                        if (window.__tonyInjectionInProgress) return;
                                        var stMagOpen = window.__tonyProactiveFormState;
                                        if (!stMagOpen || !stMagOpen.active) return;
                                        var elMagOpen2 = document.getElementById(stMagOpen.modalId);
                                        if (!elMagOpen2 || !elMagOpen2.classList.contains('active')) { window.__tonyProactiveFormState = null; return; }
                                        var gcfMag2 = window.__tonyGetCurrentFormContext;
                                        var fcMag2 = typeof gcfMag2 === 'function' ? gcfMag2() : null;
                                        var reqMag2 = fcMag2 && fcMag2.requiredEmpty && fcMag2.requiredEmpty.length ? fcMag2.requiredEmpty : [];
                                        var intMag2 = fcMag2 && fcMag2.interviewEmpty && fcMag2.interviewEmpty.length ? fcMag2.interviewEmpty : (fcMag2 && typeof tonyGetMagazzinoInterviewEmpty === 'function' ? tonyGetMagazzinoInterviewEmpty(fcMag2, fidMagOpen) : []);
                                        if (stMagOpen.type === 'ready_for_save' && typeof window.__tonyTriggerAskForSaveConfirmation === 'function') {
                                            window.__tonyTriggerAskForSaveConfirmation();
                                        } else if (stMagOpen.type === 'missing_fields' && typeof window.__tonyTriggerAskForMissingFields === 'function') {
                                            var prefMag = fidMagOpen === 'prodotto-form' ? 'Form prodotto: ' : 'Form movimento: ';
                                            var msgMagOpen = reqMag2.length
                                                ? (prefMag + 'obbligatori mancanti: ' + tonyMagazzinoInterviewLabels(fcMag2, reqMag2) + '.')
                                                : (intMag2.length ? (prefMag + (fidMagOpen === 'prodotto-form' ? 'indica ancora ' : 'opzionali: ') + tonyMagazzinoInterviewLabels(fcMag2, intMag2) + '.') : undefined);
                                            window.__tonyTriggerAskForMissingFields(msgMagOpen);
                                        }
                                        window.__tonyProactiveFormState = null;
                                    }, IDLE_REMINDER_MS);
                                }, POST_INJECT_CHECK_DELAY_MS);
                            }
                            var terOpenFields = data.fields && typeof data.fields === 'object' ? data.fields : null;
                            var hasTerrenoOpenPayload = terOpenFields && Object.keys(terOpenFields).some(function (k) {
                                var vv = terOpenFields[k];
                                return vv != null && String(vv).trim() !== '';
                            });
                            if (resolvedId === 'terreno-modal' && !hasTerrenoOpenPayload) {
                                if (window.__tonyProactiveAskTimerId) clearTimeout(window.__tonyProactiveAskTimerId);
                                if (window.__tonyIdleReminderTimerId) { clearTimeout(window.__tonyIdleReminderTimerId); window.__tonyIdleReminderTimerId = null; }
                                window.__tonyProactiveAskTimerId = setTimeout(function () {
                                    window.__tonyProactiveAskTimerId = null;
                                    if (window.__tonyInjectionInProgress) return;
                                    var gcfTer = window.__tonyGetCurrentFormContext;
                                    var fcTerOpen = typeof gcfTer === 'function' ? gcfTer() : null;
                                    var mElTerOpen = document.getElementById('terreno-modal');
                                    if (!fcTerOpen || fcTerOpen.formId !== 'terreno-form' || !mElTerOpen || !mElTerOpen.classList.contains('active')) return;
                                    var hasReqTerOpen = fcTerOpen.requiredEmpty && fcTerOpen.requiredEmpty.length > 0;
                                    var doneTerOpen = terrenoProactiveReadyForSave('terreno-form', !!hasReqTerOpen);
                                    window.__tonyProactiveFormState = { active: true, type: doneTerOpen ? 'ready_for_save' : 'missing_fields', formId: 'terreno-form', modalId: 'terreno-modal' };
                                    window.__tonyIdleReminderTimerId = setTimeout(function () {
                                        window.__tonyIdleReminderTimerId = null;
                                        if (window.__tonyInjectionInProgress) return;
                                        var stTerOpen = window.__tonyProactiveFormState;
                                        if (!stTerOpen || !stTerOpen.active) return;
                                        var elTerOpen2 = document.getElementById(stTerOpen.modalId);
                                        if (!elTerOpen2 || !elTerOpen2.classList.contains('active')) { window.__tonyProactiveFormState = null; return; }
                                        if (stTerOpen.type === 'ready_for_save' && typeof window.__tonyTriggerAskForSaveConfirmation === 'function') {
                                            window.__tonyTriggerAskForSaveConfirmation();
                                        } else if (stTerOpen.type === 'missing_fields') {
                                            var fcTer2 = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                                            tonyTerrenoProactiveMissingPrompt(fcTer2);
                                        }
                                        window.__tonyProactiveFormState = null;
                                    }, IDLE_REMINDER_MS);
                                }, POST_INJECT_CHECK_DELAY_MS);
                            }
                            setTimeout(function() {
                                console.log('[DEBUG CURSOR] processTonyCommand: Timeout 500ms scaduto, modal dovrebbe essere visibile');
                                console.log('[Tony] Modal pronto, ora i campi dovrebbero essere rilevabili.');
                            }, 500);
                        } else {
                            console.error('[DEBUG CURSOR] processTonyCommand: ERRORE - Modal NON aperto!');
                            console.error('[DEBUG CURSOR] processTonyCommand: ID provati:', modalId, resolvedId);
                            console.error('[DEBUG CURSOR] processTonyCommand: Elementi .modal presenti:', document.querySelectorAll('.modal').length);
                            console.error('[Tony] OPEN_MODAL FALLITO: modal non trovato nel DOM. ID provati:', modalId, resolvedId, 'Elementi .modal presenti:', document.querySelectorAll('.modal').length);
                            
                            // FALLBACK: Se il modal non esiste, prova ad aprire la pagina corrispondente
                            var pageMap = {
                                'attivita-modal': 'attivita',
                                'ora-modal': 'segnatura ore',
                                'lavoro-modal': 'lavori',
                                'terreno-modal': 'terreni',
                                'prodotto-modal': 'prodotti',
                                'movimento-modal': 'movimenti',
                                'cliente-modal': 'clienti',
                                'vigneto-modal': 'vigneti',
                                'frutteto-modal': 'frutteti',
                                'preventivo-form': 'nuovo preventivo'
                            };
                            
                            var pageTarget = pageMap[resolvedId] || pageMap[modalId];
                            if (pageTarget && window.Tony && typeof window.Tony.triggerAction === 'function') {
                                var pendingModalId = resolvedId;
                                var pendingTarget = pageTarget;
                                if (tonyOpenModalShouldRouteToPreventivo(data.fields) && (resolvedId === 'attivita-modal' || modalId === 'attivita-modal' || resolvedId === 'lavoro-modal' || modalId === 'lavoro-modal')) {
                                    pendingModalId = 'preventivo-form';
                                    pendingTarget = 'nuovo preventivo';
                                }
                                if (resolvedId === 'preventivo-form' || modalKey === 'preventivo-form' || modalKey === 'nuovo-preventivo') {
                                    pendingModalId = 'preventivo-form';
                                    pendingTarget = 'nuovo preventivo';
                                }
                                if ((resolvedId === 'ora-modal' || modalId === 'ora-modal') && getTonyFieldProfileFromContext() && tonyModuliAttiviIncludeManodopera()) {
                                    pendingModalId = 'quick-hours-form';
                                    pendingTarget = 'workspace campo';
                                    var _oraFbFlds = (data.fields && typeof data.fields === 'object') ? Object.assign({}, data.fields) : {};
                                    _oraFbFlds = tonyMapAttivitaFieldsToSegnaOra(_oraFbFlds);
                                    _oraFbFlds = tonyResolveOraLavoroForQuickHours(_oraFbFlds, tonyBuildSegnaOraUserBlobLastNUserTurns(6));
                                    data = Object.assign({}, data, { fields: _oraFbFlds });
                                }
                                console.log('[Tony] Fallback: Modal non trovato, apro pagina:', pendingTarget);
                                window.Tony.triggerAction('APRI_PAGINA', {
                                    target: pendingTarget,
                                    _tonyPendingModal: pendingModalId,
                                    _tonyPendingFields: (data.fields && typeof data.fields === 'object') ? data.fields : null
                                });
                            } else {
                                console.warn('[Tony] Fallback non disponibile per modal:', resolvedId);
                            }
                        }
                    } else {
                        console.warn('[DEBUG CURSOR] processTonyCommand: OPEN_MODAL senza id o target');
                        console.warn('[Tony] OPEN_MODAL: nessun id o target fornito.');
                    }
                    break;

                case 'SET_FIELD':
                    console.log('[DEBUG CURSOR] processTonyCommand: Caso SET_FIELD');
                    var fieldId = data.field || data.id;
                    var value = data.value;
                    
                    // INTERCETTAZIONE SMART FILLER (Prioritaria)
                    // Se stiamo impostando il tipo lavoro gerarchico, deleghiamo SUBITO al SmartFormFiller
                    // e impediamo l'esecuzione standard che fallirebbe su un dropdown vuoto.
                    if (fieldId === 'attivita-tipo-lavoro-gerarchico' && window.SmartFormFiller) {
                        console.log('[Tony] Intercettato SET_FIELD per SmartFormFiller:', fieldId, value);
                        var filler = new SmartFormFiller();
                        var context = window.Tony ? window.Tony.context : {};
                        
                        // Esegui in background (non blocchiamo il thread UI)
                        filler.fillField(fieldId, value, context).then(function(success) {
                            console.log('[Tony] SmartFormFiller completato:', success);
                            if (success) {
                                // Opzionale: feedback visivo o log
                            } else {
                                console.warn('[Tony] SmartFormFiller non è riuscito a compilare il campo');
                            }
                        });
                        
                        // Interrompiamo qui il case SET_FIELD standard per questo campo
                        return; 
                    }

                    console.log('[DEBUG CURSOR] processTonyCommand: fieldId originale:', fieldId);
                    console.log('[DEBUG CURSOR] processTonyCommand: value:', value);
                    
                    if (fieldId) {
                        // AUTO-OPEN MODAL: Se il modal non è aperto, aprilo prima di impostare il campo
                        var targetModalId = null;
                        if (fieldId.indexOf('attivita-') === 0) targetModalId = 'attivita-modal';
                        else if (fieldId.indexOf('lavoro-') === 0) targetModalId = 'lavoro-modal';
                        else if (fieldId.indexOf('ora-') === 0) targetModalId = 'ora-modal';
                        else if (fieldId.indexOf('terreno-') === 0) targetModalId = 'terreno-modal';
                        else if (fieldId.indexOf('prodotto-') === 0) targetModalId = 'prodotto-modal';
                        else if (fieldId.indexOf('mov-') === 0) targetModalId = 'movimento-modal';
                        
                        if (targetModalId) {
                            var modal = document.getElementById(targetModalId);
                            var isModalActive = modal && (modal.classList.contains('active') || modal.style.display === 'block' || (window.jQuery && window.jQuery(modal).is(':visible')));
                            
                            if (modal && !isModalActive) {
                                console.log('[Tony] Auto-opening modal ' + targetModalId + ' per campo ' + fieldId);
                                enqueueTonyCommand({ type: 'OPEN_MODAL', id: targetModalId }, { source: 'auto-open-modal' });
                                enqueueTonyCommand(data, { source: 'auto-retry-set-field', delayMs: 1000 });
                                return;
                            }
                            // Modal non esiste nel DOM (es. da Dashboard): naviga alla pagina e applica i campi (fallback cross-page)
                            if (!modal && targetModalId === 'attivita-modal' && window.Tony && typeof window.Tony.triggerAction === 'function') {
                                var pendingFields = {};
                                if (fieldId && value != null) pendingFields[fieldId] = value;
                                var _attNavTarget2 = getTonyFieldProfileFromContext() ? 'workspace campo' : 'attivita';
                                console.log('[Tony] SET_FIELD su modal assente, navigo a', _attNavTarget2, 'con campi pendenti');
                                window.Tony.triggerAction('APRI_PAGINA', {
                                    target: _attNavTarget2,
                                    _tonyPendingModal: getTonyFieldProfileFromContext() ? null : 'attivita-modal',
                                    _tonyPendingFields: Object.keys(pendingFields).length > 0 ? pendingFields : null
                                });
                                return;
                            }
                            if (!modal && targetModalId === 'prodotto-modal' && window.Tony && typeof window.Tony.triggerAction === 'function') {
                                var pendingFieldsP = {};
                                if (fieldId && value != null) pendingFieldsP[fieldId] = value;
                                console.log('[Tony] SET_FIELD su modal assente, navigo a Prodotti con campi pendenti');
                                window.Tony.triggerAction('APRI_PAGINA', {
                                    target: 'prodotti',
                                    _tonyPendingModal: 'prodotto-modal',
                                    _tonyPendingFields: Object.keys(pendingFieldsP).length > 0 ? pendingFieldsP : null
                                });
                                return;
                            }
                            if (!modal && targetModalId === 'movimento-modal' && window.Tony && typeof window.Tony.triggerAction === 'function') {
                                var pendingFieldsM = {};
                                if (fieldId && value != null) pendingFieldsM[fieldId] = value;
                                console.log('[Tony] SET_FIELD su modal assente, navigo a Movimenti con campi pendenti');
                                window.Tony.triggerAction('APRI_PAGINA', {
                                    target: 'movimenti',
                                    _tonyPendingModal: 'movimento-modal',
                                    _tonyPendingFields: Object.keys(pendingFieldsM).length > 0 ? pendingFieldsM : null
                                });
                                return;
                            }
                            if (!modal && targetModalId === 'ora-modal' && window.Tony && typeof window.Tony.triggerAction === 'function') {
                                var pendingFieldsOra = {};
                                if (fieldId && value != null) pendingFieldsOra[fieldId] = value;
                                pendingFieldsOra = tonyMapAttivitaFieldsToSegnaOra(pendingFieldsOra);
                                pendingFieldsOra = tonyResolveOraLavoroForQuickHours(pendingFieldsOra, tonyBuildSegnaOraUserBlobLastNUserTurns(6));
                                if (getTonyFieldProfileFromContext() && tonyModuliAttiviIncludeManodopera()) {
                                    console.log('[Tony] SET_FIELD ora-* senza modal: navigo a workspace campo (Segna ore inline)');
                                    window.Tony.triggerAction('APRI_PAGINA', {
                                        target: 'workspace campo',
                                        _tonyPendingModal: 'quick-hours-form',
                                        _tonyPendingFields: Object.keys(pendingFieldsOra).length > 0 ? pendingFieldsOra : null
                                    });
                                } else {
                                    console.log('[Tony] SET_FIELD ora-* senza modal: navigo a Segna ore (standalone)');
                                    window.Tony.triggerAction('APRI_PAGINA', {
                                        target: 'segnatura ore',
                                        _tonyPendingModal: 'ora-modal',
                                        _tonyPendingFields: Object.keys(pendingFieldsOra).length > 0 ? pendingFieldsOra : null
                                    });
                                }
                                return;
                            }
                        }

                        if (fieldId === 'operaio' || fieldId === 'manodopera') {
                            console.warn('[DEBUG CURSOR] processTonyCommand: Campo operaio/manodopera rilevato, sposto in Note');
                            console.warn('[Tony] Tentativo di impostare operaio in modulo attività. Sposto in Note.');
                            fieldId = 'attivita-note';
                            value = (value ? 'Operaio citato: ' + value : '');
                        }
                        
                        var fieldExists = !!document.getElementById(fieldId);
                        console.log('[DEBUG CURSOR] processTonyCommand: Campo con ID originale esiste:', fieldExists);
                        
                        if (!fieldExists) {
                            var fieldKey = (fieldId || '').toString().toLowerCase().trim().replace(/\s+/g, '_');
                            var resolvedField = FIELD_ID_FALLBACK[fieldId] || FIELD_ID_FALLBACK[fieldKey];
                            console.log('[DEBUG CURSOR] processTonyCommand: fieldKey normalizzato:', fieldKey);
                            console.log('[DEBUG CURSOR] processTonyCommand: resolvedField da fallback:', resolvedField);
                            
                            if (resolvedField) {
                                console.log('[DEBUG CURSOR] processTonyCommand: Fallback applicato:', fieldId, '→', resolvedField);
                                console.log('[Tony] SET_FIELD: fallback da', fieldId, '→', resolvedField);
                                fieldId = resolvedField;
                            } else {
                                console.warn('[DEBUG CURSOR] processTonyCommand: Nessun fallback trovato per fieldId:', fieldId);
                            }
                        }

                        // Delega al Form Engine quando il campo è supportato e presente nel DOM.
                        // In questo modo riduciamo i fallback hardcoded del widget.
                        if (window.SmartFormFiller && isSmartFillerEligibleField(fieldId) && document.getElementById(fieldId)) {
                            console.log('[Tony] SET_FIELD delegato a SmartFormFiller:', fieldId, value);
                            var smartFiller = new SmartFormFiller();
                            var smartContext = window.Tony ? window.Tony.context : {};
                            smartFiller.fillField(fieldId, value, smartContext).then(function(success) {
                                if (!success) {
                                    console.warn('[Tony] SmartFormFiller fallback necessario per campo:', fieldId);
                                }
                            }).catch(function(err) {
                                console.warn('[Tony] Errore SmartFormFiller, fallback standard:', err);
                            });
                            return;
                        }
                        
                        var runSetField = function() {
                            console.log('[DEBUG CURSOR] processTonyCommand: runSetField eseguita');
                            var el = document.getElementById(fieldId);
                            console.log('[DEBUG CURSOR] processTonyCommand: Elemento campo trovato:', !!el);
                            
                            if (el) {
                                console.log('[DEBUG CURSOR] processTonyCommand: Tipo elemento:', el.tagName, 'Tipo input:', el.type || 'N/A');
                                console.log('[Tony] Imposto campo ' + fieldId + ' = ' + value);
                                var val = value != null ? String(value) : '';
                                
                                if (el.tagName === 'SELECT') {
                                    console.log('[DEBUG CURSOR] processTonyCommand: Campo è SELECT, cerco opzione...');
                                    var valLower = val.toLowerCase().trim();
                                    var opt = null;
                                    var targetValue = val; // Default: usa il valore fornito
                                    
                                    // Prima prova: match esatto per value
                                    opt = Array.from(el.options).find(function(o) {
                                        return o.value === val;
                                    });
                                    
                                    // Seconda prova: match esatto per text (MAPPA FORZATA: ID vs Testo)
                                    if (!opt) {
                                        opt = Array.from(el.options).find(function(o) {
                                            return String(o.text).trim().toLowerCase() === valLower;
                                        });
                                        if (opt) {
                                            targetValue = opt.value; // Usa l'ID corrispondente al testo trovato
                                            console.log('[Tony SET_FIELD] Mappatura testo→ID:', val, '→', targetValue);
                                        }
                                    }
                                    
                                    // Terza prova: match parziale nel testo (es. "erpicatura" matcha "Erpicatura Tra le File")
                                    if (!opt && valLower.length >= 3) {
                                        opt = Array.from(el.options).find(function(o) {
                                            var textLower = String(o.text).trim().toLowerCase();
                                            return textLower.indexOf(valLower) !== -1 || valLower.indexOf(textLower) !== -1;
                                        });
                                        if (opt) {
                                            targetValue = opt.value; // Usa l'ID corrispondente
                                        }
                                    }
                                    
                                    // Quarta prova: match per parole chiave (es. "erpicatura" matcha qualsiasi opzione che contiene "erpicatura")
                                    if (!opt && valLower.length >= 3) {
                                        var keywords = valLower.split(/\s+/).filter(function(w) { return w.length >= 3; });
                                        if (keywords.length > 0) {
                                            opt = Array.from(el.options).find(function(o) {
                                                var textLower = String(o.text).trim().toLowerCase();
                                                return keywords.every(function(kw) {
                                                    return textLower.indexOf(kw) !== -1;
                                                });
                                            });
                                            if (opt) {
                                                targetValue = opt.value; // Usa l'ID corrispondente
                                            }
                                        }
                                    }
                                    
                                    if (opt) {
                                        console.log('[DEBUG CURSOR] processTonyCommand: Opzione trovata:', targetValue, opt.text);
                                        
                                        // Imposta il valore
                                        el.value = targetValue;
                                        
                                        // AGGIORNAMENTO VISIVO: Forza il browser a riconoscere il cambio valore
                                        // Alcuni browser richiedono focus/blur per aggiornare la visualizzazione del SELECT
                                        var wasFocused = document.activeElement === el;
                                        if (!wasFocused) {
                                            el.focus();
                                        }
                                        
                                        // TRIGGER DELLA CASCATA: Scatena tutti gli eventi necessari per attivare la logica gerarchica
                                        // Usa Event con cancelable: true per compatibilità con alcuni framework
                                        el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                                        el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                                        
                                        // Trigger anche per eventi specifici di alcuni framework UI
                                        if (window.jQuery || window.$) {
                                            var $el = (window.jQuery || window.$)(el);
                                            $el.trigger('input');
                                            $el.trigger('change');
                                            console.log('[Tony SET_FIELD] Trigger jQuery input+change eseguito');
                                        }
                                        
                                        // AGGIORNAMENTO VISIVO: Se non era già focalizzato, rimuovi il focus per forzare refresh
                                        if (!wasFocused) {
                                            setTimeout(function() {
                                                el.blur();
                                                // VERIFICA: Controlla che il valore sia stato effettivamente impostato
                                                if (el.value === targetValue) {
                                                    console.log('[Tony SET_FIELD] ✓ Valore SELECT verificato:', el.value, '=', opt.text);
                                                } else {
                                                    console.warn('[Tony SET_FIELD] ⚠ Valore SELECT non corrisponde! Atteso:', targetValue, 'Trovato:', el.value);
                                                }
                                            }, 10);
                                        } else {
                                            // VERIFICA immediata se già focalizzato
                                            if (el.value === targetValue) {
                                                console.log('[Tony SET_FIELD] ✓ Valore SELECT verificato:', el.value, '=', opt.text);
                                            } else {
                                                console.warn('[Tony SET_FIELD] ⚠ Valore SELECT non corrisponde! Atteso:', targetValue, 'Trovato:', el.value);
                                            }
                                        }
                                        
                                        console.log('[DEBUG CURSOR] processTonyCommand: Eventi input+change+jQuery dispatchati per SELECT, valore:', targetValue);
                                        
                                        // SMART SET_FIELD: Se è il campo tipo-lavoro-gerarchico, deduci categoria e sottocategoria
                                        if (fieldId === 'attivita-tipo-lavoro-gerarchico') {
                                            setTimeout(function() {
                                                handleSmartTipoLavoroSet(targetValue, opt.text);
                                            }, 150); // Delay per permettere al DOM di aggiornarsi dopo i trigger
                                        }
                                    } else {
                                        console.warn('[DEBUG CURSOR] processTonyCommand: Opzione non trovata, imposto valore diretto:', val);
                                        
                                        // Imposta il valore
                                        el.value = targetValue;
                                        
                                        // AGGIORNAMENTO VISIVO: Forza il browser a riconoscere il cambio valore
                                        var wasFocused = document.activeElement === el;
                                        if (!wasFocused) {
                                            el.focus();
                                        }
                                        
                                        // TRIGGER DELLA CASCATA anche se non trovato
                                        el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                                        el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                                        
                                        if (window.jQuery || window.$) {
                                            var $el = (window.jQuery || window.$)(el);
                                            $el.trigger('input');
                                            $el.trigger('change');
                                        }
                                        
                                        // AGGIORNAMENTO VISIVO: Se non era già focalizzato, rimuovi il focus per forzare refresh
                                        if (!wasFocused) {
                                            setTimeout(function() {
                                                el.blur();
                                                // VERIFICA: Controlla che il valore sia stato effettivamente impostato
                                                if (el.value === targetValue) {
                                                    console.log('[Tony SET_FIELD] ✓ Valore SELECT verificato (valore diretto):', el.value);
                                                } else {
                                                    console.warn('[Tony SET_FIELD] ⚠ Valore SELECT non corrisponde! Atteso:', targetValue, 'Trovato:', el.value);
                                                }
                                            }, 10);
                                        } else {
                                            // VERIFICA immediata se già focalizzato
                                            if (el.value === targetValue) {
                                                console.log('[Tony SET_FIELD] ✓ Valore SELECT verificato (valore diretto):', el.value);
                                            } else {
                                                console.warn('[Tony SET_FIELD] ⚠ Valore SELECT non corrisponde! Atteso:', targetValue, 'Trovato:', el.value);
                                            }
                                        }
                                        
                                        // SMART SET_FIELD: Anche se non trovato, prova comunque la deduzione
                                        if (fieldId === 'attivita-tipo-lavoro-gerarchico') {
                                            setTimeout(function() {
                                                handleSmartTipoLavoroSet(targetValue, val);
                                            }, 150);
                                        }
                                    }
                                } else {
                                    console.log('[DEBUG CURSOR] processTonyCommand: Campo è INPUT/TEXTAREA, imposto valore:', val);
                                    el.value = val;
                                    
                                    // TRIGGER DELLA CASCATA anche per input/textarea
                                    el.dispatchEvent(new Event('input', { bubbles: true }));
                                    el.dispatchEvent(new Event('change', { bubbles: true }));
                                    if (window.jQuery || window.$) {
                                        var $el = (window.jQuery || window.$)(el);
                                        $el.trigger('change');
                                    }
                                    console.log('[DEBUG CURSOR] processTonyCommand: Eventi input+change+jQuery dispatchati per INPUT/TEXTAREA');
                                }
                                console.log('[DEBUG CURSOR] processTonyCommand: SET_FIELD completato con successo');
                                if (fieldId.indexOf('prodotto-') === 0 || fieldId.indexOf('mov-') === 0) {
                                    scheduleTonyMagazzinoProactiveAfterSetField();
                                }
                            } else {
                                console.error('[DEBUG CURSOR] processTonyCommand: ERRORE - Campo non trovato nel DOM!');
                                console.error('[DEBUG CURSOR] processTonyCommand: fieldId cercato:', fieldId);
                                var allFields = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
                                console.error('[DEBUG CURSOR] processTonyCommand: Campi INPUT/SELECT/TEXTAREA presenti:', allFields.length);
                                console.error('[DEBUG CURSOR] processTonyCommand: ID dei campi presenti:', Array.from(allFields).slice(0, 10).map(function(f) { return f.id || f.name || '(senza id)'; }));
                                console.error('[Tony] SET_FIELD FALLITO: campo ' + fieldId + ' non trovato nel DOM. Campi INPUT/SELECT visibili:', allFields.length);
                            }
                        };
                        
                        var timeSinceModalOpen = Date.now() - _lastModalOpenTime;
                        var delay = (timeSinceModalOpen < 600) ? 500 : 0;
                        console.log('[DEBUG CURSOR] processTonyCommand: Tempo da apertura modal:', timeSinceModalOpen, 'ms');
                        console.log('[DEBUG CURSOR] processTonyCommand: Delay applicato:', delay, 'ms');
                        
                        if (delay > 0) {
                            console.log('[DEBUG CURSOR] processTonyCommand: Esecuzione ritardata di', delay, 'ms');
                            setTimeout(runSetField, delay);
                        } else {
                            console.log('[DEBUG CURSOR] processTonyCommand: Esecuzione immediata');
                            runSetField();
                        }
                    } else {
                        console.warn('[DEBUG CURSOR] processTonyCommand: SET_FIELD senza field o id');
                        console.warn('[Tony] SET_FIELD: nessun field o id fornito.');
                    }
                    break;

                case 'SAVE_ACTIVITY':
                    console.log('[DEBUG CURSOR] processTonyCommand: Caso SAVE_ACTIVITY');
                    var preventivoFormEl = document.getElementById('preventivo-form');
                    var modalTrattamentoAct = (function() {
                        var m = document.getElementById('modal-trattamento');
                        return m && m.classList.contains('active');
                    })();
                    var saveValidation = null;
                    /** Modal concimazioni/trattamenti: niente schema TONY_FORM_SCHEMAS — SmartFormFiller confondeva .btn-primary «Traccia» col Salva. */
                    if (modalTrattamentoAct) {
                        saveValidation = tonyCheckFormCompletenessSafe();
                    } else if (preventivoFormEl) {
                        saveValidation = tonyCheckFormCompletenessSafe();
                    } else if (window.SmartFormFiller) {
                        try {
                            saveValidation = new SmartFormFiller().validateBeforeSave();
                        } catch (validationError) {
                            console.warn('[Tony] Save guard SmartFormFiller non disponibile, fallback al controllo widget:', validationError);
                        }
                    }

                    if (!saveValidation) {
                        saveValidation = tonyCheckFormCompletenessSafe();
                    }

                    if (!saveValidation.isComplete) {
                        console.error('[Tony] SAVE_ACTIVITY BLOCCATO: Campi obbligatori mancanti o form non pronto:', saveValidation.missingFields);
                        var isModalClosed = (saveValidation.missingFields || []).some(function(m) { return String(m).indexOf('Nessun modal') >= 0 || String(m).indexOf('Form context') >= 0; });
                        if (isModalClosed && !preventivoFormEl) {
                            var path = (window.location.pathname || '').toLowerCase();
                            var isLavoriPage = path.indexOf('lavori') >= 0 || path.indexOf('gestione-lavori') >= 0;
                            var confirmMsg = 'Attività salvata!';
                            if (isLavoriPage) confirmMsg = 'Lavoro salvato!';
                            else if (path.indexOf('prodotti') >= 0) confirmMsg = 'Prodotto salvato!';
                            else if (path.indexOf('movimenti') >= 0) confirmMsg = 'Movimento registrato!';
                            showMessageInChat(confirmMsg, 'tony');
                        } else {
                            showMessageInChat('Attenzione: non posso salvare perché ci sono campi obbligatori vuoti o non pronti: ' + saveValidation.missingFields.join(', '), 'error');
                        }
                        return;
                    }

                    // Cerca il bottone di salvataggio nel form attivo (preferisci submit reale, non primi .btn-primary tipo «Traccia»)
                    var saveBtn = null;
                    if (modalTrattamentoAct) {
                        var ftSave = document.getElementById('form-trattamento');
                        if (ftSave) saveBtn = ftSave.querySelector('button[type="submit"], .form-actions button[type="submit"]');
                    }
                    if (preventivoFormEl && !saveBtn) {
                        saveBtn = preventivoFormEl.querySelector('button[type="submit"]');
                    }
                    if (!saveBtn) saveBtn = document.querySelector('.modal.active button[type="submit"], .modal.show button[type="submit"]');
                    if (!saveBtn) saveBtn = document.querySelector('.modal.active .form-actions button[type="submit"]');
                    // Fallback specifico per moduli noti
                    if (!saveBtn) saveBtn = document.getElementById('attivita-form');
                    if (!saveBtn) saveBtn = document.getElementById('ora-form');
                    if (!saveBtn) saveBtn = document.getElementById('lavoro-form');
                    
                    if (saveBtn) {
                        console.log('[Tony] SAVE_ACTIVITY: Clicco bottone salvataggio', saveBtn);
                        saveBtn.click();
                        // Rimuovi eventuali SAVE_ACTIVITY duplicati dalla coda (evita doppio salvataggio)
                        _tonyCommandQueue = _tonyCommandQueue.filter(function(e) { return e.command.type !== 'SAVE_ACTIVITY'; });
                    } else {
                        console.error('[Tony] SAVE_ACTIVITY: Bottone salvataggio non trovato');
                        showMessageInChat('Non trovo il tasto per salvare. Prova a cliccarlo tu.', 'tony');
                    }
                    break;

                case 'CLICK_BUTTON':
                    var btnId = data.id || data.target;
                    if (btnId) {
                        // BLOCCO DI SICUREZZA: Verifica campi required prima di salvare
                        var completeness = tonyCheckFormCompletenessSafe();
                        
                        if (!completeness.isComplete) {
                            console.error('[Tony] CLICK_BUTTON BLOCCATO: Campi required vuoti:', completeness.missingFields);
                            showMessageInChat('Attenzione: non posso salvare perché ci sono campi obbligatori vuoti: ' + completeness.missingFields.join(', '), 'error');
                            
                            // BLOCCO SPECIFICO: Se tipo-lavoro-gerarchico è vuoto, invia messaggio specifico
                            var tipoLavoroSelect = document.getElementById('attivita-tipo-lavoro-gerarchico');
                            if (tipoLavoroSelect && (!tipoLavoroSelect.value || tipoLavoroSelect.value === '')) {
                                console.error('[Tony] BLOCCO SICUREZZA CRITICO: Tipo lavoro vuoto, salvataggio impedito!');
                                
                                // Invia messaggio di errore interno a Tony (non visibile all'utente)
                                if (window.Tony && typeof window.Tony.ask === 'function') {
                                    setTimeout(function() {
                                        window.Tony.ask('ERRORE_INTERNO_WIDGET: Il campo tipo-lavoro-gerarchico è vuoto. Non posso salvare. Devo prima impostare la categoria principale e attendere che le opzioni del tipo lavoro vengano caricate dinamicamente dal form.').catch(function(err) {
                                            console.error('[Tony] Errore invio messaggio errore:', err);
                                        });
                                    }, 100);
                                }
                            }
                            
                            return; // NON eseguire il click
                        }
                        
                        var btnEl = document.getElementById(btnId);
                        if (btnEl) {
                            if (btnEl.tagName === 'FORM') {
                                var submitBtn = btnEl.querySelector('button[type="submit"], input[type="submit"]');
                                if (submitBtn) {
                                    var requiredEmpty = [];
                                    btnEl.querySelectorAll('[required]').forEach(function(f) {
                                        if (!f.value || (f.value && String(f.value).trim() === '')) {
                                            requiredEmpty.push(f.id || f.name || f.placeholder || '(senza id)');
                                        }
                                    });
                                    if (requiredEmpty.length > 0) {
                                        console.warn('[Tony] CLICK_BUTTON: campi required vuoti prima del submit:', requiredEmpty);
                                        showMessageInChat('Attenzione: non posso salvare perché ci sono campi obbligatori vuoti: ' + requiredEmpty.join(', '), 'error');
                                        return; // NON eseguire il click
                                    }
                                    if (typeof btnEl.validateForm === 'function') {
                                        btnEl.validateForm();
                                    } else if (typeof window.validateForm === 'function') {
                                        window.validateForm(btnEl);
                                    }
                                    console.log('[Tony] Click pulsante submit:', btnId);
                                    submitBtn.click();
                                }
                            } else {
                                console.log('[Tony] Click pulsante:', btnId);
                                btnEl.click();
                            }
                        } else if ($ && $('#' + btnId).length) {
                            var $btn = $('#' + btnId);
                            if ($btn.is('form')) {
                                $btn.find('button[type="submit"], input[type="submit"]').first().click();
                            } else {
                                $btn.click();
                            }
                        } else {
                            console.error('[Tony] CLICK_BUTTON FALLITO: pulsante/form ' + btnId + ' non trovato nel DOM. Form presenti:', document.querySelectorAll('form').length);
                        }
                    } else {
                        console.warn('[Tony] CLICK_BUTTON: nessun id o target fornito.');
                    }
                    break;

                case 'PREVENTIVO_LIST_ACTION':
                    (function () {
                        var p = data.params || data;
                        var pathPrev = (window.location.pathname || '').toLowerCase();
                        var onPrev = pathPrev.indexOf('preventivi') !== -1;
                        function notifyRes(res) {
                            if (!res || !res.message) return;
                            if (typeof window.appendMessage === 'function') {
                                window.appendMessage(res.message, res.ok ? 'tony' : 'error');
                            }
                        }
                        function run() {
                            if (typeof window.tonyPreventivoListAction !== 'function') {
                                showMessageInChat('Apri la pagina Gestione preventivi per inviare o accettare un preventivo.', 'error');
                                return;
                            }
                            window.tonyPreventivoListAction(p).then(function (res) {
                                notifyRes(res);
                            }).catch(function (e) {
                                showMessageInChat((e && e.message) ? e.message : 'Errore durante l\'azione sul preventivo.', 'error');
                            });
                        }
                        if (onPrev) {
                            run();
                            return;
                        }
                        try {
                            sessionStorage.setItem('tony_pending_preventivi_action', JSON.stringify(p));
                        } catch (e) {}
                        var urlP = getUrlForTarget('preventivi');
                        if (!urlP) {
                            showMessageInChat('Non trovo la pagina Gestione preventivi.', 'error');
                            return;
                        }
                        var labP = TONY_LABEL_MAP.preventivi || 'Gestione preventivi';
                        window.showTonyConfirmDialog('Aprire "' + labP + '" per eseguire l\'invio o l\'accettazione?').then(function (ok) {
                            if (ok) {
                                window.location.href = urlP + (urlP.indexOf('?') >= 0 ? '&' : '?') + 'tnyNotify=' + encodeURIComponent('preventivi');
                            } else {
                                try {
                                    sessionStorage.removeItem('tony_pending_preventivi_action');
                                } catch (e2) {}
                            }
                        });
                    })();
                    break;

                case 'APRI_PAGINA':
                    console.log('[DEBUG CURSOR] processTonyCommand: Caso APRI_PAGINA');
                    var target = (data.target || (data.params && data.params.target) || '').toString().trim();
                    console.log('[DEBUG CURSOR] processTonyCommand: Target per APRI_PAGINA:', target);
                    if (target && !isRawTonyApriPaginaAllowed(target)) {
                        console.warn('[Tony] APRI_PAGINA bloccato per profilo campo:', target);
                        tonyNotifyFieldProfileBlocked('page', target);
                        break;
                    }
                    if (target && !isApriPaginaTargetAllowed(target, getModuliAttiviFromTonyContext())) {
                        console.warn('[Tony] APRI_PAGINA bloccato: modulo non attivo per target', target);
                        tonyNotifyModuleInactive(target, showMessageInChat);
                        break;
                    }
                    if (target && tonyBlockApriSegnaturaIfOnFieldWorkspace(target, Object.assign({}, data, data.params && typeof data.params === 'object' ? data.params : {}))) {
                        break;
                    }
                    if (target) {
                        var resolved = resolveTarget(target) || target;
                        var url = getUrlForTarget(target);
                        if (url) {
                            var label = TONY_LABEL_MAP[resolved] || resolved;
                            var urlWithNotify = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'tnyNotify=' + encodeURIComponent(resolved);
                            console.log('[DEBUG CURSOR] processTonyCommand: URL trovato per', target, '→', urlWithNotify);
                            window.showTonyConfirmDialog('Aprire la pagina "' + label + '"?').then(function(ok) {
                                if (ok) {
                                    _tonyCommandQueue.length = 0;
                                    console.log('[DEBUG CURSOR] processTonyCommand: Navigazione confermata, target:', resolved);
                                    var apParams = (data.params && typeof data.params === 'object') ? Object.assign({}, data, data.params) : data;
                                    var pendingModalPc = apParams._tonyPendingModal;
                                    var pendingFieldsPc = apParams._tonyPendingFields || apParams.fields;
                                    var rawTPc = (target || '').toLowerCase();
                                    if (!pendingModalPc && pendingFieldsPc && typeof pendingFieldsPc === 'object' && Object.keys(pendingFieldsPc).length > 0) {
                                        if (rawTPc.indexOf('nuovo') >= 0 && rawTPc.indexOf('preventivo') >= 0) pendingModalPc = 'preventivo-form';
                                    }
                                    if (!pendingModalPc && rawTPc.indexOf('nuovo') >= 0 && rawTPc.indexOf('preventivo') >= 0) {
                                        pendingModalPc = 'preventivo-form';
                                    }
                                    if (pendingModalPc && target) {
                                        try {
                                            var rawTNavPc = (target || '').toLowerCase();
                                            var isNuovoPrevNavPc = pendingModalPc === 'preventivo-form' || (rawTNavPc.indexOf('nuovo') >= 0 && rawTNavPc.indexOf('preventivo') >= 0);
                                            var userPromptForPendingPc = isNuovoPrevNavPc ? tonyGetUserPromptForPendingNav() : '';
                                            sessionStorage.setItem('tony_pending_intent', JSON.stringify({
                                                target: target,
                                                modalId: pendingModalPc,
                                                fields: (pendingFieldsPc && typeof pendingFieldsPc === 'object') ? pendingFieldsPc : null,
                                                userPromptForPending: userPromptForPendingPc || null
                                            }));
                                            console.log('[Tony] tony_pending_intent salvato (processTonyCommand):', pendingModalPc, target);
                                        } catch (e) { console.warn('[Tony] Impossibile salvare pending intent:', e); }
                                    }
                                    window.location.hash = '#' + resolved;
                                    try {
                                        window.dispatchEvent(new CustomEvent('tony-navigate', { detail: { target: resolved, hash: '#' + resolved, url: urlWithNotify } }));
                                    } catch (e) {}
                                    window.location.href = urlWithNotify;
                                } else {
                                    console.log('[DEBUG CURSOR] processTonyCommand: Navigazione annullata dall\'utente');
                                }
                            });
                        } else {
                            console.warn('[DEBUG CURSOR] processTonyCommand: URL non trovato per target:', target);
                        }
                    } else {
                        console.warn('[DEBUG CURSOR] processTonyCommand: APRI_PAGINA senza target');
                    }
                    break;

                case 'SHOW_TABLE':
                    console.log('[Tony] SHOW_TABLE: già sulla pagina lista, tabella visibile.');
                    try {
                        var tableEl = document.querySelector('.prodotti-table, .movimenti-table, .mezzi-table, .guasti-table, .scadenze-table');
                        if (tableEl) {
                            tableEl.style.animation = 'none';
                            tableEl.offsetHeight;
                            tableEl.style.animation = 'tony-highlight 0.6s ease';
                        }
                    } catch (e) {}
                    break;

                case 'FILTER_TABLE':
                    (function() {
                        var params = data.params || {};
                        if (window.currentTableData && window.currentTableData.pageType === 'lavori_caposquadra' && typeof window.applyTonyLavoriCaposquadraFilter === 'function') {
                            window.applyTonyLavoriCaposquadraFilter(params);
                            return;
                        }
                        if (window.currentTableData && window.currentTableData.pageType === 'segnatura_ore' && typeof window.applyTonySegnaturaOreFilter === 'function') {
                            window.applyTonySegnaturaOreFilter(params);
                            return;
                        }
                        if (window.currentTableData && window.currentTableData.pageType === 'field_workspace') {
                            if (typeof window.applyTonyFieldWorkspaceFilter === 'function') {
                                window.applyTonyFieldWorkspaceFilter(params);
                            } else {
                                console.log('[Tony] FILTER_TABLE: field_workspace — filtri lista opzionali non attivi; usa il contesto items.');
                            }
                            return;
                        }
                        var pathStr = (window.location.pathname || '');
                        var pageType = (window.currentTableData && window.currentTableData.pageType) ||
                            (pathStr.indexOf('terreni-clienti') !== -1 ? 'terreniClienti' : pathStr.indexOf('tracciabilita-consumi') !== -1 ? 'tracciabilita_consumi' : pathStr.indexOf('vendemmia-standalone') !== -1 ? 'vendemmia' : (pathStr.indexOf('modules/vigneto') !== -1 || pathStr.indexOf('/vigneto/') !== -1) && pathStr.indexOf('concimazioni') !== -1 ? 'concimazioni_vigneto' : (pathStr.indexOf('modules/frutteto') !== -1 || pathStr.indexOf('/frutteto/') !== -1) && pathStr.indexOf('concimazioni') !== -1 ? 'concimazioni_frutteto' : pathStr.indexOf('clienti') !== -1 ? 'clienti' : pathStr.indexOf('preventivi') !== -1 ? 'preventivi' : pathStr.indexOf('tariffe') !== -1 ? 'tariffe' : pathStr.indexOf('prodotti') !== -1 ? 'prodotti' : pathStr.indexOf('movimenti') !== -1 ? 'movimenti' : pathStr.indexOf('attivita') !== -1 ? 'attivita' : (pathStr.indexOf('gestione-lavori') !== -1 || pathStr.indexOf('lavori') !== -1) ? 'lavori' : 'terreni');
                        var FILTER_KEY_MAP = {
                            attivita: { terreno: 'filter-terreno', tipoLavoro: 'filter-tipo-lavoro', coltura: 'filter-coltura', origine: 'filter-origine', dataDa: 'filter-data-da', dataA: 'filter-data-a', data: 'filter-data-da', ricerca: 'filter-ricerca' },
                            terreni: { podere: 'filter-podere', possesso: 'filter-tipo-possesso', alert: 'filter-alert', coltura: 'filter-coltura', categoria: 'filter-categoria' },
                            lavori: { stato: 'filter-stato', progresso: 'filter-progresso', caposquadra: 'filter-caposquadra', terreno: 'filter-terreno', tipo: 'filter-tipo', tipoLavoro: 'filter-tipo-lavoro', operaio: 'filter-operaio' },
                            clienti: { stato: 'filter-stato', ricerca: 'filter-search' },
                            preventivi: { stato: 'filter-stato', cliente: 'filter-cliente', categoriaLavoro: 'filter-categoria-lavoro', tipoLavoro: 'filter-tipo-lavoro', categoriaColtura: 'filter-categoria-coltura', ricerca: 'filter-search' },
                            terreniClienti: { cliente: 'filter-cliente' },
                            tariffe: { tipoLavoro: 'filter-tipo-lavoro', coltura: 'filter-coltura', tipoCampo: 'filter-tipo-campo', attiva: 'filter-attiva' },
                            prodotti: { attivo: 'filter-attivo', categoria: 'filter-categoria', ricerca: 'filter-search' },
                            movimenti: { tipo: 'filter-tipo', prodotto: 'filter-prodotto' },
                            concimazioni_vigneto: { vigneto: 'filter-vigneto', anno: 'filter-anno' },
                            concimazioni_frutteto: { frutteto: 'filter-frutteto', anno: 'filter-anno' },
                            tracciabilita_consumi: { categoria: 'filter-categoria', terreno: 'filter-terreno', vista: 'filter-vista' },
                            vendemmia: { vigneto: 'filter-vigneto', varieta: 'filter-varieta', anno: 'filter-anno' }
                        };
                        var keyToId = FILTER_KEY_MAP[pageType] || FILTER_KEY_MAP.terreni;
                        var isAttivita = pageType === 'attivita';

                        /** Allinea testo libero / CF ai value reali di #filter-categoria (prodotti-standalone). */
                        function normalizeTonyProdottiCategoriaValue(raw) {
                            if (raw == null || raw === '') return raw;
                            var s = String(raw).toLowerCase().trim();
                            try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) {}
                            var aliases = {
                                fertilizzante: 'fertilizzanti', fertilizzanti: 'fertilizzanti',
                                concime: 'fertilizzanti', concimi: 'fertilizzanti',
                                fitofarmaco: 'fitofarmaci', fitofarmaci: 'fitofarmaci',
                                pesticida: 'fitofarmaci', pesticidi: 'fitofarmaci',
                                'materiale impianto': 'materiale_impianto', materiale_impianto: 'materiale_impianto',
                                impianto: 'materiale_impianto', ricambi: 'ricambi', ricambio: 'ricambi',
                                sementi: 'sementi', seme: 'sementi', altro: 'altro'
                            };
                            if (aliases[s]) return aliases[s];
                            if (s.indexOf('fertil') >= 0 || s.indexOf('concim') >= 0) return 'fertilizzanti';
                            if (s.indexOf('fitofarm') >= 0 || s === 'fito' || s.indexOf('pestic') >= 0) return 'fitofarmaci';
                            if (s.indexOf('ricamb') >= 0) return 'ricambi';
                            if (s.indexOf('sement') >= 0 || /^sem[eie]/i.test(s)) return 'sementi';
                            if (s.indexOf('materiale') >= 0 && s.indexOf('impiant') >= 0) return 'materiale_impianto';
                            return raw;
                        }

                        function setFilterValue(el, value, matchByText) {
                            var valToSet = (value != null && value !== '') ? String(value) : '';
                            if (valToSet && el.options && el.options.length > 0) {
                                var normVal = valToSet.toLowerCase().trim();
                                var opt = Array.from(el.options).find(function(o) { return (o.value || '').toLowerCase() === normVal; });
                                if (!opt && matchByText) {
                                    opt = Array.from(el.options).find(function(o) { return (o.textContent || o.text || '').toLowerCase().trim() === normVal; });
                                }
                                if (!opt && matchByText && el.id === 'filter-categoria') {
                                    opt = Array.from(el.options).find(function(o) {
                                        if (!o.value) return false;
                                        var t = (o.textContent || o.text || '').toLowerCase();
                                        var v = (o.value || '').toLowerCase();
                                        return t.indexOf(normVal) >= 0 || v.indexOf(normVal) >= 0 || normVal.indexOf(v) >= 0;
                                    });
                                }
                                if (opt) valToSet = opt.value;
                            }
                            el.value = valToSet;
                            return valToSet;
                        }

                        if (params.filterType === 'reset' || params.reset === true) {
                            var resetSel = (pageType === 'attivita' || pageType === 'clienti' || pageType === 'preventivi' || pageType === 'tariffe' || pageType === 'terreniClienti' || pageType === 'prodotti' || pageType === 'movimenti' || pageType === 'concimazioni_vigneto' || pageType === 'concimazioni_frutteto' || pageType === 'tracciabilita_consumi' || pageType === 'vendemmia') ? 'select[id^="filter-"], input[id^="filter-"]' : 'select[id^="filter-"]';
                            document.querySelectorAll(resetSel).forEach(function(el) {
                                el.value = '';
                                try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                                // Pagine tipo prodotti: filter-search usa oninput, non onchange — serve anche input per aggiornare la lista.
                                if (el.tagName === 'INPUT') {
                                    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e2) {}
                                }
                            });
                            console.log('[Tony] FILTER_TABLE: tutti i filtri resettati (' + pageType + ')');
                            return;
                        }

                        var modified = [];
                        if (pageType === 'terreni' && params.categoria && params.categoria !== '') {
                            var catEl = document.getElementById('filter-categoria');
                            if (catEl) {
                                setFilterValue(catEl, params.categoria);
                                modified.push(catEl);
                                try { catEl.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                            }
                        }
                        for (var key in keyToId) {
                            if ((pageType === 'terreni' && key === 'categoria') || (key === 'data')) continue;
                            if (Object.prototype.hasOwnProperty.call(params, key) && params[key] != null && params[key] !== '') {
                                var realId = keyToId[key];
                                var el = document.getElementById(realId);
                                if (el && (el.tagName === 'SELECT' || 'value' in el)) {
                                    if (isAttivita && key === 'tipoLavoro' && params[key] === 'Vendemmia') {
                                        var hasOpt = Array.from(el.options).some(function(o) { return (o.value || '').toLowerCase() === 'vendemmia'; });
                                        if (!hasOpt) {
                                            var opt = document.createElement('option');
                                            opt.value = 'Vendemmia';
                                            opt.textContent = 'Vendemmia';
                                            el.appendChild(opt);
                                        }
                                    }
                                    var matchByText = (isAttivita && (key === 'terreno' || key === 'origine')) || (pageType === 'lavori' && (key === 'terreno' || key === 'caposquadra' || key === 'operaio' || key === 'tipoLavoro')) || (pageType === 'preventivi' && (key === 'cliente' || key === 'categoriaLavoro' || key === 'categoriaColtura')) || (pageType === 'terreniClienti' && key === 'cliente') || (pageType === 'movimenti' && key === 'prodotto') || (pageType === 'prodotti' && key === 'categoria') || (pageType === 'concimazioni_vigneto' && key === 'vigneto') || (pageType === 'concimazioni_frutteto' && key === 'frutteto') || (pageType === 'tracciabilita_consumi' && (key === 'categoria' || key === 'terreno')) || (pageType === 'vendemmia' && (key === 'varieta' || key === 'vigneto'));
                                    var paramVal = params[key];
                                    if (pageType === 'prodotti' && key === 'categoria' && realId === 'filter-categoria') {
                                        paramVal = normalizeTonyProdottiCategoriaValue(paramVal);
                                    }
                                    if (pageType === 'tracciabilita_consumi' && key === 'categoria' && realId === 'filter-categoria') {
                                        paramVal = normalizeTonyProdottiCategoriaValue(paramVal);
                                    }
                                    setFilterValue(el, paramVal, matchByText);
                                    modified.push(el);
                                }
                            }
                        }
                        if (params.data && params.data !== '' && pageType === 'attivita') {
                            var dataVal = String(params.data);
                            var daEl = document.getElementById('filter-data-da');
                            var aEl = document.getElementById('filter-data-a');
                            if (daEl) { daEl.value = dataVal; modified.push(daEl); }
                            if (aEl) { aEl.value = dataVal; modified.push(aEl); }
                        }
                        if (modified.length > 0) {
                            // Terreni: categoria è già gestita sopra con dispatch dedicato — evitare doppio change su #filter-categoria.
                            // Prodotti (e altre pagine con omonimo id): qui serve il change per aggiornare la lista (es. renderProdotti).
                            modified.filter(function(el) {
                                if (el.id === 'filter-categoria' && pageType === 'terreni') return false;
                                return true;
                            }).forEach(function(el) {
                                try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                                if (el.tagName === 'INPUT') { try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e2) {} }
                            });
                            if (isAttivita && params.tipoLavoro) {
                                var sel = document.getElementById('filter-tipo-lavoro');
                                console.log('[Tony] FILTER_TABLE attivita tipoLavoro:', params.tipoLavoro, '-> select.value:', sel ? sel.value : 'N/A');
                            }
                            console.log('[Tony] FILTER_TABLE: applicati', modified.length, 'filtri (' + pageType + ')');
                        } else {
                            var filterType = (params.filterType || '').toString().toLowerCase();
                            var value = params.value;
                            if (filterType && (value != null && value !== '')) {
                                var realId = keyToId[filterType] || ('filter-' + filterType);
                                var el = document.getElementById(realId);
                                if (el && (el.tagName === 'SELECT' || 'value' in el)) {
                                    var matchByTextRetro = (pageType === 'attivita' && (filterType === 'terreno' || filterType === 'origine')) || (pageType === 'lavori' && (filterType === 'terreno' || filterType === 'caposquadra' || filterType === 'operaio' || filterType === 'tipoLavoro')) || (pageType === 'preventivi' && (filterType === 'cliente' || filterType === 'categoriaLavoro' || filterType === 'categoriaColtura')) || (pageType === 'terreniClienti' && filterType === 'cliente') || (pageType === 'movimenti' && (filterType === 'prodotto' || filterType === 'tipo')) || (pageType === 'prodotti' && filterType === 'categoria') || (pageType === 'concimazioni_vigneto' && filterType === 'vigneto') || (pageType === 'concimazioni_frutteto' && filterType === 'frutteto') || (pageType === 'tracciabilita_consumi' && (filterType === 'categoria' || filterType === 'terreno')) || (pageType === 'vendemmia' && (filterType === 'varieta' || filterType === 'vigneto' || filterType === 'anno'));
                                    var retroVal = value;
                                    if (pageType === 'prodotti' && filterType === 'categoria' && el.id === 'filter-categoria') {
                                        retroVal = normalizeTonyProdottiCategoriaValue(retroVal);
                                    }
                                    if (pageType === 'tracciabilita_consumi' && filterType === 'categoria' && el.id === 'filter-categoria') {
                                        retroVal = normalizeTonyProdottiCategoriaValue(retroVal);
                                    }
                                    setFilterValue(el, retroVal, matchByTextRetro);
                                    try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                                    console.log('[Tony] FILTER_TABLE (retrocompat):', realId, '=', el.value);
                                } else {
                                    console.warn('[Tony] FILTER_TABLE: elemento non trovato per', filterType, '(ID:', realId + ')');
                                }
                            }
                        }
                    })();
                    break;

                case 'SUM_COLUMN':
                    (function() {
                        var params = data.params || {};
                        var keyToId = { podere: 'filter-podere', possesso: 'filter-tipo-possesso', alert: 'filter-alert', coltura: 'filter-coltura', categoria: 'filter-categoria' };
                        var column = (data.column || 'Ha').toString().trim() || 'Ha';
                        var messageTemplate = data.messageTemplate || 'Totale superficie: __TOTAL__ ettari';
                        var includeNeri = params.includeNeri === true || params.includeExpired === true || params.tuttoStorico === true;
                        var hasFilters = Object.keys(params).some(function(k) { return k !== 'includeNeri' && k !== 'includeExpired' && k !== 'tuttoStorico' && k !== 'resetFilters' && params[k] != null && params[k] !== ''; });
                        var doResetFilters = !hasFilters || params.resetFilters === true;
                        var filterIds = ['filter-podere', 'filter-categoria', 'filter-coltura', 'filter-tipo-possesso', 'filter-alert'];

                        function setFilterValue(el, value) {
                            var valToSet = (value != null && value !== '') ? String(value) : '';
                            if (valToSet && el.options && el.options.length > 0) {
                                var normVal = valToSet.toLowerCase().trim();
                                var opt = Array.from(el.options).find(function(o) { return (o.value || '').toLowerCase() === normVal; });
                                if (opt) valToSet = opt.value;
                            }
                            el.value = valToSet;
                            return valToSet;
                        }

                        function resetAllFilters() {
                            filterIds.forEach(function(id) {
                                var el = document.getElementById(id);
                                if (el && (el.tagName === 'SELECT' || 'value' in el)) {
                                    el.value = '';
                                    try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                                }
                            });
                            console.log('[Tony] SUM_COLUMN: filtri resettati per calcolo globale');
                        }

                        function applyFiltersFromParams() {
                            if (params.filterType === 'reset' || params.reset === true) return;
                            if (doResetFilters) return;
                            if (params.categoria && params.categoria !== '') {
                                var catEl = document.getElementById('filter-categoria');
                                if (catEl) { setFilterValue(catEl, params.categoria); try { catEl.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {} }
                            }
                            for (var key in keyToId) {
                                if (key === 'categoria') continue;
                                if (Object.prototype.hasOwnProperty.call(params, key) && params[key] != null && params[key] !== '') {
                                    var realId = keyToId[key];
                                    var el = document.getElementById(realId);
                                    if (el && (el.tagName === 'SELECT' || 'value' in el)) {
                                        setFilterValue(el, params[key]);
                                        try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                                    }
                                }
                            }
                        }

                        function parseHaValue(str) {
                            if (str == null || str === '') return 0;
                            var s = String(str).replace(/\s/g, '').replace(',', '.');
                            var m = s.match(/(-?\d+(?:\.\d+)?)/);
                            return m ? parseFloat(m[1]) : 0;
                        }

                        function isItemNero(item) {
                            if ((item.tipoPossesso || '') !== 'affitto') return false;
                            if (item.statoContratto === 'Scaduto') return true;
                            var ds = item.dataScadenzaAffitto;
                            if (!ds) return false;
                            try {
                                var scad = new Date(ds);
                                return !isNaN(scad.getTime()) && scad < new Date();
                            } catch (e) { return false; }
                        }

                        function isRowNero(row) {
                            var possesso = row.querySelector('.col-possesso');
                            if (!possesso) return false;
                            return !!(possesso.querySelector('.alert-dot-grey') || possesso.querySelector('.alert-dot-black'));
                        }

                        function computeSumFromTable() {
                            var total = 0;
                            var rows = document.querySelectorAll('.terreno-row');
                            rows.forEach(function(row) {
                                if (!includeNeri && isRowNero(row)) return;
                                var haCell = row.querySelector('.col-ettari .terreno-ettari') || row.querySelector('.col-ettari');
                                if (haCell) {
                                    var txt = (haCell.textContent || haCell.innerText || '').trim();
                                    total += parseHaValue(txt);
                                }
                            });
                            return Math.round(total * 100) / 100;
                        }

                        function computeSumFromContext() {
                            var table = window.currentTableData;
                            if (!table || !Array.isArray(table.items)) return null;
                            var total = 0;
                            table.items.forEach(function(item) {
                                if (!includeNeri && isItemNero(item)) return;
                                var v = item.superficie;
                                if (v != null) total += parseFloat(String(v).replace(',', '.')) || 0;
                            });
                            return Math.round(total * 100) / 100;
                        }

                        if (doResetFilters) resetAllFilters();
                        else applyFiltersFromParams();

                        setTimeout(function() {
                            var total = computeSumFromContext();
                            if (total == null) total = computeSumFromTable();
                            var totalStr = (total != null && !isNaN(total)) ? total.toFixed(2).replace('.', ',') : '0,00';
                            var msg = messageTemplate.replace(/__TOTAL__/g, totalStr);
                            if (typeof showMessageInChat === 'function') showMessageInChat(msg, 'tony');
                            if (window.Tony && typeof window.Tony.speak === 'function') window.Tony.speak(msg);
                            console.log('[Tony] SUM_COLUMN: totale Ha =', total, 'msg=', msg);
                        }, 100);
                    })();
                    break;

                case 'COMPLETE_TASK':
                case 'TASK_COMPLETE':
                    console.warn('[Tony] Comando modello non eseguibile (complete_task); provo Segna ore dalla conversazione.');
                    tonyRecoverSegnaOraFromChatHistory();
                    break;

                case 'SALVA':
                case 'SAVE':
                    if (tonyResolveQuickHoursWindow()) {
                        if (!tonyLastUserMessageExplicitSegnaOraSubmitIntent()) {
                            console.warn('[Tony] SALVA dalla CF ignorato: conferma salvataggio non nell’ultimo messaggio utente (es. «sì», «salva»).');
                            break;
                        }
                        console.log('[Tony] SALVA: workspace mobile — inject da chat + submit form.');
                        tonySalvaQuickHoursWorkspace();
                    } else {
                        enqueueTonyCommand({ type: 'SAVE_ACTIVITY' }, { source: 'salva-delegates-save_activity', delayMs: 120 });
                    }
                    break;

                /** Emesso da alcune risposte CF (sinonimo di SALVA sul form inline Segna ore). */
                case 'SUBMIT_FORM':
                case 'QUICK_SAVE': {
                    var subFormId = (data.formId || data.id || '').toString().trim().toLowerCase();
                    var qhSub = tonyResolveQuickHoursWindow();
                    if (subFormId === 'quick-hours-form' || subFormId === 'field-workspace-ore-form' || (qhSub && (!subFormId || subFormId === 'quick-hours-form'))) {
                        if (!tonyLastUserMessageExplicitSegnaOraSubmitIntent()) {
                            console.warn('[Tony] ' + String(data.type).toUpperCase() + ' ignorato: nessuna conferma esplicita nell’ultimo messaggio utente.');
                            break;
                        }
                        console.log('[Tony] ' + String(data.type).toUpperCase() + ': Segna ore workspace — stesso flusso di SALVA.');
                        tonySalvaQuickHoursWorkspace();
                    } else {
                        console.warn('[Tony] ' + String(data.type).toUpperCase() + ': formId non supportato sul client:', subFormId || '(vuoto)');
                    }
                    break;
                }

                /** Alias CF verso campi quick-hours (widget in iframe → elementi nel parent). */
                case 'QUICK_FORM_FILL':
                case 'SET_VALUE': {
                    var rawId = data.fieldId || data.field || data.id;
                    var sval = data.value !== undefined && data.value !== null ? data.value : data.fieldValue;
                    if (rawId == null || sval === undefined || sval === null) {
                        console.warn('[Tony] SET_VALUE / QUICK_FORM_FILL: mancano fieldId o value/fieldValue');
                        break;
                    }
                    var qhSv = tonyResolveQuickHoursWindow();
                    if (!qhSv) {
                        console.warn('[Tony] SET_VALUE: nessuna finestra con #quick-hours-form');
                        break;
                    }
                    var idLower = String(rawId).toLowerCase().replace(/_/g, '-');
                    var injectKv = {};
                    if (idLower === 'ora-data') injectKv['ora-data'] = String(sval);
                    else if (idLower === 'ora-start' || idLower === 'ora-inizio') injectKv['ora-inizio'] = String(sval);
                    else if (idLower === 'ora-end' || idLower === 'ora-fine') injectKv['ora-fine'] = String(sval);
                    else if (idLower === 'ora-break' || idLower === 'ora-pause') injectKv['ora-pause'] = String(sval);
                    else {
                        console.warn('[Tony] SET_VALUE: fieldId non mappato su quick-hours:', rawId);
                        break;
                    }
                    if (window.TonyFormInjector && typeof window.TonyFormInjector.injectFieldWorkspaceQuickHoursForm === 'function') {
                        Promise.resolve(window.TonyFormInjector.injectFieldWorkspaceQuickHoursForm(injectKv, window.Tony && window.Tony.context, { targetWindow: qhSv })).then(function (okSv) {
                            if (okSv) console.log('[Tony] SET_VALUE/QUICK_FORM_FILL → inject quick-hours:', rawId, sval);
                        });
                    }
                    break;
                }

                case 'RIASSUNTO':
                    try {
                        var briefing = window.tonyGlobalBriefing;
                        if (briefing && window.Tony && window.Tony.speak) {
                            var opsRiass = typeof window.formatFriendlyBriefing === 'function'
                                ? window.formatFriendlyBriefing(briefing)
                                : '';
                            var friendlyText = buildDashboardRiassuntoText(briefing, opsRiass);
                            window.Tony.speak(friendlyText);
                        }
                        var toHighlight = document.querySelectorAll('[data-tony-briefing]');
                        toHighlight.forEach(function(el) {
                            el.classList.add('tony-highlight');
                            setTimeout(function() { el.classList.remove('tony-highlight'); }, 5000);
                        });
                    } catch (e) { console.warn('[Tony] RIASSUNTO:', e); }
                    break;

                default: {
                    var fbCmd = normalizeTonyCommand(Object.assign({}, data));
                    if (fbCmd && fbCmd.type && String(fbCmd.type).toUpperCase() !== String(data.type).toUpperCase()) {
                        processTonyCommand(fbCmd);
                        break;
                    }
                    console.warn('[Tony] Tipo comando sconosciuto:', data.type);
                }
            }
        } catch (err) {
            console.error('[Tony] Errore durante l\'esecuzione del comando:', err, data);
        }
    }
    window.processTonyCommand = processTonyCommand;

    // Variabile globale per tracciare se il modulo Tony Avanzato è attivo
    var isTonyAdvancedActive = false;

    var uiApi = injectWidget(scriptBase);
    var appendMessage = uiApi.appendMessage, removeTyping = uiApi.removeTyping, showMessageInChat = uiApi.showMessageInChat;

    /**
     * Profilo campo: blocco APRI_PAGINA / OPEN_MODAL — messaggio in chat (e TTS), senza alert nativo.
     * @param {'page'|'modal'} kind
     * @param {string} [rawTarget] - target grezzo per etichetta (solo kind page)
     */
    function tonyNotifyFieldProfileBlocked(kind, rawTarget) {
        window.__tonyFieldGuardNotifiedThisTurn = true;
        var label = '';
        try {
            if (rawTarget) {
                var r = resolveTarget(String(rawTarget).trim());
                label = (r && TONY_LABEL_MAP[r]) ? String(TONY_LABEL_MAP[r]) : '';
            }
        } catch (e) { /* ignore */ }
        var msg;
        if (kind === 'modal') {
            msg = 'Dal tuo profilo campo non posso aprire questa scheda o il modulo richiesto. Per anagrafiche generali e magazzino serve un account manager.';
        } else if (label) {
            msg = 'Non posso aprire «' + label + '» con il tuo profilo. Ti aiuto con workspace campo, ore, lavori assegnati o impostazioni account; per il resto chiedi a un manager.';
        } else {
            msg = 'Non posso aprire questa pagina con il tuo profilo. Usa il workspace campo e le sezioni manodopera, oppure chiedi a un manager.';
        }
        try { if (typeof removeTyping === 'function') removeTyping(); } catch (e0) {}
        try {
            if (typeof showMessageInChat === 'function') showMessageInChat(msg, 'tony');
            else if (typeof appendMessage === 'function') appendMessage(msg, 'tony');
        } catch (e) {}
        try {
            if (window.Tony && typeof window.Tony.speak === 'function') {
                var v = msg.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
                if (v.length > 420) v = v.slice(0, 420) + '…';
                window.Tony.speak(v);
            }
        } catch (e2) {}
    }

    window.addEventListener('tony-macchine-disambiguation', function(ev) {
        try {
            var d = ev && ev.detail ? ev.detail : {};
            var msg = d.message;
            if (!msg || typeof msg !== 'string') return;
            if (typeof appendMessage === 'function') appendMessage(msg, 'tony');
            var voice = d.voiceText != null && String(d.voiceText).trim() !== ''
                ? String(d.voiceText).trim()
                : String(msg).replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
            if (voice.length > 420) voice = voice.slice(0, 420) + '…';
            if (window.Tony && typeof window.Tony.speak === 'function') window.Tony.speak(voice);
        } catch (e) { console.warn('[Tony] tony-macchine-disambiguation:', e); }
    });

    var fab = document.getElementById('tony-fab');
    var panel = document.getElementById('tony-panel');
    var messagesEl = document.getElementById('tony-messages');
    var inputEl = document.getElementById('tony-input');
    var sendBtn = document.getElementById('tony-send');
    var closeBtn = document.getElementById('tony-close');

    if (sendBtn) {
        function nascondiJsonDaStreaming(testo) {
            var t = testo.replace(/\{[\s\S]*?\}/g, '');
            return t.replace(/\{[^}]*$/, '');
        }

        /**
         * Parser JSON ultra-robusto che estrae qualsiasi JSON da una stringa, anche mescolato con testo discorsivo.
         * Gestisce formati: { "text": "...", "command": {...} }, { "command": {...} }, { "type": "..." }, ecc.
         * Il testo restituito viene pulito da residui JSON (graffe, apici).
         * @param {string} str - Stringa che può contenere testo + JSON in qualsiasi formato
         * @returns {{ text: string, command: object|null }|null}
         */
        function parseRobustTonyResponse(str) {
            function clearQueueIfUnrepairable() {
                try { _tonyCommandQueue.length = 0; } catch (e) {}
            }
            function clean(t) { return cleanTextFromJsonResidue(t || ''); }
            if (!str || typeof str !== 'string') {
                console.log('[DEBUG CURSOR] parseRobustTonyResponse: input non valido (non stringa o vuoto)');
                clearQueueIfUnrepairable();
                return null;
            }
            
            console.log('[DEBUG CURSOR] parseRobustTonyResponse: input ricevuto, lunghezza:', str.length);
            console.log('[DEBUG CURSOR] parseRobustTonyResponse: preview:', str.substring(0, 200) + (str.length > 200 ? '...' : ''));
            
            var jsonMatch = str.match(/\{[\s\S]*\}/);
            
            if (!jsonMatch) {
                console.log('[DEBUG CURSOR] parseRobustTonyResponse: Nessun JSON completo trovato, cerco JSON troncato...');
                var startIdx = str.indexOf('{');
                if (startIdx >= 0) {
                    var incompleteJson = str.substring(startIdx);
                    var openBraces = (incompleteJson.match(/\{/g) || []).length;
                    var closeBraces = (incompleteJson.match(/\}/g) || []).length;
                    var missingBraces = openBraces - closeBraces;
                    console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato JSON incompleto, parentesi aperte:', openBraces, 'chiuse:', closeBraces, 'mancanti:', missingBraces);
                    if (missingBraces > 0 && missingBraces <= 10) {
                        var completedJson = incompleteJson + '}'.repeat(missingBraces);
                        jsonMatch = [completedJson];
                        jsonMatch.index = startIdx;
                    }
                }
                if (!jsonMatch) {
                    var incompleteMatch = str.match(/\{[^{}]*["']?(?:text|command|type|action)["']?\s*:/);
                    if (incompleteMatch) {
                        startIdx = str.indexOf('{');
                        incompleteJson = str.substring(startIdx);
                        openBraces = (incompleteJson.match(/\{/g) || []).length;
                        closeBraces = (incompleteJson.match(/\}/g) || []).length;
                        missingBraces = openBraces - closeBraces;
                        if (missingBraces > 0 && missingBraces <= 10) {
                            completedJson = incompleteJson + '}'.repeat(missingBraces);
                            jsonMatch = [completedJson];
                            jsonMatch.index = startIdx;
                        }
                    }
                }
            }
            
            if (!jsonMatch) {
                console.log('[DEBUG CURSOR] parseRobustTonyResponse: Nessun JSON trovato o non riparabile');
                clearQueueIfUnrepairable();
                return null;
            }
            
            var jsonStr = jsonMatch[0];
            console.log('[DEBUG CURSOR] parseRobustTonyResponse: JSON estratto (primo tentativo):', jsonStr.substring(0, 300) + (jsonStr.length > 300 ? '...' : ''));
            
            // Prova a parsare il JSON completo
            try {
                var parsed = JSON.parse(jsonStr);
                console.log('[DEBUG CURSOR] parseRobustTonyResponse: JSON parsato con successo:', parsed);
                
                if (parsed && typeof parsed === 'object') {
                    // Caso 1: { "text": "...", "command": {...} }
                    if (parsed.command && typeof parsed.command === 'object') {
                        var text = (parsed.text != null ? String(parsed.text).trim() : '') || '';
                        console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato formato text+command. Text:', text, 'Command:', parsed.command);
                        return { text: clean(text) || 'Ok.', command: parsed.command };
                    }
                    // Caso 1b: { "text": "...", "action": "...", "params": {...} } (formato alternativo)
                    if (parsed.action) {
                        var text = (parsed.text != null ? String(parsed.text).trim() : '') || '';
                        var actionCommand = {
                            type: parsed.action,
                            ...(parsed.params || {})
                        };
                        console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato formato text+action. Text:', text, 'Action:', parsed.action, 'Params:', parsed.params);
                        return { text: clean(text) || 'Ok.', command: actionCommand };
                    }
                    // Caso 2: { "type": "OPEN_MODAL", ... } (comando standalone)
                    if (parsed.type && (parsed.type === 'OPEN_MODAL' || parsed.type === 'SET_FIELD' || parsed.type === 'CLICK_BUTTON' || parsed.type === 'APRI_PAGINA' || parsed.type === 'SAVE_ACTIVITY')) {
                        console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato comando standalone:', parsed);
                        var textBefore = str.substring(0, jsonMatch.index).trim();
                        return { text: clean(textBefore) || 'Ok.', command: parsed };
                    }
                    // Caso 2b: { "action": "APRI_PAGINA", "params": {...} } (formato alternativo standalone)
                    if (parsed.action && !parsed.text) {
                        var textBefore = str.substring(0, jsonMatch.index).trim();
                        var actionCommand = {
                            type: parsed.action,
                            ...(parsed.params || {})
                        };
                        console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato action standalone:', parsed.action, 'Params:', parsed.params);
                        return { text: clean(textBefore) || 'Ok.', command: actionCommand };
                    }
                    // Caso 3: Solo { "text": "..." } senza command
                    if (parsed.text != null) {
                        console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato solo text, nessun command');
                        return { text: clean(String(parsed.text).trim()) || 'Ok.', command: null };
                    }
                }
            } catch (e) {
                console.warn('[DEBUG CURSOR] parseRobustTonyResponse: Errore parsing JSON completo:', e.message);
                console.log('[DEBUG CURSOR] parseRobustTonyResponse: Tentativo con completamento e trimming progressivo...');
                
                // Prima prova a completare il JSON aggiungendo parentesi mancanti
                var openBraces = (jsonStr.match(/\{/g) || []).length;
                var closeBraces = (jsonStr.match(/\}/g) || []).length;
                var missingBraces = openBraces - closeBraces;
                console.log('[DEBUG CURSOR] parseRobustTonyResponse: Parentesi nel JSON estratto - aperte:', openBraces, 'chiuse:', closeBraces, 'mancanti:', missingBraces);
                
                if (missingBraces > 0) {
                    var completedJson = jsonStr + '}'.repeat(missingBraces);
                    console.log('[DEBUG CURSOR] parseRobustTonyResponse: Tentativo con JSON completato:', completedJson.substring(0, 300) + (completedJson.length > 300 ? '...' : ''));
                    try {
                        var parsedCompleted = JSON.parse(completedJson);
                        console.log('[DEBUG CURSOR] parseRobustTonyResponse: JSON completato parsato con successo:', parsedCompleted);
                        
                        if (parsedCompleted && typeof parsedCompleted === 'object') {
                            if (parsedCompleted.command && typeof parsedCompleted.command === 'object') {
                                var textCompleted = (parsedCompleted.text != null ? String(parsedCompleted.text).trim() : '') || '';
                                console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato formato text+command dopo completamento');
                                return { text: clean(textCompleted) || 'Ok.', command: parsedCompleted.command };
                            }
                            if (parsedCompleted.action) {
                                var textCompleted = (parsedCompleted.text != null ? String(parsedCompleted.text).trim() : '') || '';
                                var actionCommand = {
                                    type: parsedCompleted.action,
                                    ...(parsedCompleted.params || {})
                                };
                                console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato formato text+action dopo completamento');
                                return { text: clean(textCompleted) || 'Ok.', command: actionCommand };
                            }
                            if (parsedCompleted.type && (parsedCompleted.type === 'OPEN_MODAL' || parsedCompleted.type === 'SET_FIELD' || parsedCompleted.type === 'CLICK_BUTTON' || parsedCompleted.type === 'APRI_PAGINA' || parsedCompleted.type === 'SAVE_ACTIVITY')) {
                                var textBeforeCompleted = str.substring(0, jsonMatch.index).trim();
                                console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato comando standalone dopo completamento');
                                return { text: clean(textBeforeCompleted) || 'Ok.', command: parsedCompleted };
                            }
                        }
                    } catch (e2) {
                        console.warn('[DEBUG CURSOR] parseRobustTonyResponse: Completamento fallito:', e2.message);
                    }
                }
                
                // Se il completamento fallisce, prova trimming progressivo
                var trimmed = jsonStr;
                for (var tries = 0; tries < 50 && trimmed.length > 10; tries++) {
                    trimmed = trimmed.slice(0, -1).trim();
                    // Rimuovi eventuali caratteri finali non validi
                    while (trimmed.length > 0 && !trimmed.endsWith('}')) {
                        trimmed = trimmed.slice(0, -1);
                    }
                    if (trimmed.length === 0) break;
                    
                    try {
                        var parsedTrimmed = JSON.parse(trimmed);
                        console.log('[DEBUG CURSOR] parseRobustTonyResponse: JSON parsato dopo trimming (tentativo', tries + 1, '):', parsedTrimmed);
                        
                        if (parsedTrimmed && typeof parsedTrimmed === 'object') {
                            if (parsedTrimmed.command && typeof parsedTrimmed.command === 'object') {
                                var textTrimmed = (parsedTrimmed.text != null ? String(parsedTrimmed.text).trim() : '') || '';
                                console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato formato text+command dopo trimming');
                                return { text: clean(textTrimmed) || 'Ok.', command: parsedTrimmed.command };
                            }
                            if (parsedTrimmed.action) {
                                var textTrimmed = (parsedTrimmed.text != null ? String(parsedTrimmed.text).trim() : '') || '';
                                var actionCommand = {
                                    type: parsedTrimmed.action,
                                    ...(parsedTrimmed.params || {})
                                };
                                console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato formato text+action dopo trimming');
                                return { text: clean(textTrimmed) || 'Ok.', command: actionCommand };
                            }
                            if (parsedTrimmed.type && (parsedTrimmed.type === 'OPEN_MODAL' || parsedTrimmed.type === 'SET_FIELD' || parsedTrimmed.type === 'CLICK_BUTTON' || parsedTrimmed.type === 'APRI_PAGINA' || parsedTrimmed.type === 'SAVE_ACTIVITY')) {
                                var textBeforeTrimmed = str.substring(0, jsonMatch.index).trim();
                                console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato comando standalone dopo trimming');
                                return { text: clean(textBeforeTrimmed) || 'Ok.', command: parsedTrimmed };
                            }
                        }
                    } catch (_) {
                        // Continua il loop
                    }
                }
                
                console.error('[DEBUG CURSOR] parseRobustTonyResponse: Impossibile parsare JSON dopo', tries, 'tentativi di trimming');
            }
            
            console.log('[DEBUG CURSOR] parseRobustTonyResponse: Nessun formato riconosciuto, ritorno null e svuoto coda');
            clearQueueIfUnrepairable();
            return null;
        }

        /**
         * Verifica se il form è completo (tutti i campi required hanno valori)
         * @param {Object} formCtx - Context del form (opzionale, se non fornito usa getCurrentFormContext)
         * @returns {{isComplete: boolean, missingFields: Array<string>}}
         */
        function checkFormCompleteness(formCtx) {
            formCtx = formCtx || getCurrentFormContext();
            var missingFields = [];
            var isComplete = true;
            
            if (!formCtx || !formCtx.fields) {
                return { isComplete: false, missingFields: ['Nessun modal attivo'] };
            }
            
            formCtx.fields.forEach(function(field) {
                if (field.required) {
                    var isEmpty = !field.value || field.value === '' || field.value === null;
                    if (isEmpty) {
                        isComplete = false;
                        missingFields.push(field.id + ' (' + field.label + ')');
                    }
                }
            });
            
            // Verifica anche direttamente nel DOM per sicurezza extra
            var modal = document.querySelector('.modal.active');
            if (modal) {
                var form = modal.querySelector('form');
                if (form) {
                    form.querySelectorAll('[required]').forEach(function(f) {
                        if (!f.value || String(f.value).trim() === '') {
                            var fieldId = f.id || f.name || '(senza id)';
                            if (missingFields.indexOf(fieldId) === -1) {
                                missingFields.push(fieldId);
                                isComplete = false;
                            }
                        }
                    });
                }
            }
            
            return { isComplete: isComplete, missingFields: missingFields };
        }

        try {
            window.__tonyCheckFormCompleteness = checkFormCompleteness;
        } catch (e) {}

        /**
         * Estrae il contesto del form attivo dal DOM (modal aperto).
         * Tony usa questi dati per guidare l'interrogatorio senza mappature statiche.
         * @returns {{ formId: string, modalId: string, fields: Array, submitId?: string }|null}
         */
        /**
         * Genera riepilogo testuale leggibile dello stato del form per Gemini.
         * Es: "- Terreno: Sangiovese ✓" se compilato, "- Terreno: (vuoto)" se mancante.
         */
        function generateFormSummary(fields) {
            if (!fields || !Array.isArray(fields)) return '';
            var placeholderPatterns = /^(seleziona|--\s*seleziona|--\s*nessun|--\s*nessuna|--\s*nessun[oa]\s|scegli\.\.\.|select\.\.\.)/i;
            var lines = [];
            for (var i = 0; i < fields.length; i++) {
                var f = fields[i];
                var lbl = (f.label || f.id || 'Campo').trim();
                var val = f.value || '';
                var displayVal = '';
                if (f.valueLabel && String(f.valueLabel).trim()) {
                    displayVal = String(f.valueLabel).trim();
                } else if (val && val.length > 0 && val.length < 80 && !/^[a-zA-Z0-9_-]{20,}$/.test(val)) {
                    displayVal = val;
                } else if (val && val.length > 0) {
                    displayVal = '(compilato)';
                }
                var line = '- ' + lbl + ': ' + (displayVal || '(vuoto)');
                // attivita-sottocategoria con placeholder "-- Nessuna sottocategoria --" e value vuoto = non ancora scelto
                var isSottocategoriaPlaceholder = (f.id === 'attivita-sottocategoria' && (!val || val === '') && (displayVal === '-- Nessuna sottocategoria --' || !displayVal));
                // lavoro-sottocategoria: stesso caso (placeholder "-- Nessuna sottocategoria --" con value vuoto = non scelto)
                var isLavoroSottocategoriaPlaceholder = (f.id === 'lavoro-sottocategoria' && (!val || val === '') && (displayVal === '-- Nessuna sottocategoria --' || !displayVal));
                // attivita-pause con valore 0 = default, non ancora chiesto all'utente
                var isPauseDefault = (f.id === 'attivita-pause' && (val === '0' || val === 0 || String(val).trim() === '0'));
                // SELECT con placeholder: "-- Nessuna --", "Seleziona...", ecc. non considerare compilato
                var isSelectPlaceholder = (/^select/.test(f.type || '')) && (!val || val === '') && displayVal && placeholderPatterns.test(displayVal);
                if (displayVal && displayVal !== '(vuoto)' && displayVal !== '(compilato)' && !isSottocategoriaPlaceholder && !isLavoroSottocategoriaPlaceholder && !isPauseDefault && !isSelectPlaceholder) {
                    line += ' ✓';
                }
                lines.push(line);
            }
            return lines.join('\n');
        }

        /**
         * Costruisce contesto form Tony da un elemento form e un root per query label/contains (modal o lo stesso form).
         * @param {Window} [ownerWindow] - Documento del form (es. parent workspace quando il widget è in iframe).
         */
        function buildTonyFormContext(form, scopeRoot, modalIdForContext, logLabel, ownerWindow) {
            if (!form || !form.id || !scopeRoot) return null;
            var win = ownerWindow || window;
            var fields = [];
            var fieldTags = ['INPUT', 'SELECT', 'TEXTAREA'];
            var elements = form.querySelectorAll(fieldTags.join(','));
            for (var i = 0; i < elements.length; i++) {
                var el = elements[i];
                if (!el.id) continue;
                if (el.type === 'hidden' || el.disabled) continue;
                if (!scopeRoot.contains(el)) continue;
                var computedStyle = win.getComputedStyle(el);
                var isElementVisible = computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden';
                var parentGroup = el.closest('[id$="-group"]');
                var isParentGroupVisible = true;
                if (parentGroup) {
                    var parentStyle = win.getComputedStyle(parentGroup);
                    isParentGroupVisible = parentStyle.display !== 'none' && parentStyle.visibility !== 'hidden';
                }
                var isVisible = isElementVisible && isParentGroupVisible;
                var rect = el.getBoundingClientRect();
                var hasDimensions = rect.width > 0 || rect.height > 0;
                var isFieldVisible = isVisible && hasDimensions;
                var isRequired = el.required || el.hasAttribute('required');
                if (!isFieldVisible && !isRequired) continue;
                var label = '';
                var labelEl = scopeRoot.querySelector('label[for="' + CSS.escape(el.id) + '"]');
                if (labelEl) label = labelEl.textContent.trim().replace(/\s*\*?\s*$/, '');
                else if (el.placeholder) label = el.placeholder;
                else if (el.getAttribute('aria-label')) label = el.getAttribute('aria-label');
                var options = [];
                var valueLabel = '';
                if (el.tagName === 'SELECT') {
                    for (var j = 0; j < el.options.length; j++) {
                        var opt = el.options[j];
                        if (opt.value || opt.text.trim()) {
                            options.push({ value: opt.value || '', text: opt.text.trim() });
                        }
                        if (opt.value === el.value && (opt.text || '').trim()) {
                            valueLabel = opt.text.trim();
                        }
                    }
                }
                var isRelevant = (form.id === 'preventivo-form') || !!label || /^(attivita|lavoro|ora|terreno|vigneto|frutteto|cliente|prodotto|movimento|macchina|trattamento)-/.test(el.id) || el.id === 'lavoro-id';
                if (!isRelevant) continue;
                var rawFieldVal = el.value || '';
                if (el.tagName === 'INPUT' && (el.type || '').toLowerCase() === 'checkbox') {
                    rawFieldVal = el.checked ? 'true' : 'false';
                }
                var fieldInfo = {
                    id: el.id,
                    label: label || el.id,
                    type: (el.type || el.tagName).toLowerCase(),
                    required: isRequired,
                    value: rawFieldVal,
                    valueLabel: valueLabel || undefined,
                    options: options.length > 0 ? options : undefined,
                    isVisible: isFieldVisible
                };
                fields.push(fieldInfo);
            }
            var submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
            var formSummary = generateFormSummary(fields);
            var requiredEmpty = fields.filter(function(f) { return f.required && (!f.value || f.value === ''); }).map(function(f) { return f.id; });
            var interviewEmpty = [];
            if ((form.id === 'prodotto-form' || form.id === 'movimento-form') && typeof tonyGetMagazzinoInterviewEmpty === 'function') {
                interviewEmpty = tonyGetMagazzinoInterviewEmpty({ formId: form.id, fields: fields }, form.id);
            }
            if (form.id === 'terreno-form' && typeof tonyGetTerrenoInterviewEmpty === 'function') {
                interviewEmpty = tonyGetTerrenoInterviewEmpty({ formId: form.id, fields: fields }, 'terreno-form');
            }
            var context = {
                formId: form.id,
                modalId: modalIdForContext || '',
                fields: fields,
                formSummary: formSummary,
                requiredEmpty: requiredEmpty,
                interviewEmpty: interviewEmpty,
                submitId: submitBtn ? submitBtn.id || form.id : form.id
            };
            return context;
        }

        /** Esposto per timer/async fuori dal blocco sendBtn (es. runProactiveCheckPreventivo dopo INJECT). */
        window.__tonyBuildTonyFormContext = buildTonyFormContext;

        function getTrattamentoCampoFormContextIfActive() {
            var mt = document.getElementById('modal-trattamento');
            if (!mt || !mt.classList.contains('active')) return null;
            var ft = document.getElementById('form-trattamento');
            if (ft && ft.id) {
                return buildTonyFormContext(ft, mt, 'modal-trattamento', 'modal-trattamento attivo');
            }
            return {
                formId: 'form-trattamento',
                modalId: 'modal-trattamento',
                fields: [],
                formSummary: '',
                requiredEmpty: [],
                interviewEmpty: []
            };
        }

        /**
         * Contesto «Segna ore» inline: `#quick-hours-form` nel documento workspace (locale o parent).
         * formId logico `field-workspace-ore-form` per allineamento CF; include lavoro da `#selected-work`.
         */
        function getFieldWorkspaceQuickHoursFormContext() {
            var qhWin = tonyResolveQuickHoursWindow();
            if (!qhWin || !qhWin.document) return null;
            var form = qhWin.document.getElementById('quick-hours-form');
            if (!form) return null;
            var ctx = buildTonyFormContext(form, form, 'quick-hours-form', 'quick-hours inline', qhWin);
            if (!ctx) return null;
            ctx.formId = 'field-workspace-ore-form';
            ctx.modalId = 'quick-hours-form';
            var selEl = qhWin.document.getElementById('selected-work');
            var lavoroVal = selEl && selEl.value ? String(selEl.value).trim() : '';
            var lavoroLabel = '';
            if (selEl && selEl.tagName === 'SELECT' && selEl.selectedIndex >= 0) {
                var opt = selEl.options[selEl.selectedIndex];
                lavoroLabel = opt ? String(opt.text || '').trim() : '';
            }
            var placeholderRe = /^(caricamento|seleziona\s+lavoro)/i;
            var lavoroLooksPlaceholder = !lavoroVal || (lavoroLabel && placeholderRe.test(String(lavoroLabel).trim()));
            var lavoroField = {
                id: 'ora-lavoro',
                label: 'Lavoro',
                type: 'select-one',
                required: true,
                value: lavoroLooksPlaceholder ? '' : lavoroVal,
                valueLabel: lavoroLooksPlaceholder ? undefined : (lavoroLabel || undefined),
                isVisible: true
            };
            ctx.fields = [lavoroField].concat(ctx.fields.filter(function(f) { return f.id !== 'ora-lavoro'; }));
            ctx.formSummary = generateFormSummary(ctx.fields);
            ctx.requiredEmpty = ctx.fields.filter(function(f) { return f.required && (!f.value || f.value === ''); }).map(function(f) { return f.id; });
            ctx.interviewEmpty = [];
            try {
                var breakEl = qhWin.document.getElementById('ora-break');
                var breakVal = 0;
                if (breakEl && String(breakEl.value || '').trim() !== '') {
                    var bp = parseInt(String(breakEl.value).trim(), 10);
                    breakVal = Number.isFinite(bp) ? bp : 0;
                }
                var startEl = qhWin.document.getElementById('ora-start');
                var endEl = qhWin.document.getElementById('ora-end');
                var hasTimes = startEl && endEl && String(startEl.value || '').trim() && String(endEl.value || '').trim();
                var chatBlobPause = tonyBuildSegnaOraUserBlobLastNUserTurns(6);
                if (hasTimes && breakVal === 0 && !tonyQuickHoursUserAcknowledgedPause(chatBlobPause)) {
                    ctx.interviewEmpty = ['ora-break'];
                }
            } catch (ePause) { /* ignore */ }
            return ctx;
        }

        function scheduleTonyQuickHoursProactiveAfterInject() {
            if (window.__tonyProactiveAskTimerId) clearTimeout(window.__tonyProactiveAskTimerId);
            if (window.__tonyIdleReminderTimerId) {
                clearTimeout(window.__tonyIdleReminderTimerId);
                window.__tonyIdleReminderTimerId = null;
            }
            if (window.__tonyProactiveFormState) window.__tonyProactiveFormState = null;
            window.__tonyProactiveAskTimerId = setTimeout(function() {
                window.__tonyProactiveAskTimerId = null;
                runTonyQuickHoursProactiveCheck(0);
            }, POST_INJECT_CHECK_DELAY_MS);
        }

        /** Dopo turno utente (CF senza inject / solo testo): attende coda inject+recovery poi stesso check proattivo. */
        var POST_USER_TURN_QH_CHECK_MS = 3800;
        function scheduleTonyQuickHoursProactiveAfterUserTurn() {
            if (window.__tonyProactiveAskTimerId) clearTimeout(window.__tonyProactiveAskTimerId);
            if (window.__tonyIdleReminderTimerId) {
                clearTimeout(window.__tonyIdleReminderTimerId);
                window.__tonyIdleReminderTimerId = null;
            }
            if (window.__tonyProactiveFormState) window.__tonyProactiveFormState = null;
            window.__tonyProactiveAskTimerId = setTimeout(function() {
                window.__tonyProactiveAskTimerId = null;
                runTonyQuickHoursProactiveCheck(0);
            }, POST_USER_TURN_QH_CHECK_MS);
        }

        function runTonyQuickHoursProactiveCheck(retryCount) {
            retryCount = retryCount || 0;
            if (window.__tonyInjectionInProgress) {
                if (retryCount < 8) {
                    window.__tonyProactiveAskTimerId = setTimeout(function() {
                        window.__tonyProactiveAskTimerId = null;
                        runTonyQuickHoursProactiveCheck(retryCount + 1);
                    }, 400);
                }
                return;
            }
            var qhWin = tonyResolveQuickHoursWindow();
            if (!qhWin || !qhWin.document || !qhWin.document.getElementById('quick-hours-form')) {
                window.__tonyProactiveFormState = null;
                return;
            }
            var fc = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
            if (!fc || fc.formId !== 'field-workspace-ore-form') {
                if (retryCount < 6) {
                    window.__tonyProactiveAskTimerId = setTimeout(function() {
                        window.__tonyProactiveAskTimerId = null;
                        runTonyQuickHoursProactiveCheck(retryCount + 1);
                    }, 350);
                }
                return;
            }
            var hasReq = fc.requiredEmpty && fc.requiredEmpty.length > 0;
            var intE = (fc.interviewEmpty && fc.interviewEmpty.length) ? fc.interviewEmpty : [];
            var complete = !hasReq && intE.length === 0;
            window.__tonyProactiveFormState = { active: true, type: complete ? 'ready_for_save' : 'missing_fields', formId: 'field-workspace-ore-form', modalId: 'quick-hours-form' };
            window.__tonyIdleReminderTimerId = setTimeout(function() {
                window.__tonyIdleReminderTimerId = null;
                if (window.__tonyInjectionInProgress) return;
                var state = window.__tonyProactiveFormState;
                if (!state || !state.active || state.formId !== 'field-workspace-ore-form') return;
                if (!tonyResolveQuickHoursWindow()) { window.__tonyProactiveFormState = null; return; }
                var fc2 = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                if (!fc2 || fc2.formId !== 'field-workspace-ore-form') { window.__tonyProactiveFormState = null; return; }
                var hasReq2 = fc2.requiredEmpty && fc2.requiredEmpty.length > 0;
                var intE2 = (fc2.interviewEmpty && fc2.interviewEmpty.length) ? fc2.interviewEmpty : [];
                var complete2 = !hasReq2 && intE2.length === 0;
                var pauseAskRecent = window.__tonyQuickHoursCfAskedPauseAt && (Date.now() - window.__tonyQuickHoursCfAskedPauseAt) < 15000;
                var saveAskRecent = window.__tonyQuickHoursCfAskedSaveAt && (Date.now() - window.__tonyQuickHoursCfAskedSaveAt) < 15000;
                if (complete2 && saveAskRecent) {
                    window.__tonyProactiveFormState = null;
                    return;
                }
                if (!complete2 && intE2.length === 1 && intE2[0] === 'ora-break' && pauseAskRecent) {
                    window.__tonyProactiveFormState = null;
                    return;
                }
                if (complete2 && typeof window.__tonyTriggerAskForSaveConfirmation === 'function') {
                    window.__tonyTriggerAskForSaveConfirmation();
                } else if (!complete2 && typeof window.__tonyTriggerAskForMissingFields === 'function') {
                    var reqP = fc2.requiredEmpty && fc2.requiredEmpty.length ? fc2.requiredEmpty : [];
                    var intP = intE2;
                    var missMsg;
                    if (reqP.length) {
                        missMsg = 'Segna ore: servono ' + tonyMagazzinoInterviewLabels(fc2, reqP) + '.';
                    } else if (intP.length) {
                        var onlyBreak = intP.length === 1 && intP[0] === 'ora-break';
                        missMsg = onlyBreak
                            ? 'Segna ore: quanti minuti di pausa hai fatto? (rispondi con un numero, es. 30, oppure «nessuna pausa»).'
                            : ('Segna ore: indica ' + tonyMagazzinoInterviewLabels(fc2, intP) + '.');
                    }
                    if (missMsg) window.__tonyTriggerAskForMissingFields(missMsg);
                }
                window.__tonyProactiveFormState = null;
            }, IDLE_REMINDER_MS);
        }

        function getCurrentFormContext() {
            var preventivoFormEl = document.getElementById('preventivo-form');
            // Un solo preventivo-form nel progetto (nuovo-preventivo-standalone): niente dipendenza da pathname/rewrite.
            if (preventivoFormEl) {
                return buildTonyFormContext(preventivoFormEl, preventivoFormEl, '', 'pagina Nuovo Preventivo');
            }
            var qhCtx = getFieldWorkspaceQuickHoursFormContext();
            if (qhCtx) return qhCtx;
            var modal = document.querySelector('.modal.active');
            if (!modal) {
                return getTrattamentoCampoFormContextIfActive();
            }
            var modalStyle = window.getComputedStyle(modal);
            if (modalStyle.display === 'none' || modalStyle.visibility === 'hidden') {
                return getTrattamentoCampoFormContextIfActive();
            }
            var form = modal.querySelector('form');
            if (!form || !form.id) {
                return getTrattamentoCampoFormContextIfActive();
            }
            return buildTonyFormContext(form, modal, modal.id || '', 'modal attivo');
        }

        /** Usare da `processTonyCommand` (scope esterno a questo blocco) per contesto form dopo inject/open modal. */
        window.__tonyGetCurrentFormContext = getCurrentFormContext;
        window.__tonyScheduleQuickHoursProactiveAfterInject = scheduleTonyQuickHoursProactiveAfterInject;
        window.__tonyScheduleQuickHoursProactiveAfterUserTurn = scheduleTonyQuickHoursProactiveAfterUserTurn;

        fab.addEventListener('click', function() {
            panel.classList.add('is-open');
            if (messagesEl.children.length === 0) {
                var welcomeMessage;
                if (tonyIsCampoLikeWorkspaceForTony()) {
                    welcomeMessage = 'Sono Tony, il tuo assistente personale per questa app.';
                } else if (isTonyAdvancedActive) {
                    welcomeMessage = 'Ciao! Sono Tony, il tuo assistente. Posso rispondere a domande, aprire pagine, compilare form e molto altro. Prova ad esempio: "Apri il modulo attività" o "Portami ai terreni".';
                } else {
                    welcomeMessage = 'Ciao! Sono Tony, la guida dell\'app. Posso rispondere a domande su come funziona l\'app e dove trovare le cose.';
                }
                appendMessage(welcomeMessage, 'tony');
            }
            inputEl.focus();
        });

        var pendingVoiceText = null;
        var isAutoMode = false;
        var isWaitingForTonyResponse = false; // Blocca mic fino a risposta (Protocollo Silenzio)
        var startListeningRef = null;
        var stopListeningRef = null;
        var autoModeTimeout = null;
        var AUTO_MODE_SILENCE_MS = 30000; // 30 secondi (inattività prima di spegnere microfono)
        var VOICE_SPEECH_END_COMMIT_MS = 450; // attesa dopo fine parlato se transcript non ancora final
        var VOICE_SPEECH_END_COMMIT_FINAL_MS = 220; // transcript già isFinal
        var VOICE_MIC_REOPEN_DELAY_MS = 100;
        var VOICE_RECOGNITION_RESTART_MS = 350;
        var VOICE_REOPEN_IDLE_DEFAULT_MS = 60;
        var voiceAutoSendTimer = null;
        var TONY_SESSION_MAX_AGE_MS = 600000;

        function clearVoiceAutoSendTimer() {
            if (voiceAutoSendTimer) {
                clearTimeout(voiceAutoSendTimer);
                voiceAutoSendTimer = null;
            }
        }

        function saveTonyState() {
            try {
                var chatHistory = (window.Tony && window.Tony.chatHistory) ? window.Tony.chatHistory : [];
                var state = {
                    chatHistory: chatHistory,
                    isAutoMode: isAutoMode,
                    lastPath: window.location.pathname,
                    timestamp: Date.now()
                };
                sessionStorage.setItem('tony_session_state', JSON.stringify(state));
                var moduli = window.Tony && window.Tony.context && (window.Tony.context.dashboard && window.Tony.context.dashboard.moduli_attivi || window.Tony.context.moduli_attivi);
                if (Array.isArray(moduli) && moduli.length > 0) {
                    sessionStorage.setItem(TONY_MODULI_STORAGE_KEY, JSON.stringify(moduli));
                }
            } catch (e) { console.warn('[Tony] saveTonyState:', e); }
        }

        function restoreTonyState() {
            try {
                var savedModuli = sessionStorage.getItem(TONY_MODULI_STORAGE_KEY);
                if (savedModuli && window.Tony && typeof window.Tony.setContext === 'function') {
                    try {
                        var moduli = JSON.parse(savedModuli);
                        if (Array.isArray(moduli) && moduli.length > 0) {
                            window.Tony.setContext('dashboard', { info_azienda: { moduli_attivi: moduli }, moduli_attivi: moduli });
                            try { window.dispatchEvent(new CustomEvent('tony-module-updated', { detail: { modules: moduli } })); } catch (ev) {}
                        }
                    } catch (e) {}
                }
                var saved = sessionStorage.getItem('tony_session_state');
                if (!saved) return;
                var state = JSON.parse(saved);
                if (Date.now() - state.timestamp > TONY_SESSION_MAX_AGE_MS) return;

                if (state.chatHistory && state.chatHistory.length && window.Tony) {
                    window.Tony.chatHistory = state.chatHistory;
                    while (messagesEl.firstChild) messagesEl.removeChild(messagesEl.firstChild);
                    for (var i = 0; i < state.chatHistory.length; i++) {
                        var m = state.chatHistory[i];
                        var txt = (m.parts && m.parts[0]) ? m.parts[0].text : '';
                        if (!txt) continue;
                        var role = m.role === 'user' ? 'user' : 'tony';
                        appendMessage(txt, role);
                    }
                }

                if (state.isAutoMode) {
                    console.log('[Tony] Ripristino sessione vocale attiva...');
                    isAutoMode = true;
                    panel.classList.add('is-auto-mode');
                    if (state.lastPath !== window.location.pathname) {
                        var skipRestoreGreeting = (window.location.search || '').indexOf('tnyNotify=') >= 0;
                        if (!skipRestoreGreeting) {
                            var pageTitle = (document.title || '').replace(/^GFV Platform\s*[-–]\s*/i, '').trim() || 'questa sezione';
                            setTimeout(function() {
                                speakWithTTS('Eccoci qui nella sezione ' + pageTitle + '. Come posso aiutarti ora?', { fromVoice: true });
                            }, 1500);
                        }
                    } else {
                        toggleAutoMode(true);
                    }
                }
            } catch (e) { console.warn('[Tony] restoreTonyState:', e); }
        }

        function checkFarewellIntent(text) {
            if (!text || typeof text !== 'string') return false;
            var t = text.toLowerCase().trim();
            var keywords = ['grazie', 'posto così', 'a posto', 'apposto', 'ciao tony', 'basta così', 'basta', 'chiudi', 'termina', 'fine', 'ottimo così', 'perfetto così', 'va bene così', 'va bene cosi', 'ci sentiamo', 'a dopo', 'buon lavoro', 'saluti'];
            var words = t.split(/\s+/).filter(Boolean);
            if (words.length < 8) {
                return keywords.some(function(k) { return t.indexOf(k) !== -1; });
            }
            return false;
        }

        function resetAutoModeTimeout() {
            if (autoModeTimeout) clearTimeout(autoModeTimeout);
            if (!isAutoMode) return;
            autoModeTimeout = setTimeout(function() {
                console.log('[Tony] Inattività raggiunta. Spengo tutto.');
                isAutoMode = false;
                toggleAutoMode(false);
                appendMessage('Sessione vocale scaduta per inattività.', 'tony');
            }, AUTO_MODE_SILENCE_MS);
        }

        function toggleAutoMode(active) {
            isAutoMode = active;
            if (autoModeTimeout) {
                clearTimeout(autoModeTimeout);
                autoModeTimeout = null;
            }
            if (active) {
                panel.classList.add('is-auto-mode');
                if (startListeningRef) startListeningRef();
                resetAutoModeTimeout();
            } else {
                clearVoiceAutoSendTimer();
                if (clearTonyAudioPipeline) clearTonyAudioPipeline({ bump: false, reason: 'auto_mode_off' });
                if (stopListeningRef) stopListeningRef();
                panel.classList.remove('is-auto-mode');
                micBtn.classList.remove('tony-mic-active', 'is-auto-mode');
                console.log('[Tony] Modalità continua disattivata.');
            }
        }

        function reopenMicIfAutoMode() {
            if (isAutoMode && startListeningRef) {
                resetAutoModeTimeout();
                setTimeout(function() {
                    if (isAutoMode && !isWaitingForTonyResponse && !tonyAudioPipelineActive()) {
                        startListeningRef();
                    }
                }, VOICE_MIC_REOPEN_DELAY_MS);
            }
        }

        function scheduleReopenMicIfIdle(delayMs) {
            setTimeout(function() {
                if (!isAutoMode || isWaitingForTonyResponse || tonyAudioPipelineActive()) return;
                reopenMicIfAutoMode();
            }, typeof delayMs === 'number' ? delayMs : VOICE_REOPEN_IDLE_DEFAULT_MS);
        }

        var voiceApi = initTonyVoice({
            onPlayEnd: function(opts) {
                if (opts && opts.isClosingSession) toggleAutoMode(false);
                else scheduleReopenMicIfIdle(50);
            },
            onPlayStart: function() {
                if (autoModeTimeout) { clearTimeout(autoModeTimeout); autoModeTimeout = null; }
                if (typeof stopListeningRef === 'function') stopListeningRef();
            }
        });
        var speakWithTTS = voiceApi.speakWithTTS;
        var prefetchTonyTTS = voiceApi.prefetchTonyTTS;
        var clearTonyAudioPipeline = voiceApi.clearTonyAudioPipeline;

        function tonyAudioElementPlaying() {
            var a = window.currentTonyAudio;
            if (!a) return false;
            try {
                if (a.error) return false;
                return !a.paused && !a.ended;
            } catch (_) {
                return false;
            }
        }

        function tonyAudioPipelineActive() {
            return !!(window.__tonyIsSpeaking ||
                (window.__tonyAudioQueue && window.__tonyAudioQueue.length > 0) ||
                tonyAudioElementPlaying());
        }

        closeBtn.addEventListener('click', function() {
            if (clearTonyAudioPipeline) clearTonyAudioPipeline({ bump: false, reason: 'panel_close' });
            panel.classList.remove('is-open');
            pendingVoiceText = null;
            toggleAutoMode(false);
            var vc = document.getElementById('tony-voice-confirm');
            if (vc) vc.style.display = 'none';
        });

        function tonyIsCoarsePointerOrMobile() {
            try {
                if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
                if (/Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent || '')) return true;
            } catch (e) { /* ignore */ }
            return false;
        }

        function openTonyChatPanel() {
            if (!panel) return;
            panel.classList.add('is-open');
            if (inputEl && typeof inputEl.focus === 'function') {
                try { inputEl.focus({ preventScroll: true }); } catch (eFocus) { inputEl.focus(); }
            }
        }
        window.__tonyOpenChatPanel = openTonyChatPanel;

        function getFriendlyGreeting() {
            var greetings = [
                'Ehilà!',
                'Buongiorno! Tutto bene?',
                'Ciao! Facciamo il punto?',
                'Salve! Come va?',
                'Ehi! Pronto a dare un\'occhiata?'
            ];
            return greetings[Math.floor(Math.random() * greetings.length)];
        }
        function formatFriendlyBriefing(data) {
            return formatDashboardOpsBriefingText(data);
        }
        window.getFriendlyGreeting = getFriendlyGreeting;
        window.formatFriendlyBriefing = formatFriendlyBriefing;
        window.buildDashboardRiassuntoText = function(b) {
            return buildDashboardRiassuntoText(b, formatFriendlyBriefing(b));
        };
        window.__tonySayGreeting = function(t) { speakWithTTS(t || getFriendlyGreeting(), {}); };

        function sendMessage(overrideText, opts) {
            opts = opts || {};
            var isRealCfTurn = !opts.proactive && !opts._displayOnly;
            if (isRealCfTurn && _isSendingMessage && !opts.fromVoice) {
                console.warn('[Tony] sendMessage ignorato: richiesta già in corso (anti-flood).');
                return;
            }
            var voiceTurnGuardId = null;
            function clearVoiceTurnGuard() {
                if (voiceTurnGuardId) {
                    clearTimeout(voiceTurnGuardId);
                    voiceTurnGuardId = null;
                }
            }
            function scheduleVoiceTurnGuard() {
                if (!opts.fromVoice) return;
                clearVoiceTurnGuard();
                voiceTurnGuardId = setTimeout(function() {
                    voiceTurnGuardId = null;
                    if (!isWaitingForTonyResponse || _isSendingMessage) return;
                    console.warn('[Tony] Turno vocale bloccato senza invio al server — sblocco microfono');
                    isWaitingForTonyResponse = false;
                    removeTyping();
                    reopenMicIfAutoMode();
                    appendMessage('Non sono riuscito a inviare la domanda. Riprova.', 'error');
                }, 3500);
            }
            function releaseVoiceTurnFromIntercept() {
                clearVoiceTurnGuard();
                if (opts.fromVoice) {
                    isWaitingForTonyResponse = false;
                    reopenMicIfAutoMode();
                }
            }
            if (window.__tonyProactiveAskTimerId) {
                clearTimeout(window.__tonyProactiveAskTimerId);
                window.__tonyProactiveAskTimerId = null;
            }
            if (window.__tonyIdleReminderTimerId) {
                clearTimeout(window.__tonyIdleReminderTimerId);
                window.__tonyIdleReminderTimerId = null;
            }
            if (window.__tonyProactiveFormState) window.__tonyProactiveFormState = null;
            var text = (overrideText != null ? String(overrideText).trim() : (inputEl.value || '').trim());
            if (!text) return;
            try {
            if (opts.fromVoice && _isSendingMessage) {
                var voiceRetryEarly = typeof opts._voiceRetry === 'number' ? opts._voiceRetry : 0;
                if (voiceRetryEarly < 20) {
                    console.warn('[Tony] Voice: coda CF occupata, riprovo tra 400 ms (' + (voiceRetryEarly + 1) + '/20)');
                    setTimeout(function() {
                        sendMessage(overrideText, Object.assign({}, opts, { _voiceRetry: voiceRetryEarly + 1 }));
                    }, 400);
                    return;
                }
                console.warn('[Tony] Voice: coda CF bloccata — reset forzato');
                _isSendingMessage = false;
                if (window.__tonySendWatchdogId) {
                    clearTimeout(window.__tonySendWatchdogId);
                    window.__tonySendWatchdogId = null;
                }
            }
            if (!opts.proactive && clearTonyAudioPipeline) {
                clearTonyAudioPipeline({ bump: true, reason: 'user_turn' });
            }
            if (opts.fromVoice) {
                clearVoiceAutoSendTimer();
                isWaitingForTonyResponse = true;
                pendingVoiceText = null;
                if (typeof stopListeningRef === 'function') stopListeningRef();
                console.log('[Tony] Voice turn avviato (build ' + (window.__TONY_CLIENT_BUILD || '?') + '):', text.slice(0, 80));
            }
            if (!window.Tony || !window.Tony.isReady()) {
                releaseVoiceTurnFromIntercept();
                appendMessage('Tony non è ancora pronto. Attendi qualche secondo e riprova.', 'error');
                return;
            }
            if (window.__tonyFreemiumBlocked) {
                releaseVoiceTurnFromIntercept();
                appendMessage('Tony non è disponibile sul piano Free. Passa al piano Base dalla pagina Abbonamento.', 'error');
                return;
            }
            if (opts.proactive && opts._displayOnly) {
                appendMessage(text, 'tony');
                if (window.Tony && Array.isArray(window.Tony.chatHistory)) {
                    window.Tony.chatHistory.push({ role: 'model', parts: [{ text: text }] });
                }
                var shouldOpenPanel = opts.openPanel === true ||
                    (opts.openPanel !== false && tonyIsCoarsePointerOrMobile() && opts.speak === false);
                if (shouldOpenPanel) openTonyChatPanel();
                saveTonyState();
                if (opts.speak !== false && typeof speakWithTTS === 'function') {
                    speakWithTTS(text, {});
                }
                if (opts.fromVoice) isWaitingForTonyResponse = false;
                return;
            }
            if (!opts.proactive && !opts._suppressUserBubble) {
                tonySetLastUserMessage(text);
            }
            if (checkFarewellIntent(text)) opts.isClosingSession = true;
            if (window.speechSynthesis) window.speechSynthesis.cancel();
            if (!opts.proactive && !opts._suppressUserBubble) {
                inputEl.value = '';
                appendMessage(text, 'user');
                tonyEnsureUserTurnInChatHistory(text);
            }
            var tonyEarlyTypingTimer = null;
            if (!opts.proactive) {
                tonyEarlyTypingTimer = setTimeout(function() {
                    appendMessage('Sto controllando...', 'typing');
                }, 150);
            }
            saveTonyState();

            // Conferma salvataggio su «Segna ore» workspace: submit locale senza CF.
            if (!opts.proactive) {
                var qhSaveIntercept = tryInterceptQuickHoursSaveBeforeCf(text, {
                    clearEarlyTyping: function () {
                        if (tonyEarlyTypingTimer) { clearTimeout(tonyEarlyTypingTimer); tonyEarlyTypingTimer = null; }
                    },
                    salvaQuickHours: tonySalvaQuickHoursWorkspace,
                    processTonyCommand: processTonyCommand,
                });
                if (qhSaveIntercept.handled) {
                    if (opts.fromVoice) isWaitingForTonyResponse = false;
                    return;
                }
            }

            var segnaOreLocalHandlers = {
                appendMessage: appendMessage,
                appendTyping: function () { appendMessage('Un attimo…', 'typing'); },
                removeTyping: removeTyping,
                speak: (window.Tony && typeof window.Tony.speak === 'function') ? window.Tony.speak.bind(window.Tony) : null,
                clearEarlyTyping: function () {
                    if (tonyEarlyTypingTimer) { clearTimeout(tonyEarlyTypingTimer); tonyEarlyTypingTimer = null; }
                },
                saveState: saveTonyState,
            };

            // «segniamo le ore» senza orari: intervista locale, 0 CF (stile lavoro/magazzino).
            if (!opts.proactive) {
                var segnaOreIntentIntercept = tryInterceptSegnaOreIntentBeforeCf(text, segnaOreLocalHandlers);
                if (segnaOreIntentIntercept.handled) {
                    if (opts.fromVoice) isWaitingForTonyResponse = false;
                    return;
                }
            }

            // Fascia oraria nel messaggio su workspace campo: inject locale, 0 CF.
            if (!opts.proactive) {
                var segnaOreTurnIntercept = tryInterceptSegnaOreTurnBeforeCf(text, segnaOreLocalHandlers);
                if (segnaOreTurnIntercept.handled) {
                    if (opts.fromVoice) isWaitingForTonyResponse = false;
                    return;
                }
            }

            // Singolo orario per messaggio (es. «alle 7» / «alle 18»): inject locale, 0 CF.
            if (!opts.proactive) {
                var segnaOreSingleIntercept = tryInterceptSegnaOreSingleTimeBeforeCf(text, segnaOreLocalHandlers);
                if (segnaOreSingleIntercept.handled) {
                    if (opts.fromVoice) isWaitingForTonyResponse = false;
                    return;
                }
            }

            // Minuti pausa (es. «60») con orari già nel form: inject pausa + domanda salva, 0 CF.
            if (!opts.proactive) {
                var qhPauseIntercept = tryInterceptSegnaOrePauseBeforeCf(text, segnaOreLocalHandlers);
                if (qhPauseIntercept.handled) {
                    if (opts.fromVoice) isWaitingForTonyResponse = false;
                    return;
                }
            }

            // Risposta breve a disambiguazione trattore/attrezzo (client-side, no CF) — prima dell'intervista creazione.
            if (!opts.proactive && !opts._skipMacchineReplyIntercept) {
                var pathLavMk = (window.location && window.location.pathname ? String(window.location.pathname).toLowerCase() : '');
                var modalLavMk = document.getElementById('lavoro-modal');
                var trSelMk = document.getElementById('lavoro-trattore');
                var atSelMk = document.getElementById('lavoro-attrezzo');
                var disambFieldMk = window.__tonyLastMacchineDisambField;
                var tipoCorrectionMk = window.TonyFormInjector &&
                    typeof window.TonyFormInjector.isLavoroTipoCorrectionText === 'function' &&
                    window.TonyFormInjector.isLavoroTipoCorrectionText(text);
                var routeToInterviewMk = window.TonyFormInjector &&
                    typeof window.TonyFormInjector.userTextShouldGoToLavoroInterviewNotMacchine === 'function' &&
                    window.TonyFormInjector.userTextShouldGoToLavoroInterviewNotMacchine(text);
                var macchineDisambPending = !tipoCorrectionMk && !routeToInterviewMk &&
                    pathLavMk.indexOf('gestione-lavori') >= 0 &&
                    modalLavMk && modalLavMk.classList.contains('active') &&
                    window.__tonyMacchineDisambAskedAt && Date.now() - window.__tonyMacchineDisambAskedAt < 120000 &&
                    disambFieldMk &&
                    (!window.__tonyLavoroCreationFlow || (window.TonyFormInjector.lavoroInterviewCanAskMacchine &&
                        window.TonyFormInjector.lavoroInterviewCanAskMacchine())) &&
                    ((disambFieldMk === 'lavoro-trattore' && trSelMk && !String(trSelMk.value || '').trim()) ||
                     (disambFieldMk === 'lavoro-attrezzo' && atSelMk && !String(atSelMk.value || '').trim())) &&
                    text && text.split(/\s+/).length <= 4 && String(text).trim().length <= 24;
                if (pathLavMk.indexOf('gestione-lavori') >= 0 && window.TonyFormInjector &&
                    typeof window.TonyFormInjector.userCanReplyToMacchineDisamb === 'function' &&
                    typeof window.TonyFormInjector.applyLavoroMacchineFromUserReply === 'function' &&
                    !tipoCorrectionMk && !routeToInterviewMk &&
                    (window.TonyFormInjector.userCanReplyToMacchineDisamb(text) || macchineDisambPending)) {
                    console.log('[Tony] Intercept macchine reply client-side:', text);
                    if (tonyEarlyTypingTimer) { clearTimeout(tonyEarlyTypingTimer); tonyEarlyTypingTimer = null; }
                    appendMessage('Un attimo…', 'typing');
                    var disambFieldErrMk = disambFieldMk === 'lavoro-attrezzo' ? 'attrezzo' : 'trattore';
                    var disambExamplesMk = disambFieldErrMk === 'attrezzo'
                        ? '(es. Erpice 200 o Erpice a denti)'
                        : '(es. Agrifull o Nuovo T5)';
                    window.TonyFormInjector.applyLavoroMacchineFromUserReply(text).then(function(res) {
                        removeTyping();
                        if (res && res.handled) {
                            if (res.message) {
                                appendMessage(res.message, 'tony');
                                if (window.Tony && typeof window.Tony.speak === 'function' && res.voiceText) {
                                    window.Tony.speak(res.voiceText);
                                }
                            }
                            if (res.readyForSave && typeof window.__tonyPromptLavoroSaveLocal === 'function') {
                                setTimeout(function() { window.__tonyPromptLavoroSaveLocal(); }, 600);
                            } else {
                                tonyTryPromptLavoroSaveIfComplete();
                            }
                        } else {
                            var errFieldMk = (res && res.field === 'lavoro-attrezzo') ? 'attrezzo' : disambFieldErrMk;
                            var errExamplesMk = errFieldMk === 'attrezzo'
                                ? '(es. Erpice 200 o Erpice a denti)'
                                : '(es. Agrifull o Nuovo T5)';
                            appendMessage('Non ho capito quale ' + errFieldMk + '. Rispondi con il nome come in elenco ' + errExamplesMk + '.', 'tony');
                            if (window.Tony && typeof window.Tony.speak === 'function') {
                                window.Tony.speak('Non ho capito quale ' + errFieldMk + '. Rispondi con il nome come in elenco.');
                            }
                        }
                    }).catch(function(errMk) {
                        removeTyping();
                        console.warn('[Tony] applyLavoroMacchineFromUserReply:', errMk);
                        appendMessage('Non ho capito quale ' + disambFieldErrMk + '. Rispondi con il nome come in elenco ' + disambExamplesMk + '.', 'tony');
                    });
                    if (opts.fromVoice) isWaitingForTonyResponse = false;
                    return;
                }
            }

            // Conferma salvataggio form (lavoro, preventivo, …) — prima di intervista/tonyAsk.
            if (!opts.proactive && !opts._skipLavoroSaveIntercept) {
                var saveIntercept = tryInterceptTonyFormSaveConfirm(text, {
                    appendMessage: appendMessage,
                    processTonyCommand: processTonyCommand,
                    clearEarlyTyping: function () {
                        if (tonyEarlyTypingTimer) { clearTimeout(tonyEarlyTypingTimer); tonyEarlyTypingTimer = null; }
                    },
                });
                if (saveIntercept.handled) {
                    if (opts.fromVoice) isWaitingForTonyResponse = false;
                    return;
                }
                var magSaveIntercept = tryInterceptMagazzinoSaveBeforeCf(text, {
                    appendMessage: appendMessage,
                    speak: (window.Tony && typeof window.Tony.speak === 'function') ? window.Tony.speak.bind(window.Tony) : null,
                    processTonyCommand: processTonyCommand,
                    clearEarlyTyping: function () {
                        if (tonyEarlyTypingTimer) { clearTimeout(tonyEarlyTypingTimer); tonyEarlyTypingTimer = null; }
                    },
                });
                if (magSaveIntercept.handled) {
                    if (opts.fromVoice) isWaitingForTonyResponse = false;
                    return;
                }
                var terSaveIntercept = tryInterceptTerrenoSaveBeforeCf(text, {
                    appendMessage: appendMessage,
                    speak: (window.Tony && typeof window.Tony.speak === 'function') ? window.Tony.speak.bind(window.Tony) : null,
                    processTonyCommand: processTonyCommand,
                    clearEarlyTyping: function () {
                        if (tonyEarlyTypingTimer) { clearTimeout(tonyEarlyTypingTimer); tonyEarlyTypingTimer = null; }
                    },
                });
                if (terSaveIntercept.handled) {
                    if (opts.fromVoice) isWaitingForTonyResponse = false;
                    return;
                }
                var movCreateIntercept = tryInterceptMovimentoCreateBeforeCf(text, {
                    appendMessage: appendMessage,
                    processTonyCommand: processTonyCommand,
                    getUrlForTarget: getUrlForTarget,
                    clearEarlyTyping: function () {
                        if (tonyEarlyTypingTimer) { clearTimeout(tonyEarlyTypingTimer); tonyEarlyTypingTimer = null; }
                    },
                });
                if (movCreateIntercept.handled) {
                    if (opts.fromVoice) isWaitingForTonyResponse = false;
                    return;
                }
                var prodCreateIntercept = tryInterceptProdottoCreateBeforeCf(text, {
                    appendMessage: appendMessage,
                    processTonyCommand: processTonyCommand,
                    getUrlForTarget: getUrlForTarget,
                    clearEarlyTyping: function () {
                        if (tonyEarlyTypingTimer) { clearTimeout(tonyEarlyTypingTimer); tonyEarlyTypingTimer = null; }
                    },
                });
                if (prodCreateIntercept.handled) {
                    if (opts.fromVoice) isWaitingForTonyResponse = false;
                    return;
                }
            }

            // Creazione lavoro locale — no CF (crea lavoro + risposte intervista). Anche cross-page.
            if (!opts.proactive && !opts._skipLavoroLocalCreation && window.TonyFormInjector &&
                tonyIsLocalLavoroCreationIntent(text)) {
                if (!tonyOnGestioneLavoriPage()) {
                    window.__tonyLavoroCreationFlow = true;
                    console.log('[Tony] Creazione lavoro cross-page: flusso locale (no CF).');
                    if (tonyEarlyTypingTimer) { clearTimeout(tonyEarlyTypingTimer); tonyEarlyTypingTimer = null; }
                    try {
                        sessionStorage.setItem('tony_pending_lavoro_local_intent', JSON.stringify({
                            text: String(text || '').trim(),
                            ts: Date.now()
                        }));
                        sessionStorage.setItem('tony_pending_intent', JSON.stringify({
                            target: 'gestione lavori',
                            modalId: 'lavoro-modal',
                            fields: null,
                            lavoroLocalIntent: true
                        }));
                    } catch (eCrossLav) {}
                    var urlCrossLav = getUrlForTarget('gestione lavori') || getUrlForTarget('lavori');
                    appendMessage('Ti porto a gestione lavori.', 'tony');
                    if (urlCrossLav) {
                        window.location.href = urlCrossLav + (urlCrossLav.indexOf('?') >= 0 ? '&' : '?') + 'tnyNotify=lavori';
                    }
                    if (opts.fromVoice) isWaitingForTonyResponse = false;
                    return;
                }
                window.__tonyLavoroCreationFlow = true;
                console.log('[Tony] Creazione lavoro: flusso locale (no CF).');
                if (tonyEarlyTypingTimer) { clearTimeout(tonyEarlyTypingTimer); tonyEarlyTypingTimer = null; }
                appendMessage('Un attimo…', 'typing');
                _isSendingMessage = true;
                var startText = String(text || '').trim();
                tonyEnsureLavoroModalForInterview().then(function () {
                    var waitReady = window.TonyFormInjector.waitForLavoriFormDataReady
                        ? window.TonyFormInjector.waitForLavoriFormDataReady(8000)
                        : Promise.resolve(true);
                    return waitReady.then(function () {
                        if (tonyIsBareCreaLavoroIntent(startText)) {
                            return window.TonyFormInjector.promptLavoroInterviewMissing();
                        }
                        var waitManodopera = window.TonyFormInjector.waitForLavoriManodoperaReady
                            ? window.TonyFormInjector.waitForLavoriManodoperaReady(6000)
                            : Promise.resolve(true);
                        return waitManodopera.then(function () {
                            return window.TonyFormInjector.applyLavoroInterviewFromUserReply(startText).then(function (resStart) {
                                if (resStart && resStart.handled) return resStart;
                                return window.TonyFormInjector.promptLavoroInterviewMissing().then(function (loc) {
                                    return { handled: true, message: (loc && loc.message) || '', voiceText: (loc && loc.message) || '' };
                                });
                            });
                        });
                    });
                }).then(function (loc) {
                    removeTyping();
                    var msg = (loc && loc.message) || 'È un lavoro di squadra o lo assegno a una persona?';
                    if (msg) {
                        appendMessage(msg, 'tony');
                        if (window.Tony && typeof window.Tony.speak === 'function') window.Tony.speak(loc && loc.voiceText ? loc.voiceText : msg);
                    }
                    if (loc && loc.readyForSave) {
                        tonyTryPromptLavoroSaveIfComplete();
                    }
                }).catch(function (err) {
                    removeTyping();
                    console.warn('[Tony] avvio locale crea lavoro:', err);
                }).finally(function () {
                    _isSendingMessage = false;
                    if (opts.fromVoice) isWaitingForTonyResponse = false;
                });
                return;
            }
            if (!opts.proactive && !opts._skipLavoroLocalCreation && window.TonyFormInjector &&
                window.__tonyLavoroCreationFlow && !isAnyTonyFormSaveConfirmPending() &&
                (String(text).trim().length >= 2 || /^\d{1,3}$/.test(String(text).trim()))) {
                    if (tonyEarlyTypingTimer) { clearTimeout(tonyEarlyTypingTimer); tonyEarlyTypingTimer = null; }
                    appendMessage('Un attimo…', 'typing');
                    _isSendingMessage = true;
                    tonyEnsureLavoroModalForInterview().then(function () {
                        var waitReady = window.TonyFormInjector.waitForLavoriFormDataReady
                            ? window.TonyFormInjector.waitForLavoriFormDataReady(8000)
                            : Promise.resolve(true);
                        return waitReady.then(function () {
                            if (window.TonyFormInjector.applyLavoroCreationTurn) {
                                return window.TonyFormInjector.applyLavoroCreationTurn(text);
                            }
                            return window.TonyFormInjector.applyLavoroInterviewFromUserReply(text);
                        });
                    }).then(function (resIv) {
                        tonyFinishLavoroInterviewTurn(resIv, opts);
                    }).catch(function (errIv) {
                        removeTyping();
                        console.warn('[Tony] intervista lavoro locale:', errIv);
                    }).finally(function () {
                        _isSendingMessage = false;
                    });
                    return;
            }

            // Risposta breve intervista lavoro (fallback se modal già aperto senza creation flow).
            if (!opts.proactive && !opts._skipLavoroInterviewIntercept && !window.__tonyLavoroCreationFlow) {
                var pathLavIv = (window.location && window.location.pathname ? String(window.location.pathname).toLowerCase() : '');
                var modalLavIv = document.getElementById('lavoro-modal');
                if (pathLavIv.indexOf('gestione-lavori') >= 0 && modalLavIv && modalLavIv.classList.contains('active') &&
                    window.TonyFormInjector &&
                    typeof window.TonyFormInjector.userCanReplyToLavoroInterview === 'function' &&
                    typeof window.TonyFormInjector.applyLavoroInterviewFromUserReply === 'function' &&
                    window.TonyFormInjector.userCanReplyToLavoroInterview(text)) {
                    console.log('[Tony] Intercept intervista lavoro client-side:', text);
                    if (tonyEarlyTypingTimer) { clearTimeout(tonyEarlyTypingTimer); tonyEarlyTypingTimer = null; }
                    appendMessage('Un attimo…', 'typing');
                    var waitIv = window.TonyFormInjector.waitForLavoriFormDataReady
                        ? window.TonyFormInjector.waitForLavoriFormDataReady(8000)
                        : Promise.resolve(true);
                    waitIv.then(function () {
                        var waitManIv = window.TonyFormInjector.waitForLavoriManodoperaReady
                            ? window.TonyFormInjector.waitForLavoriManodoperaReady(6000)
                            : Promise.resolve(true);
                        return waitManIv;
                    }).then(function () {
                        return window.TonyFormInjector.applyLavoroInterviewFromUserReply(text);
                    }).then(function(resIv) {
                        removeTyping();
                        if (resIv && resIv.handled) {
                            appendMessage(resIv.message || 'Ok.', 'tony');
                            if (window.Tony && typeof window.Tony.speak === 'function' && resIv.voiceText) {
                                window.Tony.speak(resIv.voiceText);
                            }
                            if (resIv.readyForSave && typeof window.__tonyPromptLavoroSaveLocal === 'function') {
                                setTimeout(function() { window.__tonyPromptLavoroSaveLocal(); }, 600);
                            }
                        } else {
                            appendMessage('Non ho capito. Ripeti con squadra/persona, terreno, tipo lavoro, data o durata (es. martedì, domani, 3).', 'tony');
                        }
                    }).catch(function(errIv) {
                        removeTyping();
                        console.warn('[Tony] applyLavoroInterviewFromUserReply:', errIv);
                    });
                    if (opts.fromVoice) isWaitingForTonyResponse = false;
                    return;
                }
            }

            function shouldForceLavoroStructuredReply(userText) {
                if (!userText) return false;
                var p = (window.location && window.location.pathname ? String(window.location.pathname).toLowerCase() : '');
                var onGestioneLavori = p.indexOf('gestione-lavori') >= 0;
                if (!onGestioneLavori) return false;
                var t = String(userText).toLowerCase().trim();
                if (/\bquanto\s+costa\b|\bquante\s+tariffe\b|\bquanti\s+clienti\b|\bquanti\s+preventiv|\beuro\s+per\s+ettaro\b|€\s*\/\s*ha|\blistino\b/.test(t)) {
                    return false;
                }
                if (/\b(meteo|pioggia|previsioni?|vento|tempo)\b/.test(t) ||
                    /\b(posso|conviene|riesco)\b/.test(t) && /\b(domani|oggi|trattare|erpicare|trinciare|lavorare)\b/.test(t)) {
                    return false;
                }
                var modalLav = document.getElementById('lavoro-modal');
                if (modalLav && modalLav.classList.contains('active') &&
                    /^(crea\s+un?\s+lavoro|nuovo\s+lavoro)\s*$/i.test(t)) {
                    return false;
                }
                if (window.__tonyLavoroCreationFlow) return false;
                if (/\b(portami|porta\s+in|portaci|aprimi|vai\s+(a|al|alla|allo|all\')|porta\s+a|mostrami|indirizzami|naviga)\b/i.test(t)) {
                    return false;
                }
                if (/\bapri\s+(il\s+|la\s+|l\')?(pagina|modulo|moduli|form|menu|menù|sezione)\b/i.test(t)) {
                    return false;
                }
                var hasCreateIntent = /crea\s+un?\s+lavor|nuovo\s+lavor|pianifica\s+lavor|assegna\s+lavor/.test(t);
                var hasWorkKeywords = /trattament|potatur|trinciatur|fresatur|erpicatur|\bconcimazione\b|\bconcima\b|\bconcimiamo\b|raccolt|vendemmi/.test(t);
                return hasCreateIntent || hasWorkKeywords;
            }

            function buildForcedLavoroPrompt(userText) {
                var extra = '\n\n[ISTRUZIONE CLIENT OBBLIGATORIA]\n' +
                    'Se la richiesta riguarda creazione/compilazione lavoro in Gestione Lavori, rispondi SOLO con comando strutturato, non testo libero.\n' +
                    'Output ammessi:\n' +
                    '1) OPEN_MODAL con id "lavoro-modal" e fields popolati, oppure\n' +
                    '2) INJECT_FORM_DATA con formId "lavoro-form" e formData popolato.\n' +
                    'Usa default trattamenti quando l\'utente dice solo "trattamento":\n' +
                    '- lavoro-categoria-principale = "Trattamenti"\n' +
                    '- lavoro-sottocategoria = "Meccanico"\n' +
                    '- lavoro-tipo-lavoro = "Trattamento Anticrittogamico Meccanico"\n' +
                    'Macchine: se l\'utente indica trattore e attrezzo (es. "con Agrifull e nebulizzatore"), includi nel primo formData le chiavi lavoro-trattore e lavoro-attrezzo (nome o id dal contesto parco macchine). ' +
                    'Data/durata: se il messaggio contiene "domani", "oggi", "durata un giorno", "un giorno", "per X giorni", ecc., imposta lavoro-data-inizio e lavoro-durata nel formData e NON chiedere in chat quando inizi o per quanti giorni.\n' +
                    'Assegnazione: se c\'è "per Luca", "a Marco", "assegna a…" nel messaggio, includi subito tipo-assegnazione e lavoro-operaio (o caposquadra) e NON chiedere "A chi assegni?". Lavoro pianificato: per trattore/attrezzo usa "vuoi usare" / "userai", MAI "hai usato".\n' +
                    'Nel campo "text" NON chiedere trattore o attrezzo se sono già nel messaggio utente; testo breve ok (es. conferma o salva).\n' +
                    'Non rispondere con sola domanda se i dati sono già presenti nel messaggio utente.[/ISTRUZIONE CLIENT OBBLIGATORIA]';
                return String(userText || '') + extra;
            }

            // Intercetta richiesta riassunto briefing (Dashboard) — non rubare «sì»/«ok» a interviste meteo (praticabilità trattore)
            function tonyIsPendingMeteoInterviewReply() {
                try {
                    var hist = (window.Tony && window.Tony.chatHistory) ? window.Tony.chatHistory : [];
                    for (var i = hist.length - 1; i >= 0; i--) {
                        var e = hist[i];
                        if (!e || (e.role !== 'model' && e.role !== 'assistant' && e.role !== 'tony')) continue;
                        var t = e.parts && e.parts[0] && e.parts[0].text ? String(e.parts[0].text) : '';
                        if (/riesci a passare con il trattore|riesci a lavorare il terreno/i.test(t)) return true;
                        if (/morfologia del terreno|in pianura, collina o montagna/i.test(t)) return true;
                        if (/vuoi che cerchi un.altra data|cerchi un.altra data adatt|rimandiamo l.erpicatura|posticipare la lavorazione/i.test(t)) return true;
                        return false;
                    }
                } catch (eMet) { /* ignore */ }
                return false;
            }
            function tonyLastTonyMessageOfferedRiassunto() {
                try {
                    var histOffer = (window.Tony && window.Tony.chatHistory) ? window.Tony.chatHistory : [];
                    for (var j = histOffer.length - 1; j >= 0; j--) {
                        var entry = histOffer[j];
                        if (!entry || (entry.role !== 'model' && entry.role !== 'assistant' && entry.role !== 'tony')) continue;
                        var txtOffer = entry.parts && entry.parts[0] && entry.parts[0].text ? String(entry.parts[0].text) : '';
                        return /vuoi che ti faccia un riassunto|preferisci procedere tu/i.test(txtOffer);
                    }
                } catch (_) { /* ignore */ }
                return false;
            }
            function tonyDeliverDashboardRiassunto(replyText, voiceOpts) {
                voiceOpts = voiceOpts || {};
                if (tonyEarlyTypingTimer) {
                    clearTimeout(tonyEarlyTypingTimer);
                    tonyEarlyTypingTimer = null;
                }
                removeTyping();
                var reply = String(replyText || '').trim();
                if (!reply) return;
                appendMessage(reply, 'tony');
                if (typeof speakWithTTS === 'function') {
                    speakWithTTS(reply, { fromVoice: !!voiceOpts.fromVoice, isClosingSession: !!voiceOpts.isClosingSession });
                } else if (window.Tony && typeof window.Tony.speak === 'function') {
                    window.Tony.speak(reply);
                }
                document.querySelectorAll('[data-tony-briefing]').forEach(function(el) {
                    el.classList.add('tony-highlight');
                    setTimeout(function() { el.classList.remove('tony-highlight'); }, 5000);
                });
                saveTonyState();
                clearVoiceTurnGuard();
                _isSendingMessage = false;
                sendBtn.disabled = false;
                inputEl.disabled = false;
                if (voiceOpts.fromVoice) {
                    isWaitingForTonyResponse = false;
                    if (voiceOpts.isClosingSession) toggleAutoMode(false);
                    else scheduleReopenMicIfIdle(120);
                }
            }
            if (!opts.proactive && checkFarewellIntent(text)) {
                tonyDeliverDashboardRiassunto('Perfetto, a presto! Resto qui se ti serve altro.', {
                    fromVoice: opts.fromVoice,
                    isClosingSession: true
                });
                return;
            }
            var wantsRiassunto = tonyWantsDashboardRiassunto(text, {
                allowShortConfirm: !tonyIsPendingMeteoInterviewReply() && tonyLastTonyMessageOfferedRiassunto()
            });
            if (wantsRiassunto) {
                if (!window.tonyGlobalBriefing) {
                    tonyDeliverDashboardRiassunto('Sto ancora caricando il riepilogo dashboard. Riprova tra qualche secondo.', { fromVoice: opts.fromVoice });
                    return;
                }
                var fullReply = buildDashboardRiassuntoText(window.tonyGlobalBriefing, formatFriendlyBriefing(window.tonyGlobalBriefing));
                tonyDeliverDashboardRiassunto(fullReply, { fromVoice: opts.fromVoice });
                return;
            }
            // Rileva intenti di apertura modulo
            var textLower = text.toLowerCase();
            var openModalIntents = ['apri il modulo', 'apri modulo', 'apri il form', 'apri form', 
                                   'apri attività', 'apri attivita', 'apri il modal', 'apri modal',
                                   'apri diario', 'apri segnatura', 'apri ore'];
            var hasOpenModalIntent = openModalIntents.some(function(intent) { return textLower.includes(intent); });
            
            // WIDGET SYNC: Rileva parole chiave che indicano attività lavorative
            var keywords = ['erpicato', 'trattamento', 'fatto', 'lavorato', 'trinciato', 'fresato', 'potato', 
                           'raccolto', 'semato', 'concimato', 'diserbato', 'erpicatura', 'trinciatura', 
                           'fresatura', 'potatura', 'raccolta', 'semina', 'concimazione', 'diserbo'];
            var hasKeyword = keywords.some(function(kw) { return textLower.includes(kw); });
            if (hasKeyword && document.getElementById('preventivo-form')) {
                var preventivoFieldCorrection = /\b(sottocategor|tipo\s+lavoro|tra\s+le\s+file|sulla\s+fila|è\s+trinciatur|è\s+erpicatur|la\s+lavorazione)\b/.test(textLower);
                if (preventivoFieldCorrection) hasKeyword = false;
            }
            
            // Funzione per attendere che il modal sia nel DOM e attivo - SINCRONIZZAZIONE ANTI-NULL
            var waitForModalAndGetContext = function(callback, maxAttempts, attempt) {
                attempt = attempt || 0;
                maxAttempts = maxAttempts || 10; // Max 1000ms (10 * 100ms) per dare tempo al modal di aprirsi
                
                var modal = document.querySelector('.modal.active');
                if (modal) {
                    // Verifica che il modal abbia un form con campi - AGNOSTICO: qualsiasi form
                    var form = modal.querySelector('form');
                    if (form && form.querySelectorAll('input, select, textarea').length > 0) {
                        console.log('[Tony Widget Sync] Modal trovato e attivo dopo', attempt * 100, 'ms');
                        var formCtx = getCurrentFormContext();
                        callback(formCtx);
                        return;
                    }
                }
                
                if (attempt < maxAttempts) {
                    setTimeout(function() {
                        waitForModalAndGetContext(callback, maxAttempts, attempt + 1);
                    }, 100);
                } else {
                    // SINCRONIZZAZIONE ANTI-NULL: Se il modal non appare, procedi comunque con il contesto globale
                    var maxMs = (maxAttempts || 10) * 100;
                    console.warn('[Tony Widget Sync] Timeout attesa modal (' + maxMs + 'ms), procedo con contesto corrente o globale');
                    var formCtx = getCurrentFormContext();
                    // Se formCtx è null, passa un oggetto vuoto invece di null per evitare errori
                    callback(formCtx || { fields: [] });
                }
            };
            
            // Funzione per inviare la richiesta con il contesto aggiornato. NON chiamare sendMessage dopo OPEN_MODAL/SET_FIELD.
            var sendRequestWithContext = function(formCtx, _ctxRetry) {
                _ctxRetry = typeof _ctxRetry === 'number' ? _ctxRetry : 0;
                if (_isSendingMessage) {
                    if (_ctxRetry < 20) {
                        setTimeout(function() { sendRequestWithContext(formCtx, _ctxRetry + 1); }, 300);
                    } else {
                        console.warn('[Tony] sendRequestWithContext: timeout attesa coda invio');
                        if (tonyEarlyTypingTimer) { clearTimeout(tonyEarlyTypingTimer); tonyEarlyTypingTimer = null; }
                        removeTyping();
                        releaseVoiceTurnFromIntercept();
                        appendMessage('Tony è ancora occupato con la richiesta precedente. Attendi qualche secondo e riprova.', 'error');
                    }
                    return;
                }
                var ctx = window.Tony && window.Tony.context;
                var moduli = ctx && (ctx.dashboard && ctx.dashboard.moduli_attivi || ctx.moduli_attivi);
                var needRetry = !Array.isArray(moduli) || moduli.length === 0;
                if (needRetry) {
                    var discovered = getModuliFromDiscovery();
                    if (Array.isArray(discovered) && window.Tony && typeof window.Tony.setContext === 'function') {
                        window.Tony.setContext('dashboard', { info_azienda: { moduli_attivi: discovered }, moduli_attivi: discovered });
                        saveModuliToStorage(discovered);
                        if (typeof window.__tonyCheckModuleStatus === 'function') window.__tonyCheckModuleStatus(true);
                        if (_isSendingMessage) {
                            setTimeout(function() { sendRequestWithContext(formCtx, _ctxRetry + 1); }, 250);
                            return;
                        }
                        _isSendingMessage = true;
                        setTimeout(function() {
                            _isSendingMessage = false;
                            doActualSend(formCtx);
                        }, 150);
                        return;
                    }
                }
                doActualSend(formCtx);
            };

            function doActualSend(formCtx, _doRetry) {
                _doRetry = typeof _doRetry === 'number' ? _doRetry : 0;
                if (_isSendingMessage) {
                    if (_doRetry < 25) {
                        setTimeout(function() { doActualSend(formCtx, _doRetry + 1); }, 250);
                    } else {
                        console.warn('[Tony] doActualSend: coda invio bloccata');
                        if (tonyEarlyTypingTimer) { clearTimeout(tonyEarlyTypingTimer); tonyEarlyTypingTimer = null; }
                        removeTyping();
                        releaseVoiceTurnFromIntercept();
                        appendMessage('Tony è occupato. Riprova tra poco.', 'error');
                    }
                    return;
                }
                if (!opts.proactive && tonyResolveQuickHoursWindow() && tonyIsCampoLikeWorkspaceForTony() &&
                    tonyMessageIsFieldWorkspaceSegnaOreTurn(text)) {
                    _isSendingMessage = false;
                    console.log('[Tony] Segna ore workspace: percorso locale (CF non usata).');
                    var hSave = tryInterceptQuickHoursSaveBeforeCf(text, {
                        clearEarlyTyping: function () {
                            if (tonyEarlyTypingTimer) { clearTimeout(tonyEarlyTypingTimer); tonyEarlyTypingTimer = null; }
                        },
                        salvaQuickHours: tonySalvaQuickHoursWorkspace,
                        processTonyCommand: processTonyCommand,
                    });
                    if (hSave.handled) {
                        if (opts.fromVoice) isWaitingForTonyResponse = false;
                        return;
                    }
                    if (isTonySaveConfirmText(text)) {
                        if (typeof segnaOreLocalHandlers.clearEarlyTyping === 'function') {
                            segnaOreLocalHandlers.clearEarlyTyping();
                        }
                        removeTyping();
                        tonyFinishSegnaOreLocalIntercept(
                            text,
                            'Completa data, orari e pausa nel form, poi scrivi «sì», «ok» o «salva».',
                            segnaOreLocalHandlers
                        );
                        if (opts.fromVoice) isWaitingForTonyResponse = false;
                        return;
                    }
                    if (tryInterceptSegnaOreTurnBeforeCf(text, segnaOreLocalHandlers).handled ||
                        tryInterceptSegnaOreSingleTimeBeforeCf(text, segnaOreLocalHandlers).handled ||
                        tryInterceptSegnaOrePauseBeforeCf(text, segnaOreLocalHandlers).handled ||
                        tryInterceptSegnaOreIntentBeforeCf(text, segnaOreLocalHandlers).handled) {
                        if (opts.fromVoice) isWaitingForTonyResponse = false;
                        return;
                    }
                    if (typeof segnaOreLocalHandlers.clearEarlyTyping === 'function') {
                        segnaOreLocalHandlers.clearEarlyTyping();
                    }
                    removeTyping();
                    tonyFinishSegnaOreLocalIntercept(text, tonySegnaOraUnrecognizedTurnMessage(text), segnaOreLocalHandlers);
                    if (opts.fromVoice) isWaitingForTonyResponse = false;
                    return;
                }
                _isSendingMessage = true;
                window.__tonyFieldGuardNotifiedThisTurn = false;
                if (window.__tonySendWatchdogId) {
                    clearTimeout(window.__tonySendWatchdogId);
                    window.__tonySendWatchdogId = null;
                }
                window.__tonySendWatchdogId = setTimeout(function() {
                    if (!_isSendingMessage) return;
                    console.error('[Tony] Timeout risposta (>95s): sblocco invio');
                    _isSendingMessage = false;
                    removeTyping();
                    if (streamingMsgEl) streamingMsgEl.remove();
                    appendMessage('La risposta sta impiegando troppo tempo. Controlla la connessione e riprova.', 'error');
                    sendBtn.disabled = false;
                    inputEl.disabled = false;
                    var micWd = document.getElementById('tony-mic');
                    if (micWd) micWd.disabled = false;
                    isWaitingForTonyResponse = false;
                    reopenMicIfAutoMode();
                }, 95000);
                if (opts.fromVoice) {
                    console.log('[Tony] Voice: preparazione contesto CF…');
                }
                if (window.Tony.setContext) {
                    window.Tony.setContext('form', formCtx || {});
                    var pagePath = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
                    var pageCtx = {
                        pagePath: pagePath,
                        availableTargets: Object.keys(TONY_PAGE_MAP || {}),
                        availableRoutes: (typeof window !== 'undefined' && window.__tonyAvailableRoutes) ? window.__tonyAvailableRoutes : []
                    };
                    // Lettura dinamica: leggere window.currentTableData (o top/frame) nel momento esatto in cui l'utente preme invio
                    var pathStr = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
                    var freshTable = null;
                    if (typeof window !== 'undefined') {
                        var w = window.currentTableData;
                        var t = (window.top && window.top !== window) ? window.top.currentTableData : null;
                        var buf = window.__tonyTableDataBuffer;
                        // Preferisci sempre la finestra CORRENTE se ha dati tabella (così su Clienti non si invia per sbaglio dati di un'altra pagina)
                        if (w && (w.pageType || w.summary != null || w.items !== undefined)) {
                            freshTable = w;
                            if (freshTable && freshTable.pageType === 'lavori_caposquadra' && window.parent && window.parent !== window) {
                                try {
                                    var pwData = window.parent.currentTableData;
                                    if (pwData && pwData.pageType === 'field_workspace') freshTable = pwData;
                                } catch (eIf) { /* ignore */ }
                            }
                        } else if (t && (t.pageType || t.summary != null || t.items !== undefined)) {
                            freshTable = t;
                        } else if (buf && (buf.pageType || buf.summary != null || buf.items !== undefined)) {
                            freshTable = buf;
                        } else if (window.currentTableData) {
                            freshTable = window.currentTableData;
                        }
                        if (!freshTable && window.frames && window.frames.length > 0) {
                            try {
                                for (var f = 0; f < window.frames.length; f++) {
                                    var fw = window.frames[f];
                                    try {
                                        if (fw.currentTableData && fw.location && String(fw.location.pathname || '').indexOf('macchine') >= 0) {
                                            freshTable = fw.currentTableData;
                                            break;
                                        }
                                    } catch (err) { }
                                }
                            } catch (e) { }
                        }
                        if (!freshTable && window.top !== window && window.top.currentTableData) {
                            freshTable = window.top.currentTableData;
                        }
                    }
                    pageCtx.tableDataSummary = (freshTable && freshTable.summary) ? String(freshTable.summary) : 'Dati non disponibili';
                    pageCtx.currentTableData = freshTable ? Object.assign({}, freshTable, {
                        items: (freshTable.items && Array.isArray(freshTable.items)) ? freshTable.items : (freshTable.items != null ? [].concat(freshTable.items) : [])
                    }) : null;
                    if (freshTable) {
                        console.log('[Tony] Contesto tabella inviato alla CF:', freshTable.pageType || '(no pageType)', (freshTable.items && freshTable.items.length) || 0, 'righe, summary:', (freshTable.summary || '').substring(0, 50));
                    }
                    if (pathStr.indexOf('terreni') !== -1 && freshTable && freshTable.items && Array.isArray(freshTable.items)) {
                        var _seenP = {}, _seenC = {};
                        var _poderi = [], _colture = [];
                        freshTable.items.forEach(function(it) {
                            if (it.podere && !_seenP[it.podere]) { _seenP[it.podere] = 1; _poderi.push(it.podere); }
                            if (it.coltura && !_seenC[it.coltura]) { _seenC[it.coltura] = 1; _colture.push(it.coltura); }
                        });
                        pageCtx.terreni = { poderi: _poderi, colture: _colture };
                    }
                    if (pathStr.indexOf('attivita') !== -1 && freshTable && freshTable.items && Array.isArray(freshTable.items)) {
                        var _seenT = {}, _seenL = {}, _seenCol = {};
                        var _terreni = [], _tipiLavoro = [], _colture = [];
                        freshTable.items.forEach(function(it) {
                            if (it.terreno && it.terreno !== '-' && !_seenT[it.terreno]) { _seenT[it.terreno] = 1; _terreni.push(it.terreno); }
                            if (it.tipoLavoro && it.tipoLavoro !== '-' && !_seenL[it.tipoLavoro]) { _seenL[it.tipoLavoro] = 1; _tipiLavoro.push(it.tipoLavoro); }
                            if (it.coltura && it.coltura !== '-' && !_seenCol[it.coltura]) { _seenCol[it.coltura] = 1; _colture.push(it.coltura); }
                        });
                        pageCtx.attivita = { terreni: _terreni, tipiLavoro: _tipiLavoro, colture: _colture };
                    }
                    if (freshTable && freshTable.pageType === 'field_workspace' && pathStr.indexOf('lavori-caposquadra') >= 0 && window.parent && window.parent !== window) {
                        try {
                            var pphW = window.parent.location && window.parent.location.pathname ? String(window.parent.location.pathname) : '';
                            if (pphW) pageCtx.pagePath = pphW;
                            if (window.parent.Tony && window.parent.Tony.context && window.parent.Tony.context.page && window.parent.Tony.context.page.selectedLavoroId) {
                                pageCtx.selectedLavoroId = window.parent.Tony.context.page.selectedLavoroId;
                            }
                        } catch (ePpW) { /* ignore */ }
                    }
                    window.Tony.setContext('page', pageCtx);
                }
                sendBtn.disabled = true;
                inputEl.disabled = true;
                if (document.getElementById('tony-mic')) document.getElementById('tony-mic').disabled = true;

                var useStream = typeof window.Tony.askStream === 'function';
                var streamingMsgEl = null;
                var streamTtsState = {
                    consumedLength: 0,
                    active: false,
                    gen: typeof window.__tonyGeneration === 'number' ? window.__tonyGeneration : 0
                };

                function tonySpeakAssistantText(out, speakOpts) {
                    speakOpts = speakOpts || opts;
                    var ttsGen = typeof window.__tonyGeneration === 'number' ? window.__tonyGeneration : undefined;
                    if (streamTtsState && streamTtsState.active) {
                        var remainder = getStreamingTtsRemainder(out, streamTtsState);
                        streamTtsState.active = false;
                        if (remainder && remainder.length >= 2) {
                            var remGen = streamTtsState.gen != null ? streamTtsState.gen : ttsGen;
                            if (prefetchTonyTTS) {
                                try { prefetchTonyTTS(remainder, remGen); } catch (ePf) { /* ignore */ }
                            }
                            speakWithTTS(remainder, Object.assign({}, speakOpts, remGen != null ? { gen: remGen } : {}));
                        }
                        return;
                    }
                    if (prefetchTonyTTS) {
                        try { prefetchTonyTTS(out, ttsGen); } catch (ePf) { /* ignore */ }
                    } else if (typeof window.__tonyPrefetchTTS === 'function') {
                        try { window.__tonyPrefetchTTS(out, ttsGen); } catch (ePf2) { /* ignore */ }
                    }
                    speakWithTTS(out, Object.assign({}, speakOpts, ttsGen != null ? { gen: ttsGen } : {}));
                }

                function onComplete(response) {
                try {
                removeTyping();
                var rawData = response;
                
                var parsedData = {};
                try {
                    if (typeof rawData === 'object' && rawData !== null) {
                        var cmd = rawData.command && typeof rawData.command === 'object' ? rawData.command : null;
                        if (!cmd && rawData.action) {
                            cmd = { type: rawData.action, ...(rawData.params || {}) };
                        }
                        // Normalizza: la CF può restituire command: { action: 'APRI_PAGINA', params: { target } } senza .type
                        if (cmd && cmd.action && !cmd.type) {
                            cmd = { type: cmd.action, ...(cmd.params || {}), params: cmd.params };
                        }
                        cmd = normalizeTonyCommand(cmd);
                        parsedData = {
                            text: rawData.text != null ? String(rawData.text).trim() : '',
                            command: cmd
                        };
                        if (!parsedData.text && rawData.text == null) parsedData.text = 'Ok.';
                    } else if (typeof rawData === 'string') {
                        console.log('[DEBUG CURSOR] onComplete: Dati sono stringa, avvio parsing robusto...');
                        
                        // Se modulo attivo, usa parsing ultra-robusto con regex match(/\{[\s\S]*\}/)
                        if (isTonyAdvancedActive) {
                            // Parsing ultra-robusto per modulo attivo
                            var jsonMatch = rawData.match(/\{[\s\S]*\}/);
                            if (jsonMatch) {
                                try {
                                    var jsonStr = jsonMatch[0];
                                    // Corregge chiavi non quotate
                                    jsonStr = jsonStr.replace(/\b(text|command|type|action|params|field|value|id|target)\s*:/g, '"$1":');
                                    
                                    // Fix encoding prima del parse
                                    try {
                                        // Corregge encoding errati comuni (es. \xE8 -> è)
                                        // Usa una funzione di decode sicura
                                        jsonStr = jsonStr.replace(/\\x([0-9A-Fa-f]{2})/g, function(match, hex) {
                                            return String.fromCharCode(parseInt(hex, 16));
                                        });
                                    } catch (e_enc) {
                                        console.warn('[DEBUG CURSOR] Errore fix encoding:', e_enc);
                                    }

                                    var parsed = JSON.parse(jsonStr);
                                    if (parsed && typeof parsed === 'object') {
                                        // Formato { "text": "...", "command": {...} }
                                        if (parsed.command && typeof parsed.command === 'object') {
                                            parsedData = {
                                                text: (parsed.text || '').trim() || 'Ok.',
                                                command: parsed.command
                                            };
                                        }
                                        // Formato { "action": "...", "params": {...} }
                                        else if (parsed.action) {
                                            var commandObj = { type: parsed.action };
                                            if (parsed.params && typeof parsed.params === 'object') {
                                                for (var k in parsed.params) {
                                                    if (parsed.params.hasOwnProperty(k)) {
                                                        commandObj[k] = parsed.params[k];
                                                    }
                                                }
                                            }
                                            parsedData = {
                                                text: (parsed.text || '').trim() || 'Ok.',
                                                command: commandObj
                                            };
                                        }
                                        // Formato { "type": "OPEN_MODAL", ... }
                                        else if (parsed.type) {
                                            var textBefore = rawData.substring(0, jsonMatch.index).trim();
                                            parsedData = {
                                                text: textBefore || 'Ok.',
                                                command: parsed
                                            };
                                        }
                                        // Solo text
                                        else if (parsed.text) {
                                            parsedData = { text: String(parsed.text).trim(), command: null };
                                        }
                                        else {
                                            parsedData = { text: rawData, command: null };
                                        }
                                    } else {
                                        parsedData = { text: rawData, command: null };
                                    }
                                    console.log('[DEBUG CURSOR] onComplete: Parsing ultra-robusto riuscito:', parsedData);
                                } catch (e) {
                                    console.warn('[DEBUG CURSOR] onComplete: Parsing ultra-robusto fallito, provo parser robusto:', e.message);
                                    // Fallback al parser robusto esistente
                                    var extracted = parseRobustTonyResponse(rawData);
                                    if (extracted) {
                                        parsedData = extracted;
                                    } else {
                                        parsedData = { text: rawData, command: null };
                                    }
                                }
                            } else {
                                // Nessun JSON trovato, usa parser robusto come fallback
                                var extracted = parseRobustTonyResponse(rawData);
                                parsedData = extracted || { text: rawData, command: null };
                            }
                        } else {
                            // Modulo non attivo: rimuovi qualsiasi comando JSON
                            var cleanedText = rawData.replace(/\{[\s\S]*?\}/g, '').trim();
                            parsedData = { text: cleanedText || rawData, command: null };
                            console.log('[DEBUG CURSOR] onComplete: Modulo non attivo, comandi rimossi');
                        }
                    } else {
                        console.warn('[DEBUG CURSOR] onComplete: Tipo dati sconosciuto:', typeof rawData);
                        parsedData = { text: 'Nessuna risposta.' };
                    }
                } catch (e) {
                    console.error('[DEBUG CURSOR] onComplete: ERRORE CRITICO durante parsing:', e);
                    console.error('[DEBUG CURSOR] onComplete: Stack:', e.stack);
                    parsedData = { text: typeof rawData === 'string' ? rawData : 'Nessuna risposta.' };
                }

                var resolvedUi = resolveTonyUserVisibleText(parsedData.text, parsedData.command);
                parsedData.text = resolvedUi.text;
                parsedData.command = normalizeTonyCommand(resolvedUi.command || parsedData.command);

                // Verifica e esegui comando (solo se modulo attivo)
                // Gestisci sia command che action (formato alternativo)
                var commandToExecute = parsedData.command;
                if (!commandToExecute && parsedData.action) {
                    // Converti action in command per compatibilità
                    commandToExecute = {
                        type: parsedData.action,
                        ...(parsedData.params || {})
                    };
                    console.log('[DEBUG CURSOR] onComplete: Convertito action in command:', commandToExecute);
                }
                // Fallback: testo "salvata/salvato" senza command → SAVE_ACTIVITY se form completo. NON attivare su domande (es. "Quali orari hai fatto?").
                if (!commandToExecute && parsedData.text) {
                    var txt = (parsedData.text || '').toLowerCase();
                    var isQuestion = txt.indexOf('?') >= 0 || /^(quali|quante|quale|che|cosa|come|quando|dove)\s/i.test(txt);
                    if (!isQuestion && /salvat[ao](?:\s|!|\.|$)|confermato!|ok\s*salvo|perfetto\s*salvo|attività\s*salvata|prodotto\s*salvato|movimento\s*salvato/i.test(txt)) {
                        var formCtxFb = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                        var isCompleteForSave = formCtxFb && (!formCtxFb.requiredEmpty || formCtxFb.requiredEmpty.length === 0);
                        var isSaveableTonyForm = formCtxFb && (
                            formCtxFb.formId === 'attivita-form' || formCtxFb.modalId === 'attivita-modal' ||
                            formCtxFb.formId === 'prodotto-form' || formCtxFb.modalId === 'prodotto-modal' ||
                            formCtxFb.formId === 'movimento-form' || formCtxFb.modalId === 'movimento-modal'
                        );
                        if (isCompleteForSave && isSaveableTonyForm) {
                            var pathMagFb = (typeof window !== 'undefined' && window.location && window.location.pathname) ? String(window.location.pathname).toLowerCase() : '';
                            var magAnagraficaFb = (formCtxFb.formId === 'prodotto-form' || formCtxFb.formId === 'movimento-form') &&
                                (pathMagFb.indexOf('prodotti') >= 0 || pathMagFb.indexOf('movimenti') >= 0);
                            if (magAnagraficaFb) {
                                var lastUserMag = tonyGetLastUserMessage();
                                var lastLooksOkSalva = lastUserMag && isTonySaveConfirmText(lastUserMag);
                                if (lastLooksOkSalva) {
                                    var fidMagFb = formCtxFb.formId === 'movimento-form' ? 'movimento-form' : 'prodotto-form';
                                    if (magazzinoFormReadyForTonySave(fidMagFb)) {
                                        window.__tonyMagazzinoExecuteSaveAfterCf = fidMagFb;
                                        console.log('[Tony] Fallback magazzino: ultimo messaggio utente conferma → save locale (no testo CF)');
                                    } else {
                                        commandToExecute = { type: 'SAVE_ACTIVITY' };
                                        console.log('[Tony] Fallback SAVE magazzino: ultimo messaggio utente è conferma esplicita');
                                    }
                                } else {
                                    console.log('[Tony] Fallback testo→SAVE disattivato su prodotti/movimenti: niente click Salva da solo testo modello');
                                }
                            } else {
                                commandToExecute = { type: 'SAVE_ACTIVITY' };
                                console.log('[Tony] Fallback: testo conferma salvataggio senza command → SAVE_ACTIVITY');
                            }
                        }
                    }
                }

                if (commandToExecute && opts.proactive) {
                    var proactivePt = (text || '').trim();
                    if (/confermi\s+salvataggio/i.test(proactivePt) || /^form\s+completo,?\s*confermi/i.test(proactivePt)) {
                        var proactiveCmdT = String(commandToExecute.type || '').toUpperCase();
                        if (
                            proactiveCmdT === 'SAVE_ACTIVITY' ||
                            proactiveCmdT === 'QUICK_SAVE' ||
                            proactiveCmdT === 'SUBMIT_FORM' ||
                            proactiveCmdT === 'SALVA' ||
                            proactiveCmdT === 'SAVE'
                        ) {
                            console.log('[Tony] Comando salvataggio annullato: promemoria proattivo non è conferma utente (' + proactiveCmdT + ')');
                            commandToExecute = null;
                            parsedData.command = null;
                        }
                    }
                }
                
                if (commandToExecute && typeof commandToExecute === 'object' && commandToExecute.type) {
                    
                    var allowExecute = isTonyAdvancedActive;
                    if (!allowExecute) {
                        console.warn('[Tony] Comando bloccato: modulo Tony Avanzato non attivo');
                        appendMessage('Questa funzionalità richiede il modulo Tony Avanzato. Attivalo dalla pagina Abbonamento per navigare e automatizzare operazioni.', 'tony');
                        parsedData.command = null;
                    } else {
                        // Gestisci APRI_PAGINA tramite onAction callback (come da service)
                        if (commandToExecute.type === 'APRI_PAGINA' || commandToExecute.type === 'apri_modulo') {
                            var target = (commandToExecute.params && commandToExecute.params.target) || 
                                        commandToExecute.target || 
                                        commandToExecute.modulo || 
                                        '';
                            // Il service (ask/CF) ha già chiamato triggerAction → onAction: non ripetere (evita doppio messaggio guard profilo campo)
                            var apriPaginaAlreadyHandledByService = (typeof rawData === 'object' && rawData !== null && rawData.command);
                            // Evita doppia esecuzione: se siamo già su terreni e target è terreni, il service ha già gestito (guard -> FILTER_TABLE)
                            var _isOnTerreni = (typeof window !== 'undefined' && (
                                (window.location.pathname || '').indexOf('terreni') >= 0 ||
                                (window.currentTableData && window.currentTableData.pageType === 'terreni')
                            ));
                            if (apriPaginaAlreadyHandledByService) {
                                console.log('[Tony] onComplete: APRI_PAGINA già eseguito via triggerAction nel service, skip seconda invocazione');
                            } else if (_isOnTerreni && (target === 'terreni' || target === 'terreni-test-bootstrap')) {
                                console.log('[Tony] onComplete: APRI_PAGINA terreni già gestito dalla guard, skip');
                            } else if (window.Tony && typeof window.Tony.triggerAction === 'function') {
                                console.log('[DEBUG CURSOR] onComplete: Gestione APRI_PAGINA tramite onAction, target:', target);
                                if (target) {
                                    var navPayload = { target: target };
                                    var pOn = (commandToExecute.params && typeof commandToExecute.params === 'object') ? commandToExecute.params : {};
                                    if (pOn._tonyPendingModal || commandToExecute._tonyPendingModal) {
                                        navPayload._tonyPendingModal = pOn._tonyPendingModal || commandToExecute._tonyPendingModal;
                                    }
                                    if (pOn._tonyPendingFields || commandToExecute._tonyPendingFields) {
                                        navPayload._tonyPendingFields = pOn._tonyPendingFields || commandToExecute._tonyPendingFields;
                                    }
                                    var fldOn = pOn.fields || commandToExecute.fields;
                                    if (fldOn && typeof fldOn === 'object' && Object.keys(fldOn).length > 0) {
                                        navPayload._tonyPendingFields = navPayload._tonyPendingFields || fldOn;
                                    }
                                    window.Tony.triggerAction('APRI_PAGINA', navPayload);
                                } else {
                                    console.warn('[DEBUG CURSOR] onComplete: Target non trovato nel comando APRI_PAGINA');
                                }
                            } else {
                                console.warn('[DEBUG CURSOR] onComplete: Tony.triggerAction non disponibile, uso processTonyCommand');
                                if (typeof processTonyCommand === 'function') {
                                    processTonyCommand(commandToExecute);
                                }
                            }
                        } else {
                            console.log('[Tony] ESEGUO COMANDO:', commandToExecute);
                            
                            // Evita doppio enqueue: tony-service chiama triggerAction prima di restituire { text, command },
                            // quindi onAction callback ha già accodato. Non enqueueare di nuovo.
                            var responseFromService = (typeof rawData === 'object' && rawData && rawData.command);
                            var skipEnqueueForSumColumn = (commandToExecute.type === 'SUM_COLUMN');
                            if (responseFromService) {
                                // Comando già gestito da triggerAction -> onAction-callback
                            } else if (!skipEnqueueForSumColumn && typeof window.processTonyCommand === 'function') {
                                try {
                                    enqueueTonyCommand(commandToExecute, { source: 'response-direct' });
                                } catch (e) {
                                    console.error('[Tony] onComplete: ERRORE durante enqueue:', e);
                                }
                            } else if (!skipEnqueueForSumColumn && typeof processTonyCommand === 'function') {
                                try {
                                    enqueueTonyCommand(commandToExecute, { source: 'response-local' });
                                } catch (e) {
                                    console.error('[Tony] onComplete: ERRORE durante enqueue:', e);
                                }
                            } else if (!skipEnqueueForSumColumn) {
                                console.error('[Tony] ERRORE - processTonyCommand non disponibile');
                            }
                        }
                        
                        // DOPO aver eseguito SET_FIELD, aggiorna il contesto del form per la prossima richiesta
                        if (commandToExecute && commandToExecute.type === 'SET_FIELD') {
                            setTimeout(function() {
                                var updatedCtx = getCurrentFormContext();
                                if (updatedCtx && window.Tony && window.Tony.setContext) {
                                    console.log('[DEBUG CURSOR] onComplete: Aggiornamento contesto form dopo SET_FIELD');
                                    window.Tony.setContext('form', updatedCtx);
                                }
                            }, 300);
                        }
                    }
                    
                    if (opts.fromVoice && isAutoMode) {
                        resetAutoModeTimeout();
                    }
                }
                
                var finalSpeech = parsedData.text || (typeof rawData === 'string' ? rawData : 'Ok');
                finalSpeech = (typeof cleanTextFromJsonResidue === 'function' ? cleanTextFromJsonResidue(finalSpeech) : (finalSpeech || 'Ok').trim()) || 'Ok';
                var cmdForSaveNorm = commandToExecute && commandToExecute.type ? String(commandToExecute.type).toUpperCase() : '';
                if (cmdForSaveNorm === 'SAVE_ACTIVITY' && finalSpeech && /attivit/i.test(finalSpeech)) {
                    var pathSave = (window.location.pathname || '').toLowerCase();
                    if (pathSave.indexOf('prodotti') >= 0) {
                        finalSpeech = finalSpeech.replace(/\battivit[àa]\s+salvat[ao][^.\n!?]*/gi, 'Prodotto salvato correttamente');
                    } else if (pathSave.indexOf('movimenti') >= 0) {
                        finalSpeech = finalSpeech.replace(/\battivit[àa]\s+salvat[ao][^.\n!?]*/gi, 'Movimento registrato correttamente');
                    }
                }
                var cmdForDisplay = parsedData.command || (typeof rawData === 'object' && rawData && rawData.command);
                var isSumColumnCmd = cmdForDisplay && cmdForDisplay.type === 'SUM_COLUMN';
                // Fallback: se il testo è JSON troncato (solo parentesi/virgole) e c'è un comando terreni, usa messaggio sensato
                if (finalSpeech && (finalSpeech.length < 4 || /^[\s{}\[\],":]+$/i.test(finalSpeech))) {
                    var isTerreniCmd = cmdForDisplay && ((cmdForDisplay.type === 'APRI_PAGINA' && (cmdForDisplay.target === 'terreni' || cmdForDisplay.params?.target === 'terreni')) || cmdForDisplay.type === 'FILTER_TABLE');
                    if (isTerreniCmd) finalSpeech = 'Ecco i terreni.';
                    else if (isSumColumnCmd) finalSpeech = '';
                    else finalSpeech = finalSpeech || 'Ok';
                }
                if (!opts.proactive) {
                    var pathGestLavSan = (window.location && window.location.pathname) ? String(window.location.pathname).toLowerCase() : '';
                    if (pathGestLavSan.indexOf('gestione-lavori') >= 0) {
                        finalSpeech = tonySanitizeLavoroOperaioQuestionInReply(finalSpeech, text);
                        finalSpeech = tonySanitizeLavoroDataDurataQuestionInReply(finalSpeech, text);
                        finalSpeech = tonySanitizeLavoroMacchineQuestionInReply(finalSpeech, text);
                    }
                }
                finalSpeech = tonyReplaceFieldSegnaOreSpuriousRefusal(finalSpeech, text);
                finalSpeech = tonySanitizeFieldWorkspaceSegnaOraAssistantText(text, commandToExecute, finalSpeech);
                tonyTrackQuickHoursCfInterviewFromSpeech(finalSpeech);
                var magFormSan = getActiveMagazzinoFormIdForSave();
                if (magFormSan && isTonyMagazzinoCfFakeSaveText(finalSpeech)) {
                    finalSpeech = '';
                    if (window.__tonyMagazzinoExecuteSaveAfterCf === magFormSan) {
                        window.__tonyMagazzinoExecuteSaveAfterCf = null;
                    } else if (!isTonySaveConfirmText(String(text || '').trim())) {
                        tonyScheduleMagazzinoSavePromptIfReady(magFormSan, 500);
                    }
                } else if (!magFormSan && tryRecoverMovimentoCfFakeSave(finalSpeech, {
                    appendMessage: appendMessage,
                    processTonyCommand: processTonyCommand,
                })) {
                    finalSpeech = '';
                } else if (!magFormSan && tryRecoverProdottoCfFakeSave(finalSpeech, {
                    appendMessage: appendMessage,
                    processTonyCommand: processTonyCommand,
                })) {
                    finalSpeech = '';
                } else if (tonyResolveQuickHoursWindow() && tonyIsCampoLikeWorkspaceForTony() &&
                    isTonyQuickHoursCfFakeSaveText(finalSpeech)) {
                    var qhSaveCmd = cmdForSaveNorm === 'QUICK_SAVE' || cmdForSaveNorm === 'SUBMIT_FORM' ||
                        cmdForSaveNorm === 'SUBMIT' || cmdForSaveNorm === 'SALVA' || cmdForSaveNorm === 'SAVE';
                    var qhUserConfirmed = tonyLastUserMessageExplicitSegnaOraSubmitIntent();
                    if (!qhUserConfirmed) {
                        commandToExecute = null;
                        parsedData.command = null;
                        var qhWinFake = tonyResolveQuickHoursWindow();
                        var docFake = qhWinFake && qhWinFake.document;
                        var stFake = docFake && docFake.getElementById('ora-start');
                        var enFake = docFake && docFake.getElementById('ora-end');
                        var hasTimesFake = stFake && enFake &&
                            String(stFake.value || '').trim() && String(enFake.value || '').trim();
                        if (quickHoursFormReadyForTonySave()) {
                            finalSpeech = 'Per salvare scrivi «sì» o «salva», oppure tocca «Salva ore lavorate».';
                        } else if (hasTimesFake) {
                            finalSpeech = 'Ho gli orari nel form. Quanti minuti di pausa? (es. 30, oppure «nessuna pausa»).';
                        } else {
                            finalSpeech = TONY_SEGNA_ORE_ASK_FALLBACK;
                        }
                    } else if (!qhSaveCmd) {
                        finalSpeech = '';
                    }
                }
                if (window.__tonyMagazzinoExecuteSaveAfterCf) {
                    var fidExec = window.__tonyMagazzinoExecuteSaveAfterCf;
                    window.__tonyMagazzinoExecuteSaveAfterCf = null;
                    executeTonyMagazzinoSaveLocal(fidExec, {
                        appendMessage: appendMessage,
                        speak: (window.Tony && typeof window.Tony.speak === 'function') ? window.Tony.speak.bind(window.Tony) : null,
                        processTonyCommand: processTonyCommand,
                        logSuffix: 'post-CF conferma utente',
                    });
                    finalSpeech = '';
                }
                // Profilo campo: APRI_PAGINA / OPEN_MODAL bloccati — un solo messaggio da tonyNotifyFieldProfileBlocked; no testo modello ("ti porto a…")
                var suppressAssistantTextFieldGuard = false;
                if (commandToExecute && commandToExecute.type) {
                    var ctNav = String(commandToExecute.type).toUpperCase();
                    if (ctNav === 'APRI_PAGINA' || ctNav === 'APRI_MODULO') {
                        var navTg = (commandToExecute.params && commandToExecute.params.target) || commandToExecute.target || commandToExecute.modulo || '';
                        if (navTg && typeof isRawTonyApriPaginaAllowed === 'function' && !isRawTonyApriPaginaAllowed(navTg)) {
                            suppressAssistantTextFieldGuard = true;
                            finalSpeech = '';
                        }
                    } else if (ctNav === 'OPEN_MODAL') {
                        var modalTg = commandToExecute.id || commandToExecute.target || '';
                        if (modalTg && typeof isTonyOpenModalBlockedForFieldProfile === 'function' && isTonyOpenModalBlockedForFieldProfile(modalTg)) {
                            suppressAssistantTextFieldGuard = true;
                            finalSpeech = '';
                        }
                    }
                }
                var tonyReplyShownThisTurn = false;
                function doDisplay(txt) {
                    var out = (txt != null && String(txt).trim()) ? String(txt).trim() : finalSpeech;
                    out = (out != null && String(out).trim()) ? String(out).trim() : '';
                    out = tonyEnsureSegnaOraAssistantVisible(out) || out;
                    if (!out) return;
                    tonyReplyShownThisTurn = true;
                    window.__tonyLastCfAssistantText = out;
                    if (streamingMsgEl && streamingMsgEl.parentNode) {
                        streamingMsgEl.textContent = out;
                        streamingMsgEl.classList.remove('streaming');
                        streamingMsgEl = null;
                        messagesEl.scrollTop = messagesEl.scrollHeight;
                    } else {
                        appendMessage(out, 'tony');
                    }
                    tonySpeakAssistantText(out, opts);
                }
                // SUM_COLUMN: silenzia testo intermedio; il risultato viene mostrato da processTonyCommand
                if (isSumColumnCmd) {
                } else if (suppressAssistantTextFieldGuard) {
                    if (!window.__tonyFieldGuardNotifiedThisTurn) {
                        var _fgKind = 'page';
                        var _fgTg = '';
                        if (commandToExecute && commandToExecute.type) {
                            var _fgCt = String(commandToExecute.type).toUpperCase();
                            if (_fgCt === 'OPEN_MODAL') {
                                _fgKind = 'modal';
                                _fgTg = commandToExecute.id || commandToExecute.target || '';
                            } else if (_fgCt === 'APRI_PAGINA' || _fgCt === 'APRI_MODULO') {
                                _fgTg = (commandToExecute.params && commandToExecute.params.target) || commandToExecute.target || commandToExecute.modulo || '';
                            }
                        }
                        tonyNotifyFieldProfileBlocked(_fgKind, _fgTg);
                    }
                } else {
                    var formCtxForInject = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                    var isAttivitaForm = formCtxForInject && (formCtxForInject.formId === 'attivita-form' || formCtxForInject.modalId === 'attivita-modal');
                    var isLavoroForm = formCtxForInject && (formCtxForInject.formId === 'lavoro-form' || formCtxForInject.modalId === 'lavoro-modal');
                    var shouldTryExtract = formCtxForInject && (isAttivitaForm || isLavoroForm) && !parsedData.command && finalSpeech.indexOf('```json') >= 0 && window.TonyFormInjector && window.TonyFormInjector.extractAndInjectFromResponse;
                    if (shouldTryExtract) {
                        if (isLavoroForm && window.Tony && typeof window.Tony.setContext === 'function') {
                            window.Tony.setContext('lavori', (window.Tony.context && window.Tony.context.lavori) || {});
                        }
                        window.TonyFormInjector.extractAndInjectFromResponse(finalSpeech, window.Tony ? window.Tony.context : {}, formCtxForInject).then(function(res) {
                            var toShow = res.injected ? res.cleanedText : finalSpeech;
                            if (!opts.proactive) {
                                var pathExtract = (window.location && window.location.pathname) ? String(window.location.pathname).toLowerCase() : '';
                                if (pathExtract.indexOf('gestione-lavori') >= 0) {
                                    toShow = tonySanitizeLavoroOperaioQuestionInReply(toShow, text);
                                    toShow = tonySanitizeLavoroDataDurataQuestionInReply(toShow, text);
                                    toShow = tonySanitizeLavoroMacchineQuestionInReply(toShow, text);
                                }
                            }
                            toShow = tonySanitizeFieldWorkspaceSegnaOraAssistantText(text, commandToExecute, toShow);
                            toShow = tonySanitizeQuickHoursSpeechVsFormDom(toShow, text);
                            doDisplay(toShow);
                            tonyQuickHoursRecoveryAfterCfReply(commandToExecute, text).then(function(recOk) {
                                if (!recOk) tonyMaybeScheduleQuickHoursInterviewAfterCfReply(commandToExecute, text, opts, toShow);
                            });
                        });
                    } else {
                        var qhCampoWs = tonyResolveQuickHoursWindow() && tonyIsCampoLikeWorkspaceForTony() && !opts.proactive;
                        var fsCampoShow = qhCampoWs
                            ? tonySanitizeQuickHoursSpeechVsFormDom(finalSpeech, text)
                            : finalSpeech;
                        doDisplay(fsCampoShow);
                        tonyQuickHoursRecoveryAfterCfReply(commandToExecute, text).then(function(recOk) {
                            if (!recOk) {
                                tonyMaybeScheduleQuickHoursInterviewAfterCfReply(
                                    commandToExecute, text, opts, fsCampoShow || finalSpeech
                                );
                            }
                        }).catch(function(eRec) {
                            console.warn('[Tony] Recovery ore post-CF fallita:', eRec);
                        });
                    }
                }
                if (isSumColumnCmd || suppressAssistantTextFieldGuard) {
                    tonyQuickHoursRecoveryAfterCfReply(commandToExecute, text).then(function(recOk) {
                        if (!recOk) tonyMaybeScheduleQuickHoursInterviewAfterCfReply(commandToExecute, text, opts, finalSpeech);
                    }).catch(function() { /* ignore */ });
                }
                if (!tonyReplyShownThisTurn && !isSumColumnCmd && !opts.proactive) {
                    if (suppressAssistantTextFieldGuard && !window.__tonyFieldGuardNotifiedThisTurn) {
                        tonyNotifyFieldProfileBlocked('page', '');
                    } else if (!suppressAssistantTextFieldGuard) {
                        doDisplay(tonyEnsureSegnaOraAssistantVisible(finalSpeech) || (finalSpeech && String(finalSpeech).trim()) || 'Ok.');
                    }
                }
                if (streamingMsgEl) {
                    streamingMsgEl.remove();
                    streamingMsgEl = null;
                }
                saveTonyState();
                } catch (e) {
                    console.error('[Tony] onComplete: errore non gestito', e);
                    _isSendingMessage = false;
                    removeTyping();
                    if (streamingMsgEl) streamingMsgEl.remove();
                    appendMessage('Errore durante la risposta di Tony. Riprova.', 'error');
                }
            }

            function tonyFormatCallableError(err) {
                var code = err && err.code ? String(err.code) : '';
                var msg = err && err.message ? String(err.message) : '';
                if (code.indexOf('resource-exhausted') >= 0 ||
                    /429|RESOURCE_EXHAUSTED|limite di richieste|sovraccarico|Troppe richieste/i.test(msg)) {
                    return 'Servizio AI al momento sovraccarico (limite richieste). Attendi 30–60 secondi e riprova.';
                }
                if (code.indexOf('unauthenticated') >= 0) {
                    return 'Sessione scaduta. Effettua di nuovo l\'accesso.';
                }
                if (code.indexOf('failed-precondition') >= 0 && /Gemini|chiave|GEMINI_API_KEY/i.test(msg)) {
                    return 'Servizio AI non configurato sul server (manca GEMINI_API_KEY). L\'amministratore deve eseguire: firebase functions:secrets:set GEMINI_API_KEY e poi npm run deploy:functions.';
                }
                if (code.indexOf('deadline-exceeded') >= 0 || /timeout attesa risposta/i.test(msg)) {
                    return 'La risposta del server ha impiegato troppo tempo (contesto molto grande o servizio AI lento). Riprova con un messaggio breve; se persiste, riduci i filtri in elenco o attendi un minuto.';
                }
                return msg || 'Riprova più tardi.';
            }

            function onError(err) {
                clearVoiceTurnGuard();
                _isSendingMessage = false;
                if (window.__tonySendWatchdogId) {
                    clearTimeout(window.__tonySendWatchdogId);
                    window.__tonySendWatchdogId = null;
                }
                removeTyping();
                if (streamingMsgEl) streamingMsgEl.remove();
                appendMessage('Errore: ' + tonyFormatCallableError(err), 'error');
                isWaitingForTonyResponse = false;
                reopenMicIfAutoMode();
            }

            function onFinally() {
                clearVoiceTurnGuard();
                _isSendingMessage = false;
                if (window.__tonySendWatchdogId) {
                    clearTimeout(window.__tonySendWatchdogId);
                    window.__tonySendWatchdogId = null;
                }
                isWaitingForTonyResponse = false;
                sendBtn.disabled = false;
                inputEl.disabled = false;
                var micBtn = document.getElementById('tony-mic');
                if (micBtn) micBtn.disabled = false;
                scheduleReopenMicIfIdle(80);
                inputEl.focus();
            }

                var textForTony = text;
                if (!opts.proactive && shouldForceLavoroStructuredReply(text)) {
                    textForTony = buildForcedLavoroPrompt(text);
                }

                var tonyAskOpts = {
                    skipUserHistory: !!opts.proactive,
                    proactive: !!opts.proactive
                };
                if (!opts.proactive && text && String(textForTony) !== String(text)) {
                    tonyAskOpts.historyUserMessage = text;
                }

                if (useStream) {
                    var streamingAccum = '';
                    streamTtsState = {
                        consumedLength: 0,
                        active: false,
                        gen: typeof window.__tonyGeneration === 'number' ? window.__tonyGeneration : 0
                    };
                    if (opts.fromVoice) {
                        console.log('[Tony] Voice: tonyAskStream avviato');
                    }
                    window.Tony.askStream(textForTony, Object.assign({}, tonyAskOpts, {
                        onChunk: function(chunk) {
                            try {
                                streamingAccum += chunk;
                                var daMostrare = nascondiJsonDaStreaming(streamingAccum);
                                if (!streamingMsgEl) {
                                    removeTyping();
                                    streamingMsgEl = document.createElement('div');
                                    streamingMsgEl.className = 'tony-msg tony streaming';
                                    messagesEl.appendChild(streamingMsgEl);
                                    messagesEl.scrollTop = messagesEl.scrollHeight;
                                }
                                streamingMsgEl.textContent = daMostrare;
                                messagesEl.scrollTop = messagesEl.scrollHeight;
                                var ttsChunkResult = applyStreamingTtsChunks(daMostrare, streamTtsState, {
                                    gen: streamTtsState.gen,
                                    opts: opts,
                                    prefetch: prefetchTonyTTS,
                                    speak: speakWithTTS
                                });
                                streamTtsState = ttsChunkResult.state;
                            } catch (eChunk) {
                                console.warn('[Tony] onChunk stream/TTS:', eChunk);
                            }
                        }
                    })).then(onComplete).catch(onError).finally(onFinally);
                } else {
                    if (opts.fromVoice) {
                        console.log('[Tony] Voice: tonyAsk avviato');
                    }
                    window.Tony.ask(textForTony, tonyAskOpts).then(onComplete).catch(onError).finally(onFinally);
                }
            };

            function tonyFinishLocalVoiceReply(replyText) {
                if (tonyEarlyTypingTimer) {
                    clearTimeout(tonyEarlyTypingTimer);
                    tonyEarlyTypingTimer = null;
                }
                removeTyping();
                var out = String(replyText || '').trim();
                if (!out) return;
                appendMessage(out, 'tony');
                if (window.Tony && typeof window.Tony.speak === 'function') {
                    window.Tony.speak(out);
                }
                saveTonyState();
                clearVoiceTurnGuard();
                _isSendingMessage = false;
                if (opts.fromVoice) {
                    isWaitingForTonyResponse = false;
                    scheduleReopenMicIfIdle(120);
                }
                sendBtn.disabled = false;
                inputEl.disabled = false;
                var micUnlock = document.getElementById('tony-mic');
                if (micUnlock) micUnlock.disabled = false;
            }

            function tonyFinalizeSendToCf() {
            scheduleVoiceTurnGuard();
            if (opts.fromVoice) {
                console.log('[Tony] Voice: dispatch verso CF…');
            }
            // Se rilevato intento di apertura modulo, attendi che il modal sia nel DOM
            if (hasOpenModalIntent) {
                console.log('[Tony Widget Sync] Intent apertura modulo rilevato, attendo che modal sia nel DOM (max 1000ms)');
                waitForModalAndGetContext(function(formCtx) {
                    console.log('[Tony Widget Sync] Contesto estratto dopo attesa modal:', formCtx ? JSON.stringify(formCtx, null, 2) : '{}');
                    // FIX CODA ESECUZIONE: Garantisce che formCtx non sia null
                    sendRequestWithContext(formCtx || { fields: [] });
                });
            } else if (hasKeyword) {
                // Keyword (potatura, erpicatura, ecc.): verifica subito se modal già aperto, altrimenti breve poll (300ms)
                // Il modal si apre solo dopo la risposta di Tony, quindi evitiamo attese lunghe inutili
                var formCtxNow = getCurrentFormContext();
                if (formCtxNow && formCtxNow.fields && formCtxNow.fields.length > 0) {
                    console.log('[Tony Widget Sync] Parola chiave: modal già aperto, invio contesto immediato');
                    sendRequestWithContext(formCtxNow);
                } else {
                    console.log('[Tony Widget Sync] Parola chiave: breve attesa modal (max 300ms)');
                    waitForModalAndGetContext(function(formCtx) {
                        sendRequestWithContext(formCtx || { fields: [] });
                    }, 3);
                }
            } else {
                // Nessuna keyword: usa contesto immediato
                var formCtx = getCurrentFormContext();
                // FIX CODA ESECUZIONE: Garantisce che formCtx non sia null
                sendRequestWithContext(formCtx || { fields: [] });
            }
            }

            if (!opts.proactive && !opts._displayOnly) {
                import('./meteo-dashboard-quick-reply.js').then(function(meteoMod) {
                    if (!meteoMod.isTonyDashboardPagePath || !meteoMod.isTonyDashboardPagePath()) {
                        tonyFinalizeSendToCf();
                        return;
                    }
                    if (!meteoMod.isDashboardMeteoQuestion || !meteoMod.isDashboardMeteoQuestion(text)) {
                        tonyFinalizeSendToCf();
                        return;
                    }
                    console.log('[Tony] Meteo dashboard: risposta locale (cache client)');
                    return meteoMod.tryDashboardMeteoQuickReply(text).then(function(localMeteo) {
                        if (localMeteo && localMeteo.handled && localMeteo.text) {
                            tonyFinishLocalVoiceReply(localMeteo.text);
                            return;
                        }
                        tonyFinalizeSendToCf();
                    });
                }).catch(function(eMeteoLocal) {
                    console.warn('[Tony] Meteo dashboard locale:', eMeteoLocal);
                    tonyFinalizeSendToCf();
                });
            } else {
                tonyFinalizeSendToCf();
            }
            } catch (eSendMsg) {
                console.error('[Tony] sendMessage errore sincrono:', eSendMsg);
                if (tonyEarlyTypingTimer) { clearTimeout(tonyEarlyTypingTimer); tonyEarlyTypingTimer = null; }
                removeTyping();
                releaseVoiceTurnFromIntercept();
                _isSendingMessage = false;
                appendMessage('Errore durante l\'invio. Riprova.', 'error');
            }
        }

        if (uiApi && uiApi.setSendHandler) uiApi.setSendHandler(function() { sendMessage(); });
        /** Attende che finisca il turno CF così il messaggio proattivo non viene scartato da _isSendingMessage. */
        function tonySendProactiveWhenUnlocked(text, maxAttempts) {
            maxAttempts = typeof maxAttempts === 'number' ? maxAttempts : 24;
            var msg = String(text || '').trim();
            if (!msg) return;
            if (isAnyTonyFormSaveConfirmPending()) {
                console.log('[Tony] Proattivo omesso: in attesa conferma salvataggio locale.');
                return;
            }
            var n = 0;
            function tick() {
                if (typeof sendMessage !== 'function') return;
                if (!_isSendingMessage) {
                    sendMessage(msg, { proactive: true });
                    return;
                }
                n++;
                if (n >= maxAttempts) {
                    console.warn('[Tony] Proattivo: timeout attesa invio libero, messaggio omesso:', msg.slice(0, 72));
                    return;
                }
                setTimeout(tick, 300);
            }
            tick();
        }
        window.__tonySendProactiveWhenUnlocked = tonySendProactiveWhenUnlocked;
        window.__tonyDisplayProactive = function(text, options) {
            options = options || {};
            var proactiveOpts = {
                proactive: true,
                _displayOnly: true,
                speak: options.speak !== false
            };
            if (options.openPanel === true) proactiveOpts.openPanel = true;
            sendMessage(String(text || '').trim(), proactiveOpts);
        };
        window.__tonyPromptLavoroSaveLocal = function() {
            promptTonyFormSaveLocal('lavoro-form', tonyFormSaveLocalDeps());
        };
        window.__tonyPromptPreventivoSaveLocal = function() {
            promptTonyFormSaveLocal('preventivo-form', tonyFormSaveLocalDeps());
        };
        window.__tonyPromptProdottoSaveLocal = function() {
            promptTonyFormSaveLocal('prodotto-form', tonyFormSaveLocalDeps());
        };
        window.__tonyPromptMovimentoSaveLocal = function() {
            promptTonyFormSaveLocal('movimento-form', tonyFormSaveLocalDeps());
        };
        window.__tonyPromptTerrenoSaveLocal = function() {
            promptTonyFormSaveLocal('terreno-form', tonyFormSaveLocalDeps());
        };
        window.__tonyTriggerAskForMissingFields = function(optionalMessage) {
            var defMsg = optionalMessage && String(optionalMessage).trim() ? String(optionalMessage).trim() : 'Form aperto con campi mancanti da compilare';
            tonySendProactiveWhenUnlocked(defMsg);
        };
        window.__tonyTriggerAskForSaveConfirmation = function() {
            if (isAnyTonyFormSaveConfirmPending()) return;
            var modalSave = document.getElementById('lavoro-modal');
            if (modalSave && modalSave.classList.contains('active')) {
                window.__tonyPromptLavoroSaveLocal();
                return;
            }
            if (document.getElementById('preventivo-form') && formReadyForTonySave('preventivo-form')) {
                window.__tonyPromptPreventivoSaveLocal();
                return;
            }
            var modalTerrenoSave = document.getElementById('terreno-modal');
            if (modalTerrenoSave && modalTerrenoSave.classList.contains('active') &&
                terrenoFormReadyForTonySave('terreno-form')) {
                window.__tonyPromptTerrenoSaveLocal();
                return;
            }
            var modalProdotto = document.getElementById('prodotto-modal');
            if (modalProdotto && modalProdotto.classList.contains('active') &&
                magazzinoFormReadyForTonySave('prodotto-form')) {
                window.__tonyPromptProdottoSaveLocal();
                return;
            }
            var modalMovimento = document.getElementById('movimento-modal');
            if (modalMovimento && modalMovimento.classList.contains('active') &&
                magazzinoFormReadyForTonySave('movimento-form')) {
                window.__tonyPromptMovimentoSaveLocal();
                return;
            }
            tonySendProactiveWhenUnlocked('Form completo, confermi salvataggio?');
        };
        inputEl.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        var voiceConfirmEl = document.getElementById('tony-voice-confirm');
        var voiceTranscriptEl = document.getElementById('tony-voice-transcript');
        var voiceCancelBtn = document.getElementById('tony-voice-cancel');
        var voiceOkBtn = document.getElementById('tony-voice-ok');
        var micBtn = document.getElementById('tony-mic');

        if (SpeechRecognition && micBtn && voiceConfirmEl) {
            var recognition = new SpeechRecognition();
            window.recognition = recognition; // Esposto per debug
            recognition.continuous = false; // Resta false, onspeechend + delay gestiscono la pausa
            recognition.interimResults = true;
            recognition.maxAlternatives = 1;
            recognition.lang = 'it-IT';

            recognition.onsoundstart = function() {
                clearVoiceAutoSendTimer();
                if (isAutoMode) resetAutoModeTimeout();
            };
            recognition.onresult = function(e) {
                if (tonyAudioPipelineActive() || isWaitingForTonyResponse) return;
                if (isAutoMode) resetAutoModeTimeout();
                var transcript = '';
                for (var i = e.resultIndex; i < e.results.length; i++) {
                    transcript += e.results[i][0].transcript;
                }
                var txt = transcript.trim();
                if (txt) {
                    voiceTranscriptEl.textContent = txt;
                    var lastResult = e.results.length > 0 ? e.results[e.results.length - 1] : null;
                    if (lastResult && lastResult.isFinal) {
                        pendingVoiceText = txt;
                        console.log('[Tony] Ho sentito (finale):', pendingVoiceText);
                        if (isAutoMode) scheduleAutoVoiceSend('final');
                    }
                    if (!isAutoMode) {
                        voiceConfirmEl.style.display = 'flex';
                    }
                }
            };
            recognition.onerror = function(e) {
                if (e.error !== 'aborted' && e.error !== 'no-speech') {
                    appendMessage('Microfono: ' + (e.error === 'not-allowed' ? 'permesso negato' : e.error), 'error');
                }
            };

            function startListening() {
                if (!window.Tony || !window.Tony.isReady()) return;
                clearVoiceAutoSendTimer();
                pendingVoiceText = null;
                voiceConfirmEl.style.display = 'none';
                try {
                    recognition.start();
                    micBtn.classList.add('tony-mic-active');
                    if (isAutoMode) {
                        panel.classList.add('is-auto-mode');
                        micBtn.classList.add('is-auto-mode');
                    }
                } catch (err) { /* già in esecuzione */ }
            }
            function stopListening() {
                try { recognition.stop(); } catch (err) {}
                micBtn.classList.remove('tony-mic-active', 'is-auto-mode');
                if (!isAutoMode) panel.classList.remove('is-auto-mode');
            }

            startListeningRef = startListening;
            stopListeningRef = stopListening;

            function scheduleAutoVoiceSend(reason) {
                if (!isAutoMode || tonyAudioPipelineActive() || isWaitingForTonyResponse) return;
                clearVoiceAutoSendTimer();
                var hasFinalText = !!(pendingVoiceText && String(pendingVoiceText).trim());
                var delay = hasFinalText ? VOICE_SPEECH_END_COMMIT_FINAL_MS : VOICE_SPEECH_END_COMMIT_MS;
                voiceAutoSendTimer = setTimeout(function() {
                    voiceAutoSendTimer = null;
                    if (!isAutoMode || tonyAudioPipelineActive() || isWaitingForTonyResponse) return;
                    stopListening();
                    var textToSend = pendingVoiceText ? String(pendingVoiceText).trim() : '';
                    pendingVoiceText = null;
                    if (textToSend) {
                        console.log('[Tony] Invio testo vocale (' + (reason || 'auto') + '):', textToSend);
                        resetAutoModeTimeout();
                        sendMessage(textToSend, { fromVoice: true });
                    } else {
                        console.warn('[Tony] Auto-send senza testo (' + (reason || 'auto') + ').');
                        reopenMicIfAutoMode();
                    }
                }, delay);
            }

            recognition.onspeechend = function() {
                if (tonyAudioPipelineActive() || isWaitingForTonyResponse) {
                    console.log('[Tony] Speechend ignorato: Tony in risposta o TTS attivo.');
                    try { recognition.stop(); } catch (err) {}
                    clearVoiceAutoSendTimer();
                    pendingVoiceText = null;
                    return;
                }
                console.log('[Tony] Fine rilevamento voce, attendo processamento...');
                scheduleAutoVoiceSend('speechend');
            };
            recognition.onspeechstart = function() {
                clearVoiceAutoSendTimer();
                /* Barge-in solo dal click sul microfono (evita eco TTS → troncamento in auto-mode). */
            };

            recognition.onend = function() {
                if (tonyAudioPipelineActive()) {
                    console.log('[Tony] TTS in corso, microfono resta spento.');
                    return;
                }
                if (isWaitingForTonyResponse) {
                    console.log('[Tony] In attesa risposta Tony, microfono non riaccendo.');
                    return;
                }
                if (isAutoMode && autoModeTimeout) {
                    console.log('[Tony] Fine sessione naturale, riaccendo tra ' + VOICE_RECOGNITION_RESTART_MS + ' ms...');
                    setTimeout(function() {
                        if (isAutoMode && autoModeTimeout && !isWaitingForTonyResponse && !tonyAudioPipelineActive()) {
                            try { recognition.start(); } catch (err) {}
                        }
                    }, VOICE_RECOGNITION_RESTART_MS);
                } else {
                    micBtn.classList.remove('tony-mic-active');
                }
            };

            var speakWithTTSCore = speakWithTTS;
            speakWithTTS = function(text, opts) {
                clearVoiceAutoSendTimer();
                pendingVoiceText = null;
                if (typeof stopListeningRef === 'function') stopListeningRef();
                return speakWithTTSCore(text, opts);
            };

            micBtn.addEventListener('click', function() {
                if (tonyAudioPipelineActive()) {
                    if (clearTonyAudioPipeline) clearTonyAudioPipeline({ bump: true, reason: 'barge_in_mic' });
                    if (isAutoMode && startListeningRef) {
                        startListeningRef();
                        resetAutoModeTimeout();
                    }
                    return;
                }
                toggleAutoMode(!isAutoMode);
            });

            voiceCancelBtn.addEventListener('click', function() {
                pendingVoiceText = null;
                voiceConfirmEl.style.display = 'none';
            });
            voiceOkBtn.addEventListener('click', function() {
                if (pendingVoiceText) {
                    var t = pendingVoiceText;
                    pendingVoiceText = null;
                    voiceConfirmEl.style.display = 'none';
                    sendMessage(t, { fromVoice: true });
                }
            });
        } else if (micBtn) {
            micBtn.style.display = 'none';
        }

        var tonyConfirmOverlay = document.getElementById('tony-confirm-overlay');
        var tonyConfirmMessage = document.getElementById('tony-confirm-message');
        var tonyConfirmCancel = document.getElementById('tony-confirm-cancel');
        var tonyConfirmOk = document.getElementById('tony-confirm-ok');
        var tonyConfirmResolve = null;

        tonyConfirmCancel.addEventListener('click', function() {
            if (tonyConfirmResolve) { tonyConfirmResolve(false); tonyConfirmResolve = null; }
            tonyConfirmOverlay.style.display = 'none';
        });
        tonyConfirmOk.addEventListener('click', function() {
            if (tonyConfirmResolve) { tonyConfirmResolve(true); tonyConfirmResolve = null; }
            tonyConfirmOverlay.style.display = 'none';
        });
        tonyConfirmOverlay.addEventListener('click', function(e) {
            if (e.target === tonyConfirmOverlay && tonyConfirmResolve) {
                tonyConfirmResolve(false);
                tonyConfirmResolve = null;
                tonyConfirmOverlay.style.display = 'none';
            }
        });

        window.showTonyConfirmDialog = function(message) {
            return new Promise(function(resolve) {
                tonyConfirmResolve = resolve;
                tonyConfirmMessage.textContent = message;
                tonyConfirmOverlay.style.display = 'flex';
            });
        };

        window.addEventListener('beforeunload', saveTonyState);
        window.__tonyRestoreSession = restoreTonyState;
    }

    var TONY_MODULI_STORAGE_KEY = 'tony_moduli_attivi';

    /**
     * Auto-discovery: recupera moduli_attivi da sessionStorage, window.userModules o window.tenantConfig/tenant.
     * Usato quando la pagina non ha chiamato syncTonyModules (es. prodotti-standalone, sottopagine moduli).
     * @returns {string[]|null} Array moduli o null se non trovato
     */
    function getModuliFromDiscovery() {
        try {
            // Fonte autoritativa dashboard/bootstrap dopo lettura tenant su Firestore (anche [] se tutti i moduli spenti)
            if (window.__gfvTenantData && Array.isArray(window.__gfvTenantData.modules)) {
                return window.__gfvTenantData.modules.slice();
            }
        } catch (e) {}
        try {
            // Dati impostati da standalone-bootstrap prima dell'iniezione del widget (anche [] se tenant senza moduli)
            if (Array.isArray(window.__gfvModuliAttivi)) return window.__gfvModuliAttivi.slice();
        } catch (e) {}
        try {
            var fromStorage = sessionStorage.getItem(TONY_MODULI_STORAGE_KEY);
            if (fromStorage) {
                var parsed = JSON.parse(fromStorage);
                if (Array.isArray(parsed)) return parsed.slice();
            }
        } catch (e) {}
        try {
            if (Array.isArray(window.userModules) && window.userModules.length > 0) return window.userModules;
        } catch (e) {}
        try {
            var tc = window.tenantConfig || window.tenant;
            var mods = tc && (tc.modules || tc.moduli_attivi);
            if (Array.isArray(mods) && mods.length > 0) return mods;
        } catch (e) {}
        return null;
    }

    /**
     * Salva moduli in sessionStorage (persistenza tra navigazioni).
     */
    function saveModuliToStorage(arr) {
        try {
            if (Array.isArray(arr)) {
                sessionStorage.setItem(TONY_MODULI_STORAGE_KEY, JSON.stringify(arr));
            }
        } catch (e) {}
    }

    /**
     * Helper globale: sincronizza i moduli attivi con Tony. Richiamabile da qualsiasi pagina standalone
     * dopo il caricamento dati tenant. Se Tony non è ancora pronto, riprova automaticamente (fino a ~10s).
     * @param {string[]} modules - Array id moduli (es. ['frutteto','tony','vigneto'])
     * @param {{ retry?: boolean }} options - options.retry = false disabilita il retry
     */
    window.syncTonyModules = function(modules, options) {
        var arr = Array.isArray(modules) ? modules : [];
        console.log('[Tony Sync] Ricevuti moduli:', arr.length ? arr : '(vuoto)');
        var doRetry = options && options.retry === false ? false : true;
        var maxRetries = 25;
        var attempt = 0;
        function apply() {
            if (typeof window.setTonyContext === 'function') {
                window.setTonyContext({ moduli_attivi: arr });
                saveModuliToStorage(arr);
                return true;
            }
            if (window.Tony && typeof window.Tony.setContext === 'function') {
                window.Tony.setContext('dashboard', { info_azienda: { moduli_attivi: arr }, moduli_attivi: arr });
                saveModuliToStorage(arr);
                try { window.dispatchEvent(new CustomEvent('tony-module-updated', { detail: { modules: arr } })); } catch (e) {}
                return true;
            }
            return false;
        }
        if (apply()) return;
        if (!doRetry) return;
        var t = setInterval(function() {
            attempt++;
            if (apply() || attempt >= maxRetries) clearInterval(t);
        }, 400);
    };

    async function initTonyWhenReady() {
        var maxWaitMs = 15000;
        var interval = 250;
        var maxAttempts = Math.max(40, Math.ceil(maxWaitMs / interval));
        if (typeof window !== 'undefined' && !window.__firebaseReady) {
            try {
                await new Promise(function(resolve, reject) {
                    var t = setTimeout(function() { resolve(); }, Math.min(12000, maxWaitMs));
                    function onReady() {
                        clearTimeout(t);
                        if (typeof window !== 'undefined') {
                            window.removeEventListener('gfv-firebase-ready', onReady);
                        }
                        resolve();
                    }
                    if (typeof window !== 'undefined') {
                        window.addEventListener('gfv-firebase-ready', onReady);
                        if (window.__firebaseReady) { onReady(); return; }
                    }
                });
            } catch (e) { /* continue to poll */ }
        }
        for (var i = 0; i < maxAttempts; i++) {
            try {
                var firebaseService = await import('../../services/firebase-service.js');
                var app = null;
                if (firebaseService.getAppInstanceIfReady) {
                    app = firebaseService.getAppInstanceIfReady();
                } else if (firebaseService.getAppInstance) {
                    try { app = firebaseService.getAppInstance(); } catch (e) { app = null; }
                }
                if (app) {
                    var Tony = (await import('../../services/tony-service.js')).Tony;
                    window.Tony = Tony;
                    Tony.speak = function(text) { if (typeof window.__tonySayGreeting === 'function') window.__tonySayGreeting(text); };
                    await Tony.init(app);
                    Tony.setContext('session', {
                        current_page: {
                            path: window.location.pathname,
                            title: document.title,
                            timestamp: new Date().toISOString()
                        }
                    });
                    // Carica rotte disponibili per supporto evolutivo (nuove cartelle in modules/)
                    try {
                        var configUrl = (scriptBase ? new URL('../config/tony-routes.json', scriptBase).href : (window.location.pathname.replace(/\/[^/]*$/, '') + '/../config/tony-routes.json'));
                        var routesRes = await fetch(configUrl, { cache: 'no-store' });
                        if (routesRes.ok) {
                            var routesData = await routesRes.json();
                            window.__tonyAvailableRoutes = (routesData && routesData.routes) || [];
                            console.log('[Tony] Rotte disponibili caricate:', window.__tonyAvailableRoutes.length);
                        }
                    } catch (e) {
                        window.__tonyAvailableRoutes = [];
                    }
                    var _tonyWidgetInitTime = Date.now();

                    function normalizeTonyPlanClient(raw) {
                        if (raw == null || raw === '') return 'base';
                        var p = String(raw).trim().toLowerCase();
                        if (p === 'free' || p === 'freemium') return 'free';
                        if (p === 'starter' || p === 'professional' || p === 'enterprise') return 'base';
                        return p === 'base' ? 'base' : 'base';
                    }
                    function getTonyResolvedPlanId() {
                        try {
                            if (window.__gfvSubscriptionPlanId != null && window.__gfvSubscriptionPlanId !== '') {
                                return normalizeTonyPlanClient(window.__gfvSubscriptionPlanId);
                            }
                            var d = Tony.context && Tony.context.dashboard;
                            if (d && (d.plan || d.piano)) return normalizeTonyPlanClient(d.plan || d.piano);
                            var t = window.__gfvTenantData;
                            if (t && (t.plan || t.piano)) return normalizeTonyPlanClient(t.plan || t.piano);
                        } catch (e) {}
                        return null;
                    }
                    function applyTonyFreemiumGate() {
                        var plan = getTonyResolvedPlanId();
                        if (plan !== 'free') {
                            window.__tonyFreemiumBlocked = false;
                            return;
                        }
                        window.__tonyFreemiumBlocked = true;
                        var fabEl = document.getElementById('tony-fab');
                        var panelEl = document.getElementById('tony-panel');
                        if (fabEl) fabEl.style.display = 'none';
                        if (panelEl) panelEl.style.display = 'none';
                    }

                    window.setTonyContext = function(payload) {
                        if (!window.Tony || typeof window.Tony.setContext !== 'function') return;
                        var d = (window.Tony.context && window.Tony.context.dashboard) || {};
                        window.Tony.setContext('dashboard', Object.assign({}, d, payload));
                        try {
                            if (payload && payload.utente_corrente && Array.isArray(payload.utente_corrente.ruoli) && payload.utente_corrente.ruoli.length > 0) {
                                sessionStorage.setItem('gfv_tony_utente_ruoli', JSON.stringify(payload.utente_corrente.ruoli));
                            }
                        } catch (e) { /* ignore */ }
                        if (payload && (payload.plan != null || payload.piano != null)) {
                            window.__gfvSubscriptionPlanId = normalizeTonyPlanClient(payload.plan || payload.piano);
                            try {
                                applyTonyFreemiumGate();
                            } catch (ePl) {}
                        }
                        if (payload && payload.moduli_attivi) {
                            saveModuliToStorage(payload.moduli_attivi);
                            try { window.dispatchEvent(new CustomEvent('tony-module-updated', { detail: { modules: payload.moduli_attivi } })); } catch (err) {}
                        }
                    };
                    // syncTonyModules è definito a livello script (sopra) per essere disponibile prima dell'init di Tony
                    // Recupera stato modulo Tony dal context o dal database
                    var lastStatusCheck = 0;
                    var STATUS_CHECK_THROTTLE_MS = 1000; // Throttle: max 1 chiamata al secondo
                    var _tonyProntoLogged = false;
                    
                    // Ultimo controllo forzato sui dati tenant forniti dal standalone-bootstrap (moduli_attivi + piano)
                    (function applyBootstrapTenantContext() {
                        try {
                            var td = window.__gfvTenantData;
                            if (td && window.Tony && typeof window.Tony.setContext === 'function') {
                                var pid = normalizeTonyPlanClient(td.plan || td.piano || 'base');
                                window.__gfvSubscriptionPlanId = pid;
                                window.Tony.setContext('dashboard', { plan: pid, piano: pid });
                            }
                            var moduliBoot = null;
                            if (window.__gfvTenantData && Array.isArray(window.__gfvTenantData.modules)) {
                                moduliBoot = window.__gfvTenantData.modules.slice();
                            } else if (Array.isArray(window.__gfvModuliAttivi)) {
                                moduliBoot = window.__gfvModuliAttivi.slice();
                            }
                            if (moduliBoot != null && window.Tony && typeof window.Tony.setContext === 'function') {
                                window.Tony.setContext('dashboard', { info_azienda: { moduli_attivi: moduliBoot }, moduli_attivi: moduliBoot });
                                saveModuliToStorage(moduliBoot);
                                if (typeof console !== 'undefined' && console.log) {
                                    console.log('[Tony] Moduli impostati da bootstrap:', moduliBoot.length);
                                }
                            }
                        } catch (e) {}
                    })();

                    var checkTonyModuleStatus = function(force) {
                        var now = Date.now();
                        if (!force && (now - lastStatusCheck) < STATUS_CHECK_THROTTLE_MS) {
                            return;
                        }
                        lastStatusCheck = now;
                        
                        try {
                            var context = Tony.context || {};
                            var dashModsRaw = context.dashboard ? context.dashboard.moduli_attivi : undefined;
                            var moduliAttivi;
                            if (Array.isArray(dashModsRaw)) {
                                moduliAttivi = dashModsRaw;
                            } else if (Array.isArray(context.info_azienda && context.info_azienda.moduli_attivi)) {
                                moduliAttivi = context.info_azienda.moduli_attivi;
                            } else if (Array.isArray(context.moduli_attivi)) {
                                moduliAttivi = context.moduli_attivi;
                            } else {
                                moduliAttivi = [];
                            }
                            // Solo se il tenant non ha ancora valorizzato dashboard.moduli_attivi: evita loop infinito quando la lista autoritativa è [] (zero moduli attivi).
                            if (!Array.isArray(dashModsRaw)) {
                                var discovered = getModuliFromDiscovery();
                                if (Array.isArray(discovered) && window.Tony && typeof window.Tony.setContext === 'function') {
                                    window.Tony.setContext('dashboard', { info_azienda: { moduli_attivi: discovered }, moduli_attivi: discovered });
                                    saveModuliToStorage(discovered);
                                    moduliAttivi = discovered;
                                    console.log('[Tony] Moduli ripristinati da auto-discovery (tenant/bootstrap/storage):', moduliAttivi.length);
                                }
                            }
                            
                            var wasActive = isTonyAdvancedActive;
                            isTonyAdvancedActive =
                                Array.isArray(moduliAttivi) &&
                                moduliAttivi.some(function(m) { return String(m).toLowerCase() === 'tony'; });
                            
                            if (wasActive !== isTonyAdvancedActive || force) {
                                console.log('[Tony] Stato modulo avanzato:', isTonyAdvancedActive ? 'ATTIVO' : 'NON ATTIVO', 'Moduli:', moduliAttivi);
                            }
                            try {
                                applyTonyFreemiumGate();
                            } catch (eFg) {}
                            
                            var elapsedSinceInit = now - _tonyWidgetInitTime;
                            if (!Array.isArray(dashModsRaw) && elapsedSinceInit > 5000) {
                                console.warn('[Tony] ATTENZIONE: moduli_attivi non ancora nel contesto dashboard. La pagina potrebbe non aver inizializzato Tony correttamente.');
                            }
                        } catch (e) {
                            console.warn('[Tony] Errore recupero stato modulo:', e);
                            isTonyAdvancedActive = false;
                        }
                    };
                    
                    checkTonyModuleStatus(true);
                    try {
                        applyTonyFreemiumGate();
                    } catch (eInitFg) {}
                    window.__tonyCheckModuleStatus = checkTonyModuleStatus;
                    
                    var statusCheckCount = 0;
                    var statusCheckInterval = setInterval(function() {
                        statusCheckCount++;
                        if (statusCheckCount <= 3) {
                            checkTonyModuleStatus();
                        } else {
                            clearInterval(statusCheckInterval);
                        }
                    }, 3000);
                    setTimeout(function() {
                        clearInterval(statusCheckInterval);
                    }, 10000);
                    
                    function logProntoIfNeeded() {
                        if (_tonyProntoLogged) return;
                        _tonyProntoLogged = true;
                        console.log('[Tony] Pronto (widget standalone). Modulo avanzato:', isTonyAdvancedActive ? 'ATTIVO' : 'NON ATTIVO', 'build:', window.__TONY_CLIENT_BUILD || '?');
                        try {
                            window.dispatchEvent(new CustomEvent('tony-widget-ready'));
                        } catch (eReady) { /* ignore */ }
                    }
                    
window.addEventListener('tony-module-updated', function(e) {
                        var newModules = e.detail && e.detail.modules;
                        if (newModules && Array.isArray(newModules)) {
                            console.log('[Tony] Evento aggiornamento modulo ricevuto:', newModules);
                            saveModuliToStorage(newModules);
                            if (window.Tony && window.Tony.setContext) {
                                window.Tony.setContext('dashboard', {
                                    info_azienda: { moduli_attivi: newModules },
                                    moduli_attivi: newModules
                                });
                            }
                            checkTonyModuleStatus(true);
                            logProntoIfNeeded();
                        }
                    });
                    window.addEventListener('gfv-subscription-plan', function(ev) {
                        try {
                            var pid = ev.detail && ev.detail.planId != null ? ev.detail.planId : null;
                            if (pid == null) return;
                            window.__gfvSubscriptionPlanId = pid;
                            if (window.Tony && typeof window.Tony.setContext === 'function') {
                                var n = normalizeTonyPlanClient(pid);
                                window.Tony.setContext('dashboard', { plan: n, piano: n });
                            }
                            applyTonyFreemiumGate();
                            checkTonyModuleStatus(true);
                        } catch (e) {}
                    });

                    function applyTableDataToContext(data) {
                        if (!data || !window.Tony || typeof window.Tony.setContext !== 'function') return;
                        window.currentTableData = data;
                        var page = (window.Tony.context && window.Tony.context.page) || {};
                        window.Tony.setContext('page', Object.assign({}, page, {
                            tableDataSummary: data.summary || '',
                            currentTableData: data
                        }));
                    }
                    // Buffer globale: se table-data-ready è stato emesso prima che il listener fosse attivo, recupera i dati al bootstrap
                    if (typeof window !== 'undefined' && window.__tonyTableDataBuffer && (window.__tonyTableDataBuffer.summary != null || window.__tonyTableDataBuffer.items != null || window.__tonyTableDataBuffer.pageType != null)) {
                        applyTableDataToContext(window.__tonyTableDataBuffer);
                        window.__tonyTableDataBuffer = null;
                    }
                    window.addEventListener('table-data-ready', function(e) {
                        var data = (e.detail && e.detail.currentTableData) || (e.detail && e.detail.data && e.detail.data.currentTableData) || e.detail;
                        if (data && (data.summary != null || data.items != null || data.pageType != null)) applyTableDataToContext(data);
                    });
                    if (window.currentTableData && (window.currentTableData.summary != null || window.currentTableData.items != null)) {
                        applyTableDataToContext(window.currentTableData);
                    }

                    Tony.onAction(function(actionName, params) {
                        
                        if (actionName === 'APRI_PAGINA' || actionName === 'apri_modulo') {
                            if (!isTonyAdvancedActive) {
                                console.warn('[Tony] APRI_PAGINA bloccato: modulo Tony Avanzato non attivo');
                                appendMessage('Per aprire pagine con Tony attiva il modulo Tony Avanzato dalla pagina Abbonamento. Nel frattempo puoi usare il menu dell\'app.', 'tony');
                                return;
                            }
                            console.log('[DEBUG CURSOR] onAction callback: Caso APRI_PAGINA');
                            var actualParams = params.params && typeof params.params === 'object' ? params.params : params;
                            var rawTarget = (actualParams.target || actualParams.modulo || '').toString().trim();
                            
                            if (!rawTarget) {
                                console.warn('[DEBUG CURSOR] onAction callback: Target non trovato nei params');
                                console.warn('[Tony] Target non trovato. Params ricevuti:', params);
                                return;
                            }
                            
                            if (!isRawTonyApriPaginaAllowed(rawTarget)) {
                                console.warn('[Tony] onAction APRI_PAGINA bloccato per profilo campo:', rawTarget);
                                tonyNotifyFieldProfileBlocked('page', rawTarget);
                                return;
                            }
                            if (!isApriPaginaTargetAllowed(rawTarget, getModuliAttiviFromTonyContext())) {
                                console.warn('[Tony] onAction APRI_PAGINA bloccato: modulo non attivo', rawTarget);
                                tonyNotifyModuleInactive(rawTarget, appendMessage);
                                return;
                            }
                            
                            // Guardia: se siamo già sulla pagina terreni e il target è terreni, non navigare (filtra invece)
                            var isOnTerreniPage = (typeof window !== 'undefined' && (
                                (window.location.pathname || '').indexOf('terreni') >= 0 ||
                                (window.currentTableData && window.currentTableData.pageType === 'terreni')
                            ));
                            if (isOnTerreniPage && (rawTarget === 'terreni' || rawTarget === 'terreni-test-bootstrap')) {
                                console.log('[Tony] Già sulla pagina terreni: ignoro APRI_PAGINA, eseguo FILTER_TABLE reset');
                                enqueueTonyCommand({ type: 'FILTER_TABLE', params: { filterType: 'reset', value: '' } }, { source: 'apri-pagina-guard' });
                                return;
                            }
                            // Guardia: se siamo già sulla pagina attivita e il target è attivita/diario, non navigare (filtra invece)
                            var isOnAttivitaPage = (typeof window !== 'undefined' && (
                                (window.location.pathname || '').indexOf('attivita') >= 0 ||
                                (window.currentTableData && window.currentTableData.pageType === 'attivita')
                            ));
                            if (isOnAttivitaPage && (rawTarget === 'attivita' || rawTarget === 'diario' || rawTarget === 'attivita-standalone')) {
                                console.log('[Tony] Già sulla pagina attivita: ignoro APRI_PAGINA, eseguo FILTER_TABLE reset');
                                enqueueTonyCommand({ type: 'FILTER_TABLE', params: { filterType: 'reset', value: '' } }, { source: 'apri-pagina-guard' });
                                return;
                            }
                            if (tonyBlockApriSegnaturaIfOnFieldWorkspace(rawTarget, actualParams)) {
                                return;
                            }

                            var url = getUrlForTarget(rawTarget);
                            if (!url) {
                                console.warn('[DEBUG CURSOR] onAction callback: Pagina non mappata');
                                console.warn('[Tony] Pagina non mappata per target:', rawTarget, 'Params:', params);
                                return;
                            }
                            var resolved = resolveTarget(rawTarget) || rawTarget;
                            if (resolved === 'meteo' && actualParams.fields && actualParams.fields.terrenoId) {
                                url += (url.indexOf('?') >= 0 ? '&' : '?') + 'terrenoId=' + encodeURIComponent(String(actualParams.fields.terrenoId));
                            }
                            var label = TONY_LABEL_MAP[resolved] || resolved;
                            var urlWithNotify = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'tnyNotify=' + encodeURIComponent(resolved);
                            window.showTonyConfirmDialog('Aprire la pagina "' + label + '"?').then(function(ok) {
                                if (ok) {
                                    _tonyCommandQueue.length = 0;
                                    // Salvataggio intent solo alla conferma utente (evita residui da comandi annullati)
                                    var pendingModal = actualParams._tonyPendingModal;
                                    var pendingFields = actualParams._tonyPendingFields || actualParams.fields;
                                    var rawT = (rawTarget || '').toLowerCase();
                                    if (!pendingModal && pendingFields && typeof pendingFields === 'object' && Object.keys(pendingFields).length > 0) {
                                        if (rawT.indexOf('nuovo') >= 0 && rawT.indexOf('preventivo') >= 0) pendingModal = 'preventivo-form';
                                    }
                                    // Cross-page: CF / onComplete possono passare solo target senza _tonyPendingModal né fields → serve comunque modal per checkTonyPendingAfterNav.
                                    if (!pendingModal && rawT.indexOf('nuovo') >= 0 && rawT.indexOf('preventivo') >= 0) {
                                        pendingModal = 'preventivo-form';
                                    }
                                    if (pendingModal && rawTarget) {
                                        try {
                                            var rawTNav = (rawTarget || '').toLowerCase();
                                            var isNuovoPrevNav = pendingModal === 'preventivo-form' || (rawTNav.indexOf('nuovo') >= 0 && rawTNav.indexOf('preventivo') >= 0);
                                            var userPromptForPending = isNuovoPrevNav ? tonyGetUserPromptForPendingNav() : '';
                                            sessionStorage.setItem('tony_pending_intent', JSON.stringify({
                                                target: rawTarget,
                                                modalId: pendingModal,
                                                fields: (pendingFields && typeof pendingFields === 'object') ? pendingFields : null,
                                                userPromptForPending: userPromptForPending || null
                                            }));
                                            console.log('[Tony] tony_pending_intent salvato (post-conferma):', pendingModal, rawTarget);
                                        } catch (e) { console.warn('[Tony] Impossibile salvare pending intent:', e); }
                                    }
                                    window.location.hash = '#' + resolved;
                                    try {
                                        window.dispatchEvent(new CustomEvent('tony-navigate', { detail: { target: resolved, hash: '#' + resolved, url: urlWithNotify } }));
                                    } catch (e) {}
                                    window.location.href = urlWithNotify;
                                }
                            });
                            return;
                        }
                        
                        // SICUREZZA: per le altre azioni blocca se modulo non attivo
                        if (!isTonyAdvancedActive) {
                            console.warn('[Tony] Azione bloccata: modulo Tony Avanzato non attivo');
                            appendMessage('Questa funzionalità richiede il modulo Tony Avanzato. Attivalo dalla Dashboard per automatizzare operazioni.', 'tony');
                            return;
                        }
                        var command = { type: actionName };
                        if (params && typeof params === 'object') {
                            for (var k in params) if (params.hasOwnProperty(k)) command[k] = params[k];
                        }
                        var qOpts = { source: 'onAction-callback' };
                        // Su pagina Nuovo Preventivo il form è già nel DOM: niente attesa artificiale in coda (prima c'erano 400ms).
                        if (actionName === 'INJECT_FORM_DATA' && command.formId === 'preventivo-form' && document.getElementById('preventivo-form')) {
                            qOpts.delayMs = 0;
                        }
                        enqueueTonyCommand(command, qOpts);
                    });
                    
                    // Aggiorna stato modulo quando context dashboard viene settato (con debounce)
                    var setContextTimeout = null;
                    var originalSetContext = Tony.setContext;
                    if (originalSetContext) {
                        Tony.setContext = function(moduleName, data) {
                            originalSetContext.call(this, moduleName, data);
                            if (moduleName === 'dashboard' || moduleName === 'session') {
                                if (setContextTimeout) clearTimeout(setContextTimeout);
                                setContextTimeout = setTimeout(function() {
                                    checkTonyModuleStatus(true);
                                    logProntoIfNeeded();
                                }, 300);
                            }
                        };
                    }
                    
                    // Pronto: dopo dati dashboard (evento) o al massimo 2.5s per non bloccare
                    setTimeout(function() { logProntoIfNeeded(); }, 2500);
                    if (typeof window.__tonyRestoreSession === 'function') window.__tonyRestoreSession();
                    (function checkTnyNotifyGreeting() {
                        var params = new URLSearchParams(window.location.search);
                        var tny = params.get('tnyNotify');
                        if (!tny) return;
                        var label = TONY_LABEL_MAP[tny] || (tny.charAt(0).toUpperCase() + tny.slice(1).replace(/-/g, ' '));
                        var search = (window.location.search || '').replace(/([?&])tnyNotify=[^&]+&?|&tnyNotify=[^&]+/, '$1').replace(/[?&]$/, '') || '';
                        if (search === '?') search = '';
                        var urlClean = window.location.pathname + search;
                        try { history.replaceState(null, '', urlClean || window.location.pathname); } catch (e) {}
                        setTimeout(function() {
                            if (typeof window.__tonySayGreeting === 'function') {
                                window.__tonySayGreeting('Eccoci nella sezione ' + label + '!');
                            }
                        }, 800);
                    })();

                    (function checkTonyPendingAfterNav() {
                        try {
                            if (window.__tonyFreemiumBlocked) {
                                try { sessionStorage.removeItem('tony_pending_intent'); } catch (eR) {}
                                return;
                            }
                            var raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('tony_pending_intent') : null;
                            if (!raw) return;
                            var intent = null;
                            try { intent = JSON.parse(raw); } catch (e) { return; }
                            if (!intent || !intent.modalId || !intent.target) return;
                            var modPending =
                                (window.Tony && window.Tony.context && window.Tony.context.dashboard && window.Tony.context.dashboard.moduli_attivi) ||
                                window.__gfvModuliAttivi ||
                                [];
                            if (
                                !Array.isArray(modPending) ||
                                !modPending.some(function(m) { return String(m).toLowerCase() === 'tony'; })
                            ) {
                                try { sessionStorage.removeItem('tony_pending_intent'); } catch (eRm) {}
                                return;
                            }
                            var path = (window.location.pathname || '').toLowerCase();
                            var targetSlug = (intent.target || '').replace(/\s+/g, '-').toLowerCase();
                            var pendingPreventivo = intent.modalId === 'preventivo-form';
                            var onNuovoPreventivoPath =
                                path.indexOf('nuovo-preventivo') >= 0 ||
                                path.indexOf('nuovo_preventivo') >= 0 ||
                                path.indexOf('preventivo-standalone') >= 0;
                            var preventivoFormPresent = !!document.getElementById('preventivo-form');
                            if (pendingPreventivo) {
                                var pathOk = !targetSlug || path.indexOf(targetSlug) >= 0 || onNuovoPreventivoPath;
                                if (!pathOk && !preventivoFormPresent) return;
                            } else {
                                var _pendingQh = intent.modalId === 'quick-hours-form';
                                var _onFieldWsPath = path.indexOf('field-workspace') >= 0;
                                if (!(_pendingQh && _onFieldWsPath) && (!targetSlug || path.indexOf(targetSlug) < 0)) return;
                            }
                            sessionStorage.removeItem('tony_pending_intent');
                            var modalId = intent.modalId;
                            var fields = (intent.fields && typeof intent.fields === 'object') ? intent.fields : null;
                            function openAndInject() {
                                if (modalId === 'attivita-modal' && typeof window.openAttivitaModal === 'function') {
                                    window.openAttivitaModal().catch(function(e) { console.warn('[Tony] openAttivitaModal fallito:', e); });
                                    var jq = (typeof window.$ === 'function' && window.$.fn && window.$.fn.modal) ? window.$ : null;
                                    if (jq) { jq('#' + modalId).modal('show'); } else { var el = document.getElementById(modalId); if (el) el.classList.add('active'); }
                                    if (fields && Object.keys(fields).length > 0 && window.TonyFormInjector) {
                                        enqueueTonyCommand({ type: 'INJECT_FORM_DATA', formId: 'attivita-form', formData: fields }, { source: 'pending-after-nav', delayMs: 1800 });
                                    }
                                } else if (modalId === 'lavoro-modal' && typeof window.openCreaModal === 'function') {
                                    window.openCreaModal();
                                    var jq = (typeof window.$ === 'function' && window.$.fn && window.$.fn.modal) ? window.$ : null;
                                    if (jq) { jq('#' + modalId).modal('show'); } else { var el = document.getElementById(modalId); if (el) el.classList.add('active'); }
                                    var localLavoroText = null;
                                    try {
                                        var rawLl = sessionStorage.getItem('tony_pending_lavoro_local_intent');
                                        if (rawLl) {
                                            var parsedLl = JSON.parse(rawLl);
                                            localLavoroText = parsedLl && parsedLl.text ? String(parsedLl.text).trim() : null;
                                            sessionStorage.removeItem('tony_pending_lavoro_local_intent');
                                        }
                                    } catch (eLl) {}
                                    if (localLavoroText && window.TonyFormInjector) {
                                        window.__tonyLavoroCreationFlow = true;
                                        if (typeof window.TonyFormInjector.resetLavoroInterviewSessionState === 'function') {
                                            window.TonyFormInjector.resetLavoroInterviewSessionState();
                                        }
                                        setTimeout(function() {
                                            var wReady = window.TonyFormInjector.waitForLavoriFormDataReady
                                                ? window.TonyFormInjector.waitForLavoriFormDataReady(8000)
                                                : Promise.resolve(true);
                                            var wMan = window.TonyFormInjector.waitForLavoriManodoperaReady
                                                ? window.TonyFormInjector.waitForLavoriManodoperaReady(6000)
                                                : Promise.resolve(true);
                                            Promise.all([wReady, wMan]).then(function() {
                                                if (window.TonyFormInjector.applyLavoroInterviewFromUserReply) {
                                                    return window.TonyFormInjector.applyLavoroInterviewFromUserReply(localLavoroText);
                                                }
                                                return null;
                                            }).then(function(resLl) {
                                                var msgLl = (resLl && resLl.message) || '';
                                                if (!msgLl && window.TonyFormInjector.promptLavoroInterviewMissing) {
                                                    return window.TonyFormInjector.promptLavoroInterviewMissing().then(function(locLl) {
                                                        return locLl && locLl.message ? locLl.message : '';
                                                    });
                                                }
                                                return msgLl;
                                            }).then(function(msgOut) {
                                                if (msgOut && typeof appendMessage === 'function') {
                                                    appendMessage(msgOut, 'tony');
                                                    if (window.Tony && typeof window.Tony.speak === 'function') window.Tony.speak(msgOut);
                                                }
                                            }).catch(function(errLl) {
                                                console.warn('[Tony] pending lavoro local intent:', errLl);
                                            });
                                        }, 500);
                                    } else if (fields && Object.keys(fields).length > 0 && window.TonyFormInjector) {
                                        enqueueTonyCommand({ type: 'INJECT_FORM_DATA', formId: 'lavoro-form', formData: fields }, { source: 'pending-after-nav', delayMs: 350 });
                                    }
                                } else if (modalId === 'preventivo-form') {
                                    if (fields && Object.keys(fields).length > 0 && window.TonyFormInjector) {
                                        enqueueTonyCommand({ type: 'INJECT_FORM_DATA', formId: 'preventivo-form', formData: fields }, { source: 'pending-after-nav', delayMs: 2200 });
                                    }
                                    var userPromptNav = (intent.userPromptForPending && String(intent.userPromptForPending).trim()) ? String(intent.userPromptForPending).trim() : '';
                                    if (!userPromptNav) userPromptNav = tonyGetLastUserMessage();
                                    if (!userPromptNav) {
                                        userPromptNav = tonyGetUserPromptForPendingNav();
                                    }
                                    var hadPendingFieldsInject = fields && typeof fields === 'object' && Object.keys(fields).length > 0;
                                    if (userPromptNav && window.Tony && typeof window.Tony.ask === 'function') {
                                        var enrichDelayMs = hadPendingFieldsInject ? 14000 : 4000;
                                        setTimeout(function() {
                                            if (window.__tonyPreventivoPostNavEnrichDone) return;
                                            var formPrev = document.getElementById('preventivo-form');
                                            if (!formPrev) return;
                                            if (hadPendingFieldsInject) {
                                                var ctxNav = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                                                var reqNav = (ctxNav && ctxNav.requiredEmpty) ? ctxNav.requiredEmpty : [];
                                                if (reqNav.length === 0) return;
                                                if (reqNav.length === 1 && reqNav[0] === 'data-prevista') return;
                                                if (reqNav.indexOf('cliente-id') < 0 && reqNav.length < 4) return;
                                                if (ctxNav && Array.isArray(ctxNav.fields)) {
                                                    var hasTerrenoNav = ctxNav.fields.some(function(f) {
                                                        return f.id === 'terreno-id' && f.value != null && String(f.value).trim() !== '';
                                                    });
                                                    var hasTipoNav = ctxNav.fields.some(function(f) {
                                                        return f.id === 'tipo-lavoro' && f.value != null && String(f.value).trim() !== '';
                                                    });
                                                    if (hasTerrenoNav && hasTipoNav) return;
                                                }
                                            }
                                            window.__tonyPreventivoPostNavEnrichDone = true;
                                            var enrichSuffix = '\n\n[Contesto: pagina Nuovo Preventivo già aperta nel browser. Rispondi con un solo comando JSON INJECT_FORM_DATA con formId "preventivo-form" e formData completo (cliente-id, tipo-lavoro, terreno-id se noto, colture, data-prevista, ecc.) dedotto dal messaggio.]';
                                            console.log('[Tony] Post-nav: richiesta completamento preventivo a Tony (skipUserHistory), delay era', enrichDelayMs + 'ms');
                                            window.Tony.ask(userPromptNav + enrichSuffix, { skipUserHistory: true }).catch(function(err) {
                                                console.warn('[Tony] ask post-nav preventivo:', err);
                                            });
                                        }, enrichDelayMs);
                                    }
                                } else if (modalId === 'prodotto-modal') {
                                    var btnPendP = document.getElementById('btn-nuovo-prodotto');
                                    if (btnPendP) btnPendP.click();
                                    else { var elPendP = document.getElementById('prodotto-modal'); if (elPendP) elPendP.classList.add('active'); }
                                    if (fields && Object.keys(fields).length > 0) {
                                        window.__tonyProdottoPendingDraft = Object.assign({}, fields);
                                        try { sessionStorage.removeItem('tony_pending_prodotto_local_intent'); } catch (ePp) {}
                                    }
                                    if (fields && Object.keys(fields).length > 0 && window.TonyFormInjector) {
                                        enqueueTonyCommand({ type: 'INJECT_FORM_DATA', formId: 'prodotto-form', formData: fields }, { source: 'pending-after-nav', delayMs: 1200 });
                                    }
                                } else if (modalId === 'movimento-modal') {
                                    var btnPendM = document.getElementById('btn-nuovo-movimento');
                                    if (btnPendM) btnPendM.click();
                                    else { var elPendM = document.getElementById('movimento-modal'); if (elPendM) elPendM.classList.add('active'); }
                                    if (fields && Object.keys(fields).length > 0) {
                                        window.__tonyMovimentoPendingDraft = Object.assign({}, fields);
                                        try { sessionStorage.removeItem('tony_pending_movimento_local_intent'); } catch (ePm) {}
                                    }
                                    if (fields && Object.keys(fields).length > 0 && window.TonyFormInjector) {
                                        enqueueTonyCommand({ type: 'INJECT_FORM_DATA', formId: 'movimento-form', formData: fields }, { source: 'pending-after-nav', delayMs: 1200 });
                                    }
                                } else if (modalId === 'terreno-modal' && typeof window.openTerrenoModal === 'function') {
                                    window.openTerrenoModal(null).catch(function (e) { console.warn('[Tony] openTerrenoModal fallito:', e); });
                                    var jqTer = (typeof window.$ === 'function' && window.$.fn && window.$.fn.modal) ? window.$ : null;
                                    if (jqTer) { jqTer('#' + modalId).modal('show'); } else { var elTer = document.getElementById(modalId); if (elTer) elTer.classList.add('active'); }
                                    if (fields && Object.keys(fields).length > 0 && window.TonyFormInjector) {
                                        enqueueTonyCommand({ type: 'INJECT_FORM_DATA', formId: 'terreno-form', formData: fields }, { source: 'pending-after-nav', delayMs: 1500 });
                                    } else if (!fields || !Object.keys(fields).length) {
                                        setTimeout(function () { tonyScheduleTerrenoProactiveAfterInject(); }, POST_INJECT_CHECK_DELAY_MS + 200);
                                    }
                                } else if (modalId === 'quick-hours-form' && window.TonyFormInjector && typeof window.TonyFormInjector.injectFieldWorkspaceQuickHoursForm === 'function') {
                                    var _qhTwPend = tonyResolveQuickHoursWindow();
                                    var _pendQhFields = (fields && typeof fields === 'object') ? tonySanitizeCfWorkspaceOraFormData(Object.assign({}, fields)) : {};
                                    _pendQhFields = tonyResolveOraLavoroForQuickHours(_pendQhFields, tonyBuildSegnaOraUserBlobLastNUserTurns(6));
                                    Promise.resolve(window.TonyFormInjector.injectFieldWorkspaceQuickHoursForm(_pendQhFields, window.Tony && window.Tony.context, _qhTwPend ? { targetWindow: _qhTwPend } : {})).catch(function (eQh) {
                                        console.warn('[Tony] injectFieldWorkspaceQuickHoursForm post-nav:', eQh);
                                    });
                                } else if (modalId === 'ora-modal' && typeof window.openSegnaOraModal === 'function') {
                                    var fieldsOra = fields;
                                    Promise.resolve(window.openSegnaOraModal(null)).then(function () {
                                        if (fieldsOra && Object.keys(fieldsOra).length > 0 && window.TonyFormInjector) {
                                            enqueueTonyCommand({ type: 'INJECT_FORM_DATA', formId: 'ora-form', formData: fieldsOra }, { source: 'pending-after-nav-ora', delayMs: 1600 });
                                        }
                                    }).catch(function (eOra) {
                                        console.warn('[Tony] openSegnaOraModal post-nav:', eOra);
                                    });
                                } else {
                                    var mEl = document.getElementById(modalId);
                                    if (mEl) {
                                        var jq = (typeof window.$ === 'function' && window.$.fn && window.$.fn.modal) ? window.$ : null;
                                        if (jq) { jq('#' + modalId).modal('show'); } else { mEl.classList.add('active'); }
                                        if (fields && Object.keys(fields).length > 0) {
                                            Object.keys(fields).forEach(function(fk, i) {
                                                if (fields[fk] != null && fields[fk] !== '') {
                                                    enqueueTonyCommand({ type: 'SET_FIELD', field: fk, value: String(fields[fk]) }, { source: 'pending-after-nav', delayMs: 1200 + (i * 250) });
                                                }
                                            });
                                        }
                                    }
                                }
                            }
                            var waitElId = (modalId === 'preventivo-form') ? 'preventivo-form' : modalId;
                            if (document.getElementById(waitElId)) {
                                setTimeout(openAndInject, 400);
                            } else {
                                var attempts = 0;
                                var iv = setInterval(function() {
                                    attempts++;
                                    if (document.getElementById(waitElId)) { clearInterval(iv); setTimeout(openAndInject, 400); } else if (attempts >= 35) { clearInterval(iv); }
                                }, 200);
                            }
                        } catch (e) { console.warn('[Tony] checkTonyPendingAfterNav:', e); }
                    })();

                    return;
                }
            } catch (e) {
                if (i === maxAttempts - 1) console.warn('[Tony] Init non disponibile (Firebase non pronto o assente).', e);
            }
            await new Promise(function(r) { setTimeout(r, interval); });
        }
    }    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { initTonyWhenReady(); });
    } else {
        initTonyWhenReady();
    }
})();
