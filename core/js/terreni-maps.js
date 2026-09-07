/**
 * Terreni Maps - Logica Google Maps per gestione terreni
 * 
 * @module core/js/terreni-maps
 */

// ============================================
// IMPORTS
// ============================================
import { getColturaColor, showAlert } from './terreni-utils.js';
import { getCurrentPositionGeo } from './geo-capture.js';
import {
  resolveDrawTap,
  neighborRingsFromTerreni,
  snapToNeighborRings,
  DOUBLE_TAP_M
} from './terreni-draw-helpers.js';
import { toLatLngPoint, haversineMeters } from './zona-lavorata-slice.js';

/** Overlay ultima posizione GPS (non persistito in Firestore) */
let userLocationMarker = null;
let userLocationAccuracyCircle = null;

/** Sessioni disegno 1b (non persistite) */
let lastTapAt = null;
let lastTapPoint = null;
let neighborOverlays = [];
let startVertexMarker = null;
let snappingPath = false;
const pathListenerBound = new WeakSet();
let snapHintShown = false;

// ============================================
// STATE MANAGEMENT
// ============================================
// Le variabili globali (map, polygon, isDrawing, currentPolygonCoords) 
// verranno gestite tramite un state object o variabili globali nel file HTML principale

// ============================================
// GEOLOCALIZZAZIONE (lettura GPS da geo-capture.js)
// ============================================

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

function neighborRingsForState(state) {
    return neighborRingsFromTerreni(state && state.terreni, state && state.currentTerrenoId);
}

function toGoogleLatLng(point) {
    const p = toLatLngPoint(point);
    if (!p) return null;
    return new google.maps.LatLng(p.lat, p.lng);
}

function rememberTap(point) {
    lastTapAt = Date.now();
    lastTapPoint = toLatLngPoint(point);
}

function resetDrawGesture() {
    lastTapAt = null;
    lastTapPoint = null;
}

/** Pulisce overlay di sessione (chiusura modal). */
export function resetDrawSession() {
    clearNeighborOverlays();
    clearStartVertexMarker();
    resetDrawGesture();
    snapHintShown = false;
}

function clearStartVertexMarker() {
    if (startVertexMarker) {
        startVertexMarker.setMap(null);
        startVertexMarker = null;
    }
}

function clearNeighborOverlays() {
    neighborOverlays.forEach((poly) => {
        if (poly) poly.setMap(null);
    });
    neighborOverlays = [];
}

function syncNeighborOverlays(map, state) {
    clearNeighborOverlays();
    if (!map || !google || !google.maps) return;
    const rings = neighborRingsForState(state);
    rings.forEach((ring) => {
        const poly = new google.maps.Polygon({
            paths: ring.map((p) => new google.maps.LatLng(p.lat, p.lng)),
            fillColor: '#ffffff',
            fillOpacity: 0.08,
            strokeColor: '#f8f8f8',
            strokeWeight: 2,
            strokeOpacity: 0.85,
            clickable: false,
            editable: false,
            draggable: false,
            zIndex: 1
        });
        poly.setMap(map);
        neighborOverlays.push(poly);
    });
}

function syncStartVertexMarker(map, coords, isDrawing) {
    clearStartVertexMarker();
    if (!isDrawing || !map || !coords || coords.length < 1) return;
    const first = toLatLngPoint(coords[0]);
    if (!first) return;
    startVertexMarker = new google.maps.Marker({
        map,
        position: first,
        clickable: false,
        zIndex: 4,
        title: 'Primo punto — tocca qui per chiudere',
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: '#ffffff',
            fillOpacity: 1,
            strokeColor: '#2E8B57',
            strokeWeight: 3
        }
    });
}

function refreshAreaFromState(getState, updateState) {
    const updatedState = getState();
    const coords = updatedState.currentPolygonCoords || [];
    if (coords.length >= 3) {
        const mapInfo = document.getElementById('map-info');
        if (mapInfo) mapInfo.classList.add('active');
        updateAreaInfo(updatedState);
    } else {
        const mapInfo = document.getElementById('map-info');
        if (mapInfo) mapInfo.classList.remove('active');
    }
    syncStartVertexMarker(updatedState.map, coords, updatedState.isDrawing);
    updateUndoButton(updatedState);
}

