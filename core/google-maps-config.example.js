/**
 * Google Maps Configuration - GFV Platform
 * Configurazione opzionale per Google Maps API
 * 
 * IMPORTANTE: Questo file è opzionale. 
 * Se non configurato, le mappe non saranno disponibili ma l'app funzionerà comunque.
 * 
 * Per utilizzare le mappe:
 * 1. Copia questo file come google-maps-config.js
 * 2. Ottieni una chiave API da https://console.cloud.google.com/
 * 3. Abilita "Maps JavaScript API" e "Geometry Library"
 * 4. Sostituisci YOUR_GOOGLE_MAPS_API_KEY con la tua chiave
 * 
 * @module core/google-maps-config
 */

/**
 * Chiave API di Google Maps
 * 
 * Per ottenere una chiave:
 * 1. Vai su https://console.cloud.google.com/
 * 2. Crea un progetto o seleziona uno esistente
 * 3. Abilita "Maps JavaScript API"
 * 4. Abilita "Geometry Library" (necessaria per calcolo aree)
 * 5. Vai su "Credenziali" → "Crea credenziali" → "Chiave API"
 * 6. Copia la chiave qui sotto
 */
export const GOOGLE_MAPS_API_KEY = "YOUR_GOOGLE_MAPS_API_KEY_HERE";

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


