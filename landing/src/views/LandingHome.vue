<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue';
import logoMark from '../../../icons/gfv-mark.svg';
import tonyIcon from '../assets/tony-icon.png';
import TonyAvviso from '../components/TonyAvviso.vue';
import VideoTony from '../components/VideoTony.vue';
import { testiLanding } from '../content/testi-landing.js';
import {
  EMAIL_CONTATTO,
  FOTO_PIER_URL,
  GIORNI_GUIDA_TONY,
  IVA_CONFERMATA,
  LIMITI_LANDING,
  PAGINE_LEGALI,
  TESTO_CHI_SIAMO,
  TONY_BUSSA_ATTIVO,
  URL_LOGIN,
  URL_REGISTRAZIONE,
  VERSIONE_AVVISO_TONY,
} from '../config/landing-config.js';
import { rigaPrezzi, vociPianiCosaGestisci } from '../lib/landing-logica.js';
import {
  deveParlare,
  dovrebbeVibrare,
  formatoClip,
  leggiPresaVisione,
  livelloVoce,
  percorsoClip,
  percorsiAudio,
  percorsiClipDaPrecaricare,
  percorsiVoce,
  prossimoStato,
  prossimaBocca,
  salvaPresaVisione,
  SCHEMA_VIBRAZIONE,
  SOGLIA_VOCE_ACCESA,
  tempiScena,
  tempiVoce,
  tonyBussaVisibile,
  varianteScena,
} from '../lib/tony-bussa-logica.js';
import {
  monthlyToAnnual,
  SUBSCRIPTION_PLANS,
} from '../../../core/config/subscription-plans.js';

const t = testiLanding;

const prezzi = computed(() =>
  rigaPrezzi(
    {
      free: SUBSCRIPTION_PLANS.free,
      base: SUBSCRIPTION_PLANS.base,
      monthlyToAnnual,
    },
    GIORNI_GUIDA_TONY,
    { ivaConfermata: IVA_CONFERMATA }
  )
);

const pianiCosaGestisci = vociPianiCosaGestisci(LIMITI_LANDING);

const mostraChiSiamo = computed(
  () => Boolean(FOTO_PIER_URL) && Boolean(String(TESTO_CHI_SIAMO || '').trim())
);

// Nella build di deploy DEV è false e il modo non è «anteprima»: con il flag spento
// ?tonybussa=1 non accende la scena.
const tonyOn = tonyBussaVisibile({
  flag: TONY_BUSSA_ATTIVO,
  dev: import.meta.env.DEV === true || import.meta.env.MODE === 'anteprima',
  query: typeof window !== 'undefined' ? window.location.search : '',
});

const TonyStage = defineAsyncComponent(() => import('../components/TonyStage.vue'));

const fase = ref('nascosto');
const stageAperto = ref(false);
const avvisoAperto = ref(false);
const avvisoInChiusura = ref(false);
const audioAttivo = ref(true);
const riduciMovimento = ref(false);
const uscitaConClip = ref(true);
const shakePx = ref(0);
const improntaAccesa = ref(false);
const varianteScelta = ref('desktop');
const formatoScelto = ref('webm');
const pulsanteOrigine = ref<HTMLElement | null>(null);
const boccaAperta = ref(false);
const salutoFinito = ref(false);
const registrazioneCompletata = ref(false);
const stageRef = ref<{ precaricaClip?: (nome: string) => Promise<void> } | null>(null);

const stileScossone = computed(() => {
  if (!shakePx.value) return undefined;
  const px = shakePx.value;
  return { transform: `translate(${px}px, ${-Math.abs(px)}px)` };
});

/** Solo sviluppo: clip di entrata/idle non precaricate (prova statico). */
let clipAssentiInProva = false;

let audioBussata: HTMLAudioElement | null = null;
let audioTerzo: HTMLAudioElement | null = null;
let audioWhoosh: HTMLAudioElement | null = null;
let audioSaluto: HTMLAudioElement | null = null;
let audioCiao: HTMLAudioElement | null = null;
let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let nodoSaluto: MediaElementAudioSourceNode | null = null;
let modoBocca: 'ferma' | 'continua' | 'volume' = 'ferma';
let generazioneVoce = 0;
let salutoProgrammato = false;
let voceSalutoAttiva = false;
let uscitaClipFinita = false;
let uscitaVoceFinita = false;
let rafBocca = 0;
let ultimoSopraMs = 0;
let videoEntryPreload: HTMLVideoElement | null = null;
let videoIdlePreload: HTMLVideoElement | null = null;
const videoPreload: HTMLVideoElement[] = [];
let mediaPronte = false;
let formatoAudioScelto: 'mp3' | 'ogg' = 'mp3';
const timerIds: number[] = [];
const intervalli: number[] = [];

function storagePagina() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function aggiornaRiduci() {
  try {
    riduciMovimento.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    riduciMovimento.value = false;
  }
}

function rilevaFormato() {
  let webm = false;
  try {
    const video = document.createElement('video');
    webm =
      video.canPlayType('video/webm; codecs="vp09.00.10.08"') !== '' ||
      video.canPlayType('video/webm; codecs="vp9"') !== '';
  } catch {
    webm = false;
  }
  return formatoClip({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    webmAlfaSupportato: webm,
  });
}

function rilevaOgg() {
  try {
    const audio = document.createElement('audio');
    return audio.canPlayType('audio/ogg; codecs="vorbis"') !== '';
  } catch {
    return false;
  }
}

function creaVideoNascosto(src: string) {
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  video.style.cssText =
    'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  video.src = src;
  document.body.appendChild(video);
  video.load();
  videoPreload.push(video);
  return video;
}

function creaAudio(src: string) {
  const audio = new Audio(src);
  audio.preload = 'auto';
  audio.volume = 1;
  return audio;
}

