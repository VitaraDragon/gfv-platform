/**
 * Terreni Controller - Logica principale gestione terreni
 * 
 * @module core/js/terreni-controller
 */

// ============================================
// IMPORTS
// ============================================
// Le importazioni Firebase verranno fatte nel file HTML principale
// Questo modulo assume che db, auth, currentTenantId siano disponibili globalmente

// ============================================
// STATE MANAGEMENT
// ============================================
// Gestione state tramite variabili globali (temporaneo, per compatibilità)
// In futuro potremmo usare un state object centralizzato

// ============================================
// FUNZIONI HELPER
// ============================================

/**
 * Verifica se una coltura è un frutteto
 * @param {string} coltura - Nome della coltura
 * @returns {boolean} true se è un frutteto
 */
function isColturaFrutteto(coltura) {
    if (!coltura) return false;
    const colturaLower = coltura.toLowerCase();
    // Lista colture frutteto (basata su colture-service.js)
    const coltureFrutteto = [
        'pesco', 'melo', 'pero', 'albicocche', 'prugne', 'ciliegio', 'susino', 'fico',
        'nocciolo', 'mandorlo', 'castagno', 'cotogno', 'sorbo', 'nespolo', 'giuggiolo',
        'corbezzolo', 'gelso', 'mora', 'lampone', 'mirtillo', 'ribes', 'uva spina',
        'kiwi', 'melograno', 'fico d\'india', 'kaki', 'noce', 'pistacchio', 'frutteto'
    ];
    return coltureFrutteto.some(f => colturaLower.includes(f));
}

/** Restituisce categoria display (Vigneto, Frutteto, Seminativo) da nome coltura */
export function getCategoriaFromColtura(coltura) {
    if (!coltura) return null;
    const k = String(coltura).toLowerCase().trim();
    if (k.includes('vite')) return 'Vigneto';
    if (isColturaFrutteto(coltura)) return 'Frutteto';
    const seminativo = ['grano', 'mais', 'orzo', 'favino', 'girasole', 'soia', 'colza', 'avena', 'segale', 'riso'];
    if (seminativo.some(s => k.includes(s))) return 'Seminativo';
    return null;
}

/**
 * Attende che le configurazioni Firebase e Google Maps siano caricate
 * @returns {Promise<void>}
 */
export function waitForConfig() {
    return new Promise((resolve, reject) => {
        if (typeof window.firebaseConfig !== 'undefined' && typeof window.GOOGLE_MAPS_API_KEY !== 'undefined') {
            resolve();
            return;
        }
        
        let attempts = 0;
        const maxAttempts = 50; // 5 secondi
        
        const checkInterval = setInterval(() => {
            attempts++;
            if (typeof window.firebaseConfig !== 'undefined' && typeof window.GOOGLE_MAPS_API_KEY !== 'undefined') {
                clearInterval(checkInterval);
                resolve();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                if (typeof window.firebaseConfig === 'undefined') {
                    reject(new Error('Firebase config not loaded after 5 seconds'));
                } else {
                    console.warn('Google Maps API key not found. Maps will not be available.');
                    resolve(); // Continua comunque senza Maps
                }
            }
        }, 100);
    });
}

/**
 * Ottiene tenant ID dall'utente
 * @param {string} userId - ID utente
 * @param {Object} db - Istanza Firestore
 * @param {string} currentTenantId - Tenant ID corrente (se già disponibile)
 * @returns {Promise<string|null>}
 */
export async function getTenantId(userId, db, currentTenantId = null) {
    if (currentTenantId) return currentTenantId;
    
    try {
        const { getDoc, doc } = await import('../services/firebase-service.js');
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            return userData.tenantId;
        }
    } catch (error) {
        console.error('Errore recupero tenant:', error);
    }
    return null;
}

/**
 * Ottiene riferimento collection terreni per tenant
 * @param {string} tenantId - ID tenant
 * @param {Object} db - Istanza Firestore
 * @returns {Promise<Object>} Collection reference
 */
export async function getTerreniCollection(tenantId, _db) {
    if (!tenantId) throw new Error('Tenant ID non disponibile');
    const { getCollection } = await import('../services/firebase-service.js');
    return getCollection('terreni', tenantId);
}

