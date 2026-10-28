/**
 * Creazione account titolare (Auth + tenant Free + profilo users).
 * Nessun import Firebase: le API arrivano in `fb`. Nessun DOM, nessun log.
 */

import { computeTonyGuidaOnboardingEndsAt } from '../config/tony-guida-onboarding.js';

export const MS_ATTESA_VERIFICA = 1000;

/**
 * @param {unknown} email
 * @returns {string}
 */
export function normalizzaEmailRegistrazione(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Stessa normalizzazione di core/auth/registrazione-standalone.html (righe 652–665).
 * @param {string} aziendaNome
 * @param {string} uid
 * @param {number} [adessoMs]
 * @returns {string}
 */
export function tenantIdDaNomeAzienda(aziendaNome, uid, adessoMs = Date.now()) {
  let tenantIdBase = String(aziendaNome || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (!tenantIdBase || tenantIdBase.length === 0) {
    tenantIdBase = 'azienda_' + adessoMs;
  }

  return `${tenantIdBase}_${String(uid || '').substring(0, 8)}`;
}

/**
 * @param {{ aziendaNome: string, uid: string, serverTimestamp: Function, adesso?: Date|number }} opts
 */
export function datiTenantTitolare({ aziendaNome, uid, serverTimestamp, adesso }) {
  return {
    nome: aziendaNome,
    creatoDa: uid,
    creatoIl: serverTimestamp(),
    piano: 'free',
    moduli: [],
    stato: 'attivo',
    tonyGuidaOnboardingEndsAt: computeTonyGuidaOnboardingEndsAt(adesso),
  };
}

/**
 * @param {{ uid: string, email: string, tenantId: string, campiNome?: object, serverTimestamp: Function }} opts
 */
export function datiUtenteTitolare({ uid, email, tenantId, campiNome, serverTimestamp }) {
  const campi = {};
  if (campiNome && typeof campiNome === 'object') {
    if (typeof campiNome.nome === 'string' && campiNome.nome) campi.nome = campiNome.nome;
    if (typeof campiNome.cognome === 'string' && campiNome.cognome) campi.cognome = campiNome.cognome;
  }
  const ruoliArray = ['amministratore'];
  return {
    id: uid,
    email: normalizzaEmailRegistrazione(email),
    ...campi,
    ruoli: ruoliArray,
    tenantId: tenantId,
    tenantMemberships: {
      [tenantId]: {
        ruoli: ['amministratore'],
        stato: 'attivo',
        tenantIdPredefinito: true,
      },
    },
    stato: 'attivo',
    creatoDa: uid,
    creatoIl: serverTimestamp(),
    ultimoAccesso: null,
  };
}

/**
 * @param {unknown} err
 * @returns {string}
 */
export function codiceErroreRegistrazione(err) {
  const code = err && typeof err === 'object' ? String(err.code || '') : '';
  const message = err && typeof err === 'object' ? String(err.message || '') : String(err || '');
  if (code === 'auth/email-already-in-use') return 'email-usata';
  if (code === 'auth/invalid-email') return 'email-non-valida';
  if (
    code === 'auth/weak-password' ||
    code === 'auth/password-does-not-meet-requirements'
  ) {
    return 'password-debole';
  }
  if (
    code === 'auth/network-request-failed' ||
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    (err && typeof err === 'object' && err.name === 'TypeError')
  ) {
    return 'rete';
  }
  if (code === 'auth/too-many-requests') return 'troppi-tentativi';
  if (message.indexOf('Esiste già un profilo') === 0) return 'profilo-esistente';
  if (code === 'permission-denied' || message.toLowerCase().indexOf('permessi') >= 0) {
    return 'permessi';
  }
  if (message.toLowerCase().indexOf('tenant') >= 0) return 'azienda';
  return 'sconosciuto';
}

function strumentiCompleti(fb) {
  return !!(
    fb &&
    fb.auth &&
    fb.db &&
    typeof fb.createUserWithEmailAndPassword === 'function' &&
    typeof fb.deleteUser === 'function' &&
    typeof fb.doc === 'function' &&
    typeof fb.setDoc === 'function' &&
    typeof fb.getDoc === 'function' &&
    typeof fb.deleteDoc === 'function' &&
    typeof fb.serverTimestamp === 'function'
  );
}

function allegaStato(err, stato) {
  const errore =
    err && typeof err === 'object' ? err : new Error(String(err));
  errore.statoRegistrazione = stato;
  return errore;
}

/**
 * @param {{
 *   email: string,
 *   password: string,
 *   aziendaNome: string,
 *   campiNome?: object,
 *   fb: object,
 *   attendi?: (ms: number) => Promise<void>,
 *   adesso?: Date|number
 * }} opts
 */
export async function creaAccountTitolare({
  email,
  password,
  aziendaNome,
  campiNome,
  fb,
  attendi,
  adesso,
}) {
  if (!strumentiCompleti(fb)) {
    throw new Error('strumenti Firebase mancanti');
  }

  const attendiMs =
    typeof attendi === 'function'
      ? attendi
      : (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  let utente = null;
  let tenantId = null;
  let tenantCreato = false;
  let userDocCreato = false;

  const stato = () => ({
    utente,
    tenantId,
    tenantCreato,
    userDocCreato,
  });

  try {
    const emailNorm = normalizzaEmailRegistrazione(email);
    const userCredential = await fb.createUserWithEmailAndPassword(
      fb.auth,
      emailNorm,
      password
    );
    utente = userCredential.user;

    tenantId = tenantIdDaNomeAzienda(
      aziendaNome,
      utente.uid,
      adesso instanceof Date ? adesso.getTime() : typeof adesso === 'number' ? adesso : Date.now()
    );

    const tenantData = datiTenantTitolare({
      aziendaNome,
      uid: utente.uid,
      serverTimestamp: fb.serverTimestamp,
      adesso,
    });

    try {
      const tenantDocRef = fb.doc(fb.db, 'tenants', tenantId);
      await fb.setDoc(tenantDocRef, tenantData);
      tenantCreato = true;
    } catch (tenantError) {
      if (
        tenantError &&
        (tenantError.code === 'permission-denied' ||
          (tenantError.message && String(tenantError.message).includes('permission')))
      ) {
        throw allegaStato(
          new Error(
            'Errore permessi Firestore: verifica le regole di sicurezza. Codice: ' +
              tenantError.code
          ),
          stato()
        );
      }
      throw allegaStato(
        new Error(
          `Errore durante creazione tenant: ${tenantError.message || tenantError}`
        ),
        stato()
      );
    }

    const userData = datiUtenteTitolare({
      uid: utente.uid,
      email: emailNorm,
      tenantId,
      campiNome: campiNome || {},
      serverTimestamp: fb.serverTimestamp,
    });

    const existingUserDoc = await fb.getDoc(fb.doc(fb.db, 'users', utente.uid));
    if (existingUserDoc.exists()) {
      throw allegaStato(
        new Error(
          "Esiste già un profilo per questo account. Accedi invece di registrare una nuova azienda, oppure usa un'altra email."
        ),
        stato()
      );
    }
    await fb.setDoc(fb.doc(fb.db, 'users', utente.uid), userData);
    userDocCreato = true;

    await attendiMs(MS_ATTESA_VERIFICA);

    const userDocRef = fb.doc(fb.db, 'users', utente.uid);
    const userDocCheck = await fb.getDoc(userDocRef);
    if (!userDocCheck.exists()) {
      throw allegaStato(
        new Error('Errore: documento utente non creato correttamente'),
        stato()
      );
    }
    const savedData = userDocCheck.data();
    if (!savedData.tenantId || savedData.tenantId !== tenantId) {
      throw allegaStato(
        new Error('Errore: tenantId non salvato correttamente. Riprova la registrazione.'),
        stato()
      );
    }
    const ruoliSalvati = savedData.ruoli;
    if (!ruoliSalvati || !Array.isArray(ruoliSalvati) || ruoliSalvati.length === 0) {
      throw allegaStato(
        new Error('Errore: ruoli non salvati correttamente. Riprova la registrazione.'),
        stato()
      );
    }

    return { utente, uid: utente.uid, tenantId };
  } catch (err) {
    if (err && typeof err === 'object' && err.statoRegistrazione) throw err;
    throw allegaStato(err, stato());
  }
}

/**
 * @param {{ fb: object, stato: { utente?: object|null, tenantId?: string|null, tenantCreato?: boolean } }} opts
 * @returns {Promise<{ tenantEliminato: boolean, utenteEliminato: boolean }>}
 */
export async function annullaRegistrazioneParziale({ fb, stato }) {
  const out = { tenantEliminato: false, utenteEliminato: false };
  try {
    if (!stato || !stato.utente) return out;
    if (stato.tenantCreato && stato.tenantId) {
      try {
        await fb.deleteDoc(fb.doc(fb.db, 'tenants', stato.tenantId));
        out.tenantEliminato = true;
      } catch {
        out.tenantEliminato = false;
      }
    }
    try {
      await fb.deleteUser(stato.utente);
      out.utenteEliminato = true;
    } catch {
      out.utenteEliminato = false;
    }
  } catch {
    /* non lancia mai */
  }
  return out;
}
