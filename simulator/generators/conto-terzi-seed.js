/**
 * Generator seed Conto Terzi (clienti, poderi, terreni clienti, tariffe, preventivi).
 * @module simulator/generators/conto-terzi-seed
 */

import { pick } from './nomi-italiani.js';

const RAGIONI_SOCIALI = ['Az. Agr.', 'Soc. Agricola', 'Tenuta', 'Azienda Vitivinicola', 'Coop. Agricola'];
const COGNIOMI_AZIENDA = ['Rossi', 'Bianchi', 'Marini', 'Ferrari', 'Verdi', 'Colombo'];
const CITTA = ['Verona', 'Treviso', 'Padova', 'Mantova', 'Bologna', 'Reggio Emilia'];
const PROVINCE = ['VR', 'TV', 'PD', 'MN', 'BO', 'RE'];
const TIPI_LAVORO_TARIFFA = ['Potatura', 'Erpicatura', 'Trattamento', 'Aratura', 'Concimazione'];
const MORFOLOGIE = ['pianura', 'collina', 'montagna'];
const TERRENI_NOMI = ['Le Coste', 'Ronco del Sole', 'Vigna Alta', 'Poggio Verde', 'Collina Sud', 'Valle Tranquilla'];

const PREVENTIVI_STATI_DEFAULT = ['bozza', 'inviato', 'accettato_manager', 'accettato_email', 'rifiutato'];

export function generaPartitaIva(seed, index) {
  const n = Math.abs((seed * 7919 + index * 104729) % 90000000000) + 10000000000;
  return String(n).padStart(11, '0').slice(-11);
}

/**
 * @param {number} count
 * @param {number} seed
 */
export function generaClienti(count, seed = 0) {
  return Array.from({ length: count }, (_, i) => {
    const cognome = pick(COGNIOMI_AZIENDA, seed + i * 3);
    const citta = pick(CITTA, seed + i);
    const prov = pick(PROVINCE, seed + i + 1);
    return {
      ragioneSociale: `${pick(RAGIONI_SOCIALI, seed + i)} ${cognome} S.r.l.`,
      partitaIva: generaPartitaIva(seed, i),
      indirizzo: `Via dei Vigneti ${10 + i}`,
      citta,
      cap: String(37000 + (i % 50)).padStart(5, '0'),
      provincia: prov,
      telefono: `+39 045 ${1000000 + seed + i}`.slice(0, 16),
      email: `cliente${i + 1}.sim@contoterzi.local`,
      note: 'Cliente simulato — GFV Farm Simulator',
      stato: i === count - 1 && count > 2 ? 'sospeso' : 'attivo',
      totaleLavori: 0
    };
  });
}

/**
 * @param {Array<{ id: string, ragioneSociale: string }>} clienti
 * @param {number} count — un podere per cliente (max clienti.length)
 * @param {number} seed
 */
export function generaPoderiClienti(clienti, count, seed = 0) {
  const n = Math.min(count, clienti.length);
  return Array.from({ length: n }, (_, i) => {
    const cliente = clienti[i % clienti.length];
    const citta = pick(CITTA, seed + i + 5);
    return {
      clienteId: cliente.id,
      nome: `Podere ${cliente.ragioneSociale.split(' ').slice(-2, -1)[0] || 'Cliente'} ${i + 1}`,
      indirizzo: `Strada Provinciale ${20 + i}`,
      localita: citta,
      cap: String(37000 + i).padStart(5, '0'),
      coordinate: { lat: 45.5 + i * 0.02, lng: 11.9 + i * 0.02 },
      note: 'Podere cliente simulato'
    };
  });
}

/**
 * @param {Array} poderi — con id, clienteId, nome
 * @param {number} count
 * @param {number} seed
 */
