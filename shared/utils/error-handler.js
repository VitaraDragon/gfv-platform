// Error Handler Centralizzato
// Gestione uniforme degli errori nell'applicazione GFV Platform

/**
 * Tipo di errore per la visualizzazione
 */
const ErrorType = {
    ERROR: 'error',
    WARNING: 'warning',
    SUCCESS: 'success',
    INFO: 'info'
};

/**
 * Mostra un messaggio all'utente con stile appropriato
 * @param {string} message - Messaggio da mostrare
 * @param {string} type - Tipo di messaggio (error, warning, success, info)
 * @param {number} duration - Durata in millisecondi (0 = permanente)
 */
function showMessage(message, type = ErrorType.ERROR, duration = 5000) {
    // Rimuovi messaggi esistenti
    removeExistingMessages();
    
    // Crea elemento del messaggio
    const messageDiv = document.createElement('div');
    messageDiv.className = `global-message global-message-${type}`;
    messageDiv.id = 'global-message-container';
    
    // Icona basata sul tipo
    const icons = {
        error: '❌',
        warning: '⚠️',
        success: '✅',
        info: 'ℹ️'
    };
    
    // Testo del messaggio
    messageDiv.innerHTML = `
        <div class="global-message-content">
            <span class="global-message-icon">${icons[type] || 'ℹ️'}</span>
            <span class="global-message-text">${escapeHtml(message)}</span>
            <button class="global-message-close" onclick="closeMessage()">×</button>
        </div>
    `;
    
    // Aggiungi al body
    document.body.appendChild(messageDiv);
    
    // Animazione di entrata
    setTimeout(() => {
        messageDiv.classList.add('show');
    }, 10);
    
    // Auto-chiusura se durata specificata
    if (duration > 0) {
        setTimeout(() => {
            closeMessage();
        }, duration);
    }
}

/**
 * Rimuove messaggi esistenti
 */
function removeExistingMessages() {
    const existing = document.getElementById('global-message-container');
    if (existing) {
        existing.classList.remove('show');
        setTimeout(() => {
            existing.remove();
        }, 300);
    }
}

/**
 * Chiude il messaggio corrente
 */
function closeMessage() {
    removeExistingMessages();
}

/**
 * Mostra un errore all'utente
 * @param {string|Error} error - Messaggio di errore o oggetto Error
 * @param {number} duration - Durata in millisecondi
 */
function showError(error, duration = 6000) {
    const message = error instanceof Error ? error.message : error;
    showMessage(message, ErrorType.ERROR, duration);
    console.error('❌ Errore:', error);
}

/**
 * Mostra un warning all'utente
 * @param {string} message - Messaggio di warning
 * @param {number} duration - Durata in millisecondi
 */
function showWarning(message, duration = 5000) {
    showMessage(message, ErrorType.WARNING, duration);
    console.warn('⚠️ Warning:', message);
}

/**
 * Mostra un messaggio di successo
 * @param {string} message - Messaggio di successo
 * @param {number} duration - Durata in millisecondi
 */
function showSuccess(message, duration = 4000) {
    showMessage(message, ErrorType.SUCCESS, duration);
    console.log('✅ Success:', message);
}

/**
 * Mostra un messaggio informativo
 * @param {string} message - Messaggio informativo
 * @param {number} duration - Durata in millisecondi
 */
function showInfo(message, duration = 4000) {
    showMessage(message, ErrorType.INFO, duration);
    console.log('ℹ️ Info:', message);
}

/**
 * Gestisce errori Firebase in modo uniforme
 * @param {Error} error - Errore Firebase
 * @param {string} operation - Nome dell'operazione (es. "salvataggio cliente")
 */
function handleFirebaseError(error, operation = 'operazione') {
    let userMessage = `Errore durante il ${operation}`;
    
    // Messaggi specifici per errori Firebase comuni
    if (error.code) {
        switch (error.code) {
            case 'auth/user-not-found':
                userMessage = 'Utente non trovato. Verifica email e password.';
                break;
            case 'auth/wrong-password':
                userMessage = 'Password errata. Riprova.';
                break;
            case 'auth/invalid-email':
                userMessage = 'Email non valida.';
                break;
            case 'auth/user-disabled':
                userMessage = 'Account disabilitato. Contatta l\'amministratore.';
                break;
            case 'auth/too-many-requests':
                userMessage = 'Troppi tentativi. Riprova più tardi.';
                break;
            case 'permission-denied':
                userMessage = `Accesso negato durante il ${operation}. Verifica di essere autenticato.`;
                break;
            case 'unavailable':
                userMessage = `Servizio non disponibile. Controlla la connessione internet.`;
                break;
            case 'unauthenticated':
                userMessage = `Autenticazione richiesta. Effettua il login.`;
                break;
            default:
                userMessage = `Errore durante il ${operation}: ${error.message || 'Errore sconosciuto'}`;
        }
    } else if (error.message) {
        userMessage = `${userMessage}: ${error.message}`;
    }
    
    showError(userMessage);
    
    // Log dettagliato per debugging
    console.error(`🔥 Firebase Error [${operation}]:`, {
        code: error.code,
        message: error.message,
        stack: error.stack,
        error: error
    });
}

/**
 * Escape HTML per prevenire XSS
 * @param {string} text - Testo da escapare
 * @returns {string} Testo escapato
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Esponi funzioni globalmente
window.showError = showError;
window.showWarning = showWarning;
window.showSuccess = showSuccess;
window.showInfo = showInfo;
window.handleFirebaseError = handleFirebaseError;
window.closeMessage = closeMessage;

// Aggiungi stili CSS
const style = document.createElement('style');
style.textContent = `
    .global-message {
        position: fixed;
        top: 20px;
        right: 20px;
        max-width: 400px;
        min-width: 300px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        opacity: 0;
        transform: translateX(400px);
        transition: all 0.3s ease-in-out;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    
    .global-message.show {
        opacity: 1;
        transform: translateX(0);
    }
    
    .global-message-error {
        border-left: 4px solid #dc3545;
    }
    
    .global-message-warning {
        border-left: 4px solid #ffc107;
    }
    
    .global-message-success {
        border-left: 4px solid #28a745;
    }
    
    .global-message-info {
        border-left: 4px solid #17a2b8;
    }
    
    .global-message-content {
        display: flex;
        align-items: center;
        padding: 15px 20px;
        gap: 12px;
    }
    
    .global-message-icon {
        font-size: 20px;
        flex-shrink: 0;
    }
    
    .global-message-text {
        flex: 1;
        color: #333;
        font-size: 14px;
        line-height: 1.5;
    }
    
    .global-message-close {
        background: none;
        border: none;
        font-size: 24px;
        color: #999;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: color 0.2s;
    }
    
    .global-message-close:hover {
        color: #333;
    }
    
    @media (max-width: 768px) {
        .global-message {
            top: 10px;
            right: 10px;
            left: 10px;
            max-width: none;
            min-width: auto;
        }
    }
`;

// Aggiungi stili al documento quando disponibile
if (document.head) {
    document.head.appendChild(style);
} else {
    document.addEventListener('DOMContentLoaded', () => {
        document.head.appendChild(style);
    });
}

console.log('✅ Error Handler caricato correttamente');


