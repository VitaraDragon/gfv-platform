/**
 * Terreni Utils - Funzioni utility per gestione terreni
 * 
 * @module core/js/terreni-utils
 */

// ============================================
// FUNZIONI UTILITY GENERICHE
// ============================================

/**
 * Mostra alert temporaneo all'utente
 * @param {string} message - Messaggio da mostrare
 * @param {string} type - Tipo alert: 'success', 'error', 'warning', 'info' (default: 'success')
 */
export function showAlert(message, type = 'success') {
    const container = document.getElementById('alert-container');
    if (!container) {
        console.warn('Container alert non trovato');
        return;
    }
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    container.appendChild(alert);
    
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

/**
 * Escape caratteri HTML per sicurezza
 * @param {string} text - Testo da escapare
 * @returns {string} Testo escapato
 */
export function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// ============================================
// FUNZIONI UTILITY AFFITTI
// ============================================

/**
 * Calcola colore e testo alert scadenza affitto
 * @param {Date|Timestamp|string} dataScadenza - Data scadenza affitto
 * @returns {Object} { colore: string, testo: string, giorni: number, mesi: number|null }
 */
export function calcolaAlertAffitto(dataScadenza) {
    if (!dataScadenza) {
        return { colore: null, testo: '', giorni: null };
    }

    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    
    const scadenza = dataScadenza.toDate ? dataScadenza.toDate() : new Date(dataScadenza);
    scadenza.setHours(0, 0, 0, 0);

    const giorniRimanenti = Math.ceil((scadenza - oggi) / (1000 * 60 * 60 * 24));
    const mesiRimanenti = giorniRimanenti / 30;

    if (giorniRimanenti < 0) {
        return { colore: 'grey', testo: 'Scaduto', giorni: giorniRimanenti, mesi: null };
    } else if (giorniRimanenti <= 30) {
        // Rosso: ≤1 mese
        return { colore: 'red', testo: `${giorniRimanenti} giorni`, giorni: giorniRimanenti, mesi: mesiRimanenti };
    } else if (giorniRimanenti <= 180) {
        // Giallo: 1-6 mesi
        const mesi = Math.floor(mesiRimanenti);
        return { colore: 'yellow', testo: `~${mesi} mesi`, giorni: giorniRimanenti, mesi: mesiRimanenti };
    } else {
        // Verde: >6 mesi
        const mesi = Math.floor(mesiRimanenti);
        return { colore: 'green', testo: `~${mesi} mesi`, giorni: giorniRimanenti, mesi: mesiRimanenti };
    }
}

/**
 * Formatta data scadenza per visualizzazione
 * @param {Date|Timestamp|string} data - Data da formattare
 * @returns {string} Data formattata (es: "01/01/2025")
 */
export function formattaDataScadenza(data) {
    if (!data) return '';
    const d = data.toDate ? data.toDate() : new Date(data);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ============================================
// FUNZIONI UTILITY COLORI COLTURE (per mappe)
// ============================================

/**
 * Palette colori per colture (ottimizzata per visibilità)
 */
const colturaColors = {
    'Vite': { fill: '#DC143C', stroke: '#8B0000' },      // Rosso scuro brillante
    'Frutteto': { fill: '#FF6600', stroke: '#CC5500' },  // Arancione brillante
    'Seminativo': { fill: '#FFD700', stroke: '#B8860B' }, // Giallo oro
    'Orto': { fill: '#00FF00', stroke: '#00AA00' },      // Verde lime brillante
    'Ortive': { fill: '#00FF00', stroke: '#00AA00' },    // Alias per Ortive
    'Prato': { fill: '#90EE90', stroke: '#228B22' },    // Verde chiaro
    'Olivo': { fill: '#9370DB', stroke: '#6A5ACD' },    // Viola medio
    'Agrumeto': { fill: '#FFA500', stroke: '#FF8C00' },  // Arancione
    'Bosco': { fill: '#8B4513', stroke: '#654321' },    // Marrone sella
    'Default': { fill: '#1E90FF', stroke: '#0066CC' }   // Blu dodger (invece di verde)
};

/**
 * Mappa nome coltura specifico a categoria generica per colore
 * @param {string} colturaNome - Nome coltura
 * @param {string} colturaCategoria - Nome categoria coltura (opzionale)
 * @returns {string} Nome categoria colore
 */
export function mapColturaToColorCategory(colturaNome, colturaCategoria) {
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
        colturaCategoria?.toLowerCase() === 'bosco') {
        return 'Bosco';
    }
    
    return 'Default';
}

/**
 * Ottiene colore coltura selezionata per poligono mappa
 * @returns {Object} { fill: string, stroke: string }
 */
export function getColturaColor() {
    const colturaSelect = document.getElementById('terreno-coltura');
    const colturaCategoriaSelect = document.getElementById('terreno-coltura-categoria');
    const colturaNome = colturaSelect ? colturaSelect.value : null;
    const colturaCategoria = colturaCategoriaSelect ? 
        colturaCategoriaSelect.options[colturaCategoriaSelect.selectedIndex]?.text : null;
    
    if (!colturaNome) {
        return colturaColors['Default'];
    }
    
    const colorCategory = mapColturaToColorCategory(colturaNome, colturaCategoria);
    const colorData = colturaColors[colorCategory] || colturaColors['Default'];
    return {
        fill: colorData.fill,
        stroke: colorData.stroke
    };
}

