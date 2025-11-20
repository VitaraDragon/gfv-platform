// Loading Handler Centralizzato
// Sistema per gestire stati di caricamento e feedback visivo durante operazioni async

/**
 * Mostra un indicatore di caricamento
 * @param {string} message - Messaggio da mostrare
 * @param {HTMLElement} targetElement - Elemento dove mostrare il loading (opzionale)
 */
function showLoading(message = 'Caricamento...', targetElement = null) {
    // Rimuovi loading precedente se esiste
    hideLoading(targetElement);
    
    // Crea elemento loading
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'loading-overlay-global';
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <p class="loading-message">${message}</p>
        </div>
    `;
    
    // Aggiungi stili se non già presenti
    if (!document.getElementById('loading-handler-styles')) {
        const style = document.createElement('style');
        style.id = 'loading-handler-styles';
        style.textContent = `
            .loading-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                backdrop-filter: blur(2px);
            }
            
            .loading-spinner {
                background: white;
                padding: 30px 40px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                text-align: center;
            }
            
            .spinner {
                border: 4px solid #f3f3f3;
                border-top: 4px solid #2E8B57;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 0 auto 15px;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .loading-message {
                color: #333;
                font-size: 16px;
                margin: 0;
                font-weight: 500;
            }
            
            .button-loading {
                position: relative;
                pointer-events: none;
                opacity: 0.7;
            }
            
            .button-loading::after {
                content: '';
                position: absolute;
                width: 16px;
                height: 16px;
                margin: auto;
                border: 2px solid transparent;
                border-top-color: currentColor;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
            }
            
            .button-loading-text {
                opacity: 0;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Aggiungi al body o all'elemento target
    if (targetElement) {
        const container = targetElement.closest('.modal-content') || targetElement.parentElement || document.body;
        container.style.position = 'relative';
        targetElement.id = 'loading-overlay-target';
        container.appendChild(loadingOverlay);
    } else {
        document.body.appendChild(loadingOverlay);
    }
}

/**
 * Nasconde l'indicatore di caricamento
 * @param {HTMLElement} targetElement - Elemento target (opzionale)
 */
function hideLoading(targetElement = null) {
    const overlay = document.getElementById('loading-overlay-global');
    if (overlay) {
        overlay.remove();
    }
    
    // Rimuovi anche loading specifici per target
    if (targetElement) {
        const targetOverlay = targetElement.querySelector('.loading-overlay');
        if (targetOverlay) {
            targetOverlay.remove();
        }
    }
}

/**
 * Mostra loading su un pulsante
 * @param {HTMLElement|string} button - Pulsante o selettore del pulsante
 * @param {string} loadingText - Testo da mostrare durante il loading (opzionale)
 */
function setButtonLoading(button, loadingText = null) {
    const btn = typeof button === 'string' ? document.querySelector(button) : button;
    if (!btn) return;
    
    // Salva testo originale
    if (!btn.dataset.originalText) {
        btn.dataset.originalText = btn.textContent;
        btn.dataset.originalDisabled = btn.disabled;
    }
    
    btn.classList.add('button-loading');
    btn.disabled = true;
    
    if (loadingText) {
        btn.innerHTML = `<span class="button-loading-text">${loadingText}</span>`;
    } else {
        btn.innerHTML = `<span class="button-loading-text">${btn.dataset.originalText}</span>`;
    }
}

/**
 * Rimuove loading da un pulsante
 * @param {HTMLElement|string} button - Pulsante o selettore del pulsante
 */
function removeButtonLoading(button) {
    const btn = typeof button === 'string' ? document.querySelector(button) : button;
    if (!btn || !btn.dataset.originalText) return;
    
    btn.classList.remove('button-loading');
    btn.disabled = btn.dataset.originalDisabled === 'true';
    btn.textContent = btn.dataset.originalText;
    delete btn.dataset.originalText;
    delete btn.dataset.originalDisabled;
}

// Esponi funzioni globalmente
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.setButtonLoading = setButtonLoading;
window.removeButtonLoading = removeButtonLoading;

console.log('✅ Loading Handler caricato correttamente');





