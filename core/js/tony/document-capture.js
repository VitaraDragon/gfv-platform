/**
 * Tony Occhi — acquisizione documenti da chat (Fase 1 MVP).
 * Sessione multi-pagina → CF tonyExtractDocument (Gemini vision).
 * @module core/js/tony/document-capture
 */

import { hasActiveModule, getModuliAttiviFromTonyContext, moduleInactiveMessage } from '../../config/tony-module-gate.js';
import { openTonyDocumentReviewForm } from './document-review-form.js';
import { evaluateExtractionOutcome } from './document-register.js';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PAGES = 10;

/**
 * @returns {string[]}
 */
export function getTonyUserRuoli() {
  try {
    var ctx = window.Tony && window.Tony.context;
    var dash = ctx && ctx.dashboard;
    var ruoli = (dash && dash.utente_corrente && dash.utente_corrente.ruoli) || [];
    if (Array.isArray(ruoli) && ruoli.length > 0) return ruoli.slice();
    try {
      var stored = sessionStorage.getItem('gfv_tony_utente_ruoli');
      if (stored) {
        var parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) { /* ignore */ }
  } catch (e2) { /* ignore */ }
  return [];
}

export function isTonyManagerOrAdmin(ruoli) {
  var list = Array.isArray(ruoli) ? ruoli : getTonyUserRuoli();
  return list.some(function (r) {
    var n = String(r).toLowerCase().trim();
    return n.includes('manager') || n.includes('amministratore');
  });
}

/**
 * @param {{ freemiumBlocked?: boolean, moduliAttivi?: string[], ruoli?: string[] }} [opts]
 */
export function canUseTonyDocumentCapture(opts) {
  opts = opts || {};
  if (opts.freemiumBlocked || (typeof window !== 'undefined' && window.__tonyFreemiumBlocked)) {
    return { ok: false, reason: 'Tony non è disponibile sul piano Free. Passa al piano Base dalla pagina Abbonamento.' };
  }
  if (!isTonyManagerOrAdmin(opts.ruoli)) {
    return {
      ok: false,
      reason: 'L\'acquisizione documenti è riservata a manager e amministratori.',
    };
  }
  var moduli = opts.moduliAttivi || getModuliAttiviFromTonyContext();
  if (!hasActiveModule(moduli, 'magazzino')) {
    return { ok: false, reason: moduleInactiveMessage('magazzino') };
  }
  return { ok: true, reason: '' };
}

/**
 * @param {File} file
 * @returns {Promise<{ mimeType: string, data: string, fileName: string, size: number }>}
 */
export async function fileToDocumentPage(file) {
  if (!file || typeof file !== 'object') {
    throw new Error('File non valido.');
  }
  var mime = String(file.type || '').toLowerCase().trim();
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error('Formato non supportato. Usa foto (JPEG/PNG/WebP) o PDF.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('File troppo grande (max ~10 MB).');
  }
  var data = await new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var result = String(reader.result || '');
        var comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = function () { reject(new Error('Lettura file non riuscita.')); };
    reader.readAsDataURL(file);
  });
  return {
    mimeType: mime,
    data: data,
    fileName: file.name || 'pagina',
    size: file.size,
  };
}

/**
 * @param {object} estrazione
 * @returns {string}
 */
