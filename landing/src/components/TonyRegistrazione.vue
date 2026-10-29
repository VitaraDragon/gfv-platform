<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import { testiLanding } from '../content/testi-landing.js';
import {
  caselleLegali,
  eseguiRegistrazione,
  messaggioEsito,
  validaModuloRegistrazione,
  URL_REGISTRAZIONE,
} from '../lib/tony-registrazione.js';

const emit = defineEmits(['chiudi-modulo', 'registrazione-completata', 'invio-in-corso']);

const t = testiLanding.tonyBussa.registrazione;
const caselle = caselleLegali();

const email = ref('');
const password = ref('');
const conferma = ref('');
const aziendaNome = ref('');
const termini = ref(false);
const dpa = ref(false);
const inInvio = ref(false);
const successo = ref(false);
const legaleRimandata = ref(false);
const erroreGenerale = ref('');
const errori = ref<Record<string, string>>({});

const emailEl = ref<HTMLInputElement | null>(null);
const passwordEl = ref<HTMLInputElement | null>(null);
const confermaEl = ref<HTMLInputElement | null>(null);
const aziendaEl = ref<HTMLInputElement | null>(null);

onMounted(() => {
  nextTick(() => emailEl.value?.focus());
});

function focusPrimoErrore(err: Record<string, string>) {
  nextTick(() => {
    if (err.email) emailEl.value?.focus();
    else if (err.password) passwordEl.value?.focus();
    else if (err.conferma) confermaEl.value?.focus();
    else if (err.azienda) aziendaEl.value?.focus();
  });
}

function onAnnulla() {
  if (inInvio.value) return;
  emit('chiudi-modulo');
}

async function onInvia() {
  if (inInvio.value || successo.value) return;
  erroreGenerale.value = '';
  const validazione = validaModuloRegistrazione({
    email: email.value,
    password: password.value,
    conferma: conferma.value,
    aziendaNome: aziendaNome.value,
    caselle: { termini: termini.value, dpa: dpa.value },
  });
  errori.value = validazione.errori;
  if (!validazione.ok) {
    focusPrimoErrore(validazione.errori);
    return;
  }

  inInvio.value = true;
  emit('invio-in-corso', true);
  const dati = {
    email: email.value,
    password: password.value,
    aziendaNome: aziendaNome.value,
    caselle: { termini: termini.value, dpa: dpa.value },
  };
  password.value = '';
  conferma.value = '';

  try {
    let esito;
    if (import.meta.env.DEV) {
      const query = typeof window !== 'undefined' ? window.location.search : '';
      const finta = await import('../lib/tony-registrazione-finta.js');
      const scenario = finta.parametroTonyReg(query);
      if (scenario) {
        esito = await finta.eseguiRegistrazioneFinta({ scenario, dati });
      }
    }
    if (!esito) {
      const account = await import('../lib/firebase-landing-account.js');
      const fb = await account.strumentiRegistrazione();
      esito = await eseguiRegistrazione({ dati, fb });
      // Sessione resta aperta per la fase account (passo 14); esce TonyStage.
    }

    if (esito.esito === 'ok' || esito.esito === 'ok-legale-rimandata') {
      successo.value = true;
      legaleRimandata.value = esito.esito === 'ok-legale-rimandata';
      emit('registrazione-completata');
      return;
    }

    erroreGenerale.value = messaggioEsito(esito.codice || 'sconosciuto');
    if (esito.codice === 'email-usata' || esito.codice === 'email-non-valida') {
      errori.value = { email: erroreGenerale.value };
      focusPrimoErrore(errori.value);
    } else if (esito.codice === 'password-debole') {
      errori.value = { password: erroreGenerale.value };
      focusPrimoErrore(errori.value);
    } else if (esito.codice === 'azienda') {
      errori.value = { azienda: erroreGenerale.value };
      focusPrimoErrore(errori.value);
    }
  } catch (err: any) {
    const codice = err && err.code === 'protezione-non-pronta' ? 'protezione-non-pronta' : 'sconosciuto';
    erroreGenerale.value = messaggioEsito(codice);
  } finally {
    inInvio.value = false;
    emit('invio-in-corso', false);
  }
}
</script>

