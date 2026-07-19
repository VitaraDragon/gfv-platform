"use strict";

/** MIME ammessi per Tony Occhi PoC (vision Gemini). */
const TONY_DOCUMENT_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

/** ~10 MB per pagina (base64 ≈ 4/3 del binario). */
const TONY_DOCUMENT_MAX_BYTES_PER_PAGE = 10 * 1024 * 1024;
const TONY_DOCUMENT_MAX_PAGES = 10;

const TONY_DOCUMENT_EXTRACTION_PROMPT = `Sei un assistente che estrae dati da documenti italiani di magazzino agricolo (bolle di consegna / DDT e fatture).

Analizza TUTTE le pagine fornite (stesso documento logico) e restituisci SOLO un oggetto JSON valido, senza markdown né testo extra.

Regole:
- tipoDocumento: "bolla" | "fattura" | "scontrino" | "sconosciuto"
- confidence: 0–1 a livello documento
- fornitore: { nome, piva, confidence } — stringhe vuote se assenti (emittente del documento, non il destinatario)
- numeroDocumento, dataDocumento (ISO YYYY-MM-DD se possibile, altrimenti stringa vuota)
- NUMERI DOCUMENTO / DDT (CRITICO — errori frequenti OCR):
  - Su bolla/DDT: leggi il campo «Numero D.D.T.» / «N. documento» CIFRA PER CIFRA (es. 1490/00 non 1493/00 né 1500/00).
  - Su fattura: stessi numeri nei riferimenti «Ddt num: …» — ricopia esattamente le cifre stampate, non approssimare.
  - Confusione tipica da evitare: 0↔8, 0↔3, 1↔7, 5↔6, 9↔0; non “arrotondare” a centinaia (1490≠1500).
  - Se incerto, abbassa confidence e preferisci la lettura letterale del riquadro numero documento.
- righe: array di SOLO righe merce/servizio con:
  descrizione (solo nome prodotto/servizio, senza prefisso DDT),
  codiceFornitore,
  quantita (numero),
  unita (L, kg, pz, NU, LT, …),
  prezzoUnitario (numero o null su bolla),
  riferimentoBolla (opzionale su fattura): { numeroDocumento, dataDocumento? } — DDT/bolla a cui appartiene la riga,
  confidence (0–1),
  paginaOrigine (1-based)
- totali (opzionale su fattura): { imponibile, iva, totale } — numeri o null
- riferimentiBolla (opzionale su fattura): array di { numeroDocumento, dataDocumento?, fornitore? } — elenco unico di tutti i DDT/bolle citati

Fatture riepilogative / multi-DDT (CRITICO):
- Righe tipo "Ddt num: 1334/00 del …", "DDT n.", "Documento di trasporto …" NON sono prodotti: non metterle in righe[]. Usale solo come contesto di gruppo.
- Ogni prodotto sotto un gruppo DDT deve avere riferimentoBolla.numeroDocumento di quel DDT.
- Non omettere prodotti: estrai TUTTE le righe merce con quantità e/o prezzo, anche se nello stesso gruppo DDT ce ne sono più di una.
- Spese, contributi, addebiti accessori (es. "Spese spedizione") sono righe valide.
- Preferisci Σ(quantita × prezzoUnitario) coerente con totali.imponibile (tolleranza tipografica); se manca una riga merce, rileggi la tabella.

Altre regole:
- Unisci righe duplicate su più pagine dello stesso documento
- Non inventare prodotti: se illeggibile, confidence bassa e descrizione parziale
- Layout fornitore-agnostic: nessun template fisso
- JSON stretto: virgolette doppie, numeri con punto decimale (es. 61.04 non 61,04), niente virgola finale, niente testo fuori dal JSON`;

/**
 * @param {unknown} pages
 * @returns {Array<{ mimeType: string, data: string, indice: number }>}
 */
