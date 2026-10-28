<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { URL_REGISTRAZIONE } from '../config/landing-config.js';
import { testiLanding } from '../content/testi-landing.js';
import { chiediATony } from '../lib/tony-chat-client.js';
import {
  MAX_CARATTERI_DOMANDA,
  MESSAGGI_CHAT,
  azionePerEsito,
  aggiornaStoria,
  nuovaSessione,
  validaDomanda,
} from '../lib/tony-chat-logica.js';

const props = defineProps<{
  ottieniToken: () => Promise<string | null>;
  variante: string;
  riduciMovimento: boolean;
  salutoFinito: boolean;
  protezionePronta: boolean | null;
  staticoForzato: boolean;
}>();

const emit = defineEmits([
  'ascoltoIniziato',
  'ascoltoFinito',
  'domandaInviata',
  'testoArrivato',
  'rispostaFinita',
  'servizioSpento',
  'saluta',
]);

const t = testiLanding.tonyBussa;

type Battuta = {
  ruolo: 'utente' | 'tony' | 'nascosta';
  testo: string;
  live?: boolean;
};

const campo = ref('');
const inAttesa = ref(false);
const campoAttivo = ref(true);
const chipVisibili = ref(true);
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

let recognition: any = null;
let abortCorrente: AbortController | null = null;
let timerFuoco = 0;
let ascoltoEmesso = false;
let smontato = false;

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

async function inviaTesto(grezzo: string, daChip = false) {
  if (inAttesa.value || !campoAttivo.value || modalitàStatica.value) return;
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

  const domanda = validazione.domanda;
  campo.value = '';
  chipVisibili.value = false;
  fermaMicrofono();
  if (ascoltoEmesso) {
    ascoltoEmesso = false;
    emit('ascoltoFinito');
  }

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

  let esito;
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
      });
    } else {
      esito = await chiediATony({
        domanda,
        sessione: sessione.value,
        storia: storia.value,
        ottieniToken: props.ottieniToken,
        onPezzo,
        segnale: abortCorrente.signal,
      });
    }
  } catch {
    esito = { codice: 'errore' };
  }

  if (smontato) return;
  abortCorrente = null;
  inAttesa.value = false;

  const azione = azionePerEsito(esito);
  if (azione.tipo === 'statico') {
    // togli testo parziale e resta solo la frase
    if (primoPezzo) {
      const ultimo = messaggi.value[messaggi.value.length - 1];
      if (ultimo && ultimo.live) messaggi.value.pop();
    }
    testoParziale.value = '';
    passaAStatico(azione.testo);
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

  campoAttivo.value = azione.campoAttivo;
  if (azione.tipo === 'limite') {
    mostraAccountEvidenza.value = true;
    chipVisibili.value = false;
  }

  emit('rispostaFinita');
  scorriInBasso();
  if (azione.campoAttivo) nextTick(() => inputEl.value?.focus());
  void daChip;
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
  if (document.hidden) fermaMicrofono();
}

onUnmounted(() => {
  smontato = true;
  fermaMicrofono();
  if (abortCorrente) abortCorrente.abort();
  if (timerFuoco) window.clearTimeout(timerFuoco);
  document.removeEventListener('visibilitychange', onVisibility);
});

/** Esposto a TonyStage quando si saluta a metà richiesta. */
function interrompi() {
  if (abortCorrente) abortCorrente.abort();
  fermaMicrofono();
}

defineExpose({ interrompi });
</script>

<template>
  <div class="tony-chat">
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
    </div>

    <p
      v-if="inAttesa && !testoParziale"
      class="sr-only"
      aria-live="polite"
    >
      {{ t.pensaLettoreSchermo }}
    </p>

    <template v-if="chatVisibile && campoAttivo">
      <div v-if="chipVisibili" class="chip-riga" role="group" aria-label="Domande rapide">
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

    <div class="fumetto-azioni">
      <a
        class="btn-account"
        :class="{ 'btn-account--evidenza': mostraAccountEvidenza || modalitàStatica || staticoForzato }"
        :href="URL_REGISTRAZIONE"
      >
        {{ t.ctaAccount }}
      </a>
      <button type="button" class="btn-saluta" @click="emit('saluta')">
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
