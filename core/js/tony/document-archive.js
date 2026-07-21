/**
 * Tony Occhi — archivio documenti (persistenza Storage + metadati).
 * Compressione immagini client; PDF nativi as-is. Policy errori: movimenti
 * già scritti non si annullano; flag filePending + messaggio utente.
 * @module core/js/tony/document-archive
 */

export var ARCHIVE_IMAGE_MAX_EDGE = 1600;
export var ARCHIVE_JPEG_QUALITY = 0.72;
export var ARCHIVE_MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

/**
 * @param {string} tenantId
 * @param {string} sessionId
 * @param {number} pageIndex1 — 1-based
 * @param {string} ext — jpg|png|webp|pdf
 * @returns {string}
 */
export function buildDocumentStoragePath(tenantId, sessionId, pageIndex1, ext) {
  var tid = String(tenantId || '').trim();
  var sid = String(sessionId || '').trim();
  var idx = Number(pageIndex1);
  var e = String(ext || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  if (!tid || !sid || !Number.isFinite(idx) || idx < 1) {
    throw new Error('Path archivio non valido (tenant/session/indice).');
  }
  return 'tenants/' + tid + '/documentiAcquisiti/' + sid + '/page-' + idx + '.' + e;
}

/**
 * @param {string} mimeType
 * @returns {string}
 */
export function extFromMime(mimeType) {
  var m = String(mimeType || '').toLowerCase();
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg';
  if (m === 'image/png') return 'png';
  if (m === 'image/webp') return 'webp';
  if (m === 'application/pdf') return 'pdf';
  return 'bin';
}

/**
 * @param {string} base64
 * @param {string} mimeType
 * @returns {Blob}
 */
export function base64ToBlob(base64, mimeType) {
  var raw = String(base64 || '');
  var bin = typeof atob === 'function' ? atob(raw) : Buffer.from(raw, 'base64').toString('binary');
  var len = bin.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mimeType || 'application/octet-stream' });
}

/**
 * Comprime immagine (max edge + JPEG). PDF e tipi non-immagine restano invariati.
 * @param {{ mimeType: string, data: string }} page
 * @param {{ maxEdge?: number, quality?: number, createImageBitmap?: function, document?: Document }} [opts]
 * @returns {Promise<{ blob: Blob, mimeType: string, ext: string, compressed: boolean }>}
 */
export async function preparePageForUpload(page, opts) {
  opts = opts || {};
  var mime = String((page && page.mimeType) || '').toLowerCase();
  var data = page && page.data ? String(page.data) : '';
  if (!data) throw new Error('Pagina senza dati.');

  if (mime === 'application/pdf' || mime.indexOf('image/') !== 0) {
    var blobRaw = base64ToBlob(data, mime || 'application/octet-stream');
    return {
      blob: blobRaw,
      mimeType: mime || 'application/octet-stream',
      ext: extFromMime(mime),
      compressed: false,
    };
  }

  var maxEdge = opts.maxEdge != null ? opts.maxEdge : ARCHIVE_IMAGE_MAX_EDGE;
  var quality = opts.quality != null ? opts.quality : ARCHIVE_JPEG_QUALITY;
  var doc = opts.document || (typeof document !== 'undefined' ? document : null);

  try {
    var blobIn = base64ToBlob(data, mime);
    var bitmap = null;
    var createBitmap = opts.createImageBitmap || (typeof createImageBitmap === 'function' ? createImageBitmap : null);
    if (createBitmap) {
      bitmap = await createBitmap(blobIn);
    } else if (doc && typeof Image !== 'undefined') {
      bitmap = await loadImageElement(blobIn);
    }
    if (!bitmap || !doc) {
      return {
        blob: blobIn,
        mimeType: mime,
        ext: extFromMime(mime),
        compressed: false,
      };
    }
    var w = bitmap.width || bitmap.naturalWidth || 0;
    var h = bitmap.height || bitmap.naturalHeight || 0;
    if (!(w > 0 && h > 0)) {
      return { blob: blobIn, mimeType: mime, ext: extFromMime(mime), compressed: false };
    }
    var scale = Math.min(1, maxEdge / Math.max(w, h));
    var tw = Math.max(1, Math.round(w * scale));
    var th = Math.max(1, Math.round(h * scale));
    var canvas = doc.createElement('canvas');
    canvas.width = tw;
    canvas.height = th;
    var ctx = canvas.getContext('2d');
    if (!ctx) {
      return { blob: blobIn, mimeType: mime, ext: extFromMime(mime), compressed: false };
    }
    ctx.drawImage(bitmap, 0, 0, tw, th);
    if (typeof bitmap.close === 'function') {
      try { bitmap.close(); } catch (_) { /* ignore */ }
    }
    var outBlob = await canvasToJpegBlob(canvas, quality);
    return {
      blob: outBlob,
      mimeType: 'image/jpeg',
      ext: 'jpg',
      compressed: true,
    };
  } catch (e) {
    var fallback = base64ToBlob(data, mime);
    return { blob: fallback, mimeType: mime, ext: extFromMime(mime), compressed: false };
  }
}

