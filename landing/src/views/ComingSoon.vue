<script setup lang="ts">
import logo512 from '../../../icons/icon-512x512.png';
</script>

<template>
  <div class="page">
    <div class="bg-blobs" aria-hidden="true">
      <span class="blob blob-a" />
      <span class="blob blob-b" />
      <span class="blob blob-c" />
    </div>
    <div class="grain" aria-hidden="true" />

    <main class="card">
      <div class="card-inner">
        <header class="hero">
          <p class="eyebrow">
            <span class="eyebrow-dot" aria-hidden="true" />
            Siamo qui per cambiare le regole
          </p>

          <div class="logo-wrap">
            <div class="logo-ring">
              <img
                class="logo-mark"
                :src="logo512"
                width="120"
                height="120"
                alt="Global Farm View"
                decoding="async"
              />
            </div>
          </div>

          <h1 id="brand-title" class="brand">
            <span class="brand-name">Global Farm View</span>
            <span class="brand-line">La tua azienda, da una nuova prospettiva.</span>
          </h1>

          <p class="subhead">
            Non serve riempire i campi di sensori per avere il controllo totale. Abbiamo eliminato
            l’hardware per darti l’unica cosa che conta davvero:
            <strong>la visione d’insieme.</strong>
          </p>
        </header>

        <div class="copy">
          <p class="lead-para">
            Basta strumenti frammentati o decisioni prese in ritardo. Con
            <strong>GFV (Global Farm View)</strong>, l’intera gestione agricola converge in un’unica
            interfaccia intelligente, progettata per chi deve decidere ogni giorno avendo il
            <strong>quadro completo</strong> sotto gli occhi.
          </p>

          <h2 class="section-title">Perché scegliere la nostra visione</h2>

          <ul class="benefits">
            <li>
              <span class="benefit-title">Zero hardware</span>
              <span class="benefit-text"
                >Trasforma gli smartphone della tua squadra in centri dati. Niente sensori costosi da
                installare o mantenere.</span
              >
            </li>
            <li>
              <span class="benefit-title">Dati che diventano risparmio</span>
              <span class="benefit-text"
                >Ogni attività quotidiana si traduce in indicazioni concrete per ridurre gli sprechi e
                ottimizzare i margini.</span
              >
            </li>
            <li>
              <span class="benefit-title">Squadre in tempo reale</span>
              <span class="benefit-text"
                >Coordina il lavoro, monitora i prelievi in magazzino e vedi la tua azienda muoversi in
                diretta, anche in mobilità.</span
              >
            </li>
          </ul>
        </div>

        <footer class="closing">
          <p class="closing-tagline">Il futuro dell’agricoltura è leggero, digitale e globale.</p>
          <p class="closing-body">
            Stiamo aprendo le porte a una nuova gestione: preparati a tenere l’intera azienda nel palmo
            della tua mano.
          </p>
        </footer>
      </div>
    </main>
  </div>
</template>

<style scoped>
.page {
  --green-deep: #071910;
  --green-mid: #0f4d32;
  --green-bright: #158050;
  --gold: #c9a227;
  --gold-soft: rgba(201, 162, 39, 0.28);
  --ink: #06140e;
  --ink-soft: #1a2e24;

  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(1rem, 4vw, 2rem);
  overflow-x: hidden;
  color: var(--ink);
  isolation: isolate;
  font-family:
    'Plus Jakarta Sans',
    system-ui,
    -apple-system,
    sans-serif;
  background:
    radial-gradient(ellipse 100% 80% at 50% -20%, rgba(21, 128, 80, 0.5) 0%, transparent 55%),
    radial-gradient(ellipse 70% 50% at 100% 50%, rgba(201, 162, 39, 0.14) 0%, transparent 50%),
    linear-gradient(165deg, var(--green-deep) 0%, var(--green-mid) 42%, #041208 100%);
}

.bg-blobs {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(64px);
  opacity: 0.55;
  animation: blob-float 18s ease-in-out infinite;
}

.blob-a {
  width: min(420px, 80vw);
  height: min(420px, 80vw);
  background: var(--green-bright);
  top: -12%;
  left: -8%;
  animation-delay: 0s;
}

.blob-b {
  width: min(360px, 70vw);
  height: min(360px, 70vw);
  background: #1fa66a;
  bottom: -10%;
  right: -12%;
  animation-delay: -6s;
}

.blob-c {
  width: min(280px, 55vw);
  height: min(280px, 55vw);
  background: var(--gold-soft);
  top: 38%;
  right: 10%;
  animation-delay: -12s;
  opacity: 0.4;
}

@keyframes blob-float {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(4%, 3%) scale(1.05);
  }
  66% {
    transform: translate(-3%, -2%) scale(0.98);
  }
}

