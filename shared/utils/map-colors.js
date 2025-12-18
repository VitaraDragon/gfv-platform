/**
 * Palette colori unificata per mappe GFV Platform
 * Colori ottimizzati per visibilità su mappa satellitare
 * 
 * @module shared/utils/map-colors
 */

/**
 * Colori per colture - palette visibile e distinta
 * Ogni colore ha versione base (fill) e scura (stroke) per massima visibilità
 */
export const colturaColors = {
    'Vite': {
        fill: '#DC143C',      // Rosso scuro brillante
        stroke: '#8B0000',   // Rosso molto scuro per perimetro
        name: 'Vite'
    },
    'Frutteto': {
        fill: '#FF6600',     // Arancione brillante
        stroke: '#CC5500',   // Arancione scuro per perimetro
        name: 'Frutteto'
    },
    'Seminativo': {
        fill: '#FFD700',     // Giallo oro
        stroke: '#B8860B',   // Giallo scuro per perimetro
        name: 'Seminativo'
    },
    'Orto': {
        fill: '#00FF00',     // Verde lime brillante
        stroke: '#00AA00',   // Verde scuro per perimetro
        name: 'Orto'
    },
    'Prato': {
        fill: '#90EE90',     // Verde chiaro
        stroke: '#228B22',   // Verde scuro per perimetro
        name: 'Prato'
    },
    'Olivo': {
        fill: '#9370DB',     // Viola medio
        stroke: '#6A5ACD',   // Viola scuro per perimetro
        name: 'Olivo'
    },
    'Agrumeto': {
        fill: '#FFA500',     // Arancione
        stroke: '#FF8C00',   // Arancione scuro per perimetro
        name: 'Agrumeto'
    },
    'Bosco': {
        fill: '#8B4513',     // Marrone sella
        stroke: '#654321',   // Marrone scuro per perimetro
        name: 'Bosco'
    },
    'Default': {
        fill: '#1E90FF',     // Blu dodger (invece di verde)
        stroke: '#0066CC',   // Blu scuro per perimetro
        name: 'Non specificato'
    }
};

/**
 * Ottiene il colore fill per una coltura
 * @param {string} coltura - Nome della coltura
 * @returns {string} Colore hex per fill
 */
export function getColturaFillColor(coltura) {
    const colturaData = colturaColors[coltura] || colturaColors['Default'];
    return colturaData.fill;
}

/**
 * Ottiene il colore stroke per una coltura (versione scura per perimetro)
 * @param {string} coltura - Nome della coltura
 * @returns {string} Colore hex per stroke
 */
export function getColturaStrokeColor(coltura) {
    const colturaData = colturaColors[coltura] || colturaColors['Default'];
    return colturaData.stroke;
}

/**
 * Ottiene entrambi i colori (fill e stroke) per una coltura
 * @param {string} coltura - Nome della coltura
 * @returns {Object} Oggetto con fill e stroke
 */
export function getColturaColors(coltura) {
    const colturaData = colturaColors[coltura] || colturaColors['Default'];
    return {
        fill: colturaData.fill,
        stroke: colturaData.stroke,
        name: colturaData.name
    };
}

/**
 * Configurazione perimetri mappe - valori ottimizzati per visibilità
 */
export const mapPolygonConfig = {
    strokeWeight: 3,        // Aumentato da 2 a 3 per maggiore visibilità
    strokeOpacity: 1.0,     // Aumentato da 0.8 a 1.0 per massima visibilità
    fillOpacity: 0.35       // Mantenuto per trasparenza
};

/**
 * Mappa una coltura specifica alla sua categoria generica per colori/filtri
 * @param {string} colturaNome - Nome specifico della coltura (es. "Vite da Vino", "Albicocche")
 * @param {string} colturaCategoria - Categoria della coltura se disponibile (opzionale)
 * @returns {string} Categoria generica (Vite, Frutteto, Seminativo, Orto, Prato, Olivo, Agrumeto, Bosco, Default)
 */
