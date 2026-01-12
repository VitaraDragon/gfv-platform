/**
 * Gestione Macchine Utils - Funzioni utility per gestione macchine
 * 
 * @module core/admin/js/gestione-macchine-utils
 */

// ============================================
// FUNZIONI UTILITY GENERICHE
// ============================================

/**
 * Mostra alert temporaneo all'utente
 * @param {string} message - Messaggio da mostrare
 * @param {string} type - Tipo alert: 'success', 'error', 'warning', 'info' (default: 'info')
 */
export function showAlert(message, type = 'info') {
    const container = document.getElementById('alert-container');
    if (!container) {
        console.warn('Container alert non trovato');
        return;
    }
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    container.innerHTML = '';
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
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// FUNZIONI UTILITY FORMATTAZIONE
// ============================================

/**
 * Formatta data in formato italiano
 * @param {Date|Timestamp|string} data - Data da formattare
 * @returns {string} Data formattata o '-'
 */
export function formattaData(data) {
    if (!data) return '-';
    const d = data.toDate ? data.toDate() : new Date(data);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ============================================
// FUNZIONI UTILITY MANUTENZIONE
// ============================================

/**
 * Verifica se manutenzione è in scadenza (entro 30 giorni o 50 ore)
 * @param {Object} macchina - Oggetto macchina
 * @param {Timestamp|Date} macchina.prossimaManutenzione - Data prossima manutenzione
 * @param {number} macchina.oreProssimaManutenzione - Ore prossima manutenzione
 * @param {number} macchina.oreAttuali - Ore attuali macchina
 * @returns {boolean} True se in scadenza
 */
export function isManutenzioneInScadenza(macchina) {
    if (!macchina.prossimaManutenzione && (!macchina.oreProssimaManutenzione || macchina.oreProssimaManutenzione === null)) {
        return false;
    }

    // Verifica per data
    if (macchina.prossimaManutenzione) {
        const oggi = new Date();
        oggi.setHours(0, 0, 0, 0);
        const scadenza = macchina.prossimaManutenzione.toDate ? macchina.prossimaManutenzione.toDate() : new Date(macchina.prossimaManutenzione);
        scadenza.setHours(0, 0, 0, 0);
        const giorniRimanenti = Math.ceil((scadenza - oggi) / (1000 * 60 * 60 * 24));
        
        if (giorniRimanenti <= 30 && giorniRimanenti >= 0) {
            return true;
        }
    }

    // Verifica per ore
    if (macchina.oreProssimaManutenzione !== null && macchina.oreAttuali !== null) {
        const oreRimanenti = macchina.oreProssimaManutenzione - macchina.oreAttuali;
        if (oreRimanenti <= 50 && oreRimanenti >= 0) {
            return true;
        }
    }

    return false;
}

/**
 * Verifica se manutenzione è scaduta
 * @param {Object} macchina - Oggetto macchina
 * @param {Timestamp|Date} macchina.prossimaManutenzione - Data prossima manutenzione
 * @param {number} macchina.oreProssimaManutenzione - Ore prossima manutenzione
 * @param {number} macchina.oreAttuali - Ore attuali macchina
 * @returns {boolean} True se scaduta
 */
export function isManutenzioneScaduta(macchina) {
    if (!macchina.prossimaManutenzione && (!macchina.oreProssimaManutenzione || macchina.oreProssimaManutenzione === null)) {
        return false;
    }

    // Verifica per data
    if (macchina.prossimaManutenzione) {
        const oggi = new Date();
        oggi.setHours(0, 0, 0, 0);
        const scadenza = macchina.prossimaManutenzione.toDate ? macchina.prossimaManutenzione.toDate() : new Date(macchina.prossimaManutenzione);
        scadenza.setHours(0, 0, 0, 0);
        
        if (scadenza < oggi) {
            return true;
        }
    }

    // Verifica per ore
    if (macchina.oreProssimaManutenzione !== null && macchina.oreAttuali !== null) {
        if (macchina.oreAttuali >= macchina.oreProssimaManutenzione) {
            return true;
        }
    }

    return false;
}

