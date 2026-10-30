/**
 * Logica pura di «Tony bussa ed entra» (niente DOM, niente Vue).
 * Il chiamante passa `dev`: nella build di deploy è false, quindi con il flag
 * spento la scena resta spenta anche se l'indirizzo ha ?tonybussa=1.
 */

const SOGLIA_VARIANTE_PX = 768;
const VERSIONE_CLIP = 'v4';
/** Override di versione per singola clip (es. talking v5 senza salto). */
const VERSIONE_PER_CLIP = Object.freeze({
  talking: 'v5',
});

/** Nomi file base delle clip (senza variante/risoluzione/formato). */
const NOMI_FILE_CLIP = Object.freeze({
  entry: Object.freeze({
    desktop: 'tony-entry-h1-mano-bordo',
    mobile: 'tony-entry-h2-saluto',
  }),
  idle: 'tony-idle-loop',
  listenRaise: 'tony-listen-raise',
  listenLoop: 'tony-listen-loop',
  listenLower: 'tony-listen-lower',
  thinking: 'tony-thinking',
  scrive: 'tony-scrive-hs1-taccuino',
  talking: 'tony-talking-loop',
  topicRegistrazione: 'tony-topic-registrazione-2s5',
  topicSede: 'tony-topic-sede',
  topicPoderi: 'tony-topic-poderi-2s5',
  topicTerreni: 'tony-topic-terreni',
  exit: 'tony-exit-2s-veloce',
});

/** Durate esatte in ms (uguali in WebM, WebP e stacked). */
export const DURATE_CLIP_MS = Object.freeze({
  entry: Object.freeze({ desktop: 3042, mobile: 2708 }),
  idle: 4000,
  listenRaise: 1833,
  listenLoop: 2583,
  listenLower: 1833,
  thinking: 2375,
  scrive: 3583,
  talking: 7500,
  topicRegistrazione: 2500,
  topicSede: 2792,
  topicPoderi: 2500,
  topicTerreni: 3042,
  exit: 2000,
});

/** Clip topic per l'aiuto all'account (passo 14). */
export const CLIP_PER_ARGOMENTO = Object.freeze({
  sede: 'topicSede',
  poderi: 'topicPoderi',
  terreni: 'topicTerreni',
});

/** Clip che si ripetono in loop. */
export const CLIP_IN_LOOP = Object.freeze(['idle', 'listenLoop', 'scrive', 'talking']);

/**
 * Durata minima visibile della clip «scrive» (taccuino in mano ~1,0–2,8 s).
 * Se la voce è pronta prima, si aspetta fino a questo minimo così il gesto si legge.
 */
export const MIN_SCRIVE_MS = 2800;

/** Massimo di bussate automatiche per sessione (senza interazione utente). */
export const MAX_BUSSATE_AUTOMATICHE = 2;

/**
 * Ms da attendere prima di avviare talking/audio, per tenere «scrive» visibile.
 * @param {{ clipCorrente?: string, msDaInizioClip?: number, riduciMovimento?: boolean }} opts
 * @returns {number}
 */
export function attesaPrimaDiParlareMs({ clipCorrente, msDaInizioClip, riduciMovimento }) {
  if (riduciMovimento === true) return 0;
  if (clipCorrente !== 'scrive') return 0;
  const trascorsi =
    typeof msDaInizioClip === 'number' && Number.isFinite(msDaInizioClip)
      ? Math.max(0, msDaInizioClip)
      : 0;
  return Math.max(0, MIN_SCRIVE_MS - trascorsi);
}

/** Ritardo bussata automatica dopo apertura pagina (una volta per sessione). */
export const BUSSATA_AUTOMATICA_MS = 8000;

export const CHIAVE_BUSSATA_SESSIONE = 'gfv-tony-bussato-sessione';
export const CHIAVE_RINUNCIA_AVVISO = 'gfv-tony-rinuncia-avviso';
export const CHIAVE_INFORMATIVA_AIUTO = 'gfv-tony-informativa-aiuto';

