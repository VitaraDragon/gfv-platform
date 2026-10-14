/**
 * Lettura dell'etichetta autorizzata. Gemini vede il PDF.
 * Una riga entra solo se due letture, dopo la normalizzazione, coincidono.
 */
const { righeConfermate } = require("./etichetta-confronto");

const ISTRUZIONI = [
  "Leggi solo questo PDF, l'etichetta autorizzata del Ministero della Salute.",
  "Non usare altre conoscenze sul prodotto. Non inventare numeri.",
  "Per ogni coltura compila i campi. La dose è il minimo e il massimo scritti in etichetta, mai una dose consigliata. Il volume d'acqua non è la dose.",
  "Se in quella riga due dosi non si possono attribuire, o se non è chiaro se un numero è dose a ettaro, dose a ettolitro, carenza, massimo interventi o intervallo, ometti la coltura.",
  "Serra: pienoCampo false solo se quella riga dice serra e non dice pieno campo.",
  "Se la stessa riga nomina più colture con gli stessi numeri, ripeti la riga una volta per coltura.",
  "unitaHa e unitaHl sono solo kg, g, l o ml."
].join(" ");

const SCHEMA_NUMERO = { type: "NUMBER", nullable: true };
const SCHEMA_UNITA = { type: "STRING", nullable: true, enum: ["kg", "g", "l", "ml"] };
const SCHEMA_RIGA = {
  type: "OBJECT",
  properties: {
    coltura: { type: "STRING" },
    avversita: { type: "STRING" },
    pienoCampo: { type: "BOOLEAN" },
    epoca: { type: "STRING", nullable: true },
    doseMinHa: SCHEMA_NUMERO,
    doseMaxHa: SCHEMA_NUMERO,
    unitaHa: SCHEMA_UNITA,
    doseMinHl: SCHEMA_NUMERO,
    doseMaxHl: SCHEMA_NUMERO,
    unitaHl: SCHEMA_UNITA,
    giorniCarenza: SCHEMA_NUMERO,
    giorniCarenzaSerra: SCHEMA_NUMERO,
    impieghiMassimiAnno: SCHEMA_NUMERO,
    giorniMinimiTraPassaggi: SCHEMA_NUMERO
  },
  required: ["coltura", "avversita", "pienoCampo"]
};

const SCHEMA = {
  type: "OBJECT",
  properties: {
    righe: { type: "ARRAY", items: SCHEMA_RIGA }
  },
  required: ["righe"]
};

function testo(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function parseJsonRighe(risposta) {
  const raw = testo(String(risposta || "").replace(/```json|```/gi, ""));
  const da = raw.indexOf("{");
  const a = raw.lastIndexOf("}");
  if (da < 0 || a <= da) return null;
  try {
    const data = JSON.parse(raw.slice(da, a + 1));
    return Array.isArray(data.righe) ? data.righe : null;
  } catch (err) {
    return null;
  }
}

function istruzioniConferma(righe) {
  const elenco = righe.map((riga) => (riga.coltura || riga.colturaScheda) + " — " + (riga.avversita || "")).join("; ");
  return ISTRUZIONI + " Conferma solo queste colture, rileggendo il PDF, e ometti quelle per cui il numero non ha un ruolo chiaro: " + elenco;
}

async function leggiPagineEtichetta(pdfBuffer, chiedi) {
  if (!pdfBuffer || !pdfBuffer.length) {
    return { stato: "da_verificare", motivo: "testo_non_leggibile", righe: [] };
  }
  let prima;
  let seconda;
  try {
    prima = parseJsonRighe(await chiedi(ISTRUZIONI, pdfBuffer));
  } catch (err) {
    return { stato: "da_riprovare", motivo: "scheda_non_letta", righe: [] };
  }
  if (!prima) return { stato: "da_riprovare", motivo: "scheda_non_letta", righe: [] };
  if (!righeConfermate(prima, prima).length) {
    return { stato: "da_verificare", motivo: "estrazione_incerta", righe: [] };
  }
  try {
    seconda = parseJsonRighe(await chiedi(istruzioniConferma(prima), pdfBuffer));
  } catch (err) {
    return { stato: "da_riprovare", motivo: "scheda_non_letta", righe: [] };
  }
  if (!seconda) return { stato: "da_riprovare", motivo: "scheda_non_letta", righe: [] };
  const righe = righeConfermate(prima, seconda);
  if (!righe.length) return { stato: "da_verificare", motivo: "estrazione_incerta", righe: [] };
  return { stato: "pronta", motivo: null, righe };
}

async function chiediGeminiEtichetta(prompt, pdfBuffer) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("manca_chiave");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "application/pdf", data: Buffer.from(pdfBuffer).toString("base64") } }
        ]
      }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 16384,
        responseMimeType: "application/json",
        responseSchema: SCHEMA
      }
    })
  });
  if (!res.ok) throw new Error("gemini_" + res.status);
  const data = await res.json();
  const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
  return Array.isArray(parts) ? parts.map((part) => part.text || "").join("") : "";
}

module.exports = {
  ISTRUZIONI,
  SCHEMA,
  parseJsonRighe,
  leggiPagineEtichetta,
  chiediGeminiEtichetta
};