// ============================================
// FUNZIONI CARICAMENTO DATI
// ============================================

/**
 * Carica lista poderi da Firestore
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Array} poderi - Array poderi (modificato in place)
 */
export async function loadPoderi(currentTenantId, _db, poderi) {
    try {
        if (!currentTenantId) return;
        
        const { getCollectionData } = await import('../services/firebase-service.js');
        const documents = await getCollectionData('poderi', {
            tenantId: currentTenantId,
            orderBy: 'nome',
            orderDirection: 'asc'
        });
        
        poderi.length = 0; // Svuota array
        documents.forEach((doc) => {
            poderi.push({
                id: doc.id,
                nome: doc.nome || ''
            });
        });
        
        // Popola dropdown poderi
        populatePoderiDropdown(poderi);
    } catch (error) {
        console.error('Errore caricamento poderi:', error);
        poderi.length = 0;
    }
}

/**
 * Popola dropdown poderi nel form
 * @param {Array} poderi - Array poderi
 */
export function populatePoderiDropdown(poderi) {
    const podereSelect = document.getElementById('terreno-podere');
    if (!podereSelect) return;
    
    // Mantieni opzione vuota
    podereSelect.innerHTML = '<option value="">-- Nessun podere --</option>';
    
    // Aggiungi poderi
    poderi.forEach(podere => {
        const option = document.createElement('option');
        option.value = podere.nome;
        option.textContent = podere.nome;
        podereSelect.appendChild(option);
    });
}

/**
 * Inizializza colture predefinite se non presenti (fallback per ambiente file://)
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 */
export async function initializeColturePredefiniteTerreni(currentTenantId, db) {
    try {
        if (!currentTenantId) return;
        // Delega al servizio centralizzato (id deterministici + writeBatch + ripresa)
        const { setCurrentTenantId } = await import('../services/tenant-service.js');
        setCurrentTenantId(currentTenantId);
        const { initializeColturePredefinite } = await import('../services/colture-service.js');
        await initializeColturePredefinite();
    } catch (error) {
        console.error('Errore inizializzazione colture predefinite:', error);
    }
}

/**
 * Carica categorie per colture usando categorie-service.js
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Object} app - Istanza Firebase App
 * @param {Object} auth - Istanza Firebase Auth
 * @param {Array} categorieColtureTerreni - Array categorie (modificato in place)
 */
export async function loadCategorieColtureTerreni(currentTenantId, db, app, auth, categorieColtureTerreni) {
    try {
        if (!currentTenantId) return;

        // Verifica se siamo in ambiente file:// (non supportato per moduli ES6)
        const isFileProtocol = window.location.protocol === 'file:';
        
        if (isFileProtocol) {
            // Fallback: carica direttamente da Firestore
            const { collection, getDocs } = await import('../services/firebase-service.js');
            const categorieRef = collection(db, `tenants/${currentTenantId}/categorie`);
            const categorieSnapshot = await getDocs(categorieRef);
            
            categorieColtureTerreni.length = 0; // Svuota array
            categorieSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.applicabileA === 'colture') {
                    categorieColtureTerreni.push({ id: doc.id, ...data });
                }
            });
            
            categorieColtureTerreni.sort((a, b) => {
                const ordineA = a.ordine || 999;
                const ordineB = b.ordine || 999;
                return ordineA - ordineB;
            });
        } else {
            // Usa categorie-service.js invece di caricamento diretto
            // Assicura che Firebase sia inizializzato nel servizio
            const { setFirebaseInstances } = await import('../services/firebase-service.js');
            setFirebaseInstances({ app, db, auth });
            
            // Assicura che il tenantId sia impostato nel servizio
            const { setCurrentTenantId } = await import('../services/tenant-service.js');
            if (currentTenantId) {
                setCurrentTenantId(currentTenantId);
            }
            
            const { getAllCategorie } = await import('../services/categorie-service.js');
            const categorie = await getAllCategorie({
                applicabileA: 'colture',
                orderBy: 'ordine',
                orderDirection: 'asc'
            });

            categorieColtureTerreni.length = 0; // Svuota array
            categorieColtureTerreni.push(...categorie);
        }

        // Popola dropdown con una sola voce per codice (copia canonica). L'array di stato
        // resta con TUTTE le copie: serve dopo per unire le colture di ogni copia sotto il canonico.
        popolaSelectCategorieColture(
            document.getElementById('terreno-coltura-categoria'),
            raggruppaCategorie(categorieColtureTerreni).canoniche,
            null
        );
    } catch (error) {
        console.error('Errore caricamento categorie colture:', error);
    }
}

