/**
 * Migrazione dati Manodopera — decisioni pure, senza Firestore.
 * Attivazione: attività di Diario → lavori. Disattivazione: lavori → storico Diario.
 * Non cancella attività, lavori, operai o squadre.
 *
 * Euristica stato (il modello Diario non ha un flag «aperta»):
 * - stato esplicito chiuso/completato, oppure chiusa/completata === true → lavoro completato
 * - stato esplicito aperto/in_corso, oppure aperta/inCorso === true → lavoro in_corso
 * - data di oggi e senza chiusura (né flag di chiusura né orarioFine) → in_corso
 * - altrimenti → completato
 * Un'attività di un giorno passato senza orarioFine è quindi completato: la chiusura
 * manca, ma non è «oggi».
 *
 * Date: validateLavoroMigrazione non applica il limite di Lavoro.validate
 * «data inizio non più di un anno fa». Lo storico del Diario va copiato anche se è più vecchio.
 * validateAttivitaMigrazione non applica il rifiuto delle date future di Attivita.validate:
 * si conserva il giorno del lavoro.
 *
 * @module core/services/manodopera-migrazione-logic
 */

export const ORIGINE_ATTIVITA_VERSO_LAVORO = 'attivita→lavoro';
export const ORIGINE_LAVORO_VERSO_ATTIVITA = 'lavoro→attivita';
export const ETICHETTA_STORICO_PRE_MANODOPERA = 'storico pre-Manodopera';
export const NOME_LAVORO_FALLBACK = 'Attività migrata';
export const COLTURA_FALLBACK = 'Non specificata';
export const ORARIO_DEFAULT_INIZIO = '08:00';
export const ORARIO_DEFAULT_FINE = '12:00';
export const SOGLIA_SPINNER_MIGRAZIONE = 20;

const STATI_LAVORO = [
  'da_pianificare',
  'assegnato',
  'in_corso',
  'in_standby',
  'sospeso',
  'completato',
  'completato_da_approvare',
  'annullato'
];

const STATI_ATTIVITA_CHIUSI = new Set(['completata', 'completato', 'chiusa', 'chiuso']);
const STATI_ATTIVITA_APERTI = new Set(['aperta', 'aperto', 'in_corso', 'in corso']);
const STATI_LAVORO_CHIUSI = new Set(['completato', 'annullato']);
const TIME_RE = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

/**
 * @param {number} n
 * @returns {string}
 */
export function messaggioLavoriAperti(n) {
  const count = Number(n) || 0;
  return `Hai ${count} lavori ancora aperti: chiudili o li vedrai solo in storico.`;
}

/**
 * @param {boolean} prima Manodopera era nell'array effettivo
 * @param {boolean} dopo Manodopera è nell'array effettivo
 * @returns {'attivazione'|'disattivazione'|null}
 */
export function direzioneManodopera(prima, dopo) {
  const before = !!prima;
  const after = !!dopo;
  if (!before && after) return 'attivazione';
  if (before && !after) return 'disattivazione';
  return null;
}

/**
 * @param {Date} [data]
 * @returns {string} YYYY-MM-DD nel fuso locale
 */
export function isoOggi(data = new Date()) {
  const d = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * @param {*} value
 * @returns {string} YYYY-MM-DD oppure stringa vuota
 */
export function aIsoData(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : isoOggi(parsed);
  }
  if (value instanceof Date) return isoOggi(value);
  if (typeof value.toDate === 'function') {
    try {
      return isoOggi(value.toDate());
    } catch (err) {
      return '';
    }
  }
  if (typeof value.seconds === 'number') {
    return isoOggi(new Date(value.seconds * 1000));
  }
  return '';
}

/**
 * @param {object|null|undefined} lavoro
 * @returns {boolean}
 */
export function isLavoroAperto(lavoro) {
  const stato = testo(lavoro && lavoro.stato).toLowerCase();
  if (!stato) return true;
  return !STATI_LAVORO_CHIUSI.has(stato);
}

/**
 * @param {Array<object>|null|undefined} lavori
 * @returns {number}
 */
export function contaLavoriAperti(lavori) {
  return (Array.isArray(lavori) ? lavori : []).filter(isLavoroAperto).length;
}

/**
 * @param {number} documenti
 * @returns {boolean}
 */
