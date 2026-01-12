/**
 * Config Loader - Carica configurazioni Firebase e Google Maps
 * Gestisce fallback per GitHub Pages
 */

// Namespace per evitare conflitti
window.GFVConfigLoader = window.GFVConfigLoader || {};

window.GFVConfigLoader.loadConfig = async function loadConfig() {
    return new Promise((resolve, reject) => {
        // Se già caricato, risolvi immediatamente
        if (typeof window.firebaseConfig !== 'undefined') {
            resolve();
            return;
        }

        // Prova prima il percorso locale
        const configScript = document.createElement('script');
        configScript.src = 'config/firebase-config.js';
        
        configScript.onload = function() {
            // Aspetta un po' per assicurarsi che lo script sia eseguito
            setTimeout(() => {
                if (typeof window.firebaseConfig !== 'undefined') {
                    resolve();
                } else {
                    // Se non è stato definito, prova il fallback
                    loadFallbackConfig().then(resolve).catch(reject);
                }
            }, 100);
        };
        
        configScript.onerror = function() {
            // Se fallisce, prova il fallback
            loadFallbackConfig().then(resolve).catch(reject);
        };
        
        document.head.appendChild(configScript);
    });
}

function loadFallbackConfig() {
    return new Promise((resolve, reject) => {
        const fallbackScript = document.createElement('script');
        fallbackScript.src = 'https://raw.githubusercontent.com/VitaraDragon/gfv-platform/main/core/config/firebase-config.js';
        
        fallbackScript.onload = function() {
            setTimeout(() => {
                if (typeof window.firebaseConfig !== 'undefined') {
                    resolve();
                } else {
                    reject(new Error('Firebase config not found even after loading from GitHub'));
                }
            }, 100);
        };
        
        fallbackScript.onerror = function() {
            reject(new Error('Failed to load Firebase config from GitHub'));
        };
        
        document.head.appendChild(fallbackScript);
    });
}

window.GFVConfigLoader.loadGoogleMapsConfig = async function loadGoogleMapsConfig() {
    return new Promise((resolve, reject) => {
        if (typeof window.GOOGLE_MAPS_API_KEY !== 'undefined') {
            resolve();
            return;
        }

        // Prova prima il percorso locale (stesso percorso di Firebase config)
        const mapsConfigScript = document.createElement('script');
        mapsConfigScript.src = 'config/google-maps-config.js';
        
        mapsConfigScript.onload = function() {
            setTimeout(() => {
                if (typeof window.GOOGLE_MAPS_API_KEY !== 'undefined') {
                    resolve();
                } else {
                    // Se non è stato definito, prova il fallback
                    loadGoogleMapsConfigFallback().then(resolve).catch(reject);
                }
            }, 100);
        };
        
        mapsConfigScript.onerror = function() {
            // Se fallisce, prova il fallback
            loadGoogleMapsConfigFallback().then(resolve).catch(reject);
        };
        
        document.head.appendChild(mapsConfigScript);
    });
}

function loadGoogleMapsConfigFallback() {
    return new Promise((resolve, reject) => {
        const fallback = document.createElement('script');
        fallback.src = 'https://raw.githubusercontent.com/VitaraDragon/gfv-platform/main/core/config/google-maps-config.js';
        
        fallback.onload = function() {
            setTimeout(() => {
                if (typeof window.GOOGLE_MAPS_API_KEY !== 'undefined') {
                    resolve();
                } else {
                    console.warn('Google Maps API key not found');
                    resolve(); // Non bloccare il caricamento
                }
            }, 100);
        };
        
        fallback.onerror = function() {
            console.warn('Failed to load Google Maps config');
            resolve(); // Non bloccare il caricamento
        };
        
        document.head.appendChild(fallback);
    });
}

window.GFVConfigLoader.waitForConfig = function waitForConfig() {
    return new Promise((resolve, reject) => {
        if (typeof window.firebaseConfig !== 'undefined') {
            resolve(window.firebaseConfig);
            return;
        }
        
        // Aspetta fino a 5 secondi che il config sia caricato
        let attempts = 0;
        const maxAttempts = 50; // 5 secondi (50 * 100ms)
        
        const checkInterval = setInterval(() => {
            attempts++;
            if (typeof window.firebaseConfig !== 'undefined') {
                clearInterval(checkInterval);
                resolve(window.firebaseConfig);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                reject(new Error('Firebase config not loaded after 5 seconds'));
            }
        }, 100);
    });
}

window.GFVConfigLoader.waitForGoogleMapsConfig = async function waitForGoogleMapsConfig() {
    return new Promise((resolve) => {
        if (typeof window.GOOGLE_MAPS_API_KEY !== 'undefined') {
            resolve();
            return;
        }
        
        // Aspetta fino a 5 secondi
        let attempts = 0;
        const maxAttempts = 50;
        const checkInterval = setInterval(() => {
            attempts++;
            if (typeof window.GOOGLE_MAPS_API_KEY !== 'undefined') {
                clearInterval(checkInterval);
                resolve();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.warn('Google Maps config non trovato dopo attesa');
                resolve(); // Non bloccare
            }
        }, 100);
    });
}

window.GFVConfigLoader.loadGoogleMapsAPI = function loadGoogleMapsAPI() {
    return new Promise((resolve) => {
        if (typeof google !== 'undefined' && google.maps) {
            resolve();
            return;
        }

        // Aspetta che il config sia caricato (max 5 secondi)
        let attempts = 0;
        const maxAttempts = 50; // 50 tentativi x 100ms = 5 secondi
        const checkConfig = setInterval(() => {
            attempts++;
            const GOOGLE_MAPS_API_KEY = window.GOOGLE_MAPS_API_KEY;
            
            if (attempts === 1) {

            }
            
            if (GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
                clearInterval(checkConfig);

                // Config trovato, procedi con il caricamento
                loadGoogleMapsAPIImplementation(GOOGLE_MAPS_API_KEY).then(resolve);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkConfig);
                console.warn('⚠️ Google Maps API key not configured after waiting', attempts, 'attempts');
                console.warn('Chiave disponibile?', typeof window.GOOGLE_MAPS_API_KEY !== 'undefined' ? window.GOOGLE_MAPS_API_KEY : 'undefined');
                resolve(); // Non bloccare il caricamento
            }
        }, 100);
    });
}

function loadGoogleMapsAPIImplementation(GOOGLE_MAPS_API_KEY) {
    return new Promise((resolve) => {
        if (typeof google !== 'undefined' && google.maps) {
            resolve();
            return;
        }

        // Verifica se lo script è già stato aggiunto
        if (document.querySelector('script[src*="maps.googleapis.com"]')) {
            // Aspetta che Google Maps sia caricato
            const checkInterval = setInterval(() => {
                if (typeof google !== 'undefined' && google.maps) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
            }, 5000);
            return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry&loading=async`;
        script.async = true;
        script.defer = true;
        
        script.onload = function() {
            resolve();
        };
        
        script.onerror = function() {
            console.warn('Failed to load Google Maps API');
            resolve(); // Non bloccare il caricamento
        };
        
        document.head.appendChild(script);
    });
}

