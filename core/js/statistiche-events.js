/**
 * Statistiche Events - Event handlers per statistiche
 * 
 * @module core/js/statistiche-events
 */

// ============================================
// FUNZIONI EVENT HANDLERS
// ============================================

/**
 * Applica filtri e ricarica statistiche
 * @param {Function} loadStatisticheCallback - Callback per caricare statistiche
 */
export function applyFilters(loadStatisticheCallback) {
    if (loadStatisticheCallback) {
        loadStatisticheCallback();
    }
}

/**
 * Reset filtri e ricarica statistiche
 * @param {Function} loadStatisticheCallback - Callback per caricare statistiche
 */
export function resetFilters(loadStatisticheCallback) {
    const filterDataDa = document.getElementById('filter-data-da');
    const filterDataA = document.getElementById('filter-data-a');
    const filterTerreno = document.getElementById('filter-terreno');
    const filterTipoLavoro = document.getElementById('filter-tipo-lavoro');
    
    if (filterDataDa) filterDataDa.value = '';
    if (filterDataA) filterDataA.value = '';
    if (filterTerreno) filterTerreno.value = '';
    if (filterTipoLavoro) filterTipoLavoro.value = '';
    
    if (loadStatisticheCallback) {
        loadStatisticheCallback();
    }
}

/**
 * Inizializza app (carica filtri e statistiche)
 * @param {Function} loadFiltersCallback - Callback per caricare filtri
 * @param {Function} loadStatisticheCallback - Callback per caricare statistiche
 */
export async function initApp(loadFiltersCallback, loadStatisticheCallback) {
    try {
        if (loadFiltersCallback) {
            await loadFiltersCallback();
        }
        if (loadStatisticheCallback) {
            await loadStatisticheCallback();
        }
    } catch (error) {
        console.error('Errore inizializzazione app:', error);
    }
}

