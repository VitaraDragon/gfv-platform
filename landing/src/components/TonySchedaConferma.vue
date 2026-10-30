<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { testiLanding } from '../content/testi-landing.js';
import {
  collegaTerreniAiPoderi,
  controllaScheda,
  esitoSalvataggio,
  messaggioErroreSetup,
  nuovoRequestId,
  payloadDaScheda,
  risolviNomePodere,
} from '../lib/tony-aiuto-account.js';
import { COLTURE_PREDEFINITE } from '../lib/generati/tony-landing-setup-core.js';

const props = defineProps<{
  dati: {
    sede?: {
      indirizzo?: string | null;
      citta?: string | null;
      cap?: string | null;
      provincia?: string | null;
    } | null;
    poderi?: Array<{ nome?: string }>;
    terreni?: Array<{
      nome?: string;
      superficie?: number | string | null;
      coltura?: string | null;
      podere?: string | null;
    }>;
  };
  salvaAzienda: (dati: object) => Promise<any>;
}>();

const emit = defineEmits(['torna-chat', 'salvata', 'invio-in-corso', 'vai-dashboard']);

const t = testiLanding.tonyBussa.aiuto;

const requestId = ref(nuovoRequestId());
const inInvio = ref(false);
const erroreGenerale = ref('');
const giaPreparato = ref(false);
const erroriCampi = ref<Record<string, string>>({});

const sede = ref({
  indirizzo: '',
  citta: '',
  cap: '',
  provincia: '',
});
const poderi = ref<Array<{ nome: string }>>([{ nome: '' }]);
const terreni = ref<
  Array<{ nome: string; superficie: string; coltura: string; podere: string }>
>([{ nome: '', superficie: '', coltura: '', podere: '' }]);

const nomiColture = computed(() =>
  (COLTURE_PREDEFINITE || []).map((c: { nome: string }) => c.nome)
);

function caricaDaProps() {
  const grezzi = props.dati || {};
  const d = collegaTerreniAiPoderi({
    sede: grezzi.sede || null,
    poderi: Array.isArray(grezzi.poderi) ? grezzi.poderi : [],
    terreni: Array.isArray(grezzi.terreni) ? grezzi.terreni : [],
    ultimoPodere: grezzi.ultimoPodere || null,
  });
  sede.value = {
    indirizzo: (d.sede && d.sede.indirizzo) || '',
    citta: (d.sede && d.sede.citta) || '',
    cap: (d.sede && d.sede.cap) || '',
    provincia: (d.sede && d.sede.provincia) || '',
  };
  poderi.value =
    Array.isArray(d.poderi) && d.poderi.length
      ? d.poderi.map((p) => ({ nome: p.nome || '' }))
      : [{ nome: '' }];
  const nomeUnico =
    poderi.value.length === 1 && poderi.value[0].nome
      ? poderi.value[0].nome
      : '';
  terreni.value =
    Array.isArray(d.terreni) && d.terreni.length
      ? d.terreni.map((tr) => {
          const risolto =
            risolviNomePodere(tr.podere || '', poderi.value) ||
            (tr.podere ? '' : nomeUnico);
          return {
            nome: tr.nome || '',
            superficie:
              tr.superficie != null && tr.superficie !== ''
                ? String(tr.superficie).replace('.', ',')
                : '',
            coltura: tr.coltura || '',
            podere: risolto || '',
          };
        })
      : [{ nome: '', superficie: '', coltura: '', podere: nomeUnico }];
}

onMounted(() => {
  caricaDaProps();
  nextTick(() => controllaLive());
});

watch(
  () => props.dati,
  () => {
    if (!inInvio.value) caricaDaProps();
  }
);

function payloadCorrente() {
  return payloadDaScheda(
    {
      sede: sede.value,
      poderi: poderi.value,
      terreni: terreni.value,
    },
    requestId.value
  );
}

function controllaLive() {
  const esito = controllaScheda(payloadCorrente());
  const mappa: Record<string, string> = {};
  if (!esito.ok && Array.isArray(esito.errori)) {
    for (const e of esito.errori) {
      if (e && e.campo) mappa[e.campo] = e.errore || '';
    }
  }
  erroriCampi.value = mappa;
  return esito;
}

function aggiungiPodere() {
  if (poderi.value.length >= 10) return;
  poderi.value.push({ nome: '' });
}

function togliPodere(i: number) {
  poderi.value.splice(i, 1);
  if (!poderi.value.length) poderi.value.push({ nome: '' });
}

function aggiungiTerreno() {
  if (terreni.value.length >= 5) return;
  terreni.value.push({ nome: '', superficie: '', coltura: '', podere: '' });
}

