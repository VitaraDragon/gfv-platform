/**
 * @vitest-environment node
 */
import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { tonyDebugEnabled, tonyDebugLog } from '../core/js/tony/debug.js';

describe('tony debug log', () => {
    const prevWindow = global.window;
    let logSpy;

    beforeEach(() => {
        global.window = {};
        logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
        global.window = prevWindow;
    });

    test('spento di default', () => {
        expect(tonyDebugEnabled()).toBe(false);
        tonyDebugLog('[Tony] Esecuzione comando:', 'SET_FIELD');
        expect(logSpy).not.toHaveBeenCalled();
    });

    test('attivo con window.__TONY_DEBUG', () => {
        global.window.__TONY_DEBUG = true;
        expect(tonyDebugEnabled()).toBe(true);
        tonyDebugLog('[Tony] Esecuzione comando:', 'SET_FIELD');
        expect(logSpy).toHaveBeenCalledTimes(1);
        expect(logSpy.mock.calls[0][0]).toBe('[Tony] Esecuzione comando:');
        expect(logSpy.mock.calls[0][1]).toBe('SET_FIELD');
    });
});
