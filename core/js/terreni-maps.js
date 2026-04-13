/**
 * Terreni Maps - Logica Google Maps per gestione terreni
 * 
 * @module core/js/terreni-maps
 */

// ============================================
// IMPORTS
// ============================================
import { getColturaColor, showAlert } from './terreni-utils.js';

/** Overlay ultima posizione GPS (non persistito in Firestore) */
let userLocationMarker = null;
let userLocationAccuracyCircle = null;

const GEOLOCATION_OPTIONS = {
    enableHighAccuracy: true,
    timeout: 25000,
    maximumAge: 0
};

// ============================================
// STATE MANAGEMENT
// ============================================
// Le variabili globali (map, polygon, isDrawing, currentPolygonCoords) 
// verranno gestite tramite un state object o variabili globali nel file HTML principale

// ============================================
// GEOLOCALIZZAZIONE
// ============================================

/**
 * Richiede posizione corrente (Promise).
 * @returns {Promise<{ lat: number, lng: number, accuracyMeters: number|null }>}
 */
function getCurrentPositionGeo() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('GEO_NOT_SUPPORTED'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                resolve({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracyMeters: typeof pos.coords.accuracy === 'number' && !Number.isNaN(pos.coords.accuracy)
                        ? pos.coords.accuracy
                        : null
                });
            },
            (err) => reject(err),
            GEOLOCATION_OPTIONS
        );
    });
}

function clearUserLocationOverlays() {
    if (userLocationMarker) {
        userLocationMarker.setMap(null);
        userLocationMarker = null;
    }
    if (userLocationAccuracyCircle) {
        userLocationAccuracyCircle.setMap(null);
        userLocationAccuracyCircle = null;
    }
}

/**
 * Aggiunge un vertice al poligono (stesso comportamento di un click sulla mappa).
 */
function appendVertexFromLatLng(map, latLng, getState, updateState) {
    const currentState = getState();
    if (!currentState.isDrawing) {
        return false;
    }
    if (!currentState.polygon) {
        const colors = getColturaColor();
        const polygon = new google.maps.Polygon({
            paths: [latLng],
            fillColor: colors.fill + '80',
            fillOpacity: 0.35,
            strokeColor: colors.stroke,
            strokeWeight: 3,
            strokeOpacity: 1.0,
            clickable: false,
            editable: true,
            draggable: true
        });
        polygon.setMap(map);
        const currentPolygonCoords = [latLng];
        updateState({ polygon, currentPolygonCoords });
    } else {
        const path = currentState.polygon.getPath();
        path.push(latLng);
        const currentPolygonCoords = path.getArray();
        updateState({ currentPolygonCoords });
    }
    setTimeout(() => {
        const updatedState = getState();
        if (updatedState.currentPolygonCoords && updatedState.currentPolygonCoords.length >= 3) {
            const mapInfo = document.getElementById('map-info');
            if (mapInfo) mapInfo.classList.add('active');
            updateAreaInfo(updatedState);
        }
    }, 0);
    return true;
}

/**
 * Centra la mappa sulla posizione GPS corrente e mostra indicatore + cerchio di incertezza (approssimativo).
 * @param {Object} state - { map }
 */
