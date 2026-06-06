import { describe, it, expect, vi } from 'vitest';
import { parseTonySseStream } from '../core/services/tony-sse-parse.js';

function writeSse(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

describe('parseTonySseStream', () => {
  it('parsa evento done con CRLF', () => {
    const raw = writeSse('done', { text: 'ciao', command: null }).replace(/\n/g, '\r\n');
    const { done } = parseTonySseStream(raw);
    expect(done).toEqual({ text: 'ciao', command: null });
  });

  it('ignora commenti SSE e invoca onChunk', () => {
    const raw =
      `: ping\n\n` +
      writeSse('chunk', { delta: 'Hel' }) +
      writeSse('chunk', { delta: 'lo' }) +
      writeSse('done', { text: 'Hello', command: null });
    const chunks = [];
    const { done } = parseTonySseStream(raw, {
      onChunk: (d) => chunks.push(d),
    });
    expect(chunks).toEqual(['Hel', 'lo']);
    expect(done.text).toBe('Hello');
  });

  it('propaga evento error', () => {
    const raw = writeSse('error', { code: 'internal', message: 'boom' });
    expect(() => parseTonySseStream(raw)).toThrow('boom');
  });

  it('restituisce null se body vuoto', () => {
    const { done, hadEvents } = parseTonySseStream('');
    expect(done).toBeNull();
    expect(hadEvents).toBe(false);
  });
});

describe('tony-ask-stream writeSse format', () => {
  it('padding comment non rompe parsing done', () => {
    const padding = `: tony-stream-open ${' '.repeat(64)}\n\n`;
    const raw = padding + writeSse('done', { text: 'ok', command: null });
    const { done } = parseTonySseStream(raw);
    expect(done.text).toBe('ok');
  });
});