export function formatDocumentExtractionSummary(estrazione) {
  if (!estrazione || typeof estrazione !== 'object') {
    return 'Estrazione completata ma senza dati strutturati.';
  }
  var tipo = estrazione.tipoDocumento || 'sconosciuto';
  var tipoLabel = tipo === 'bolla'
    ? 'Bolla di consegna'
    : tipo === 'fattura'
      ? 'Fattura'
      : tipo === 'scontrino'
        ? 'Scontrino'
        : 'Documento';
  var forn = estrazione.fornitore && estrazione.fornitore.nome ? estrazione.fornitore.nome : '';
  var righe = Array.isArray(estrazione.righe) ? estrazione.righe : [];
  var parts = ['Ho letto una ' + tipoLabel + (forn ? ' da ' + forn : '') + ' con ' + righe.length + ' righe.'];
  if (estrazione.numeroDocumento) parts.push('N. ' + estrazione.numeroDocumento);
  if (estrazione.dataDocumento) parts.push('Data ' + estrazione.dataDocumento);
  var refs = Array.isArray(estrazione.riferimentiBolla) ? estrazione.riferimentiBolla : [];
  if (refs.length) {
    parts.push('DDT collegati: ' + refs.map(function (r) { return r.numeroDocumento; }).filter(Boolean).join(', '));
  }
  if (righe.length > 0) {
    var r0 = righe[0];
    var line = (r0.descrizione || '').trim();
    if (r0.quantita != null) line += ' — qty ' + r0.quantita + (r0.unita ? ' ' + r0.unita : '');
    if (line) parts.push('Prima riga: ' + line);
  }
  parts.push('Controlla il form di revisione e conferma con «Registra dati».');
  return parts.join(' ');
}

/**
 * @param {object} opts
 * @param {function(string, string=): void} opts.appendMessage
 * @param {function(string, string=): void} [opts.showMessageInChat]
 * @param {function(): object|null} [opts.getTonyService]
 * @param {boolean} [opts.freemiumBlocked]
 */
