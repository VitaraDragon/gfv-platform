<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { URL_REGISTRAZIONE } from '../config/landing-config.js';
import { testiLanding } from '../content/testi-landing.js';
import { tempiVoce } from '../lib/tony-bussa-logica.js';
import { chiediATony } from '../lib/tony-chat-client.js';
import {
  MAX_CARATTERI_DOMANDA,
  MESSAGGI_CHAT,
  azionePerEsito,
  aggiornaStoria,
  modoVoce,
  nuovaSessione,
  validaDomanda,
} from '../lib/tony-chat-logica.js';
import { chiediVoce } from '../lib/tony-voce-client.js';
import { creaPlayerVoce } from '../lib/tony-voce-player.js';
import {
  PASSI_AIUTO,
  prossimoPasso,
  unisciDati,
} from '../lib/tony-aiuto-account.js';
import { percorsoVoceFatto } from '../lib/tony-bussa-logica.js';
import TonyRegistrazione from './TonyRegistrazione.vue';
import TonySchedaConferma from './TonySchedaConferma.vue';

const props = defineProps<{
  ottieniToken: () => Promise<string | null>;
  ottieniTokenAccesso?: () => Promise<string | null>;
  salvaAzienda?: (dati: object) => Promise<any>;
  variante: string;
  riduciMovimento: boolean;
  salutoFinito: boolean;
  protezionePronta: boolean | null;
  staticoForzato: boolean;
  audioIniziale: boolean;
  moduloDisponibile: boolean;
}>();

const emit = defineEmits([
  'ascoltoIniziato',
  'ascoltoFinito',
  'domandaInviata',
  'testoArrivato',
  'rispostaFinita',
  'servizioSpento',
  'saluta',
  'voceIniziata',
  'voceFinita',
  'apri-modulo',
  'chiudi-modulo',
  'registrazione-completata',
  'invio-in-corso',
  'argomento',
  'vai-dashboard',
]);

const t = testiLanding.tonyBussa;
const ta = t.aiuto;

type Battuta = {
  ruolo: 'utente' | 'tony' | 'nascosta';
  testo: string;
  live?: boolean;
};

const campo = ref('');
const inAttesa = ref(false);
const campoAttivo = ref(true);
const moduloAperto = ref(false);
const registrazioneCompletata = ref(false);
const chipVisibili = ref(true);
const invioInCorso = ref(false);
/** Fase aiuto account (passo 14). */
const faseAiuto = ref(false);
const passoAiuto = ref<string | null>(null);
const datiAiuto = ref<{
  sede: any;
  poderi: any[];
  terreni: any[];
}>({ sede: null, poderi: [], terreni: [] });
const schedaAperta = ref(false);
const aiutoFatto = ref(false);
const aiutoSospeso = ref(false);
const argomentiSuonati = new Set<string>();
/** Stato del campo/chip/evidenza prima di aprire il modulo (R1). */
let statoPrimaDelModulo: {
  campoAttivo: boolean;
  chipVisibili: boolean;
  mostraAccountEvidenza: boolean;
} | null = null;
const messaggi = ref<Battuta[]>([]);
const storia = ref<Array<{ ruolo: 'utente' | 'tony'; testo: string }>>([]);
const sessione = ref(nuovaSessione(
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? () => crypto.randomUUID()
    : undefined
));
const microfonoDisponibile = ref(false);
const microfonoAscolta = ref(false);
const microfonoNascosto = ref(false);
const mostraAccountEvidenza = ref(false);
const modalitàStatica = ref(false);
const scenarioFinto = ref<string | null>(null);
const notaFinto = ref('');
const testoParziale = ref('');
const listaMessaggi = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLInputElement | null>(null);
const altoparlante = ref(props.audioIniziale !== false);
const altoparlanteVisibile = ref(false);
const mostraAscolta = ref(false);
const voceInCorso = ref(false);
const voceParlandoSr = ref(false);

let recognition: any = null;
let abortCorrente: AbortController | null = null;
let abortVoce: AbortController | null = null;
let timerFuoco = 0;
let ascoltoEmesso = false;
let smontato = false;
let risposteVocaliAutomatiche = 0;
let blobAscolta: Blob | null = null;
let metaVoce: { idVoce: string; testo: string } | null = null;
let chiediVoceFn: typeof chiediVoce = chiediVoce;
let scenarioVoceFinta: string | null = null;
const playerVoce = creaPlayerVoce();

const contatoreVisibile = computed(() => {
  const n = campo.value.length;
  return n >= MAX_CARATTERI_DOMANDA - 50;
});

const chatVisibile = computed(
  () =>
    props.salutoFinito &&
    !modalitàStatica.value &&
    !props.staticoForzato &&
    props.protezionePronta !== false
);

const mobile = computed(() => props.variante === 'mobile');

