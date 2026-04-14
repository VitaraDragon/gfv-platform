/**
 * Geolocalizzazione condivisa (mappa terreni, segnatura ore, attività).
 * @module core/js/geo-capture
 */

export const GEOLOCATION_OPTIONS = {
    enableHighAccuracy: true,
    timeout: 25000,
    maximumAge: 0
};

/**
 * @returns {Promise<{ lat: number, lng: number, accuracyMeters: number|null }>}
 */
export function getCurrentPositionGeo() {
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
                    accuracyMeters:
                        typeof pos.coords.accuracy === 'number' && !Number.isNaN(pos.coords.accuracy)
                            ? pos.coords.accuracy
                            : null
                });
            },
            (err) => reject(err),
            GEOLOCATION_OPTIONS
        );
    });
}

/**
 * Oggetto da salvare su Firestore (sottochiave es. posizioneRilevamento).
 * @param {{ lat: number, lng: number, accuracyMeters: number|null }} pos
 * @param {*} Timestamp — costruttore Timestamp da firebase-service / Firestore
 */
export function buildPosizioneRilevamentoFirestore(pos, Timestamp) {
    return {
        lat: pos.lat,
        lng: pos.lng,
        accuracyMeters: pos.accuracyMeters,
        rilevataIl: Timestamp.fromDate(new Date())
    };
}

/**
 * HTML compatto (solo numeri + link Maps) per celle tabella / elenchi.
 * @param {{ lat?: number, lng?: number, accuracyMeters?: number|null }|null|undefined} pos
 * @returns {string} stringa vuota se assente
 */
export function formatPosizioneRilevamentoCompactHtml(pos) {
    if (!pos || typeof pos.lat !== 'number' || typeof pos.lng !== 'number') {
        return '';
    }
    const acc =
        pos.accuracyMeters != null && pos.accuracyMeters > 0
            ? ` (±${Math.round(pos.accuracyMeters)} m)`
            : '';
    const lat = pos.lat;
    const lng = pos.lng;
    const q = encodeURIComponent(`${lat},${lng}`);
    return (
        '<span class="gfv-pos-gps" style="font-size:11px;color:#555;display:block;margin-top:4px;line-height:1.35;">' +
        '📍 <a href="https://www.google.com/maps?q=' +
        q +
        '" target="_blank" rel="noopener">' +
        lat.toFixed(5) +
        ', ' +
        lng.toFixed(5) +
        '</a>' +
        acc +
        '</span>'
    );
}

export function geolocationErrorMessage(err) {
    if (!err) return 'Impossibile ottenere la posizione.';
    if (err.code === 1) {
        return 'Posizione negata: abilita i permessi di localizzazione per questo sito.';
    }
    if (err.code === 2) {
        return 'Posizione non disponibile. Riprova all\'aperto o verifica il GPS.';
    }
    if (err.code === 3) {
        return 'Timeout lettura posizione. Riprova.';
    }
    if (err.message === 'GEO_NOT_SUPPORTED') {
        return 'Geolocalizzazione non supportata da questo browser.';
    }
    return 'Impossibile ottenere la posizione. Riprova.';
}
