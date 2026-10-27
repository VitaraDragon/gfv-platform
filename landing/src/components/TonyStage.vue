<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { URL_REGISTRAZIONE } from '../config/landing-config.js';
import { testiLanding } from '../content/testi-landing.js';
import { percorsoClip, percorsoTonyStatico, tempiVoce } from '../lib/tony-bussa-logica.js';
import { avvia, ferma } from '../lib/stacked-alpha-player.js';

const props = defineProps<{
  fase: string;
  variante: string;
  formato: string;
  riduciMovimento: boolean;
  uscitaConClip: boolean;
  boccaAperta: boolean;
}>();

const emit = defineEmits(['entrataFinita', 'uscitaFinita', 'saluta', 'clipNonPronta']);

const t = testiLanding.tonyBussa;
const tonyStatico = percorsoTonyStatico();
const msBocca = tempiVoce().dissolvenzaBoccaMs;
const videoEntry = ref<HTMLVideoElement | null>(null);
const videoIdle = ref<HTMLVideoElement | null>(null);
const videoTalking = ref<HTMLVideoElement | null>(null);
const videoExit = ref<HTMLVideoElement | null>(null);
const canvasEntry = ref<HTMLCanvasElement | null>(null);
const canvasIdle = ref<HTMLCanvasElement | null>(null);
const canvasTalking = ref<HTMLCanvasElement | null>(null);
const canvasExit = ref<HTMLCanvasElement | null>(null);
const boccaVisibile = computed(
  () => props.fase === 'parla' && props.boccaAperta === true && !props.riduciMovimento
);
const nascondiEntrata = ref(false);
const inFadeOut = ref(false);

let playerEntry: { ferma: () => void } | null = null;
let playerIdle: { ferma: () => void } | null = null;
let playerTalking: { ferma: () => void } | null = null;
let playerExit: { ferma: () => void } | null = null;
let entrataAvviata = false;
let idleAvviata = false;
let uscitaAvviata = false;
let entrataEmessa = false;
let uscitaEmessa = false;
let smontato = false;
let timerEntrata = 0;
let timerUscita = 0;
let protezioneAvviata = false;

const saluto = () =>
  props.variante === 'mobile' ? t.salutoMobile : t.salutoDesktop;

function src(nome: 'entry' | 'idle' | 'exit' | 'talking') {
  const formato = props.formato === 'stacked' ? 'stacked' : 'webm';
  const variante = props.variante === 'mobile' ? 'mobile' : 'desktop';
  return percorsoClip(nome, variante, formato);
}

function playSicuro(el: HTMLVideoElement | null) {
  if (!el) return;
  const promessa = el.play();
  if (promessa && typeof promessa.catch === 'function') {
    promessa.catch(() => {});
  }
}

function emettiEntrata() {
  if (smontato || entrataEmessa) return;
  entrataEmessa = true;
  if (timerEntrata) window.clearTimeout(timerEntrata);
  emit('entrataFinita');
}

function emettiUscita() {
  if (smontato || uscitaEmessa) return;
  uscitaEmessa = true;
  if (timerUscita) window.clearTimeout(timerUscita);
  emit('uscitaFinita');
}

function suonaIdle() {
  if (idleAvviata || smontato) return;
  idleAvviata = true;
  if (props.formato === 'stacked') {
    if (!canvasIdle.value) return;
    playerIdle = avvia(canvasIdle.value, src('idle'), {
      loop: true,
      onPrimoFotogramma: () => {
        nascondiEntrata.value = true;
        playerEntry?.ferma();
        playerEntry = null;
      },
    });
    return;
  }
  const idle = videoIdle.value;
  if (!idle) return;
  idle.loop = true;
  const rivela = () => {
    if (smontato) return;
    try {
      idle.currentTime = 0;
    } catch {
      /* il browser non ha ancora un fotogramma */
    }
    nascondiEntrata.value = true;
    videoEntry.value?.pause();
    playSicuro(idle);
  };
  if (idle.readyState >= 2) rivela();
  else idle.addEventListener('loadeddata', rivela, { once: true });
}

function suonaEntrata() {
  if (entrataAvviata || smontato) return;
  entrataAvviata = true;
  if (props.riduciMovimento) {
    suonaIdle();
    emettiEntrata();
    return;
  }
  timerEntrata = window.setTimeout(() => {
    suonaIdle();
    emettiEntrata();
  }, 4000);
  if (props.formato === 'stacked') {
    if (!canvasEntry.value) return;
    playerEntry = avvia(canvasEntry.value, src('entry'), {
      loop: false,
      onFine: () => {
        suonaIdle();
        emettiEntrata();
      },
    });
    return;
  }
  const idle = videoIdle.value;
  if (idle && idle.readyState >= 1) {
    try {
      idle.currentTime = 0;
    } catch {
      /* ancora vuoto */
    }
  }
  playSicuro(videoEntry.value);
}

