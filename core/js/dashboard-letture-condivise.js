/**
 * Letture condivise della dashboard: una sola getDocs per collezione del tenant per pagina.
 * Conteggi (dashboard-counts-snapshot) e widget scadenze (dashboard-deadlines) leggono
 * le stesse collezioni (terreni, macchine): la promise viene condivisa invece di rileggere.
 * La memoria è legata all'oggetto `dependencies` della pagina, quindi non passa tra pagine o test.
 * @module core/js/dashboard-letture-condivise
 */

/** @type {WeakMap<object, Map<string, Promise<any>>>} */
let _perDipendenze = new WeakMap();

/**
 * getDocs(tenants/{tenantId}/{nome}) una sola volta per `dependencies`.
 * Se la lettura fallisce la voce viene tolta, così il chiamante successivo riprova.
 * @param {{ db: any, collection: Function, getDocs: Function }} dependencies
 * @param {string} tenantId
 * @param {string} nome - nome della collezione (es. 'terreni', 'macchine')
 * @returns {Promise<any>} QuerySnapshot
 */
export function leggiCollezioneTenantCondivisa(dependencies, tenantId, nome) {
    const { db, collection, getDocs } = dependencies;
    let mappa = _perDipendenze.get(dependencies);
    if (!mappa) {
        mappa = new Map();
        _perDipendenze.set(dependencies, mappa);
    }
    const chiave = `${tenantId}/${nome}`;
    const esistente = mappa.get(chiave);
    if (esistente) return esistente;
    const promessa = Promise.resolve().then(() => getDocs(collection(db, `tenants/${tenantId}/${nome}`)));
    mappa.set(chiave, promessa);
    promessa.catch(() => {
        if (mappa.get(chiave) === promessa) mappa.delete(chiave);
    });
    return promessa;
}

/** Svuota le letture condivise (cambio tenant / invalidazione conteggi). */
export function azzeraLettureCondivise() {
    _perDipendenze = new WeakMap();
}
