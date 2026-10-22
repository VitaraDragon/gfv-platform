<script setup lang="ts">
import { computed, onMounted } from 'vue';
import logoMark from '../../../icons/gfv-mark.svg';
import tonyIcon from '../assets/tony-icon.png';
import VideoTony from '../components/VideoTony.vue';
import { testiLanding } from '../content/testi-landing.js';
import {
  EMAIL_CONTATTO,
  FOTO_PIER_URL,
  GIORNI_GUIDA_TONY,
  IVA_CONFERMATA,
  TESTO_CHI_SIAMO,
  URL_LOGIN,
  URL_REGISTRAZIONE,
} from '../config/landing-config.js';
import { rigaPrezzi } from '../lib/landing-logica.js';
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

const mostraChiSiamo = computed(
  () => Boolean(FOTO_PIER_URL) && Boolean(String(TESTO_CHI_SIAMO || '').trim())
);

onMounted(() => {
  document.title = t.documentTitle;
});

const iconeGratis: Record<string, string> = {
  Terreni: '🌾',
  Poderi: '🏡',
  'Diario attività': '📋',
  Statistiche: '📈',
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

/** Icone immagine (stessa dimensione delle emoji, forma tonda). */
const iconeModuliImg: Record<string, string> = {
  'Tony Avanzato': tonyIcon,
};
</script>

<template>
  <div class="landing">
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
            <a class="btn-primary" :href="URL_REGISTRAZIONE">
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
            <p class="cta-note">{{ t.hero.gratisNota }}</p>
            <p class="cta-whisper">{{ t.hero.tonyDicembre }}</p>
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
          <a class="btn-primary" :href="URL_REGISTRAZIONE">
            <span class="btn-icon" aria-hidden="true">👋</span>
            {{ t.hero.ctaPrincipale }}
          </a>
          <p class="cta-note">{{ t.hero.gratisNota }}</p>
          <p class="cta-whisper">{{ t.hero.tonyDicembre }}</p>
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
        <h3>{{ t.cosaGestisci.gratisTitolo }}</h3>
        <ul class="chips">
          <li v-for="chip in t.cosaGestisci.gratis" :key="chip" class="chip">
            <span aria-hidden="true">{{ iconeGratis[chip] || '•' }}</span>
            {{ chip }}
          </li>
        </ul>
        <h3>{{ t.cosaGestisci.moduliTitolo }}</h3>
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
        <a class="btn-primary" :href="URL_REGISTRAZIONE">
          <span class="btn-icon" aria-hidden="true">👋</span>
          {{ t.chiusura.cta }}
        </a>
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
        <a href="/termini">{{ t.footer.linkTermini }}</a>
        <a href="/privacy">{{ t.footer.linkPrivacy }}</a>
        <a href="/cookie">{{ t.footer.linkCookie }}</a>
      </nav>
    </footer>
  </div>
</template>

<style scoped>
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

.cta-whisper {
  margin: 0;
  font-size: 0.8rem;
  color: #5a7266;
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
  margin: 1.25rem 0 0.65rem;
  font-size: 1rem;
  color: var(--ink);
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