/**
 * Carica colture organizzate per categoria usando colture-service.js
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Object} app - Istanza Firebase App
 * @param {Object} auth - Istanza Firebase Auth
 * @param {Object} colturePerCategoriaTerreni - Oggetto {categoriaId: [colture]} (modificato in place)
 * @param {Array} colture - Array colture (modificato in place, per retrocompatibilità)
 * @param {Array|null} [categorieColtureTerreni=null] - Categorie già caricate (per ripopolare il select dopo seed)
 */
export async function loadColturePerCategoriaTerreni(currentTenantId, db, app, auth, colturePerCategoriaTerreni, colture, categorieColtureTerreni = null) {
    try {
        if (!currentTenantId) return;

        // Verifica se siamo in ambiente file:// (non supportato per moduli ES6)
        const isFileProtocol = window.location.protocol === 'file:';
        
        if (isFileProtocol) {
            // Fallback: carica direttamente da Firestore
            const { collection, getDocs, doc, getDoc } = await import('../services/firebase-service.js');
            const coltureRef = collection(db, `tenants/${currentTenantId}/colture`);
            let coltureSnapshot = await getDocs(coltureRef);
            
            // Completa colture predefinite mancanti (ripresa seed interrotto)
            await initializeColturePredefiniteTerreni(currentTenantId, db);
            coltureSnapshot = await getDocs(coltureRef);
            
            // Svuota oggetto
            Object.keys(colturePerCategoriaTerreni).forEach(key => delete colturePerCategoriaTerreni[key]);
            
            const coltureArray = [];
            coltureSnapshot.forEach(doc => {
                coltureArray.push({ id: doc.id, ...doc.data() });
            });
            
            coltureArray.sort((a, b) => {
                const nomeA = (a.nome || '').toLowerCase();
                const nomeB = (b.nome || '').toLowerCase();
                return nomeA.localeCompare(nomeB);
            });
            
            // Carica categorie valide per filtrare
            const categorieRef = collection(db, `tenants/${currentTenantId}/categorie`);
            const categorieSnapshot = await getDocs(categorieRef);
            const categorieValideSet = new Set();
            categorieSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.applicabileA === 'colture') {
                    categorieValideSet.add(doc.id);
                }
            });
            
            // Organizza per categoria
            coltureArray.forEach(coltura => {
                const categoriaId = coltura.categoriaId || 'senza_categoria';
                
                if (categoriaId !== 'senza_categoria' && !categorieValideSet.has(categoriaId)) {
                    const categoriaIdCorretto = 'senza_categoria';
                    if (!colturePerCategoriaTerreni[categoriaIdCorretto]) {
                        colturePerCategoriaTerreni[categoriaIdCorretto] = [];
                    }
                    colturePerCategoriaTerreni[categoriaIdCorretto].push(coltura);
                    return;
                }
                
                if (!colturePerCategoriaTerreni[categoriaId]) {
                    colturePerCategoriaTerreni[categoriaId] = [];
                }
                colturePerCategoriaTerreni[categoriaId].push(coltura);
            });
        } else {
            // Assicura che Firebase sia inizializzato nel servizio
            const { setFirebaseInstances } = await import('../services/firebase-service.js');
            setFirebaseInstances({ app, db, auth });
            
            // Assicura che il tenantId sia impostato nel servizio
            const { setCurrentTenantId } = await import('../services/tenant-service.js');
            if (currentTenantId) {
                setCurrentTenantId(currentTenantId);
            }
            
            // Assicura che le categorie siano inizializzate prima delle colture
            const { initializeCategoriePredefinite } = await import('../services/categorie-service.js');
            const { initializeColturePredefinite, getColturePerCategoria } = await import('../services/colture-service.js');
            
            // Inizializza prima le categorie (necessarie per le colture)
            try {
                await initializeCategoriePredefinite();
            } catch (catError) {
                console.warn('⚠️ Errore inizializzazione categorie (potrebbero già esistere):', catError.message);
            }
            
            // Completa colture predefinite mancanti (ripresa seed interrotto; no-op se già complete)
            await initializeColturePredefinite();

            // Usa colture-service.js invece di caricamento diretto
            const colturePerCategoria = await getColturePerCategoria();
            
            // Svuota oggetto
            Object.keys(colturePerCategoriaTerreni).forEach(key => delete colturePerCategoriaTerreni[key]);
            
            // Copia dati
            Object.assign(colturePerCategoriaTerreni, colturePerCategoria);
        }

        // Unisci le colture di tutte le copie omonime sotto la categoria canonica
        if (Array.isArray(categorieColtureTerreni) && categorieColtureTerreni.length > 0) {
            const { aliasToCanon } = raggruppaCategorie(categorieColtureTerreni);
            const unite = unisciColturePerCategoria(colturePerCategoriaTerreni, aliasToCanon);
            Object.keys(colturePerCategoriaTerreni).forEach(key => delete colturePerCategoriaTerreni[key]);
            Object.assign(colturePerCategoriaTerreni, unite);
        }

        // Estrai tutte le colture per retrocompatibilità
        colture.length = 0; // Svuota array
        Object.values(colturePerCategoriaTerreni).forEach(coltureList => {
            coltureList.forEach(c => colture.push(c.nome));
        });

        // Dopo seed/caricamento: ripopola il select categorie con dedupe usando le colture note
        if (Array.isArray(categorieColtureTerreni)) {
            popolaSelectCategorieColture(
                document.getElementById('terreno-coltura-categoria'),
                raggruppaCategorie(categorieColtureTerreni).canoniche,
                colturePerCategoriaTerreni
            );
        }

        // Aggiorna il dropdown colture se c'è già una categoria selezionata
        const categoriaSelect = document.getElementById('terreno-coltura-categoria');
        if (categoriaSelect && categoriaSelect.value && window.updateColtureDropdownTerreni) {
            window.updateColtureDropdownTerreni();
        }
    } catch (error) {
        console.error('Errore caricamento colture:', error);
        // Fallback: liste piatte — NON lasciare select categorie piene con mappa colture vuota
        console.warn('Impossibile caricare da colture, uso ListePersonalizzate:', error.message);
        Object.keys(colturePerCategoriaTerreni).forEach(key => delete colturePerCategoriaTerreni[key]);
        const { doc, getDoc } = await import('../services/firebase-service.js');
        const listeRef = doc(db, `tenants/${currentTenantId}/liste`, 'personalizzate');
        const listeSnap = await getDoc(listeRef);
        
        if (listeSnap.exists()) {
            const data = listeSnap.data();
            colture.length = 0;
            colture.push(...(data.colture || []));
        } else {
            colture.length = 0;
            colture.push('Vite', 'Frutteto', 'Seminativo', 'Orto', 'Prato', 'Olivo', 'Agrumeto', 'Bosco');
        }

        popolaSelectCategorieColture(
            document.getElementById('terreno-coltura-categoria'),
            Array.isArray(categorieColtureTerreni) ? categorieColtureTerreni : [],
            colturePerCategoriaTerreni,
            {
                messaggioErrore: '-- Errore caricamento colture: riprova o ricarica la pagina --',
            }
        );
        if (Array.isArray(categorieColtureTerreni)) {
            // Non fingere che le categorie orfane funzionino: svuota lo stato categorie del form
            categorieColtureTerreni.length = 0;
        }
    }
}

