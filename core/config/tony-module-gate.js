/**
 * Gate moduli tenant per Tony (client). Mirror di functions/tony-module-gate.js.
 * @module core/config/tony-module-gate
 */

const MODULE_LABELS = {
  magazzino: 'Prodotti e Magazzino',
  contoTerzi: 'Conto Terzi',
  vendemmiaMeccanica: 'Vendemmia Meccanica',
  parcoMacchine: 'Parco Macchine',
  manodopera: 'Manodopera',
  vigneto: 'Vigneto',
  frutteto: 'Frutteto',
  meteo: 'Meteo'
};

const TARGET_REQUIRES_MODULE = {
  'conto terzi': 'contoTerzi',
  contoterzi: 'contoTerzi',
  clienti: 'contoTerzi',
  preventivi: 'contoTerzi',
  tariffe: 'contoTerzi',
  'terreni clienti': 'contoTerzi',
  'mappa clienti': 'contoTerzi',
  'nuovo preventivo': 'contoTerzi',
  'accetta preventivo': 'contoTerzi',
  'vendemmia meccanica': 'vendemmiaMeccanica',
  vendemmiameccanica: 'vendemmiaMeccanica',
  'vendemmia meccanizzata': 'vendemmiaMeccanica',
  magazzino: 'magazzino',
  scorte: 'magazzino',
  prodotti: 'magazzino',
  'anagrafica prodotti': 'magazzino',
  movimenti: 'magazzino',
  'movimenti magazzino': 'magazzino',
  'tracciabilità consumi': 'magazzino',
  'tracciabilita consumi': 'magazzino',
  'consumi magazzino': 'magazzino',
  macchine: 'parcoMacchine',
  parcoMacchine: 'parcoMacchine',
  'parco macchine': 'parcoMacchine',
  trattori: 'parcoMacchine',
  mezzi: 'parcoMacchine',
  scadenze: 'parcoMacchine',
  guasti: 'parcoMacchine',
  lavori: 'manodopera',
  'gestione lavori': 'manodopera',
  'segnatura ore': 'manodopera',
  'workspace campo': 'manodopera',
  comunicazioni: 'manodopera',
  'comunicazioni squadra': 'manodopera',
  'comunicazioni caposquadra': 'manodopera',
  manodopera: 'manodopera',
  vigneto: 'vigneto',
  frutteto: 'frutteto',
  meteo: 'meteo'
};

function normalizeTargetKey(raw) {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[àáâãä]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u');
}

export function hasActiveModule(moduliAttivi, moduleId) {
  if (!moduleId) return true;
  var list = Array.isArray(moduliAttivi) ? moduliAttivi : [];
  var want = String(moduleId).toLowerCase();
  return list.some(function(m) { return String(m).toLowerCase() === want; });
}

export function getModuliAttiviFromTonyContext() {
  try {
    var ctx = window.Tony && window.Tony.context;
    if (!ctx) {
      if (window.__gfvTenantData && Array.isArray(window.__gfvTenantData.modules)) {
        return window.__gfvTenantData.modules;
      }
      return [];
    }
    if (ctx.dashboard && Array.isArray(ctx.dashboard.moduli_attivi)) return ctx.dashboard.moduli_attivi;
    if (ctx.info_azienda && Array.isArray(ctx.info_azienda.moduli_attivi)) return ctx.info_azienda.moduli_attivi;
    if (Array.isArray(ctx.moduli_attivi)) return ctx.moduli_attivi;
    if (window.__gfvTenantData && Array.isArray(window.__gfvTenantData.modules)) return window.__gfvTenantData.modules;
  } catch (e) { /* ignore */ }
  return [];
}

export function moduleLabel(moduleId) {
  return MODULE_LABELS[moduleId] || moduleId || 'modulo';
}

export function moduleInactiveMessage(moduleIds) {
  var ids = Array.isArray(moduleIds) ? moduleIds : [moduleIds];
  var labels = ids.filter(Boolean).map(moduleLabel);
  if (labels.length === 0) {
    return 'Questa funzione richiede un modulo non attivo sul tuo abbonamento. Puoi attivarlo dalla pagina Abbonamento.';
  }
  if (labels.length === 1) {
    return 'Il modulo ' + labels[0] + ' non è attivo sul tuo abbonamento. Attivalo dalla pagina Abbonamento per usare questa funzione.';
  }
  return 'Servono i moduli ' + labels.join(' e ') + ' attivi sul tuo abbonamento. Puoi attivarli dalla pagina Abbonamento.';
}

export function getRequiredModuleForTarget(rawTarget) {
  var t = normalizeTargetKey(rawTarget);
  if (!t) return null;
  if (Object.prototype.hasOwnProperty.call(TARGET_REQUIRES_MODULE, t)) {
    return TARGET_REQUIRES_MODULE[t];
  }
  for (var key in TARGET_REQUIRES_MODULE) {
    if (!Object.prototype.hasOwnProperty.call(TARGET_REQUIRES_MODULE, key)) continue;
    if (key.length >= 4 && t.indexOf(key) !== -1) return TARGET_REQUIRES_MODULE[key];
  }
  return null;
}

export function isApriPaginaTargetAllowed(rawTarget, moduliAttivi) {
  var mod = getRequiredModuleForTarget(rawTarget);
  if (!mod) return true;
  return hasActiveModule(moduliAttivi, mod);
}

export function tonyNotifyModuleInactive(rawTarget, showMessageInChat, speakFn) {
  var mod = getRequiredModuleForTarget(rawTarget);
  var msg = moduleInactiveMessage(mod || []);
  try {
    if (typeof showMessageInChat === 'function') showMessageInChat(msg, 'tony');
  } catch (e) { /* ignore */ }
  try {
    if (typeof speakFn === 'function') speakFn(msg);
    else if (window.Tony && typeof window.Tony.speak === 'function') window.Tony.speak(msg);
  } catch (e2) { /* ignore */ }
}
