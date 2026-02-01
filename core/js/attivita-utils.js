/**
 * Attività Utils - Funzioni utility per gestione attività
 * 
 * @module core/js/attivita-utils
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
// FUNZIONI CALCOLO ORE
// ============================================

/**
 * Calcola ore nette da orario inizio, fine e pause
 * @returns {Object} Oggetto con { ore, minuti, decimali }
 */
export function calculateOreNette() {
    const inizioEl = document.getElementById('attivita-orario-inizio');
    const fineEl = document.getElementById('attivita-orario-fine');
    const pauseEl = document.getElementById('attivita-pause');
    
    if (!inizioEl) return { ore: 0, minuti: 0, decimali: 0 };
    
    const inizio = inizioEl.value;
    const fine = fineEl ? fineEl.value : '';
    const pause = pauseEl ? parseInt(pauseEl.value) || 0 : 0;
    
    if (!inizio) return { ore: 0, minuti: 0, decimali: 0 };
    
    // Se non c'è orario fine, non calcolare ore (attività in corso)
    if (!fine) return { ore: 0, minuti: 0, decimali: 0 };
    
    try {
        const [inizioOre, inizioMinuti] = inizio.split(':').map(Number);
        const [fineOre, fineMinuti] = fine.split(':').map(Number);
        
        const inizioMinutiTotali = inizioOre * 60 + inizioMinuti;
        const fineMinutiTotali = fineOre * 60 + fineMinuti;
        
        let minutiTotali = fineMinutiTotali - inizioMinutiTotali;
        if (minutiTotali < 0) return { ore: 0, minuti: 0, decimali: 0 };
        
        minutiTotali -= pause;
        if (minutiTotali < 0) return { ore: 0, minuti: 0, decimali: 0 };
        
        const ore = Math.floor(minutiTotali / 60);
        const minuti = minutiTotali % 60;
        const decimali = parseFloat((minutiTotali / 60).toFixed(2));
        
        return { ore, minuti, decimali };
    } catch (e) {
        return { ore: 0, minuti: 0, decimali: 0 };
    }
}

/**
 * Formatta ore in formato leggibile
 * @param {number} oreNette - Ore in formato decimale
 * @returns {string} Formato "Xh Ymin" o "Xh" o "Ymin"
 */
export function formatOreNette(oreNette) {
    if (typeof oreNette === 'number') {
        const ore = Math.floor(oreNette);
        const minuti = Math.round((oreNette - ore) * 60);
        
        if (minuti === 0) {
            return `${ore}h`;
        } else if (ore === 0) {
            return `${minuti}min`;
        } else {
            return `${ore}h ${minuti}min`;
        }
    }
    return '0h';
}

/**
 * Aggiorna display ore nette nel form
 */
export function updateOreNette() {
    const result = calculateOreNette();
    const displayEl = document.getElementById('ore-nette-display');
    
    if (!displayEl) return;
    
    let displayText = '';
    
    if (result.ore === 0 && result.minuti === 0) {
        displayText = '0h';
    } else if (result.minuti === 0) {
        displayText = `${result.ore}h`;
    } else if (result.ore === 0) {
        displayText = `${result.minuti}min`;
    } else {
        displayText = `${result.ore}h ${result.minuti}min`;
    }
    
    displayEl.textContent = displayText;
}

/**
 * Aggiorna display ore macchina basandosi su ore lavoratore
 */
export function updateOreMacchinaDisplay() {
    const oreLavoratoreDisplay = document.getElementById('ore-lavoratore-display');
    const oreMacchinaInput = document.getElementById('attivita-ore-macchina');
    
    if (oreLavoratoreDisplay) {
        const oreNetteResult = calculateOreNette();
        oreLavoratoreDisplay.textContent = oreNetteResult.decimali.toFixed(2);
        
        // Pre-compila ore macchina con ore lavoratore se vuoto
        if (oreMacchinaInput && !oreMacchinaInput.value) {
            oreMacchinaInput.value = oreNetteResult.decimali.toFixed(2);
        }
    }
}

