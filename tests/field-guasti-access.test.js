import { describe, it, expect } from 'vitest';
import {
    puoAprireSegnalazioneGuasti,
    ritornoWorkspaceCampoDaGuasti,
    hrefRitornoSegnalazioneGuasti,
    etichettaRitornoSegnalazioneGuasti,
    primoTenantIdUtente,
} from '../core/js/field-guasti-access.js';

describe('segnalazione guasti — profilo campo', () => {
    it('operaio e caposquadra-only possono aprire e tornano al workspace', () => {
        expect(puoAprireSegnalazioneGuasti(['operaio'])).toBe(true);
        expect(puoAprireSegnalazioneGuasti(['caposquadra'])).toBe(true);
        expect(hrefRitornoSegnalazioneGuasti(['Caposquadra'])).toMatch(/field-workspace-standalone\.html/);
        expect(etichettaRitornoSegnalazioneGuasti(['operaio'])).toBe('← Campo');
    });

    it('manager e admin, anche con ruolo campo, tornano in dashboard', () => {
        expect(puoAprireSegnalazioneGuasti(['manager'])).toBe(false);
        expect(puoAprireSegnalazioneGuasti(['manager', 'caposquadra'])).toBe(true);
        expect(ritornoWorkspaceCampoDaGuasti(['manager', 'operaio'])).toBe(false);
        expect(hrefRitornoSegnalazioneGuasti(['amministratore', 'caposquadra'])).toMatch(/dashboard-standalone\.html/);
        expect(etichettaRitornoSegnalazioneGuasti(['manager', 'operaio'])).toBe('← Dashboard');
    });

    it('senza ruoli campo non apre', () => {
        expect(puoAprireSegnalazioneGuasti([])).toBe(false);
        expect(puoAprireSegnalazioneGuasti(['contabile'])).toBe(false);
    });

    it('risolve il tenant dalla membership se manca tenantId', () => {
        expect(primoTenantIdUtente({ tenantId: 'az-a' })).toBe('az-a');
        expect(primoTenantIdUtente({
            tenantMemberships: {
                'az-b': { stato: 'attivo' },
                'az-c': { stato: 'sospeso' },
            },
        })).toBe('az-b');
        expect(primoTenantIdUtente(null)).toBeNull();
    });
});
