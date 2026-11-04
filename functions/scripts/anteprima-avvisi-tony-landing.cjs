"use strict";

/**
 * Anteprima locale delle email di avviso Tony landing (passo 15).
 * Non importa Firebase, non legge segreti, non manda niente.
 *
 * Uso (dalla radice del repo):
 *   node functions/scripts/anteprima-avvisi-tony-landing.cjs
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  testoEmailSpesa,
  testoEmailBudget
} = require("../lib/tony-landing-avvisi");

const dir = path.join(os.tmpdir(), "gfv-anteprima-avvisi");
fs.mkdirSync(dir, { recursive: true });

const mese = "novembre 2026";
const casi = [
  {
    nome: "50.html",
    mail: testoEmailSpesa({
      soglia: 50,
      spesaMeseEur: 15.1,
      budgetEur: 30,
      domandeMese: 42,
      mese
    })
  },
  {
    nome: "80.html",
    mail: testoEmailSpesa({
      soglia: 80,
      spesaMeseEur: 24.3,
      budgetEur: 30,
      domandeMese: 80,
      mese
    })
  },
  {
    nome: "100.html",
    mail: testoEmailSpesa({
      soglia: 100,
      spesaMeseEur: 30.02,
      budgetEur: 30,
      domandeMese: 100,
      mese,
      spentoAdesso: true
    })
  },
  {
    nome: "100-gia-spento.html",
    mail: testoEmailSpesa({
      soglia: 100,
      spesaMeseEur: 30.02,
      budgetEur: 30,
      domandeMese: 100,
      mese,
      spentoAdesso: false
    })
  },
  {
    nome: "budget-google.html",
    mail: testoEmailBudget({
      costo: 52,
      budget: 50,
      valuta: "EUR",
      mese,
      eraGiaSpento: false
    })
  }
];

console.log("Anteprima avvisi Tony landing → " + dir);
for (const c of casi) {
  const file = path.join(dir, c.nome);
  const html =
    "<!-- " +
    c.mail.oggetto +
    " -->\n" +
    c.mail.html;
  fs.writeFileSync(file, html, "utf8");
  console.log(file);
}