export function serveSpinnerMigrazione(documenti) {
  return Number(documenti) >= SOGLIA_SPINNER_MIGRAZIONE;
}

/**
 * @param {object} report
 * @returns {string}
 */
export function formatToastMigrazione(report) {
  if (!report || report.baseline || report.unchanged || report.needsConfirm || report.aborted) {
    return '';
  }
  const n = report.creati || 0;
  const m = report.skipped || 0;
  const k = report.solaLettura || 0;
  if (n + m + k === 0 && !(report.errori > 0)) return '';
  let msg = `Migrazione dati: ${n} creati, ${m} già collegati, ${k} in sola lettura.`;
  if (report.errori > 0) msg += ` ${report.errori} da riprovare.`;
  return msg;
}

/**
 * @param {object} attivita
 * @param {string} [oggi] YYYY-MM-DD
 * @returns {boolean}
 */
export function attivitaAperta(attivita, oggi) {
  const row = attivita || {};
  const stato = testo(row.stato).toLowerCase();
  if (STATI_ATTIVITA_CHIUSI.has(stato)) return false;
  if (STATI_ATTIVITA_APERTI.has(stato)) return true;
  if (row.chiusa === true || row.completata === true) return false;
  if (row.aperta === true || row.inCorso === true) return true;
  const data = aIsoData(row.data);
  const today = oggi || isoOggi();
  if (data && data === today && !haChiusura(row)) return true;
  return false;
}

/**
 * @param {object} attivita
 * @returns {'tipo-altro'|'ct-incompleto'|'campi-vuoti'|null}
 */
export function motivoSolaLetturaAttivita(attivita) {
  const row = attivita || {};
  if (isTipoAltro(row.tipoLavoro)) return 'tipo-altro';
  if (isContoTerziIncompleto(row)) return 'ct-incompleto';
  if (!testo(row.terrenoId) || !testo(row.tipoLavoro) || !aIsoData(row.data)) return 'campi-vuoti';
  return null;
}

/**
 * @param {object} attivita
 * @returns {string}
 */
export function nomeLavoroDaAttivita(attivita) {
  const tipo = testo(attivita && attivita.tipoLavoro);
  const terreno = testo(attivita && attivita.terrenoNome);
  let nome = '';
  if (tipo.length >= 3) nome = tipo;
  else if (tipo && terreno) nome = `${tipo} ${terreno}`.trim();
  else if (terreno.length >= 3) nome = terreno;
  if (nome.length < 3) nome = NOME_LAVORO_FALLBACK;
  if (nome.length > 100) nome = nome.slice(0, 100).trim();
  if (nome.length < 3) nome = NOME_LAVORO_FALLBACK;
  return nome;
}

/**
 * @param {object} attivita
 * @returns {string}
 */
export function noteLavoroDaAttivita(attivita) {
  const row = attivita || {};
  const pezzi = [];
  const originale = testo(row.note);
  if (originale) pezzi.push(originale);
  pezzi.push(ETICHETTA_STORICO_PRE_MANODOPERA);
  const riepilogo = [];
  if (testo(row.coltura)) riepilogo.push(`Coltura: ${testo(row.coltura)}`);
  if (testo(row.orarioInizio) || testo(row.orarioFine)) {
    riepilogo.push(`Orari: ${testo(row.orarioInizio) || '—'}–${testo(row.orarioFine) || '—'}`);
  }
  if (row.oreNette !== undefined && row.oreNette !== null && row.oreNette !== '') {
    riepilogo.push(`Ore nette: ${row.oreNette}`);
  }
  if (row.pauseMinuti !== undefined && row.pauseMinuti !== null && row.pauseMinuti !== '') {
    riepilogo.push(`Pause: ${row.pauseMinuti} min`);
  }
  if (riepilogo.length) pezzi.push(riepilogo.join(' · '));
  return pezzi.join('\n');
}

