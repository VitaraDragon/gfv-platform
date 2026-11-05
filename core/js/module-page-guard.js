/**
 * Guard condiviso per pagine di modulo: usa i moduli effettivi
 * (pagati + prove + bundle) e mostra un messaggio chiaro invece di un redirect silenzioso.
 * @module core/js/module-page-guard
 */

import { getModuleConfig } from '../config/subscription-plans.js';
import { hasModuleAccessFromTenant } from '../utils/module-access-resolver.js';

const DEFAULT_LABELS = {
  magazzino: 'Magazzino',
  parcoMacchine: 'Parco Macchine',
  contoTerzi: 'Conto Terzi',
  vigneto: 'Vigneto',
  frutteto: 'Frutteto',
  seminativo: 'Seminativo',
  manodopera: 'Manodopera',
  meteo: 'Meteo',
  report: 'Report',
  tony: 'Tony Avanzato',
  vendemmiaMeccanica: 'Vendemmia Meccanica',
};

/**
 * @param {string} moduleId
 * @returns {string}
 */
export function nomeModuloLeggibile(moduleId) {
  const cfg = getModuleConfig(moduleId);
  if (cfg && cfg.name) return cfg.name;
  return DEFAULT_LABELS[moduleId] || String(moduleId || 'modulo');
}

/**
 * @param {string} [fromPath]
 * @returns {string}
 */
export function hrefAbbonamentoDaPagina(fromPath) {
  const path = String(fromPath || (typeof location !== 'undefined' ? location.pathname : '') || '');
  if (path.includes('/modules/')) return '../../../core/admin/abbonamento-standalone.html';
  if (path.includes('/core/admin/')) return 'abbonamento-standalone.html';
  if (path.includes('/core/')) return 'admin/abbonamento-standalone.html';
  return 'core/admin/abbonamento-standalone.html';
}

/**
 * @param {string} moduleId
 * @param {{ abbonamentoHref?: string }} [options]
 * @returns {string}
 */
export function messaggioModuloDisattivo(moduleId, options = {}) {
  const nome = nomeModuloLeggibile(moduleId);
  return `Il modulo ${nome} non è attivo. Puoi riattivarlo da Abbonamento.`;
}

/**
 * Sostituisce il body con un banner e il pulsante verso Abbonamento.
 * @param {string} moduleId
 * @param {{ abbonamentoHref?: string, container?: Element|null }} [options]
 */
export function mostraModuloDisattivo(moduleId, options = {}) {
  const nome = nomeModuloLeggibile(moduleId);
  const href = options.abbonamentoHref || hrefAbbonamentoDaPagina();
  const html =
    '<div style="max-width:520px;margin:48px auto;padding:24px;border:1px solid #ffc107;border-radius:10px;background:#fff8e1;font-family:system-ui,sans-serif;text-align:center;">' +
    '<div style="font-size:40px;margin-bottom:12px;">🔒</div>' +
    '<h1 style="font-size:20px;margin:0 0 12px;color:#333;">Modulo non attivo</h1>' +
    '<p style="margin:0 0 20px;color:#555;line-height:1.5;">Il modulo <strong>' +
    escapeHtml(nome) +
    '</strong> non è attivo. Puoi riattivarlo da Abbonamento. I dati già inseriti restano salvati.</p>' +
    '<a href="' +
    escapeHtml(href) +
    '" style="display:inline-block;padding:10px 18px;background:#2E8B57;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Vai ad Abbonamento</a>' +
    '</div>';

  const target = options.container || (typeof document !== 'undefined' ? document.body : null);
  if (target) {
    target.innerHTML = html;
  }
  return { ok: false, message: messaggioModuloDisattivo(moduleId), href };
}

/**
 * @param {object|null|undefined} tenant
 * @param {string} moduleId
 * @param {Date} [now]
 * @returns {boolean}
 */
export function moduloEffettivoAttivo(tenant, moduleId, now = new Date()) {
  return hasModuleAccessFromTenant(tenant, moduleId, now);
}

/**
 * Controlla l'accesso e, se manca, mostra il banner.
 * @param {object|null|undefined} tenant
 * @param {string} moduleId
 * @param {{ abbonamentoHref?: string, container?: Element|null, now?: Date }} [options]
 * @returns {boolean} true se il modulo è effettivo
 */
export function richiediModulo(tenant, moduleId, options = {}) {
  if (moduloEffettivoAttivo(tenant, moduleId, options.now)) {
    return true;
  }
  mostraModuloDisattivo(moduleId, options);
  return false;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
