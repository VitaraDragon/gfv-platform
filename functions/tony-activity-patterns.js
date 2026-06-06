"use strict";

const { getModuliAttiviFromCtx, hasActiveModule } = require("./tony-module-gate");

/**
 * Parser deterministico pattern attività/ore (Fase 3).
 * Config-driven — estendibile senza patch per pagina.
 * Senza manodopera: diario attività (attivita-form).
 * Con manodopera: il parser non apre pagine (manager non usa diario né Segna ore; operai/capi hanno profilo campo e altri hook).
 */

const ACTIVITY_VERB_MAP = [
  { re: /\btrinciat[oaie]?/i, tipo: "Trinciatura", keywords: ["trinciatur"] },
  { re: /\bpotat[oaie]?/i, tipo: "Potatura", keywords: ["potatur"] },
  { re: /\berpicat[oaie]?/i, tipo: "Erpicatura", keywords: ["erpicatur"] },
  { re: /\bvendemmiat[oaie]?/i, tipo: "Vendemmia", keywords: ["vendemm"] },
  { re: /\barat[oaie]?/i, tipo: "Aratura", keywords: ["aratur"] },
  { re: /\bdiserbat[oaie]?/i, tipo: "Diserbo", keywords: ["diserb"] },
  { re: /\bseminat[oaie]?/i, tipo: "Semina", keywords: ["semina"] },
];

const RELATIVE_DATE_MAP = [
  { re: /\bieri\b/i, offsetDays: -1 },
  { re: /\boggi\b/i, offsetDays: 0 },
  { re: /\bdomani\b/i, offsetDays: 1 },
  { re: /\bl(?:'|\s)?altro\s*ieri\b/i, offsetDays: -2 },
];

function normText(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formatIsoDateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function resolveRelativeDate(message) {
  const m = String(message || "");
  for (const entry of RELATIVE_DATE_MAP) {
    if (entry.re.test(m)) {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() + entry.offsetDays);
      return formatIsoDateLocal(d);
    }
  }
  return null;
}

function extractHours(message) {
  const m = String(message || "");
  let match =
    m.match(/(\d+(?:[.,]\d+)?)\s*(?:ore|h)\b/i) ||
    m.match(/\b(?:per|da)\s+(\d+(?:[.,]\d+)?)\s*(?:ore|h)?\b/i);
  if (!match) return null;
  const n = parseFloat(String(match[1]).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0 || n > 24) return null;
  return n;
}

function resolveActivityType(message, tipiLavoro) {
  const msgN = normText(message);
  for (const entry of ACTIVITY_VERB_MAP) {
    if (entry.re.test(message)) {
      const tipi = Array.isArray(tipiLavoro) ? tipiLavoro : [];
      const found = tipi.find((t) => {
        const nome = normText(t.nome || t.label || t.id || "");
        return entry.keywords.some((kw) => nome.includes(kw));
      });
      return (found && (found.nome || found.label)) || entry.tipo;
    }
  }
  return null;
}

function resolveTerreno(message, terreni) {
  const list = Array.isArray(terreni) ? terreni : [];
  if (list.length === 0) return { id: null, ambiguous: false };
  const msgN = normText(message);
  const matches = list.filter((t) => {
    const nome = normText(t.nome || t.label || "");
    return nome.length >= 3 && msgN.includes(nome);
  });
  if (matches.length === 1) {
    return { id: matches[0].id || matches[0].nome, nome: matches[0].nome, ambiguous: false };
  }
  if (matches.length > 1) return { id: null, ambiguous: true, matches };
  return { id: null, ambiguous: false };
}

function isActivityPatternMessage(message) {
  const m = String(message || "").toLowerCase();
  if (!/\b(segna|registra|ho\s+(fatto|trinciato|potato|erpicato|lavorato)|segno|segnare)\b/i.test(m)) {
    if (!/\b(trinciat|potat|erpicat|vendemmiat|arat|diserbat|seminat)\w*\b/i.test(m)) return false;
  }
  return extractHours(message) != null || /\b(trinciat|potat|erpicat|vendemmiat)\w*\b/i.test(m);
}

/**
 * @param {{ message: string, history?: object[], ctx: object }} input
 * @returns {{ id: string, text: string, command: object } | null}
 */
function tryTonyActivityPatterns(input) {
  const message = input && input.message ? String(input.message) : "";
  if (!message.trim() || !isActivityPatternMessage(message)) return null;

  const ctx = (input && input.ctx) || {};
  const azienda = ctx.azienda || {};
  const terreni = azienda.terreni || ctx.attivita?.terreni || [];
  const tipiLavoro = azienda.tipiLavoro || [];

  const ore = extractHours(message);
  const tipoLavoro = resolveActivityType(message, tipiLavoro);
  const terreno = resolveTerreno(message, terreni);
  const dataIso = resolveRelativeDate(message);

  if (!tipoLavoro) return null;
  if (terreno.ambiguous) return null;
  if (ore == null) return null;

  const moduliAttivi = getModuliAttiviFromCtx(ctx);
  const manodoperaAttiva = hasActiveModule(moduliAttivi, "manodopera");

  const terrenoLabel = terreno.nome ? ` nel ${terreno.nome}` : "";
  const dataLabel = dataIso ? ` del ${dataIso}` : "";

  if (manodoperaAttiva) {
    const text =
      `Ho capito: ${tipoLavoro.toLowerCase()}${terrenoLabel}, ${ore} ore${dataLabel}. ` +
      "Con il modulo manodopera le ore le segnano operai e caposquadra dal workspace in campo; tu da manager le validi in Validazione ore e pianifichi in Gestione lavori. " +
      "Segnare ore proprie da qui non è ancora previsto: dimmi se vuoi aprire Gestione lavori o Validazione ore.";

    return {
      id: "activity_pattern_manodopera_info",
      text,
      command: null,
    };
  }

  const formData = {
    "attivita-tipo-lavoro": tipoLavoro,
    "attivita-ore": String(ore),
  };
  if (terreno.id) formData["attivita-terreno"] = terreno.id;
  if (dataIso) formData["attivita-data"] = dataIso;

  const text = `Segno ${tipoLavoro.toLowerCase()}${terrenoLabel}: ${ore} ore${dataLabel}. Controlla il form e conferma se manca qualcosa.`;

  return {
    id: "activity_pattern",
    text,
    command: {
      type: "INJECT_FORM_DATA",
      formId: "attivita-form",
      formData,
    },
  };
}

module.exports = {
  tryTonyActivityPatterns,
  isActivityPatternMessage,
  extractHours,
  resolveActivityType,
  resolveTerreno,
  resolveRelativeDate,
};
