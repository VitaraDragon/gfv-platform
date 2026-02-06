/**
 * Gestione Lavori Maps - Logica Google Maps per dettaglio lavori e zone lavorate
 * 
 * @module core/admin/js/gestione-lavori-maps
 */

// ============================================
// CONSTANTS
// ============================================

// Colori diversi per ogni giorno (palette colori distinte)
const COLORI_GIORNI = [
    { stroke: '#00FF00', fill: '#00FF00' }, // Verde (giorno 1)
    { stroke: '#0080FF', fill: '#0080FF' }, // Blu (giorno 2)
    { stroke: '#FF8000', fill: '#FF8000' }, // Arancione (giorno 3)
    { stroke: '#FF00FF', fill: '#FF00FF' }, // Magenta (giorno 4)
    { stroke: '#00FFFF', fill: '#00FFFF' }, // Cyan (giorno 5)
    { stroke: '#FFFF00', fill: '#FFFF00' }, // Giallo (giorno 6)
    { stroke: '#FF0080', fill: '#FF0080' }, // Rosa (giorno 7)
    { stroke: '#80FF00', fill: '#80FF00' }, // Verde chiaro (giorno 8)
    { stroke: '#8000FF', fill: '#8000FF' }, // Viola (giorno 9)
    { stroke: '#FF8080', fill: '#FF8080' }  // Salmone (giorno 10)
];

// ============================================
// FUNZIONI PRINCIPALI
// ============================================