/**
 * @param {{
 *   sessioneGiaBussato?: boolean,
 *   bussateAutomatiche?: number,
 *   utenteHaInteragito?: boolean,
 *   rinunciaSalvata?: boolean,
 *   avvisoAperto?: boolean,
 *   stageAperto?: boolean,
 *   paginaNascosta?: boolean
 * }} opts
 * @returns {boolean}
 */
export function bussataAutomaticaConsentita({
  sessioneGiaBussato,
  bussateAutomatiche,
  utenteHaInteragito,
  rinunciaSalvata,
  avvisoAperto,
  stageAperto,
  paginaNascosta,
}) {
  if (utenteHaInteragito === true) return false;
  if (sessioneGiaBussato === true) return false;
  const n =
    typeof bussateAutomatiche === 'number' && Number.isFinite(bussateAutomatiche)
      ? bussateAutomatiche
      : 0;
  if (n >= MAX_BUSSATE_AUTOMATICHE) return false;
  if (rinunciaSalvata === true) return false;
  if (avvisoAperto === true) return false;
  if (stageAperto === true) return false;
  if (paginaNascosta === true) return false;
  return true;
}

const FORMATI = Object.freeze(['webm', 'webp', 'stacked']);
const NOMI_CLIP = Object.freeze(Object.keys(NOMI_FILE_CLIP));

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
  idle: {
    saluta: 'esce',
    voceIniziata: 'parla',
    ascoltoIniziato: 'ascolta',
    domandaInviata: 'pensa',
    servizioSpento: 'idle',
    apriModulo: 'modulo',
  },
  ascolta: {
    ascoltoFinito: 'idle',
    domandaInviata: 'pensa',
    saluta: 'esce',
    servizioSpento: 'idle',
    apriModulo: 'modulo',
  },
  pensa: {
    testoArrivato: 'scrive',
    rispostaFinita: 'idle',
    voceIniziata: 'parla',
    servizioSpento: 'idle',
    saluta: 'esce',
    apriModulo: 'modulo',
  },
  scrive: {
    rispostaFinita: 'idle',
    voceIniziata: 'parla',
    servizioSpento: 'idle',
    saluta: 'esce',
    apriModulo: 'modulo',
  },
  parla: { voceFinita: 'idle', saluta: 'esce', apriModulo: 'modulo' },
  statico: { saluta: 'esce', apriModulo: 'modulo' },
  /** Fase «chat» del brief: idle dopo il saluto. Modulo = registrazione in chat. */
  modulo: { chiudiModulo: 'idle', saluta: 'esce' },
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
 * Safari e tutto iPhone/iPad → WebP (VP9 senza alfa su Safari).
 * Altri con WebM → webm; altrimenti stacked.
 * @param {{ userAgent?: string, maxTouchPoints?: number, webmAlfaSupportato?: boolean }} opts
 * @returns {'webp' | 'webm' | 'stacked'}
 */
export function formatoClip({ userAgent, maxTouchPoints, webmAlfaSupportato }) {
  const ua = String(userAgent || '');
  const touch = Number(maxTouchPoints);
  if (browserSuIos(ua) || iPadOsComeMac(ua, touch) || safariSenzaChromium(ua)) {
    return 'webp';
  }
  if (webmAlfaSupportato === true) return 'webm';
  return 'stacked';
}

/**
 * @param {string} nome
 * @param {'desktop' | 'mobile'} [variante]
 * @returns {number}
 */
export function durataClipMs(nome, variante) {
  if (nome === 'entry') {
    const mappa = DURATE_CLIP_MS.entry;
    return variante === 'mobile' ? mappa.mobile : mappa.desktop;
  }
  const ms = DURATE_CLIP_MS[nome];
  return typeof ms === 'number' ? ms : 0;
}

/**
 * @param {string} nome
 * @returns {boolean}
 */
export function clipInLoop(nome) {
  return CLIP_IN_LOOP.indexOf(nome) >= 0;
}

