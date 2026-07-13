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
- fornitore: { nome, piva, confidence } — stringhe vuote se assenti
- numeroDocumento, dataDocumento (ISO YYYY-MM-DD se possibile, altrimenti stringa vuota)
- righe: array con descrizione, codiceFornitore, quantita (numero), unita (L, kg, pz, …), prezzoUnitario (numero o null su bolla), confidence (0–1), paginaOrigine (1-based)
- totali (opzionale su fattura): { imponibile, iva, totale } — numeri o null
- riferimentiBolla (opzionale su fattura): array di { numeroDocumento, dataDocumento?, fornitore? } — DDT/bolle citati nel documento
- Unisci righe duplicate su più pagine dello stesso documento
- Non inventare prodotti: se illeggibile, confidence bassa e descrizione parziale
- Layout fornitore-agnostic: nessun template fisso`;

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
    const loose = source.match(/\{[\s\S]*\}/);
    if (loose) source = loose[0].trim();
  }
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch (e) {
    throw new Error("JSON estrazione non valido: " + (e && e.message ? e.message : "parse error"));
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON estrazione deve essere un oggetto.");
  }
  return parsed;
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
 * Normalizza output Gemini verso schema interno GFV.
 * @param {object} raw
 * @returns {object}
 */
function normalizeExtractionResult(raw) {
  const tipo = String(raw.tipoDocumento || "sconosciuto").toLowerCase();
  const tipoDocumento = ["bolla", "fattura", "scontrino", "sconosciuto"].includes(tipo) ? tipo : "sconosciuto";
  const forn = raw.fornitore && typeof raw.fornitore === "object" ? raw.fornitore : {};
  const righeIn = Array.isArray(raw.righe) ? raw.righe : [];
  const righe = righeIn.map((r, i) => {
    const row = r && typeof r === "object" ? r : {};
    return {
      descrizione: String(row.descrizione || "").trim(),
      codiceFornitore: String(row.codiceFornitore || row.codice || "").trim(),
      quantita: toNumOrNull(row.quantita),
      unita: String(row.unita || row.unitaMisura || "").trim(),
      prezzoUnitario: toNumOrNull(row.prezzoUnitario),
      confidence: clamp01(row.confidence),
      paginaOrigine: Number.isFinite(Number(row.paginaOrigine)) ? Number(row.paginaOrigine) : i + 1,
    };
  }).filter((r) => r.descrizione.length > 0);

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
    riferimentiBolla: normalizeRiferimentiBolla(raw.riferimentiBolla),
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
  normalizeExtractionResult,
  buildGeminiDocumentParts,
};
