import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const svcSrc = readFileSync(join(process.cwd(), 'core/services/tony-service.js'), 'utf8');
const mainSrc = readFileSync(join(process.cwd(), 'core/js/tony/main.js'), 'utf8');

describe('Tony askStream — forceStream voce', () => {
  it('tony-service: forceStream bypass + no localhost prefer callable', () => {
    expect(svcSrc).toMatch(/_preferCallableOverStream\(opts = \{\}\)/);
    expect(svcSrc).toMatch(/opts\.forceStream === true/);
    expect(svcSrc).not.toMatch(/host === 'localhost'/);
    expect(svcSrc).toMatch(/_askStreamCallableFallback/);
    expect(svcSrc).toMatch(/_preferCallableOverStream\(opts\)/);
  });

  it('main.js: voce passa forceStream a askStream', () => {
    expect(mainSrc).toMatch(/forceStream:\s*!!opts\.fromVoice/);
  });
});
