/**
 * Gestione Lavori Utils - Funzioni utility per gestione lavori
 * 
 * @module core/admin/js/gestione-lavori-utils
 */

import { showStandaloneAlert } from '../../js/standalone-alert.js';

// ============================================
// FUNZIONI UTILITY GENERICHE
// ============================================

/**
 * Mostra alert temporaneo all'utente
 * @param {string} message - Messaggio da mostrare
 * @param {string} type - Tipo alert: 'success', 'error', 'warning', 'info' (default: 'info')
 */
export function showAlert(message, type = 'info') {
    showStandaloneAlert(message, type);
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
// FUNZIONI UTILITY STATO LAVORO
// ============================================

/**
 * Formatta stato lavoro per visualizzazione
 * @param {string} stato - Stato lavoro
 * @returns {string} Stato formattato con emoji
 */
export function getStatoFormattato(stato) {
    const stati = {
        'da_pianificare': '📝 Da pianificare',
        'assegnato': '📋 Assegnato',
        'in_corso': '🔄 In corso',
        'in_standby': '⏸️ Standby (assenza)',
        'sospeso': '⏸️ Sospeso',
        'completato': '✅ Completato',
        'completato_da_approvare': '⏳ In attesa approvazione',
        'annullato': '❌ Annullato'
    };
    return stati[stato] || stato;
}

/**
 * Ottieni stato progresso formattato
 * @param {string} statoProgresso - Stato progresso lavoro
 * @returns {string} Stato progresso formattato con emoji
 */
export function getStatoProgressoFormattato(statoProgresso) {
    const stati = {
        'in_ritardo': '🔴 In ritardo',
        'in_tempo': '🟢 In tempo',
        'in_anticipo': '🚀 In anticipo'
    };
    return stati[statoProgresso] || statoProgresso || '';
}

/**
 * Calcola stato progresso lavoro (in_anticipo/in_tempo/in_ritardo)
 * @param {Object} lavoro - Oggetto lavoro con dataInizio, durataPrevista, superficieTotaleLavorata
 * @param {Object} terreno - Oggetto terreno con superficie
 * @returns {string|null} Stato progresso: 'in_anticipo', 'in_tempo', 'in_ritardo', o null se non calcolabile
 */
export function calcolaStatoProgresso(lavoro, terreno) {
    if (!lavoro.dataInizio || !lavoro.durataPrevista) {
        return null;
    }
    
    const dataInizio = lavoro.dataInizio instanceof Date 
        ? lavoro.dataInizio 
        : (lavoro.dataInizio?.toDate ? lavoro.dataInizio.toDate() : new Date(lavoro.dataInizio));
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    dataInizio.setHours(0, 0, 0, 0);
    
    const giorniEffettivi = Math.max(0, Math.floor((oggi - dataInizio) / (1000 * 60 * 60 * 24)) + 1);
    
    if (giorniEffettivi === 0) {
        return null; // Lavoro non ancora iniziato
    }
    
    const superficieTotale = terreno?.superficie || 0;
    const superficieLavorata = lavoro.superficieTotaleLavorata || lavoro.superficieLavorata || 0;
    const percentualeCompletamento = superficieTotale > 0 ? (superficieLavorata / superficieTotale * 100) : 0;
    const percentualeTempo = (giorniEffettivi / lavoro.durataPrevista) * 100;
    const tolleranza = 10; // Tolleranza del 10%
    
    if (percentualeCompletamento > percentualeTempo + tolleranza) {
        return 'in_anticipo';
    } else if (percentualeCompletamento < percentualeTempo - tolleranza) {
        return 'in_ritardo';
    } else {
        return 'in_tempo';
    }
}

// ============================================
// FUNZIONI UTILITY CONTO TERZI
// ============================================

/**
 * Applica stili per modalità Conto Terzi
 */
export function applyContoTerziStyles() {
    const header = document.querySelector('.header');
    if (header) {
        header.classList.add('conto-terzi-mode');
        header.style.background = 'linear-gradient(135deg, #1976D2 0%, #1565C0 100%)';
    }
    
    const container = document.querySelector('.container');
    if (container) {
        container.classList.add('conto-terzi-mode');
    }
    
    // Aggiorna titolo se necessario
    const headerTitle = header?.querySelector('h1');
    if (headerTitle && headerTitle.textContent.includes('Gestione Lavori')) {
        headerTitle.textContent = '📋 Lavori da Pianificare - Conto Terzi';
    }
    
    // Aggiorna stili bottoni primari
    const primaryButtons = document.querySelectorAll('.btn-primary');
    primaryButtons.forEach(btn => {
        if (!btn.closest('.modal')) {
            btn.style.background = 'rgba(255,255,255,0.2)';
        }
    });
    
    // Aggiorna stili modal
    const modalPrimaryButtons = document.querySelectorAll('.modal .btn-primary');
    modalPrimaryButtons.forEach(btn => {
        btn.style.background = '#1976D2';
    });
    
    // Aggiorna stat cards principali
    const statCards = document.querySelectorAll('.stat-card:not(.secondary):not(.warning):not(.danger)');
    statCards.forEach(card => {
        if (!card.closest('.stats-header')) {
            card.style.background = 'linear-gradient(135deg, #1976D2 0%, #1565C0 100%)';
        }
    });
}/**
 * Aggiorna link dashboard per modalità Conto Terzi
 */
export function updateDashboardLink() {
    const dashboardLink = document.getElementById('dashboard-link');
    if (dashboardLink) {
        dashboardLink.href = '../../modules/conto-terzi/views/conto-terzi-home-standalone.html';
    }
}

const LAVORO_CT_LOCK_FIELD_IDS = [
    'lavoro-nome',
    'lavoro-terreno',
    'lavoro-categoria-principale',
    'lavoro-sottocategoria',
    'lavoro-tipo-lavoro'
];

/**
 * Blocca campi già noti dal preventivo CT (da_pianificare).
 * @param {Object} lavoro
 */
export function applyLavoroFormContoTerziDaPianificareLock(lavoro) {
    if (!lavoro || lavoro.stato !== 'da_pianificare' || !lavoro.clienteId || !lavoro.preventivoId) {
        resetLavoroFormContoTerziLock();
        return;
    }

    LAVORO_CT_LOCK_FIELD_IDS.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.tagName === 'SELECT') {
            el.disabled = true;
        } else {
            el.readOnly = true;
        }
    });

    let hint = document.getElementById('lavoro-ct-preventivo-hint');
    if (!hint) {
        hint = document.createElement('p');
        hint.id = 'lavoro-ct-preventivo-hint';
        hint.style.cssText = 'color:#1565C0;font-size:12px;margin:0 0 12px 0;padding:8px 10px;background:#E3F2FD;border-radius:6px;';
        const form = document.getElementById('lavoro-form');
        if (form && form.firstChild) {
            form.insertBefore(hint, form.firstChild);
        }
    }
    hint.textContent = 'Dati da preventivo conto terzi: completa data, assegnazione e macchine.';
    hint.style.display = 'block';
}

/**
 * Ripristina editabilità campi form lavoro dopo chiusura modal CT.
 */
export function resetLavoroFormContoTerziLock() {
    LAVORO_CT_LOCK_FIELD_IDS.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.disabled = false;
        el.readOnly = false;
    });
    const hint = document.getElementById('lavoro-ct-preventivo-hint');
    if (hint) hint.style.display = 'none';
}