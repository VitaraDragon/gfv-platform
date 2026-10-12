/**
 * Helper lingua campo: fallback, parametri, storage finto.
 */
import { describe, it, expect } from 'vitest';
import { FIELD_UI_STRINGS } from '../../core/config/field-ui-i18n.js';
import {
    t,
    normalizzaLingua,
    leggiLinguaCampo,
    salvaLinguaCampo,
    FIELD_LANG_STORAGE_KEY
} from '../../core/services/field-ui-i18n.js';

function memoria(iniziale) {
    const store = { ...(iniziale || {}) };
    return {
        getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
        setItem(key, value) { store[key] = String(value); },
        dump: store
    };
}

describe('field-ui-i18n helper', () => {
    it('normalizza solo it, ro, en e sq', () => {
        expect(normalizzaLingua('fr')).toBe('it');
        expect(normalizzaLingua(undefined)).toBe('it');
        expect(normalizzaLingua('EN')).toBe('en');
        expect(normalizzaLingua(' ro ')).toBe('ro');
        expect(normalizzaLingua('SQ')).toBe('sq');
        expect(normalizzaLingua('')).toBe('it');
        expect(normalizzaLingua(null)).toBe('it');
    });

    it('sq restituisce l’albanese e, se manca, torna all’italiano', () => {
        expect(t('menu.logout', 'sq')).toBe('Dilni');
        expect(t('menu.lingua', 'sq')).toBe('Gjuha');
        const salvato = FIELD_UI_STRINGS['menu.logout'].sq;
        delete FIELD_UI_STRINGS['menu.logout'].sq;
        try {
            expect(t('menu.logout', 'sq')).toBe('Esci');
        } finally {
            FIELD_UI_STRINGS['menu.logout'].sq = salvato;
        }
    });

    it('lingua sconosciuta e chiave assente in rumeno tornano all\'italiano', () => {
        expect(t('menu.logout', 'de')).toBe('Esci');
        const salvato = FIELD_UI_STRINGS['menu.logout'].ro;
        delete FIELD_UI_STRINGS['menu.logout'].ro;
        try {
            expect(t('menu.logout', 'ro')).toBe('Esci');
        } finally {
            FIELD_UI_STRINGS['menu.logout'].ro = salvato;
        }
    });

    it('chiave inesistente restituisce la chiave, senza eccezioni', () => {
        expect(t('non.esiste', 'en')).toBe('non.esiste');
        expect(t('non.esiste', 'it', { n: 1 })).toBe('non.esiste');
    });

    it('sostituisce i parametri e lascia il segnaposto se manca il valore', () => {
        const voce = FIELD_UI_STRINGS['toast.prova'];
        FIELD_UI_STRINGS['toast.prova'] = {
            it: 'Inviati {n} di {count}',
            ro: 'Trimise {n} din {count}',
            en: 'Sent {n} of {count}',
            sq: 'U dërguan {n} nga {count}'
        };
        try {
            expect(t('toast.prova', 'en', { n: 2, count: 5 })).toBe('Sent 2 of 5');
            expect(t('toast.prova', 'it', { n: 1 })).toBe('Inviati 1 di {count}');
            expect(t('toast.prova', 'ro', { n: null, count: 3 })).toBe('Trimise {n} din 3');
        } finally {
            if (voce === undefined) delete FIELD_UI_STRINGS['toast.prova'];
            else FIELD_UI_STRINGS['toast.prova'] = voce;
        }
    });

    it('legge e scrive su storage finto; valore sporco o storage che lancia → it', () => {
        const store = memoria({ [FIELD_LANG_STORAGE_KEY]: 'fr' });
        expect(leggiLinguaCampo(store)).toBe('it');
        expect(salvaLinguaCampo('en', store)).toBe('en');
        expect(store.dump[FIELD_LANG_STORAGE_KEY]).toBe('en');
        expect(leggiLinguaCampo(store)).toBe('en');
        expect(salvaLinguaCampo('nope', store)).toBe('it');
        expect(leggiLinguaCampo(store)).toBe('it');

        const rotto = {
            getItem() { throw new Error('privata'); },
            setItem() { throw new Error('privata'); }
        };
        expect(leggiLinguaCampo(rotto)).toBe('it');
        expect(salvaLinguaCampo('ro', rotto)).toBe('ro');
        expect(leggiLinguaCampo(null)).toBe('it');
    });
});
