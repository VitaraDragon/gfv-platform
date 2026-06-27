/**
 * Generator nomi italiani per profili simulati.
 * @module simulator/generators/nomi-italiani
 */

const NOMI = ['Marco', 'Lucia', 'Giuseppe', 'Anna', 'Paolo', 'Elena', 'Andrea', 'Francesca', 'Stefano', 'Chiara'];
const COGNOMI = ['Bianchi', 'Rossi', 'Verdi', 'Ferrari', 'Romano', 'Colombo', 'Ricci', 'Marini', 'Gallo', 'Conti'];
const AZIENDE = ['Az. Agr.', 'Tenuta', 'Azienda Vitivinicola', 'Podere', 'Cascina'];
const TERRENI = ['Le Coste', 'Ronco del Sole', 'Vigna Alta', 'Poggio Verde', 'Collina Sud', 'Valle Tranquilla', 'Il Riposo', 'Monte Olivo'];
const VARIETA = ['Sangiovese', 'Merlot', 'Glera', 'Pinot Grigio', 'Barbera', 'Trebbiano'];
const MARCHE_TRATTORI = ['Same', 'John Deere', 'New Holland', 'Massey Ferguson', 'Fendt'];
const MARCHE_ATTREZZI = ['Maschio', 'Kuhn', 'Amazone', 'Berti', 'Forigo'];
const PRODOTTI = [
  { nome: 'Rame ossicloruro', categoria: 'fitofarmaci' },
  { nome: 'Zolfo bagnabile', categoria: 'fitofarmaci' },
  { nome: 'Concime NPK 15-15-15', categoria: 'fertilizzanti' },
  { nome: 'Olio paraffinico', categoria: 'fitofarmaci' },
  { nome: 'Calcio foliar', categoria: 'fertilizzanti' },
  { nome: 'Rame metallo', categoria: 'fitofarmaci' }
];

function pick(list, index) {
  return list[index % list.length];
}

export { pick };

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * @param {number} [seed=0]
 */
export function generaProfilo(seed = Date.now()) {
  const nome = pick(NOMI, seed);
  const cognome = pick(COGNOMI, seed + 3);
  const aziendaTipo = pick(AZIENDE, seed + 7);
  const aziendaNome = `${aziendaTipo} ${cognome}`;
  const slug = slugify(`${cognome}_${seed}`);

  return {
    nome,
    cognome,
    displayName: `${nome} ${cognome}`,
    aziendaNome,
    slug,
    email: `sim+${slug}@gfv.local`
  };
}

/**
 * Profilo campo (capo/operaio) — nomi italiani distinti dal manager.
 * @param {'caposquadra'|'operaio'} ruolo
 * @param {number} index — 1-based
 * @param {number} seed
 * @param {string} slug — slug azienda sim
 */
export function generaPersonaCampo(ruolo, index, seed, slug) {
  const offset = ruolo === 'caposquadra' ? 100 : 200;
  const nome = pick(NOMI, seed + offset + index * 3);
  const cognome = pick(COGNOMI, seed + offset + index * 5);
  const roleToken = ruolo === 'caposquadra' ? 'capo' : 'op';
  return {
    nome,
    cognome,
    displayName: `${nome} ${cognome}`,
    ruoli: [ruolo],
    email: `sim+${slug}_${roleToken}${index}@gfv.local`
  };
}

export function generaTerreni(count, seed = 0, options = {}) {
  const podere = options.podereNome || 'Podere principale';
  const morfologie = ['collina', 'pianura', 'collina', 'montagna'];
  return Array.from({ length: count }, (_, i) => {
    const lat = 45.4 + i * 0.01;
    const lng = 11.8 + i * 0.01;
    const delta = 0.0015;
    return {
      nome: pick(TERRENI, seed + i),
      superficie: 1.5 + (i % 4) * 0.8,
      coltura: 'Vite da Vino',
      podere,
      tipoCampo: morfologie[i % morfologie.length],
      tipoPossesso: 'proprieta',
      coordinate: { lat, lng },
      polygonCoords: [
        { lat: lat - delta, lng: lng - delta },
        { lat: lat - delta, lng: lng + delta },
        { lat: lat + delta, lng: lng + delta },
        { lat: lat + delta, lng: lng - delta }
      ]
    };
  });
}

