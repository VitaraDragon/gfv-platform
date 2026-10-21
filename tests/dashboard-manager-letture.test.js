/**
 * Dashboard manager: meno letture Firestore e giri di rete in parallelo, stesso risultato.
 * La «rete» è simulata: ogni richiesta resta in sospeso finché il test non chiude un giro (RTT);
 * il numero di giri necessari a finire = catena critica in serie.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  if (typeof globalThis.window === 'undefined') {
    globalThis.window = { dispatchEvent: () => true, addEventListener: () => {} };
  }
});

vi.mock('../core/services/firebase-service.js', () => ({
  getDocumentData: vi.fn(),
  getCollectionData: vi.fn(),
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
  getAuthInstance: vi.fn(() => ({ currentUser: null })),
  getCollection: vi.fn(),
  onAuthStateChanged: vi.fn(),
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
}));

vi.mock('../core/services/auth-service.js', () => ({
  getCurrentUserData: vi.fn(),
}));

vi.mock('../core/js/dashboard-perf.js', () => ({
  dashboardPerfAsync: async (_label, fn) => fn(),
}));

import * as firebaseService from '../core/services/firebase-service.js';
import {
  getUserRolesForTenant,
  getUserRolesFromData,
  getUserTenants,
  getUserTenantsFromData,
  getUserTenantsWithNamesFromData,
} from '../core/services/tenant-service.js';
import {
  leggiUtenteETenantAvvio,
  leggiTenantDocAvvio,
  aziendePerSwitch,
} from '../core/js/dashboard-avvio-letture.js';
import {
  leggiCollezioneTenantCondivisa,
  azzeraLettureCondivise,
} from '../core/js/dashboard-letture-condivise.js';
import {
  loadDashboardCountsSnapshot,
  invalidateDashboardCountsSnapshot,
  lavoriConOreManagerPossibili,
  loadAffittiUrgentiCountCondiviso,
} from '../core/js/dashboard-counts-snapshot.js';
import {
  loadAffittiUrgentiCount,
  countOreDaValidareFromLavoriDocs,
} from '../core/js/dashboard-data.js?v=2026-10-20a';
import {
  fetchScadenzeAmministrazioneItems,
  fetchInArrivoItems,
} from '../core/js/dashboard-deadlines.js';

// ---------------------------------------------------------------------------
// Rete simulata
// ---------------------------------------------------------------------------
const flush = () => new Promise((r) => setTimeout(r, 0));

function creaRete() {
  const inAttesa = [];
  const chiamate = [];
  return {
    chiamate,
    richiesta(etichetta, valore) {
      chiamate.push(etichetta);
      return new Promise((resolve, reject) => {
        inAttesa.push({ resolve, reject, valore });
      });
    },
    /** Esegue fn() chiudendo un giro alla volta; restituisce { valore, giri }. */
    async esegui(fn) {
      let finito = false;
      let valore;
      let errore;
      Promise.resolve()
        .then(fn)
        .then(
          (v) => { finito = true; valore = v; },
          (e) => { finito = true; errore = e; }
        );
      let giri = 0;
      for (let i = 0; i < 200; i++) {
        await flush();
        await flush();
        if (finito) break;
        if (inAttesa.length === 0) continue;
        giri += 1;
        const giro = inAttesa.splice(0);
        giro.forEach((r) => (r.valore instanceof Error ? r.reject(r.valore) : r.resolve(r.valore)));
      }
      if (!finito) throw new Error('rete simulata: operazione non conclusa');
      if (errore) throw errore;
      return { valore, giri };
    },
  };
}

function snapDoc(id, data) {
  return { id, exists: () => data != null, data: () => (data == null ? undefined : { ...data }) };
}

function querySnap(rows) {
  const docs = rows.map((r) => snapDoc(r.id, r.data));
  return { docs, size: docs.length, empty: docs.length === 0, forEach: (fn) => docs.forEach(fn) };
}

// ---------------------------------------------------------------------------
// Dati finti
// ---------------------------------------------------------------------------
const UID = 'u_manager';
const TID = 'tenant_a';