/**
 * @param {'entry' | 'idle' | 'exit' | 'talking' | string} nome
 * @param {'desktop' | 'mobile'} variante
 * @param {'webm' | 'webp' | 'stacked'} formato
 * @returns {string}
 */
function versioneClipPerNome(nome) {
  if (Object.prototype.hasOwnProperty.call(VERSIONE_PER_CLIP, nome)) {
    return VERSIONE_PER_CLIP[nome];
  }
  return VERSIONE_CLIP;
}

export function percorsoClip(nome, variante, formato) {
  if (NOMI_CLIP.indexOf(nome) < 0) return '';
  if (FORMATI.indexOf(formato) < 0) return '';
  const chiaveVariante = variante === 'mobile' ? 'mobile' : 'desktop';
  const base = nomeFileClip(nome, chiaveVariante);
  if (!base) return '';
  const ver = versioneClipPerNome(nome);
  if (formato === 'webm') {
    const res = chiaveVariante === 'mobile' ? '432x540' : '576x720';
    return `/tony-live/${base}-${chiaveVariante}-${res}-alpha-${ver}.webm`;
  }
  if (formato === 'webp') {
    const res = chiaveVariante === 'mobile' ? '432x540' : '576x720';
    return `/tony-live/${base}-${chiaveVariante}-${res}-12fps-${ver}.webp`;
  }
  const res = chiaveVariante === 'mobile' ? '432x1080' : '576x1440';
  return `/tony-live/${base}-${chiaveVariante}-${res}-stacked-alpha-${ver}.mp4`;
}

/**
 * Entrata e idle per prime, poi le altre 7 (dopo «Fai entrare Tony»).
 * @param {'desktop' | 'mobile'} variante
 * @param {'webm' | 'webp' | 'stacked'} formato
 * @returns {string[]}
 */
/**
 * Ordine di precarica dopo entry/idle: thinking e scrive per prime
 * (taccuino), poi ascolto e talking.
 */
export const ORDINE_PRECARICA_CHAT = Object.freeze([
  'entry',
  'idle',
  'thinking',
  'scrive',
  'listenRaise',
  'listenLoop',
  'listenLower',
  'talking',
  'exit',
]);

export function percorsiClipDaPrecaricare(variante, formato) {
  return ORDINE_PRECARICA_CHAT.map((nome) =>
    percorsoClip(nome, variante, formato)
  ).filter(Boolean);
}

/**
 * Layout desktop: laterale se resta abbastanza spazio al contenuto, altrimenti basso.
 * @param {{ larghezzaFinestra: number, ingombro: number, minimoContenuto?: number }} opts
 * @returns {'laterale' | 'basso'}
 */
export function layoutTonyDesktop({ larghezzaFinestra, ingombro, minimoContenuto }) {
  const w =
    typeof larghezzaFinestra === 'number' && Number.isFinite(larghezzaFinestra)
      ? larghezzaFinestra
      : 0;
  const ing =
    typeof ingombro === 'number' && Number.isFinite(ingombro) ? Math.max(0, ingombro) : 0;
  const min =
    typeof minimoContenuto === 'number' && Number.isFinite(minimoContenuto)
      ? minimoContenuto
      : 640;
  if (w - ing - 16 < min) return 'basso';
  return 'laterale';
}

/**
 * Solo topic-registrazione (webm/webp/stacked) per il dispositivo.
 * @param {'desktop' | 'mobile'} dispositivo
 * @returns {string[]}
 */
export function percorsiClipRegistrazione(dispositivo) {
  const variante = dispositivo === 'mobile' ? 'mobile' : 'desktop';
  return ['webm', 'webp', 'stacked']
    .map((formato) => percorsoClip('topicRegistrazione', variante, formato))
    .filter(Boolean);
}

/**
 * Clip topic sede/poderi/terreni per il formato corrente.
 * @param {'webm' | 'webp' | 'stacked'} formato
 * @param {'desktop' | 'mobile'} [variante]
 * @returns {string[]}
 */