onMounted(() => {
  const SR =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;
  microfonoDisponibile.value = typeof SR === 'function';
  document.addEventListener('visibilitychange', onVisibility);
  if (import.meta.env.DEV) {
    const query = typeof window !== 'undefined' ? window.location.search : '';
    import('../lib/tony-chat-finto.js')
      .then((m) => {
        if (smontato) return;
        const sc = m.parametroFinto(query);
        scenarioFinto.value = sc;
        if (sc) notaFinto.value = m.NOTA_MODELLO_FINTO;
      })
      .catch(() => {});
  }
});

watch(scenarioFinto, async (sc) => {
  if (!import.meta.env.DEV || !sc) return;
  try {
    const { chiediVoceFinta, parametroVoceFinta, NOTA_VOCE_FINTA } = await import('../lib/tony-voce-finta.js');
    if (smontato) return;
    const query = typeof window !== 'undefined' ? window.location.search : '';
    scenarioVoceFinta = parametroVoceFinta(query);
    chiediVoceFn = (args) =>
      chiediVoceFinta({
        ...args,
        scenario: scenarioVoceFinta || 'ok',
      }) as Promise<any>;
    if (notaFinto.value && !notaFinto.value.includes(NOTA_VOCE_FINTA)) {
      notaFinto.value = notaFinto.value + ' · ' + NOTA_VOCE_FINTA;
    }
  } catch {
    /* modulo sviluppo non disponibile */
  }
});

watch(
  () => props.salutoFinito,
  (finito) => {
    if (!finito) return;
    if (props.protezionePronta === false && !scenarioFinto.value) {
      passaAStatico(MESSAGGI_CHAT.spento);
      return;
    }
    nextTick(() => inputEl.value?.focus());
  }
);

watch(
  () => props.protezionePronta,
  (pronta) => {
    if (pronta === false && props.salutoFinito && !scenarioFinto.value && !modalitàStatica.value) {
      passaAStatico(MESSAGGI_CHAT.spento);
    }
  }
);

watch(
  () => props.staticoForzato,
  (v) => {
    if (v) modalitàStatica.value = true;
  }
);

function passaAStatico(testo: string) {
  modalitàStatica.value = true;
  campoAttivo.value = false;
  chipVisibili.value = false;
  testoParziale.value = '';
  inAttesa.value = false;
  fermaMicrofono();
  if (abortCorrente) abortCorrente.abort();
  messaggi.value.push({ ruolo: 'tony', testo });
  emit('servizioSpento');
}

function aggiornaAscoltoDaCampo() {
  if (inAttesa.value || modalitàStatica.value || !chatVisibile.value) return;
  const haTesto = campo.value.trim().length > 0;
  const haFuoco = document.activeElement === inputEl.value;
  if ((haTesto && haFuoco) || microfonoAscolta.value) {
    if (!ascoltoEmesso) {
      ascoltoEmesso = true;
      emit('ascoltoIniziato');
    }
  } else if (ascoltoEmesso) {
    ascoltoEmesso = false;
    emit('ascoltoFinito');
  }
}

function onFocusCampo() {
  if (timerFuoco) {
    window.clearTimeout(timerFuoco);
    timerFuoco = 0;
  }
  aggiornaAscoltoDaCampo();
}

function onBlurCampo() {
  if (timerFuoco) window.clearTimeout(timerFuoco);
  timerFuoco = window.setTimeout(() => {
    aggiornaAscoltoDaCampo();
  }, 1500);
}

function onInputCampo() {
  if (campo.value.length > MAX_CARATTERI_DOMANDA) {
    campo.value = campo.value.slice(0, MAX_CARATTERI_DOMANDA);
  }
  aggiornaAscoltoDaCampo();
}

function apriModulo() {
  if (!props.moduloDisponibile || moduloAperto.value) return;
  fermaMicrofono();
  fermaVoceCorrente();
  statoPrimaDelModulo = {
    campoAttivo: campoAttivo.value,
    chipVisibili: chipVisibili.value,
    mostraAccountEvidenza: mostraAccountEvidenza.value,
  };
  moduloAperto.value = true;
  campoAttivo.value = false;
  messaggi.value.push({
    ruolo: 'tony',
    testo: t.registrazione.apertura,
  });
  scorriInBasso();
  emit('apri-modulo');
}

function onChiudiModulo() {
  if (registrazioneCompletata.value) return;
  moduloAperto.value = false;
  if (statoPrimaDelModulo) {
    campoAttivo.value = statoPrimaDelModulo.campoAttivo;
    chipVisibili.value = statoPrimaDelModulo.chipVisibili;
    mostraAccountEvidenza.value = statoPrimaDelModulo.mostraAccountEvidenza;
    statoPrimaDelModulo = null;
  } else {
    campoAttivo.value = true;
  }
  emit('chiudi-modulo');
}

