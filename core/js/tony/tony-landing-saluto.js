/**
 * Saluto e percorso 7 giorni dopo setup dalla landing (messaggio locale, zero CF).
 * @module core/js/tony/tony-landing-saluto
 */

const STORAGE_KEY = 'gfv_tony_landing_percorso';

/**
 * @param {unknown} v
 * @returns {number|null} ms epoch
 */
export function timestampToMs(v) {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  if (typeof v.toMillis === 'function') {
    try {
      return v.toMillis();
    } catch (e) {
      return null;
    }
  }
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  if (v instanceof Date) return v.getTime();
  return null;
}

/**
 * @param {string} tenantId
 * @returns {object}
 */
export function leggiStatoPercorsoLocale(tenantId) {
  const id = String(tenantId || '').trim();
  const empty = {
    salutoFatto: false,
    percorsoChiuso: false,
    passiVisti: {},
    ultimoRiprendiGiorno: '',
  };
  if (!id) return empty;
  try {
    const raw = localStorage.getItem(STORAGE_KEY + ':' + id);
    if (!raw) return empty;
    const o = JSON.parse(raw);
    return Object.assign({}, empty, o || {});
  } catch (e) {
    return empty;
  }
}

/**
 * @param {string} tenantId
 * @param {object} stato
 */
export function salvaStatoPercorsoLocale(tenantId, stato) {
  const id = String(tenantId || '').trim();
  if (!id) return;
  try {
    localStorage.setItem(STORAGE_KEY + ':' + id, JSON.stringify(stato || {}));
  } catch (e) {
    /* ignore */
  }
}

function giornoChiave(now = new Date()) {
  return (
    now.getFullYear() +
    '-' +
    String(now.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(now.getDate()).padStart(2, '0')
  );
}

/**
 * Logica pura: cosa mostrare all'accesso.
 * @param {{
 *   tonyLandingSetupCompletatoIl?: unknown,
 *   tonyGuidaOnboardingEndsAt?: unknown,
 *   sedeCoordinate?: object|null,
 *   statoLocale?: object,
 *   now?: Date,
 *   pianoBase?: boolean,
 * }} args
 * @returns {{ tipo: 'saluto'|'riprendi'|'niente', motivo: string }}
 */
export function decidiSalutoLanding(args) {
  const a = args && typeof args === 'object' ? args : {};
  const now = a.now instanceof Date ? a.now : new Date();
  const markerMs = timestampToMs(a.tonyLandingSetupCompletatoIl);
  if (markerMs == null) return { tipo: 'niente', motivo: 'no-marker' };

  const endsMs = timestampToMs(a.tonyGuidaOnboardingEndsAt);
  if (endsMs == null || endsMs <= now.getTime()) {
    return { tipo: 'niente', motivo: 'onboarding-scaduto' };
  }

  const stato = Object.assign(
    { salutoFatto: false, percorsoChiuso: false, passiVisti: {}, ultimoRiprendiGiorno: '' },
    a.statoLocale || {}
  );

  if (stato.percorsoChiuso) return { tipo: 'niente', motivo: 'chiuso' };

  // Piano Base creato da landing: stesso saluto nei 7 giorni (onboarding attivo + marker).
  if (!stato.salutoFatto) {
    return { tipo: 'saluto', motivo: 'primo-accesso' };
  }

  const oggi = giornoChiave(now);
  if (stato.ultimoRiprendiGiorno === oggi) {
    return { tipo: 'niente', motivo: 'gia-oggi' };
  }
  return { tipo: 'riprendi', motivo: 'giorno-nuovo' };
}

/**
 * @param {{ nome?: string|null, haPinSede?: boolean }} opts
 * @returns {{ testo: string, passi: Array<{ id: string, label: string, target: string }> }}
 */
export function costruisciMessaggioSaluto(opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const nome = String(o.nome || '').trim();
  const ciao = nome ? 'Ciao ' + nome + '!' : 'Ciao!';
  const pinNota = o.haPinSede
    ? ''
    : ' (il pin della sede manca ancora: lo mettiamo al passo 1)';
  const testo =
    ciao +
    ' Per 7 giorni ti guido dentro l’app, a passi brevi.' +
    pinNota +
    ' Usa la graffetta in alto a sinistra per aprire i moduli.';
  const passi = [
    {
      id: 'sede',
      label: '1) Mappa / sede',
      target: 'impostazioni',
    },
    {
      id: 'terreni',
      label: '2) Terreni (coltura e confini)',
      target: 'terreni',
    },
    {
      id: 'diario',
      label: '3) Primo lavoro / attività nel Diario',
      target: 'attivita',
    },
  ];
  return { testo, passi };
}

/**
 * @param {{ passiVisti?: object }} stato
 * @returns {string}
 */
export function messaggioRiprendi(stato) {
  const visti = (stato && stato.passiVisti) || {};
  if (!visti.sede) return 'Riprendiamo dalla mappa / sede.';
  if (!visti.terreni) return 'Riprendiamo dai terreni.';
  if (!visti.diario) return 'Riprendiamo dal Diario attività.';
  return 'Riprendiamo da dove eravamo.';
}

/**
 * True se il pin sede è presente.
 * @param {object|null|undefined} sedeCoordinate
 */
export function haPinSede(sedeCoordinate) {
  const c = sedeCoordinate;
  if (!c || typeof c !== 'object') return false;
  const lat = typeof c.lat === 'number' ? c.lat : Number(c.lat);
  const lng = typeof c.lng === 'number' ? c.lng : Number(c.lng);
  return Number.isFinite(lat) && Number.isFinite(lng);
}