function onEntryEnded() {
  if (smontato || props.formato === 'stacked') return;
  if (props.fase === 'esce' || props.fase === 'statico') return;
  suonaIdle();
  emettiEntrata();
}

function suonaTalking() {
  if (smontato || props.riduciMovimento) return;
  if (props.formato === 'stacked') {
    if (!canvasTalking.value) return;
    playerTalking?.ferma();
    playerTalking = avvia(canvasTalking.value, src('talking'), { loop: true });
    return;
  }
  const video = videoTalking.value;
  if (!video) return;
  try {
    video.currentTime = 0;
  } catch {
    /* ancora vuoto */
  }
  video.loop = true;
  playSicuro(video);
}

function fermaTalking() {
  const video = videoTalking.value;
  if (video) {
    try {
      video.pause();
    } catch {
      /* già fermo */
    }
  }
  if (playerTalking) {
    playerTalking.ferma();
    playerTalking = null;
  }
}

function suonaUscita() {
  if (uscitaAvviata || smontato) return;
  uscitaAvviata = true;
  fermaTalking();
  videoEntry.value?.pause();
  videoIdle.value?.pause();
  playerEntry?.ferma();
  playerIdle?.ferma();
  playerEntry = null;
  playerIdle = null;
  const conClip = props.uscitaConClip && !props.riduciMovimento;
  if (!conClip) {
    inFadeOut.value = true;
    timerUscita = window.setTimeout(emettiUscita, 280);
    return;
  }
  if (props.formato === 'stacked') {
    if (!canvasExit.value) {
      timerUscita = window.setTimeout(emettiUscita, 400);
      return;
    }
    playerExit = avvia(canvasExit.value, src('exit'), {
      loop: false,
      onFine: emettiUscita,
    });
    timerUscita = window.setTimeout(emettiUscita, 4500);
    return;
  }
  const exit = videoExit.value;
  if (!exit) {
    timerUscita = window.setTimeout(emettiUscita, 400);
    return;
  }
  playSicuro(exit);
  timerUscita = window.setTimeout(emettiUscita, 4500);
}

function onExitEnded() {
  emettiUscita();
}

function onMediaError() {
  if (smontato || props.fase === 'idle' || props.fase === 'esce' || props.fase === 'parla') return;
  emit('clipNonPronta');
}

function avviaProtezionePigro() {
  if (protezioneAvviata || smontato) return;
  protezioneAvviata = true;
  // Firebase e App Check solo dopo che Tony è entrato (non all'apertura, non durante l'entrata).
  import('../lib/firebase-landing.js')
    .then((m) => m.avviaProtezione())
    .catch(() => {});
}

function applicaFase(fase: string, precedente?: string) {
  if (precedente === 'parla' && fase !== 'parla') fermaTalking();
  if (fase === 'entra') suonaEntrata();
  if (fase === 'idle') suonaIdle();
  if (fase === 'parla') suonaTalking();
  if (fase === 'esce') suonaUscita();
  if (fase === 'idle' || fase === 'parla' || fase === 'statico') {
    avviaProtezionePigro();
  }
}

watch(
  () => props.fase,
  (fase, precedente) => applicaFase(fase, precedente)
);

onMounted(() => applicaFase(props.fase));

onUnmounted(() => {
  smontato = true;
  if (timerEntrata) window.clearTimeout(timerEntrata);
  if (timerUscita) window.clearTimeout(timerUscita);
  playerEntry?.ferma();
  playerIdle?.ferma();
  playerTalking?.ferma();
  playerExit?.ferma();
  ferma();
  for (const el of [videoEntry.value, videoIdle.value, videoTalking.value, videoExit.value]) {
    if (!el) continue;
    try {
      el.pause();
    } catch {
      /* già fermo */
    }
    el.removeAttribute('src');
    try {
      el.load();
    } catch {
      /* elemento già staccato */
    }
  }
});
</script>

