<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { testiLanding } from '../content/testi-landing.js';
import {
  clipInLoop,
  DIMENSIONI_TONY_STATICO,
  DISSOLVENZA_STATICO_MS,
  durataClipMs,
  percorsoClip,
  percorsoTonyStatico,
  scalettaClip,
  sicurezzaEntrataMs,
  tempiVoce,
} from '../lib/tony-bussa-logica.js';
import { creaPlayerClip } from '../lib/tony-clip-player.js';
import TonyChat from './TonyChat.vue';

const props = defineProps<{
  fase: string;
  variante: string;
  formato: string;
  riduciMovimento: boolean;
  uscitaConClip: boolean;
  boccaAperta: boolean;
  salutoFinito: boolean;
  audioAttivo: boolean;
}>();

const emit = defineEmits([
  'entrataFinita',
  'uscitaFinita',
  'saluta',
  'clipNonPronta',
  'ascoltoIniziato',
  'ascoltoFinito',
  'domandaInviata',
  'testoArrivato',
  'rispostaFinita',
  'servizioSpento',
  'voceIniziata',
  'voceFinita',
]);

const t = testiLanding.tonyBussa;
const msBocca = tempiVoce().dissolvenzaBoccaMs;
const figuraHost = ref<HTMLElement | null>(null);
const chatRef = ref<{ interrompi?: () => void } | null>(null);
const inFadeOut = ref(false);
const clipPronte = ref<Record<string, boolean>>({ entry: true, idle: true });
const protezionePronta = ref<boolean | null>(null);
const mostraStatico = ref(false);
const staticoSrc = ref('');
const staticoW = ref(576);
const staticoH = ref(720);
const staticoOpacity = ref(0);
const figuraFade = ref(false);

let player: ReturnType<typeof creaPlayerClip> | null = null;
let entrataAvviata = false;
let idleAvviata = false;
let uscitaAvviata = false;
let entrataEmessa = false;
let uscitaEmessa = false;
let smontato = false;
let timerEntrata = 0;
let timerUscita = 0;
let timerGiro = 0;
let timerAttesaPrimo = 0;
let timerStatico = 0;
let protezioneAvviata = false;
let codaClip: string[] = [];
let clipCorrente = '';
let faseClipPrecedente = '';
let generazioneClip = 0;
/** Scaletta da avviare quando finisce la clip «una volta» in corso. */
let codaDopoCorrente: { lista: string[]; dissolvenzaMs: number } | null = null;
let dissolvenzaProssima = 0;
let staticoDaClip = false;

const saluto = () =>
  props.variante === 'mobile' ? t.salutoMobile : t.salutoDesktop;

function fmt() {
  if (props.formato === 'webp') return 'webp';
  if (props.formato === 'stacked') return 'stacked';
  return 'webm';
}

function varScena(): 'desktop' | 'mobile' {
  return props.variante === 'mobile' ? 'mobile' : 'desktop';
}

function urlClip(nome: string) {
  return percorsoClip(nome, varScena(), fmt());
}

function assicuratiPlayer() {
  if (player || !figuraHost.value) return;
  player = creaPlayerClip({
    contenitore: figuraHost.value,
    formato: fmt(),
    onErrore: () => {
      if (smontato || props.fase === 'idle' || props.fase === 'esce' || props.fase === 'parla') {
        return;
      }
      if (props.fase === 'bussa' || props.fase === 'entra') emit('clipNonPronta');
    },
  });
}

async function ottieniToken() {
  try {
    const m = await import('../lib/firebase-landing.js');
    return await m.tokenAppCheck();
  } catch {
    return null;
  }
}

function avviaProtezionePigro() {
  if (protezioneAvviata || smontato) return;
  protezioneAvviata = true;
  if (import.meta.env.DEV) {
    import('../lib/tony-chat-finto.js')
      .then((m) => {
        if (smontato) return;
        const sc =
          typeof window !== 'undefined' ? m.parametroFinto(window.location.search) : null;
        if (sc) {
          protezionePronta.value = true;
          return;
        }
        return import('../lib/firebase-landing.js').then((fb) =>
          fb.avviaProtezione().then((esito) => {
            if (!smontato) protezionePronta.value = !!(esito && esito.pronta === true);
          })
        );
      })
      .catch(() => {
        if (!smontato) protezionePronta.value = false;
      });
    return;
  }
  import('../lib/firebase-landing.js')
    .then((m) =>
      m.avviaProtezione().then((esito) => {
        if (smontato) return;
        protezionePronta.value = !!(esito && esito.pronta === true);
      })
    )
    .catch(() => {
      if (!smontato) protezionePronta.value = false;
    });
}

