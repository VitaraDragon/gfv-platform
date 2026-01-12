/**
 * Firebase Configuration - GFV Platform (EXAMPLE)
 * 
 * Questo è un file di esempio. 
 * Copia questo file come `firebase-config.js` e inserisci i tuoi valori reali.
 * 
 * @module core/firebase-config.example
 */

/**
 * Configurazione Firebase per GFV Platform
 * 
 * Per ottenere questa configurazione:
 * 1. Vai su https://console.firebase.google.com/
 * 2. Crea un nuovo progetto (es: "gfv-platform")
 * 3. Aggiungi una Web App
 * 4. Copia la configurazione qui sotto
 */
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "gfv-platform.firebaseapp.com",
  projectId: "gfv-platform",
  storageBucket: "gfv-platform.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID" // Opzionale, solo se usi Analytics
};

export default firebaseConfig;

