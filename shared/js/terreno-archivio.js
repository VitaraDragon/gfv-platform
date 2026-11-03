/**
 * Stato terreno: attivo (anche se il campo manca) oppure archiviato.
 * Il filtro non usa where('stato') su Firestore: i documenti di oggi non hanno il campo.
 *
 * @module shared/js/terreno-archivio
 */

export const STATI_TERRENO = ['attivo', 'archiviato'];
export const MOTIVI_ARCHIVIAZIONE = ['fine_affitto', 'vendita', 'altro'];

export const MESSAGGIO_VERIFICA_COLLEGAMENTI =
  'Non riesco a controllare i dati collegati, riprova';

const ETICHETTE_COLLEGAMENTI = [
  ['vigneti', 'vigneto', 'vigneti'],
  ['frutteti', 'frutteto', 'frutteti'],
  ['lavori', 'lavoro', 'lavori'],
  ['attivita', 'attività del diario', 'attività del diario'],
  ['campagne', 'campagna seminativo', 'campagne seminativo'],
  ['preventivi', 'preventivo', 'preventivi'],
  ['pianoStagione', 'voce nel piano stagione', 'voci nel piano stagione']
];

/**
 * Stato assente → attivo. Stato esplicito non valido → errore.
 * @param {string|null|undefined} stato
 * @returns {'attivo'|'archiviato'}
 */
export function normalizzaStatoTerreno(stato) {
  if (stato == null || stato === '') return 'attivo';
  if (!STATI_TERRENO.includes(stato)) {
    throw new Error('Stato terreno non valido. Stati validi: attivo, archiviato');
  }
  return stato;
}

export function isTerrenoArchiviato(terreno) {
  return !!(terreno && terreno.stato === 'archiviato');
}

/**
 * Nome da mostrare nello storico. I terreni archiviati hanno il suffisso.
 * @param {object|null|undefined} terreno
 * @param {string} [fallback]
 */
export function nomeTerrenoPerStorico(terreno, fallback = '-') {
  if (!terreno) return fallback;
  const base = String(terreno.nome || '').trim();
  if (!base) return fallback;
  return isTerrenoArchiviato(terreno) ? `${base} (archiviato)` : base;
}

export function terreniOperativi(lista) {
  return (Array.isArray(lista) ? lista : []).filter((t) => !isTerrenoArchiviato(t));
}

export function haCollegamenti(collegamenti) {
  if (!collegamenti || typeof collegamenti !== 'object') return false;
  return ETICHETTE_COLLEGAMENTI.some(([key]) => Number(collegamenti[key]) > 0);
}

export function riepilogoCollegamenti(collegamenti) {
  const parti = [];
  for (const [key, singolare, plurale] of ETICHETTE_COLLEGAMENTI) {
    const n = Number(collegamenti && collegamenti[key]) || 0;
    if (n <= 0) continue;
    parti.push(`${n} ${n === 1 ? singolare : plurale}`);
  }
  return parti.join(', ');
}

function formattaDataBreve(value) {
  if (!value) return '';
  const data = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(data.getTime())) return '';
  const g = String(data.getDate()).padStart(2, '0');
  const m = String(data.getMonth() + 1).padStart(2, '0');
  return `${g}/${m}`;
}

export function testoLavoriAperti(lavoriAperti) {
  const lista = Array.isArray(lavoriAperti) ? lavoriAperti : [];
  if (!lista.length) return '';
  const voci = lista.map((lavoro) => {
    const nome = lavoro.nome || 'Lavoro senza nome';
    const quando = formattaDataBreve(lavoro.dataInizio);
    return quando ? `«${nome}» (dal ${quando})` : `«${nome}»`;
  });
  return `Archiviando il terreno, anche questi lavori diventano in sola lettura: ${voci.join(', ')}. Se ti servono ancora, completali prima.`;
}

/**
 * @param {{ ok?: boolean, nome?: string, collegamenti?: object }} verifica
 */
export function decidiAzioneTerreno(verifica) {
  if (!verifica || verifica.ok === false) {
    return { azione: 'errore', messaggio: MESSAGGIO_VERIFICA_COLLEGAMENTI };
  }
  const nome = verifica.nome || 'questo terreno';
  const collegamenti = verifica.collegamenti || {};
  if (!haCollegamenti(collegamenti)) {
    return {
      azione: 'elimina',
      messaggio: `Sei sicuro di voler eliminare il terreno «${nome}»?`
    };
  }
  const elenco = riepilogoCollegamenti(collegamenti);
  const lavori = testoLavoriAperti(collegamenti.lavoriAperti);
  const messaggio = [
    `Sul terreno «${nome}» ci sono ${elenco}.`,
    'Il terreno esce da elenchi, tendine e conteggi. Lavori, ore, vigneti, potature e trattamenti restano consultabili con il suo nome. Puoi ripristinarlo quando vuoi.',
    'Anche i vigneti e i frutteti ancora aperti si chiudono: lo storico resta.',
    lavori
  ].filter(Boolean).join('\n\n');
  return { azione: 'archivia', messaggio };
}

export function motivoDaScelta(scelta) {
  const testo = String(scelta || '').trim().toLowerCase();
  if (testo === '1' || testo === 'fine_affitto' || testo === 'fine affitto') return 'fine_affitto';
  if (testo === '2' || testo === 'vendita') return 'vendita';
  if (testo === '3' || testo === 'altro') return 'altro';
  return null;
}

/**
 * Terreni aziendali ancora nel meteo e nei conteggi. Gli archiviati restano fuori.
 * @param {Array<{ data?: object }|object>} docs
 */
export function terreniPerAvvisiMeteo(docs) {
  return (Array.isArray(docs) ? docs : []).filter((row) => {
    const data = row && row.data ? row.data : row;
    if (!data || typeof data !== 'object') return false;
    if (data.clienteId) return false;
    if (data.stato === 'archiviato') return false;
    return true;
  });
}

export function contaPianoStagione(vendemmiaMeccanica) {
  if (!vendemmiaMeccanica || typeof vendemmiaMeccanica !== 'object') return 0;
  const presenti = Object.values(vendemmiaMeccanica).filter((anno) => anno && anno.inPiano);
  return presenti.length > 0 ? presenti.length : 0;
}
