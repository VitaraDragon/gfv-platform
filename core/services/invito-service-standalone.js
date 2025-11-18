/**
 * Invito Service - Gestione inviti utenti (versione standalone)
 * Gestisce creazione inviti, verifica token e accettazione inviti
 * 
 * @module core/services/invito-service-standalone
 */

/**
 * Genera un token unico per l'invito
 * @returns {string} Token unico
 */
export function generateInviteToken() {
    // Usa crypto.randomUUID se disponibile, altrimenti fallback
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID() + '-' + Date.now();
    }
    // Fallback per browser più vecchi
    return 'inv-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9) + '-' + Math.random().toString(36).substr(2, 9);
}

/**
 * Crea un invito per un nuovo utente
 * @param {Object} db - Istanza Firestore
 * @param {Object} collection - Funzione collection di Firestore
 * @param {Object} addDoc - Funzione addDoc di Firestore
 * @param {Object} serverTimestamp - Funzione serverTimestamp di Firestore
 * @param {string} email - Email utente
 * @param {string} nome - Nome utente
 * @param {string} cognome - Cognome utente
 * @param {Array<string>} ruoli - Array di ruoli
 * @param {string} tenantId - ID tenant
 * @param {string} inviatoDa - ID utente che invia
 * @returns {Promise<Object>} Dati invito creato
 */
export async function createInvito(db, collection, addDoc, serverTimestamp, email, nome, cognome, ruoli, tenantId, inviatoDa) {
    try {
        // Genera token unico
        const token = generateInviteToken();
        
        // Calcola data scadenza (7 giorni)
        const scadeIl = new Date();
        scadeIl.setDate(scadeIl.getDate() + 7);
        
        // Crea invito
        const invitoData = {
            email: email.toLowerCase().trim(),
            nome: nome.trim(),
            cognome: cognome.trim(),
            ruoli: ruoli, // Array di ruoli
            tenantId: tenantId,
            token: token,
            stato: 'invitato',
            inviatoDa: inviatoDa,
            inviatoIl: serverTimestamp(),
            scadeIl: scadeIl,
            accettatoIl: null
        };
        
        // Salva in Firestore
        const docRef = await addDoc(collection(db, 'inviti'), invitoData);
        
        return {
            id: docRef.id,
            ...invitoData,
            token: token // Includi token nel risultato per generare link
        };
    } catch (error) {
        console.error('Errore creazione invito:', error);
        throw new Error(`Errore creazione invito: ${error.message}`);
    }
}

/**
 * Verifica un token invito
 * @param {Object} db - Istanza Firestore
 * @param {Object} collection - Funzione collection di Firestore
 * @param {Object} query - Funzione query di Firestore
 * @param {Object} where - Funzione where di Firestore
 * @param {Object} getDocs - Funzione getDocs di Firestore
 * @param {string} token - Token da verificare
 * @returns {Promise<Object>} Dati invito
 */
export async function verifyInviteToken(db, collection, query, where, getDocs, token) {
    try {
        // Cerca invito con token e stato "invitato"
        const invitiQuery = query(
            collection(db, 'inviti'),
            where('token', '==', token),
            where('stato', '==', 'invitato')
        );
        
        const snapshot = await getDocs(invitiQuery);
        
        if (snapshot.empty) {
            throw new Error('Token invalido o già utilizzato');
        }
        
        const invitoDoc = snapshot.docs[0];
        const invitoData = invitoDoc.data();
        
        // Verifica scadenza
        const scadeIl = invitoData.scadeIl?.toDate ? invitoData.scadeIl.toDate() : new Date(invitoData.scadeIl);
        if (new Date() > scadeIl) {
            throw new Error('Token scaduto. Contatta l\'amministratore per un nuovo invito.');
        }
        
        return {
            id: invitoDoc.id,
            ...invitoData
        };
    } catch (error) {
        console.error('Errore verifica token:', error);
        throw error;
    }
}

/**
 * Accetta un invito e crea l'utente
 * @param {Object} auth - Istanza Firebase Auth
 * @param {Object} db - Istanza Firestore
 * @param {Object} createUserWithEmailAndPassword - Funzione createUserWithEmailAndPassword
 * @param {Object} doc - Funzione doc di Firestore
 * @param {Object} setDoc - Funzione setDoc di Firestore
 * @param {Object} updateDoc - Funzione updateDoc di Firestore
 * @param {Object} serverTimestamp - Funzione serverTimestamp di Firestore
 * @param {string} token - Token invito
 * @param {string} password - Password scelta dall'utente
 * @returns {Promise<Object>} Dati utente creato
 */
export async function acceptInvito(auth, db, createUserWithEmailAndPassword, doc, setDoc, updateDoc, serverTimestamp, token, password) {
    try {
        // Verifica token (questa funzione deve essere chiamata prima)
        // Per ora assumiamo che il token sia già stato verificato
        
        // Per accettare l'invito, dobbiamo prima verificare il token
        // Questo richiede le funzioni Firestore, quindi le passiamo come parametri
        const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        const invito = await verifyInviteToken(db, collection, query, where, getDocs, token);
        
        // Crea utente Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(
            auth,
            invito.email,
            password
        );
        
        const firebaseUser = userCredential.user;
        
        // Crea record utente in Firestore
        const userData = {
            id: firebaseUser.uid,
            email: invito.email,
            nome: invito.nome,
            cognome: invito.cognome,
            ruoli: invito.ruoli || [],
            tenantId: invito.tenantId,
            stato: 'attivo',
            creatoDa: invito.inviatoDa,
            creatoIl: serverTimestamp(),
            ultimoAccesso: null,
            invitoId: invito.id
        };
        
        // Salva utente (usa merge: true per evitare sovrascritture accidentali)
        await setDoc(doc(db, 'users', firebaseUser.uid), userData, { merge: true });
        
        // Aggiorna invito
        await updateDoc(doc(db, 'inviti', invito.id), {
            stato: 'accettato',
            accettatoIl: serverTimestamp()
        });
        
        return userData;
    } catch (error) {
        console.error('Errore accettazione invito:', error);
        throw new Error(`Errore accettazione invito: ${error.message}`);
    }
}

export default {
    generateInviteToken,
    createInvito,
    verifyInviteToken,
    acceptInvito
};