const userDataMulti = {
  nome: 'Pier',
  cognome: 'Rossi',
  tenantMemberships: {
    tenant_a: { ruoli: ['manager'], stato: 'attivo', tenantIdPredefinito: true },
    tenant_b: { ruoli: ['operaio'], stato: 'attivo' },
  },
};
const userDataSingolo = {
  nome: 'Ugo',
  tenantMemberships: { tenant_a: { ruoli: ['Manager', 'caposquadra'], stato: 'attivo' } },
};
const userDataLegacy = { nome: 'Old', tenantId: 'tenant_a', ruoli: ['amministratore'] };
const userDataSenzaRuoli = { tenantMemberships: { tenant_a: { stato: 'attivo' } } };

const tenantDocs = {
  tenant_a: { nome: 'Azienda A', modules: ['manodopera', 'parcoMacchine'] },
  tenant_b: { name: 'Azienda B' },
};

function giorniDaOggi(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}

/** 10 lavori: 4 chiusi (completato/annullato), 2 senza assegnazione. */
function lavoriFinti() {
  const oggi = giorniDaOggi(0);
  return [
    { id: 'L1', data: { stato: 'in_corso', operaioId: 'op1', dataInizio: oggi } },
    { id: 'L2', data: { stato: 'assegnato', caposquadraId: 'capo1', dataInizio: oggi } },
    { id: 'L3', data: { stato: 'completato', operaioId: 'op2' } },
    { id: 'L4', data: { stato: 'completato', caposquadraId: 'capo1' } },
    { id: 'L5', data: { stato: 'annullato', operaioId: 'op3' } },
    { id: 'L6', data: { stato: 'completato_da_approvare', caposquadraId: 'capo2' } },
    { id: 'L7', data: { stato: 'da_pianificare' } },
    { id: 'L8', data: { stato: 'in_corso', operaioId: 'op1', caposquadraId: 'capo1' } },
    { id: 'L9', data: { stato: 'sospeso', operaioId: 'op4' } },
    { id: 'L10', data: { stato: 'completato', caposquadraId: 'capo2' } },
  ];
}

/** Ore da_validare per lavoro (la query filtra già stato=='da_validare'). */
const oreDaValidarePerLavoro = {
  L1: [{ id: 'o1', data: { stato: 'da_validare', operaioId: 'op1' } }],
  L2: [
    { id: 'o2', data: { stato: 'da_validare', operaioId: 'capo1' } },
    { id: 'o3', data: { stato: 'da_validare', operaioId: 'op9' } },
  ],
  // lavoro chiuso con ore ancora da validare: devono contare
  L3: [{ id: 'o4', data: { stato: 'da_validare', operaioId: 'op2' } }, { id: 'o5', data: { stato: 'da_validare', operaioId: 'op2' } }],
  L4: [{ id: 'o6', data: { stato: 'da_validare', operaioId: 'capo1' } }],
  L5: [],
  L6: [{ id: 'o7', data: { stato: 'da_validare', operaioId: 'op8' } }],
  L7: [{ id: 'o8', data: { stato: 'da_validare', operaioId: 'opX' } }],
  L8: [{ id: 'o9', data: { stato: 'da_validare', operaioId: 'op1' } }],
  L9: [{ id: 'o10', data: { stato: 'da_validare', operaioId: 'op4' } }],
  L10: [],
};

const terreniFinti = [
  { id: 't1', data: { nome: 'Vigna', tipoPossesso: 'affitto', dataScadenzaAffitto: giorniDaOggi(10) } },
  { id: 't2', data: { nome: 'Campo', tipoPossesso: 'affitto', dataScadenzaAffitto: giorniDaOggi(400) } },
  { id: 't3', data: { nome: 'Cliente', tipoPossesso: 'affitto', dataScadenzaAffitto: giorniDaOggi(5), clienteId: 'c1' } },
  { id: 't4', data: { nome: 'Proprio', tipoPossesso: 'proprieta' } },
  { id: 't5', data: { nome: 'Scaduto', tipoPossesso: 'affitto', dataScadenzaAffitto: giorniDaOggi(-3) } },
];

const macchineFinte = [
  { id: 'm1', data: { nome: 'Trattore', prossimaRevisione: giorniDaOggi(5), prossimaManutenzione: giorniDaOggi(3), oreAttuali: 990, oreProssimaManutenzione: 1000 } },
  { id: 'm2', data: { nome: 'Furgone', tipoMacchina: 'furgone', prossimaAssicurazione: giorniDaOggi(20), kmAttuali: 9800, kmProssimaManutenzione: 10000 } },
  { id: 'm3', data: { nome: 'Atomizzatore' } },
];

