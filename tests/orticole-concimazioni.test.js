/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { ORTICOLE_HUB_CARDS } from '../modules/orticole/config/orticole-hub.js';

describe('Orticole — concimazioni', () => {
  it('hub concimazioni distinto dai trattamenti', () => {
    const card = ORTICOLE_HUB_CARDS.find((item) => item.id === 'concimazioni');
    expect(card).toBeTruthy();
    expect(card.placeholder).toBe(false);
    expect(card.pageType).toBe('concimazioni_orticole');
    expect(card.href).toBe('concimazioni-standalone.html');
  });
});
