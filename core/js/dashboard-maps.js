/**
 * Dashboard Maps - Logica Google Maps per dashboard
 * 
 * @module core/js/dashboard-maps
 */

// ============================================
// IMPORTS
// ============================================
// escapeHtml viene passato come callback
// db, auth, collection, getDocs vengono passati come parametri o accessibili globalmente

// ============================================
// STATE MANAGEMENT
// ============================================
// Le variabili di stato (map, polygons, overlayLavoriVisible, etc.) 
// vengono gestite localmente nelle funzioni

// ============================================
// FUNZIONI PRINCIPALI
// ============================================

/**
 * Crea la sezione mappa aziendale
 * @param {Object} userData - Dati utente
 * @param {boolean} hasManodopera - Se true, include funzionalità avanzate Manodopera
 * @param {Function} loadMappaCallback - Callback per caricare la mappa
 * @returns {HTMLElement} Sezione HTML creata
 */
export function createMappaAziendaleSection(userData, hasManodopera = false, loadMappaCallback) {
    const section = document.createElement('div');
    section.className = 'dashboard-section';
    section.style.height = '100%';
    section.style.display = 'flex';
    section.style.flexDirection = 'column';
    
    // Versione completa con Manodopera: include filtri avanzati, overlay lavori, indicatori
    if (hasManodopera) {
        section.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; gap: 20px;">
                <div style="flex: 1;">
                    <h2 style="margin: 0;"><span class="section-icon">🗺️</span> Vista Mappa Aziendale</h2>
                    <p style="color: #666; margin-top: 5px; margin-bottom: 0; font-size: 14px;">
                        Visualizza tutti i terreni dell'azienda con i loro confini geolocalizzati sulla mappa satellitare
                    </p>
                </div>
                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    <div style="display: flex; flex-direction: column; gap: 5px;">
                        <label for="filtro-podere" style="font-size: 12px; color: #666; font-weight: 500;">Podere</label>
                        <select id="filtro-podere" class="mappa-filtro-select" title="Filtra per podere">
                            <option value="">Tutti i poderi</option>
                        </select>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 5px;">
                        <label for="filtro-coltura" style="font-size: 12px; color: #666; font-weight: 500;">Coltura</label>
                        <select id="filtro-coltura" class="mappa-filtro-select" title="Filtra per coltura">
                            <option value="">Tutte le colture</option>
                        </select>
                    </div>
                    <button id="toggle-overlay-lavori" class="mappa-control-btn" title="Mostra/Nascondi zone lavorate" style="margin-top: 20px;">
                        <span>👷</span> Zone Lavorate
                    </button>
                    <button id="toggle-indicatori-lavori" class="mappa-control-btn" title="Mostra/Nascondi indicatori stato lavori" style="margin-top: 20px;">
                        <span>📍</span> Indicatori Lavori
                    </button>
                </div>
            </div>
            <div id="mappa-aziendale-container" class="mappa-container" style="flex: 1; min-height: 500px; width: 100%;">
                <div class="mappa-loading">
                    <div>Caricamento mappa...</div>
                </div>
            </div>
        `;
        
        // Carica versione completa con Manodopera
        setTimeout(() => {
            if (loadMappaCallback) {
                loadMappaCallback(userData, true);
            }
        }, 500);
    } else {
        // Versione semplificata senza Manodopera: solo terreni, nessun filtro avanzato, nessun overlay
        section.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h2 style="margin: 0;"><span class="section-icon">🗺️</span> Vista Mappa Aziendale</h2>
                <p style="color: #666; margin-top: 5px; margin-bottom: 0; font-size: 14px;">
                    Visualizza tutti i terreni dell'azienda con i loro confini geolocalizzati sulla mappa satellitare
                </p>
            </div>
            <div id="mappa-aziendale-container" class="mappa-container" style="flex: 1; min-height: 500px; width: 100%;">
                <div class="mappa-loading">
                    <div>Caricamento mappa...</div>
                </div>
            </div>
        `;
        
        // Carica versione semplificata senza Manodopera
        setTimeout(() => {
            if (loadMappaCallback) {
                loadMappaCallback(userData, false);
            }
        }, 500);
    }
    
    return section;
}

/**
 * Colori per colture (palette colori ottimizzata per visibilità)
 */
const colturaColors = {
    'Vite': { fill: '#DC143C', stroke: '#8B0000' },
    'Frutteto': { fill: '#FF6600', stroke: '#CC5500' },
    'Seminativo': { fill: '#FFD700', stroke: '#B8860B' },
    'Orto': { fill: '#00FF00', stroke: '#00AA00' },
    'Ortive': { fill: '#00FF00', stroke: '#00AA00' },
    'Prato': { fill: '#90EE90', stroke: '#228B22' },
    'Olivo': { fill: '#9370DB', stroke: '#6A5ACD' },
    'Agrumeto': { fill: '#FFA500', stroke: '#FF8C00' },
    'Bosco': { fill: '#8B4513', stroke: '#654321' },
    'Default': { fill: '#1E90FF', stroke: '#0066CC' }
};

/**
 * Mappa nome coltura specifico a categoria generica
 * @param {string} colturaNome - Nome della coltura
 * @param {string} colturaCategoria - Categoria della coltura
 * @returns {string} Categoria colore
 */
