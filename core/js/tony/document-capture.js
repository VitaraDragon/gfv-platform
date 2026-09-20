/**
 * Tony Occhi — acquisizione documenti da chat (Fase 1 MVP).
 * Sessione multi-pagina → CF tonyExtractDocument (Gemini vision).
 * @module core/js/tony/document-capture
 */

import { hasActiveModule, getModuliAttiviFromTonyContext, moduleInactiveMessage } from '../../config/tony-module-gate.js';
import { openTonyDocumentReviewForm } from './document-review-form.js';
import { evaluateExtractionOutcome } from './document-register.js';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/xml',
  'text/xml',
  'application/fatturapa+xml',
]);
const HEIC_MIME = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PAGES = 10;
/** Lato lungo max prima di Gemini: abbastanza per OCR, evita JPEG > 10 MB da HEIC 12 MP. */
export var DOCUMENT_IMAGE_MAX_EDGE = 2048;
export var DOCUMENT_JPEG_QUALITY = 0.85;
var HEIC_DECODE_ERROR =
  'Non riesco a leggere questa foto (formato HEIC). Scatta una nuova foto oppure salvala come JPEG e riprova.';

/**
 * Foto iPhone dalla Libreria (High Efficiency) — MIME o estensione.
 * @param {{ type?: string, name?: string }|null|undefined} file
 * @returns {boolean}
 */
export function isHeicLikeDocumentFile(file) {
  var mime = String((file && file.type) || '').toLowerCase().trim();
  var name = String((file && file.name) || '').toLowerCase();
  if (HEIC_MIME.has(mime)) return true;
  return /\.(heic|heif)$/i.test(name);
}

/**
 * @param {{ type?: string, name?: string }} file
 * @returns {string}
 */
export function resolveDocumentMime(file) {
  var mime = String((file && file.type) || '').toLowerCase().trim();
  var name = String((file && file.name) || '').toLowerCase();
  if (mime === 'image/jpg') mime = 'image/jpeg';
  if (ALLOWED_MIME.has(mime)) {
    if (mime === 'text/xml') return 'application/xml';
    return mime;
  }
  if (isHeicLikeDocumentFile(file)) return 'image/heic';
  if (/\.xml$/i.test(name)) return 'application/xml';
  if (/\.pdf$/i.test(name)) return 'application/pdf';
  if (/\.(jpe?g)$/i.test(name)) return 'image/jpeg';
  if (/\.png$/i.test(name)) return 'image/png';
  if (/\.webp$/i.test(name)) return 'image/webp';
  return mime;
}

function loadImageFromBlob(blob) {
  return new Promise(function (resolve, reject) {
    if (typeof URL === 'undefined' || typeof Image === 'undefined') {
      reject(new Error('decode-unavailable'));
      return;
    }
    var url = URL.createObjectURL(blob);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error('decode-failed'));
    };
    img.src = url;
  });
}

function canvasToJpegBlob(canvas, quality) {
  return new Promise(function (resolve, reject) {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob(function (b) {
        if (b) resolve(b);
        else reject(new Error('toBlob fallito'));
      }, 'image/jpeg', quality);
      return;
    }
    try {
      var dataUrl = canvas.toDataURL('image/jpeg', quality);
      var comma = dataUrl.indexOf(',');
      var b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
      var bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      resolve(new Blob([bytes], { type: 'image/jpeg' }));
    } catch (e) {
      reject(e);
    }
  });
}

function jpegFileFromBlob(blob, originalName, FileCtor) {
  var base = String(originalName || 'foto').replace(/\.(heic|heif)$/i, '');
  if (!base) base = 'foto';
  var fileName = base + '.jpg';
  var Ctor = FileCtor || (typeof File !== 'undefined' ? File : null);
  if (typeof Ctor === 'function') {
    return new Ctor([blob], fileName, { type: 'image/jpeg', lastModified: Date.now() });
  }
  try { blob.name = fileName; } catch (_) { /* ignore */ }
  return blob;
}