function validateDocumentPages(pages) {
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error("Serve almeno una pagina (pages[].mimeType + pages[].data base64).");
  }
  if (pages.length > TONY_DOCUMENT_MAX_PAGES) {
    throw new Error(`Massimo ${TONY_DOCUMENT_MAX_PAGES} pagine per estrazione.`);
  }
  return pages.map((page, idx) => {
    if (!page || typeof page !== "object") {
      throw new Error(`Pagina ${idx + 1}: oggetto non valido.`);
    }
    const mimeType = String(page.mimeType || "").trim().toLowerCase();
    if (!TONY_DOCUMENT_ALLOWED_MIME.has(mimeType)) {
      throw new Error(
        `Pagina ${idx + 1}: MIME non supportato (${mimeType || "mancante"}). Ammessi: jpeg, png, webp, pdf.`
      );
    }
    const data = typeof page.data === "string" ? page.data.trim() : "";
    if (!data) {
      throw new Error(`Pagina ${idx + 1}: campo data (base64) obbligatorio.`);
    }
    const raw = data.replace(/^data:[^;]+;base64,/, "");
    let buf;
    try {
      buf = Buffer.from(raw, "base64");
    } catch (_) {
      throw new Error(`Pagina ${idx + 1}: base64 non valido.`);
    }
    if (!buf.length) {
      throw new Error(`Pagina ${idx + 1}: file vuoto.`);
    }
    if (buf.length > TONY_DOCUMENT_MAX_BYTES_PER_PAGE) {
      throw new Error(`Pagina ${idx + 1}: file troppo grande (max ~10 MB).`);
    }
    const indice = Number.isFinite(Number(page.indice)) ? Number(page.indice) : idx + 1;
    return { mimeType, data: raw, indice };
  });
}

/**
 * Ripara JSON tipicamente spezzato da Gemini (virgole finali, decimali IT, truncamento).
 * @param {string} source
 * @returns {string}
 */
function repairExtractedDocumentJsonText(source) {
  let s = String(source || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");

  // Decimali italiani fuori stringa: 61,04 → 61.04
  s = s.replace(/(:\s*)(-?\d+),(\d+)(\s*[,}\]])/g, "$1$2.$3$4");
  // Virgole finali prima di } o ]
  s = s.replace(/,\s*([}\]])/g, "$1");

  // Chiudi stringa / oggetti / array se risposta troncata
  let inString = false;
  let escape = false;
  const stack = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{" || c === "[") stack.push(c);
    else if (c === "}" || c === "]") {
      if (stack.length) stack.pop();
    }
  }
  if (inString) s += '"';
  s = s.replace(/,\s*$/, "");
  // Proprietà incompleta in coda: ,"chiave": oppure ,"chiave"
  s = s.replace(/,\s*"[^"]*"\s*:\s*("[^"]*")?\s*$/, "");
  s = s.replace(/,\s*"[^"]*"\s*$/, "");
  s = s.replace(/:\s*$/, ": null");
  while (stack.length) {
    const open = stack.pop();
    s += open === "{" ? "}" : "]";
  }
  s = s.replace(/,\s*([}\]])/g, "$1");
  return s;
}

/**
 * @param {string} rawText
 * @returns {object}
 */
function parseExtractedDocumentJson(rawText) {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("Risposta Gemini vuota.");
  }
  let source = rawText.trim();
  const fence = source.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    source = fence[1].trim();
  } else {
    const start = source.indexOf("{");
    if (start >= 0) {
      // Dal primo { in poi (anche se troncato). NON usare lastIndexOf('}'):
      // su fatture incomplete taglierebbe le righe dopo il primo oggetto chiuso.
      source = source.slice(start);
    }
  }

  const attempts = [source, repairExtractedDocumentJsonText(source)];
  // Se il JSON grezzo già bilancia, prova anche lo slice fino all'ultimo }
  const end = source.lastIndexOf("}");
  if (end > 0) {
    attempts.push(source.slice(0, end + 1));
    attempts.push(repairExtractedDocumentJsonText(source.slice(0, end + 1)));
  }
  let lastErr = null;
  for (let i = 0; i < attempts.length; i++) {
    try {
      const parsed = JSON.parse(attempts[i]);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("JSON estrazione deve essere un oggetto.");
      }
      return parsed;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    "JSON estrazione non valido: " + (lastErr && lastErr.message ? lastErr.message : "parse error")
  );
}

function toNumOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1, n));
}

function normalizeRiferimentiBolla(raw) {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .map((item) => {
      if (!item || typeof item !== "object") {
        if (typeof item === "string" && item.trim()) {
          return { numeroDocumento: item.trim(), dataDocumento: "", fornitore: "" };
        }
        return null;
      }
      const numero = String(item.numeroDocumento || item.numero || "").trim();
      if (!numero) return null;
      return {
        numeroDocumento: numero,
        dataDocumento: String(item.dataDocumento || item.data || "").trim(),
        fornitore: String(item.fornitore || "").trim(),
      };
    })
    .filter(Boolean);
}

/**
 * Intestazione gruppo DDT su fattura riepilogativa (non è una riga merce).
 * @param {string} descrizione
 * @returns {boolean}
 */
function isDdtHeaderDescrizione(descrizione) {
  const d = String(descrizione || "").trim();
  if (!d) return false;
  if (/^ddt\s*num/i.test(d)) return true;
  if (/^ddt\s*[nN°.]/i.test(d)) return true;
  if (/^documento\s+di\s+trasporto/i.test(d)) return true;
  if (/^bolla\s+(n|num)/i.test(d)) return true;
  // Solo riferimento DDT senza merce tipica
  if (/^ddt[\s.:/\d]/i.test(d) && !/\b(fung|inse|concim|maschera|spese|olio|rame|zolfo|fertil|seme)/i.test(d)) {
    return true;
  }
  return false;
}

/**
 * Estrae numero DDT da testo tipo "Ddt num: 1334/00 del 08/09/2026".
 * @param {string} text
 * @returns {{ numeroDocumento: string, dataDocumento: string }|null}
 */
function extractRiferimentoBollaFromText(text) {
  const s = String(text || "").trim();
  if (!s) return null;
  const m = s.match(
    /(?:ddt|bolla|documento\s+di\s+trasporto)\s*(?:num(?:ero)?|n\.?|n°)?\s*[:.]?\s*([0-9]+(?:\s*\/\s*[0-9A-Za-z]+)?)/i
  );
  if (!m) return null;
  const numeroDocumento = String(m[1] || "").replace(/\s+/g, "").trim();
  if (!numeroDocumento) return null;
  let dataDocumento = "";
  const d = s.match(/del\s+(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2})/i);
  if (d) dataDocumento = String(d[1] || "").trim();
  return { numeroDocumento, dataDocumento };
}

/**
 * @param {unknown} raw
 * @param {string} [descrizioneFallback]
 * @returns {{ numeroDocumento: string, dataDocumento: string }|null}
 */
function normalizeRigaRiferimentoBolla(raw, descrizioneFallback) {
  if (raw && typeof raw === "object") {
    const numero = String(raw.numeroDocumento || raw.numero || "").trim();
    if (numero) {
      return {
        numeroDocumento: numero,
        dataDocumento: String(raw.dataDocumento || raw.data || "").trim(),
      };
    }
  }
  if (typeof raw === "string" && raw.trim()) {
    const fromStr = extractRiferimentoBollaFromText(raw) || {
      numeroDocumento: raw.trim(),
      dataDocumento: "",
    };
    if (fromStr.numeroDocumento) return fromStr;
  }
  return extractRiferimentoBollaFromText(descrizioneFallback || "");
}

function mergeRiferimentiBolla(a, b) {
  const map = new Map();
  normalizeRiferimentiBolla(a).concat(normalizeRiferimentiBolla(b)).forEach((ref) => {
    const key = String(ref.numeroDocumento || "")
      .toLowerCase()
      .replace(/\s+/g, "");
    if (!key) return;
    if (!map.has(key)) map.set(key, ref);
  });
  return Array.from(map.values());
}

/**
 * Normalizza output Gemini verso schema interno GFV.
 * @param {object} raw
 * @returns {object}
 */
