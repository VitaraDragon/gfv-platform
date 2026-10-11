/**
 * Validazione del payload di registraAccettazioniLegali.
 * Nessun Firebase. L'uid lo mette il chiamante, da request.auth.
 */

const TIPI = ["termini-b2b", "privacy", "dpa", "informativa-lavoratori"];
const DOCUMENTI_REGISTRAZIONE = ["termini-b2b", "privacy", "dpa"];
const DOCUMENTI_INVITO = ["informativa-lavoratori"];
const RUOLI_INVITO = ["operaio", "caposquadra", "manager"];
const VERSION_RE = /^(termini-b2b|privacy|dpa|informativa-lavoratori)-(\d{4})-(\d{2})-(\d{2})$/;

function versioneValida(tipo, versione) {
  if (typeof versione !== "string") return false;
  const match = VERSION_RE.exec(versione);
  if (!match || match[1] !== tipo) return false;
  if (match[2] === "0000" && match[3] === "00" && match[4] === "00") return false;
  const anno = Number(match[2]);
  const mese = Number(match[3]);
  const giorno = Number(match[4]);
  if (mese < 1 || mese > 12 || giorno < 1) return false;
  const data = new Date(Date.UTC(anno, mese - 1, giorno));
  return data.getUTCFullYear() === anno
    && data.getUTCMonth() === mese - 1
    && data.getUTCDate() === giorno;
}

function fallisce(code, error) {
  return { ok: false, code: code, error: error };
}

/**
 * @param {object} data
 * @returns {{ ok: boolean, code?: string, error?: string, azione?: string, canale?: string, tenantId?: string, ruolo?: string, righe?: Array<{tipo: string, versione: string, versioneTestoCasella: string}> }}
 */
function validaPayloadAccettazione(data) {
  const src = data && typeof data === "object" ? data : {};
  const azione = src.azione;
  if (azione !== "registra" && azione !== "stato") {
    return fallisce("invalid-argument", "Azione non valida.");
  }
  if (azione === "stato") return { ok: true, azione: "stato" };

  const canale = src.canale;
  if (canale !== "registrazione" && canale !== "invito") {
    return fallisce("invalid-argument", "Canale non valido.");
  }
  if (typeof src.tenantId !== "string" || !src.tenantId.trim()) {
    return fallisce("invalid-argument", "Azienda mancante.");
  }
  if (typeof src.ruolo !== "string" || !src.ruolo.trim()) {
    return fallisce("invalid-argument", "Ruolo non valido.");
  }
  if (!Array.isArray(src.documenti) || src.documenti.length === 0) {
    return fallisce("failed-precondition", "Manca un documento accettato.");
  }

  const righe = [];
  const visti = new Set();
  for (let i = 0; i < src.documenti.length; i++) {
    const doc = src.documenti[i];
    if (!doc || typeof doc !== "object") {
      return fallisce("invalid-argument", "Documento non valido.");
    }
    const tipo = doc.tipo;
    if (TIPI.indexOf(tipo) < 0) {
      return fallisce("invalid-argument", "Tipo documento non ammesso.");
    }
    if (!versioneValida(tipo, doc.versione)) {
      return fallisce("invalid-argument", "Versione documento non valida.");
    }
    if (typeof doc.versioneTestoCasella !== "string" || !doc.versioneTestoCasella.trim() || doc.versioneTestoCasella.length > 80) {
      return fallisce("invalid-argument", "Versione casella non valida.");
    }
    if (visti.has(tipo)) {
      return fallisce("invalid-argument", "Documento ripetuto.");
    }
    visti.add(tipo);
    righe.push({
      tipo: tipo,
      versione: doc.versione,
      versioneTestoCasella: doc.versioneTestoCasella.trim()
    });
  }

  if (canale === "invito") {
    if (righe.length !== 1 || righe[0].tipo !== "informativa-lavoratori") {
      return fallisce("failed-precondition", "Da invito si registra solo l'informativa lavoratori.");
    }
  } else {
    const tipi = righe.map(function (riga) { return riga.tipo; }).sort();
    const voluti = DOCUMENTI_REGISTRAZIONE.slice().sort();
    if (tipi.length !== voluti.length || tipi.some(function (tipo, indice) { return tipo !== voluti[indice]; })) {
      return fallisce("failed-precondition", "Mancano termini, privacy o DPA.");
    }
  }

  return {
    ok: true,
    azione: "registra",
    canale: canale,
    tenantId: src.tenantId.trim(),
    ruolo: src.ruolo.trim(),
    righe: righe
  };
}

function idAccettazione(uid, tipo, versione) {
  return uid + "_" + tipo + "_" + versione;
}

module.exports = {
  validaPayloadAccettazione,
  idAccettazione,
  DOCUMENTI_REGISTRAZIONE,
  DOCUMENTI_INVITO,
  RUOLI_INVITO
};
