/**
 * Etichetta leggibile della coltura di un terreno cliente (Conto Terzi).
 * `coltura` / `colturaCategoria` possono contenere l'ID categoria (es. seed_seminativo)
 * quando l'utente sceglie solo la categoria: non va mai mostrato all'utente.
 */

export function isIdCategoriaSeed(value) {
    return /^seed_[a-z0-9_]+$/i.test(String(value == null ? '' : value).trim());
}

function titleCaseSlug(slug) {
    return String(slug)
        .replace(/^seed_/i, '')
        .split('_')
        .filter(Boolean)
        .map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); })
        .join(' ');
}

/**
 * @param {Object} terreno
 * @param {Array<{id:string,nome:string}>} [categorieColture]
 * @returns {string} nome leggibile, oppure «—» se assente
 */
export function getTerrenoColturaLabel(terreno, categorieColture) {
    if (!terreno) return '—';
    const categorie = Array.isArray(categorieColture) ? categorieColture : [];
    const nomeCategoria = function (id) {
        const found = categorie.find(function (c) { return c && c.id === id; });
        return found && found.nome ? String(found.nome).trim() : '';
    };
    const candidati = [terreno.colturaSottocategoria, terreno.coltura, terreno.colturaCategoria];
    for (let i = 0; i < candidati.length; i++) {
        const v = String(candidati[i] == null ? '' : candidati[i]).trim();
        if (!v) continue;
        const nome = nomeCategoria(v);
        if (nome) return nome;
        if (isIdCategoriaSeed(v)) {
            const pretty = titleCaseSlug(v);
            if (pretty) return pretty;
            continue;
        }
        return v;
    }
    return '—';
}
