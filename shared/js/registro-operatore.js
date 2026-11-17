/**
 * Operatore della scheda trattamento: tendina operai e caposquadra, più «Altro».
 * Stessa fonte di Gestione Lavori: users del tenant, ruolo operaio o caposquadra, stato attivo.
 * In salvataggio resta il nome visibile, come già fa il registro dopo Completa.
 * @module shared/js/registro-operatore
 */

export const OPERATORE_ALTRO = '__altro__';

export function nomeVisibileOperatore(persona) {
  if (!persona) return '';
  const nome = `${persona.nome || ''} ${persona.cognome || ''}`.trim();
  return nome || persona.email || (persona.id ? String(persona.id) : '');
}

/** Caposquadra del lavoro, altrimenti operaio. Senza assegnatario: null. */
export function operatoreDaLavoro(lavoro) {
  if (!lavoro || typeof lavoro !== 'object') return null;
  const id = lavoro.caposquadraId || lavoro.operaioId || null;
  return id ? String(id) : null;
}

/** Operai e caposquadra, senza doppioni sullo stesso id. */
export function unisciOperatori(operai, caposquadra) {
  const map = new Map();
  [...(caposquadra || []), ...(operai || [])].forEach((persona) => {
    if (!persona || !persona.id || map.has(String(persona.id))) return;
    map.set(String(persona.id), persona);
  });
  return Array.from(map.values()).sort((a, b) => (
    nomeVisibileOperatore(a).localeCompare(nomeVisibileOperatore(b), 'it')
  ));
}

/**
 * Un valore già salvato: id utente, nome visibile, oppure testo libero.
 * @returns {{ tipo: 'vuoto'|'elenco'|'altro', id: string, testo: string }}
 */
export function riconosciOperatore(valore, persone) {
  const raw = String(valore == null ? '' : valore).trim();
  const lista = Array.isArray(persone) ? persone : [];
  if (!raw) return { tipo: 'vuoto', id: '', testo: '' };
  const perId = lista.find((p) => p && String(p.id) === raw);
  if (perId) return { tipo: 'elenco', id: String(perId.id), testo: nomeVisibileOperatore(perId) };
  const basso = raw.toLowerCase();
  const perNome = lista.find((p) => nomeVisibileOperatore(p).toLowerCase() === basso);
  if (perNome) return { tipo: 'elenco', id: String(perNome.id), testo: nomeVisibileOperatore(perNome) };
  return { tipo: 'altro', id: '', testo: raw };
}

