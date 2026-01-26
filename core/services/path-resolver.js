/**
 * Path Resolver - Risolve percorsi correttamente per GitHub Pages e ambiente locale
 * Gestisce il caso in cui l'app è deployata in una sottocartella su GitHub Pages
 * 
 * @module core/services/path-resolver
 * 
 * IMPORTANTE: Per usare questa funzione in file HTML con script inline,
 * importa prima questo modulo e poi usa resolveImportPath per tutti gli import dinamici.
 * 
 * @example
 * import { resolveImportPath } from './core/services/path-resolver.js';
 * const module = await import(resolveImportPath('./firebase-service.js'));
 */

/**
 * Ottiene il base path dell'applicazione
 * Per GitHub Pages: /gfv-platform/
 * Per locale: /
 * @returns {string} Base path
 */
export function getBasePath() {
    if (typeof window === 'undefined') {
        return '/';
    }
    
    // Se siamo in ambiente file://, non c'è base path
    if (window.location.protocol === 'file:') {
        return '';
    }
    
    // Per GitHub Pages, cerca il pattern /gfv-platform/ o simile
    const pathname = window.location.pathname;
    
    // Cerca pattern come /gfv-platform/ o /repository-name/
    // Il base path è tutto ciò che precede /core/, /modules/, ecc.
    const coreIndex = pathname.indexOf('/core/');
    const modulesIndex = pathname.indexOf('/modules/');
    
    if (coreIndex !== -1) {
        return pathname.substring(0, coreIndex);
    }
    
    if (modulesIndex !== -1) {
        return pathname.substring(0, modulesIndex);
    }
    
    // Se non troviamo pattern noti, assumiamo root
    return '/';
}

/**
 * Risolve un percorso relativo in un percorso assoluto corretto
 * @param {string} relativePath - Percorso relativo (es: './firebase-service.js' o '../services/firebase-service.js')
 * @param {string} currentPath - Percorso del file corrente (opzionale, auto-detect se non fornito)
 * @returns {string} Percorso assoluto risolto
 * 
 * @example
 * resolvePath('./firebase-service.js') // '/gfv-platform/core/services/firebase-service.js' su GitHub Pages
 * resolvePath('../../../core/services/firebase-service.js') // '/gfv-platform/core/services/firebase-service.js'
 */
export function resolvePath(relativePath, currentPath = null) {
    if (typeof window === 'undefined') {
        return relativePath;
    }
    
    // Se il percorso inizia con http:// o https://, è già assoluto
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
        return relativePath;
    }
    
    // Se il percorso inizia con /, è già assoluto dalla root del sito
    // Ma dobbiamo aggiungere il base path se siamo su GitHub Pages
    if (relativePath.startsWith('/')) {
        const basePath = getBasePath();
        // Rimuovi il leading slash e aggiungi base path
        const pathWithoutSlash = relativePath.substring(1);
        return basePath + '/' + pathWithoutSlash;
    }
    
    // Per percorsi relativi, dobbiamo risolverli rispetto al file corrente
    const basePath = getBasePath();
    
    // Se non abbiamo il percorso corrente, prova a dedurlo dall'URL
    if (!currentPath) {
        currentPath = window.location.pathname;
    }
    
    // Rimuovi il base path dal current path per ottenere il percorso relativo
    let relativeCurrentPath = currentPath;
    if (basePath && currentPath.startsWith(basePath)) {
        relativeCurrentPath = currentPath.substring(basePath.length);
    }
    
    // Normalizza il percorso corrente (rimuovi il nome del file se presente)
    const lastSlash = relativeCurrentPath.lastIndexOf('/');
    if (lastSlash !== -1) {
        relativeCurrentPath = relativeCurrentPath.substring(0, lastSlash + 1);
    } else {
        relativeCurrentPath = '/';
    }
    
    // Risolvi il percorso relativo
    const parts = relativeCurrentPath.split('/').filter(p => p);
    const relativeParts = relativePath.split('/').filter(p => p && p !== '.');
    
    // Gestisci .. (parent directory)
    for (const part of relativeParts) {
        if (part === '..') {
            if (parts.length > 0) {
                parts.pop();
            }
        } else {
            parts.push(part);
        }
    }
    
    // Costruisci il percorso finale
    const resolvedPath = '/' + parts.join('/');
    return basePath + resolvedPath;
}