function mapColturaToColorCategory(colturaNome, colturaCategoria) {
    if (!colturaNome) return 'Default';
    
    const nomeLower = colturaNome.toLowerCase();
    
    // Match esatto nella palette
    if (colturaColors[colturaNome]) {
        return colturaNome;
    }
    
    // Mapping per Vite (tutte le varianti)
    if (nomeLower.includes('vite') || colturaCategoria?.toLowerCase() === 'vite') {
        return 'Vite';
    }
    
    // Mapping per Frutteto (tutte le varianti)
    if (nomeLower.includes('albicocch') || nomeLower.includes('pesco') || 
        nomeLower.includes('melo') || nomeLower.includes('pero') ||
        nomeLower.includes('ciliegio') || nomeLower.includes('susino') ||
        nomeLower.includes('fico') || nomeLower.includes('nocciolo') ||
        nomeLower.includes('mandorlo') || nomeLower.includes('castagno') ||
        nomeLower.includes('kiwi') || nomeLower.includes('mirtillo') ||
        nomeLower.includes('lampone') || nomeLower.includes('ribes') ||
        nomeLower.includes('mora') || nomeLower.includes('melograno') ||
        nomeLower.includes('noce') || nomeLower.includes('pistacchio') ||
        colturaCategoria?.toLowerCase() === 'frutteto') {
        return 'Frutteto';
    }
    
    // Mapping per Seminativo
    if (nomeLower.includes('grano') || nomeLower.includes('mais') ||
        nomeLower.includes('orzo') || nomeLower.includes('favino') ||
        nomeLower.includes('girasole') || nomeLower.includes('soia') ||
        nomeLower.includes('colza') || nomeLower.includes('avena') ||
        nomeLower.includes('segale') || nomeLower.includes('fava') ||
        nomeLower.includes('lenticchia') || nomeLower.includes('cece') ||
        nomeLower.includes('riso') || nomeLower.includes('quinoa') ||
        nomeLower.includes('canapa') || nomeLower.includes('lino') ||
        nomeLower.includes('erba medica') || nomeLower.includes('trifoglio') ||
        colturaCategoria?.toLowerCase() === 'seminativo') {
        return 'Seminativo';
    }
    
    // Mapping per Ortive/Orto
    if (nomeLower.includes('pomodoro') || nomeLower.includes('zucchin') ||
        nomeLower.includes('melanzan') || nomeLower.includes('peperon') ||
        nomeLower.includes('insalata') || nomeLower.includes('carot') ||
        nomeLower.includes('patat') || nomeLower.includes('bietol') ||
        nomeLower.includes('fragol') || nomeLower.includes('cipoll') ||
        nomeLower.includes('aglio') || nomeLower.includes('fagiol') ||
        nomeLower.includes('pisell') || nomeLower.includes('cavolo') ||
        nomeLower.includes('broccoli') || nomeLower.includes('spinaci') ||
        nomeLower.includes('lattuga') || nomeLower.includes('radicchio') ||
        nomeLower.includes('finocchi') || nomeLower.includes('sedano') ||
        nomeLower.includes('cetriol') || nomeLower.includes('anguria') ||
        nomeLower.includes('melon') || colturaCategoria?.toLowerCase() === 'ortive' ||
        colturaCategoria?.toLowerCase() === 'orto') {
        return 'Orto';
    }
    
    // Mapping per Prato
    if (nomeLower.includes('prato') || nomeLower.includes('pascolo') ||
        colturaCategoria?.toLowerCase() === 'prato') {
        return 'Prato';
    }
    
    // Mapping per Olivo
    if (nomeLower.includes('olivo') || nomeLower.includes('oliveto') ||
        colturaCategoria?.toLowerCase() === 'olivo') {
        return 'Olivo';
    }
    
    // Mapping per Agrumeto
    if (nomeLower.includes('arancio') || nomeLower.includes('limone') ||
        nomeLower.includes('mandarino') || nomeLower.includes('clementin') ||
        nomeLower.includes('pompelmo') || nomeLower.includes('bergamotto') ||
        nomeLower.includes('cedro') || nomeLower.includes('lime') ||
        nomeLower.includes('kumquat') || colturaCategoria?.toLowerCase() === 'agrumeto') {
        return 'Agrumeto';
    }
    
    // Mapping per Bosco
    if (nomeLower.includes('bosco') || nomeLower.includes('foresta') ||
        colturaCategoria?.toLowerCase() === 'bosco') {
        return 'Bosco';
    }
    
    return 'Default';
}

/**
 * Calcola centroide di un poligono
 * @param {Array} coords - Array di coordinate {lat, lng}
 * @returns {Object} Centroide {lat, lng}
 */
export function getPolygonCenter(coords) {
    let latSum = 0;
    let lngSum = 0;
    coords.forEach(coord => {
        latSum += coord.lat;
        lngSum += coord.lng;
    });
    return {
        lat: latSum / coords.length,
        lng: lngSum / coords.length
    };
}

/**
 * Carica e visualizza terreni sulla mappa
 * @param {Object} userData - Dati utente
 * @param {boolean} hasManodopera - Se true, carica versione completa con overlay lavori, filtri avanzati, indicatori
 * @param {Object} dependencies - Dipendenze { app, db, auth, collection, getDocs, escapeHtml, loadGoogleMapsAPI }
 */
