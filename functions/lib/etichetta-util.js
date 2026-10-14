function testo(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function numero(value) {
  if (value == null || value === "") return null;
  const n = parseFloat(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function normalizza(value) {
  return testo(value).toLowerCase();
}

module.exports = { testo, numero, normalizza };