/**
 * Carica colture (wrapper per retrocompatibilità)
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Object} app - Istanza Firebase App
 * @param {Object} auth - Istanza Firebase Auth
 * @param {Array} categorieColtureTerreni - Array categorie (modificato in place)
 * @param {Object} colturePerCategoriaTerreni - Oggetto {categoriaId: [colture]} (modificato in place)
 * @param {Array} colture - Array colture (modificato in place)
 */
export async function loadColture(currentTenantId, db, app, auth, categorieColtureTerreni, colturePerCategoriaTerreni, colture) {
    await loadCategorieColtureTerreni(currentTenantId, db, app, auth, categorieColtureTerreni);
    await loadColturePerCategoriaTerreni(
        currentTenantId, db, app, auth, colturePerCategoriaTerreni, colture, categorieColtureTerreni
    );
    // Ripopola a fine carico se le categorie ci sono ancora (dopo catch di fallback
    // categorieColtureTerreni è vuoto e il select mostra già il messaggio di errore).
    if (Array.isArray(categorieColtureTerreni) && categorieColtureTerreni.length > 0) {
        popolaSelectCategorieColture(
            document.getElementById('terreno-coltura-categoria'),
            raggruppaCategorie(categorieColtureTerreni).canoniche,
            colturePerCategoriaTerreni
        );
        const categoriaSelect = document.getElementById('terreno-coltura-categoria');
        if (categoriaSelect && categoriaSelect.value && window.updateColtureDropdownTerreni) {
            window.updateColtureDropdownTerreni();
        }
    }
}

