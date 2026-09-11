"use strict";

/**
 * Parser deterministico FatturaPA / fattura elettronica XML (schema Agenzia Entrate).
 * Non è un template per fornitore: è lo standard legale italiano.
 * Output allineato a normalizeExtractionResult (Tony Occhi).
 */

const FATTURAPA_MIME = new Set([
  "application/xml",
  "text/xml",
  "application/fatturapa+xml",
]);

function isXmlMime(mime) {
  const m = String(mime || "").toLowerCase().trim();
  return FATTURAPA_MIME.has(m);
}

/**
 * @param {Buffer} buf
 * @returns {string}
 */
function decodeXmlBuffer(buf) {
  if (!buf || !buf.length) return "";
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.slice(2).toString("utf16le");
  }
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.slice(3).toString("utf8");
  }
  const head = buf.slice(0, 240).toString("ascii");
  const enc = (head.match(/encoding\s*=\s*["']([^"']+)["']/i) || [])[1] || "";
  if (/utf-16/i.test(enc)) return buf.toString("utf16le");
  if (/iso-8859-1|windows-1252|latin-?1/i.test(enc)) return buf.toString("latin1");
  return buf.toString("utf8");
}

function unescapeXml(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => {
      const cp = parseInt(n, 16);
      return Number.isFinite(cp) ? String.fromCharCode(cp) : "";
    })
    .replace(/&#(\d+);/g, (_, n) => {
      const cp = Number(n);
      return Number.isFinite(cp) ? String.fromCharCode(cp) : "";
    })
    .replace(/&amp;/g, "&")
    .trim();
}

