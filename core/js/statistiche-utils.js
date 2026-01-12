/**
 * Statistiche Utils - Funzioni utility per statistiche
 * 
 * @module core/js/statistiche-utils
 */

// ============================================
// FUNZIONI UTILITY FORMATTAZIONE
// ============================================

/**
 * Formatta ore in formato leggibile (es. "5h 30min" o "5h")
 * @param {number} ore - Numero di ore (può essere decimale)
 * @returns {string} Ore formattate
 */
export function formatOre(ore) {
    const oreInt = Math.floor(ore);
    const minuti = Math.round((ore - oreInt) * 60);
    if (minuti === 0) {
        return `${oreInt}h`;
    }
    return `${oreInt}h ${minuti}min`;
}

/**
 * Formatta mese in formato leggibile (es. "Gen 2024")
 * @param {string} mese - Mese in formato "YYYY-MM"
 * @returns {string} Mese formattato
 */
export function formatMese(mese) {
    const [anno, meseNum] = mese.split('-');
    const mesi = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    return `${mesi[parseInt(meseNum) - 1]} ${anno}`;
}

/**
 * Escape caratteri HTML per prevenire XSS
 * @param {string} text - Testo da escapare
 * @returns {string} Testo escapato
 */
export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Calcola alert scadenza affitto (stessa logica di terreni-standalone.html)
 * @param {Date|Timestamp} dataScadenza - Data di scadenza affitto
 * @returns {Object} Oggetto con colore, testo, giorni e mesi rimanenti
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
        return { colore: 'red', testo: `${giorniRimanenti} giorni`, giorni: giorniRimanenti, mesi: mesiRimanenti };
    } else if (giorniRimanenti <= 180) {
        const mesi = Math.floor(mesiRimanenti);
        return { colore: 'yellow', testo: `~${mesi} mesi`, giorni: giorniRimanenti, mesi: mesiRimanenti };
    } else {
        const mesi = Math.floor(mesiRimanenti);
        return { colore: 'green', testo: `~${mesi} mesi`, giorni: giorniRimanenti, mesi: mesiRimanenti };
    }
}

/**
 * Formatta data scadenza in formato italiano
 * @param {Date|Timestamp} data - Data da formattare
 * @returns {string} Data formattata (es. "15/01/2024")
 */
export function formattaDataScadenza(data) {
    if (!data) return '';
    const d = data.toDate ? data.toDate() : new Date(data);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

