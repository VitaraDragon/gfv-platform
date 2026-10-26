/**
 * Logica pura di «Tony bussa ed entra» (niente DOM, niente Vue).
 * Il chiamante passa `dev`: nella build di deploy è false, quindi con il flag
 * spento la scena resta spenta anche se l'indirizzo ha ?tonybussa=1.
 */

const SOGLIA_VARIANTE_PX = 768;

const CLIP = {
  entry: {
    desktop: {
      webm: '/tony-live/tony-entry-desktop-desktop-576x720-alpha.webm',
      stacked: '/tony-live/tony-entry-desktop-desktop-576x1440-stacked-alpha.mp4',
    },
    mobile: {
      webm: '/tony-live/tony-entry-mobile-mobile-432x540-alpha.webm',
      stacked: '/tony-live/tony-entry-mobile-mobile-432x1080-stacked-alpha.mp4',
    },
  },
  idle: {
    desktop: {
      webm: '/tony-live/tony-idle-loop-desktop-576x720-alpha.webm',
      stacked: '/tony-live/tony-idle-loop-desktop-576x1440-stacked-alpha.mp4',
    },
    mobile: {
      webm: '/tony-live/tony-idle-loop-mobile-432x540-alpha.webm',
      stacked: '/tony-live/tony-idle-loop-mobile-432x1080-stacked-alpha.mp4',
    },
  },
  talking: {
    desktop: {
      webm: '/tony-live/tony-talking-loop-desktop-576x720-alpha.webm',
      stacked: '/tony-live/tony-talking-loop-desktop-576x1440-stacked-alpha.mp4',
    },
    mobile: {
      webm: '/tony-live/tony-talking-loop-mobile-432x540-alpha.webm',
      stacked: '/tony-live/tony-talking-loop-mobile-432x1080-stacked-alpha.mp4',
    },
  },
  exit: {
    desktop: {
      webm: '/tony-live/tony-exit-desktop-576x720-alpha.webm',
      stacked: '/tony-live/tony-exit-desktop-576x1440-stacked-alpha.mp4',
    },
    mobile: {
      webm: '/tony-live/tony-exit-mobile-432x540-alpha.webm',
      stacked: '/tony-live/tony-exit-mobile-432x1080-stacked-alpha.mp4',
    },
  },
};

const AUDIO = {
  desktop: {
    bussata: 'tony-bussata-desktop-vetro',
    terzo: 'tony-knock-glass-03',
  },
  mobile: {
    bussata: 'tony-bussata-mobile-telefono',
    terzo: 'tony-knock-phone-03',
  },
  whoosh: 'tony-whoosh-soft-01',
};

/** Tre impulsi: cadono sui colpi a 400, 700 e 1100 ms se la vibrazione parte a 400 ms. */
export const SCHEMA_VIBRAZIONE = Object.freeze([40, 260, 40, 340, 60]);

const CHIAVE_PRESA_VISIONE = 'gfv-avviso-tony';

const TRANSIZIONI = {
  nascosto: { apri: 'avviso' },
  avviso: { conferma: 'bussa', rinuncia: 'nascosto' },
  bussa: { bussataFinita: 'entra', clipNonPronta: 'statico', saluta: 'esce' },
  entra: { entrataFinita: 'idle', clipNonPronta: 'statico', saluta: 'esce' },
  idle: { saluta: 'esce', voceIniziata: 'parla' },
  parla: { voceFinita: 'idle', saluta: 'esce' },
  statico: { saluta: 'esce' },
  esce: { uscitaFinita: 'nascosto' },
};

/**
 * @param {{ flag?: boolean, dev?: boolean, query?: string }} opts
 * @returns {boolean}
 */
export function tonyBussaVisibile({ flag, dev, query }) {
  if (flag === true) return true;
  if (dev === true && parametroTonyBussa(query)) return true;
  return false;
}

/**
 * @param {string} [query]
 * @returns {boolean}
 */
export function parametroTonyBussa(query) {
  const testo = String(query ?? '');
  const inizio = testo.indexOf('?');
  let q = inizio >= 0 ? testo.slice(inizio + 1) : testo;
  const hash = q.indexOf('#');
  if (hash >= 0) q = q.slice(0, hash);
  try {
    return new URLSearchParams(q).get('tonybussa') === '1';
  } catch {
    return false;
  }
}

/**
 * Stessa soglia di formatoVideo: da 768 px in su è desktop.
 * @param {number} larghezzaPx
 * @returns {'desktop' | 'mobile'}
 */
export function varianteScena(larghezzaPx) {
  const w = Number(larghezzaPx);
  if (!Number.isFinite(w) || w < SOGLIA_VARIANTE_PX) return 'mobile';
  return 'desktop';
}