/**
 * Risolve un percorso relativo per un import ES6
 * Questa funzione gestisce correttamente i percorsi per import() dinamici
 * Usa import.meta.url quando disponibile per risolvere i percorsi rispetto al file corrente
 * 
 * IMPORTANTE: Quando usato in script inline in HTML, passa l'URL del documento corrente
 * come currentModuleUrl per risolvere correttamente i percorsi.
 * 
 * @param {string} relativePath - Percorso relativo
 * @param {string} currentModuleUrl - URL del modulo corrente (da import.meta.url o window.location.href)
 * @returns {string} Percorso risolto per l'import
 */
export function resolveImportPath(relativePath, currentModuleUrl = null) {
    // Se il percorso inizia con http:// o https://, è già assoluto
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
        return relativePath;
    }
    
    // Se abbiamo import.meta.url, usalo per risolvere il percorso rispetto al file corrente
    if (currentModuleUrl) {
        try {
            const baseUrl = new URL(currentModuleUrl);
            const resolvedUrl = new URL(relativePath, baseUrl);
            return resolvedUrl.href;
        } catch (e) {
            console.warn('Errore risoluzione percorso con URL base:', e);
        }
    }
    
    // Se siamo in un browser, prova a usare window.location
    if (typeof window !== 'undefined') {
        // Se il percorso inizia con /, dobbiamo aggiungere il base path
        if (relativePath.startsWith('/')) {
            const basePath = getBasePath();
            // Rimuovi il leading slash
            const pathWithoutSlash = relativePath.substring(1);
            // Aggiungi base path
            if (basePath === '/' || basePath === '') {
                return '/' + pathWithoutSlash;
            }
            // Assicurati che basePath finisca con / e pathWithoutSlash non inizi con /
            const normalizedBasePath = basePath.endsWith('/') ? basePath : basePath + '/';
            return normalizedBasePath + pathWithoutSlash;
        }
        
        // Per percorsi relativi, risolvili usando l'URL del documento corrente
        const basePath = getBasePath();
        try {
            // Usa l'URL del documento corrente come base
            const currentUrl = new URL(window.location.href);
            // Estrai il percorso del documento
            const docPath = currentUrl.pathname;
            // Trova la directory del documento
            const lastSlash = docPath.lastIndexOf('/');
            const docDir = lastSlash !== -1 ? docPath.substring(0, lastSlash + 1) : '/';
            // Risolvi il percorso relativo
            const resolvedUrl = new URL(relativePath, currentUrl.origin + docDir);
            // Estrai il pathname
            let resolvedPath = resolvedUrl.pathname;
            
            // Se il pathname inizia con basePath, è già corretto
            if (basePath && basePath !== '/' && resolvedPath.startsWith(basePath)) {
                return resolvedPath;
            }
            
            // Se basePath è diverso da /, potrebbe essere necessario aggiungerlo
            // Ma solo se il percorso risolto non inizia già con esso
            if (basePath && basePath !== '/' && !resolvedPath.startsWith(basePath)) {
                // Rimuovi il leading slash se presente
                const pathWithoutSlash = resolvedPath.startsWith('/') ? resolvedPath.substring(1) : resolvedPath;
                const normalizedBasePath = basePath.endsWith('/') ? basePath : basePath + '/';
                return normalizedBasePath + pathWithoutSlash;
            }
            
            return resolvedPath;
        } catch (e) {
            // Se fallisce, usa il percorso relativo originale
            console.warn('Impossibile risolvere percorso import:', relativePath, e);
        }
    }
    
    // Fallback: usa il percorso relativo originale
    return relativePath;
}

/**
 * Helper per import dinamico che risolve correttamente i percorsi
 * @param {string} relativePath - Percorso relativo del modulo da importare
 * @returns {Promise<Module>} Modulo importato
 * 
 * @example
 * const module = await dynamicImport('./firebase-service.js');
 */
export async function dynamicImport(relativePath) {
    const resolvedPath = resolveImportPath(relativePath);
    return import(resolvedPath);
}

export default {
    getBasePath,
    resolvePath,
    resolveImportPath,
    dynamicImport
};