function loadImageElement(blob) {
  return new Promise(function (resolve, reject) {
    var url = URL.createObjectURL(blob);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error('Immagine non leggibile per compressione.'));
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
      resolve(base64ToBlob(b64, 'image/jpeg'));
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Stato collegamento / prezzo per filtri archivio.
 * @param {object} estrazione
 * @param {{ documentoCollegatoId?: string|null, prezzoInAttesa?: boolean }} [extra]
 * @returns {{ statoCollegamento: string, prezzoInAttesa: boolean }}
 */
export function resolveArchiveLinkState(estrazione, extra) {
  extra = extra || {};
  var tipo = String(
    (estrazione && (estrazione.tipoDocumentoConfermato || estrazione.tipoDocumento)) || ''
  ).toLowerCase();
  var linked = !!(extra.documentoCollegatoId || (estrazione && estrazione.documentoCollegatoId));
  var prezzoInAttesa = extra.prezzoInAttesa === true;
  if (tipo === 'bolla') {
    if (!prezzoInAttesa && estrazione && Array.isArray(estrazione.righe)) {
      prezzoInAttesa = estrazione.righe.some(function (r) {
        return r && (r.prezzoUnitario == null || r.prezzoUnitario === '');
      });
    }
    return {
      statoCollegamento: prezzoInAttesa ? 'prezzo_in_attesa' : (linked ? 'collegata' : 'senza_fattura'),
      prezzoInAttesa: !!prezzoInAttesa,
    };
  }
  if (tipo === 'fattura') {
    return {
      statoCollegamento: linked ? 'collegata_a_bolla' : 'entrata_diretta',
      prezzoInAttesa: false,
    };
  }
  if (tipo === 'scontrino') {
    return { statoCollegamento: 'entrata_diretta', prezzoInAttesa: false };
  }
  return { statoCollegamento: 'sconosciuto', prezzoInAttesa: !!prezzoInAttesa };
}

/**
 * Metadati sessione Firestore (ROADMAP §8, campi utili MVP).
 * @param {object} opts
 * @returns {object}
 */
export function buildDocumentoAcquisitoMetadata(opts) {
  opts = opts || {};
  var estrazione = opts.estrazione || {};
  var tipo = String(estrazione.tipoDocumentoConfermato || estrazione.tipoDocumento || 'sconosciuto').toLowerCase();
  var link = resolveArchiveLinkState(estrazione, {
    documentoCollegatoId: opts.documentoCollegatoId,
    prezzoInAttesa: opts.prezzoInAttesa,
  });
  var forn = estrazione.fornitore && typeof estrazione.fornitore === 'object'
    ? {
      nome: estrazione.fornitore.nome || '',
      piva: estrazione.fornitore.piva || '',
      confidence: estrazione.fornitore.confidence != null ? estrazione.fornitore.confidence : null,
    }
    : { nome: '', piva: '', confidence: null };

  var righe = Array.isArray(estrazione.righe)
    ? estrazione.righe.map(function (r, i) {
      return {
        descrizione: r.descrizione || '',
        codiceFornitore: r.codiceFornitore || '',
        quantita: r.quantita != null ? Number(r.quantita) : null,
        unita: r.unita || '',
        prezzoUnitario: r.prezzoUnitario != null && r.prezzoUnitario !== '' ? Number(r.prezzoUnitario) : null,
        prodottoIdConfermato: r.prodottoIdConfermato || r.prodottoIdSuggerito || null,
        paginaOrigine: r.paginaOrigine != null ? r.paginaOrigine : i + 1,
      };
    })
    : [];

  return {
    stato: 'confirmed',
    filePending: opts.filePending === true,
    tipoDocumento: estrazione.tipoDocumento || tipo,
    tipoDocumentoConfermato: tipo,
    pagine: Array.isArray(opts.pagine) ? opts.pagine : [],
    fornitore: forn,
    numeroDocumento: estrazione.numeroDocumento || '',
    dataDocumento: estrazione.dataDocumento || '',
    documentoCollegatoId: opts.documentoCollegatoId || null,
    movimentoIds: Array.isArray(opts.movimentoIds) ? opts.movimentoIds.slice() : [],
    prezzoInAttesa: link.prezzoInAttesa,
    statoCollegamento: link.statoCollegamento,
    confermatoIl: opts.confermatoIl || new Date().toISOString(),
    confermatoDa: opts.confermatoDa || null,
    righeConfermate: righe,
    uploadError: opts.uploadError || null,
  };
}

/**
 * Upload pagine + scrittura metadati. Non lancia se i movimenti sono già ok:
 * in caso di errore parziale/totale setta filePending.
 *
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.sessionId
 * @param {Array<{ mimeType: string, data: string, fileName?: string }>} params.pages
 * @param {object} params.estrazione
 * @param {string[]} params.movimentoIds
 * @param {string|null} [params.documentoCollegatoId]
 * @param {string|null} [params.userId]
 * @param {function(string, Blob, { contentType: string }): Promise<void>} params.uploadBytes — (storagePath, blob, meta)
 * @param {function(string, object): Promise<void>} params.saveDocumento — (sessionId, data)
 * @param {function(string, object): Promise<void>} [params.linkDocumentoCollegato] — aggiorna bolla collegata
 * @returns {Promise<{ ok: boolean, filePending: boolean, pagine: Array<object>, uploadErrors: string[] }>}
 */
export async function persistDocumentArchiveAfterRegister(params) {
  params = params || {};
  var tenantId = params.tenantId;
  var sessionId = params.sessionId;
  var pages = Array.isArray(params.pages) ? params.pages : [];
  var uploadBytes = params.uploadBytes;
  var saveDocumento = params.saveDocumento;
  var uploadErrors = [];
  var pagineMeta = [];

  if (!tenantId || !sessionId) {
    throw new Error('tenantId e sessionId obbligatori per archivio.');
  }
  if (typeof uploadBytes !== 'function' || typeof saveDocumento !== 'function') {
    throw new Error('Dipendenze upload/save archivio mancanti.');
  }

  if (!pages.length) {
    var metaEmpty = buildDocumentoAcquisitoMetadata({
      estrazione: params.estrazione,
      movimentoIds: params.movimentoIds,
      documentoCollegatoId: params.documentoCollegatoId,
      confermatoDa: params.userId,
      filePending: true,
      uploadError: 'Nessuna pagina originale in sessione (file non persistiti).',
      pagine: [],
    });
    await saveDocumento(sessionId, metaEmpty);
    if (params.documentoCollegatoId && typeof params.linkDocumentoCollegato === 'function') {
      try {
        await params.linkDocumentoCollegato(params.documentoCollegatoId, {
          documentoCollegatoId: sessionId,
        });
      } catch (_) { /* non bloccante */ }
    }
    return { ok: false, filePending: true, pagine: [], uploadErrors: [metaEmpty.uploadError] };
  }

  for (var i = 0; i < pages.length; i++) {
    var page = pages[i];
    var indice = i + 1;
    try {
      var prepared = await preparePageForUpload(page);
      if (prepared.blob.size > ARCHIVE_MAX_UPLOAD_BYTES) {
        throw new Error('Pagina ' + indice + ' troppo grande dopo compressione.');
      }
      var storagePath = buildDocumentStoragePath(tenantId, sessionId, indice, prepared.ext);
      await uploadBytes(storagePath, prepared.blob, { contentType: prepared.mimeType });
      pagineMeta.push({
        indice: indice,
        storagePath: storagePath,
        mimeType: prepared.mimeType,
        fileName: (page && page.fileName) || ('page-' + indice + '.' + prepared.ext),
        size: prepared.blob.size,
        compressed: prepared.compressed === true,
        caricatoIl: new Date().toISOString(),
      });
    } catch (err) {
      var msg = (err && err.message) ? String(err.message) : 'Upload pagina ' + indice + ' fallito';
      uploadErrors.push(msg);
      console.warn('[Tony Occhi] upload archivio pagina ' + indice + ':', err);
    }
  }

  var filePending = uploadErrors.length > 0 || pagineMeta.length < pages.length;
  var meta = buildDocumentoAcquisitoMetadata({
    estrazione: params.estrazione,
    movimentoIds: params.movimentoIds,
    documentoCollegatoId: params.documentoCollegatoId,
    confermatoDa: params.userId,
    filePending: filePending,
    uploadError: filePending ? uploadErrors.join('; ') : null,
    pagine: pagineMeta,
  });
  await saveDocumento(sessionId, meta);

  if (params.documentoCollegatoId && typeof params.linkDocumentoCollegato === 'function') {
    try {
      await params.linkDocumentoCollegato(params.documentoCollegatoId, {
        documentoCollegatoId: sessionId,
        statoCollegamento: 'collegata',
        prezzoInAttesa: false,
      });
    } catch (linkErr) {
      console.warn('[Tony Occhi] link bolla↔fattura archivio:', linkErr);
    }
  }

  return {
    ok: !filePending,
    filePending: filePending,
    pagine: pagineMeta,
    uploadErrors: uploadErrors,
  };
}

/**
 * Messaggio chat post-registrazione per esito archivio.
 * @param {{ filePending?: boolean, uploadErrors?: string[] }} archiveResult
 * @returns {string}
 */
export function formatArchivePersistMessage(archiveResult) {
  if (!archiveResult) return '';
  if (archiveResult.filePending) {
    return ' I dati magazzino sono salvati; l\'originale non è ancora in archivio (riprova più tardi o contatta assistenza).';
  }
  return ' Originale salvato in Archivio documenti.';
}

/**
 * ISO date YYYY-MM-DD da confermatoIl / createdAt (Timestamp, Date, string).
 * Usa calendario locale (non UTC) per allineare filtri Dal/Al.
 * @param {object} doc
 * @returns {string}
 */
export function getDataAcquisizioneYmd(doc) {
  if (!doc) return '';
  var raw = doc.confermatoIl != null ? doc.confermatoIl : doc.createdAt;
  if (raw == null || raw === '') return '';
  if (typeof raw.toDate === 'function') {
    try { raw = raw.toDate(); } catch (_) { return ''; }
  }
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return '';
    return localYmd(raw);
  }
  var s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    var dIso = new Date(s);
    if (!isNaN(dIso.getTime())) return localYmd(dIso);
    return s.slice(0, 10);
  }
  var d = new Date(s);
  if (!isNaN(d.getTime())) return localYmd(d);
  return '';
}

