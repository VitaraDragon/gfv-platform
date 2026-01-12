/**
 * Dashboard Utils Extended - Funzioni utility aggiuntive per dashboard
 * 
 * @module core/js/dashboard-utils-extended
 */

// ============================================
// FUNZIONI UTILITY
// ============================================

/**
 * Calcola alert scadenza affitto
 * @param {Object|Date} dataScadenza - Data scadenza (Timestamp Firestore o Date)
 * @returns {Object} Oggetto con { colore, testo, giorni, mesi }
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
 * @param {Object|Date} data - Data (Timestamp Firestore o Date)
 * @returns {string} Data formattata
 */
export function formattaDataScadenza(data) {
    if (!data) return '';
    const d = data.toDate ? data.toDate() : new Date(data);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}



