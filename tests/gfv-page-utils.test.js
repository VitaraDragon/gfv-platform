/**
 * @vitest-environment node
 */
import { describe, expect, test, vi, beforeEach } from 'vitest';

vi.mock('../core/js/standalone-alert.js', () => ({
    showStandaloneAlert: vi.fn()
}));

import { escapeHtml, showAlert } from '../core/js/gfv-page-utils.js';
import { showStandaloneAlert } from '../core/js/standalone-alert.js';

describe('gfv-page-utils escapeHtml', () => {
    test('stringa vuota e null/undefined', () => {
        expect(escapeHtml('')).toBe('');
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });

    test('escapa markup e virgolette', () => {
        expect(escapeHtml('<script>alert(1)</script>')).toBe(
            '&lt;script&gt;alert(1)&lt;/script&gt;'
        );
        expect(escapeHtml('a & b "c" \'d\'')).toBe('a &amp; b &quot;c&quot; &#39;d&#39;');
    });

    test('converte numeri in stringa', () => {
        expect(escapeHtml(0)).toBe('0');
        expect(escapeHtml(12)).toBe('12');
    });
});

describe('gfv-page-utils showAlert', () => {
    beforeEach(() => {
        showStandaloneAlert.mockClear();
    });

    test('delega a showStandaloneAlert', () => {
        showAlert('ok', 'success', 1000);
        expect(showStandaloneAlert).toHaveBeenCalledWith('ok', 'success', 1000);
    });

    test('default type info', () => {
        showAlert('ciao');
        expect(showStandaloneAlert).toHaveBeenCalledWith('ciao', 'info', undefined);
    });
});