/** dependencies come in dashboard-standalone.html, con getDocs/getDoc sulla rete simulata. */
function creaDipendenze(rete) {
  const path = (segs) => segs.join('/');
  return {
    db: { finto: true },
    auth: { currentUser: { uid: UID } },
    collection: (_db, ...segs) => ({ tipo: 'collezione', path: path(segs) }),
    doc: (_db, ...segs) => ({ tipo: 'doc', path: path(segs) }),
    query: (ref, ...filtri) => ({ ...ref, filtri }),
    where: (campo, op, valore) => ({ campo, op, valore }),
    getDoc: (ref) => {
      const [col, id] = ref.path.split('/');
      const fonte = col === 'users' ? { [UID]: rete.userData } : tenantDocs;
      return rete.richiesta(`getDoc:${ref.path}`, snapDoc(id, fonte[id]));
    },
    getDocs: (ref) => {
      const p = ref.path;
      let rows = [];
      if (p.endsWith('/lavori')) rows = lavoriFinti();
      else if (p.endsWith('/terreni')) rows = terreniFinti;
      else if (p.endsWith('/macchine')) rows = macchineFinte;
      else if (p.endsWith('/oreOperai')) rows = oreDaValidarePerLavoro[p.split('/')[3]] || [];
      return rete.richiesta(`getDocs:${p}`, querySnap(rows));
    },
  };
}

function conta(chiamate, re) {
  return chiamate.filter((c) => re.test(c)).length;
}

beforeEach(() => {
  invalidateDashboardCountsSnapshot();
  azzeraLettureCondivise();
  vi.mocked(firebaseService.getDocumentData).mockReset();
});

// ---------------------------------------------------------------------------
// Riferimento: la logica di prima (b065122), copiata qui per confrontare i risultati
// ---------------------------------------------------------------------------
function ruoliPrima(userData, tenantId) {
  if (!userData) return [];
  if (userData.tenantMemberships && userData.tenantMemberships[tenantId]) {
    const membership = userData.tenantMemberships[tenantId];
    return membership.ruoli && Array.isArray(membership.ruoli) ? membership.ruoli : [];
  }
  if (userData.tenantId === tenantId && userData.ruoli && Array.isArray(userData.ruoli)) {
    return userData.ruoli;
  }
  return [];
}

/** Catena di avvio di prima: users → (users ‖ tenants) → write → users → tenants (switch). */
async function avvioPrima(deps, rete) {
  const userDoc = await deps.getDoc(deps.doc(deps.db, 'users', UID));
  const userData = userDoc.data();
  const [ruoli, tenantDoc] = await Promise.all([
    deps.getDoc(deps.doc(deps.db, 'users', UID)).then((s) => ruoliPrima(s.data(), TID)),
    deps.getDoc(deps.doc(deps.db, 'tenants', TID)),
  ]);
  await rete.richiesta('updateDoc:users', null);
  const switchUser = (await deps.getDoc(deps.doc(deps.db, 'users', UID))).data();
  const ids = Object.keys(switchUser.tenantMemberships || {});
  const nomi = await Promise.all(ids.map((id) => deps.getDoc(deps.doc(deps.db, 'tenants', id)).then((s) => s.data())));
  return { userData, ruoli, tenant: tenantDoc.data(), aziende: ids.length, nomi };
}

/** Catena di avvio di adesso, come in dashboard-standalone.html. */
async function avvioDopo(deps, rete) {
  const avvio = await leggiUtenteETenantAvvio({ ...deps, uid: UID, tenantIdPrevisto: TID });
  const userData = avvio.userDoc.data();
  const ruoli = getUserRolesFromData(userData, TID);
  const tenantDoc = await leggiTenantDocAvvio(deps, avvio.tenantAnticipato, TID);
  rete.richiesta('updateDoc:users', null); // non attesa
  const switchPromise = aziendePerSwitch(userData, {
    getUserTenantsFromData,
    getUserTenantsWithNamesFromData: async (ud) => {
      const ms = getUserTenantsFromData(ud);
      return Promise.all(ms.map((m) => deps.getDoc(deps.doc(deps.db, 'tenants', m.tenantId)).then((s) => ({ ...m, nome: s.data().nome || s.data().name || null }))));
    },
  });
  return { userData, ruoli, tenant: tenantDoc.data(), switchPromise };
}