function maybeSnapPathIndex(path, index, getState) {
    if (snappingPath) return;
    const state = getState();
    const rings = neighborRingsForState(state);
    if (!rings.length) return;
    const raw = path.getAt(index);
    const snapped = snapToNeighborRings(raw, rings);
    if (!snapped.snapped) return;
    const current = toLatLngPoint(raw);
    if (current && haversineMeters(current, snapped.point) < 0.35) return;
    snappingPath = true;
    path.setAt(index, toGoogleLatLng(snapped.point));
    snappingPath = false;
    if (!snapHintShown) {
        snapHintShown = true;
        showAlert('Vertice agganciato al campo vicino.', 'success');
    }
}

function bindPolygonPathListeners(polygon, getState, updateState) {
    if (!polygon || pathListenerBound.has(polygon)) return;
    pathListenerBound.add(polygon);
    const path = polygon.getPath();
    const sync = () => {
        const currentPolygonCoords = path.getArray();
        updateState({ currentPolygonCoords });
        refreshAreaFromState(getState, updateState);
    };
    google.maps.event.addListener(path, 'set_at', function (index) {
        maybeSnapPathIndex(path, index, getState);
        sync();
    });
    google.maps.event.addListener(path, 'insert_at', sync);
    google.maps.event.addListener(path, 'remove_at', sync);
}

function applyDrawingUi(state, isDrawing) {
    const btn = document.getElementById('btn-draw');
    const mapElement = document.getElementById('map');
    if (isDrawing) {
        if (btn) {
            btn.textContent = '⏹️ Stop Tracciamento';
            btn.className = 'btn btn-danger';
        }
        if (mapElement) mapElement.style.cursor = 'crosshair';
        if (state.map) state.map.setOptions({ disableDoubleClickZoom: true });
    } else {
        if (btn) {
            btn.textContent = '✏️ Traccia Confini';
            btn.className = 'btn btn-success';
        }
        if (mapElement) mapElement.style.cursor = 'default';
        if (state.map) state.map.setOptions({ disableDoubleClickZoom: false });
    }
    updateUndoButton({ ...state, isDrawing });
}

function updateUndoButton(state) {
    const undoBtn = document.getElementById('btn-undo-vertex');
    if (!undoBtn) return;
    const n = (state.currentPolygonCoords || []).length;
    undoBtn.hidden = !state.isDrawing;
    undoBtn.disabled = !state.isDrawing || n < 1;
}

function stopDrawing(state, updateState, options) {
    if (!state.isDrawing) return;
    applyDrawingUi(state, false);
    updateState({ isDrawing: false });
    resetDrawGesture();
    if (options && options.announce) {
        showAlert('Perimetro chiuso. Trascina i vertici se serve, poi Salva.', 'success');
    }
}

function pushVertex(map, latLng, getState, updateState) {
    const currentState = getState();
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
            draggable: true,
            zIndex: 3
        });
        polygon.setMap(map);
        bindPolygonPathListeners(polygon, getState, updateState);
        updateState({ polygon, currentPolygonCoords: [latLng] });
    } else {
        bindPolygonPathListeners(currentState.polygon, getState, updateState);
        const path = currentState.polygon.getPath();
        path.push(latLng);
        updateState({ currentPolygonCoords: path.getArray() });
    }
    setTimeout(() => refreshAreaFromState(getState, updateState), 0);
}

/**
 * Aggiunge un vertice, oppure chiude il perimetro (vicino al primo / doppio tap).
 */
