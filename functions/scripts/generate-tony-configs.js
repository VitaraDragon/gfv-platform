#!/usr/bin/env node
"use strict";

/**
 * Genera functions/config/tony-*.json da catalogo moduli/bundle (allineato a subscription-plans.js).
 * Uso (da functions/): node scripts/generate-tony-configs.js
 */

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const BUNDLE_LABELS = {
  "vigneto-operativo": "Viticoltore Operativo",
  "operativo-vigneto": "Viticoltore Campo",
  "frutteto-operativo": "Frutteto Operativo",
  "frutticoltore-campo": "Frutticoltore Campo",
  "conto-terzi-operativo": "Servizi Conto Terzi",
  "business-completo": "Business Conto Terzi",
  "operativo-completo": "Operativo Completo",
  "coltura-meteo": "Colture e Meteo",
  "gfv-completo": "GFV Completo",
};

const RECOMMENDATIONS = {
  skipModuleIds: ["tony"],
  modules: [
    {
      id: "vigneto",
      label: "Vigneto",
      available: true,
      triggers: [
        { type: "categoryShare", category: "Vite", minCount: 3, minShare: 0.4, weight: 85 },
      ],
      complements: {
        magazzino: "per scarichi da trattamenti e concimazioni in vigna",
      },
    },
    {
      id: "frutteto",
      label: "Frutteto",
      available: true,
      triggers: [
        { type: "categoryShare", category: "Frutteto", minCount: 2, minShare: 0.35, weight: 82 },
        { type: "categoryShare", category: "Frutta", minCount: 2, minShare: 0.35, weight: 82 },
      ],
      complements: {
        magazzino: "per tracciare prodotti e scarichi da trattamenti",
      },
    },
    {
      id: "contoTerzi",
      label: "Conto Terzi",
      available: true,
      triggers: [
        { type: "clientiMin", min: 1, weight: 80 },
        { type: "terreniClientiMin", min: 1, weight: 78 },
        { type: "preventiviMin", min: 1, weight: 76 },
      ],
      complements: {
        manodopera: "per ore squadra sui lavori dei clienti",
        report: "per sintesi costi e margini sui servizi",
        vendemmiaMeccanica: "per vendemmia meccanizzata e calcolo compenso CT",
      },
    },
    {
      id: "vendemmiaMeccanica",
      label: "Vendemmia Meccanica",
      available: true,
      triggers: [{ type: "terreniClientiMin", min: 3, weight: 74 }],
      complements: {},
    },
    {
      id: "manodopera",
      label: "Manodopera",
      available: true,
      triggers: [
        { type: "terreniMin", min: 5, weight: 70 },
        { type: "lavoriClientiMin", min: 5, weight: 72 },
      ],
      complements: {
        parcoMacchine: "per collegare macchine e lavori in campo",
      },
    },
    {
      id: "parcoMacchine",
      label: "Parco Macchine",
      available: true,
      triggers: [
        { type: "macchineMin", min: 1, weight: 78 },
        { type: "meccanicoHint", weight: 74 },
        { type: "guastiMin", min: 1, weight: 76 },
      ],
      complements: {
        report: "per costi macchina e manutenzioni nei report",
      },
    },
    {
      id: "magazzino",
      label: "Prodotti e Magazzino",
      available: true,
      triggers: [
        { type: "trattamentiHint", weight: 75 },
        { type: "prodottiMin", min: 1, weight: 70 },
      ],
      complements: {},
    },
    {
      id: "report",
      label: "Report/Bilancio",
      available: true,
      triggers: [{ type: "lavoriClientiMin", min: 10, weight: 65 }],
      complements: {},
    },
    {
      id: "meteo",
      label: "Meteo",
      available: true,
      triggers: [{ type: "terreniMin", min: 4, weight: 60 }],
      complements: {},
    },
    {
      id: "tony",
      label: "Tony Avanzato",
      available: true,
      triggers: [],
      complements: {},
    },
  ],
};

async function main() {
  const plansPath = path.join(__dirname, "..", "..", "core", "config", "subscription-plans.js");
  const { BUNDLES, AVAILABLE_MODULES } = await import(pathToFileURL(plansPath).href);
  const moduleMonthlyPrices = Object.fromEntries(
    AVAILABLE_MODULES.filter((m) => m.available).map((m) => [m.id, m.price])
  );
  const bundleEntries = BUNDLES.map((bundle) => ({
    id: bundle.id,
    label: BUNDLE_LABELS[bundle.id] || bundle.name || bundle.id,
    modules: bundle.modules,
    monthlyPrice: bundle.price,
  }));

  const bundlesCatalog = {
    moduleMonthlyPrices,
    bundles: bundleEntries,
  };

  const targets = [
    path.join(__dirname, "..", "config", "tony-bundles-catalog.json"),
    path.join(__dirname, "..", "..", "core", "config", "tony-bundles-catalog.json"),
    path.join(__dirname, "..", "config", "tony-module-recommendations.json"),
    path.join(__dirname, "..", "..", "core", "config", "tony-module-recommendations.json"),
  ];

  for (const target of targets) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const payload =
      target.includes("tony-bundles-catalog")
        ? bundlesCatalog
        : RECOMMENDATIONS;
    fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  console.log("Generated:");
  targets.forEach((p) => console.log(`  ${p}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
