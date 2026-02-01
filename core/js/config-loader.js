/**
 * Config Loader - Carica configurazioni Firebase e Google Maps
 * Gestisce fallback per GitHub Pages
 */

// Namespace per evitare conflitti
window.GFVConfigLoader = window.GFVConfigLoader || {};

/** Base path per pagine sotto modules/ (es. '../../../core'). Le pagine core lasciano vuoto. */
function getConfigBase() {
    const base = (window.GFV_CONFIG_BASE || '').replace(/\/$/, '');
    return base;
}

window.GFVConfigLoader.loadConfig = async function loadConfig() {
    return new Promise((resolve, reject) => {
        if (typeof window.firebaseConfig !== 'undefined') {
            resolve();
            return;
        }
        try {
            const cached = sessionStorage.getItem('gfv_firebase_config');
            if (cached) {
                const parsed = JSON.parse(cached);
                window.firebaseConfig = parsed;
                resolve();
                return;
            }
        } catch (_) {}

        const base = getConfigBase();
        const configScript = document.createElement('script');
        configScript.src = base ? base + '/config/firebase-config.js' : 'config/firebase-config.js';
        configScript.onload = function() {
            // Nessun setTimeout: lo script è già eseguito al onload
            if (typeof window.firebaseConfig !== 'undefined') {
                try { sessionStorage.setItem('gfv_firebase_config', JSON.stringify(window.firebaseConfig)); } catch (_) {}
                resolve();
            } else {
                loadFallbackConfig().then(resolve).catch(reject);
            }
        };
        configScript.onerror = function() {
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
            if (typeof window.firebaseConfig !== 'undefined') {
                try { sessionStorage.setItem('gfv_firebase_config', JSON.stringify(window.firebaseConfig)); } catch (_) {}
                resolve();
            } else {
                reject(new Error('Firebase config not found even after loading from GitHub'));
            }
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
        try {
            const cached = sessionStorage.getItem('gfv_google_maps_key');
            if (cached) {
                window.GOOGLE_MAPS_API_KEY = cached;
                resolve();
                return;
            }
        } catch (_) {}

        const base = getConfigBase();
        const mapsConfigScript = document.createElement('script');
        mapsConfigScript.src = base ? base + '/config/google-maps-config.js' : 'config/google-maps-config.js';
        mapsConfigScript.onload = function() {
            if (typeof window.GOOGLE_MAPS_API_KEY !== 'undefined') {
                try { sessionStorage.setItem('gfv_google_maps_key', window.GOOGLE_MAPS_API_KEY); } catch (_) {}
                resolve();
            } else {
                loadGoogleMapsConfigFallback().then(resolve).catch(reject);
            }
        };
        mapsConfigScript.onerror = function() {
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
            if (typeof window.GOOGLE_MAPS_API_KEY !== 'undefined') {
                try { sessionStorage.setItem('gfv_google_maps_key', window.GOOGLE_MAPS_API_KEY); } catch (_) {}
            }
            resolve();
        };
        fallback.onerror = function() {
            console.warn('Failed to load Google Maps config');
            resolve();
        };
        document.head.appendChild(fallback);
    });
}

/** Carica Firebase e Google Maps config in parallelo (più veloce quando servono entrambi). */
window.GFVConfigLoader.loadConfigAndMaps = function loadConfigAndMaps() {
    return Promise.all([
        window.GFVConfigLoader.loadConfig(),
        window.GFVConfigLoader.loadGoogleMapsConfig()
    ]);
};

window.GFVConfigLoader.waitForConfig = function waitForConfig() {
    return new Promise((resolve, reject) => {
        if (typeof window.firebaseConfig !== 'undefined') {
            resolve(window.firebaseConfig);
            return;
        }
        let attempts = 0;
        const maxAttempts = 100; // 5 secondi (100 * 50ms)
        const checkInterval = setInterval(() => {
            attempts++;
            if (typeof window.firebaseConfig !== 'undefined') {
                clearInterval(checkInterval);
                resolve(window.firebaseConfig);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                reject(new Error('Firebase config not loaded after 5 seconds'));
            }
        }, 50);
    });
}

window.GFVConfigLoader.waitForGoogleMapsConfig = async function waitForGoogleMapsConfig() {
    return new Promise((resolve) => {
        if (typeof window.GOOGLE_MAPS_API_KEY !== 'undefined') {
            resolve();
            return;
        }
        let attempts = 0;
        const maxAttempts = 100;
        const checkInterval = setInterval(() => {
            attempts++;
            if (typeof window.GOOGLE_MAPS_API_KEY !== 'undefined') {
                clearInterval(checkInterval);
                resolve();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.warn('Google Maps config non trovato dopo attesa');
                resolve();
            }
        }, 50);
    });
}

window.GFVConfigLoader.loadGoogleMapsAPI = function loadGoogleMapsAPI() {
    return new Promise((resolve) => {
        if (typeof google !== 'undefined' && google.maps) {
            resolve();
            return;
        }

        let attempts = 0;
        const maxAttempts = 100; // 100 x 50ms = 5 secondi
        const checkConfig = setInterval(() => {
            attempts++;
            const GOOGLE_MAPS_API_KEY = window.GOOGLE_MAPS_API_KEY;
            if (GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
                clearInterval(checkConfig);

                // Config trovato, procedi con il caricamento
                loadGoogleMapsAPIImplementation(GOOGLE_MAPS_API_KEY).then(resolve);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkConfig);
                console.warn('⚠️ Google Maps API key not configured after waiting', attempts, 'attempts');
                resolve();
            }
        }, 50);
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

