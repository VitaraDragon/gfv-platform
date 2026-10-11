/**
 * Applica il catalogo campo al DOM.
 * Con italiano non riscrive il markup: lo ripristina solo se si torna da un'altra lingua.
 * Non tocca data-slide-title.
 * @module core/mobile/js/field-ui-i18n-dom
 */

import { normalizzaLingua, t } from '../../services/field-ui-i18n.js';

const BINDINGS = [
    {
        keyAttr: 'data-i18n',
        origAttr: 'data-i18n-it',
        read: (el) => el.textContent,
        write: (el, value) => { el.textContent = value; }
    },
    {
        keyAttr: 'data-i18n-placeholder',
        origAttr: 'data-i18n-placeholder-it',
        read: (el) => el.getAttribute('placeholder') || '',
        write: (el, value) => { el.setAttribute('placeholder', value); }
    },
    {
        keyAttr: 'data-i18n-aria',
        origAttr: 'data-i18n-aria-it',
        read: (el) => el.getAttribute('aria-label') || '',
        write: (el, value) => { el.setAttribute('aria-label', value); }
    },
    {
        keyAttr: 'data-i18n-title',
        origAttr: 'data-i18n-title-it',
        read: (el) => el.getAttribute('title') || '',
        write: (el, value) => { el.setAttribute('title', value); }
    }
];

/**
 * @param {string} lang
 * @param {ParentNode} [root]
 * @returns {'it'|'ro'|'en'}
 */
export function applicaLingua(lang, root) {
    const lingua = normalizzaLingua(lang);
    const scope = root && typeof root.querySelectorAll === 'function' ? root : document;
    const doc = scope && scope.nodeType === 9
        ? scope
        : (typeof document !== 'undefined' ? document : null);
    if (doc && doc.documentElement) doc.documentElement.lang = lingua;
    if (!scope || typeof scope.querySelectorAll !== 'function') return lingua;

    BINDINGS.forEach((binding) => {
        scope.querySelectorAll('[' + binding.keyAttr + ']').forEach((el) => {
            const key = el.getAttribute(binding.keyAttr);
            if (!key) return;
            if (lingua === 'it') {
                if (el.hasAttribute(binding.origAttr)) {
                    binding.write(el, el.getAttribute(binding.origAttr));
                }
                return;
            }
            if (!el.hasAttribute(binding.origAttr)) {
                el.setAttribute(binding.origAttr, binding.read(el));
            }
            binding.write(el, t(key, lingua));
        });
    });
    return lingua;
}