function togliTerreno(i: number) {
  terreni.value.splice(i, 1);
  if (!terreni.value.length) {
    terreni.value.push({ nome: '', superficie: '', coltura: '', podere: '' });
  }
}

function onTorna() {
  if (inInvio.value) return;
  emit('torna-chat');
}

function onEsc(e: KeyboardEvent) {
  if (e.key !== 'Escape') return;
  if (inInvio.value) return;
  e.stopPropagation();
  onTorna();
}

async function onSalva() {
  if (inInvio.value) return;
  erroreGenerale.value = '';
  giaPreparato.value = false;
  const check = controllaLive();
  if (!check.ok) {
    if (check.codice === 'niente-da-salvare') {
      erroreGenerale.value = messaggioErroreSetup({ motivo: 'niente-da-salvare' });
      return;
    }
    const primo = Object.keys(erroriCampi.value)[0];
    if (primo) {
      nextTick(() => {
        const el = document.querySelector(
          `[data-campo="${CSS.escape(primo)}"]`
        ) as HTMLElement | null;
        el?.focus();
      });
    }
    erroreGenerale.value = messaggioErroreSetup({ motivo: 'dati-non-validi' });
    return;
  }

  inInvio.value = true;
  emit('invio-in-corso', true);
  try {
    const payload = payloadCorrente();
    const esito = await props.salvaAzienda(payload);
    if (esito && esito.ok && esitoSalvataggio(esito.risposta || esito).ok) {
      emit('salvata');
      return;
    }
    const motivo = (esito && (esito.motivo || esito.codice)) || 'rete';
    if (motivo === 'gia-preparato' || motivo === 'already-exists') {
      giaPreparato.value = true;
    }
    if (Array.isArray(esito?.campi)) {
      const mappa: Record<string, string> = {};
      for (const c of esito.campi) {
        if (c && typeof c === 'object' && c.campo != null) {
          mappa[String(c.campo)] = String(c.errore || 'da correggere');
        } else {
          mappa[String(c)] = 'da correggere';
        }
      }
      erroriCampi.value = mappa;
    }
    erroreGenerale.value = messaggioErroreSetup(
      {
        motivo,
        codice: esito?.codice,
        dettagli: esito?.dettagli,
      },
      { collegato: true }
    );
  } catch {
    erroreGenerale.value = messaggioErroreSetup({ motivo: 'rete' });
  } finally {
    inInvio.value = false;
    emit('invio-in-corso', false);
  }
}
</script>

