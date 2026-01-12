/**
 * Attività Maps - Logica Google Maps per visualizzazione zone lavorate
 * 
 * @module core/js/attivita-maps
 */

// ============================================
// FUNZIONI PRINCIPALI
// ============================================

/**
 * Mostra mappa con zone lavorate per un lavoro conto terzi in una data specifica
 * @param {Object} params - Parametri funzione
 * @param {string} params.lavoroId - ID lavoro
 * @param {string} params.dataAttivita - Data attività (YYYY-MM-DD)
 * @param {string} params.dataFormatted - Data formattata per display
 * @param {Array} params.lavoriList - Array lavori
 * @param {Array} params.terreni - Array terreni
 * @param {string} params.currentTenantId - ID tenant corrente
 * @param {Object} params.db - Istanza Firestore
 * @param {Object} params.collection - Funzione collection Firestore
 * @param {Object} params.getDocs - Funzione getDocs Firestore
 * @param {Object} params.getDoc - Funzione getDoc Firestore
 * @param {Object} params.doc - Funzione doc Firestore
 * @param {Function} params.loadGoogleMapsAPI - Callback per caricare Google Maps API
 * @param {Function} params.showAlert - Callback per mostrare alert
 * @param {Function} params.updateMappaZoneMap - Callback per aggiornare mappaZoneMap globale
 * @param {Function} params.updateMappaZonePolygons - Callback per aggiornare mappaZonePolygons globale
 * @param {Function} params.getMappaZoneMap - Callback per leggere mappaZoneMap globale
 * @param {Function} params.getMappaZonePolygons - Callback per leggere mappaZonePolygons globale
 */
