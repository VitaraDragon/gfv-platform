/**
 * Le pagine pubblicate non devono caricare file da node_modules/.
 * Il browser su Pages non ha quella cartella.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const SCAN = ['core', 'modules', 'shared'];

function walk(dir, acc) {
    for (const name of readdirSync(dir)) {
        if (name === 'node_modules') continue;
        const abs = path.join(dir, name);
        if (statSync(abs).isDirectory()) walk(abs, acc);
        else if (/\.(html|js|mjs)$/.test(name)) acc.push(abs);
    }
    return acc;
}

describe('file pubblicati senza node_modules', () => {
    it('core, modules, shared e index.html non citano node_modules/', () => {
        const files = SCAN.flatMap((dir) => walk(path.join(root, dir), []));
        files.push(path.join(root, 'index.html'));
        const trovati = [];
        for (const abs of files) {
            const src = readFileSync(abs, 'utf8');
            if (src.includes('node_modules/')) {
                trovati.push(path.relative(root, abs).replace(/\\/g, '/'));
            }
        }
        expect(trovati).toEqual([]);
    });
});
