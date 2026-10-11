/**
 * Ri-accettazione al primo ingresso. Con il flag spento non chiama la rete e non disegna nulla.
 * Le pagine importano questo file solo se il flag è acceso.
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
 * @param {{ attiva?: boolean, configOk?: boolean, ruoli?: string[], config?: object, leggiStato?: () => Promise<Array<{tipo?: string, versione?: string}>>, mostra?: (piano: object) => Promise<void> }} opts
 */
export async function eseguiGate(opts) {
  const prima = pianoGate(Object.assign({}, opts, { accettazioni: [] }));
  if (!prima.chiamare || typeof opts.leggiStato !== 'function') {
    return { mostrato: false };
  }
  const accettazioni = await opts.leggiStato();
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

export async function avviaDaFirebase(contesto) {
  const config = contesto && contesto.config;
  const firebase = await import('../services/firebase-service.js');
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
    if (!Array.isArray(ruoli) || !ruoli.length) ruoli = data.ruoli || [];
    if (!tenantId) tenantId = data.tenantId || '';
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
    leggiStato: async () => {
      const res = await callable({ azione: 'stato' });
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