function emettiEntrata() {
  if (smontato || entrataEmessa) return;
  entrataEmessa = true;
  if (timerEntrata) window.clearTimeout(timerEntrata);
  if (timerAttesaPrimo) window.clearTimeout(timerAttesaPrimo);
  emit('entrataFinita');
}

function emettiUscita() {
  if (smontato || uscitaEmessa) return;
  uscitaEmessa = true;
  if (timerUscita) window.clearTimeout(timerUscita);
  emit('uscitaFinita');
}

function clipChatPronta(nome: string) {
  if (nome === 'entry' || nome === 'idle') return true;
  return clipPronte.value[nome] === true;
}

function clipUnaVolta(nome: string) {
  return (
    nome === 'listenRaise' ||
    nome === 'listenLower' ||
    nome === 'thinking' ||
    nome === 'entry'
  );
}

function suonaProssima() {
  if (smontato || !player) return;
  if (!codaClip.length) return;
  const nome = codaClip.shift() as string;
  clipCorrente = nome;
  const fadeMs = dissolvenzaProssima;
  dissolvenzaProssima = 0;

  if (props.riduciMovimento && nome !== 'exit' && props.fase !== 'entra') {
    if (nome === 'idle' || codaClip.length === 0) {
      const idleUrl = urlClip('idle');
      player.suona(idleUrl, {
        loop: true,
        durataMs: durataClipMs('idle'),
      });
      clipCorrente = 'idle';
    }
    return;
  }

  if (
    !clipChatPronta(nome) &&
    nome !== 'entry' &&
    nome !== 'idle' &&
    nome !== 'exit' &&
    nome !== 'talking'
  ) {
    player.suona(urlClip('idle'), { loop: true, durataMs: durataClipMs('idle') });
    clipCorrente = 'idle';
    codaClip = [];
    return;
  }

  const loop = clipInLoop(nome);
  const durataMs = durataClipMs(nome, varScena());
  const gen = generazioneClip;

  player.suona(urlClip(nome), {
    loop,
    durataMs,
    dissolvenzaMs: fadeMs,
    onInizio:
      nome === 'entry'
        ? () => {
            if (timerAttesaPrimo) {
              window.clearTimeout(timerAttesaPrimo);
              timerAttesaPrimo = 0;
            }
            if (timerEntrata) window.clearTimeout(timerEntrata);
            timerEntrata = window.setTimeout(() => {
              if (entrataEmessa || smontato) return;
              generazioneClip += 1;
              fermaInArrivoPlayer();
              codaClip = ['idle'];
              suonaProssima();
              emettiEntrata();
            }, sicurezzaEntrataMs(varScena()));
          }
        : undefined,
    onFine: () => {
      if (smontato) return;
      if (codaDopoCorrente && clipUnaVolta(nome) && nome !== 'entry') {
        const pending = codaDopoCorrente;
        codaDopoCorrente = null;
        generazioneClip += 1;
        codaClip = pending.lista.slice();
        dissolvenzaProssima = pending.dissolvenzaMs;
        suonaProssima();
        return;
      }
      if (gen !== generazioneClip) return;
      if (nome === 'entry') {
        suonaProssima();
        emettiEntrata();
        return;
      }
      if (nome === 'exit') {
        emettiUscita();
        return;
      }
      if (nome === 'thinking' && props.fase === 'pensa') {
        codaClip = ['thinking'];
        suonaProssima();
        return;
      }
      if (!loop) suonaProssima();
    },
  });

  if (nome === 'idle') idleAvviata = true;
}

function fermaInArrivoPlayer() {
  // ferma solo tramite nuova generazione; il player scarta l'in-arrivo al prossimo suona
}

function dissolvenzaPerPassaggio(da: string, a: string) {
  if (da === 'idle') return msBocca;
  if (a === 'parla' || da === 'parla') return msBocca;
  return 0;
}

