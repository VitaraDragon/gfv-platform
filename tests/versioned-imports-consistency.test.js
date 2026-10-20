/**
 * Se un file di core/, modules/ o shared è importato con ?v=,
 * ogni altro import dello stesso file usa lo stesso ?v.
 * Un import senza ?v accanto a uno con ?v è un disallineamento.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const SCAN = ['core', 'modules', 'shared'];

function walk(dir, acc) {
    for (const name of readdirSync(dir)) {
        if (name === 'node_modules') continue;
        const abs = path.join(dir, name);
        if (statSync(abs).isDirectory()) walk(abs, acc);
        else if (/\.(js|mjs|html)$/.test(name)) acc.push(abs);
    }
    return acc;
}

function versioneDi(query) {
    let version = null;
    for (const part of String(query || '').split('&')) {
        if (!part) continue;
        const eq = part.indexOf('=');
        const key = eq === -1 ? part : part.slice(0, eq);
        if (key !== 'v') continue;
        version = eq === -1 ? '' : part.slice(eq + 1);
    }
    return version;
}

function risolvi(fromAbs, spec) {
    const clean = String(spec || '').split('#')[0];
    const q = clean.indexOf('?');
    const pathPart = q >= 0 ? clean.slice(0, q) : clean;
    if (!pathPart || /^(https?:|data:|blob:)/.test(pathPart) || !/\.(js|mjs|css)$/.test(pathPart)) {
        return null;
    }
    let abs;
    if (pathPart.startsWith('/')) {
        const relUrl = pathPart.replace(/^\/gfv-platform\//, '').replace(/^\//, '');
        abs = path.join(root, relUrl);
    } else {
        abs = path.resolve(path.dirname(fromAbs), pathPart);
    }
    const rel = path.relative(root, abs).replace(/\\/g, '/');
    if (!rel || rel.startsWith('..') || !/^(core|modules|shared)\//.test(rel)) return null;
    return { rel, version: versioneDi(q >= 0 ? clean.slice(q + 1) : '') };
}

function raccogli() {
    const groups = new Map();
    const re = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]|<script\b[^>]*\bsrc\s*=\s*['"]([^'"]+)['"]/gi;
    for (const abs of SCAN.flatMap((dir) => walk(path.join(root, dir), []))) {
        const src = readFileSync(abs, 'utf8');
        re.lastIndex = 0;
        let match;
        while ((match = re.exec(src))) {
            const trovato = risolvi(abs, match[1] || match[2]);
            if (!trovato) continue;
            if (!groups.has(trovato.rel)) groups.set(trovato.rel, []);
            groups.get(trovato.rel).push({
                from: path.relative(root, abs).replace(/\\/g, '/'),
                version: trovato.version
            });
        }
    }
    return groups;
}

function disallineati(groups) {
    const out = [];
    for (const [file, uses] of groups) {
        const conVersione = uses.some((use) => use.version != null);
        const versioni = new Set(uses.map((use) => use.version));
        if (!conVersione || versioni.size === 1) continue;
        out.push({
            file,
            uses: uses.map((use) => `${use.from} -> ${use.version == null ? '(senza ?v)' : '?v=' + use.version}`)
        });
    }
    return out;
}

describe('import ?v coerenti', () => {
    const groups = raccogli();

    it('ogni file importato con ?v usa la stessa versione ovunque', () => {
        const bad = disallineati(groups);
        expect(bad).toEqual([]);
    });

    it('manodopera-lavori-scope.js non mescola ?v e import senza versione', () => {
        const uses = groups.get('core/services/manodopera-lavori-scope.js') || [];
        expect(uses.length).toBeGreaterThan(0);
        const versioni = new Set(uses.map((use) => use.version));
        expect(versioni.size).toBe(1);
        expect(versioni.has(null)).toBe(false);
    });
});