export function percorsiClipArgomenti(formato, variante) {
  const v = variante === 'mobile' ? 'mobile' : 'desktop';
  const f =
    formato === 'webp' || formato === 'stacked' || formato === 'webm'
      ? formato
      : 'webm';
  return ['topicSede', 'topicPoderi', 'topicTerreni']
    .map((nome) => percorsoClip(nome, v, f))
    .filter(Boolean);
}

/**
 * Scaletta una volta per argomento: gesto poi idle.
 * @param {string} argomento
 * @returns {string[] | null}
 */
export function scalettaArgomento(argomento) {
  const clip = CLIP_PER_ARGOMENTO[argomento];
  if (!clip) return null;
  return [clip, 'idle'];
}

/**
 * Voce fissa dopo il salvataggio (passo 14).
 * @returns {{ mp3: string, vtt: string }}
 */
export function percorsoVoceFatto() {
  return {
    mp3: '/tony-live/voci/tony-fatto.mp3',
    vtt: '/tony-live/voci/tony-fatto.vtt',
  };
}

/**
 * Elenco ordinato delle clip da suonare passando da uno stato all'altro.
 * @param {string} da
 * @param {string} a
 * @returns {string[]}
 */
export function scalettaClip(da, a) {
  if (a === 'esce') return ['exit'];
  if (a === 'statico') return [];
  if (da === 'entra' && a === 'idle') return [];
  if (a === 'modulo') return ['topicRegistrazione', 'scrive'];
  if (da === 'modulo' && a === 'idle') return ['idle'];
  if (da === 'idle' && a === 'ascolta') return ['listenRaise', 'listenLoop'];
  if (da === 'ascolta' && a === 'idle') return ['listenLower', 'idle'];
  if (da === 'ascolta' && a === 'pensa') return ['listenLower', 'thinking'];
  if (da === 'idle' && a === 'pensa') return ['thinking'];
  if (da === 'pensa' && a === 'scrive') return ['scrive'];
  if (da === 'scrive' && a === 'idle') return ['idle'];
  if (da === 'pensa' && a === 'idle') return ['idle'];
  if (da === 'scrive' && a === 'parla') return ['talking'];
  if (da === 'pensa' && a === 'parla') return ['talking'];
  if (da === 'idle' && a === 'parla') return ['talking'];
  if (da === 'parla' && a === 'idle') return ['idle'];
  return [];
}

/**
 * Decide come avviare una nuova scaletta di clip (R6: taccuino visibile).
 * Ritorna null per lasciare la logica storica di avviaScaletta.
 * @param {{ da: string, a: string, clipCorrente?: string, codaInAttesa?: string[] | null, riduciMovimento?: boolean }} opts
 * @returns {{ modo: 'subito' | 'fineGiro' | 'dopoCorrente', lista: string[], dissolvenzaMs: number } | null}
 */
export function passaggioClip({ da, a, clipCorrente, codaInAttesa, riduciMovimento }) {
  if (riduciMovimento === true) {
    return { modo: 'subito', lista: [], dissolvenzaMs: 0 };
  }

  const fade = tempiVoce().dissolvenzaBoccaMs;
  const lista = scalettaClip(da, a);

  // Eccezioni che passano sempre davanti: uscita e voce.
  if (a === 'esce' || a === 'parla') {
    return { modo: 'subito', lista, dissolvenzaMs: fade };
  }

  // Annulla / fine modulo: subito idle, anche se «scrive» è ancora in coda (R4).
  if (da === 'modulo' && a === 'idle') {
    return { modo: 'subito', lista, dissolvenzaMs: fade };
  }

  // Se «scrive» è ancora in coda, la nuova scaletta va dopo (non la sovrascrive).
  const coda = Array.isArray(codaInAttesa) ? codaInAttesa : null;
  if (coda && coda.indexOf('scrive') >= 0) {
    const idx = coda.indexOf('scrive');
    const nuova = coda.slice(0, idx + 1);
    for (let i = 0; i < lista.length; i += 1) {
      if (nuova.indexOf(lista[i]) < 0) nuova.push(lista[i]);
    }
    return { modo: 'dopoCorrente', lista: nuova, dissolvenzaMs: 0 };
  }

  if (da === 'pensa' && a === 'scrive') {
    return { modo: 'subito', lista, dissolvenzaMs: fade };
  }
  if (da === 'scrive' && a === 'idle') {
    return { modo: 'fineGiro', lista, dissolvenzaMs: 0 };
  }

  void clipCorrente;
  return null;
}

