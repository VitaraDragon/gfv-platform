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
 * Crea un invito per un nuovo utente o per aggiungere tenant a utente esistente
 * @param {Object} db - Istanza Firestore
 * @param {Object} collection - Funzione collection di Firestore
 * @param {Object} query - Funzione query di Firestore
 * @param {Object} where - Funzione where di Firestore
 * @param {Object} getDocs - Funzione getDocs di Firestore
 * @param {Object} addDoc - Funzione addDoc di Firestore
 * @param {Object} serverTimestamp - Funzione serverTimestamp di Firestore
 * @param {string} email - Email utente
 * @param {string} nome - Nome utente
 * @param {string} cognome - Cognome utente
 * @param {Array<string>} ruoli - Array di ruoli
 * @param {string} tenantId - ID tenant
 * @param {string} inviatoDa - ID utente che invia
 * @returns {Promise<Object>} Dati invito creato con flag isExistingUser
 */
export async function createInvito(db, collection, query, where, getDocs, addDoc, serverTimestamp, email, nome, cognome, ruoli, tenantId, inviatoDa) {
    try {
        // Verifica se email esiste già in Firestore
        const emailNormalized = email.toLowerCase().trim();
        const usersQuery = query(
            collection(db, 'users'),
            where('email', '==', emailNormalized)
        );
        const usersSnapshot = await getDocs(usersQuery);
        const isExistingUser = !usersSnapshot.empty;
        
        // Se utente esiste, verifica che non appartenga già a questo tenant
        if (isExistingUser) {
            const existingUserDoc = usersSnapshot.docs[0];
            const existingUserData = existingUserDoc.data();
            
            // Verifica se appartiene già a questo tenant
            if (existingUserData.tenantMemberships && existingUserData.tenantMemberships[tenantId]) {
                const membership = existingUserData.tenantMemberships[tenantId];
                if (membership.stato === 'attivo') {
                    throw new Error('Utente appartiene già a questo tenant');
                }
            } else if (existingUserData.tenantId === tenantId) {
                // Retrocompatibilità: verifica tenantId deprecato
                throw new Error('Utente appartiene già a questo tenant');
            }
        }
        
        // Genera token unico
        const token = generateInviteToken();
        
        // Calcola data scadenza (7 giorni)
        const scadeIl = new Date();
        scadeIl.setDate(scadeIl.getDate() + 7);
        
        // Crea invito
        const invitoData = {
            email: emailNormalized,
            nome: nome.trim(),
            cognome: cognome.trim(),
            ruoli: ruoli, // Array di ruoli
            tenantId: tenantId,
            token: token,
            stato: 'invitato',
            inviatoDa: inviatoDa,
            inviatoIl: serverTimestamp(),
            scadeIl: scadeIl,
            accettatoIl: null,
            isExistingUser: isExistingUser // Flag: true se utente esiste già
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
        
        console.error('🔍 [VERIFY_TOKEN] Invito caricato da Firestore:', {
            id: invitoDoc.id,
            email: invitoData.email,
            isExistingUser: invitoData.isExistingUser,
            isExistingUserType: typeof invitoData.isExistingUser,
            allKeys: Object.keys(invitoData)
        });
        
        // Verifica scadenza
        const scadeIl = invitoData.scadeIl?.toDate ? invitoData.scadeIl.toDate() : new Date(invitoData.scadeIl);
        if (new Date() > scadeIl) {
            throw new Error('Token scaduto. Contatta l\'amministratore per un nuovo invito.');
        }
        
        return {
            id: invitoDoc.id,
            ...invitoData,
            // Assicurati che isExistingUser sia un booleano
            isExistingUser: invitoData.isExistingUser === true || invitoData.isExistingUser === 'true'
        };
    } catch (error) {
        console.error('Errore verifica token:', error);
        throw error;
    }
}

/**
 * Accetta un invito e crea l'utente o aggiunge membership a utente esistente
 * @param {Object} auth - Istanza Firebase Auth
 * @param {Object} db - Istanza Firestore
 * @param {Object} createUserWithEmailAndPassword - Funzione createUserWithEmailAndPassword
 * @param {Object} signInWithEmailAndPassword - Funzione signInWithEmailAndPassword
 * @param {Object} doc - Funzione doc di Firestore
 * @param {Object} getDoc - Funzione getDoc di Firestore
 * @param {Object} setDoc - Funzione setDoc di Firestore
 * @param {Object} updateDoc - Funzione updateDoc di Firestore
 * @param {Object} collection - Funzione collection di Firestore
 * @param {Object} query - Funzione query di Firestore
 * @param {Object} where - Funzione where di Firestore
 * @param {Object} getDocs - Funzione getDocs di Firestore
 * @param {Object} serverTimestamp - Funzione serverTimestamp di Firestore
 * @param {string} token - Token invito
 * @param {string} password - Password scelta dall'utente (opzionale se utente esiste già)
 * @returns {Promise<Object>} Dati utente creato o aggiornato
 */
export async function acceptInvito(auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, serverTimestamp, token, password) {
    try {
        // Verifica token
        const invito = await verifyInviteToken(db, collection, query, where, getDocs, token);
        
        let firebaseUser = null;
        let isNewUser = false;
        
        // Se invito indica utente esistente, prova a fare login invece di creare account
        // Controlla anche valori truthy per retrocompatibilità
        const isExistingUserFlag = invito.isExistingUser === true || invito.isExistingUser === 'true' || invito.isExistingUser === 1;
        
        if (isExistingUserFlag) {
            try {
                // Prova a fare login con email e password fornita
                if (!password) {
                    throw new Error('Password richiesta per utente esistente');
                }
                
                const userCredential = await signInWithEmailAndPassword(auth, invito.email, password);
                firebaseUser = userCredential.user;
                
                // Utente esiste già, aggiungiamo solo membership
                const userDocRef = doc(db, 'users', firebaseUser.uid);
                const userDoc = await getDoc(userDocRef);
                
                if (!userDoc.exists()) {
                    throw new Error('Utente non trovato in Firestore');
                }
                
                const userData = userDoc.data();
                
                // Aggiungi tenantMembership
                const tenantMemberships = userData.tenantMemberships || {};
                
                // Verifica che non appartenga già a questo tenant
                if (tenantMemberships[invito.tenantId] && tenantMemberships[invito.tenantId].stato === 'attivo') {
                    throw new Error('Appartieni già a questo tenant');
                }
                
                // Aggiungi nuova membership
                tenantMemberships[invito.tenantId] = {
                    ruoli: invito.ruoli || [],
                    stato: 'attivo',
                    dataInizio: serverTimestamp(),
                    creatoDa: invito.inviatoDa,
                    tenantIdPredefinito: false // Non è il tenant predefinito se è un invito
                };
                
                // Aggiorna documento utente
                await updateDoc(userDocRef, {
                    tenantMemberships: tenantMemberships
                });
                
                // Aggiorna invito
                await updateDoc(doc(db, 'inviti', invito.id), {
                    stato: 'accettato',
                    accettatoIl: serverTimestamp()
                });
                
                // Pulisci cache tenant utente per forzare ricaricamento
                try {
                    const { clearUserTenantsCache } = await import('./tenant-service.js');
                    clearUserTenantsCache();
                } catch (cacheError) {
                    console.warn('Errore pulizia cache tenant:', cacheError);
                }
                
                return {
                    ...userData,
                    tenantMemberships: tenantMemberships,
                    _isNewMembership: true,
                    _newTenantId: invito.tenantId
                };
                
            } catch (loginError) {
                // Se login fallisce, potrebbe essere password sbagliata o altro
                if (loginError.code === 'auth/user-not-found' || loginError.code === 'auth/wrong-password') {
                    throw new Error('Password errata. Usa la password del tuo account esistente.');
                }
                throw loginError;
            }
        } else {
            // Utente nuovo: crea account Firebase Auth
            if (!password) {
                throw new Error('Password obbligatoria per nuovo utente');
            }
            
            try {
                const userCredential = await createUserWithEmailAndPassword(
                    auth,
                    invito.email,
                    password
                );
                firebaseUser = userCredential.user;
                isNewUser = true;
            } catch (createError) {
                // Se email esiste già in Firebase Auth, gestisci come utente esistente
                if (createError.code === 'auth/email-already-in-use') {
                    // Prova a fare login
                    if (!password) {
                        throw new Error('Password richiesta. Questa email è già registrata. Inserisci la password del tuo account esistente.');
                    }
                    
                    try {
                        const userCredential = await signInWithEmailAndPassword(auth, invito.email, password);
                        firebaseUser = userCredential.user;
                        
                        // Aggiungi membership come sopra
                        const userDocRef = doc(db, 'users', firebaseUser.uid);
                        const userDoc = await getDoc(userDocRef);
                        
                        if (!userDoc.exists()) {
                            throw new Error('Utente non trovato in Firestore');
                        }
                        
                        const userData = userDoc.data();
                        const tenantMemberships = userData.tenantMemberships || {};
                        
                        if (tenantMemberships[invito.tenantId] && tenantMemberships[invito.tenantId].stato === 'attivo') {
                            throw new Error('Appartieni già a questo tenant');
                        }
                        
                        tenantMemberships[invito.tenantId] = {
                            ruoli: invito.ruoli || [],
                            stato: 'attivo',
                            dataInizio: serverTimestamp(),
                            creatoDa: invito.inviatoDa,
                            tenantIdPredefinito: false
                        };
                        
                    await updateDoc(userDocRef, {
                        tenantMemberships: tenantMemberships
                    });
                    
                    await updateDoc(doc(db, 'inviti', invito.id), {
                        stato: 'accettato',
                        accettatoIl: serverTimestamp()
                    });
                    
                    // Pulisci cache tenant utente per forzare ricaricamento
                    try {
                        const { clearUserTenantsCache } = await import('./tenant-service.js');
                        clearUserTenantsCache();
                    } catch (cacheError) {
                        console.warn('Errore pulizia cache tenant:', cacheError);
                    }
                    
                    return {
                        ...userData,
                        tenantMemberships: tenantMemberships,
                        _isNewMembership: true,
                        _newTenantId: invito.tenantId
                    };
                    } catch (loginError) {
                        if (loginError.code === 'auth/user-not-found' || loginError.code === 'auth/wrong-password') {
                            throw new Error('Password errata. Inserisci la password del tuo account esistente.');
                        }
                        throw loginError;
                    }
                }
                throw createError;
            }
            
            // Crea record utente in Firestore (nuovo utente)
            const userData = {
                id: firebaseUser.uid,
                email: invito.email,
                nome: invito.nome,
                cognome: invito.cognome,
                ruoli: invito.ruoli || [],
                tenantId: invito.tenantId, // Mantenuto per retrocompatibilità
                tenantMemberships: {
                    [invito.tenantId]: {
                        ruoli: invito.ruoli || [],
                        stato: 'attivo',
                        dataInizio: serverTimestamp(),
                        creatoDa: invito.inviatoDa,
                        tenantIdPredefinito: true // Primo tenant è predefinito
                    }
                },
                stato: 'attivo',
                creatoDa: invito.inviatoDa,
                creatoIl: serverTimestamp(),
                ultimoAccesso: null,
                invitoId: invito.id
            };
            
            // Salva utente
            await setDoc(doc(db, 'users', firebaseUser.uid), userData);
            
            // Aggiorna invito
            await updateDoc(doc(db, 'inviti', invito.id), {
                stato: 'accettato',
                accettatoIl: serverTimestamp()
            });
            
            return userData;
        }
    } catch (error) {
        console.error('❌ [ACCEPT_INVITO] Errore accettazione invito:', {
            code: error.code,
            message: error.message,
            stack: error.stack
        });
        // Se l'errore ha un codice (es. auth/email-already-in-use), preservalo
        if (error.code) {
            const preservedError = new Error(error.message);
            preservedError.code = error.code;
            preservedError.name = error.name;
            throw preservedError;
        }
        // Se l'errore è già un Error con messaggio chiaro, rilanciarlo così com'è
        if (error.message && (error.message.includes('Password errata') || error.message.includes('appartiene già'))) {
            throw error;
        }
        // Altrimenti wrappare in un nuovo errore
        throw new Error(`Errore accettazione invito: ${error.message}`);
    }
}

export default {
    generateInviteToken,
    createInvito,
    verifyInviteToken,
    acceptInvito
};

