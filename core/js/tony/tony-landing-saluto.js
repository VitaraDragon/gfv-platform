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
    : ' (il pin della sede manca ancora: lo metti in Impostazioni, con l\u2019ingranaggio in alto a destra)';
  const testo =
    ciao +
    ' Per 7 giorni ti guido dentro l’app, a passi brevi.' +
    pinNota +
    ' Usa la graffetta in alto a sinistra per aprire i moduli.';
  return { testo, passi: [] };
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

/** Attesa massima del pin sede (auto-pin dashboard) prima di scegliere la frase del saluto. */
export const ATTESA_PIN_SEDE_MS = 3500;

/**
 * Se il pin sede manca, attende (max `maxMs`) che l'auto-pin della dashboard finisca
 * (`window.__gfvSedeAutoPinPromise`) prima di decidere la frase del saluto.
 * Non rilancia mai: gli errori della promise equivalgono a 'nessun pin'.
 *
 * @param {() => object|null|undefined} leggiTenant  es. () => window.__gfvTenantData
 * @param {() => Promise<any>|undefined} leggiPromise  es. () => window.__gfvSedeAutoPinPromise
 * @param {{ maxMs?: number, pollMs?: number, adesso?: () => number }} [opzioni]
 * @returns {Promise<{ haPin: boolean, atteso: boolean, scaduto: boolean, promessa: Promise<any>|null }>}
 *   `promessa`: auto-pin ancora in volo allo scadere dell'attesa (per la riga 'pin tardivo').
 */
export async function attendiPinSedeAutoPin(leggiTenant, leggiPromise, opzioni) {
  const o = opzioni && typeof opzioni === 'object' ? opzioni : {};
  const maxMs = typeof o.maxMs === 'number' ? o.maxMs : ATTESA_PIN_SEDE_MS;
  const pollMs = typeof o.pollMs === 'number' ? o.pollMs : 100;
  const adesso = typeof o.adesso === 'function' ? o.adesso : Date.now;
  const pinPresente = () => {
    try {
      const t = leggiTenant ? leggiTenant() : null;
      return haPinSede(t && t.sedeCoordinate);
    } catch (e) {
      return false;
    }
  };
  if (pinPresente()) return { haPin: true, atteso: false, scaduto: false, promessa: null };

  const fine = adesso() + maxMs;
  let atteso = false;
  let promessaVista = null;
  const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

  while (adesso() < fine) {
    let p = null;
    try {
      p = leggiPromise ? leggiPromise() : null;
    } catch (e) {
      p = null;
    }
    if (p && typeof p.then === 'function') {
      promessaVista = p;
      atteso = true;
      const resto = Math.max(0, fine - adesso());
      let finita = false;
      await Promise.race([
        Promise.resolve(p).then(
          () => {
            finita = true;
          },
          () => {
            finita = true;
          }
        ),
        pausa(resto),
      ]);
      if (pinPresente()) return { haPin: true, atteso: true, scaduto: false, promessa: null };
      if (finita) return { haPin: false, atteso: true, scaduto: false, promessa: null };
      break;
    }
    atteso = true;
    await pausa(Math.min(pollMs, Math.max(0, fine - adesso())));
    if (pinPresente()) return { haPin: true, atteso: true, scaduto: false, promessa: null };
  }
  return {
    haPin: pinPresente(),
    atteso,
    scaduto: true,
    promessa: promessaVista,
  };
}

/**
 * Unica riga mostrata se il pin arriva dopo il saluto.
 * @param {string} [mode]  'civico' | 'centro'
 * @returns {string}
 */
export function costruisciMessaggioPinTardivo(mode) {
  if (mode === 'centro') {
    return 'Ho messo il pin della sede al centro del comune: spostalo sull\u2019indirizzo preciso in Impostazioni.';
  }
  return 'Ho messo il pin della sede sulla mappa: puoi ritoccarlo in Impostazioni.';
}
