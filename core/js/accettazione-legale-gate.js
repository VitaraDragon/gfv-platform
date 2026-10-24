/**
 * Ri-accettazione al primo ingresso. Con il flag spento non chiama la rete e non disegna nulla.
 * Le pagine importano questo file solo se il flag è acceso.
 * Flag acceso: se lo stato non si legge, l'ingresso resta bloccato (Riprova / Esci), mai fail-open.
 * Lo stato e la registrazione sono per l'azienda corrente.
 */
import {
  documentiRichiestiPerRuolo,
  decidiRiaccettazione,
  costruisciPayloadAccettazione,
  validaCaselleRegistrazione,
  validaPresaVisioneInvito
} from '../services/accettazione-legale.js';

const RUOLI_INVITO = ['operaio', 'caposquadra', 'manager'];

export function canalePerRuoli(ruoli) {
  const lista = Array.isArray(ruoli) ? ruoli.map((ruolo) => String(ruolo)) : [];
  if (lista.includes('amministratore')) return 'registrazione';
  if (lista.some((ruolo) => RUOLI_INVITO.includes(ruolo))) return 'invito';
  return '';
}

export function ruoloPerCanale(ruoli, canale) {
  const lista = Array.isArray(ruoli) ? ruoli.map((ruolo) => String(ruolo)) : [];
  if (canale === 'registrazione') return lista.includes('amministratore') ? 'amministratore' : '';
  return RUOLI_INVITO.find((ruolo) => lista.includes(ruolo)) || '';
}

/**
 * Flag spento: chiamare false e mostra false. Nessuna lettura, nessuna UI.
 * @param {{ attiva?: boolean, configOk?: boolean, ruoli?: string[], accettazioni?: Array<{tipo?: string, versione?: string}>, config?: object }} input
 */
export function pianoGate(input) {
  const vuoto = { chiamare: false, mostra: false, canale: '', ruolo: '', mancanti: [] };
  if (!input || input.attiva !== true || input.configOk !== true) return vuoto;
  const canale = canalePerRuoli(input.ruoli);
  const ruolo = ruoloPerCanale(input.ruoli, canale);
  if (!canale || !ruolo) return vuoto;
  const richiesti = documentiRichiestiPerRuolo(input.ruoli, canale);
  const config = {
    attiva: true,
    DOCUMENTI_LEGALI: input.config && input.config.DOCUMENTI_LEGALI
  };
  const mancanti = decidiRiaccettazione(input.accettazioni || [], richiesti, config);
  return { chiamare: true, mostra: mancanti.length > 0, canale, ruolo, mancanti };
}

/**
 * Se `leggiStato` lancia: con `mostraErrore` aspetta il "Riprova" e rilegge, senza mai lasciar entrare;
 * senza `mostraErrore` rilancia (chi chiama deve bloccare).
 * @param {{ attiva?: boolean, configOk?: boolean, ruoli?: string[], config?: object, leggiStato?: () => Promise<Array<{tipo?: string, versione?: string}>>, mostra?: (piano: object) => Promise<void>, mostraErrore?: (err: unknown) => Promise<void> }} opts
 */
export async function eseguiGate(opts) {
  const prima = pianoGate(Object.assign({}, opts, { accettazioni: [] }));
  if (!prima.chiamare || typeof opts.leggiStato !== 'function') {
    return { mostrato: false };
  }
  let accettazioni;
  for (;;) {
    try {
      accettazioni = await opts.leggiStato();
      break;
    } catch (err) {
      if (typeof opts.mostraErrore !== 'function') throw err;
      await opts.mostraErrore(err);
    }
  }
  const dopo = pianoGate(Object.assign({}, opts, { accettazioni: accettazioni || [] }));
  if (!dopo.mostra || typeof opts.mostra !== 'function') {
    return { mostrato: false };
  }
  await opts.mostra(dopo);
  return { mostrato: true };
}

function aggiungiLink(parent, testo, url) {
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = testo;
  parent.appendChild(link);
}