function appendVertexFromLatLng(map, latLng, getState, updateState) {
    const currentState = getState();
    if (!currentState.isDrawing) {
        return false;
    }
    const decision = resolveDrawTap({
        tap: latLng,
        vertices: currentState.currentPolygonCoords || [],
        now: Date.now(),
        lastTapAt,
        lastTapPoint,
        neighborRings: neighborRingsForState(currentState)
    });
    rememberTap(latLng);

    if (decision.action === 'ignore') {
        return false;
    }
    if (decision.action === 'close') {
        if (decision.dropLastIfNear && currentState.polygon) {
            const path = currentState.polygon.getPath();
            const last = path.getLength() ? path.getAt(path.getLength() - 1) : null;
            const lastPt = toLatLngPoint(last);
            const tapPt = toLatLngPoint(latLng);
            if (lastPt && tapPt && haversineMeters(lastPt, tapPt) <= DOUBLE_TAP_M && path.getLength() > 3) {
                path.pop();
                updateState({ currentPolygonCoords: path.getArray() });
            }
        }
        stopDrawing(getState(), updateState, { announce: true });
        refreshAreaFromState(getState, updateState);
        return true;
    }

    const addAt = toGoogleLatLng(decision.point) || latLng;
    pushVertex(map, addAt, getState, updateState);
    if (decision.snapped && !snapHintShown) {
        snapHintShown = true;
        showAlert('Vertice agganciato al campo vicino.', 'success');
    }
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
        syncNeighborOverlays(state.map, getState());
        return; // Già inizializzata
    }
    
    try {
        clearNeighborOverlays();
        clearStartVertexMarker();
        const defaultCenter = { lat: 44.4949, lng: 11.3426 }; // Bologna area
        
        const map = new google.maps.Map(document.getElementById('map'), {
            zoom: 15,
            center: defaultCenter,
            mapTypeId: google.maps.MapTypeId.SATELLITE
        });

        // Aggiorna state
        updateState({ map });

        map.addListener('click', function(event) {
            appendVertexFromLatLng(map, event.latLng, getState, updateState);
        });
        map.addListener('dblclick', function(event) {
            const currentState = getState();
            if (!currentState.isDrawing) return;
            if (event && event.stop) event.stop();
            const n = (currentState.currentPolygonCoords || []).length;
            if (n >= 3) {
                stopDrawing(currentState, updateState, { announce: true });
            }
        });
        syncNeighborOverlays(map, getState());
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
    if (isDrawing) {
        resetDrawGesture();
        snapHintShown = false;
        if (state.polygon) {
            state.polygon.setMap(null);
            updateState({ polygon: null, currentPolygonCoords: [] });
            const mapInfo = document.getElementById('map-info');
            if (mapInfo) mapInfo.classList.remove('active');
        }
        clearStartVertexMarker();
        syncNeighborOverlays(state.map, { ...state, polygon: null, currentPolygonCoords: [] });
        applyDrawingUi(state, true);
        updateState({ isDrawing: true });
        showAlert('Tocca gli angoli. Vicino al primo punto, o un doppio tap, chiude il perimetro.', 'success');
    } else {
        stopDrawing(state, updateState);
    }
}

/**
 * Toglie l’ultimo vertice mentre si traccia.
 */
export function undoLastVertex(state, updateState, getState = () => state) {
    const currentState = getState();
    if (!currentState.isDrawing || !currentState.polygon) {
        return false;
    }
    const path = currentState.polygon.getPath();
    if (!path.getLength()) return false;
    path.pop();
    const currentPolygonCoords = path.getArray();
    if (currentPolygonCoords.length === 0) {
        currentState.polygon.setMap(null);
        updateState({ polygon: null, currentPolygonCoords: [] });
        clearStartVertexMarker();
    } else {
        updateState({ currentPolygonCoords });
    }
    refreshAreaFromState(getState, updateState);
    return true;
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
    clearStartVertexMarker();
    resetDrawGesture();
    updateUndoButton({ ...state, currentPolygonCoords: [] });
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

    updateState({ polygon, currentPolygonCoords });
    bindPolygonPathListeners(polygon, () => state, updateState);
    syncNeighborOverlays(state.map, state);

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



