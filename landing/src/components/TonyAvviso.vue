<script setup lang="ts">
// BOZZA: da far rivedere
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import { EMAIL_CONTATTO, PAGINE_LEGALI } from '../config/landing-config.js';
import { testiLanding } from '../content/testi-landing.js';

const props = defineProps<{
  inChiusura?: boolean;
}>();

const emit = defineEmits(['conferma', 'rinuncia']);

const t = testiLanding.tonyBussa;
const email = EMAIL_CONTATTO;
const hrefPrivacy = `${PAGINE_LEGALI.privacy.percorso}#tony`;
const radice = ref<HTMLElement | null>(null);
const letto = ref(false);
const audio = ref(true);
let overflowPrima = '';

function fuochi(root: HTMLElement) {
  const nodi = root.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])'
  );
  return [...nodi].filter((el) => !el.hasAttribute('disabled'));
}

function onKeydown(e: KeyboardEvent) {
  if (props.inChiusura) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    emit('rinuncia');
    return;
  }
  if (e.key !== 'Tab' || !radice.value) return;
  const lista = fuochi(radice.value);
  if (lista.length === 0) return;
  const primo = lista[0];
  const ultimo = lista[lista.length - 1];
  const attivo = document.activeElement;
  if (e.shiftKey && (attivo === primo || !radice.value.contains(attivo))) {
    e.preventDefault();
    ultimo.focus();
  } else if (!e.shiftKey && attivo === ultimo) {
    e.preventDefault();
    primo.focus();
  }
}

function conferma() {
  if (!letto.value) return;
  emit('conferma', { audio: audio.value });
}

onMounted(() => {
  overflowPrima = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onKeydown);
  nextTick(() => {
    radice.value?.focus();
  });
});

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown);
  document.body.style.overflow = overflowPrima;
});
</script>

<template>
  <!-- BOZZA: da far rivedere -->
  <div
    class="avviso-backdrop"
    :class="{ 'avviso-backdrop--chiude': inChiusura }"
  >
    <div
      ref="radice"
      class="avviso"
      role="dialog"
      aria-modal="true"
      aria-labelledby="avviso-titolo"
      aria-describedby="avviso-testo"
      tabindex="-1"
    >
      <h2 id="avviso-titolo">{{ t.avvisoTitolo }}</h2>
      <div id="avviso-testo" class="avviso-testo">
        <p v-for="(para, i) in t.avvisoParagrafi" :key="i">
          <template v-for="(pezzo, j) in para" :key="j">
            <strong v-if="pezzo.forte">{{ pezzo.testo }}</strong>
            <span v-else>{{ pezzo.testo }}</span>
          </template>
        </p>
        <p class="titolare">
          {{ t.titolare }}<template v-if="email">, {{ email }}</template>.
          <a :href="hrefPrivacy">{{ t.linkPrivacy }}</a>
        </p>
      </div>

      <label class="check">
        <input v-model="letto" type="checkbox" />
        <span>{{ t.presaVisione }}</span>
      </label>
      <label class="check">
        <input v-model="audio" type="checkbox" />
        <span>{{ t.audioAttivo }}</span>
      </label>

      <div class="azioni">
        <button type="button" class="btn-entra" :disabled="!letto" @click="conferma">
          {{ t.faiEntrare }}
        </button>
        <button type="button" class="btn-no" @click="emit('rinuncia')">
          {{ t.noGrazie }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.avviso-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(6, 20, 14, 0.48);
}

.avviso-backdrop--chiude {
  animation: avviso-out 200ms ease forwards;
}

.avviso {
  width: min(36rem, 100%);
  max-height: min(90vh, 40rem);
  overflow: auto;
  padding: 1.25rem 1.2rem 1.1rem;
  border-radius: 16px;
  background: #fff;
  color: #06140e;
  box-shadow: 0 18px 48px rgba(6, 20, 14, 0.28);
}

.avviso:focus {
  outline: none;
}

h2 {
  margin: 0 0 0.75rem;
  font-size: 1.25rem;
  letter-spacing: -0.02em;
  color: #0f4d32;
}

.avviso-testo p {
  margin: 0 0 0.75rem;
  font-size: 0.95rem;
  line-height: 1.5;
  color: #1a2e24;
}

.titolare a {
  color: #0f4d32;
  font-weight: 700;
}

.check {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  margin: 0.45rem 0;
  font-weight: 600;
  line-height: 1.4;
}

.check input {
  margin-top: 0.2rem;
  width: 1.05rem;
  height: 1.05rem;
  accent-color: #0f4d32;
}

.azioni {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 0.9rem;
}

.btn-entra,
.btn-no {
  font-family: inherit;
  cursor: pointer;
  border-radius: 999px;
  font-weight: 700;
  font-size: 0.98rem;
}

.btn-entra {
  border: 0;
  padding: 0.75rem 1.1rem;
  background: #0f4d32;
  color: #fff;
}

.btn-entra:hover:not(:disabled) {
  background: #158050;
}

.btn-entra:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-no {
  padding: 0.75rem 1rem;
  background: #fff;
  color: #0f4d32;
  border: 1px solid rgba(15, 77, 50, 0.35);
}

.btn-entra:focus-visible,
.btn-no:focus-visible,
.check input:focus-visible {
  outline: 3px solid #158050;
  outline-offset: 2px;
}

@keyframes avviso-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
</style>