function partiScaletta(lista: string[], dissolvenzaMs: number) {
  codaDopoCorrente = null;
  generazioneClip += 1;
  codaClip = lista.slice();
  dissolvenzaProssima = dissolvenzaMs;
  suonaProssima();
}

function avviaScaletta(da: string, a: string) {
  if (timerGiro) {
    window.clearTimeout(timerGiro);
    timerGiro = 0;
  }
  assicuratiPlayer();
  if (!player) return;

  if (a === 'statico') {
    return;
  }

  if (props.riduciMovimento && a !== 'esce' && a !== 'entra') {
    if (a === 'idle' || a === 'ascolta' || a === 'pensa' || a === 'scrive' || a === 'parla') {
      if (clipCorrente === 'idle' && clipInLoop('idle')) return;
      partiScaletta(['idle'], 0);
      return;
    }
  }

  const lista = scalettaClip(da, a);
  if (!lista.length) return;

  // già sulla stessa clip in loop (es. idle → idle): non ripartire
  if (
    lista.length === 1 &&
    lista[0] === clipCorrente &&
    clipInLoop(clipCorrente)
  ) {
    return;
  }

  const fade = dissolvenzaPerPassaggio(da, a);
  const subito =
    da === 'idle' ||
    a === 'parla' ||
    da === 'parla' ||
    a === 'esce';

  const unaVoltaInCorso =
    clipUnaVolta(clipCorrente) &&
    clipCorrente !== 'entry' &&
    !clipInLoop(clipCorrente);

  if (unaVoltaInCorso && !subito) {
    codaDopoCorrente = { lista: lista.slice(), dissolvenzaMs: fade };
    return;
  }

  const loopInCorso =
    clipInLoop(clipCorrente) &&
    (clipCorrente === 'listenLoop' ||
      clipCorrente === 'scrive' ||
      clipCorrente === 'talking' ||
      clipCorrente === 'idle');

  // da idle si parte subito (già in subito); da altri loop aspetta fine giro
  if (loopInCorso && !subito && clipCorrente !== 'idle') {
    const durata = durataClipMs(clipCorrente, varScena());
    const genAttesa = generazioneClip;
    timerGiro = player.allaFineDelGiro(durata, () => {
      if (smontato) return;
      if (genAttesa !== generazioneClip && !codaDopoCorrente) {
        /* interrotto */
      }
      partiScaletta(lista, fade);
    });
    return;
  }

  partiScaletta(lista, fade);
}

function suonaEntrata() {
  if (entrataAvviata || smontato) return;
  entrataAvviata = true;
  assicuratiPlayer();
  if (props.riduciMovimento) {
    codaClip = ['idle'];
    suonaProssima();
    emettiEntrata();
    return;
  }
  // se entro 4 s non arriva il primo fotogramma → clip non pronta
  timerAttesaPrimo = window.setTimeout(() => {
    if (entrataEmessa || smontato) return;
    generazioneClip += 1;
    emit('clipNonPronta');
  }, 4000);
  generazioneClip += 1;
  codaClip = ['entry', 'idle'];
  suonaProssima();
}

function suonaUscita() {
  if (uscitaAvviata || smontato) return;
  uscitaAvviata = true;
  chatRef.value?.interrompi?.();
  generazioneClip += 1;
  codaDopoCorrente = null;
  const conClip = props.uscitaConClip && !props.riduciMovimento;
  if (!conClip) {
    inFadeOut.value = true;
    player?.ferma();
    player = null;
    timerUscita = window.setTimeout(emettiUscita, 280);
    return;
  }
  assicuratiPlayer();
  codaClip = ['exit'];
  suonaProssima();
  timerUscita = window.setTimeout(emettiUscita, 4500);
}

function aggiornaSrcStatico() {
  const v = varScena();
  staticoSrc.value = percorsoTonyStatico(v);
  const dim = DIMENSIONI_TONY_STATICO[v];
  staticoW.value = dim.larghezza;
  staticoH.value = dim.altezza;
}