export function mapColturaToColorCategory(colturaNome, colturaCategoria = null) {
    if (!colturaNome) return 'Default';
    
    const nomeLower = colturaNome.toLowerCase();
    
    // Match esatto nella palette
    if (colturaColors[colturaNome]) {
        return colturaNome;
    }
    
    // Mapping per Vite (tutte le varianti)
    if (nomeLower.includes('vite') || colturaCategoria?.toLowerCase() === 'vite') {
        return 'Vite';
    }
    
    // Mapping per Frutteto (tutte le varianti)
    if (nomeLower.includes('albicocch') || nomeLower.includes('pesco') || 
        nomeLower.includes('melo') || nomeLower.includes('pero') ||
        nomeLower.includes('ciliegio') || nomeLower.includes('susino') ||
        nomeLower.includes('fico') || nomeLower.includes('nocciolo') ||
        nomeLower.includes('mandorlo') || nomeLower.includes('castagno') ||
        nomeLower.includes('kiwi') || nomeLower.includes('mirtillo') ||
        nomeLower.includes('lampone') || nomeLower.includes('ribes') ||
        nomeLower.includes('mora') || nomeLower.includes('melograno') ||
        nomeLower.includes('noce') || nomeLower.includes('pistacchio') ||
        colturaCategoria?.toLowerCase() === 'frutteto') {
        return 'Frutteto';
    }
    
    // Mapping per Seminativo
    if (nomeLower.includes('grano') || nomeLower.includes('mais') ||
        nomeLower.includes('orzo') || nomeLower.includes('favino') ||
        nomeLower.includes('girasole') || nomeLower.includes('soia') ||
        nomeLower.includes('colza') || nomeLower.includes('avena') ||
        nomeLower.includes('segale') || nomeLower.includes('fava') ||
        nomeLower.includes('lenticchia') || nomeLower.includes('cece') ||
        nomeLower.includes('riso') || nomeLower.includes('quinoa') ||
        nomeLower.includes('canapa') || nomeLower.includes('lino') ||
        nomeLower.includes('erba medica') || nomeLower.includes('trifoglio') ||
        colturaCategoria?.toLowerCase() === 'seminativo') {
        return 'Seminativo';
    }
    
    // Mapping per Ortive/Orto
    if (nomeLower.includes('pomodoro') || nomeLower.includes('zucchin') ||
        nomeLower.includes('melanzan') || nomeLower.includes('peperon') ||
        nomeLower.includes('insalata') || nomeLower.includes('carot') ||
        nomeLower.includes('patat') || nomeLower.includes('bietol') ||
        nomeLower.includes('fragol') || nomeLower.includes('cipoll') ||
        nomeLower.includes('aglio') || nomeLower.includes('fagiol') ||
        nomeLower.includes('pisell') || nomeLower.includes('cavolo') ||
        nomeLower.includes('broccoli') || nomeLower.includes('spinaci') ||
        nomeLower.includes('lattuga') || nomeLower.includes('radicchio') ||
        nomeLower.includes('finocchi') || nomeLower.includes('sedano') ||
        nomeLower.includes('cetriol') || nomeLower.includes('anguria') ||
        nomeLower.includes('melon') || colturaCategoria?.toLowerCase() === 'ortive' ||
        colturaCategoria?.toLowerCase() === 'orto') {
        return 'Orto';
    }
    
    // Mapping per Prato
    if (nomeLower.includes('prato') || nomeLower.includes('pascolo') ||
        colturaCategoria?.toLowerCase() === 'prato') {
        return 'Prato';
    }
    
    // Mapping per Olivo
    if (nomeLower.includes('olivo') || nomeLower.includes('oliveto') ||
        colturaCategoria?.toLowerCase() === 'olivo') {
        return 'Olivo';
    }
    
    // Mapping per Agrumeto
    if (nomeLower.includes('arancio') || nomeLower.includes('limone') ||
        nomeLower.includes('mandarino') || nomeLower.includes('clementin') ||
        nomeLower.includes('pompelmo') || nomeLower.includes('bergamotto') ||
        nomeLower.includes('cedro') || nomeLower.includes('lime') ||
        nomeLower.includes('kumquat') || colturaCategoria?.toLowerCase() === 'agrumeto') {
        return 'Agrumeto';
    }
    
    // Mapping per Bosco
    if (nomeLower.includes('bosco') || nomeLower.includes('foresta') ||
        nomeLower.includes('castagneto') || nomeLower.includes('faggeto') ||
        nomeLower.includes('querceto') || nomeLower.includes('pineto') ||
        colturaCategoria?.toLowerCase() === 'bosco') {
        return 'Bosco';
    }
    
    return 'Default';
}

/**
 * Ottiene le categorie colture disponibili (chiavi della palette colori)
 * @returns {Array<string>} Array di categorie colture
 */
export function getColturaCategories() {
    return Object.keys(colturaColors).filter(key => key !== 'Default');
}

/**
 * Default export
 */
export default {
    colturaColors,
    getColturaFillColor,
    getColturaStrokeColor,
    getColturaColors,
    mapColturaToColorCategory,
    getColturaCategories,
    mapPolygonConfig
};


