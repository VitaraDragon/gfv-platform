/**
 * Chi può segnare una zona lavorata.
 * Puro: nessun import Firebase. La stessa decisione sta nelle regole di zoneLavorate.
 */

export const MSG_ZONA_NON_PERMESSA =
  'Su questo lavoro le zone le segna il caposquadra (o il manager).';

/**
 * @param {*} value
 * @returns {string}
 */
export function idPulito(value) {
  if (value == null) return '';
  return String(value).trim();
}

/**
 * @param {{ ruoli?: string[] }|null|undefined} user
 * @returns {string[]}
 */
function ruoliDi(user) {
  if (!user || !Array.isArray(user.ruoli)) return [];
  return user.ruoli
    .map((ruolo) => String(ruolo || '').toLowerCase().replace(/\s+/g, ''))
    .filter(Boolean);
}

/**
 * uid oppure id: se differiscono valgono entrambi.
 * @param {{ uid?: string, id?: string }|null|undefined} user
 * @returns {string[]}
 */
function identitaUtente(user) {
  if (!user || typeof user !== 'object') return [];
  const ids = [];
  for (const raw of [user.uid, user.id]) {
    const id = idPulito(raw);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * @param {*} value
 * @param {{ uid?: string, id?: string }|null|undefined} user
 * @returns {boolean}
 */
function stessoId(value, user) {
  const target = idPulito(value);
  if (!target) return false;
  return identitaUtente(user).includes(target);
}

/**
 * Lavoro autonomo per le zone: caposquadraId assente o vuoto.
 * Se il capo è valorizzato, il lavoro è di squadra anche se c'è anche operaioId.
 * @param {object|null|undefined} lavoro
 * @returns {boolean}
 */
export function isLavoroAutonomoPerZone(lavoro) {
  if (!lavoro || typeof lavoro !== 'object') return false;
  return idPulito(lavoro.caposquadraId) === '';
}

/**
 * Sostituto su un lavoro autonomo: ruolo operaio e assenzaSostitutoOperaioId uguale all'utente.
 * Nessuna finestra di validità: il campo resta finché qualcuno non lo cambia.
 * @param {object|null|undefined} lavoro
 * @param {object|null|undefined} user
 * @returns {boolean}
 */
export function isSostitutoSuLavoroAutonomo(lavoro, user) {
  if (!isLavoroAutonomoPerZone(lavoro)) return false;
  if (!ruoliDi(user).includes('operaio')) return false;
  return stessoId(lavoro.assenzaSostitutoOperaioId, user);
}

/**
 * Manager o amministratore; caposquadra del lavoro di squadra;
 * operaio sul proprio autonomo o sostituto indicato su un autonomo.
 * @param {object|null|undefined} lavoro
 * @param {object|null|undefined} user
 * @returns {boolean}
 */
export function puoSegnareZona(lavoro, user) {
  if (!lavoro || !user) return false;
  const ruoli = ruoliDi(user);
  if (ruoli.includes('manager') || ruoli.includes('amministratore')) return true;
  const capoId = idPulito(lavoro.caposquadraId);
  if (capoId) {
    return ruoli.includes('caposquadra') && stessoId(capoId, user);
  }
  if (!ruoli.includes('operaio')) return false;
  return stessoId(lavoro.operaioId, user) || stessoId(lavoro.assenzaSostitutoOperaioId, user);
}