export async function mostraMappaZonaLavorata(params) {
    const {
        lavoroId,
        dataAttivita,
        dataFormatted,
        lavoriList,
        terreni,
        currentTenantId,
        db,
        collection,
        getDocs,
        getDoc,
        doc: docFn,
        loadGoogleMapsAPI,
        showAlert,
        updateMappaZoneMap,
        updateMappaZonePolygons,
        getMappaZoneMap,
        getMappaZonePolygons
    } = params;

    try {
        // Apri modal prima di caricare la mappa
        const titleElement = document.getElementById('mappa-zone-title');
        const modalElement = document.getElementById('mappa-zone-modal');
        if (titleElement) titleElement.textContent = `Zone Lavorate - ${dataFormatted}`;
        if (modalElement) modalElement.classList.add('active');
        
        const mapContainer = document.getElementById('mappa-zone-container');
        const infoContainer = document.getElementById('mappa-zone-info');
        
        // Mostra loading
        if (mapContainer) {
            mapContainer.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666;">Caricamento mappa...</div>';
        }
        if (infoContainer) {
            infoContainer.innerHTML = 'Caricamento zone lavorate...';
        }
        
        // Carica Google Maps API se non già caricato
        if (loadGoogleMapsAPI) {
            await loadGoogleMapsAPI();
        }
        
        if (typeof google === 'undefined' || !google.maps) {
            console.error('❌ Google Maps non disponibile');
            if (showAlert) {
                showAlert('Google Maps non disponibile. Verifica che il file config/google-maps-config.js sia presente e configurato correttamente.', 'error');
            }
            if (mapContainer) {
                mapContainer.innerHTML = 
                    '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #d32f2f; text-align: center; padding: 20px;">Google Maps non disponibile.<br>Verifica la configurazione.</div>';
            }
            if (infoContainer) {
                infoContainer.innerHTML = 
                    '<div style="color: #d32f2f;">Errore: Google Maps non disponibile</div>';
            }
            return;
        }

        // Trova lavoro e terreno
        const lavoro = lavoriList.find(l => l.id === lavoroId);
        if (!lavoro) {
            if (mapContainer) {
                mapContainer.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #d32f2f;">Lavoro non trovato</div>';
            }
            if (infoContainer) {
                infoContainer.innerHTML = 'Errore: Lavoro non trovato';
            }
            return;
        }

        let terreno = terreni.find(t => t.id === lavoro.terrenoId);
        
        // Se il terreno non ha polygonCoords, caricalo dal database
        if (!terreno || !terreno.polygonCoords || terreno.polygonCoords.length === 0) {
            try {
                const terrenoDoc = await getDoc(docFn(db, 'tenants', currentTenantId, 'terreni', lavoro.terrenoId));
                if (terrenoDoc.exists()) {
                    const terrenoData = terrenoDoc.data();
                    terreno = {
                        id: terrenoDoc.id,
                        nome: terrenoData.nome || '',
                        superficie: terrenoData.superficie || 0,
                        coordinate: terrenoData.coordinate || null,
                        polygonCoords: terrenoData.polygonCoords || null
                    };
                    // Aggiorna anche nella lista cache
                    const terrenoIndex = terreni.findIndex(t => t.id === lavoro.terrenoId);
                    if (terrenoIndex >= 0) {
                        terreni[terrenoIndex] = terreno;
                    }
                }
            } catch (error) {
                console.error('Errore caricamento terreno:', error);
            }
        }
        
        if (!terreno || !terreno.polygonCoords || terreno.polygonCoords.length === 0) {
            console.error('❌ Terreno senza confini mappa:', terreno);
            if (mapContainer) {
                mapContainer.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #d32f2f;">Terreno senza confini mappa</div>';
            }
            if (infoContainer) {
                infoContainer.innerHTML = 'Errore: Terreno senza confini mappa. Verifica che il terreno abbia i confini tracciati.';
            }
            return;
        }

        // Inizializza mappa
        const center = terreno.coordinate || { lat: 45.0, lng: 9.0 };
        const mappaZoneMap = new google.maps.Map(mapContainer, {
            zoom: 15,
            center: center,
            mapTypeId: 'satellite'
        });

        // Aggiorna variabile globale
        if (updateMappaZoneMap) updateMappaZoneMap(mappaZoneMap);

        // Pulisci poligoni precedenti
        const mappaZonePolygons = [];
        const previousPolygons = getMappaZonePolygons ? getMappaZonePolygons() : [];
        previousPolygons.forEach(p => {
            if (p && p.setMap) p.setMap(null);
        });
        if (updateMappaZonePolygons) updateMappaZonePolygons(mappaZonePolygons);

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
        terrenoPolygon.setMap(mappaZoneMap);
        mappaZonePolygons.push(terrenoPolygon);
        if (updateMappaZonePolygons) updateMappaZonePolygons(mappaZonePolygons);

        // Aggiusta zoom per includere tutto il terreno
        const bounds = new google.maps.LatLngBounds();
        terrenoCoords.forEach(coord => bounds.extend(coord));
        mappaZoneMap.fitBounds(bounds);

        // Carica zone lavorate per questa data specifica
        const zoneRef = collection(db, 'tenants', currentTenantId, 'lavori', lavoroId, 'zoneLavorate');
        const zoneSnapshot = await getDocs(zoneRef);
        
        // Normalizza data attività per confronto (YYYY-MM-DD)
        const dataAttivitaObj = new Date(dataAttivita + 'T00:00:00');
        const dataAttivitaKey = dataAttivitaObj.toISOString().split('T')[0];
        
        let zoneTrovate = [];
        let superficieTotale = 0;

        zoneSnapshot.forEach(zonaDoc => {
            const zonaData = zonaDoc.data();
            
            // Normalizza data zona
            let dataZona;
            if (zonaData.data?.toDate) {
                dataZona = zonaData.data.toDate();
            } else if (zonaData.data) {
                dataZona = new Date(zonaData.data);
            } else {
                return; // Salta se non ha data
            }
            
            const dataZonaKey = new Date(dataZona.getFullYear(), dataZona.getMonth(), dataZona.getDate()).toISOString().split('T')[0];
            
            // Filtra per data specifica
            if (dataZonaKey === dataAttivitaKey) {
                const zona = { id: zonaDoc.id, ...zonaData };
                zoneTrovate.push(zona);
                superficieTotale += zona.superficieHa || 0;
                
                // Disegna zona lavorata sulla mappa
                if (zona.coordinate && zona.coordinate.length > 0) {
                    const zonaCoords = zona.coordinate.map(c => ({
                        lat: c.lat,
                        lng: c.lng
                    }));
                    
                    const zonaPolygon = new google.maps.Polygon({
                        paths: zonaCoords,
                        strokeColor: '#00FF00',
                        strokeOpacity: 0.9,
                        strokeWeight: 2,
                        fillColor: '#00FF00',
                        fillOpacity: 0.4
                    });
                    zonaPolygon.setMap(mappaZoneMap);
                    mappaZonePolygons.push(zonaPolygon);
                    if (updateMappaZonePolygons) updateMappaZonePolygons(mappaZonePolygons);
                }
            }
        });

        // Aggiorna info
        if (infoContainer) {
            if (zoneTrovate.length === 0) {
                infoContainer.innerHTML = `
                    <div style="color: #d32f2f;">
                        ⚠️ Nessuna zona lavorata tracciata per il ${dataFormatted}
                    </div>
                `;
            } else {
                infoContainer.innerHTML = `
                    <div style="color: #2E7D32;">
                        ✅ <strong>${zoneTrovate.length}</strong> ${zoneTrovate.length === 1 ? 'zona' : 'zone'} lavorata${zoneTrovate.length === 1 ? '' : 'e'} 
                        per un totale di <strong>${superficieTotale.toFixed(2)} ha</strong>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Errore caricamento mappa zone:', error);
        const mapContainer = document.getElementById('mappa-zone-container');
        const infoContainer = document.getElementById('mappa-zone-info');
        if (mapContainer) {
            mapContainer.innerHTML = 
                '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #d32f2f;">Errore caricamento mappa</div>';
        }
        if (infoContainer) {
            infoContainer.innerHTML = 
                `<div style="color: #d32f2f;">Errore: ${error.message}</div>`;
        }
    }
}

/**
 * Chiude modal mappa zone lavorate e pulisce la mappa
 * @param {Object} params - Parametri funzione
 * @param {Function} params.getMappaZoneMap - Callback per leggere mappaZoneMap globale
 * @param {Function} params.getMappaZonePolygons - Callback per leggere mappaZonePolygons globale
 * @param {Function} params.updateMappaZoneMap - Callback per aggiornare mappaZoneMap globale
 * @param {Function} params.updateMappaZonePolygons - Callback per aggiornare mappaZonePolygons globale
 */
export function closeMappaZoneModal(params) {
    const {
        getMappaZoneMap,
        getMappaZonePolygons,
        updateMappaZoneMap,
        updateMappaZonePolygons
    } = params;

    const modalElement = document.getElementById('mappa-zone-modal');
    if (modalElement) {
        modalElement.classList.remove('active');
    }
    
    // Pulisci mappa
    const mappaZoneMap = getMappaZoneMap ? getMappaZoneMap() : null;
    const mappaZonePolygons = getMappaZonePolygons ? getMappaZonePolygons() : [];
    
    if (mappaZoneMap) {
        mappaZonePolygons.forEach(p => {
            if (p && p.setMap) p.setMap(null);
        });
        if (updateMappaZonePolygons) updateMappaZonePolygons([]);
        if (updateMappaZoneMap) updateMappaZoneMap(null);
    }
}