function passaAStatico(da: string) {
  aggiornaSrcStatico();
  staticoDaClip = da === 'entra';
  mostraStatico.value = true;
  if (!staticoDaClip) {
    // da bussa: figura compare con fade 280 ms, contenitore già vuoto
    figuraFade.value = true;
    staticoOpacity.value = 1;
    player?.ferma();
    player = null;
    return;
  }
  // da entra: dissolvenza incrociata; video resta finché l'img è visibile
  figuraFade.value = false;
  staticoOpacity.value = 0;
  const img = new Image();
  img.src = staticoSrc.value;
  const dec = img.decode ? img.decode() : Promise.resolve();
  dec
    .then(() => {
      if (smontato || props.fase !== 'statico') return;
      staticoOpacity.value = 1;
      if (timerStatico) window.clearTimeout(timerStatico);
      timerStatico = window.setTimeout(() => {
        player?.ferma();
        player = null;
      }, DISSOLVENZA_STATICO_MS + 70);
    })
    .catch(() => {
      staticoOpacity.value = 1;
      player?.ferma();
      player = null;
    });
  // sicurezza
  if (timerStatico) window.clearTimeout(timerStatico);
  timerStatico = window.setTimeout(() => {
    if (player) {
      player.ferma();
      player = null;
    }
    staticoOpacity.value = 1;
  }, 250);
}

function applicaFase(fase: string, precedente?: string) {
  const prec = precedente || faseClipPrecedente || '';
  if (fase === 'entra') {
    mostraStatico.value = false;
    suonaEntrata();
  } else if (fase === 'esce') {
    suonaUscita();
  } else if (fase === 'statico') {
    passaAStatico(prec);
  } else if (
    fase === 'idle' ||
    fase === 'ascolta' ||
    fase === 'pensa' ||
    fase === 'scrive' ||
    fase === 'parla'
  ) {
    mostraStatico.value = false;
    if (prec && prec !== fase) avviaScaletta(prec, fase);
    else if (fase === 'idle' && !idleAvviata) {
      assicuratiPlayer();
      codaClip = ['idle'];
      suonaProssima();
    } else if (fase === 'parla' && prec === 'idle') {
      avviaScaletta('idle', 'parla');
    }
  }
  if (fase === 'idle' || fase === 'parla' || fase === 'statico' || fase === 'ascolta') {
    avviaProtezionePigro();
  }
  faseClipPrecedente = fase;
}

watch(
  () => props.fase,
  (fase, precedente) => applicaFase(fase, precedente)
);

watch(
  () => props.riduciMovimento,
  (v) => {
    if (v) figuraFade.value = true;
  }
);

onMounted(() => {
  assicuratiPlayer();
  applicaFase(props.fase);
});

onUnmounted(() => {
  smontato = true;
  if (timerEntrata) window.clearTimeout(timerEntrata);
  if (timerUscita) window.clearTimeout(timerUscita);
  if (timerGiro) window.clearTimeout(timerGiro);
  if (timerAttesaPrimo) window.clearTimeout(timerAttesaPrimo);
  if (timerStatico) window.clearTimeout(timerStatico);
  player?.ferma();
  player = null;
});

function onSaluta() {
  chatRef.value?.interrompi?.();
  emit('saluta');
}

function marcaClipPronta(nome: string) {
  clipPronte.value = { ...clipPronte.value, [nome]: true };
}

defineExpose({
  marcaClipPronta,
  precaricaClip: async (nome: string) => {
    assicuratiPlayer();
    if (!player) return;
    await player.precarica(urlClip(nome));
    marcaClipPronta(nome);
  },
});

const mostraFumetto = () =>
  props.fase === 'idle' ||
  props.fase === 'statico' ||
  props.fase === 'parla' ||
  props.fase === 'ascolta' ||
  props.fase === 'pensa' ||
  props.fase === 'scrive' ||
  props.fase === 'esce';
</script>

