/**
 * Contratto: inset tastiera Tony (visualViewport) e viewport-fit per safe-area.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  computeTonyKeyboardInset,
  applyTonyKeyboardInset,
  bindTonyVisualViewport,
  TONY_KEYBOARD_INSET_MIN_PX,
} from '../core/js/tony/visual-viewport.js';

const css = readFileSync(join(process.cwd(), 'core/styles/tony-widget.css'), 'utf8');
const loader = readFileSync(join(process.cwd(), 'core/js/gfv-tony-loader.js'), 'utf8');

describe('computeTonyKeyboardInset', () => {
  it('0 se manca visualViewport o layout', () => {
    expect(computeTonyKeyboardInset(null, 800)).toBe(0);
    expect(computeTonyKeyboardInset({ height: 500, offsetTop: 0 }, 0)).toBe(0);
  });

  it('ignora il chrome della barra URL (< soglia)', () => {
    expect(computeTonyKeyboardInset({ height: 760, offsetTop: 0 }, 800)).toBe(0);
    expect(TONY_KEYBOARD_INSET_MIN_PX).toBeGreaterThanOrEqual(80);
  });

  it('tastiera: layout 800, visual 500 → 300px', () => {
    expect(computeTonyKeyboardInset({ height: 500, offsetTop: 0 }, 800)).toBe(300);
  });

  it('considera offsetTop (scroll del visual viewport)', () => {
    expect(computeTonyKeyboardInset({ height: 500, offsetTop: 40 }, 800)).toBe(260);
  });
});

describe('applyTonyKeyboardInset', () => {
  it('imposta CSS var e classe sul pannello', () => {
    const panel = { style: { setProperty: vi.fn() }, classList: { toggle: vi.fn() } };
    const fab = { classList: { toggle: vi.fn() } };
    applyTonyKeyboardInset(panel, fab, 280);
    expect(panel.style.setProperty).toHaveBeenCalledWith('--tony-keyboard-inset', '280px');
    expect(panel.classList.toggle).toHaveBeenCalledWith('is-keyboard-open', true);
    expect(fab.classList.toggle).toHaveBeenCalledWith('is-keyboard-open', true);
    applyTonyKeyboardInset(panel, fab, 0);
    expect(panel.classList.toggle).toHaveBeenCalledWith('is-keyboard-open', false);
  });
});

describe('bindTonyVisualViewport', () => {
  it('è idempotente e sync-a dall’innerHeight', () => {
    const panel = {
      id: 'tony-panel',
      style: { setProperty: vi.fn() },
      classList: { toggle: vi.fn() },
    };
    const listeners = [];
    const fakeWin = {
      innerHeight: 800,
      visualViewport: {
        height: 480,
        offsetTop: 0,
        addEventListener: (type, fn) => listeners.push([type, fn]),
      },
      addEventListener: vi.fn(),
      setTimeout: vi.fn(),
      document: {
        getElementById: (id) => (id === 'tony-panel' ? panel : null),
        addEventListener: vi.fn(),
      },
    };
    const sync = bindTonyVisualViewport({ window: fakeWin, document: fakeWin.document });
    expect(sync()).toBe(320);
    expect(listeners.map((l) => l[0]).sort()).toEqual(['resize', 'scroll']);
    const again = bindTonyVisualViewport({ window: fakeWin, document: fakeWin.document });
    expect(again).toBe(sync);
  });
});

describe('CSS / loader viewport-fit', () => {
  it('il pannello usa --tony-keyboard-inset in bottom e max-height', () => {
    expect(css).toMatch(/--tony-keyboard-inset/);
    expect(css).toMatch(/bottom:\s*var\(--tony-keyboard-inset/);
    expect(css).toMatch(/\.tony-widget-panel\.is-keyboard-open/);
    expect(css).toMatch(/\.tony-widget-fab\.is-keyboard-open/);
  });

  it('il loader aggiunge viewport-fit=cover al meta viewport', () => {
    expect(loader).toMatch(/viewport-fit=cover/);
    expect(loader).toMatch(/indexOf\('viewport-fit'\)/);
  });
});
