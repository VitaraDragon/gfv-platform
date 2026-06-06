/**
 * Normalizza alias CF/modello INJECT/SUBMIT → comandi canone client (Segna ore workspace).
 * Mirror di core/js/tony/engine.js normalizeTonyCommand (solo alias campo ore).
 */

function isQuickHoursTarget(target) {
  if (target == null || target === "") return false;
  const s = String(target).trim().toLowerCase();
  return (
    s === "quick-hours-form" ||
    s === "field-workspace-ore-form" ||
    s === "ora-form" ||
    s.indexOf("quick-hours") >= 0
  );
}

function mapQuickHoursFormDataKeys(formData) {
  if (!formData || typeof formData !== "object" || Array.isArray(formData)) return formData;
  const out = { ...formData };
  if (out["ora-start"] != null && out["ora-inizio"] == null) out["ora-inizio"] = out["ora-start"];
  if (out["ora-end"] != null && out["ora-fine"] == null) out["ora-fine"] = out["ora-end"];
  if (out["ora-break"] != null && out["ora-pause"] == null) out["ora-pause"] = out["ora-break"];
  if (out["attivita-orario-inizio"] && !out["ora-inizio"]) out["ora-inizio"] = out["attivita-orario-inizio"];
  if (out["attivita-orario-fine"] && !out["ora-fine"]) out["ora-fine"] = out["attivita-orario-fine"];
  if (out["attivita-pause"] != null && out["ora-pause"] == null) out["ora-pause"] = out["attivita-pause"];
  if (out["attivita-data"] && !out["ora-data"]) out["ora-data"] = out["attivita-data"];
  return out;
}

/**
 * @param {object|null|undefined} result — { text, command }
 * @returns {object}
 */
function normalizeFieldWorkspaceTonyResult(result) {
  if (!result || typeof result !== "object") return result || { text: "Ok." };
  const out = { ...result };
  if (!out.command || typeof out.command !== "object") return out;

  const c = { ...out.command };
  if (c.type) c.type = String(c.type).toUpperCase();

  if (c.type === "INJECT") {
    const injTarget = c.target || c.formId || c.id || c.modalId;
    const injPayload = c.parameters || c.params || c.formData || c.fields || c.fieldValues;
    c.type = "INJECT_FORM_DATA";
    if (isQuickHoursTarget(injTarget)) {
      c.formId = "field-workspace-ore-form";
    } else if (injTarget) {
      c.formId = String(injTarget).trim();
    }
    if (injPayload && typeof injPayload === "object" && !Array.isArray(injPayload)) {
      c.formData = mapQuickHoursFormDataKeys(injPayload);
    }
    delete c.target;
    delete c.parameters;
  }

  if (c.type === "SUBMIT") {
    const subTarget = c.target || c.formId || c.id;
    if (isQuickHoursTarget(subTarget) || !subTarget) {
      c.type = "QUICK_SAVE";
      c.formId = "field-workspace-ore-form";
    } else {
      c.type = "SUBMIT_FORM";
      c.formId = String(subTarget).trim();
    }
    delete c.target;
  }

  if (c.type === "INJECT_FORM_DATA") {
    if (!c.formId && isQuickHoursTarget(c.target)) c.formId = "field-workspace-ore-form";
    const fd = c.formData || c.fields || c.fieldValues || c.parameters || c.params;
    if (fd && typeof fd === "object" && !Array.isArray(fd)) {
      c.formData = mapQuickHoursFormDataKeys(fd);
    }
  }

  if (c.type === "QUICK_SAVE" || c.type === "SUBMIT_FORM") {
    if (!c.formId && isQuickHoursTarget(c.target)) c.formId = "field-workspace-ore-form";
  }

  out.command = c;
  return out;
}

module.exports = {
  normalizeFieldWorkspaceTonyResult,
  isQuickHoursTarget,
  mapQuickHoursFormDataKeys,
};