<template>
  <div
    class="tony-stage"
    :class="variante === 'mobile' ? 'tony-stage--mobile' : 'tony-stage--desktop'"
    :style="{ '--ms-statico': DISSOLVENZA_STATICO_MS + 'ms' }"
  >
    <div class="tony-riga">
      <div
        v-show="mostraFumetto()"
        class="fumetto"
        role="region"
        :aria-labelledby="fase === 'esce' ? undefined : 'tony-etichetta'"
        :aria-label="fase === 'esce' ? t.ciao : undefined"
      >
        <template v-if="fase === 'esce'">
          <p class="saluto" aria-live="polite">{{ t.ciao }}</p>
        </template>
        <template v-else>
          <p id="tony-etichetta" class="etichetta">{{ t.etichetta }}</p>
          <p class="saluto" aria-live="polite">{{ saluto() }}</p>
          <p class="nota-saluto">{{ t.notaSaluto }}</p>
          <TonyChat
            ref="chatRef"
            :ottieni-token="ottieniToken"
            :variante="variante"
            :riduci-movimento="riduciMovimento"
            :saluto-finito="salutoFinito"
            :protezione-pronta="protezionePronta"
            :statico-forzato="false"
            :audio-iniziale="audioAttivo"
            @saluta="onSaluta"
            @ascolto-iniziato="emit('ascoltoIniziato')"
            @ascolto-finito="emit('ascoltoFinito')"
            @domanda-inviata="emit('domandaInviata')"
            @testo-arrivato="emit('testoArrivato')"
            @risposta-finita="emit('rispostaFinita')"
            @servizio-spento="emit('servizioSpento')"
            @voce-iniziata="emit('voceIniziata')"
            @voce-finita="emit('voceFinita')"
          />
        </template>
      </div>

      <div
        v-show="fase !== 'bussa'"
        class="tony-figura"
        aria-hidden="true"
        :class="{
          'tony-figura--fade': figuraFade || riduciMovimento,
          'tony-figura--esce': inFadeOut,
        }"
      >
        <img
          v-if="mostraStatico"
          class="tony-statico"
          :src="staticoSrc"
          alt=""
          :width="staticoW"
          :height="staticoH"
          :style="{ opacity: staticoOpacity }"
        />
        <div
          v-show="!mostraStatico || staticoDaClip"
          ref="figuraHost"
          class="tony-player-host"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.tony-stage {
  position: fixed;
  inset: 0;
  z-index: 40;
  pointer-events: none;
}

.tony-riga {
  pointer-events: none;
}

.fumetto {
  pointer-events: auto;
  background: #fff;
  border: 1px solid rgba(15, 77, 50, 0.14);
  box-shadow: 0 12px 32px rgba(6, 20, 14, 0.16);
}

.etichetta {
  margin: 0 0 0.35rem;
  font-size: 0.78rem;
  font-weight: 800;
  color: #0f4d32;
  flex: 0 0 auto;
}

.saluto {
  margin: 0;
  font-size: 0.98rem;
  line-height: 1.45;
  color: #06140e;
  flex: 0 0 auto;
}

.nota-saluto {
  margin: 0.45rem 0 0.55rem;
  font-size: 0.82rem;
  line-height: 1.4;
  color: #4a6358;
  flex: 0 0 auto;
}

.tony-figura {
  position: relative;
  aspect-ratio: 4 / 5;
  pointer-events: none;
}

.tony-figura--fade {
  animation: tony-fade-in 280ms ease;
}

.tony-figura--esce {
  animation: tony-fade-out 280ms ease forwards;
}

.tony-player-host {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.tony-statico {
  position: absolute;
  inset: 0;
  z-index: 3;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center bottom;
  background: transparent;
  display: block;
  transition: opacity var(--ms-statico, 180ms) ease;
}

.tony-stage--desktop .tony-riga {
  position: fixed;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
  max-width: min(100vw, 720px);
}

.tony-stage--desktop .fumetto {
  width: min(400px, 42vw);
  min-width: 360px;
  max-width: 400px;
  padding: 0.9rem 1rem 1rem;
  border-radius: 16px;
  margin: 0 0.75rem 1rem 0;
}

.tony-stage--desktop .tony-figura {
  height: 30vh;
  flex: 0 0 auto;
}

.tony-stage--mobile .tony-riga {
  position: fixed;
  inset: 0;
}

.tony-stage--mobile .tony-figura {
  position: absolute;
  left: 0;
  bottom: 55vh;
  bottom: 55dvh;
  height: 30vh;
  width: auto;
  max-width: 45vw;
}

.tony-stage--mobile .fumetto {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 55vh;
  height: 55dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0.85rem 1rem calc(0.9rem + env(safe-area-inset-bottom));
  border-radius: 18px 18px 0 0;
  border-bottom: 0;
}

.tony-stage--mobile .fumetto :deep(.tony-chat) {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

@media (min-width: 768px) and (max-width: 1023px) {
  .tony-stage--desktop .tony-figura {
    height: 26vh;
  }

  .tony-stage--desktop .fumetto {
    width: min(360px, 40vw);
    min-width: 280px;
  }
}

@keyframes tony-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes tony-fade-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
</style>
