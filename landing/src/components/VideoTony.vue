<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { formatoVideo, sorgentiVideo } from '../lib/landing-logica.js';
import { testiLanding } from '../content/testi-landing.js';

const larghezza = ref(
  typeof window !== 'undefined' ? window.innerWidth : 1024
);

function aggiornaLarghezza() {
  larghezza.value = window.innerWidth;
}

onMounted(() => {
  aggiornaLarghezza();
  window.addEventListener('resize', aggiornaLarghezza, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('resize', aggiornaLarghezza);
});

const formato = computed(() => formatoVideo(larghezza.value));
const media = computed(() => sorgentiVideo(formato.value));
const aspectClass = computed(() =>
  formato.value === '4x5' ? 'video-frame--portrait' : 'video-frame--landscape'
);
</script>

<template>
  <figure class="video-tony">
    <div class="video-frame" :class="aspectClass">
      <video
        :key="formato"
        controls
        playsinline
        preload="metadata"
        :poster="media.poster"
      >
        <source
          v-for="src in media.sources"
          :key="src.src"
          :src="src.src"
          :type="src.type"
        />
        <track
          kind="subtitles"
          srclang="it"
          label="Italiano"
          :src="media.track"
          default
        />
      </video>
    </div>
    <figcaption class="video-nota">
      {{ testiLanding.video.notaAccessibilita }}
    </figcaption>
  </figure>
</template>

<style scoped>
.video-tony {
  margin: 0;
  width: 100%;
}

.video-frame {
  width: 100%;
  border-radius: 16px;
  overflow: hidden;
  background: #0a1f14;
  box-shadow: 0 12px 32px rgba(6, 20, 14, 0.18);
}

.video-frame--landscape {
  aspect-ratio: 16 / 9;
}

.video-frame--portrait {
  aspect-ratio: 4 / 5;
  max-width: 420px;
  margin-inline: auto;
}

.video-frame video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #0a1f14;
}

.video-nota {
  margin: 0.65rem 0 0;
  font-size: 0.8rem;
  line-height: 1.45;
  color: #3d5248;
  text-align: center;
}
</style>