/**
 * Calcolo automatico ore nette per modalità Conto Terzi
 */
export function updateOreNetteContoTerzi() {
    const oraInizioEl = document.getElementById('attivita-ora-inizio-ct');
    const oraFineEl = document.getElementById('attivita-ora-fine-ct');
    const pauseEl = document.getElementById('attivita-pause-ct');
    const oreNetteEl = document.getElementById('attivita-ore-nette-ct');
    
    if (!oraInizioEl || !oraFineEl || !pauseEl || !oreNetteEl) return;
    
    const oraInizio = oraInizioEl.value;
    const oraFine = oraFineEl.value;
    const pauseMinuti = parseInt(pauseEl.value) || 0;
    
    if (!oraInizio || !oraFine) {
        oreNetteEl.value = '0.0';
        return;
    }
    
    try {
        const [inizioOre, inizioMinuti] = oraInizio.split(':').map(Number);
        const [fineOre, fineMinuti] = oraFine.split(':').map(Number);
        
        const inizioMinutiTotali = inizioOre * 60 + inizioMinuti;
        const fineMinutiTotali = fineOre * 60 + fineMinuti;
        
        if (fineMinutiTotali <= inizioMinutiTotali) {
            oreNetteEl.value = '0.0';
            return;
        }
        
        let minutiTotali = fineMinutiTotali - inizioMinutiTotali - pauseMinuti;
        if (minutiTotali < 0) minutiTotali = 0;
        
        const oreNette = (minutiTotali / 60).toFixed(2);
        oreNetteEl.value = oreNette;
    } catch (error) {
        oreNetteEl.value = '0.0';
    }
}

// ============================================
// FUNZIONI MAPPING COLTURE
// ============================================

/**
 * Mappa coltura specifica a categoria (versione locale sincrona)
 * @param {string} colturaNome - Nome della coltura
 * @returns {string} Nome della categoria
 */
export function mapColturaToCategoria(colturaNome) {
    if (!colturaNome) return 'Default';
    
    const nomeLower = colturaNome.toLowerCase();
    
    // Match esatto nella palette
    if (colturaNome === 'Vite' || colturaNome === 'Frutteto' || colturaNome === 'Seminativo' || 
        colturaNome === 'Orto' || colturaNome === 'Prato' || colturaNome === 'Olivo' || 
        colturaNome === 'Agrumeto' || colturaNome === 'Bosco') {
        return colturaNome;
    }
    
    // Mapping per Vite
    if (nomeLower.includes('vite')) {
        return 'Vite';
    }
    
    // Mapping per Frutteto
    if (nomeLower.includes('albicocch') || nomeLower.includes('pesco') || 
        nomeLower.includes('melo') || nomeLower.includes('pero') ||
        nomeLower.includes('ciliegio') || nomeLower.includes('susino') ||
        nomeLower.includes('fico') || nomeLower.includes('nocciolo') ||
        nomeLower.includes('mandorlo') || nomeLower.includes('castagno') ||
        nomeLower.includes('kiwi') || nomeLower.includes('mirtillo') ||
        nomeLower.includes('lampone') || nomeLower.includes('ribes') ||
        nomeLower.includes('mora') || nomeLower.includes('melograno') ||
        nomeLower.includes('noce') || nomeLower.includes('pistacchio') ||
        nomeLower.includes('kaki') || nomeLower.includes('cachi')) {
        return 'Frutteto';
    }
    
    // Mapping per Seminativo
    if (nomeLower.includes('grano') || nomeLower.includes('mais') ||
        nomeLower.includes('orzo') || nomeLower.includes('favino') ||
        nomeLower.includes('girasole') || nomeLower.includes('soia') ||
        nomeLower.includes('colza') || nomeLower.includes('barbabietola') ||
        nomeLower.includes('pomodoro') || nomeLower.includes('patata')) {
        return 'Seminativo';
    }
    
    // Mapping per Orto
    if (nomeLower.includes('insalata') || nomeLower.includes('zucchin') ||
        nomeLower.includes('peperon') || nomeLower.includes('melanzan') ||
        nomeLower.includes('carota') || nomeLower.includes('cipolla') ||
        nomeLower.includes('aglio') || nomeLower.includes('fagiol') ||
        nomeLower.includes('pisell') || nomeLower.includes('fava') ||
        nomeLower.includes('cavolo') || nomeLower.includes('broccol') ||
        nomeLower.includes('spinac') || nomeLower.includes('bietola')) {
        return 'Orto';
    }
    
    // Mapping per Prato
    if (nomeLower.includes('prato') || nomeLower.includes('erba') ||
        nomeLower.includes('foragg') || nomeLower.includes('medica')) {
        return 'Prato';
    }
    
    // Mapping per Olivo
    if (nomeLower.includes('oliv') || nomeLower.includes('ulivo')) {
        return 'Olivo';
    }
    
    // Mapping per Agrumeto
    if (nomeLower.includes('limone') || nomeLower.includes('arancia') ||
        nomeLower.includes('mandarino') || nomeLower.includes('pompelmo') ||
        nomeLower.includes('cedro') || nomeLower.includes('bergamotto')) {
        return 'Agrumeto';
    }
    
    // Mapping per Bosco
    if (nomeLower.includes('bosco') || nomeLower.includes('foresta') ||
        nomeLower.includes('quercia') || nomeLower.includes('faggio') ||
        nomeLower.includes('pino') || nomeLower.includes('abete')) {
        return 'Bosco';
    }
    
    // Default
    return 'Default';
}

