/**
 * Sospensione operativa di un lavoro (maltempo / guasto / altro).
 * Distinta dallo standby assenza (`in_standby`, campi `standby*`).
 *
 * Stati sospendibili: allineati al Caposquadra (`isLavoroStatoSospendibile`:
 * assegnato | in_corso | attivo). `attivo` è incluso perché il Capo lo tratta
 * come sospendibile e le rules del manager non lo vietano. Il service storico
 * accettava solo assegnato | in_corso.
 * Esclusi: da_pianificare (non è un segmento già in campo), sospeso,
 * in_standby, completato, completato_da_approvare, annullato.
 *
 * UX motivo «Altro»: la nota è obbligatoria (niente conferma extra).
 * Maltempo e Guasto: la nota è facoltativa e, se c'è, viene concatenata.
 *
 * @module core/services/lavoro-sospensione
 */

/** @type {readonly ['assegnato', 'in_corso', 'attivo']} */
export const STATI_LAVORO_SOSPENDIBILI = Object.freeze(['assegnato', 'in_corso', 'attivo']);

/**
 * @param {string|null|undefined} stato
 * @returns {boolean}
 */
export function isLavoroStatoSospendibile(stato) {
  const s = String(stato || 'assegnato').trim();
  return STATI_LAVORO_SOSPENDIBILI.includes(s);
}

/**
 * @param {string} motivo maltempo | guasto | altro
 * @param {string} [note]
 * @returns {string} Causa pronta per `sospensioneCausa`, oppure '' se non valida
 */
export function formatSospensioneCausa(motivo, note) {
  const key = String(motivo || '').trim().toLowerCase();
  const nota = String(note || '').trim();
  if (key === 'maltempo') return nota ? `Maltempo: ${nota}` : 'Maltempo';
  if (key === 'guasto') return nota ? `Guasto: ${nota}` : 'Guasto';
  if (key === 'altro') return nota ? `Altro: ${nota}` : '';
  return '';
}

/**
 * @param {string} motivo
 * @param {string} [note]
 * @returns {{ ok: boolean, error: string, causa: string }}
 */
export function validateSospensioneInput(motivo, note) {
  const key = String(motivo || '').trim().toLowerCase();
  const nota = String(note || '').trim();
  if (!key) {
    return {
      ok: false,
      error: 'Seleziona il motivo della sospensione (maltempo, guasto o altro).',
      causa: ''
    };
  }
  if (key === 'altro' && !nota) {
    return {
      ok: false,
      error: 'Per il motivo Altro scrivi una nota.',
      causa: ''
    };
  }
  const causa = formatSospensioneCausa(key, nota);
  if (!causa) {
    return { ok: false, error: 'Motivo di sospensione non valido.', causa: '' };
  }
  return { ok: true, error: '', causa };
}

/**
 * Ricostruisce motivo/nota da una `sospensioneCausa` già salvata.
 * Il testo libero del Caposquadra (prompt) resta in nota, motivo «altro»,
 * senza riscriverlo finché l'utente non cambia i campi.
 * @param {string} causa
 * @returns {{ motivo: string, note: string }}
 */
export function parseSospensioneCausa(causa) {
  const raw = String(causa || '').trim();
  if (!raw) return { motivo: '', note: '' };
  const match = raw.match(/^(Maltempo|Guasto|Altro)\s*(?::\s*([\s\S]*))?$/i);
  if (match) {
    return { motivo: match[1].toLowerCase(), note: String(match[2] || '').trim() };
  }
  return { motivo: 'altro', note: raw };
}

/**
 * Patch Firestore della sospensione operativa. Non include campi standby.
 * @param {string} causa
 * @param {Date} [now]
 * @returns {{ ok: true, patch: { stato: 'sospeso', sospensioneCausa: string, sospensioneIl: Date, aggiornatoIl: Date } } | { ok: false, error: string, patch: null }}
 */
export function buildSospendiLavoroPatch(causa, now = new Date()) {
  const causaTesto = String(causa || '').trim();
  if (!causaTesto) {
    return { ok: false, error: 'Motivo della sospensione obbligatorio', patch: null };
  }
  return {
    ok: true,
    patch: {
      stato: 'sospeso',
      sospensioneCausa: causaTesto,
      sospensioneIl: now,
      aggiornatoIl: now
    }
  };
}

/**
 * Campi da aggiungere al save del modal Modifica quando lo stato è sospeso.
 * Se lo stato non è sospeso, `fields` è null: non si inventano campi standby.
 * `writeSospensioneIl` è true solo su transizione fresca o se il timestamp manca.
 * @param {{ nuovoStato?: string, statoPrecedente?: string|null, motivo?: string, note?: string, sospensioneCausaEsistente?: string, hasSospensioneIl?: boolean }} input
 * @returns {{ ok: true, fields: { sospensioneCausa: string, writeSospensioneIl: boolean } | null } | { ok: false, error: string, fields: null }}
 */
export function sospensioneFieldsForModificaSave(input = {}) {
  if (input.nuovoStato !== 'sospeso') {
    const avevaSospensione = input.statoPrecedente === 'sospeso'
      || String(input.sospensioneCausaEsistente || '').trim().length > 0
      || !!input.hasSospensioneIl;
    if (avevaSospensione) {
      return { ok: true, fields: { clearSospensione: true } };
    }
    return { ok: true, fields: null };
  }

  const statoPrecedente = input.statoPrecedente || null;
  const transizioneFresca = statoPrecedente !== 'sospeso';
  const causaEsistente = String(input.sospensioneCausaEsistente || '').trim();
  const motivo = String(input.motivo || '').trim().toLowerCase();
  const nota = String(input.note || '').trim();
  const parsed = parseSospensioneCausa(causaEsistente);
  const invariata = !transizioneFresca
    && !!causaEsistente
    && parsed.motivo === motivo
    && parsed.note === nota;

  if (invariata) {
    return {
      ok: true,
      fields: {
        sospensioneCausa: causaEsistente,
        writeSospensioneIl: !input.hasSospensioneIl
      }
    };
  }

  const check = validateSospensioneInput(motivo, nota);
  if (!check.ok) {
    return { ok: false, error: check.error, fields: null };
  }
  return {
    ok: true,
    fields: {
      sospensioneCausa: check.causa,
      writeSospensioneIl: transizioneFresca || !input.hasSospensioneIl
    }
  };
}