function normalizeExtractionResult(raw) {
  const tipo = String(raw.tipoDocumento || "sconosciuto").toLowerCase();
  const tipoDocumento = ["bolla", "fattura", "scontrino", "sconosciuto"].includes(tipo) ? tipo : "sconosciuto";
  const forn = raw.fornitore && typeof raw.fornitore === "object" ? raw.fornitore : {};
  const righeIn = Array.isArray(raw.righe) ? raw.righe : [];
  let lastRif = null;
  const refsFromRows = [];
  const righe = righeIn
    .map((r, i) => {
      const row = r && typeof r === "object" ? r : {};
      const descrizione = String(row.descrizione || "").trim();
      if (!descrizione) return null;

      // Intestazione gruppo DDT: aggiorna contesto, non creare riga merce
      if (isDdtHeaderDescrizione(descrizione)) {
        const hdr = extractRiferimentoBollaFromText(descrizione);
        if (hdr) {
          lastRif = hdr;
          refsFromRows.push(hdr);
        }
        return null;
      }

      let riferimentoBolla = normalizeRigaRiferimentoBolla(
        row.riferimentoBolla || row.riferimentoDDT || row.ddt,
        descrizione
      );
      if (!riferimentoBolla && lastRif) {
        riferimentoBolla = { ...lastRif };
      }
      if (riferimentoBolla) {
        lastRif = riferimentoBolla;
        refsFromRows.push(riferimentoBolla);
      }

      return {
        descrizione,
        codiceFornitore: String(row.codiceFornitore || row.codice || "").trim(),
        quantita: toNumOrNull(row.quantita),
        unita: String(row.unita || row.unitaMisura || "").trim(),
        prezzoUnitario: toNumOrNull(row.prezzoUnitario),
        riferimentoBolla: riferimentoBolla || null,
        confidence: clamp01(row.confidence),
        paginaOrigine: Number.isFinite(Number(row.paginaOrigine)) ? Number(row.paginaOrigine) : i + 1,
      };
    })
    .filter(Boolean);

  const tot = raw.totali && typeof raw.totali === "object" ? raw.totali : null;
  let totali = null;
  if (tot) {
    totali = {
      imponibile: toNumOrNull(tot.imponibile),
      iva: toNumOrNull(tot.iva),
      totale: toNumOrNull(tot.totale),
    };
  }

  return {
    tipoDocumento,
    confidence: clamp01(raw.confidence),
    fornitore: {
      nome: String(forn.nome || forn.ragioneSociale || "").trim(),
      piva: String(forn.piva || forn.partitaIva || "").trim(),
      confidence: clamp01(forn.confidence),
    },
    numeroDocumento: String(raw.numeroDocumento || raw.numero || "").trim(),
    dataDocumento: String(raw.dataDocumento || raw.data || "").trim(),
    righe,
    totali,
    riferimentiBolla: mergeRiferimentiBolla(raw.riferimentiBolla, refsFromRows),
  };
}

/**
 * @param {Array<{ mimeType: string, data: string, indice: number }>} pages
 * @returns {Array<object>}
 */
function buildGeminiDocumentParts(pages) {
  const parts = [{ text: TONY_DOCUMENT_EXTRACTION_PROMPT }];
  for (const page of pages) {
    parts.push({
      text: `--- Pagina ${page.indice} (${page.mimeType}) ---`,
    });
    parts.push({
      inlineData: {
        mimeType: page.mimeType,
        data: page.data,
      },
    });
  }
  parts.push({
    text: "Restituisci solo il JSON di estrazione secondo le regole sopra.",
  });
  return parts;
}

module.exports = {
  TONY_DOCUMENT_ALLOWED_MIME,
  TONY_DOCUMENT_MAX_BYTES_PER_PAGE,
  TONY_DOCUMENT_MAX_PAGES,
  TONY_DOCUMENT_EXTRACTION_PROMPT,
  validateDocumentPages,
  parseExtractedDocumentJson,
  repairExtractedDocumentJsonText,
  normalizeExtractionResult,
  buildGeminiDocumentParts,
  isDdtHeaderDescrizione,
  extractRiferimentoBollaFromText,
  normalizeRigaRiferimentoBolla,
};