function preparaMedia() {
  if (mediaPronte) return;
  const variante = varianteScena(window.innerWidth);
  varianteScelta.value = variante;
  formatoScelto.value = rilevaFormato();
  formatoAudioScelto = rilevaOgg() ? 'ogg' : 'mp3';
  const audio = percorsiAudio(variante === 'mobile' ? 'mobile' : 'desktop');
  const estensione = formatoAudioScelto;
  audioBussata = creaAudio(audio.bussata[estensione]);
  audioTerzo = creaAudio(audio.terzo[estensione]);
  audioWhoosh = creaAudio(audio.whoosh[estensione]);
  const voci = percorsiVoce(variante === 'mobile' ? 'mobile' : 'desktop');
  audioSaluto = creaAudio(voci.saluto.mp3);
  audioCiao = creaAudio(voci.ciao.mp3);
  const formato = formatoScelto.value;
  const urlEntry = percorsoClip('entry', variante, formato);
  const urlIdle = percorsoClip('idle', variante, formato);
  if (clipAssentiInProva) {
    videoEntryPreload = { readyState: 0 } as HTMLVideoElement;
    videoIdlePreload = { readyState: 0 } as HTMLVideoElement;
  } else if (formato === 'webp') {
    // WebP: pronto solo dopo decode riuscito (altrimenti statico dopo staticoMs)
    const imgE = new Image();
    imgE.src = urlEntry;
    const imgI = new Image();
    imgI.src = urlIdle;
    videoEntryPreload = { readyState: 0 } as HTMLVideoElement;
    videoIdlePreload = { readyState: 0 } as HTMLVideoElement;
    const decE = imgE.decode ? imgE.decode() : Promise.resolve();
    decE
      .then(() => {
        videoEntryPreload = { readyState: 4 } as HTMLVideoElement;
      })
      .catch(() => {});
    const decI = imgI.decode ? imgI.decode() : Promise.resolve();
    decI
      .then(() => {
        videoIdlePreload = { readyState: 4 } as HTMLVideoElement;
      })
      .catch(() => {});
  } else {
    videoEntryPreload = creaVideoNascosto(urlEntry);
    videoIdlePreload = creaVideoNascosto(urlIdle);
  }
  mediaPronte = true;
}

/** Dopo «Fai entrare Tony»: le altre 7 clip una dopo l'altra. */
async function precaricaClipChat() {
  const variante = varianteScelta.value === 'mobile' ? 'mobile' : 'desktop';
  const formato = formatoScelto.value;
  const urls = percorsiClipDaPrecaricare(variante, formato);
  const nomi = [
    'entry',
    'idle',
    'listenRaise',
    'listenLoop',
    'listenLower',
    'thinking',
    'scrive',
    'talking',
    'exit',
  ];
  for (let i = 2; i < nomi.length; i += 1) {
    const nome = nomi[i];
    const url = urls[i];
    if (!url) continue;
    try {
      if (stageRef.value && typeof stageRef.value.precaricaClip === 'function') {
        await stageRef.value.precaricaClip(nome);
      } else if (formato === 'webp') {
        const img = new Image();
        img.src = url;
        await (img.decode ? img.decode() : Promise.resolve());
      } else {
        creaVideoNascosto(url);
      }
    } catch {
      /* clip non pronta: la scena resta su idle se serve */
    }
  }
}

function rilasciaPreload() {
  fermaAudio();
  rilasciaVoce();
  for (const video of videoPreload) {
    try {
      video.pause();
    } catch {
      /* già fermo */
    }
    video.removeAttribute('src');
    try {
      video.load();
    } catch {
      /* elemento già staccato */
    }
    if (video.parentNode) video.parentNode.removeChild(video);
  }
  videoPreload.length = 0;
  videoEntryPreload = null;
  videoIdlePreload = null;
  audioBussata = null;
  audioTerzo = null;
  audioWhoosh = null;
  audioSaluto = null;
  audioCiao = null;
  mediaPronte = false;
}

function fermaAudio() {
  for (const audio of [audioBussata, audioTerzo, audioWhoosh]) {
    if (!audio) continue;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      /* il browser non consente il reset */
    }
  }
}

function riproduci(audio: HTMLAudioElement | null) {
  if (!audio || !audioAttivo.value) return;
  try {
    audio.currentTime = 0;
    const promessa = audio.play();
    if (promessa && typeof promessa.catch === 'function') promessa.catch(() => {});
  } catch {
    /* audio bloccato: la scena continua in silenzio */
  }
}

function sblocca(audio: HTMLAudioElement | null) {
  if (!audio || !audioAttivo.value) return;
  try {
    const promessa = audio.play();
    if (promessa && typeof promessa.then === 'function') {
      promessa
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
        })
        .catch(() => {});
    }
  } catch {
    /* silenzio */
  }
}

type AudioSblocco = HTMLAudioElement & { sbloccoInCorso?: boolean };

function sbloccaVoce(audio: HTMLAudioElement | null) {
  if (!audio || !audioAttivo.value) return;
  const voce = audio as AudioSblocco;
  voce.sbloccoInCorso = true;
  try {
    const promessa = audio.play();
    if (promessa && typeof promessa.then === 'function') {
      promessa
        .then(() => {
          if (!voce.sbloccoInCorso) return;
          voce.sbloccoInCorso = false;
          audio.pause();
          try {
            audio.currentTime = 0;
          } catch {
            /* il browser non consente il reset */
          }
        })
        .catch(() => {
          voce.sbloccoInCorso = false;
        });
    }
  } catch {
    voce.sbloccoInCorso = false;
  }
}

function fineSblocco(audio: HTMLAudioElement | null) {
  if (!audio) return;
  (audio as AudioSblocco).sbloccoInCorso = false;
}

function creaContestoAudio() {
  try {
    const w = window as Window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext || w.webkitAudioContext;
    if (!Ctor) return null;
    return new Ctor();
  } catch {
    return null;
  }
}

function sbloccaContestoAudio() {
  if (!audioAttivo.value) return;
  try {
    if (!audioCtx) audioCtx = creaContestoAudio();
    if (!audioCtx) return;
    const promessa = audioCtx.resume();
    if (promessa && typeof promessa.catch === 'function') promessa.catch(() => {});
  } catch {
    /* senza analizzatore la bocca resta sul ripiego */
  }
}

