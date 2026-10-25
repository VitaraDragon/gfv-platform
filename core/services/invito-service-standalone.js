/**
 * Invito Service - Gestione inviti utenti (versione standalone)
 * Creazione inviti lato client; accettazione membership solo via callable accettaInvito.
 *
 * @module core/services/invito-service-standalone
 */

/**
 * Genera un token unico per l'invito
 * @returns {string} Token unico
 */
export function generateInviteToken() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID() + '-' + Date.now();
    }
    return 'inv-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9) + '-' + Math.random().toString(36).substr(2, 9);
}

/**
 * Crea un invito. Non interroga più users per email (rules: niente query cross-tenant).
 * isExistingUser resta storico/false; la callable getInvitoPubblico lo ricalcola da Auth.
 * L'appartenenza già attiva è rifiutata da accettaInvito (already-exists).
 */
export async function createInvito(db, collection, query, where, getDocs, addDoc, serverTimestamp, email, nome, cognome, ruoli, tenantId, inviatoDa) {
    try {
        const emailNormalized = email.toLowerCase().trim();
        const token = generateInviteToken();
        const scadeIl = new Date();
        scadeIl.setDate(scadeIl.getDate() + 7);

        const invitoData = {
            email: emailNormalized,
            nome: nome.trim(),
            cognome: cognome.trim(),
            ruoli: ruoli,
            tenantId: tenantId,
            token: token,
            stato: 'invitato',
            inviatoDa: inviatoDa,
            inviatoIl: serverTimestamp(),
            scadeIl: scadeIl,
            accettatoIl: null,
            isExistingUser: false
        };

        const docRef = await addDoc(collection(db, 'inviti'), invitoData);

        return {
            id: docRef.id,
            ...invitoData,
            token: token
        };
    } catch (error) {
        console.error('Errore creazione invito:', error);
        throw new Error(`Errore creazione invito: ${error.message}`);
    }
}

/**
 * Mappa errori della callable getInvitoPubblico in messaggi utente.
 * @param {*} error
 * @returns {Error}
 */
export function mapInvitoPubblicoError(error) {
    const code = String((error && error.code) || '');
    const msg = String((error && error.message) || '');
    if (/invalid-argument/i.test(code) || /Token non valido/i.test(msg)) {
        return new Error('Token non valido.');
    }
    if (/failed-precondition/i.test(code) || /scaduto/i.test(msg)) {
        return new Error('Token scaduto. Contatta l\'amministratore per un nuovo invito.');
    }
    if (/not-found/i.test(code) || /già utilizzato/i.test(msg) || /non trovato/i.test(msg)) {
        return new Error('Token invalido o già utilizzato');
    }
    return new Error(msg || 'Errore verifica invito');
}

/**
 * Codice errore callable (es. functions/already-exists → already-exists).
 * @param {*} error
 * @returns {string}
 */
export function invitoCallableErrorCode(error) {
    const raw = String((error && error.code) || '');
    const m = raw.match(/^(?:functions\/)?([a-z0-9-]+)$/i);
    return m ? m[1].toLowerCase() : '';
}

/**
 * Mappa errori di accettaInvito.
 * @param {*} error
 * @returns {Error}
 */
export function mapAccettaInvitoError(error) {
    const code = invitoCallableErrorCode(error);
    const msg = String((error && error.message) || '');
    if (code === 'already-exists') {
        const err = new Error('Appartieni già a questa azienda');
        err.code = 'already-exists';
        return err;
    }
    if (code === 'permission-denied') {
        const err = new Error(msg || 'Non puoi accettare questo invito.');
        err.code = 'permission-denied';
        return err;
    }
    if (code === 'failed-precondition' || /scaduto/i.test(msg)) {
        const err = new Error(msg || 'Token scaduto. Contatta l\'amministratore per un nuovo invito.');
        err.code = 'failed-precondition';
        return err;
    }
    if (code === 'not-found' || /già utilizzato/i.test(msg)) {
        const err = new Error(msg || 'Token invalido o già utilizzato');
        err.code = 'not-found';
        return err;
    }
    if (code === 'invalid-argument') {
        const err = new Error(msg || 'Dati invito non validi.');
        err.code = 'invalid-argument';
        return err;
    }
    if (code === 'unauthenticated') {
        const err = new Error('Devi essere autenticato per accettare l\'invito.');
        err.code = 'unauthenticated';
        return err;
    }
    const err = new Error(msg || 'Errore accettazione invito');
    if (code) err.code = code;
    return err;
}

/**
 * Legge un invito dal token via Cloud Function (niente query pubblica su /inviti).
 * @param {string} token
 * @returns {Promise<Object>}
 */
