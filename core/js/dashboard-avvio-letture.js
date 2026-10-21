/**
 * Letture di avvio della dashboard: documento utente e documento tenant nello stesso giro.
 * Il tenant previsto è quello già scelto da tenant-service (sessionStorage) durante il bootstrap:
 * se dopo la lettura dell'utente il tenant risolto è lo stesso, si usa la lettura anticipata;
 * altrimenti si rilegge il tenant giusto, come prima.
 * @module core/js/dashboard-avvio-letture
 */

const misuraDiretta = (_label, fn) => fn();

/**
 * Legge users/{uid} e, se già noto, tenants/{tenantIdPrevisto} in parallelo.
 * Un errore sulla lettura anticipata del tenant non interrompe la lettura dell'utente:
 * viene conservato e rilanciato solo se quel tenant serve davvero (vedi leggiTenantDocAvvio).
 * @param {{ db: any, doc: Function, getDoc: Function, uid: string, tenantIdPrevisto?: string|null, misura?: Function }} opts
 * @returns {Promise<{ userDoc: any, tenantAnticipato: { tenantId: string, doc?: any, errore?: any }|null }>}
 */
export async function leggiUtenteETenantAvvio({ db, doc, getDoc, uid, tenantIdPrevisto = null, misura = misuraDiretta }) {
    const userPromise = misura('auth.userDoc', () => getDoc(doc(db, 'users', uid)));
    const tenantPromise = tenantIdPrevisto
        ? misura('auth.tenantDoc', () => getDoc(doc(db, 'tenants', tenantIdPrevisto))).then(
            (snap) => ({ tenantId: tenantIdPrevisto, doc: snap }),
            (errore) => ({ tenantId: tenantIdPrevisto, errore })
        )
        : Promise.resolve(null);
    const [userDoc, tenantAnticipato] = await Promise.all([userPromise, tenantPromise]);
    return { userDoc, tenantAnticipato };
}

/**
 * Documento tenant per il tenant risolto: riusa la lettura anticipata se è lo stesso tenant.
 * @param {{ db: any, doc: Function, getDoc: Function, misura?: Function }} deps
 * @param {{ tenantId: string, doc?: any, errore?: any }|null} tenantAnticipato
 * @param {string|null} currentTenantId
 * @returns {Promise<any|null>}
 */
export async function leggiTenantDocAvvio({ db, doc, getDoc, misura = misuraDiretta }, tenantAnticipato, currentTenantId) {
    if (!currentTenantId) return null;
    if (tenantAnticipato && tenantAnticipato.tenantId === currentTenantId) {
        if (tenantAnticipato.errore) throw tenantAnticipato.errore;
        return tenantAnticipato.doc;
    }
    return misura('auth.tenantDoc', () => getDoc(doc(db, 'tenants', currentTenantId)));
}

/**
 * Elenco aziende per il pulsante «cambia azienda», dal documento utente già letto.
 * Con una sola azienda (o nessuna) non serve il nome: nessuna lettura.
 * @param {Object|null} userData - documento utente così come letto (non normalizzato)
 * @param {{ getUserTenantsFromData: Function, getUserTenantsWithNamesFromData: Function }} tenantService
 * @returns {Promise<Array<Object>>}
 */
export async function aziendePerSwitch(userData, { getUserTenantsFromData, getUserTenantsWithNamesFromData }) {
    if (!userData) return [];
    const memberships = getUserTenantsFromData(userData);
    if (memberships.length <= 1) return memberships;
    return getUserTenantsWithNamesFromData(userData);
}
