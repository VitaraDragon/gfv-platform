import { createRouter, createWebHistory } from 'vue-router';
import ComingSoon from '../views/ComingSoon.vue';
import LandingHome from '../views/LandingHome.vue';
import { LANDING_ATTIVA } from '../config/landing-config.js';
import { scegliVistaHome } from '../lib/landing-logica.js';

const vistaHome = scegliVistaHome({
  landingAttiva: LANDING_ATTIVA,
  // Vite: true con `npm run dev` oppure build/preview in modo anteprima
  dev:
    import.meta.env.DEV === true || import.meta.env.MODE === 'anteprima',
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
