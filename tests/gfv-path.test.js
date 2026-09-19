/**
 * @vitest-environment node
 */
import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { getBasePath, resolveImportPath, resolvePath } from '../core/js/gfv-path.js';

describe('gfv-path', () => {
    const prevWindow = global.window;

    beforeEach(() => {
        global.window = {
            location: {
                protocol: 'https:',
                pathname: '/gfv-platform/modules/vigneto/views/trattamenti-standalone.html',
                href: 'https://example.test/gfv-platform/modules/vigneto/views/trattamenti-standalone.html',
                origin: 'https://example.test'
            }
        };
    });

    afterEach(() => {
        global.window = prevWindow;
    });

    test('getBasePath da /modules/ su GitHub Pages', () => {
        expect(getBasePath()).toBe('/gfv-platform');
    });

    test('getBasePath da /core/', () => {
        global.window.location.pathname = '/gfv-platform/core/dashboard-standalone.html';
        expect(getBasePath()).toBe('/gfv-platform');
    });

    test('http/https restano invariati', () => {
        expect(resolveImportPath('https://cdn.example/a.js')).toBe('https://cdn.example/a.js');
    });

    test('risolve relativo rispetto a currentModuleUrl', () => {
        expect(
            resolveImportPath(
                '../../../core/services/lavori-service.js',
                'https://example.test/gfv-platform/modules/vigneto/views/trattamenti-standalone.html'
            )
        ).toBe('https://example.test/gfv-platform/core/services/lavori-service.js');
    });

    test('resolvePath è alias di resolveImportPath', () => {
        expect(resolvePath).toBe(resolveImportPath);
    });
});
