/**
 * Icone a tratto della pelle Proposta.
 * Una forma per modulo (azioni rapide) e per emoji già presente nelle card.
 * Il colore lo mette la pagina (currentColor = accento del modulo).
 * @module core/js/ui-pelle-icons
 */

const PATHS = {
  apple: '<path d="M12 8c-4 .8-6 4-6 7a6 6 0 0 0 12 0c0-3-2-6.2-6-7z"/><path d="M12 8c.2-2 1.6-3.4 3.6-3.8"/>',
  grape: '<circle cx="9" cy="9" r="2"/><circle cx="14" cy="9" r="2"/><circle cx="11.5" cy="13" r="2"/><path d="M12 5c.6 0 1.4.6 1.6 1.6"/>',
  wine: '<path d="M8 3h8l-1 7a3 3 0 0 1-6 0L8 3z"/><path d="M12 13v6"/><path d="M9 21h6"/>',
  box: '<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>',
  map: '<path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z"/><path d="M9 3v15"/><path d="M15 6v15"/>',
  clipboard: '<rect x="7" y="4" width="10" height="16" rx="2"/><path d="M9 4h6v2H9z"/><path d="M9 11h6"/><path d="M9 15h4"/>',
  users: '<circle cx="9" cy="8" r="2.5"/><circle cx="16" cy="9" r="2"/><path d="M4 19c.6-3 2.6-4.5 5-4.5s4.4 1.5 5 4.5"/><path d="M15 14.5c1.8 0 3.2 1 3.8 3"/>',
  tractor: '<circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M4 17H3v-4h7l2-5h5v5h3"/><path d="M14 8V6h3"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .4-8 5 5 0 0 0-9.6-1.5A3.5 3.5 0 0 0 7 18z"/>',
  chart: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15l3-4 3 3 4-6"/>',
  scissors: '<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><path d="M8 7l12 10"/><path d="M8 17L20 7"/>',
  flask: '<path d="M9 3h6"/><path d="M10 3v6L6 20h12l-4-11V3"/>',
  sprout: '<path d="M12 21V11"/><path d="M12 11c0-4 3-6 6-6-1 4-3 6-6 6z"/><path d="M12 13c0-3-2.5-5-5-5 1 3 2.5 5 5 5z"/>',
  ruler: '<path d="M4 16l12-12 4 4L8 20H4v-4z"/><path d="M9 11l2 2"/><path d="M12 8l2 2"/>',
  hash: '<path d="M9 4l-2 16"/><path d="M17 4l-2 16"/><path d="M5 9h15"/><path d="M4 15h15"/>',
  inbox: '<path d="M3 13l3-8h12l3 8"/><path d="M3 13h5l1 3h6l1-3h5v6H3v-6z"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>',
  file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
  globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16"/><path d="M12 4c2.5 2.4 3.5 5 3.5 8s-1 5.6-3.5 8c-2.5-2.4-3.5-5-3.5-8s1-5.6 3.5-8z"/>',
  coins: '<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7"/><path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>',
  pen: '<path d="M4 20l1-4L16 5l3 3L8 19l-4 1z"/><path d="M14 7l3 3"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
  check: '<circle cx="12" cy="12" r="8"/><path d="M8 12l2.5 2.5L16 9"/>',
  wrench: '<path d="M14 6a4 4 0 0 0-5 5L4 16l4 4 5-5a4 4 0 0 0 5-5l-3 3-2-2 3-3z"/>',
  truck: '<path d="M3 7h11v10H3z"/><path d="M14 11h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.5"/><circle cx="17" cy="18" r="1.5"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M4 10h16"/>',
  alert: '<path d="M12 4l8 14H4z"/><path d="M12 10v4"/><path d="M12 16h.01"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/><path d="M8 16h.01"/><path d="M12 16h.01"/><path d="M16 16h.01"/>',
  folder: '<path d="M3 7h6l2 2h10v10H3z"/>',
  user: '<circle cx="12" cy="8" r="3"/><path d="M6 19c1-3 3-4.5 6-4.5s5 1.5 6 4.5"/>',
  home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/>',
  phone: '<rect x="8" y="3" width="8" height="18" rx="2"/><path d="M11 18h2"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/>',
  pin: '<path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z"/><circle cx="12" cy="11" r="1.5"/>',
  card: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>',
  mark: '<circle cx="12" cy="12" r="3"/>'
};

const MODULE_ICON = {
  home: 'home',
  terreni: 'map',
  lavori: 'clipboard',
  vigneto: 'grape',
  frutteto: 'apple',
  manodopera: 'users',
  magazzino: 'box',
  parcoMacchine: 'tractor',
  contoTerzi: 'coins',
  meteo: 'cloud',
  report: 'chart',
  diarioAttivita: 'pen',
  abbonamento: 'card',
  statistiche: 'chart',
  impostazioni: 'wrench'
};

const EMOJI_ICON = {
  '🍎': 'apple',
  '🍇': 'grape',
  '🍷': 'wine',
  '📦': 'box',
  '🗺️': 'map',
  '🗺': 'map',
  '📋': 'clipboard',
  '👥': 'users',
  '🚜': 'tractor',
  '🌦️': 'cloud',
  '🌤': 'cloud',
  '📊': 'chart',
  '✂️': 'scissors',
  '✂': 'scissors',
  '🧪': 'flask',
  '🌱': 'sprout',
  '📐': 'ruler',
  '🔢': 'hash',
  '📥': 'inbox',
  '🔍': 'search',
  '📄': 'file',
  '🌍': 'globe',
  '💰': 'coins',
  '📝': 'pen',
  '🔄': 'refresh',
  '✅': 'check',
  '🛠️': 'wrench',
  '🛠': 'wrench',
  '🔧': 'wrench',
  '🚚': 'truck',
  '📅': 'calendar',
  '⚠️': 'alert',
  '⚠': 'alert',
  '🧮': 'calc',
  '📁': 'folder',
  '👷': 'user',
  '👷‍♂️': 'user',
  '👷‍♀️': 'user',
  '📱': 'phone',
  '⏱️': 'clock',
  '⏱': 'clock',
  '📍': 'pin',
  '💳': 'card'
};

export function iconNameForModule(id) {
  return MODULE_ICON[id] || 'mark';
}

export function iconNameForEmoji(raw) {
  const text = String(raw || '').trim();
  if (EMOJI_ICON[text]) return EMOJI_ICON[text];
  const bare = text.replace(/\uFE0F/g, '');
  if (EMOJI_ICON[bare]) return EMOJI_ICON[bare];
  const base = bare.replace(/\u200D./gu, '');
  if (EMOJI_ICON[base]) return EMOJI_ICON[base];
  return 'mark';
}

export function iconSvg(name) {
  const inner = PATHS[name] || PATHS.mark;
  return (
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    inner +
    '</svg>'
  );
}
