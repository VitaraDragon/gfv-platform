/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { scegliLavoroPredefinitoGuasto } from '../core/js/field-guasti-access.js';

const SRC = readFileSync('core/mobile/js/field-workspace-controller.js', 'utf8');

function estraiFunzione(src, firma) {
    const start = src.indexOf(firma);
    if (start < 0) throw new Error('funzione non trovata: ' + firma);
    const open = src.indexOf('{', start);
    let depth = 0;
    for (let i = open; i < src.length; i += 1) {
        if (src[i] === '{') depth += 1;
        else if (src[i] === '}') {
            depth -= 1;
            if (depth === 0) return src.slice(start, i + 1);
        }
    }
    throw new Error('funzione non chiusa: ' + firma);
}

function lavoro(id, label, raw) {
    return { id, label, raw: { id, ...raw } };
}

function scegli(works) {
    const sandbox = { scegliLavoroPredefinitoGuasto, works, risultato: null };
    const codice = `
        ${estraiFunzione(SRC, 'function lavoroPredefinitoCampo(works)')}
        risultato = lavoroPredefinitoCampo(works);
    `;
    runInContext(codice, createContext(sandbox));
    return sandbox.risultato;
}

function contestoGuasto() {
    const sandbox = {
        guastoEmbedFrameEl: null,
        lavoroScelto: '',
        idLavoroSelezionatoOSalvato() {
            return sandbox.lavoroScelto;
        }
    };
    const codice = `
        ${estraiFunzione(SRC, 'function urlSchedaGuastoCampo(lavoroId)')}
        ${estraiFunzione(SRC, 'function bozzaGuastoAperta(frame)')}
        ${estraiFunzione(SRC, 'function ensureGuastoEmbedLoaded()')}
    `;
    runInContext(codice, createContext(sandbox));
    sandbox.ensureGuastoEmbedLoaded = sandbox.ensureGuastoEmbedLoaded;
    return sandbox;
}

describe('lavoro predefinito del campo e bozza guasto', () => {
    it('un lavoro in corso batte il primo in ordine alfabetico', () => {
        const works = [
            lavoro('A', 'Alfa', { stato: 'assegnato', dataInizio: '2020-01-01' }),
            lavoro('Z', 'Zeta', { stato: 'in_corso', dataInizio: '2020-02-01' })
        ];
        expect(scegli(works).id).toBe('Z');
    });

    it('prende l\'iniziato più recente e, se non c\'è, il prossimo', () => {
        const iniziati = [
            lavoro('V', 'Vecchio', { stato: 'assegnato', dataInizio: '2019-01-01' }),
            lavoro('R', 'Recente', { stato: 'assegnato', dataInizio: '2024-06-01' })
        ];
        expect(scegli(iniziati).id).toBe('R');
        const prossimi = [
            lavoro('L', 'Lontano', { stato: 'assegnato', dataInizio: '2099-12-01' }),
            lavoro('V', 'Vicino', { stato: 'assegnato', dataInizio: '2099-03-01' })
        ];
        expect(scegli(prossimi).id).toBe('V');
    });

    it('un lavoro sospeso batte uno in standby', () => {
        const works = [
            lavoro('B', 'Beta', { stato: 'in_standby', dataInizio: '2024-01-01' }),
            lavoro('S', 'Alfa', { stato: 'sospeso', dataInizio: '2020-01-01' })
        ];
        expect(scegli(works).id).toBe('S');
    });

    it('dà lo stesso lavoro di scegliLavoroPredefinitoGuasto', () => {
        const works = [
            lavoro('S', 'Squadra', {
                stato: 'assegnato',
                dataInizio: '2024-01-01',
                caposquadraId: 'capo',
                operaioId: null
            }),
            lavoro('A', 'Autonomo', {
                stato: 'assegnato',
                dataInizio: '2024-01-01',
                operaioId: 'op',
                caposquadraId: null
            })
        ];
        const dalCampo = scegli(works);
        const dalGuasto = scegliLavoroPredefinitoGuasto(works.map((w) => w.raw));
        expect(dalCampo.id).toBe(dalGuasto.id);
        expect(dalCampo.id).toBe('A');
    });

    it('con la lista vuota non sceglie nulla', () => {
        expect(scegli([])).toBeNull();
    });

    it('loadWorksForSelection non usa più il primo lavoro alfabetico', () => {
        const corpo = estraiFunzione(SRC, 'async function loadWorksForSelection(tentativo)');
        expect(corpo).not.toContain('works[0]');
        expect(SRC).toContain('selectedWork = lavoroPredefinitoCampo(works)');
    });

    it('al primo passaggio carica la scheda guasto', () => {
        const sandbox = contestoGuasto();
        sandbox.lavoroScelto = 'L1';
        sandbox.guastoEmbedFrameEl = { dataset: {}, src: '', contentWindow: {} };
        sandbox.ensureGuastoEmbedLoaded();
        expect(sandbox.guastoEmbedFrameEl.dataset.loaded).toBe('1');
        expect(sandbox.guastoEmbedFrameEl.dataset.lavoroId).toBe('L1');
        expect(sandbox.guastoEmbedFrameEl.src).toContain('lavoroId=L1');
    });

    it('con una bozza aperta non ricarica se cambia il lavoro', () => {
        const sandbox = contestoGuasto();
        sandbox.lavoroScelto = 'L2';
        sandbox.guastoEmbedFrameEl = {
            dataset: { loaded: '1', lavoroId: 'L1' },
            src: 'vecchio',
            contentWindow: { __gfvFormSporco: true }
        };
        sandbox.ensureGuastoEmbedLoaded();
        expect(sandbox.guastoEmbedFrameEl.src).toBe('vecchio');
        expect(sandbox.guastoEmbedFrameEl.dataset.lavoroId).toBe('L1');
    });

    it('senza bozza la scheda segue il lavoro nuovo', () => {
        const sandbox = contestoGuasto();
        sandbox.lavoroScelto = 'L2';
        sandbox.guastoEmbedFrameEl = {
            dataset: { loaded: '1', lavoroId: 'L1' },
            src: 'vecchio',
            contentWindow: { __gfvFormSporco: false }
        };
        sandbox.ensureGuastoEmbedLoaded();
        expect(sandbox.guastoEmbedFrameEl.dataset.lavoroId).toBe('L2');
        expect(sandbox.guastoEmbedFrameEl.src).toContain('lavoroId=L2');
    });

    it('se l\'iframe non è leggibile ricarica come prima', () => {
        const sandbox = contestoGuasto();
        sandbox.lavoroScelto = 'L2';
        const frame = {
            dataset: { loaded: '1', lavoroId: 'L1' },
            src: 'vecchio'
        };
        Object.defineProperty(frame, 'contentWindow', {
            get() {
                throw new Error('origine diversa');
            }
        });
        sandbox.guastoEmbedFrameEl = frame;
        sandbox.ensureGuastoEmbedLoaded();
        expect(frame.dataset.lavoroId).toBe('L2');
        expect(frame.src).toContain('lavoroId=L2');
    });
});