function readFileAsBase64(file) {
  if (typeof FileReader === 'function') {
    return new Promise(function (resolve, reject) {
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
  }
  if (file && typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer().then(function (buf) {
      if (typeof Buffer !== 'undefined') {
        return Buffer.from(buf).toString('base64');
      }
      var bytes = new Uint8Array(buf);
      var binary = '';
      for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    });
  }
  return Promise.reject(new Error('Lettura file non riuscita.'));
}

/**
 * Safari/iOS decodifica HEIC in canvas; Chrome desktop spesso no.
 * @param {Blob} file
 * @param {{ maxEdge?: number, quality?: number, createImageBitmap?: function, document?: Document, File?: function }} [opts]
 * @returns {Promise<File|Blob>}
 */
export async function convertRasterFileToJpeg(file, opts) {
  opts = opts || {};
  var maxEdge = opts.maxEdge != null ? opts.maxEdge : DOCUMENT_IMAGE_MAX_EDGE;
  var quality = opts.quality != null ? opts.quality : DOCUMENT_JPEG_QUALITY;
  var doc = opts.document || (typeof document !== 'undefined' ? document : null);
  var createBitmap = opts.createImageBitmap
    || (typeof createImageBitmap === 'function' ? createImageBitmap : null);

  var bitmap;
  try {
    if (createBitmap) {
      try {
        bitmap = await createBitmap(file);
      } catch (e) {
        bitmap = await loadImageFromBlob(file);
      }
    } else {
      bitmap = await loadImageFromBlob(file);
    }
  } catch (e) {
    throw new Error(HEIC_DECODE_ERROR);
  }

  var w = bitmap.width || bitmap.naturalWidth || 0;
  var h = bitmap.height || bitmap.naturalHeight || 0;
  if (!(w > 0 && h > 0) || !doc) {
    if (typeof bitmap.close === 'function') {
      try { bitmap.close(); } catch (_) { /* ignore */ }
    }
    throw new Error(HEIC_DECODE_ERROR);
  }

  var scale = Math.min(1, maxEdge / Math.max(w, h));
  var tw = Math.max(1, Math.round(w * scale));
  var th = Math.max(1, Math.round(h * scale));
  var canvas = doc.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  var ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error(HEIC_DECODE_ERROR);
  }
  ctx.drawImage(bitmap, 0, 0, tw, th);
  if (typeof bitmap.close === 'function') {
    try { bitmap.close(); } catch (_) { /* ignore */ }
  }

  var outBlob;
  try {
    outBlob = await canvasToJpegBlob(canvas, quality);
    if (outBlob.size > MAX_BYTES) {
      outBlob = await canvasToJpegBlob(canvas, 0.7);
    }
  } catch (e2) {
    throw new Error(HEIC_DECODE_ERROR);
  }
  if (!outBlob || outBlob.size > MAX_BYTES) {
    throw new Error('File troppo grande (max ~10 MB).');
  }
  return jpegFileFromBlob(outBlob, file && file.name, opts.File);
}

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
 * @param {{ convertRasterFileToJpeg?: function, createImageBitmap?: function, document?: Document, File?: function }} [opts]
 * @returns {Promise<{ mimeType: string, data: string, fileName: string, size: number, sourceFile?: File|Blob }>}
 */
export async function fileToDocumentPage(file, opts) {
  opts = opts || {};
  if (!file || typeof file !== 'object') {
    throw new Error('File non valido.');
  }
  var working = file;
  if (isHeicLikeDocumentFile(file)) {
    var convert = opts.convertRasterFileToJpeg || convertRasterFileToJpeg;
    working = await convert(file, opts);
  }
  var mime = resolveDocumentMime(working);
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error('Formato non supportato. Scatta o scegli dalla galleria una foto (JPEG, PNG, WebP, HEIC) o un PDF.');
  }
  if (working.size > MAX_BYTES) {
    throw new Error('File troppo grande (max ~10 MB).');
  }
  var data = await readFileAsBase64(working);
  return {
    mimeType: mime,
    data: data,
    fileName: working.name || file.name || 'pagina',
    size: working.size,
    sourceFile: working,
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
      } else if (page.mimeType === 'application/xml' || page.mimeType === 'text/xml' || page.mimeType === 'application/fatturapa+xml') {
        var xmlIcon = document.createElement('span');
        xmlIcon.className = 'tony-doc-thumb-pdf';
        xmlIcon.textContent = 'XML';
        wrap.appendChild(xmlIcon);
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
        if (page.mimeType.indexOf('image/') === 0) {
          try {
            previewUrl = URL.createObjectURL(page.sourceFile || fileList[i]);
          } catch (e) { /* ignore */ }
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
      // Conserva originali per archivio Storage dopo «Registra» (prima azzerava la sessione).
      var pagesForArchive = sessionPages.map(function (p) {
        return {
          mimeType: p.mimeType,
          data: p.data,
          fileName: p.fileName || 'pagina',
        };
      });
      resetSession();
      if (estrazione) {
        if (estrazione && result.safetyPassBReasons && !estrazione.safetyPassBReasons) {
          estrazione.safetyPassBReasons = result.safetyPassBReasons;
        }
        if (result.fonteEstrazione && !estrazione.fonteEstrazione) {
          estrazione.fonteEstrazione = result.fonteEstrazione;
        }
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
          pages: pagesForArchive,
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