function xmlAll(xml, tag) {
  const re = new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[A-Za-z_][\\w.-]*:)?${tag}>`,
    "gi"
  );
  const out = [];
  let m;
  const source = String(xml || "");
  while ((m = re.exec(source))) {
    out.push(m[1]);
  }
  return out;
}

function xmlFirst(xml, tag) {
  const all = xmlAll(xml, tag);
  return all.length ? all[0] : "";
}

function xmlText(xml, tag) {
  return unescapeXml(xmlFirst(xml, tag));
}

function looksLikeFatturaPaXml(text) {
  const s = String(text || "");
  return (
    /<(?:[A-Za-z_][\w.-]*:)?FatturaElettronica[\s>]/i.test(s) ||
    /<(?:[A-Za-z_][\w.-]*:)?FatturaElettronicaHeader[\s>]/i.test(s)
  );
}

/**
 * @param {Buffer} buf
 * @returns {boolean}
 */
function looksLikeXmlBuffer(buf) {
  if (!buf || !buf.length) return false;
  let i = 0;
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) i = 3;
  while (i < buf.length && (buf[i] === 0x20 || buf[i] === 0x09 || buf[i] === 0x0a || buf[i] === 0x0d)) {
    i += 1;
  }
  if (buf[i] !== 0x3c) return false;
  const head = buf.slice(i, Math.min(i + 120, buf.length)).toString("utf8");
  return (
    head.indexOf("<?xml") === 0 ||
    /<(?:[A-Za-z_][\w.-]*:)?FatturaElettronica/i.test(head) ||
    head.charAt(0) === "<"
  );
}

/**
 * Alcuni PDF di fattura elettronica includono l'XML in chiaro (allegato non compresso).
 * @param {Buffer} buf
 * @returns {string|null}
 */
function tryExtractXmlFromPdfBuffer(buf) {
  if (!buf || !buf.length) return null;
  const encodings = ["utf8", "latin1"];
  for (let e = 0; e < encodings.length; e++) {
    const s = buf.toString(encodings[e]);
    const start = s.search(/<(?:[A-Za-z_][\w.-]*:)?FatturaElettronica[\s>]/i);
    if (start < 0) continue;
    const endM = s.slice(start).match(/<\/(?:[A-Za-z_][\w.-]*:)?FatturaElettronica\s*>/i);
    if (!endM || endM.index == null) continue;
    const xml = s.slice(start, start + endM.index + endM[0].length);
    if (looksLikeFatturaPaXml(xml) && xmlAll(xml, "DettaglioLinee").length) return xml;
  }
  return null;
}

function toNum(v) {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}

function parseFornitore(headerXml) {
  const cedente = xmlFirst(headerXml, "CedentePrestatore");
  const anag = xmlFirst(cedente, "Anagrafica");
  let nome = xmlText(anag, "Denominazione");
  if (!nome) {
    const n = xmlText(anag, "Nome");
    const c = xmlText(anag, "Cognome");
    nome = [n, c].filter(Boolean).join(" ").trim();
  }
  const id = xmlText(cedente, "IdCodice");
  const paese = xmlText(cedente, "IdPaese");
  const piva = id ? (paese && paese !== "IT" ? paese + id : id) : "";
  return { nome, piva, confidence: nome || piva ? 1 : 0 };
}

function parseDatiDdt(bodyXml) {
  const blocks = xmlAll(bodyXml, "DatiDDT");
  const refs = [];
  const lineMap = new Map();
  const applyToAll = [];
  blocks.forEach((block) => {
    const numero = xmlText(block, "NumeroDDT");
    if (!numero) return;
    const data = xmlText(block, "DataDDT");
    const ref = { numeroDocumento: numero, dataDocumento: data, fornitore: "" };
    refs.push(ref);
    const lines = xmlAll(block, "RiferimentoNumeroLinea").map((x) => unescapeXml(x));
    if (!lines.length) applyToAll.push(ref);
    else {
      lines.forEach((n) => {
        const key = String(n || "").trim();
        if (key) lineMap.set(key, ref);
      });
    }
  });
  return { refs, lineMap, applyToAll };
}

function parseLinee(bodyXml, ddt) {
  const lines = xmlAll(bodyXml, "DettaglioLinee");
  const defaultRef = ddt.applyToAll.length === 1 ? ddt.applyToAll[0] : null;
  return lines
    .map((line) => {
      const descrizione = xmlText(line, "Descrizione");
      if (!descrizione) return null;
      const numeroLinea = xmlText(line, "NumeroLinea");
      const codice = xmlText(line, "CodiceValore");
      const qty = toNum(xmlText(line, "Quantita"));
      const unita = xmlText(line, "UnitaMisura");
      const prezzo = toNum(xmlText(line, "PrezzoUnitario"));
      const rif =
        (numeroLinea && ddt.lineMap.get(String(numeroLinea).trim())) || defaultRef || null;
      return {
        descrizione,
        codiceFornitore: codice,
        quantita: qty,
        unita,
        prezzoUnitario: prezzo,
        riferimentoBolla: rif
          ? { numeroDocumento: rif.numeroDocumento, dataDocumento: rif.dataDocumento }
          : null,
        confidence: 1,
        paginaOrigine: 1,
      };
    })
    .filter(Boolean);
}

function parseTotali(bodyXml) {
  const riep = xmlAll(bodyXml, "DatiRiepilogo");
  let imponibile = 0;
  let iva = 0;
  let any = false;
  riep.forEach((r) => {
    const imp = toNum(xmlText(r, "ImponibileImporto"));
    const tax = toNum(xmlText(r, "Imposta"));
    if (imp != null) {
      imponibile += imp;
      any = true;
    }
    if (tax != null) iva += tax;
  });
  const totDoc = toNum(xmlText(bodyXml, "ImportoTotaleDocumento"));
  if (!any && totDoc == null) return null;
  const totali = {
    imponibile: any ? Math.round(imponibile * 100) / 100 : null,
    iva: any ? Math.round(iva * 100) / 100 : null,
    totale: totDoc,
  };
  if (totali.totale == null && totali.imponibile != null && totali.iva != null) {
    totali.totale = Math.round((totali.imponibile + totali.iva) * 100) / 100;
  }
  return totali;
}

/**
 * @param {string} xml
 * @returns {object}
 */
function parseFatturaPaXml(xml) {
  if (!looksLikeFatturaPaXml(xml)) {
    throw new Error("XML non riconosciuto come FatturaPA.");
  }
  const header = xmlFirst(xml, "FatturaElettronicaHeader");
  const bodies = xmlAll(xml, "FatturaElettronicaBody");
  const body = bodies[0] || xml;
  const ddt = parseDatiDdt(body);
  const righe = parseLinee(body, ddt);
  return {
    tipoDocumento: "fattura",
    confidence: 1,
    fornitore: parseFornitore(header || xml),
    numeroDocumento: xmlText(body, "Numero"),
    dataDocumento: xmlText(body, "Data"),
    righe,
    totali: parseTotali(body),
    riferimentiBolla: ddt.refs,
    fonteEstrazione: "fatturapa",
    fattureNelFile: bodies.length || 1,
  };
}

/**
 * @param {Array<{ mimeType: string, data: string }>} pages
 * @returns {object|null}
 */
function tryExtractFatturaPaFromPages(pages) {
  const list = Array.isArray(pages) ? pages : [];
  for (let i = 0; i < list.length; i++) {
    const page = list[i] || {};
    let buf;
    try {
      buf = Buffer.from(String(page.data || ""), "base64");
    } catch (_) {
      continue;
    }
    if (!buf.length) continue;
    const mime = String(page.mimeType || "").toLowerCase();
    if (isXmlMime(mime) || looksLikeXmlBuffer(buf)) {
      const xml = decodeXmlBuffer(buf);
      if (looksLikeFatturaPaXml(xml)) {
        try {
          return parseFatturaPaXml(xml);
        } catch (_) {
          /* pagina successiva */
        }
      }
    }
    if (mime === "application/pdf") {
      const xml = tryExtractXmlFromPdfBuffer(buf);
      if (xml) {
        try {
          return parseFatturaPaXml(xml);
        } catch (_) {
          /* continua */
        }
      }
    }
  }
  return null;
}

module.exports = {
  FATTURAPA_MIME,
  isXmlMime,
  decodeXmlBuffer,
  looksLikeFatturaPaXml,
  looksLikeXmlBuffer,
  tryExtractXmlFromPdfBuffer,
  parseFatturaPaXml,
  tryExtractFatturaPaFromPages,
};