/** Se il valore è un id sconosciuto, prova a risolverlo in nome prima di trattarlo come testo libero. */
export async function preparaValoreOperatore(valore, persone, risolviNome) {
  const primo = riconosciOperatore(valore, persone);
  if (primo.tipo === 'vuoto') return '';
  if (primo.tipo === 'elenco') return primo.id;
  if (typeof risolviNome === 'function' && valore && !/\s/.test(String(valore))) {
    try {
      const nome = await risolviNome(String(valore));
      if (nome && nome !== valore) {
        const secondo = riconosciOperatore(nome, persone);
        if (secondo.tipo === 'elenco') return secondo.id;
        return String(nome);
      }
    } catch (err) {
      /* resta il testo già riconosciuto */
    }
  }
  return primo.testo;
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function preparaCampoOperatore(root) {
  const el = root.getElementById('trattamento-operatore');
  if (!el) return null;
  let select = el;
  if (el.tagName !== 'SELECT') {
    select = root.createElement('select');
    select.id = 'trattamento-operatore';
    if (el.required) select.required = true;
    el.replaceWith(select);
  }
  let altro = root.getElementById('trattamento-operatore-altro');
  if (!altro) {
    altro = root.createElement('input');
    altro.type = 'text';
    altro.id = 'trattamento-operatore-altro';
    altro.placeholder = 'Nome operatore';
    altro.style.marginTop = '6px';
    altro.style.display = 'none';
    select.insertAdjacentElement('afterend', altro);
  }
  altro.autocomplete = 'off';
  if (select.dataset.operatoreBound !== '1') {
    select.dataset.operatoreBound = '1';
    select.addEventListener('change', () => {
      const campo = root.getElementById('trattamento-operatore-altro');
      if (!campo) return;
      campo.style.display = select.value === OPERATORE_ALTRO ? '' : 'none';
    });
  }
  return select;
}

export function riempiTendinaOperatore(persone, valore, root = document) {
  const select = preparaCampoOperatore(root);
  if (!select) return null;
  const scelta = riconosciOperatore(valore, persone);
  const righe = ['<option value="">— Seleziona —</option>'];
  (persone || []).forEach((persona) => {
    if (!persona || !persona.id) return;
    righe.push(`<option value="${esc(persona.id)}">${esc(nomeVisibileOperatore(persona))}</option>`);
  });
  righe.push(`<option value="${OPERATORE_ALTRO}">Altro</option>`);
  select.innerHTML = righe.join('');
  const altro = root.getElementById('trattamento-operatore-altro');
  if (scelta.tipo === 'elenco') {
    select.value = scelta.id;
    if (altro) {
      altro.value = '';
      altro.style.display = 'none';
    }
  } else if (scelta.tipo === 'altro') {
    select.value = OPERATORE_ALTRO;
    if (altro) {
      altro.value = scelta.testo;
      altro.style.display = '';
    }
  } else {
    select.value = '';
    if (altro) {
      altro.value = '';
      altro.style.display = 'none';
    }
  }
  return scelta;
}

/** Nome visibile da registrare. Con «Altro» è il testo libero. */
export function leggiOperatoreDalForm(root = document) {
  const el = root.getElementById('trattamento-operatore');
  if (!el) return '';
  if (el.tagName !== 'SELECT') return String(el.value || '').trim();
  if (el.value === OPERATORE_ALTRO) {
    return String(root.getElementById('trattamento-operatore-altro')?.value || '').trim();
  }
  if (!el.value) return '';
  const opt = el.options[el.selectedIndex];
  return opt ? String(opt.textContent || '').trim() : '';
}

/** users/{id} → «nome cognome», altrimenti email o l'id. */
export async function risolviNomeUtente(userId) {
  if (!userId || typeof userId !== 'string') return '';
  try {
    const { getDb, getDoc, doc } = await import('../../core/services/firebase-service.js');
    const db = getDb();
    if (!db) return userId;
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return userId;
    const u = userDoc.data() || {};
    return `${(u.nome || '').trim()} ${(u.cognome || '').trim()}`.trim() || u.email || userId;
  } catch (err) {
    return userId;
  }
}

/**
 * Stesse query di loadOperai e loadCaposquadra in Gestione Lavori.
 * @returns {Promise<Array>}
 */
export async function caricaOperatoriAzienda() {
  const { getDb, collection, query, getDocs, where } = await import('../../core/services/firebase-service.js');
  const { getCurrentTenantId } = await import('../../core/services/tenant-service.js');
  const db = getDb();
  const tenantId = getCurrentTenantId();
  if (!db || !tenantId) return [];
  const usersRef = collection(db, 'users');
  const leggi = async (ruolo) => {
    const q = query(
      usersRef,
      where('tenantId', '==', tenantId),
      where('ruoli', 'array-contains', ruolo),
      where('stato', '==', 'attivo')
    );
    const snap = await getDocs(q);
    const out = [];
    snap.forEach((item) => out.push({ id: item.id, ...item.data() }));
    return out;
  };
  const [operai, caposquadra] = await Promise.all([leggi('operaio'), leggi('caposquadra')]);
  return unisciOperatori(operai, caposquadra);
}

export async function mostraOperatoreNelForm(valore, opzioni = {}) {
  const root = opzioni.root || document;
  let persone = opzioni.persone;
  if (!persone) {
    try {
      persone = await caricaOperatoriAzienda();
    } catch (err) {
      persone = [];
    }
  }
  const risolvi = opzioni.risolviNome === null ? null : (opzioni.risolviNome || risolviNomeUtente);
  const pronto = await preparaValoreOperatore(valore, persone, risolvi);
  return riempiTendinaOperatore(persone, pronto, root);
}
