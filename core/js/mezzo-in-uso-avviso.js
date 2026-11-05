/**
 * Avviso «mezzo già in uso» per Diario e Gestione lavori.
 * Il mezzo resta selezionabile: solo etichetta, avviso sotto la tendina, conferma al salvataggio.
 *
 * @module core/js/mezzo-in-uso-avviso
 */

/**
 * @param {object|null|undefined} macchina
 * @returns {boolean}
 */
export function isMezzoInUso(macchina) {
  if (!macchina) return false;
  const stato = String(macchina.stato || '').toLowerCase().trim().replace(/_/g, '-');
  return stato === 'in-uso';
}

/**
 * Etichetta opzione tendina: «Nome — in uso» se in uso, altrimenti testo base.
 * @param {string} etichettaBase
 * @param {object|null|undefined} macchina
 * @returns {string}
 */
export function etichettaOpzioneMezzo(etichettaBase, macchina) {
  const base = String(etichettaBase || '').trim() || 'Mezzo';
  if (!isMezzoInUso(macchina)) return base;
  return `${base} — in uso`;
}

/**
 * Attività/lavoro che tiene il mezzo in uso (senza fine / in corso).
 * @param {string} mezzoId
 * @param {{ attivita?: Array, lavori?: Array, escludiAttivitaId?: string|null, escludiLavoroId?: string|null }} [opts]
 * @returns {{ tipo: 'attivita'|'lavoro', id: string, titolo: string, data: string|null, orario: string|null }|null}
 */
export function trovaUtilizzoMezzo(mezzoId, opts = {}) {
  const id = String(mezzoId || '').trim();
  if (!id) return null;
  const escludiAtt = opts.escludiAttivitaId ? String(opts.escludiAttivitaId) : null;
  const escludiLav = opts.escludiLavoroId ? String(opts.escludiLavoroId) : null;

  const attivita = Array.isArray(opts.attivita) ? opts.attivita : [];
  for (const a of attivita) {
    if (!a || (escludiAtt && String(a.id) === escludiAtt)) continue;
    const stessoMezzo = String(a.macchinaId || '') === id || String(a.attrezzoId || '') === id;
    if (!stessoMezzo) continue;
    // In corso: senza orario fine
    if (a.orarioFine) continue;
    const tipoLavoro = a.tipoLavoro || a.nome || 'Attività';
    const terreno = a.terrenoNome ? ` – ${a.terrenoNome}` : '';
    return {
      tipo: 'attivita',
      id: String(a.id || ''),
      titolo: `${tipoLavoro}${terreno}`,
      data: a.data || null,
      orario: a.orarioInizio || null
    };
  }

  const lavori = Array.isArray(opts.lavori) ? opts.lavori : [];
  for (const l of lavori) {
    if (!l || (escludiLav && String(l.id) === escludiLav)) continue;
    const stessoMezzo = String(l.macchinaId || '') === id || String(l.attrezzoId || '') === id;
    if (!stessoMezzo) continue;
    const stato = String(l.stato || '').toLowerCase();
    if (stato === 'completato' || stato === 'annullato' || stato === 'cancellato') continue;
    return {
      tipo: 'lavoro',
      id: String(l.id || ''),
      titolo: l.nome || l.tipoLavoro || 'Lavoro',
      data: l.dataInizio || l.data || null,
      orario: l.orarioInizio || null
    };
  }
  return null;
}