// ============================================
// IMPORTS UTILITY
// ============================================
import { escapeHtml, calcolaAlertAffitto, formattaDataScadenza, showAlert } from './terreni-utils.js';
import { popolaSelectCategorieColture } from './terreni-categorie-colture.js';
import { raggruppaCategorie, unisciColturePerCategoria } from './catalogo-dedupe.js';

// ============================================
// FUNZIONI PRINCIPALI
// ============================================

/**
 * Carica tutti i terreni del tenant da Firestore
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} auth - Istanza Firebase Auth
 * @param {Object} db - Istanza Firestore
 * @param {Array} terreni - Array terreni (modificato in place)
 * @param {Array} terreniFiltrati - Array terreni filtrati (modificato in place)
 * @param {Function} renderTerreniCallback - Callback per renderizzare terreni dopo caricamento
 */
/**
 * Calcola superficie da mappa (helper interno)
 * @param {Object} terreno - Dati terreno
 * @param {string} terrenoId - ID terreno
 * @param {Object} terreniCollection - Riferimento collection terreni
 * @returns {number|null} Superficie calcolata o null
 */
async function calcolaSuperficieDaMappa(terreno, terrenoId, terreniCollection) {
    if (!terreno.polygonCoords || !Array.isArray(terreno.polygonCoords) || terreno.polygonCoords.length < 3) {
        return terreno.superficie || null;
    }
    
    let superficie = terreno.superficie || null;
    
    try {
        if (window.googleMapsReady && google && google.maps && google.maps.geometry) {
            // Usa Google Maps Geometry per calcolo preciso
            const coords = terreno.polygonCoords.map(c => {
                if (c.lat && c.lng) {
                    return new google.maps.LatLng(c.lat, c.lng);
                }
                return c;
            });
            
            const area = google.maps.geometry.spherical.computeArea(coords);
            superficie = area / 10000; // Converti da m² a ettari
            
            // Salva automaticamente la superficie calcolata (in background)
            if (superficie > 0 && superficie < 10000 && terreniCollection) {
                setTimeout(async () => {
                    try {
                        const { doc, updateDoc, serverTimestamp } = await import('../services/firebase-service.js');
                        const terrenoRef = doc(terreniCollection, terrenoId);
                        await updateDoc(terrenoRef, { 
                            superficie: parseFloat(superficie.toFixed(2)),
                            updatedAt: serverTimestamp()
                        });
                    } catch (e) {
                        console.warn('Errore salvataggio superficie calcolata:', e);
                    }
                }, 1000);
            }
        } else {
            // Fallback: calcolo approssimato usando formula Shoelace
            const coords = terreno.polygonCoords.map(c => {
                if (c.lat && c.lng) {
                    return { lat: c.lat, lng: c.lng };
                }
                return c;
            });
            
            if (coords.length >= 3) {
                // Formula Shoelace per calcolo area poligono
                let area = 0;
                for (let i = 0; i < coords.length; i++) {
                    const j = (i + 1) % coords.length;
                    area += coords[i].lng * coords[j].lat;
                    area -= coords[j].lng * coords[i].lat;
                }
                area = Math.abs(area) / 2;
                
                // Conversione approssimata
                const latMedia = coords.reduce((sum, c) => sum + c.lat, 0) / coords.length;
                const latRad = latMedia * Math.PI / 180;
                const lngToM = 111320 * Math.cos(latRad);
                const latToM = 110540;
                
                const areaM2 = area * lngToM * latToM;
                superficie = areaM2 / 10000; // Converti in ettari
                
                // Se la superficie calcolata è ragionevole, usala
                if (superficie > 0 && superficie < 10000 && terreniCollection) {
                    setTimeout(async () => {
                        try {
                            const { doc, updateDoc, serverTimestamp } = await import('../services/firebase-service.js');
                            const terrenoRef = doc(terreniCollection, terrenoId);
                            await updateDoc(terrenoRef, { 
                                superficie: parseFloat(superficie.toFixed(2)),
                                updatedAt: serverTimestamp()
                            });
                        } catch (e) {
                            console.warn('Errore salvataggio superficie calcolata:', e);
                        }
                    }, 1000);
                } else {
                    superficie = terreno.superficie || null;
                }
            }
        }
    } catch (e) {
        console.warn('Errore calcolo superficie da mappa:', e);
        superficie = terreno.superficie || null;
    }
    
    return superficie;
}

