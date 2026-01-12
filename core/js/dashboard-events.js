/**
 * Dashboard Events - Event handlers per dashboard
 * 
 * @module core/js/dashboard-events
 */

// ============================================
// IMPORTS
// ============================================
// Le importazioni Firebase verranno fatte nel file HTML principale

// ============================================
// FUNZIONI EVENT HANDLERS
// ============================================

/**
 * Gestisce logout utente
 * @param {Object} auth - Istanza Firebase Auth
 * @param {Object} db - Istanza Firestore
 * @param {Function} cleanupCallbacks - Callback per pulizia listener (manutenzioni, guasti, etc.)
 */
export async function handleLogout(auth, db, cleanupCallbacks = {}) {
    try {
        // Ferma l'aggiornamento dello stato online
        if (window.gfvOnlineInterval) {
            clearInterval(window.gfvOnlineInterval);
        }
        
        // Pulizia listener manutenzioni e guasti
        if (cleanupCallbacks.manutenzioniUnsubscribe) {
            cleanupCallbacks.manutenzioniUnsubscribe();
        }
        if (cleanupCallbacks.guastiUnsubscribe) {
            cleanupCallbacks.guastiUnsubscribe();
        }
        
        // Imposta offline prima del logout
        const user = auth.currentUser;
        if (user) {
            try {
                const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                const userDocRef = doc(db, 'users', user.uid);
                await updateDoc(userDocRef, {
                    isOnline: false
                });
            } catch (error) {
                console.warn('Errore aggiornamento stato offline:', error);
            }
        }
        
        // Rimuovi anche il flag di sessione
        sessionStorage.removeItem('gfv_expected_user_id');
        sessionStorage.removeItem('gfv_user_just_registered');
        
        const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        await signOut(auth);
        window.location.href = './auth/login-standalone.html';
    } catch (error) {
        console.error('Errore logout:', error);
        alert('Errore durante il logout');
    }
}

/**
 * Conferma ricezione comunicazione (Operaio)
 * @param {string} comunicazioneId - ID comunicazione
 * @param {Object} auth - Istanza Firebase Auth
 * @param {Object} db - Istanza Firestore
 * @param {Function} loadComunicazioniCallback - Callback per ricaricare comunicazioni
 */
export async function confermaComunicazione(comunicazioneId, auth, db, loadComunicazioniCallback) {
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        const { getDoc, doc, updateDoc, Timestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return;
        
        const userData = userDoc.data();
        const tenantId = userData.tenantId;
        if (!tenantId) return;
        
        const comunicazioneRef = doc(db, `tenants/${tenantId}/comunicazioni`, comunicazioneId);
        const comunicazioneDoc = await getDoc(comunicazioneRef);
        
        if (!comunicazioneDoc.exists()) {
            alert('Comunicazione non trovata');
            return;
        }
        
        const comm = comunicazioneDoc.data();
        const conferme = comm.conferme || [];
        
        // Verifica se già confermato
        if (conferme.some(c => c.userId === user.uid || c === user.uid)) {
            alert('Hai già confermato questa comunicazione');
            return;
        }
        
        // Aggiungi conferma (usa Timestamp.now() invece di serverTimestamp() perché non può essere usato dentro array)
        conferme.push({
            userId: user.uid,
            timestamp: Timestamp.now()
        });
        
        await updateDoc(comunicazioneRef, {
            conferme: conferme
        });
        
        // Ricarica comunicazioni
        if (loadComunicazioniCallback) {
            await loadComunicazioniCallback();
        }
        
        alert('✅ Conferma ricevuta!');
    } catch (error) {
        console.error('Errore conferma comunicazione:', error);
        alert('Errore durante la conferma: ' + error.message);
    }
}

/**
 * Gestisce cambio lavoro nel form comunicazione rapida (Caposquadra)
 * @param {Array} lavoriAttiviCaposquadra - Array lavori attivi
 * @param {Object} db - Istanza Firestore
 * @param {string} tenantId - ID tenant
 */
export function handleRapidaLavoroChange(lavoriAttiviCaposquadra, db, tenantId) {
    const lavoroSelect = document.getElementById('rapida-lavoro-select');
    if (!lavoroSelect) return;
    
    const lavoroId = lavoroSelect.value;
    const lavoro = lavoriAttiviCaposquadra.find(l => l.id === lavoroId);
    
    if (!lavoro || !lavoro.terreno) {
        document.getElementById('rapida-lavoro-nome').textContent = 'Nessun lavoro selezionato';
        document.getElementById('rapida-podere').textContent = '-';
        document.getElementById('rapida-terreno').textContent = '-';
        return;
    }
    
    const lavoroNome = lavoro.nome || 'Senza nome';
    const podere = lavoro.terreno.podere || 'Non specificato';
    const terrenoNome = lavoro.terreno.nome || lavoro.nome || 'Non specificato';
    
    document.getElementById('rapida-lavoro-nome').textContent = lavoroNome;
    document.getElementById('rapida-podere').textContent = podere;
    document.getElementById('rapida-terreno').textContent = terrenoNome;
}

/**
 * Invia comunicazione rapida (Caposquadra)
 * @param {Event} e - Event submit
 * @param {Object} auth - Istanza Firebase Auth
 * @param {Object} db - Istanza Firestore
 * @param {Array} lavoriAttiviCaposquadra - Array lavori attivi
 * @param {Function} showRapidaMessageCallback - Callback per mostrare messaggio
 */
