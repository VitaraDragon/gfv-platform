import { createRouter, createWebHistory } from 'vue-router';
import ComingSoon from '../views/ComingSoon.vue';
import LandingHome from '../views/LandingHome.vue';
import { LANDING_ATTIVA } from '../config/landing-config.js';
import { scegliVistaHome } from '../lib/landing-logica.js';

const vistaHome = scegliVistaHome({
  landingAttiva: LANDING_ATTIVA,
  // Vite: true solo con `npm run dev`
  dev: import.meta.env.DEV === true,
});

const HomeComponent = vistaHome === 'landing' ? LandingHome : ComingSoon;

/**
 * Root: landing nuova solo se flag acceso oppure sviluppo locale.
 * Altrimenti «Coming soon», come oggi. Ogni altro percorso rimanda lì.
 */
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeComponent,
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'home' },
    },
  ],
});