function localYmd(d) {
  var yyyy = d.getFullYear();
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  var dd = String(d.getDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
}

/**
 * Formato IT per colonna «Acquisito» (data + ora se disponibile).
 * @param {object} doc
 * @returns {string}
 */
export function formatDataAcquisizioneDisplay(doc) {
  if (!doc) return '—';
  var raw = doc.confermatoIl != null ? doc.confermatoIl : doc.createdAt;
  if (raw == null || raw === '') return '—';
  var d = null;
  if (typeof raw.toDate === 'function') {
    try { d = raw.toDate(); } catch (_) { d = null; }
  } else if (raw instanceof Date) {
    d = raw;
  } else {
    d = new Date(String(raw));
  }
  if (!d || isNaN(d.getTime())) {
    var ymd = getDataAcquisizioneYmd(doc);
    return ymd || '—';
  }
  var dd = String(d.getDate()).padStart(2, '0');
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  var yyyy = d.getFullYear();
  var hh = String(d.getHours()).padStart(2, '0');
  var mi = String(d.getMinutes()).padStart(2, '0');
  return dd + '/' + mm + '/' + yyyy + ' ' + hh + ':' + mi;
}

/**
 * Filtri lista archivio (client-side, una sola lista).
 * @param {Array<object>} docs
 * @param {{ tipo?: string, fornitore?: string, numero?: string, dal?: string, al?: string, statoCollegamento?: string, soloPrezzoInAttesa?: boolean, periodoSu?: 'acquisizione'|'documento' }} filters
 * @returns {Array<object>}
 */
export function filterDocumentiAcquisiti(docs, filters) {
  filters = filters || {};
  var list = Array.isArray(docs) ? docs : [];
  var tipo = String(filters.tipo || '').toLowerCase().trim();
  var forn = String(filters.fornitore || '').toLowerCase().trim();
  var numero = String(filters.numero || '').toLowerCase().trim();
  var dal = String(filters.dal || '').trim();
  var al = String(filters.al || '').trim();
  var stato = String(filters.statoCollegamento || '').trim();
  var soloAttesa = filters.soloPrezzoInAttesa === true;
  var periodoSu = String(filters.periodoSu || 'acquisizione').toLowerCase();
  if (periodoSu !== 'documento') periodoSu = 'acquisizione';

  return list.filter(function (d) {
    if (!d) return false;
    var t = String(d.tipoDocumentoConfermato || d.tipoDocumento || '').toLowerCase();
    if (tipo && t !== tipo) return false;
    if (forn) {
      var nome = String((d.fornitore && d.fornitore.nome) || '').toLowerCase();
      if (nome.indexOf(forn) < 0) return false;
    }
    if (numero) {
      var num = String(d.numeroDocumento || '').toLowerCase();
      if (num.indexOf(numero) < 0) return false;
    }
    var dataRef = periodoSu === 'documento'
      ? String(d.dataDocumento || '').slice(0, 10)
      : getDataAcquisizioneYmd(d);
    if (dal) {
      if (!dataRef || dataRef < dal) return false;
    }
    if (al) {
      if (!dataRef || dataRef > al) return false;
    }
    if (stato && String(d.statoCollegamento || '') !== stato) return false;
    if (soloAttesa && d.prezzoInAttesa !== true) return false;
    return true;
  });
}

/**
 * Label UX per stato collegamento.
 * @param {object} doc
 * @returns {string}
 */
export function formatStatoCollegamentoLabel(doc) {
  if (!doc) return '-';
  if (doc.filePending) return 'File in attesa';
  var s = String(doc.statoCollegamento || '');
  var map = {
    prezzo_in_attesa: 'Prezzo in attesa',
    senza_fattura: 'Senza fattura',
    collegata: 'Collegata a fattura',
    collegata_a_bolla: 'Collegata a bolla',
    entrata_diretta: 'Entrata diretta',
    sconosciuto: '—',
  };
  return map[s] || s || '—';
}