function formatDataIt(data) {
  if (!data) return null;
  const s = String(data);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

/**
 * @param {{ titolo?: string, data?: string|null, orario?: string|null }|null} utilizzo
 * @param {'trattore'|'attrezzo'} [tipoMezzo]
 * @returns {string}
 */
export function messaggioAvvisoMezzoInUso(utilizzo, tipoMezzo = 'trattore') {
  const label = tipoMezzo === 'attrezzo' ? 'attrezzo' : 'trattore';
  if (!utilizzo) {
    return `Questo ${label} risulta già in uso.`;
  }
  const dove = utilizzo.tipo === 'lavoro' ? 'nel lavoro' : "nell'attività";
  let msg = `Questo ${label} è già in uso ${dove} "${utilizzo.titolo}"`;
  const dataIt = formatDataIt(utilizzo.data);
  if (dataIt && utilizzo.orario) {
    msg += ` (dal ${dataIt} alle ${utilizzo.orario})`;
  } else if (dataIt) {
    msg += ` (dal ${dataIt})`;
  } else if (utilizzo.orario) {
    msg += ` (dalle ${utilizzo.orario})`;
  }
  msg += `. Se è un errore, chiudi quell'${utilizzo.tipo === 'lavoro' ? 'lavoro' : 'attività'} mettendo l'ora di fine.`;
  return msg;
}

/**
 * @param {string} nomeMezzo
 * @param {'trattore'|'attrezzo'} [tipoMezzo]
 * @returns {string}
 */
export function messaggioConfermaMezzoInUso(nomeMezzo, tipoMezzo = 'trattore') {
  const label = tipoMezzo === 'attrezzo' ? 'L\'attrezzo' : 'Il trattore';
  const nome = String(nomeMezzo || '').trim() || (tipoMezzo === 'attrezzo' ? 'selezionato' : 'selezionato');
  return `${label} ${nome} è già in uso in un'altra attività. Salvo lo stesso?`;
}

/**
 * True se il mezzo in uso appartiene già all'attività/lavoro in modifica → niente avviso.
 * @param {string} mezzoId
 * @param {{ macchinaIdCorrente?: string|null, attrezzoIdCorrente?: string|null }} [corrente]
 */
export function mezzoGiaDellEntitaInModifica(mezzoId, corrente = {}) {
  const id = String(mezzoId || '').trim();
  if (!id) return false;
  return String(corrente.macchinaIdCorrente || '') === id
    || String(corrente.attrezzoIdCorrente || '') === id;
}

/**
 * Assicura un elemento avviso subito sotto il select.
 * @param {HTMLElement} selectEl
 * @param {string} [avvisoId]
 * @returns {HTMLElement|null}
 */
export function ensureAvvisoElement(selectEl, avvisoId) {
  if (!selectEl || !selectEl.parentElement) return null;
  const id = avvisoId || `${selectEl.id || 'mezzo'}-in-uso-avviso`;
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.setAttribute('role', 'status');
    el.style.cssText = 'display:none;margin-top:6px;padding:8px 10px;background:#fff8e6;border:1px solid #e6c35c;border-radius:6px;color:#6b5200;font-size:13px;';
    selectEl.parentElement.insertBefore(el, selectEl.nextSibling);
  }
  return el;
}

/**
 * Aggiorna l'avviso sotto la tendina in base alla selezione.
 * @param {HTMLSelectElement|null} selectEl
 * @param {object|null} macchina
 * @param {{ utilizzo?: object|null, tipoMezzo?: 'trattore'|'attrezzo', silenzioso?: boolean, avvisoId?: string }} [opts]
 */
export function aggiornaAvvisoSottoTendina(selectEl, macchina, opts = {}) {
  const el = ensureAvvisoElement(selectEl, opts.avvisoId);
  if (!el) return;
  if (opts.silenzioso || !isMezzoInUso(macchina)) {
    el.style.display = 'none';
    el.textContent = '';
    return;
  }
  el.textContent = messaggioAvvisoMezzoInUso(opts.utilizzo || null, opts.tipoMezzo || 'trattore');
  el.style.display = 'block';
}

/**
 * Se il mezzo scelto è in uso altrove, chiede conferma. OK → true (salva), Annulla → false.
 * @param {object|null|undefined} macchina
 * @param {{ utilizzo?: object|null, tipoMezzo?: 'trattore'|'attrezzo', silenzioso?: boolean, confirmFn?: Function }} [opts]
 * @returns {boolean}
 */
export function confermaSalvataggioMezzoInUso(macchina, opts = {}) {
  if (!macchina || opts.silenzioso || !isMezzoInUso(macchina)) return true;
  const msg = messaggioConfermaMezzoInUso(macchina.nome || '', opts.tipoMezzo || 'trattore');
  const confirmFn = typeof opts.confirmFn === 'function' ? opts.confirmFn : (typeof confirm === 'function' ? confirm : () => true);
  return !!confirmFn(msg);
}