/**
 * Inizializza il calcolo automatico delle ore nette per il form rapido (modalità Conto Terzi)
 * @param {string} lavoroId - ID del lavoro per cui inizializzare il calcolo
 */
export function initCalcoloOreNetteRapido(lavoroId) {
    const oraInizioEl = document.getElementById(`rapido-ora-inizio-${lavoroId}`);
    const oraFineEl = document.getElementById(`rapido-ora-fine-${lavoroId}`);
    const pauseEl = document.getElementById(`rapido-pause-${lavoroId}`);
    const oreNetteEl = document.getElementById(`rapido-ore-nette-${lavoroId}`);
    
    if (!oraInizioEl || !oraFineEl || !pauseEl || !oreNetteEl) return;
    
    function calcolaOreNette() {
        const oraInizio = oraInizioEl.value;
        const oraFine = oraFineEl.value;
        const pauseMinuti = parseInt(pauseEl.value) || 0;
        
        if (!oraInizio || !oraFine) {
            oreNetteEl.value = '0.0';
            return;
        }
        
        try {
            const [inizioOre, inizioMinuti] = oraInizio.split(':').map(Number);
            const [fineOre, fineMinuti] = oraFine.split(':').map(Number);
            
            const inizioMinutiTotali = inizioOre * 60 + inizioMinuti;
            const fineMinutiTotali = fineOre * 60 + fineMinuti;
            
            if (fineMinutiTotali <= inizioMinutiTotali) {
                oreNetteEl.value = '0.0';
                return;
            }
            
            let minutiTotali = fineMinutiTotali - inizioMinutiTotali - pauseMinuti;
            if (minutiTotali < 0) minutiTotali = 0;
            
            const oreNette = (minutiTotali / 60).toFixed(2);
            oreNetteEl.value = oreNette;
        } catch (error) {
            oreNetteEl.value = '0.0';
        }
    }
    
    oraInizioEl.addEventListener('change', calcolaOreNette);
    oraInizioEl.addEventListener('input', calcolaOreNette);
    oraFineEl.addEventListener('change', calcolaOreNette);
    oraFineEl.addEventListener('input', calcolaOreNette);
    pauseEl.addEventListener('change', calcolaOreNette);
    pauseEl.addEventListener('input', calcolaOreNette);
    
    // Calcola iniziale
    setTimeout(calcolaOreNette, 100);
}

