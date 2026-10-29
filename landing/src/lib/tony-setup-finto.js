/**
 * Salvataggio finto della scheda Confermi (solo sviluppo, ?tonysetup=).
 */

/**
 * @param {string} [query]
 * @returns {string | null}
 */
export function parametroTonySetup(query) {
  const testo = String(query ?? '');
  const inizio = testo.indexOf('?');
  let q = inizio >= 0 ? testo.slice(inizio + 1) : testo;
  const hash = q.indexOf('#');
  if (hash >= 0) q = q.slice(0, hash);
  let valore = null;
  try {
    valore = new URLSearchParams(q).get('tonysetup');
  } catch {
    return null;
  }
  if (valore === null || valore === '') return null;
  if (valore === '1') return 'ok';
  const ammessi = [
    'ok',
    'lento',
    'doppio',
    'dati-non-validi',
    'niente-da-salvare',
    'limite-terreni',
    'gia-preparato',
    'troppe-chiamate',
    'senza-azienda',
    'non-autorizzato',
    'non-collegato',
    'rete',
  ];
  if (ammessi.indexOf(valore) >= 0) return valore;
  return 'ok';
}

/**
 * @param {{ scenario?: string, dati?: object, sleepFn?: (ms: number) => Promise<void> }} args
 */
export async function salvaAziendaFinta({ scenario = 'ok', sleepFn } = {}) {
  const sleep =
    typeof sleepFn === 'function'
      ? sleepFn
      : (ms) => new Promise((r) => setTimeout(r, ms));
  const sc = String(scenario || 'ok');

  if (sc === 'lento') await sleep(5000);
  else if (sc === 'ok' || sc === 'doppio') await sleep(800);

  if (sc === 'ok') {
    return { ok: true, risposta: { ok: true, salvato: true } };
  }
  if (sc === 'doppio') {
    return { ok: true, risposta: { ok: true, giaSalvato: true } };
  }
  if (sc === 'dati-non-validi') {
    return {
      ok: false,
      codice: 'invalid-argument',
      motivo: 'dati-non-validi',
      campi: ['terreni[1].superficie'],
      dettagli: {},
    };
  }
  if (sc === 'niente-da-salvare') {
    return { ok: false, codice: 'invalid-argument', motivo: 'niente-da-salvare', dettagli: {} };
  }
  if (sc === 'limite-terreni') {
    return {
      ok: false,
      codice: 'failed-precondition',
      motivo: 'limite-terreni',
      dettagli: { limite: 5, esistenti: 3, richiesti: 4 },
    };
  }
  if (sc === 'gia-preparato') {
    return { ok: false, codice: 'already-exists', motivo: 'gia-preparato', dettagli: {} };
  }
  if (sc === 'troppe-chiamate') {
    return { ok: false, codice: 'resource-exhausted', motivo: 'troppe-chiamate', dettagli: {} };
  }
  if (sc === 'senza-azienda') {
    return { ok: false, codice: 'permission-denied', motivo: 'senza-azienda', dettagli: {} };
  }
  if (sc === 'non-autorizzato') {
    return { ok: false, codice: 'permission-denied', motivo: 'non-autorizzato', dettagli: {} };
  }
  if (sc === 'non-collegato') {
    return { ok: false, codice: 'unauthenticated', motivo: 'non-collegato', dettagli: {} };
  }
  if (sc === 'rete') {
    return { ok: false, codice: 'unavailable', motivo: 'rete', dettagli: {} };
  }
  return { ok: true, risposta: { ok: true, salvato: true } };
}