export async function loadMappaAziendale(userData, hasManodopera = false, dependencies) {
    const { app, db, auth, collection, getDocs, escapeHtml, loadGoogleMapsAPI } = dependencies;
    
    const container = document.getElementById('mappa-aziendale-container');
    if (!container) {
        console.warn('Container mappa non trovato');
        return;
    }

    try {
        // Verifica che Google Maps sia caricato
        if (!window.googleMapsReady) {
            await loadGoogleMapsAPI();
        }

        // Aspetta che Google Maps sia completamente disponibile
        let attempts = 0;
        const maxAttempts = 50; // 5 secondi
        while ((typeof google === 'undefined' || !google.maps) && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (typeof google === 'undefined' || !google.maps) {
            console.error('❌ Google Maps non disponibile dopo attesa');
            container.innerHTML = `
                <div class="mappa-loading">
                    <h3 style="color: #dc3545; margin-bottom: 15px;">⚠️ Google Maps non disponibile</h3>
                    <p>Per visualizzare la mappa è necessario configurare una chiave API di Google Maps valida.</p>
                    <p style="margin-top: 10px; font-size: 12px; color: #666;">
                        Verifica che la chiave API sia configurata correttamente nel file di configurazione.
                    </p>
                </div>
            `;
            return;
        }

        const user = auth.currentUser;
        if (!user || !userData) {
            container.innerHTML = `
                <div class="mappa-loading">
                    <p>Errore: dati utente non disponibili</p>
                </div>
            `;
            return;
        }

        // Usa getCurrentTenantId() invece di userData.tenantId per supportare multi-tenant
        const { getCurrentTenantId } = await import('../services/tenant-service.js');
        const currentTenantId = getCurrentTenantId() || userData.tenantId; // Fallback a userData.tenantId per retrocompatibilità
        if (!currentTenantId) {
            container.innerHTML = `
                <div class="mappa-loading">
                    <p>Errore: tenant corrente non disponibile</p>
                </div>
            `;
            return;
        }

        // Carica terreni usando servizio centralizzato (solo terreni aziendali, escludi terreni clienti)
        const { loadTerreniViaService } = await import('../services/service-helper.js');
        const terreniList = await loadTerreniViaService({
            tenantId: currentTenantId,
            firebaseInstances: { app, db, auth },
            options: {
                orderBy: 'nome',
                orderDirection: 'asc',
                clienteId: null // Solo terreni aziendali
            }
        });
        
        // Filtra solo terreni con mappa (polygonCoords)
        const terreni = terreniList.filter(terreno => {
            return terreno.polygonCoords && Array.isArray(terreno.polygonCoords) && terreno.polygonCoords.length >= 3;
        }).map(terreno => ({
            id: terreno.id,
            nome: terreno.nome || 'Terreno senza nome',
            superficie: terreno.superficie || null,
            coltura: terreno.coltura || null,
            podere: terreno.podere || null,
            polygonCoords: terreno.polygonCoords,
            coordinate: terreno.coordinate || null,
            note: terreno.note || ''
        }));

        if (terreni.length === 0) {
            container.innerHTML = `
                <div class="mappa-loading">
                    <h3 style="color: #666; margin-bottom: 15px;">📋 Nessun terreno con mappa</h3>
                    <p>Non ci sono terreni con confini tracciati sulla mappa.</p>
                    <p style="margin-top: 10px;">
                        <a href="terreni-standalone.html" style="color: #2E8B57; text-decoration: underline;">
                            Vai alla gestione terreni per tracciare i confini
                        </a>
                    </p>
                </div>
            `;
            return;
        }

        // Inizializza mappa
        // Assicurati che il container abbia dimensioni corrette
        if (container.offsetWidth === 0 || container.offsetHeight === 0) {
            // Aspetta che il container abbia dimensioni
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        const mapDiv = document.createElement('div');
        mapDiv.style.width = '100%';
        mapDiv.style.height = '100%';
        mapDiv.style.minHeight = '500px';
        mapDiv.style.display = 'block';
        container.innerHTML = '';
        container.appendChild(mapDiv);
        
        // Aspetta che il DOM sia aggiornato prima di creare la mappa
        await new Promise(resolve => setTimeout(resolve, 50));

        // Calcola bounds per zoom automatico
        const bounds = new google.maps.LatLngBounds();
        terreni.forEach(terreno => {
            terreno.polygonCoords.forEach(coord => {
                const latLng = new google.maps.LatLng(coord.lat, coord.lng);
                bounds.extend(latLng);
            });
        });

        // Crea mappa
        const map = new google.maps.Map(mapDiv, {
            center: bounds.getCenter(),
            zoom: 12,
            mapTypeId: google.maps.MapTypeId.SATELLITE,
            mapTypeControl: true,
            mapTypeControlOptions: {
                style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
                position: google.maps.ControlPosition.TOP_RIGHT
            },
            zoomControl: true,
            streetViewControl: false,
            fullscreenControl: true
        });
        
        // Forza resize della mappa per assicurarsi che venga renderizzata correttamente
        setTimeout(() => {
            google.maps.event.trigger(map, 'resize');
        }, 100);

        // Funzione per zoom intelligente con padding
        function fitBoundsWithPadding(boundsToFit, paddingPixels = 50) {
            if (!boundsToFit) {
                return;
            }
            
            try {
                const ne = boundsToFit.getNorthEast();
                const sw = boundsToFit.getSouthWest();
                
                if (!ne || !sw) {
                    return;
                }
                
                const latDiff = ne.lat() - sw.lat();
                const lngDiff = ne.lng() - sw.lng();
                
                if (latDiff === 0 && lngDiff === 0) {
                    const center = boundsToFit.getCenter();
                    if (center) {
                        map.setCenter(center);
                        map.setZoom(15);
                    }
                    return;
                }
                
                const latPadding = latDiff * (paddingPixels / 1000);
                const lngPadding = lngDiff * (paddingPixels / 1000);
                
                const expandedBounds = new google.maps.LatLngBounds(
                    new google.maps.LatLng(sw.lat() - latPadding, sw.lng() - lngPadding),
                    new google.maps.LatLng(ne.lat() + latPadding, ne.lng() + lngPadding)
                );
                
                if (latDiff < 0.0005 || lngDiff < 0.0005) {
                    const center = expandedBounds.getCenter();
                    map.setCenter(center);
                    map.setZoom(18);
                    return;
                }
                
                if (latDiff > 0.1 || lngDiff > 0.1) {
                    const largeLatPadding = latDiff * 0.1;
                    const largeLngPadding = lngDiff * 0.1;
                    expandedBounds.extend(new google.maps.LatLng(sw.lat() - largeLatPadding, sw.lng() - largeLngPadding));
                    expandedBounds.extend(new google.maps.LatLng(ne.lat() + largeLatPadding, ne.lng() + largeLngPadding));
                }
                
                map.fitBounds(expandedBounds);
            } catch (error) {
                console.warn('Errore fitBounds:', error);
                try {
                    const center = boundsToFit.getCenter();
                    if (center) {
                        map.setCenter(center);
                        map.setZoom(15);
                    }
                } catch (e) {
                    console.error('Errore fallback zoom:', e);
                }
            }
        }

        // Fit bounds iniziale con padding
        google.maps.event.addListenerOnce(map, 'idle', function() {
            fitBoundsWithPadding(bounds, 50);
        });
        
        // Gestisci ridimensionamento finestra
        let resizeTimeout;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(function() {
                if (map && bounds) {
                    google.maps.event.trigger(map, 'resize');
                    setTimeout(() => {
                        fitBoundsWithPadding(bounds, 50);
                    }, 100);
                }
            }, 250);
        });

        // Estrai poderi e colture uniche per i filtri - SOLO se Manodopera è attivo
        const poderiUnici = [...new Set(terreni.map(t => t.podere).filter(p => p))].sort();
        const coltureUniche = [...new Set(terreni.map(t => t.coltura).filter(c => c))].sort();

        // Popola dropdown filtri - SOLO se Manodopera è attivo
        const filtroPodereSelect = hasManodopera ? document.getElementById('filtro-podere') : null;
        const filtroColturaSelect = hasManodopera ? document.getElementById('filtro-coltura') : null;
        
        if (hasManodopera && filtroPodereSelect) {
            poderiUnici.forEach(podere => {
                const option = document.createElement('option');
                option.value = podere;
                option.textContent = podere;
                filtroPodereSelect.appendChild(option);
            });
        }

        if (hasManodopera && filtroColturaSelect) {
            coltureUniche.forEach(coltura => {
                const option = document.createElement('option');
                option.value = coltura;
                option.textContent = coltura;
                filtroColturaSelect.appendChild(option);
            });
        }

        // Crea poligoni per ogni terreno
        const polygons = [];
        const infoWindows = [];
        let terrenoPolygonsMap = new Map();

        terreni.forEach((terreno) => {
            const coords = terreno.polygonCoords.map(c => 
                new google.maps.LatLng(c.lat, c.lng)
            );

            const colturaNome = terreno.coltura || null;
            const colturaCategoria = terreno.colturaCategoria || null;
            const colorCategory = mapColturaToColorCategory(colturaNome, colturaCategoria);
            const colorData = colturaColors[colorCategory] || colturaColors['Default'];
            const fillColor = colorData.fill + '80';
            const strokeColor = colorData.stroke;

            // Crea poligono
            const polygon = new google.maps.Polygon({
                paths: coords,
                strokeColor: strokeColor,
                strokeOpacity: 1.0,
                strokeWeight: 3,
                fillColor: fillColor,
                fillOpacity: 0.35,
                map: map,
                terrain: {
                    id: terreno.id,
                    nome: terreno.nome,
                    superficie: terreno.superficie,
                    coltura: colturaNome || 'Default',
                    podere: terreno.podere,
                    note: terreno.note
                }
            });

            polygons.push(polygon);
            terrenoPolygonsMap.set(terreno.id, polygon);

            // Crea info window
            const infoContent = `
                <div class="mappa-info-window">
                    <h3>${escapeHtml(terreno.nome)}</h3>
                    ${terreno.podere ? `<p><strong>Podere:</strong> ${escapeHtml(terreno.podere)}</p>` : ''}
                    ${terreno.coltura ? `<p><strong>Coltura:</strong> ${escapeHtml(terreno.coltura)}</p>` : ''}
                    ${terreno.superficie ? `<p><strong>Superficie:</strong> ${terreno.superficie.toFixed(2)} ha</p>` : ''}
                    ${terreno.note ? `<p><strong>Note:</strong> ${escapeHtml(terreno.note)}</p>` : ''}
                    <p style="margin-top: 10px;">
                        <a href="terreni-standalone.html" style="color: #2E8B57; text-decoration: underline; font-size: 12px;">
                            Vedi dettagli →
                        </a>
                    </p>
                </div>
            `;

            const infoWindow = new google.maps.InfoWindow({
                content: infoContent
            });

            infoWindows.push(infoWindow);

            // Click sul poligono per aprire info window
            polygon.addListener('click', function(event) {
                infoWindows.forEach(iw => iw.close());
                infoWindow.setPosition(event.latLng);
                infoWindow.open(map);
            });
        });

        // Carica e disegna zone lavorate (overlay lavori attivi) - SOLO se Manodopera è attivo
        let overlayLavoriVisible = false;
        const zoneLavoratePolygons = [];
        const zoneLavorateInfoWindows = [];
        
        // Indicatori stato lavori - SOLO se Manodopera è attivo
        let indicatoriLavoriVisible = false;
        const lavoroMarkers = [];
        const lavoroMarkersInfoWindows = [];
        
        // Carica zone lavorate - SOLO se Manodopera è attivo
        if (hasManodopera) {
            await loadAndDrawZoneLavorate();
        }

        // Carica indicatori lavori - SOLO se Manodopera è attivo
        if (hasManodopera) {
            await loadAndDrawIndicatoriLavori();
        }

        // Funzione per caricare e disegnare zone lavorate
        async function loadAndDrawZoneLavorate() {
            if (!hasManodopera) return;
            try {
                // Usa getCurrentTenantId() invece di userData.tenantId per supportare multi-tenant
                const { getCurrentTenantId } = await import('../services/tenant-service.js');
                const currentTenantId = getCurrentTenantId() || userData.tenantId; // Fallback a userData.tenantId per retrocompatibilità
                if (!currentTenantId) {
                    return;
                }
                const lavoriCollection = collection(db, `tenants/${currentTenantId}/lavori`);
                const lavoriSnapshot = await getDocs(lavoriCollection);
                
                const lavoriAttivi = [];
                lavoriSnapshot.forEach(doc => {
                    const data = doc.data();
                    const stato = data.stato || 'assegnato';
                    if (stato !== 'completato' && stato !== 'annullato') {
                        lavoriAttivi.push({
                            id: doc.id,
                            nome: data.nome || 'Lavoro senza nome',
                            terrenoId: data.terrenoId,
                            tipoLavoro: data.tipoLavoro || '',
                            caposquadraId: data.caposquadraId,
                            dataInizio: data.dataInizio?.toDate ? data.dataInizio.toDate() : (data.dataInizio ? new Date(data.dataInizio) : null),
                            stato: stato,
                            percentualeCompletamento: data.percentualeCompletamento || 0
                        });
                    }
                });

                for (const lavoro of lavoriAttivi) {
                    try {
                        // Usa currentTenantId già ottenuto sopra
                        const zoneRef = collection(db, `tenants/${currentTenantId}/lavori/${lavoro.id}/zoneLavorate`);
                        const zoneSnapshot = await getDocs(zoneRef);
                        
                        zoneSnapshot.forEach(zonaDoc => {
                            const zonaData = zonaDoc.data();
                            if (zonaData.coordinate && Array.isArray(zonaData.coordinate) && zonaData.coordinate.length >= 3) {
                                const coords = zonaData.coordinate.map(c => 
                                    new google.maps.LatLng(c.lat, c.lng)
                                );

                                const zonaPolygon = new google.maps.Polygon({
                                    paths: coords,
                                    strokeColor: '#00FF00',
                                    strokeOpacity: 0.9,
                                    strokeWeight: 3,
                                    fillColor: '#00FF00',
                                    fillOpacity: 0.4,
                                    map: overlayLavoriVisible ? map : null,
                                    zIndex: 100,
                                    zona: {
                                        id: zonaDoc.id,
                                        lavoroId: lavoro.id,
                                        lavoroNome: lavoro.nome,
                                        tipoLavoro: lavoro.tipoLavoro,
                                        data: zonaData.data?.toDate ? zonaData.data.toDate() : (zonaData.data ? new Date(zonaData.data) : null),
                                        superficieHa: zonaData.superficieHa || 0,
                                        note: zonaData.note || ''
                                    }
                                });

                                zoneLavoratePolygons.push(zonaPolygon);

                                const zonaInfoContent = `
                                    <div class="mappa-info-window">
                                        <h3>${escapeHtml(lavoro.nome)}</h3>
                                        ${lavoro.tipoLavoro ? `<p><strong>Tipo Lavoro:</strong> ${escapeHtml(lavoro.tipoLavoro)}</p>` : ''}
                                        ${zonaData.data ? `<p><strong>Data:</strong> ${zonaData.data.toDate ? zonaData.data.toDate().toLocaleDateString('it-IT') : new Date(zonaData.data).toLocaleDateString('it-IT')}</p>` : ''}
                                        ${zonaData.superficieHa ? `<p><strong>Superficie:</strong> ${zonaData.superficieHa.toFixed(2)} ha</p>` : ''}
                                        ${lavoro.percentualeCompletamento ? `<p><strong>Completamento:</strong> ${lavoro.percentualeCompletamento.toFixed(1)}%</p>` : ''}
                                        ${zonaData.note ? `<p><strong>Note:</strong> ${escapeHtml(zonaData.note)}</p>` : ''}
                                        <p style="margin-top: 10px;">
                                            <a href="admin/gestione-lavori-standalone.html" style="color: #2E8B57; text-decoration: underline; font-size: 12px;">
                                                Vedi dettagli lavoro →
                                            </a>
                                        </p>
                                    </div>
                                `;

                                const zonaInfoWindow = new google.maps.InfoWindow({
                                    content: zonaInfoContent
                                });

                                zoneLavorateInfoWindows.push(zonaInfoWindow);

                                zonaPolygon.addListener('click', function(event) {
                                    infoWindows.forEach(iw => iw.close());
                                    zoneLavorateInfoWindows.forEach(iw => iw.close());
                                    zonaInfoWindow.setPosition(event.latLng);
                                    zonaInfoWindow.open(map);
                                });
                            }
                        });
                    } catch (error) {
                        console.warn(`Errore caricamento zone lavorate per lavoro ${lavoro.id}:`, error);
                    }
                }
            } catch (error) {
                console.error('Errore caricamento lavori attivi:', error);
            }
        }

        // Funzione per caricare e disegnare indicatori stato lavori
        async function loadAndDrawIndicatoriLavori() {
            if (!hasManodopera) return;
            try {
                // Usa currentTenantId già ottenuto sopra
                const lavoriCollection = collection(db, `tenants/${currentTenantId}/lavori`);
                const lavoriSnapshot = await getDocs(lavoriCollection);
                
                const lavoriConProgressi = [];
                const oggi = new Date();
                oggi.setHours(0, 0, 0, 0);
                
                lavoriSnapshot.forEach(doc => {
                    const data = doc.data();
                    const stato = data.stato || 'assegnato';
                    if (stato !== 'completato' && stato !== 'annullato') {
                        let giorniEffettivi = data.giorniEffettivi || 0;
                        if (data.dataInizio && data.durataPrevista) {
                            const dataInizio = data.dataInizio?.toDate 
                                ? data.dataInizio.toDate() 
                                : (data.dataInizio ? new Date(data.dataInizio) : null);
                            if (dataInizio) {
                                const dataInizioSenzaOra = new Date(dataInizio);
                                dataInizioSenzaOra.setHours(0, 0, 0, 0);
                                giorniEffettivi = Math.max(0, Math.floor((oggi - dataInizioSenzaOra) / (1000 * 60 * 60 * 24)) + 1);
                            }
                        }
                        
                        lavoriConProgressi.push({
                            id: doc.id,
                            nome: data.nome || 'Lavoro senza nome',
                            terrenoId: data.terrenoId,
                            tipoLavoro: data.tipoLavoro || '',
                            caposquadraId: data.caposquadraId,
                            dataInizio: data.dataInizio?.toDate ? data.dataInizio.toDate() : (data.dataInizio ? new Date(data.dataInizio) : null),
                            durataPrevista: data.durataPrevista || 0,
                            stato: stato,
                            percentualeCompletamento: data.percentualeCompletamento || 0,
                            statoProgresso: data.statoProgresso || null,
                            superficieTotaleLavorata: data.superficieTotaleLavorata || 0,
                            giorniEffettivi: giorniEffettivi
                        });
                    }
                });

                for (const lavoro of lavoriConProgressi) {
                    try {
                        const terreno = terreni.find(t => t.id === lavoro.terrenoId);
                        if (!terreno || !terreno.polygonCoords || terreno.polygonCoords.length < 3) {
                            continue;
                        }
                        
                        if (!lavoro.statoProgresso && lavoro.dataInizio && lavoro.durataPrevista && lavoro.giorniEffettivi > 0) {
                            const superficieTotale = terreno.superficie || 0;
                            const superficieLavorata = lavoro.superficieTotaleLavorata || 0;
                            
                            let percentualeCompletamento = lavoro.percentualeCompletamento;
                            if (!percentualeCompletamento && superficieTotale > 0) {
                                percentualeCompletamento = (superficieLavorata / superficieTotale) * 100;
                            }
                            
                            const percentualeTempo = (lavoro.giorniEffettivi / lavoro.durataPrevista) * 100;
                            const tolleranza = 10;
                            
                            if (percentualeCompletamento > percentualeTempo + tolleranza) {
                                lavoro.statoProgresso = 'in_anticipo';
                            } else if (percentualeCompletamento < percentualeTempo - tolleranza) {
                                lavoro.statoProgresso = 'in_ritardo';
                            } else {
                                lavoro.statoProgresso = 'in_tempo';
                            }
                            
                            if (!lavoro.percentualeCompletamento && superficieTotale > 0) {
                                lavoro.percentualeCompletamento = percentualeCompletamento;
                            }
                        }

                        const centro = getPolygonCenter(terreno.polygonCoords);
                        const position = new google.maps.LatLng(centro.lat, centro.lng);

                        let markerColor = '#2E8B57';
                        let markerIcon = '🟢';
                        let markerLabel = '';

                        if (lavoro.statoProgresso === 'in_ritardo') {
                            markerColor = '#DC3545';
                            markerIcon = '🔴';
                            markerLabel = 'R';
                        } else if (lavoro.statoProgresso === 'in_anticipo') {
                            markerColor = '#28A745';
                            markerIcon = '🟢';
                            markerLabel = 'A';
                        } else if (lavoro.statoProgresso === 'in_tempo') {
                            markerColor = '#FFC107';
                            markerIcon = '🟡';
                            markerLabel = 'T';
                        } else {
                            if (lavoro.stato === 'in_corso') {
                                markerColor = '#17A2B8';
                                markerIcon = '🔵';
                                markerLabel = 'C';
                            } else {
                                markerColor = '#6C757D';
                                markerIcon = '⚪';
                                markerLabel = 'A';
                            }
                        }

                        const markerIconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
                                <circle cx="16" cy="16" r="14" fill="${markerColor}" stroke="white" stroke-width="2"/>
                                <text x="16" y="22" font-size="16" font-weight="bold" fill="white" text-anchor="middle">${markerLabel}</text>
                            </svg>
                        `)}`;

                        const marker = new google.maps.Marker({
                            position: position,
                            map: indicatoriLavoriVisible ? map : null,
                            icon: {
                                url: markerIconUrl,
                                scaledSize: new google.maps.Size(32, 32),
                                anchor: new google.maps.Point(16, 16)
                            },
                            title: `${lavoro.nome} - ${lavoro.statoProgresso || lavoro.stato}`,
                            zIndex: 200,
                            lavoro: {
                                id: lavoro.id,
                                nome: lavoro.nome,
                                tipoLavoro: lavoro.tipoLavoro,
                                terrenoNome: terreno.nome,
                                stato: lavoro.stato,
                                statoProgresso: lavoro.statoProgresso,
                                percentualeCompletamento: lavoro.percentualeCompletamento,
                                superficieTotaleLavorata: lavoro.superficieTotaleLavorata,
                                giorniEffettivi: lavoro.giorniEffettivi,
                                durataPrevista: lavoro.durataPrevista,
                                dataInizio: lavoro.dataInizio
                            }
                        });

                        lavoroMarkers.push(marker);

                        const statoProgressoFormattato = lavoro.statoProgresso 
                            ? (lavoro.statoProgresso === 'in_anticipo' ? '🟢 In anticipo' : 
                               lavoro.statoProgresso === 'in_tempo' ? '🟡 In tempo' : 
                               '🔴 In ritardo')
                            : '⏳ Non disponibile';

                        const statoLavoroFormattato = lavoro.stato === 'in_corso' ? '🔄 In corso' :
                                                      lavoro.stato === 'assegnato' ? '📋 Assegnato' :
                                                      lavoro.stato;

                        const lavoroInfoContent = `
                            <div class="mappa-info-window">
                                <h3>${escapeHtml(lavoro.nome)}</h3>
                                <p><strong>Terreno:</strong> ${escapeHtml(terreno.nome)}</p>
                                ${lavoro.tipoLavoro ? `<p><strong>Tipo Lavoro:</strong> ${escapeHtml(lavoro.tipoLavoro)}</p>` : ''}
                                <p><strong>Stato:</strong> ${statoLavoroFormattato}</p>
                                <p><strong>Progresso:</strong> ${statoProgressoFormattato}</p>
                                ${lavoro.percentualeCompletamento ? `<p><strong>Completamento:</strong> ${lavoro.percentualeCompletamento.toFixed(1)}%</p>` : ''}
                                ${lavoro.superficieTotaleLavorata ? `<p><strong>Superficie Lavorata:</strong> ${lavoro.superficieTotaleLavorata.toFixed(2)} ha</p>` : ''}
                                ${lavoro.dataInizio ? `<p><strong>Data Inizio:</strong> ${lavoro.dataInizio.toLocaleDateString('it-IT')}</p>` : ''}
                                ${lavoro.durataPrevista ? `<p><strong>Durata Prevista:</strong> ${lavoro.durataPrevista} giorni</p>` : ''}
                                ${lavoro.giorniEffettivi ? `<p><strong>Giorni Trascorsi:</strong> ${lavoro.giorniEffettivi}</p>` : ''}
                                <p style="margin-top: 10px;">
                                    <a href="admin/gestione-lavori-standalone.html" style="color: #2E8B57; text-decoration: underline; font-size: 12px;">
                                        Vedi dettagli lavoro →
                                    </a>
                                </p>
                            </div>
                        `;

                        const lavoroInfoWindow = new google.maps.InfoWindow({
                            content: lavoroInfoContent
                        });

                        lavoroMarkersInfoWindows.push(lavoroInfoWindow);

                        marker.addListener('click', function() {
                            infoWindows.forEach(iw => iw.close());
                            zoneLavorateInfoWindows.forEach(iw => iw.close());
                            lavoroMarkersInfoWindows.forEach(iw => iw.close());
                            lavoroInfoWindow.open(map, marker);
                        });
                    } catch (error) {
                        console.warn(`Errore creazione marker per lavoro ${lavoro.id}:`, error);
                    }
                }
            } catch (error) {
                console.error('Errore caricamento indicatori lavori:', error);
            }
        }

        // Funzione per filtrare terreni visualizzati
        function applyFilters() {
            if (!hasManodopera) return;
            
            const podereFiltro = filtroPodereSelect ? filtroPodereSelect.value : '';
            const colturaFiltro = filtroColturaSelect ? filtroColturaSelect.value : '';
            
            let terreniVisibili = 0;
            const boundsFiltro = new google.maps.LatLngBounds();
            
            terreni.forEach(terreno => {
                const polygon = terrenoPolygonsMap.get(terreno.id);
                if (!polygon) return;
                
                const matchPodere = !podereFiltro || terreno.podere === podereFiltro;
                const matchColtura = !colturaFiltro || terreno.coltura === colturaFiltro;
                
                if (matchPodere && matchColtura) {
                    polygon.setMap(map);
                    terreniVisibili++;
                    terreno.polygonCoords.forEach(coord => {
                        boundsFiltro.extend(new google.maps.LatLng(coord.lat, coord.lng));
                    });
                } else {
                    polygon.setMap(null);
                }
            });
            
            if (terreniVisibili > 0 && boundsFiltro.getNorthEast()) {
                fitBoundsWithPadding(boundsFiltro, 50);
            }
            
            updateLegenda(podereFiltro, colturaFiltro);
        }

        // Funzione per aggiornare legenda
        function updateLegenda(podereFiltro, colturaFiltro) {
            const coltureVisibili = [...new Set(
                terreni
                    .filter(t => {
                        if (hasManodopera) {
                            const matchPodere = !podereFiltro || t.podere === podereFiltro;
                            const matchColtura = !colturaFiltro || t.coltura === colturaFiltro;
                            return matchPodere && matchColtura;
                        } else {
                            return true;
                        }
                    })
                    .map(t => t.coltura)
                    .filter(c => c)
            )];
            
            const legendaEsistente = container.querySelector('.mappa-legenda');
            if (legendaEsistente) {
                legendaEsistente.remove();
            }
            
            if (coltureVisibili.length > 0 || (hasManodopera && zoneLavoratePolygons.length > 0)) {
                const legendaDiv = document.createElement('div');
                legendaDiv.className = 'mappa-legenda';
                legendaDiv.innerHTML = `
                    <h4>Legenda</h4>
                    ${coltureVisibili.length > 0 ? `
                        <div style="margin-bottom: 15px;">
                            <strong style="font-size: 11px; color: #666;">Colture:</strong>
                            ${coltureVisibili.map(colturaNome => {
                                const terrenoEsempio = terreni.find(t => t.coltura === colturaNome);
                                const colturaCategoria = terrenoEsempio?.colturaCategoria || null;
                                const colorCategory = mapColturaToColorCategory(colturaNome, colturaCategoria);
                                const colorData = colturaColors[colorCategory] || colturaColors['Default'];
                                const color = colorData.fill || colorData;
                                return `
                                    <div class="mappa-legenda-item">
                                        <div class="mappa-legenda-color" style="background-color: ${color};"></div>
                                        <span>${escapeHtml(colturaNome)}</span>
                                    </div>
                                `;
                            }).join('')}
                            ${terreni.some(t => {
                                if (hasManodopera) {
                                    const matchPodere = !podereFiltro || t.podere === podereFiltro;
                                    const matchColtura = !colturaFiltro || t.coltura === colturaFiltro;
                                    return matchPodere && matchColtura && !t.coltura;
                                } else {
                                    return !t.coltura;
                                }
                            }) ? `
                                <div class="mappa-legenda-item">
                                    <div class="mappa-legenda-color" style="background-color: ${colturaColors['Default'].fill || colturaColors['Default']};"></div>
                                    <span>Non specificato</span>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                    ${hasManodopera && zoneLavoratePolygons.length > 0 ? `
                        <div style="margin-top: ${coltureVisibili.length > 0 ? '15px' : '0'}; padding-top: ${coltureVisibili.length > 0 ? '15px' : '0'}; ${coltureVisibili.length > 0 ? 'border-top: 1px solid #ddd;' : ''}">
                            <strong style="font-size: 11px; color: #666;">Zone Lavorate:</strong>
                            <div class="mappa-legenda-item">
                                <div class="mappa-legenda-color" style="background-color: #00FF00; border: 2px solid #00FF00;"></div>
                                <span>Zone lavorate attive</span>
                            </div>
                        </div>
                    ` : ''}
                    ${hasManodopera && lavoroMarkers.length > 0 ? `
                        <div style="margin-top: ${(coltureVisibili.length > 0 || zoneLavoratePolygons.length > 0) ? '15px' : '0'}; padding-top: ${(coltureVisibili.length > 0 || zoneLavoratePolygons.length > 0) ? '15px' : '0'}; ${(coltureVisibili.length > 0 || zoneLavoratePolygons.length > 0) ? 'border-top: 1px solid #ddd;' : ''}">
                            <strong style="font-size: 11px; color: #666;">Indicatori Lavori:</strong>
                            <div class="mappa-legenda-item">
                                <span style="font-size: 16px; margin-right: 5px;">🔴</span>
                                <span>In ritardo</span>
                            </div>
                            <div class="mappa-legenda-item">
                                <span style="font-size: 16px; margin-right: 5px;">🟡</span>
                                <span>In tempo</span>
                            </div>
                            <div class="mappa-legenda-item">
                                <span style="font-size: 16px; margin-right: 5px;">🟢</span>
                                <span>In anticipo</span>
                            </div>
                            <div class="mappa-legenda-item">
                                <span style="font-size: 16px; margin-right: 5px;">🔵</span>
                                <span>In corso</span>
                            </div>
                        </div>
                    ` : ''}
                `;
                container.appendChild(legendaDiv);
            }
        }

        // Event listener per filtri - SOLO se Manodopera è attivo
        if (hasManodopera) {
            if (filtroPodereSelect) {
                filtroPodereSelect.addEventListener('change', applyFilters);
            }
            if (filtroColturaSelect) {
                filtroColturaSelect.addEventListener('change', applyFilters);
            }
        }

        // Toggle overlay lavori attivi
        const toggleOverlayBtn = document.getElementById('toggle-overlay-lavori');
        if (hasManodopera && toggleOverlayBtn) {
            toggleOverlayBtn.addEventListener('click', function() {
                overlayLavoriVisible = !overlayLavoriVisible;
                
                zoneLavoratePolygons.forEach(polygon => {
                    if (overlayLavoriVisible) {
                        polygon.setMap(map);
                    } else {
                        polygon.setMap(null);
                    }
                });

                if (overlayLavoriVisible) {
                    toggleOverlayBtn.classList.add('active');
                    toggleOverlayBtn.innerHTML = '<span>👷</span> Zone Lavorate <span style="color: #00FF00;">●</span>';
                } else {
                    toggleOverlayBtn.classList.remove('active');
                    toggleOverlayBtn.innerHTML = '<span>👷</span> Zone Lavorate';
                }
            });
        }

        // Toggle indicatori lavori attivi
        const toggleIndicatoriBtn = document.getElementById('toggle-indicatori-lavori');
        if (hasManodopera && toggleIndicatoriBtn) {
            toggleIndicatoriBtn.addEventListener('click', function() {
                indicatoriLavoriVisible = !indicatoriLavoriVisible;
                
                lavoroMarkers.forEach(marker => {
                    if (indicatoriLavoriVisible) {
                        marker.setMap(map);
                    } else {
                        marker.setMap(null);
                    }
                });

                if (indicatoriLavoriVisible) {
                    toggleIndicatoriBtn.classList.add('active');
                    toggleIndicatoriBtn.innerHTML = '<span>📍</span> Indicatori Lavori <span style="color: #2E8B57;">●</span>';
                } else {
                    toggleIndicatoriBtn.classList.remove('active');
                    toggleIndicatoriBtn.innerHTML = '<span>📍</span> Indicatori Lavori';
                }
            });
        }

        // Crea legenda iniziale
        updateLegenda('', '');

    } catch (error) {
        console.error('❌ Errore caricamento mappa aziendale:', error);
        console.error('Stack trace:', error.stack);
        console.error('Google Maps disponibile?', typeof google !== 'undefined' ? 'Sì' : 'No');
        console.error('google.maps disponibile?', typeof google !== 'undefined' && google.maps ? 'Sì' : 'No');
        
        const errorMessage = error?.message || 'Errore sconosciuto';
        const escapedMessage = escapeHtml ? escapeHtml(errorMessage) : errorMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        container.innerHTML = `
            <div class="mappa-loading">
                <h3 style="color: #dc3545; margin-bottom: 15px;">⚠️ Errore</h3>
                <p>Errore durante il caricamento della mappa: ${escapedMessage}</p>
                <p style="margin-top: 10px; font-size: 12px; color: #666;">
                    Vai alla gestione terreni per tracciare i confini
                </p>
                <p style="margin-top: 5px; font-size: 12px; color: #666;">
                    Verifica che la chiave API sia configurata correttamente nel file di configurazione.
                </p>
            </div>
        `;
    }
}