/** Clip che suonano una sola volta (non in loop). */
export const CLIP_UNA_VOLTA = Object.freeze([
  'listenRaise',
  'listenLower',
  'thinking',
  'topicRegistrazione',
  'topicSede',
  'topicPoderi',
  'topicTerreni',
  'entry',
]);

/**
 * Decide cosa fare quando finisce una clip (logica pura di onFine in TonyStage).
 * @param {{ nome: string, fase: string, inLoop: boolean, codaDopoCorrente?: { lista: string[], dissolvenzaMs?: number } | null }} opts
 * @returns {{ azione: 'coda' | 'ripeti' | 'prossima' | 'nulla', lista?: string[], dissolvenzaMs?: number }}
 */
export function dopoFineClip({ nome, fase, inLoop, codaDopoCorrente }) {
  const unaVolta = CLIP_UNA_VOLTA.indexOf(nome) >= 0;
  if (codaDopoCorrente && unaVolta && nome !== 'entry') {
    const lista = Array.isArray(codaDopoCorrente.lista)
      ? codaDopoCorrente.lista.slice()
      : [];
    return {
      azione: 'coda',
      lista,
      dissolvenzaMs:
        typeof codaDopoCorrente.dissolvenzaMs === 'number'
          ? codaDopoCorrente.dissolvenzaMs
          : 0,
    };
  }
  if (nome === 'entry') return { azione: 'prossima' };
  if (nome === 'exit') return { azione: 'nulla' };
  if (nome === 'thinking' && fase === 'pensa') {
    return { azione: 'ripeti', lista: ['thinking'] };
  }
  if (!inLoop) return { azione: 'prossima' };
  return { azione: 'nulla' };
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

/** Dimensioni PNG idle (stessa inquadratura delle clip). */
export const DIMENSIONI_TONY_STATICO = Object.freeze({
  desktop: Object.freeze({ larghezza: 576, altezza: 720 }),
  mobile: Object.freeze({ larghezza: 432, altezza: 540 }),
});

/** Dissolvenza incrociata verso l'immagine ferma (ms). */
export const DISSOLVENZA_STATICO_MS = 180;

/**
 * Immagine ferma quando le clip non arrivano (stessa inquadratura di idle).
 * Senza argomenti o con valore diverso da mobile → desktop (test passo 6).
 * @param {'desktop' | 'mobile' | string} [variante]
 * @returns {string}
 */
export function percorsoTonyStatico(variante) {
  if (variante === 'mobile') return '/tony-live/static/tony-static-idle-mobile.png';
  return '/tony-live/static/tony-static-idle-desktop.png';
}

/**
 * Timer di sicurezza dell'entrata: durata clip + margine, dal primo fotogramma.
 * @param {'desktop' | 'mobile'} [variante]
 * @returns {number}
 */
export function sicurezzaEntrataMs(variante) {
  return durataClipMs('entry', variante) + 1500;
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
    attesaMaxVoceMs: 6000,
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

function nomeFileClip(nome, variante) {
  const voce = NOMI_FILE_CLIP[nome];
  if (!voce) return '';
  if (typeof voce === 'string') return voce;
  return voce[variante] || '';
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

function iPadOsComeMac(ua, maxTouchPoints) {
  return /Macintosh/i.test(ua) && Number.isFinite(maxTouchPoints) && maxTouchPoints > 1;
}

/** WebKit con Safari, senza Chrome, Chromium, Edge o Firefox nel user agent. */
function safariSenzaChromium(ua) {
  if (!/Safari\//.test(ua)) return false;
  return !/Chrome|Chromium|CriOS|Edg|OPR|Android|FxiOS/.test(ua);
}
