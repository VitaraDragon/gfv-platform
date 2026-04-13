import { createRouter, createWebHistory } from 'vue-router';
import ComingSoon from '../views/ComingSoon.vue';

/**
 * Unica schermata pubblica: qualunque percorso mostra la landing
 * oppure reindirizza alla root (stesso componente).
 */
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'coming-soon',
      component: ComingSoon,
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'coming-soon' },
    },
  ],
});
