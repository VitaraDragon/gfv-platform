#!/usr/bin/env node
"use strict";

/**
 * Crea prodotti/prezzi annuali Stripe (test) da catalogo GFV.
 * Uso (da functions/): node scripts/sync-stripe-catalog.js
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const Stripe = require("stripe");

/** Catalogo allineato a core/config/subscription-plans.js */
const CATALOG = [
  { id: "base", type: "plan", name: "GFV Piano Base", description: "Piano Base GFV — fatturazione annuale", monthly: 5 },
  { id: "manodopera", type: "module", name: "GFV Modulo Manodopera", description: "Gestione squadre, operai e lavori", monthly: 6 },
  { id: "parcoMacchine", type: "module", name: "GFV Modulo Parco Macchine", description: "Macchine, manutenzioni e scadenze", monthly: 3 },
  { id: "contoTerzi", type: "module", name: "GFV Modulo Conto Terzi", description: "Clienti e lavori conto terzi", monthly: 6 },
  { id: "vigneto", type: "module", name: "GFV Modulo Vigneto", description: "Gestione vigneti e vendemmia", monthly: 3 },
  { id: "frutteto", type: "module", name: "GFV Modulo Frutteto", description: "Gestione frutteti e raccolta", monthly: 3 },
  { id: "magazzino", type: "module", name: "GFV Modulo Magazzino", description: "Prodotti, giacenze e movimenti", monthly: 3 },
  { id: "tony", type: "module", name: "GFV Tony Avanzato", description: "Assistente IA operativo", monthly: 5 },
  { id: "report", type: "module", name: "GFV Modulo Report", description: "Report e sintesi aziendali", monthly: 5 },
  { id: "meteo", type: "module", name: "GFV Modulo Meteo", description: "Meteo sede e terreni", monthly: 1 },
  { id: "vigneto-operativo", type: "bundle", name: "GFV Bundle Viticoltore Operativo", description: "Vigneto + Manodopera + Magazzino", monthly: 10 },
  { id: "operativo-vigneto", type: "bundle", name: "GFV Bundle Viticoltore Campo", description: "Vigneto + Manodopera + Parco Macchine", monthly: 10 },
  { id: "frutteto-operativo", type: "bundle", name: "GFV Bundle Frutteto Operativo", description: "Frutteto + Manodopera + Magazzino", monthly: 10 },
  { id: "frutticoltore-campo", type: "bundle", name: "GFV Bundle Frutticoltore Campo", description: "Frutteto + Manodopera + Parco Macchine", monthly: 10 },
  { id: "conto-terzi-operativo", type: "bundle", name: "GFV Bundle Servizi Conto Terzi", description: "Conto Terzi + Manodopera + Report", monthly: 14 },
  { id: "business-completo", type: "bundle", name: "GFV Bundle Business Conto Terzi", description: "Conto Terzi + Report", monthly: 9 },
  { id: "operativo-completo", type: "bundle", name: "GFV Bundle Operativo Completo", description: "Manodopera + Parco Macchine + Report", monthly: 12 },
  { id: "coltura-meteo", type: "bundle", name: "GFV Bundle Colture e Meteo", description: "Vigneto + Frutteto + Meteo", monthly: 6 },
  { id: "gfv-completo", type: "bundle", name: "GFV Bundle Completo", description: "Tutti i moduli disponibili", monthly: 30 },
];

function loadStripeKey() {
  const fromEnv = (process.env.STRIPE_SECRET_KEY || "").trim();
  if (fromEnv) return fromEnv;
  return execSync(
    "gcloud secrets versions access latest --secret=STRIPE_SECRET_KEY --project=gfv-platform",
    { encoding: "utf8" }
  ).trim();
}

function annualCents(monthly) {
  return Math.round(Number(monthly) * 12 * 100);
}

async function main() {
  const stripe = new Stripe(loadStripeKey());
  const pricesPath = path.join(__dirname, "..", "config", "stripe-prices.json");
  const catalog = JSON.parse(fs.readFileSync(pricesPath, "utf8"));
  if (!catalog.test) catalog.test = {};

  let created = 0;
  let skipped = 0;

  for (const item of CATALOG) {
    if (catalog.test[item.id]) {
      console.log(`skip ${item.id} → ${catalog.test[item.id]}`);
      skipped += 1;
      continue;
    }

    const product = await stripe.products.create({
      name: item.name,
      description: item.description,
      metadata: {
        gfvId: item.id,
        gfvType: item.type,
        gfvEnv: "test",
      },
    });

    const price = await stripe.prices.create({
      product: product.id,
      currency: "eur",
      unit_amount: annualCents(item.monthly),
      recurring: { interval: "year" },
      metadata: {
        gfvId: item.id,
        gfvType: item.type,
        gfvMonthlyReference: String(item.monthly),
      },
    });

    catalog.test[item.id] = price.id;
    console.log(`created ${item.id} → ${price.id} (€${item.monthly}/mese · €${item.monthly * 12}/anno)`);
    created += 1;
  }

  fs.writeFileSync(pricesPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  console.log(`\nDone. created=${created} skipped=${skipped}`);
  console.log(`Updated ${pricesPath}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