function collegaAnalizzatore(audio: HTMLAudioElement) {
  if (!audioCtx || audioCtx.state !== 'running') return false;
  try {
    if (!analyser) {
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
    }
    if (!nodoSaluto) {
      nodoSaluto = audioCtx.createMediaElementSource(audio);
      nodoSaluto.connect(analyser);
      analyser.connect(audioCtx.destination);
    }
    return true;
  } catch {
    return false;
  }
}

function fermaLoopBocca() {
  if (rafBocca) cancelAnimationFrame(rafBocca);
  rafBocca = 0;
  ultimoSopraMs = 0;
}

function avviaLoopBocca() {
  if (rafBocca || !analyser) return;
  const nodo = analyser;
  const dati = new Uint8Array(nodo.fftSize);
  const tick = (ora: number) => {
    if (modoBocca !== 'volume' || !analyser) {
      rafBocca = 0;
      return;
    }
    nodo.getByteTimeDomainData(dati);
    const livello = livelloVoce(dati);
    if (livello >= SOGLIA_VOCE_ACCESA) ultimoSopraMs = ora;
    const msDaUltimo = ultimoSopraMs > 0 ? ora - ultimoSopraMs : 0;
    boccaAperta.value = prossimaBocca({
      aperta: boccaAperta.value,
      livello,
      msDaUltimoSopra: msDaUltimo,
    });
    rafBocca = requestAnimationFrame(tick);
  };
  rafBocca = requestAnimationFrame(tick);
}

function fermaSaluto() {
  generazioneVoce += 1;
  voceSalutoAttiva = false;
  fermaLoopBocca();
  boccaAperta.value = false;
  modoBocca = 'ferma';
  if (!audioSaluto) return;
  audioSaluto.onplaying = null;
  audioSaluto.onended = null;
  audioSaluto.onerror = null;
  try {
    audioSaluto.pause();
  } catch {
    /* già fermo */
  }
}

function rilasciaVoce() {
  generazioneVoce += 1;
  voceSalutoAttiva = false;
  fermaLoopBocca();
  boccaAperta.value = false;
  modoBocca = 'ferma';
  for (const audio of [audioSaluto, audioCiao]) {
    if (!audio) continue;
    audio.onplaying = null;
    audio.onended = null;
    audio.onerror = null;
    try {
      audio.pause();
    } catch {
      /* già fermo */
    }
  }
  try {
    nodoSaluto?.disconnect();
  } catch {
    /* già staccato */
  }
  try {
    analyser?.disconnect();
  } catch {
    /* già staccato */
  }
  nodoSaluto = null;
  analyser = null;
  const ctx = audioCtx;
  audioCtx = null;
  if (ctx) {
    try {
      const chiuso = ctx.close();
      if (chiuso && typeof chiuso.catch === 'function') chiuso.catch(() => {});
    } catch {
      /* già chiuso */
    }
  }
}

function onSalutoPlaying(gen: number) {
  if (gen !== generazioneVoce || voceSalutoAttiva) return;
  if (fase.value !== 'idle' && fase.value !== 'statico') return;
  voceSalutoAttiva = true;
  if (fase.value === 'idle') {
    if (modoBocca === 'continua') boccaAperta.value = true;
    if (modoBocca === 'volume') avviaLoopBocca();
  }
  fase.value = prossimoStato(fase.value, 'voceIniziata');
}

function onSalutoFinita(gen: number) {
  if (gen !== generazioneVoce) return;
  voceSalutoAttiva = false;
  fermaLoopBocca();
  boccaAperta.value = false;
  if (fase.value === 'parla') fase.value = prossimoStato('parla', 'voceFinita');
  salutoFinito.value = true;
}

function avviaSaluto() {
  if (fase.value !== 'idle' && fase.value !== 'statico') return;
  if (!audioSaluto) {
    salutoFinito.value = true;
    return;
  }
  const ctxPronto = !!(audioCtx && audioCtx.state === 'running');
  const decisione = deveParlare({
    audioAttivo: audioAttivo.value,
    riduciMovimento: riduciMovimento.value,
    analizzatoreDisponibile: ctxPronto,
  });
  if (!decisione.voce) {
    salutoFinito.value = true;
    return;
  }
  let bocca = decisione.bocca;
  if (bocca === 'volume' && !collegaAnalizzatore(audioSaluto)) bocca = 'continua';
  modoBocca = bocca;
  const gen = generazioneVoce;
  audioSaluto.onplaying = () => onSalutoPlaying(gen);
  audioSaluto.onended = () => onSalutoFinita(gen);
  audioSaluto.onerror = () => onSalutoFinita(gen);
  fra(tempiVoce().attesaMaxVoceMs, () => {
    if (gen !== generazioneVoce || voceSalutoAttiva) return;
    generazioneVoce += 1;
    if (!audioSaluto) return;
    audioSaluto.onplaying = null;
    audioSaluto.onended = null;
    audioSaluto.onerror = null;
    try {
      audioSaluto.pause();
    } catch {
      /* resta il testo nel fumetto */
    }
    salutoFinito.value = true;
  });
  fineSblocco(audioSaluto);
  try {
    audioSaluto.currentTime = 0;
    const promessa = audioSaluto.play();
    if (promessa && typeof promessa.catch === 'function') {
      promessa.catch(() => {
        /* autoplay bloccato: niente errore, il testo è già nel fumetto */
      });
    }
  } catch {
    /* silenzio */
  }
}

function programmaSaluto() {
  if (salutoProgrammato) return;
  if (fase.value !== 'idle' && fase.value !== 'statico') return;
  salutoProgrammato = true;
  fra(tempiVoce().ritardoSalutoMs, () => {
    if (fase.value !== 'idle' && fase.value !== 'statico') return;
    avviaSaluto();
  });
}

function provaChiudiUscita() {
  if (fase.value !== 'esce') return;
  if (uscitaClipFinita && uscitaVoceFinita) chiudiTutto();
}

function avviaCiao() {
  if (!audioCiao) {
    uscitaVoceFinita = true;
    provaChiudiUscita();
    return;
  }
  const fine = () => {
    if (uscitaVoceFinita) return;
    uscitaVoceFinita = true;
    provaChiudiUscita();
  };
  audioCiao.onended = fine;
  audioCiao.onerror = fine;
  fineSblocco(audioCiao);
  try {
    audioCiao.currentTime = 0;
    const promessa = audioCiao.play();
    if (promessa && typeof promessa.then === 'function') {
      promessa.catch(() => fine());
    }
  } catch {
    fine();
  }
}