export async function handleSendComunicazioneRapida(e, auth, db, lavoriAttiviCaposquadra, showRapidaMessageCallback) {
    e.preventDefault();
    
    try {
        const user = auth.currentUser;
        if (!user) {
            console.error('handleSendComunicazioneRapida: utente non autenticato');
            if (showRapidaMessageCallback) {
                showRapidaMessageCallback('Errore: utente non autenticato', 'error');
            }
            return;
        }
        
        const { getDoc, doc, collection, query, where, getDocs, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
            console.error('handleSendComunicazioneRapida: documento utente non trovato');
            if (showRapidaMessageCallback) {
                showRapidaMessageCallback('Errore: dati utente non trovati', 'error');
            }
            return;
        }
        
        const userData = userDoc.data();
        if (!userData.tenantId) {
            console.error('handleSendComunicazioneRapida: tenantId non trovato');
            if (showRapidaMessageCallback) {
                showRapidaMessageCallback('Errore: tenant non trovato', 'error');
            }
            return;
        }
        
        // Ottieni lavoro selezionato
        const lavoroSelect = document.getElementById('rapida-lavoro-select');
        const lavoroId = lavoroSelect ? lavoroSelect.value : lavoriAttiviCaposquadra[0].id;
        const lavoro = lavoriAttiviCaposquadra.find(l => l.id === lavoroId);
        
        if (!lavoro || !lavoro.terreno) {
            if (showRapidaMessageCallback) {
                showRapidaMessageCallback('Errore: lavoro o terreno non trovato', 'error');
            }
            return;
        }
        
        const podere = lavoro.terreno.podere || 'Non specificato';
        const terrenoNome = lavoro.terreno.nome || lavoro.nome || 'Non specificato';
        const orario = document.getElementById('rapida-orario').value;
        const note = document.getElementById('rapida-note').value.trim();
        
        if (!orario) {
            if (showRapidaMessageCallback) {
                showRapidaMessageCallback('Inserisci un orario', 'error');
            }
            return;
        }
        
        // Ottieni coordinate podere se disponibili
        let coordinatePodere = null;
        if (podere && podere !== 'Non specificato') {
            try {
                const poderiCollection = collection(db, `tenants/${userData.tenantId}/poderi`);
                const q = query(poderiCollection, where('nome', '==', podere));
                const poderiSnapshot = await getDocs(q);
                if (!poderiSnapshot.empty) {
                    const podereData = poderiSnapshot.docs[0].data();
                    coordinatePodere = podereData.coordinate || null;
                }
            } catch (error) {
                console.warn('Errore recupero coordinate podere:', error);
            }
        }
        
        // Ottieni membri squadra
        const caposquadraId = userData.id || user.uid;
        const squadreCollection = collection(db, `tenants/${userData.tenantId}/squadre`);
        const q = query(squadreCollection, where('caposquadraId', '==', caposquadraId));
        const squadreSnapshot = await getDocs(q);
        
        if (squadreSnapshot.empty) {
            console.warn('Nessuna squadra trovata per caposquadraId:', caposquadraId);
            if (showRapidaMessageCallback) {
                showRapidaMessageCallback('Nessuna squadra trovata. Verifica di essere assegnato come caposquadra di una squadra.', 'error');
            }
            return;
        }
        
        const squadraDoc = squadreSnapshot.docs[0];
        const squadraData = squadraDoc.data();
        const membriSquadra = squadraData.operai || [];
        
        if (membriSquadra.length === 0) {
            if (showRapidaMessageCallback) {
                showRapidaMessageCallback('Nessun membro nella tua squadra', 'error');
            }
            return;
        }
        
        // Crea comunicazione
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(parseInt(orario.split(':')[0]), parseInt(orario.split(':')[1]), 0, 0);
        
        const comunicazioneData = {
            caposquadraId: userData.id || user.uid,
            caposquadraNome: `${userData.nome || ''} ${userData.cognome || ''}`.trim(),
            podere: podere,
            terreno: terrenoNome,
            data: tomorrow,
            orario: orario,
            note: note || null,
            coordinatePodere: coordinatePodere,
            destinatari: membriSquadra,
            conferme: [],
            stato: 'attiva',
            createdAt: serverTimestamp()
        };
        
        const comunicazioniCollection = collection(db, `tenants/${userData.tenantId}/comunicazioni`);
        const comunicazioneRef = await addDoc(comunicazioniCollection, comunicazioneData);
        
        console.log('Comunicazione rapida inviata con successo:', comunicazioneRef.id);
        console.log('Destinatari:', membriSquadra);
        
        if (showRapidaMessageCallback) {
            showRapidaMessageCallback('✅ Comunicazione inviata alla squadra con successo!', 'success');
        }
        
        // Reset form
        const orarioInput = document.getElementById('rapida-orario');
        const noteInput = document.getElementById('rapida-note');
        if (orarioInput) orarioInput.value = '07:00';
        if (noteInput) noteInput.value = '';
    } catch (error) {
        console.error('Errore invio comunicazione rapida:', error);
        if (showRapidaMessageCallback) {
            showRapidaMessageCallback('Errore durante l\'invio: ' + error.message, 'error');
        }
    }
}

/**
 * Mostra messaggio nel form rapido
 * @param {string} message - Messaggio da mostrare
 * @param {string} type - Tipo messaggio ('success' | 'error')
 */
export function showRapidaMessage(message, type) {
    const messageDiv = document.getElementById('rapida-message');
    if (!messageDiv) return;
    
    const color = type === 'success' ? '#28a745' : '#dc3545';
    const bgColor = type === 'success' ? '#d4edda' : '#f8d7da';
    
    messageDiv.innerHTML = `
        <div style="padding: 12px; background: ${bgColor}; color: ${color}; border-radius: 6px; font-size: 14px;">
            ${message}
        </div>
    `;
    
    if (type === 'success') {
        setTimeout(() => {
            messageDiv.innerHTML = '';
        }, 3000);
    }
}

