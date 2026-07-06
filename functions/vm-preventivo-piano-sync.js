/**
 * Server-side: preventivo VM accettato → inPiano su terreno (piano stagione).
 * @module functions/vm-preventivo-piano-sync
 */

const VM_TIPO_KEYWORDS = [
  "vendemmia meccanica",
  "vendemmia meccanizzata",
  "vendemmia meccanizzata ct",
  "vendemmia meccanica ct",
];

function isTipoLavoroVendemmiaMeccanica(tipoLavoro) {
  const tipo = String(tipoLavoro || "").toLowerCase().trim();
  if (!tipo) return false;
  if (VM_TIPO_KEYWORDS.some((k) => tipo.includes(k))) return true;
  return tipo.includes("vendemmia") && tipo.includes("meccan");
}

function deriveAnnoStagioneFromPreventivo(preventivo) {
  const raw = preventivo?.dataPrevista;
  if (raw && typeof raw.toDate === "function") {
    const d = raw.toDate();
    if (d instanceof Date && !Number.isNaN(d.getTime())) return String(d.getFullYear());
  }
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return String(raw.getFullYear());
  if (typeof raw === "string" && raw.length >= 4) {
    const y = Number(raw.slice(0, 4));
    if (Number.isFinite(y) && y >= 2000 && y <= 2100) return String(y);
  }
  return String(new Date().getFullYear());
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} tenantId
 * @param {Object} preventivo
 * @returns {Promise<{ synced: boolean, terrenoIds?: string[], anno?: string }>}
 */
async function syncPreventivoAccettatoToPianoAdmin(db, tenantId, preventivo) {
  if (!isTipoLavoroVendemmiaMeccanica(preventivo?.tipoLavoro)) {
    return { synced: false };
  }

  const tenantSnap = await db.doc(`tenants/${tenantId}`).get();
  const modules = tenantSnap.exists ? tenantSnap.data()?.modules || [] : [];
  if (!modules.includes("vendemmiaMeccanica")) {
    return { synced: false };
  }

  const anno = deriveAnnoStagioneFromPreventivo(preventivo);
  let terrenoIds = [];

  if (preventivo.terrenoId) {
    terrenoIds = [String(preventivo.terrenoId)];
  } else if (preventivo.clienteId) {
    const terreniSnap = await db
      .collection(`tenants/${tenantId}/terreni`)
      .where("clienteId", "==", preventivo.clienteId)
      .get();
    terreniSnap.docs.forEach((docSnap) => {
      const t = docSnap.data() || {};
      const cat = String(t.colturaCategoria || t.colturaSottocategoria || t.coltura || "").toLowerCase();
      const colt = String(t.coltura || t.colturaSottocategoria || "").toLowerCase();
      const isVigneto =
        cat.includes("vite") ||
        cat.includes("vigneto") ||
        colt.includes("vite") ||
        colt.includes("vigneto") ||
        colt.includes("uva");
      if (isVigneto) terrenoIds.push(docSnap.id);
    });
    terrenoIds = [...new Set(terrenoIds)];
  }

  if (!terrenoIds.length) return { synced: false, anno };

  for (const terrenoId of terrenoIds) {
    const ref = db.doc(`tenants/${tenantId}/terreni/${terrenoId}`);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const data = snap.data() || {};
      const vm = { ...(data.vendemmiaMeccanica || {}) };
      const current = { ...(vm[anno] || {}) };
      if (current.inPiano) return;
      vm[anno] = {
        ...current,
        inPiano: true,
        preventivoId: preventivo.id || current.preventivoId || null,
        preventivoNumero: preventivo.numero || current.preventivoNumero || null,
      };
      tx.update(ref, { vendemmiaMeccanica: vm });
    });
  }

  return { synced: true, terrenoIds, anno };
}

module.exports = {
  syncPreventivoAccettatoToPianoAdmin,
  isTipoLavoroVendemmiaMeccanica,
};
