import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'core/services/tony-service.js'), 'utf8');

describe('tony guide load', () => {
  it('usa Promise.all / fetchGuidaMarkdownPartsParallel e non no-store', () => {
    expect(src).toMatch(/fetchGuidaMarkdownPartsParallel|Promise\.all/);
    expect(src).toMatch(/export async function fetchGuidaMarkdownPartsParallel/);
    expect(src).not.toMatch(/cache:\s*['"]no-store['"]/);
    expect(src).toMatch(/v=['"]\s*\+|v='\s*\+|guidaFetchCacheBust/);
  });

  it('init non attende le guide prima del modello (guidesReadyPromise in background)', () => {
    expect(src).toMatch(/_guidesReadyPromise/);
    expect(src).toMatch(/ask\(userPrompt[\s\S]*_guidesReadyPromise/);
  });
});