.grain {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.06;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

.card {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 640px;
  border-radius: 24px;
  background: #ffffff;
  box-shadow:
    0 2px 4px rgba(6, 20, 14, 0.06),
    0 20px 40px -8px rgba(6, 20, 14, 0.28);
  overflow: hidden;
}

.card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 5px;
  background: linear-gradient(90deg, var(--green-mid), var(--green-bright), var(--gold));
}

.card-inner {
  display: flex;
  flex-direction: column;
  gap: clamp(1.35rem, 4vw, 1.9rem);
  padding: clamp(1.75rem, 5vw, 2.75rem) clamp(1.35rem, 4vw, 2.25rem) clamp(2rem, 5vw, 2.75rem);
}

.hero {
  text-align: center;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0 0 1.1rem;
  padding: 0.4rem 0.95rem 0.4rem 0.6rem;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #0b3d28;
  background: rgba(15, 77, 50, 0.1);
  border-radius: 999px;
  border: 1px solid rgba(15, 77, 50, 0.18);
}

.eyebrow-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--green-bright);
  box-shadow: 0 0 0 3px rgba(21, 128, 80, 0.3);
  animation: pulse-dot 2.2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.85;
    transform: scale(1.1);
  }
}

.logo-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 1.1rem;
}

.logo-ring {
  padding: 10px;
  border-radius: 28px;
  background: linear-gradient(135deg, rgba(15, 77, 50, 0.08), rgba(201, 162, 39, 0.12));
  box-shadow:
    0 8px 28px rgba(6, 20, 14, 0.12),
    0 0 0 1px rgba(255, 255, 255, 0.9) inset;
  animation: logo-float 5s ease-in-out infinite;
}

@keyframes logo-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}

.logo-mark {
  width: 120px;
  height: 120px;
  object-fit: contain;
  display: block;
  border-radius: 20px;
}

.brand {
  margin: 0 0 1rem;
  padding: 0;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.12;
  color: var(--ink);
}

.brand-name {
  display: block;
  font-size: clamp(1.65rem, 5vw, 2.15rem);
  color: var(--green-mid);
  margin-bottom: 0.35rem;
}

.brand-line {
  display: block;
  font-size: clamp(1.2rem, 3.6vw, 1.5rem);
  font-weight: 700;
  color: var(--ink);
  max-width: 20ch;
  margin-inline: auto;
}

.subhead {
  margin: 0;
  text-align: center;
  font-size: clamp(1.05rem, 2.8vw, 1.15rem);
  font-weight: 500;
  line-height: 1.5;
  color: var(--ink-soft);
  max-width: 36ch;
  margin-inline: auto;
}

.subhead strong {
  color: var(--green-mid);
  font-weight: 700;
}

.copy {
  margin: 0;
  padding: 0;
  text-align: left;
  font-size: 1.0625rem;
  line-height: 1.65;
  color: var(--ink-soft);
}

.lead-para {
  margin: 0;
}

.lead-para strong {
  color: var(--green-mid);
  font-weight: 700;
}

.section-title {
  margin: 1.35rem 0 0.85rem;
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--green-mid);
}

.benefits {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.benefits li {
  margin: 0;
  padding: 0.95rem 1rem;
  border-radius: 14px;
  background: rgba(15, 77, 50, 0.06);
  border: 1px solid rgba(15, 77, 50, 0.1);
}

.benefit-title {
  display: block;
  font-size: 1rem;
  font-weight: 800;
  color: var(--ink);
  margin-bottom: 0.35rem;
}

.benefit-text {
  display: block;
  font-size: 0.98rem;
  font-weight: 500;
  line-height: 1.55;
  color: var(--ink-soft);
}

.closing {
  margin: 0;
  padding-top: 0.35rem;
  text-align: center;
  border-top: 1px solid rgba(15, 77, 50, 0.12);
}

.closing-tagline {
  margin: 0 0 0.65rem;
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1.4;
  color: var(--ink);
}

.closing-body {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.55;
  color: var(--ink-soft);
}

@media (prefers-reduced-motion: reduce) {
  .blob,
  .logo-ring,
  .eyebrow-dot {
    animation: none;
  }
}
</style>