<template>
  <div
    class="tony-stage"
    :class="variante === 'mobile' ? 'tony-stage--mobile' : 'tony-stage--desktop'"
    :style="{ '--ms-bocca': msBocca + 'ms' }"
  >
    <div class="tony-riga">
      <div
        v-show="fase === 'idle' || fase === 'statico' || fase === 'parla' || fase === 'esce'"
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
          <div class="fumetto-azioni">
            <a class="btn-account" :href="URL_REGISTRAZIONE">{{ t.ctaAccount }}</a>
            <button type="button" class="btn-saluta" @click="emit('saluta')">
              {{ t.saluta }}
            </button>
          </div>
        </template>
      </div>

      <div
        v-show="fase !== 'bussa'"
        class="tony-figura"
        aria-hidden="true"
        :class="{
          'tony-figura--fade': riduciMovimento || fase === 'statico',
          'tony-figura--esce': inFadeOut,
        }"
      >
        <img
          v-if="fase === 'statico'"
          class="tony-statico"
          :src="tonyStatico"
          alt=""
          width="744"
          height="1024"
        />
        <template v-else-if="formato === 'webm'">
          <video
            ref="videoEntry"
            class="clip clip-entry"
            :class="{ 'clip--nascosta': nascondiEntrata || fase === 'esce' || fase === 'statico' }"
            :src="src('entry')"
            muted
            playsinline
            preload="auto"
            @ended="onEntryEnded"
            @error="onMediaError"
          />
          <video
            ref="videoIdle"
            class="clip clip-idle"
            :class="{ 'clip--nascosta': !nascondiEntrata || fase === 'esce' || fase === 'statico' || boccaVisibile }"
            :src="src('idle')"
            muted
            playsinline
            loop
            preload="auto"
            @error="onMediaError"
          />
          <video
            ref="videoTalking"
            class="clip clip-talking"
            :class="{ 'clip--nascosta': !boccaVisibile }"
            :src="src('talking')"
            muted
            playsinline
            loop
            preload="auto"
          />
          <video
            ref="videoExit"
            class="clip clip-exit"
            :class="{ 'clip--nascosta': fase !== 'esce' || !uscitaConClip }"
            :src="src('exit')"
            muted
            playsinline
            preload="auto"
            @ended="onExitEnded"
          />
        </template>
        <template v-else>
          <canvas
            ref="canvasEntry"
            class="clip clip-entry"
            :class="{ 'clip--nascosta': nascondiEntrata || fase === 'esce' || fase === 'statico' }"
          />
          <canvas
            ref="canvasIdle"
            class="clip clip-idle"
            :class="{ 'clip--nascosta': !nascondiEntrata || fase === 'esce' || fase === 'statico' || boccaVisibile }"
          />
          <canvas
            ref="canvasTalking"
            class="clip clip-talking"
            :class="{ 'clip--nascosta': !boccaVisibile }"
          />
          <canvas
            ref="canvasExit"
            class="clip clip-exit"
            :class="{ 'clip--nascosta': fase !== 'esce' || !uscitaConClip }"
          />
        </template>
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

.fumetto,
.btn-account,
.btn-saluta {
  pointer-events: auto;
}

.etichetta {
  margin: 0 0 0.35rem;
  font-size: 0.78rem;
  font-weight: 800;
  color: #0f4d32;
}

.saluto {
  margin: 0;
  font-size: 0.98rem;
  line-height: 1.45;
  color: #06140e;
}

.nota-saluto {
  margin: 0.45rem 0 0;
  font-size: 0.82rem;
  line-height: 1.4;
  color: #4a6358;
}

.fumetto {
  background: #fff;
  border: 1px solid rgba(15, 77, 50, 0.14);
  box-shadow: 0 12px 32px rgba(6, 20, 14, 0.16);
}

.fumetto-azioni {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.btn-account,
.btn-saluta {
  font-family: inherit;
  font-weight: 700;
  font-size: 0.92rem;
  border-radius: 999px;
  text-decoration: none;
}

.btn-account {
  display: inline-flex;
  align-items: center;
  padding: 0.65rem 0.9rem;
  background: #0f4d32;
  color: #fff;
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

.clip {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: transparent;
}

.clip-entry {
  z-index: 2;
}

.clip-idle,
.clip-talking {
  transition: opacity var(--ms-bocca, 150ms) ease;
}

.clip-idle {
  z-index: 1;
}

.clip-talking {
  z-index: 2;
}

.clip-exit {
  z-index: 3;
}

.clip--nascosta {
  opacity: 0;
}

.tony-statico {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center bottom;
  background: transparent;
  display: block;
}

.tony-stage--desktop .tony-riga {
  position: fixed;
  right: 1.25rem;
  bottom: 1.25rem;
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
  max-width: calc(100vw - 2rem);
}

.tony-stage--desktop .fumetto {
  width: min(380px, 42vw);
  padding: 0.9rem 1rem 1rem;
  border-radius: 16px;
}

.tony-stage--desktop .tony-figura {
  height: 30vh;
  flex: 0 0 auto;
}

.tony-stage--mobile .tony-riga {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tony-stage--mobile .tony-figura {
  height: 30vh;
}

.tony-stage--mobile .fumetto {
  width: 100%;
  max-height: 40vh;
  overflow: auto;
  padding: 0.85rem 1rem calc(0.9rem + env(safe-area-inset-bottom));
  border-radius: 18px 18px 0 0;
  border-bottom: 0;
}

@media (min-width: 768px) and (max-width: 1023px) {
  .tony-stage--desktop .tony-figura {
    height: 26vh;
  }

  .tony-stage--desktop .fumetto {
    width: min(320px, 40vw);
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
