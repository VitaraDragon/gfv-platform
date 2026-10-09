/**
 * Un solo build Tony: TONY_CLIENT_BUILD in main.js è la fonte.
 * Loader, shell e import versionati non possono restare su un altro ?v=.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd();

function walkCore(dir, acc) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) {
      walkCore(abs, acc);
    } else if (extname(name) === '.js' || extname(name) === '.html') {
      acc.push(abs);
    }
  }
  return acc;
}

function rel(abs) {
  return abs.slice(ROOT.length + 1).replace(/\\/g, '/');
}

const EXPECTED_BUILD = readFileSync(join(ROOT, 'core/js/tony/main.js'), 'utf8')
  .match(/TONY_CLIENT_BUILD\s*=\s*'([^']+)'/)[1];

const VALUE_PATTERNS = [
  /gfv-tony-loader\.js\?v=([^'"&`\s]+)/g,
  /TONY_LOADER_QUERY\s*=\s*'([^']+)'/g,
  /TONY_LOADER_BUILD\s*=\s*'([^']+)'/g,
  /gfv-standalone-shell\.js\?v=([^'"&`\s]+)/g,
];

describe('Tony build version sync', () => {
  it('legge TONY_CLIENT_BUILD come fonte unica', () => {
    expect(EXPECTED_BUILD).toMatch(/^\d{4}-\d{2}-\d{2}[a-z]$/);
  });

  it('loader, shell e costanti in core usano lo stesso build', () => {
    const mismatches = [];
    for (const file of walkCore(join(ROOT, 'core'), [])) {
      const src = readFileSync(file, 'utf8');
      for (const re of VALUE_PATTERNS) {
        re.lastIndex = 0;
        let match;
        while ((match = re.exec(src))) {
          if (match[1] !== EXPECTED_BUILD) {
            mismatches.push(`${rel(file)}: ${match[0]}`);
          }
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('gli import ?v= di main.js usano lo stesso build', () => {
    const src = readFileSync(join(ROOT, 'core/js/tony/main.js'), 'utf8');
    const versions = [];
    const re = /from\s+['"][^'"]+\?v=([^'"]+)['"]/g;
    let match;
    while ((match = re.exec(src))) versions.push(match[1]);
    expect(versions.length).toBeGreaterThan(0);
    expect(versions.filter((v) => v !== EXPECTED_BUILD)).toEqual([]);
  });
});