<template>
  <div class="tony-reg" @keydown.escape.stop="onAnnulla">
    <template v-if="!successo">
      <form class="tony-reg-form" @submit.prevent="onInvia">
        <div class="campo">
          <label for="tony-reg-email">{{ t.etichettaEmail }}</label>
          <input
            id="tony-reg-email"
            ref="emailEl"
            v-model="email"
            type="email"
            autocomplete="email"
            :disabled="inInvio"
            :aria-invalid="!!errori.email"
            :aria-describedby="errori.email ? 'tony-reg-email-err' : undefined"
          />
          <p v-if="errori.email" id="tony-reg-email-err" class="err">{{ errori.email }}</p>
        </div>

        <div class="campo">
          <label for="tony-reg-password">{{ t.etichettaPassword }}</label>
          <input
            id="tony-reg-password"
            ref="passwordEl"
            v-model="password"
            type="password"
            autocomplete="new-password"
            :disabled="inInvio"
            :aria-invalid="!!errori.password"
            :aria-describedby="errori.password ? 'tony-reg-password-err' : undefined"
          />
          <p v-if="errori.password" id="tony-reg-password-err" class="err">{{ errori.password }}</p>
        </div>

        <div class="campo">
          <label for="tony-reg-conferma">{{ t.etichettaConferma }}</label>
          <input
            id="tony-reg-conferma"
            ref="confermaEl"
            v-model="conferma"
            type="password"
            autocomplete="new-password"
            :disabled="inInvio"
            :aria-invalid="!!errori.conferma"
            :aria-describedby="errori.conferma ? 'tony-reg-conferma-err' : undefined"
          />
          <p v-if="errori.conferma" id="tony-reg-conferma-err" class="err">{{ errori.conferma }}</p>
        </div>

        <div class="campo">
          <label for="tony-reg-azienda">{{ t.etichettaAzienda }}</label>
          <input
            id="tony-reg-azienda"
            ref="aziendaEl"
            v-model="aziendaNome"
            type="text"
            autocomplete="organization"
            :disabled="inInvio"
            :aria-invalid="!!errori.azienda"
            :aria-describedby="errori.azienda ? 'tony-reg-azienda-err' : undefined"
          />
          <p v-if="errori.azienda" id="tony-reg-azienda-err" class="err">{{ errori.azienda }}</p>
        </div>

        <div v-for="c in caselle" :key="c.id" class="casella">
          <template v-if="c.soloLink">
            <a
              v-for="(p, i) in c.htmlParti"
              :key="i"
              :href="p.href"
              target="_blank"
              rel="noopener"
            >{{ p.testo }}</a>
          </template>
          <label v-else>
            <input
              v-if="c.id === 'termini'"
              v-model="termini"
              type="checkbox"
              :disabled="inInvio"
            />
            <input
              v-else-if="c.id === 'dpa'"
              v-model="dpa"
              type="checkbox"
              :disabled="inInvio"
            />
            <span>
              <template v-for="(p, i) in c.htmlParti" :key="i">
                <a
                  v-if="p.tipo === 'link'"
                  :href="p.href"
                  target="_blank"
                  rel="noopener"
                >{{ p.testo }}</a>
                <template v-else>{{ p.testo }}</template>
              </template>
            </span>
          </label>
          <p v-if="errori[c.id]" class="err">{{ errori[c.id] }}</p>
        </div>

        <p v-if="erroreGenerale" class="err-gen" role="alert">
          {{ erroreGenerale }}
          <a
            v-if="erroreGenerale === t.errori['protezione-non-pronta'] || erroreGenerale === t.errori.sconosciuto"
            :href="URL_REGISTRAZIONE"
          >{{ t.ctaAccountClassica || 'registrazione classica' }}</a>
        </p>

        <div class="azioni">
          <button type="submit" class="btn-crea" :disabled="inInvio">
            {{ inInvio ? t.invio : t.crea }}
          </button>
          <button type="button" class="btn-annulla" :disabled="inInvio" @click="onAnnulla">
            {{ t.annulla }}
          </button>
        </div>
      </form>
    </template>

    <template v-else>
      <p class="fatto" role="status">{{ t.fatto }}</p>
      <p v-if="legaleRimandata" class="nota">{{ t.legaleRimandata }}</p>
    </template>
  </div>
</template>

<style scoped>
.tony-reg {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-width: 0;
}

.tony-reg-form {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.campo label,
.casella label {
  display: block;
  font-size: 0.82rem;
  font-weight: 600;
  color: #0f4d32;
  margin-bottom: 0.2rem;
}

.campo input[type='email'],
.campo input[type='password'],
.campo input[type='text'] {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid rgba(15, 77, 50, 0.28);
  border-radius: 8px;
  padding: 0.45rem 0.55rem;
  font-size: 0.95rem;
}

.casella label {
  display: flex;
  gap: 0.4rem;
  align-items: flex-start;
  font-weight: 400;
  line-height: 1.35;
}

.casella input[type='checkbox'] {
  margin-top: 0.2rem;
  flex: 0 0 auto;
}

.err,
.err-gen {
  margin: 0.15rem 0 0;
  color: #9b1c1c;
  font-size: 0.78rem;
}

.azioni {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.25rem;
}

.btn-crea,
.btn-dashboard {
  border: 0;
  background: #0f4d32;
  color: #fff;
  font-weight: 700;
  border-radius: 999px;
  padding: 0.45rem 0.9rem;
  font-size: 0.88rem;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  text-align: center;
}

.btn-crea:disabled {
  opacity: 0.65;
  cursor: wait;
}

.btn-annulla {
  border: 1px solid rgba(15, 77, 50, 0.28);
  background: #fff;
  color: #0f4d32;
  border-radius: 999px;
  padding: 0.45rem 0.9rem;
  font-size: 0.88rem;
  cursor: pointer;
}

.fatto {
  margin: 0;
  font-weight: 700;
  color: #0f4d32;
}

.nota {
  margin: 0;
  font-size: 0.88rem;
  color: #1a3d2c;
}
</style>
