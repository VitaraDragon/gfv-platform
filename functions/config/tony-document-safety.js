"use strict";

/**
 * Tony Occhi — Level B: decide se serve una seconda passata Gemini
 * e come fondere i risultati. Solo controlli deterministici (veloci).
 */

const { buildGeminiDocumentParts } = require("./tony-document-schemas");

/**
 * @param {Array<object>} righe
 * @returns {number|null}
 */
function sumRigheImportoNetto(righe) {
  let sum = 0;
  let any = false;
  (righe || []).forEach((r) => {
    const qty = Number(r && r.quantita);
    const prezzo = Number(r && r.prezzoUnitario);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(prezzo)) return;
    sum += qty * prezzo;
    any = true;
  });
  return any ? Math.round(sum * 100) / 100 : null;
}

/**
 * @param {Array<object>} righe
 * @returns {number}
 */
function countMerceRows(righe) {
  return (righe || []).filter((r) => {
    const desc = String((r && r.descrizione) || "").trim();
    const qty = Number(r && r.quantita);
    return desc.length >= 1 && Number.isFinite(qty) && qty > 0;
  }).length;
}

/**
 * Decide se lanciare la seconda passata (Flash mirata).
 * Soglie più strette del soft-gate UI: non ridondare su ogni warning lieve.
 * @param {object} estrazione
 * @returns {{ run: boolean, reasons: string[] }}
 */
function shouldRunSafetySecondPass(estrazione) {
  const e = estrazione || {};
  const tipo = String(e.tipoDocumento || "").toLowerCase();
  const righe = Array.isArray(e.righe) ? e.righe : [];
  const reasons = [];

  if (countMerceRows(righe) === 0) {
    reasons.push("no_rows");
  }

  const docConf = e.confidence != null ? Number(e.confidence) : null;
  if (docConf != null && Number.isFinite(docConf) && docConf < 0.65) {
    reasons.push("doc_confidence_low");
  }

  if (righe.length >= 2) {
    const low = righe.filter((r) => {
      const c = r.confidence != null ? Number(r.confidence) : null;
      return c != null && Number.isFinite(c) && c < 0.7;
    }).length;
    if (low / righe.length >= 0.5) {
      reasons.push("many_low_confidence_rows");
    }
  }

  if (!String(e.numeroDocumento || "").trim() && (tipo === "bolla" || tipo === "fattura")) {
    reasons.push("missing_numero");
  }

  const dataStr = String(e.dataDocumento || "").trim();
  const yearMatch = dataStr.match(/(\d{4})/);
  if (yearMatch) {
    const y = parseInt(yearMatch[1], 10);
    const cy = new Date().getFullYear();
    if (y >= 2000 && y <= 2100 && Math.abs(y - cy) > 2) {
      reasons.push("date_implausible");
    }
  }

  if (tipo === "fattura" || tipo === "scontrino") {
    const sum = sumRigheImportoNetto(righe);
    const imponibile = e.totali && e.totali.imponibile != null ? Number(e.totali.imponibile) : null;
    if (sum != null && imponibile != null && Number.isFinite(imponibile)) {
      const delta = Math.abs(sum - imponibile);
      const rel = delta / Math.max(Math.abs(imponibile), 1);
      if (delta > 5 && rel > 0.03) {
        reasons.push("imponibile_mismatch");
      }
    }
    if (imponibile != null && Number.isFinite(imponibile) && imponibile > 100 && countMerceRows(righe) <= 1) {
      reasons.push("few_rows_vs_imponibile");
    }
  }

  return { run: reasons.length > 0, reasons };
}

/**
 * Prompt mirato: completezza righe + numeri documento (senza riscrivere tutto il canone).
 * @param {Array<{ mimeType: string, data: string, indice: number }>} pages
 * @param {object} first
 * @param {string[]} reasons
 * @returns {Array<object>}
 */
function buildSafetySecondPassParts(pages, first, reasons) {
  const e = first || {};
  const reasonsText = (reasons || []).join(", ") || "incompleto";
  const nRighe = countMerceRows(e.righe);
  const imp = e.totali && e.totali.imponibile != null ? e.totali.imponibile : null;
  const context =
    "PRIMA LETTURA (incompleta/incoerente — motivi: " +
    reasonsText +
    "). tipo=" +
    (e.tipoDocumento || "?") +
    ", n.doc=" +
    (e.numeroDocumento || "(vuoto)") +
    ", righeMerce=" +
    nRighe +
    (imp != null ? ", imponibile=" + imp : "") +
    ".\n" +
    "COMPITO SECONDA PASSATA (CRITICO):\n" +
    "1) Elenca TUTTE le righe merce/servizio con quantità e prezzo (se in documento), senza omettere articoli.\n" +
    "2) NON includere intestazioni «Ddt num:…» come prodotti; usa riferimentoBolla sulle righe.\n" +
    "3) Numero documento / DDT: leggi CIFRA PER CIFRA dal riquadro stampato.\n" +
    "4) Su fattura: Σ(qty×prezzo) deve avvicinarsi all'imponibile; se manca una riga, rileggi la tabella.\n" +
    "5) Restituisci lo STESSO schema JSON della prima lettura (tipoDocumento, confidence, fornitore, numeroDocumento, dataDocumento, righe[], totali, riferimentiBolla).\n";

  const base = buildGeminiDocumentParts(pages);
  // Inserisci il contesto subito dopo il prompt di sistema (parts[0])
  const parts = [base[0], { text: context }].concat(base.slice(1));
  return parts;
}