function onInvioInCorso(valore: boolean) {
  invioInCorso.value = !!valore;
  emit('invio-in-corso', invioInCorso.value);
}

function onRegistrazioneCompletata() {
  registrazioneCompletata.value = true;
  moduloAperto.value = false;
  campoAttivo.value = false;
  chipVisibili.value = false;
  messaggi.value.push({ ruolo: 'tony', testo: t.registrazione.fatto });
  messaggi.value.push({ ruolo: 'tony', testo: ta.invito });
  faseAiuto.value = true;
  passoAiuto.value = 'invito';
  storia.value = [];
  sessione.value = nuovaSessione(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? () => crypto.randomUUID()
      : undefined
  );
  scorriInBasso();
  emit('registrazione-completata');
  emit('chiudi-modulo');
}

function haDatiAiuto() {
  const d = datiAiuto.value;
  return !!(
    d.sede ||
    (d.poderi && d.poderi.length) ||
    (d.terreni && d.terreni.length)
  );
}

function domandaFissa(passo: string) {
  if (passo === 'sede') return ta.domandaSede;
  if (passo === 'poderi') return ta.domandaPoderi;
  if (passo === 'terreni') return ta.domandaTerreni;
  return '';
}

function avviaPasso(passo: string) {
  passoAiuto.value = passo;
  schedaAperta.value = false;
  campoAttivo.value = true;
  chipVisibili.value = true;
  const testo = domandaFissa(passo);
  messaggi.value.push({ ruolo: 'tony', testo });
  if (!argomentiSuonati.has(passo)) {
    argomentiSuonati.add(passo);
    emit('argomento', passo);
  }
  scorriInBasso();
}

function onChipAiuto(etichetta: string) {
  if (inAttesa.value || invioInCorso.value) return;
  if (etichetta === ta.chipSi) {
    avviaPasso('sede');
    return;
  }
  if (etichetta === ta.chipSaltaTutto) {
    emit('vai-dashboard');
    return;
  }
  if (etichetta === ta.chipDopo) {
    const corrente = passoAiuto.value;
    const prox = corrente ? prossimoPasso(corrente) : null;
    if (prox) avviaPasso(prox);
    else apriScheda();
    return;
  }
  if (etichetta === ta.chipAvanti) {
    const corrente = passoAiuto.value;
    const prox = corrente ? prossimoPasso(corrente) : null;
    if (prox) avviaPasso(prox);
    else apriScheda();
    return;
  }
  if (etichetta === ta.chipRiepilogo) {
    apriScheda();
  }
}

function apriScheda() {
  schedaAperta.value = true;
  campoAttivo.value = false;
  chipVisibili.value = false;
  passoAiuto.value = 'scheda';
  messaggi.value.push({ ruolo: 'tony', testo: ta.schedaIntro });
  scorriInBasso();
}

function onTornaDallaScheda() {
  schedaAperta.value = false;
  campoAttivo.value = true;
  chipVisibili.value = true;
  if (!passoAiuto.value || passoAiuto.value === 'scheda') {
    passoAiuto.value = PASSI_AIUTO[PASSI_AIUTO.length - 1];
  }
}

async function suVoceFatto() {
  if (!altoparlante.value || props.riduciMovimento) return;
  try {
    const percorsi = percorsoVoceFatto();
    const risposta = await fetch(percorsi.mp3);
    if (!risposta.ok) return;
    const blob = await risposta.blob();
    playerVoce.sblocca();
    await playerVoce.suona(blob, {
      onInizio: () => emit('voceIniziata'),
      onFine: () => emit('voceFinita'),
    });
  } catch {
    emit('voceFinita');
  }
}

async function onSchedaSalvata() {
  schedaAperta.value = false;
  aiutoFatto.value = true;
  campoAttivo.value = false;
  chipVisibili.value = false;
  messaggi.value.push({ ruolo: 'tony', testo: ta.fatto });
  scorriInBasso();
  await suVoceFatto();
}

function onVaiDashboard() {
  emit('vai-dashboard');
}