export async function centerMapOnMyLocation(state) {
    if (!state.map || !google || !google.maps) {
        showAlert('Mappa non disponibile.', 'warning');
        return;
    }
    try {
        const { lat, lng, accuracyMeters } = await getCurrentPositionGeo();
        const pos = new google.maps.LatLng(lat, lng);
        clearUserLocationOverlays();
        state.map.setCenter(pos);
        state.map.setZoom(18);

        userLocationMarker = new google.maps.Marker({
            map: state.map,
            position: pos,
            title: 'La tua posizione (approssimativa)'
        });

        if (accuracyMeters != null && accuracyMeters > 0 && accuracyMeters < 5000) {
            userLocationAccuracyCircle = new google.maps.Circle({
                map: state.map,
                center: pos,
                radius: accuracyMeters,
                strokeColor: '#1a73e8',
                strokeOpacity: 0.55,
                strokeWeight: 1,
                fillColor: '#1a73e8',
                fillOpacity: 0.08,
                clickable: false
            });
        }

        const accText = accuracyMeters != null && accuracyMeters > 0
            ? ` Precisione stimata dal dispositivo: circa ±${Math.round(accuracyMeters)} m (non è un confine certificato).`
            : ' La precisione dipende dal dispositivo e dal contesto (boschi, edifici, meteo).';
        showAlert(
            'Posizione aggiornata.' + accText + ' Allinea sempre i vertici del poligono a ciò che vedi in satellite.',
            'success'
        );
    } catch (err) {
        if (err && err.code === 1) {
            showAlert('Posizione negata: abilita i permessi di localizzazione per il sito nelle impostazioni del browser.', 'error');
        } else if (err && err.code === 2) {
            showAlert('Posizione non disponibile al momento. Riprova all\'aperto o verifica il GPS.', 'warning');
        } else if (err && err.code === 3) {
            showAlert('Timeout lettura posizione. Riprova.', 'warning');
        } else if (err && err.message === 'GEO_NOT_SUPPORTED') {
            showAlert('Il browser non supporta la geolocalizzazione.', 'error');
        } else {
            showAlert('Impossibile ottenere la posizione. Riprova.', 'error');
        }
    }
}

/**
 * Aggiunge un vertice del poligono usando la posizione GPS attuale (in campo, camminando il perimetro).
 * @param {Object} state
 * @param {Function} updateState
 * @param {Function} getState
 */
export async function addGpsVertexToPolygon(state, updateState, getState = () => state) {
    if (!state.map || !google || !google.maps) {
        showAlert('Mappa non disponibile.', 'warning');
        return;
    }
    const currentState = getState();
    if (!currentState.isDrawing) {
        showAlert('Attiva prima «Traccia Confini», poi aggiungi i punti da GPS o toccando la mappa.', 'warning');
        return;
    }
    try {
        const { lat, lng, accuracyMeters } = await getCurrentPositionGeo();
        const latLng = new google.maps.LatLng(lat, lng);
        appendVertexFromLatLng(state.map, latLng, getState, updateState);
        const accText = accuracyMeters != null && accuracyMeters > 0
            ? ` (± circa ${Math.round(accuracyMeters)} m)`
            : '';
        showAlert('Vertice aggiunto dalla posizione GPS' + accText + '. Verifica e regola i vertici sulla mappa se serve.', 'success');
    } catch (err) {
        if (err && err.code === 1) {
            showAlert('Posizione negata: abilita i permessi di localizzazione.', 'error');
        } else if (err && err.code === 3) {
            showAlert('Timeout lettura posizione. Riprova.', 'warning');
        } else if (err && err.message === 'GEO_NOT_SUPPORTED') {
            showAlert('Geolocalizzazione non supportata da questo browser.', 'error');
        } else {
            showAlert('Impossibile leggere la posizione. Riprova all\'aperto.', 'error');
        }
    }
}

// ============================================
// FUNZIONI PRINCIPALI
// ============================================

/**
 * Inizializza Google Maps nel container
 * @param {Object} state - State object con { map, polygon, isDrawing, currentPolygonCoords }
 * @param {Function} updateState - Funzione per aggiornare lo state
 * @param {Function} getState - Funzione per leggere lo state corrente (opzionale, default: () => state)
 */
