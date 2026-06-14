"use strict";

function normalizeItTony(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isOnTerreniPage(ctx) {
  const page = (ctx && ctx.page) || {};
  const pt = (page.currentTableData && page.currentTableData.pageType) || page.pageType || "";
  if (String(pt) === "terreni") return true;
  const path = String(page.pagePath || "");
  return path.toLowerCase().includes("terreni");
}

function isTerrenoCreationIntent(message) {
  const m = normalizeItTony(message);
  if (!/\bterren\w*\b/.test(m)) return false;
  return (
    /\b(aggiung\w*|crea\w*|nuov\w*|inserisc\w*|registr\w*|fammi\s+vedere|mostra\w*|apri\w*|compila\w*)\b/.test(m) ||
    /\bterreno\s+(di|da|nel|al)\b/.test(m)
  );
}

function pickNameFromList(msgNorm, list) {
  if (!Array.isArray(list) || !msgNorm) return null;
  let best = null;
  let bestLen = 0;
  for (const item of list) {
    const raw = typeof item === "string" ? item : item.nome || item.label || "";
    const name = normalizeItTony(raw);
    if (!name || name.length < 2) continue;
    if (msgNorm.includes(name) && name.length > bestLen) {
      best = String(raw).trim();
      bestLen = name.length;
    }
  }
  return best;
}

function extractSuperficieHa(message) {
  const m = String(message || "").match(/(\d+[.,]?\d*)\s*(ha|ettar\w*)/i);
  if (m) return m[1].replace(",", ".");
  if (/\b(un|una|1)\s+ettar/i.test(message)) return "1";
  return null;
}

function inferColtura(message, coltureList) {
  const m = normalizeItTony(message);
  const fromList = pickNameFromList(m, coltureList);
  if (fromList) return fromList;
  if (/\bvite\s+da\s+vino\b|\bsangiovese\b|\bbarbera\b|\bmerlot\b/.test(m)) return "Vite da Vino";
  if (/\bchasselas\b|\bmuller\b/.test(m)) return "Chasselas";
  if (/\bkaki\b/.test(m)) return "Kaki";
  if (/\balbicocc/.test(m)) return "Albicocche";
  if (/\bgrano\b|\bfrumento\b/.test(m)) return "Grano tenero";
  if (/\bmais\b/.test(m)) return "Mais";
  return null;
}

function inferTerrenoNome(message, coltura, podere) {
  const raw = String(message || "").trim();
  const m = normalizeItTony(raw);
  const quoted = raw.match(/["']([^"']{2,60})["']/);
  if (quoted) return quoted[1].trim();

  const typed = raw.match(
    /\b(vigneto|frutteto|seminativo|appezzamento|oliveto)\s+([a-zàèéìòù][\w\s'-]{1,48})/i
  );
  if (typed) {
    let n = `${typed[1]} ${typed[2]}`.trim();
    n = n.replace(/\s+\d+[.,]?\d*\s*(ha|ettar\w*)?\b.*$/i, "").trim();
    n = n.replace(/\s+(di|da|a|in|al|nel|podere|coltura|vite)\b[\s\S]*$/i, "").trim();
    if (n.length >= 3) {
      return n
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
    }
  }

  if (coltura && podere) {
    const cShort = String(coltura).split(/\s+/).slice(0, 2).join(" ");
    return `${cShort} ${podere}`.trim();
  }
  if (/\bvigneto\b/.test(m)) return "Vigneto nuovo";
  if (coltura) return String(coltura);
  return null;
}

/**
 * @param {{ message: string, history?: object[], ctx: object }} input
 * @returns {{ id: string, text: string, command: object, earlyReturn: boolean, fieldsCount: number } | null}
 */
function tryTonyTerrenoEntityParse(input) {
  const message = input && input.message ? String(input.message) : "";
  const ctx = (input && input.ctx) || {};
  if (!message.trim() || !isOnTerreniPage(ctx) || !isTerrenoCreationIntent(message)) return null;

  const pageTerreni = (ctx.page && ctx.page.terreni) || {};
  const coltureList = Array.isArray(pageTerreni.colture) ? pageTerreni.colture : [];
  const poderiList = Array.isArray(pageTerreni.poderi) ? pageTerreni.poderi : [];
  const tableItems =
    ctx.page && ctx.page.currentTableData && Array.isArray(ctx.page.currentTableData.items)
      ? ctx.page.currentTableData.items
      : [];
  const poderiFromTable = tableItems.map((it) => it.podere).filter(Boolean);

  const msgNorm = normalizeItTony(message);
  const fields = {};
  const coltura = inferColtura(message, coltureList);
  const podere = pickNameFromList(msgNorm, poderiList) || pickNameFromList(msgNorm, poderiFromTable);
  const superficie = extractSuperficieHa(message);
  const nome = inferTerrenoNome(message, coltura, podere);

  if (nome) fields["terreno-nome"] = nome;
  if (superficie) fields["terreno-superficie"] = superficie;
  if (podere) fields["terreno-podere"] = podere;
  if (coltura) fields["terreno-coltura"] = coltura;
  if (/\baffitt\w*\b/.test(msgNorm)) {
    fields["terreno-tipo-possesso"] = "affitto";
  } else if (/\bpropriet\w*\b/.test(msgNorm) || Object.keys(fields).length > 0) {
    fields["terreno-tipo-possesso"] = "proprieta";
  }
  if (/\bcollin\w*\b/.test(msgNorm)) fields["terreno-tipo-campo"] = "collina";
  else if (/\bmontagn\w*\b/.test(msgNorm)) fields["terreno-tipo-campo"] = "montagna";
  else if (/\bpianur\w*\b/.test(msgNorm)) fields["terreno-tipo-campo"] = "pianura";

  const fieldsCount = Object.keys(fields).length;
  const text =
    fieldsCount > 1
      ? "Apro il form e compilo i dati che ho capito."
      : fieldsCount === 1
        ? "Apro il form e compilo un campo; dimmi il resto se serve."
        : "Apro il form. Come vuoi chiamare il terreno?";

  return {
    id: "terreno_entity",
    text,
    command: {
      type: "OPEN_MODAL",
      id: "terreno-modal",
      fields,
    },
    earlyReturn: true,
    fieldsCount,
  };
}

module.exports = {
  tryTonyTerrenoEntityParse,
  isTerrenoCreationIntent,
  isOnTerreniPage,
};