async function inviaTesto(grezzo: string, daChip = false) {
  if (moduloAperto.value || schedaAperta.value) return;
  if (faseAiuto.value && passoAiuto.value === 'invito') return;
  if (inAttesa.value || !campoAttivo.value || modalitàStatica.value) return;
  if (aiutoFatto.value || aiutoSospeso.value) return;
  const validazione = validaDomanda(grezzo);
  if (!validazione.ok) {
    if (validazione.motivo === 'vuota') return;
    if (validazione.motivo === 'troppo-lunga') {
      messaggi.value.push({ ruolo: 'tony', testo: t.troppoLunga });
      return;
    }
    if (validazione.motivo === 'dati-personali') {
      campo.value = '';
      messaggi.value.push({ ruolo: 'nascosta', testo: t.domandaNascosta });
      messaggi.value.push({ ruolo: 'tony', testo: MESSAGGI_CHAT.datiPersonali });
      return;
    }
    return;
  }

  fermaVoceCorrente();
  mostraAscolta.value = false;
  blobAscolta = null;
  metaVoce = null;

  const domanda = validazione.domanda;
  campo.value = '';
  chipVisibili.value = false;
  fermaMicrofono();
  if (ascoltoEmesso) {
    ascoltoEmesso = false;
    emit('ascoltoFinito');
  }

  if (altoparlante.value) playerVoce.sblocca();

  messaggi.value.push({ ruolo: 'utente', testo: domanda });
  inAttesa.value = true;
  testoParziale.value = '';
  emit('domandaInviata');
  scorriInBasso();

  abortCorrente = new AbortController();
  let primoPezzo = false;

  const onPezzo = (delta: string) => {
    if (!primoPezzo) {
      primoPezzo = true;
      emit('testoArrivato');
      messaggi.value.push({ ruolo: 'tony', testo: '', live: true });
    }
    testoParziale.value += delta;
    const ultimo = messaggi.value[messaggi.value.length - 1];
    if (ultimo && ultimo.live) ultimo.testo = testoParziale.value;
    scorriInBasso();
  };

  const inAccount =
    faseAiuto.value &&
    passoAiuto.value &&
    PASSI_AIUTO.indexOf(passoAiuto.value) >= 0;

  let esito: any;
  try {
    if (import.meta.env.DEV && scenarioFinto.value) {
      const { chiediFinto } = await import('../lib/tony-chat-finto.js');
      esito = await chiediFinto({
        domanda,
        sessione: sessione.value,
        storia: storia.value,
        ottieniToken: props.ottieniToken,
        onPezzo,
        segnale: abortCorrente.signal,
        scenario: scenarioFinto.value,
        fase: inAccount ? 'account' : undefined,
        argomento: inAccount ? passoAiuto.value || undefined : undefined,
      });
    } else {
      esito = await chiediATony({
        domanda,
        sessione: sessione.value,
        storia: storia.value,
        ottieniToken: props.ottieniToken,
        ottieniTokenAccesso: props.ottieniTokenAccesso,
        onPezzo,
        segnale: abortCorrente.signal,
        fase: inAccount ? 'account' : undefined,
        argomento: inAccount ? passoAiuto.value || undefined : undefined,
      });
    }
  } catch {
    esito = { codice: 'errore', fase: inAccount ? 'account' : undefined };
  }

  if (smontato) return;
  abortCorrente = null;
  inAttesa.value = false;

  if (inAccount && esito && !esito.fase) esito.fase = 'account';
  const azione = azionePerEsito(esito);
  if (azione.tipo === 'statico') {
    if (primoPezzo) {
      const ultimo = messaggi.value[messaggi.value.length - 1];
      if (ultimo && ultimo.live) messaggi.value.pop();
    }
    testoParziale.value = '';
    passaAStatico(azione.testo);
    return;
  }

  if (azione.tipo === 'aiuto-sospeso') {
    if (primoPezzo) {
      const ultimo = messaggi.value[messaggi.value.length - 1];
      if (ultimo && ultimo.live) {
        ultimo.testo = azione.testo;
        ultimo.live = false;
      }
    } else {
      messaggi.value.push({ ruolo: 'tony', testo: azione.testo });
    }
    testoParziale.value = '';
    aiutoSospeso.value = true;
    campoAttivo.value = false;
    chipVisibili.value = false;
    emit('rispostaFinita');
    return;
  }

  if (primoPezzo) {
    const ultimo = messaggi.value[messaggi.value.length - 1];
    if (ultimo && ultimo.live) {
      ultimo.testo = azione.testo;
      ultimo.live = false;
    }
  } else {
    messaggi.value.push({ ruolo: 'tony', testo: azione.testo });
  }
  testoParziale.value = '';

  if (esito.codice === 'ok') {
    storia.value = aggiornaStoria(storia.value, { ruolo: 'utente', testo: domanda });
    storia.value = aggiornaStoria(storia.value, { ruolo: 'tony', testo: azione.testo });
  }

  if (inAccount && esito.codice === 'ok') {
    if (esito.troppiTerreni) {
      messaggi.value.push({ ruolo: 'tony', testo: ta.cinqueTerreni });
    }
    const uniti = unisciDati(datiAiuto.value, esito.dati, passoAiuto.value || '');
    datiAiuto.value = uniti.dati;
    if (uniti.troppiTerreni && !esito.troppiTerreni) {
      messaggi.value.push({ ruolo: 'tony', testo: ta.cinqueTerreni });
    }
    if (esito.dati && esito.dati.fatto === true) {
      const prox = prossimoPasso(passoAiuto.value || '');
      if (prox) avviaPasso(prox);
      else apriScheda();
    } else {
      campoAttivo.value = true;
      chipVisibili.value = true;
    }
  } else {
    campoAttivo.value = azione.campoAttivo;
  }
  if (azione.tipo === 'limite') {
    mostraAccountEvidenza.value = true;
    chipVisibili.value = false;
  }

  const modo = modoVoce({
    esito: { ...esito, testo: azione.testo },
    altoparlante: altoparlante.value,
    risposteVocaliAutomatiche,
    riduciMovimento: props.riduciMovimento,
    paginaNascosta: typeof document !== 'undefined' ? document.hidden : false,
  });

  if (esito.voce === true && typeof esito.idVoce === 'string') {
    altoparlanteVisibile.value = true;
    metaVoce = { idVoce: esito.idVoce, testo: azione.testo };
  }

  if (modo === 'automatica') {
    scorriInBasso();
    if (azione.campoAttivo) nextTick(() => inputEl.value?.focus());
    void gestisciVoceAutomatica(esito, azione.testo);
  } else if (modo === 'pulsante') {
    mostraAscolta.value = true;
    emit('rispostaFinita');
    scorriInBasso();
    if (azione.campoAttivo) nextTick(() => inputEl.value?.focus());
  } else {
    emit('rispostaFinita');
    scorriInBasso();
    if (azione.campoAttivo) nextTick(() => inputEl.value?.focus());
  }
  void daChip;
}

