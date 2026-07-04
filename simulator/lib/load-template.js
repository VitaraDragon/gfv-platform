/**
 * Caricamento template simulatore con merge `extends` e override quantità CLI.
 * @module simulator/lib/load-template
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '../templates');

function deepMerge(base, override) {
  const out = { ...base };
  for (const key of Object.keys(override || {})) {
    const val = override[key];
    if (
      val &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      base[key] &&
      typeof base[key] === 'object' &&
      !Array.isArray(base[key])
    ) {
      out[key] = deepMerge(base[key], val);
    } else {
      out[key] = val;
    }
  }
  return out;
}

/**
 * @param {string} templateId
 * @param {{ quantities?: Record<string, number> }} [overrides]
 */
export function loadTemplate(templateId, overrides = {}) {
  const path = join(TEMPLATES_DIR, `${templateId}.json`);
  let template = JSON.parse(readFileSync(path, 'utf-8'));

  if (template.extends) {
    const parentId = template.extends;
    const parent = loadTemplate(parentId, {});
    template = deepMerge(parent, template);
    delete template.extends;
  }

  if (overrides.quantities && Object.keys(overrides.quantities).length) {
    template.quantities = {
      ...(template.quantities || {}),
      ...overrides.quantities
    };
  }
  if (overrides.manodopera && Object.keys(overrides.manodopera).length) {
    template.manodopera = deepMerge(template.manodopera || {}, overrides.manodopera);
  }
  if (overrides.attivita && Object.keys(overrides.attivita).length) {
    template.attivita = deepMerge(template.attivita || {}, overrides.attivita);
  }

  return template;
}

const QUANTITY_CLI_KEYS = [
  'caposquadra',
  'operai',
  'squadre',
  'lavoriSquadra',
  'lavoriAutonomi',
  'giorniOreSimulate'
];

/**
 * @param {string[]} args — process.argv slice
 * @returns {{ quantities?: Record<string, number> }}
 */
export function parseQuantityOverrides(args) {
  const quantities = {};
  for (const key of QUANTITY_CLI_KEYS) {
    const arg = args.find((a) => a.startsWith(`--${key}=`));
    if (!arg) continue;
    const raw = arg.split('=')[1];
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(`Override non valido: --${key}=${raw}`);
    }
    quantities[key] = n;
  }
  return Object.keys(quantities).length ? { quantities } : {};
}

export function isManodoperaTemplate(template) {
  const moduli = template?.moduli || template?.modules || [];
  return moduli.includes('manodopera');
}

export function isContoTerziTemplate(template) {
  const moduli = template?.moduli || template?.modules || [];
  return moduli.includes('contoTerzi');
}

export function hasVignetoModule(template) {
  const moduli = template?.moduli || template?.modules || [];
  return moduli.includes('vigneto');
}

export function hasFruttetoModule(template) {
  const moduli = template?.moduli || template?.modules || [];
  return moduli.includes('frutteto');
}

/** Solo frutteto (senza vigneto) — compatibilità template esistenti. */
export function isFruttetoTemplate(template) {
  return hasFruttetoModule(template) && !hasVignetoModule(template);
}

/** Vigneto e frutteto entrambi attivi sullo stesso tenant. */
export function isMistoColtureTemplate(template) {
  return hasVignetoModule(template) && hasFruttetoModule(template);
}