export function generaTrattori(count, seed = 0) {
  return Array.from({ length: count }, (_, i) => {
    const marca = pick(MARCHE_TRATTORI, seed + i);
    return {
      nome: `Trattore ${marca} ${80 + i * 15}`,
      tipoMacchina: 'trattore',
      marca,
      modello: `Serie ${600 + i * 10}`,
      cavalli: 80 + i * 15,
      stato: 'disponibile',
      oreIniziali: 1200 + i * 100
    };
  });
}

export function generaAttrezzi(count, seed = 0) {
  const tipi = ['Erpice a denti', 'Irroratrice', 'Trinciatrice', 'Fresatrice', 'Spandiconcime'];
  return Array.from({ length: count }, (_, i) => {
    const marca = pick(MARCHE_ATTREZZI, seed + i);
    const tipo = pick(tipi, seed + i + 2);
    return {
      nome: `${tipo} ${marca}`,
      tipoMacchina: 'attrezzo',
      marca,
      cavalliMinimiRichiesti: 50,
      codiceCategoria: i % 2 === 0 ? 'lavorazione_terreno' : 'trattamenti',
      stato: 'disponibile'
    };
  });
}

const MARCHE_FLOTTA = ['Fiat Professional', 'Ford', 'Iveco', 'Volkswagen', 'Toyota'];
const MODELLI_FURGONE = ['Ducato', 'Transit', 'Daily', 'Caddy'];
const MODELLI_PICKUP = ['Ranger', 'Hilux', 'L200', 'Amarok'];

export function generaFlotta(count, seed = 0) {
  const tipi = ['furgone', 'automezzo', 'veicolo'];
  const nomiFurgone = ['Furgone cantina', 'Furgone officina', 'Furgone uva'];
  const nomiPickup = ['Pickup campo', 'Pickup aziendale'];

  return Array.from({ length: count }, (_, i) => {
    const tipo = tipi[i % tipi.length];
    const marca = pick(MARCHE_FLOTTA, seed + i);
    const targa = `FG${String(100 + i).padStart(3, '0')}${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + ((i + 3) % 26))}`;
    const isFurgone = tipo === 'furgone';
    const modello = isFurgone
      ? pick(MODELLI_FURGONE, seed + i)
      : pick(MODELLI_PICKUP, seed + i + 1);
    const nomeBase = isFurgone ? pick(nomiFurgone, seed + i) : pick(nomiPickup, seed + i);
    return {
      nome: `${nomeBase} ${marca}`,
      tipoMacchina: tipo,
      marca,
      modello,
      targa,
      stato: 'disponibile',
      kmIniziali: 32000 + i * 8500,
      kmAttuali: 32000 + i * 8500,
      note: 'Mezzo aziendale simulato — flotta GFV Farm Simulator'
    };
  });
}

export function generaVigneti(terreni, seed = 0) {
  return terreni.map((t, i) => ({
    terrenoId: t.id,
    terrenoNome: t.nome,
    varieta: pick(VARIETA, seed + i),
    tipoPalo: 'cemento',
    destinazioneUva: 'vino',
    annataImpianto: 2010 + (i % 8),
    densita: 4000,
    formaAllevamento: 'Guyot',
    distanzaFile: 2.5,
    distanzaUnita: 1.0,
    superficieEttari: t.superficie || 2,
    statoImpianto: 'attivo'
  }));
}

export function generaProdotti(count, seed = 0) {
  return Array.from({ length: count }, (_, i) => {
    const base = pick(PRODOTTI, seed + i);
    return {
      nome: base.nome,
      categoria: base.categoria,
      unitaMisura: 'kg',
      scortaMinima: 5,
      prezzoUnitario: 12 + i * 3,
      attivo: true
    };
  });
}

export { slugify };