/**
 * Safari (anche su iPhone/iPad) e ogni browser su iOS/iPadOS usano l'MP4 stacked.
 * Gli altri usano WebM con trasparenza se il browser lo sa riprodurre.
 * @param {{ userAgent?: string, webmAlfaSupportato?: boolean }} opts
 * @returns {'webm' | 'stacked'}
 */
export function formatoClip({ userAgent, webmAlfaSupportato }) {
  const ua = String(userAgent || '');
  if (browserSuIos(ua) || safariSenzaChromium(ua)) return 'stacked';
  if (webmAlfaSupportato === true) return 'webm';
  return 'stacked';
}

/**
 * @param {'entry' | 'idle' | 'exit' | 'talking'} nome
 * @param {'desktop' | 'mobile'} variante
 * @param {'webm' | 'stacked'} formato
 * @returns {string}
 */
export function percorsoClip(nome, variante, formato) {
  const perNome = CLIP[nome];
  if (!perNome) return '';
  const chiaveVariante = variante === 'mobile' ? 'mobile' : 'desktop';
  const chiaveFormato = formato === 'stacked' ? 'stacked' : 'webm';
  return perNome[chiaveVariante][chiaveFormato];
}

/**
 * Bussata intera, terzo colpo da solo, fruscio. Ognuno in MP3 e OGG.
 * @param {'desktop' | 'mobile'} variante
 */
export function percorsiAudio(variante) {
  const scelta = variante === 'mobile' ? AUDIO.mobile : AUDIO.desktop;
  const base = '/tony-live/audio';
  return {
    bussata: coppiaAudio(base, scelta.bussata),
    terzo: coppiaAudio(base, scelta.terzo),
    whoosh: coppiaAudio(base, AUDIO.whoosh),
  };
}

/**
 * Saluto della variante e commiato. Solo MP3: le voci non hanno OGG.
 * @param {'desktop' | 'mobile'} variante
 */
export function percorsiVoce(variante) {
  const nomeSaluto = variante === 'mobile' ? 'tony-saluto-mobile' : 'tony-saluto-desktop';
  return {
    saluto: coppiaVoce(nomeSaluto),
    ciao: coppiaVoce('tony-ciao'),
  };
}

/** Immagine di riserva quando le clip non arrivano. */
export function percorsoTonyStatico() {
  return '/tony-live/static/tony-static.png';
}

/**
 * Volume RMS da getByteTimeDomainData. Silenzio (128) = 0, onda piena circa 1.
 * @param {ArrayLike<number> | null | undefined} campioni
 * @returns {number}
 */
export function livelloVoce(campioni) {
  const n = campioni && campioni.length ? campioni.length : 0;
  if (!n) return 0;
  let somma = 0;
  for (let i = 0; i < n; i += 1) {
    const scarto = (Number(campioni[i]) - 128) / 128;
    somma += scarto * scarto;
  }
  return Math.sqrt(somma / n);
}

/** Sopra questa soglia la bocca si apre. */
export const SOGLIA_VOCE_ACCESA = 0.05;
/** Sotto questa soglia, dopo la tenuta, la bocca si chiude. */
export const SOGLIA_VOCE_SPENTA = 0.025;
/** Millisecondi di tenuta per non chiudere la bocca tra una sillaba e l'altra. */
export const TENUTA_BOCCA_MS = 250;

/**
 * Isteresi: aperta sopra la soglia accesa; se già aperta resta aperta
 * finché il volume non scende sotto la soglia spenta da almeno TENUTA_BOCCA_MS.
 * @param {{ aperta?: boolean, livello?: number, msDaUltimoSopra?: number }} opts
 * @returns {boolean}
 */
export function prossimaBocca({ aperta, livello, msDaUltimoSopra }) {
  const valore = Number(livello);
  if (Number.isFinite(valore) && valore >= SOGLIA_VOCE_ACCESA) return true;
  if (aperta === true) {
    const sotto = !Number.isFinite(valore) || valore < SOGLIA_VOCE_SPENTA;
    const tenuta = Number(msDaUltimoSopra) >= TENUTA_BOCCA_MS;
    if (sotto && tenuta) return false;
    return true;
  }
  return false;
}

/** Ritardi della voce: saluto, attesa massima, dissolvenza bocca, tetto dell'uscita. */
export function tempiVoce() {
  return {
    ritardoSalutoMs: 200,
    attesaMaxVoceMs: 4000,
    dissolvenzaBoccaMs: 150,
    attesaMaxUscitaMs: 5000,
  };
}

/**
 * @param {{ audioAttivo?: boolean, riduciMovimento?: boolean, analizzatoreDisponibile?: boolean }} opts
 * @returns {{ voce: boolean, bocca: 'ferma' | 'continua' | 'volume' }}
 */