<template>
  <div class="tony-scheda" @keydown="onEsc">
    <p class="intro">{{ t.schedaIntro }}</p>

    <section class="blocco" aria-labelledby="tony-scheda-sede">
      <h3 id="tony-scheda-sede">{{ t.etichettaSede }}</h3>
      <div class="campo">
        <label for="tony-scheda-via">{{ t.etichettaVia }}</label>
        <input
          id="tony-scheda-via"
          v-model="sede.indirizzo"
          data-campo="sede.indirizzo"
          type="text"
          autocomplete="off"
          :disabled="inInvio"
          :aria-invalid="!!erroriCampi['sede.indirizzo']"
          :aria-describedby="erroriCampi['sede.indirizzo'] ? 'tony-scheda-err-sede-indirizzo' : undefined"
          @input="controllaLive"
        />
        <p
          v-if="erroriCampi['sede.indirizzo']"
          id="tony-scheda-err-sede-indirizzo"
          class="err"
        >{{ erroriCampi['sede.indirizzo'] }}</p>
      </div>
      <div class="campo">
        <label for="tony-scheda-citta">{{ t.etichettaComune }}</label>
        <input
          id="tony-scheda-citta"
          v-model="sede.citta"
          data-campo="sede.citta"
          type="text"
          autocomplete="off"
          :disabled="inInvio"
          :aria-invalid="!!erroriCampi['sede.citta']"
          :aria-describedby="erroriCampi['sede.citta'] ? 'tony-scheda-err-sede-citta' : undefined"
          @input="controllaLive"
        />
        <p
          v-if="erroriCampi['sede.citta']"
          id="tony-scheda-err-sede-citta"
          class="err"
        >{{ erroriCampi['sede.citta'] }}</p>
      </div>
      <div class="riga2">
        <div class="campo">
          <label for="tony-scheda-cap">{{ t.etichettaCap }}</label>
          <input
            id="tony-scheda-cap"
            v-model="sede.cap"
            data-campo="sede.cap"
            type="text"
            autocomplete="off"
            :disabled="inInvio"
            :aria-invalid="!!erroriCampi['sede.cap']"
            :aria-describedby="erroriCampi['sede.cap'] ? 'tony-scheda-err-sede-cap' : undefined"
            @input="controllaLive"
          />
          <p
            v-if="erroriCampi['sede.cap']"
            id="tony-scheda-err-sede-cap"
            class="err"
          >{{ erroriCampi['sede.cap'] }}</p>
        </div>
        <div class="campo">
          <label for="tony-scheda-prov">{{ t.etichettaProvincia }}</label>
          <input
            id="tony-scheda-prov"
            v-model="sede.provincia"
            data-campo="sede.provincia"
            type="text"
            maxlength="2"
            autocomplete="off"
            :disabled="inInvio"
            :aria-invalid="!!erroriCampi['sede.provincia']"
            :aria-describedby="erroriCampi['sede.provincia'] ? 'tony-scheda-err-sede-provincia' : undefined"
            @input="controllaLive"
          />
          <p
            v-if="erroriCampi['sede.provincia']"
            id="tony-scheda-err-sede-provincia"
            class="err"
          >{{ erroriCampi['sede.provincia'] }}</p>
        </div>
      </div>
    </section>

    <section class="blocco" aria-labelledby="tony-scheda-poderi">
      <h3 id="tony-scheda-poderi">{{ t.etichettaPoderi }}</h3>
      <div v-for="(p, i) in poderi" :key="'p' + i" class="riga-el">
        <div class="campo cresce">
          <label :for="'tony-scheda-podere-' + i">{{ t.etichettaNome }}</label>
          <input
            :id="'tony-scheda-podere-' + i"
            v-model="p.nome"
            :data-campo="'poderi[' + i + '].nome'"
            type="text"
            autocomplete="off"
            :disabled="inInvio"
            :aria-invalid="!!erroriCampi['poderi[' + i + '].nome']"
            :aria-describedby="erroriCampi['poderi[' + i + '].nome'] ? 'tony-scheda-err-poderi-' + i + '-nome' : undefined"
            @input="controllaLive"
          />
          <p
            v-if="erroriCampi['poderi[' + i + '].nome']"
            :id="'tony-scheda-err-poderi-' + i + '-nome'"
            class="err"
          >{{ erroriCampi['poderi[' + i + '].nome'] }}</p>
        </div>
        <button type="button" class="btn-mini" :disabled="inInvio" @click="togliPodere(i)">
          −
        </button>
      </div>
      <button
        type="button"
        class="btn-aggiungi"
        :disabled="inInvio || poderi.length >= 10"
        @click="aggiungiPodere"
      >
        +
      </button>
    </section>

    <section class="blocco" aria-labelledby="tony-scheda-terreni">
      <h3 id="tony-scheda-terreni">{{ t.etichettaTerreni }}</h3>
      <div v-for="(tr, i) in terreni" :key="'t' + i" class="terreno">
        <div class="campo">
          <label :for="'tony-scheda-terreno-nome-' + i">{{ t.etichettaNome }}</label>
          <input
            :id="'tony-scheda-terreno-nome-' + i"
            v-model="tr.nome"
            :data-campo="'terreni[' + i + '].nome'"
            type="text"
            autocomplete="off"
            :disabled="inInvio"
            :aria-invalid="!!erroriCampi['terreni[' + i + '].nome']"
            :aria-describedby="erroriCampi['terreni[' + i + '].nome'] ? 'tony-scheda-err-terreni-' + i + '-nome' : undefined"
            @input="controllaLive"
          />
          <p
            v-if="erroriCampi['terreni[' + i + '].nome']"
            :id="'tony-scheda-err-terreni-' + i + '-nome'"
            class="err"
          >{{ erroriCampi['terreni[' + i + '].nome'] }}</p>
        </div>
        <div class="campo">
          <label :for="'tony-scheda-terreno-sup-' + i">{{ t.etichettaSuperficie }}</label>
          <input
            :id="'tony-scheda-terreno-sup-' + i"
            v-model="tr.superficie"
            :data-campo="'terreni[' + i + '].superficie'"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            :disabled="inInvio"
            :aria-invalid="!!erroriCampi['terreni[' + i + '].superficie']"
            :aria-describedby="erroriCampi['terreni[' + i + '].superficie'] ? 'tony-scheda-err-terreni-' + i + '-superficie' : undefined"
            @input="controllaLive"
          />
          <p
            v-if="erroriCampi['terreni[' + i + '].superficie']"
            :id="'tony-scheda-err-terreni-' + i + '-superficie'"
            class="err"
          >{{ erroriCampi['terreni[' + i + '].superficie'] }}</p>
        </div>
        <div class="campo">
          <label :for="'tony-scheda-terreno-col-' + i">{{ t.etichettaColtura }}</label>
          <input
            :id="'tony-scheda-terreno-col-' + i"
            v-model="tr.coltura"
            list="tony-scheda-colture"
            :data-campo="'terreni[' + i + '].coltura'"
            type="text"
            autocomplete="off"
            :disabled="inInvio"
            :aria-invalid="!!erroriCampi['terreni[' + i + '].coltura']"
            :aria-describedby="erroriCampi['terreni[' + i + '].coltura'] ? 'tony-scheda-err-terreni-' + i + '-coltura' : undefined"
            @input="controllaLive"
          />
          <p
            v-if="erroriCampi['terreni[' + i + '].coltura']"
            :id="'tony-scheda-err-terreni-' + i + '-coltura'"
            class="err"
          >{{ erroriCampi['terreni[' + i + '].coltura'] }}</p>
        </div>
        <div class="campo">
          <label :for="'tony-scheda-terreno-pod-' + i">{{ t.etichettaPodere }}</label>
          <select
            :id="'tony-scheda-terreno-pod-' + i"
            v-model="tr.podere"
            :data-campo="'terreni[' + i + '].podere'"
            :disabled="inInvio"
            :aria-invalid="!!erroriCampi['terreni[' + i + '].podere']"
            :aria-describedby="erroriCampi['terreni[' + i + '].podere'] ? 'tony-scheda-err-terreni-' + i + '-podere' : undefined"
            @change="controllaLive"
          >
            <option value="">{{ t.nessuno }}</option>
            <option
              v-for="p in poderi.filter((x) => x.nome.trim())"
              :key="p.nome"
              :value="p.nome"
            >
              {{ p.nome }}
            </option>
          </select>
          <p
            v-if="erroriCampi['terreni[' + i + '].podere']"
            :id="'tony-scheda-err-terreni-' + i + '-podere'"
            class="err"
          >{{ erroriCampi['terreni[' + i + '].podere'] }}</p>
        </div>
        <button type="button" class="btn-mini" :disabled="inInvio" @click="togliTerreno(i)">
          −
        </button>
      </div>
      <datalist id="tony-scheda-colture">
        <option v-for="n in nomiColture" :key="n" :value="n" />
      </datalist>
      <button
        type="button"
        class="btn-aggiungi"
        :disabled="inInvio || terreni.length >= 5"
        @click="aggiungiTerreno"
      >
        +
      </button>
    </section>

    <p v-if="erroreGenerale" class="err-gen" role="alert">{{ erroreGenerale }}</p>
    <p v-if="inInvio" class="sr-only" role="status">{{ t.salvando }}</p>

    <div class="azioni">
      <button
        v-if="giaPreparato"
        type="button"
        class="btn-salva"
        @click="emit('vai-dashboard')"
      >
        {{ t.vaiDashboard }}
      </button>
      <button
        v-else
        type="button"
        class="btn-salva"
        :disabled="inInvio"
        @click="onSalva"
      >
        {{ inInvio ? t.salvando : t.salva }}
      </button>
      <button type="button" class="btn-torna" :disabled="inInvio" @click="onTorna">
        {{ t.tornaChat }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.tony-scheda {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-width: 0;
  max-height: min(52vh, 420px);
  overflow: auto;
  padding-right: 0.15rem;
}
.intro {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.35;
}
.blocco {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.blocco h3 {
  margin: 0.2rem 0 0;
  font-size: 0.95rem;
}
.campo {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}
.campo label {
  font-size: 0.8rem;
}
.campo input,
.campo select {
  font: inherit;
  padding: 0.35rem 0.45rem;
  border: 1px solid #b7c4b0;
  border-radius: 6px;
  background: #fff;
}
.campo input[aria-invalid='true'] {
  border-color: #b42318;
}
.riga2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
}
.riga-el,
.terreno {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: flex-end;
}
.cresce {
  flex: 1 1 10rem;
}
.btn-mini,
.btn-aggiungi {
  border: 1px solid #b7c4b0;
  background: #f4f7f2;
  border-radius: 6px;
  min-width: 2rem;
  height: 2rem;
  cursor: pointer;
}
.azioni {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  position: sticky;
  bottom: 0;
  background: linear-gradient(180deg, transparent, #f7faf5 30%);
  padding-top: 0.35rem;
}
.btn-salva,
.btn-torna {
  font: inherit;
  border-radius: 8px;
  padding: 0.45rem 0.75rem;
  cursor: pointer;
}
.btn-salva {
  background: #2f6b3a;
  color: #fff;
  border: none;
}
.btn-salva:disabled,
.btn-torna:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.btn-torna {
  background: #fff;
  border: 1px solid #b7c4b0;
}
.err,
.err-gen {
  margin: 0;
  color: #b42318;
  font-size: 0.82rem;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