/**
 * Validazione del lavoro creato in migrazione.
 * Non applica il controllo «più di un anno fa» di Lavoro.validate.
 * @param {object} lavoro
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateLavoroMigrazione(lavoro) {
  const errors = [];
  const row = lavoro || {};
  const nome = testo(row.nome);
  if (!nome) errors.push('Nome lavoro obbligatorio');
  else if (nome.length < 3) errors.push('Nome lavoro deve essere di almeno 3 caratteri');
  else if (nome.length > 100) errors.push('Nome lavoro non può superare 100 caratteri');
  if (!testo(row.terrenoId)) errors.push('Terreno obbligatorio');
  if (row.caposquadraId && row.operaioId) {
    errors.push('Un lavoro non può essere assegnato sia a un caposquadra che a un operaio diretto');
  }
  if (!testo(row.tipoLavoro)) errors.push('Tipo lavoro obbligatorio');
  if (!row.dataInizio) errors.push('Data inizio obbligatoria');
  const durata = row.durataPrevista;
  if (durata === null || durata === undefined || durata === '') {
    errors.push('Durata prevista obbligatoria');
  } else if (Number(durata) < 1) {
    errors.push('Durata prevista deve essere almeno 1 giorno');
  } else if (Number(durata) > 365) {
    errors.push('Durata prevista non può superare 365 giorni');
  }
  if (row.stato && !STATI_LAVORO.includes(row.stato)) {
    errors.push('Stato non valido');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * @param {object} attivita
 * @param {{ oggi?: string, adesso?: string }} [ctx]
 * @returns {{ solaLettura: true, motivo: string, errori?: string[] }|{ solaLettura: false, lavoro: object }}
 */
export function costruisciLavoroDaAttivita(attivita, ctx = {}) {
  const motivo = motivoSolaLetturaAttivita(attivita);
  if (motivo) return { solaLettura: true, motivo };
  const oggi = ctx.oggi || isoOggi();
  const lavoro = {
    nome: nomeLavoroDaAttivita(attivita),
    terrenoId: testo(attivita.terrenoId),
    tipoLavoro: testo(attivita.tipoLavoro),
    clienteId: testo(attivita.clienteId) || null,
    macchinaId: testo(attivita.macchinaId) || null,
    attrezzoId: testo(attivita.attrezzoId) || null,
    dataInizio: aIsoData(attivita.data),
    durataPrevista: 1,
    stato: attivitaAperta(attivita, oggi) ? 'in_corso' : 'completato',
    note: noteLavoroDaAttivita(attivita),
    caposquadraId: null,
    operaioId: null,
    assegnazioneEtichetta: ETICHETTA_STORICO_PRE_MANODOPERA,
    migratoDaAttivitaId: attivita.id,
    origineMigrazione: ORIGINE_ATTIVITA_VERSO_LAVORO,
    migratoIl: ctx.adesso || new Date().toISOString()
  };
  const validation = validateLavoroMigrazione(lavoro);
  if (!validation.valid) {
    return { solaLettura: true, motivo: 'validazione', errori: validation.errors };
  }
  return { solaLettura: false, lavoro };
}

/**
 * @param {object} lavoro
 * @param {object|null|undefined} terreno
 * @returns {string}
 */
export function colturaDaLavoro(lavoro, terreno) {
  const candidati = [
    lavoro && lavoro.coltura,
    terreno && terreno.coltura,
    terreno && terreno.colturaSottocategoria,
    terreno && terreno.colturaCategoria
  ];
  for (let i = 0; i < candidati.length; i += 1) {
    if (testo(candidati[i])) return testo(candidati[i]);
  }
  return COLTURA_FALLBACK;
}

/**
 * Non applica il rifiuto «data futura» di Attivita.validate.
 * @param {object} attivita
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateAttivitaMigrazione(attivita) {
  const errors = [];
  const row = attivita || {};
  if (!aIsoData(row.data)) errors.push('Data attività obbligatoria');
  if (!testo(row.terrenoId)) errors.push('Terreno obbligatorio');
  if (!testo(row.terrenoNome)) errors.push('Nome terreno obbligatorio');
  if (!testo(row.tipoLavoro)) errors.push('Tipo lavoro obbligatorio');
  if (!testo(row.coltura)) errors.push('Coltura obbligatoria');
  if (!orariValidi(testo(row.orarioInizio), testo(row.orarioFine))) errors.push('Orari non validi');
  return { valid: errors.length === 0, errors };
}

/**
 * @param {object} lavoro
 * @param {{ terreno?: object, adesso?: string }} [ctx]
 * @returns {{ solaLettura: true, motivo: string, errori?: string[] }|{ solaLettura: false, attivita: object }}
 */