async function gestisciVoceAutomatica(esito: any, testo: string) {
  abortVoce = new AbortController();
  const esitoVoce = await chiediVoceFn({
    idVoce: esito.idVoce,
    sessione: sessione.value,
    testo,
    ottieniToken: props.ottieniToken,
    segnale: abortVoce.signal,
  });
  if (smontato) return;
  abortVoce = null;
  if (!esitoVoce.ok) {
    emit('rispostaFinita');
    return;
  }
  blobAscolta = esitoVoce.blob;
  const esitoPlay = await playerVoce.suona(esitoVoce.blob, {
    attesaMaxMs: tempiVoce().attesaMaxVoceMs,
    onInizio: () => {
      voceInCorso.value = true;
      voceParlandoSr.value = true;
      emit('voceIniziata');
    },
    onFine: () => {
      voceInCorso.value = false;
      voceParlandoSr.value = false;
      emit('voceFinita');
    },
  });
  if (esitoPlay === 'fallita') {
    mostraAscolta.value = true;
    emit('rispostaFinita');
    return;
  }
  risposteVocaliAutomatiche += 1;
}

function fermaVoceCorrente() {
  if (abortVoce) {
    abortVoce.abort();
    abortVoce = null;
  }
  if (voceInCorso.value || playerVoce) {
    playerVoce.ferma();
    if (voceInCorso.value) {
      voceInCorso.value = false;
      voceParlandoSr.value = false;
      emit('voceFinita');
    }
  }
}

async function onAscoltaClick() {
  if (voceInCorso.value) {
    fermaVoceCorrente();
    return;
  }
  playerVoce.sblocca();
  let blob = blobAscolta;
  if (!blob && metaVoce) {
    abortVoce = new AbortController();
    const esitoVoce = await chiediVoceFn({
      idVoce: metaVoce.idVoce,
      sessione: sessione.value,
      testo: metaVoce.testo,
      ottieniToken: props.ottieniToken,
      segnale: abortVoce.signal,
    });
    abortVoce = null;
    if (!esitoVoce.ok) {
      mostraAscolta.value = false;
      blobAscolta = null;
      metaVoce = null;
      return;
    }
    blob = esitoVoce.blob;
    blobAscolta = blob;
  }
  if (!blob) {
    mostraAscolta.value = false;
    return;
  }
  const esitoPlay = await playerVoce.suona(blob, {
    attesaMaxMs: tempiVoce().attesaMaxVoceMs,
    onInizio: () => {
      voceInCorso.value = true;
      voceParlandoSr.value = true;
      emit('voceIniziata');
    },
    onFine: () => {
      voceInCorso.value = false;
      voceParlandoSr.value = false;
      emit('voceFinita');
    },
  });
  if (esitoPlay === 'fallita') {
    mostraAscolta.value = false;
    blobAscolta = null;
    metaVoce = null;
  }
}

function onToggleAltoparlante() {
  altoparlante.value = !altoparlante.value;
  if (!altoparlante.value) {
    fermaVoceCorrente();
  } else {
    playerVoce.sblocca();
  }
}

function onChip(testo: string) {
  inviaTesto(testo, true);
}

function onInvia() {
  inviaTesto(campo.value);
}

