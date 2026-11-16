/**
 * Unica fonte dei testi open data del registro trattamenti.
 * La Cloud Function la legge da qui (in deploy ne viene copiata una .mjs).
 * @module shared/js/registro-trattamenti-fonte
 */

export const URL_LICENZA_IODL = "https://www.dati.gov.it/iodl/2.0/";
export const URL_DATASET_FITOSANITARI = "https://www.dati.salute.gov.it/it/dataset/fitosanitari/";
export const URL_BANCA_FITOSANITARI = "https://fitosanitari.salute.gov.it/";

/** Frase senza data. La data del CSV si aggiunge con testoAttribuzioneOpenData. */
export const FONTE_OPEN_DATA_FITOSANITARI = "Contiene dati del Ministero della Salute – Banca dati prodotti fitosanitari (Open Data), licenza IODL 2.0";

export const AVVISO_ETICHETTA_FA_FEDE = "Verifica sempre l'etichetta autorizzata: è quella che fa fede.";

/**
 * Valori reali di stato_amministrativo nel CSV PROD_FTS_6_20261116 (16/11/2026).
 * In commercio: Autorizzato* , Ri-registrato* , Rinnovato*.
 * Fuori commercio: Revocato, Scaduto, Sospeso.
 * @returns {"autorizzato"|"revocato"|"scaduto"|"sospeso"|"non_verificato"}
 */
export function classificaStatoAmministrativo(stato) {
  const s = String(stato == null ? "" : stato).replace(/\s+/g, " ").trim().toLowerCase();
  if (!s) return "non_verificato";
  if (s.startsWith("revoc")) return "revocato";
  if (s.startsWith("scadut")) return "scaduto";
  if (s.startsWith("sospes")) return "sospeso";
  if (s.startsWith("autorizz") || s.startsWith("ri-registr") || s.startsWith("ri registr") || s.startsWith("rinnov")) {
    return "autorizzato";
  }
  return "non_verificato";
}

export function dataLetturaItaliana(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return m[3] + "/" + m[2] + "/" + m[1];
}

export function testoAttribuzioneOpenData(iso) {
  const data = dataLetturaItaliana(iso);
  return FONTE_OPEN_DATA_FITOSANITARI + (data ? " — aggiornati al " + data : "");
}

function escTesto(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Stessa frase, con i link alla licenza e al dataset. */
export function htmlAttribuzioneOpenData(iso) {
  const data = dataLetturaItaliana(iso);
  const quando = data ? " — aggiornati al " + escTesto(data) : "";
  return "Contiene dati del Ministero della Salute – "
    + '<a href="' + URL_DATASET_FITOSANITARI + '" target="_blank" rel="noopener noreferrer">Banca dati prodotti fitosanitari</a>'
    + ' (Open Data), licenza <a href="' + URL_LICENZA_IODL + '" target="_blank" rel="noopener noreferrer">IODL 2.0</a>'
    + quando;
}