export function generaTerreniClienti(poderi, count, seed = 0) {
  if (!poderi.length) return [];
  return Array.from({ length: count }, (_, i) => {
    const podere = poderi[i % poderi.length];
    const lat = 45.45 + i * 0.008;
    const lng = 11.85 + i * 0.008;
    const delta = 0.0012;
    return {
      clienteId: podere.clienteId,
      nome: pick(TERRENI_NOMI, seed + i),
      superficie: 1.2 + (i % 5) * 0.6,
      coltura: 'Vite da Vino',
      podere: podere.nome,
      tipoCampo: pick(MORFOLOGIE, seed + i),
      tipoPossesso: 'affitto',
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

/**
 * @param {number} count
 * @param {number} seed
 */
export function generaTariffe(count, seed = 0) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const tipoLavoro = pick(TIPI_LAVORO_TARIFFA, seed + i);
    const tipoCampo = pick(MORFOLOGIE, seed + i + 2);
    const colturaSpecifica = i % 3 !== 0 ? 'Vite da Vino' : '';
    out.push({
      tipoLavoro,
      coltura: colturaSpecifica,
      categoriaColturaId: null,
      tipoCampo,
      tariffaBase: 120 + (i % 4) * 45,
      coefficiente: tipoCampo === 'montagna' ? 1.25 : tipoCampo === 'collina' ? 1.1 : 1,
      note: colturaSpecifica ? 'Tariffa specifica vite' : 'Tariffa generica categoria',
      attiva: i !== count - 1
    });
  }
  return out;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * @param {object} opts
 * @param {Array} opts.clienti
 * @param {Array} opts.terreniClienti — con id, superficie, tipoCampo, coltura
 * @param {Array} opts.tariffe
 * @param {number} opts.count
 * @param {number} opts.seed
 * @param {string[]} [opts.stati]
 * @param {number} [opts.iva=22]
 * @param {number} [opts.giorniScadenza=30]
 */
export function generaPreventivi(opts) {
  const {
    clienti,
    terreniClienti,
    tariffe,
    count,
    seed,
    stati = PREVENTIVI_STATI_DEFAULT,
    iva = 22,
    giorniScadenza = 30
  } = opts;

  if (!clienti?.length || !terreniClienti?.length || !tariffe?.length) {
    return [];
  }

  const year = new Date().getFullYear();
  const oggi = new Date();
  oggi.setHours(12, 0, 0, 0);

  return Array.from({ length: count }, (_, i) => {
    const cliente = clienti[i % clienti.length];
    const terreno = terreniClienti[i % terreniClienti.length];
    const tariffa = tariffe.find(
      (t) =>
        t.tipoCampo === terreno.tipoCampo &&
        (t.coltura === terreno.coltura || t.coltura === '')
    ) || tariffe[i % tariffe.length];
    const stato = stati[i % stati.length];
    const totale = parseFloat(
      (terreno.superficie * tariffa.tariffaBase * tariffa.coefficiente).toFixed(2)
    );
    const dataPrevista = addDays(oggi, 7 + i * 3);
    const dataScadenza = addDays(oggi, giorniScadenza + i);
    const numero = `PREV-${year}-${String(i + 1).padStart(3, '0')}`;

    const doc = {
      numero,
      clienteId: cliente.id,
      terrenoId: terreno.id,
      tipoLavoro: tariffa.tipoLavoro,
      coltura: terreno.coltura,
      tipoCampo: terreno.tipoCampo,
      superficie: terreno.superficie,
      macchinaId: null,
      dataPrevista,
      stato,
      totale,
      iva,
      totaleConIva: parseFloat((totale * (1 + iva / 100)).toFixed(2)),
      note: `Preventivo simulato — ${tariffa.tipoLavoro}`,
      giorniScadenza,
      dataScadenza,
      tokenAccettazione: null,
      dataInvio: null,
      dataAccettazione: null,
      lavoroId: null
    };

    if (stato === 'inviato' || stato === 'accettato_email' || stato === 'accettato_manager') {
      doc.dataInvio = addDays(oggi, -5 + i);
      doc.tokenAccettazione = `simtok_${seed}_${i}_${Date.now().toString(36)}`;
    }
    if (stato === 'accettato_email' || stato === 'accettato_manager') {
      doc.dataAccettazione = addDays(oggi, -2 + i);
    }

    return doc;
  });
}

export { PREVENTIVI_STATI_DEFAULT };