function onKeydown(ev: KeyboardEvent) {
  if (ev.key === 'Enter') {
    ev.preventDefault();
    onInvia();
  }
}

function scorriInBasso() {
  nextTick(() => {
    const el = listaMessaggi.value;
    if (el) el.scrollTop = el.scrollHeight;
  });
}

function fermaMicrofono() {
  microfonoAscolta.value = false;
  try {
    recognition?.stop();
  } catch {
    /* già fermo */
  }
  recognition = null;
  aggiornaAscoltoDaCampo();
}

function avviaMicrofono() {
  if (moduloAperto.value) return;
  if (microfonoNascosto.value || !microfonoDisponibile.value || inAttesa.value) return;
  const SR =
    window.SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (typeof SR !== 'function') {
    microfonoDisponibile.value = false;
    return;
  }
  try {
    recognition = new SR();
    recognition.lang = 'it-IT';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (ev: any) => {
      let testo = '';
      for (let i = 0; i < ev.results.length; i += 1) {
        testo += ev.results[i][0].transcript;
      }
      campo.value = testo.slice(0, MAX_CARATTERI_DOMANDA);
      aggiornaAscoltoDaCampo();
    };
    recognition.onerror = () => {
      microfonoNascosto.value = true;
      microfonoDisponibile.value = false;
      fermaMicrofono();
    };
    recognition.onend = () => {
      microfonoAscolta.value = false;
      aggiornaAscoltoDaCampo();
    };
    recognition.start();
    microfonoAscolta.value = true;
    aggiornaAscoltoDaCampo();
  } catch {
    microfonoNascosto.value = true;
    microfonoDisponibile.value = false;
  }
}

function onMicClick() {
  if (mobile.value) return;
  if (microfonoAscolta.value) fermaMicrofono();
  else avviaMicrofono();
}

function onMicDown(ev: Event) {
  if (!mobile.value) return;
  ev.preventDefault();
  avviaMicrofono();
}

function onMicUp() {
  if (!mobile.value) return;
  fermaMicrofono();
}

function onVisibility() {
  if (document.hidden) {
    fermaMicrofono();
    fermaVoceCorrente();
  }
}

onUnmounted(() => {
  smontato = true;
  fermaMicrofono();
  if (abortCorrente) abortCorrente.abort();
  if (abortVoce) abortVoce.abort();
  playerVoce.libera();
  if (timerFuoco) window.clearTimeout(timerFuoco);
  document.removeEventListener('visibilitychange', onVisibility);
});

/** Esposto a TonyStage quando si saluta a metà richiesta. */
function interrompi() {
  if (abortCorrente) abortCorrente.abort();
  if (abortVoce) abortVoce.abort();
  fermaMicrofono();
  fermaVoceCorrente();
  playerVoce.libera();
}

defineExpose({ interrompi });
</script>