export async function loadTerreni(currentTenantId, auth, db, app, terreni, terreniFiltrati, renderTerreniCallback) {
    try {
        if (!currentTenantId) {
            const user = auth.currentUser;
            if (user) {
                currentTenantId = await getTenantId(user.uid, db, currentTenantId);
            }
        }
        
        if (!currentTenantId) {
            throw new Error('Tenant ID non disponibile. Assicurati di essere autenticato.');
        }

        // Usa servizio centralizzato tramite helper
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
        
        // Ottieni riferimento collection per calcolo superficie
        const terreniCollection = await getTerreniCollection(currentTenantId, db);
        
        // Processa terreni: calcola superficie se necessario
        terreni.length = 0; // Svuota array
        for (const terreno of terreniList) {
            // Calcola superficie dalla mappa se necessario
            let superficie = terreno.superficie || null;
            if ((!superficie || superficie === 0) && terreno.polygonCoords) {
                superficie = await calcolaSuperficieDaMappa(terreno, terreno.id, terreniCollection);
            }
            
            terreni.push({
                ...terreno,
                superficie: superficie
            });
        }
        
        // Reset filtri quando si ricaricano i terreni
        terreniFiltrati.length = 0;
        
        // Renderizza terreni
        if (renderTerreniCallback) {
            renderTerreniCallback(terreni, terreniFiltrati);
        }
    } catch (error) {
        console.error('Errore caricamento terreni:', error);
        showAlert('Errore nel caricamento dei terreni: ' + error.message, 'error');
        const container = document.getElementById('terreni-container');
        if (container) {
            container.innerHTML = `
                <div class="alert alert-error">
                    <strong>Errore:</strong> ${error.message}
                </div>
            `;
        }
    }
}

/**
 * Renderizza lista terreni in tabella HTML
 * @param {Array} terreni - Array tutti i terreni
 * @param {Array} terreniFiltrati - Array terreni filtrati
 * @param {Function} maybeAutoStartTerreniTourCallback - Callback per avviare tour (opzionale)
 * @param {boolean} hasVignetoModule - Se il modulo vigneto è attivo (opzionale)
 * @param {boolean} hasFruttetoModule - Se il modulo frutteto è attivo (opzionale)
 */
