/**
 * Specifica del guard embed in gfv-tony-loader (logica pura, senza DOM browser).
 * Allineare a shouldSuppressTonyAsEmbed in core/js/gfv-tony-loader.js.
 */
function shouldSuppressTonyAsEmbed(opts) {
    const search = opts.search || '';
    const parentPath = opts.parentPath || '';
    const parentHasFab = !!opts.parentHasFab;
    const isIframe = !!opts.isIframe;

    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const embed = String(params.get('embed') || '').toLowerCase();
    if (embed === 'mobile' || embed === '1' || embed === 'true') return true;
    if (params.get('noTony') === '1') return true;
    if (isIframe) {
        if (parentHasFab) return true;
        if (String(parentPath).toLowerCase().indexOf('field-workspace') >= 0) return true;
    }
    return false;
}

describe('gfv-tony-embed-guard', () => {
    test('embed=mobile sopprime Tony', () => {
        expect(shouldSuppressTonyAsEmbed({ search: '?embed=mobile' })).toBe(true);
    });

    test('noTony=1 sopprime Tony', () => {
        expect(shouldSuppressTonyAsEmbed({ search: '?noTony=1' })).toBe(true);
    });

    test('pagina top-level non sopprime', () => {
        expect(shouldSuppressTonyAsEmbed({ search: '', isIframe: false })).toBe(false);
    });

    test('iframe in field-workspace sopprime', () => {
        expect(shouldSuppressTonyAsEmbed({
            search: '',
            isIframe: true,
            parentPath: '/core/mobile/field-workspace-standalone.html'
        })).toBe(true);
    });

    test('iframe con FAB parent sopprime', () => {
        expect(shouldSuppressTonyAsEmbed({
            search: '',
            isIframe: true,
            parentHasFab: true,
            parentPath: '/other.html'
        })).toBe(true);
    });
});
