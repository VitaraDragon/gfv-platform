const { normalizza } = require("./etichetta-util");

const FORME_COLTURA = [
  ["vite da vino", ["vite da vino", "uva da vino"]],
  ["vite da tavola", ["vite da tavola", "uva da tavola"]],
  ["vite", ["vite"]],
  ["erba medica", ["erba medica"]],
  ["grano saraceno", ["grano saraceno"]],
  ["olivo", ["oliveti", "oliveto", "ulivi", "ulivo", "olive", "olivo"]],
  ["limone", ["limoneti", "limoneto", "limoni", "limone"]],
  ["agrumi", ["agrumi"]],
  ["frumento", ["frumento", "grano tenero", "grano duro", "grano"]],
  ["melo", ["mele", "melo"]],
  ["pesco", ["pesche", "pesco"]],
  ["pero", ["pere", "pero"]],
  ["albicocco", ["albicocco"]],
  ["ciliegio", ["ciliegie", "ciliegio"]],
  ["susino", ["susine", "susino"]],
  ["actinidia", ["actinidia", "kiwi"]],
  ["fico", ["fico"]],
  ["nocciolo", ["nocciolo"]],
  ["castagno", ["castagno"]],
  ["mandorlo", ["mandorle", "mandorlo"]],
  ["arancio", ["arance", "arancio"]],
  ["mandarino", ["mandarini", "mandarino"]],
  ["clementine", ["clementine", "clementino"]],
  ["kaki", ["kaki"]],
  ["noce", ["noci", "noce"]],
  ["pistacchio", ["pistacchio"]],
  ["nettarine", ["nettarine", "nettarina", "nettarino"]],
  ["fragola", ["fragola"]],
  ["cetriolo", ["cetrioli", "cetriolo"]],
  ["cetriolino", ["cetriolino"]],
  ["zucchino", ["zucchine", "zucchino", "zucchini"]],
  ["melone", ["meloni", "melone"]],
  ["cocomero", ["cocomeri", "cocomero", "anguria", "angurie"]],
  ["zucca", ["zucca"]],
  ["pomodoro", ["pomodoro"]],
  ["melanzana", ["melanzana"]],
  ["peperone", ["peperone"]],
  ["lauroceraso", ["lauroceraso"]],
  ["rosa", ["rosa"]],
  ["garofano", ["garofano"]],
  ["lattuga", ["lattughe", "lattuga"]],
  ["tabacco", ["tabacco"]],
  ["mora", ["mora"]],
  ["lampone", ["lampone"]],
  ["aglio", ["aglio"]],
  ["cipolla", ["cipolle", "cipolla"]],
  ["scalogno", ["scalogno"]],
  ["finocchio", ["finocchio"]],
  ["patata", ["patate", "patata"]],
  ["carota", ["carote", "carota"]],
  ["sedano", ["sedano"]],
  ["asparago", ["asparago"]],
  ["cavolfiore", ["cavolfiori", "cavolfiore"]],
  ["broccoli", ["broccoli"]],
  ["prezzemolo", ["prezzemolo"]],
  ["indivia", ["indivia"]],
  ["radicchio", ["radicchio"]],
  ["scarola", ["scarola"]],
  ["barbabietola", ["barbabietola da zucchero", "barbabietola"]],
  ["spinacio", ["spinaci", "spinacio"]],
  ["bietola", ["bietole", "bietola"]],
  ["carciofo", ["carciofo"]],
  ["porro", ["porro"]],
  ["fagiolo", ["fagioli", "fagiolo"]],
  ["pisello", ["piselli", "pisello"]],
  ["fagiolino", ["fagiolino"]],
  ["valerianella", ["valerianella"]],
  ["mais", ["mais"]],
  ["orzo", ["orzo"]],
  ["favino", ["favino"]],
  ["girasole", ["girasole"]],
  ["soia", ["soia"]],
  ["colza", ["colza"]],
  ["avena", ["avena"]],
  ["segale", ["segale"]],
  ["fava", ["fava"]],
  ["lenticchia", ["lenticchie", "lenticchia"]],
  ["cece", ["cece"]],
  ["lupino", ["lupino"]],
  ["cicerchia", ["cicerchia"]],
  ["riso", ["riso"]],
  ["amaranto", ["amaranto"]],
  ["quinoa", ["quinoa"]],
  ["canapa", ["canapa"]],
  ["lino", ["lino"]],
  ["carthamo", ["carthamo"]],
  ["trifoglio", ["trifoglio"]],
  ["veccia", ["veccia"]],
  ["lupinella", ["lupinella"]],
  ["sorgo", ["sorgo"]],
  ["miglio", ["miglio"]],
  ["panico", ["panico"]]
];

function posizioniColtura(frammento) {
  const basso = normalizza(frammento);
  const punti = [];
  FORME_COLTURA.forEach(([canon, forme]) => {
    forme.forEach((forma) => {
      const re = new RegExp("(^|[^a-zà-ÿ])(" + forma.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")(?![a-zà-ÿ])", "g");
      let match = re.exec(basso);
      while (match) {
        const at = match.index + match[1].length;
        if (forma === "ciliegio" && /^ dolce/.test(basso.slice(at + forma.length))) {
          match = re.exec(basso);
          continue;
        }
        const prima = basso.slice(Math.max(0, at - 12), at);
        if (/(?:del|della|dello|dei|degli|delle)\s+$/.test(prima)) {
          match = re.exec(basso);
          continue;
        }
        punti.push({ canon, at, fine: at + forma.length });
        match = re.exec(basso);
      }
    });
  });
  punti.sort((a, b) => a.at - b.at || b.fine - b.at - (a.fine - a.at));
  const tenuti = [];
  punti.forEach((p) => {
    if (tenuti.some((t) => p.at < t.fine && p.fine > t.at)) return;
    tenuti.push(p);
  });
  return tenuti;
}

function coltureIn(frammento) {
  const out = [];
  posizioniColtura(frammento).forEach((p) => {
    if (!out.includes(p.canon)) out.push(p.canon);
  });
  return out;
}

module.exports = { FORME_COLTURA, coltureIn, posizioniColtura };