export function initMap(state, updateState, getState = () => state) {
    if (!window.googleMapsReady || !google || !google.maps) {
        const mapElement = document.getElementById('map');
        if (mapElement) {
            mapElement.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f8f9fa; border-radius: 8px; flex-direction: column; padding: 20px;">
                    <h3 style="color: #dc3545; margin-bottom: 15px;">⚠️ Google Maps non disponibile</h3>
                    <p style="color: #666; text-align: center;">
                        Per utilizzare la mappa e il calcolo automatico della superficie,<br>
                        è necessario configurare una chiave API di Google Maps valida.
                    </p>
                </div>
            `;
        }
        return;
    }
    
    if (state.map) {
        return; // Già inizializzata
    }
    
    try {
        const defaultCenter = { lat: 44.4949, lng: 11.3426 }; // Bologna area
        
        const map = new google.maps.Map(document.getElementById('map'), {
            zoom: 15,
            center: defaultCenter,
            mapTypeId: google.maps.MapTypeId.SATELLITE
        });

        // Aggiorna state
        updateState({ map });

        // Click listener per tracciamento poligono
        // IMPORTANTE: usa getState() per leggere sempre lo state corrente invece della closure
        map.addListener('click', function(event) {
            appendVertexFromLatLng(map, event.latLng, getState, updateState);
        });

        // Listener per modifiche poligono
        map.addListener('polygon_changed', function() {
            const currentState = getState();
            if (currentState.polygon) {
                const currentPolygonCoords = currentState.polygon.getPath().getArray();
                updateState({ currentPolygonCoords });
                if (currentPolygonCoords.length >= 3) {
                    updateAreaInfo(currentState);
                }
            }
        });
    } catch (error) {
        console.error('Errore inizializzazione mappa:', error);
    }
}

/**
 * Cerca indirizzo e centra mappa
 * @param {Object} state - State object con { map }
 */
export function searchLocation(state) {
    if (!state.map || !google || !google.maps) return;
    
    const geocoder = new google.maps.Geocoder();
    const addressInput = document.getElementById('map-search');
    const address = addressInput ? addressInput.value : '';

    if (!address) {
        showAlert('Inserisci un indirizzo da cercare', 'warning');
        return;
    }

    geocoder.geocode({ address: address }, function(results, status) {
        if (status === 'OK') {
            state.map.setCenter(results[0].geometry.location);
            state.map.setZoom(18);
            
            new google.maps.Marker({
                map: state.map,
                position: results[0].geometry.location,
                title: address
            });
        } else {
            showAlert('Indirizzo non trovato: ' + status, 'error');
        }
    });
}

/**
 * Attiva/disattiva modalità tracciamento poligono
 * @param {Object} state - State object con { map, polygon, isDrawing, currentPolygonCoords }
 * @param {Function} updateState - Funzione per aggiornare lo state
 */
export function toggleDrawing(state, updateState) {
    if (!state.map) {
        return;
    }
    
    const isDrawing = !state.isDrawing;
    const btn = document.getElementById('btn-draw');
    const mapElement = document.getElementById('map');
    
    if (isDrawing) {
        if (btn) {
            btn.textContent = '⏹️ Stop Tracciamento';
            btn.className = 'btn btn-danger';
        }
        if (mapElement) mapElement.style.cursor = 'crosshair';
        if (state.polygon) {
            state.polygon.setMap(null);
            updateState({ polygon: null, currentPolygonCoords: [] });
            const mapInfo = document.getElementById('map-info');
            if (mapInfo) mapInfo.classList.remove('active');
        }
    } else {
        if (btn) {
            btn.textContent = '✏️ Traccia Confini';
            btn.className = 'btn btn-success';
        }
        if (mapElement) mapElement.style.cursor = 'default';
    }
    
    updateState({ isDrawing });
}

/**
 * Cancella poligono tracciato
 * @param {Object} state - State object con { polygon, currentPolygonCoords }
 * @param {Function} updateState - Funzione per aggiornare lo state
 */
export function clearPolygon(state, updateState) {
    if (state.polygon) {
        state.polygon.setMap(null);
        updateState({ polygon: null, currentPolygonCoords: [] });
        const mapInfo = document.getElementById('map-info');
        if (mapInfo) mapInfo.classList.remove('active');
        const superficieInput = document.getElementById('terreno-superficie');
        if (superficieInput) superficieInput.value = '';
    }
}

/**
 * Calcola e aggiorna info superficie da poligono
 * @param {Object} state - State object con { polygon, currentPolygonCoords }
 */
export function updateAreaInfo(state) {
    if (!state.polygon || !google || !google.maps || !state.currentPolygonCoords) return;
    
    const area = google.maps.geometry.spherical.computeArea(state.currentPolygonCoords);
    const areaHectares = area / 10000;
    
    const calculatedAreaElement = document.getElementById('calculated-area');
    if (calculatedAreaElement) {
        calculatedAreaElement.textContent = areaHectares.toFixed(2);
    }
    
    // Aggiorna SEMPRE il campo superficie con il valore calcolato dalla mappa
    if (areaHectares > 0) {
        const superficieInput = document.getElementById('terreno-superficie');
        if (superficieInput) {
            superficieInput.value = areaHectares.toFixed(2);
        }
        const manualAreaElement = document.getElementById('manual-area');
        if (manualAreaElement) {
            manualAreaElement.textContent = areaHectares.toFixed(2);
        }
    }
}

/**
 * Carica poligono esistente sulla mappa
 * @param {Array} polygonCoords - Coordinate poligono
 * @param {Object} state - State object con { map, polygon, currentPolygonCoords }
 * @param {Function} updateState - Funzione per aggiornare lo state
 */
export function loadExistingPolygon(polygonCoords, state, updateState) {
    if (!state.map || !google || !google.maps) return;
    
    if (!polygonCoords || polygonCoords.length === 0) return;
    
    clearPolygon(state, updateState);
    
    // Converti coordinate in LatLng se necessario
    const coords = polygonCoords.map(coord => {
        if (coord.lat && coord.lng) {
            return new google.maps.LatLng(coord.lat, coord.lng);
        }
        return coord;
    });
    
    const colors = getColturaColor();
    const polygon = new google.maps.Polygon({
        paths: coords,
        fillColor: colors.fill + '80', // Aggiungi trasparenza
        fillOpacity: 0.35,
        strokeColor: colors.stroke,    // Usa versione scura per perimetro
        strokeWeight: 3,               // Aumentato per maggiore visibilità
        strokeOpacity: 1.0,            // Massima visibilità
        editable: true,
        draggable: true
    });
    
    polygon.setMap(state.map);
    const currentPolygonCoords = polygon.getPath().getArray();
    
    // Aggiorna state
    updateState({ polygon, currentPolygonCoords });
    
    // Listener per modifiche
    google.maps.event.addListener(polygon.getPath(), 'set_at', function() {
        const currentPolygonCoords = polygon.getPath().getArray();
        updateState({ currentPolygonCoords });
        if (currentPolygonCoords.length >= 3) {
            updateAreaInfo({ ...state, polygon, currentPolygonCoords });
        }
    });

    google.maps.event.addListener(polygon.getPath(), 'insert_at', function() {
        const currentPolygonCoords = polygon.getPath().getArray();
        updateState({ currentPolygonCoords });
        if (currentPolygonCoords.length >= 3) {
            updateAreaInfo({ ...state, polygon, currentPolygonCoords });
        }
    });

    google.maps.event.addListener(polygon.getPath(), 'remove_at', function() {
        const currentPolygonCoords = polygon.getPath().getArray();
        updateState({ currentPolygonCoords });
        if (currentPolygonCoords.length >= 3) {
            updateAreaInfo({ ...state, polygon, currentPolygonCoords });
        }
    });

    // Fit bounds automatico
    const bounds = new google.maps.LatLngBounds();
    coords.forEach(coord => bounds.extend(coord));
    state.map.fitBounds(bounds);
    
    // Aggiorna area info
    if (currentPolygonCoords.length >= 3) {
        const mapInfo = document.getElementById('map-info');
        if (mapInfo) mapInfo.classList.add('active');
        updateAreaInfo({ ...state, polygon, currentPolygonCoords });
    }
}

// ============================================
// FUNZIONI HELPER PER ACCESSO STATE
// ============================================

/**
 * Ottiene istanza mappa corrente
 * @param {Object} state - State object
 * @returns {Object|null} Istanza Google Map
 */
export function getMapInstance(state) {
    return state.map || null;
}

/**
 * Ottiene istanza poligono corrente
 * @param {Object} state - State object
 * @returns {Object|null} Istanza Google Maps Polygon
 */
export function getPolygonInstance(state) {
    return state.polygon || null;
}

/**
 * Ottiene coordinate poligono corrente
 * @param {Object} state - State object
 * @returns {Array} Array coordinate poligono
 */
export function getCurrentPolygonCoords(state) {
    return state.currentPolygonCoords || [];
}



