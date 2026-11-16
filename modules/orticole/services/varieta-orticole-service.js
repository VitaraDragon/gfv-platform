/**
 * Varietà per coltura Orticole.
 * Elenco predefinito + aggiunte del browser (localStorage), come Frutteto.
 * @module modules/orticole/services/varieta-orticole-service
 */

/** @type {Record<string, string[]>} */
export const VARIETA_PREDEFINITE_PER_COLTURA = {
  Pomodoro: [
    'San Marzano', 'Roma VF', 'Cirio 3', 'UC 82', 'Brigade', 'Hypeel', 'Docet', 'Talent',
    'Cuore di Bue', 'Datterino', 'Ciliegino', 'Pachino', 'Costoluto Genovese', 'Rio Grande'
  ],
  Patate: [
    'Agata', 'Colomba', 'Spunta', 'Monalisa', 'Kennebec', 'Desiree', 'Vivaldi', 'Challenger',
    'Marabel', 'Fontane', 'Asterix', 'Primura'
  ],
  Cipolle: [
    'Dorata di Parma', 'Rossa di Tropea', 'Bianca di Mayama', 'Borettana', 'Ramata di Milano',
    'Musona', 'Stoccarda', 'Texas Early Grano', 'White Lisbon'
  ],
  Aglio: ['Bianco Polesano', 'Rosso di Sulmona', 'Rosso di Nubia', 'Vessalato', 'Aglione della Valdichiana'],
  Zucchine: ['Nero di Milano', 'Romanesco', 'Tondo di Nizza', 'Striato d\'Italia', 'Genovese', 'Alberello'],
  Melanzane: ['Violetta Lunga', 'Black Beauty', 'Palermitana', 'Tonda Bianca', 'Rosa Bianca', 'Prosperosa'],
  Peperoni: ['Quadrato d\'Asti', 'Corno di Toro', 'Lombardo', 'Cayenna', 'California Wonder', 'Friggitello'],
  Insalata: ['Gentile', 'Canasta', 'Iceberg', 'Batavia', 'Romana', 'Foglia di Quercia'],
  Lattuga: ['Cappuccia', 'Romana', 'Gentilina', 'Iceberg', 'Lollo Rossa', 'Batavia'],
  Carote: ['Nantes', 'Flakkee', 'Berlicum', 'Chantenay', 'Parisian Market', 'Purple Haze'],
  Bietole: ['Verde a Costa Argentata', 'Rossa di Chioggia', 'Bright Lights', 'Erbette'],
  Fragole: ['Albion', 'Clery', 'Elsanta', 'Sabrosa', 'Asia', 'Roxana', 'Sabrina'],
  Fagioli: ['Borlotto', 'Cannellino', 'Dell\'occhio', 'Cornetto', 'Lingua di Fuoco', 'Tolosano'],
  Fagiolini: ['Bobis', 'Mangiatutto', 'Nano di Spagna', 'Anellino', 'Saxa'],
  Piselli: ['Telefono', 'Meraviglia d\'Italia', 'Rondo', 'Utrillo', 'Progress 9'],
  Cavolo: ['Cappuccio', 'Verza', 'Nero di Toscana', 'Di Bruxelles', 'Cinese'],
  Broccoli: ['Calabrese', 'Ramoso', 'Romanesco', 'Sessantina'],
  Cavolfiore: ['Di Sicilia', 'Snowball', 'Romanesco', 'Violetto di Catania'],
  Spinaci: ['Gigante d\'Inverno', 'Matador', 'America', 'Viroflay', 'Emilia'],
  Radicchio: ['Rosso di Chioggia', 'Rosso di Treviso', 'Variegato di Castelfranco', 'Di Verona'],
  Finocchi: ['Romanesco', 'Di Firenze', 'Mantovano', 'Tardo'],
  Sedano: ['Verde Pascal', 'Dorato d\'Asti', 'Rapace', 'Golden Self Blanching'],
  Cetrioli: ['Marketer', 'Lungo Verde degli Ortolani', 'Parigino', 'Marketmore'],
  Angurie: ['Crimson Sweet', 'Sugar Baby', 'Asahi Miyako', 'Charleston Gray'],
  Meloni: ['Retato', 'Honeydew', 'Cantalupo', 'Giallo Canaria', 'Piel de Sapo']
};

const ALIAS_COLTURA = {
  pomodori: 'Pomodoro',
  tomato: 'Pomodoro',
  patata: 'Patate',
  cipolla: 'Cipolle',
  zucchina: 'Zucchine',
  zucchino: 'Zucchine',
  melanzana: 'Melanzane',
  peperone: 'Peperoni',
  carota: 'Carote',
  bietola: 'Bietole',
  fragola: 'Fragole',
  fagiolo: 'Fagioli',
  fagiolino: 'Fagiolini',
  pisello: 'Piselli',
  broccolo: 'Broccoli',
  spinacio: 'Spinaci',
  finocchio: 'Finocchi',
  cetriolo: 'Cetrioli',
  anguria: 'Angurie',
  melone: 'Meloni'
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
  return canon ? `orticole_varieta_${slug(canon)}` : '';
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
