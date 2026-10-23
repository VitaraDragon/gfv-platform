/**
 * formatTonyChatHtml: escape + ** → <strong>
 */
import { describe, it, expect } from 'vitest';
import { formatTonyChatHtml } from '../core/js/tony/ui.js';

describe('formatTonyChatHtml', () => {
  it('converte ** in strong', () => {
    expect(formatTonyChatHtml('Vai su **Terreni**')).toBe('Vai su <strong>Terreni</strong>');
  });
  it('escapa HTML', () => {
    expect(formatTonyChatHtml('<script>x</script>')).toBe('&lt;script&gt;x&lt;/script&gt;');
  });
  it('non lascia ** grezzi se chiuse', () => {
    const html = formatTonyChatHtml('Apri **Categoria Coltura** e **Coltura**');
    expect(html).not.toContain('**');
    expect(html).toBe('Apri <strong>Categoria Coltura</strong> e <strong>Coltura</strong>');
  });
  it('lascia ** non chiuse come testo escaped', () => {
    expect(formatTonyChatHtml('inizio **taglio')).toBe('inizio **taglio');
  });
});