function normDescKey(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 48);
}

/**
 * Unisce riferimenti bolla senza duplicati.
 * @param {Array} a
 * @param {Array} b
 */
function mergeRefs(a, b) {
  const map = new Map();
  []
    .concat(Array.isArray(a) ? a : [], Array.isArray(b) ? b : [])
    .forEach((ref) => {
      if (!ref || !ref.numeroDocumento) return;
      const key = String(ref.numeroDocumento)
        .toLowerCase()
        .replace(/\s+/g, "");
      if (!map.has(key)) map.set(key, ref);
    });
  return Array.from(map.values());
}

/**
 * Fondi prima + seconda passata privilegiando completezza righe e campi intestazione.
 * @param {object} first
 * @param {object} second
 * @param {string[]} reasons
 * @returns {object}
 */
function mergeSafetySecondPass(first, second, reasons) {
  const a = first || {};
  const b = second || {};
  const out = {
    tipoDocumento: a.tipoDocumento || b.tipoDocumento || "sconosciuto",
    confidence: null,
    fornitore: Object.assign({ nome: "", piva: "", confidence: null }, a.fornitore || {}),
    numeroDocumento: String(a.numeroDocumento || "").trim(),
    dataDocumento: String(a.dataDocumento || "").trim(),
    righe: Array.isArray(a.righe) ? a.righe.slice() : [],
    totali: a.totali || null,
    riferimentiBolla: mergeRefs(a.riferimentiBolla, b.riferimentiBolla),
    safetyPassB: true,
    safetyPassBReasons: Array.isArray(reasons) ? reasons.slice() : [],
  };

  if (b.tipoDocumento && a.tipoDocumento === "sconosciuto") {
    out.tipoDocumento = b.tipoDocumento;
  }

  if (!out.numeroDocumento && b.numeroDocumento) {
    out.numeroDocumento = String(b.numeroDocumento).trim();
  }
  if (!out.dataDocumento && b.dataDocumento) {
    out.dataDocumento = String(b.dataDocumento).trim();
  }
  if ((!out.fornitore.nome || !out.fornitore.nome.trim()) && b.fornitore && b.fornitore.nome) {
    out.fornitore.nome = String(b.fornitore.nome).trim();
  }
  if ((!out.fornitore.piva || !out.fornitore.piva.trim()) && b.fornitore && b.fornitore.piva) {
    out.fornitore.piva = String(b.fornitore.piva).trim();
  }

  const countA = countMerceRows(a.righe);
  const countB = countMerceRows(b.righe);
  if (countB > countA) {
    out.righe = Array.isArray(b.righe) ? b.righe.slice() : [];
  } else if (countB > 0 && countA > 0) {
    // Completa prezzi mancanti dalla seconda passata (stessa descrizione)
    const byKey = new Map();
    (b.righe || []).forEach((r) => {
      const k = normDescKey(r.descrizione) + "|" + String(r.quantita);
      if (!byKey.has(k)) byKey.set(k, r);
    });
    out.righe = (a.righe || []).map((r) => {
      const k = normDescKey(r.descrizione) + "|" + String(r.quantita);
      const alt = byKey.get(k);
      if (!alt) return r;
      const next = Object.assign({}, r);
      if ((next.prezzoUnitario == null || next.prezzoUnitario === "") && alt.prezzoUnitario != null) {
        next.prezzoUnitario = alt.prezzoUnitario;
      }
      if (!next.riferimentoBolla && alt.riferimentoBolla) {
        next.riferimentoBolla = alt.riferimentoBolla;
      }
      if ((next.confidence == null || next.confidence < 0.7) && alt.confidence != null) {
        next.confidence = Math.max(Number(next.confidence) || 0, Number(alt.confidence) || 0);
      }
      return next;
    });
    // Aggiungi righe della B assenti in A
    const keysA = new Set(
      (out.righe || []).map((r) => normDescKey(r.descrizione) + "|" + String(r.quantita))
    );
    (b.righe || []).forEach((r) => {
      const k = normDescKey(r.descrizione) + "|" + String(r.quantita);
      if (!keysA.has(k) && String(r.descrizione || "").trim()) {
        out.righe.push(r);
        keysA.add(k);
      }
    });
  } else if (countB > 0 && countA === 0) {
    out.righe = Array.isArray(b.righe) ? b.righe.slice() : [];
  }

  if (!out.totali && b.totali) {
    out.totali = b.totali;
  } else if (out.totali && b.totali) {
    out.totali = {
      imponibile: out.totali.imponibile != null ? out.totali.imponibile : b.totali.imponibile,
      iva: out.totali.iva != null ? out.totali.iva : b.totali.iva,
      totale: out.totali.totale != null ? out.totali.totale : b.totali.totale,
    };
  }

  const ca = a.confidence != null ? Number(a.confidence) : null;
  const cb = b.confidence != null ? Number(b.confidence) : null;
  if (ca != null && cb != null && Number.isFinite(ca) && Number.isFinite(cb)) {
    out.confidence = Math.min(1, Math.max(ca, cb));
  } else {
    out.confidence = cb != null && Number.isFinite(cb) ? cb : ca;
  }

  return out;
}

module.exports = {
  sumRigheImportoNetto,
  countMerceRows,
  shouldRunSafetySecondPass,
  buildSafetySecondPassParts,
  mergeSafetySecondPass,
};
