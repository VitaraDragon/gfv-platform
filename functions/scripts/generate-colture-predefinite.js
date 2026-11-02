#!/usr/bin/env node
"use strict";

/**
 * Genera functions/config/colture-predefinite.js da core/config/app-catalog-seed-data.js.
 * Uso (dalla radice del repo): node functions/scripts/generate-colture-predefinite.js
 *
 * generaContenuto è pura: il test la chiama senza leggere il file sorgente.
 * La lettura e la scrittura girano solo se questo file è il programma principale.
 */

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

/**
 * Stessa chiave di functions/lib/tony-landing-setup-core.js (chiaveNome):
 * trim, minuscolo, spazi singoli, spazio non separabile e apostrofi tipografici.
 * @param {unknown} valore
 * @returns {string}
 */
function chiaveNome(valore) {
  if (valore == null) return "";
  return String(valore)
    .replace(/\u00A0/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * @param {Array<{ nome?: string, categoriaCodice?: string }>} colture
 * @param {Array<{ nome?: string, codice?: string }>} categorie
 * @returns {string}
 */
function generaContenuto(colture, categorie) {
  if (!Array.isArray(colture) || !Array.isArray(categorie)) {
    throw new Error("Colture e categorie devono essere elenchi: il file non è stato scritto.");
  }

  const visti = new Set();
  const righeColture = [];
  for (let i = 0; i < colture.length; i++) {
    const coltura = colture[i];
    const nome = coltura && typeof coltura.nome === "string" ? coltura.nome : "";
    const chiave = chiaveNome(nome);
    if (!chiave) {
      throw new Error("Coltura senza nome: il file non è stato scritto.");
    }
    if (visti.has(chiave)) {
      throw new Error("Due colture con lo stesso nome (" + nome + "): il file non è stato scritto.");
    }
    visti.add(chiave);
    if (!coltura || typeof coltura.categoriaCodice !== "string" || coltura.categoriaCodice === "") {
      throw new Error("Coltura senza categoria (" + nome + "): il file non è stato scritto.");
    }
    righeColture.push(
      "  Object.freeze({ nome: " + JSON.stringify(nome) + ", categoriaCodice: " + JSON.stringify(coltura.categoriaCodice) + " }),"
    );
  }

  const righeCategorie = [];
  for (let i = 0; i < categorie.length; i++) {
    const categoria = categorie[i];
    if (!categoria || typeof categoria.nome !== "string" || chiaveNome(categoria.nome) === "") {
      throw new Error("Categoria senza nome: il file non è stato scritto.");
    }
    if (typeof categoria.codice !== "string" || categoria.codice === "") {
      throw new Error("Categoria senza codice (" + categoria.nome + "): il file non è stato scritto.");
    }
    righeCategorie.push(
      "  Object.freeze({ nome: " + JSON.stringify(categoria.nome) + ", codice: " + JSON.stringify(categoria.codice) + " }),"
    );
  }

  const linee = [
    '"use strict";',
    "// FILE GENERATO da functions/scripts/generate-colture-predefinite.js: NON modificarlo a mano.",
    "// Fonte unica: core/config/app-catalog-seed-data.js (COLTURE_PREDEFINITE, CATEGORIE_COLTURE_PREDEFINITE).",
    "// Per rigenerarlo, dalla radice del repo: node functions/scripts/generate-colture-predefinite.js",
    "const COLTURE_PREDEFINITE = Object.freeze([",
    ...righeColture,
    "]);",
    "const CATEGORIE_COLTURE_PREDEFINITE = Object.freeze([",
    ...righeCategorie,
    "]);",
    "module.exports = { COLTURE_PREDEFINITE, CATEGORIE_COLTURE_PREDEFINITE };",
    ""
  ];
  return linee.join("\n");
}

async function main() {
  const sorgente = path.join(__dirname, "..", "..", "core", "config", "app-catalog-seed-data.js");
  const destinazione = path.join(__dirname, "..", "config", "colture-predefinite.js");
  const modulo = await import(pathToFileURL(sorgente).href);
  const contenuto = generaContenuto(modulo.COLTURE_PREDEFINITE, modulo.CATEGORIE_COLTURE_PREDEFINITE);
  fs.mkdirSync(path.dirname(destinazione), { recursive: true });
  fs.writeFileSync(destinazione, contenuto, "utf8");
  console.log("Scritto " + destinazione);
  console.log("Colture: " + modulo.COLTURE_PREDEFINITE.length);
  console.log("Categorie: " + modulo.CATEGORIE_COLTURE_PREDEFINITE.length);
}

if (require.main === module) {
  main().catch(function (err) {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { generaContenuto };
