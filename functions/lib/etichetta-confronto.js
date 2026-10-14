/**
 * Due letture entrano in archivio solo se, dopo la normalizzazione, sono la stessa riga.
 */
const { normalizzaRiga } = require("./etichetta-normalizza");

const CAMPI = [
  "coltura", "pienoCampo",
  "doseMinHa", "doseMaxHa", "unitaHa",
  "doseMinHl", "doseMaxHl", "unitaHl",
  "giorniCarenza", "giorniCarenzaSerra",
  "impieghiMassimiAnno", "giorniMinimiTraPassaggi"
];

function stessaRiga(a, b) {
  if (!a || !b) return false;
  if (a.avversita.join("|") !== b.avversita.join("|")) return false;
  return CAMPI.every((campo) => a[campo] === b[campo]);
}

function rigaPerArchivio(riga) {
  return {
    colturaScheda: riga.coltura,
    epoca: null,
    avversita: riga.avversita.join(", "),
    pienoCampo: riga.pienoCampo,
    giorniCarenza: riga.giorniCarenza,
    giorniCarenzaSerra: riga.giorniCarenzaSerra,
    doseMinHa: riga.doseMinHa,
    doseMaxHa: riga.doseMaxHa,
    doseMinHl: riga.doseMinHl,
    doseMaxHl: riga.doseMaxHl,
    unitaDose: null,
    unitaDoseHa: riga.unitaHa ? riga.unitaHa.split("/")[0] : null,
    unitaDoseHl: riga.unitaHl ? riga.unitaHl.split("/")[0] : null,
    impieghiMassimiAnno: riga.impieghiMassimiAnno,
    giorniMinimiTraPassaggi: riga.giorniMinimiTraPassaggi,
    affidabilita: "alta"
  };
}

function righeConfermate(prima, seconda) {
  const a = (prima || []).map(normalizzaRiga).filter(Boolean);
  const b = (seconda || []).map(normalizzaRiga).filter(Boolean);
  const usate = new Set();
  const out = [];
  a.forEach((riga) => {
    const indice = b.findIndex((altra, i) => !usate.has(i) && stessaRiga(riga, altra));
    if (indice < 0) return;
    usate.add(indice);
    out.push(rigaPerArchivio(riga));
  });
  return out;
}

module.exports = {
  stessaRiga,
  righeConfermate
};