/**
 * Carica e renderizza tab Mappa del dettaglio con zone lavorate
 * @param {string} lavoroId - ID lavoro
 * @param {Object} state - State object con { dettaglioMap, dettaglioMapMarkers, dettaglioMapPolygons, allZoneLavorate, zonePerData, dateDisponibili }
 * @param {Function} updateState - Funzione per aggiornare lo state
 * @param {Array} lavoriList - Array lavori
 * @param {Array} terreniList - Array terreni
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 */
export async function loadDettaglioMap(
    lavoroId,
    state,
    updateState,
    lavoriList,
    terreniList,
    currentTenantId,
    db
) {
    const container = document.getElementById('dettaglio-map-content');
    const mapContainer = document.getElementById('dettaglio-map');
    const zoneListContainer = document.getElementById('zone-list');
    const filtroDataSelect = document.getElementById('filtro-data-zone');
    const infoZoneFiltrate = document.getElementById('info-zone-filtrate');
    
    try {
        const lavoro = lavoriList.find(l => l.id === lavoroId);
        if (!lavoro) {
            if (container) container.innerHTML = '<div class="empty-state">Lavoro non trovato</div>';
            return;
        }

        const terreno = terreniList.find(t => t.id === lavoro.terrenoId);
        if (!terreno || !terreno.polygonCoords || terreno.polygonCoords.length === 0) {
            if (mapContainer) mapContainer.innerHTML = '<div class="empty-state">Terreno senza confini mappa</div>';
            if (zoneListContainer) zoneListContainer.innerHTML = '<div class="empty-state">Nessuna zona lavorata</div>';
            return;
        }

        // Inizializza mappa (sempre re-inizializza per ogni lavoro)
        const center = terreno.coordinate || { lat: 45.0, lng: 9.0 };
        if (typeof google !== 'undefined' && google.maps) {
            const dettaglioMap = new google.maps.Map(mapContainer, {
                zoom: 15,
                center: center,
                mapTypeId: 'satellite'
            });
            updateState({ dettaglioMap });
        } else {
            if (mapContainer) mapContainer.innerHTML = '<div class="empty-state">Google Maps non disponibile. Attendi il caricamento...</div>';
            setTimeout(() => loadDettaglioMap(lavoroId, state, updateState, lavoriList, terreniList, currentTenantId, db), 1000);
            return;
        }

        // Pulisci markers e poligoni precedenti
        if (state.dettaglioMapMarkers) {
            state.dettaglioMapMarkers.forEach(m => m.setMap(null));
        }
        if (state.dettaglioMapPolygons) {
            state.dettaglioMapPolygons.forEach(p => p.setMap(null));
        }
        updateState({ dettaglioMapMarkers: [], dettaglioMapPolygons: [] });

        // Disegna confini terreno
        const terrenoCoords = terreno.polygonCoords.map(c => {
            if (typeof c === 'object' && c !== null) {
                return {
                    lat: c.lat !== undefined ? c.lat : (Array.isArray(c) ? c[0] : 45.0),
                    lng: c.lng !== undefined ? c.lng : (Array.isArray(c) ? c[1] : 9.0)
                };
            } else if (Array.isArray(c)) {
                return { lat: c[0] || 45.0, lng: c[1] || 9.0 };
            }
            return { lat: 45.0, lng: 9.0 };
        });
        
        const terrenoPolygon = new google.maps.Polygon({
            paths: terrenoCoords,
            strokeColor: '#FF0000',
            strokeOpacity: 0.8,
            strokeWeight: 3,
            fillColor: '#FF0000',
            fillOpacity: 0.1
        });
        terrenoPolygon.setMap(state.dettaglioMap);
        const dettaglioMapPolygons = [terrenoPolygon];
        updateState({ dettaglioMapPolygons });

        // Aggiusta zoom per includere tutto il terreno
        const bounds = new google.maps.LatLngBounds();
        terrenoCoords.forEach(coord => bounds.extend(coord));
        state.dettaglioMap.fitBounds(bounds);

        // Carica zone lavorate
        const { collection, getDocs } = await import('../../services/firebase-service.js');
        const zoneRef = collection(db, 'tenants', currentTenantId, 'lavori', lavoroId, 'zoneLavorate');
        const zoneSnapshot = await getDocs(zoneRef);
        
        const allZoneLavorate = [];
        const zonePerData = {};
        const dateDisponibili = [];

        zoneSnapshot.forEach(zonaDoc => {
            const zonaData = zonaDoc.data();
            const zona = { id: zonaDoc.id, ...zonaData };
            
            // Normalizza la data
            let dataZona;
            if (zonaData.data?.toDate) {
                dataZona = zonaData.data.toDate();
            } else if (zonaData.data) {
                dataZona = new Date(zonaData.data);
            } else {
                dataZona = new Date(); // Default a oggi se mancante
            }
            
            // Normalizza data a mezzanotte per raggruppamento
            const dataKey = new Date(dataZona.getFullYear(), dataZona.getMonth(), dataZona.getDate());
            const dataKeyString = dataKey.toISOString().split('T')[0]; // YYYY-MM-DD
            
            zona.dataNormalizzata = dataKey;
            zona.dataKeyString = dataKeyString;
            
            allZoneLavorate.push(zona);
            
            // Raggruppa per data
            if (!zonePerData[dataKeyString]) {
                zonePerData[dataKeyString] = [];
                dateDisponibili.push(dataKeyString);
            }
            zonePerData[dataKeyString].push(zona);
        });

        // Ordina date (più recenti prima)
        dateDisponibili.sort((a, b) => new Date(b) - new Date(a));

        // Popola dropdown date
        if (filtroDataSelect) {
            filtroDataSelect.innerHTML = '<option value="tutte">📅 Tutte le date</option>';
            dateDisponibili.forEach((dataKey) => {
                const dataObj = new Date(dataKey);
                const dataFormatted = dataObj.toLocaleDateString('it-IT', { 
                    weekday: 'short', 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                });
                const numZone = zonePerData[dataKey].length;
                const superficieTotale = zonePerData[dataKey].reduce((sum, z) => sum + (z.superficieHa || 0), 0);
                
                filtroDataSelect.innerHTML += `
                    <option value="${dataKey}">
                        ${dataFormatted} (${numZone} ${numZone === 1 ? 'zona' : 'zone'}, ${superficieTotale.toFixed(2)} ha)
                    </option>
                `;
            });

            // Reset filtro a "tutte"
            filtroDataSelect.value = 'tutte';
            
            // Aggiungi listener per cambio filtro
            filtroDataSelect.onchange = function() {
                filtraZonePerData(filtroDataSelect.value, state, updateState);
            };
        }

        // Aggiorna state con zone caricate
        updateState({ allZoneLavorate, zonePerData, dateDisponibili });

        // Mostra tutte le zone inizialmente
        mostraZoneSullaMappa(allZoneLavorate, null, state, updateState);
        aggiornaListaZone(allZoneLavorate, state);
        aggiornaInfoZone('tutte', null, state);
    } catch (error) {
        console.error('Errore caricamento mappa:', error);
        if (mapContainer) mapContainer.innerHTML = '<div class="empty-state">Errore caricamento mappa</div>';
    }
}

