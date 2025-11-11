/**
 * Google Maps Configuration - GFV Platform
 * Configurazione per Google Maps API
 * 
 * IMPORTANTE: Questo file contiene la chiave API reale.
 * NON committare questo file su Git (è già nel .gitignore)
 * 
 * @module core/google-maps-config
 */

/**
 * Chiave API di Google Maps
 */
export const GOOGLE_MAPS_API_KEY = "AIzaSyA1hzGgiM72XcAZjnDKDV-vz9OGVWJWLKs";

/**
 * Configurazione opzionale per Google Maps
 */
export const googleMapsConfig = {
  apiKey: GOOGLE_MAPS_API_KEY,
  libraries: ['geometry'], // Libreria necessaria per calcolo aree
  version: 'weekly' // Usa versione settimanale (più aggiornata)
};

export default {
  GOOGLE_MAPS_API_KEY,
  googleMapsConfig
};