function fra(ms: number, fn: () => void) {
  const id = window.setTimeout(fn, ms);
  timerIds.push(id);
}

function pulisciTempo() {
  for (const id of timerIds) window.clearTimeout(id);
  timerIds.length = 0;
  for (const id of intervalli) window.clearInterval(id);
  intervalli.length = 0;
}

function alTempo(inizio: number, ms: number, fn: () => void) {
  const attesa = ms - (Date.now() - inizio);
  if (attesa <= 0) fn();
  else fra(attesa, fn);
}

function scuoti(px: number, durataMs: number) {
  shakePx.value = px;
  fra(durataMs, () => {
    if (shakePx.value === px) shakePx.value = 0;
  });
}

function clipPronta(video: HTMLVideoElement | null) {
  return !!video && video.readyState >= 3;
}

function ripristinaFocus() {
  const el = pulsanteOrigine.value;
  if (el && typeof el.focus === 'function') el.focus();
}

function chiudiTutto() {
  pulisciTempo();
  salutoProgrammato = false;
  salutoFinito.value = false;
  uscitaClipFinita = false;
  uscitaVoceFinita = false;
  if (fase.value === 'esce') fase.value = prossimoStato('esce', 'uscitaFinita');
  else fase.value = 'nascosto';
  stageAperto.value = false;
  avvisoAperto.value = false;
  avvisoInChiusura.value = false;
  improntaAccesa.value = false;
  shakePx.value = 0;
  rilasciaPreload();
  ripristinaFocus();
}

function saluta() {
  if (fase.value === 'esce') return;
  if (fase.value === 'modulo' || registrazioneCompletata.value) return;
  const prima = fase.value;
  const dopo = prossimoStato(prima, 'saluta');
  pulisciTempo();
  fermaSaluto();
  fermaAudio();
  try {
    navigator.vibrate(0);
  } catch {
    /* niente vibrazione da fermare */
  }
  shakePx.value = 0;
  improntaAccesa.value = false;
  if (dopo !== 'esce') {
    chiudiTutto();
    return;
  }
  const statiConVoce = [
    'idle',
    'parla',
    'statico',
    'ascolta',
    'pensa',
    'scrive',
  ];
  const conVoce = statiConVoce.indexOf(prima) >= 0 && audioAttivo.value;
  uscitaClipFinita = false;
  uscitaVoceFinita = !conVoce;
  uscitaConClip.value =
    (prima === 'idle' ||
      prima === 'entra' ||
      prima === 'parla' ||
      prima === 'ascolta' ||
      prima === 'pensa' ||
      prima === 'scrive') &&
    !riduciMovimento.value;
  fase.value = 'esce';
  if (conVoce) avviaCiao();
  fra(tempiVoce().attesaMaxUscitaMs, () => {
    if (fase.value === 'esce') chiudiTutto();
  });
}

function onApriModulo() {
  if (fase.value === 'esce' || fase.value === 'nascosto') return;
  fase.value = prossimoStato(fase.value, 'apriModulo');
}

function onChiudiModulo() {
  if (fase.value !== 'modulo') return;
  fase.value = prossimoStato('modulo', 'chiudiModulo');
}

function onRegistrazioneCompletata() {
  registrazioneCompletata.value = true;
}

function onEntrataFinita() {
  if (fase.value !== 'entra') return;
  fase.value = prossimoStato('entra', 'entrataFinita');
  void precaricaClipChat();
}

function onAscoltoIniziato() {
  if (fase.value === 'idle') fase.value = prossimoStato('idle', 'ascoltoIniziato');
}

function onAscoltoFinito() {
  if (fase.value === 'ascolta') fase.value = prossimoStato('ascolta', 'ascoltoFinito');
}

function onDomandaInviata() {
  if (fase.value === 'idle' || fase.value === 'ascolta') {
    fase.value = prossimoStato(fase.value, 'domandaInviata');
  }
}

function onTestoArrivato() {
  if (fase.value === 'pensa') fase.value = prossimoStato('pensa', 'testoArrivato');
}

function onRispostaFinita() {
  if (fase.value === 'pensa' || fase.value === 'scrive' || fase.value === 'ascolta') {
    fase.value = prossimoStato(fase.value, 'rispostaFinita');
  }
}

function onVoceIniziata() {
  if (fase.value === 'pensa' || fase.value === 'scrive' || fase.value === 'idle') {
    fase.value = prossimoStato(fase.value, 'voceIniziata');
  }
}

function onVoceFinita() {
  if (fase.value === 'parla') {
    fase.value = prossimoStato('parla', 'voceFinita');
  }
}

function onServizioSpento() {
  if (fase.value === 'esce' || fase.value === 'nascosto') return;
  fase.value = prossimoStato(fase.value, 'servizioSpento');
  salutoFinito.value = true;
}

function onClipNonPronta() {
  if (fase.value !== 'bussa' && fase.value !== 'entra') return;
  fase.value = prossimoStato(fase.value, 'clipNonPronta');
}

function onUscitaFinita() {
  uscitaClipFinita = true;
  provaChiudiUscita();
}

function vaiEntrata() {
  if (fase.value !== 'bussa') return;
  fase.value = prossimoStato('bussa', 'bussataFinita');
  riproduci(audioWhoosh);
}

function vaiStatico() {
  if (fase.value !== 'bussa' && fase.value !== 'entra') return;
  fase.value = prossimoStato(fase.value, 'clipNonPronta');
  riproduci(audioWhoosh);
}

function provaEntrata(inizio: number, staticoMs: number) {
  if (fase.value !== 'bussa') return;
  if (clipPronta(videoEntryPreload)) {
    vaiEntrata();
    return;
  }
  riproduci(audioTerzo);
  const id = window.setInterval(() => {
    if (fase.value !== 'bussa') {
      window.clearInterval(id);
      return;
    }
    if (clipPronta(videoEntryPreload)) {
      window.clearInterval(id);
      vaiEntrata();
      return;
    }
    if (Date.now() - inizio >= staticoMs) {
      window.clearInterval(id);
      vaiStatico();
    }
  }, 100);
  intervalli.push(id);
}