// ---------------------------------------------------------------------------
describe('tenant-service: helper dal documento utente già letto', () => {
  it('getUserRolesFromData dà gli stessi ruoli della vecchia lettura, per membership, legacy e casi vuoti', () => {
    const casi = [
      [userDataMulti, 'tenant_a'],
      [userDataMulti, 'tenant_b'],
      [userDataMulti, 'tenant_x'],
      [userDataSingolo, 'tenant_a'],
      [userDataLegacy, 'tenant_a'],
      [userDataLegacy, 'tenant_b'],
      [userDataSenzaRuoli, 'tenant_a'],
      [null, 'tenant_a'],
      [userDataMulti, null],
    ];
    for (const [ud, tid] of casi) {
      expect(getUserRolesFromData(ud, tid)).toEqual(tid ? ruoliPrima(ud, tid) : []);
    }
  });

  it('getUserRolesForTenant continua a leggere users una volta e usa la stessa regola', async () => {
    vi.mocked(firebaseService.getDocumentData).mockResolvedValue({ id: UID, ...userDataMulti });
    await expect(getUserRolesForTenant('tenant_b', UID)).resolves.toEqual(['operaio']);
    expect(firebaseService.getDocumentData).toHaveBeenCalledTimes(1);
    expect(firebaseService.getDocumentData).toHaveBeenCalledWith('users', UID);
  });

  it('getUserTenants (con uid) dà lo stesso elenco di getUserTenantsWithNamesFromData, che non rilegge users', async () => {
    vi.mocked(firebaseService.getDocumentData).mockImplementation(async (col, id) =>
      col === 'users' ? { id, ...userDataMulti } : tenantDocs[id] ? { id, ...tenantDocs[id] } : null
    );
    const prima = await getUserTenants(UID);
    const lettePrima = vi.mocked(firebaseService.getDocumentData).mock.calls.length;
    vi.mocked(firebaseService.getDocumentData).mockClear();
    const dopo = await getUserTenantsWithNamesFromData(userDataMulti);
    const calls = vi.mocked(firebaseService.getDocumentData).mock.calls;
    expect(dopo).toEqual(prima);
    expect(dopo.map((t) => t.nome)).toEqual(['Azienda A', 'Azienda B']);
    expect(lettePrima).toBe(3); // users + 2 tenants
    expect(calls.length).toBe(2); // solo i 2 tenants
    expect(calls.every(([col]) => col === 'tenants')).toBe(true);
  });
});

