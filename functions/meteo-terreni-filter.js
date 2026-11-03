/**
 * Stesso criterio di shared/js/terreno-archivio.js (terreniPerAvvisiMeteo).
 * File CommonJS perché le functions non importano i moduli ESM del client.
 */

function terreniPerAvvisiMeteo(docs) {
  return (Array.isArray(docs) ? docs : []).filter((row) => {
    const data = row && row.data ? row.data : row;
    if (!data || typeof data !== "object") return false;
    if (data.clienteId) return false;
    if (data.stato === "archiviato") return false;
    return true;
  });
}

module.exports = { terreniPerAvvisiMeteo };