function attendiIdle(inizio: number, staticoMs: number) {
  const prova = () => {
    if (fase.value !== 'bussa') return true;
    if (clipPronta(videoIdlePreload)) {
      fase.value = prossimoStato('bussa', 'bussataFinita');
      fase.value = prossimoStato('entra', 'entrataFinita');
      return true;
    }
    if (Date.now() - inizio >= staticoMs) {
      vaiStatico();
      return true;
    }
    return false;
  };
  if (prova()) return;
  const id = window.setInterval(() => {
    if (prova()) window.clearInterval(id);
  }, 80);
  intervalli.push(id);
}

function partiCronometro() {
  const inizio = Date.now();
  const variante = varianteScelta.value === 'mobile' ? 'mobile' : 'desktop';
  const tempi = tempiScena({
    variante,
    riduciMovimento: riduciMovimento.value,
  });
  if (audioAttivo.value) {
    riproduci(audioBussata);
    sblocca(audioTerzo);
    sblocca(audioWhoosh);
    sbloccaContestoAudio();
    sbloccaVoce(audioSaluto);
    sbloccaVoce(audioCiao);
  }
  if (riduciMovimento.value) {
    attendiIdle(inizio, tempi.staticoMs);
    return;
  }
  tempi.colpiMs.forEach((ms, i) => {
    const base = tempi.scossonePx[i] || 0;
    const px = i % 2 === 0 ? base : -base;
    alTempo(inizio, ms, () => scuoti(px, tempi.durataScossoneMs));
  });
  if (tempi.impronta) {
    const impronta = tempi.impronta;
    alTempo(inizio, impronta.aMs, () => {
      improntaAccesa.value = true;
      fra(impronta.durataMs, () => {
        improntaAccesa.value = false;
      });
    });
  }
  if (
    dovrebbeVibrare({
      variante,
      haVibrate: typeof navigator.vibrate === 'function',
      riduciMovimento: false,
    })
  ) {
    alTempo(inizio, tempi.vibrazioneMs, () => {
      try {
        navigator.vibrate(SCHEMA_VIBRAZIONE);
      } catch {
        /* iPhone, o il browser ha rifiutato */
      }
    });
  }
  alTempo(inizio, tempi.entrataMs, () => provaEntrata(inizio, tempi.staticoMs));
}

function avviaScena() {
  if (stageAperto.value) return;
  aggiornaRiduci();
  const ora = varianteScena(window.innerWidth);
  if (mediaPronte && ora !== varianteScelta.value) rilasciaPreload();
  preparaMedia();
  let stato = fase.value;
  if (stato === 'nascosto') stato = prossimoStato(stato, 'apri');
  if (stato === 'avviso') stato = prossimoStato(stato, 'conferma');
  fase.value = stato;
  stageAperto.value = true;
  partiCronometro();
}

function onVuoiProvare(ev: MouseEvent) {
  const target = ev.currentTarget;
  pulsanteOrigine.value = target instanceof HTMLElement ? target : null;
  aggiornaRiduci();
  preparaMedia();
  const presa = leggiPresaVisione(storagePagina(), VERSIONE_AVVISO_TONY);
  if (presa.vista) {
    audioAttivo.value = presa.audio !== false;
    avviaScena();
    return;
  }
  fase.value = prossimoStato('nascosto', 'apri');
  avvisoAperto.value = true;
}

function onConferma(payload: { audio?: boolean }) {
  audioAttivo.value = payload?.audio !== false;
  salvaPresaVisione(
    storagePagina(),
    VERSIONE_AVVISO_TONY,
    new Date().toISOString(),
    audioAttivo.value
  );
  avvisoInChiusura.value = true;
  const tempi = tempiScena({
    variante: varianteScelta.value === 'mobile' ? 'mobile' : 'desktop',
    riduciMovimento: riduciMovimento.value,
  });
  avviaScena();
  window.setTimeout(() => {
    avvisoAperto.value = false;
    avvisoInChiusura.value = false;
  }, tempi.dissolvenzaAvvisoMs);
}

function onRinuncia() {
  if (stageAperto.value) return;
  fase.value = prossimoStato(fase.value === 'avviso' ? 'avviso' : fase.value, 'rinuncia');
  if (fase.value !== 'nascosto') fase.value = 'nascosto';
  avvisoAperto.value = false;
  avvisoInChiusura.value = false;
  rilasciaPreload();
  ripristinaFocus();
}

function onEscGlobale(e: KeyboardEvent) {
  if (e.key !== 'Escape') return;
  if (avvisoAperto.value && !avvisoInChiusura.value) return;
  if (!stageAperto.value) return;
  if (fase.value === 'modulo' || registrazioneCompletata.value) {
    const target = e.target as HTMLElement | null;
    if (target && target.closest && target.closest('.tony-reg')) {
      // Esc nel modulo = Annulla (gestito da TonyRegistrazione)
      return;
    }
    return;
  }
  e.preventDefault();
  saluta();
}

watch(fase, (nuova, precedente) => {
  if (nuova === precedente) return;
  if (nuova === 'idle' || nuova === 'statico') {
    programmaSaluto();
    if (nuova === 'statico' && precedente !== 'idle' && precedente !== 'parla') {
      // clip non pronte: chat disponibile subito
      salutoFinito.value = true;
    }
  }
});

