const fs = require("fs");
const path = require("path");
const { normalizzaRiga, normalizzaUnita, partiAvversita } = require("../functions/lib/etichetta-normalizza");
const { righeConfermate } = require("../functions/lib/etichetta-confronto");
const { parseJsonRighe, leggiPagineEtichetta } = require("../functions/lib/etichetta-gemini");

function fixture(nome) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "etichette-gemini", nome), "utf8"));
}

describe("normalizzazione e confronto", () => {
  it("uniforma virgola, unità e articoli dell'avversità", () => {
    const a = normalizzaRiga({
      coltura: "Melo",
      avversita: "ticchiolatura (Venturia inaequalis), alternaria",
      pienoCampo: true,
      doseMinHa: "0,5",
      doseMaxHa: "1",
      unitaHa: "L/ha",
      giorniCarenza: "60"
    });
    const b = normalizzaRiga({
      coltura: "melo",
      avversita: "ticchiolatura e dell'alternaria",
      pienoCampo: true,
      doseMinHa: 0.5,
      doseMaxHa: 1,
      unitaHa: "l",
      giorniCarenza: 60
    });
    expect(a).toEqual(b);
    expect(normalizzaUnita("ml/hl", "ha")).toBe("ml/hl");
    expect(partiAvversita("dell'alternaria e della maculatura bruna")).toEqual(["alternaria", "maculatura bruna"]);
  });

  it("dalle due letture di Luna Privilege archivia le cinque colture", () => {
    const righe = righeConfermate(fixture("luna-privilege-1.json").righe, fixture("luna-privilege-2.json").righe);
    expect(righe.map((riga) => riga.colturaScheda)).toEqual(["albicocco", "ciliegio", "pesco", "nettarine", "susino"]);
    expect(righe.every((riga) => riga.doseMinHa === 0.5 && riga.unitaDoseHa === "l" && riga.giorniCarenza === 3)).toBe(true);
  });

  it("dalle due letture di Banjo archivia le sette colture concordi", () => {
    const righe = righeConfermate(fixture("banjo-1.json").righe, fixture("banjo-2.json").righe);
    expect(righe.map((riga) => riga.colturaScheda)).toEqual([
      "melo", "cotogno", "nespolo giapponese ed europeo", "pero", "nashi", "vite", "patata"
    ]);
    expect(righe.find((riga) => riga.colturaScheda === "melo").doseMinHl).toBe(70);
    expect(righe.find((riga) => riga.colturaScheda === "patata").doseMinHa).toBe(0.3);
  });

  it("Closer resta da riprovare perché la risposta è tagliata", async () => {
    const testo = fixture("closer-1.json").testo;
    expect(parseJsonRighe(testo)).toBeNull();
    const esito = await leggiPagineEtichetta(Buffer.from("pdf"), async () => testo);
    expect(esito.stato).toBe("da_riprovare");
    expect(esito.righe).toEqual([]);
  });
});
