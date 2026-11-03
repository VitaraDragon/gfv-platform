/**
 * @vitest-environment jsdom
 * Se l'import di resolveEffectiveModules fallisce, Tony tiene i moduli grezzi del tenant.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('gfvPublishTenantForTony senza resolver', () => {
    it('pubblica tenant.modules quando l\'import del resolver fallisce', async () => {
        delete window.__gfvTonyLoaderBuild;
        window.__gfvModuliAttivi = [];
        window.__gfvTenantData = null;
        window.history.pushState({}, '', '/core/admin/abbonamento-standalone.html');
        const src = readFileSync('core/js/gfv-tony-loader.js', 'utf8');
        window.eval(src);
        window.gfvTryLoadTonyWidgetWhenReady = function () {};
        window.gfvPublishTenantForTony({
            plan: 'base',
            modules: ['manodopera'],
            moduleTrials: {
                tony: { status: 'active', endsAt: Date.now() + 7 * 24 * 60 * 60 * 1000 }
            }
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(window.__gfvModuliAttivi).toEqual(['manodopera']);
    });
});