onMounted(() => {
  document.title = t.documentTitle;
  if (!tonyOn) return;
  window.addEventListener('keydown', onEscGlobale);
  if (import.meta.env.DEV) {
    import('../lib/tony-chat-finto.js')
      .then((m) => {
        if (typeof m.clipFinteAssenti === 'function') {
          clipAssentiInProva = m.clipFinteAssenti(
            typeof window !== 'undefined' ? window.location.search : ''
          );
        }
      })
      .catch(() => {});
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', onEscGlobale);
  pulisciTempo();
  rilasciaPreload();
});

/** Icone emoji per id voce piano (stesse nei blocchi gratuito e Base). */
const iconePianoEmoji: Record<string, string> = {
  terreni: '🌾',
  poderi: '🏡',
  diario: '📋',
  statistiche: '📈',
};

const iconeModuli: Record<string, string> = {
  'Squadre e ore': '👷',
  'Parco macchine': '🚜',
  Magazzino: '📦',
  'Conto terzi': '🤝',
  Vigneto: '🍇',
  Frutteto: '🍎',
  Seminativo: '🌱',
  Meteo: '⛅',
  Report: '📊',
};

/** Icone immagine tonde (Tony Guida / Tony Avanzato). */
const iconeImgPerId: Record<string, string> = {
  'tony-guida': tonyIcon,
};

const iconeModuliImg: Record<string, string> = {
  'Tony Avanzato': tonyIcon,
};
</script>

<template>
  <div class="landing">
    <div
      class="landing-pagina"
      :class="{ 'landing-pagina--tony': stageAperto && varianteScelta === 'mobile' }"
      :style="stileScossone"
    >
    <header class="topbar">
      <a class="brand-link" href="#inizio">
        <img
          class="brand-mark"
          :src="logoMark"
          width="48"
          height="48"
          :alt="t.brand"
          decoding="async"
        />
        <span class="brand-name">{{ t.brand }}</span>
      </a>
      <a class="login-link" :href="URL_LOGIN">{{ t.hero.linkAccedi }}</a>
    </header>

    <main id="inizio">
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-copy">
          <h1 id="hero-title">{{ t.hero.titolo }}</h1>
          <p class="hero-sub">{{ t.hero.sottotitolo }}</p>

          <div class="hero-cta hero-cta--desktop">
            <a v-if="!tonyOn" class="btn-primary" :href="URL_REGISTRAZIONE">
              <span class="btn-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M8 11v2M12 10v4M16 11v2"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                  <path
                    d="M5 8c0-1.5 1.2-3 3.2-3h7.6C17.8 5 19 6.5 19 8v4c0 3.5-2.5 6.5-7 8.5C7.5 18.5 5 15.5 5 12V8z"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              {{ t.hero.ctaPrincipale }}
            </a>
            <button v-else type="button" class="btn-primary" @click="onVuoiProvare">
              <span class="btn-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M8 11v2M12 10v4M16 11v2"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                  <path
                    d="M5 8c0-1.5 1.2-3 3.2-3h7.6C17.8 5 19 6.5 19 8v4c0 3.5-2.5 6.5-7 8.5C7.5 18.5 5 15.5 5 12V8z"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              {{ t.hero.ctaPrincipale }}
            </button>
            <p class="cta-note">{{ t.hero.gratisNota }}</p>
            <a class="link-secondary" :href="URL_REGISTRAZIONE">{{
              t.hero.linkRegistrazione
            }}</a>
          </div>
        </div>

        <div class="hero-media">
          <VideoTony />
          <!-- BOZZA: da far rivedere — subito sotto il video su tutti gli schermi -->
          <section class="prezzi" aria-labelledby="prezzi-title">
            <h2 id="prezzi-title" class="sr-only">{{ t.prezzi.titoloSezione }}</h2>
            <p>{{ prezzi.gratis }}</p>
            <p>{{ prezzi.moduli }}</p>
          </section>
        </div>

        <div class="hero-cta hero-cta--mobile">
          <a v-if="!tonyOn" class="btn-primary" :href="URL_REGISTRAZIONE">
            <span class="btn-icon" aria-hidden="true">👋</span>
            {{ t.hero.ctaPrincipale }}
          </a>
          <button v-else type="button" class="btn-primary" @click="onVuoiProvare">
            <span class="btn-icon" aria-hidden="true">👋</span>
            {{ t.hero.ctaPrincipale }}
          </button>
          <p class="cta-note">{{ t.hero.gratisNota }}</p>
          <a class="link-secondary" :href="URL_REGISTRAZIONE">{{
            t.hero.linkRegistrazione
          }}</a>
        </div>
      </section>

      <section class="come-aiuta" aria-labelledby="come-title">
        <h2 id="come-title">{{ t.comeAiuta.titolo }}</h2>
        <ol>
          <li v-for="(punto, i) in t.comeAiuta.punti" :key="i">
            <strong>{{ punto.titolo }}</strong>
            <span>{{ punto.testo }}</span>
          </li>
        </ol>
      </section>

      <section class="semplice" aria-labelledby="semplice-title">
        <h2 id="semplice-title">{{ t.semplice.titolo }}</h2>
        <ul>
          <li v-for="(frase, i) in t.semplice.frasi" :key="i">{{ frase }}</li>
        </ul>
      </section>

      <section class="cosa-gestisci" aria-labelledby="gestisci-title">
        <h2 id="gestisci-title">{{ t.cosaGestisci.titolo }}</h2>

        <div class="piani-confronto">
          <div class="piano-blocco">
            <h3>{{ pianiCosaGestisci.gratisTitolo }}</h3>
            <ul class="chips">
              <li
                v-for="voce in pianiCosaGestisci.gratis"
                :key="'gratis-' + voce.id"
                class="chip"
              >
                <img
                  v-if="iconeImgPerId[voce.id]"
                  class="chip-icon-img"
                  :src="iconeImgPerId[voce.id]"
                  alt=""
                  width="18"
                  height="18"
                  decoding="async"
                  aria-hidden="true"
                />
                <span v-else aria-hidden="true">{{
                  iconePianoEmoji[voce.id] || '•'
                }}</span>
                <span class="chip-label">
                  {{ voce.nome
                  }}<span v-if="voce.dettaglio" class="chip-limite">
                    — {{ voce.dettaglio }}</span
                  >
                </span>
              </li>
            </ul>
          </div>

          <div class="piano-blocco">
            <h3>{{ pianiCosaGestisci.baseTitolo }}</h3>
            <ul class="chips">
              <li
                v-for="voce in pianiCosaGestisci.base"
                :key="'base-' + voce.id"
                class="chip"
              >
                <img
                  v-if="iconeImgPerId[voce.id]"
                  class="chip-icon-img"
                  :src="iconeImgPerId[voce.id]"
                  alt=""
                  width="18"
                  height="18"
                  decoding="async"
                  aria-hidden="true"
                />
                <span v-else aria-hidden="true">{{
                  iconePianoEmoji[voce.id] || '•'
                }}</span>
                <span class="chip-label">{{ voce.nome }}</span>
              </li>
            </ul>
          </div>
        </div>

        <h3 class="moduli-titolo">{{ t.cosaGestisci.moduliTitolo }}</h3>
        <ul class="chips">
          <li v-for="chip in t.cosaGestisci.moduli" :key="chip" class="chip">
            <img
              v-if="iconeModuliImg[chip]"
              class="chip-icon-img"
              :src="iconeModuliImg[chip]"
              alt=""
              width="18"
              height="18"
              decoding="async"
              aria-hidden="true"
            />
            <span v-else aria-hidden="true">{{ iconeModuli[chip] || '•' }}</span>
            {{ chip }}
          </li>
          <li class="chip chip--muted">{{ t.cosaGestisci.inArrivo }}</li>
        </ul>
      </section>

      <section class="fiducia" aria-labelledby="fiducia-title">
        <h2 id="fiducia-title">{{ t.fiducia.titolo }}</h2>
        <div v-if="mostraChiSiamo" class="chi-siamo">
          <img
            class="foto-pier"
            :src="FOTO_PIER_URL"
            alt="Pierpaolo Rossi"
            width="120"
            height="120"
            decoding="async"
          />
          <p class="chi-siamo-testo">{{ TESTO_CHI_SIAMO }}</p>
        </div>
        <p class="dati-europa">{{ t.fiducia.datiEuropa }}</p>
      </section>

      <section class="chiusura" aria-labelledby="chiusura-title">
        <h2 id="chiusura-title">{{ t.chiusura.titolo }}</h2>
        <a v-if="!tonyOn" class="btn-primary" :href="URL_REGISTRAZIONE">
          <span class="btn-icon" aria-hidden="true">👋</span>
          {{ t.chiusura.cta }}
        </a>
        <button v-else type="button" class="btn-primary" @click="onVuoiProvare">
          <span class="btn-icon" aria-hidden="true">👋</span>
          {{ t.chiusura.cta }}
        </button>
      </section>
    </main>

    <footer class="footer">
      <!-- BOZZA: da far rivedere -->
      <p>
        {{ t.footer.offertoDa
        }}<template v-if="EMAIL_CONTATTO">
          —
          <a :href="'mailto:' + EMAIL_CONTATTO">{{ EMAIL_CONTATTO }}</a>
        </template>
      </p>
      <nav class="footer-links" aria-label="Informazioni legali">
        <a :href="PAGINE_LEGALI.termini.percorso">{{ t.footer.linkTermini }}</a>
        <a :href="PAGINE_LEGALI.privacy.percorso">{{ t.footer.linkPrivacy }}</a>
        <a :href="PAGINE_LEGALI.cookie.percorso">{{ t.footer.linkCookie }}</a>
      </nav>
    </footer>
    </div>
    <div v-if="improntaAccesa" class="impronta" aria-hidden="true"></div>
    <TonyAvviso
      v-if="tonyOn && avvisoAperto"
      :in-chiusura="avvisoInChiusura"
      @conferma="onConferma"
      @rinuncia="onRinuncia"
    />
    <TonyStage
      v-if="tonyOn && stageAperto"
      ref="stageRef"
      :fase="fase"
      :variante="varianteScelta"
      :formato="formatoScelto"
      :riduci-movimento="riduciMovimento"
      :uscita-con-clip="uscitaConClip"
      :bocca-aperta="boccaAperta"
      :saluto-finito="salutoFinito"
      :audio-attivo="audioAttivo"
      @entrata-finita="onEntrataFinita"
      @uscita-finita="onUscitaFinita"
      @saluta="saluta"
      @clip-non-pronta="onClipNonPronta"
      @ascolto-iniziato="onAscoltoIniziato"
      @ascolto-finito="onAscoltoFinito"
      @domanda-inviata="onDomandaInviata"
      @testo-arrivato="onTestoArrivato"
      @risposta-finita="onRispostaFinita"
      @servizio-spento="onServizioSpento"
      @voce-iniziata="onVoceIniziata"
      @voce-finita="onVoceFinita"
      @apri-modulo="onApriModulo"
      @chiudi-modulo="onChiudiModulo"
      @registrazione-completata="onRegistrazioneCompletata"
    />
  </div>
</template>

<style scoped>
.landing-pagina--tony {
  padding-bottom: 46vh;
}

.impronta {
  position: fixed;
  right: 1.4rem;
  bottom: 1.4rem;
  z-index: 35;
  width: 76px;
  height: 46px;
  pointer-events: none;
  background:
    radial-gradient(ellipse 14px 20px at 18% 62%, rgba(6, 20, 14, 0.38), transparent 72%),
    radial-gradient(ellipse 14px 20px at 50% 38%, rgba(6, 20, 14, 0.32), transparent 72%),
    radial-gradient(ellipse 14px 20px at 82% 64%, rgba(6, 20, 14, 0.38), transparent 72%);
}

.landing {
  --green-deep: #071910;
  --green-mid: #0f4d32;
  --green-bright: #158050;
  --ink: #06140e;
  --ink-soft: #1a2e24;
  --paper: #f7faf8;
  --line: rgba(15, 77, 50, 0.12);

  min-height: 100vh;
  color: var(--ink);
  background:
    radial-gradient(ellipse 90% 50% at 10% -10%, rgba(21, 128, 80, 0.12), transparent 55%),
    linear-gradient(180deg, #ffffff 0%, var(--paper) 100%);
  font-family:
    'Plus Jakarta Sans',
    system-ui,
    -apple-system,
    sans-serif;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.topbar {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  max-width: 1120px;
  margin: 0 auto;
  padding: 0.85rem 1.25rem;
}

.brand-link {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
  text-decoration: none;
  color: var(--green-mid);
  font-weight: 800;
}

.brand-mark {
  display: block;
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 10px;
}

.brand-name {
  font-size: clamp(0.95rem, 3.2vw, 1.15rem);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.login-link {
  flex-shrink: 0;
  font-size: 0.85rem;
  color: #4a6358;
  text-decoration: underline;
  text-underline-offset: 3px;
  white-space: nowrap;
}

main {
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 1.25rem 3rem;
}

.hero {
  display: grid;
  gap: 1.5rem;
  padding: 1rem 0 0.5rem;
}

.hero h1 {
  margin: 0 0 0.85rem;
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  line-height: 1.15;
  letter-spacing: -0.03em;
  color: var(--ink);
}

.hero-sub {
  margin: 0;
  font-size: clamp(1.05rem, 2.2vw, 1.2rem);
  line-height: 1.55;
  color: var(--ink-soft);
  font-weight: 500;
  max-width: 42ch;
}

.hero-cta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.45rem;
  margin-top: 1.25rem;
}

.hero-cta--desktop {
  display: none;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.9rem 1.35rem;
  border-radius: 999px;
  background: var(--green-mid);
  color: #fff;
  font-weight: 700;
  font-size: 1.05rem;
  text-decoration: none;
  box-shadow: 0 10px 24px rgba(15, 77, 50, 0.28);
}

.btn-primary:hover {
  background: var(--green-bright);
}

button.btn-primary {
  border: 0;
  cursor: pointer;
  font-family: inherit;
}

button.btn-primary:focus-visible,
.btn-primary:focus-visible {
  outline: 3px solid var(--green-bright);
  outline-offset: 3px;
}

.btn-icon {
  display: inline-flex;
  line-height: 1;
}

.cta-note {
  margin: 0.35rem 0 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--ink-soft);
}

.link-secondary {
  margin-top: 0.35rem;
  font-size: 0.95rem;
  color: var(--green-mid);
  font-weight: 600;
}

.hero-media {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.prezzi {
  margin: 0;
  padding: 1.25rem 1.15rem;
  border-radius: 16px;
  background: rgba(15, 77, 50, 0.06);
  border: 1px solid var(--line);
}

.prezzi p {
  margin: 0 0 0.85rem;
  font-size: 0.98rem;
  line-height: 1.6;
  color: var(--ink-soft);
}

.prezzi p:last-child {
  margin-bottom: 0;
}

.come-aiuta,
.semplice,
.cosa-gestisci,
.fiducia,
.chiusura {
  margin-top: 2.75rem;
}

h2 {
  margin: 0 0 1rem;
  font-size: clamp(1.35rem, 3vw, 1.7rem);
  letter-spacing: -0.02em;
  color: var(--green-mid);
}

.come-aiuta ol {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.9rem;
}

.come-aiuta li {
  padding: 1rem 1.1rem;
  border-radius: 14px;
  background: #fff;
  border: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.come-aiuta strong {
  color: var(--ink);
  font-size: 1.05rem;
}

.come-aiuta span {
  color: var(--ink-soft);
  line-height: 1.55;
}

.semplice ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.65rem;
}

.semplice li {
  padding: 0.85rem 1rem;
  border-left: 4px solid var(--green-bright);
  background: rgba(21, 128, 80, 0.06);
  border-radius: 0 12px 12px 0;
  font-weight: 600;
  color: var(--ink-soft);
  line-height: 1.5;
}

.cosa-gestisci h3 {
  margin: 0 0 0.65rem;
  font-size: 1rem;
  color: var(--ink);
}

.piani-confronto {
  display: grid;
  gap: 1.5rem;
  margin-top: 1rem;
}

.piano-blocco {
  margin: 0;
}

.moduli-titolo {
  margin-top: 1.75rem;
}

@media (min-width: 1024px) {
  .piani-confronto {
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem 2rem;
    align-items: start;
  }
}

.chips {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.8rem;
  border-radius: 999px;
  background: #fff;
  border: 1px solid var(--line);
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--ink-soft);
}

.chip-label {
  display: inline;
  line-height: 1.35;
}

.chip-limite {
  font-size: 0.82em;
  font-weight: 500;
  color: #5a7266;
}

.chip-icon-img {
  width: 1.15em;
  height: 1.15em;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  display: block;
}

.chip--muted {
  background: #e8eeeA;
  color: #5a6b62;
  border-color: transparent;
}

.fiducia .dati-europa {
  margin: 1rem 0 0;
  color: var(--ink-soft);
  line-height: 1.55;
}

.chi-siamo {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  margin-top: 1rem;
}

.foto-pier {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  object-fit: cover;
}

.chi-siamo-testo {
  margin: 0;
  white-space: pre-line;
  line-height: 1.55;
  color: var(--ink-soft);
}

.chiusura {
  text-align: center;
  padding: 2rem 1rem;
  border-radius: 20px;
  background: linear-gradient(160deg, rgba(15, 77, 50, 0.1), rgba(21, 128, 80, 0.04));
}

.chiusura .btn-primary {
  margin-top: 0.5rem;
}

.footer {
  max-width: 1120px;
  margin: 0 auto;
  padding: 2rem 1.25rem 2.5rem;
  border-top: 1px solid var(--line);
  color: #4a6358;
  font-size: 0.9rem;
  line-height: 1.55;
}

.footer a {
  color: var(--green-mid);
}

.footer-links {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 0.85rem;
}

/* Desktop: copy a sinistra, video (+ prezzi sotto) a destra; CTA nel copy */
@media (min-width: 1024px) {
  .hero {
    grid-template-columns: 1fr 1.05fr;
    align-items: start;
    gap: 2rem 2.5rem;
  }

  .hero-cta--desktop {
    display: flex;
  }

  .hero-cta--mobile {
    display: none;
  }
}

/* Telefono: titolo/sottotitolo → video 4:5 → CTA subito dopo */
@media (max-width: 767px) {
  .hero {
    display: flex;
    flex-direction: column;
  }

  .hero-cta--desktop {
    display: none;
  }

  .hero-cta--mobile {
    display: flex;
    order: 3;
  }

  .hero-copy {
    order: 1;
  }

  .hero-media {
    order: 2;
  }
}
</style>
