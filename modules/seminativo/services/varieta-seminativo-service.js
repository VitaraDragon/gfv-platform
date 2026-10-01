/**
 * Varietà per coltura Seminativo.
 * Elenco predefinito + aggiunte del browser (localStorage), come le varietà del Frutteto.
 * @module modules/seminativo/services/varieta-seminativo-service
 */

/** @type {Record<string, string[]>} */
export const VARIETA_PREDEFINITE_PER_COLTURA = {
  Grano: [
    'Bologna', 'Rebelde', 'Solehio', 'Aubusson', 'Blasco', 'Mieti', 'Bolero', 'Altamira', 'Giorgione',
    'Svevo', 'Marco Aurelio', 'Iride', 'Saragolla', 'Claudio', 'Anco Marzio', 'Tirex', 'Normanno', 'Levante', 'Achille'
  ],
  Mais: [
    'Nostrano dell\'Isola', 'Marano', 'Ottofile', 'Biancoperla', 'Sponcio',
    'PR31Y43', 'P1547', 'DKC6980', 'DKC6092', 'SY Hydro', 'Kontigos', 'LG30.600'
  ],
  Orzo: ['Cometa', 'Ketos', 'Alastro', 'Concerto', 'Explorer', 'Sunshine', 'Overture', 'Tepee', 'Flanelle', 'Prestige'],
  Favino: ['Prothabat 69', 'Irena', 'Scuro di Torre Lama', 'Chiaro di Torre Lama', 'Vesuvio', 'Sicania', 'Castel'],
  Girasole: ['Mas 83.R', 'NK Ferti', 'SY Experto', 'LG56.04', 'P64LE25', 'Inosun', 'Klarika', 'Pacific'],
  Soia: ['PR91M10', 'Bahia', 'Hiroko', 'Namai', 'PR92B63', 'Demetra', 'Goriziana', 'Nikko'],
  Colza: ['DK Exception', 'PT256', 'Architect', 'SY Alister', 'ES Hydromel', 'INV1165'],
  Avena: ['Argentina', 'Prevision', 'Genziana', 'Fulvia', 'Novella Antonia', 'Teo'],
  Segale: ['Dukato', 'Conduct', 'SU Forsetti', 'Protector'],
  Fava: ['Aguadulce', 'Reina Mora', 'Histal', 'Muchamiel', 'Extra Precoce'],
  Lenticchia: [
    'Lenticchia di Altamura', 'Lenticchia di Castelluccio', 'Lenticchia di Onano',
    'Lenticchia di Ustica', 'Lenticchia di Villalba', 'Eston', 'Laird'
  ],
  Cece: ['Sultano', 'Pascià', 'Reale', 'Principe', 'Califfo', 'Sarah'],
  Lupino: ['Multitalia', 'Luxor', 'Polo', 'Lumen'],
  Cicerchia: ['Marchigiana', 'di Serra de\' Conti', 'di Campodimele'],
  Riso: ['Carnaroli', 'Arborio', 'Vialone Nano', 'Roma', 'Baldo', 'Sant\'Andrea', 'Volano', 'Selenio', 'Gloria', 'Venere', 'Originario', 'Balilla'],
  'Grano Saraceno': ['Bamby', 'Lileja', 'Zita', 'Darja'],
  Amaranto: ['Oscar Blanco', 'Plainsman', 'K-432'],
  Quinoa: ['Titicaca', 'Puno', 'Vikinga', 'Regalona', 'Pasto'],
  Canapa: ['Futura 75', 'Felina 32', 'Uso 31', 'Carmagnola', 'Fibranova', 'Eletta Campana', 'Fedora 17'],
  Lino: ['Solal', 'Festival', 'Niagara', 'Princess'],
  Carthamo: ['Benno', 'Montola 2000', 'KAS 301'],
  'Erba Medica': ['Gea', 'Equipe', 'La Torre', 'Delta', 'Gamma', 'Emiliana', 'Garisenda'],
  Trifoglio: ['Rajah', 'Merviot', 'Start', 'Aberherald', 'Altaswede', 'Violetto', 'Alessandrino', 'Incarnato'],
  Veccia: ['Villana', 'Marianna', 'Topaze', 'Nacre', 'Caterina'],
  Lupinella: ['Perly', 'Fakir', 'Visnovsky', 'Emyr'],
  Sulla: ['Sparacia', 'Bellante', 'Grimaldi', 'Sant\'Andrea'],
  Sorgo: ['PR88Y20', 'Arsenio', 'Kalatur', 'Biomass 133', 'Sweet Caroline', 'SF8'],
  Miglio: ['White French', 'Tamara', 'Kornberger', 'Jagna'],
  Panico: ['White Wonder', 'Pipers', 'Village']
};

const ALIAS_COLTURA = {
  frumento: 'Grano',
  'frumento tenero': 'Grano',
  'frumento duro': 'Grano',
  'grano tenero': 'Grano',
  'grano duro': 'Grano',
  medica: 'Erba Medica',
  'erba medica': 'Erba Medica',
  grano_saraceno: 'Grano Saraceno',
  saraceno: 'Grano Saraceno'
};

function normalizeName(value) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
}

function slug(value) {
  return normalizeName(value).toLowerCase().replace(/\s+/g, '_');
}

export function canonicalColturaNome(nome) {
  const raw = normalizeName(nome);
  if (!raw) return '';
  const key = raw.toLowerCase();
  if (ALIAS_COLTURA[key]) return ALIAS_COLTURA[key];
  const found = Object.keys(VARIETA_PREDEFINITE_PER_COLTURA).find((entry) => entry.toLowerCase() === key);
  return found || raw;
}

export function storageKeyForColtura(nome) {
  const canon = canonicalColturaNome(nome);
  return canon ? `seminativo_varieta_${slug(canon)}` : '';
}

function readStore(storage) {
  if (storage) return storage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

export function getVarietaPersonalizzate(colturaNome, storage) {
  const key = storageKeyForColtura(colturaNome);
  const store = readStore(storage);
  if (!key || !store) return [];
  try {
    const parsed = JSON.parse(store.getItem(key) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeName).filter(Boolean);
  } catch {
    return [];
  }
}

export function mergeVarieta(predefinite, personalizzate) {
  const seen = new Set();
  const out = [];
  [...(predefinite || []), ...(personalizzate || [])].forEach((item) => {
    const name = normalizeName(item);
    if (!name) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(name);
  });
  out.sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));
  return out;
}

export function getVarietaPerColtura(colturaNome, storage) {
  const canon = canonicalColturaNome(colturaNome);
  if (!canon) return [];
  const predefinite = VARIETA_PREDEFINITE_PER_COLTURA[canon] || [];
  return mergeVarieta(predefinite, getVarietaPersonalizzate(canon, storage));
}

export function addVarietaPersonalizzata(colturaNome, varieta, storage) {
  const canon = canonicalColturaNome(colturaNome);
  const name = normalizeName(varieta);
  const store = readStore(storage);
  const key = storageKeyForColtura(canon);
  if (!canon || !name || !store || !key) return false;
  const esistenti = getVarietaPersonalizzate(canon, store);
  if (esistenti.some((item) => item.toLowerCase() === name.toLowerCase())) return true;
  esistenti.push(name);
  store.setItem(key, JSON.stringify(esistenti));
  return true;
}