<template>
  <div class="tony-chat">
    <div
      v-if="altoparlanteVisibile"
      class="riga-altoparlante"
    >
      <button
        type="button"
        class="btn-altoparlante"
        :aria-pressed="altoparlante ? 'true' : 'false'"
        :aria-label="altoparlante ? t.voceAccesa : t.voceSpenta"
        :title="altoparlante ? t.voceAccesa : t.voceSpenta"
        @click="onToggleAltoparlante"
      >
        {{ altoparlante ? '🔊' : '🔇' }}
      </button>
    </div>

    <p
      v-if="notaFinto"
      class="finto-nota"
    >
      {{ notaFinto }}
    </p>

    <div
      v-if="messaggi.length"
      ref="listaMessaggi"
      class="conversazione"
    >
      <div
        v-for="(m, i) in messaggi"
        :key="i"
        class="battuta"
        :class="'battuta--' + m.ruolo"
        :aria-live="i === messaggi.length - 1 && m.ruolo === 'tony' ? 'polite' : undefined"
      >
        {{ m.testo }}
      </div>
      <button
        v-if="mostraAscolta"
        type="button"
        class="btn-ascolta"
        @click="onAscoltaClick"
      >
        {{ voceInCorso ? t.fermaVoce : t.ascolta }}
      </button>
    </div>

    <p
      v-if="inAttesa && !testoParziale"
      class="sr-only"
      aria-live="polite"
    >
      {{ t.pensaLettoreSchermo }}
    </p>
    <p
      v-if="voceParlandoSr"
      class="sr-only"
      aria-live="polite"
    >
      {{ t.voceLettoreSchermo }}
    </p>

    <TonyRegistrazione
      v-if="chatVisibile && moduloAperto"
      @chiudi-modulo="onChiudiModulo"
      @registrazione-completata="onRegistrazioneCompletata"
      @invio-in-corso="onInvioInCorso"
    />

    <TonySchedaConferma
      v-else-if="chatVisibile && schedaAperta && salvaAzienda"
      :dati="datiAiuto"
      :salva-azienda="salvaAzienda"
      @torna-chat="onTornaDallaScheda"
      @salvata="onSchedaSalvata"
      @invio-in-corso="onInvioInCorso"
      @vai-dashboard="onVaiDashboard"
    />

    <template v-else-if="chatVisibile && faseAiuto && passoAiuto === 'invito'">
      <div class="chip-riga" role="group" aria-label="Aiuto account">
        <button type="button" class="chip" @click="onChipAiuto(ta.chipSi)">
          {{ ta.chipSi }}
        </button>
        <button type="button" class="chip" @click="onChipAiuto(ta.chipSaltaTutto)">
          {{ ta.chipSaltaTutto }}
        </button>
      </div>
    </template>

    <template v-else-if="chatVisibile && campoAttivo && !aiutoFatto">
      <p v-if="faseAiuto" class="informativa-aiuto">
        {{ ta.informativa }}
        <a href="/privacy#tony">{{ ta.informativaLink }}</a>
      </p>
      <div v-if="chipVisibili" class="chip-riga" role="group" aria-label="Domande rapide">
        <template v-if="faseAiuto">
          <button
            type="button"
            class="chip"
            :disabled="inAttesa"
            @click="onChipAiuto(ta.chipDopo)"
          >
            {{ ta.chipDopo }}
          </button>
          <button
            v-if="haDatiAiuto()"
            type="button"
            class="chip"
            :disabled="inAttesa"
            @click="onChipAiuto(ta.chipAvanti)"
          >
            {{ ta.chipAvanti }}
          </button>
          <button
            v-if="haDatiAiuto()"
            type="button"
            class="chip"
            :disabled="inAttesa"
            @click="onChipAiuto(ta.chipRiepilogo)"
          >
            {{ ta.chipRiepilogo }}
          </button>
        </template>
        <template v-else>
          <button
            v-for="c in t.chip"
            :key="c"
            type="button"
            class="chip"
            :disabled="inAttesa"
            @click="onChip(c)"
          >
            {{ c }}
          </button>
        </template>
      </div>

      <div class="campo-riga">
        <label class="sr-only" for="tony-domanda">{{ t.etichettaCampo }}</label>
        <input
          id="tony-domanda"
          ref="inputEl"
          v-model="campo"
          type="text"
          class="campo"
          :placeholder="microfonoAscolta ? t.ascolto : t.segnapostoCampo"
          :maxlength="MAX_CARATTERI_DOMANDA"
          :disabled="inAttesa"
          autocomplete="off"
          @focus="onFocusCampo"
          @blur="onBlurCampo"
          @input="onInputCampo"
          @keydown="onKeydown"
        />
        <span v-if="contatoreVisibile" class="contatore">{{ campo.length }}/{{ MAX_CARATTERI_DOMANDA }}</span>
        <button
          type="button"
          class="btn-invia"
          :disabled="inAttesa || !campo.trim()"
          @click="onInvia"
        >
          {{ t.invia }}
        </button>
        <button
          v-if="microfonoDisponibile && !microfonoNascosto"
          type="button"
          class="btn-mic"
          :class="{ 'btn-mic--on': microfonoAscolta }"
          :aria-label="mobile ? t.microfonoMobile : t.microfono"
          :disabled="inAttesa"
          @click="onMicClick"
          @pointerdown="onMicDown"
          @pointerup="onMicUp"
          @pointercancel="onMicUp"
          @pointerleave="onMicUp"
        >
          {{ mobile ? '🎙' : '🎙' }}
        </button>
      </div>
    </template>

    <div v-if="chatVisibile && (aiutoFatto || aiutoSospeso)" class="fumetto-azioni">
      <button
        v-if="aiutoSospeso && haDatiAiuto()"
        type="button"
        class="btn-account"
        @click="apriScheda"
      >
        {{ ta.chipRiepilogo }}
      </button>
      <button type="button" class="btn-account btn-account--evidenza" @click="onVaiDashboard">
        {{ ta.vaiDashboard }}
      </button>
      <button
        type="button"
        class="btn-saluta"
        :disabled="invioInCorso"
        @click="emit('saluta')"
      >
        {{ t.saluta }}
      </button>
    </div>

    <div v-else class="fumetto-azioni">
      <button
        v-if="moduloDisponibile && !moduloAperto && !faseAiuto"
        type="button"
        class="btn-account"
        :class="{ 'btn-account--evidenza': mostraAccountEvidenza || modalitàStatica || staticoForzato }"
        @click="apriModulo"
      >
        {{ t.ctaAccount }}
      </button>
      <a
        v-else-if="!moduloAperto && !faseAiuto"
        class="btn-account"
        :class="{ 'btn-account--evidenza': mostraAccountEvidenza || modalitàStatica || staticoForzato }"
        :href="URL_REGISTRAZIONE"
      >
        {{ t.ctaAccount }}
      </a>
      <button
        v-if="faseAiuto && haDatiAiuto() && !schedaAperta && !aiutoFatto"
        type="button"
        class="btn-account"
        @click="apriScheda"
      >
        {{ ta.chipRiepilogo }}
      </button>
      <button
        type="button"
        class="btn-saluta"
        :disabled="invioInCorso"
        @click="emit('saluta')"
      >
        {{ t.saluta }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.tony-chat {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-height: 0;
  flex: 1 1 auto;
}

.informativa-aiuto {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.35;
  color: #3d4a3a;
}
.informativa-aiuto a {
  color: inherit;
  text-decoration: underline;
}

.riga-altoparlante {
  display: flex;
  justify-content: flex-end;
  margin: -0.15rem 0 0.1rem;
}

.btn-altoparlante {
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0.15rem 0.25rem;
  color: #0f4d32;
}

.btn-ascolta {
  align-self: flex-start;
  margin-top: 0.15rem;
  border: 1px solid rgba(15, 77, 50, 0.28);
  background: #fff;
  color: #0f4d32;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 700;
  padding: 0.28rem 0.7rem;
  cursor: pointer;
}

.finto-nota {
  margin: 0;
  font-size: 0.72rem;
  color: #7a8f84;
}

.conversazione {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex: 1 1 auto;
  min-height: 0;
  max-height: 10rem;
  overflow: auto;
  padding-right: 0.15rem;
}

.battuta {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.4;
  padding: 0.4rem 0.55rem;
  border-radius: 10px;
}

.battuta--utente {
  align-self: flex-end;
  background: rgba(15, 77, 50, 0.1);
  color: #06140e;
  max-width: 92%;
}

.battuta--tony {
  align-self: flex-start;
  background: #f3f7f5;
  color: #06140e;
  max-width: 95%;
}

.battuta--nascosta {
  align-self: flex-end;
  font-size: 0.8rem;
  font-style: italic;
  color: #4a6358;
  background: transparent;
  padding: 0.15rem 0.35rem;
}

.chip-riga {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chip {
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 650;
  border: 1px solid rgba(15, 77, 50, 0.28);
  background: #fff;
  color: #0f4d32;
  border-radius: 999px;
  padding: 0.4rem 0.7rem;
  cursor: pointer;
}

.chip:disabled {
  opacity: 0.55;
  cursor: default;
}

.chip:focus-visible {
  outline: 3px solid #158050;
  outline-offset: 2px;
}

.campo-riga {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  position: relative;
}

.campo {
  flex: 1 1 10rem;
  min-width: 0;
  font-family: inherit;
  font-size: 0.92rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid rgba(15, 77, 50, 0.28);
  border-radius: 10px;
  color: #06140e;
  background: #fff;
}

.campo:focus-visible {
  outline: 3px solid #158050;
  outline-offset: 1px;
}

.contatore {
  font-size: 0.72rem;
  color: #4a6358;
}

.btn-invia,
.btn-mic {
  font-family: inherit;
  font-weight: 700;
  font-size: 0.88rem;
  border-radius: 999px;
  border: 1px solid rgba(15, 77, 50, 0.35);
  background: #0f4d32;
  color: #fff;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
}

.btn-mic {
  background: #fff;
  color: #0f4d32;
  min-width: 2.5rem;
}

.btn-mic--on {
  background: #e8f5ee;
}

.btn-invia:disabled,
.btn-mic:disabled {
  opacity: 0.55;
  cursor: default;
}

.btn-invia:focus-visible,
.btn-mic:focus-visible {
  outline: 3px solid #158050;
  outline-offset: 2px;
}

.fumetto-azioni {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.15rem;
  flex: 0 0 auto;
}

@media (max-width: 767px) {
  .conversazione {
    max-height: none;
  }
}

.btn-account,
.btn-saluta {
  font-family: inherit;
  font-weight: 700;
  font-size: 0.92rem;
  border-radius: 999px;
  text-decoration: none;
  pointer-events: auto;
}

.btn-account {
  display: inline-flex;
  align-items: center;
  padding: 0.65rem 0.9rem;
  background: #0f4d32;
  color: #fff;
}

.btn-account--evidenza {
  box-shadow: 0 0 0 3px rgba(21, 128, 80, 0.35);
}

.btn-saluta {
  border: 1px solid rgba(15, 77, 50, 0.35);
  background: #fff;
  color: #0f4d32;
  padding: 0.65rem 0.85rem;
  cursor: pointer;
}

.btn-account:focus-visible,
.btn-saluta:focus-visible {
  outline: 3px solid #158050;
  outline-offset: 2px;
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
</style>
