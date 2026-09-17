/**
 * Tony — inset tastiera da visualViewport (iOS/Android).
 * position:fixed resta agganciato al layout viewport: senza questo la chat
 * finisce sotto la tastiera. Nessun if (iPhone): stessa formula ovunque.
 * @module core/js/tony/visual-viewport
 */

/** Sotto questa soglia (px) è chrome del browser (barra URL), non la tastiera. */
export var TONY_KEYBOARD_INSET_MIN_PX = 120;

/**
 * @param {{ height?: number, offsetTop?: number }|null|undefined} visualViewport
 * @param {number} layoutHeight window.innerHeight
 * @returns {number}
 */
export function computeTonyKeyboardInset(visualViewport, layoutHeight) {
    if (!visualViewport || !(layoutHeight > 0)) return 0;
    var visH = Number(visualViewport.height);
    var visTop = Number(visualViewport.offsetTop);
    if (!isFinite(visH) || visH <= 0) return 0;
    if (!isFinite(visTop) || visTop < 0) visTop = 0;
    var inset = layoutHeight - (visH + visTop);
    if (!isFinite(inset) || inset < TONY_KEYBOARD_INSET_MIN_PX) return 0;
    return Math.round(inset);
}

/**
 * @param {HTMLElement|null} panel
 * @param {HTMLElement|null} fab
 * @param {number} inset
 */
export function applyTonyKeyboardInset(panel, fab, inset) {
    var n = inset > 0 ? inset : 0;
    var px = n + 'px';
    var open = n >= TONY_KEYBOARD_INSET_MIN_PX;
    if (panel) {
        panel.style.setProperty('--tony-keyboard-inset', px);
        panel.classList.toggle('is-keyboard-open', open);
    }
    if (fab) {
        fab.classList.toggle('is-keyboard-open', open);
    }
}

/**
 * Aggancia resize/scroll di visualViewport + focus sul campo Tony.
 * Idempotente. Ritorna `sync` per i test.
 * @param {{ window?: Window, document?: Document }} [opts]
 * @returns {function(): number}
 */
export function bindTonyVisualViewport(opts) {
    var win = (opts && opts.window) || (typeof window !== 'undefined' ? window : null);
    var doc = (opts && opts.document) || (win && win.document) || (typeof document !== 'undefined' ? document : null);
    if (!win || !doc) {
        return function () { return 0; };
    }
    if (win.__tonyVisualViewportBound) {
        return typeof win.__tonySyncKeyboardInset === 'function'
            ? win.__tonySyncKeyboardInset
            : function () { return 0; };
    }
    win.__tonyVisualViewportBound = true;

    function sync() {
        var panel = doc.getElementById('tony-panel');
        var fab = doc.getElementById('tony-fab');
        var inset = computeTonyKeyboardInset(win.visualViewport, win.innerHeight);
        applyTonyKeyboardInset(panel, fab, inset);
        return inset;
    }

    win.__tonySyncKeyboardInset = sync;

    var vv = win.visualViewport;
    if (vv && typeof vv.addEventListener === 'function') {
        vv.addEventListener('resize', sync);
        vv.addEventListener('scroll', sync);
    }
    win.addEventListener('resize', sync);
    win.addEventListener('orientationchange', sync);
    doc.addEventListener('focusin', function (ev) {
        var t = ev && ev.target;
        if (t && (t.id === 'tony-input' || (t.closest && t.closest('#tony-panel')))) {
            win.setTimeout(sync, 50);
            win.setTimeout(sync, 300);
        }
    });
    doc.addEventListener('focusout', function (ev) {
        var t = ev && ev.target;
        if (t && t.id === 'tony-input') {
            win.setTimeout(sync, 50);
            win.setTimeout(sync, 300);
        }
    });
    sync();
    return sync;
}
