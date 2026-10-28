<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { testiLanding } from '../content/testi-landing.js';
import {
  clipInLoop,
  durataClipMs,
  percorsoClip,
  percorsoTonyStatico,
  scalettaClip,
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
const tonyStatico = percorsoTonyStatico();
const msBocca = tempiVoce().dissolvenzaBoccaMs;
const figuraHost = ref<HTMLElement | null>(null);
const chatRef = ref<{ interrompi?: () => void } | null>(null);
const inFadeOut = ref(false);
const clipPronte = ref<Record<string, boolean>>({ entry: true, idle: true });
const protezionePronta = ref<boolean | null>(null);

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
let protezioneAvviata = false;
let codaClip: string[] = [];
let clipCorrente = '';
let faseClipPrecedente = '';
let generazioneClip = 0;

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

function suonaProssima() {
  if (smontato || !player) return;
  if (!codaClip.length) return;
  const nome = codaClip.shift() as string;
  clipCorrente = nome;

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

  if (!clipChatPronta(nome) && nome !== 'entry' && nome !== 'idle' && nome !== 'exit' && nome !== 'talking') {
    // clip chat non pronta: resta su idle
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
    onFine: () => {
      if (smontato || gen !== generazioneClip) return;
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
        // ripeti thinking finché resta in pensa
        codaClip = ['thinking'];
        suonaProssima();
        return;
      }
      if (!loop) suonaProssima();
    },
  });

  if (nome === 'idle') idleAvviata = true;
}

function avviaScaletta(da: string, a: string) {
  generazioneClip += 1;
  if (timerGiro) {
    window.clearTimeout(timerGiro);
    timerGiro = 0;
  }
  assicuratiPlayer();
  if (!player) return;

  if (a === 'statico') {
    player.ferma();
    player = null;
    return;
  }

  if (props.riduciMovimento && a !== 'esce' && a !== 'entra') {
    if (a === 'idle' || a === 'ascolta' || a === 'pensa' || a === 'scrive' || a === 'parla') {
      codaClip = ['idle'];
      suonaProssima();
      return;
    }
  }

  // uscita da loop: aspetta fine giro per ascolta→idle/pensa e scrive→idle
  const daLoop =
    (da === 'ascolta' && (a === 'idle' || a === 'pensa') && clipCorrente === 'listenLoop') ||
    (da === 'scrive' && a === 'idle' && clipCorrente === 'scrive') ||
    (da === 'pensa' && (a === 'scrive' || a === 'idle') && clipCorrente === 'thinking');

  const lista = scalettaClip(da, a);
  if (!lista.length && a !== 'statico') return;

  const parti = () => {
    codaClip = lista.slice();
    if (a === 'idle' && da === 'entra') {
      // entry poi idle già in lista
    }
    suonaProssima();
  };

  if (daLoop && player && typeof player.allaFineDelGiro === 'function') {
    const durata =
      clipCorrente === 'listenLoop'
        ? durataClipMs('listenLoop')
        : clipCorrente === 'scrive'
          ? durataClipMs('scrive')
          : durataClipMs('thinking');
    timerGiro = player.allaFineDelGiro(durata, () => {
      if (smontato) return;
      // se thinking e andiamo a scrive/idle: non ripetere, vai alla scaletta
      parti();
    });
    return;
  }

  parti();
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
  timerEntrata = window.setTimeout(() => {
    if (!entrataEmessa) {
      codaClip = ['idle'];
      suonaProssima();
      emettiEntrata();
    }
  }, 4000);
  codaClip = ['entry', 'idle'];
  suonaProssima();
}

function suonaUscita() {
  if (uscitaAvviata || smontato) return;
  uscitaAvviata = true;
  chatRef.value?.interrompi?.();
  generazioneClip += 1;
  const conClip = props.uscitaConClip && !props.riduciMovimento;
  if (!conClip) {
    inFadeOut.value = true;
    player?.ferma();
    timerUscita = window.setTimeout(emettiUscita, 280);
    return;
  }
  assicuratiPlayer();
  codaClip = ['exit'];
  suonaProssima();
  timerUscita = window.setTimeout(emettiUscita, 4500);
}

function applicaFase(fase: string, precedente?: string) {
  const prec = precedente || faseClipPrecedente || '';
  if (fase === 'entra') suonaEntrata();
  else if (fase === 'esce') suonaUscita();
  else if (fase === 'statico') {
    player?.ferma();
    player = null;
  } else if (
    fase === 'idle' ||
    fase === 'ascolta' ||
    fase === 'pensa' ||
    fase === 'scrive' ||
    fase === 'parla'
  ) {
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

onMounted(() => {
  assicuratiPlayer();
  applicaFase(props.fase);
});

onUnmounted(() => {
  smontato = true;
  if (timerEntrata) window.clearTimeout(timerEntrata);
  if (timerUscita) window.clearTimeout(timerUscita);
  if (timerGiro) window.clearTimeout(timerGiro);
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

defineExpose({ marcaClipPronta, precaricaClip: async (nome: string) => {
  assicuratiPlayer();
  if (!player) return;
  await player.precarica(urlClip(nome));
  marcaClipPronta(nome);
}});

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
    :style="{ '--ms-bocca': msBocca + 'ms' }"
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
        <div
          v-show="fase !== 'statico'"
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
}

.saluto {
  margin: 0;
  font-size: 0.98rem;
  line-height: 1.45;
  color: #06140e;
}

.nota-saluto {
  margin: 0.45rem 0 0.55rem;
  font-size: 0.82rem;
  line-height: 1.4;
  color: #4a6358;
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
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center bottom;
  background: transparent;
  display: block;
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
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column-reverse;
  align-items: flex-start;
}

.tony-stage--mobile .tony-figura {
  height: 30vh;
  align-self: flex-start;
  margin-left: 0;
}

.tony-stage--mobile .fumetto {
  width: 100%;
  max-height: 55vh;
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