export function renderTerreni(terreni, terreniFiltrati, maybeAutoStartTerreniTourCallback, hasVignetoModule = false, hasFruttetoModule = false) {
    const container = document.getElementById('terreni-container');
    if (!container) return;
    
    // Usa terreni filtrati se disponibili, altrimenti tutti i terreni
    const terreniDaMostrare = terreniFiltrati.length > 0 ? terreniFiltrati : terreni;
    
    if (terreniDaMostrare.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🌾</div>
                <h3>Nessun terreno registrato</h3>
                <p>Aggiungi il tuo primo terreno utilizzando il pulsante "Aggiungi Terreno".</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="section-header">
            <h2>I Tuoi Terreni (${terreniDaMostrare.length}${terreniFiltrati.length > 0 ? ` di ${terreni.length}` : ''})</h2>
        </div>
        <div class="terreni-table">
            <div class="terreni-header">
                <div class="col-nome">Nome Campo</div>
                <div class="col-coltura">Coltura</div>
                <div class="col-podere">Podere</div>
                <div class="col-possesso">Possesso</div>
                <div class="col-ettari">Ha</div>
                <div class="col-mappa">Mappa</div>
                <div class="col-note">Note</div>
                <div class="col-azioni">Azioni</div>
            </div>
            ${terreniDaMostrare.map(terreno => {
                const escapedNome = escapeHtml(terreno.nome || 'Senza nome');
                const escapedColtura = escapeHtml(terreno.coltura || '');
                const escapedPodere = escapeHtml(terreno.podere || '');
                const ettariValue = terreno.superficie ? terreno.superficie.toFixed(2) : '0.00';
                const hasMappa = terreno.polygonCoords && Array.isArray(terreno.polygonCoords) && terreno.polygonCoords.length > 0;
                const escapedNote = escapeHtml(terreno.note || '');
                
                // Calcola alert scadenza affitto
                const tipoPossesso = terreno.tipoPossesso || 'proprieta';
                let possessoHtml = '';
                
                if (tipoPossesso === 'proprieta') {
                    possessoHtml = '<span class="badge badge-success">Proprietà</span>';
                } else if (tipoPossesso === 'affitto') {
                    const alert = calcolaAlertAffitto(terreno.dataScadenzaAffitto);
                    const dataScadenzaFormattata = terreno.dataScadenzaAffitto ? formattaDataScadenza(terreno.dataScadenzaAffitto) : '';
                    let tooltipText = `Affitto - Scade il ${dataScadenzaFormattata}`;
                    if (alert.giorni !== null) {
                        if (alert.giorni < 0) {
                            tooltipText = `Affitto - Scaduto il ${dataScadenzaFormattata}`;
                        } else {
                            tooltipText = `Affitto - Scade tra ${alert.testo} (${dataScadenzaFormattata})`;
                        }
                    }
                    
                    let pallinoHtml = '';
                    if (alert.colore) {
                        const pallinoEmoji = alert.colore === 'green' ? '🟢' : alert.colore === 'yellow' ? '🟡' : alert.colore === 'red' ? '🔴' : '⚫';
                        pallinoHtml = `<span class="alert-dot alert-dot-${alert.colore}" title="${tooltipText}">${pallinoEmoji}</span>`;
                    }
                    
                    possessoHtml = `<span class="badge badge-info" title="${tooltipText}">Affitto</span> ${pallinoHtml}`;
                }
                
                return `
                <div class="terreno-row">
                    <div class="col-nome" data-label="Nome Campo">
                        <span class="terreno-name">${escapedNome}</span>
                    </div>
                    <div class="col-coltura" data-label="Coltura">
                        <span class="terreno-coltura">${escapedColtura || '-'}</span>
                    </div>
                    <div class="col-podere" data-label="Podere">
                        <span class="terreno-podere">${escapedPodere || '-'}</span>
                    </div>
                    <div class="col-possesso" data-label="Possesso">
                        ${possessoHtml}
                    </div>
                    <div class="col-ettari" data-label="Ettari">
                        <span class="terreno-ettari">${ettariValue}</span>
                    </div>
                    <div class="col-mappa" data-label="Mappa">
                        ${hasMappa ? 
                            '<span class="map-indicator" title="Confini tracciati">📍</span>' : 
                            '<span class="map-indicator no-map" title="Nessun confine tracciato">❌</span>'
                        }
                    </div>
                    <div class="col-note" data-label="Note">
                        ${escapedNote || '-'}
                    </div>
                    <div class="col-azioni" data-label="Azioni">
                        <button onclick="editTerreno('${terreno.id}')" class="btn-edit-small" title="Modifica">✏️</button>
                        <button onclick="confirmDeleteTerreno('${terreno.id}')" class="btn-delete-small" title="Elimina">🗑️</button>
                        ${hasVignetoModule && escapedColtura && escapedColtura.toLowerCase().includes('vite') 
                            ? `<button onclick="gestisciVigneto('${terreno.id}')" class="btn-vigneto-small" title="Gestisci Vigneto">🍇</button>` 
                            : ''}
                        ${hasFruttetoModule && escapedColtura && isColturaFrutteto(escapedColtura)
                            ? `<button onclick="gestisciFrutteto('${terreno.id}')" class="btn-frutteto-small" title="Gestisci Frutteto">🍎</button>` 
                            : ''}
                    </div>
                </div>
                `;
            }).join('')}
        </div>
    `;

    // Avvia tour se necessario
    if (maybeAutoStartTerreniTourCallback) {
        maybeAutoStartTerreniTourCallback();
    }
}

/**
 * Filtra terreni per tipo possesso e alert scadenza
 * @param {Array} terreni - Array tutti i terreni
 * @param {Array} terreniFiltrati - Array terreni filtrati (modificato in place)
 * @param {Function} renderTerreniCallback - Callback per renderizzare terreni
 */
export function filterTerreni(terreni, terreniFiltrati, renderTerreniCallback) {
    const filterTipoPossesso = document.getElementById('filter-tipo-possesso')?.value || '';
    const filterAlert = document.getElementById('filter-alert')?.value || '';
    const filterPodere = document.getElementById('filter-podere')?.value || '';
    const filterCategoria = document.getElementById('filter-categoria')?.value || '';
    const filterColtura = document.getElementById('filter-coltura')?.value || '';
    
    terreniFiltrati.length = 0; // Svuota array
    terreni.forEach(terreno => {
        // Filtro tipo possesso
        if (filterTipoPossesso && terreno.tipoPossesso !== filterTipoPossesso) {
            return;
        }
        
        // Filtro podere
        if (filterPodere && (terreno.podere || '').trim() !== filterPodere) {
            return;
        }
        
        // Filtro categoria (dedotta da coltura)
        if (filterCategoria) {
            const catTerreno = getCategoriaFromColtura(terreno.coltura);
            if (catTerreno !== filterCategoria) {
                return;
            }
        }
        
        // Filtro coltura
        if (filterColtura && (terreno.coltura || '').trim() !== filterColtura) {
            return;
        }
        
        // Filtro alert (solo per affitti)
        if (filterAlert && terreno.tipoPossesso === 'affitto') {
            const alert = calcolaAlertAffitto(terreno.dataScadenzaAffitto);
            if (alert.colore !== filterAlert) {
                return;
            }
        } else if (filterAlert && terreno.tipoPossesso === 'proprieta') {
            // Se filtro per alert ma terreno è proprietà, escludi
            return;
        }
        
        terreniFiltrati.push(terreno);
    });
    
    // Renderizza terreni
    if (renderTerreniCallback) {
        renderTerreniCallback(terreni, terreniFiltrati);
    }
}

/**
 * Resetta filtri e mostra tutti i terreni
 * @param {Array} terreni - Array tutti i terreni
 * @param {Array} terreniFiltrati - Array terreni filtrati (modificato in place)
 * @param {Function} renderTerreniCallback - Callback per renderizzare terreni
 */
export function clearFilters(terreni, terreniFiltrati, renderTerreniCallback) {
    const filterTipoPossesso = document.getElementById('filter-tipo-possesso');
    const filterAlert = document.getElementById('filter-alert');
    const filterPodere = document.getElementById('filter-podere');
    const filterCategoria = document.getElementById('filter-categoria');
    const filterColtura = document.getElementById('filter-coltura');
    
    if (filterTipoPossesso) filterTipoPossesso.value = '';
    if (filterAlert) filterAlert.value = '';
    if (filterPodere) filterPodere.value = '';
    if (filterCategoria) filterCategoria.value = '';
    if (filterColtura) filterColtura.value = '';
    
    terreniFiltrati.length = 0; // Svuota array
    
    // Renderizza terreni (mostra tutti, non filtrati)
    if (renderTerreniCallback) {
        renderTerreniCallback(terreni, terreniFiltrati);
    }
}