export async function fetchInvitoByToken(token) {
    const { getHttpsCallable } = await import('./firebase-service.js');
    const callable = getHttpsCallable('getInvitoPubblico');
    try {
        const result = await callable({ token: String(token || '') });
        const invito = result && result.data && result.data.invito;
        if (!invito || !invito.id) {
            throw new Error('Token invalido o già utilizzato');
        }
        return invito;
    } catch (error) {
        throw mapInvitoPubblicoError(error);
    }
}

/**
 * Verifica un token invito
 */
export async function verifyInviteToken(db, collection, query, where, getDocs, token) {
    try {
        const invitoData = await fetchInvitoByToken(token);

        const scadeIl = invitoData.scadeIl && invitoData.scadeIl.toDate
            ? invitoData.scadeIl.toDate()
            : (invitoData.scadeIl ? new Date(invitoData.scadeIl) : null);
        if (scadeIl && !Number.isNaN(scadeIl.getTime()) && new Date() > scadeIl) {
            throw new Error('Token scaduto. Contatta l\'amministratore per un nuovo invito.');
        }

        return {
            ...invitoData,
            isExistingUser: invitoData.isExistingUser === true || invitoData.isExistingUser === 'true'
        };
    } catch (error) {
        console.error('Errore verifica token:', error);
        throw error;
    }
}

/**
 * Accetta un invito: Auth sul client, membership + stato invito solo via callable accettaInvito.
 * Firma lunga mantenuta per compatibilità con la pagina (parametri Firestore non più usati per membership).
 */
export async function acceptInvito(auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, serverTimestamp, token, password) {
    try {
        const invito = await verifyInviteToken(db, collection, query, where, getDocs, token);

        if (!password) {
            throw new Error(
                invito.isExistingUser
                    ? 'Password richiesta per utente esistente'
                    : 'Password obbligatoria per nuovo utente'
            );
        }

        let isNewAuthUser = false;
        const isExistingUserFlag = invito.isExistingUser === true || invito.isExistingUser === 'true' || invito.isExistingUser === 1;

        if (isExistingUserFlag) {
            try {
                await signInWithEmailAndPassword(auth, invito.email, password);
            } catch (loginError) {
                if (loginError.code === 'auth/user-not-found' || loginError.code === 'auth/wrong-password' || loginError.code === 'auth/invalid-credential') {
                    throw new Error('Password errata. Usa la password del tuo account esistente.');
                }
                throw loginError;
            }
        } else {
            try {
                await createUserWithEmailAndPassword(auth, invito.email, password);
                isNewAuthUser = true;
            } catch (createError) {
                if (createError.code === 'auth/email-already-in-use') {
                    try {
                        await signInWithEmailAndPassword(auth, invito.email, password);
                    } catch (loginError) {
                        if (loginError.code === 'auth/user-not-found' || loginError.code === 'auth/wrong-password' || loginError.code === 'auth/invalid-credential') {
                            throw new Error('Password errata. Inserisci la password del tuo account esistente.');
                        }
                        throw loginError;
                    }
                } else {
                    throw createError;
                }
            }
        }

        const { getHttpsCallable } = await import('./firebase-service.js');
        const callable = getHttpsCallable('accettaInvito');
        let result;
        try {
            result = await callable({ token: String(token || '') });
        } catch (callableError) {
            throw mapAccettaInvitoError(callableError);
        }

        const data = (result && result.data) || {};
        const tenantId = data.tenantId || invito.tenantId;
        const isNewUser = data.isNewUser === true || isNewAuthUser;

        try {
            const { setCurrentTenantId, clearUserTenantsCache } = await import('./tenant-service.js');
            if (tenantId) setCurrentTenantId(tenantId);
            clearUserTenantsCache();
        } catch (cacheError) {
            console.warn('Errore impostazione tenant dopo invito:', cacheError);
        }

        return {
            email: invito.email,
            nome: invito.nome,
            cognome: invito.cognome,
            tenantId: tenantId,
            _isNewMembership: !isNewUser,
            _newTenantId: tenantId,
            _isNewUser: isNewUser,
            ok: data.ok === true
        };
    } catch (error) {
        console.error('❌ [ACCEPT_INVITO] Errore accettazione invito:', {
            code: error.code,
            message: error.message
        });
        if (error.code) {
            const preservedError = new Error(error.message);
            preservedError.code = error.code;
            preservedError.name = error.name;
            throw preservedError;
        }
        if (error.message && (error.message.includes('Password errata') || error.code === 'already-exists')) {
            throw error;
        }
        throw new Error(`Errore accettazione invito: ${error.message}`);
    }
}

export default {
    generateInviteToken,
    createInvito,
    fetchInvitoByToken,
    mapInvitoPubblicoError,
    mapAccettaInvitoError,
    invitoCallableErrorCode,
    verifyInviteToken,
    acceptInvito
};
