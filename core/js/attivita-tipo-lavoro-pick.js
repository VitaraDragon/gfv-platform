/**
 * Helper puri per la scelta del tipo lavoro in Diario (Modifica attività).
 * Più tipi possono avere lo stesso `nome` in sottocategorie diverse
 * (es. «Trinciatura» in Generale e in Tra le File): `find(nome)` prende il primo
 * e la Modifica perde il tipo salvato.
 */

function norm(s) {
    return String(s == null ? '' : s).trim().toLowerCase();
}

/**
 * Sceglie il tipo lavoro per nome preferendo (in ordine):
 * 1. categoria/sottocategoria esplicita (id) salvata sull'attività
 * 2. sottocategoria il cui nome contiene `preferSottocategoriaNome` (es. «tra le file»)
 * 3. primo match per nome
 *
 * @param {Array} tipiLavoroList
 * @param {string} nome
 * @param {Object} [opts]
 * @param {string[]} [opts.preferCategoriaIds]
 * @param {string} [opts.preferSottocategoriaNome]
 * @param {Function} [opts.getNomeCategoria] id => nome categoria/sottocategoria
 * @returns {Object|null}
 */
export function pickTipoLavoroByNome(tipiLavoroList, nome, opts) {
    const options = opts || {};
    const target = norm(nome);
    if (!target || !Array.isArray(tipiLavoroList)) return null;
    const matches = tipiLavoroList.filter(function (t) { return t && norm(t.nome) === target; });
    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];

    const preferIds = (options.preferCategoriaIds || []).filter(Boolean);
    if (preferIds.length) {
        const byId = matches.find(function (t) {
            return preferIds.indexOf(t.sottocategoriaId) !== -1 || preferIds.indexOf(t.categoriaId) !== -1;
        });
        if (byId) return byId;
    }

    const pattern = norm(options.preferSottocategoriaNome);
    if (pattern && typeof options.getNomeCategoria === 'function') {
        const byName = matches.find(function (t) {
            const id = t.sottocategoriaId || t.categoriaId;
            return norm(options.getNomeCategoria(id)).indexOf(pattern) !== -1;
        });
        if (byName) return byName;
    }
    return matches[0];
}

/**
 * True se il cambio terreno va trattato come azione utente su NUOVA attività
 * (solo allora Generale → Tra le File). Non durante prefill di Modifica.
 */
export function shouldAutoSwitchGeneraleToTraLeFile(opts) {
    const o = opts || {};
    if (o.currentAttivitaId) return false;
    if (o.detail && o.detail.precompilazione) return false;
    return true;
}
