/**
 * Riga meteo della dashboard: con molti avvisi meteo la colonna sinistra è molto alta.
 * La colonna destra (.dashboard-meteo-side__inner, grid con due righe auto e height:100%)
 * senza align-content distribuiva l'altezza in più sulle due righe: le card «Prossimi giorni»
 * e «Operatività oggi» si allungavano con bianco dentro (Uso Reale: 710 e 654 px).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(__dirname, '../core/styles/dashboard.css'), 'utf8');

function regola(selettore) {
    const re = new RegExp(selettore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}');
    const m = css.match(re);
    if (!m) throw new Error(`regola ${selettore} non trovata`);
    const dichiarazioni = {};
    m[1].replace(/\/\*[\s\S]*?\*\//g, '').split(';').forEach((d) => {
        const i = d.indexOf(':');
        if (i > 0) dichiarazioni[d.slice(0, i).trim()] = d.slice(i + 1).trim();
    });
    return dichiarazioni;
}

describe('dashboard.css: colonna previsioni/operatività', () => {
    it('le righe restano alte quanto il contenuto (align-content: start)', () => {
        const r = regola('.dashboard-meteo-side__inner');
        expect(r.display).toBe('grid');
        expect(r['grid-template-rows']).toBe('auto auto');
        expect(r['align-content']).toBe('start');
    });

    it('solo previsioni (senza manodopera): la card unica occupa ancora la colonna (1fr)', () => {
        expect(regola('.dashboard-meteo-side__inner--forecast-only')['grid-template-rows']).toBe('1fr');
    });
});
