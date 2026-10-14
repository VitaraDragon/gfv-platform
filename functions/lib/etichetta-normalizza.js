/**
 * Porta due letture della stessa etichetta nella stessa forma,
 * prima del confronto. Funzione pura: niente rete.
 */
const { coltureIn } = require("./etichetta-colture");

function testo(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function normalizzaNumero(value) {
  if (value == null || value === "") return null;
  const n = parseFloat(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function normalizzaColtura(nome) {
  const pulito = testo(nome).toLowerCase();
  if (!pulito) return "";
  const trovate = coltureIn(pulito);
  if (trovate.length === 1 && trovate[0] === pulito) return trovate[0];
  if (trovate.length === 1 && pulito.split(" ").length === 1) return trovate[0];
  return pulito;
}

function partiAvversita(value) {
  let t = testo(value).toLowerCase();
  t = t.replace(/\([^)]*\)/g, " ");
  t = t.replace(/\bdell['’]/g, "");
  t = t.replace(/\b(della|dello|dei|degli|delle|del)\s+/g, "");
  t = t.replace(/\bed\s+/g, ", ");
  t = t.replace(/\be\s+/g, ", ");
  const parti = t.split(/[,;/]/).map((parte) => parte.replace(/[^a-zà-ÿ0-9 ]/g, "").replace(/\s+/g, " ").trim()).filter((parte) => parte.length > 2);
  return [...new Set(parti)].sort();
}

function siglaUnita(value) {
  const u = testo(value).toLowerCase().replace(/\s+/g, "");
  const mappa = {
    kg: "kg", k: "kg", g: "g", l: "l", lt: "l", ml: "ml",
    chilogrammi: "kg", chilogrammo: "kg",
    grammi: "g", grammo: "g",
    litri: "l", litro: "l",
    millilitri: "ml", millilitro: "ml"
  };
  return mappa[u] || null;
}

function normalizzaUnita(unita, per) {
  const grezza = testo(unita).toLowerCase().replace(/\s+/g, "");
  if (!grezza) return null;
  if (grezza.includes("/")) {
    const pezzi = grezza.split("/");
    const base = siglaUnita(pezzi[0]);
    const destino = pezzi[1] === "ettaro" ? "ha" : pezzi[1] === "ettolitro" ? "hl" : pezzi[1];
    if (!base || (destino !== "ha" && destino !== "hl")) return null;
    return base + "/" + destino;
  }
  const base = siglaUnita(grezza);
  if (!base || (per !== "ha" && per !== "hl")) return null;
  return base + "/" + per;
}

function coppiaDose(min, max) {
  const a = normalizzaNumero(min);
  const b = normalizzaNumero(max);
  if (a == null && b == null) return { min: null, max: null };
  if (a != null && b == null) return { min: a, max: a };
  if (a == null) return { min: null, max: b };
  return { min: a, max: b };
}

function normalizzaRiga(raw) {
  if (!raw || typeof raw !== "object") return null;
  const coltura = normalizzaColtura(raw.coltura || raw.colturaScheda);
  const avversita = partiAvversita(raw.avversita || raw.avversità);
  if (!coltura || !avversita.length) return null;
  const ha = coppiaDose(raw.doseMinHa, raw.doseMaxHa);
  const hl = coppiaDose(raw.doseMinHl, raw.doseMaxHl);
  const unitaHa = ha.min == null && ha.max == null ? null : normalizzaUnita(raw.unitaHa || raw.unitaDoseHa, "ha");
  const unitaHl = hl.min == null && hl.max == null ? null : normalizzaUnita(raw.unitaHl || raw.unitaDoseHl, "hl");
  if ((ha.min != null || ha.max != null) && !unitaHa) return null;
  if ((hl.min != null || hl.max != null) && !unitaHl) return null;
  if (!unitaHa && !unitaHl) return null;
  const pienoCampo = !(raw.pienoCampo === false || raw.pienoCampo === "false");
  return {
    coltura,
    avversita,
    pienoCampo,
    doseMinHa: ha.min,
    doseMaxHa: ha.max,
    unitaHa,
    doseMinHl: hl.min,
    doseMaxHl: hl.max,
    unitaHl,
    giorniCarenza: normalizzaNumero(raw.giorniCarenza),
    giorniCarenzaSerra: normalizzaNumero(raw.giorniCarenzaSerra),
    impieghiMassimiAnno: normalizzaNumero(raw.impieghiMassimiAnno),
    giorniMinimiTraPassaggi: normalizzaNumero(raw.giorniMinimiTraPassaggi)
  };
}

module.exports = {
  normalizzaNumero,
  normalizzaColtura,
  normalizzaUnita,
  partiAvversita,
  normalizzaRiga
};