function casella(id) {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = id;
  input.style.cssText = 'width:auto;padding:0;border:0;margin:0 8px 0 0;vertical-align:middle;';
  return input;
}

function mostraOverlay(opts) {
  const piano = opts.piano;
  const config = opts.config;
  const documenti = config.DOCUMENTI_LEGALI;
  const nome = (typeof opts.aziendaNome === 'string' && opts.aziendaNome.trim())
    ? opts.aziendaNome.trim()
    : 'la tua azienda';
  return new Promise((resolve) => {
    const fondo = document.createElement('div');
    fondo.id = 'accettazione-legale-gate';
    fondo.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;';
    const pannello = document.createElement('div');
    pannello.style.cssText = 'background:#fff;border-radius:12px;max-width:520px;width:100%;padding:24px;font:16px/1.4 system-ui,sans-serif;color:#1a1a1a;';
    const errore = document.createElement('p');
    errore.style.cssText = 'color:#dc3545;min-height:1.2em;';

    if (piano.canale === 'registrazione') {
      const prima = document.createElement('label');
      prima.style.display = 'block';
      prima.style.marginBottom = '12px';
      const termini = casella('accettazione-termini');
      prima.appendChild(termini);
      prima.appendChild(document.createTextNode('Ho letto e accetto i '));
      aggiungiLink(prima, 'Termini di servizio', documenti['termini-b2b'].url);
      prima.appendChild(document.createTextNode(' e ho letto l\''));
      aggiungiLink(prima, 'Informativa privacy', documenti.privacy.url);
      prima.appendChild(document.createTextNode(' di GFV.'));
      pannello.appendChild(prima);

      const seconda = document.createElement('label');
      seconda.style.display = 'block';
      seconda.style.marginBottom = '12px';
      const dpa = casella('accettazione-dpa');
      seconda.appendChild(dpa);
      seconda.appendChild(document.createTextNode('Accetto il '));
      aggiungiLink(seconda, 'DPA', documenti.dpa.url);
      seconda.appendChild(document.createTextNode(': per i dati dei lavoratori e dei clienti della mia azienda io sono titolare e GFV è responsabile. Dichiaro di poter accettare per conto dell\'azienda.'));
      pannello.appendChild(seconda);
      if (typeof config.COOKIE_URL === 'string' && config.COOKIE_URL.indexOf('https://') === 0) {
        const cookie = document.createElement('a');
        cookie.href = config.COOKIE_URL;
        cookie.target = '_blank';
        cookie.rel = 'noopener';
        cookie.textContent = 'Cookie';
        cookie.style.display = 'inline-block';
        cookie.style.marginBottom = '12px';
        pannello.appendChild(cookie);
      }
    } else {
      const label = document.createElement('label');
      label.style.display = 'block';
      label.style.marginBottom = '12px';
      const presa = casella('accettazione-presa-visione');
      label.appendChild(presa);
      label.appendChild(document.createTextNode('Ho letto l\''));
      aggiungiLink(
        label,
        'informativa sul trattamento dei miei dati come lavoratore di ' + nome,
        documenti['informativa-lavoratori'].url
      );
      label.appendChild(document.createTextNode('.'));
      pannello.appendChild(label);
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Continua';
    btn.style.cssText = 'margin-top:8px;padding:12px 16px;background:#2E8B57;color:#fff;border:0;border-radius:8px;';
    btn.addEventListener('click', async () => {
      errore.textContent = '';
      const documentiPayload = piano.canale === 'registrazione'
        ? ['termini-b2b', 'privacy', 'dpa']
        : ['informativa-lavoratori'];
      if (piano.canale === 'registrazione') {
        const termini = document.getElementById('accettazione-termini');
        const dpa = document.getElementById('accettazione-dpa');
        if (!validaCaselleRegistrazione({
          termini: !!(termini && termini.checked === true),
          dpa: !!(dpa && dpa.checked === true)
        })) {
          errore.textContent = 'Spunta la casella per continuare.';
          return;
        }
      } else {
        const presa = document.getElementById('accettazione-presa-visione');
        if (!validaPresaVisioneInvito({ presaVisione: !!(presa && presa.checked === true) })) {
          errore.textContent = 'Spunta la casella per continuare.';
          return;
        }
      }
      try {
        const payload = costruisciPayloadAccettazione({
          canale: piano.canale,
          tenantId: opts.tenantId,
          ruolo: piano.ruolo,
          documenti: documentiPayload,
          config: config
        });
        await opts.registra(payload);
        fondo.remove();
        resolve();
      } catch (err) {
        errore.textContent = 'Non riesco a registrare. Riprova.';
      }
    });
    pannello.appendChild(errore);
    pannello.appendChild(btn);
    fondo.appendChild(pannello);
    document.body.appendChild(fondo);
  });
}

/**
 * Overlay bloccante quando non riesco a verificare le condizioni.
 * Si risolve solo con "Riprova"; "Esci" fa logout e porta al login.
 * @param {{ messaggio?: string, esci?: () => Promise<void> }} opts
 * @returns {Promise<void>}
 */
export function mostraErroreBloccante(opts) {
  const o = opts || {};
  return new Promise((resolve) => {
    const vecchio = document.getElementById('accettazione-legale-gate-errore');
    if (vecchio) vecchio.remove();
    const fondo = document.createElement('div');
    fondo.id = 'accettazione-legale-gate-errore';
    fondo.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;';
    const pannello = document.createElement('div');
    pannello.style.cssText = 'background:#fff;border-radius:12px;max-width:520px;width:100%;padding:24px;font:16px/1.4 system-ui,sans-serif;color:#1a1a1a;';
    const testo = document.createElement('p');
    testo.textContent = o.messaggio || 'Non riesco a verificare le condizioni di uso. Controlla la connessione e riprova.';
    pannello.appendChild(testo);
    const riprova = document.createElement('button');
    riprova.type = 'button';
    riprova.textContent = 'Riprova';
    riprova.style.cssText = 'margin:8px 8px 0 0;padding:12px 16px;background:#2E8B57;color:#fff;border:0;border-radius:8px;';
    riprova.addEventListener('click', () => {
      fondo.remove();
      resolve();
    });
    pannello.appendChild(riprova);
    if (typeof o.esci === 'function') {
      const esci = document.createElement('button');
      esci.type = 'button';
      esci.textContent = 'Esci';
      esci.style.cssText = 'margin-top:8px;padding:12px 16px;background:#fff;color:#1a1a1a;border:1px solid #ccc;border-radius:8px;';
      esci.addEventListener('click', () => {
        Promise.resolve(o.esci()).catch(() => {});
      });
      pannello.appendChild(esci);
    }
    fondo.appendChild(pannello);
    document.body.appendChild(fondo);
  });
}

async function esciVersoLogin(firebase) {
  try {
    await firebase.signOut(firebase.getAuthInstance());
  } catch (err) { /* ignore: si va comunque al login */ }
  let url = new URL('../auth/login-standalone.html', import.meta.url).href;
  try {
    const emu = await import('./firebase-emulator-dev.js');
    url = emu.withEmulatorQuery(url);
  } catch (err) { /* ignore */ }
  window.location.href = url;
}

/**
 * Tenant e ruoli per il gate: contesto della pagina, poi tenant corrente, poi campi legacy del doc utente.
 * @param {{ ruoli?: string[], tenantId?: string }|null|undefined} contesto
 * @param {object|null} userData
 * @param {string} tenantCorrente
 * @param {(data: object, tenantId: string) => string[]} [ruoliDaMembership]
 * @returns {{ tenantId: string, ruoli: string[] }}
 */
export function risolviTenantERuoli(contesto, userData, tenantCorrente, ruoliDaMembership) {
  const data = userData && typeof userData === 'object' ? userData : {};
  let tenantId = contesto && typeof contesto.tenantId === 'string' ? contesto.tenantId : '';
  if (!tenantId && typeof tenantCorrente === 'string') tenantId = tenantCorrente;
  if (!tenantId && typeof data.tenantId === 'string') tenantId = data.tenantId;
  let ruoli = contesto && Array.isArray(contesto.ruoli) && contesto.ruoli.length ? contesto.ruoli : [];
  if (!ruoli.length && tenantId && typeof ruoliDaMembership === 'function') {
    ruoli = ruoliDaMembership(data, tenantId) || [];
  }
  if (!ruoli.length && Array.isArray(data.ruoli) && (!tenantId || data.tenantId === tenantId)) ruoli = data.ruoli;
  return { tenantId, ruoli };
}

export async function avviaDaFirebase(contesto) {
  const firebase = await import('../services/firebase-service.js');
  const esci = () => esciVersoLogin(firebase);
  const mostraErrore = () => mostraErroreBloccante({ esci });
  for (;;) {
    try {
      return await avviaUnaVolta(contesto, firebase, mostraErrore);
    } catch (err) {
      console.warn('[accettazione-legale] verifica non riuscita, ingresso bloccato');
      await mostraErrore(err);
    }
  }
}

async function avviaUnaVolta(contesto, firebase, mostraErrore) {
  const config = contesto && contesto.config;
  const auth = firebase.getAuthInstance();
  let user = auth.currentUser;
  if (!user) {
    user = await new Promise((resolve) => {
      const stop = firebase.onAuthStateChanged(auth, (trovato) => {
        stop();
        resolve(trovato || null);
      });
    });
  }
  if (!user) return { mostrato: false };
  let ruoli = contesto && contesto.ruoli;
  let tenantId = contesto && contesto.tenantId;
  if (!Array.isArray(ruoli) || !ruoli.length || !tenantId) {
    const snap = await firebase.getDoc(firebase.doc(firebase.getDb(), 'users', user.uid));
    if (!snap.exists()) return { mostrato: false };
    const data = snap.data() || {};
    let tenantCorrente = '';
    let ruoliDaMembership = null;
    try {
      const tenantService = await import('../services/tenant-service.js');
      tenantCorrente = tenantService.getCurrentTenantId() || '';
      ruoliDaMembership = tenantService.getUserRolesFromData;
    } catch (err) { /* fallback legacy sotto */ }
    if (tenantCorrente && !(data.tenantId === tenantCorrente
      || (data.tenantMemberships && Object.prototype.hasOwnProperty.call(data.tenantMemberships, tenantCorrente)))) {
      tenantCorrente = '';
    }
    const risolti = risolviTenantERuoli(contesto, data, tenantCorrente, ruoliDaMembership);
    ruoli = risolti.ruoli;
    tenantId = risolti.tenantId;
  }
  if (canalePerRuoli(ruoli) && !tenantId) {
    throw new Error('azienda corrente non trovata');
  }
  let aziendaNome = contesto && typeof contesto.aziendaNome === 'string' ? contesto.aziendaNome : '';
  if (!aziendaNome.trim() && tenantId) {
    try {
      const tenantSnap = await firebase.getDoc(firebase.doc(firebase.getDb(), 'tenants', tenantId));
      if (tenantSnap.exists()) aziendaNome = (tenantSnap.data() && tenantSnap.data().nome) || '';
    } catch (err) {
      aziendaNome = '';
    }
  }
  const callable = firebase.getHttpsCallable('registraAccettazioniLegali');
  return eseguiGate({
    attiva: true,
    configOk: true,
    ruoli,
    config,
    mostraErrore,
    leggiStato: async () => {
      const res = await callable({ azione: 'stato', tenantId });
      const data = res && res.data;
      return (data && data.documenti) || [];
    },
    mostra: (piano) => mostraOverlay({
      piano,
      tenantId,
      aziendaNome,
      config,
      registra: (payload) => callable(Object.assign({ azione: 'registra' }, payload))
    })
  });
}