export function deveParlare({ audioAttivo, riduciMovimento, analizzatoreDisponibile }) {
  if (audioAttivo === false) return { voce: false, bocca: 'ferma' };
  if (riduciMovimento === true) return { voce: true, bocca: 'ferma' };
  if (analizzatoreDisponibile === false) return { voce: true, bocca: 'continua' };
  return { voce: true, bocca: 'volume' };
}

/**
 * Unisce il testo dei cue. Salta WEBVTT, righe vuote, numeri e tempi.
 * @param {string} contenuto
 * @returns {string}
 */
export function testoDaVtt(contenuto) {
  const testo = String(contenuto ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const frasi = [];
  for (const riga of testo.split('\n')) {
    const pulita = riga.trim();
    if (!pulita) continue;
    if (pulita.startsWith('WEBVTT')) continue;
    if (/^\d+$/.test(pulita)) continue;
    if (pulita.includes('-->')) continue;
    frasi.push(pulita);
  }
  return frasi.join(' ');
}

/**
 * @param {{ variante?: string, riduciMovimento?: boolean }} opts
 */
export function tempiScena({ variante, riduciMovimento }) {
  const mobile = variante === 'mobile';
  const fermo = riduciMovimento === true;
  return {
    dissolvenzaAvvisoMs: 200,
    avvioSuonoBussataMs: 0,
    colpiMs: [400, 700, 1100],
    durataScossoneMs: 80,
    scossonePx: fermo ? [] : mobile ? [1, 2, 1] : [2, 2, 2],
    impronta: !fermo && !mobile ? { aMs: 1100, durataMs: 400 } : null,
    entrataMs: 2000,
    staticoMs: 5000,
    vibrazioneMs: 400,
  };
}

/**
 * Vibra solo sul telefono, solo se il browser lo permette, mai con «riduci movimento».
 * @param {{ variante?: string, haVibrate?: boolean, riduciMovimento?: boolean }} opts
 * @returns {boolean}
 */
export function dovrebbeVibrare({ variante, haVibrate, riduciMovimento }) {
  if (variante !== 'mobile') return false;
  if (haVibrate !== true) return false;
  if (riduciMovimento === true) return false;
  return true;
}

/**
 * @param {{ getItem?: (chiave: string) => string | null } | null | undefined} storage
 * @param {string} versione
 * @returns {{ vista: boolean, data?: string, versione?: string, audio?: boolean }}
 */
export function leggiPresaVisione(storage, versione) {
  try {
    if (!storage || typeof storage.getItem !== 'function') return { vista: false };
    const raw = storage.getItem(CHIAVE_PRESA_VISIONE);
    if (!raw) return { vista: false };
    const dati = JSON.parse(raw);
    if (!dati || typeof dati !== 'object') return { vista: false };
    if (dati.versione === versione) {
      return {
        vista: true,
        data: dati.data,
        versione: dati.versione,
        audio: dati.audio === false ? false : true,
      };
    }
    return { vista: false };
  } catch {
    return { vista: false };
  }
}

/**
 * @param {{ setItem?: (chiave: string, valore: string) => void } | null | undefined} storage
 * @param {string} versione
 * @param {string} adesso
 * @param {boolean} [audio] omesso (chiamate del passo 5) vale come acceso
 * @returns {boolean}
 */
export function salvaPresaVisione(storage, versione, adesso, audio) {
  try {
    if (!storage || typeof storage.setItem !== 'function') return false;
    storage.setItem(
      CHIAVE_PRESA_VISIONE,
      JSON.stringify({
        versione,
        data: adesso,
        audio: audio === false ? false : true,
      })
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Evento sconosciuto: lo stato resta com'è.
 * @param {string} stato
 * @param {string} evento
 * @returns {string}
 */
export function prossimoStato(stato, evento) {
  const mappa = TRANSIZIONI[stato];
  if (!mappa || !Object.prototype.hasOwnProperty.call(mappa, evento)) return stato;
  return mappa[evento];
}

function coppiaAudio(base, nome) {
  return {
    mp3: `${base}/${nome}.mp3`,
    ogg: `${base}/${nome}.ogg`,
  };
}

function coppiaVoce(nome) {
  return {
    mp3: `/tony-live/voci/${nome}.mp3`,
    vtt: `/tony-live/voci/${nome}.vtt`,
  };
}

function browserSuIos(ua) {
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
}

/** WebKit con Safari, senza Chrome, Chromium, Edge o Firefox nel user agent. */
function safariSenzaChromium(ua) {
  if (!/Safari/i.test(ua)) return false;
  return !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|Edg\/|OPR\/|Opera|Firefox/i.test(ua);
}