/**
 * Filtra zone per data
 * @param {string} dataSelezionata - Data selezionata o 'tutte'
 * @param {Object} state - State object
 * @param {Function} updateState - Funzione per aggiornare lo state
 */
export function filtraZonePerData(dataSelezionata, state, updateState) {
    if (dataSelezionata === 'tutte') {
        mostraZoneSullaMappa(state.allZoneLavorate, null, state, updateState);
        aggiornaListaZone(state.allZoneLavorate, state);
        aggiornaInfoZone('tutte', null, state);
    } else {
        const zoneFiltrate = state.zonePerData[dataSelezionata] || [];
        mostraZoneSullaMappa(zoneFiltrate, dataSelezionata, state, updateState);
        aggiornaListaZone(zoneFiltrate, state);
        aggiornaInfoZone(dataSelezionata, zoneFiltrate, state);
    }
}

/**
 * Mostra zone sulla mappa
 * @param {Array} zone - Array zone da mostrare
 * @param {string|null} dataSelezionata - Data selezionata o null per tutte
 * @param {Object} state - State object
 * @param {Function} updateState - Funzione per aggiornare lo state
 */
export function mostraZoneSullaMappa(zone, dataSelezionata, state, updateState) {
    if (!state.dettaglioMap) return;

    // Rimuovi solo i poligoni delle zone (non il terreno)
    const dettaglioMapPolygons = [...state.dettaglioMapPolygons];
    dettaglioMapPolygons.forEach((polygon, index) => {
        if (index > 0) { // Salta il primo (terreno)
            polygon.setMap(null);
        }
    });
    const newPolygons = dettaglioMapPolygons.slice(0, 1); // Mantieni solo il terreno

    // Determina l'indice del colore in base alla data
    let colorIndex = 0;
    if (dataSelezionata && state.dateDisponibili && state.dateDisponibili.includes(dataSelezionata)) {
        colorIndex = state.dateDisponibili.indexOf(dataSelezionata);
    }

    // Disegna zone sulla mappa
    zone.forEach((zona) => {
        if (zona.coordinate && zona.coordinate.length > 0) {
            const zonaCoords = zona.coordinate.map(c => ({
                lat: c.lat,
                lng: c.lng
            }));
            
            // Seleziona colore: se mostra tutte, usa colore in base alla data della zona
            let colore;
            if (dataSelezionata === null || dataSelezionata === 'tutte') {
                // Mostra tutte: usa colore in base alla data della zona
                const zonaDataIndex = state.dateDisponibili ? state.dateDisponibili.indexOf(zona.dataKeyString) : 0;
                colore = COLORI_GIORNI[zonaDataIndex % COLORI_GIORNI.length];
            } else {
                // Mostra solo una data: usa il colore di quella data
                colore = COLORI_GIORNI[colorIndex % COLORI_GIORNI.length];
            }
            
            const zonaPolygon = new google.maps.Polygon({
                paths: zonaCoords,
                strokeColor: colore.stroke,
                strokeOpacity: 0.9,
                strokeWeight: 2,
                fillColor: colore.fill,
                fillOpacity: 0.4
            });
            zonaPolygon.setMap(state.dettaglioMap);
            newPolygons.push(zonaPolygon);
        }
    });

    updateState({ dettaglioMapPolygons: newPolygons });
}

/**
 * Aggiorna lista zone
 * @param {Array} zone - Array zone da mostrare
 * @param {Object} state - State object
 */