describe('dashboard-avvio-letture: utente e tenant nello stesso giro', () => {
  it('prima 5 giri e 3 letture di users; dopo 1 giro, 1 lettura di users; stesso utente, ruoli e tenant', async () => {
    const retePrima = creaRete();
    retePrima.userData = userDataSingolo;
    const prima = await retePrima.esegui(() => avvioPrima(creaDipendenze(retePrima), retePrima));

    const reteDopo = creaRete();
    reteDopo.userData = userDataSingolo;
    const dopo = await reteDopo.esegui(async () => {
      const r = await avvioDopo(creaDipendenze(reteDopo), reteDopo);
      r.aziende = (await r.switchPromise).length;
      return r;
    });

    expect(prima.giri).toBe(5);
    expect(dopo.giri).toBe(1);
    expect(conta(retePrima.chiamate, /^getDoc:users\//)).toBe(3);
    expect(conta(reteDopo.chiamate, /^getDoc:users\//)).toBe(1);
    expect(conta(retePrima.chiamate, /^getDoc:tenants\//)).toBe(2);
    expect(conta(reteDopo.chiamate, /^getDoc:tenants\//)).toBe(1);

    expect(dopo.valore.userData).toEqual(prima.valore.userData);
    expect(dopo.valore.ruoli).toEqual(prima.valore.ruoli);
    expect(dopo.valore.tenant).toEqual(prima.valore.tenant);
    expect(dopo.valore.aziende).toBe(prima.valore.aziende);
  });

  it('multi-azienda: i nomi per il pulsante arrivano in parallelo, senza rileggere users', async () => {
    const rete = creaRete();
    rete.userData = userDataMulti;
    const deps = creaDipendenze(rete);
    const { valore, giri } = await rete.esegui(async () => {
      const r = await avvioDopo(deps, rete);
      return { ...r, aziende: await r.switchPromise };
    });
    expect(giri).toBe(2); // utente‖tenant, poi i nomi delle 2 aziende insieme
    expect(conta(rete.chiamate, /^getDoc:users\//)).toBe(1);
    expect(valore.aziende.map((a) => [a.tenantId, a.nome])).toEqual([
      ['tenant_a', 'Azienda A'],
      ['tenant_b', 'Azienda B'],
    ]);
  });

  it('tenant risolto diverso da quello previsto: rilegge quello giusto (come prima)', async () => {
    const rete = creaRete();
    rete.userData = userDataMulti;
    const deps = creaDipendenze(rete);
    const { valore, giri } = await rete.esegui(async () => {
      const avvio = await leggiUtenteETenantAvvio({ ...deps, uid: UID, tenantIdPrevisto: 'tenant_a' });
      return leggiTenantDocAvvio(deps, avvio.tenantAnticipato, 'tenant_b');
    });
    expect(giri).toBe(2);
    expect(valore.data()).toEqual(tenantDocs.tenant_b);
  });

  it('nessun tenant previsto: legge solo l\'utente; errore sul tenant anticipato rilanciato solo se serve', async () => {
    const rete = creaRete();
    rete.userData = userDataSingolo;
    const deps = creaDipendenze(rete);
    const senza = await rete.esegui(() => leggiUtenteETenantAvvio({ ...deps, uid: UID, tenantIdPrevisto: null }));
    expect(senza.valore.tenantAnticipato).toBeNull();
    expect(rete.chiamate).toEqual([`getDoc:users/${UID}`]);

    const errore = new Error('permission-denied');
    const depsErr = { ...deps, getDoc: (ref) => (ref.path.startsWith('tenants/') ? Promise.reject(errore) : deps.getDoc(ref)) };
    const conErr = await rete.esegui(() => leggiUtenteETenantAvvio({ ...depsErr, uid: UID, tenantIdPrevisto: TID }));
    expect(conErr.valore.userDoc.exists()).toBe(true);
    await expect(leggiTenantDocAvvio(depsErr, conErr.valore.tenantAnticipato, TID)).rejects.toBe(errore);
    await expect(leggiTenantDocAvvio(depsErr, conErr.valore.tenantAnticipato, null)).resolves.toBeNull();
  });

  it('una sola azienda: il pulsante non serve e non si legge nessun tenant', async () => {
    const withNames = vi.fn();
    const r = await aziendePerSwitch(userDataSingolo, { getUserTenantsFromData, getUserTenantsWithNamesFromData: withNames });
    expect(r.length).toBe(1);
    expect(withNames).not.toHaveBeenCalled();
    await expect(aziendePerSwitch(null, { getUserTenantsFromData, getUserTenantsWithNamesFromData: withNames })).resolves.toEqual([]);
  });
});

describe('conteggi e scadenze: stesse cifre, meno letture', () => {
  const ctx = { availableModules: ['manodopera', 'parcoMacchine'], hasManodopera: true, hasContoTerzi: true };

  it('ore da validare: stesso totale contando i lavori chiusi; niente query sui lavori senza assegnazione', async () => {
    const rete = creaRete();
    const deps = creaDipendenze(rete);
    const docs = querySnap(lavoriFinti()).docs;

    const prima = await rete.esegui(() => countOreDaValidareFromLavoriDocs(TID, docs, deps));
    const queryPrima = conta(rete.chiamate, /oreOperai$/);
    rete.chiamate.length = 0;
    const dopo = await rete.esegui(() => countOreDaValidareFromLavoriDocs(TID, lavoriConOreManagerPossibili(docs), deps));
    const queryDopo = conta(rete.chiamate, /oreOperai$/);

    // L1 1 + L2 1 (solo capo) + L3 2 (completato) + L4 1 (completato, capo) + L9 1 = 6
    expect(prima.valore).toBe(6);
    expect(dopo.valore).toBe(prima.valore);
    expect(queryPrima).toBe(10);
    expect(queryDopo).toBe(8); // fuori L7 (nessuna assegnazione) e L8 (operaio e capo insieme)
    expect(dopo.giri).toBe(1);
  });

  it('affitti urgenti: stesso risultato di loadAffittiUrgentiCount, terreni letti una volta sola', async () => {
    const rete = creaRete();
    const deps = creaDipendenze(rete);
    const prima = await rete.esegui(() => loadAffittiUrgentiCount(deps, TID));
    const dopo = await rete.esegui(() => loadAffittiUrgentiCountCondiviso(deps, TID));
    expect(dopo.valore).toEqual(prima.valore);
    const senzaUtente = await loadAffittiUrgentiCountCondiviso({ ...deps, auth: { currentUser: null } }, TID);
    expect(senzaUtente).toEqual({ urgentCount: 0, totalAffitti: 0 });
  });

  it('pagina intera (conteggi + due widget + ricarica «In arrivo» dopo le ore): terreni 1 e macchine 1 invece di 2 e 4', async () => {
    const rete = creaRete();
    const deps = creaDipendenze(rete);
    const { valore } = await rete.esegui(async () => {
      const snap = await loadDashboardCountsSnapshot(TID, ctx, deps);
      await snap.oreRefreshPromise;
      const [scadenze, inArrivo] = await Promise.all([
        fetchScadenzeAmministrazioneItems(TID, ctx.availableModules, deps),
        fetchInArrivoItems(TID, ctx, deps, snap),
      ]);
      const inArrivoDopoOre = await fetchInArrivoItems(TID, ctx, deps, snap);
      return { snap, scadenze, inArrivo, inArrivoDopoOre };
    });
    expect(conta(rete.chiamate, /\/terreni$/)).toBe(1);
    expect(conta(rete.chiamate, /\/macchine$/)).toBe(1);
    expect(conta(rete.chiamate, /\/lavori$/)).toBe(1);
    expect(conta(rete.chiamate, /\/oreOperai$/)).toBe(8); // 10 lavori, 2 senza assegnazione valida
    expect(valore.snap.oreDaValidare).toBe(6);
    expect(valore.snap.affittiUrgenti).toBe(1);
    expect(valore.snap.affittiTotal).toBe(3);
    expect(valore.snap.operativitaOggi).toEqual({ programmatiOggi: 1, inCorso: 2, oreDaValidare: 6 });
    expect(valore.inArrivoDopoOre).toEqual(valore.inArrivo);
  });

  it('widget scadenze: stessi elementi e stesso ordine di prima; terreni e macchine nello stesso giro', async () => {
    // Prima: due getDocs in serie (stessa logica, letture dirette senza condivisione)
    const retePrima = creaRete();
    const depsPrima = creaDipendenze(retePrima);
    const prima = await retePrima.esegui(async () => {
      const t = await depsPrima.getDocs(depsPrima.collection(depsPrima.db, `tenants/${TID}/terreni`));
      const m = await depsPrima.getDocs(depsPrima.collection(depsPrima.db, `tenants/${TID}/macchine`));
      return [t, m];
    });
    expect(prima.giri).toBe(2);

    const reteDopo = creaRete();
    const depsDopo = creaDipendenze(reteDopo);
    const dopo = await reteDopo.esegui(() => fetchScadenzeAmministrazioneItems(TID, ['parcoMacchine'], depsDopo));
    expect(dopo.giri).toBe(1);
    expect(dopo.valore.map((it) => [it.tipoLabel, it.titolo, it.colore])).toEqual([
      ['Affitto', 'Scaduto', 'grey'],
      ['Revisione', 'Trattore', 'red'],
      ['Affitto', 'Vigna', 'red'],
      ['Assicurazione', 'Furgone', 'yellow'],
      ['Affitto', 'Campo', 'green'],
    ]);
  });

  it('lettura condivisa: una getDocs per collezione e per oggetto dependencies; dopo un errore si riprova', async () => {
    let n = 0;
    const deps = {
      db: {},
      collection: (_db, p) => ({ path: p }),
      getDocs: vi.fn(async () => {
        n += 1;
        if (n === 1) throw new Error('rete giù');
        return querySnap([]);
      }),
    };
    await expect(leggiCollezioneTenantCondivisa(deps, TID, 'macchine')).rejects.toThrow('rete giù');
    await leggiCollezioneTenantCondivisa(deps, TID, 'macchine');
    await leggiCollezioneTenantCondivisa(deps, TID, 'macchine');
    expect(deps.getDocs).toHaveBeenCalledTimes(2);
    const altre = { ...deps, getDocs: vi.fn(async () => querySnap([])) };
    await leggiCollezioneTenantCondivisa(altre, TID, 'macchine');
    expect(altre.getDocs).toHaveBeenCalledTimes(1);
    azzeraLettureCondivise();
    await leggiCollezioneTenantCondivisa(deps, TID, 'macchine');
    expect(deps.getDocs).toHaveBeenCalledTimes(3);
  });
});
