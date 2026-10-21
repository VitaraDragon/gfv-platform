/**
 * Helper puro per la lingua del workspace campo.
 * Nessun Firebase e nessun DOM. Default italiano: non si deduce dal browser.
 * @module core/services/field-ui-i18n
 */

import { FIELD_UI_LANGS, FIELD_UI_LANG_OPTIONS, FIELD_UI_STRINGS } from '../config/field-ui-i18n.js?v=2026-10-21a';

export { FIELD_UI_LANG_OPTIONS };

export const FIELD_LANG_STORAGE_KEY = 'gfv_field_lang';

/**
 * @param {unknown} v
 * @returns {'it'|'ro'|'en'|'sq'|'fr'}
 */
export function normalizzaLingua(v) {
    const s = String(v == null ? '' : v).trim().toLowerCase();
    return FIELD_UI_LANGS.includes(s) ? s : 'it';
}

/**
 * @param {string} text
 * @param {Record<string, unknown>|null|undefined} params
 * @returns {string}
 */
function applicaParametri(text, params) {
    if (!params || typeof params !== 'object') return text;
    return text.replace(/\{([A-Za-z0-9_]+)\}/g, (full, name) => {
        if (!Object.prototype.hasOwnProperty.call(params, name) || params[name] == null) return full;
        return String(params[name]);
    });
}

/**
 * @param {string} key
 * @param {string} [lang]
 * @param {Record<string, unknown>} [params]
 * @returns {string}
 */
export function t(key, lang, params) {
    const id = String(key == null ? '' : key);
    const entry = FIELD_UI_STRINGS[id];
    if (!entry || typeof entry !== 'object') return id;
    const lingua = normalizzaLingua(lang);
    let text = entry[lingua];
    if (typeof text !== 'string') text = entry.it;
    if (typeof text !== 'string') return id;
    return applicaParametri(text, params);
}

/**
 * @param {{ getItem?: (k: string) => string|null }|null|undefined} storage
 * @returns {'it'|'ro'|'en'|'sq'|'fr'}
 */
export function leggiLinguaCampo(storage) {
    try {
        if (!storage || typeof storage.getItem !== 'function') return 'it';
        return normalizzaLingua(storage.getItem(FIELD_LANG_STORAGE_KEY));
    } catch (error) {
        return 'it';
    }
}

/**
 * @param {string} lang
 * @param {{ setItem?: (k: string, v: string) => void }|null|undefined} storage
 * @returns {'it'|'ro'|'en'|'sq'|'fr'}
 */
export function salvaLinguaCampo(lang, storage) {
    const lingua = normalizzaLingua(lang);
    try {
        if (storage && typeof storage.setItem === 'function') {
            storage.setItem(FIELD_LANG_STORAGE_KEY, lingua);
        }
    } catch (error) {
        /* modalità privata o storage assente */
    }
    return lingua;
}
