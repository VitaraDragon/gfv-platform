/**
 * @vitest-environment jsdom
 *
 * Regressione: l'informativa bloccante non deve nascondere chip demo
 * né bloccare «Sì, iniziamo» / «Salta tutto» nel passo invito.
 */
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TonyChat from '../../landing/src/components/TonyChat.vue';
import { testiLanding } from '../../landing/src/content/testi-landing.js';

const t = testiLanding.tonyBussa;
const ta = t.aiuto;

function propsBase(extra = {}) {
  return {
    ottieniToken: async () => 'token-test',
    variante: 'desktop',
    riduciMovimento: true,
    salutoFinito: true,
    protezionePronta: true,
    staticoForzato: false,
    audioIniziale: false,
    moduloDisponibile: true,
    ...extra,
  };
}

function monta() {
  return mount(TonyChat, {
    props: propsBase(),
    global: {
      stubs: {
        TonyRegistrazione: true,
        TonySchedaConferma: true,
      },
    },
  });
}

function setup(wrapper) {
  return wrapper.vm.$.setupState;
}

describe('informativa bloccante — comportamento TonyChat', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.pause = vi.fn();
    window.HTMLMediaElement.prototype.load = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      blob: async () => new Blob(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('(a) storage vuoto: 3 chip demo e campo presenti', async () => {
    const wrapper = monta();
    await flushPromises();

    for (const etichetta of t.chip) {
      expect(wrapper.text()).toContain(etichetta);
    }
    expect(wrapper.find('#tony-domanda').exists()).toBe(true);
    expect(wrapper.find('.informativa-aiuto').exists()).toBe(false);
    wrapper.unmount();
  });

  it('(b) dopo account, «Sì, iniziamo» → sede + informativa visibile', async () => {
    const wrapper = monta();
    await flushPromises();

    setup(wrapper).onRegistrazioneCompletata();
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain(ta.chipSi);
    expect(wrapper.find('.informativa-aiuto').exists()).toBe(false);

    await wrapper.findAll('button.chip').find((b) => b.text() === ta.chipSi).trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(setup(wrapper).passoAiuto).toBe('sede');
    expect(wrapper.find('.informativa-aiuto').exists()).toBe(true);
    expect(wrapper.find('#tony-domanda').exists()).toBe(false);
    wrapper.unmount();
  });

  it('(c) dopo «Ho capito» il campo è presente', async () => {
    const wrapper = monta();
    await flushPromises();

    setup(wrapper).onRegistrazioneCompletata();
    await flushPromises();
    await wrapper.findAll('button.chip').find((b) => b.text() === ta.chipSi).trigger('click');
    await flushPromises();

    expect(wrapper.find('.informativa-aiuto').exists()).toBe(true);
    await wrapper
      .findAll('button.chip')
      .find((b) => b.text() === ta.informativaHoCapito)
      .trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.informativa-aiuto').exists()).toBe(false);
    expect(wrapper.find('#tony-domanda').exists()).toBe(true);
    wrapper.unmount();
  });

  it('(d) «Salta tutto» dopo l\'account emette vai-dashboard', async () => {
    const wrapper = monta();
    await flushPromises();

    setup(wrapper).onRegistrazioneCompletata();
    await flushPromises();
    await wrapper.vm.$nextTick();

    await wrapper
      .findAll('button.chip')
      .find((b) => b.text() === ta.chipSaltaTutto)
      .trigger('click');
    await flushPromises();

    expect(wrapper.emitted('vai-dashboard')).toBeTruthy();
    expect(wrapper.emitted('vai-dashboard').length).toBeGreaterThanOrEqual(1);
    wrapper.unmount();
  });
});
