/**
 * Contratto CSS: chat Tony visibile per intero su viewport iPhone
 * (niente zoom Safari, niente overflow orizzontale della riga fotocamera+mic+input).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(process.cwd(), 'core/styles/tony-widget.css'), 'utf8');
const loader = readFileSync(join(process.cwd(), 'core/js/tony-widget-standalone.js'), 'utf8');

describe('Tony widget — layout mobile / iPhone', () => {
  it('il campo testo è ≥ 16px così Safari non zoomma la pagina al focus', () => {
    const inputBlock = css.match(/\.tony-widget-input\s*\{[^}]+\}/)?.[0] || '';
    expect(inputBlock).toMatch(/font-size:\s*16px/);
    expect(inputBlock).toMatch(/min-width:\s*0/);
    expect(inputBlock).toMatch(/flex:\s*1 1 0/);
  });

  it('pannello e riga input non possono allargare il documento', () => {
    const panelBlock = css.match(/\.tony-widget-panel\s*\{[^}]+\}/)?.[0] || '';
    expect(panelBlock).toMatch(/min-width:\s*0/);
    expect(panelBlock).toMatch(/overflow-x:\s*hidden/);
    expect(panelBlock).toMatch(/100dvw/);

    const rowBlock = css.match(/\.tony-widget-input-row\s*\{[^}]+\}/)?.[0] || '';
    expect(rowBlock).toMatch(/min-width:\s*0/);
    expect(rowBlock).toMatch(/overflow:\s*hidden/);
  });

  it('su smartphone il foglio è 100dvw da sinistra, non left+right al 100% del documento', () => {
    expect(css).toMatch(/@media \(max-width: 768px\)/);
    const mobile = css.split('@media (max-width: 768px)')[1] || '';
    expect(mobile).toMatch(/width:\s*100dvw/);
    expect(mobile).toMatch(/left:\s*0/);
    expect(mobile).toMatch(/right:\s*auto/);
    expect(mobile).not.toMatch(/left:\s*0;\s*right:\s*0/);
  });

  it('fotocamera e microfono non si schiacciano', () => {
    expect(css).toMatch(/\.tony-widget-camera[\s\S]*?flex-shrink:\s*0/);
    expect(css).toMatch(/\.tony-widget-mic[\s\S]*?flex-shrink:\s*0/);
  });

  it('il CSS del widget è cache-bustato col build del loader', () => {
    expect(loader).toMatch(/tony-widget\.css.*\?v=/);
  });

  it('su smartphone il foglio si alza con --tony-keyboard-inset (tastiera iOS)', () => {
    const mobile = css.split('@media (max-width: 768px)')[1] || '';
    expect(mobile).toMatch(/bottom:\s*var\(--tony-keyboard-inset/);
    expect(mobile).toMatch(/is-keyboard-open/);
  });
});