export function initTonyDocumentCapture(opts) {
  opts = opts || {};
  var appendMessage = opts.appendMessage || function () {};
  var showMessageInChat = opts.showMessageInChat || appendMessage;
  var getTonyService = opts.getTonyService || function () { return window.Tony || window.TonyService || null; };

  var panel = document.getElementById('tony-doc-capture');
  var cameraBtn = document.getElementById('tony-camera');
  var fileInput = document.getElementById('tony-doc-file-input');
  var thumbsEl = document.getElementById('tony-doc-thumbs');
  var statusEl = document.getElementById('tony-doc-status');
  var btnAdd = document.getElementById('tony-doc-add-page');
  var btnFinish = document.getElementById('tony-doc-finish');
  var btnCancel = document.getElementById('tony-doc-cancel');
  var scannerEl = document.getElementById('tony-doc-scanner');

  if (!panel || !cameraBtn || !fileInput) {
    return { refreshVisibility: function () {} };
  }

  /** @type {Array<{ id: string, mimeType: string, data: string, fileName: string, previewUrl?: string }>} */
  var sessionPages = [];
  var busy = false;

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text || '';
  }

  function setScannerVisible(visible) {
    if (scannerEl) scannerEl.style.display = visible ? 'block' : 'none';
    if (panel) panel.classList.toggle('tony-doc-capture--extracting', !!visible);
  }

  function revokePreviews() {
    sessionPages.forEach(function (p) {
      if (p.previewUrl) {
        try { URL.revokeObjectURL(p.previewUrl); } catch (e) { /* ignore */ }
      }
    });
  }

  function resetSession() {
    revokePreviews();
    sessionPages = [];
    busy = false;
    panel.style.display = 'none';
    setScannerVisible(false);
    setStatus('');
    renderThumbs();
    updateButtons();
  }

  function renderThumbs() {
    if (!thumbsEl) return;
    thumbsEl.innerHTML = '';
    sessionPages.forEach(function (page, idx) {
      var wrap = document.createElement('div');
      wrap.className = 'tony-doc-thumb';
      if (page.mimeType === 'application/pdf') {
        var pdfIcon = document.createElement('span');
        pdfIcon.className = 'tony-doc-thumb-pdf';
        pdfIcon.textContent = 'PDF';
        wrap.appendChild(pdfIcon);
      } else if (page.previewUrl) {
        var img = document.createElement('img');
        img.src = page.previewUrl;
        img.alt = 'Pagina ' + (idx + 1);
        wrap.appendChild(img);
      }
      var label = document.createElement('span');
      label.className = 'tony-doc-thumb-label';
      label.textContent = String(idx + 1);
      wrap.appendChild(label);
      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'tony-doc-thumb-remove';
      rm.setAttribute('aria-label', 'Rimuovi pagina ' + (idx + 1));
      rm.textContent = '×';
      rm.addEventListener('click', function () {
        if (busy) return;
        var removed = sessionPages.splice(idx, 1)[0];
        if (removed && removed.previewUrl) {
          try { URL.revokeObjectURL(removed.previewUrl); } catch (e) { /* ignore */ }
        }
        renderThumbs();
        updateButtons();
        setStatus(sessionPages.length ? sessionPages.length + ' pagina/e in coda.' : 'Nessuna pagina ancora.');
      });
      wrap.appendChild(rm);
      thumbsEl.appendChild(wrap);
    });
  }

  function updateButtons() {
    var hasPages = sessionPages.length > 0;
    if (btnFinish) btnFinish.disabled = busy || !hasPages;
    if (btnAdd) btnAdd.disabled = busy || sessionPages.length >= MAX_PAGES;
    if (btnCancel) btnCancel.disabled = busy;
    if (cameraBtn) cameraBtn.disabled = busy;
  }

  function refreshVisibility() {
    var gate = canUseTonyDocumentCapture({ freemiumBlocked: opts.freemiumBlocked });
    if (cameraBtn) {
      cameraBtn.style.display = gate.ok ? '' : 'none';
      cameraBtn.disabled = busy;
    }
  }

  function openFilePicker() {
    var gate = canUseTonyDocumentCapture({ freemiumBlocked: opts.freemiumBlocked });
    if (!gate.ok) {
      showMessageInChat(gate.reason, 'tony');
      return;
    }
    if (sessionPages.length >= MAX_PAGES) {
      showMessageInChat('Hai raggiunto il massimo di ' + MAX_PAGES + ' pagine per documento.', 'tony');
      return;
    }
    fileInput.value = '';
    fileInput.click();
  }

  function showCapturePanel() {
    panel.style.display = 'block';
    if (sessionPages.length === 0) {
      setStatus('Aggiungi una o più pagine, poi «Acquisizione terminata».');
    }
    updateButtons();
  }

  async function addFiles(fileList) {
    if (!fileList || !fileList.length) return;
    var gate = canUseTonyDocumentCapture({ freemiumBlocked: opts.freemiumBlocked });
    if (!gate.ok) {
      showMessageInChat(gate.reason, 'tony');
      return;
    }
    for (var i = 0; i < fileList.length; i++) {
      if (sessionPages.length >= MAX_PAGES) break;
      try {
        var page = await fileToDocumentPage(fileList[i]);
        var previewUrl = null;
        if (page.mimeType.indexOf('image/') === 0 && fileList[i]) {
          try { previewUrl = URL.createObjectURL(fileList[i]); } catch (e) { /* ignore */ }
        }
        sessionPages.push({
          id: 'p-' + Date.now() + '-' + i,
          mimeType: page.mimeType,
          data: page.data,
          fileName: page.fileName,
          previewUrl: previewUrl,
        });
      } catch (err) {
        showMessageInChat(err.message || 'Errore caricamento file.', 'error');
      }
    }
    showCapturePanel();
    setStatus(sessionPages.length + ' pagina/e in coda. Aggiungi altre o termina l\'acquisizione.');
    renderThumbs();
    updateButtons();
    appendMessage('📷 Pagina aggiunta (' + sessionPages.length + ' in totale).', 'user');
  }

  async function finishAcquisition() {
    if (busy || sessionPages.length === 0) return;
    var gate = canUseTonyDocumentCapture({ freemiumBlocked: opts.freemiumBlocked });
    if (!gate.ok) {
      showMessageInChat(gate.reason, 'tony');
      return;
    }
    var svc = getTonyService();
    if (!svc || typeof svc.extractDocument !== 'function') {
      showMessageInChat('Servizio Tony non pronto. Ricarica la pagina e riprova.', 'error');
      return;
    }
    busy = true;
    updateButtons();
    setScannerVisible(true);
    setStatus('Sto leggendo ' + sessionPages.length + ' pagina/e…');
    appendMessage('Acquisizione terminata — estrazione in corso.', 'user');

    try {
      var pagesPayload = sessionPages.map(function (p, idx) {
        return { mimeType: p.mimeType, data: p.data, indice: idx + 1 };
      });
      var result = await svc.extractDocument({ pages: pagesPayload });
      var estrazione = result && result.estrazione ? result.estrazione : null;
      setScannerVisible(false);
      resetSession();
      if (estrazione) {
        if (estrazione && result.safetyPassBReasons && !estrazione.safetyPassBReasons) {
          estrazione.safetyPassBReasons = result.safetyPassBReasons;
        }
        if (result.safetyPassB) estrazione.safetyPassB = true;
        if (result.safetyPassBAttempted) estrazione.safetyPassBAttempted = true;

        var outcome = evaluateExtractionOutcome(estrazione);
        if (outcome.status === 'failed') {
          console.warn('[Tony Occhi] acquisizione rifiutata:', outcome.reasons);
          showMessageInChat(outcome.message, 'tony');
          if (window.Tony && typeof window.Tony.speak === 'function') {
            try { window.Tony.speak(outcome.message); } catch (_) { /* ignore */ }
          }
          return;
        }

        if (result.safetyPassB || estrazione.safetyPassB) {
          showMessageInChat(
            'Ho fatto una rilettura di controllo. Controlla il form prima di registrare.',
            'tony'
          );
        } else if (outcome.status === 'review_with_warnings') {
          showMessageInChat(
            'Lettura OK ma con punti da verificare — controlla gli avvisi nel form prima di registrare.',
            'tony'
          );
        }

        await openTonyDocumentReviewForm({
          estrazione: estrazione,
          showMessageInChat: showMessageInChat,
          appendMessage: appendMessage,
        });
      } else {
        showMessageInChat(
          'Acquisizione non riuscita: nessun dato utilizzabile. Rifai la foto (un foglio, ben leggibile) e riprova.',
          'tony'
        );
      }
    } catch (err) {
      console.error('[Tony Occhi] estrazione:', err);
      var msg = (err && err.message) ? String(err.message) : 'Estrazione non riuscita.';
      var code = (err && err.code) ? String(err.code) : '';
      if (/failed-precondition|internal/i.test(code) && /fetch|cors|network|failed/i.test(msg)) {
        msg = 'La funzione cloud tonyExtractDocument non è raggiungibile (probabilmente non ancora deployata). Esegui: npm run deploy:functions oppure firebase deploy --only functions:tonyExtractDocument';
      } else if (/internal/i.test(code) && !msg) {
        msg = 'Errore server durante l\'estrazione. Verifica che tonyExtractDocument sia deployata su Firebase.';
      }
      if (/permission-denied|non attivo|manager/i.test(msg)) {
        showMessageInChat(msg, 'tony');
      } else {
        showMessageInChat('Non sono riuscito a leggere il documento. ' + msg, 'error');
      }
      setScannerVisible(false);
      busy = false;
      updateButtons();
      setStatus('Riprova o aggiungi pagine più leggibili.');
    }
  }

  cameraBtn.addEventListener('click', function () {
    if (panel.style.display === 'none' || panel.style.display === '') {
      openFilePicker();
    } else {
      openFilePicker();
    }
  });

  fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files.length) {
      addFiles(fileInput.files);
    }
  });

  if (btnAdd) btnAdd.addEventListener('click', openFilePicker);
  if (btnFinish) btnFinish.addEventListener('click', finishAcquisition);
  if (btnCancel) btnCancel.addEventListener('click', resetSession);

  refreshVisibility();

  try {
    window.addEventListener('tony-module-updated', function () { refreshVisibility(); });
    window.addEventListener('gfv-tenant-tony-ready', function () { refreshVisibility(); });
    window.addEventListener('gfv-subscription-plan', function () { refreshVisibility(); });
  } catch (e) { /* ignore */ }

  return {
    refreshVisibility: refreshVisibility,
    resetSession: resetSession,
  };
}