export function costruisciAttivitaDaLavoro(lavoro, ctx = {}) {
  const row = lavoro || {};
  const dataIso = aIsoData(row.dataInizio);
  if (!dataIso) return { solaLettura: true, motivo: 'senza-data' };
  if (!testo(row.terrenoId)) return { solaLettura: true, motivo: 'senza-terreno' };
  const terreno = ctx.terreno || null;
  const terrenoNome = testo(row.terrenoNome) || testo(terreno && terreno.nome) || 'Terreno';
  const tipo = testo(row.tipoLavoro) || testo(row.nome) || 'Lavoro migrato';
  let inizio = testo(row.orarioInizio);
  let fine = testo(row.orarioFine);
  let orariDefault = false;
  if (!orariValidi(inizio, fine)) {
    inizio = ORARIO_DEFAULT_INIZIO;
    fine = ORARIO_DEFAULT_FINE;
    orariDefault = true;
  }
  const pauseRaw = Number(row.pauseMinuti);
  const pause = Number.isFinite(pauseRaw) && pauseRaw >= 0 ? pauseRaw : 0;
  const notePezzi = [];
  if (testo(row.note)) notePezzi.push(testo(row.note));
  if (testo(row.stato).toLowerCase() === 'annullato') {
    notePezzi.push('Lavoro annullato: copiato nello storico del Diario. Il lavoro non è stato cancellato.');
  }
  if (orariDefault) {
    notePezzi.push(
      `Orari non presenti sul lavoro: impostati di default in migrazione (${ORARIO_DEFAULT_INIZIO}–${ORARIO_DEFAULT_FINE}).`
    );
  }
  const attivita = {
    data: dataIso,
    terrenoId: testo(row.terrenoId),
    terrenoNome,
    tipoLavoro: tipo,
    coltura: colturaDaLavoro(row, terreno),
    orarioInizio: inizio,
    orarioFine: fine,
    pauseMinuti: pause,
    oreNette: oreNetteDaOrari(inizio, fine, pause),
    note: notePezzi.join('\n'),
    clienteId: testo(row.clienteId) || null,
    macchinaId: testo(row.macchinaId) || null,
    attrezzoId: testo(row.attrezzoId) || null,
    lavoroId: row.id,
    migratoDaLavoroId: row.id,
    origineMigrazione: ORIGINE_LAVORO_VERSO_ATTIVITA,
    migratoIl: ctx.adesso || new Date().toISOString()
  };
  const validation = validateAttivitaMigrazione(attivita);
  if (!validation.valid) {
    return { solaLettura: true, motivo: 'validazione', errori: validation.errors };
  }
  return { solaLettura: false, attivita };
}

function testo(value) {
  return String(value == null ? '' : value).trim();
}

function haChiusura(attivita) {
  if (attivita.chiusa === true || attivita.completata === true) return true;
  if (testo(attivita.orarioFine)) return true;
  return STATI_ATTIVITA_CHIUSI.has(testo(attivita.stato).toLowerCase());
}

function isTipoAltro(tipo) {
  return testo(tipo).toLowerCase() === 'altro';
}

function isContoTerziIncompleto(attivita) {
  const tipo = testo(attivita.tipoLavoro).toLowerCase();
  const cliente = testo(attivita.clienteId);
  const sembra = !!cliente
    || attivita.contoTerzi === true
    || tipo === 'lavoro conto terzi'
    || tipo === 'conto terzi';
  if (!sembra) return false;
  if (!cliente) return true;
  if (!testo(attivita.terrenoId)) return true;
  if (!testo(attivita.tipoLavoro)) return true;
  return false;
}

function orariValidi(inizio, fine) {
  if (!TIME_RE.test(inizio) || !TIME_RE.test(fine)) return false;
  const inizioParti = inizio.split(':').map(Number);
  const fineParti = fine.split(':').map(Number);
  return (fineParti[0] * 60 + fineParti[1]) > (inizioParti[0] * 60 + inizioParti[1]);
}

function oreNetteDaOrari(inizio, fine, pause) {
  const inizioParti = inizio.split(':').map(Number);
  const fineParti = fine.split(':').map(Number);
  const minuti = Math.max(
    0,
    (fineParti[0] * 60 + fineParti[1]) - (inizioParti[0] * 60 + inizioParti[1]) - (pause || 0)
  );
  return Math.round((minuti / 60) * 100) / 100;
}