export function aggiornaListaZone(zone, state) {
    const zoneListContainer = document.getElementById('zone-list');
    if (!zoneListContainer) return;
    
    if (zone.length === 0) {
        zoneListContainer.innerHTML = '<div class="empty-state">Nessuna zona lavorata tracciata</div>';
        return;
    }

    // Raggruppa per data per la visualizzazione
    const zonePerDataLista = {};
    zone.forEach(zona => {
        const dataKey = zona.dataKeyString;
        if (!zonePerDataLista[dataKey]) {
            zonePerDataLista[dataKey] = [];
        }
        zonePerDataLista[dataKey].push(zona);
    });

    // Ordina date (più recenti prima)
    const dateOrdinate = Object.keys(zonePerDataLista).sort((a, b) => new Date(b) - new Date(a));

    zoneListContainer.innerHTML = dateOrdinate.map(dataKey => {
        const zoneGiorno = zonePerDataLista[dataKey];
        const dataObj = new Date(dataKey);
        const dataFormatted = dataObj.toLocaleDateString('it-IT', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        const superficieTotale = zoneGiorno.reduce((sum, z) => sum + (z.superficieHa || 0), 0);
        const colorIndex = state.dateDisponibili ? state.dateDisponibili.indexOf(dataKey) : 0;
        const colore = COLORI_GIORNI[colorIndex % COLORI_GIORNI.length];
        
        return `
            <div style="margin-bottom: 20px; padding: 10px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid ${colore.stroke};">
                <div style="font-weight: 600; margin-bottom: 10px; color: #333;">
                    📅 ${dataFormatted}
                    <span style="font-size: 12px; font-weight: normal; color: #666; margin-left: 10px;">
                        (${zoneGiorno.length} ${zoneGiorno.length === 1 ? 'zona' : 'zone'}, ${superficieTotale.toFixed(2)} ha)
                    </span>
                </div>
                ${zoneGiorno.map(zona => {
                    const dataZonaFormatted = zona.dataNormalizzata.toLocaleDateString('it-IT');
                    return `
                        <div class="zone-item" style="margin-left: 10px; margin-bottom: 5px;">
                            <div class="zone-info">
                                <div class="zone-surface" style="font-weight: 500;">${(zona.superficieHa || 0).toFixed(2)} ha</div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }).join('');
}

/**
 * Aggiorna info zone filtrate
 * @param {string} dataSelezionata - Data selezionata o 'tutte'
 * @param {Array|null} zoneFiltrate - Zone filtrate (opzionale)
 * @param {Object} state - State object
 */
export function aggiornaInfoZone(dataSelezionata, zoneFiltrate, state) {
    const infoZoneFiltrate = document.getElementById('info-zone-filtrate');
    if (!infoZoneFiltrate) return;
    
    if (dataSelezionata === 'tutte') {
        const totaleZone = state.allZoneLavorate ? state.allZoneLavorate.length : 0;
        const totaleSuperficie = state.allZoneLavorate ? state.allZoneLavorate.reduce((sum, z) => sum + (z.superficieHa || 0), 0) : 0;
        const numGiorni = state.dateDisponibili ? state.dateDisponibili.length : 0;
        infoZoneFiltrate.innerHTML = `
            <span style="color: #2E7D32;">✅ Visualizzate <strong>${totaleZone}</strong> zone lavorate in <strong>${numGiorni}</strong> giorno${numGiorni !== 1 ? 'i' : ''} 
            (totale: <strong>${totaleSuperficie.toFixed(2)} ha</strong>)</span>
        `;
    } else {
        const zone = zoneFiltrate || (state.zonePerData && state.zonePerData[dataSelezionata]) || [];
        const superficie = zone.reduce((sum, z) => sum + (z.superficieHa || 0), 0);
        const dataObj = new Date(dataSelezionata);
        const dataFormatted = dataObj.toLocaleDateString('it-IT', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        infoZoneFiltrate.innerHTML = `
            <span style="color: #1976D2;">🔍 Visualizzate <strong>${zone.length}</strong> ${zone.length === 1 ? 'zona' : 'zone'} del <strong>${dataFormatted}</strong> 
            (totale: <strong>${superficie.toFixed(2)} ha</strong>)</span>
        `;
    }
}

/**
 * Mostra tutte le zone (rimuove filtro data)
 * @param {Object} state - State object
 * @param {Function} updateState - Funzione per aggiornare lo state
 */
export function mostraTutteLeZone(state, updateState) {
    const filtroDataSelect = document.getElementById('filtro-data-zone');
    if (filtroDataSelect) {
        filtroDataSelect.value = 'tutte';
    }
    filtraZonePerData('tutte', state, updateState);
}



